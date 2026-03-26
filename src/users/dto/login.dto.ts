import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * 定义登录的 DTO 结构。
 */
export class LoginDto {
  /**
   * 保存用户邮箱。
   */
  @ApiProperty({
    description: '用户邮箱',
    example: 'alice@example.com',
    maxLength: 100,
  })
  @IsEmail({}, { message: '请输入合法邮箱' })
  @MaxLength(100, {
    message: '邮箱长度不能超过 100 个字符',
  })
  email: string;

  /**
   * 保存用户密码。
   */
  @ApiProperty({
    description: '登录密码',
    example: '12345678',
    minLength: 8,
    maxLength: 32,
  })
  @IsString()
  @MinLength(8, {
    message: '密码至少 8 位',
  })
  @MaxLength(32, {
    message: '密码长度不能超过 32 位',
  })
  password: string;
}
