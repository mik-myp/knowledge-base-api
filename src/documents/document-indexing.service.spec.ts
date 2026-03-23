import { ConfigService } from '@nestjs/config';
import { Document as LangChainDocument } from 'langchain';
import type { Connection } from 'mongoose';
import { DocumentIndexingService } from './document-indexing.service';

type InternalDocumentIndexingService = DocumentIndexingService & {
  loadSourceDocuments: (
    params: unknown,
  ) => Promise<LangChainDocument<Record<string, unknown>>[]>;
  splitDocuments: (
    documents: LangChainDocument<Record<string, unknown>>[],
  ) => Promise<LangChainDocument<Record<string, unknown>>[]>;
  createEmbeddings: () => {
    embedDocuments: (texts: string[]) => Promise<number[][]>;
  };
};

describe('DocumentIndexingService', () => {
  let service: DocumentIndexingService;
  let collectionMock: {
    deleteMany: jest.Mock;
    insertMany: jest.Mock;
  };

  beforeEach(() => {
    collectionMock = {
      deleteMany: jest.fn().mockResolvedValue(undefined),
      insertMany: jest.fn().mockResolvedValue(undefined),
    };

    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'MONGODB_VECTOR_COLLECTION') {
          return 'document_chunk_vectors';
        }

        if (key === 'MONGODB_VECTOR_INDEX') {
          return 'document_chunk_vector_index';
        }

        return undefined;
      }),
    } as unknown as ConfigService;

    const connection = {
      db: {
        collection: jest.fn().mockReturnValue(collectionMock),
      },
    } as unknown as Connection;

    service = new DocumentIndexingService(configService, connection);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('calculates startIndex and endIndex for markdown-like documents', async () => {
    const internalService = service as InternalDocumentIndexingService;

    jest.spyOn(internalService, 'loadSourceDocuments').mockResolvedValue([
      new LangChainDocument({
        pageContent: 'alpha beta gamma delta',
        metadata: {},
      }),
    ]);
    jest.spyOn(internalService, 'splitDocuments').mockResolvedValue([
      new LangChainDocument({
        pageContent: 'alpha beta',
        metadata: {},
      }),
      new LangChainDocument({
        pageContent: ' gamma delta',
        metadata: {},
      }),
    ]);

    const chunks = await service.prepareChunks({
      userId: 'user-id',
      knowledgeBaseId: 'kb-id',
      documentId: 'doc-id',
      documentName: 'demo.md',
      extension: 'md',
      content: 'alpha beta gamma delta',
    });

    expect(chunks).toEqual([
      {
        sequence: 0,
        content: 'alpha beta',
        startIndex: 0,
        endIndex: 10,
      },
      {
        sequence: 1,
        content: 'gamma delta',
        startIndex: 11,
        endIndex: 22,
      },
    ]);
  });

  it('preserves pdf page number and computes page-level offsets', async () => {
    const internalService = service as InternalDocumentIndexingService;

    jest.spyOn(internalService, 'loadSourceDocuments').mockResolvedValue([
      new LangChainDocument({
        pageContent: 'Alpha page one',
        metadata: {
          loc: {
            pageNumber: 1,
          },
        },
      }),
      new LangChainDocument({
        pageContent: 'Beta page two',
        metadata: {
          loc: {
            pageNumber: 2,
          },
        },
      }),
    ]);
    jest
      .spyOn(internalService, 'splitDocuments')
      .mockResolvedValueOnce([
        new LangChainDocument({
          pageContent: 'Alpha page',
          metadata: {
            loc: {
              pageNumber: 1,
            },
          },
        }),
      ])
      .mockResolvedValueOnce([
        new LangChainDocument({
          pageContent: 'page two',
          metadata: {
            loc: {
              pageNumber: 2,
            },
          },
        }),
      ]);

    const chunks = await service.prepareChunks({
      userId: 'user-id',
      knowledgeBaseId: 'kb-id',
      documentId: 'doc-id',
      documentName: 'demo.pdf',
      extension: 'pdf',
      file: {
        buffer: Buffer.from('pdf'),
      } as Express.Multer.File,
    });

    expect(chunks).toEqual([
      {
        sequence: 0,
        content: 'Alpha page',
        page: 1,
        startIndex: 0,
        endIndex: 10,
      },
      {
        sequence: 1,
        content: 'page two',
        page: 2,
        startIndex: 5,
        endIndex: 13,
      },
    ]);
  });

  it('omits undefined optional fields when writing vector documents', async () => {
    const internalService = service as InternalDocumentIndexingService;

    jest.spyOn(internalService, 'createEmbeddings').mockReturnValue({
      embedDocuments: jest.fn().mockResolvedValue([[0.1], [0.2]]),
    });

    await service.replaceDocumentVectors({
      userId: 'user-id',
      knowledgeBaseId: 'kb-id',
      documentId: 'doc-id',
      documentName: 'demo.md',
      chunks: [
        {
          sequence: 0,
          content: 'chunk-a',
        },
        {
          sequence: 1,
          content: 'chunk-b',
          page: 2,
          startIndex: 10,
          endIndex: 17,
        },
      ],
    });

    expect(collectionMock.insertMany).toHaveBeenCalledTimes(1);

    const payload = collectionMock.insertMany.mock.calls[0][0] as Array<
      Record<string, unknown>
    >;

    expect(payload[0]).toEqual({
      userId: 'user-id',
      knowledgeBaseId: 'kb-id',
      documentId: 'doc-id',
      documentName: 'demo.md',
      sequence: 0,
      text: 'chunk-a',
      embedding: [0.1],
    });
    expect(payload[1]).toEqual({
      userId: 'user-id',
      knowledgeBaseId: 'kb-id',
      documentId: 'doc-id',
      documentName: 'demo.md',
      sequence: 1,
      text: 'chunk-b',
      embedding: [0.2],
      page: 2,
      startIndex: 10,
      endIndex: 17,
    });
  });
});
