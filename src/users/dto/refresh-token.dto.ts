import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { API_CONSTRAINTS, trimStringValue } from 'src/contracts/api-contracts';

/**
 * 定义刷新令牌的 DTO 结构。
 */
export class RefreshTokenDto {
  /**
   * 保存刷新令牌。
   */
  @ApiProperty({
    description: '用于刷新 accessToken 的 refreshToken',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxx.yyy',
    maxLength: API_CONSTRAINTS.user.refreshTokenMaxLength,
  })
  @Transform(({ value }) => trimStringValue(value))
  @IsString()
  @IsNotEmpty({ message: 'refreshToken 不能为空' })
  @MaxLength(API_CONSTRAINTS.user.refreshTokenMaxLength, {
    message: 'refreshToken 长度异常',
  })
  refreshToken: string;
}
