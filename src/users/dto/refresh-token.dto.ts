import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * 定义刷新令牌的 DTO 结构。
 */
export class RefreshTokenDto {
  /**
   * 保存刷新令牌。
   */
  @ApiProperty({
    description: '用于刷新访问令牌的刷新令牌',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxx.yyy',
    maxLength: 2000,
  })
  @IsString()
  @IsNotEmpty({ message: 'refreshToken 不能为空' })
  @MaxLength(2000, {
    message: 'refreshToken 长度异常',
  })
  refreshToken: string;
}
