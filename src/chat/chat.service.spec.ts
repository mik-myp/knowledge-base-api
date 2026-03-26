import { ChatService } from './chat.service';

describe('ChatService', () => {
  let service: ChatService;
  type ChatServiceDependencies = ConstructorParameters<typeof ChatService>;

  const chatSessionModel = {} as ChatServiceDependencies[0];
  const chatMessageModel = {} as ChatServiceDependencies[1];
  const knowledgeBaseModel = {} as ChatServiceDependencies[2];
  const langchainService = {
    createChatModel: jest.fn(),
  } as unknown as ChatServiceDependencies[3];
  const documentIndexingService = {
    semanticSearch: jest.fn(),
  } as unknown as ChatServiceDependencies[4];

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ChatService(
      chatSessionModel,
      chatMessageModel,
      knowledgeBaseModel,
      langchainService,
      documentIndexingService,
    );
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
    const deleteMany = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue({ deletedCount: 2 }),
    });
    chatMessageModel.deleteMany = deleteMany;

    await service.removeSession(
      '507f1f77bcf86cd799439012',
      '507f1f77bcf86cd799439011',
    );

    expect(deleteMany).toHaveBeenCalled();
  });
});
