import { Injectable } from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';
import { Document, DocumentDocument } from './schemas/documnet.schema';
import { Model } from 'mongoose';
import { UploadDocumentDto } from './dto/upload-document.dto';

@Injectable()
export class DocumnetsService {
  constructor(
    @InjectModel(Document.name)
    private readonly documentModel: Model<DocumentDocument>,
  ) {}

  async upload(
    userId: string,
    file: Express.Multer.File,
    uploadDocument: UploadDocumentDto,
  ) {
    console.log(userId, file, uploadDocument);
  }
  // create(createDocumnetDto: CreateDocumnetDto) {
  //   return 'This action adds a new documnet';
  // }
  // findAll() {
  //   return `This action returns all documnets`;
  // }
  // findOne(id: number) {
  //   return `This action returns a #${id} documnet`;
  // }
  // update(id: number, updateDocumnetDto: UpdateDocumnetDto) {
  //   return `This action updates a #${id} documnet`;
  // }
  // remove(id: number) {
  //   return `This action removes a #${id} documnet`;
  // }
}
