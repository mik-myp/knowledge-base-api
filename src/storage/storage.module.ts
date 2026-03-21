import { StorageService } from './storage.service';
/*
https://docs.nestjs.com/modules
*/

import { Module } from '@nestjs/common';

@Module({
  imports: [],
  controllers: [],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
