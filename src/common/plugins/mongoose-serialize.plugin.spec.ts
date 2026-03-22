import { Schema, Types } from 'mongoose';
import {
  mongooseSerializePlugin,
  serializeMongoResult,
} from './mongoose-serialize.plugin';

describe('mongooseSerializePlugin', () => {
  it('serializes nested mongo documents', () => {
    const documentId = new Types.ObjectId('507f1f77bcf86cd799439011');
    const nestedId = new Types.ObjectId('507f1f77bcf86cd799439012');

    expect(
      serializeMongoResult({
        _id: documentId,
        name: 'document',
        __v: 0,
        nested: {
          _id: nestedId,
          label: 'nested',
        },
      }),
    ).toEqual({
      id: documentId.toHexString(),
      name: 'document',
      nested: {
        id: nestedId.toHexString(),
        label: 'nested',
      },
    });
  });

  it('preserves composite aggregate keys', () => {
    expect(
      serializeMongoResult({
        _id: {
          status: 'ready',
        },
        total: 2,
      }),
    ).toEqual({
      _id: {
        status: 'ready',
      },
      total: 2,
    });
  });

  it('transforms aggregate results through middleware', async () => {
    const schema = new Schema({
      name: String,
    });

    mongooseSerializePlugin(schema);

    const documentId = new Types.ObjectId('507f1f77bcf86cd799439013');
    const aggregateResults = [
      {
        _id: documentId,
        name: 'aggregate document',
      },
    ];

    await schema.s.hooks.execPost('aggregate', {}, [aggregateResults], {
      error: null,
    });

    expect(aggregateResults).toEqual([
      {
        id: documentId.toHexString(),
        name: 'aggregate document',
      },
    ]);
  });
});
