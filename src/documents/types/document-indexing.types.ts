export type PrepareChunksInput = {
  userId: string;
  knowledgeBaseId: string;
  documentId: string;
  documentName: string;
  extension: string;
  content?: string;
  file?: Express.Multer.File;
};

export type PreparedChunk = {
  sequence: number;
  content: string;
  page?: number;
  startIndex?: number;
  endIndex?: number;
};

export type SplitDocumentMetadata = {
  page?: number;
  loc?: {
    pageNumber?: number;
  };
};
