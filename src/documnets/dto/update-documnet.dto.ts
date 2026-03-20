import { PartialType } from '@nestjs/swagger';
import { CreateDocumnetDto } from './create-documnet.dto';

export class UpdateDocumnetDto extends PartialType(CreateDocumnetDto) {}
