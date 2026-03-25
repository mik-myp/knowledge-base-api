/*
https://docs.nestjs.com/exception-filters#exception-filters-1
*/

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * 捕获未处理异常并返回统一错误响应。
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  /**
   * 记录异常过滤器中的错误日志。
   */
  private readonly logger = new Logger(AllExceptionsFilter.name);

  /**
   * 捕获异常并写出统一错误响应。
   * @param exception 当前捕获到的异常对象。
   * @param host 当前执行上下文。
   * @returns 响应写出后不返回额外内容。
   */
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = '服务器内部错误';
    let error: any = null;

    // 处理 HttpException
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const responseObj = exceptionResponse as any;
        message = responseObj.message || '请求失败';
        error = responseObj.error || null;
      }
    }
    // 处理其他异常
    else if (exception instanceof Error) {
      message = exception.message || '服务器内部错误';
      this.logger.error(
        `未处理的异常: ${exception.message}`,
        exception.stack,
        'AllExceptionsFilter',
      );
    }

    // 记录错误日志
    this.logger.error(
      `${request.method} ${request.url} - ${status} - ${message}`,
    );

    // 返回统一格式的错误响应
    const errorResponse = {
      code: status,
      message: Array.isArray(message) ? message[0] : message,
      data: null,
      timestamp: new Date().toISOString(),
      path: request.url,
      ...(error && { error }),
    };

    response.status(status).json(errorResponse);
  }
}
