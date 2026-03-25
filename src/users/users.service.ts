import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import bcrypt from 'bcryptjs';
import { Model } from 'mongoose';
import { toObjectId } from 'src/common/utils/object-id.util';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { User, UserDocument, UserStatus } from './schemas/user.schema';
import {
  isRefreshTokenPayload,
  type AccessTokenPayload,
  type LogoutResult,
  type RefreshTokenPayload,
  type TokenPairResult,
  type UserProfile,
} from './types/users.types';

/**
 * 负责用户相关业务处理的服务。
 */
@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 处理用户注册。
   * @param registerDto 注册请求参数，包含用户名、邮箱和密码。
   * @returns 返回 Promise，解析后得到令牌对结果。
   */
  async register(registerDto: RegisterDto): Promise<TokenPairResult> {
    const { username, email, password } = registerDto;

    const existingUser = await this.userModel.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      throw new ConflictException('邮箱或用户名已存在');
    }

    const newUser = new this.userModel({
      username,
      email,
      password,
    });

    await newUser.save();

    return this.issueTokenPair(newUser, { touchLastLoginAt: true });
  }

  /**
   * 处理用户登录。
   * @param loginDto 登录请求参数，包含邮箱和密码。
   * @returns 返回 Promise，解析后得到令牌对结果。
   */
  async login(loginDto: LoginDto): Promise<TokenPairResult> {
    const { email, password } = loginDto;

    const user = await this.userModel.findOne({ email });

    if (!user) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    this.assertUserIsActive(user, '账号已被禁用，请联系管理员');

    return this.issueTokenPair(user, { touchLastLoginAt: true });
  }

  /**
   * 刷新令牌。
   * @param refreshTokenDto 刷新令牌请求参数。
   * @returns 返回 Promise，解析后得到令牌对结果。
   */
  async refresh(refreshTokenDto: RefreshTokenDto): Promise<TokenPairResult> {
    const payload = await this.verifyRefreshToken(refreshTokenDto.refreshToken);
    const userObjectId = toObjectId(
      payload.userId,
      () => new UnauthorizedException('refreshToken 无效或已过期'),
    );

    const user = this.ensureUserExists(
      await this.userModel.findById(userObjectId),
      'refreshToken 无效或已过期',
    );

    this.assertUserIsActive(user, '账号已被禁用，请重新登录');

    if (!user.refreshToken) {
      throw new UnauthorizedException('refreshToken 无效或已过期');
    }

    const isRefreshTokenValid = await bcrypt.compare(
      refreshTokenDto.refreshToken,
      user.refreshToken,
    );

    if (!isRefreshTokenValid) {
      throw new UnauthorizedException('refreshToken 无效或已过期');
    }

    return this.issueTokenPair(user);
  }

  /**
   * 处理用户退出登录。
   * @param userId 当前用户 ID。
   * @returns 返回 Promise，解析后得到退出登录结果。
   */
  async logout(userId: string): Promise<LogoutResult> {
    const user = await this.getActiveUserByIdOrThrow(userId);

    user.refreshToken = undefined;
    await user.save();

    return {
      success: true,
    };
  }

  /**
   * 获取当前用户信息。
   * @param userId 当前用户 ID。
   * @returns 返回 Promise，解析后得到用户资料。
   */
  async me(userId: string): Promise<UserProfile> {
    const user = await this.getActiveUserByIdOrThrow(userId);

    return this.toUserProfile(user);
  }

  /**
   * 获取有效用户，不存在时抛出异常。
   * @param userId 当前用户 ID。
   * @returns 返回 Promise，解析后得到用户文档。
   */
  async getActiveUserByIdOrThrow(userId: string): Promise<UserDocument> {
    const userObjectId = toObjectId(
      userId,
      () => new UnauthorizedException('登录状态已失效，请重新登录'),
    );
    const user = this.ensureUserExists(
      await this.userModel.findById(userObjectId),
      '登录状态已失效，请重新登录',
    );

    this.assertUserIsActive(user, '账号已被禁用，请重新登录');

    return user;
  }

  /**
   * 签发令牌对。
   * @param user 用户。
   * @param options 配置项。
   * @param options.touchLastLoginAt 是否更新最近登录时间。
   * @returns 返回 Promise，解析后得到令牌对结果。
   */
  private async issueTokenPair(
    user: UserDocument,
    options: { touchLastLoginAt?: boolean } = {},
  ): Promise<TokenPairResult> {
    if (options.touchLastLoginAt) {
      user.lastLoginAt = new Date();
    }

    const refreshTokenPayload = this.createRefreshTokenPayload(user);

    const [accessToken, refreshToken] = await Promise.all([
      this.signAccessToken(this.createAccessTokenPayload(user)),
      this.signRefreshToken(refreshTokenPayload),
    ]);

    const salt = await bcrypt.genSalt(10);

    user.refreshToken = await bcrypt.hash(refreshToken, salt);

    await user.save();

    return {
      user: this.toUserProfile(user),
      accessToken,
      refreshToken,
    };
  }

  /**
   * 创建访问令牌载荷。
   * @param user 用户。
   * @returns 返回访问令牌载荷。
   */
  private createAccessTokenPayload(user: UserDocument): AccessTokenPayload {
    return {
      userId: user.id,
      email: user.email,
      tokenType: 'access',
    };
  }

  /**
   * 创建刷新令牌载荷。
   * @param user 用户。
   * @returns 返回刷新令牌载荷。
   */
  private createRefreshTokenPayload(user: UserDocument): RefreshTokenPayload {
    return {
      userId: user.id,
      email: user.email,
      tokenType: 'refresh',
      jti: randomUUID(),
    };
  }

  /**
   * 生成访问令牌。
   * @param payload 载荷数据。
   * @returns 返回 Promise，解析后得到字符串。
   */
  private async signAccessToken(payload: AccessTokenPayload): Promise<string> {
    return this.jwtService.signAsync(payload);
  }

  /**
   * 生成刷新令牌。
   * @param payload 载荷数据。
   * @returns 返回 Promise，解析后得到字符串。
   */
  private async signRefreshToken(
    payload: RefreshTokenPayload,
  ): Promise<string> {
    return this.jwtService.signAsync(payload, {
      secret: this.getRefreshTokenSecret(),
      expiresIn: this.getRefreshTokenExpiresIn(),
    });
  }

  /**
   * 校验刷新令牌。
   * @param token 令牌。
   * @returns 返回 Promise，解析后得到刷新令牌载荷。
   */
  private async verifyRefreshToken(
    token: string,
  ): Promise<RefreshTokenPayload> {
    try {
      const payload: unknown = await this.jwtService.verifyAsync(token, {
        secret: this.getRefreshTokenSecret(),
      });

      if (!isRefreshTokenPayload(payload)) {
        throw new UnauthorizedException('refreshToken 无效或已过期');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('refreshToken 无效或已过期');
    }
  }

  /**
   * 获取刷新令牌Secret。
   * @returns 返回字符串结果。
   */
  private getRefreshTokenSecret(): string {
    return (
      this.configService.get<string>('JWT_REFRESH_SECRET') ??
      'knowledge-base-api-refresh'
    );
  }

  /**
   * 获取刷新令牌ExpiresIn。
   * @returns 返回NonNullable<JwtSignOptions['expiresIn']>。
   */
  private getRefreshTokenExpiresIn(): NonNullable<JwtSignOptions['expiresIn']> {
    return (
      this.configService.get<JwtSignOptions['expiresIn']>(
        'JWT_REFRESH_EXPIRESIN',
      ) ?? '30d'
    );
  }

  /**
   * 确保用户存在。
   * @param user 用户。
   * @param message 消息对象。
   * @returns 返回用户文档。
   */
  private ensureUserExists(
    user: UserDocument | null,
    message: string,
  ): UserDocument {
    if (!user) {
      throw new UnauthorizedException(message);
    }

    return user;
  }

  /**
   * 断言用户处于启用状态。
   * @param user 用户。
   * @param message 消息对象。
   * @returns 无返回值。
   */
  private assertUserIsActive(user: UserDocument, message: string): void {
    if (user.status !== UserStatus.Active) {
      throw new UnauthorizedException(message);
    }
  }

  /**
   * 转换用户资料。
   * @param user 用户。
   * @returns 返回用户资料。
   */
  private toUserProfile(user: UserDocument): UserProfile {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      lastLoginAt: user.lastLoginAt,
    };
  }
}
