import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type DocumentDocument = HydratedDocument<Document>;

export enum DocumentStatus {
  Uploaded = 'uploaded',
  Parsing = 'parsing',
  Chunking = 'chunking',
  Embedding = 'embedding',
  Ready = 'ready',
  Failed = 'failed',
}

export enum StorageProvider {
  R2 = 'r2',
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
    maxlength: 200,
  })
  title: string;

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
  ext: string;

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

  @Prop({ trim: true })
  sha256?: string;

  @Prop({
    type: String,
    enum: Object.values(StorageProvider),
    required: true,
    default: StorageProvider.R2,
  })
  storageProvider: StorageProvider;

  @Prop({
    required: true,
    trim: true,
  })
  bucket: string;

  @Prop({
    required: true,
    trim: true,
  })
  objectKey: string;

  @Prop({
    type: String,
    enum: Object.values(DocumentStatus),
    required: true,
    default: DocumentStatus.Uploaded,
    index: true,
  })
  status: DocumentStatus;

  @Prop({ min: 0 })
  pageCount?: number;

  @Prop({ min: 0 })
  chunkCount?: number;

  @Prop({
    trim: true,
  })
  parseErrorMessage?: string;

  @Prop()
  indexedAt?: Date;
}

export const DocumentSchema = SchemaFactory.createForClass(Document);

DocumentSchema.index({ userId: 1, knowledgeBaseId: 1 });
