import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * 定义创建对话会话的 DTO 结构。
 */
export class CreateChatSessionDto {
  /**
   * 保存知识库 ID。
   */
  @ApiPropertyOptional({
    description: '知识库 ID，不传则创建普通对话会话',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @IsMongoId({ message: 'knowledgeBaseId 必须是合法的 ObjectId' })
  knowledgeBaseId?: string;

  /**
   * 保存标题。
   */
  @ApiPropertyOptional({
    description: '可选的会话标题',
    example: '技术方案讨论',
  })
  @IsOptional()
  @IsString()
  @MinLength(1, {
    message: 'title 不能为空',
  })
  @MaxLength(50, {
    message: 'title 长度不能超过 50 个字符',
  })
  title?: string;
}
