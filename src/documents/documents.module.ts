import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Document, DocumentSchema } from './schemas/document.schema';
import {
  KnowledgeBase,
  KnowledgeBaseSchema,
} from 'src/knowledge_bases/schemas/knowledge_base.schema';
import { StorageModule } from 'src/storage/storage.module';
import {
  DocumentChunk,
  DocumentChunkSchema,
} from './schemas/document_chunks.schema';
import { DocumentIndexingService } from './document-indexing.service';
import { LangchainModule } from 'src/langchain/langchain.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: KnowledgeBase.name, schema: KnowledgeBaseSchema },
      {
        name: Document.name,
        schema: DocumentSchema,
      },
      {
        name: DocumentChunk.name,
        schema: DocumentChunkSchema,
      },
    ]),
    StorageModule,
    LangchainModule,
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentIndexingService],
  exports: [DocumentsService, DocumentIndexingService],
})
export class DocumentsModule {}
