import { IsIn, IsNumber, IsString, Max, Min } from 'class-validator';
import { ArticleType, Language, Length, Tone } from '../types/write.types';

export class StartWriteDto {
  @IsString()
  topic: string;

  @IsIn([
    ArticleType.BLOG,
    ArticleType.SUMMARY,
    ArticleType.REPORT,
    ArticleType.STORY,
    ArticleType.PRODUCT,
    ArticleType.EMAIL,
  ])
  articleType: string;

  @IsIn([Language.CHINESE, Language.ENGLISH])
  language: string;

  @IsIn([Tone.FORMAL, Tone.FRIENDLY, Tone.PERSUASIVE, Tone.PROFESSIONAL])
  tone: string;

  @IsIn([Length.LONG, Length.MEDIUM, Length.SHORT])
  length: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  creativity: number;
}
