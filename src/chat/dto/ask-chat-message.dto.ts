import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import {
  ChatMessageType,
  type ChatRequestMessageRole,
} from '../types/chat.types';

export class AskChatMessageDto {
  @ApiProperty({
    description: 'Message role.',
    enum: [ChatMessageType.System, ChatMessageType.Human, ChatMessageType.Tool],
    example: ChatMessageType.Human,
  })
  @IsIn([ChatMessageType.System, ChatMessageType.Human, ChatMessageType.Tool])
  role: ChatRequestMessageRole;

  @ApiProperty({
    description: 'Message content.',
    example: 'Please explain this concept.',
  })
  @IsString()
  content: string;

  @ApiPropertyOptional({
    description: 'Optional message name.',
    example: 'knowledge-tool',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Optional tool call id.',
    example: 'call_123',
  })
  @IsOptional()
  @IsString()
  toolCallId?: string;
}
