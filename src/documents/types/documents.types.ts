/**
 * 定义文档的数据记录结构。
 */
export type DocumentRecord = {
  id: string;
  userId: string;
  knowledgeBaseId: string;
  sourceType: 'upload' | 'editor';
  originalName: string;
  extension: string;
  mimeType: string;
  size: number;
  indexStatus: 'pending' | 'indexing' | 'success' | 'failed';
  indexingError?: string;
  content?: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * 定义文档列表Item的数据记录结构。
 */
export type DocumentListItemRecord = DocumentRecord & {
  knowledgeBaseName: string;
};

/**
 * 定义文档列表的结果结构。
 */
export type DocumentListResult = {
  dataList: DocumentListItemRecord[];
  total: number;
};

/**
 * 定义删除By文档Ids的结果结构。
 */
export type RemoveByDocumentIdsResult = {
  deletedCount: number;
  deletedIds: string[];
};

/**
 * 描述文档创建失败后需要回滚的资源标识。
 */
export type CreatedDocumentCleanupTarget = {
  documentId?: string;
  storageKey?: string;
};

/**
 * 定义上传Single文件的结果结构。
 */
export type UploadSingleFileResult = {
  cleanupTarget: CreatedDocumentCleanupTarget;
  serializedDocument: unknown;
};

/**
 * 定义文档下载的结果结构。
 */
export type DocumentDownloadResult = {
  fileName: string;
  mimeType: string;
  content: Buffer;
};
