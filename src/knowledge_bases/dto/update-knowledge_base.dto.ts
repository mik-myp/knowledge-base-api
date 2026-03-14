import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateKnowledgeBaseDto {
  @ApiPropertyOptional({
    description: '知识库名称',
    example: '新版前端面试知识库',
    minLength: 1,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: '知识库名称不能为空' })
  @MaxLength(100, { message: '知识库名称长度不能超过 100 个字符' })
  name?: string;

  @ApiPropertyOptional({
    description: '知识库描述',
    example: '更新后的知识库描述。',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: '知识库描述长度不能超过 500 个字符' })
  description?: string;
}
