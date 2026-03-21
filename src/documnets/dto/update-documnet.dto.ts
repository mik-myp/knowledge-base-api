import { IsEnum } from 'class-validator';
import { DocumentStatus } from '../schemas/documnet.schema';

export class UpdateDocumnetDto {
  @IsEnum(DocumentStatus)
  status: string;
}
