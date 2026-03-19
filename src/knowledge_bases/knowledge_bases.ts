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

export type KnowledgeBaseListResult = {
  dataList: KnowledgeBaseRecord[];
  total: number;
};

export type KnowledgeBaseDocumentRecord = {
  id: string;
  userId: Types.ObjectId;
  knowledgeBaseId: Types.ObjectId;
  title: string;
  originalName: string;
  ext: string;
  mimeType: string;
  size: number;
  sha256?: string;
  storageProvider: string;
  bucket: string;
  objectKey: string;
  status: string;
  pageCount?: number;
  chunkCount?: number;
  parseErrorMessage?: string | null;
  indexedAt?: Date;
};

export type KnowledgeBaseDocumentListResult = {
  dataList: KnowledgeBaseDocumentRecord[];
  total: number;
};
