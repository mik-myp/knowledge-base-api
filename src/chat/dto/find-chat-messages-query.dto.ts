import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsMongoId } from 'class-validator';
import { trimStringValue } from 'src/contracts/api-contracts';

/**
 * 定义查询对话消息查询参数的 DTO 结构。
 */
export class FindChatMessagesQueryDto {
  /**
   * 保存会话 ID。
   */
  @ApiProperty({
    description: 'Session id.',
    example: '507f1f77bcf86cd799439011',
  })
  @Transform(({ value }) => trimStringValue(value))
  @IsMongoId({ message: 'sessionId 必须是合法 ObjectId' })
  sessionId: string;
}
