import {
  Controller,
  Post,
  Body,
  Request,
  UploadedFile,
  UseInterceptors,
  Get,
  Query,
} from '@nestjs/common';
import { DocumnetsService } from './documnets.service';

import type { UserRequest } from 'src/users/users';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { ListDocumentsQueryDto } from './dto/list-documents-query.dto';

@Controller('documnets')
export class DocumnetsController {
  constructor(private readonly documnetsService: DocumnetsService) {}

  @Post('/upload')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @Request() req: { user: { userId: string } },
    @UploadedFile() file: Express.Multer.File,
    @Body() uploadDocument: { knowledgeBaseId: string },
  ) {
    return this.documnetsService.upload(req.user.userId, file, uploadDocument);
  }

  @Get('all')
  findAllDocuments(
    @Request() req: UserRequest,
    @Query() query: ListDocumentsQueryDto,
  ) {
    return this.documnetsService.findAllDocuments(req.user.userId, query);
  }

  // @Get('allByKnowledgeId')
  // findAllDocumentsByKnowledgeId(
  //   @Request() req: UserRequest,
  //   @Query()
  //   query: {
  //     knowledgeBaseId: string;
  //   },
  // ) {
  //   return this.documnetsService.findAllDocumentsByKnowledgeId(
  //     req.user.userId,
  //     query.knowledgeBaseId,
  //   );
  // }

  // @Get(':id')
  // findOne(@Request() req: UserRequest, @Param('id') id: string) {
  //   return this.documnetsService.findOne(req.user.userId, id);
  // }

  // @Patch(':id')
  // update(
  //   @Request() req: UserRequest,
  //   @Param('id') id: string,
  //   @Body() updateDocumnetDto: UpdateDocumnetDto,
  // ) {
  //   return this.documnetsService.update(req.user.userId, id, updateDocumnetDto);
  // }

  // @Delete(':id')
  // remove(@Request() req: UserRequest, @Param('id') id: string) {
  //   return this.documnetsService.remove(req.user.userId, id);
  // }
}
