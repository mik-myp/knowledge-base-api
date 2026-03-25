/*
https://docs.nestjs.com/guards#guards
*/

import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from '../utils/public.decorator';

/**
 * 负责Jwt认证校验的守卫。
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  /**
   * 判断当前请求是否需要执行 JWT 认证。
   * @param context 当前执行上下文。
   * @returns 返回是否允许继续执行请求。
   */
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  /**
   * 统一处理 Passport 返回的认证结果。
   * @param err Passport 抛出的错误对象。
   * @param user 认证成功后得到的用户信息。
   * @param info 认证过程中的附加提示信息。
   * @param info.message Passport 返回的错误消息。
   * @param info.name Passport 返回的错误名称。
   * @returns 返回认证通过后的用户对象。
   */
  handleRequest<TUser>(
    err: Error | null,
    user: TUser | false | null,
    info?: { message?: string; name?: string },
  ): TUser {
    if (err || !user) {
      const errorMessage = info?.message || '无效的 Token';
      const errorName = info?.name || 'UnknownError';

      let friendlyMessage = errorMessage;
      if (
        errorName === 'TokenExpiredError' ||
        errorMessage.includes('jwt expired')
      ) {
        friendlyMessage = 'Token 已过期，请重新登录';
      } else if (errorName === 'JsonWebTokenError') {
        if (errorMessage.includes('invalid signature')) {
          friendlyMessage =
            'Token 签名无效，可能是 JWT access secret 配置不一致或 Token 被篡改';
        } else if (errorMessage.includes('jwt malformed')) {
          friendlyMessage = 'Token 格式错误，请检查 Authorization 头部格式';
        }
      }

      throw new UnauthorizedException(friendlyMessage);
    }

    return user;
  }
}
