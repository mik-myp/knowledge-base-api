import { Test, TestingModule } from '@nestjs/testing';
import { DocumnetsService } from './documnets.service';

describe('DocumnetsService', () => {
  let service: DocumnetsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DocumnetsService],
    }).compile();

    service = module.get<DocumnetsService>(DocumnetsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
