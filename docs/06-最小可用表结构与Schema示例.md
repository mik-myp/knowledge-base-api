# 06 最小可用表结构与 Schema / DTO 示例

> 状态：教程蓝图
>
> 适用范围：把本项目的核心集合拆成“最小可用字段 + 后续扩展字段 + 可复制的 Mongoose Schema / DTO / Module 模板”，方便初学者直接照着实现。

---

## 1. 这份文档怎么用

这份文档不是在描述“当前仓库已经全部存在这些代码”，而是在提供一套和当前仓库风格一致的实现模板。

建议阅读顺序：

1. 先看 [00-项目产品与业务总览](./00-项目产品与业务总览.md)，知道项目想做什么
2. 再看 [02-架构与数据模型](./02-架构与数据模型.md)，知道为什么需要这些集合
3. 然后看本文，直接照着写 schema、dto、module、类型和字段
4. 最后看 [07-后端开发规范与Nest学习路径](./07-后端开发规范与Nest学习路径.md)，统一 Nest 写法

---

## 2. 统一写法约定

后续所有 schema 推荐统一遵循：

```ts
@Schema({
  collection: 'collection_name',
  timestamps: true,
  versionKey: false,
})
export class Xxx {}

export type XxxDocument = HydratedDocument<Xxx>;

export const XxxSchema = SchemaFactory.createForClass(Xxx);
```

关联字段统一用：

```ts
@Prop({
  type: Types.ObjectId,
  ref: 'ParentModelName',
  required: true,
  index: true,
})
parentId: Types.ObjectId;
```

模块统一用：

```ts
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Xxx.name, schema: XxxSchema },
    ]),
  ],
  controllers: [XxxController],
  providers: [XxxService],
  exports: [XxxService],
})
export class XxxModule {}
```

---

## 3. `users` 最小可用示例

### 3.1 适合先实现哪些字段

MVP 必需字段：

- `email`
- `password`
- `username`
- `status`
- `refreshToken`

后续可扩展字段：

- `lastLoginAt`
- `avatar`

### 3.2 表字段说明

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `_id` | ObjectId | 是 | 用户主键 |
| `email` | string | 是 | 登录邮箱，唯一 |
| `password` | string | 是 | 密码哈希 |
| `username` | string | 是 | 用户昵称 |
| `status` | string | 是 | 用户状态，推荐 `active/disabled` |
| `refreshToken` | string | 否 | 当前有效 refreshToken 的哈希 |
| `lastLoginAt` | Date | 否 | 最近登录时间 |
| `createdAt` | Date | 是 | 创建时间 |
| `updatedAt` | Date | 是 | 更新时间 |

### 3.3 Schema 示例

```ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

export enum UserStatus {
  Active = 'active',
  Disabled = 'disabled',
}

@Schema({
  collection: 'users',
  timestamps: true,
  versionKey: false,
})
export class User {
  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  email: string;

  @Prop({
    type: String,
    required: true,
  })
  password: string;

  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  username: string;

  @Prop({
    type: String,
    enum: Object.values(UserStatus),
    default: UserStatus.Active,
    required: true,
  })
  status: UserStatus;

  @Prop({
    type: String,
    default: undefined,
    trim: true,
  })
  refreshToken?: string;

  @Prop({
    type: Date,
    default: Date.now,
  })
  lastLoginAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ email: 1 }, { unique: true });
```

### 3.4 DTO 设计

#### `RegisterDto`

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `email` | string | 是 | 用户邮箱 |
| `password` | string | 是 | 登录密码，建议 8-32 位 |
| `username` | string | 是 | 用户昵称 |

#### `LoginDto`

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `email` | string | 是 | 用户邮箱 |
| `password` | string | 是 | 登录密码 |

#### `RefreshTokenDto`

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `refreshToken` | string | 是 | 用于刷新 accessToken 的 refreshToken |

### 3.5 Module 示例

```ts
@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

---

## 4. `knowledge_bases` 最小可用示例

### 4.1 适合先实现哪些字段

MVP 必需字段：

- `userId`
- `name`
- `description`

后续可扩展字段：

- `documentCount`
- `chunkCount`
- `sessionCount`
- `lastIndexedAt`

### 4.2 表字段说明

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `_id` | ObjectId | 是 | 知识库主键 |
| `userId` | ObjectId | 是 | 所属用户 |
| `name` | string | 是 | 知识库名称 |
| `description` | string | 否 | 知识库描述 |
| `documentCount` | number | 否 | 文档数量缓存，列表页需要时再加 |
| `chunkCount` | number | 否 | chunk 数量缓存，列表页需要时再加 |
| `sessionCount` | number | 否 | 会话数量缓存，列表页需要时再加 |
| `lastIndexedAt` | Date | 否 | 最近索引完成时间 |
| `createdAt` | Date | 是 | 创建时间 |
| `updatedAt` | Date | 是 | 更新时间 |

### 4.3 Schema 示例

```ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type KnowledgeBaseDocument = HydratedDocument<KnowledgeBase>;

@Schema({
  collection: 'knowledge_bases',
  timestamps: true,
  versionKey: false,
})
export class KnowledgeBase {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop({
    type: String,
    required: true,
    maxLength: 100,
    trim: true,
  })
  name: string;

  @Prop({
    type: String,
    maxLength: 500,
    trim: true,
  })
  description?: string;

  @Prop({
    type: Number,
    default: 0,
    min: 0,
  })
  documentCount?: number;

  @Prop({
    type: Number,
    default: 0,
    min: 0,
  })
  chunkCount?: number;

  @Prop({
    type: Number,
    default: 0,
    min: 0,
  })
  sessionCount?: number;

  @Prop({
    type: Date,
  })
  lastIndexedAt?: Date;
}

export const KnowledgeBaseSchema =
  SchemaFactory.createForClass(KnowledgeBase);

KnowledgeBaseSchema.index({ userId: 1, updatedAt: -1 });
```

### 4.4 DTO 设计

#### `CreateKnowledgeBaseDto`

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `name` | string | 是 | 知识库名称 |
| `description` | string | 否 | 知识库描述 |

#### `UpdateKnowledgeBaseDto`

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `name` | string | 否 | 更新后的知识库名称 |
| `description` | string | 否 | 更新后的知识库描述 |

#### `ListKnowledgeBasesQueryDto`

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `page` | number | 否 | 页码 |
| `pageSize` | number | 否 | 每页数量 |

### 4.5 Module 示例

```ts
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: KnowledgeBase.name, schema: KnowledgeBaseSchema },
    ]),
  ],
  controllers: [KnowledgeBasesController],
  providers: [KnowledgeBasesService],
  exports: [KnowledgeBasesService],
})
export class KnowledgeBasesModule {}
```

---

## 5. `documents` 最小可用示例

### 5.1 第一阶段最少需要哪些字段

说明：

- 当前最小闭环先以文件上传为主，因此下面把 `extension`、`mimeType`、`size` 仍列入第一阶段关注字段
- 后续接入 Markdown 编辑器时，这几个字段可以按业务放宽为可选

MVP 必需字段：

- `userId`
- `knowledgeBaseId`
- `sourceType`
- `contentFormat`
- `originalName`
- `extension`
- `fileType`
- `mimeType`
- `size`
- `status`

后续可扩展字段：

- `chunkCount`
- `processedAt`
- `storageKey`
- `errorMessage`
- `splitterType`
- `splitConfig`

### 5.2 表字段说明

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `_id` | ObjectId | 是 | 文档主键 |
| `userId` | ObjectId | 是 | 所属用户 |
| `knowledgeBaseId` | ObjectId | 是 | 所属知识库 |
| `sourceType` | string | 是 | 文档来源，推荐 `upload/editor` |
| `contentFormat` | string | 是 | 最终送去切片的内容格式，推荐 `markdown/plain_text` |
| `originalName` | string | 是 | 文档展示名；编辑器内容也建议统一使用这个字段 |
| `extension` | string | 否 | 原始扩展名；编辑器内容可为空 |
| `fileType` | string | 是 | 展示级文件类型 |
| `mimeType` | string | 否 | MIME 类型；编辑器内容可为空 |
| `size` | number | 否 | 文件大小，单位字节；编辑器内容可按字符数或 `0` 落库 |
| `status` | string | 是 | 文档处理状态 |
| `chunkCount` | number | 否 | chunk 数量缓存 |
| `processedAt` | Date | 否 | 处理完成时间 |
| `storageKey` | string | 否 | 对象存储路径 |
| `errorMessage` | string | 否 | 错误信息 |
| `splitterType` | string | 否 | 切片器类型，例如 `recursive_character` |
| `splitConfig` | object | 否 | 切片配置快照，例如 `chunkSize/chunkOverlap/separators` |
| `createdAt` | Date | 是 | 创建时间 |
| `updatedAt` | Date | 是 | 更新时间 |

### 5.3 Schema 示例

```ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type DocumentDocument = HydratedDocument<Document>;

export enum DocumentSourceType {
  Upload = 'upload',
  Editor = 'editor',
}

export enum DocumentContentFormat {
  Markdown = 'markdown',
  PlainText = 'plain_text',
}

export enum DocumentStatus {
  Pending = 'pending',
  Processing = 'processing',
  Ready = 'ready',
  Failed = 'failed',
}

export enum DocumentSplitterType {
  RecursiveCharacter = 'recursive_character',
  Token = 'token',
}

@Schema({
  collection: 'documents',
  timestamps: true,
  versionKey: false,
})
export class Document {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
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
    trim: true,
  })
  sourceType: DocumentSourceType;

  @Prop({
    type: String,
    enum: Object.values(DocumentContentFormat),
    required: true,
    trim: true,
  })
  contentFormat: DocumentContentFormat;

  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  originalName: string;

  @Prop({
    type: String,
    trim: true,
    default: undefined,
  })
  extension?: string;

  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  fileType: string;

  @Prop({
    type: String,
    trim: true,
    default: undefined,
  })
  mimeType?: string;

  @Prop({
    type: Number,
    min: 0,
    default: undefined,
  })
  size?: number;

  @Prop({
    type: String,
    enum: Object.values(DocumentStatus),
    default: DocumentStatus.Pending,
    required: true,
  })
  status: DocumentStatus;

  @Prop({
    type: Number,
    default: 0,
    min: 0,
  })
  chunkCount?: number;

  @Prop({
    type: Date,
  })
  processedAt?: Date;

  @Prop({
    type: String,
    trim: true,
  })
  storageKey?: string;

  @Prop({
    type: String,
    trim: true,
  })
  errorMessage?: string;

  @Prop({
    type: String,
    enum: Object.values(DocumentSplitterType),
    default: undefined,
  })
  splitterType?: DocumentSplitterType;

  @Prop({
    type: Object,
    default: undefined,
  })
  splitConfig?: {
    chunkSize?: number;
    chunkOverlap?: number;
    separators?: string[];
    encodingName?: string;
  };
}

export const DocumentSchema = SchemaFactory.createForClass(Document);

DocumentSchema.index({ userId: 1, updatedAt: -1 });
DocumentSchema.index({ knowledgeBaseId: 1, updatedAt: -1 });
```

### 5.4 DTO 设计

#### `ListDocumentsQueryDto`

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `page` | number | 否 | 页码 |
| `pageSize` | number | 否 | 每页数量 |
| `knowledgeBaseId` | string | 否 | 按知识库筛选 |
| `fileType` | string | 否 | 按文件类型筛选 |
| `status` | string | 否 | 按处理状态筛选 |
| `keyword` | string | 否 | 按文件名搜索 |

#### `UploadDocumentDto`

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `knowledgeBaseId` | string | 是 | 文档归属的知识库 |
| `name` | string | 否 | 自定义文档名称，不传时可使用原始文件名 |

#### `CreateEditorDocumentDto`

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `knowledgeBaseId` | string | 是 | 文档归属的知识库 |
| `name` | string | 是 | 编辑器内容的文档标题 |
| `content` | string | 是 | Markdown 原文 |

#### `UpdateDocumentStatusDto`

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `status` | string | 是 | 文档状态 |
| `processedAt` | Date | 否 | 处理完成时间 |

说明：

- 文档切片创建相关 DTO 统一放在下面的 `document_chunks` 小节中，避免在 `documents` 和 `document_chunks` 两处出现两个入口，让初学者混淆职责边界。

### 5.5 Module 示例

```ts
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Document.name, schema: DocumentSchema },
    ]),
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
```

---

## 6. `document_chunks` 最小可用示例

### 6.1 第一阶段最少需要哪些字段

MVP 必需字段：

- `userId`
- `knowledgeBaseId`
- `documentId`
- `sequence`
- `content`
- `charCount`
- `startIndex`
- `metadata`

后续可扩展字段：

- `endIndex`
- `tokenCount`
- `embedding`
- `metadata.blockType`

### 6.2 表字段说明

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `_id` | ObjectId | 是 | chunk 主键 |
| `userId` | ObjectId | 是 | 所属用户 |
| `knowledgeBaseId` | ObjectId | 是 | 所属知识库 |
| `documentId` | ObjectId | 是 | 来源文档 |
| `sequence` | number | 是 | 文档内顺序 |
| `content` | string | 是 | chunk 文本 |
| `charCount` | number | 是 | 字符数 |
| `startIndex` | number | 是 | chunk 在原文中的起始位置，推荐由 LangChain `addStartIndex` 生成 |
| `endIndex` | number | 否 | chunk 在原文中的结束位置 |
| `tokenCount` | number | 否 | token 数 |
| `embedding` | number[] | 否 | 向量数据 |
| `metadata` | object | 是 | 来源定位信息，至少支持 `sourceType/contentFormat/page/headingPath` |
| `createdAt` | Date | 是 | 创建时间 |
| `updatedAt` | Date | 是 | 更新时间 |

### 6.3 Schema 示例

```ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type DocumentChunkDocument = HydratedDocument<DocumentChunk>;

@Schema({
  collection: 'document_chunks',
  timestamps: true,
  versionKey: false,
})
export class DocumentChunk {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
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
    ref: 'Document',
    required: true,
    index: true,
  })
  documentId: Types.ObjectId;

  @Prop({
    type: Number,
    required: true,
    min: 0,
  })
  sequence: number;

  @Prop({
    type: String,
    required: true,
  })
  content: string;

  @Prop({
    type: Number,
    required: true,
    min: 0,
  })
  charCount: number;

  @Prop({
    type: Number,
    required: true,
    min: 0,
  })
  startIndex: number;

  @Prop({
    type: Number,
    min: 0,
  })
  endIndex?: number;

  @Prop({
    type: Number,
    min: 0,
  })
  tokenCount?: number;

  @Prop({
    type: [Number],
    default: undefined,
  })
  embedding?: number[];

  @Prop({
    type: Object,
    required: true,
  })
  metadata: {
    sourceType: 'upload' | 'editor';
    contentFormat: 'markdown' | 'plain_text';
    page?: number;
    headingPath?: string[];
    blockType?: string;
  };
}

export const DocumentChunkSchema =
  SchemaFactory.createForClass(DocumentChunk);

DocumentChunkSchema.index({ documentId: 1, sequence: 1 }, { unique: true });
DocumentChunkSchema.index({ knowledgeBaseId: 1 });
```

### 6.4 DTO 设计

`document_chunks` 一般不直接暴露很多独立控制器接口，更多由 `DocumentsService` 或切片任务内部使用。

推荐保留这些内部 DTO：

#### `CreateDocumentChunkDto`

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `documentId` | string | 是 | 来源文档 ID |
| `sequence` | number | 是 | chunk 顺序 |
| `content` | string | 是 | chunk 文本 |
| `charCount` | number | 是 | 字符数 |
| `startIndex` | number | 是 | chunk 起始位置 |
| `endIndex` | number | 否 | chunk 结束位置 |
| `tokenCount` | number | 否 | token 数 |
| `metadata` | object | 是 | 至少保留 `sourceType/contentFormat/page/headingPath` |

#### `RebuildDocumentChunksDto`

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `documentId` | string | 是 | 需要重建切片的文档 ID |
| `force` | boolean | 否 | 是否强制重建 |

### 6.5 Module 示例

```ts
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Document.name, schema: DocumentSchema },
      { name: DocumentChunk.name, schema: DocumentChunkSchema },
    ]),
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
```

---

## 7. `chat_sessions` 最小可用示例

### 7.1 第一阶段最少需要哪些字段

MVP 必需字段：

- `userId`
- `knowledgeBaseId`
- `title`
- `messageCount`
- `lastMessageAt`

后续可扩展字段：

- `lastMessagePreview`

### 7.2 表字段说明

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `_id` | ObjectId | 是 | 会话主键 |
| `userId` | ObjectId | 是 | 所属用户 |
| `knowledgeBaseId` | ObjectId | 是 | 所属知识库 |
| `title` | string | 是 | 会话标题 |
| `messageCount` | number | 是 | 消息数量缓存 |
| `lastMessageAt` | Date | 否 | 最近发言时间 |
| `lastMessagePreview` | string | 否 | 最近一条消息摘要 |
| `createdAt` | Date | 是 | 创建时间 |
| `updatedAt` | Date | 是 | 更新时间 |

### 7.3 Schema 示例

```ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ChatSessionDocument = HydratedDocument<ChatSession>;

@Schema({
  collection: 'chat_sessions',
  timestamps: true,
  versionKey: false,
})
export class ChatSession {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
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
    required: true,
    trim: true,
    maxLength: 200,
  })
  title: string;

  @Prop({
    type: Number,
    required: true,
    default: 0,
    min: 0,
  })
  messageCount: number;

  @Prop({
    type: Date,
  })
  lastMessageAt?: Date;

  @Prop({
    type: String,
    trim: true,
    maxLength: 300,
  })
  lastMessagePreview?: string;
}

export const ChatSessionSchema = SchemaFactory.createForClass(ChatSession);

ChatSessionSchema.index({ knowledgeBaseId: 1, updatedAt: -1 });
```

### 7.4 DTO 设计

#### `ListChatSessionsQueryDto`

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `knowledgeBaseId` | string | 否 | 按知识库筛选 |
| `page` | number | 否 | 页码 |
| `pageSize` | number | 否 | 每页数量 |

#### `CreateChatSessionDto`

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `knowledgeBaseId` | string | 是 | 所属知识库 |
| `title` | string | 否 | 会话标题，不传时可自动生成 |

### 7.5 Module 示例

```ts
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ChatSession.name, schema: ChatSessionSchema },
      { name: ChatMessage.name, schema: ChatMessageSchema },
    ]),
  ],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
```

---

## 8. `chat_messages` 最小可用示例

### 8.1 第一阶段最少需要哪些字段

MVP 必需字段：

- `userId`
- `knowledgeBaseId`
- `sessionId`
- `messageType`
- `content`
- `sequence`

后续可扩展字段：

- `messageId`
- `name`
- `sources`
- `responseMetadata`
- `usageMetadata`
- `toolCalls`
- `toolCallId`
- `toolName`
- `artifact`

### 8.2 表字段说明

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `_id` | ObjectId | 是 | 消息主键 |
| `userId` | ObjectId | 是 | 所属用户 |
| `knowledgeBaseId` | ObjectId | 是 | 所属知识库 |
| `sessionId` | ObjectId | 是 | 所属会话 |
| `messageType` | string | 是 | 对齐 LangChain，推荐 `system/human/ai/tool` |
| `content` | string / object[] | 是 | 消息正文；后续可兼容 content blocks |
| `sequence` | number | 是 | 会话内顺序 |
| `messageId` | string | 否 | LangChain / 模型返回的消息 ID |
| `name` | string | 否 | 角色别名或工具名 |
| `sources` | object[] | 否 | `ai` 消息的引用来源快照 |
| `responseMetadata` | object | 否 | 模型返回元信息 |
| `usageMetadata` | object | 否 | token 使用统计 |
| `toolCalls` | object[] | 否 | `ai` 消息中的工具调用请求 |
| `toolCallId` | string | 否 | `tool` 消息关联的调用 ID |
| `toolName` | string | 否 | `tool` 消息对应工具名 |
| `artifact` | object | 否 | `tool` 消息的原始结构化结果 |
| `createdAt` | Date | 是 | 创建时间 |
| `updatedAt` | Date | 是 | 更新时间 |

### 8.3 Schema 示例

```ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type ChatMessageDocument = HydratedDocument<ChatMessage>;

export enum ChatMessageType {
  System = 'system',
  Human = 'human',
  Ai = 'ai',
  Tool = 'tool',
}

@Schema({
  collection: 'chat_messages',
  timestamps: true,
  versionKey: false,
})
export class ChatMessage {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
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

  @Prop({
    type: String,
    enum: Object.values(ChatMessageType),
    required: true,
  })
  messageType: ChatMessageType;

  @Prop({
    type: MongooseSchema.Types.Mixed,
    required: true,
  })
  content: string | Array<Record<string, unknown>>;

  @Prop({
    type: Number,
    required: true,
    min: 0,
  })
  sequence: number;

  @Prop({
    type: String,
    trim: true,
  })
  messageId?: string;

  @Prop({
    type: String,
    trim: true,
  })
  name?: string;

  @Prop({
    type: [Object],
    default: undefined,
  })
  sources?: Array<{
    knowledgeBaseId: string;
    documentId: string;
    documentName: string;
    chunkId: string;
    chunkSequence: number;
    snippet: string;
    page?: number;
    headingPath?: string[];
    startIndex?: number;
    endIndex?: number;
    sourceType?: 'upload' | 'editor';
    contentFormat?: 'markdown' | 'plain_text';
    score?: number;
  }>;

  @Prop({
    type: Object,
    default: undefined,
  })
  responseMetadata?: Record<string, unknown>;

  @Prop({
    type: Object,
    default: undefined,
  })
  usageMetadata?: Record<string, number>;

  @Prop({
    type: [Object],
    default: undefined,
  })
  toolCalls?: Array<Record<string, unknown>>;

  @Prop({
    type: String,
    trim: true,
  })
  toolCallId?: string;

  @Prop({
    type: String,
    trim: true,
  })
  toolName?: string;

  @Prop({
    type: Object,
    default: undefined,
  })
  artifact?: Record<string, unknown>;
}

export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);

ChatMessageSchema.index({ sessionId: 1, sequence: 1 }, { unique: true });
ChatMessageSchema.index({ userId: 1, knowledgeBaseId: 1 });
```

### 8.4 DTO 设计

#### `AskQuestionDto`

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `knowledgeBaseId` | string | 是 | 当前提问的知识库 |
| `sessionId` | string | 否 | 继续已有会话时传入 |
| `question` | string | 是 | 用户问题 |

#### `StreamChatDto`

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `knowledgeBaseId` | string | 是 | 当前提问的知识库 |
| `sessionId` | string | 否 | 继续已有会话时传入 |
| `question` | string | 是 | 用户问题 |

#### `CreateChatMessageDto`

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `sessionId` | string | 是 | 所属会话 |
| `messageType` | string | 是 | 对齐 LangChain，推荐 `system/human/ai/tool` |
| `content` | string / object[] | 是 | 消息正文 |
| `sequence` | number | 是 | 会话顺序 |
| `sources` | object[] | 否 | 引用来源快照 |
| `toolCallId` | string | 否 | 工具消息关联 ID |
| `artifact` | object | 否 | 工具消息的原始结构化结果 |

### 8.5 Module 示例

```ts
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ChatSession.name, schema: ChatSessionSchema },
      { name: ChatMessage.name, schema: ChatMessageSchema },
    ]),
  ],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
```

---

## 9. 为什么推荐按这个顺序实现

推荐顺序：

1. `users`
2. `knowledge_bases`
3. `documents`
4. `document_chunks`
5. `chat_sessions`
6. `chat_messages`
7. RAG
8. SSE

原因：

- 前两步先打稳身份和容器
- `documents` 解决最明确的前端列表需求
- `document_chunks` 让文档真正可检索
- `chat_sessions` 和 `chat_messages` 让问答过程可持久化
- 最后再接 RAG 和 SSE，复杂度自然上升

---

## 10. 实现时最容易犯的错误

- 还没理清业务归属，就先往表里堆很多字段
- 把 `embedding` 当成第一阶段必需字段
- 把 `fileType` 和 `extension` 混成一个字段
- 把 `sourceType` 和 `contentFormat` 混成一个字段
- 把 LangChain 的 `chunkSize`、`chunkOverlap` 直接重复存到每条 chunk 上
- 在多个模块里重复 `forFeature` 同一张集合
- 没有 `userId` 过滤就直接查文档或会话
- 在消息表里继续使用一套和 LangChain 不一致的角色枚举
- 把 `sources` 设计成只能实时回查，导致历史消息不稳定

---

## 11. 关联阅读

- 产品与业务先看：[00-项目产品与业务总览](./00-项目产品与业务总览.md)
- 数据模型总览：[02-架构与数据模型](./02-架构与数据模型.md)
- 当前代码结构：[03-当前已实现接口与代码结构](./03-当前已实现接口与代码结构.md)
- 实施主线：[04-完整项目实施步骤](./04-完整项目实施步骤.md)
- 后端规范：[07-后端开发规范与Nest学习路径](./07-后端开发规范与Nest学习路径.md)
