import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateKnowledgeBaseDto } from './dto/create-knowledge_base.dto';
import { ListKnowledgeBasesQueryDto } from './dto/list-knowledge-bases-query.dto';
import { UpdateKnowledgeBaseDto } from './dto/update-knowledge_base.dto';
import { Model } from 'mongoose';
import { toObjectId } from 'src/common/utils/object-id.util';
import {
  KnowledgeBase,
  KnowledgeBaseDocument,
} from './schemas/knowledge_base.schema';
import { InjectModel } from '@nestjs/mongoose';
import type {
  KnowledgeBaseListResult,
  KnowledgeBaseRecord,
} from './types/knowledge-bases.types';
import {
  Document,
  DocumentDocument,
} from 'src/documents/schemas/document.schema';
import { DocumentsService } from 'src/documents/documents.service';
import {
  ChatSession,
  ChatSessionDocument,
} from 'src/chat/schemas/chat_session.schema';
import {
  ChatMessage,
  ChatMessageDocument,
} from 'src/chat/schemas/chat_message.schema';

/**
 * 负责知识库Bases相关业务处理的服务。
 */
@Injectable()
export class KnowledgeBasesService {
  constructor(
    @InjectModel(KnowledgeBase.name)
    private readonly knowledgeBaseModel: Model<KnowledgeBaseDocument>,
    @InjectModel(Document.name)
    private readonly documentModel: Model<DocumentDocument>,
    @InjectModel(ChatSession.name)
    private readonly chatSessionModel: Model<ChatSessionDocument>,
    @InjectModel(ChatMessage.name)
    private readonly chatMessageModel: Model<ChatMessageDocument>,
    private readonly documentsService: DocumentsService,
  ) {}

  /**
   * 序列化知识库基础。
   * @param knowledgeBase 知识库基础。
   * @returns 返回知识库基础记录。
   */
  private serializeKnowledgeBase(
    knowledgeBase: KnowledgeBaseDocument,
  ): KnowledgeBaseRecord {
    return {
      id: knowledgeBase.id,
      userId: knowledgeBase.userId.toString(),
      name: knowledgeBase.name,
      description: knowledgeBase.description,
    };
  }

  /**
   * 创建相关逻辑。
   * @param userId 当前用户 ID。
   * @param createKnowledgeBaseDto 创建知识库请求参数。
   * @returns 返回 Promise，解析后得到知识库基础记录。
   */
  async create(
    userId: string,
    createKnowledgeBaseDto: CreateKnowledgeBaseDto,
  ): Promise<KnowledgeBaseRecord> {
    const userObjectId = toObjectId(userId);
    const newKnowledgeBase = new this.knowledgeBaseModel({
      userId: userObjectId,
      ...createKnowledgeBaseDto,
    });

    await newKnowledgeBase.save();

    return this.serializeKnowledgeBase(newKnowledgeBase);
  }

  /**
   * 查询All。
   * @param userId 当前用户 ID。
   * @param query 查询参数对象。
   * @returns 返回 Promise，解析后得到知识库基础列表结果或知识库基础Record[]。
   */
  async findAll(
    userId: string,
    query: ListKnowledgeBasesQueryDto,
  ): Promise<KnowledgeBaseListResult | KnowledgeBaseRecord[]> {
    const userObjectId = toObjectId(userId);
    const { page, pageSize } = query;
    if (page && pageSize) {
      const [knowledgeBases, total] = await Promise.all([
        this.knowledgeBaseModel
          .find({ userId: userObjectId })
          .sort({ updatedAt: -1 })
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .exec(),
        this.knowledgeBaseModel.countDocuments({ userId: userObjectId }).exec(),
      ]);

      return {
        dataList: knowledgeBases.map((knowledgeBase) =>
          this.serializeKnowledgeBase(knowledgeBase),
        ),
        total,
      };
    }

    const knowledgeBases = await this.knowledgeBaseModel
      .find({ userId: userObjectId })
      .sort({ updatedAt: -1 })
      .exec();

    return knowledgeBases.map((knowledgeBase) =>
      this.serializeKnowledgeBase(knowledgeBase),
    );
  }

  /**
   * 查询One。
   * @param userId 当前用户 ID。
   * @param id 资源 ID。
   * @returns 返回 Promise，解析后得到知识库基础记录。
   */
  async findOne(userId: string, id: string): Promise<KnowledgeBaseRecord> {
    const userObjectId = toObjectId(userId);
    const knowledgeBaseObjectId = toObjectId(id);
    const knowledgeBase = await this.knowledgeBaseModel
      .findOne({ _id: knowledgeBaseObjectId, userId: userObjectId })
      .exec();

    if (!knowledgeBase) {
      throw new NotFoundException('知识库不存在');
    }

    return this.serializeKnowledgeBase(knowledgeBase);
  }

  /**
   * 更新相关逻辑。
   * @param userId 当前用户 ID。
   * @param id 资源 ID。
   * @param updateKnowledgeBaseDto 更新知识库请求参数。
   * @returns 返回 Promise，解析后得到知识库基础记录。
   */
  async update(
    userId: string,
    id: string,
    updateKnowledgeBaseDto: UpdateKnowledgeBaseDto,
  ): Promise<KnowledgeBaseRecord> {
    const userObjectId = toObjectId(userId);
    const knowledgeBaseObjectId = toObjectId(id);
    const knowledgeBase = await this.knowledgeBaseModel
      .findOneAndUpdate(
        { _id: knowledgeBaseObjectId, userId: userObjectId },
        updateKnowledgeBaseDto,
        {
          returnDocument: 'after',
          runValidators: true,
        },
      )
      .exec();

    if (!knowledgeBase) {
      throw new NotFoundException('知识库不存在');
    }

    return this.serializeKnowledgeBase(knowledgeBase);
  }

  /**
   * 删除相关逻辑。
   * @param userId 当前用户 ID。
   * @param id 资源 ID。
   * @returns 返回 Promise，解析后得到知识库基础记录。
   */
  async remove(userId: string, id: string): Promise<KnowledgeBaseRecord> {
    const userObjectId = toObjectId(userId);
    const knowledgeBaseObjectId = toObjectId(id);
    const knowledgeBase = await this.knowledgeBaseModel
      .findOne({ _id: knowledgeBaseObjectId, userId: userObjectId })
      .exec();

    if (!knowledgeBase) {
      throw new NotFoundException('知识库不存在');
    }

    const documents = await this.documentModel
      .find({
        knowledgeBaseId: knowledgeBaseObjectId,
        userId: userObjectId,
      })
      .exec();

    const documentIds = documents.map((document) => document.id);

    if (documentIds.length > 0) {
      await this.documentsService.removeByDocumentIds(userId, documentIds);
    }

    const chatSessions = await this.chatSessionModel
      .find({
        knowledgeBaseId: knowledgeBaseObjectId,
        userId: userObjectId,
      })
      .exec();

    const chatSessionIds = chatSessions.map((chatSession) =>
      toObjectId(chatSession.id),
    );

    await Promise.all([
      chatSessionIds.length > 0
        ? this.chatMessageModel
            .deleteMany({
              userId: userObjectId,
              sessionId: {
                $in: chatSessionIds,
              },
            })
            .exec()
        : Promise.resolve(),
      this.chatSessionModel
        .deleteMany({
          knowledgeBaseId: knowledgeBaseObjectId,
          userId: userObjectId,
        })
        .exec(),
    ]);

    await this.knowledgeBaseModel
      .findOneAndDelete({ _id: knowledgeBaseObjectId, userId: userObjectId })
      .exec();

    return this.serializeKnowledgeBase(knowledgeBase);
  }
}
