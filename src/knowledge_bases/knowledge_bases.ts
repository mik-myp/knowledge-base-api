import { Types } from 'mongoose';

export type KnowledgeBaseRecord = {
  id: string;
  userId: Types.ObjectId;
  name: string;
  description?: string;
  documentCount: number;
  chunkCount: number;
  sessionCount: number;
  lastIndexedAt?: Date;
};

export type KnowledgeBaseListResult = {
  dataList: KnowledgeBaseRecord[];
  total: number;
};
