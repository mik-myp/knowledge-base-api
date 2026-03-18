import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { UsersService } from '../../users/users.service';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let configService: jest.Mocked<Pick<ConfigService, 'get'>>;
  let usersService: jest.Mocked<Pick<UsersService, 'getActiveUserByIdOrThrow'>>;

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'JWT_ACCESS_SECRET') {
          return 'access-secret';
        }

        return undefined;
      }),
    };

    usersService = {
      getActiveUserByIdOrThrow: jest.fn(),
    };

    strategy = new JwtStrategy(configService as never, usersService as never);
  });

  it('loads the latest active user before accepting an access token', async () => {
    usersService.getActiveUserByIdOrThrow.mockResolvedValue({
      id: 'user-1',
      email: 'alice@example.com',
    } as never);

    const result = await strategy.validate({
      userId: 'stale-user-id',
      email: 'stale@example.com',
      tokenType: 'access',
    });

    expect(usersService.getActiveUserByIdOrThrow).toHaveBeenCalledWith(
      'stale-user-id',
    );
    expect(result).toEqual({
      userId: 'user-1',
      email: 'alice@example.com',
      tokenType: 'access',
    });
  });

  it('rejects refresh token payloads on protected routes', async () => {
    await expect(
      strategy.validate({
        userId: 'user-1',
        email: 'alice@example.com',
        tokenType: 'refresh',
        jti: 'refresh-jti',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
