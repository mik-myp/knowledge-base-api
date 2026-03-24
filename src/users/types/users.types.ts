export type BaseJwtTokenPayload = {
  userId: string;
  email: string;
};

export type AccessTokenPayload = BaseJwtTokenPayload & {
  tokenType: 'access';
};

export type RefreshTokenPayload = BaseJwtTokenPayload & {
  tokenType: 'refresh';
  jti: string;
};

export type UserProfile = {
  id: string;
  email: string;
  username: string;
  lastLoginAt?: Date;
};

export type TokenPairResult = {
  user: UserProfile;
  accessToken: string;
  refreshToken: string;
};

export type LogoutResult = {
  success: boolean;
};

export type JwtTokenPayload = AccessTokenPayload | RefreshTokenPayload;

export type AuthenticatedUser = {
  userId: string;
  email: string;
  tokenType: 'access';
};

export type UserRequest = {
  user: AuthenticatedUser;
};

export const isJwtTokenPayload = (value: unknown): value is JwtTokenPayload => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  if (
    typeof candidate.userId !== 'string' ||
    typeof candidate.email !== 'string'
  ) {
    return false;
  }

  if (candidate.tokenType === 'access') {
    return true;
  }

  return (
    candidate.tokenType === 'refresh' &&
    typeof candidate.jti === 'string' &&
    candidate.jti.length > 0
  );
};

export const isRefreshTokenPayload = (
  value: unknown,
): value is RefreshTokenPayload => {
  return isJwtTokenPayload(value) && value.tokenType === 'refresh';
};
