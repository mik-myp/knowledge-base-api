import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { DocumentsService } from './documents.service';
import { Document, DocumentSourceType } from './schemas/document.schema';
import { KnowledgeBase } from 'src/knowledge_bases/schemas/knowledge_base.schema';
import { StorageService } from 'src/storage/storage.service';
import { DocumentChunk } from './schemas/document_chunks.schema';
import { DocumentIndexingService } from './document-indexing.service';

describe('DocumentsService', () => {
  let service: DocumentsService;
  let knowledgeBaseModel: {
    collection: { name: string };
    findOne: jest.Mock;
  };
  let documentModel: jest.Mock & {
    aggregate: jest.Mock;
    deleteMany: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    findOneAndUpdate: jest.Mock;
    findOneAndDelete: jest.Mock;
  };
  let documentChunkModel: {
    deleteMany: jest.Mock;
    insertMany: jest.Mock;
  };

  const userId = '507f1f77bcf86cd799439011';
  const documentId = '507f1f77bcf86cd799439012';
  const knowledgeBaseId = '507f1f77bcf86cd799439013';

  const storageService = {
    isConfigured: jest.fn().mockReturnValue(true),
    uploadFile: jest.fn(),
    deleteFile: jest.fn(),
    downloadFile: jest.fn(),
  };
  const documentIndexingService = {
    prepareChunks: jest.fn().mockResolvedValue([]),
    replaceDocumentVectors: jest.fn().mockResolvedValue(undefined),
    deleteDocumentVectors: jest.fn().mockResolvedValue(undefined),
  };
  const flushBackgroundTasks = async () => {
    await new Promise<void>((resolve) => setImmediate(resolve));
    await new Promise<void>((resolve) => setImmediate(resolve));
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
      deleteMany: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(undefined),
      }),
      find: jest.fn(),
      findOne: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ _id: new Types.ObjectId() }),
      }),
      findOneAndUpdate: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(undefined),
      }),
      findOneAndDelete: jest.fn(),
    });
    documentChunkModel = {
      deleteMany: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(undefined),
      }),
      insertMany: jest.fn().mockResolvedValue(undefined),
    };

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
          provide: getModelToken(DocumentChunk.name),
          useValue: documentChunkModel,
        },
        {
          provide: StorageService,
          useValue: storageService,
        },
        {
          provide: DocumentIndexingService,
          useValue: documentIndexingService,
        },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    storageService.isConfigured.mockReturnValue(true);
    documentIndexingService.prepareChunks.mockResolvedValue([]);
    documentIndexingService.replaceDocumentVectors.mockResolvedValue(undefined);
    documentIndexingService.deleteDocumentVectors.mockResolvedValue(undefined);
    storageService.downloadFile.mockResolvedValue({
      body: Buffer.from('file-content'),
      contentType: 'application/pdf',
    });
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
    const firstCreatedDocumentId = new Types.ObjectId().toHexString();
    const secondCreatedDocumentId = new Types.ObjectId().toHexString();

    const createdDocuments = [
      {
        id: firstCreatedDocumentId,
        save: jest.fn().mockResolvedValue(undefined),
        toObject: jest.fn().mockReturnValue({
          originalName: firstOriginalName,
        }),
      },
      {
        id: secondCreatedDocumentId,
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
    const createdDocumentId = new Types.ObjectId(documentId);
    const createdUserId = new Types.ObjectId(userId);
    const createdKnowledgeBaseId = new Types.ObjectId(knowledgeBaseId);
    const createdDocument = {
      id: createdDocumentId.toHexString(),
      save: jest.fn().mockResolvedValue(undefined),
      toObject: jest.fn().mockReturnValue({
        _id: createdDocumentId,
        userId: createdUserId,
        knowledgeBaseId: createdKnowledgeBaseId,
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
      id: createdDocumentId.toHexString(),
      userId: createdUserId.toHexString(),
      knowledgeBaseId: createdKnowledgeBaseId.toHexString(),
      originalName: '设计说明',
      sourceType: DocumentSourceType.Editor,
    });
  });

  it('persists uploaded markdown without object storage when storage is not configured', async () => {
    storageService.isConfigured.mockReturnValue(false);
    const createdDocumentId = new Types.ObjectId().toHexString();

    const createdDocument = {
      id: createdDocumentId,
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
    ).rejects.toThrow('当前仅支持上传 md、pdf、txt、docx 文件');

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

  it('marks the current uploaded file as failed when indexing fails', async () => {
    const createdDocumentId = new Types.ObjectId().toHexString();
    const createdDocument = {
      id: createdDocumentId,
      save: jest.fn().mockResolvedValue(undefined),
      toObject: jest.fn().mockReturnValue({
        originalName: 'guide.pdf',
      }),
    };

    storageService.uploadFile.mockResolvedValue('folder/guide.pdf');
    documentIndexingService.prepareChunks.mockRejectedValueOnce(
      new Error('index failed'),
    );
    documentModel.mockImplementationOnce(() => createdDocument);

    const result = await service.upload(
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
    );

    await flushBackgroundTasks();

    expect(result).toEqual([
      {
        originalName: 'guide.pdf',
      },
    ]);
    expect(documentModel.findOneAndUpdate).toHaveBeenCalled();
    expect(documentChunkModel.deleteMany).toHaveBeenCalledWith({
      userId: expect.any(Types.ObjectId),
      documentId: expect.any(Types.ObjectId),
    });
    expect(documentIndexingService.deleteDocumentVectors).toHaveBeenCalledWith(
      userId,
      createdDocumentId,
    );
    expect(storageService.deleteFile).not.toHaveBeenCalledWith(
      'folder/guide.pdf',
    );
  });

  it('keeps previous files and only marks the failed file when a later file indexing fails', async () => {
    const firstDocumentId = new Types.ObjectId().toHexString();
    const secondDocumentId = new Types.ObjectId().toHexString();
    const firstDocument = {
      id: firstDocumentId,
      save: jest.fn().mockResolvedValue(undefined),
      toObject: jest.fn().mockReturnValue({
        originalName: 'first.md',
      }),
    };
    const secondDocument = {
      id: secondDocumentId,
      save: jest.fn().mockResolvedValue(undefined),
      toObject: jest.fn().mockReturnValue({
        originalName: 'second.md',
      }),
    };

    storageService.uploadFile
      .mockResolvedValueOnce('folder/first.md')
      .mockResolvedValueOnce('folder/second.md');
    documentIndexingService.prepareChunks
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('second file failed'));
    documentModel
      .mockImplementationOnce(() => firstDocument)
      .mockImplementationOnce(() => secondDocument);

    const result = await service.upload(
      userId,
      [
        {
          originalname: 'first.md',
          mimetype: 'text/markdown',
          size: 10,
          buffer: Buffer.from('# first'),
        } as Express.Multer.File,
        {
          originalname: 'second.md',
          mimetype: 'text/markdown',
          size: 11,
          buffer: Buffer.from('# second'),
        } as Express.Multer.File,
      ],
      {
        knowledgeBaseId,
      },
    );

    await flushBackgroundTasks();

    expect(result).toEqual([
      {
        originalName: 'first.md',
      },
      {
        originalName: 'second.md',
      },
    ]);
    expect(storageService.deleteFile).not.toHaveBeenCalled();
    expect(documentIndexingService.deleteDocumentVectors).toHaveBeenCalledWith(
      userId,
      secondDocumentId,
    );
    expect(
      documentIndexingService.deleteDocumentVectors,
    ).not.toHaveBeenCalledWith(userId, firstDocumentId);
  });

  it('marks editor documents as failed when indexing fails', async () => {
    const createdDocumentId = new Types.ObjectId().toHexString();
    const createdDocument = {
      id: createdDocumentId,
      save: jest.fn().mockResolvedValue(undefined),
      toObject: jest.fn().mockReturnValue({
        originalName: '说明文档',
      }),
      originalName: '说明文档',
      extension: 'md',
    };

    documentIndexingService.prepareChunks.mockRejectedValueOnce(
      new Error('editor index failed'),
    );
    documentModel.mockImplementationOnce(() => createdDocument);

    const result = await service.createEditorDocument(userId, {
      knowledgeBaseId,
      name: '说明文档',
      content: '# hello',
    });

    await flushBackgroundTasks();

    expect(result).toEqual({
      originalName: '说明文档',
    });
    expect(documentModel.deleteMany).not.toHaveBeenCalledWith({
      _id: expect.any(Types.ObjectId),
      userId: expect.any(Types.ObjectId),
    });
    expect(storageService.deleteFile).not.toHaveBeenCalled();
    expect(documentIndexingService.deleteDocumentVectors).toHaveBeenCalledWith(
      userId,
      createdDocumentId,
    );
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

  it('serializes objectId fields to strings when finding a document', async () => {
    const foundDocumentId = new Types.ObjectId(documentId);
    const foundUserId = new Types.ObjectId(userId);
    const foundKnowledgeBaseId = new Types.ObjectId(knowledgeBaseId);
    documentModel.findOne.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue({
        _id: foundDocumentId,
        userId: foundUserId,
        knowledgeBaseId: foundKnowledgeBaseId,
        originalName: 'demo.md',
      }),
    });

    const result = await service.findOne(userId, documentId);

    expect(result).toEqual({
      id: foundDocumentId.toHexString(),
      userId: foundUserId.toHexString(),
      knowledgeBaseId: foundKnowledgeBaseId.toHexString(),
      originalName: 'demo.md',
    });
  });

  it('downloads stored files from object storage', async () => {
    documentModel.findOne.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue({
        _id: new Types.ObjectId(documentId),
        userId: new Types.ObjectId(userId),
        knowledgeBaseId: new Types.ObjectId(knowledgeBaseId),
        originalName: 'demo.pdf',
        extension: 'pdf',
        mimeType: 'application/pdf',
        storageKey: 'storage/demo.pdf',
      }),
    });
    storageService.downloadFile.mockResolvedValue({
      body: Buffer.from('pdf-content'),
      contentType: 'application/pdf',
    });

    const result = await service.download(userId, documentId);

    expect(storageService.downloadFile).toHaveBeenCalledWith(
      'storage/demo.pdf',
    );
    expect(result).toEqual({
      fileName: 'demo.pdf',
      mimeType: 'application/pdf',
      content: Buffer.from('pdf-content'),
    });
  });

  it('downloads inline content for editor documents and appends missing extension', async () => {
    documentModel.findOne.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue({
        _id: new Types.ObjectId(documentId),
        userId: new Types.ObjectId(userId),
        knowledgeBaseId: new Types.ObjectId(knowledgeBaseId),
        originalName: '设计说明',
        extension: 'md',
        mimeType: 'text/markdown',
        content: '# hello',
      }),
    });

    const result = await service.download(userId, documentId);

    expect(storageService.downloadFile).not.toHaveBeenCalled();
    expect(result).toEqual({
      fileName: '设计说明.md',
      mimeType: 'text/markdown',
      content: Buffer.from('# hello'),
    });
  });

  it('removes matched documents by ids and clears storage and indexes', async () => {
    const firstId = new Types.ObjectId().toHexString();
    const secondId = new Types.ObjectId().toHexString();

    documentModel.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([
        {
          id: firstId,
          storageKey: 'storage/first.pdf',
        },
        {
          id: secondId,
          storageKey: undefined,
        },
      ]),
    });
    const result = await service.removeByDocumentIds(userId, [
      firstId,
      secondId,
      firstId,
    ]);

    expect(documentModel.find).toHaveBeenCalledWith({
      _id: {
        $in: [expect.any(Types.ObjectId), expect.any(Types.ObjectId)],
      },
      userId: expect.any(Types.ObjectId),
    });
    expect(documentModel.deleteMany).toHaveBeenCalledTimes(2);
    expect(storageService.deleteFile).toHaveBeenCalledWith('storage/first.pdf');
    expect(documentChunkModel.deleteMany).toHaveBeenCalledTimes(2);
    expect(documentIndexingService.deleteDocumentVectors).toHaveBeenCalledTimes(
      2,
    );
    expect(result).toEqual({
      deletedCount: 2,
      deletedIds: [firstId, secondId],
    });
  });
});
