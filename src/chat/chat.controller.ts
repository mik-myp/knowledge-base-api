import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Request,
  Query,
  Res,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { CreateChatSessionDto } from './dto/create-chat_session.dto';
import { UpdateChatSessionDto } from './dto/update-chat_session.dto';
import type { UserRequest } from 'src/users/types/users.types';
import { AskChatDto } from './dto/ask-chat.dto';
import { FindChatMessagesQueryDto } from './dto/find-chat-messages-query.dto';
import type { Response } from 'express';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('/sessions')
  createSession(
    @Request() req: UserRequest,
    @Body() createChatDto: CreateChatSessionDto,
  ) {
    return this.chatService.createSession(req.user.userId, createChatDto);
  }

  @Get('/sessions')
  findAllSession(@Request() req: UserRequest) {
    return this.chatService.findAllSession(req.user.userId);
  }

  @Patch('/sessions/:id')
  updateSession(
    @Request() req: UserRequest,
    @Param('id') id: string,
    @Body() updateChatDto: UpdateChatSessionDto,
  ) {
    return this.chatService.updateSession(req.user.userId, id, updateChatDto);
  }

  @Delete('/sessions/:id')
  removeSession(@Request() req: UserRequest, @Param('id') id: string) {
    return this.chatService.removeSession(req.user.userId, id);
  }

  @Post('/ask')
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
  findMessages(
    @Request() req: UserRequest,
    @Query() query: FindChatMessagesQueryDto,
  ) {
    return this.chatService.findMessages(req.user.userId, query);
  }

  @Get('/history/messages')
  findHistoryMessages(
    @Request() req: UserRequest,
    @Query() query: FindChatMessagesQueryDto,
  ) {
    return this.chatService.findMessages(req.user.userId, query);
  }
}
