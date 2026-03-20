import { Module } from '@nestjs/common';
import { DocumnetsService } from './documnets.service';
import { DocumnetsController } from './documnets.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Document, DocumentSchema } from './schemas/documnet.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Document.name,
        schema: DocumentSchema,
      },
    ]),
  ],
  controllers: [DocumnetsController],
  providers: [DocumnetsService],
})
export class DocumnetsModule {}
