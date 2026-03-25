/**
 * 描述文档分片准备阶段需要的输入参数。
 */
export type PrepareChunksInput = {
  userId: string;
  knowledgeBaseId: string;
  documentId: string;
  documentName: string;
  extension: string;
  content?: string;
  file?: Express.Multer.File;
};

/**
 * 描述持久化分片前使用的数据结构。
 */
export type PreparedChunk = {
  sequence: number;
  content: string;
  page?: number;
  startIndex?: number;
  endIndex?: number;
};

/**
 * 描述 LangChain 拆分文档时附带的元数据结构。
 */
export type SplitDocumentMetadata = {
  page?: number;
  loc?: {
    pageNumber?: number;
  };
};
