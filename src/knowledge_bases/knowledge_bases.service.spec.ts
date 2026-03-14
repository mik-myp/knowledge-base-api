import { Test, TestingModule } from '@nestjs/testing';
import { KnowledgeBasesService } from './knowledge_bases.service';

describe('KnowledgeBasesService', () => {
  let service: KnowledgeBasesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [KnowledgeBasesService],
    }).compile();

    service = module.get<KnowledgeBasesService>(KnowledgeBasesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
