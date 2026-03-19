import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { KnowledgeBasesService } from './knowledge_bases.service';
import { KnowledgeBase } from './schemas/knowledge_base.schema';

describe('KnowledgeBasesService', () => {
  let service: KnowledgeBasesService;
  let knowledgeBaseModel: jest.Mock;

  const createDocumentMock = (overrides: Record<string, unknown> = {}) => {
    const serialized = {
      id: 'kb-id',
      userId: 'user-id',
      name: '知识库',
      description: '描述',
      documentCount: 0,
      chunkCount: 0,
      sessionCount: 0,
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KnowledgeBasesService,
        {
          provide: getModelToken(KnowledgeBase.name),
          useValue: knowledgeBaseModel,
        },
      ],
    }).compile();

    service = module.get<KnowledgeBasesService>(KnowledgeBasesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('initializes aggregate counters when creating a knowledge base', async () => {
    const document = createDocumentMock();
    knowledgeBaseModel.mockImplementation(() => document);

    const result = await service.create('user-id', {
      name: '知识库',
      description: '描述',
    });

    expect(knowledgeBaseModel).toHaveBeenCalledWith({
      userId: 'user-id',
      documentCount: 0,
      chunkCount: 0,
      sessionCount: 0,
      name: '知识库',
      description: '描述',
    });
    expect(document.save).toHaveBeenCalled();
    expect(result).toEqual({
      id: 'kb-id',
      userId: 'user-id',
      name: '知识库',
      description: '描述',
      documentCount: 0,
      chunkCount: 0,
      sessionCount: 0,
    });
  });

  it('serializes a knowledge base when finding one', async () => {
    const document = createDocumentMock({ id: 'kb-find-one' });
    knowledgeBaseModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(document),
    });

    const result = await service.findOne('user-id', 'kb-find-one');

    expect(result).toEqual({
      id: 'kb-find-one',
      userId: 'user-id',
      name: '知识库',
      description: '描述',
      documentCount: 0,
      chunkCount: 0,
      sessionCount: 0,
    });
    expect(document.toObject).toHaveBeenCalled();
  });

  it('serializes a knowledge base when updating', async () => {
    const document = createDocumentMock({ name: '更新后的知识库' });
    knowledgeBaseModel.findOneAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue(document),
    });

    const result = await service.update('user-id', 'kb-id', {
      name: '更新后的知识库',
    });

    expect(result).toEqual({
      id: 'kb-id',
      userId: 'user-id',
      name: '更新后的知识库',
      description: '描述',
      documentCount: 0,
      chunkCount: 0,
      sessionCount: 0,
    });
    expect(document.toObject).toHaveBeenCalled();
  });

  it('serializes a knowledge base when deleting', async () => {
    const document = createDocumentMock({ id: 'kb-delete' });
    knowledgeBaseModel.findOneAndDelete.mockReturnValue({
      exec: jest.fn().mockResolvedValue(document),
    });

    const result = await service.remove('user-id', 'kb-delete');

    expect(result).toEqual({
      id: 'kb-delete',
      userId: 'user-id',
      name: '知识库',
      description: '描述',
      documentCount: 0,
      chunkCount: 0,
      sessionCount: 0,
    });
    expect(document.toObject).toHaveBeenCalled();
  });
});
