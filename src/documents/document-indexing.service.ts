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

/**
 * 负责文档分片、向量写入和语义检索的服务。
 */
@Injectable()
export class DocumentIndexingService {
  /**
   * 记录文档索引流程中的诊断日志。
   */
  private readonly logger = new Logger(DocumentIndexingService.name);

  constructor(
    private readonly langchainService: LangchainService,
    private readonly configService: ConfigService,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  /**
   * 获取当前 Mongoose 连接对应的 MongoDB 数据库实例。
   * @returns 返回已连接的 MongoDB 数据库对象。
   */
  private get db(): Db {
    if (!this.connection.db) {
      throw new Error('Mongo connection is not ready');
    }

    return this.connection.db;
  }

  /**
   * 获取向量集合名称。
   * @returns 返回向量数据所在的集合名称。
   */
  private getVectorCollectionName(): string {
    return process.env.MONGODB_VECTOR_COLLECTION || 'document_chunk_vectors';
  }

  /**
   * 获取向量索引名称。
   * @returns 返回 MongoDB 向量检索索引名称。
   */
  private getVectorIndexName(): string {
    return process.env.MONGODB_VECTOR_INDEX || 'document_chunk_vector_index';
  }

  /**
   * 读取指定阶段的超时配置。
   * @param key 配置项名称。
   * @param fallback 未配置时使用的默认超时时间。
   * @returns 返回最终生效的超时毫秒数。
   */
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

  /**
   * 获取问题向量生成阶段的超时时间。
   * @returns 返回问题向量生成的超时毫秒数。
   */
  private getEmbedQueryTimeoutMs(): number {
    return this.getStageTimeoutMs('EMBED_QUERY_TIMEOUT_MS', 12000);
  }

  /**
   * 获取向量检索阶段的超时时间。
   * @returns 返回向量检索的超时毫秒数。
   */
  private getVectorSearchTimeoutMs(): number {
    return this.getStageTimeoutMs('VECTOR_SEARCH_TIMEOUT_MS', 8000);
  }

  /**
   * 为异步任务增加超时保护。
   * @param task 需要执行的异步任务。
   * @param timeoutMs 超时时间，单位为毫秒。
   * @param errorMessage 超时后抛出的错误提示。
   * @returns 返回任务结果；若超时则抛出网关超时异常。
   */
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

  /**
   * 获取存放文档向量的 MongoDB 集合。
   * @returns 返回向量集合实例。
   */
  private getVectorCollection(): Collection {
    return this.db.collection(this.getVectorCollectionName());
  }

  /**
   * 将原始上传内容转换为 LangChain 文档对象。
   * @param params 文档分片准备参数。
   * @returns 返回后续分片步骤使用的 LangChain 文档数组。
   */
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

  /**
   * 按固定策略拆分文档内容。
   * @param documents 需要拆分的 LangChain 文档列表。
   * @returns 返回拆分后的文档片段列表。
   */
  private async splitDocuments(documents: LangChainDocument[]) {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    return splitter.splitDocuments(documents);
  }

  /**
   * 从分片元数据中提取页码信息。
   * @param metadata LangChain 分片附带的元数据。
   * @returns 返回页码；若不存在则返回 `undefined`。
   */
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

  /**
   * 为单个源文档构建可持久化的分片数据。
   * @param sourceText 源文档完整文本。
   * @param splitDocuments 拆分后的 LangChain 文档片段。
   * @param sequenceStart 当前文档片段的起始序号。
   * @returns 返回写入数据库前使用的分片结构列表。
   */
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

  /**
   * 生成文档分片数据。
   * @param params 文档分片准备参数。
   * @returns 返回可用于写入数据库和向量库的分片列表。
   */
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

  /**
   * 替换文档Vectors。
   * @param params 参数对象。
   * @param params.userId 当前用户 ID。
   * @param params.knowledgeBaseId 知识库 ID。
   * @param params.documentId 文档 ID。
   * @param params.documentName 文档Name。
   * @param params.chunks 分片数据列表。
   * @returns 返回 Promise，完成后无额外返回值。
   */
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

  /**
   * 删除文档已有的向量索引。
   * @param userId 当前用户 ID。
   * @param documentId 文档 ID。
   * @returns 删除完成后不返回额外内容。
   */
  async deleteDocumentVectors(
    userId: string,
    documentId: string,
  ): Promise<void> {
    await this.getVectorCollection().deleteMany({
      userId,
      documentId,
    });
  }

  /**
   * 在指定知识库内执行语义检索。
   * @param params 检索参数。
   * @param params.userId 当前用户 ID。
   * @param params.knowledgeBaseId 目标知识库 ID。
   * @param params.question 用户提出的问题。
   * @param params.topK 需要返回的最相关分片数量。
   * @param params.onProgress 可选的阶段回调，用于向外部报告检索进度。
   * @returns 返回按相关度排序的检索命中结果。
   */
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
