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
    description: '消息角色',
    enum: [ChatMessageType.System, ChatMessageType.Human, ChatMessageType.Tool],
    example: ChatMessageType.Human,
  })
  @IsIn([ChatMessageType.System, ChatMessageType.Human, ChatMessageType.Tool])
  role: ChatRequestMessageRole;

  /**
   * 保存内容。
   */
  @ApiProperty({
    description: '消息内容',
    example: '请解释一下这个概念。',
  })
  @IsString()
  @MinLength(1, { message: 'content 不能为空' })
  content: string;

  /**
   * 保存名称。
   */
  @ApiPropertyOptional({
    description: '可选的消息名称',
    example: '知识库工具',
  })
  @IsOptional()
  @IsString()
  name?: string;

  /**
   * 保存工具调用Id。
   */
  @ApiPropertyOptional({
    description: '可选的工具调用 ID',
    example: '调用_123',
  })
  @IsOptional()
  @IsString()
  toolCallId?: string;
}
