# RAG 最小实现说明

## 1. 当前只做一个问答接口

当前最小闭环只建议实现：

- `chat_sessions`
- `chat_messages`
- `POST /chat/ask`

不要先实现：

- `chat/stream`

---

## 2. 最小问答链路

```text
question
  -> 校验或创建 session
  -> 保存 human message
  -> 校验 knowledgeBaseId 是否属于当前用户
  -> 查询当前 knowledgeBase 下的 document_chunks
  -> 选出最相关的前 N 个 chunk
  -> 组装 prompt
  -> 调用 LangChain ChatOpenAI
  -> 保存 ai message
  -> 返回 sessionId + answer + sources
```

---

## 3. 当前最小来源结构

来源引用只保留：

- `documentId`
- `documentName`
- `chunkSequence`
- `page`
- `startIndex`
- `endIndex`

不要先扩展：

- `headingPath`

---

## 4. 当前最小检索策略

如果你还不想引入 embeddings，当前可以先做：

- 基于 chunk 文本的关键词匹配
- 按匹配分数选 topK

这样也能先跑通一个可用的个人 RAG 闭环。

等这条线稳定后，再升级为向量检索。

---

## 5. LangChain 最小消息持久化约定

`chat_sessions` 只负责业务会话容器。

真正与 LangChain 对齐的是 `chat_messages`：

- `messageType = system` 对应 `SystemMessage`
- `messageType = human` 对应 `HumanMessage`
- `messageType = ai` 对应 `AIMessage`
- `messageType = tool` 对应 `ToolMessage`

当前最小闭环只保存：

- `messageType`
- `content`
- `sequence`
- `sources`

不要先把 LangChain 返回对象整包塞进数据库。

### 为什么 `chat_sessions` 不按 LangChain 设计

因为 LangChain 没有要求你必须存在“会话表”。

所以当前最小闭环里：

- `chat_sessions` 只负责把一轮轮问答串起来
- `chat_sessions.title` 负责给前端展示会话标题
- `chat_messages` 才负责承接 LangChain 消息类型

### 为什么 `chat_messages` 不直接照搬 LangChain 全量参数

LangChain 常见消息对象里，除了 `type` 和 `content`，还可能带：

- `id`
- `response_metadata`
- `usage_metadata`
- `tool_calls`

但对当前最小闭环来说，真正必须落库的只有：

- `messageType`
- `content`
- `sequence`
- `sources`

这样才能保证表结构最小、实现最稳。

---

## 6. `document_chunks` 与 LangChain 拆分结果的最小映射

如果你用 LangChain 做拆分，当前最小闭环建议这样映射：

- `pageContent` -> `document_chunks.content`
- 拆分结果顺序 -> `document_chunks.sequence`
- `metadata.page` -> `document_chunks.page`
- `metadata.startIndex` -> `document_chunks.startIndex`
- `startIndex + content.length` 或你自己的计算结果 -> `document_chunks.endIndex`

设计原则：

- `page / startIndex / endIndex` 属于 chunk 自身事实，可以直接落库
- `chunkSize / chunkOverlap / separators` 这类切分配置，不要重复写进每条 chunk
