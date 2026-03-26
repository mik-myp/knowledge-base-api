import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

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
    minLength: 1,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MinLength(1, {
    message: '知识库名称不能为空',
  })
  @MaxLength(100, {
    message: '知识库名称长度不能超过 100 个字符',
  })
  name?: string;

  /**
   * 保存描述信息。
   */
  @ApiPropertyOptional({
    description: '知识库描述',
    example: '更新后的知识库描述。',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, {
    message: '知识库描述长度不能超过 500 个字符',
  })
  description?: string;
}
