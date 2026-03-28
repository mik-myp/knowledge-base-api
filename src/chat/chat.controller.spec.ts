import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { of } from 'rxjs';

describe('ChatController', () => {
  const chatService = {
    createSession: jest.fn(),
    findAllSession: jest.fn(),
    updateSession: jest.fn(),
    removeSession: jest.fn(),
    askStream: jest.fn(),
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

  it('should delegate ask stream to service', async () => {
    const askDto = {
      sessionId: 'session-id',
      messages: [
        {
          role: 'human',
          content: '你好',
        },
      ],
    };

    const response = {
      setHeader: jest.fn(),
      flushHeaders: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
      on: jest.fn(),
      destroy: jest.fn(),
    };

    chatService.askStream.mockReturnValue(
      of({
        sessionId: 'session-id',
        answer: '你好',
        done: true,
      }) as any,
    );

    controller.askStream(request as any, askDto, response as any);

    expect(chatService.askStream.mock.calls[0]).toEqual(['user-id', askDto]);
  });

  it('should delegate message query to service', async () => {
    const query = {
      sessionId: 'session-id',
    };

    await controller.findMessages(request as any, query);

    expect(chatService.findMessages.mock.calls[0]).toEqual(['user-id', query]);
  });
});
