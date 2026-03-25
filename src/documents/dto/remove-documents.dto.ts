import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsMongoId } from 'class-validator';

export class RemoveDocumentsDto {
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
