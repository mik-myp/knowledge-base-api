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

  private s3Client: S3Client;

  private s3BucketName: string;

  constructor(private configService: ConfigService) {
    const awsEndPoint = this.configService.getOrThrow<string>('AWS_EMD_POINT');

    const awsAccessKeyId =
      this.configService.getOrThrow<string>('AWS_ACCESS_KEY_ID');

    const awsSecretAccessKey = this.configService.getOrThrow<string>(
      'AWS_SECRET_ACCESS_KEY',
    );

    this.s3BucketName = this.configService.getOrThrow<string>('S3_BUCKET_NAME');

    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: awsEndPoint,
      credentials: {
        accessKeyId: awsAccessKeyId,
        secretAccessKey: awsSecretAccessKey,
      },
    });
  }

  async uploadFile(
    file: Express.Multer.File,
    floder?: string,
  ): Promise<string> {
    const key = (floder ? floder : '') + `${Date.now()} - ${file.originalname}`;
    const command = new PutObjectCommand({
      Bucket: this.s3BucketName,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    });

    await this.s3Client.send(command);

    return key;
  }

  async deleteFile(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.s3BucketName,
      Key: key,
    });
    await this.s3Client.send(command);
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.s3BucketName,
      Key: key,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn });
  }
}
