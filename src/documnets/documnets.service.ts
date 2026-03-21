import { Injectable } from '@nestjs/common';

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

  async upload(
    userId: string,
    file: Express.Multer.File,
    uploadDocument: UploadDocumentDto,
  ) {
    const folder = `${userId} - ${uploadDocument.knowledgeBaseId}`;
    const s3Key = await this.storageService.uploadFile(file, folder);

    const extension = file.originalname.split('.').pop() || 'other';

    const newDocument = new this.documentModel({
      userId: userId,
      knowledgeBaseId: uploadDocument.knowledgeBaseId,
      s3Key,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      extension,
      fileType: FileType[extension] || 'other',
    });

    await newDocument.save();

    return newDocument.toObject();
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
}
