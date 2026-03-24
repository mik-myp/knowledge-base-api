export enum ChatMessageType {
  System = 'system',
  Human = 'human',
  Ai = 'ai',
  Tool = 'tool',
}

export type ChatRequestMessageRole =
  | ChatMessageType.System
  | ChatMessageType.Human
  | ChatMessageType.Tool;

export type ChatToolCall = {
  id?: string;
  name: string;
  args: Record<string, unknown>;
};

export type ChatMessageSource = {
  documentId: string;
  documentName: string;
  chunkSequence: number;
  page?: number;
  startIndex?: number;
  endIndex?: number;
  score?: number;
};

export type ChatUsageMetadata = {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  input_token_details?: Record<string, unknown>;
  output_token_details?: Record<string, unknown>;
};

export type SerializedChatSession = {
  id: string;
  userId: string;
  knowledgeBaseId?: string | null;
  title: string;
  createdAt: string;
  updatedAt: string;
};

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

export type ChatAskResponse = {
  sessionId: string;
  answer: string;
  message: SerializedChatMessage;
  sources: ChatMessageSource[];
};

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
