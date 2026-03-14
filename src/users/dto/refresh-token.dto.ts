import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    description: '用于刷新 accessToken 的 refreshToken',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxx.yyy',
    maxLength: 2000,
  })
  @IsString()
  @IsNotEmpty({ message: 'refreshToken 不能为空' })
  @MaxLength(2000, { message: 'refreshToken 长度异常' })
  refreshToken: string;
}
