import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateEditorDocumentDto {
  @ApiProperty({
    description: '文档归属的知识库 ID',
    example: '507f1f77bcf86cd799439013',
  })
  @IsMongoId({ message: 'knowledgeBaseId 必须是合法 ObjectId' })
  knowledgeBaseId: string;

  @ApiProperty({
    description: '编辑器文档标题',
    example: 'NestJS 鉴权设计',
  })
  @IsString({ message: 'name 必须是字符串' })
  @MinLength(1, { message: 'name 不能为空' })
  @MaxLength(200, { message: 'name 长度不能超过 200' })
  name: string;

  @ApiProperty({
    description: 'Markdown 原文',
    example: '# 标题\n\n这是正文',
  })
  @IsString({ message: 'content 必须是字符串' })
  @MinLength(1, { message: 'content 不能为空' })
  content: string;
}
