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
  KnowledgeBaseRecord,
} from './knowledge_bases';

@Injectable()
export class KnowledgeBasesService {
  constructor(
    @InjectModel(KnowledgeBase.name)
    private readonly knowledgeBaseModel: Model<KnowledgeBaseDocument>,
  ) {}

  private serializeKnowledgeBase(
    knowledgeBase: KnowledgeBaseDocument,
  ): KnowledgeBaseRecord {
    return knowledgeBase.toObject() as unknown as KnowledgeBaseRecord;
  }

  async create(
    userId: string,
    createKnowledgeBaseDto: CreateKnowledgeBaseDto,
  ): Promise<KnowledgeBaseRecord> {
    const newKnowledgeBase = new this.knowledgeBaseModel({
      userId,
      documentCount: 0,
      chunkCount: 0,
      sessionCount: 0,
      ...createKnowledgeBaseDto,
    });

    await newKnowledgeBase.save();

    return this.serializeKnowledgeBase(newKnowledgeBase);
  }

  async findAll(
    userId: string,
    query: ListKnowledgeBasesQueryDto,
  ): Promise<KnowledgeBaseListResult | KnowledgeBaseRecord[]> {
    const { page, pageSize } = query;
    if (page && pageSize) {
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
        dataList: knowledgeBases.map((knowledgeBase) =>
          this.serializeKnowledgeBase(knowledgeBase),
        ),
        total,
      };
    }

    const knowledgeBases = this.knowledgeBaseModel
      .find({ userId })
      .sort({ updatedAt: -1 })
      .exec();

    return knowledgeBases;
  }

  async findOne(userId: string, id: string): Promise<KnowledgeBaseRecord> {
    const knowledgeBase = await this.knowledgeBaseModel
      .findOne({ _id: id, userId })
      .exec();

    if (!knowledgeBase) {
      throw new NotFoundException('知识库不存在');
    }

    return this.serializeKnowledgeBase(knowledgeBase);
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

    return this.serializeKnowledgeBase(knowledgeBase);
  }

  async remove(userId: string, id: string): Promise<KnowledgeBaseRecord> {
    const knowledgeBase = await this.knowledgeBaseModel
      .findOneAndDelete({ _id: id, userId })
      .exec();

    if (!knowledgeBase) {
      throw new NotFoundException('知识库不存在');
    }

    return this.serializeKnowledgeBase(knowledgeBase);
  }
}
