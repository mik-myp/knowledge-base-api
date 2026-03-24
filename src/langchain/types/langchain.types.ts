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
