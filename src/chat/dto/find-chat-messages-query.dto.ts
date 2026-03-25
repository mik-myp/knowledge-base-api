import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId } from 'class-validator';

export class FindChatMessagesQueryDto {
  @ApiProperty({
    description: 'Session id.',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId({ message: 'sessionId 必须是合法 ObjectId' })
  sessionId: string;
}
