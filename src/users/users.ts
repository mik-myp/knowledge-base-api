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

export type JwtTokenPayload = {
  userId: string;
  email: string;
  tokenType: 'access' | 'refresh';
};

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

  return (
    typeof candidate.userId === 'string' &&
    typeof candidate.email === 'string' &&
    (candidate.tokenType === 'access' || candidate.tokenType === 'refresh')
  );
};
