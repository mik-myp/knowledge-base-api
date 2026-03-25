import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  API_CONSTRAINTS,
  trimOptionalStringValue,
} from 'src/contracts/api-contracts';

/**
 * 定义创建对话会话的 DTO 结构。
 */
export class CreateChatSessionDto {
  /**
   * 保存知识库 ID。
   */
  @ApiPropertyOptional({
    description: 'Knowledge base id. Omit it to create a normal chat session.',
    example: '507f1f77bcf86cd799439011',
  })
  @Transform(({ value }) => trimOptionalStringValue(value))
  @IsOptional()
  @IsMongoId({ message: 'knowledgeBaseId 必须是合法 ObjectId' })
  knowledgeBaseId?: string;

  /**
   * 保存标题。
   */
  @ApiPropertyOptional({
    description: 'Optional session title.',
    example: 'NestJS session',
  })
  @Transform(({ value }) => trimOptionalStringValue(value))
  @IsOptional()
  @IsString()
  @MinLength(API_CONSTRAINTS.chat.sessionTitleMinLength, {
    message: 'title 不能为空',
  })
  @MaxLength(API_CONSTRAINTS.chat.sessionTitleMaxLength, {
    message: 'title 长度不能超过 50 个字符',
  })
  title?: string;
}
