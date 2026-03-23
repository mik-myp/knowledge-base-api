# AntDX 与 LangChain 搭配方案

## 1. 当前两个仓库的真实状态

### 前端现状

前端项目：`/Volumes/ZHITAI/project/knowledge-front-end`

当前 AI 页面已经有这些文件：

- `src/layouts/AILayout.tsx`
- `src/layouts/components/ChatSide.tsx`
- `src/layouts/components/ChatList.tsx`
- `src/layouts/components/ChatSender.tsx`

当前已经选型：

- `@ant-design/x`
- `@ant-design/x-sdk`

当前页面已经具备的 UI 能力：

- 左侧会话列表 `Conversations`
- 中间消息列表 `Bubble.List`
- 空态页 `Welcome`
- 底部输入区 `Sender`
- 建议项 `Suggestion`

但现在还只是“UI 骨架”，核心业务还没接上：

- `AILayout.tsx` 里还是 `XRequest("https://api.example.com/chat")`
- 会话列表还是假数据
- 消息列表没有真正接 `useXChat`
- 输入框没有真正提交到后端
- “选择知识库” 还是演示项，不是真实知识库

### 后端现状

后端项目：`/Volumes/ZHITAI/project/knowledge-base-api`

已经落地：

- `users`
- `knowledge_bases`
- `documents`
- `document_chunks`
- `document_chunk_vectors`
- 对象存储上传
- 文档切片
- 向量写入
- 向量检索

还没落地：

- `chat_sessions`
- `chat_messages`
- `GET /chat/sessions`
- `GET /chat/messages`
- `POST /chat/ask`

所以最准确的判断是：

- 前端聊天 UI 方向已经明确
- 后端文档索引链路已经明确
- 中间缺的是“会话层”和“问答接口层”

---

## 2. 这套组合应该怎么分工

### `Ant Design X`

负责：

- 会话侧边栏
- 消息气泡列表
- 输入框
- 欢迎态

### `X SDK`

负责：

- 前端消息状态
- 会话切换状态
- 请求生命周期
- 后续流式响应管理

### `Nest`

负责：

- 鉴权
- 接口
- 会话与消息持久化
- 知识库归属校验
- 文档删除与回滚

### `LangChain`

负责：

- embedding
- 检索
- prompt 组装
- 模型调用
- 后续 tool / agent

### 一条必须坚持的边界

前端可以使用 `X SDK`，但 `X SDK` 调用的必须是后端接口。  
不要让前端直接接模型 provider。

---

## 3. 推荐的最终调用链

```text
AntDX(Sender / Bubble / Conversations)
  + X SDK(useXChat / useXConversations / XRequest)
    -> Nest /chat/*
      -> ChatService
        -> DocumentIndexingService.semanticSearch()
        -> LangChain Chat Model
        -> chat_sessions / chat_messages
```

这条链路里：

- 前端不碰 embedding
- 前端不碰向量检索
- 后端不关心 Bubble 怎么渲染

---

## 4. 先从前端组件反推后端接口

### 4.1 `ChatSide -> Conversations`

它需要的是“会话列表”。

所以后端至少要有：

- `GET /chat/sessions?knowledgeBaseId=xxx`

前端需要的字段很少：

- `id`
- `title`
- `updatedAt`

然后前端自己映射：

- `key = id`
- `label = title`
- `group = today / yesterday / earlier`

`group` 不要落数据库。

### 4.2 `ChatList -> Bubble.List`

它需要的是“消息列表”。

所以后端至少要有：

- `GET /chat/messages?sessionId=xxx`

前端要的核心字段：

- `id`
- `messageType`
- `content`
- `sources`

映射规则：

- `human -> Bubble role end`
- `ai -> Bubble role start`

### 4.3 `ChatSender -> Sender + Suggestion`

它需要两类东西：

- 输入问题
- 选择知识库

所以页面级别至少要维护：

- `activeKnowledgeBaseId`
- `activeSessionId`
- `draftMessage`

后端至少要有：

- `GET /knowledge-bases`
- `POST /chat/ask`

---

## 5. 推荐的表结构，不要再混 UI 字段和数据库字段

### 5.1 前端状态字段，不进数据库

这些字段只能留在前端：

- `activeConversationKey`
- `loading`
- `status`
- `group`
- `suggestionOpen`
- `draftMessage`

### 5.2 数据库事实字段

这些字段必须进数据库：

- `chat_sessions.userId`
- `chat_sessions.knowledgeBaseId`
- `chat_sessions.title`
- `chat_messages.sessionId`
- `chat_messages.messageType`
- `chat_messages.content`
- `chat_messages.sequence`
- `chat_messages.sources`

### 5.3 检索事实字段

这些字段必须跟文档切片一起保留：

- `document_chunks.page`
- `document_chunks.startIndex`
- `document_chunks.endIndex`
- `document_chunk_vectors.page`
- `document_chunk_vectors.startIndex`
- `document_chunk_vectors.endIndex`

原因很简单：  
前端要显示来源位置，后端要做向量命中结果回填，这些信息都不能丢。

---

## 6. 推荐接口协议

### 6.1 获取会话列表

```http
GET /chat/sessions?knowledgeBaseId=kb_1
```

响应：

```json
{
  "dataList": [
    {
      "id": "session_1",
      "title": "RAG 回答为什么能显示来源",
      "knowledgeBaseId": "kb_1",
      "updatedAt": "2026-03-23T10:00:00.000Z"
    }
  ],
  "total": 1
}
```

### 6.2 获取消息列表

```http
GET /chat/messages?sessionId=session_1
```

响应：

```json
{
  "dataList": [
    {
      "id": "msg_1",
      "messageType": "human",
      "content": "RAG 回答为什么能显示来源？",
      "sequence": 0
    },
    {
      "id": "msg_2",
      "messageType": "ai",
      "content": "因为后端把命中的 chunk 定位信息一起持久化并回传了。",
      "sequence": 1,
      "sources": [
        {
          "documentId": "doc_1",
          "documentName": "设计说明.md",
          "chunkSequence": 4,
          "page": 2,
          "startIndex": 180,
          "endIndex": 320,
          "score": 0.91
        }
      ]
    }
  ]
}
```

### 6.3 单次问答

```http
POST /chat/ask
Content-Type: application/json
```

请求体：

```json
{
  "knowledgeBaseId": "kb_1",
  "sessionId": "session_1",
  "question": "RAG 回答为什么能显示来源？",
  "topK": 5
}
```

响应体：

```json
{
  "sessionId": "session_1",
  "answer": "因为后端把命中的 chunk 定位信息一起持久化并回传了。",
  "sources": [
    {
      "documentId": "doc_1",
      "documentName": "设计说明.md",
      "chunkSequence": 4,
      "page": 2,
      "startIndex": 180,
      "endIndex": 320,
      "score": 0.91
    }
  ]
}
```

---

## 7. `POST /chat/ask` 在后端应该怎么跑

推荐固定成下面这条链路：

1. 校验当前用户
2. 校验 `knowledgeBaseId` 归属
3. 如果传了 `sessionId`，校验会话归属
4. 如果没传 `sessionId`，创建 `chat_session`
5. 保存 `human` 消息
6. 调 `DocumentIndexingService.semanticSearch()`
7. 组装上下文和 prompt
8. 调 LangChain chat model
9. 保存 `ai` 消息和 `sources`
10. 返回 `sessionId + answer + sources`

这里最重要的不是“能回答”，而是“回答和来源能闭环回到前端”。

---

## 8. 现阶段最重要的三个建模结论

### 8.1 会话必须绑定知识库

不要做“一个会话里随时切知识库”的设计。

正确方式：

- 一条 `chat_session` 只对应一个 `knowledgeBaseId`
- 用户切知识库，本质上就是切一个新的会话上下文

### 8.2 消息存 LangChain 语义，前端再映射 UI 语义

后端存：

- `system`
- `human`
- `ai`
- `tool`

前端显示：

- `human -> user/end`
- `ai -> assistant/start`

这样数据库不会被某个 UI 组件绑死。

### 8.3 来源字段必须是“快照”

`sources` 不要只存一个 `documentId`。  
最少要带：

- `documentId`
- `documentName`
- `chunkSequence`
- `page`
- `startIndex`
- `endIndex`
- `score`

原因：

- 前端立即可展示
- 以后就算文档名称变化，也不影响历史消息回放

---

## 9. 前端建议怎么改，文件级别说明

### 9.1 `src/layouts/AILayout.tsx`

这个文件应该升级成页面状态入口，至少负责：

- 拉知识库列表
- 拉会话列表
- 维护 `activeKnowledgeBaseId`
- 维护 `activeSessionId`
- 维护 `messages`
- 把回调传给 `ChatSide`、`ChatList`、`ChatSender`

当前的占位代码需要改掉：

- 删除 `https://api.example.com/chat`
- 不再使用静态 `DEFAULT_CONVERSATIONS_ITEMS`

### 9.2 `src/layouts/components/ChatSide.tsx`

应该只做会话列表展示与切换。

接收这些 props 就够了：

- `conversations`
- `activeConversationKey`
- `onCreateConversation`
- `onChangeConversation`

### 9.3 `src/layouts/components/ChatList.tsx`

应该真正接收消息数据，而不是只吃空数组默认值。

建议 props：

- `messages`
- `isRequesting`

如果要显示来源，可以把 `sources` 渲染到 `extraInfo` 或消息下方扩展区。

### 9.4 `src/layouts/components/ChatSender.tsx`

应该负责：

- 输入问题
- 显示知识库建议项
- 提交时调用页面层的 `onSubmit`

不应该自己持久化消息。

---

## 10. 是否要用 X SDK

答案是：要用，但方式要对。

### 当前阶段推荐

先把接口跑通，再把前端消息流切到 X SDK。

顺序建议：

1. 先实现 `GET /chat/sessions`
2. 先实现 `GET /chat/messages`
3. 先实现 `POST /chat/ask`
4. 再让 `useXConversations` 接真实会话列表
5. 再让 `useXChat` 接真实消息提交

### 不推荐

不推荐这样做：

- 前端用 `OpenAIChatProvider`
- 后端再自己做一套 `LangChain RAG`

这会造成双重编排，后面一定会乱。

---

## 11. 非流式和流式的落地顺序

### 阶段 1：先做非流式

前端：

- `Sender.onSubmit -> POST /chat/ask`
- 收到响应后把 AI 消息塞回列表

后端：

- 返回完整 `answer`
- 同时返回 `sources`

### 阶段 2：再做流式

前端：

- `XRequest`
- `XStream`
- `useXChat`

后端：

- `POST /chat/stream`
- 逐 token 返回
- 流结束后再持久化完整 `ai` 消息

---

## 12. 最终结论

这套项目里，最稳的组合不是“AntDX 直接连模型”，而是：

```text
AntDX + X SDK
  -> Nest /chat/*
    -> LangChain
      -> 文档检索与模型调用
```

按当前真实仓库状态继续往下做，核心不是再重写文档索引，而是补齐这三块：

1. `chat_sessions`
2. `chat_messages`
3. `/chat/sessions`、`/chat/messages`、`/chat/ask`

只要这三块补上，前端现有 AI 页面就能从演示骨架进入真正可用状态。
