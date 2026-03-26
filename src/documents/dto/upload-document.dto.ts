import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId } from 'class-validator';

/**
 * 定义上传文档的 DTO 结构。
 */
export class UploadDocumentDto {
  /**
   * 保存知识库 ID。
   */
  @ApiProperty({
    description: 'Knowledge base id.',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId({ message: 'knowledgeBaseId 必须是合法 ObjectId' })
  knowledgeBaseId: string;
}
