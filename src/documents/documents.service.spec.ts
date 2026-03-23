import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { DocumentsService } from './documents.service';
import { Document, DocumentSourceType } from './schemas/document.schema';
import { KnowledgeBase } from 'src/knowledge_bases/schemas/knowledge_base.schema';
import { StorageService } from 'src/storage/storage.service';

describe('DocumentsService', () => {
  let service: DocumentsService;
  let knowledgeBaseModel: {
    collection: { name: string };
    findOne: jest.Mock;
  };
  let documentModel: jest.Mock & {
    aggregate: jest.Mock;
    findOne: jest.Mock;
    findOneAndDelete: jest.Mock;
  };

  const userId = '507f1f77bcf86cd799439011';
  const documentId = '507f1f77bcf86cd799439012';
  const knowledgeBaseId = '507f1f77bcf86cd799439013';

  const storageService = {
    isConfigured: jest.fn().mockReturnValue(true),
    uploadFile: jest.fn(),
    deleteFile: jest.fn(),
  };

  beforeEach(async () => {
    knowledgeBaseModel = {
      collection: {
        name: 'knowledge_bases',
      },
      findOne: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ _id: 'kb-id' }),
      }),
    };

    documentModel = Object.assign(jest.fn(), {
      aggregate: jest.fn(),
      findOne: jest.fn(),
      findOneAndDelete: jest.fn(),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        {
          provide: getModelToken(KnowledgeBase.name),
          useValue: knowledgeBaseModel,
        },
        {
          provide: getModelToken(Document.name),
          useValue: documentModel,
        },
        {
          provide: StorageService,
          useValue: storageService,
        },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    storageService.isConfigured.mockReturnValue(true);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('uploads multiple files and normalizes mojibake filenames before persisting', async () => {
    const firstOriginalName = '03-当前已实现接口与代码结构.md';
    const mojibakeOriginalName = Buffer.from(
      firstOriginalName,
      'utf8',
    ).toString('latin1');
    const secondOriginalName = 'guide.pdf';

    const createdDocuments = [
      {
        save: jest.fn().mockResolvedValue(undefined),
        toObject: jest.fn().mockReturnValue({
          originalName: firstOriginalName,
        }),
      },
      {
        save: jest.fn().mockResolvedValue(undefined),
        toObject: jest.fn().mockReturnValue({
          originalName: secondOriginalName,
        }),
      },
    ];

    storageService.uploadFile
      .mockResolvedValueOnce(`folder/${firstOriginalName}`)
      .mockResolvedValueOnce(`folder/${secondOriginalName}`);

    documentModel
      .mockImplementationOnce((payload: Record<string, unknown>) => {
        expect(payload.originalName).toBe(firstOriginalName);
        expect(payload.extension).toBe('md');
        expect(payload.sourceType).toBe(DocumentSourceType.Upload);
        expect(payload.storageKey).toBe(`folder/${firstOriginalName}`);
        expect(payload.content).toBe('content-1');
        expect(payload.userId).toBeInstanceOf(Types.ObjectId);
        expect(payload.knowledgeBaseId).toBeInstanceOf(Types.ObjectId);
        expect((payload.userId as Types.ObjectId).toHexString()).toBe(userId);
        expect((payload.knowledgeBaseId as Types.ObjectId).toHexString()).toBe(
          knowledgeBaseId,
        );

        return createdDocuments[0];
      })
      .mockImplementationOnce((payload: Record<string, unknown>) => {
        expect(payload.originalName).toBe(secondOriginalName);
        expect(payload.extension).toBe('pdf');
        expect(payload.sourceType).toBe(DocumentSourceType.Upload);
        expect(payload.storageKey).toBe(`folder/${secondOriginalName}`);
        expect(payload.content).toBeUndefined();
        expect(payload.userId).toBeInstanceOf(Types.ObjectId);
        expect(payload.knowledgeBaseId).toBeInstanceOf(Types.ObjectId);

        return createdDocuments[1];
      });

    const result = await service.upload(
      userId,
      [
        {
          originalname: mojibakeOriginalName,
          mimetype: 'text/markdown',
          size: 5036,
          buffer: Buffer.from('content-1'),
        } as Express.Multer.File,
        {
          originalname: secondOriginalName,
          mimetype: 'application/pdf',
          size: 1024,
          buffer: Buffer.from('content-2'),
        } as Express.Multer.File,
      ],
      {
        knowledgeBaseId,
      },
    );

    expect(storageService.uploadFile).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        originalname: firstOriginalName,
      }),
      `${userId}-${knowledgeBaseId}`,
    );
    expect(storageService.uploadFile).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        originalname: secondOriginalName,
      }),
      `${userId}-${knowledgeBaseId}`,
    );
    expect(createdDocuments[0].save).toHaveBeenCalled();
    expect(createdDocuments[1].save).toHaveBeenCalled();
    expect(result).toEqual([
      {
        originalName: firstOriginalName,
      },
      {
        originalName: secondOriginalName,
      },
    ]);
  });

  it('creates editor documents without object storage', async () => {
    const createdDocument = {
      save: jest.fn().mockResolvedValue(undefined),
      toObject: jest.fn().mockReturnValue({
        originalName: '设计说明',
        sourceType: DocumentSourceType.Editor,
      }),
    };

    documentModel.mockImplementationOnce((payload: Record<string, unknown>) => {
      expect(payload.sourceType).toBe(DocumentSourceType.Editor);
      expect(payload.content).toBe('# hello');
      expect(payload.extension).toBe('md');
      expect(payload.mimeType).toBe('text/markdown');
      expect(payload.userId).toBeInstanceOf(Types.ObjectId);
      expect(payload.knowledgeBaseId).toBeInstanceOf(Types.ObjectId);
      expect((payload.userId as Types.ObjectId).toHexString()).toBe(userId);
      expect((payload.knowledgeBaseId as Types.ObjectId).toHexString()).toBe(
        knowledgeBaseId,
      );
      return createdDocument;
    });

    const result = await service.createEditorDocument(userId, {
      knowledgeBaseId,
      name: '设计说明',
      content: '# hello',
    });

    expect(storageService.uploadFile).not.toHaveBeenCalled();
    expect(createdDocument.save).toHaveBeenCalled();
    expect(result).toEqual({
      originalName: '设计说明',
      sourceType: DocumentSourceType.Editor,
    });
  });

  it('persists uploaded markdown without object storage when storage is not configured', async () => {
    storageService.isConfigured.mockReturnValue(false);

    const createdDocument = {
      save: jest.fn().mockResolvedValue(undefined),
      toObject: jest.fn().mockReturnValue({
        originalName: 'notes.md',
        content: '# title',
      }),
    };

    documentModel.mockImplementationOnce((payload: Record<string, unknown>) => {
      expect(payload.storageKey).toBeUndefined();
      expect(payload.content).toBe('# title');
      return createdDocument;
    });

    const result = await service.upload(
      userId,
      [
        {
          originalname: 'notes.md',
          mimetype: 'text/markdown',
          size: 7,
          buffer: Buffer.from('# title'),
        } as Express.Multer.File,
      ],
      {
        knowledgeBaseId,
      },
    );

    expect(storageService.uploadFile).not.toHaveBeenCalled();
    expect(createdDocument.save).toHaveBeenCalled();
    expect(result).toEqual([
      {
        originalName: 'notes.md',
        content: '# title',
      },
    ]);
  });

  it('rejects empty file arrays', async () => {
    await expect(
      service.upload(userId, [], {
        knowledgeBaseId,
      }),
    ).rejects.toThrow('至少上传一个文件');

    expect(storageService.uploadFile).not.toHaveBeenCalled();
    expect(documentModel).not.toHaveBeenCalled();
  });

  it('rejects unsupported upload extensions', async () => {
    await expect(
      service.upload(
        userId,
        [
          {
            originalname: 'archive.zip',
            mimetype: 'application/zip',
            size: 20,
            buffer: Buffer.from('zip'),
          } as Express.Multer.File,
        ],
        {
          knowledgeBaseId,
        },
      ),
    ).rejects.toThrow('当前仅支持上传 md、txt、pdf、doc、docx 文件');

    expect(storageService.uploadFile).not.toHaveBeenCalled();
    expect(documentModel).not.toHaveBeenCalled();
  });

  it('rejects pdf uploads when storage is not configured', async () => {
    storageService.isConfigured.mockReturnValue(false);

    await expect(
      service.upload(
        userId,
        [
          {
            originalname: 'guide.pdf',
            mimetype: 'application/pdf',
            size: 20,
            buffer: Buffer.from('pdf'),
          } as Express.Multer.File,
        ],
        {
          knowledgeBaseId,
        },
      ),
    ).rejects.toThrow('当前未配置对象存储，仅支持上传 md、txt 文件');

    expect(storageService.uploadFile).not.toHaveBeenCalled();
    expect(documentModel).not.toHaveBeenCalled();
  });

  it('returns paginated documents under the current user with filters applied', async () => {
    const createdAt = new Date('2026-03-21T10:00:00.000Z');
    const updatedAt = new Date('2026-03-21T11:00:00.000Z');

    documentModel.aggregate
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([
          {
            id: documentId,
            userId,
            knowledgeBaseId,
            originalName: 'demo.pdf',
            storageKey: 'user/kb/demo.pdf',
            extension: 'pdf',
            mimeType: 'application/pdf',
            size: 1024,
            knowledgeBaseName: '示例知识库',
            createdAt,
            updatedAt,
          },
        ]),
      })
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([{ total: 1 }]),
      });

    const result = await service.findAll(userId, {
      page: 2,
      pageSize: 5,
      knowledgeBaseId,
      keyword: 'demo',
    });

    expect(documentModel.aggregate).toHaveBeenCalledTimes(2);

    const listPipeline = documentModel.aggregate.mock.calls[0][0] as Array<{
      $match?: Record<string, unknown>;
      $lookup?: Record<string, unknown>;
      $unwind?: string;
      $addFields?: Record<string, string>;
      $sort?: Record<string, number>;
      $skip?: number;
      $limit?: number;
      $project?: Record<string, number>;
    }>;

    expect(listPipeline[0].$match).toEqual({
      userId: expect.any(Types.ObjectId),
      knowledgeBaseId: expect.any(Types.ObjectId),
      originalName: {
        $regex: 'demo',
        $options: 'i',
      },
    });
    expect(
      (listPipeline[0].$match?.userId as Types.ObjectId).toHexString(),
    ).toBe(userId);
    expect(
      (listPipeline[0].$match?.knowledgeBaseId as Types.ObjectId).toHexString(),
    ).toBe(knowledgeBaseId);
    expect(listPipeline[1].$lookup).toEqual({
      from: 'knowledge_bases',
      localField: 'knowledgeBaseId',
      foreignField: '_id',
      as: 'knowledgeBase',
    });
    expect(listPipeline[2].$unwind).toBe('$knowledgeBase');
    expect(listPipeline[3].$addFields).toEqual({
      knowledgeBaseName: '$knowledgeBase.name',
    });
    expect(listPipeline[4].$sort).toEqual({ createdAt: -1 });
    expect(listPipeline[5].$skip).toBe(5);
    expect(listPipeline[6].$limit).toBe(5);
    expect(listPipeline[7].$project).toEqual({ knowledgeBase: 0, content: 0 });

    const totalPipeline = documentModel.aggregate.mock.calls[1][0] as Array<{
      $count?: string;
    }>;

    expect(totalPipeline.at(-1)?.$count).toBe('total');
    expect(result).toEqual({
      dataList: [
        {
          id: documentId,
          userId,
          knowledgeBaseId,
          originalName: 'demo.pdf',
          storageKey: 'user/kb/demo.pdf',
          extension: 'pdf',
          mimeType: 'application/pdf',
          size: 1024,
          knowledgeBaseName: '示例知识库',
          createdAt,
          updatedAt,
        },
      ],
      total: 1,
    });
  });
});
