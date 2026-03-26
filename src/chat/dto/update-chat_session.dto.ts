import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * 定义更新对话会话的 DTO 结构。
 */
export class UpdateChatSessionDto {
  /**
   * 保存标题。
   */
  @ApiProperty({
    description: '新的会话标题',
    example: '更新后的会话标题',
  })
  @IsString()
  @MinLength(1, {
    message: 'title 不能为空',
  })
  @MaxLength(50, {
    message: 'title 长度不能超过 50 个字符',
  })
  title: string;
}
