import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    description: '用户邮箱',
    example: 'alice@example.com',
    maxLength: 100,
  })
  @IsEmail({}, { message: '请输入合法邮箱' })
  @MaxLength(100, { message: '邮箱长度不能超过 100 个字符' })
  email: string;

  @ApiProperty({
    description: '登录密码',
    example: '12345678',
    minLength: 8,
    maxLength: 32,
  })
  @IsString()
  @MinLength(8, { message: '密码至少 8 位' })
  @MaxLength(32, { message: '密码长度不能超过 32 个字符' })
  password: string;

  @ApiProperty({
    description: '用户昵称',
    example: 'Alice',
    minLength: 2,
    maxLength: 30,
  })
  @IsString()
  @MinLength(2, { message: '昵称至少 2 位' })
  @MaxLength(30, { message: '昵称长度不能超过 30 个字符' })
  username: string;
}
