import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Request,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { ParseObjectIdPipe } from 'src/common/pipes/parse-object-id.pipe';
import type { UserRequest } from 'src/users/types/users.types';
import { DocumentsService } from './documents.service';
import { CreateEditorDocumentDto } from './dto/create-editor-document.dto';
import { ListDocumentsQueryDto } from './dto/list-documents-query.dto';
import { RemoveDocumentsDto } from './dto/remove-documents.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';

const buildContentDisposition = (fileName: string): string => {
  const asciiFileName = fileName.replace(/[^\x20-\x7E]+/g, '_') || 'document';

  return `attachment; filename="${asciiFileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
};

@ApiTags('documents')
@ApiBearerAuth()
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload document files and build indexes' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['knowledgeBaseId', 'files'],
      properties: {
        knowledgeBaseId: {
          type: 'string',
          description: 'Knowledge base id',
          example: '507f1f77bcf86cd799439011',
        },
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
      },
    },
  })
  @ApiOkResponse({ description: 'Documents uploaded successfully' })
  @ApiBadRequestResponse({
    description: 'Payload is invalid or file type is not supported',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @UseInterceptors(FilesInterceptor('files'))
  upload(
    @Request() req: UserRequest,
    @UploadedFiles() files: Array<Express.Multer.File>,
    @Body() uploadDocument: UploadDocumentDto,
  ) {
    return this.documentsService.upload(req.user.userId, files, uploadDocument);
  }

  @Post('editor')
  @ApiOperation({ summary: 'Create an editor document and build indexes' })
  @ApiBody({ type: CreateEditorDocumentDto })
  @ApiOkResponse({ description: 'Editor document created successfully' })
  @ApiBadRequestResponse({ description: 'Payload is invalid' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  createEditorDocument(
    @Request() req: UserRequest,
    @Body() body: CreateEditorDocumentDto,
  ) {
    return this.documentsService.createEditorDocument(req.user.userId, body);
  }

  @Get()
  @ApiOperation({ summary: 'List documents with pagination' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, example: 10 })
  @ApiQuery({
    name: 'knowledgeBaseId',
    required: false,
    example: '507f1f77bcf86cd799439011',
  })
  @ApiQuery({ name: 'keyword', required: false, example: 'guide' })
  @ApiOkResponse({ description: 'Document list loaded successfully' })
  @ApiBadRequestResponse({ description: 'Query params are invalid' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  findAll(@Request() req: UserRequest, @Query() query: ListDocumentsQueryDto) {
    return this.documentsService.findAll(req.user.userId, query);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Download the original document file' })
  @ApiParam({ name: 'id', description: 'Document id' })
  @ApiProduces('application/octet-stream')
  @ApiOkResponse({ description: 'Document downloaded successfully' })
  @ApiBadRequestResponse({ description: 'Document id format is invalid' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiNotFoundResponse({ description: 'Document or original file not found' })
  async download(
    @Request() req: UserRequest,
    @Param('id', ParseObjectIdPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.documentsService.download(req.user.userId, id);

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader(
      'Content-Disposition',
      buildContentDisposition(file.fileName),
    );
    res.send(file.content);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get document detail' })
  @ApiParam({ name: 'id', description: 'Document id' })
  @ApiOkResponse({ description: 'Document detail loaded successfully' })
  @ApiBadRequestResponse({ description: 'Document id format is invalid' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiNotFoundResponse({ description: 'Document not found' })
  findOne(
    @Request() req: UserRequest,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    return this.documentsService.findOne(req.user.userId, id);
  }

  @Delete('all')
  @ApiOperation({ summary: 'Delete multiple documents' })
  @ApiBody({ type: RemoveDocumentsDto })
  @ApiOkResponse({ description: 'Documents deleted successfully' })
  @ApiBadRequestResponse({ description: 'Payload is invalid' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  removeAll(@Request() req: UserRequest, @Body() body: RemoveDocumentsDto) {
    return this.documentsService.removeByDocumentIds(
      req.user.userId,
      body.documentIds,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a single document' })
  @ApiParam({ name: 'id', description: 'Document id' })
  @ApiOkResponse({ description: 'Document deleted successfully' })
  @ApiBadRequestResponse({ description: 'Document id format is invalid' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiNotFoundResponse({ description: 'Document not found' })
  remove(
    @Request() req: UserRequest,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    return this.documentsService.remove(req.user.userId, id);
  }
}
