import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseFilePipeBuilder,
  Post,
  Query,
  Request,
  StreamableFile,
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
import { ParseObjectIdPipe } from 'src/common/pipes/parse-object-id.pipe';
import type { UserRequest } from 'src/users/types/users.types';
import { DocumentsService } from './documents.service';
import { CreateEditorDocumentDto } from './dto/create-editor-document.dto';
import { ListDocumentsQueryDto } from './dto/list-documents-query.dto';
import { RemoveDocumentsDto } from './dto/remove-documents.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';

const maxUploadFileSize = 5 * 1024 * 1024;
const supportedUploadFilePattern = /\.(md|pdf|txt|docx)$/i;

const buildContentDisposition = (fileName: string): string => {
  const asciiFileName = fileName.replace(/[^\x20-\x7E]+/g, '_') || 'wen-dang';

  return `attachment; filename="${asciiFileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
};

/**
 * 负责文档相关接口处理的控制器。
 */
@ApiTags('文档')
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
  @ApiOperation({ summary: '上传文档并建立索引' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['knowledgeBaseId', 'files'],
      properties: {
        knowledgeBaseId: {
          type: 'string',
          description: '知识库 ID',
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
  @ApiOkResponse({ description: '文档上传成功' })
  @ApiBadRequestResponse({
    description: '请求参数不合法或文件格式不支持',
  })
  @ApiUnauthorizedResponse({ description: '未提供有效访问令牌' })
  @UseInterceptors(
    FilesInterceptor('files', undefined, {
      limits: {
        fileSize: maxUploadFileSize,
      },
      fileFilter: (_req, file, callback) => {
        if (!supportedUploadFilePattern.test(file.originalname)) {
          callback(
            new BadRequestException('仅支持上传 md、pdf、txt、docx 格式文件'),
            false,
          );
          return;
        }

        callback(null, true);
      },
    }),
  )
  upload(
    @Request() req: UserRequest,
    @UploadedFiles(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({
          maxSize: maxUploadFileSize,
          errorMessage: '上传文件大小不能超过 5MB',
        })
        .build({
          fileIsRequired: true,
        }),
    )
    files: Array<Express.Multer.File>,
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
  @ApiOperation({ summary: '创建在线文档并建立索引' })
  @ApiBody({ type: CreateEditorDocumentDto })
  @ApiOkResponse({ description: '在线文档创建成功' })
  @ApiBadRequestResponse({ description: '请求参数不合法' })
  @ApiUnauthorizedResponse({ description: '未提供有效访问令牌' })
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
  @ApiOperation({ summary: '分页获取文档列表' })
  @ApiQuery({ name: 'page', required: false, description: '页码', example: 1 })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    description: '每页数量',
    example: 10,
  })
  @ApiQuery({
    name: 'knowledgeBaseId',
    required: false,
    description: '知识库 ID',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiQuery({
    name: 'keyword',
    required: false,
    description: '搜索关键词',
    example: '使用说明',
  })
  @ApiOkResponse({ description: '文档列表获取成功' })
  @ApiBadRequestResponse({ description: '查询参数不合法' })
  @ApiUnauthorizedResponse({ description: '未提供有效访问令牌' })
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
  @ApiOperation({ summary: '下载原始文档' })
  @ApiParam({ name: 'id', description: '文档 ID' })
  @ApiProduces('application/octet-stream')
  @ApiOkResponse({ description: '文档下载成功' })
  @ApiBadRequestResponse({ description: '文档 ID 格式错误' })
  @ApiUnauthorizedResponse({ description: '未提供有效访问令牌' })
  @ApiNotFoundResponse({ description: '文档或原始文件不存在' })
  async download(
    @Request() req: UserRequest,
    @Param('id', ParseObjectIdPipe) id: string,
  ): Promise<StreamableFile> {
    const file = await this.documentsService.download(req.user.userId, id);

    return new StreamableFile(file.content, {
      type: file.mimeType,
      disposition: buildContentDisposition(file.fileName),
      length: file.content.length,
    });
  }

  /**
   * 查询单个文档详情。
   * @param req 当前请求对象，用于读取登录用户信息。
   * @param id 需要查询的文档 ID。
   * @returns 返回对应的文档详情。
   */
  @Get(':id')
  @ApiOperation({ summary: '获取文档详情' })
  @ApiParam({ name: 'id', description: '文档 ID' })
  @ApiOkResponse({ description: '文档详情获取成功' })
  @ApiBadRequestResponse({ description: '文档 ID 格式错误' })
  @ApiUnauthorizedResponse({ description: '未提供有效访问令牌' })
  @ApiNotFoundResponse({ description: '文档不存在' })
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
  @ApiOperation({ summary: '批量删除文档' })
  @ApiBody({ type: RemoveDocumentsDto })
  @ApiOkResponse({ description: '文档批量删除成功' })
  @ApiBadRequestResponse({ description: '请求参数不合法' })
  @ApiUnauthorizedResponse({ description: '未提供有效访问令牌' })
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
  @ApiOperation({ summary: '删除单个文档' })
  @ApiParam({ name: 'id', description: '文档 ID' })
  @ApiOkResponse({ description: '文档删除成功' })
  @ApiBadRequestResponse({ description: '文档 ID 格式错误' })
  @ApiUnauthorizedResponse({ description: '未提供有效访问令牌' })
  @ApiNotFoundResponse({ description: '文档不存在' })
  remove(
    @Request() req: UserRequest,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    return this.documentsService.remove(req.user.userId, id);
  }
}
