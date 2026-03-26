import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * 定义创建知识库基础的 DTO 结构。
 */
export class CreateKnowledgeBaseDto {
  /**
   * 保存名称。
   */
  @ApiProperty({
    description: '知识库名称',
    example: '前端面试知识库',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @MinLength(1, {
    message: '知识库名称不能为空',
  })
  @MaxLength(100, {
    message: '知识库名称长度不能超过 100 个字符',
  })
  name: string;

  /**
   * 保存描述信息。
   */
  @ApiPropertyOptional({
    description: '知识库描述',
    example: '用于整理前端面试题、八股文和项目经验。',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, {
    message: '知识库描述长度不能超过 500 个字符',
  })
  description?: string;
}
