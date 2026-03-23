# 后端开发规范与 Nest 学习路径

## 1. 当前项目的最重要规则

### 规则一：只为最小闭环加字段

如果一个字段不直接服务于：

- 建知识库
- 存文档
- 拆 chunk
- 问答

就不要先加。

### 规则二：缺失能力先文档化，不先铺大工程

当前缺失的 `document_chunks` 和 `chat/ask`，先按文档定义最小结构即可。
当前缺失的 `chat_sessions` 和 `chat_messages` 也按最小结构定义即可。

### 规则三：接口边界和数据库边界分开

- controller / DTO 用 `string`
- schema / query 用 `ObjectId`

---

## 2. 当前推荐的开发顺序

1. 读懂 `users`
2. 读懂 `knowledge_bases`
3. 读懂 `documents`
4. 自己补 `document_chunks`
5. 自己补 `chat_sessions`
6. 自己补 `chat_messages`
7. 自己补 `chat/ask`

---

## 3. 当前不要做的事

- 不要先做复杂会话能力，例如标题生成、会话列表高级筛选
- 不要先做流式
- 不要先做复杂来源元数据
- 不要先做一堆统计字段
