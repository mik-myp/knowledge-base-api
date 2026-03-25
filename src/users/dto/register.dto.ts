import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { API_CONSTRAINTS, trimStringValue } from 'src/contracts/api-contracts';

/**
 * 定义注册的 DTO 结构。
 */
export class RegisterDto {
  /**
   * 保存用户邮箱。
   */
  @ApiProperty({
    description: '用户邮箱',
    example: 'alice@example.com',
    maxLength: API_CONSTRAINTS.user.emailMaxLength,
  })
  @Transform(({ value }) => trimStringValue(value))
  @IsEmail({}, { message: '请输入合法邮箱' })
  @MaxLength(API_CONSTRAINTS.user.emailMaxLength, {
    message: '邮箱长度不能超过 100 个字符',
  })
  email: string;

  /**
   * 保存用户密码。
   */
  @ApiProperty({
    description: '登录密码',
    example: '12345678',
    minLength: API_CONSTRAINTS.user.passwordMinLength,
    maxLength: API_CONSTRAINTS.user.passwordMaxLength,
  })
  @Transform(({ value }) => trimStringValue(value))
  @IsString()
  @MinLength(API_CONSTRAINTS.user.passwordMinLength, {
    message: '密码至少 8 位',
  })
  @MaxLength(API_CONSTRAINTS.user.passwordMaxLength, {
    message: '密码长度不能超过 32 个字符',
  })
  password: string;

  /**
   * 保存用户名。
   */
  @ApiProperty({
    description: '用户昵称',
    example: 'Alice',
    minLength: API_CONSTRAINTS.user.usernameMinLength,
    maxLength: API_CONSTRAINTS.user.usernameMaxLength,
  })
  @Transform(({ value }) => trimStringValue(value))
  @IsString()
  @MinLength(API_CONSTRAINTS.user.usernameMinLength, {
    message: '昵称至少 2 位',
  })
  @MaxLength(API_CONSTRAINTS.user.usernameMaxLength, {
    message: '昵称长度不能超过 30 个字符',
  })
  username: string;
}
