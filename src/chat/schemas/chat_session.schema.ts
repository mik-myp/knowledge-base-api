import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/**
 * 定义对话会话文档的类型结构。
 */
export type ChatSessionDocument = HydratedDocument<ChatSession> & {
  updatedAt: Date;
  createdAt: Date;
};

/**
 * 定义对话会话相关逻辑。
 */
@Schema({
  collection: 'chat_sessions',
  timestamps: true,
  versionKey: false,
})
export class ChatSession {
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
   * 保存知识库 ID。
   */
  @Prop({
    type: Types.ObjectId,
    ref: 'KnowledgeBase',
    required: false,
  })
  knowledgeBaseId: Types.ObjectId;

  /**
   * 保存标题。
   */
  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  title: string;

  /**
   * 保存当前会话已分配到的下一条消息序号。
   */
  @Prop({
    type: Number,
    required: true,
    min: 0,
    default: 0,
  })
  messageSequence: number;
}

/**
 * 定义对话会话Schema。
 */
export const ChatSessionSchema = SchemaFactory.createForClass(ChatSession);
ChatSessionSchema.index({ userId: 1, updatedAt: -1 });
