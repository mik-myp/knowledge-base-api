import { Test, TestingModule } from '@nestjs/testing';
import { DocumnetsController } from './documnets.controller';
import { DocumnetsService } from './documnets.service';

describe('DocumnetsController', () => {
  let controller: DocumnetsController;
  const documnetsService = {
    upload: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumnetsController],
      providers: [
        {
          provide: DocumnetsService,
          useValue: documnetsService,
        },
      ],
    }).compile();

    controller = module.get<DocumnetsController>(DocumnetsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('forwards file arrays to the service', async () => {
    const files = [
      {
        originalname: 'a.md',
      },
      {
        originalname: 'b.pdf',
      },
    ] as Array<Express.Multer.File>;

    documnetsService.upload.mockResolvedValue(['result']);

    const result = await controller.upload(
      {
        user: {
          userId: 'user-id',
        },
      },
      files,
      {
        knowledgeBaseId: 'knowledge-base-id',
      },
    );

    expect(documnetsService.upload).toHaveBeenCalledWith('user-id', files, {
      knowledgeBaseId: 'knowledge-base-id',
    });
    expect(result).toEqual(['result']);
  });
});
