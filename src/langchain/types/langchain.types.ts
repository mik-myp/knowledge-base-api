/**
 * 描述一次向量检索返回的命中文档片段。
 */
export type VectorSearchHit = {
  documentId: string;
  documentName: string;
  sequence: number;
  text: string;
  page?: number;
  startIndex?: number;
  endIndex?: number;
  score: number;
};
