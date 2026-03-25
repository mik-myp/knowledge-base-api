import { Module } from '@nestjs/common';
import { LangchainService } from './langchain.service';

/**
 * 组织Langchain相关依赖的模块。
 */
@Module({
  providers: [LangchainService],
  exports: [LangchainService],
})
export class LangchainModule {}
