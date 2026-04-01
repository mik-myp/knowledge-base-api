import { Module } from '@nestjs/common';
import { WriteService } from './write.service';
import { WriteController } from './write.controller';

@Module({
  controllers: [WriteController],
  providers: [WriteService],
})
export class WriteModule {}
