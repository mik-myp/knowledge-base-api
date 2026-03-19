import { Test, TestingModule } from '@nestjs/testing';
import { KnowledgeBasesController } from './knowledge_bases.controller';
import { KnowledgeBasesService } from './knowledge_bases.service';

describe('KnowledgeBasesController', () => {
  let controller: KnowledgeBasesController;
  const knowledgeBasesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [KnowledgeBasesController],
      providers: [
        {
          provide: KnowledgeBasesService,
          useValue: knowledgeBasesService,
        },
      ],
    }).compile();

    controller = module.get<KnowledgeBasesController>(KnowledgeBasesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
