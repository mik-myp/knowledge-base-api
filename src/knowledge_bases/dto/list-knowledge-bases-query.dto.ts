import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * 定义列表知识库Bases查询参数的 DTO 结构。
 */
export class ListKnowledgeBasesQueryDto {
  /**
   * 保存页码。
   */
  @ApiPropertyOptional({
    description: '页码',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page 必须是整数' })
  @Min(1, {
    message: 'page 不能小于 1',
  })
  page?: number;

  /**
   * 保存每页数量。
   */
  @ApiPropertyOptional({
    description: '每页数量',
    example: 10,
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
  pageSize?: number;
}
