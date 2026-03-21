# 07 后端开发规范与 Nest 学习路径

> 状态：规范文档
>
> 适用范围：帮助新加入开发者快速理解当前项目的后端写法，也帮助纯前端背景同学循序渐进学习 Nest 项目的基本组织方式。

---

## 1. 先建立一个后端心智模型

在这个项目里，一次请求通常会按下面路径流动：

```text
前端页面
  -> Controller
  -> DTO 校验
  -> Guard / Pipe / Interceptor
  -> Service
  -> Schema / Model
  -> MongoDB
  -> 返回业务数据
  -> 响应拦截器包装
  -> 返回前端
```

这条链路里每一层都有明确职责，不应该混写。

---

## 2. Nest 项目推荐职责边界

### 2.1 Module

职责：

- 组织一个领域下的 controller、service、schema
- 声明依赖和导出能力

不应该做的事：

- 写业务逻辑
- 写请求参数处理

### 2.2 Controller

职责：

- 接收 HTTP 请求
- 读取 DTO、路径参数、当前用户
- 调用 service
- 返回结果

不应该做的事：

- 写复杂业务逻辑
- 直接访问数据库
- 拼接过多业务规则

### 2.3 Service

职责：

- 承载业务逻辑
- 组织多个 model 查询或写入
- 做权限校验、状态流转、数据转换

不应该做的事：

- 负责 HTTP 层细节
- 直接依赖具体页面表现

### 2.4 Schema / Model

职责：

- 定义持久化结构
- 定义索引
- 定义和数据库强相关的约束

不应该做的事：

- 承载业务流程
- 承载前端页面逻辑

### 2.5 DTO

职责：

- 只负责 HTTP 边界输入校验

不应该做的事：

- 充当数据库模型
- 充当 service 内部数据结构

### 2.6 Type

职责：

- 约束 service 层和内部数据结构
- 定义返回结构、token payload、业务对象

---

## 3. 当前项目的目录与写法规范

### 3.1 当前模块组织

当前核心模块：

- `users`
- `knowledge_bases`
- `common`

后续规划模块：

- `documents`
- `chat`
- `rag`
- `storage`

### 3.2 推荐目录结构

```text
src/
  users/
    dto/
    schemas/
    users.controller.ts
    users.service.ts
    users.module.ts
    users.ts
  knowledge_bases/
    dto/
    schemas/
    knowledge_bases.controller.ts
    knowledge_bases.service.ts
    knowledge_bases.module.ts
    knowledge_bases.ts
  common/
    guard/
    interceptor/
    pipes/
    filters/
    utils/
```

推荐继续沿用这个模式扩展新模块，不要在后续引入完全不同的目录风格。

---

## 4. 代码书写规范

### 4.1 DTO 规范

- DTO 只放在 `dto/` 下
- DTO 只做 HTTP 入参校验
- 列表查询优先单独建 query DTO
- 单一路径参数优先用 `ParseObjectIdPipe`，不为单个 `id` 额外建 DTO

### 4.2 Type 规范

- service 内部结构、payload、返回对象放在 `*.ts` 类型文件里
- 不要把内部类型和 DTO 混在一起

### 4.3 Service 规范

- 一个 service 方法只负责一个清晰业务动作
- 所有“当前用户只能访问自己的数据”校验都放在 service 层落地
- 返回结构尽量稳定，不要一会儿返回文档实例，一会儿返回普通对象

### 4.4 Schema 规范

- 所有 schema 开启 `timestamps: true`
- 所有 schema 关闭 `versionKey`
- 关联字段统一用 `ObjectId`
- 索引显式声明，不要只靠口头约定
- 全部导出 `HydratedDocument`
- `SchemaFactory.createForClass(...)` 后再统一补索引

### 4.5 Controller 规范

- controller 只做路由层组织
- Swagger 注释写在 controller 上
- 业务解释写在文档，不堆在 controller 里

### 4.6 异常处理规范

- 参数错误：`BadRequestException`
- 未登录或 token 无效：`UnauthorizedException`
- 资源不存在：`NotFoundException`
- 资源冲突：`ConflictException`

不要返回“成功但 data 里放错误信息”这种不稳定结构。

---

## 5. 数据与接口设计规范

### 5.1 分页结构

当前项目列表业务数据统一采用：

```json
{
  "dataList": [],
  "total": 0
}
```

### 5.2 汇总字段规范

知识库级汇总字段当前统一包括：

- `documentCount`
- `chunkCount`
- `sessionCount`
- `lastIndexedAt`

后续新增模块时，必须明确谁负责维护这些字段。

### 5.3 权限隔离规范

所有业务查询都优先基于 `userId` 限定范围。

例如：

- 用户只能看自己的知识库
- 用户只能看自己知识库下的文档
- 用户只能看自己知识库下的会话和消息

### 5.4 命名规范

- 集合名使用复数、下划线风格，如 `knowledge_bases`
- 模块目录沿用当前仓库风格，如 `knowledge_bases`
- TypeScript 类型和类使用大驼峰
- DTO 类名使用 `XxxDto`

---

## 6. 新模块落地时的依赖方向

为了避免代码越写越乱，后续模块依赖关系建议固定如下：

- `documents` 可以依赖 `knowledge_bases`
- `chat` 可以依赖 `knowledge_bases`
- `rag` 可以依赖 `documents` 和 `chat`
- `storage` 不依赖业务模块

不建议：

- `users` 反向依赖业务模块
- `documents` 和 `chat` 互相交叉依赖

---

## 7. Mongoose 最小实践

### 7.1 什么时候用 `@Prop`

- 只要字段最终要落 MongoDB，就用 `@Prop`
- 字段类型、默认值、是否必填、枚举约束，都尽量写清楚

### 7.2 什么时候加索引

- 列表页排序字段要考虑索引
- 关联查询字段要考虑索引
- 唯一约束要显式建唯一索引
- 不要一开始就到处加索引，只给真实查询路径建索引

### 7.3 什么时候在 schema 上加 hook / method

- 像 `users.password` 这种明显属于模型自己的保存逻辑，适合放 schema hook
- 跨多张集合的业务流程，不要放 schema hook，放 service

### 7.4 `MongooseModule.forFeature(...)` 怎么用

固定原则：

- 谁拥有集合，谁在自己的 module 中注册
- 同一张集合不要在多个业务模块里重复注册
- 一个模块需要多张集合时，可以在同一个 `forFeature` 中一起声明

例如：

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

### 7.5 为什么推荐先做最小字段集

原因很实际：

- 字段越多，DTO、service、测试和文档都一起变复杂
- 第一阶段真正需要的是能支撑页面和主链路，不是把所有未来信息一次存满
- 先把最小功能跑通，再加扩展字段，风险更低

---

## 8. 新加入开发者 30 分钟上手清单

1. 看 [00-项目产品与业务总览](./00-项目产品与业务总览.md)，搞清项目解决什么问题。
2. 看 [03-当前已实现接口与代码结构](./03-当前已实现接口与代码结构.md)，搞清当前哪些东西已经能跑。
3. 看 [02-架构与数据模型](./02-架构与数据模型.md)，搞清每张表为什么存在。
4. 看 [06-最小可用表结构与Schema示例](./06-最小可用表结构与Schema示例.md)，搞清 schema 和 module 该怎么写。
5. 看当前 `users` 与 `knowledge_bases` 代码，建立“controller -> service -> schema”心智模型。
6. 再看 [04-完整项目实施步骤](./04-完整项目实施步骤.md)，确认后续要按什么顺序继续实现。

---

## 9. 针对初学者的 Nest 学习顺序

如果你此前只写过前端，建议这样学这个项目：

### 第 1 步：先看请求和响应

先理解：

- 一个页面发什么请求
- 后端返回什么结构

对应文档：

- [00-项目产品与业务总览](./00-项目产品与业务总览.md)
- [03-当前已实现接口与代码结构](./03-当前已实现接口与代码结构.md)

### 第 2 步：再看 DTO 和 Controller

先理解：

- 为什么要校验请求参数
- controller 为什么只是入口，不写业务

### 第 3 步：再看 Service

先理解：

- 真正业务逻辑为什么放在 service
- 为什么 service 要校验资源归属和状态

### 第 4 步：再看 Schema 和集合设计

先理解：

- 为什么一个页面背后往往不止一张集合
- 为什么后端要考虑索引、归属链、冗余字段

对应文档：

- [02-架构与数据模型](./02-架构与数据模型.md)
- [06-最小可用表结构与Schema示例](./06-最小可用表结构与Schema示例.md)

### 第 5 步：最后看 RAG 与 SSE

这是建立在前面都理解之后的高级能力。

如果前面基础没打稳，直接看 RAG 和 SSE 很容易只会抄代码，不理解为什么这么写。

---

## 10. 反模式清单

后续开发中尽量避免这些写法：

- 在 controller 里直接写数据库查询
- 把 DTO 当成数据库模型使用
- service 返回结构前后不一致
- 一个接口同时承担多个无关业务动作
- 没有 `userId` 限制就查询业务数据
- 页面逻辑直接驱动数据库字段设计，没有抽象业务对象

---

## 11. 关联阅读

- 产品与业务先看：[00-项目产品与业务总览](./00-项目产品与业务总览.md)
- 当前接口看：[03-当前已实现接口与代码结构](./03-当前已实现接口与代码结构.md)
- 数据模型看：[02-架构与数据模型](./02-架构与数据模型.md)
- Schema 示例看：[06-最小可用表结构与Schema示例](./06-最小可用表结构与Schema示例.md)
- 实施主线看：[04-完整项目实施步骤](./04-完整项目实施步骤.md)
