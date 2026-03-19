import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateKnowledgeBaseDto } from './dto/create-knowledge_base.dto';
import { ListKnowledgeBasesQueryDto } from './dto/list-knowledge-bases-query.dto';
import { UpdateKnowledgeBaseDto } from './dto/update-knowledge_base.dto';
import { Model } from 'mongoose';
import {
  KnowledgeBase,
  KnowledgeBaseDocument,
} from './schemas/knowledge_base.schema';
import { InjectModel } from '@nestjs/mongoose';
import type {
  KnowledgeBaseListResult,
  KnowledgeBaseDocumentListResult,
  KnowledgeBaseRecord,
} from './knowledge_bases';
import {
  KnowledgeDocument,
  KnowledgeDocumentDocument,
} from '../documents/schemas/document.schema';

@Injectable()
export class KnowledgeBasesService {
  constructor(
    @InjectModel(KnowledgeBase.name)
    private readonly knowledgeBaseModel: Model<KnowledgeBaseDocument>,
    @InjectModel(KnowledgeDocument.name)
    private readonly knowledgeDocumentModel: Model<KnowledgeDocumentDocument>,
  ) {}

  async create(
    userId: string,
    createKnowledgeBaseDto: CreateKnowledgeBaseDto,
  ): Promise<KnowledgeBaseRecord> {
    const newKnowledgeBase = new this.knowledgeBaseModel({
      userId,
      documentCount: 0,
      chunkCount: 0,
      ...createKnowledgeBaseDto,
    });

    await newKnowledgeBase.save();

    return newKnowledgeBase.toObject();
  }

  async findAll(
    userId: string,
    query: ListKnowledgeBasesQueryDto,
  ): Promise<KnowledgeBaseListResult> {
    const { page = 1, pageSize = 10 } = query;
    const [knowledgeBases, total] = await Promise.all([
      this.knowledgeBaseModel
        .find({ userId })
        .sort({ updatedAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .exec(),
      this.knowledgeBaseModel.countDocuments({ userId }).exec(),
    ]);

    return {
      dataList: knowledgeBases.map((knowledgeBase) => knowledgeBase.toObject()),
      total,
    };
  }

  async findAllDocuments(
    userId: string,
    query: ListKnowledgeBasesQueryDto,
  ): Promise<KnowledgeBaseDocumentListResult> {
    const { page = 1, pageSize = 10 } = query;
    const [documents, total] = await Promise.all([
      this.knowledgeDocumentModel
        .find({ userId })
        .sort({ updatedAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .exec(),
      this.knowledgeDocumentModel.countDocuments({ userId }).exec(),
    ]);

    return {
      dataList: documents.map((document) => document.toObject()),
      total,
    };
  }

  async findOne(userId: string, id: string): Promise<KnowledgeBaseRecord> {
    const knowledgeBase = await this.knowledgeBaseModel
      .findOne({ _id: id, userId })
      .exec();

    if (!knowledgeBase) {
      throw new NotFoundException('知识库不存在');
    }

    return knowledgeBase;
  }

  async update(
    userId: string,
    id: string,
    updateKnowledgeBaseDto: UpdateKnowledgeBaseDto,
  ): Promise<KnowledgeBaseRecord> {
    const knowledgeBase = await this.knowledgeBaseModel
      .findOneAndUpdate({ _id: id, userId }, updateKnowledgeBaseDto, {
        returnDocument: 'after',
        runValidators: true,
      })
      .exec();

    if (!knowledgeBase) {
      throw new NotFoundException('知识库不存在');
    }

    return knowledgeBase;
  }

  async remove(userId: string, id: string): Promise<KnowledgeBaseRecord> {
    const knowledgeBase = await this.knowledgeBaseModel
      .findOneAndDelete({ _id: id, userId })
      .exec();

    if (!knowledgeBase) {
      throw new NotFoundException('知识库不存在');
    }

    return knowledgeBase;
  }
}
