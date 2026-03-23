import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type KnowledgeBaseDocument = HydratedDocument<KnowledgeBase>;

@Schema({
  collection: 'knowledge_bases',
  timestamps: true,
  versionKey: false,
})
export class KnowledgeBase {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop({
    type: String,
    required: true,
    maxLength: 100,
    trim: true,
  })
  name: string;

  @Prop({
    type: String,
    maxLength: 500,
    trim: true,
  })
  description?: string;
}

export const KnowledgeBaseSchema = SchemaFactory.createForClass(KnowledgeBase);

KnowledgeBaseSchema.index({ userId: 1, updatedAt: -1 });
