import { Test, TestingModule } from '@nestjs/testing';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

describe('DocumentsController', () => {
  let controller: DocumentsController;

  const documentsService = {
    upload: jest.fn(),
    createEditorDocument: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentsController],
      providers: [
        {
          provide: DocumentsService,
          useValue: documentsService,
        },
      ],
    }).compile();

    controller = module.get<DocumentsController>(DocumentsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('forwards file arrays to the upload service', async () => {
    const files = [
      {
        originalname: 'a.md',
      },
      {
        originalname: 'b.pdf',
      },
    ] as Array<Express.Multer.File>;

    documentsService.upload.mockResolvedValue(['result']);

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

    expect(documentsService.upload).toHaveBeenCalledWith('user-id', files, {
      knowledgeBaseId: 'knowledge-base-id',
    });
    expect(result).toEqual(['result']);
  });

  it('forwards editor documents to the service', async () => {
    documentsService.createEditorDocument.mockResolvedValue({
      originalName: '说明文档',
    });

    const result = await controller.createEditorDocument(
      {
        user: {
          userId: 'user-id',
        },
      } as never,
      {
        knowledgeBaseId: 'knowledge-base-id',
        name: '说明文档',
        content: '# hello',
      },
    );

    expect(documentsService.createEditorDocument).toHaveBeenCalledWith(
      'user-id',
      {
        knowledgeBaseId: 'knowledge-base-id',
        name: '说明文档',
        content: '# hello',
      },
    );
    expect(result).toEqual({
      originalName: '说明文档',
    });
  });
});
