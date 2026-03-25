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

/**
 * 构建下载响应头中的 `Content-Disposition` 字段。
 * @param fileName 原始文件名。
 * @returns 返回兼容 ASCII 和 UTF-8 文件名的响应头值。
 */
const buildContentDisposition = (fileName: string): string => {
  const asciiFileName = fileName.replace(/[^\x20-\x7E]+/g, '_') || 'document';

  return `attachment; filename="${asciiFileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
};

/**
 * 负责文档相关接口处理的控制器。
 */
@ApiTags('documents')
@ApiBearerAuth()
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  /**
   * 上传文档并触发索引构建。
   * @param req 当前请求对象，用于读取登录用户信息。
   * @param files 用户上传的文件列表。
   * @param uploadDocument 上传参数，包含目标知识库 ID。
   * @returns 返回上传成功后的文档记录列表。
   */
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

  /**
   * 创建在线编辑文档并同步建立索引。
   * @param req 当前请求对象，用于读取登录用户信息。
   * @param body 编辑器文档的标题、内容和所属知识库信息。
   * @returns 返回新建后的文档记录。
   */
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

  /**
   * 分页查询当前用户的文档列表。
   * @param req 当前请求对象，用于读取登录用户信息。
   * @param query 查询参数，包含分页、知识库筛选和关键字。
   * @returns 返回文档列表和总数。
   */
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

  /**
   * 下载指定文档的原始文件内容。
   * @param req 当前请求对象，用于读取登录用户信息。
   * @param id 需要下载的文档 ID。
   * @param res Express 响应对象，用于写回文件流。
   * @returns 文件发送完成后不返回额外数据。
   */
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

  /**
   * 查询单个文档详情。
   * @param req 当前请求对象，用于读取登录用户信息。
   * @param id 需要查询的文档 ID。
   * @returns 返回对应的文档详情。
   */
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

  /**
   * 批量删除文档。
   * @param req 当前请求对象，用于读取登录用户信息。
   * @param body 删除参数，包含需要删除的文档 ID 列表。
   * @returns 返回批量删除结果。
   */
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

  /**
   * 删除单个文档。
   * @param req 当前请求对象，用于读取登录用户信息。
   * @param id 需要删除的文档 ID。
   * @returns 返回被删除的文档记录。
   */
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
