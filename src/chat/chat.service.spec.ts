import { DocumentIndexingService } from 'src/documents/document-indexing.service';
import { LangchainService } from 'src/langchain/langchain.service';
import { ChatService } from './chat.service';
import { ChatMessageType, type SerializedChatMessage } from './types/chat.types';

describe('ChatService', () => {
  let service: ChatService;

  const chatSessionModel = {} as any;
  const chatMessageModel = {} as any;
  const knowledgeBaseModel = {} as any;
  const langchainService = {
    createChatModel: jest.fn(),
  } as unknown as jest.Mocked<Pick<LangchainService, 'createChatModel'>>;
  const documentIndexingService = {
    semanticSearch: jest.fn(),
  } as unknown as jest.Mocked<Pick<DocumentIndexingService, 'semanticSearch'>>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ChatService(
      chatSessionModel,
      chatMessageModel,
      knowledgeBaseModel,
      langchainService as unknown as LangchainService,
      documentIndexingService as unknown as DocumentIndexingService,
    );
  });

  it('should create a session when sessionId is missing', async () => {
    const session = {
      id: 'session-id',
      title: 'new session',
      knowledgeBaseId: null,
    };
    const aiMessage: SerializedChatMessage = {
      id: 'ai-id',
      userId: 'user-id',
      sessionId: 'session-id',
      messageType: ChatMessageType.Ai,
      content: 'hello',
      sequence: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    jest.spyOn(service as any, 'resolveSession').mockResolvedValue(session);
    jest
      .spyOn(service as any, 'getLastSequence')
      .mockResolvedValueOnce(-1)
      .mockResolvedValueOnce(0);
    jest
      .spyOn(service as any, 'appendIncomingMessages')
      .mockResolvedValue([]);
    jest.spyOn(service as any, 'loadSessionMessages').mockResolvedValue([]);
    langchainService.createChatModel.mockReturnValue({
      invoke: jest.fn().mockResolvedValue({
        content: 'hello',
        response_metadata: {
          model_name: 'test-model',
        },
        usage_metadata: {
          input_tokens: 1,
          output_tokens: 1,
          total_tokens: 2,
        },
        tool_calls: [],
      }),
    } as any);
    jest
      .spyOn(service as any, 'appendAssistantMessage')
      .mockResolvedValue(aiMessage);
    const touchSessionSpy = jest
      .spyOn(service as any, 'touchSession')
      .mockResolvedValue(undefined);

    const result = await service.ask('user-id', {
      messages: [
        {
          role: 'human',
          content: 'hello',
        },
      ],
    } as any);

    expect((service as any).resolveSession).toHaveBeenCalledWith(
      'user-id',
      {
        messages: [
          {
            role: 'human',
            content: 'hello',
          },
        ],
      },
      'hello',
    );
    expect(result.sessionId).toBe('session-id');
    expect(result.answer).toBe('hello');
    expect(result.message).toEqual(aiMessage);
    expect(touchSessionSpy).toHaveBeenCalledWith('session-id', 'hello');
  });

  it('should perform semantic search for knowledge-base session and return sources', async () => {
    const session = {
      id: 'session-id',
      title: 'knowledge session',
      knowledgeBaseId: 'knowledge-id',
    };
    const aiMessage: SerializedChatMessage = {
      id: 'ai-id',
      userId: 'user-id',
      sessionId: 'session-id',
      messageType: ChatMessageType.Ai,
      content: 'answer from knowledge',
      sequence: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sources: [
        {
          documentId: 'document-id',
          documentName: 'guide.md',
          chunkSequence: 2,
          page: 1,
          startIndex: 10,
          endIndex: 40,
          score: 0.91,
        },
      ],
    };

    jest.spyOn(service as any, 'resolveSession').mockResolvedValue(session);
    jest
      .spyOn(service as any, 'getLastSequence')
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);
    jest
      .spyOn(service as any, 'appendIncomingMessages')
      .mockResolvedValue([]);
    jest.spyOn(service as any, 'loadSessionMessages').mockResolvedValue([]);
    langchainService.createChatModel.mockReturnValue({
      invoke: jest.fn().mockResolvedValue({
        content: 'answer from knowledge',
        response_metadata: {},
        usage_metadata: {
          input_tokens: 3,
          output_tokens: 4,
          total_tokens: 7,
        },
        tool_calls: [],
      }),
    } as any);
    jest
      .spyOn(service as any, 'appendAssistantMessage')
      .mockResolvedValue(aiMessage);
    jest
      .spyOn(service as any, 'touchSession')
      .mockResolvedValue(undefined);
    documentIndexingService.semanticSearch.mockResolvedValue([
      {
        documentId: 'document-id',
        documentName: 'guide.md',
        sequence: 2,
        text: 'knowledge snippet',
        page: 1,
        startIndex: 10,
        endIndex: 40,
        score: 0.91,
      },
    ] as any);

    const result = await service.ask('user-id', {
      sessionId: 'session-id',
      messages: [
        {
          role: 'human',
          content: 'explain it',
        },
      ],
      topK: 4,
    } as any);

    expect(documentIndexingService.semanticSearch).toHaveBeenCalledWith({
      userId: 'user-id',
      knowledgeBaseId: 'knowledge-id',
      question: 'explain it',
      topK: 4,
    });
    expect(result.sources).toEqual(aiMessage.sources);
    expect(result.answer).toBe('answer from knowledge');
  });

  it('should delete chat messages together when removing a session', async () => {
    const chatSession = {
      toObject: () => ({
        _id: '507f1f77bcf86cd799439011',
        userId: '507f1f77bcf86cd799439012',
        knowledgeBaseId: null,
        title: 'session',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    };

    chatSessionModel.findOneAndDelete = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(chatSession),
    });
    chatMessageModel.deleteMany = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue({ deletedCount: 2 }),
    });

    await service.removeSession(
      '507f1f77bcf86cd799439012',
      '507f1f77bcf86cd799439011',
    );

    expect(chatMessageModel.deleteMany).toHaveBeenCalled();
  });
});
