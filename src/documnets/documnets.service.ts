import { Injectable } from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';
import { Document, DocumentDocument } from './schemas/documnet.schema';
import { Model, Types } from 'mongoose';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { ListDocumentsQueryDto } from './dto/list-documents-query.dto';
import {
  KnowledgeBase,
  KnowledgeBaseDocument,
} from 'src/knowledge_bases/schemas/knowledge_base.schema';

@Injectable()
export class DocumnetsService {
  constructor(
    @InjectModel(KnowledgeBase.name)
    private readonly knowledgeBaseModel: Model<KnowledgeBaseDocument>,
    @InjectModel(Document.name)
    private readonly documentModel: Model<DocumentDocument>,
  ) {}

  async upload(
    userId: string,
    file: Express.Multer.File,
    uploadDocument: UploadDocumentDto,
  ) {
    console.log(userId, file, uploadDocument);
  }

  async findAllDocuments(userId: string, query: ListDocumentsQueryDto) {
    const { page = 1, pageSize = 10 } = query;
    const userObjectId = new Types.ObjectId(userId);

    const skip = (page - 1) * pageSize;

    // 1. 获取该用户的所有知识库 ID
    const knowledgeBaseDocs = await this.knowledgeBaseModel
      .find({ userId: userObjectId })
      .select('_id')
      .lean()
      .exec();

    const knowledgeBaseIds = knowledgeBaseDocs.map((doc) => doc._id);

    if (knowledgeBaseIds.length === 0) {
      return { dataList: [], total: 0 };
    }

    // 2. 从文档集合中查询
    const [dataList, total] = await Promise.all([
      this.documentModel
        .find({ knowledgeBaseId: { $in: knowledgeBaseIds } })
        .skip(skip)
        .limit(pageSize)
        .exec(),
      this.documentModel.countDocuments({
        knowledgeBaseId: { $in: knowledgeBaseIds },
      }),
    ]);

    return { dataList, total };
  }
}
