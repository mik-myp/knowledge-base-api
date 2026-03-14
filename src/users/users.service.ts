import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import bcrypt from 'bcryptjs';
import { Model } from 'mongoose';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { User, UserDocument } from './schemas/user.schema';
import {
  isJwtTokenPayload,
  type JwtTokenPayload,
  type LogoutResult,
  type TokenPairResult,
  type UserProfile,
} from './users';

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

    return this.issueTokenPair(user, { touchLastLoginAt: true });
  }

  async refresh(refreshTokenDto: RefreshTokenDto): Promise<TokenPairResult> {
    const payload = await this.verifyRefreshToken(refreshTokenDto.refreshToken);

    const user = await this.userModel.findById(payload.userId);

    if (!user || !user.refreshToken) {
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
    const user = await this.userModel.findById(userId);

    if (!user) {
      throw new UnauthorizedException('登录状态已失效，请重新登录');
    }

    user.refreshToken = undefined;
    await user.save();

    return {
      success: true,
    };
  }

  async me(userId: string): Promise<UserProfile> {
    const user = await this.userModel.findById(userId);

    if (!user) {
      throw new UnauthorizedException('登录状态已失效，请重新登录');
    }

    return this.toUserProfile(user);
  }

  private async issueTokenPair(
    user: UserDocument,
    options: { touchLastLoginAt?: boolean } = {},
  ): Promise<TokenPairResult> {
    if (options.touchLastLoginAt) {
      user.lastLoginAt = new Date();
    }

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync({
        userId: user.id,
        email: user.email,
        tokenType: 'access',
      }),
      this.jwtService.signAsync(
        {
          userId: user.id,
          email: user.email,
          tokenType: 'refresh',
        },
        {
          expiresIn:
            this.configService.get<JwtSignOptions['expiresIn']>(
              'JWT_SECRET_REFRESH_EXPIRESIN',
            ) ?? '30d',
        },
      ),
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

  private createTokenPayload(
    user: UserDocument,
    tokenType: JwtTokenPayload['tokenType'],
  ): JwtTokenPayload {
    return {
      userId: user.id,
      email: user.email,
      tokenType,
    };
  }

  private async signToken(
    payload: JwtTokenPayload,
    expiresIn: NonNullable<JwtSignOptions['expiresIn']>,
  ): Promise<string> {
    return this.jwtService.signAsync(payload, {
      expiresIn,
    });
  }

  private async verifyRefreshToken(token: string): Promise<JwtTokenPayload> {
    try {
      const payload: unknown = await this.jwtService.verifyAsync(token);

      if (!isJwtTokenPayload(payload) || payload.tokenType !== 'refresh') {
        throw new UnauthorizedException('refreshToken 无效或已过期');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('refreshToken 无效或已过期');
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
