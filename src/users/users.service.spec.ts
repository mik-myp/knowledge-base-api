import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import { UsersService } from './users.service';
import { UserDocument, UserStatus } from './schemas/user.schema';

type MockUserModel = {
  findById: jest.Mock;
};

const createUserDocument = (): UserDocument => {
  return {
    id: '507f1f77bcf86cd799439011',
    email: 'alice@example.com',
    username: 'Alice',
    status: UserStatus.Active,
    refreshToken: undefined,
    lastLoginAt: undefined,
    save: jest.fn().mockResolvedValue(undefined),
  } as unknown as UserDocument;
};

describe('UsersService', () => {
  let service: UsersService;
  let userModel: MockUserModel;
  let jwtService: jest.Mocked<Pick<JwtService, 'signAsync' | 'verifyAsync'>>;
  let configService: jest.Mocked<Pick<ConfigService, 'get'>>;

  beforeEach(() => {
    userModel = {
      findById: jest.fn(),
    };

    jwtService = {
      signAsync: jest.fn(async (payload: Record<string, unknown>, options) => {
        const tokenType = String(payload.tokenType);
        const tokenId =
          typeof payload.jti === 'string' ? payload.jti : 'access-token';
        const secret =
          typeof options?.secret === 'string'
            ? options.secret
            : 'default-secret';

        return `${tokenType}:${tokenId}:${secret}`;
      }),
      verifyAsync: jest.fn(),
    };

    configService = {
      get: jest.fn((key: string) => {
        switch (key) {
          case 'JWT_REFRESH_SECRET':
            return 'refresh-secret';
          case 'JWT_REFRESH_EXPIRESIN':
            return '30d';
          default:
            return undefined;
        }
      }),
    };

    service = new UsersService(
      userModel as never,
      jwtService as never,
      configService as never,
    );
  });

  it('rotates refresh tokens with a unique jti and dedicated secret', async () => {
    const user = createUserDocument();
    user.refreshToken = await bcrypt.hash('refresh-token-1', 10);

    userModel.findById.mockResolvedValue(user);
    jwtService.verifyAsync.mockResolvedValue({
      userId: user.id,
      email: user.email,
      tokenType: 'refresh',
      jti: 'existing-refresh-jti',
    });

    const firstResult = await service.refresh({
      refreshToken: 'refresh-token-1',
    });

    user.refreshToken = await bcrypt.hash(firstResult.refreshToken, 10);

    const secondResult = await service.refresh({
      refreshToken: firstResult.refreshToken,
    });

    const refreshCalls = jwtService.signAsync.mock.calls.filter(([payload]) => {
      return payload.tokenType === 'refresh';
    });

    expect(userModel.findById).toHaveBeenNthCalledWith(
      1,
      expect.any(Types.ObjectId),
    );
    expect(userModel.findById).toHaveBeenNthCalledWith(
      2,
      expect.any(Types.ObjectId),
    );
    expect(userModel.findById.mock.calls[0]?.[0].toHexString()).toBe(user.id);
    expect(userModel.findById.mock.calls[1]?.[0].toHexString()).toBe(user.id);
    expect(firstResult.refreshToken).not.toBe(secondResult.refreshToken);
    expect(refreshCalls).toHaveLength(2);
    expect(refreshCalls[0]?.[0].jti).not.toBe(refreshCalls[1]?.[0].jti);
    expect(refreshCalls[0]?.[1]).toMatchObject({
      secret: 'refresh-secret',
      expiresIn: '30d',
    });
  });

  it('rejects refresh when the user is disabled', async () => {
    const user = createUserDocument();
    user.status = UserStatus.Disabled;
    user.refreshToken = await bcrypt.hash('refresh-token-1', 10);

    userModel.findById.mockResolvedValue(user);
    jwtService.verifyAsync.mockResolvedValue({
      userId: user.id,
      email: user.email,
      tokenType: 'refresh',
      jti: 'existing-refresh-jti',
    });

    await expect(
      service.refresh({ refreshToken: 'refresh-token-1' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
