import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  Res,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
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
import { ChatService } from './chat.service';
import { AskChatDto } from './dto/ask-chat.dto';
import { CreateChatSessionDto } from './dto/create-chat_session.dto';
import { FindChatMessagesQueryDto } from './dto/find-chat-messages-query.dto';
import { UpdateChatSessionDto } from './dto/update-chat_session.dto';
/**
 * 负责对话相关接口处理的控制器。
 */
@ApiTags('对话')
@ApiBearerAuth()
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /**
   * 创建新的对话会话。
   * @param req 当前请求对象，用于读取登录用户信息。
   * @param createChatDto 创建会话的请求参数。
   * @returns 返回新建后的会话记录。
   */
  @Post('/sessions')
  @ApiOperation({ summary: '创建对话会话' })
  @ApiBody({ type: CreateChatSessionDto })
  @ApiOkResponse({ description: '会话创建成功' })
  @ApiUnauthorizedResponse({ description: '未提供有效访问令牌' })
  createSession(
    @Request() req: UserRequest,
    @Body() createChatDto: CreateChatSessionDto,
  ) {
    return this.chatService.createSession(req.user.userId, createChatDto);
  }

  /**
   * 获取当前用户的全部会话。
   * @param req 当前请求对象，用于读取登录用户信息。
   * @returns 返回当前用户的会话列表。
   */
  @Get('/sessions')
  @ApiOperation({ summary: '获取当前用户的会话列表' })
  @ApiOkResponse({ description: '会话列表获取成功' })
  @ApiUnauthorizedResponse({ description: '未提供有效访问令牌' })
  findAllSession(@Request() req: UserRequest) {
    return this.chatService.findAllSession(req.user.userId);
  }

  /**
   * 更新指定会话的标题。
   * @param req 当前请求对象，用于读取登录用户信息。
   * @param id 需要更新的会话 ID。
   * @param updateChatDto 会话更新参数。
   * @returns 返回更新后的会话记录。
   */
  @Patch('/sessions/:id')
  @ApiOperation({ summary: '修改会话标题' })
  @ApiParam({ name: 'id', description: '会话 ID' })
  @ApiBody({ type: UpdateChatSessionDto })
  @ApiOkResponse({ description: '会话更新成功' })
  @ApiBadRequestResponse({
    description: '会话 ID 格式错误或标题不合法',
  })
  @ApiUnauthorizedResponse({ description: '未提供有效访问令牌' })
  updateSession(
    @Request() req: UserRequest,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() updateChatDto: UpdateChatSessionDto,
  ) {
    return this.chatService.updateSession(req.user.userId, id, updateChatDto);
  }

  /**
   * 删除指定会话及其关联消息。
   * @param req 当前请求对象，用于读取登录用户信息。
   * @param id 需要删除的会话 ID。
   * @returns 返回被删除的会话记录。
   */
  @Delete('/sessions/:id')
  @ApiOperation({ summary: '删除会话' })
  @ApiParam({ name: 'id', description: '会话 ID' })
  @ApiOkResponse({ description: '会话及其消息已删除' })
  @ApiBadRequestResponse({ description: '会话 ID 格式错误' })
  @ApiUnauthorizedResponse({ description: '未提供有效访问令牌' })
  removeSession(
    @Request() req: UserRequest,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    return this.chatService.removeSession(req.user.userId, id);
  }

  /**
   * 以 SSE 方式推送问答生成过程。
   * @param req 当前请求对象，用于读取登录用户信息。
   * @param askDto 问答请求参数。
   * @param res Express 响应对象，用于持续写出流式结果。
   * @returns 响应结束前不返回额外数据。
   */
  @Post('/ask-stream')
  @ApiOperation({ summary: '发起流式问答' })
  @ApiBody({ type: AskChatDto })
  @ApiProduces('text/event-stream')
  @ApiOkResponse({
    description:
      '返回 text/event-stream，每个事件的数据字段都是一个 JSON 数据块。',
  })
  @ApiBadRequestResponse({ description: '请求参数不合法' })
  @ApiUnauthorizedResponse({ description: '未提供有效访问令牌' })
  askStream(
    @Request() req: UserRequest,
    @Body() askDto: AskChatDto,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const subscription = this.chatService
      .askStream(req.user.userId, askDto)
      .subscribe({
        next: (chunk) => {
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        },
        error: (error: Error) => {
          res.destroy(error);
        },
        complete: () => {
          res.end();
        },
      });

    res.on('close', () => {
      subscription.unsubscribe();
    });
  }

  /**
   * 查询指定会话的消息列表。
   * @param req 当前请求对象，用于读取登录用户信息。
   * @param query 查询参数，包含会话 ID。
   * @returns 返回该会话的消息记录列表。
   */
  @Get('/messages')
  @ApiOperation({ summary: '获取会话消息列表' })
  @ApiQuery({
    name: 'sessionId',
    description: '会话 ID',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiOkResponse({ description: '消息列表获取成功' })
  @ApiBadRequestResponse({ description: '会话 ID 格式错误' })
  @ApiUnauthorizedResponse({ description: '未提供有效访问令牌' })
  findMessages(
    @Request() req: UserRequest,
    @Query() query: FindChatMessagesQueryDto,
  ) {
    return this.chatService.findMessages(req.user.userId, query);
  }
}
