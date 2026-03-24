import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import {
  BadRequestException,
  GatewayTimeoutException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import { Document as LangChainDocument } from 'langchain';
import { Collection, Db } from 'mongodb';
import { Connection } from 'mongoose';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import { LangchainService } from 'src/langchain/langchain.service';
import type { VectorSearchHit } from 'src/langchain/types/langchain.types';
import { TEXT_UPLOAD_EXTENSIONS } from './documents.service';
import type {
  PrepareChunksInput,
  PreparedChunk,
  SplitDocumentMetadata,
} from './types/document-indexing.types';

@Injectable()
export class DocumentIndexingService {
  private readonly logger = new Logger(DocumentIndexingService.name);

  constructor(
    private readonly langchainService: LangchainService,
    private readonly configService: ConfigService,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  private get db(): Db {
    if (!this.connection.db) {
      throw new Error('Mongo connection is not ready');
    }

    return this.connection.db;
  }

  private getVectorCollectionName(): string {
    return process.env.MONGODB_VECTOR_COLLECTION || 'document_chunk_vectors';
  }

  private getVectorIndexName(): string {
    return process.env.MONGODB_VECTOR_INDEX || 'document_chunk_vector_index';
  }

  private getStageTimeoutMs(
    key: 'EMBED_QUERY_TIMEOUT_MS' | 'VECTOR_SEARCH_TIMEOUT_MS',
    fallback: number,
  ): number {
    const configuredValue = this.configService.get<string | number>(key);
    const normalizedValue =
      typeof configuredValue === 'number'
        ? configuredValue
        : Number(configuredValue);

    if (Number.isInteger(normalizedValue) && normalizedValue > 0) {
      return normalizedValue;
    }

    return fallback;
  }

  private getEmbedQueryTimeoutMs(): number {
    return this.getStageTimeoutMs('EMBED_QUERY_TIMEOUT_MS', 12000);
  }

  private getVectorSearchTimeoutMs(): number {
    return this.getStageTimeoutMs('VECTOR_SEARCH_TIMEOUT_MS', 8000);
  }

  private async withTimeout<T>(
    task: Promise<T>,
    timeoutMs: number,
    errorMessage: string,
  ): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
      return await Promise.race([
        task,
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => {
            reject(new GatewayTimeoutException(errorMessage));
          }, timeoutMs);
        }),
      ]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  private getVectorCollection(): Collection {
    return this.db.collection(this.getVectorCollectionName());
  }

  private async loadSourceDocuments(
    params: PrepareChunksInput,
  ): Promise<LangChainDocument[]> {
    if (TEXT_UPLOAD_EXTENSIONS.has(params.extension)) {
      return [
        new LangChainDocument({
          pageContent: params.content ?? '',
          metadata: {
            documentId: params.documentId,
            documentName: params.documentName,
          },
        }),
      ];
    }

    if (params.extension === 'pdf') {
      if (!params.file) {
        throw new BadRequestException('pdf 文件缺少原始文件内容');
      }

      const parser = new PDFParse({
        data: params.file.buffer,
      });

      try {
        const result = await parser.getText();

        return result.pages
          .filter((page) => page.text.trim().length > 0)
          .map(
            (page) =>
              new LangChainDocument({
                pageContent: page.text,
                metadata: {
                  documentId: params.documentId,
                  documentName: params.documentName,
                  page: page.num,
                },
              }),
          );
      } finally {
        await parser.destroy();
      }
    }

    if (params.extension === 'docx') {
      if (!params.file) {
        throw new BadRequestException('docx 文件缺少原始文件内容');
      }

      const result = await mammoth.extractRawText({
        buffer: params.file.buffer,
      });

      return [
        new LangChainDocument({
          pageContent: result.value,
          metadata: {
            documentId: params.documentId,
            documentName: params.documentName,
          },
        }),
      ];
    }

    if (params.extension === 'doc') {
      throw new BadRequestException('当前仅支持解析 docx，请先转换为 docx');
    }

    throw new BadRequestException(`不支持的扩展名: ${params.extension}`);
  }

  private async splitDocuments(documents: LangChainDocument[]) {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    return splitter.splitDocuments(documents);
  }

  private extractPageFromMetadata(
    metadata: SplitDocumentMetadata,
  ): number | undefined {
    if (typeof metadata.page === 'number') {
      return metadata.page;
    }

    if (typeof metadata.loc?.pageNumber === 'number') {
      return metadata.loc.pageNumber;
    }

    return undefined;
  }

  private buildPreparedChunksForSourceDocument(
    sourceText: string,
    splitDocuments: LangChainDocument[],
    sequenceStart: number,
  ): PreparedChunk[] {
    let searchCursor = 0;

    return splitDocuments.reduce<PreparedChunk[]>((chunks, document, index) => {
      const content = document.pageContent.trim();

      if (!content) {
        return chunks;
      }

      const startIndex = sourceText.indexOf(content, searchCursor);
      const fallbackStartIndex =
        startIndex >= 0 ? startIndex : sourceText.indexOf(content);
      const normalizedStartIndex =
        fallbackStartIndex >= 0 ? fallbackStartIndex : undefined;

      if (typeof normalizedStartIndex === 'number') {
        searchCursor = normalizedStartIndex + content.length;
      }

      chunks.push({
        sequence: sequenceStart + index,
        content,
        page: this.extractPageFromMetadata(
          document.metadata as SplitDocumentMetadata,
        ),
        startIndex: normalizedStartIndex,
        endIndex:
          typeof normalizedStartIndex === 'number'
            ? normalizedStartIndex + content.length
            : undefined,
      });

      return chunks;
    }, []);
  }

  async prepareChunks(params: PrepareChunksInput): Promise<PreparedChunk[]> {
    const sourceDocuments = await this.loadSourceDocuments(params);
    const chunks: PreparedChunk[] = [];

    for (const sourceDocument of sourceDocuments) {
      const splitDocuments = await this.splitDocuments([sourceDocument]);

      chunks.push(
        ...this.buildPreparedChunksForSourceDocument(
          sourceDocument.pageContent,
          splitDocuments,
          chunks.length,
        ),
      );
    }

    return chunks;
  }

  async replaceDocumentVectors(params: {
    userId: string;
    knowledgeBaseId: string;
    documentId: string;
    documentName: string;
    chunks: PreparedChunk[];
  }): Promise<void> {
    const collection = this.getVectorCollection();

    await collection.deleteMany({
      userId: params.userId,
      documentId: params.documentId,
    });

    if (!params.chunks.length) {
      return;
    }

    const embeddings = await this.langchainService
      .createEmbeddings()
      .embedDocuments(params.chunks.map((chunk) => chunk.content));

    await collection.insertMany(
      params.chunks.map((chunk, index) => {
        const payload: Record<string, number | string | number[]> = {
          userId: params.userId,
          knowledgeBaseId: params.knowledgeBaseId,
          documentId: params.documentId,
          documentName: params.documentName,
          sequence: chunk.sequence,
          text: chunk.content,
          embedding: embeddings[index],
        };

        if (typeof chunk.page === 'number') {
          payload.page = chunk.page;
        }

        if (typeof chunk.startIndex === 'number') {
          payload.startIndex = chunk.startIndex;
        }

        if (typeof chunk.endIndex === 'number') {
          payload.endIndex = chunk.endIndex;
        }

        return payload;
      }),
    );
  }

  async deleteDocumentVectors(
    userId: string,
    documentId: string,
  ): Promise<void> {
    await this.getVectorCollection().deleteMany({
      userId,
      documentId,
    });
  }

  async semanticSearch(params: {
    userId: string;
    knowledgeBaseId: string;
    question: string;
    topK: number;
    onProgress?: (
      stage: 'embedding' | 'vector_search' | 'processing_results',
    ) => void;
  }): Promise<VectorSearchHit[]> {
    const startedAt = Date.now();
    const embedTimeoutMs = this.getEmbedQueryTimeoutMs();
    const vectorSearchTimeoutMs = this.getVectorSearchTimeoutMs();

    params.onProgress?.('embedding');

    const embedStartedAt = Date.now();
    const queryVector = await this.withTimeout(
      this.langchainService.createEmbeddings().embedQuery(params.question),
      embedTimeoutMs,
      '生成问题向量超时，请稍后重试',
    );

    this.logger.log(
      `semanticSearch embedQuery completed in ${Date.now() - embedStartedAt}ms; knowledgeBaseId=${params.knowledgeBaseId}; topK=${params.topK}; questionLength=${params.question.length}`,
    );

    params.onProgress?.('vector_search');

    const vectorSearchStartedAt = Date.now();
    const hits = await this.withTimeout(
      this.getVectorCollection()
        .aggregate(
          [
            {
              $vectorSearch: {
                index: this.getVectorIndexName(),
                path: 'embedding',
                queryVector,
                numCandidates: Math.max(params.topK * 10, 50),
                limit: params.topK,
                filter: {
                  userId: params.userId,
                  knowledgeBaseId: params.knowledgeBaseId,
                },
              },
            },
            {
              $project: {
                _id: 0,
                documentId: 1,
                documentName: 1,
                sequence: 1,
                text: 1,
                page: 1,
                startIndex: 1,
                endIndex: 1,
                score: {
                  $meta: 'vectorSearchScore',
                },
              },
            },
          ],
          {
            maxTimeMS: vectorSearchTimeoutMs,
          },
        )
        .toArray() as Promise<VectorSearchHit[]>,
      vectorSearchTimeoutMs,
      '向量检索超时，请稍后重试',
    );

    this.logger.log(
      `semanticSearch vectorSearch completed in ${Date.now() - vectorSearchStartedAt}ms; knowledgeBaseId=${params.knowledgeBaseId}; hitCount=${hits.length}`,
    );

    params.onProgress?.('processing_results');

    this.logger.log(
      `semanticSearch finished in ${Date.now() - startedAt}ms; knowledgeBaseId=${params.knowledgeBaseId}; hitCount=${hits.length}`,
    );

    return hits;
  }
}
