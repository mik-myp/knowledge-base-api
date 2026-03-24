import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatSession, ChatSessionSchema } from './schemas/chat_session.schema';
import { ChatMessage, ChatMessageSchema } from './schemas/chat_message.schema';
import {
  KnowledgeBase,
  KnowledgeBaseSchema,
} from 'src/knowledge_bases/schemas/knowledge_base.schema';
import { DocumentsModule } from 'src/documents/documents.module';
import { LangchainModule } from 'src/langchain/langchain.module';

@Module({
  imports: [
    DocumentsModule,
    LangchainModule,
    MongooseModule.forFeature([
      { name: ChatSession.name, schema: ChatSessionSchema },
      {
        name: ChatMessage.name,
        schema: ChatMessageSchema,
      },
      {
        name: KnowledgeBase.name,
        schema: KnowledgeBaseSchema,
      },
    ]),
  ],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
