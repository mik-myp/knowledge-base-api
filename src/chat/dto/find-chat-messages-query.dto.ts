import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId } from 'class-validator';

/**
 * 定义查询对话消息查询参数的 DTO 结构。
 */
export class FindChatMessagesQueryDto {
  /**
   * 保存会话 ID。
   */
  @ApiProperty({
    description: '会话 ID',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId({ message: 'sessionId 必须是合法的 ObjectId' })
  sessionId: string;
}
