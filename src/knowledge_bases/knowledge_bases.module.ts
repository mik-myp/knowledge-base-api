import { Module } from '@nestjs/common';
import { KnowledgeBasesService } from './knowledge_bases.service';
import { KnowledgeBasesController } from './knowledge_bases.controller';
import { MongooseModule } from '@nestjs/mongoose';
import {
  KnowledgeBase,
  KnowledgeBaseSchema,
} from './schemas/knowledge_base.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: KnowledgeBase.name,
        schema: KnowledgeBaseSchema,
      },
    ]),
  ],
  controllers: [KnowledgeBasesController],
  providers: [KnowledgeBasesService],
})
export class KnowledgeBasesModule {}
