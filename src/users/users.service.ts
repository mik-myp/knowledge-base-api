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

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

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

  async logout(userId: string): Promise<LogoutResult> {
    const user = await this.getActiveUserByIdOrThrow(userId);

    user.refreshToken = undefined;
    await user.save();

    return {
      success: true,
    };
  }

  async me(userId: string): Promise<UserProfile> {
    const user = await this.getActiveUserByIdOrThrow(userId);

    return this.toUserProfile(user);
  }

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

  private createAccessTokenPayload(user: UserDocument): AccessTokenPayload {
    return {
      userId: user.id,
      email: user.email,
      tokenType: 'access',
    };
  }

  private createRefreshTokenPayload(user: UserDocument): RefreshTokenPayload {
    return {
      userId: user.id,
      email: user.email,
      tokenType: 'refresh',
      jti: randomUUID(),
    };
  }

  private async signAccessToken(payload: AccessTokenPayload): Promise<string> {
    return this.jwtService.signAsync(payload);
  }

  private async signRefreshToken(
    payload: RefreshTokenPayload,
  ): Promise<string> {
    return this.jwtService.signAsync(payload, {
      secret: this.getRefreshTokenSecret(),
      expiresIn: this.getRefreshTokenExpiresIn(),
    });
  }

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

  private getRefreshTokenSecret(): string {
    return (
      this.configService.get<string>('JWT_REFRESH_SECRET') ??
      'knowledge-base-api-refresh'
    );
  }

  private getRefreshTokenExpiresIn(): NonNullable<JwtSignOptions['expiresIn']> {
    return (
      this.configService.get<JwtSignOptions['expiresIn']>(
        'JWT_REFRESH_EXPIRESIN',
      ) ?? '30d'
    );
  }

  private ensureUserExists(
    user: UserDocument | null,
    message: string,
  ): UserDocument {
    if (!user) {
      throw new UnauthorizedException(message);
    }

    return user;
  }

  private assertUserIsActive(user: UserDocument, message: string): void {
    if (user.status !== UserStatus.Active) {
      throw new UnauthorizedException(message);
    }
  }

  private toUserProfile(user: UserDocument): UserProfile {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      lastLoginAt: user.lastLoginAt,
    };
  }
}
