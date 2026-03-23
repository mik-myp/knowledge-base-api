import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type DocumentChunkDocument = HydratedDocument<DocumentChunk>;

@Schema({
  collection: 'document_chunks',
  timestamps: true,
  versionKey: false,
})
export class DocumentChunk {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'KnowledgeBase',
    required: true,
    index: true,
  })
  knowledgeBaseId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Document', required: true, index: true })
  documentId: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 0 })
  sequence: number;

  @Prop({ type: String, required: true })
  content: string;

  @Prop({ type: Number, min: 1, default: undefined })
  page?: number;

  @Prop({ type: Number, min: 0, default: undefined })
  startIndex?: number;

  @Prop({ type: Number, min: 0, default: undefined })
  endIndex?: number;
}

export const DocumentChunkSchema = SchemaFactory.createForClass(DocumentChunk);

DocumentChunkSchema.index({ documentId: 1, sequence: 1 }, { unique: true });
DocumentChunkSchema.index({ userId: 1, knowledgeBaseId: 1 });
DocumentChunkSchema.index({ knowledgeBaseId: 1, documentId: 1 });
