import {
  BadRequestException,
  GatewayTimeoutException,
  Injectable,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { StartWriteDto } from './dto/start-write.dto';
import {
  StartWriteStreamChunk,
  ArticleMap,
  LanguageMap,
  LengthMap,
  ToneMap,
} from './types/write.types';
import { LangchainService } from 'src/langchain/langchain.service';
import { DocumentIndexingService } from 'src/documents/document-indexing.service';
import { PromptTemplate } from '@langchain/core/prompts';
import { AIMessageChunk } from 'langchain';

@Injectable()
export class WriteService {
  constructor(
    private readonly langchainService: LangchainService,
    private readonly documentIndexingService: DocumentIndexingService,
  ) {}
  /**
   * 解析流式错误消息。
   * @param error 错误对象。
   * @returns 返回字符串结果。
   */
  private resolveStreamErrorMessage(error: unknown): string {
    if (error instanceof GatewayTimeoutException) {
      const timeoutMessage = error.message?.trim();
      return timeoutMessage || '请求超时，请稍后重试';
    }

    if (error instanceof BadRequestException) {
      const message = error.message?.trim();
      return message || '请求参数错误，请稍后重试';
    }

    if (error instanceof Error && error.message.trim()) {
      return error.message.trim();
    }

    return '本次写作处理失败，请稍后重试';
  }

  /**
   * 从模型返回内容中提取纯文本。
   * @param content 模型返回的原始内容结构。
   * @returns 返回拼接后的文本字符串。
   */
  private extractModelText(content: unknown) {
    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      return content
        .map((item) => {
          if (typeof item === 'string') {
            return item;
          }

          if (
            item &&
            typeof item === 'object' &&
            'text' in item &&
            typeof item.text === 'string'
          ) {
            return item.text;
          }

          return '';
        })
        .join('');
    }

    return '';
  }

  private buildSystemPrompt() {
    return `
    你是一个写作专家。
    请根据提供的写作主题、内容类型、语言、语气风格、篇幅长度，生成内容。
    1. 写作主题：{topic}
    2. 内容类型：{articleType}
    3. 语言：{language}
    4. 语气风格：{tone}
    5. 篇幅长度：{length}
    返回的内容，请必须以Markdown语法格式返回。
  `;
  }

  start(
    userId: string,
    startWriteDto: StartWriteDto,
  ): Observable<StartWriteStreamChunk> {
    return new Observable((subscriber) => {
      let cancelled = false;
      let progressTimer: ReturnType<typeof setInterval> | undefined;
      let progressIndex = 0;
      const abortController = new AbortController();

      const stopProgressHeartbeat = (): void => {
        if (progressTimer) {
          clearInterval(progressTimer);
          progressTimer = undefined;
        }
      };

      const emitProgress = (progress: string): void => {
        if (cancelled) {
          return;
        }

        subscriber.next({
          content: '',
          progress,
          done: false,
        });
      };

      const startProgressHeartbeat = (progressMessages: string[]): void => {
        stopProgressHeartbeat();
        progressIndex = 0;

        progressTimer = setInterval(() => {
          const nextProgress =
            progressMessages[progressIndex % progressMessages.length];

          progressIndex += 1;
          emitProgress(nextProgress);
        }, 1500);
      };

      void (async () => {
        if (cancelled) {
          return;
        }

        emitProgress('开始写作');
        startProgressHeartbeat([
          '正在理解写作要求',
          '正在组织文章结构',
          '正在生成 Markdown 草稿',
        ]);

        const prompt = PromptTemplate.fromTemplate(this.buildSystemPrompt());

        const model = this.langchainService.createChatModel(
          startWriteDto.creativity,
        );

        const chain = prompt.pipe(model);

        const stream = await chain.stream(
          {
            topic: startWriteDto.topic,
            articleType: ArticleMap[startWriteDto.articleType],
            language: LanguageMap[startWriteDto.language],
            tone: ToneMap[startWriteDto.tone],
            length: LengthMap[startWriteDto.length],
          },
          {
            signal: abortController.signal,
          },
        );
        let content = '';
        let fullMessage: AIMessageChunk | undefined;

        for await (const chunk of stream) {
          if (cancelled) {
            stopProgressHeartbeat();
            return;
          }

          if (!fullMessage) {
            fullMessage = chunk;
          } else {
            fullMessage = fullMessage.concat(chunk);
          }

          content = this.extractModelText(fullMessage.content);

          if (content) {
            stopProgressHeartbeat();
          }

          subscriber.next({
            content,
            done: false,
          });
        }

        const normalizedContent = content.trim() || '未获取到有效回答';
        stopProgressHeartbeat();

        if (cancelled) {
          return;
        }
        subscriber.next({
          content: normalizedContent,
          progress: '',
          done: true,
        });
        subscriber.complete();
      })().catch((error: unknown) => {
        stopProgressHeartbeat();

        if (cancelled) {
          return;
        }

        const errorMessage = this.resolveStreamErrorMessage(error);

        subscriber.next({
          content: '',
          error: errorMessage,
          progress: '',
          done: true,
        });
        subscriber.complete();
      });

      return () => {
        cancelled = true;
        abortController.abort();
        stopProgressHeartbeat();
      };
    });
  }
}
