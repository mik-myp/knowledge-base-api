import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { isJwtTokenPayload, type AuthenticatedUser } from 'src/users/users';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(private readonly configService: ConfigService) {
    const jwtSecret =
      configService.get<string>('JWT_SECRET') || 'knowledge-base-api';

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });

    if (!configService.get<string>('JWT_SECRET')) {
      this.logger.warn(
        '⚠️ JWT_SECRET 未配置，使用默认值。生产环境请务必设置环境变量 JWT_SECRET',
      );
    } else {
      this.logger.log('✅ JWT_SECRET 已从环境变量加载');
    }
  }

  validate(payload: unknown): AuthenticatedUser {
    if (!isJwtTokenPayload(payload) || payload.tokenType !== 'access') {
      throw new UnauthorizedException('accessToken 无效');
    }

    return {
      userId: payload.userId,
      email: payload.email,
      tokenType: 'access',
    };
  }
}
