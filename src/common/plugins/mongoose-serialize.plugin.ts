import { Schema } from 'mongoose';

/**
 * 表示序列化后可安全返回给前端的文档结构。
 */
type SerializedDocument = Record<string, unknown> & {
  _id?: unknown;
  id?: string;
};

/**
 * 表示 Mongoose 序列化转换挂载的目标模式。
 */
type TransformMode = 'toJSON' | 'toObject';

/**
 * 判断是否为PlainObject。
 * @param value 待处理的值。
 * @returns 返回布尔值，表示是否满足PlainObject。
 */
const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return Object.prototype.toString.call(value) === '[object Object]';
};

/**
 * 判断是否为ObjectIdLike。
 * @param value 待处理的值。
 * @returns 返回布尔值，表示是否满足ObjectIdLike。
 */
const isObjectIdLike = (
  value: unknown,
): value is { toHexString: () => string } => {
  return (
    value !== null &&
    value !== undefined &&
    typeof value === 'object' &&
    'toHexString' in value &&
    typeof value.toHexString === 'function'
  );
};

/**
 * 将 `_id` 或类 ObjectId 值转换为字符串 ID。
 * @param value 需要序列化的 ID 值。
 * @returns 返回字符串 ID；无法转换时返回 `undefined`。
 */
const serializeId = (value: unknown): string | undefined => {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }

  if (isObjectIdLike(value)) {
    return value.toHexString();
  }

  return undefined;
};

/**
 * 序列化 Mongo 查询结果。
 * @param value 待处理的值。
 * @returns 返回未知类型结果。
 */
export const serializeMongoResult = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => serializeMongoResult(item));
  }

  if (isObjectIdLike(value)) {
    return value.toHexString();
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const serializedDocument: SerializedDocument = {};

  for (const [key, currentValue] of Object.entries(value)) {
    if (key === '__v' || key === '_id') {
      continue;
    }

    serializedDocument[key] = serializeMongoResult(currentValue);
  }

  const serializedId = serializeId(value._id);

  if (serializedId !== undefined) {
    serializedDocument.id = serializedId;
  } else if (value._id !== undefined) {
    serializedDocument._id = serializeMongoResult(value._id);
  }

  return serializedDocument;
};

/**
 * 为指定序列化模式挂载统一的 ID 转换逻辑。
 * @param schema 需要扩展的 Mongoose Schema。
 * @param mode 目标转换模式。
 * @returns 配置完成后不返回额外内容。
 */
const applyIdTransform = (schema: Schema, mode: TransformMode) => {
  const currentOptions = schema.get(mode) ?? {};
  const originalTransform = currentOptions.transform as
    | ((doc: any, ret: any, options: any) => any)
    | undefined;

  schema.set(mode, {
    ...currentOptions,
    transform(doc: any, ret: any, options: any) {
      const transformedRet = originalTransform?.(doc, ret, options);

      if (transformedRet !== undefined) {
        if (typeof transformedRet !== 'object' || transformedRet === null) {
          return transformedRet;
        }

        return serializeMongoResult(transformedRet);
      }

      return serializeMongoResult(ret);
    },
  });
};

/**
 * 为 Mongoose Schema 注册统一序列化插件。
 * @param schema 需要注册插件的 Schema。
 * @returns 插件挂载完成后不返回额外内容。
 */
export const mongooseSerializePlugin = (schema: Schema) => {
  applyIdTransform(schema, 'toJSON');
  applyIdTransform(schema, 'toObject');
  schema.post('aggregate', function (result: unknown[]) {
    if (!Array.isArray(result)) {
      return;
    }

    for (let index = 0; index < result.length; index += 1) {
      result[index] = serializeMongoResult(result[index]);
    }
  });
};
