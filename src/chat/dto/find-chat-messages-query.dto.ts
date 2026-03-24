import { IsMongoId } from 'class-validator';

export class FindChatMessagesQueryDto {
  @IsMongoId({ message: 'sessionId 必须是合法 ObjectId' })
  sessionId: string;
}
