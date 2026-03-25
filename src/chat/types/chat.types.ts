/**
 * 定义对话消息类型的可选枚举值。
 */
export enum ChatMessageType {
  System = 'system',
  Human = 'human',
  Ai = 'ai',
  Tool = 'tool',
}

/**
 * 定义对话请求消息Role的类型结构。
 */
export type ChatRequestMessageRole =
  | ChatMessageType.System
  | ChatMessageType.Human
  | ChatMessageType.Tool;

/**
 * 定义对话工具调用的类型结构。
 */
export type ChatToolCall = {
  id?: string;
  name: string;
  args: Record<string, unknown>;
};

/**
 * 定义对话消息来源的类型结构。
 */
export type ChatMessageSource = {
  documentId: string;
  documentName: string;
  chunkSequence: number;
  page?: number;
  startIndex?: number;
  endIndex?: number;
  score?: number;
};

/**
 * 定义对话用量元数据的类型结构。
 */
export type ChatUsageMetadata = {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  input_token_details?: Record<string, unknown>;
  output_token_details?: Record<string, unknown>;
};

/**
 * 描述序列化后的对话会话结构。
 */
export type SerializedChatSession = {
  id: string;
  userId: string;
  knowledgeBaseId?: string | null;
  title: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * 描述序列化后的对话消息结构。
 */
export type SerializedChatMessage = {
  id: string;
  userId: string;
  sessionId: string;
  messageType: ChatMessageType;
  content: string;
  sequence: number;
  name?: string;
  toolCallId?: string;
  toolCalls?: ChatToolCall[];
  responseMetadata?: Record<string, unknown>;
  usageMetadata?: ChatUsageMetadata;
  sources?: ChatMessageSource[];
  createdAt: string;
  updatedAt: string;
};

/**
 * 定义对话问答响应的类型结构。
 */
export type ChatAskResponse = {
  sessionId: string;
  answer: string;
  message: SerializedChatMessage;
  sources: ChatMessageSource[];
};

/**
 * 定义对话问答流式分片的类型结构。
 */
export type ChatAskStreamChunk = {
  sessionId: string;
  answer: string;
  progress?: string;
  error?: string;
  message?: SerializedChatMessage;
  sources?: ChatMessageSource[];
  done?: boolean;
};

/**
 * 定义创建对话消息Params的类型结构。
 */
export type CreateChatMessageParams = {
  userId: string;
  sessionId: string;
  messageType: ChatMessageType;
  content: string;
  sequence: number;
  name?: string;
  toolCallId?: string;
  toolCalls?: ChatToolCall[];
  responseMetadata?: Record<string, unknown>;
  usageMetadata?: ChatUsageMetadata;
  sources?: ChatMessageSource[];
};
