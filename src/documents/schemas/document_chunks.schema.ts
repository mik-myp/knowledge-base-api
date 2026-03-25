import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/**
 * 定义文档分片文档的类型结构。
 */
export type DocumentChunkDocument = HydratedDocument<DocumentChunk>;

/**
 * 定义文档分片相关逻辑。
 */
@Schema({
  collection: 'document_chunks',
  timestamps: true,
  versionKey: false,
})
export class DocumentChunk {
  /**
   * 保存当前用户 ID。
   */
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  /**
   * 保存知识库 ID。
   */
  @Prop({
    type: Types.ObjectId,
    ref: 'KnowledgeBase',
    required: true,
    index: true,
  })
  knowledgeBaseId: Types.ObjectId;

  /**
   * 保存文档 ID。
   */
  @Prop({ type: Types.ObjectId, ref: 'Document', required: true, index: true })
  documentId: Types.ObjectId;

  /**
   * 保存消息序号。
   */
  @Prop({ type: Number, required: true, min: 0 })
  sequence: number;

  /**
   * 保存内容。
   */
  @Prop({ type: String, required: true })
  content: string;

  /**
   * 保存页码。
   */
  @Prop({ type: Number, min: 1, default: undefined })
  page?: number;

  /**
   * 保存startIndex。
   */
  @Prop({ type: Number, min: 0, default: undefined })
  startIndex?: number;

  /**
   * 保存endIndex。
   */
  @Prop({ type: Number, min: 0, default: undefined })
  endIndex?: number;
}

/**
 * 定义文档分片Schema。
 */
export const DocumentChunkSchema = SchemaFactory.createForClass(DocumentChunk);

DocumentChunkSchema.index({ documentId: 1, sequence: 1 }, { unique: true });
DocumentChunkSchema.index({ userId: 1, knowledgeBaseId: 1 });
DocumentChunkSchema.index({ knowledgeBaseId: 1, documentId: 1 });
