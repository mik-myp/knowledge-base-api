import { OpenAIEmbeddings } from '@langchain/openai';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongoDBAtlasVectorSearch } from '@langchain/mongodb';
import { MongoClient } from 'mongodb';
import { TEXT_UPLOAD_EXTENSIONS } from './documents.service';
import { Document } from 'langchain';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import mammoth from 'mammoth';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

@Injectable()
export class DocumentIndexingService {
  private mongoClient;
  constructor(private readonly configService: ConfigService) {
    this.mongoClient = new MongoClient(
      this.configService.get<string>('MONGODB_URI') || '',
    );
  }

  private getVectorCollectionName() {
    return this.configService.get<string>('MONGODB_VECTOR_COLLECTION') || '';
  }

  private getVectorIndexName() {
    return this.configService.get<string>('MONGODB_VECTOR_INDEX') || '';
  }

  private createEmbeddings() {
    return new OpenAIEmbeddings({
      model: this.configService.get<string>('OPENAI_EMBEDDING_MODEL'),
      apiKey: this.configService.get<string>('OPENAI_EMBEDDING_API_KEY'),
      configuration: {
        baseURL: this.configService.get<string>('OPENAI_EMBEDDING_BASE_URL'),
      },
    });
  }

  private createVectorStore() {
    const collection = this.mongoClient
      .db('knowledge')
      .collection(this.getVectorCollectionName());

    return new MongoDBAtlasVectorSearch(this.createEmbeddings(), {
      collection,
      indexName: this.getVectorIndexName(),
      textKey: 'text',
      embeddingKey: 'embedding',
    });
  }

  private async loadSourceDocuments(params: {
    userId: string;
    knowledgeBaseId: string;
    documentId: string;
    documentName: string;
    extension: string;
    content?: string;
    file?: Express.Multer.File;
  }) {
    if (TEXT_UPLOAD_EXTENSIONS.has(params.extension)) {
      return [
        new Document({
          pageContent: params.content ?? '',
          metadata: {
            userId: params.userId,
            knowledgeBaseId: params.knowledgeBaseId,
            documentId: params.documentId,
            documentName: params.documentName,
          },
        }),
      ];
    }
    if (params.extension === 'pdf') {
      if (!params.file) {
        throw new BadRequestException('pdf 文件缺少原始内容');
      }

      const loader = new PDFLoader(
        new Blob([params.file.buffer], { type: 'application/pdf' }),
        { splitPages: true },
      );

      return loader.load();
    }

    if (params.extension === 'docx') {
      if (!params.file) {
        throw new BadRequestException('docx 文件缺少原始内容');
      }

      const result = await mammoth.extractRawText({
        buffer: params.file.buffer,
      });

      return [
        new Document({
          pageContent: result.value,
          metadata: {
            userId: params.userId,
            knowledgeBaseId: params.knowledgeBaseId,
            documentId: params.documentId,
            documentName: params.documentName,
          },
        }),
      ];
    }

    if (params.extension === 'doc') {
      throw new BadRequestException('当前仅支持解析 docx，请先转换为 docx');
    }
    return [];
  }

  private async splitDocuments(documents: Document[]) {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    return splitter.splitDocuments(documents);
  }
}
