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

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

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

  handleRequest<TUser>(
    err: Error | null,
    user: TUser | false | null,
    info?: { message?: string; name?: string },
  ): TUser {
    console.log(err, user);

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
            'Token 签名无效，可能是 JWT_SECRET 配置不一致或 Token 被篡改';
        } else if (errorMessage.includes('jwt malformed')) {
          friendlyMessage = 'Token 格式错误，请检查 Authorization 头部格式';
        }
      }

      throw new UnauthorizedException(friendlyMessage);
    }

    return user;
  }
}
