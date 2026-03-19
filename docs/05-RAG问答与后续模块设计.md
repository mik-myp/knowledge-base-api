# 05 RAG 问答与后续模块设计

> 状态：规划中
>
> 适用范围：集中记录 `documents / document_chunks / chat / RAG / SSE` 的后续设计，避免与当前已实现接口混写。

---

## 1. 本文覆盖范围

本文聚焦后续要实现但当前仓库尚未落地的部分：

- 文档上传
- 文档解析
- chunk 持久化
- Embedding
- 向量检索
- JSON 问答
- SSE 流式问答
- 引用来源与消息持久化

---

## 2. 文档模块的第一优先级

前端的直接需求是：

> 展示当前用户下所有知识库中的全部文档，并按文件类型区分

因此文档模块第一版不应一上来就追求“上传到对象存储 + 向量索引 + 流式问答”全部完成，而应该优先把这条链路做顺：

1. `documents` 集合
2. `GET /documents`
3. `fileType` 归类
4. 文档状态流转

---

## 3. 文档类型设计

推荐同时保存两个字段：

- `extension`
- `fileType`

其中：

- `extension` 保留原始扩展名，例如 `docx`、`md`、`pdf`
- `fileType` 负责前端展示和筛选，例如 `word`、`markdown`、`pdf`

推荐映射关系：

| 扩展名 | `fileType` |
| --- | --- |
| `pdf` | `pdf` |
| `doc` / `docx` | `word` |
| `md` / `markdown` | `markdown` |
| `txt` | `text` |
| `xls` / `xlsx` / `csv` | `spreadsheet` |
| `ppt` / `pptx` | `presentation` |
| 其他 | `other` |

---

## 4. 文档状态设计

第一版推荐状态：

- `pending`
- `processing`
- `ready`
- `failed`

这样能兼顾：

- 前端列表页展示解析进度
- 后续任务重试
- 管理端排错

---

## 5. Chunk 设计

`document_chunks` 应该采用独立集合，而不是直接嵌到文档里。

原因：

- chunk 数量可能很多
- 后续要做 Embedding 和检索
- 独立集合更利于删除、重建、过滤和索引

推荐字段：

- `userId`
- `knowledgeBaseId`
- `documentId`
- `sequence`
- `content`
- `charCount`
- `tokenCount`

---

## 6. 会话与消息设计

### 6.1 `chat_sessions`

建议字段：

- `userId`
- `knowledgeBaseId`
- `title`
- `messageCount`
- `lastMessageAt`

### 6.2 `chat_messages`

建议字段：

- `userId`
- `knowledgeBaseId`
- `sessionId`
- `role`
- `content`
- `sequence`

推荐角色：

- `user`
- `assistant`
- `system`

---

## 7. 检索链路

完整 RAG 问答建议遵循这个顺序：

1. 接收用户问题
2. 根据 `userId + knowledgeBaseId` 限定检索范围
3. 从 `document_chunks` 找到相关上下文
4. 组装 Prompt
5. 调用聊天模型
6. 生成回答
7. 保存会话与消息

这里的关键原则是：

- 永远按 `knowledgeBaseId` 限定范围
- 不要把所有用户文档混到一个共享检索空间里

---

## 8. JSON 与 SSE 的职责分工

### 8.1 JSON 问答

适合：

- 后台管理端
- 调试检索质量
- 需要一次性拿到完整结果的场景

### 8.2 SSE 问答

适合：

- 聊天页
- 前端联调
- 更接近 ChatGPT 的交互体验

建议实现顺序：

1. 先做 JSON
2. 再做 SSE

---

## 9. 引用来源设计

当回答基于检索结果生成时，建议在回答中保留引用来源快照。

最低建议信息：

- `documentId`
- `documentName`
- `chunkId`
- `chunkSequence`
- `snippet`

这样做的好处是：

- 前端可以展示“答案来自哪份文档”
- 后续即使文档内容更新，也不影响历史消息展示

---

## 10. 后续代码落地顺序建议

推荐按下面顺序推进：

1. `documents` schema、DTO、service、controller
2. `GET /documents`
3. `document_chunks` schema 与重建逻辑
4. `chat_sessions` / `chat_messages`
5. JSON 问答
6. SSE

---

## 11. 与当前代码的边界

截至 2026-03-19，本文所有内容都属于“设计与蓝图”，当前仓库尚未落地。

如果你正在维护线上环境，请以这两份文档为准：

- [03-当前已实现接口与代码结构](./03-当前已实现接口与代码结构.md)
- [项目部署与更新指南](./项目部署与更新指南.md)

---

## 12. 关联阅读

- 数据模型主文档：[02-架构与数据模型](./02-架构与数据模型.md)
- 实施步骤主线：[04-完整项目实施步骤](./04-完整项目实施步骤.md)
