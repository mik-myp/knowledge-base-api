import { Module } from '@nestjs/common';
import { KnowledgeBasesService } from './knowledge_bases.service';
import { KnowledgeBasesController } from './knowledge_bases.controller';
import { MongooseModule } from '@nestjs/mongoose';
import {
  KnowledgeBase,
  KnowledgeBaseSchema,
} from './schemas/knowledge_base.schema';
import {
  KnowledgeDocument,
  KnowledgeDocumentSchema,
} from '../documents/schemas/document.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: KnowledgeBase.name,
        schema: KnowledgeBaseSchema,
      },
      {
        name: KnowledgeDocument.name,
        schema: KnowledgeDocumentSchema,
      },
    ]),
  ],
  controllers: [KnowledgeBasesController],
  providers: [KnowledgeBasesService],
})
export class KnowledgeBasesModule {}
