import { Test, TestingModule } from '@nestjs/testing';
import { KnowledgeBasesController } from './knowledge_bases.controller';
import { KnowledgeBasesService } from './knowledge_bases.service';

describe('KnowledgeBasesController', () => {
  let controller: KnowledgeBasesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [KnowledgeBasesController],
      providers: [KnowledgeBasesService],
    }).compile();

    controller = module.get<KnowledgeBasesController>(KnowledgeBasesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
