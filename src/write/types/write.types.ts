export enum ArticleType {
  BLOG = 'blog',
  SUMMARY = 'summary',
  REPORT = 'report',
  PRODUCT = 'product',
  STORY = 'story',
  EMAIL = 'email',
}

export enum Language {
  ENGLISH = 'english',
  CHINESE = 'chinese',
}

export enum Length {
  SHORT = 'short',
  MEDIUM = 'medium',
  LONG = 'long',
}

export enum Tone {
  FORMAL = 'formal',
  PERSUASIVE = 'persuasive',
  FRIENDLY = 'friendly',
  PROFESSIONAL = 'professional',
}

export type StartWriteStreamChunk = {
  content: string;
  progress?: string;
  error?: string;
  done?: boolean;
};
