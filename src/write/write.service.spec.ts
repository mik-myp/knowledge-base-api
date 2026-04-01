import { Test, TestingModule } from '@nestjs/testing';
import { DocumentIndexingService } from 'src/documents/document-indexing.service';
import { LangchainService } from 'src/langchain/langchain.service';
import { WriteService } from './write.service';

describe('WriteService', () => {
  let service: WriteService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WriteService,
        {
          provide: LangchainService,
          useValue: {
            createChatModel: jest.fn(),
          },
        },
        {
          provide: DocumentIndexingService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<WriteService>(WriteService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
