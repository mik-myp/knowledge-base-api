import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
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
import {
  API_CONSTRAINTS,
  trimOptionalStringValue,
} from 'src/contracts/api-contracts';
import { AskChatMessageDto } from './ask-chat-message.dto';

/**
 * 定义问答对话的 DTO 结构。
 */
export class AskChatDto {
  /**
   * 保存消息列表。
   */
  @ApiProperty({
    description:
      'Messages for this request. It must contain at least one human message.',
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
    description: 'Existing session id for follow-up questions.',
    example: '507f1f77bcf86cd799439011',
  })
  @Transform(({ value }) => trimOptionalStringValue(value))
  @IsOptional()
  @IsMongoId({ message: 'sessionId 必须是合法 ObjectId' })
  sessionId?: string;

  /**
   * 保存知识库 ID。
   */
  @ApiPropertyOptional({
    description: 'Knowledge base id when creating a knowledge-based chat.',
    example: '507f1f77bcf86cd799439012',
  })
  @Transform(({ value }) => trimOptionalStringValue(value))
  @IsOptional()
  @IsMongoId({ message: 'knowledgeBaseId 必须是合法 ObjectId' })
  knowledgeBaseId?: string;

  /**
   * 保存topK。
   */
  @ApiPropertyOptional({
    description: 'Top K chunks returned by semantic search.',
    example: 5,
    minimum: API_CONSTRAINTS.chat.askTopKMin,
    maximum: API_CONSTRAINTS.chat.askTopKMax,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(API_CONSTRAINTS.chat.askTopKMin)
  @Max(API_CONSTRAINTS.chat.askTopKMax)
  topK?: number;
}
