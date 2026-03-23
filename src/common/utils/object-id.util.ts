import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';

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
