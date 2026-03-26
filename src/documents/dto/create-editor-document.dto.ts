import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * 定义创建Editor文档的 DTO 结构。
 */
export class CreateEditorDocumentDto {
  /**
   * 保存知识库 ID。
   */
  @ApiProperty({
    description: '文档归属的知识库 ID',
    example: '507f1f77bcf86cd799439013',
  })
  @IsMongoId({ message: 'knowledgeBaseId 必须是合法 ObjectId' })
  knowledgeBaseId: string;

  /**
   * 保存名称。
   */
  @ApiProperty({
    description: '编辑器文档标题',
    example: 'NestJS 鉴权设计',
  })
  @IsString({ message: 'name 必须是字符串' })
  @MinLength(1, {
    message: 'name 不能为空',
  })
  @MaxLength(200, {
    message: 'name 长度不能超过 200',
  })
  name: string;

  /**
   * 保存内容。
   */
  @ApiProperty({
    description: 'Markdown 原文',
    example: '# 标题\n\n这是正文',
  })
  @IsString({ message: 'content 必须是字符串' })
  @MinLength(1, {
    message: 'content 不能为空',
  })
  content: string;
}
