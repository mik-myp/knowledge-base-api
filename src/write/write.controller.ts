import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Request,
  Res,
} from '@nestjs/common';
import { WriteService } from './write.service';
import type { Response } from 'express';

import type { UserRequest } from 'src/users/types/users.types';
import { StartWriteDto } from './dto/start-write.dto';

@Controller('write')
export class WriteController {
  constructor(private readonly writeService: WriteService) {}

  @Post('/start')
  start(
    @Request() req: UserRequest,
    @Body() startWriteDto: StartWriteDto,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const subscription = this.writeService
      .start(req.user.userId, startWriteDto)
      .subscribe({
        next: (chunk) => {
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        },
        error: (error: Error) => {
          res.write(
            `data: ${JSON.stringify({
              content: '',
              error: error.message || '本次写作处理失败，请稍后重试',
              done: true,
            })}\n\n`,
          );
          res.end();
        },
        complete: () => {
          res.end();
        },
      });

    res.on('close', () => {
      subscription.unsubscribe();
    });
  }
}
