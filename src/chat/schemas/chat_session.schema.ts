import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ChatSessionDocument = HydratedDocument<ChatSession> & {
  updatedAt: Date;
  createdAt: Date;
};

@Schema({
  collection: 'chat_sessions',
  timestamps: true,
  versionKey: false,
})
export class ChatSession {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'KnowledgeBase',
    required: false,
  })
  knowledgeBaseId: Types.ObjectId;

  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  title: string;
}

export const ChatSessionSchema = SchemaFactory.createForClass(ChatSession);
