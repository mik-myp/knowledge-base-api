import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './common/utils/public.decorator';

/**
 * 负责App相关接口处理的控制器。
 */
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * 获取Hello。
   * @returns 返回字符串结果。
   */
  @Get()
  @Public()
  getHello(): string {
    return this.appService.getHello();
  }
}
