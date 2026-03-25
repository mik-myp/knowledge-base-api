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
    description: 'Document ids to delete.',
    type: [String],
    example: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsMongoId({ each: true, message: 'documentIds 中必须都是合法 ObjectId' })
  documentIds: string[];
}
