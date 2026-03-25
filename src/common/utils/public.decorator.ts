import { SetMetadata } from '@nestjs/common';

/**
 * 标记接口无需鉴权时使用的元数据键名。
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * 标记当前路由为公开接口。
 * @returns 返回一个写入公开标记的装饰器。
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
