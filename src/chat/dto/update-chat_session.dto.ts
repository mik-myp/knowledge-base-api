import { IsString } from 'class-validator';

export class UpdateChatSessionDto {
  @IsString()
  title: string;
}
