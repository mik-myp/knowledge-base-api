export type DocumentRecord = {
  id: string;
  userId: string;
  knowledgeBaseId: string;
  sourceType: 'upload' | 'editor';
  originalName: string;
  extension: string;
  mimeType: string;
  size: number;
  content?: string;
  createdAt: string;
  updatedAt: string;
};

export type DocumentListItemRecord = DocumentRecord & {
  knowledgeBaseName: string;
};

export type DocumentListResult = {
  dataList: DocumentListItemRecord[];
  total: number;
};

export type RemoveByDocumentIdsResult = {
  deletedCount: number;
  deletedIds: string[];
};

export type CreatedDocumentCleanupTarget = {
  documentId?: string;
  storageKey?: string;
};

export type UploadSingleFileResult = {
  cleanupTarget: CreatedDocumentCleanupTarget;
  serializedDocument: unknown;
};
