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
6. 为后续 Markdown 编辑器预留统一内容模型

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
- `sourceType` 和 `contentFormat` 从一开始就分开设计，兼容文件上传与编辑器直写

### 4.2 `DocumentChunksModule`

职责：

- 持久化文档切片
- 为后续检索提供基础数据
- 负责切片重建和删除清理

第一阶段关键点：

- 先存 `sequence`、`content`、`charCount`
- 推荐同时保存 `startIndex` 和最小 `metadata`
- 暂时不把 `embedding` 当成必需字段

### 4.3 `ChatModule`

职责：

- 管理会话和消息
- 支撑聊天页历史记录
- 持久化用户问题和助手回答

第一阶段关键点：

- 先把 `chat_sessions` 和 `chat_messages` 的最小字段跑通
- 先保证消息顺序和归属关系稳定
- `chat_sessions` 保持业务会话语义，`chat_messages` 对齐 LangChain message 结构

### 4.4 `RagModule`

职责：

- 检索相关 chunk
- 组装 prompt
- 调用模型
- 统一回答结构

第一阶段关键点：

- 它是能力模块，不是先做很多 CRUD 接口的模块
- 应建立在前面几张集合已经稳定之后再接入
- 检索结果要能沉淀为 `assistant` 消息的 `sources` 快照

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

当前项目已明确有两类内容入口：

- 文件上传：当前以 `md`、`pdf`、`word` 为主
- 编辑器直写：后续 Markdown 编辑器提交 Markdown 纯文本

因此文档模型至少要把“来源”和“内容格式”拆开。

### 6.1 文件类型设计

推荐同时保存两个字段：

- `extension`
- `fileType`
- `sourceType`
- `contentFormat`

其中：

- `extension` 保留原始扩展名，例如 `docx`、`md`、`pdf`
- `fileType` 负责前端展示和筛选，例如 `word`、`markdown`、`pdf`
- `sourceType` 区分内容来自文件上传还是编辑器
- `contentFormat` 区分最终送去切片的内容是 `markdown` 还是 `plain_text`

推荐 `sourceType`：

- `upload`
- `editor`

推荐 `contentFormat`：

- `markdown`
- `plain_text`

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

- `knowledgeBaseId`
- `documentId`
- `documentName`
- `chunkId`
- `chunkSequence`
- `snippet`

如果要兼容 `pdf`、`word`、Markdown 文件与编辑器内容，推荐再补：

- `page`
- `headingPath`
- `startIndex`
- `endIndex`
- `sourceType`
- `contentFormat`
- `score`

这样做的好处是：

- 前端可以展示“答案来自哪份文档”
- PDF 可以显示页码
- Markdown 文件和编辑器内容可以显示标题路径
- 文档后续更新后，历史消息仍能保留当时的来源上下文

### 6.4 LangChain 切片参数如何落库

如果后续使用 LangChain 切片，推荐把切片配置保存在 `documents` 上，而不是每条 chunk 上都重复保存。

推荐保存在 `documents` 的字段：

- `splitterType`
- `splitConfig.chunkSize`
- `splitConfig.chunkOverlap`
- `splitConfig.separators`
- `splitConfig.encodingName`

推荐保存在 `document_chunks` 的字段：

- `sequence`
- `content`
- `charCount`
- `startIndex`
- `endIndex`
- `tokenCount`
- `metadata`

设计原则：

- chunk 表只保留 chunk 自身事实
- splitter 参数属于“本次处理配置”，不属于每条 chunk 的固有属性
- `metadata` 至少应兼容 `page`、`headingPath`、`blockType`

### 6.5 LangChain 消息结构如何映射

如果后续聊天链路也采用 LangChain，推荐这样映射：

- `chat_sessions`：继续承载业务会话，不强行套 LangChain 字段
- `chat_messages.messageType`：直接使用 `system/human/ai/tool`
- `chat_messages.content`：第一阶段可先存文本，后续可扩展到 content blocks
- `chat_messages.responseMetadata`、`usageMetadata`：对应模型返回元信息
- `chat_messages.toolCalls`、`toolCallId`、`artifact`：对应工具调用与工具结果

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
8. 给最终 `ai` 消息写入 `sources`

这里的关键原则是：

- 永远按 `knowledgeBaseId` 限定范围
- 不要把所有用户文档混到一个共享检索空间里
- 检索为空时，要么返回空检索提示，要么走受控降级策略，不能无约束自由发挥
- 如果使用 LangChain 流式输出，不要把每个 `AIMessageChunk` 都直接落库，应先聚合成完整消息再保存

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
- `sourceType/contentFormat` 设计

### 10.2 阶段二：补 `document_chunks`

目标：

- 让文档变成真正可检索的数据

交付：

- chunk 切分逻辑
- `document_chunks` 集合
- 文档状态流转
- `startIndex` 与最小来源 `metadata`

### 10.3 阶段三：补 `chat_sessions` 与 `chat_messages`

目标：

- 让聊天页能持久化与回放

交付：

- 会话列表
- 消息流
- `messageType` 与 `sequence` 规则
- LangChain message 字段映射

### 10.4 阶段四：补 JSON 问答

目标：

- 先验证检索质量和回答结构

交付：

- `POST /chat/ask`
- `sources` 返回结构
- 回答与消息落库
- `assistant` 消息来源快照

### 10.5 阶段五：补 SSE

目标：

- 提供更接近产品形态的实时问答体验

交付：

- `POST /chat/stream`
- token 流式返回
- 流式结束后的最终落库
- 聚合后的完整 `ai` 消息持久化

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

## 12. 使用 LangChain 实现文档拆分说明

这一节只说明最小闭环下，如何用 LangChain 统一处理：

- `pdf`
- `md` 文件
- `word` 文件
- Markdown 语法纯文本

目标不是一步做到最复杂，而是先把“不同来源 -> LangChain Document -> chunk -> 入库”这条链路跑通。

### 12.1 推荐依赖

当前项目如果要正式接入这些加载器，建议补齐这些依赖：

```bash
pnpm add @langchain/community @langchain/core pdf-parse mammoth word-extractor
```

说明：

- `PDFLoader` 依赖 `pdf-parse`
- `DocxLoader` 处理 `.docx` 依赖 `mammoth`
- `DocxLoader` 处理 `.doc` 依赖 `word-extractor`
- 纯文本文件可直接使用 `TextLoader`

### 12.2 按文件类型选择加载器

推荐固定映射：

- `pdf` -> `PDFLoader`
- `docx` -> `DocxLoader`
- `doc` -> `DocxLoader({ type: 'doc' })`
- `md` -> `TextLoader`
- Markdown 编辑器纯文本 -> 直接构造 LangChain `Document`

这里最重要的设计原则是：

- 先把所有输入都统一转换成 LangChain `Document[]`
- 再进入统一切片流程
- 不要为每种文件类型各写一套完全不同的 chunk 入库逻辑

### 12.3 推荐实现流程

```text
读取原始输入
  -> 按类型选择 LangChain loader
  -> 得到 LangChain Document[]
  -> 补充统一 metadata
  -> 使用 TextSplitter 切片
  -> 映射为 document_chunks
  -> 批量写入 MongoDB
  -> 更新 documents.status / chunkCount / processedAt
```

### 12.4 不同来源如何统一

#### `pdf`

建议：

- 使用 `PDFLoader`
- 保留页码相关 metadata
- 后续把页码写入 `document_chunks.metadata.page`

这样后面引用来源时，前端可以直接显示“第几页”。

#### `.docx` / `.doc`

建议：

- 使用 `DocxLoader`
- 抽取后的文本统一按 `plain_text` 处理
- 如果抽取阶段无法提供稳定页码，不要强行伪造 `page`

第一阶段重点是把文本稳定切出来，不必为了 Word 先做复杂定位。

#### `.md` 文件

建议：

- 使用 `TextLoader`
- `contentFormat` 固定记为 `markdown`
- 在进入切片前，优先在应用层补充 Markdown 结构 metadata

这里的“补充结构 metadata”是设计建议，不是 LangChain 强制要求。最常见做法是先解析 Markdown 标题层级，再把 `headingPath` 写进 metadata。

#### Markdown 语法纯文本

这类内容不需要先落临时文件再交给 loader。

推荐直接构造 LangChain `Document`：

```ts
import { Document } from "@langchain/core/documents";

const docs = [
  new Document({
    pageContent: markdownContent,
    metadata: {
      sourceType: "editor",
      contentFormat: "markdown",
      documentId,
      documentName,
    },
  }),
];
```

这样更适合后续编辑器保存、重建切片和增量更新。

### 12.5 推荐切片器

最小闭环建议优先使用：

- `RecursiveCharacterTextSplitter`

原因：

- 它是 LangChain 在通用文本场景下最稳妥的起点
- 可以配置 `chunkSize`、`chunkOverlap`
- 可以自定义 `separators`
- 对 `pdf`、`word`、`markdown`、纯文本都能统一使用

推荐思路：

- 当前项目先统一用一种 splitter 跑通主链路
- 不急着按每种文件类型拆成完全不同的 splitter 体系
- 中文或 Markdown 内容需要更好切分时，再逐步优化 `separators`

### 12.6 推荐切片参数落库方式

推荐把切片配置保存在 `documents`：

- `splitterType`
- `splitConfig.chunkSize`
- `splitConfig.chunkOverlap`
- `splitConfig.separators`
- `splitConfig.encodingName`

推荐把 chunk 自身事实保存在 `document_chunks`：

- `sequence`
- `content`
- `charCount`
- `startIndex`
- `tokenCount`
- `metadata`

这样划分的好处是：

- `documents` 负责记录“这次怎么切的”
- `document_chunks` 负责记录“切出来的结果是什么”
- 避免把一套切片参数重复写入成百上千条 chunk

### 12.7 `metadata` 最低建议

如果要兼顾上传文件与编辑器内容，建议 `document_chunks.metadata` 至少支持：

- `sourceType`
- `contentFormat`
- `page`
- `headingPath`

其中：

- `page` 主要给 PDF 用
- `headingPath` 主要给 Markdown 文件和编辑器内容用

### 12.8 一个可执行的最小实现顺序

建议按这个顺序落地：

1. 先支持 `md` 文件和 Markdown 纯文本。
2. 再接 `pdf`。
3. 最后补 `docx/doc`。

这样做的原因是：

- Markdown 最容易保留原始结构
- PDF 的来源引用价值高，值得尽早支持
- Word 抽取质量和格式差异更不稳定，适合放后面

---

## 13. 使用 LangChain 实现对话功能说明

这一节说明如何用 LangChain 实现当前项目的最小问答闭环。

最小目标：

```text
读取当前会话历史
  -> 在当前 knowledgeBase 内检索 chunk
  -> 组装 LangChain messages
  -> 调用 chat model
  -> 返回 answer + sources
  -> 保存 human 消息和 ai 消息
```

### 13.1 推荐依赖与模型入口

如果当前项目继续走 OpenAI 兼容模型，推荐使用：

```ts
import { ChatOpenAI } from "@langchain/openai";
```

推荐初始化方式：

```ts
const chatModel = new ChatOpenAI({
  model: process.env.OPENAI_CHAT_MODEL,
  temperature: 0,
});
```

如果后续需要接其他兼容提供商，优先保持 LangChain 消息和返回结构不变，只替换模型实例。

### 13.2 最小对话链路不要一开始就上 Agent

最小闭环阶段，不建议一开始就上 agent、tool calling、多工具编排。

先做这条链路就够：

1. 前端提交 `knowledgeBaseId + question`
2. 服务端按 `knowledgeBaseId` 检索相关 chunk
3. 把检索结果拼进 prompt
4. 用 LangChain chat model 调用一次
5. 返回回答并落库

这样调试成本最低，也最容易验证引用来源是否正确。

### 13.3 会话历史如何映射为 LangChain messages

数据库里建议保存：

- `chat_sessions`
- `chat_messages`

运行时再把 `chat_messages` 映射为 LangChain messages。

推荐映射：

- `messageType = system` -> `SystemMessage`
- `messageType = human` -> `HumanMessage`
- `messageType = ai` -> `AIMessage`
- `messageType = tool` -> `ToolMessage`

这里要注意：

- 数据库存的是业务稳定结构
- LangChain message 是运行时对象
- 不要把 LangChain 原始对象直接整包序列化进 MongoDB

### 13.4 最小 JSON 问答实现顺序

推荐顺序：

1. 校验当前用户是否拥有 `knowledgeBaseId`
2. 创建或读取 `chat_session`
3. 保存一条 `human` 消息
4. 查询 `document_chunks`
5. 组装系统提示词和上下文
6. 调用 `chatModel.invoke(...)`
7. 生成 `sources` 快照
8. 保存一条 `ai` 消息
9. 返回 `answer + sources + session + message`

### 13.5 `sources` 应该如何生成

最小闭环阶段，`sources` 不建议依赖模型自己返回。

更稳的做法是：

- 你先检索出 topK chunk
- 再由服务端把这些 chunk 映射成 `sources`
- 最后把 `sources` 作为 `ai` 消息快照保存

推荐每条 source 至少包含：

- `knowledgeBaseId`
- `documentId`
- `documentName`
- `chunkId`
- `chunkSequence`
- `snippet`

如有条件再补：

- `page`
- `headingPath`
- `startIndex`
- `score`

### 13.6 LangChain 返回值和数据库字段如何对应

建议这样映射：

- `AIMessage.content` -> `chat_messages.content`
- `AIMessage.id` -> `chat_messages.messageId`
- `AIMessage.response_metadata` -> `chat_messages.responseMetadata`
- `AIMessage.usage_metadata` -> `chat_messages.usageMetadata`
- 应用层构造的引用来源 -> `chat_messages.sources`

如果后续接工具调用，再补：

- `AIMessage.tool_calls` -> `chat_messages.toolCalls`
- `ToolMessage.tool_call_id` -> `chat_messages.toolCallId`
- 工具原始结果 -> `chat_messages.artifact`

### 13.7 SSE 流式问答如何做

如果后续做流式问答，LangChain 会返回 `AIMessageChunk` 流。

这里的关键约束只有一条：

- 流式过程中可以持续向前端推送
- 但数据库里只保存最终聚合完成的一条 `ai` 消息

不要：

- 每收到一个 chunk 就写一次数据库

应该：

1. 服务层消费 LangChain 的流
2. 一边向前端转发文本
3. 一边在内存里聚合完整消息
4. 流结束后统一保存 `ai` 消息和 `sources`

### 13.8 一个可执行的最小实现顺序

建议按这个顺序落地：

1. 先做 `POST /chat/ask`
2. 先做非流式 JSON 问答
3. 先把 `sources` 和消息落库做稳定
4. 再做 `POST /chat/stream`
5. 最后再考虑工具调用和更复杂的 LangChain 编排

这样能保证你每往前走一步，前端都能拿到明确可用的结果，而不是一开始就把聊天系统做成难以排查的黑盒。
