import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { API_CONSTRAINTS, trimStringValue } from 'src/contracts/api-contracts';

/**
 * 定义更新对话会话的 DTO 结构。
 */
export class UpdateChatSessionDto {
  /**
   * 保存标题。
   */
  @ApiProperty({
    description: 'New session title.',
    example: 'Updated session title',
  })
  @Transform(({ value }) => trimStringValue(value))
  @IsString()
  @MinLength(API_CONSTRAINTS.chat.sessionTitleMinLength, {
    message: 'title 不能为空',
  })
  @MaxLength(API_CONSTRAINTS.chat.sessionTitleMaxLength, {
    message: 'title 长度不能超过 50 个字符',
  })
  title: string;
}
