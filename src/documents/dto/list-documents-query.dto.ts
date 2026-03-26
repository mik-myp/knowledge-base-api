import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

/**
 * 定义列表文档查询参数的 DTO 结构。
 */
export class ListDocumentsQueryDto {
  /**
   * 保存页码。
   */
  @ApiPropertyOptional({
    description: '页码',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page 必须是整数' })
  @Min(1, { message: 'page 不能小于 1' })
  page?: number = 1;

  /**
   * 保存每页数量。
   */
  @ApiPropertyOptional({
    description: '每页数量',
    example: 10,
    default: 10,
    maximum: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'pageSize 必须是整数' })
  @Min(1, {
    message: 'pageSize 不能小于 1',
  })
  @Max(50, {
    message: 'pageSize 不能大于 50',
  })
  pageSize?: number = 10;

  /**
   * 保存知识库 ID。
   */
  @ApiPropertyOptional({
    description: '按知识库筛选',
    example: '507f1f77bcf86cd799439013',
  })
  @IsOptional()
  @IsMongoId({ message: 'knowledgeBaseId 必须是合法 ObjectId' })
  knowledgeBaseId?: string;

  /**
   * 保存搜索关键词。
   */
  @ApiPropertyOptional({
    description: '按文件名搜索',
    example: '项目说明',
  })
  @IsOptional()
  @IsString({ message: 'keyword 必须是字符串' })
  keyword?: string;
}
