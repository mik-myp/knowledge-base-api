import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';

/**
 * 将字符串转换为 ObjectId。
 * @param value 待处理的值。
 * @param exceptionFactory 异常构造函数。
 * @returns 返回Types.ObjectId。
 */
export function toObjectId(
  value: string,
  exceptionFactory: () => Error = () =>
    new BadRequestException('非法的 ObjectId'),
): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw exceptionFactory();
  }

  return new Types.ObjectId(value);
}
