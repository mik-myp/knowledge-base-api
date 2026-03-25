import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import {
  CHAT_REQUEST_MESSAGE_ROLES,
  trimOptionalStringValue,
  trimStringValue,
} from 'src/contracts/api-contracts';
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
  @IsIn(CHAT_REQUEST_MESSAGE_ROLES)
  role: ChatRequestMessageRole;

  /**
   * 保存内容。
   */
  @ApiProperty({
    description: 'Message content.',
    example: 'Please explain this concept.',
  })
  @Transform(({ value }) => trimStringValue(value))
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
  @Transform(({ value }) => trimOptionalStringValue(value))
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
  @Transform(({ value }) => trimOptionalStringValue(value))
  @IsOptional()
  @IsString()
  toolCallId?: string;
}
