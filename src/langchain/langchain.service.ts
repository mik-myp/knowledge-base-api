import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * 统一创建对话模型和向量模型实例。
 */
@Injectable()
export class LangchainService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * 获取嵌入模型批处理大小。
   * @returns 返回限制后的批处理数量。
   */
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

  /**
   * 创建问答使用的聊天模型实例。
   * @returns 返回配置好的 `ChatOpenAI` 实例。
   */
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

  /**
   * 创建向量嵌入模型实例。
   * @returns 返回配置好的 `OpenAIEmbeddings` 实例。
   */
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
