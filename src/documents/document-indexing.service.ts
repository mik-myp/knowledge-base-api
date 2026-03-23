import { OpenAIEmbeddings } from '@langchain/openai';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import { Document as LangChainDocument } from 'langchain';
import { Collection, Db } from 'mongodb';
import { Connection } from 'mongoose';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import { TEXT_UPLOAD_EXTENSIONS } from './documents.service';

type PrepareChunksInput = {
  userId: string;
  knowledgeBaseId: string;
  documentId: string;
  documentName: string;
  extension: string;
  content?: string;
  file?: Express.Multer.File;
};

export type PreparedChunk = {
  sequence: number;
  content: string;
  page?: number;
  startIndex?: number;
  endIndex?: number;
};

type SplitDocumentMetadata = {
  page?: number;
  loc?: {
    pageNumber?: number;
  };
};

@Injectable()
export class DocumentIndexingService {
  constructor(
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
    return (
      this.configService.get<string>('MONGODB_VECTOR_COLLECTION') ||
      'document_chunk_vectors'
    );
  }

  private getVectorIndexName(): string {
    return (
      this.configService.get<string>('MONGODB_VECTOR_INDEX') ||
      'document_chunk_vector_index'
    );
  }

  private getVectorCollection(): Collection {
    return this.db.collection(this.getVectorCollectionName());
  }

  private getEmbeddingBatchSize(): number {
    const configuredBatchSize = this.configService.get<number>(
      'OPENAI_EMBEDDING_BATCH_SIZE',
    );

    if (
      typeof configuredBatchSize === 'number' &&
      Number.isInteger(configuredBatchSize) &&
      configuredBatchSize > 0
    ) {
      return Math.min(configuredBatchSize, 10);
    }

    return 10;
  }

  private createEmbeddings() {
    return new OpenAIEmbeddings({
      model: this.configService.get<string>('OPENAI_EMBEDDING_MODEL'),
      apiKey: this.configService.get<string>('OPENAI_EMBEDDING_API_KEY'),
      batchSize: this.getEmbeddingBatchSize(),
      configuration: {
        baseURL: this.configService.get<string>('OPENAI_EMBEDDING_BASE_URL'),
      },
    });
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

    const embeddings = await this.createEmbeddings().embedDocuments(
      params.chunks.map((chunk) => chunk.content),
    );

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
  }) {
    const queryVector = await this.createEmbeddings().embedQuery(
      params.question,
    );

    return this.getVectorCollection()
      .aggregate([
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
      ])
      .toArray();
  }
}
