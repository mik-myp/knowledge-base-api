import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class UpdateChatSessionDto {
  @ApiProperty({
    description: 'New session title.',
    example: 'Updated session title',
  })
  @IsString()
  title: string;
}
