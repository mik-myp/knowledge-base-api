# 最小可用表结构与 Schema 示例

## 1. `knowledge_bases`

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

---

## 2. `documents`

```ts
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

  @Prop({ type: String, required: true })
  sourceType: 'upload' | 'editor';

  @Prop({ type: String, required: true, trim: true })
  originalName: string;

  @Prop({ type: String, default: undefined })
  storageKey?: string;

  @Prop({ type: String, default: undefined })
  content?: string;

  @Prop({ type: String, required: true, lowercase: true })
  extension: string;

  @Prop({ type: String, required: true, lowercase: true })
  mimeType: string;

  @Prop({ type: Number, required: true, min: 0 })
  size: number;
}
```

---

## 3. `document_chunks`

这一部分当前仓库还没有实现，建议你按下面的最小结构自己补：

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

---

## 4. `chat_sessions`

这一部分当前仓库还没有实现，建议你按下面的最小结构自己补：

```ts
@Schema({ collection: 'chat_sessions', timestamps: true, versionKey: false })
export class ChatSession {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'KnowledgeBase',
    required: true,
    index: true,
  })
  knowledgeBaseId: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true, maxLength: 200 })
  title: string;
}
```

说明：

- 这张表不直接映射 LangChain 参数
- 它只是业务会话容器
- 当前最小闭环需要 `title`
- 当前最小闭环不需要 `messageCount`
- `title` 推荐使用第一条 `human` 消息截断生成

---

## 5. `chat_messages`

这一部分当前仓库还没有实现，建议你按下面的最小结构自己补：

```ts
type ChatMessageType = 'system' | 'human' | 'ai' | 'tool';

@Schema({ collection: 'chat_messages', timestamps: true, versionKey: false })
export class ChatMessage {
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
    type: Types.ObjectId,
    ref: 'ChatSession',
    required: true,
    index: true,
  })
  sessionId: Types.ObjectId;

  @Prop({ type: String, required: true })
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
      },
    ],
    default: undefined,
  })
  sources?: Array<{
    documentId: Types.ObjectId;
    documentName: string;
    chunkSequence: number;
  }>;
}
```

说明：

- `messageType` 对齐 LangChain 的 `system / human / ai / tool`
- `content` 对齐 LangChain message 的文本内容
- `sources` 只给 AI 消息保存引用来源
- 当前最小闭环不保存 LangChain 的 `id`、`response_metadata`、`usage_metadata`
