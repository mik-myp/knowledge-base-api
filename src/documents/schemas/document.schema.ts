import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type DocumentDocument = HydratedDocument<Document>;

export enum DocumentSourceType {
  Upload = 'upload',
  Editor = 'editor',
}

@Schema({
  collection: 'documents',
  timestamps: true,
  versionKey: false,
})
export class Document {
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
    required: true,
    index: true,
  })
  knowledgeBaseId: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(DocumentSourceType),
    required: true,
  })
  sourceType: DocumentSourceType;

  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  originalName: string;

  @Prop({
    type: String,
    trim: true,
    default: undefined,
  })
  storageKey?: string;

  @Prop({
    type: String,
    default: undefined,
  })
  content?: string;

  @Prop({
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  })
  extension: string;

  @Prop({
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  })
  mimeType: string;

  @Prop({
    type: Number,
    required: true,
    min: 0,
  })
  size: number;
}

export const DocumentSchema = SchemaFactory.createForClass(Document);

DocumentSchema.index({ userId: 1, knowledgeBaseId: 1 });
DocumentSchema.index({ userId: 1, updatedAt: -1 });
DocumentSchema.index({ knowledgeBaseId: 1, updatedAt: -1 });
