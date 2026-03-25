import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/**
 * 定义知识库基础文档的类型结构。
 */
export type KnowledgeBaseDocument = HydratedDocument<KnowledgeBase>;

/**
 * 定义知识库基础相关逻辑。
 */
@Schema({
  collection: 'knowledge_bases',
  timestamps: true,
  versionKey: false,
})
export class KnowledgeBase {
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
   * 保存名称。
   */
  @Prop({
    type: String,
    required: true,
    maxLength: 100,
    trim: true,
  })
  name: string;

  /**
   * 保存描述信息。
   */
  @Prop({
    type: String,
    maxLength: 500,
    trim: true,
  })
  description?: string;
}

/**
 * 定义知识库基础Schema。
 */
export const KnowledgeBaseSchema = SchemaFactory.createForClass(KnowledgeBase);

KnowledgeBaseSchema.index({ userId: 1, updatedAt: -1 });
