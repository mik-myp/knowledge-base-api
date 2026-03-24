import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
  type BaseMessage,
} from 'langchain';
import { Model } from 'mongoose';
import { serializeMongoResult } from 'src/common/plugins/mongoose-serialize.plugin';
import { toObjectId } from 'src/common/utils/object-id.util';
import { DocumentIndexingService } from 'src/documents/document-indexing.service';
import { LangchainService } from 'src/langchain/langchain.service';
import {
  KnowledgeBase,
  type KnowledgeBaseDocument,
} from 'src/knowledge_bases/schemas/knowledge_base.schema';
import { AskChatDto } from './dto/ask-chat.dto';
import { CreateChatSessionDto } from './dto/create-chat_session.dto';
import { FindChatMessagesQueryDto } from './dto/find-chat-messages-query.dto';
import { UpdateChatSessionDto } from './dto/update-chat_session.dto';
import {
  ChatMessage,
  type ChatMessageDocument,
} from './schemas/chat_message.schema';
import {
  ChatSession,
  type ChatSessionDocument,
} from './schemas/chat_session.schema';
import {
  ChatMessageType,
  type ChatAskResponse,
  type CreateChatMessageParams,
  type SerializedChatMessage,
  type SerializedChatSession,
} from './types/chat.types';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(ChatSession.name)
    private readonly chatSessionModel: Model<ChatSessionDocument>,
    @InjectModel(ChatMessage.name)
    private readonly chatMessageModel: Model<ChatMessageDocument>,
    @InjectModel(KnowledgeBase.name)
    private readonly knowledgeBaseModel: Model<KnowledgeBaseDocument>,
    private readonly langchainService: LangchainService,
    private readonly documentIndexingService: DocumentIndexingService,
  ) {}

  private serializeChatSession(
    chatSession: ChatSessionDocument,
  ): SerializedChatSession {
    return serializeMongoResult(
      chatSession.toObject(),
    ) as SerializedChatSession;
  }

  private serializeChatMessage(
    chatMessage: ChatMessageDocument | Record<string, unknown>,
  ): SerializedChatMessage {
    const rawMessage =
      typeof (chatMessage as ChatMessageDocument).toObject === 'function'
        ? (chatMessage as ChatMessageDocument).toObject()
        : chatMessage;

    return serializeMongoResult(rawMessage) as SerializedChatMessage;
  }

  private buildSessionTitle(question: string) {
    const title = question.trim().replace(/\s+/g, ' ').slice(0, 50);
    return title || '新会话';
  }

  private getLatestHumanMessage(dto: AskChatDto) {
    const latestHumanMessage = [...dto.messages]
      .reverse()
      .find(
        (message) =>
          message.role === ChatMessageType.Human && message.content.trim(),
      );

    if (!latestHumanMessage) {
      throw new BadRequestException('messages 中至少需要一条 human 消息');
    }

    return latestHumanMessage;
  }

  private async ensureKnowledgeBaseAccess(
    userId: string,
    knowledgeBaseId: string,
  ) {
    const knowledgeBase = await this.knowledgeBaseModel
      .findOne({
        _id: toObjectId(knowledgeBaseId),
        userId: toObjectId(userId),
      })
      .select({ _id: 1 })
      .lean()
      .exec();

    if (!knowledgeBase) {
      throw new NotFoundException('知识库不存在');
    }
  }

  private async findSessionById(userId: string, sessionId: string) {
    const session = await this.chatSessionModel
      .findOne({
        _id: toObjectId(sessionId),
        userId: toObjectId(userId),
      })
      .exec();

    if (!session) {
      throw new NotFoundException('会话不存在');
    }

    return session;
  }

  private async resolveSession(
    userId: string,
    dto: AskChatDto,
    question: string,
  ) {
    if (dto.sessionId) {
      const session = await this.findSessionById(userId, dto.sessionId);

      if (
        dto.knowledgeBaseId &&
        String(session.knowledgeBaseId ?? '') !== dto.knowledgeBaseId
      ) {
        throw new BadRequestException('sessionId 与 knowledgeBaseId 不匹配');
      }

      return session;
    }

    if (dto.knowledgeBaseId) {
      await this.ensureKnowledgeBaseAccess(userId, dto.knowledgeBaseId);
    }

    const session = new this.chatSessionModel({
      userId: toObjectId(userId),
      knowledgeBaseId: dto.knowledgeBaseId
        ? toObjectId(dto.knowledgeBaseId)
        : undefined,
      title: this.buildSessionTitle(question),
    });

    await session.save();
    return session;
  }

  private async getLastSequence(sessionId: string) {
    const latestMessage = await this.chatMessageModel
      .findOne({
        sessionId: toObjectId(sessionId),
      })
      .sort({ sequence: -1 })
      .select({ sequence: 1 })
      .lean()
      .exec();

    return typeof latestMessage?.sequence === 'number'
      ? latestMessage.sequence
      : -1;
  }

  private async createMessages(
    messages: CreateChatMessageParams[],
  ): Promise<SerializedChatMessage[]> {
    if (!messages.length) {
      return [];
    }

    const createdMessages = await this.chatMessageModel.insertMany(
      messages.map((message) => ({
        userId: toObjectId(message.userId),
        sessionId: toObjectId(message.sessionId),
        messageType: message.messageType,
        content: message.content,
        sequence: message.sequence,
        name: message.name,
        toolCallId: message.toolCallId,
        toolCalls: message.toolCalls,
        responseMetadata: message.responseMetadata,
        usageMetadata: message.usageMetadata,
        sources: message.sources?.map((source) => ({
          documentId: toObjectId(source.documentId),
          documentName: source.documentName,
          chunkSequence: source.chunkSequence,
          page: source.page,
          startIndex: source.startIndex,
          endIndex: source.endIndex,
          score: source.score,
        })),
      })),
    );

    return createdMessages.map((message) => this.serializeChatMessage(message));
  }

  private async appendIncomingMessages(
    userId: string,
    sessionId: string,
    dto: AskChatDto,
  ) {
    const lastSequence = await this.getLastSequence(sessionId);

    return this.createMessages(
      dto.messages.map((message, index) => ({
        userId,
        sessionId,
        messageType: message.role,
        content: message.content,
        sequence: lastSequence + index + 1,
        name: message.name,
        toolCallId: message.toolCallId,
      })),
    );
  }

  private async appendAssistantMessage(params: {
    userId: string;
    sessionId: string;
    answer: string;
    responseMetadata?: Record<string, unknown>;
    usageMetadata?: SerializedChatMessage['usageMetadata'];
    toolCalls?: Array<{
      id?: string;
      name: string;
      args: Record<string, unknown>;
    }>;
    sources?: SerializedChatMessage['sources'];
  }) {
    const lastSequence = await this.getLastSequence(params.sessionId);

    const [assistantMessage] = await this.createMessages([
      {
        userId: params.userId,
        sessionId: params.sessionId,
        messageType: ChatMessageType.Ai,
        content: params.answer,
        sequence: lastSequence + 1,
        responseMetadata: params.responseMetadata,
        usageMetadata: params.usageMetadata,
        toolCalls: params.toolCalls,
        sources: params.sources,
      },
    ]);

    return assistantMessage;
  }

  private buildContextText(
    hits: Array<{
      documentName: string;
      sequence: number;
      text: string;
      page?: number;
    }>,
  ) {
    return hits
      .map((hit, index) => {
        const location =
          typeof hit.page === 'number'
            ? `page=${hit.page}, sequence=${hit.sequence}`
            : `sequence=${hit.sequence}`;

        return [
          `[片段 ${index + 1}]`,
          `文档: ${hit.documentName}`,
          `位置: ${location}`,
          hit.text,
        ].join('\n');
      })
      .join('\n\n');
  }

  private buildSystemPrompt(contextText?: string) {
    if (!contextText) {
      return '你是一个中文 AI 助手。回答时保持准确、直接、简洁，不要编造事实。';
    }

    return [
      '你是知识库问答助手。回答时必须优先依据提供的上下文。',
      '如果上下文不足以支持答案，请直接说明“根据当前知识库内容无法确认”，不要编造。',
      '如果引用了知识库内容，请尽量围绕上下文作答，不要脱离上下文扩展过多。',
      '',
      '可用上下文：',
      contextText,
    ].join('\n');
  }

  private normalizeModelOutput(content: unknown) {
    if (typeof content === 'string') {
      return content.trim();
    }

    if (Array.isArray(content)) {
      return content
        .map((item) => {
          if (typeof item === 'string') {
            return item;
          }

          if (
            item &&
            typeof item === 'object' &&
            'text' in item &&
            typeof item.text === 'string'
          ) {
            return item.text;
          }

          return '';
        })
        .join('\n')
        .trim();
    }

    return '';
  }

  private toLangChainMessage(message: SerializedChatMessage): BaseMessage {
    if (message.messageType === ChatMessageType.System) {
      return new SystemMessage({
        content: message.content,
        name: message.name,
        response_metadata: message.responseMetadata,
      });
    }

    if (message.messageType === ChatMessageType.Human) {
      return new HumanMessage({
        content: message.content,
        name: message.name,
        response_metadata: message.responseMetadata,
      });
    }

    if (message.messageType === ChatMessageType.Tool) {
      return new ToolMessage({
        content: message.content,
        name: message.name,
        tool_call_id: message.toolCallId ?? message.id,
        response_metadata: message.responseMetadata,
      });
    }

    return new AIMessage({
      content: message.content,
      name: message.name,
      tool_calls: message.toolCalls,
      response_metadata: message.responseMetadata,
      usage_metadata: message.usageMetadata,
    });
  }

  private async loadSessionMessages(userId: string, sessionId: string) {
    const messages = await this.chatMessageModel
      .find({
        userId: toObjectId(userId),
        sessionId: toObjectId(sessionId),
      })
      .sort({ sequence: 1, createdAt: 1 })
      .lean()
      .exec();

    return messages.map((message) => this.serializeChatMessage(message));
  }

  private async touchSession(sessionId: string, title?: string) {
    await this.chatSessionModel
      .findByIdAndUpdate(
        toObjectId(sessionId),
        title ? { title } : { $set: {} },
        {
          runValidators: false,
        },
      )
      .exec();
  }

  async createSession(userId: string, createChatDto: CreateChatSessionDto) {
    if (createChatDto.knowledgeBaseId) {
      await this.ensureKnowledgeBaseAccess(
        userId,
        createChatDto.knowledgeBaseId,
      );
    }

    const session = new this.chatSessionModel({
      userId: toObjectId(userId),
      knowledgeBaseId: createChatDto.knowledgeBaseId
        ? toObjectId(createChatDto.knowledgeBaseId)
        : undefined,
      title: createChatDto.title?.trim() || '新会话',
    });

    await session.save();

    return this.serializeChatSession(session);
  }

  async findAllSession(userId: string) {
    const chatSessions = await this.chatSessionModel
      .find({ userId: toObjectId(userId) })
      .sort({ updatedAt: -1 })
      .exec();

    return chatSessions.map((chatSession) =>
      this.serializeChatSession(chatSession),
    );
  }

  async updateSession(
    userId: string,
    id: string,
    updateChatDto: UpdateChatSessionDto,
  ) {
    const title = updateChatDto.title.trim();

    if (!title) {
      throw new BadRequestException('标题不能为空');
    }

    const chatSession = await this.chatSessionModel
      .findOneAndUpdate(
        {
          _id: toObjectId(id),
          userId: toObjectId(userId),
        },
        { title },
        {
          returnDocument: 'after',
          runValidators: true,
        },
      )
      .exec();

    if (!chatSession) {
      throw new NotFoundException('会话不存在');
    }

    return this.serializeChatSession(chatSession);
  }

  async removeSession(userId: string, id: string) {
    const chatSession = await this.chatSessionModel
      .findOneAndDelete({
        _id: toObjectId(id),
        userId: toObjectId(userId),
      })
      .exec();

    if (!chatSession) {
      throw new NotFoundException('会话不存在');
    }

    await this.chatMessageModel
      .deleteMany({
        userId: toObjectId(userId),
        sessionId: toObjectId(id),
      })
      .exec();

    return this.serializeChatSession(chatSession);
  }

  async ask(userId: string, dto: AskChatDto): Promise<ChatAskResponse> {
    const latestHumanMessage = this.getLatestHumanMessage(dto);
    const session = await this.resolveSession(
      userId,
      dto,
      latestHumanMessage.content,
    );

    const existingSequence = await this.getLastSequence(session.id);

    await this.appendIncomingMessages(userId, session.id, dto);

    const historyMessages = await this.loadSessionMessages(userId, session.id);
    const sources: SerializedChatMessage['sources'] = [];
    let systemPrompt = this.buildSystemPrompt();

    if (session.knowledgeBaseId) {
      const hits = await this.documentIndexingService.semanticSearch({
        userId,
        knowledgeBaseId: String(session.knowledgeBaseId),
        question: latestHumanMessage.content,
        topK: dto.topK ?? 5,
      });

      systemPrompt = this.buildSystemPrompt(this.buildContextText(hits));
      sources.push(
        ...hits.map((hit) => ({
          documentId: hit.documentId,
          documentName: hit.documentName,
          chunkSequence: hit.sequence,
          page: hit.page,
          startIndex: hit.startIndex,
          endIndex: hit.endIndex,
          score: hit.score,
        })),
      );
    }

    const response = await this.langchainService
      .createChatModel()
      .invoke([
        new SystemMessage(systemPrompt),
        ...historyMessages.map((message) => this.toLangChainMessage(message)),
      ]);

    const answer =
      this.normalizeModelOutput(response.content) || '未获取到有效回答';

    const assistantMessage = await this.appendAssistantMessage({
      userId,
      sessionId: session.id,
      answer,
      responseMetadata: response.response_metadata,
      usageMetadata: response.usage_metadata,
      toolCalls: response.tool_calls,
      sources,
    });

    await this.touchSession(
      session.id,
      existingSequence < 0
        ? this.buildSessionTitle(latestHumanMessage.content)
        : undefined,
    );

    return {
      sessionId: session.id,
      answer,
      message: assistantMessage,
      sources,
    };
  }

  async findMessages(userId: string, query: FindChatMessagesQueryDto) {
    await this.findSessionById(userId, query.sessionId);
    return this.loadSessionMessages(userId, query.sessionId);
  }
}
