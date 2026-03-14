import {
  Query,
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Request,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ParseObjectIdPipe } from 'src/common/pipes/parse-object-id.pipe';
import { KnowledgeBasesService } from './knowledge_bases.service';
import { CreateKnowledgeBaseDto } from './dto/create-knowledge_base.dto';
import { ListKnowledgeBasesQueryDto } from './dto/list-knowledge-bases-query.dto';
import { UpdateKnowledgeBaseDto } from './dto/update-knowledge_base.dto';
import type { UserRequest } from 'src/users/users';
import type {
  KnowledgeBaseListResult,
  KnowledgeBaseRecord,
} from './knowledge_bases';

@ApiTags('knowledge-bases')
@ApiBearerAuth()
@Controller('knowledge-bases')
export class KnowledgeBasesController {
  constructor(private readonly knowledgeBasesService: KnowledgeBasesService) {}

  @Post()
  @ApiOperation({ summary: '创建知识库' })
  @ApiBody({ type: CreateKnowledgeBaseDto })
  @ApiOkResponse({ description: '知识库创建成功' })
  @ApiUnauthorizedResponse({ description: '未提供有效 accessToken' })
  create(
    @Request() req: UserRequest,
    @Body() createKnowledgeBaseDto: CreateKnowledgeBaseDto,
  ): Promise<KnowledgeBaseRecord> {
    return this.knowledgeBasesService.create(
      req.user.userId,
      createKnowledgeBaseDto,
    );
  }

  @Get()
  @ApiOperation({ summary: '获取当前用户的知识库列表' })
  @ApiQuery({
    name: 'page',
    required: false,
    description: '页码，从 1 开始。',
    example: 1,
  })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    description: '每页数量，最大 50。',
    example: 10,
  })
  @ApiOkResponse({ description: '知识库列表获取成功' })
  @ApiUnauthorizedResponse({ description: '未提供有效 accessToken' })
  findAll(
    @Request() req: UserRequest,
    @Query() query: ListKnowledgeBasesQueryDto,
  ): Promise<KnowledgeBaseListResult> {
    return this.knowledgeBasesService.findAll(req.user.userId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取当前用户的单个知识库详情' })
  @ApiParam({ name: 'id', description: '知识库 ID' })
  @ApiOkResponse({ description: '知识库详情获取成功' })
  @ApiUnauthorizedResponse({ description: '未提供有效 accessToken' })
  @ApiBadRequestResponse({ description: '知识库 ID 格式错误' })
  @ApiNotFoundResponse({ description: '知识库不存在' })
  findOne(
    @Request() req: UserRequest,
    @Param('id', ParseObjectIdPipe) id: string,
  ): Promise<KnowledgeBaseRecord> {
    return this.knowledgeBasesService.findOne(req.user.userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新当前用户的知识库信息' })
  @ApiParam({ name: 'id', description: '知识库 ID' })
  @ApiBody({ type: UpdateKnowledgeBaseDto })
  @ApiOkResponse({ description: '知识库更新成功' })
  @ApiUnauthorizedResponse({ description: '未提供有效 accessToken' })
  @ApiBadRequestResponse({ description: '知识库 ID 格式错误' })
  @ApiNotFoundResponse({ description: '知识库不存在' })
  update(
    @Request() req: UserRequest,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() updateKnowledgeBaseDto: UpdateKnowledgeBaseDto,
  ): Promise<KnowledgeBaseRecord> {
    return this.knowledgeBasesService.update(
      req.user.userId,
      id,
      updateKnowledgeBaseDto,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除当前用户的知识库' })
  @ApiParam({ name: 'id', description: '知识库 ID' })
  @ApiOkResponse({ description: '知识库删除成功' })
  @ApiUnauthorizedResponse({ description: '未提供有效 accessToken' })
  @ApiBadRequestResponse({ description: '知识库 ID 格式错误' })
  @ApiNotFoundResponse({ description: '知识库不存在' })
  remove(
    @Request() req: UserRequest,
    @Param('id', ParseObjectIdPipe) id: string,
  ): Promise<KnowledgeBaseRecord> {
    return this.knowledgeBasesService.remove(req.user.userId, id);
  }
}
