import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { KnowledgeBasesService } from './knowledge_bases.service';
import { KnowledgeBase } from './schemas/knowledge_base.schema';
import { KnowledgeDocument } from '../documents/schemas/document.schema';

describe('KnowledgeBasesService', () => {
  let service: KnowledgeBasesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KnowledgeBasesService,
        {
          provide: getModelToken(KnowledgeBase.name),
          useValue: {},
        },
        {
          provide: getModelToken(KnowledgeDocument.name),
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<KnowledgeBasesService>(KnowledgeBasesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
