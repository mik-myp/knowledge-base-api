import { IsIn, IsOptional, IsString } from 'class-validator';
import {
  ChatMessageType,
  type ChatRequestMessageRole,
} from '../types/chat.types';

export class AskChatMessageDto {
  @IsIn([ChatMessageType.System, ChatMessageType.Human, ChatMessageType.Tool])
  role: ChatRequestMessageRole;

  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  toolCallId?: string;
}
