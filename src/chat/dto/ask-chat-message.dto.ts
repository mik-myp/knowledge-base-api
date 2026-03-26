import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import {
  ChatMessageType,
  type ChatRequestMessageRole,
} from '../types/chat.types';

/**
 * 定义问答对话消息的 DTO 结构。
 */
export class AskChatMessageDto {
  /**
   * 保存role。
   */
  @ApiProperty({
    description: 'Message role.',
    enum: [ChatMessageType.System, ChatMessageType.Human, ChatMessageType.Tool],
    example: ChatMessageType.Human,
  })
  @IsIn([ChatMessageType.System, ChatMessageType.Human, ChatMessageType.Tool])
  role: ChatRequestMessageRole;

  /**
   * 保存内容。
   */
  @ApiProperty({
    description: 'Message content.',
    example: 'Please explain this concept.',
  })
  @IsString()
  @MinLength(1, { message: 'content 不能为空' })
  content: string;

  /**
   * 保存名称。
   */
  @ApiPropertyOptional({
    description: 'Optional message name.',
    example: 'knowledge-tool',
  })
  @IsOptional()
  @IsString()
  name?: string;

  /**
   * 保存工具调用Id。
   */
  @ApiPropertyOptional({
    description: 'Optional tool call id.',
    example: 'call_123',
  })
  @IsOptional()
  @IsString()
  toolCallId?: string;
}
