import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsMongoId,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { AskChatMessageDto } from './ask-chat-message.dto';

/**
 * 定义问答对话的 DTO 结构。
 */
export class AskChatDto {
  /**
   * 保存消息列表。
   */
  @ApiProperty({
    description: '本次请求的消息列表，至少包含一条用户消息。',
    type: [AskChatMessageDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AskChatMessageDto)
  messages: AskChatMessageDto[];

  /**
   * 保存会话 ID。
   */
  @ApiPropertyOptional({
    description: '继续追问时传入的会话 ID',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @IsMongoId({ message: 'sessionId 必须是合法的 ObjectId' })
  sessionId?: string;

  /**
   * 保存知识库 ID。
   */
  @ApiPropertyOptional({
    description: '创建知识库问答时传入的知识库 ID',
    example: '507f1f77bcf86cd799439012',
  })
  @IsOptional()
  @IsMongoId({ message: 'knowledgeBaseId 必须是合法的 ObjectId' })
  knowledgeBaseId?: string;

  /**
   * 保存topK。
   */
  @ApiPropertyOptional({
    description: '语义检索返回的片段数量',
    example: 5,
    minimum: 1,
    maximum: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  topK?: number;
}
