import { Module } from '@nestjs/common';
import { DocumnetsService } from './documnets.service';
import { DocumnetsController } from './documnets.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Document, DocumentSchema } from './schemas/documnet.schema';
import {
  KnowledgeBase,
  KnowledgeBaseSchema,
} from 'src/knowledge_bases/schemas/knowledge_base.schema';
import { StorageModule } from 'src/storage/storage.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: KnowledgeBase.name, schema: KnowledgeBaseSchema },
      {
        name: Document.name,
        schema: DocumentSchema,
      },
    ]),
    StorageModule,
  ],
  controllers: [DocumnetsController],
  providers: [DocumnetsService],
})
export class DocumnetsModule {}
