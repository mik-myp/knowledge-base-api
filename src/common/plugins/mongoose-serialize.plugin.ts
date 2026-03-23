import { Schema } from 'mongoose';

type SerializedDocument = Record<string, unknown> & {
  _id?: unknown;
  id?: string;
};

type TransformMode = 'toJSON' | 'toObject';

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return Object.prototype.toString.call(value) === '[object Object]';
};

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

const serializeId = (value: unknown): string | undefined => {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }

  if (isObjectIdLike(value)) {
    return value.toHexString();
  }

  return undefined;
};

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
