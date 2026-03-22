import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';
import { Document, DocumentDocument } from './schemas/documnet.schema';
import { Model, PipelineStage } from 'mongoose';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { ListDocumentsQueryDto } from './dto/list-documents-query.dto';
import {
  KnowledgeBase,
  KnowledgeBaseDocument,
} from 'src/knowledge_bases/schemas/knowledge_base.schema';
import { StorageService } from 'src/storage/storage.service';

const FileType = {
  pdf: 'pdf',
  doc: 'word',
  docs: 'word',
  md: 'markdown',
  markdown: 'markdown',
  txt: 'text',
} as const;

@Injectable()
export class DocumnetsService {
  constructor(
    @InjectModel(KnowledgeBase.name)
    private readonly knowledgeBaseModel: Model<KnowledgeBaseDocument>,
    @InjectModel(Document.name)
    private readonly documentModel: Model<DocumentDocument>,
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

  private buildFindAllDocumentsPipeline(userId: string): PipelineStage[] {
    return [
      {
        $match: {
          $expr: {
            $eq: [{ $toString: '$userId' }, userId],
          },
        },
      },
      {
        $lookup: {
          from: this.knowledgeBaseModel.collection.name,
          let: {
            documentKnowledgeBaseId: '$knowledgeBaseId',
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    {
                      $eq: [
                        { $toString: '$_id' },
                        { $toString: '$$documentKnowledgeBaseId' },
                      ],
                    },
                    {
                      $eq: [{ $toString: '$userId' }, userId],
                    },
                  ],
                },
              },
            },
          ],
          as: 'knowledgeBase',
        },
      },
      {
        $unwind: '$knowledgeBase',
      },
    ];
  }

  private async uploadSingleFile(
    userId: string,
    file: Express.Multer.File,
    uploadDocument: UploadDocumentDto,
  ) {
    const normalizedOriginalName = this.normalizeOriginalName(
      file.originalname,
    );
    const normalizedFile: Express.Multer.File = {
      ...file,
      originalname: normalizedOriginalName,
    };

    const folder = `${userId} - ${uploadDocument.knowledgeBaseId}`;
    const s3Key = await this.storageService.uploadFile(normalizedFile, folder);

    const extension =
      normalizedOriginalName.split('.').pop()?.toLowerCase() || 'other';

    const newDocument = new this.documentModel({
      userId: userId,
      knowledgeBaseId: uploadDocument.knowledgeBaseId,
      s3Key,
      originalName: normalizedOriginalName,
      mimeType: normalizedFile.mimetype,
      size: file.size,
      extension,
      fileType: FileType[extension] || 'other',
    });

    await newDocument.save();

    return newDocument.toObject();
  }

  async upload(
    userId: string,
    files: Array<Express.Multer.File>,
    uploadDocument: UploadDocumentDto,
  ) {
    if (!files?.length) {
      throw new BadRequestException('至少上传一个文件');
    }

    return Promise.all(
      files.map((file) => this.uploadSingleFile(userId, file, uploadDocument)),
    );
  }

  async findAllDocuments(userId: string, query: ListDocumentsQueryDto) {
    const { page = 1, pageSize = 10 } = query;
    const skip = (page - 1) * pageSize;
    const basePipeline = this.buildFindAllDocumentsPipeline(userId);

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

  async findAllDocumentsByKnowledgeId(userId: string, knowledgeBaseId: string) {
    const documents = await this.documentModel
      .find({
        userId,
        knowledgeBaseId,
      })
      .exec();

    return documents;
  }

  async remove(userId: string, id: string) {
    const document = await this.documentModel
      .findOneAndDelete({
        _id: id,
        userId,
      })
      .exec();
    if (!document) {
      throw new NotFoundException('文档不存在');
    }
    await this.storageService.deleteFile(document.s3Key);

    return document.toObject();
  }
}
