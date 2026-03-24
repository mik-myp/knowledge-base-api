import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage } from 'mongoose';
import { ListDocumentsQueryDto } from './dto/list-documents-query.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';
import {
  Document,
  DocumentDocument,
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

const SUPPORTED_UPLOAD_EXTENSIONS = new Set([
  'pdf',
  'doc',
  'docx',
  'md',
  'markdown',
  'txt',
]);

export const TEXT_UPLOAD_EXTENSIONS = new Set(['md', 'markdown', 'txt']);

@Injectable()
export class DocumentsService {
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

  private countExtendedLatinCharacters(value: string): number {
    return (value.match(/[\u0080-\u00FF]/g) ?? []).length;
  }

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

    if (query.keyword?.trim()) {
      filters.originalName = {
        $regex: query.keyword.trim(),
        $options: 'i',
      };
    }

    return filters;
  }

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

  private getFileExtension(originalName: string): string {
    return originalName.split('.').pop()?.toLowerCase() || 'other';
  }

  private buildDownloadFileName(
    originalName: string,
    extension: string,
  ): string {
    const trimmedOriginalName = originalName.trim();
    const normalizedExtension = extension.trim().toLowerCase();

    if (!trimmedOriginalName) {
      return `document.${normalizedExtension}`;
    }

    return trimmedOriginalName.toLowerCase().endsWith(`.${normalizedExtension}`)
      ? trimmedOriginalName
      : `${trimmedOriginalName}.${normalizedExtension}`;
  }

  private assertSupportedUploadExtension(extension: string): void {
    if (!SUPPORTED_UPLOAD_EXTENSIONS.has(extension)) {
      throw new BadRequestException(
        '当前仅支持上传 md、txt、pdf、doc、docx 文件',
      );
    }
  }

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

  private async deleteDocumentChunks(userId: string, documentId: string) {
    await this.documentChunkModel
      .deleteMany({
        userId: toObjectId(userId),
        documentId: toObjectId(documentId),
      })
      .exec();
  }

  private async removeDocumentIndex(userId: string, documentId: string) {
    await this.deleteDocumentChunks(userId, documentId);
    await this.documentIndexingService.deleteDocumentVectors(
      userId,
      documentId,
    );
  }

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

    await this.replaceDocumentChunks(
      params.userId,
      params.knowledgeBaseId,
      params.documentId,
      chunks,
    );

    await this.documentIndexingService.replaceDocumentVectors({
      userId: params.userId,
      knowledgeBaseId: params.knowledgeBaseId,
      documentId: params.documentId,
      documentName: params.documentName,
      chunks,
    });
  }

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
      });

      await newDocument.save();
      documentId = newDocument.id;

      await this.syncDocumentIndex({
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
        originalName: editorDocument.name.trim(),
        extension: 'md',
        mimeType: 'text/markdown',
        size: Buffer.byteLength(editorDocument.content, 'utf8'),
      });

      await document.save();
      documentId = document.id;

      await this.syncDocumentIndex({
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

  async findOne(userId: string, id: string) {
    const document = await this.findOwnedDocument(userId, id);
    return serializeMongoResult(document);
  }

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

  async remove(userId: string, id: string) {
    const userObjectId = toObjectId(userId);
    const documentObjectId = toObjectId(id);
    const document = await this.documentModel
      .findOneAndDelete({
        _id: documentObjectId,
        userId: userObjectId,
      })
      .exec();

    if (!document) {
      throw new NotFoundException('文档不存在');
    }

    if (document.storageKey && this.storageService.isConfigured()) {
      await this.storageService.deleteFile(document.storageKey);
    }

    await this.removeDocumentIndex(userId, id);

    return serializeMongoResult(document.toObject());
  }

  async removeByDocumentIds(
    userId: string,
    documentIds: string[],
  ): Promise<RemoveByDocumentIdsResult> {
    const normalizedDocumentIds = Array.from(
      new Set(documentIds.filter((id) => Boolean(id?.trim()))),
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

    const deletedIds = documents.map((document) => document.id);

    await this.documentModel
      .deleteMany({
        _id: {
          $in: deletedIds.map((id) => toObjectId(id)),
        },
        userId: userObjectId,
      })
      .exec();

    const storageKeys = documents
      .map((document) => document.storageKey)
      .filter((storageKey): storageKey is string => Boolean(storageKey));

    if (this.storageService.isConfigured() && storageKeys.length) {
      await Promise.all(
        storageKeys.map((storageKey) =>
          this.storageService.deleteFile(storageKey),
        ),
      );
    }

    await Promise.all(
      deletedIds.map((documentId) =>
        this.removeDocumentIndex(userId, documentId),
      ),
    );

    return {
      deletedCount: deletedIds.length,
      deletedIds,
    };
  }
}
