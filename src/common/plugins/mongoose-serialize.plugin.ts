import { Schema } from 'mongoose';

type SerializedDocument = Record<string, unknown> & {
  _id?: { toString(): string } | string;
  id?: string;
};

type TransformMode = 'toJSON' | 'toObject';

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

        ret = transformedRet as SerializedDocument;
      }

      if (ret._id !== undefined) {
        ret.id = typeof ret._id === 'string' ? ret._id : ret._id.toString();
        delete ret._id;
      }
      if (ret.__v !== undefined) {
        delete ret.__v;
      }
      return ret;
    },
  });
};

export const mongooseSerializePlugin = (schema: Schema) => {
  applyIdTransform(schema, 'toJSON');
  applyIdTransform(schema, 'toObject');
};
