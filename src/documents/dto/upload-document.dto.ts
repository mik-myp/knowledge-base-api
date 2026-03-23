import { IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';

export class UploadDocumentDto {
  @IsMongoId({ message: 'knowledgeBaseId 必须是合法 ObjectId' })
  knowledgeBaseId: string;

  @IsOptional()
  @IsString({ message: 'name 必须是字符串' })
  @MaxLength(200, { message: 'name 长度不能超过 200' })
  name?: string;
}
