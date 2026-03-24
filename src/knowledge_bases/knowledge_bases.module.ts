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
} from 'src/documents/schemas/document.schema';
import { DocumentsModule } from 'src/documents/documents.module';
import {
  ChatSession,
  ChatSessionSchema,
} from 'src/chat/schemas/chat_session.schema';
import {
  ChatMessage,
  ChatMessageSchema,
} from 'src/chat/schemas/chat_message.schema';

@Module({
  imports: [
    DocumentsModule,
    MongooseModule.forFeature([
      {
        name: KnowledgeBase.name,
        schema: KnowledgeBaseSchema,
      },
      {
        name: Document.name,
        schema: DocumentSchema,
      },
      {
        name: ChatSession.name,
        schema: ChatSessionSchema,
      },
      {
        name: ChatMessage.name,
        schema: ChatMessageSchema,
      },
    ]),
  ],

  controllers: [KnowledgeBasesController],
  providers: [KnowledgeBasesService],
})
export class KnowledgeBasesModule {}
