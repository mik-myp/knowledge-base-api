import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import {
  API_CONSTRAINTS,
  trimOptionalStringValue,
} from 'src/contracts/api-contracts';

/**
 * 定义更新知识库基础的 DTO 结构。
 */
export class UpdateKnowledgeBaseDto {
  /**
   * 保存名称。
   */
  @ApiPropertyOptional({
    description: '知识库名称',
    example: '新版前端面试知识库',
    minLength: API_CONSTRAINTS.knowledgeBase.nameMinLength,
    maxLength: API_CONSTRAINTS.knowledgeBase.nameMaxLength,
  })
  @Transform(({ value }) => trimOptionalStringValue(value))
  @IsOptional()
  @IsString()
  @MinLength(API_CONSTRAINTS.knowledgeBase.nameMinLength, {
    message: '知识库名称不能为空',
  })
  @MaxLength(API_CONSTRAINTS.knowledgeBase.nameMaxLength, {
    message: '知识库名称长度不能超过 100 个字符',
  })
  name?: string;

  /**
   * 保存描述信息。
   */
  @ApiPropertyOptional({
    description: '知识库描述',
    example: '更新后的知识库描述。',
    maxLength: API_CONSTRAINTS.knowledgeBase.descriptionMaxLength,
  })
  @Transform(({ value }) => trimOptionalStringValue(value))
  @IsOptional()
  @IsString()
  @MaxLength(API_CONSTRAINTS.knowledgeBase.descriptionMaxLength, {
    message: '知识库描述长度不能超过 500 个字符',
  })
  description?: string;
}
