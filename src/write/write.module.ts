import { Module } from '@nestjs/common';
import { WriteService } from './write.service';
import { WriteController } from './write.controller';
import { LangchainModule } from 'src/langchain/langchain.module';
import { DocumentIndexingService } from 'src/documents/document-indexing.service';

@Module({
  imports: [LangchainModule],
  controllers: [WriteController],
  providers: [WriteService, DocumentIndexingService],
})
export class WriteModule {}
