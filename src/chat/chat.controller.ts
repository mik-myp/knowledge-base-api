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

@ApiTags('chat')
@ApiBearerAuth()
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('/sessions')
  @ApiOperation({ summary: 'Create a chat session' })
  @ApiBody({ type: CreateChatSessionDto })
  @ApiOkResponse({ description: 'Session created successfully' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  createSession(
    @Request() req: UserRequest,
    @Body() createChatDto: CreateChatSessionDto,
  ) {
    return this.chatService.createSession(req.user.userId, createChatDto);
  }

  @Get('/sessions')
  @ApiOperation({ summary: 'List current user chat sessions' })
  @ApiOkResponse({ description: 'Session list loaded successfully' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  findAllSession(@Request() req: UserRequest) {
    return this.chatService.findAllSession(req.user.userId);
  }

  @Patch('/sessions/:id')
  @ApiOperation({ summary: 'Rename a chat session' })
  @ApiParam({ name: 'id', description: 'Session id' })
  @ApiBody({ type: UpdateChatSessionDto })
  @ApiOkResponse({ description: 'Session updated successfully' })
  @ApiBadRequestResponse({
    description: 'Session id format is invalid or title is invalid',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  updateSession(
    @Request() req: UserRequest,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() updateChatDto: UpdateChatSessionDto,
  ) {
    return this.chatService.updateSession(req.user.userId, id, updateChatDto);
  }

  @Delete('/sessions/:id')
  @ApiOperation({ summary: 'Delete a chat session' })
  @ApiParam({ name: 'id', description: 'Session id' })
  @ApiOkResponse({ description: 'Session and its messages were deleted' })
  @ApiBadRequestResponse({ description: 'Session id format is invalid' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  removeSession(
    @Request() req: UserRequest,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    return this.chatService.removeSession(req.user.userId, id);
  }

  @Post('/ask')
  @ApiOperation({ summary: 'Start an AI answer request with SSE streaming' })
  @ApiBody({ type: AskChatDto })
  @ApiProduces('text/event-stream')
  @ApiOkResponse({
    description:
      'Returns text/event-stream. Each event chunk is a JSON payload string.',
  })
  @ApiBadRequestResponse({ description: 'Request payload is invalid' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  ask(
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

  @Get('/messages')
  @ApiOperation({ summary: 'Get messages for a chat session' })
  @ApiQuery({
    name: 'sessionId',
    description: 'Session id',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiOkResponse({ description: 'Messages loaded successfully' })
  @ApiBadRequestResponse({ description: 'sessionId format is invalid' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  findMessages(
    @Request() req: UserRequest,
    @Query() query: FindChatMessagesQueryDto,
  ) {
    return this.chatService.findMessages(req.user.userId, query);
  }

  @Get('/history/messages')
  @ApiOperation({
    summary: 'Get messages for a chat session (legacy route)',
    deprecated: true,
  })
  @ApiQuery({
    name: 'sessionId',
    description: 'Session id',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiOkResponse({ description: 'Messages loaded successfully' })
  @ApiBadRequestResponse({ description: 'sessionId format is invalid' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  findHistoryMessages(
    @Request() req: UserRequest,
    @Query() query: FindChatMessagesQueryDto,
  ) {
    return this.chatService.findMessages(req.user.userId, query);
  }
}
