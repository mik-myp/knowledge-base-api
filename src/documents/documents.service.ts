import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage } from 'mongoose';
import { ListDocumentsQueryDto } from './dto/list-documents-query.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';
import {
  Document,
  DocumentDocument,
  DocumentIndexStatus,
  DocumentSourceType,
} from './schemas/document.schema';
import { serializeMongoResult } from 'src/common/plugins/mongoose-serialize.plugin';
import {
  KnowledgeBase,
  KnowledgeBaseDocument,
} from 'src/knowledge_bases/schemas/knowledge_base.schema';
import { toObjectId } from 'src/common/utils/object-id.util';
import { StorageService } from 'src/storage/storage.service';
import { CreateEditorDocumentDto } from './dto/create-editor-document.dto';
import {
  DocumentChunk,
  DocumentChunkDocument,
} from './schemas/document_chunks.schema';
import { DocumentIndexingService } from './document-indexing.service';
import type {
  CreatedDocumentCleanupTarget,
  DocumentDownloadResult,
  RemoveByDocumentIdsResult,
  UploadSingleFileResult,
} from './types/documents.types';

/**
 * 记录系统允许上传的文档扩展名集合。
 */
const SUPPORTED_UPLOAD_EXTENSIONS = new Set(['pdf', 'docx', 'md', 'txt']);

/**
 * 记录可以直接按文本内容解析的扩展名集合。
 */
export const TEXT_UPLOAD_EXTENSIONS = new Set(['md', 'txt']);

/**
 * 负责文档相关业务处理的服务。
 */
@Injectable()
export class DocumentsService {
  /**
   * 记录文档相关流程日志。
   */
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    @InjectModel(KnowledgeBase.name)
    private readonly knowledgeBaseModel: Model<KnowledgeBaseDocument>,
    @InjectModel(Document.name)
    private readonly documentModel: Model<DocumentDocument>,
    @InjectModel(DocumentChunk.name)
    private readonly documentChunkModel: Model<DocumentChunkDocument>,
    private readonly storageService: StorageService,
    private readonly documentIndexingService: DocumentIndexingService,
  ) {}

  /**
   * 统计字符串中的扩展拉丁字符数量。
   * @param value 需要统计的字符串。
   * @returns 返回匹配到的扩展拉丁字符个数。
   */
  private countExtendedLatinCharacters(value: string): number {
    return (value.match(/[\u0080-\u00FF]/g) ?? []).length;
  }

  /**
   * 尝试修正上传文件名的乱码编码。
   * @param originalName 原始文件名。
   * @returns 返回更适合作为展示名称的文件名。
   */
  private normalizeOriginalName(originalName: string): string {
    if (!/[\u0080-\u00FF]/.test(originalName)) {
      return originalName;
    }

    const decodedName = Buffer.from(originalName, 'latin1').toString('utf8');

    if (decodedName.includes('\uFFFD')) {
      return originalName;
    }

    if (
      // eslint-disable-next-line no-control-regex
      /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/.test(decodedName)
    ) {
      return originalName;
    }

    return this.countExtendedLatinCharacters(decodedName) <
      this.countExtendedLatinCharacters(originalName)
      ? decodedName
      : originalName;
  }

  /**
   * 校验知识库访问权限。
   * @param userId 当前用户 ID。
   * @param knowledgeBaseId 知识库 ID。
   * @returns 返回 Promise，完成后无额外返回值。
   */
  private async ensureKnowledgeBaseAccess(
    userId: string,
    knowledgeBaseId: string,
  ): Promise<void> {
    const userObjectId = toObjectId(userId);
    const knowledgeBaseObjectId = toObjectId(knowledgeBaseId);
    const knowledgeBase = await this.knowledgeBaseModel
      .findOne({
        _id: knowledgeBaseObjectId,
        userId: userObjectId,
      })
      .select({ _id: 1 })
      .lean()
      .exec();

    if (!knowledgeBase) {
      throw new NotFoundException('知识库不存在');
    }
  }

  /**
   * 查询当前用户拥有的文档。
   * @param userId 当前用户 ID。
   * @param id 文档 ID。
   * @returns 返回当前用户可访问的文档记录。
   */
  private async findOwnedDocument(userId: string, id: string) {
    const userObjectId = toObjectId(userId);
    const documentObjectId = toObjectId(id);
    const document = await this.documentModel
      .findOne({
        _id: documentObjectId,
        userId: userObjectId,
      })
      .lean()
      .exec();

    if (!document) {
      throw new NotFoundException('文档不存在');
    }

    return document;
  }

  /**
   * 构建文档列表查询条件。
   * @param userId 当前用户 ID。
   * @param query 文档列表查询参数。
   * @returns 返回可直接传给 MongoDB 的筛选条件对象。
   */
  private buildDocumentFilters(
    userId: string,
    query: ListDocumentsQueryDto,
  ): Record<string, unknown> {
    const filters: Record<string, unknown> = {
      userId: toObjectId(userId),
    };

    if (query.knowledgeBaseId) {
      filters.knowledgeBaseId = toObjectId(query.knowledgeBaseId);
    }

    if (query.keyword) {
      filters.originalName = {
        $regex: this.escapeRegex(query.keyword),
        $options: 'i',
      };
    }

    return filters;
  }

  /**
   * 对正则关键字做转义，避免误匹配和性能风险。
   * @param value 原始搜索关键词。
   * @returns 返回可安全用于正则查询的字符串。
   */
  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * 构建文档列表聚合管道。
   * @param filters 文档筛选条件。
   * @returns 返回文档列表查询使用的聚合管道。
   */
  private buildFindAllDocumentsPipeline(
    filters: Record<string, unknown>,
  ): PipelineStage[] {
    return [
      {
        $match: filters,
      },
      {
        $lookup: {
          from: this.knowledgeBaseModel.collection.name,
          localField: 'knowledgeBaseId',
          foreignField: '_id',
          as: 'knowledgeBase',
        },
      },
      {
        $unwind: '$knowledgeBase',
      },
      {
        $addFields: {
          knowledgeBaseName: '$knowledgeBase.name',
        },
      },
    ];
  }

  /**
   * 提取文件扩展名。
   * @param originalName 原始文件名。
   * @returns 返回小写扩展名，缺失时返回 `other`。
   */
  private getFileExtension(originalName: string): string {
    return originalName.split('.').pop()?.toLowerCase() || 'other';
  }

  /**
   * 生成下载时使用的文件名。
   * @param originalName 文档原始名称。
   * @param extension 文档扩展名。
   * @returns 返回补齐扩展名后的文件名。
   */
  private buildDownloadFileName(
    originalName: string,
    extension: string,
  ): string {
    const normalizedExtension = extension.toLowerCase();

    if (!originalName) {
      return `document.${normalizedExtension}`;
    }

    return originalName.toLowerCase().endsWith(`.${normalizedExtension}`)
      ? originalName
      : `${originalName}.${normalizedExtension}`;
  }

  /**
   * 校验上传扩展名是否受支持。
   * @param extension 待校验的文件扩展名。
   * @returns 校验通过时不返回额外内容。
   */
  private assertSupportedUploadExtension(extension: string): void {
    if (!SUPPORTED_UPLOAD_EXTENSIONS.has(extension)) {
      throw new BadRequestException('当前仅支持上传 md、pdf、txt、docx 文件');
    }
  }

  /**
   * 校验在未配置对象存储时该扩展名是否允许上传。
   * @param extension 待校验的文件扩展名。
   * @returns 校验通过时不返回额外内容。
   */
  private assertUploadCanProceedWithoutStorage(extension: string): void {
    if (
      !this.storageService.isConfigured() &&
      !TEXT_UPLOAD_EXTENSIONS.has(extension)
    ) {
      throw new BadRequestException(
        '当前未配置对象存储，仅支持上传 md、txt 文件',
      );
    }
  }

  /**
   * 用新的分片内容替换文档已有分片。
   * @param userId 当前用户 ID。
   * @param knowledgeBaseId 知识库 ID。
   * @param documentId 文档 ID。
   * @param chunks 需要写入的分片数据列表。
   * @returns 分片替换完成后不返回额外内容。
   */
  private async replaceDocumentChunks(
    userId: string,
    knowledgeBaseId: string,
    documentId: string,
    chunks: Array<{
      content: string;
      page?: number;
      startIndex?: number;
      endIndex?: number;
    }>,
  ) {
    const userObjectId = toObjectId(userId);
    const knowledgeBaseObjectId = toObjectId(knowledgeBaseId);
    const documentObjectId = toObjectId(documentId);

    await this.documentChunkModel
      .deleteMany({
        userId: userObjectId,
        knowledgeBaseId: knowledgeBaseObjectId,
        documentId: documentObjectId,
      })
      .exec();

    if (!chunks.length) return;

    const payload = chunks.map((chunk, index) => {
      const item: {
        userId: ReturnType<typeof toObjectId>;
        knowledgeBaseId: ReturnType<typeof toObjectId>;
        documentId: ReturnType<typeof toObjectId>;
        sequence: number;
        content: string;
        page?: number;
        startIndex?: number;
        endIndex?: number;
      } = {
        userId: userObjectId,
        knowledgeBaseId: knowledgeBaseObjectId,
        documentId: documentObjectId,
        sequence: index,
        content: chunk.content,
      };

      if (typeof chunk.page === 'number') {
        item.page = chunk.page;
      }

      if (typeof chunk.startIndex === 'number') {
        item.startIndex = chunk.startIndex;
      }

      if (typeof chunk.endIndex === 'number') {
        item.endIndex = chunk.endIndex;
      }

      return item;
    });

    await this.documentChunkModel.insertMany(payload);
  }

  /**
   * 删除文档对应的全部分片记录。
   * @param userId 当前用户 ID。
   * @param documentId 文档 ID。
   * @returns 删除完成后不返回额外内容。
   */
  private async deleteDocumentChunks(userId: string, documentId: string) {
    await this.documentChunkModel
      .deleteMany({
        userId: toObjectId(userId),
        documentId: toObjectId(documentId),
      })
      .exec();
  }

  /**
   * 删除文档的分片索引和向量索引。
   * @param userId 当前用户 ID。
   * @param documentId 文档 ID。
   * @returns 索引清理完成后不返回额外内容。
   */
  private async removeDocumentIndex(userId: string, documentId: string) {
    await this.deleteDocumentChunks(userId, documentId);
    await this.documentIndexingService.deleteDocumentVectors(
      userId,
      documentId,
    );
  }

  /**
   * 删除Created文档记录。
   * @param userId 当前用户 ID。
   * @param documentId 文档 ID。
   * @returns 返回 Promise，完成后无额外返回值。
   */
  private async deleteCreatedDocumentRecord(
    userId: string,
    documentId: string,
  ): Promise<void> {
    await this.documentModel
      .deleteMany({
        _id: toObjectId(documentId),
        userId: toObjectId(userId),
      })
      .exec();
  }

  /**
   * 回滚单个已创建文档的存储和索引数据。
   * @param userId 当前用户 ID。
   * @param target 需要清理的文档记录、索引和存储对象信息。
   * @returns 回滚完成后不返回额外数据。
   */
  private async rollbackCreatedDocument(
    userId: string,
    target: CreatedDocumentCleanupTarget,
  ): Promise<void> {
    const cleanupErrors: Error[] = [];

    if (target.documentId) {
      try {
        await this.removeDocumentIndex(userId, target.documentId);
      } catch (error) {
        cleanupErrors.push(
          error instanceof Error ? error : new Error('删除文档索引失败'),
        );
      }

      try {
        await this.deleteCreatedDocumentRecord(userId, target.documentId);
      } catch (error) {
        cleanupErrors.push(
          error instanceof Error ? error : new Error('删除文档记录失败'),
        );
      }
    }

    if (target.storageKey && this.storageService.isConfigured()) {
      try {
        await this.storageService.deleteFile(target.storageKey);
      } catch (error) {
        cleanupErrors.push(
          error instanceof Error ? error : new Error('删除对象存储文件失败'),
        );
      }
    }

    if (cleanupErrors.length > 0) {
      throw cleanupErrors[0];
    }
  }

  /**
   * 批量回滚一组已创建文档。
   * @param userId 当前用户 ID。
   * @param targets 需要依次清理的文档目标列表。
   * @returns 回滚完成后不返回额外数据。
   */
  private async rollbackCreatedDocuments(
    userId: string,
    targets: CreatedDocumentCleanupTarget[],
  ): Promise<void> {
    const results = await Promise.allSettled(
      targets
        .slice()
        .reverse()
        .map((target) => this.rollbackCreatedDocument(userId, target)),
    );

    const rejectedResult = results.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );

    if (rejectedResult) {
      throw rejectedResult.reason instanceof Error
        ? rejectedResult.reason
        : new Error('批量回滚上传文件失败');
    }
  }

  /**
   * 同步重建文档的分片索引和向量索引。
   * @param params 索引构建参数。
   * @param params.userId 当前用户 ID。
   * @param params.knowledgeBaseId 知识库 ID。
   * @param params.documentId 文档 ID。
   * @param params.documentName 文档名称。
   * @param params.extension 文档扩展名。
   * @param params.content 纯文本内容，文本类文件时可直接提供。
   * @param params.file 原始上传文件，二进制解析场景下使用。
   * @returns 索引同步完成后不返回额外数据。
   */
  private async syncDocumentIndex(params: {
    userId: string;
    knowledgeBaseId: string;
    documentId: string;
    documentName: string;
    extension: string;
    content?: string;
    file?: Express.Multer.File;
  }) {
    const chunks = await this.documentIndexingService.prepareChunks(params);
    await this.ensureDocumentStillExists(params.userId, params.documentId);

    await this.replaceDocumentChunks(
      params.userId,
      params.knowledgeBaseId,
      params.documentId,
      chunks,
    );
    await this.ensureDocumentStillExists(params.userId, params.documentId);

    await this.documentIndexingService.replaceDocumentVectors({
      userId: params.userId,
      knowledgeBaseId: params.knowledgeBaseId,
      documentId: params.documentId,
      documentName: params.documentName,
      chunks,
    });
  }

  /**
   * 确认索引中的文档仍然存在。
   * @param userId 当前用户 ID。
   * @param documentId 文档 ID。
   * @returns 如果文档存在则继续，否则抛出异常。
   */
  private async ensureDocumentStillExists(
    userId: string,
    documentId: string,
  ): Promise<void> {
    const document = await this.documentModel
      .findOne({
        _id: toObjectId(documentId),
        userId: toObjectId(userId),
      })
      .select({ _id: 1 })
      .lean()
      .exec();

    if (!document) {
      throw new NotFoundException('文档不存在，索引任务已终止');
    }
  }

  /**
   * 更新文档索引状态。
   * @param userId 当前用户 ID。
   * @param documentId 文档 ID。
   * @param status 索引状态。
   * @param indexingError 最近一次索引错误，可选。
   * @returns 更新完成后不返回额外数据。
   */
  private async updateDocumentIndexStatus(params: {
    userId: string;
    documentId: string;
    status: DocumentIndexStatus;
    indexingError?: string;
  }): Promise<void> {
    await this.documentModel
      .findOneAndUpdate(
        {
          _id: toObjectId(params.documentId),
          userId: toObjectId(params.userId),
        },
        {
          $set: {
            indexStatus: params.status,
            indexingError: params.indexingError?.trim() || undefined,
          },
        },
        {
          runValidators: false,
        },
      )
      .exec();
  }

  /**
   * 将索引错误转换为适合展示的文本。
   * @param error 错误对象。
   * @returns 返回索引失败文案。
   */
  private resolveIndexingErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim()) {
      return error.message.trim();
    }

    return '文档索引失败';
  }

  /**
   * 启动后台索引任务。
   * @param params 索引参数。
   * @returns 返回 Promise，完成后不返回额外数据。
   */
  private async runDocumentIndexing(params: {
    userId: string;
    knowledgeBaseId: string;
    documentId: string;
    documentName: string;
    extension: string;
    content?: string;
    file?: Express.Multer.File;
  }): Promise<void> {
    await this.updateDocumentIndexStatus({
      userId: params.userId,
      documentId: params.documentId,
      status: DocumentIndexStatus.Indexing,
    });

    try {
      await this.syncDocumentIndex(params);
      await this.updateDocumentIndexStatus({
        userId: params.userId,
        documentId: params.documentId,
        status: DocumentIndexStatus.Success,
      });
    } catch (error) {
      const errorMessage = this.resolveIndexingErrorMessage(error);

      try {
        await this.removeDocumentIndex(params.userId, params.documentId);
      } catch (cleanupError) {
        this.logger.error(
          `清理失败的文档索引时出错; documentId=${params.documentId}; message=${this.resolveIndexingErrorMessage(cleanupError)}`,
          cleanupError instanceof Error ? cleanupError.stack : undefined,
        );
      }

      await this.updateDocumentIndexStatus({
        userId: params.userId,
        documentId: params.documentId,
        status: DocumentIndexStatus.Failed,
        indexingError: errorMessage,
      });

      this.logger.error(
        `文档索引失败; documentId=${params.documentId}; message=${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * 以后台任务方式触发文档索引。
   * @param params 索引参数。
   * @returns 触发完成后不返回额外数据。
   */
  private queueDocumentIndexing(params: {
    userId: string;
    knowledgeBaseId: string;
    documentId: string;
    documentName: string;
    extension: string;
    content?: string;
    file?: Express.Multer.File;
  }): void {
    void this.runDocumentIndexing(params).catch((error: unknown) => {
      this.logger.error(
        `后台文档索引任务异常退出; documentId=${params.documentId}; message=${this.resolveIndexingErrorMessage(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    });
  }

  /**
   * 删除文档记录。
   * @param userId 当前用户 ID。
   * @param documentId 文档 ID。
   * @returns 删除完成后不返回额外数据。
   */
  private async deleteDocumentRecord(
    userId: string,
    documentId: string,
  ): Promise<void> {
    await this.documentModel
      .deleteMany({
        _id: toObjectId(documentId),
        userId: toObjectId(userId),
      })
      .exec();
  }

  /**
   * 清理文档关联的对象存储和索引数据。
   * @param userId 当前用户 ID。
   * @param params 清理参数。
   * @param params.documentId 文档 ID。
   * @param params.storageKey 对象存储 key，可选。
   * @returns 清理完成后不返回额外数据。
   */
  private async cleanupDocumentArtifacts(
    userId: string,
    params: {
      documentId: string;
      storageKey?: string;
    },
  ): Promise<void> {
    if (params.storageKey && this.storageService.isConfigured()) {
      await this.storageService.deleteFile(params.storageKey);
    }

    await this.removeDocumentIndex(userId, params.documentId);
  }

  /**
   * 按已查询到的文档记录执行安全删除。
   * @param userId 当前用户 ID。
   * @param document 需要删除的文档记录。
   * @returns 删除完成后不返回额外数据。
   */
  private async removeDocumentByRecord(
    userId: string,
    document: {
      id: string;
      storageKey?: string;
    },
  ): Promise<void> {
    await this.cleanupDocumentArtifacts(userId, {
      documentId: document.id,
      storageKey: document.storageKey,
    });
    await this.deleteDocumentRecord(userId, document.id);
  }

  /**
   * 上传单个文件并建立索引。
   * @param userId 当前用户 ID。
   * @param file 单个上传文件。
   * @param uploadDocument 上传参数，包含知识库归属信息。
   * @returns 返回单个文件上传后的清理信息和序列化文档结果。
   */
  private async uploadSingleFile(
    userId: string,
    file: Express.Multer.File,
    uploadDocument: UploadDocumentDto,
  ): Promise<UploadSingleFileResult> {
    const userObjectId = toObjectId(userId);
    const knowledgeBaseObjectId = toObjectId(uploadDocument.knowledgeBaseId);
    const normalizedOriginalName = this.normalizeOriginalName(
      file.originalname,
    );
    const normalizedFile: Express.Multer.File = {
      ...file,
      originalname: normalizedOriginalName,
    };

    const extension = this.getFileExtension(normalizedOriginalName);
    const content = TEXT_UPLOAD_EXTENSIONS.has(extension)
      ? normalizedFile.buffer.toString('utf8')
      : undefined;
    const folder = `${userId}-${uploadDocument.knowledgeBaseId}`;
    let storageKey: string | undefined;
    let documentId: string | undefined;

    try {
      storageKey = this.storageService.isConfigured()
        ? await this.storageService.uploadFile(normalizedFile, folder)
        : undefined;

      const newDocument = new this.documentModel({
        userId: userObjectId,
        knowledgeBaseId: knowledgeBaseObjectId,
        sourceType: DocumentSourceType.Upload,
        storageKey,
        content,
        originalName: normalizedOriginalName,
        mimeType: normalizedFile.mimetype,
        size: file.size,
        extension,
        indexStatus: DocumentIndexStatus.Pending,
      });

      await newDocument.save();
      documentId = newDocument.id;

      this.queueDocumentIndexing({
        userId,
        knowledgeBaseId: uploadDocument.knowledgeBaseId,
        documentId,
        documentName: normalizedOriginalName,
        extension,
        content,
        file: normalizedFile,
      });

      return {
        cleanupTarget: {
          documentId,
          storageKey,
        },
        serializedDocument: serializeMongoResult(newDocument.toObject()),
      };
    } catch (error) {
      await this.rollbackCreatedDocument(userId, {
        documentId,
        storageKey,
      });

      throw error;
    }
  }

  /**
   * 批量上传文件并为每个文档建立索引。
   * @param userId 当前用户 ID。
   * @param files 上传的文件列表。
   * @param uploadDocument 上传参数，包含目标知识库 ID。
   * @returns 返回上传成功后的文档记录列表。
   */
  async upload(
    userId: string,
    files: Array<Express.Multer.File>,
    uploadDocument: UploadDocumentDto,
  ) {
    await this.ensureKnowledgeBaseAccess(
      userId,
      uploadDocument.knowledgeBaseId,
    );

    if (!files?.length) {
      throw new BadRequestException('至少上传一个文件');
    }

    files.forEach((file) => {
      const normalizedOriginalName = this.normalizeOriginalName(
        file.originalname,
      );
      const extension = this.getFileExtension(normalizedOriginalName);
      this.assertSupportedUploadExtension(extension);
      this.assertUploadCanProceedWithoutStorage(extension);
    });

    const uploadedDocuments: UploadSingleFileResult[] = [];

    try {
      for (const file of files) {
        const uploadedDocument = await this.uploadSingleFile(
          userId,
          file,
          uploadDocument,
        );
        uploadedDocuments.push(uploadedDocument);
      }

      return uploadedDocuments.map(
        (uploadedDocument) => uploadedDocument.serializedDocument,
      );
    } catch (error) {
      await this.rollbackCreatedDocuments(
        userId,
        uploadedDocuments.map(
          (uploadedDocument) => uploadedDocument.cleanupTarget,
        ),
      );

      throw error;
    }
  }

  /**
   * 创建在线编辑文档并建立索引。
   * @param userId 当前用户 ID。
   * @param editorDocument 编辑器文档内容和所属知识库信息。
   * @returns 返回新建后的文档记录。
   */
  async createEditorDocument(
    userId: string,
    editorDocument: CreateEditorDocumentDto,
  ) {
    await this.ensureKnowledgeBaseAccess(
      userId,
      editorDocument.knowledgeBaseId,
    );

    const userObjectId = toObjectId(userId);
    const knowledgeBaseObjectId = toObjectId(editorDocument.knowledgeBaseId);
    let documentId: string | undefined;

    try {
      const document = new this.documentModel({
        userId: userObjectId,
        knowledgeBaseId: knowledgeBaseObjectId,
        sourceType: DocumentSourceType.Editor,
        content: editorDocument.content,
        originalName: editorDocument.name,
        extension: 'md',
        mimeType: 'text/markdown',
        size: Buffer.byteLength(editorDocument.content, 'utf8'),
        indexStatus: DocumentIndexStatus.Pending,
      });

      await document.save();
      documentId = document.id;

      this.queueDocumentIndexing({
        userId,
        knowledgeBaseId: editorDocument.knowledgeBaseId,
        documentId,
        documentName: document.originalName,
        extension: document.extension,
        content: editorDocument.content,
      });

      return serializeMongoResult(document.toObject());
    } catch (error) {
      await this.rollbackCreatedDocument(userId, {
        documentId,
      });

      throw error;
    }
  }

  /**
   * 分页查询文档列表。
   * @param userId 当前用户 ID。
   * @param query 文档列表查询参数。
   * @returns 返回文档列表和总数。
   */
  async findAll(userId: string, query: ListDocumentsQueryDto) {
    const { page = 1, pageSize = 10 } = query;
    const skip = (page - 1) * pageSize;
    const filters = this.buildDocumentFilters(userId, query);
    const basePipeline = this.buildFindAllDocumentsPipeline(filters);

    const [dataList, totalResult] = await Promise.all([
      this.documentModel
        .aggregate([
          ...basePipeline,
          {
            $sort: {
              createdAt: -1,
            },
          },
          {
            $skip: skip,
          },
          {
            $limit: pageSize,
          },
          {
            $project: {
              knowledgeBase: 0,
              content: 0,
            },
          },
        ])
        .exec(),
      this.documentModel
        .aggregate<{ total: number }>([
          ...basePipeline,
          {
            $count: 'total',
          },
        ])
        .exec(),
    ]);

    return {
      dataList,
      total: totalResult[0]?.total ?? 0,
    };
  }

  /**
   * 查询单个文档详情。
   * @param userId 当前用户 ID。
   * @param id 文档 ID。
   * @returns 返回序列化后的文档详情。
   */
  async findOne(userId: string, id: string) {
    const document = await this.findOwnedDocument(userId, id);
    return serializeMongoResult(document);
  }

  /**
   * 获取文档原始文件的下载内容。
   * @param userId 当前用户 ID。
   * @param id 文档 ID。
   * @returns 返回下载所需的文件名、媒体类型和二进制内容。
   */
  async download(userId: string, id: string): Promise<DocumentDownloadResult> {
    const document = await this.findOwnedDocument(userId, id);
    const fileName = this.buildDownloadFileName(
      String(document.originalName ?? ''),
      String(document.extension ?? 'txt'),
    );

    if (typeof document.storageKey === 'string' && document.storageKey) {
      const { body, contentType } = await this.storageService.downloadFile(
        document.storageKey,
      );

      return {
        fileName,
        mimeType:
          typeof contentType === 'string' && contentType.trim()
            ? contentType
            : String(document.mimeType),
        content: body,
      };
    }

    if (typeof document.content === 'string') {
      return {
        fileName,
        mimeType: String(document.mimeType),
        content: Buffer.from(document.content, 'utf8'),
      };
    }

    throw new NotFoundException('原文件不存在');
  }

  /**
   * 删除单个文档及其索引。
   * @param userId 当前用户 ID。
   * @param id 文档 ID。
   * @returns 返回被删除的文档记录。
   */
  async remove(userId: string, id: string) {
    const document = await this.documentModel
      .findOne({
        _id: toObjectId(id),
        userId: toObjectId(userId),
      })
      .exec();

    if (!document) {
      throw new NotFoundException('文档不存在');
    }

    await this.removeDocumentByRecord(userId, {
      id: document.id,
      storageKey: document.storageKey,
    });

    return serializeMongoResult(document.toObject());
  }

  /**
   * 按文档 ID 列表批量删除文档。
   * @param userId 当前用户 ID。
   * @param documentIds 需要删除的文档 ID 列表。
   * @returns 返回删除数量和成功删除的文档 ID 列表。
   */
  async removeByDocumentIds(
    userId: string,
    documentIds: string[],
  ): Promise<RemoveByDocumentIdsResult> {
    const normalizedDocumentIds = Array.from(
      new Set(documentIds.filter(Boolean)),
    );

    if (!normalizedDocumentIds.length) {
      return {
        deletedCount: 0,
        deletedIds: [],
      };
    }

    const userObjectId = toObjectId(userId);
    const documentObjectIds = normalizedDocumentIds.map((id) => toObjectId(id));

    const documents = await this.documentModel
      .find({
        _id: {
          $in: documentObjectIds,
        },
        userId: userObjectId,
      })
      .select({
        _id: 1,
        storageKey: 1,
      })
      .exec();

    if (!documents.length) {
      return {
        deletedCount: 0,
        deletedIds: [],
      };
    }

    const deletedIds: string[] = [];

    for (const document of documents) {
      try {
        await this.removeDocumentByRecord(userId, {
          id: document.id,
          storageKey: document.storageKey,
        });
        deletedIds.push(document.id);
      } catch (error) {
        this.logger.error(
          `批量删除文档失败; documentId=${document.id}; message=${this.resolveIndexingErrorMessage(error)}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }

    return {
      deletedCount: deletedIds.length,
      deletedIds,
    };
  }
}
