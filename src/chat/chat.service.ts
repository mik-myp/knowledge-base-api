import {
  BadRequestException,
  GatewayTimeoutException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
  type AIMessageChunk,
  type BaseMessage,
} from 'langchain';
import { Model } from 'mongoose';
import { Observable } from 'rxjs';
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
  type ChatAskStreamChunk,
  type CreateChatMessageParams,
  type SerializedChatMessage,
  type SerializedChatSession,
} from './types/chat.types';

/**
 * 负责对话相关业务处理的服务。
 */
@Injectable()
export class ChatService {
  /**
   * 记录对话生成过程中的关键日志。
   */
  private readonly logger = new Logger(ChatService.name);

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

  /**
   * 序列化会话数据。
   * @param chatSession 对话会话。
   * @returns 返回Serialized对话会话。
   */
  private serializeChatSession(
    chatSession: ChatSessionDocument,
  ): SerializedChatSession {
    return serializeMongoResult(
      chatSession.toObject(),
    ) as SerializedChatSession;
  }

  /**
   * 序列化消息数据。
   * @param chatMessage 对话消息。
   * @returns 返回Serialized对话消息。
   */
  private serializeChatMessage(
    chatMessage: ChatMessageDocument | Record<string, unknown>,
  ): SerializedChatMessage {
    const rawMessage =
      typeof (chatMessage as ChatMessageDocument).toObject === 'function'
        ? (chatMessage as ChatMessageDocument).toObject()
        : chatMessage;

    return serializeMongoResult(rawMessage) as SerializedChatMessage;
  }

  /**
   * 根据用户问题生成默认会话标题。
   * @param question 用户最近一次提问内容。
   * @returns 返回截断并清洗后的会话标题。
   */
  private buildSessionTitle(question: string) {
    const title = question.slice(0, 50);
    return title || '新会话';
  }

  /**
   * 获取本次请求中最后一条用户消息。
   * @param dto 问答请求参数。
   * @returns 返回最后一条有效的用户消息对象。
   */
  private getLatestHumanMessage(dto: AskChatDto) {
    const latestHumanMessage = [...dto.messages]
      .reverse()
      .find(
        (message) =>
          message.role === ChatMessageType.Human,
      );

    if (!latestHumanMessage) {
      throw new BadRequestException('messages 中至少需要一条 human 消息');
    }

    return latestHumanMessage;
  }

  /**
   * 校验用户是否有权限访问指定知识库。
   * @param userId 当前用户 ID。
   * @param knowledgeBaseId 知识库 ID。
   * @returns 校验通过后不返回额外内容。
   */
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

  /**
   * 查询当前用户拥有的会话。
   * @param userId 当前用户 ID。
   * @param sessionId 会话 ID。
   * @returns 返回对应的会话实体。
   */
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

  /**
   * 解析本次问答应使用的会话。
   * @param userId 当前用户 ID。
   * @param dto 问答请求参数。
   * @param question 当前问题内容。
   * @returns 返回已有会话或新创建的会话实体。
   */
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

  /**
   * 获取会话中最后一条消息的序号。
   * @param sessionId 会话 ID。
   * @returns 返回最后一条消息的序号；若暂无消息则返回 `-1`。
   */
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

  /**
   * 批量创建消息记录。
   * @param messages 消息列表。
   * @returns 返回 Promise，解析后得到Serialized对话Message[]。
   */
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
          text: source.text,
        })),
      })),
    );

    return createdMessages.map((message) => this.serializeChatMessage(message));
  }

  /**
   * 将本次请求中的输入消息写入数据库。
   * @param userId 当前用户 ID。
   * @param sessionId 会话 ID。
   * @param dto 问答请求参数。
   * @returns 返回新写入的消息记录列表。
   */
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

  /**
   * 将模型生成的最终回答写入数据库。
   * @param params 助手消息写入参数。
   * @param params.userId 当前用户 ID。
   * @param params.sessionId 会话 ID。
   * @param params.answer 模型生成的最终回答文本。
   * @param params.responseMetadata 模型响应元数据。
   * @param params.usageMetadata 模型用量元数据。
   * @param params.toolCalls 模型返回的工具调用信息。
   * @param params.sources 回答引用的知识库来源列表。
   * @returns 返回新写入的助手消息记录。
   */
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

  /**
   * 将检索命中的分片整理为提示词上下文。
   * @param hits 检索返回的文档片段列表。
   * @returns 返回可直接拼入系统提示词的上下文文本。
   */
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

  /**
   * 构建发送给模型的系统提示词。
   * @param contextText 检索得到的上下文文本，可选。
   * @returns 返回最终发送给模型的系统提示词。
   */
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

  /**
   * 将模型输出内容整理为可展示文本。
   * @param content 模型返回的原始内容结构。
   * @returns 返回清洗后的文本内容。
   */
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

  /**
   * 从模型返回内容中提取纯文本。
   * @param content 模型返回的原始内容结构。
   * @returns 返回拼接后的文本字符串。
   */
  private extractModelText(content: unknown) {
    if (typeof content === 'string') {
      return content;
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
        .join('');
    }

    return '';
  }

  /**
   * 转换为LangChain消息。
   * @param message 消息对象。
   * @returns 返回基础消息。
   */
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

  /**
   * 按顺序加载会话下的全部消息。
   * @param userId 当前用户 ID。
   * @param sessionId 会话 ID。
   * @returns 返回按序排列的消息列表。
   */
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

  /**
   * 刷新会话更新时间，并按需更新标题。
   * @param sessionId 会话 ID。
   * @param title 可选的新标题。
   * @returns 更新完成后不返回额外内容。
   */
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

  /**
   * 构建普通问答场景下的进度提示文案。
   * @param hasKnowledgeBase 是否关联知识库。
   * @returns 返回可轮播展示的进度提示列表。
   */
  private buildProgressMessages(hasKnowledgeBase: boolean): string[] {
    if (hasKnowledgeBase) {
      return [
        '正在检索相关知识片段...',
        '正在分析知识库内容...',
        '正在组织知识库回答...',
      ];
    }

    return ['正在分析你的问题...', '正在整理回答结构...', '正在生成回答...'];
  }

  /**
   * 根据知识库问答阶段生成进度提示文案。
   * @param stage 当前执行阶段。
   * @returns 返回该阶段对应的进度提示列表。
   */
  private buildKnowledgeBaseStageProgressMessages(
    stage:
      | 'preparing_context'
      | 'embedding'
      | 'vector_search'
      | 'processing_results'
      | 'generating_answer',
  ): string[] {
    switch (stage) {
      case 'preparing_context':
        return [
          '会话已创建，正在准备知识库上下文...',
          '正在初始化知识库检索...',
        ];
      case 'embedding':
        return ['正在生成问题向量...', '问题向量生成中...'];
      case 'vector_search':
        return ['正在执行向量检索...', '向量检索中...'];
      case 'processing_results':
        return ['正在整理检索结果...', '检索结果整理中...'];
      case 'generating_answer':
        return ['正在结合知识库生成回答...', '知识库回答生成中...'];
      default:
        return ['正在处理中...'];
    }
  }

  /**
   * 解析流式错误消息。
   * @param error 错误对象。
   * @returns 返回字符串结果。
   */
  private resolveStreamErrorMessage(error: unknown): string {
    if (error instanceof GatewayTimeoutException) {
      const timeoutMessage = error.message?.trim();
      return timeoutMessage || '知识库检索超时，请稍后重试';
    }

    if (error instanceof BadRequestException) {
      const message = error.message?.trim();
      return message || '请求参数错误，请稍后重试';
    }

    if (error instanceof Error && error.message.trim()) {
      return error.message.trim();
    }

    return '本次问答处理失败，请稍后重试';
  }

  /**
   * 创建新的对话会话。
   * @param userId 当前用户 ID。
   * @param createChatDto 创建会话的请求参数。
   * @returns 返回新建后的会话记录。
   */
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
      title: createChatDto.title || '新会话',
    });

    await session.save();

    return this.serializeChatSession(session);
  }

  /**
   * 获取当前用户的全部会话。
   * @param userId 当前用户 ID。
   * @returns 返回按更新时间倒序排列的会话列表。
   */
  async findAllSession(userId: string) {
    const chatSessions = await this.chatSessionModel
      .find({ userId: toObjectId(userId) })
      .sort({ updatedAt: -1 })
      .exec();

    return chatSessions.map((chatSession) =>
      this.serializeChatSession(chatSession),
    );
  }

  /**
   * 更新会话标题。
   * @param userId 当前用户 ID。
   * @param id 会话 ID。
   * @param updateChatDto 会话更新参数。
   * @returns 返回更新后的会话记录。
   */
  async updateSession(
    userId: string,
    id: string,
    updateChatDto: UpdateChatSessionDto,
  ) {
    const title = updateChatDto.title;

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

  /**
   * 删除会话及其关联消息。
   * @param userId 当前用户 ID。
   * @param id 会话 ID。
   * @returns 返回被删除的会话记录。
   */
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

  /**
   * 以流式方式执行问答并持续推送进度。
   * @param userId 当前用户 ID。
   * @param dto 问答请求参数。
   * @returns 返回按 SSE 语义消费的问答流数据。
   */
  askStream(userId: string, dto: AskChatDto): Observable<ChatAskStreamChunk> {
    return new Observable<ChatAskStreamChunk>((subscriber) => {
      let cancelled = false;
      let currentSessionId: string | undefined;
      let progressTimer: ReturnType<typeof setInterval> | undefined;
      let progressIndex = 0;

      const stopProgressHeartbeat = (): void => {
        if (progressTimer) {
          clearInterval(progressTimer);
          progressTimer = undefined;
        }
      };

      const emitProgress = (
        sessionId: string,
        progress: string,
        sources: SerializedChatMessage['sources'] = [],
      ): void => {
        if (cancelled) {
          return;
        }

        subscriber.next({
          sessionId,
          answer: '',
          progress,
          sources,
          done: false,
        });
      };

      const startProgressHeartbeat = (
        sessionId: string,
        progressMessages: string[],
        sources: SerializedChatMessage['sources'] = [],
      ): void => {
        stopProgressHeartbeat();
        progressIndex = 0;

        progressTimer = setInterval(() => {
          const nextProgress =
            progressMessages[progressIndex % progressMessages.length];

          progressIndex += 1;
          emitProgress(sessionId, nextProgress, sources);
        }, 1500);
      };

      void (async () => {
        const latestHumanMessage = this.getLatestHumanMessage(dto);
        const session = await this.resolveSession(
          userId,
          dto,
          latestHumanMessage.content,
        );
        currentSessionId = session.id;

        const existingSequence = await this.getLastSequence(session.id);

        await this.appendIncomingMessages(userId, session.id, dto);

        if (cancelled) {
          return;
        }

        subscriber.next({
          sessionId: session.id,
          answer: '',
          progress: session.knowledgeBaseId
            ? '会话已创建，正在准备知识库上下文...'
            : '会话已创建，正在准备回答...',
          sources: [],
          done: false,
        });

        startProgressHeartbeat(
          session.id,
          session.knowledgeBaseId
            ? this.buildKnowledgeBaseStageProgressMessages('preparing_context')
            : this.buildProgressMessages(false),
        );

        const historyMessages = await this.loadSessionMessages(
          userId,
          session.id,
        );
        const sources: SerializedChatMessage['sources'] = [];
        let systemPrompt = this.buildSystemPrompt();

        if (session.knowledgeBaseId) {
          const hits = await this.documentIndexingService.semanticSearch({
            userId,
            knowledgeBaseId: String(session.knowledgeBaseId),
            question: latestHumanMessage.content,
            topK: dto.topK ?? 5,
            onProgress: (stage) => {
              if (stage === 'embedding') {
                emitProgress(session.id, '正在生成问题向量...', sources);
                startProgressHeartbeat(
                  session.id,
                  this.buildKnowledgeBaseStageProgressMessages('embedding'),
                  sources,
                );
                return;
              }

              if (stage === 'vector_search') {
                emitProgress(session.id, '正在执行向量检索...', sources);
                startProgressHeartbeat(
                  session.id,
                  this.buildKnowledgeBaseStageProgressMessages('vector_search'),
                  sources,
                );
                return;
              }

              emitProgress(session.id, '正在整理检索结果...', sources);
              startProgressHeartbeat(
                session.id,
                this.buildKnowledgeBaseStageProgressMessages(
                  'processing_results',
                ),
                sources,
              );
            },
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
              text: hit.text,
            })),
          );
        }

        emitProgress(
          session.id,
          session.knowledgeBaseId
            ? '正在结合知识库生成回答...'
            : '正在调用模型生成回答...',
          sources,
        );
        startProgressHeartbeat(
          session.id,
          session.knowledgeBaseId
            ? this.buildKnowledgeBaseStageProgressMessages('generating_answer')
            : this.buildProgressMessages(false),
          sources,
        );

        const model = this.langchainService.createChatModel();
        const stream = await model.stream([
          new SystemMessage(systemPrompt),
          ...historyMessages.map((message) => this.toLangChainMessage(message)),
        ]);

        let answer = '';
        let lastChunk: AIMessageChunk | null = null;

        for await (const chunk of stream) {
          if (cancelled) {
            stopProgressHeartbeat();
            return;
          }

          lastChunk = chunk;
          answer += this.extractModelText(chunk.content);

          if (answer) {
            stopProgressHeartbeat();
          }

          subscriber.next({
            sessionId: session.id,
            answer,
            sources,
            done: false,
          });
        }

        const normalizedAnswer = answer.trim() || '未获取到有效回答';
        stopProgressHeartbeat();

        const assistantMessage = await this.appendAssistantMessage({
          userId,
          sessionId: session.id,
          answer: normalizedAnswer,
          responseMetadata: lastChunk?.response_metadata,
          usageMetadata: lastChunk?.usage_metadata,
          toolCalls: lastChunk?.tool_calls,
          sources,
        });

        await this.touchSession(
          session.id,
          existingSequence < 0
            ? this.buildSessionTitle(latestHumanMessage.content)
            : undefined,
        );

        if (cancelled) {
          return;
        }

        subscriber.next({
          sessionId: session.id,
          answer: normalizedAnswer,
          message: assistantMessage,
          sources,
          done: true,
        });
        subscriber.complete();
      })().catch((error: unknown) => {
        stopProgressHeartbeat();

        const errorMessage = this.resolveStreamErrorMessage(error);

        this.logger.error(
          `askStream failed; sessionId=${currentSessionId ?? 'unknown'}; userId=${userId}; message=${errorMessage}`,
          error instanceof Error ? error.stack : undefined,
        );

        if (currentSessionId && !cancelled) {
          subscriber.next({
            sessionId: currentSessionId,
            answer: '',
            error: errorMessage,
            sources: [],
            done: true,
          });
          subscriber.complete();
          return;
        }

        subscriber.error(error);
      });

      return () => {
        cancelled = true;
        stopProgressHeartbeat();
      };
    });
  }

  /**
   * 查询指定会话的消息列表。
   * @param userId 当前用户 ID。
   * @param query 查询参数，包含会话 ID。
   * @returns 返回该会话下的全部消息记录。
   */
  async findMessages(userId: string, query: FindChatMessagesQueryDto) {
    await this.findSessionById(userId, query.sessionId);
    return this.loadSessionMessages(userId, query.sessionId);
  }
}
