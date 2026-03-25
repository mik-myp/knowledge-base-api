# knowledge-base-api

`knowledge-base-api` 是知识库项目的后端服务，负责承接认证、知识库管理、文档存储与索引、AI 会话、RAG 检索问答等核心能力。

它不是一个简单的 CRUD 接口项目，而是一套围绕“知识入库 -> 语义检索 -> AI 回答 -> 来源追踪”组织起来的 NestJS 服务。

## 项目定位

这个后端解决的是两件事：

1. 把用户上传的文档沉淀成可管理、可检索、可追踪的数据资产。
2. 在用户发问时，把知识库检索和大模型回答串成一条稳定的问答链路。

因此项目同时包含：

- 传统业务接口：用户、知识库、文档、会话。
- AI 基础设施：文档切分、向量化、MongoDB 向量检索、流式回答。

## 核心能力

- JWT 登录鉴权，支持注册、登录、刷新令牌、退出登录、获取当前用户信息。
- 知识库 CRUD。
- 文档上传、下载、删除、分页查询、按知识库筛选。
- 文档内容解析与预览支持数据准备。
- 文档分块落库，保留 chunk 顺序、页码、原文位置。
- 文档向量生成与向量库替换。
- 普通 AI 会话与知识库 AI 会话。
- 基于 `SSE` 的流式问答接口。
- 回答附带来源片段，便于前端做引用展示和追溯。
- 统一成功响应格式与统一异常响应格式。

## 技术栈

- 框架：NestJS 11
- 语言：TypeScript
- 数据库：MongoDB + Mongoose
- 认证：Passport JWT、`@nestjs/jwt`
- AI：LangChain、OpenAI Chat、OpenAI Embeddings
- 向量检索：MongoDB Atlas Vector Search
- 文件存储：S3 兼容对象存储
- 文档解析：`pdf-parse`、`mammoth`
- 测试：Jest
- 接口文档：Swagger

## 模块划分

### 1. `users`

负责：

- 用户注册
- 用户登录
- 刷新 access token
- 退出登录
- 获取当前登录用户资料

设计特点：

- 密码使用 `bcryptjs` 加密存储。
- refresh token 不直接明文保存，而是哈希后落库。
- access token 和 refresh token 分开签发，过期时间和密钥分别配置。

### 2. `knowledge_bases`

负责：

- 创建知识库
- 查询知识库列表
- 查询单个知识库
- 更新知识库
- 删除知识库

设计特点：

- 删除知识库时，不只是删一条记录。
- 会级联删除其下文档、文档 chunk、向量数据，以及关联聊天会话和聊天消息。

### 3. `documents`

负责：

- 多文件上传
- 编辑器文档创建
- 文档分页查询
- 文档详情查询
- 文档原文件下载
- 单个删除与批量删除

设计特点：

- 上传时先校验知识库归属。
- 支持的扩展名：`pdf`、`doc`、`docx`、`md`、`markdown`、`txt`
- 如果未配置对象存储，只允许上传 `md` / `markdown` / `txt`，因为这类文本可以直接存库。
- 上传成功后会立即进入“切分 + 向量化 + 建索引”流程。
- 如果中途任何一步失败，会执行回滚，避免留下脏数据。

### 4. `document-indexing`

这是文档模块里的核心服务，负责把“原始文档”变成“可检索知识”。

处理流程：

1. 根据文件类型抽取文本。
2. 使用 `RecursiveCharacterTextSplitter` 按 `chunkSize=1000`、`chunkOverlap=200` 切分。
3. 把 chunk 信息写入 `document_chunks` 集合。
4. 调用 embedding 模型生成向量。
5. 将向量写入 MongoDB 向量集合。

额外处理：

- PDF 会尽量保留页码。
- chunk 会保留原文起止位置，方便后续高亮或定位。
- 检索和向量生成都做了超时控制。

### 5. `chat`

负责：

- 会话创建、列表查询、重命名、删除
- 查询历史消息
- 流式问答

设计特点：

- 支持普通会话，也支持绑定知识库的会话。
- 首次发问时如果没有 `sessionId`，会自动创建会话。
- 人类消息与 AI 消息都会持久化。
- 知识库会话会先做语义检索，再把结果拼到系统提示词里。
- 流式接口在输出过程中会持续发送“阶段进度”。

### 6. `langchain`

负责封装：

- `ChatOpenAI`
- `OpenAIEmbeddings`

这样业务层不直接依赖模型初始化细节，后续替换模型也更集中。

### 7. `storage`

负责：

- 上传文件到 S3 兼容对象存储
- 删除对象
- 下载对象
- 生成签名 URL

当前项目主要使用上传、删除、下载三种能力。

## 主要数据结构

| 集合 / 存储 | 作用 |
| --- | --- |
| `users` | 存储用户、密码、状态、refreshToken、最近登录时间 |
| `knowledge_bases` | 存储知识库名称、描述、归属用户 |
| `documents` | 存储文档元信息、原文内容或对象存储 key |
| `document_chunks` | 存储切分后的文本片段和定位信息 |
| 向量集合 | 存储文档片段向量，供 MongoDB 向量检索使用 |
| `chat_sessions` | 存储会话标题、归属用户、可选知识库绑定 |
| `chat_messages` | 存储会话中的所有消息、token 信息、来源引用 |

## RAG 问答链路

这个项目的 AI 主链路可以概括成下面 8 步：

1. 前端调用 `/chat/ask`，提交消息数组，可带 `sessionId` 或 `knowledgeBaseId`。
2. 后端校验参数，找出最后一条 `human` 消息。
3. 如果没有 `sessionId`，就创建新会话。
4. 先把本次用户消息落库，保证历史上下文完整。
5. 如果是知识库会话，则对问题生成向量，并在 MongoDB 中做向量检索。
6. 把命中的文档片段拼接成上下文，构造成系统提示词。
7. 调用聊天模型流式生成回答，同时通过 `SSE` 向前端持续推送进度和内容。
8. 回答完成后，把 AI 消息连同来源片段一起落库，再发送最终结果。

这套设计的价值在于：

- 普通会话和知识库会话共用同一套会话系统。
- 检索结果不是只在内存里存在，而是会跟随最终消息一起保存。
- 前端可以对来源片段做稳定展示，不是“回答结束就丢失”。

## 接口分组

### 用户接口

- `POST /users/register`
- `POST /users/login`
- `POST /users/refresh`
- `POST /users/logout`
- `GET /users/me`

### 知识库接口

- `POST /knowledge-bases`
- `GET /knowledge-bases`
- `GET /knowledge-bases/:id`
- `PATCH /knowledge-bases/:id`
- `DELETE /knowledge-bases/:id`

### 文档接口

- `POST /documents/upload`
- `POST /documents/editor`
- `GET /documents`
- `GET /documents/:id`
- `GET /documents/:id/download`
- `DELETE /documents/:id`
- `DELETE /documents/all`

### 会话接口

- `POST /chat/sessions`
- `GET /chat/sessions`
- `PATCH /chat/sessions/:id`
- `DELETE /chat/sessions/:id`
- `GET /chat/messages`
- `POST /chat/ask`

## 统一响应格式

除文件下载和流式接口外，项目统一返回：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {},
  "timestamp": "2026-03-25T00:00:00.000Z",
  "path": "/users/me"
}
```

错误响应也会保持同一结构，便于前端统一处理。

## 环境变量

项目默认优先读取 `.env.local`，其次读取 `.env`。

### MongoDB

| 变量名 | 说明 |
| --- | --- |
| `MONGODB_URI` | MongoDB 连接串 |
| `MONGODB_VECTOR_COLLECTION` | 向量集合名称 |
| `MONGODB_VECTOR_INDEX` | 向量索引名称 |
| `MONGODB_SERVER_API_STRICT` | MongoDB Server API strict 配置 |
| `MONGODB_SERVER_API_DEPRECATION_ERRORS` | MongoDB Server API deprecation errors 配置 |

### JWT

| 变量名 | 说明 |
| --- | --- |
| `JWT_ACCESS_SECRET` | access token 密钥 |
| `JWT_ACCESS_EXPIRESIN` | access token 过期时间 |
| `JWT_REFRESH_SECRET` | refresh token 密钥 |
| `JWT_REFRESH_EXPIRESIN` | refresh token 过期时间 |

### Chat 模型

| 变量名 | 说明 |
| --- | --- |
| `OPENAI_CHAT_MODEL` | 聊天模型名称 |
| `OPENAI_CHAT_API_KEY` | 聊天模型 API Key |
| `OPENAI_CHAT_BASE_URL` | 聊天模型网关地址 |

### Embedding 模型

| 变量名 | 说明 |
| --- | --- |
| `OPENAI_EMBEDDING_MODEL` | 向量模型名称 |
| `OPENAI_EMBEDDING_API_KEY` | 向量模型 API Key |
| `OPENAI_EMBEDDING_BASE_URL` | 向量模型网关地址 |
| `OPENAI_EMBEDDING_BATCH_SIZE` | 批量向量化大小，代码中上限为 10 |
| `EMBED_QUERY_TIMEOUT_MS` | 问题向量生成超时时间 |
| `VECTOR_SEARCH_TIMEOUT_MS` | 向量检索超时时间 |

### 对象存储

| 变量名 | 说明 |
| --- | --- |
| `AWS_ENDPOINT` | S3 兼容服务 endpoint |
| `AWS_ACCESS_KEY_ID` | Access Key |
| `AWS_SECRET_ACCESS_KEY` | Secret Key |
| `S3_BUCKET_NAME` | Bucket 名称 |

## 本地启动

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
pnpm start:dev
```

### 生产构建与启动

```bash
pnpm build
pnpm start:prod
```

服务默认端口为 `3000`。

## Swagger

启动后可以通过下面地址查看接口文档：

```text
http://localhost:3000/docs
```

注意，这里的 `/docs` 是运行时 Swagger 路由，不是仓库里的历史文档目录。

## 测试命令

```bash
pnpm test
pnpm test:e2e
pnpm test:cov
```

## 开发注意事项

- `app.module.ts` 中固定使用数据库名 `knowledge`，部署时需要保证 MongoDB 中该库可用。
- 如果没有配置对象存储，就不要上传 `pdf`、`doc`、`docx` 这类需要保留原文件的文档。
- 要启用知识库问答，MongoDB 侧必须先创建好向量索引，并与 `MONGODB_VECTOR_INDEX` 对应。
- `/chat/ask` 是 `SSE` 流式接口，前端不能按普通 JSON 请求处理。
