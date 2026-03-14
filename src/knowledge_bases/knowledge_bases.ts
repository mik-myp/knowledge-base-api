import { Types } from 'mongoose';

export type KnowledgeBaseRecord = {
  id: string;
  userId: Types.ObjectId;
  name: string;
  description?: string;
  documentCount: number;
  chunkCount: number;
  lastIndexedAt?: Date;
};

export type KnowledgeBaseListResult = KnowledgeBaseRecord[];
