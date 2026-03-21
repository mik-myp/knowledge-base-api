import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type DocumentDocument = HydratedDocument<Document>;

export enum DocumentStatus {
  Pending = 'pending',
  Processing = 'processing',
  Ready = 'ready',
  Failed = 'failed',
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
    required: true,
    trim: true,
  })
  originalName: string;

  @Prop({
    required: true,
    trim: true,
    lowercase: true,
  })
  extension: string;

  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  fileType: string;

  @Prop({
    required: true,
    trim: true,
    lowercase: true,
  })
  mimeType: string;

  @Prop({
    required: true,
    min: 0,
  })
  size: number;

  @Prop({
    type: String,
    enum: Object.values(DocumentStatus),
    required: true,
    default: DocumentStatus.Pending,
    index: true,
  })
  status: DocumentStatus;
}

export const DocumentSchema = SchemaFactory.createForClass(Document);

DocumentSchema.index({ userId: 1, knowledgeBaseId: 1 });
