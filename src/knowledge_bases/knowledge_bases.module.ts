import { Module } from '@nestjs/common';
import { KnowledgeBasesService } from './knowledge_bases.service';
import { KnowledgeBasesController } from './knowledge_bases.controller';
import { MongooseModule } from '@nestjs/mongoose';
import {
  KnowledgeBase,
  KnowledgeBaseSchema,
} from './schemas/knowledge_base.schema';
import {
  Document,
  DocumentSchema,
} from 'src/documnets/schemas/documnet.schema';
import { StorageModule } from 'src/storage/storage.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: KnowledgeBase.name,
        schema: KnowledgeBaseSchema,
      },
      {
        name: Document.name,
        schema: DocumentSchema,
      },
    ]),
    StorageModule,
  ],

  controllers: [KnowledgeBasesController],
  providers: [KnowledgeBasesService],
})
export class KnowledgeBasesModule {}
