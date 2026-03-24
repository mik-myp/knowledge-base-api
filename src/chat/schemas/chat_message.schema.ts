import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import type {
  ChatMessageSource,
  ChatToolCall,
  ChatUsageMetadata,
} from '../types/chat.types';
import { ChatMessageType } from '../types/chat.types';

export type ChatMessageDocument = HydratedDocument<ChatMessage>;

@Schema({
  collection: 'chat_messages',
  timestamps: true,
  versionKey: false,
})
export class ChatMessage {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'ChatSession',
    required: true,
    index: true,
  })
  sessionId: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(ChatMessageType),
    required: true,
  })
  messageType: ChatMessageType;

  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  content: string;

  @Prop({
    type: Number,
    required: true,
  })
  sequence: number;

  @Prop({
    type: String,
    required: false,
    trim: true,
  })
  name?: string;

  @Prop({
    type: String,
    required: false,
  })
  toolCallId?: string;

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

  @Prop({
    type: MongooseSchema.Types.Mixed,
    required: false,
  })
  responseMetadata?: Record<string, unknown>;

  @Prop({
    type: MongooseSchema.Types.Mixed,
    required: false,
  })
  usageMetadata?: ChatUsageMetadata;

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
      },
    ],
    required: false,
  })
  sources?: ChatMessageSource[];
}

export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);
ChatMessageSchema.index({ userId: 1, sessionId: 1, sequence: 1 });
ChatMessageSchema.index({ sessionId: 1, createdAt: 1 });
