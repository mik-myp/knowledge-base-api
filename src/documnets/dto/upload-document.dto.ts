import { IsMongoId } from 'class-validator';

export class UploadDocumentDto {
  @IsMongoId({ message: 'knowledgeBaseId 必须是合法 ObjectId' })
  knowledgeBaseId: string;
}
