/**
 * 定义基础Jwt令牌载荷的类型结构。
 */
export type BaseJwtTokenPayload = {
  userId: string;
  email: string;
};

/**
 * 定义访问令牌载荷的类型结构。
 */
export type AccessTokenPayload = BaseJwtTokenPayload & {
  tokenType: 'access';
};

/**
 * 定义刷新令牌载荷的类型结构。
 */
export type RefreshTokenPayload = BaseJwtTokenPayload & {
  tokenType: 'refresh';
  jti: string;
};

/**
 * 定义用户资料的类型结构。
 */
export type UserProfile = {
  id: string;
  email: string;
  username: string;
  lastLoginAt?: Date;
};

/**
 * 定义令牌对的结果结构。
 */
export type TokenPairResult = {
  user: UserProfile;
  accessToken: string;
  refreshToken: string;
};

/**
 * 定义退出登录的结果结构。
 */
export type LogoutResult = {
  success: boolean;
};

/**
 * 表示系统支持的 JWT 载荷联合类型。
 */
export type JwtTokenPayload = AccessTokenPayload | RefreshTokenPayload;

/**
 * 描述认证通过后挂载到请求对象上的用户信息。
 */
export type AuthenticatedUser = {
  userId: string;
  email: string;
  tokenType: 'access';
};

/**
 * 定义用户请求的类型结构。
 */
export type UserRequest = {
  user: AuthenticatedUser;
};

/**
 * 判断值是否为 JWT 载荷。
 * @param value 待处理的值。
 * @returns 返回布尔值，表示是否满足Jwt令牌载荷。
 */
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

/**
 * 判断值是否为刷新令牌载荷。
 * @param value 待处理的值。
 * @returns 返回布尔值，表示是否满足刷新令牌载荷。
 */
export const isRefreshTokenPayload = (
  value: unknown,
): value is RefreshTokenPayload => {
  return isJwtTokenPayload(value) && value.tokenType === 'refresh';
};
