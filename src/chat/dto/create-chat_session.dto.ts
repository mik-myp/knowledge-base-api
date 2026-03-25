import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsMongoId, IsOptional, IsString } from 'class-validator';

export class CreateChatSessionDto {
  @ApiPropertyOptional({
    description: 'Knowledge base id. Omit it to create a normal chat session.',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @IsMongoId({ message: 'knowledgeBaseId 必须是合法 ObjectId' })
  knowledgeBaseId?: string;

  @ApiPropertyOptional({
    description: 'Optional session title.',
    example: 'NestJS session',
  })
  @IsOptional()
  @IsString()
  title?: string;
}
