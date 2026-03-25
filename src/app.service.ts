import { Injectable } from '@nestjs/common';

/**
 * 负责App相关业务处理的服务。
 */
@Injectable()
export class AppService {
  /**
   * 获取Hello。
   * @returns 返回字符串结果。
   */
  getHello(): string {
    return 'Hello World!';
  }
}
