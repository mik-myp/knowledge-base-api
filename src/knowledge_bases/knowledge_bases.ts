export type KnowledgeBaseRecord = {
  id: string;
  userId: string;
  name: string;
  description?: string;
};

export type KnowledgeBaseListResult = {
  dataList: KnowledgeBaseRecord[];
  total: number;
};
