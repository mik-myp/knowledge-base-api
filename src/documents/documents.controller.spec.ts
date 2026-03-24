import { Test, TestingModule } from '@nestjs/testing';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

describe('DocumentsController', () => {
  let controller: DocumentsController;

  const documentsService = {
    upload: jest.fn(),
    createEditorDocument: jest.fn(),
    findAll: jest.fn(),
    download: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    removeByDocumentIds: jest.fn(),
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

  it('forwards batch document removal to the service', async () => {
    documentsService.removeByDocumentIds.mockResolvedValue({
      deletedCount: 2,
      deletedIds: ['doc-1', 'doc-2'],
    });

    const result = await controller.removeAll(
      {
        user: {
          userId: 'user-id',
        },
      } as never,
      {
        documentIds: ['doc-1', 'doc-2'],
      },
    );

    expect(documentsService.removeByDocumentIds).toHaveBeenCalledWith(
      'user-id',
      ['doc-1', 'doc-2'],
    );
    expect(result).toEqual({
      deletedCount: 2,
      deletedIds: ['doc-1', 'doc-2'],
    });
  });

  it('writes downloaded document content to the response', async () => {
    const response = {
      setHeader: jest.fn(),
      send: jest.fn(),
    };

    documentsService.download.mockResolvedValue({
      fileName: '设计说明.md',
      mimeType: 'text/markdown',
      content: Buffer.from('# hello'),
    });

    await controller.download(
      {
        user: {
          userId: 'user-id',
        },
      } as never,
      'document-id',
      response as never,
    );

    expect(documentsService.download).toHaveBeenCalledWith(
      'user-id',
      'document-id',
    );
    expect(response.setHeader).toHaveBeenNthCalledWith(
      1,
      'Content-Type',
      'text/markdown',
    );
    expect(response.setHeader).toHaveBeenNthCalledWith(
      2,
      'Content-Disposition',
      expect.stringContaining("filename*=UTF-8''"),
    );
    expect(response.send).toHaveBeenCalledWith(Buffer.from('# hello'));
  });
});
