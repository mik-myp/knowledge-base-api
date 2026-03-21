# 05 RAG 问答与后续模块设计

> 状态：规划中
>
> 适用范围：集中记录 `documents / document_chunks / chat / RAG / SSE` 的后续设计，避免与当前已实现接口混写。

---

## 1. 先说明本文和其他分册的边界

这份文档只回答一个问题：

> 当 `users` 和 `knowledge_bases` 已经就位后，后续模块应该如何补齐，才能把项目推进到“可上传文档、可检索、可问答、可追溯来源”的完整状态？

阅读建议：

- 想先理解产品目标和交互链路，先看 [00-项目产品与业务总览](./00-项目产品与业务总览.md)
- 想先看集合关系和字段定义，先看 [02-架构与数据模型](./02-架构与数据模型.md)
- 想直接照着写 Schema、DTO 和 Module，先看 [06-最小可用表结构与Schema示例](./06-最小可用表结构与Schema示例.md)
- 想先看当前已经存在的接口和代码结构，先看 [03-当前已实现接口与代码结构](./03-当前已实现接口与代码结构.md)
- 想按教程节奏推进开发，配合看 [04-完整项目实施步骤](./04-完整项目实施步骤.md)
- 想统一 Nest 写法和职责边界，配合看 [07-后端开发规范与Nest学习路径](./07-后端开发规范与Nest学习路径.md)

---

## 2. 后续阶段到底要补什么

本文聚焦后续要实现但当前仓库尚未落地的部分：

- 文档上传与文档主记录
- 文档解析与 chunk 持久化
- Embedding 与向量检索
- JSON 问答
- SSE 流式问答
- 引用来源快照
- 会话与消息持久化

它们共同服务这条业务主线：

```text
用户上传文档
  -> 系统保存 documents 记录
  -> 文档解析与切片
  -> 保存 document_chunks
  -> 建立 Embedding / 检索能力
  -> 用户在知识库维度提问
  -> 系统检索上下文并生成回答
  -> 保存 chat_sessions / chat_messages
  -> 前端展示答案与引用来源
```

---

## 3. 第一优先级不是“大而全”，而是跑通最短主链路

前端的直接需求是：

> 展示当前用户下所有知识库中的全部文档，并按文件类型区分。

因此第一批新增代码不应该一上来就同时引入对象存储、向量索引、流式问答和复杂任务编排，而应该先把最短可交付链路跑通：

1. `documents` 集合
2. `DocumentsModule`
3. `GET /documents`
4. `extension + fileType` 分类
5. 文档状态流转

这样做的原因很直接：

- 先满足最明确的页面需求
- 先把“知识库里有什么内容”描述清楚
- 先为后续 chunk、检索、问答打稳定基础

---

## 4. 模块蓝图与职责边界

这一节只保留模块职责和依赖方向，不再重复展开完整 Schema / DTO 示例。

如果你准备直接照着写代码，请以 [06-最小可用表结构与Schema示例](./06-最小可用表结构与Schema示例.md) 为主。

### 4.1 `DocumentsModule`

职责：

- 管理文档主记录
- 提供用户级文档列表
- 承担文档状态流转入口

第一阶段关键点：

- 先把 `documents` 主记录跑通
- 先支持 `GET /documents`
- 先让 `fileType` 和 `status` 可用于前端展示

### 4.2 `DocumentChunksModule`

职责：

- 持久化文档切片
- 为后续检索提供基础数据
- 负责切片重建和删除清理

第一阶段关键点：

- 先存 `sequence`、`content`、`charCount`
- 暂时不把 `embedding` 当成必需字段

### 4.3 `ChatModule`

职责：

- 管理会话和消息
- 支撑聊天页历史记录
- 持久化用户问题和助手回答

第一阶段关键点：

- 先把 `chat_sessions` 和 `chat_messages` 的最小字段跑通
- 先保证消息顺序和归属关系稳定

### 4.4 `RagModule`

职责：

- 检索相关 chunk
- 组装 prompt
- 调用模型
- 统一回答结构

第一阶段关键点：

- 它是能力模块，不是先做很多 CRUD 接口的模块
- 应建立在前面几张集合已经稳定之后再接入

---

## 5. API 设计与 DTO 设计

这一节承接原版大文档中的 API 与 DTO 章节，但统一改写为“规划接口”，避免让读者误以为这些能力当前已经可用。

### 5.1 `documents` 规划接口

推荐第一批接口：

- `GET /documents`
- `GET /documents/:id`
- `POST /documents/upload`
- `DELETE /documents/:id`

其中第一优先级是：

- `GET /documents`

它对应的前端页面是“当前用户下所有知识库的文档列表页”。

推荐查询参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `page` | number | 否 | 页码 |
| `pageSize` | number | 否 | 每页数量 |
| `knowledgeBaseId` | string | 否 | 按知识库筛选 |
| `fileType` | string | 否 | 按文件类型筛选 |
| `status` | string | 否 | 按处理状态筛选 |
| `keyword` | string | 否 | 按文件名搜索 |

推荐 DTO：

- `ListDocumentsQueryDto`
- `UploadDocumentDto`
- 路径参数优先直接配合 `ParseObjectIdPipe`

`ListDocumentsQueryDto` 应重点校验：

- 分页参数范围
- `knowledgeBaseId` 是否为合法 ObjectId
- `fileType`、`status` 是否在允许范围内

### 5.2 `chat` 规划接口

推荐接口：

- `GET /chat/sessions`
- `GET /chat/sessions/:id/messages`
- `POST /chat/ask`
- `POST /chat/stream`

推荐 DTO：

- `ListChatSessionsQueryDto`
- `AskQuestionDto`
- `StreamChatDto`
- 历史消息查询的路径参数优先直接配合 `ParseObjectIdPipe`

`AskQuestionDto` 第一版建议包含：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `knowledgeBaseId` | string | 是 | 当前提问的知识库 |
| `sessionId` | string | 否 | 继续已有会话时传入 |
| `question` | string | 是 | 用户问题 |

返回结构建议：

- `answer`
- `sources`
- `session`
- `message`

这样前端拿到结果后可以同时更新：

- 当前回答区
- 引用来源区
- 会话列表
- 消息流

### 5.3 DTO 设计原则

- DTO 只负责 HTTP 入参校验
- 路径参数优先配合 `ParseObjectIdPipe`
- 和数据库强绑定的字段定义放 `schema`
- 和 service 内部结构相关的类型放 `*.ts` 类型文件
- 上传场景的 DTO 不直接承载文件二进制，文件由拦截器读取，DTO 只负责业务字段

---

## 6. 文档类型、状态与来源设计

### 6.1 文件类型设计

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

### 6.2 文档状态设计

第一版推荐状态：

- `pending`
- `processing`
- `ready`
- `failed`

这样能兼顾：

- 前端列表页展示解析进度
- 后续任务重试
- 管理端排错

### 6.3 引用来源设计

当回答基于检索结果生成时，建议在 `chat_messages.sources` 或响应体中保留引用来源快照。

最低建议信息：

- `documentId`
- `documentName`
- `chunkId`
- `chunkSequence`
- `snippet`

这样做的好处是：

- 前端可以展示“答案来自哪份文档”
- 文档后续更新后，历史消息仍能保留当时的来源上下文

---

## 7. 检索链路设计

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
- 检索为空时，要么返回空检索提示，要么走受控降级策略，不能无约束自由发挥

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

原因：

- JSON 更容易调试与验收
- SSE 牵涉到流式输出、前端订阅、错误中断和最终落库，复杂度更高

---

## 9. 环境变量设计

这一节只描述“后续模块真正开始实现时才会逐步引入的变量”，避免与当前部署文档混淆。

推荐分组：

### 9.1 对象存储

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `R2_REGION`

### 9.2 模型与 Embedding

- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `OPENAI_CHAT_MODEL`
- `OPENAI_EMBEDDING_MODEL`
- `OPENAI_EMBEDDING_DIMENSIONS`

### 9.3 RAG 参数

- `MONGODB_VECTOR_INDEX_NAME`
- `RAG_CHUNK_SIZE`
- `RAG_CHUNK_OVERLAP`
- `RAG_TOP_K`
- `UPLOAD_MAX_FILE_SIZE_MB`

设计原则：

- 哪个阶段没开始实现，就不要提前把该阶段变量写成部署必需项
- Embedding 维度必须和向量索引维度一致
- 上传大小限制应与前端和 Nginx 限制保持一致

---

## 10. 各阶段建议如何推进

### 10.1 阶段一：先完成 `documents`

目标：

- 让前端能查看当前用户的全量文档列表

交付：

- `documents` schema
- `DocumentsModule`
- `GET /documents`
- `fileType` 分类

### 10.2 阶段二：补 `document_chunks`

目标：

- 让文档变成真正可检索的数据

交付：

- chunk 切分逻辑
- `document_chunks` 集合
- 文档状态流转

### 10.3 阶段三：补 `chat_sessions` 与 `chat_messages`

目标：

- 让聊天页能持久化与回放

交付：

- 会话列表
- 消息流
- `role` 与 `sequence` 规则

### 10.4 阶段四：补 JSON 问答

目标：

- 先验证检索质量和回答结构

交付：

- `POST /chat/ask`
- `sources` 返回结构
- 回答与消息落库

### 10.5 阶段五：补 SSE

目标：

- 提供更接近产品形态的实时问答体验

交付：

- `POST /chat/stream`
- token 流式返回
- 流式结束后的最终落库

---

## 11. 与当前代码的边界

截至 2026-03-20，本文所有内容都属于“设计与蓝图”，当前仓库尚未落地。

如果你正在维护当前代码或线上环境，请以这两份文档为准：

- [03-当前已实现接口与代码结构](./03-当前已实现接口与代码结构.md)
- [项目部署与更新指南](./项目部署与更新指南.md)

如果你准备开始补代码，建议把本文与这四份文档一起看：

- [00-项目产品与业务总览](./00-项目产品与业务总览.md)
- [02-架构与数据模型](./02-架构与数据模型.md)
- [06-最小可用表结构与Schema示例](./06-最小可用表结构与Schema示例.md)
- [07-后端开发规范与Nest学习路径](./07-后端开发规范与Nest学习路径.md)

---
