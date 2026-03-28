import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import type {
  ChatMessageSource,
  ChatToolCall,
  ChatUsageMetadata,
} from '../types/chat.types';
import { ChatMessageType } from '../types/chat.types';

/**
 * 定义对话消息文档的类型结构。
 */
export type ChatMessageDocument = HydratedDocument<ChatMessage>;

/**
 * 定义对话消息相关逻辑。
 */
@Schema({
  collection: 'chat_messages',
  timestamps: true,
  versionKey: false,
})
export class ChatMessage {
  /**
   * 保存当前用户 ID。
   */
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId: Types.ObjectId;

  /**
   * 保存会话 ID。
   */
  @Prop({
    type: Types.ObjectId,
    ref: 'ChatSession',
    required: true,
    index: true,
  })
  sessionId: Types.ObjectId;

  /**
   * 保存消息类型。
   */
  @Prop({
    type: String,
    enum: Object.values(ChatMessageType),
    required: true,
  })
  messageType: ChatMessageType;

  /**
   * 保存内容。
   */
  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  content: string;

  /**
   * 保存消息序号。
   */
  @Prop({
    type: Number,
    required: true,
  })
  sequence: number;

  /**
   * 保存名称。
   */
  @Prop({
    type: String,
    required: false,
    trim: true,
  })
  name?: string;

  /**
   * 保存工具调用Id。
   */
  @Prop({
    type: String,
    required: false,
  })
  toolCallId?: string;

  /**
   * 保存工具调用列表。
   */
  @Prop({
    type: [
      {
        id: {
          type: String,
          required: false,
        },
        name: {
          type: String,
          required: true,
        },
        args: {
          type: MongooseSchema.Types.Mixed,
          required: true,
        },
      },
    ],
    required: false,
  })
  toolCalls?: ChatToolCall[];

  /**
   * 保存响应元数据。
   */
  @Prop({
    type: MongooseSchema.Types.Mixed,
    required: false,
  })
  responseMetadata?: Record<string, unknown>;

  /**
   * 保存用量元数据。
   */
  @Prop({
    type: MongooseSchema.Types.Mixed,
    required: false,
  })
  usageMetadata?: ChatUsageMetadata;

  /**
   * 保存来源信息列表。
   */
  @Prop({
    type: [
      {
        documentId: {
          type: Types.ObjectId,
          ref: 'Document',
          required: true,
        },
        documentName: {
          type: String,
          required: true,
        },
        chunkSequence: {
          type: Number,
          required: true,
        },
        page: {
          type: Number,
        },
        startIndex: {
          type: Number,
        },
        endIndex: {
          type: Number,
        },
        score: {
          type: Number,
        },
        text: {
          type: String,
        },
      },
    ],
    required: false,
  })
  sources?: ChatMessageSource[];
}

/**
 * 定义对话消息Schema。
 */
export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);
ChatMessageSchema.index(
  { userId: 1, sessionId: 1, sequence: 1 },
  { unique: true },
);
ChatMessageSchema.index({ sessionId: 1, createdAt: 1 });
