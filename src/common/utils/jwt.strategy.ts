import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';
import {
  isJwtTokenPayload,
  type AuthenticatedUser,
} from '../../users/types/users.types';

/**
 * 负责 accessToken 解析与用户身份校验的策略。
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  /**
   * 记录 JWT 策略初始化和校验过程的日志。
   */
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    const jwtSecret =
      configService.get<string>('JWT_ACCESS_SECRET') ??
      'knowledge-base-api-access';

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });

    if (!configService.get<string>('JWT_ACCESS_SECRET')) {
      this.logger.warn(
        'JWT access secret 未配置，使用默认值。生产环境请务必设置 JWT_ACCESS_SECRET',
      );
    } else {
      this.logger.log('JWT access secret 已从环境变量加载');
    }
  }

  /**
   * 校验 JWT 载荷并返回认证用户信息。
   * @param payload JWT 解码后的载荷数据。
   * @returns 返回可挂载到请求对象上的认证用户信息。
   */
  async validate(payload: unknown): Promise<AuthenticatedUser> {
    if (!isJwtTokenPayload(payload) || payload.tokenType !== 'access') {
      throw new UnauthorizedException('accessToken 无效');
    }

    const user = await this.usersService.getActiveUserByIdOrThrow(
      payload.userId,
    );

    return {
      userId: user.id,
      email: user.email,
      tokenType: 'access',
    };
  }
}
