# 最小可用表结构与 Schema 示例

这份文档分两部分写：

- 已经在后端代码里存在的 schema，直接按当前实现给示例
- 还没实现但前端 `AntDX` 页面已经明确需要的 schema，按推荐结构给示例

---

## 1. 已实现：`knowledge_bases`

```ts
@Schema({ collection: 'knowledge_bases', timestamps: true, versionKey: false })
export class KnowledgeBase {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: String, required: true, maxLength: 100, trim: true })
  name: string;

  @Prop({ type: String, maxLength: 500, trim: true })
  description?: string;
}
```

适用场景：

- 知识库下拉列表
- 文档上传归属
- 会话绑定知识库
- 普通 AI 会话与知识库会话并存

---

## 2. 已实现：`documents`

```ts
export enum DocumentSourceType {
  Upload = 'upload',
  Editor = 'editor',
}

@Schema({ collection: 'documents', timestamps: true, versionKey: false })
export class Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'KnowledgeBase',
    required: true,
    index: true,
  })
  knowledgeBaseId: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(DocumentSourceType),
    required: true,
  })
  sourceType: DocumentSourceType;

  @Prop({ type: String, required: true, trim: true })
  originalName: string;

  @Prop({ type: String, trim: true, default: undefined })
  storageKey?: string;

  @Prop({ type: String, default: undefined })
  content?: string;

  @Prop({ type: String, required: true, trim: true, lowercase: true })
  extension: string;

  @Prop({ type: String, required: true, trim: true, lowercase: true })
  mimeType: string;

  @Prop({ type: Number, required: true, min: 0 })
  size: number;
}
```

这张表只保留主记录，不存切片数组，不存 embedding。

---

## 3. 已实现：`document_chunks`

```ts
@Schema({ collection: 'document_chunks', timestamps: true, versionKey: false })
export class DocumentChunk {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'KnowledgeBase',
    required: true,
    index: true,
  })
  knowledgeBaseId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Document', required: true, index: true })
  documentId: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 0 })
  sequence: number;

  @Prop({ type: String, required: true })
  content: string;

  @Prop({ type: Number, min: 1, default: undefined })
  page?: number;

  @Prop({ type: Number, min: 0, default: undefined })
  startIndex?: number;

  @Prop({ type: Number, min: 0, default: undefined })
  endIndex?: number;
}
```

推荐索引：

```ts
DocumentChunkSchema.index({ documentId: 1, sequence: 1 }, { unique: true });
DocumentChunkSchema.index({ userId: 1, knowledgeBaseId: 1 });
DocumentChunkSchema.index({ knowledgeBaseId: 1, documentId: 1 });
```

这张表是来源定位依据，不要删掉 `page/startIndex/endIndex`。

---

## 4. 已实现：`document_chunk_vectors`

这张表当前不是 Mongoose schema，而是 Mongo 原生集合。  
建议至少固定一份 TypeScript 类型，避免前后文档不一致。

```ts
export type DocumentChunkVector = {
  userId: string;
  knowledgeBaseId: string;
  documentId: string;
  documentName: string;
  sequence: number;
  text: string;
  embedding: number[];
  page?: number;
  startIndex?: number;
  endIndex?: number;
};
```

当前 `DocumentIndexingService.replaceDocumentVectors()` 写入的就是这组字段。

关键点：

- `text` 对应切片内容
- `embedding` 是向量数组
- `page/startIndex/endIndex` 是来源定位字段快照
- 这里的 id 都是字符串，服务于 `$vectorSearch.filter`

---

## 5. 推荐新增：`chat_sessions`

前端 `ChatSide -> Conversations` 已经明确要求后端提供会话容器，所以这张表必须补。

```ts
@Schema({ collection: 'chat_sessions', timestamps: true, versionKey: false })
export class ChatSession {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'KnowledgeBase',
    default: null,
    index: true,
  })
  knowledgeBaseId?: Types.ObjectId | null;

  @Prop({ type: String, required: true, trim: true, maxLength: 200 })
  title: string;
}

export const ChatSessionSchema = SchemaFactory.createForClass(ChatSession);

ChatSessionSchema.index({ userId: 1, updatedAt: -1 });
```

为什么只保留这 3 个业务字段：

- `Conversations` 组件最终只需要 `id + title + updatedAt`
- `group` 用 `updatedAt` 算
- `activeKey` 是前端状态，不落库
- `knowledgeBaseId` 有值表示知识库会话，为空表示普通 AI 会话

配套行为建议固定：

- `POST /chat/sessions` 新建空会话
- `PATCH /chat/sessions/:id` 只改 `title`
- `DELETE /chat/sessions/:id` 时级联删除该会话下的消息

---

## 6. 推荐新增：`chat_messages`

这张表负责承接 LangChain 消息事实，同时给前端消息列表提供数据源。

```ts
type ChatMessageType = 'system' | 'human' | 'ai' | 'tool';

type ChatMessageSource = {
  documentId: Types.ObjectId;
  documentName: string;
  chunkSequence: number;
  page?: number;
  startIndex?: number;
  endIndex?: number;
  score?: number;
};

@Schema({ collection: 'chat_messages', timestamps: true, versionKey: false })
export class ChatMessage {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'KnowledgeBase',
    default: null,
    index: true,
  })
  knowledgeBaseId?: Types.ObjectId | null;

  @Prop({
    type: Types.ObjectId,
    ref: 'ChatSession',
    required: true,
    index: true,
  })
  sessionId: Types.ObjectId;

  @Prop({ type: String, required: true, enum: ['system', 'human', 'ai', 'tool'] })
  messageType: ChatMessageType;

  @Prop({ type: String, required: true })
  content: string;

  @Prop({ type: Number, required: true, min: 0 })
  sequence: number;

  @Prop({
    type: [
      {
        documentId: { type: Types.ObjectId, required: true },
        documentName: { type: String, required: true },
        chunkSequence: { type: Number, required: true },
        page: { type: Number, required: false },
        startIndex: { type: Number, required: false },
        endIndex: { type: Number, required: false },
        score: { type: Number, required: false },
      },
    ],
    default: undefined,
  })
  sources?: ChatMessageSource[];
}

export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);

ChatMessageSchema.index({ sessionId: 1, sequence: 1 }, { unique: true });
ChatMessageSchema.index({ userId: 1, sessionId: 1, createdAt: 1 });
```

为什么不用前端的 `user/assistant` 直接落库：

- 后端要和 LangChain 消息类型对齐
- 前端展示时再把 `human -> user`、`ai -> assistant`
- 这样数据库更稳定，前端组件怎么换都不影响后端事实表
- `knowledgeBaseId` 只是当前会话上下文快照，普通 AI 会话时为空

---

## 7. 推荐 DTO：给 AntDX 页面用，不要直接暴露数据库结构

### 7.1 会话列表 DTO

```ts
export type ChatSessionListItemDto = {
  id: string;
  title: string;
  knowledgeBaseId: string | null;
  updatedAt: string;
};
```

前端映射到 `Conversations.items`：

```ts
const items = dataList.map((item) => ({
  key: item.id,
  label: item.title,
  group: toConversationGroup(item.updatedAt),
}));
```

### 7.2 新增会话 DTO

```ts
export type CreateChatSessionDto = {
  knowledgeBaseId?: string;
  title?: string;
};
```

建议：

- `knowledgeBaseId` 不传表示普通 AI 会话
- `title` 不传时，后端默认使用 `新会话`

### 7.3 会话重命名 DTO

```ts
export type RenameChatSessionDto = {
  title: string;
};
```

这里不要允许改 `knowledgeBaseId`。  
会话上下文范围一旦创建就固定。

### 7.4 消息列表 DTO

```ts
export type ChatMessageListItemDto = {
  id: string;
  messageType: 'system' | 'human' | 'ai' | 'tool';
  content: string;
  sequence: number;
  sources?: Array<{
    documentId: string;
    documentName: string;
    chunkSequence: number;
    page?: number;
    startIndex?: number;
    endIndex?: number;
    score?: number;
  }>;
};
```

前端映射到 `Bubble.List.items`：

```ts
const items = dataList
  .filter((item) => item.messageType === 'human' || item.messageType === 'ai')
  .map((item) => ({
    key: item.id,
    role: item.messageType === 'human' ? 'end' : 'start',
    content: item.content,
    extraInfo: item.sources,
  }));
```

---

## 8. 推荐问答返回 DTO

```ts
export type AskChatResponseDto = {
  sessionId: string;
  answer: string;
  sources: Array<{
    documentId: string;
    documentName: string;
    chunkSequence: number;
    page?: number;
    startIndex?: number;
    endIndex?: number;
    score?: number;
  }>;
};
```

这份 DTO 是给前端的，不要直接把 LangChain 返回对象原样透传。
