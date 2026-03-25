import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/**
 * 定义文档文档的类型结构。
 */
export type DocumentDocument = HydratedDocument<Document>;

/**
 * 定义文档来源类型的可选枚举值。
 */
export enum DocumentSourceType {
  Upload = 'upload',
  Editor = 'editor',
}

/**
 * 定义文档相关逻辑。
 */
@Schema({
  collection: 'documents',
  timestamps: true,
  versionKey: false,
})
export class Document {
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
    required: true,
    index: true,
  })
  knowledgeBaseId: Types.ObjectId;

  /**
   * 保存来源类型。
   */
  @Prop({
    type: String,
    enum: Object.values(DocumentSourceType),
    required: true,
  })
  sourceType: DocumentSourceType;

  /**
   * 保存originalName。
   */
  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  originalName: string;

  /**
   * 保存storageKey。
   */
  @Prop({
    type: String,
    trim: true,
    default: undefined,
  })
  storageKey?: string;

  /**
   * 保存内容。
   */
  @Prop({
    type: String,
    default: undefined,
  })
  content?: string;

  /**
   * 保存extension。
   */
  @Prop({
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  })
  extension: string;

  /**
   * 保存mime类型。
   */
  @Prop({
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  })
  mimeType: string;

  /**
   * 保存大小。
   */
  @Prop({
    type: Number,
    required: true,
    min: 0,
  })
  size: number;
}

/**
 * 定义文档Schema。
 */
export const DocumentSchema = SchemaFactory.createForClass(Document);

DocumentSchema.index({ userId: 1, knowledgeBaseId: 1 });
DocumentSchema.index({ userId: 1, updatedAt: -1 });
DocumentSchema.index({ knowledgeBaseId: 1, updatedAt: -1 });
