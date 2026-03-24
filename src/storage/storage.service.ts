/*
https://docs.nestjs.com/providers#services
*/

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  private s3Client?: S3Client;

  private s3BucketName?: string;

  constructor(private configService: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(
      this.configService.get<string>('AWS_EMD_POINT') &&
      this.configService.get<string>('AWS_ACCESS_KEY_ID') &&
      this.configService.get<string>('AWS_SECRET_ACCESS_KEY') &&
      this.configService.get<string>('S3_BUCKET_NAME'),
    );
  }

  private ensureClient(): { client: S3Client; bucketName: string } {
    if (this.s3Client && this.s3BucketName) {
      return {
        client: this.s3Client,
        bucketName: this.s3BucketName,
      };
    }

    const endpoint = this.configService.get<string>('AWS_EMD_POINT');
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'AWS_SECRET_ACCESS_KEY',
    );
    const bucketName = this.configService.get<string>('S3_BUCKET_NAME');

    if (!endpoint || !accessKeyId || !secretAccessKey || !bucketName) {
      throw new Error('对象存储配置缺失，无法执行文件上传相关操作');
    }

    this.s3Client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    this.s3BucketName = bucketName;

    return {
      client: this.s3Client,
      bucketName: this.s3BucketName,
    };
  }

  async uploadFile(
    file: Express.Multer.File,
    folder?: string,
  ): Promise<string> {
    const { client, bucketName } = this.ensureClient();
    const keyPrefix = folder ? `${folder}/` : '';
    const key = `${keyPrefix}${Date.now()}-${file.originalname}`;
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    });

    await client.send(command);

    return key;
  }

  async deleteFile(key: string): Promise<void> {
    const { client, bucketName } = this.ensureClient();
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    });
    await client.send(command);
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const { client, bucketName } = this.ensureClient();
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    return getSignedUrl(client, command, { expiresIn });
  }

  async downloadFile(
    key: string,
  ): Promise<{ body: Buffer; contentType?: string }> {
    const { client, bucketName } = this.ensureClient();
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });
    const response = await client.send(command);

    if (!response.Body) {
      throw new Error('对象存储文件不存在或内容为空');
    }

    const bytes = await response.Body.transformToByteArray();

    return {
      body: Buffer.from(bytes),
      contentType: response.ContentType,
    };
  }
}
