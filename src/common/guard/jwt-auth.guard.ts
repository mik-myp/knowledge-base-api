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
      context.getHandler(), // 获取当前处理方法的元数据
      context.getClass(), // 获取当前类的元数据
    ]);

    // 如果接口被标记为公开接口，直接允许通过
    if (isPublic) {
      return true; // 公开接口，不需要验证Token，直接返回true
    }

    // 否则，执行父类AuthGuard的canActivate方法，进行JWT认证
    return super.canActivate(context); // 调用父类的方法，继续进行JWT验证
  }

  handleRequest(err, user, info: any) {
    if (err || !user) {
      // 记录详细的错误信息用于调试
      const errorMessage = info?.message || '无效的 Token';
      const errorName = info?.name || 'UnknownError';

      // 根据不同的错误类型提供更友好的错误信息
      let friendlyMessage = errorMessage;
      if (errorName === 'JsonWebTokenError') {
        if (errorMessage.includes('invalid signature')) {
          friendlyMessage =
            'Token 签名无效，可能是 JWT_SECRET 配置不一致或 Token 被篡改';
        } else if (errorMessage.includes('jwt malformed')) {
          friendlyMessage = 'Token 格式错误，请检查 Authorization 头部格式';
        } else if (errorMessage.includes('jwt expired')) {
          friendlyMessage = 'Token 已过期，请重新登录';
        }
      }

      throw new UnauthorizedException(friendlyMessage);
    }
    return user;
  }
}
