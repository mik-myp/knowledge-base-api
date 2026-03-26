import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsMongoId } from 'class-validator';

/**
 * 定义删除文档的 DTO 结构。
 */
export class RemoveDocumentsDto {
  /**
   * 保存文档 ID 列表。
   */
  @ApiProperty({
    description: '需要删除的文档 ID 列表',
    type: [String],
    example: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsMongoId({
    each: true,
    message: 'documentIds 中的每一项都必须是合法的 ObjectId',
  })
  documentIds: string[];
}
