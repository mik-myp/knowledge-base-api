import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { DocumnetsService } from './documnets.service';
import { Document, DocumentStatus } from './schemas/documnet.schema';
import { KnowledgeBase } from 'src/knowledge_bases/schemas/knowledge_base.schema';
import { StorageService } from 'src/storage/storage.service';

describe('DocumnetsService', () => {
  let service: DocumnetsService;
  let knowledgeBaseModel: { collection: { name: string } };
  let documentModel: jest.Mock & {
    aggregate: jest.Mock;
  };

  const storageService = {
    uploadFile: jest.fn(),
  };

  beforeEach(async () => {
    knowledgeBaseModel = {
      collection: {
        name: 'knowledge_bases',
      },
    };

    documentModel = Object.assign(jest.fn(), {
      aggregate: jest.fn(),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumnetsService,
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

    service = module.get<DocumnetsService>(DocumnetsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('uploads multiple files and normalizes mojibake filenames before persisting', async () => {
    const userId = '507f1f77bcf86cd799439011';
    const knowledgeBaseId = '507f1f77bcf86cd799439013';
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
        expect(payload.fileType).toBe('markdown');

        return createdDocuments[0];
      })
      .mockImplementationOnce((payload: Record<string, unknown>) => {
        expect(payload.originalName).toBe(secondOriginalName);
        expect(payload.extension).toBe('pdf');
        expect(payload.fileType).toBe('pdf');

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
      `${userId} - ${knowledgeBaseId}`,
    );
    expect(storageService.uploadFile).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        originalname: secondOriginalName,
      }),
      `${userId} - ${knowledgeBaseId}`,
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

  it('rejects empty file arrays', async () => {
    await expect(
      service.upload('507f1f77bcf86cd799439011', [], {
        knowledgeBaseId: '507f1f77bcf86cd799439013',
      }),
    ).rejects.toThrow('至少上传一个文件');

    expect(storageService.uploadFile).not.toHaveBeenCalled();
    expect(documentModel).not.toHaveBeenCalled();
  });

  it('returns paginated documents under the current user knowledge bases', async () => {
    const userId = '507f1f77bcf86cd799439011';
    const documentId = '507f1f77bcf86cd799439012';
    const knowledgeBaseId = '507f1f77bcf86cd799439013';
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
            s3Key: 'user/kb/demo.pdf',
            extension: 'pdf',
            fileType: 'pdf',
            mimeType: 'application/pdf',
            size: 1024,
            status: DocumentStatus.Ready,
            createdAt,
            updatedAt,
          },
        ]),
      })
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([{ total: 1 }]),
      });

    const result = await service.findAllDocuments(userId, {
      page: 2,
      pageSize: 5,
    });

    expect(documentModel.aggregate).toHaveBeenCalledTimes(2);

    const listPipeline = documentModel.aggregate.mock.calls[0][0] as Array<{
      $match?: Record<string, unknown>;
      $lookup?: Record<string, unknown>;
      $unwind?: string;
      $sort?: Record<string, number>;
      $skip?: number;
      $limit?: number;
      $project?: Record<string, number>;
    }>;

    expect(listPipeline[0].$match).toEqual({
      $expr: {
        $eq: [{ $toString: '$userId' }, userId],
      },
    });
    expect(listPipeline[1].$lookup).toEqual({
      from: 'knowledge_bases',
      let: {
        documentKnowledgeBaseId: '$knowledgeBaseId',
      },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                {
                  $eq: [
                    { $toString: '$_id' },
                    { $toString: '$$documentKnowledgeBaseId' },
                  ],
                },
                {
                  $eq: [{ $toString: '$userId' }, userId],
                },
              ],
            },
          },
        },
      ],
      as: 'knowledgeBase',
    });
    expect(listPipeline[2].$unwind).toBe('$knowledgeBase');
    expect(listPipeline[3].$sort).toEqual({ createdAt: -1 });
    expect(listPipeline[4].$skip).toBe(5);
    expect(listPipeline[5].$limit).toBe(5);
    expect(listPipeline[6].$project).toEqual({ knowledgeBase: 0 });

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
          s3Key: 'user/kb/demo.pdf',
          extension: 'pdf',
          fileType: 'pdf',
          mimeType: 'application/pdf',
          size: 1024,
          status: DocumentStatus.Ready,
          createdAt,
          updatedAt,
        },
      ],
      total: 1,
    });
  });

  it('supports non-objectid user ids in comparisons', async () => {
    documentModel.aggregate
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([]),
      })
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([]),
      });

    const result = await service.findAllDocuments('user-string-id', {
      page: 1,
      pageSize: 10,
    });

    expect(result).toEqual({
      dataList: [],
      total: 0,
    });
    expect(documentModel.aggregate).toHaveBeenCalledTimes(2);
  });
});
