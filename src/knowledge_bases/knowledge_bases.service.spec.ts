import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { KnowledgeBasesService } from './knowledge_bases.service';
import { KnowledgeBase } from './schemas/knowledge_base.schema';
import { Document } from 'src/documents/schemas/document.schema';
import { StorageService } from 'src/storage/storage.service';

describe('KnowledgeBasesService', () => {
  let service: KnowledgeBasesService;
  let knowledgeBaseModel: jest.Mock;
  let documentModel: {
    find: jest.Mock;
    deleteMany: jest.Mock;
  };

  const userId = '507f1f77bcf86cd799439011';
  const knowledgeBaseId = '507f1f77bcf86cd799439012';

  const storageService = {
    isConfigured: jest.fn().mockReturnValue(true),
    deleteFile: jest.fn(),
  };

  const createDocumentMock = (overrides: Record<string, unknown> = {}) => {
    const serialized = {
      id: 'kb-id',
      userId: 'user-id',
      name: '知识库',
      description: '描述',
      ...overrides,
    };

    return {
      save: jest.fn().mockResolvedValue(undefined),
      toObject: jest.fn().mockReturnValue(serialized),
    };
  };

  beforeEach(async () => {
    knowledgeBaseModel = jest.fn();
    knowledgeBaseModel.findOne = jest.fn();
    knowledgeBaseModel.findOneAndUpdate = jest.fn();
    knowledgeBaseModel.findOneAndDelete = jest.fn();
    knowledgeBaseModel.find = jest.fn();
    knowledgeBaseModel.countDocuments = jest.fn();
    documentModel = {
      find: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      }),
      deleteMany: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(undefined),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KnowledgeBasesService,
        {
          provide: getModelToken(KnowledgeBase.name),
          useValue: knowledgeBaseModel,
        },
        {
          provide: getModelToken(Document.name),
          useValue: documentModel,
        },
        {
          provide: StorageService,
          useValue: storageService,
        },
      ],
    }).compile();

    service = module.get<KnowledgeBasesService>(KnowledgeBasesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('creates a knowledge base with minimal required fields', async () => {
    const document = createDocumentMock();
    knowledgeBaseModel.mockImplementation(() => document);

    const result = await service.create(userId, {
      name: '知识库',
      description: '描述',
    });

    expect(knowledgeBaseModel).toHaveBeenCalledWith({
      userId: expect.any(Types.ObjectId),
      name: '知识库',
      description: '描述',
    });
    expect(knowledgeBaseModel.mock.calls[0]?.[0].userId.toHexString()).toBe(
      userId,
    );
    expect(document.save).toHaveBeenCalled();
    expect(result).toEqual({
      id: 'kb-id',
      userId: 'user-id',
      name: '知识库',
      description: '描述',
    });
  });

  it('serializes a knowledge base when finding one', async () => {
    const document = createDocumentMock({ id: 'kb-find-one' });
    knowledgeBaseModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(document),
    });

    const result = await service.findOne(userId, knowledgeBaseId);

    expect(result).toEqual({
      id: 'kb-find-one',
      userId: 'user-id',
      name: '知识库',
      description: '描述',
    });
    expect(document.toObject).toHaveBeenCalled();
    expect(knowledgeBaseModel.findOne).toHaveBeenCalledWith({
      _id: expect.any(Types.ObjectId),
      userId: expect.any(Types.ObjectId),
    });
    const findOneFilters = knowledgeBaseModel.findOne.mock.calls[0]?.[0];
    expect(findOneFilters._id.toHexString()).toBe(knowledgeBaseId);
    expect(findOneFilters.userId.toHexString()).toBe(userId);
  });

  it('serializes a knowledge base when updating', async () => {
    const document = createDocumentMock({ name: '更新后的知识库' });
    knowledgeBaseModel.findOneAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue(document),
    });

    const result = await service.update(userId, knowledgeBaseId, {
      name: '更新后的知识库',
    });

    expect(result).toEqual({
      id: 'kb-id',
      userId: 'user-id',
      name: '更新后的知识库',
      description: '描述',
    });
    expect(document.toObject).toHaveBeenCalled();
    expect(knowledgeBaseModel.findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: expect.any(Types.ObjectId),
        userId: expect.any(Types.ObjectId),
      },
      {
        name: '更新后的知识库',
      },
      {
        returnDocument: 'after',
        runValidators: true,
      },
    );
    const updateFilters =
      knowledgeBaseModel.findOneAndUpdate.mock.calls[0]?.[0];
    expect(updateFilters._id.toHexString()).toBe(knowledgeBaseId);
    expect(updateFilters.userId.toHexString()).toBe(userId);
  });

  it('serializes a knowledge base when deleting', async () => {
    const document = createDocumentMock({ id: 'kb-delete' });
    knowledgeBaseModel.findOneAndDelete.mockReturnValue({
      exec: jest.fn().mockResolvedValue(document),
    });
    documentModel.find.mockReturnValue({
      exec: jest.fn().mockResolvedValue([]),
    });

    const result = await service.remove(userId, knowledgeBaseId);

    expect(result).toEqual({
      id: 'kb-delete',
      userId: 'user-id',
      name: '知识库',
      description: '描述',
    });
    expect(document.toObject).toHaveBeenCalled();
    expect(documentModel.find).toHaveBeenCalledWith({
      knowledgeBaseId: expect.any(Types.ObjectId),
      userId: expect.any(Types.ObjectId),
    });
    const deleteFindFilters = documentModel.find.mock.calls[0]?.[0];
    expect(deleteFindFilters.knowledgeBaseId.toHexString()).toBe(
      knowledgeBaseId,
    );
    expect(deleteFindFilters.userId.toHexString()).toBe(userId);
    expect(documentModel.deleteMany).toHaveBeenCalledWith({
      knowledgeBaseId: expect.any(Types.ObjectId),
      userId: expect.any(Types.ObjectId),
    });
    const deleteFilters = documentModel.deleteMany.mock.calls[0]?.[0];
    expect(deleteFilters.knowledgeBaseId.toHexString()).toBe(knowledgeBaseId);
    expect(deleteFilters.userId.toHexString()).toBe(userId);
  });
});
