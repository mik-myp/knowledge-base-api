import {
  Controller,
  Post,
  Body,
  Request,
  UseInterceptors,
  Get,
  Query,
  Delete,
  Param,
  UploadedFiles,
} from '@nestjs/common';
import { DocumentsService } from './documents.service';

import type { UserRequest } from 'src/users/types/users.types';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ListDocumentsQueryDto } from './dto/list-documents-query.dto';
import { ParseObjectIdPipe } from 'src/common/pipes/parse-object-id.pipe';
import { CreateEditorDocumentDto } from './dto/create-editor-document.dto';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('upload')
  @UseInterceptors(FilesInterceptor('files'))
  upload(
    @Request() req: UserRequest,
    @UploadedFiles() files: Array<Express.Multer.File>,
    @Body() uploadDocument: UploadDocumentDto,
  ) {
    return this.documentsService.upload(req.user.userId, files, uploadDocument);
  }

  @Post('editor')
  createEditorDocument(
    @Request() req: UserRequest,
    @Body() body: CreateEditorDocumentDto,
  ) {
    return this.documentsService.createEditorDocument(req.user.userId, body);
  }

  @Get()
  findAll(@Request() req: UserRequest, @Query() query: ListDocumentsQueryDto) {
    return this.documentsService.findAll(req.user.userId, query);
  }

  @Get(':id')
  findOne(
    @Request() req: UserRequest,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    return this.documentsService.findOne(req.user.userId, id);
  }

  @Delete('all')
  removeAll(
    @Request() req: UserRequest,
    @Body()
    body: {
      documentIds: string[];
    },
  ) {
    return this.documentsService.removeByDocumentIds(
      req.user.userId,
      body.documentIds,
    );
  }

  @Delete(':id')
  remove(
    @Request() req: UserRequest,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    return this.documentsService.remove(req.user.userId, id);
  }
}
