import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: '请输入合法邮箱' })
  @MaxLength(100, { message: '邮箱长度不能超过 100 个字符' })
  email: string;

  @IsString()
  @MinLength(8, { message: '密码至少 8 位' })
  @MaxLength(32, { message: '密码长度不能超过 32 位' })
  password: string;
}
