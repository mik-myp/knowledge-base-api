import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatMessageType } from './types/chat.types';

describe('ChatController', () => {
  const chatService = {
    createSession: jest.fn(),
    findAllSession: jest.fn(),
    updateSession: jest.fn(),
    removeSession: jest.fn(),
    ask: jest.fn(),
    findMessages: jest.fn(),
  } as unknown as jest.Mocked<ChatService>;

  const controller = new ChatController(chatService);
  const request = {
    user: {
      userId: 'user-id',
      email: 'user@example.com',
      tokenType: 'access',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should delegate ask to service', async () => {
    const askDto = {
      sessionId: 'session-id',
      messages: [
        {
          role: 'human',
          content: '你好',
        },
      ],
    };

    await controller.ask(request as any, askDto);

    expect(chatService.ask).toHaveBeenCalledWith('user-id', askDto);
  });

  it('should delegate message query to service', async () => {
    const query = {
      sessionId: 'session-id',
    };

    await controller.findMessages(request as any, query);

    expect(chatService.findMessages).toHaveBeenCalledWith('user-id', query);
  });
});
