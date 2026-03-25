import { StorageService } from './storage.service';
/*
https://docs.nestjs.com/modules
*/

import { Module } from '@nestjs/common';

/**
 * 组织Storage相关依赖的模块。
 */
@Module({
  imports: [],
  controllers: [],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
