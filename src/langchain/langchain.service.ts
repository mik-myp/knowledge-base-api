import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class LangchainService {
  constructor(private readonly configService: ConfigService) {}

  private getEmbeddingBatchSize() {
    const configuredBatchSize = this.configService.get<number>(
      'OPENAI_EMBEDDING_BATCH_SIZE',
    );

    if (
      typeof configuredBatchSize === 'number' &&
      Number.isInteger(configuredBatchSize) &&
      configuredBatchSize > 0
    ) {
      return Math.min(configuredBatchSize, 10);
    }

    return 10;
  }

  createChatModel() {
    return new ChatOpenAI({
      model: this.configService.get<string>('OPENAI_CHAT_MODEL'),
      apiKey: this.configService.get<string>('OPENAI_CHAT_API_KEY'),
      streaming: true,
      configuration: {
        baseURL: this.configService.get<string>('OPENAI_CHAT_BASE_URL'),
      },
    });
  }

  createEmbeddings() {
    return new OpenAIEmbeddings({
      model: this.configService.get<string>('OPENAI_EMBEDDING_MODEL'),
      apiKey: this.configService.get<string>('OPENAI_EMBEDDING_API_KEY'),
      batchSize: this.getEmbeddingBatchSize(),
      configuration: {
        baseURL: this.configService.get<string>('OPENAI_EMBEDDING_BASE_URL'),
      },
    });
  }
}
