import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId } from 'class-validator';

export class UploadDocumentDto {
  @ApiProperty({
    description: 'Knowledge base id.',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId({ message: 'knowledgeBaseId 必须是合法 ObjectId' })
  knowledgeBaseId: string;
}
