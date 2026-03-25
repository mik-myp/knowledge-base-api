/**
 * 定义知识库基础的数据记录结构。
 */
export type KnowledgeBaseRecord = {
  id: string;
  userId: string;
  name: string;
  description?: string;
};

/**
 * 定义知识库基础列表的结果结构。
 */
export type KnowledgeBaseListResult = {
  dataList: KnowledgeBaseRecord[];
  total: number;
};
