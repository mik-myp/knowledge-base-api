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

    const payload = chunks.map((chunk, index) => ({
      userId: userObjectId,
      knowledgeBaseId: knowledgeBaseObjectId,
      documentId: documentObjectId,
      sequence: index,
      content: chunk.content,
      page: chunk.page,
      startIndex: chunk.startIndex,
      endIndex: chunk.endIndex,
    }));

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

  private async uploadSingleFile(
    userId: string,
    file: Express.Multer.File,
    uploadDocument: UploadDocumentDto,
  ) {
    const userObjectId = toObjectId(userId);
    const knowledgeBaseObjectId = toObjectId(uploadDocument.knowledgeBaseId);
    const normalizedOriginalName = this.normalizeOriginalName(
      file.originalname,
    );
    const normalizedFile: Express.Multer.File = {
      ...file,
      originalname: normalizedOriginalName,
    };

    const folder = `${userId}-${uploadDocument.knowledgeBaseId}`;
    const storageKey = this.storageService.isConfigured()
      ? await this.storageService.uploadFile(normalizedFile, folder)
      : undefined;

    const extension = this.getFileExtension(normalizedOriginalName);
    const content = TEXT_UPLOAD_EXTENSIONS.has(extension)
      ? normalizedFile.buffer.toString('utf8')
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

    return serializeMongoResult(newDocument.toObject());
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

    return Promise.all(
      files.map((file) => this.uploadSingleFile(userId, file, uploadDocument)),
    );
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

    return serializeMongoResult(document.toObject());
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

    return serializeMongoResult(document);
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

    await this.deleteDocumentChunks(userId, id);

    return serializeMongoResult(document.toObject());
  }
}
