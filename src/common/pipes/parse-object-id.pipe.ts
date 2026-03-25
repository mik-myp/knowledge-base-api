import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { Types } from 'mongoose';

/**
 * 校验路由参数是否为合法 ObjectId 的管道。
 */
@Injectable()
export class ParseObjectIdPipe implements PipeTransform<string, string> {
  /**
   * 校验并返回合法的 ObjectId 字符串。
   * @param value 需要校验的路由参数值。
   * @returns 返回原始 ObjectId 字符串。
   */
  transform(value: string): string {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException('非法的 ObjectId');
    }

    return value;
  }
}
