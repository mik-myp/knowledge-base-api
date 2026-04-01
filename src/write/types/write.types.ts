export enum ArticleType {
  BLOG = 'blog',
  SUMMARY = 'summary',
  REPORT = 'report',
  PRODUCT = 'product',
  STORY = 'story',
  EMAIL = 'email',
}

export const ArticleMap = {
  blog: '博客文章',
  summary: '摘要总结',
  report: '技术报告',
  product: '产品介绍',
  story: '故事创作',
  email: '邮件',
};

export enum Language {
  ENGLISH = 'english',
  CHINESE = 'chinese',
}

export const LanguageMap = {
  english: '英文',
  chinese: '中文',
};

export enum Length {
  SHORT = 'short',
  MEDIUM = 'medium',
  LONG = 'long',
}

export const LengthMap = {
  short: '短篇',
  medium: '中篇',
  long: '长篇',
};

export enum Tone {
  FORMAL = 'formal',
  PERSUASIVE = 'persuasive',
  FRIENDLY = 'friendly',
  PROFESSIONAL = 'professional',
}

export const ToneMap = {
  formal: '正式',
  persuasive: '说服型',
  friendly: '友好',
  professional: '专业',
};

export type StartWriteStreamChunk = {
  content: string;
  progress?: string;
  error?: string;
  done?: boolean;
};
