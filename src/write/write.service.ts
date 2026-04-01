import {
  BadRequestException,
  GatewayTimeoutException,
  Injectable,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { StartWriteDto } from './dto/start-write.dto';
import { StartWriteStreamChunk } from './types/write.types';
import { LangchainService } from 'src/langchain/langchain.service';
import { DocumentIndexingService } from 'src/documents/document-indexing.service';

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

  private buildSystemPrompt(startWriteDto: StartWriteDto) {
    const { articleType, creativity, language, length, tone, topic } =
      startWriteDto;

    return [
      '你是一个写作专家。',
      '请根据提供的写作主题、内容类型、语言、语气风格、篇幅长度，生成内容。',
      `写作主题：${articleType}，`,
      `内容类型：${language}，`,
      `语言：${language}，`,
      `语气风格：${language}，`,
      `篇幅长度：${language}，`,
    ];
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

        const systemPrompt = this.buildSystemPrompt(startWriteDto);
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
