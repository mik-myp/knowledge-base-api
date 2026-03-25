/*
https://docs.nestjs.com/interceptors#interceptors
*/

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpStatus,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * 描述统一响应拦截器输出的数据结构。
 */
export interface ResponseFormat<T = any> {
  code: number;
  message: string;
  data: T;
  timestamp: string;
  path: string;
}

/**
 * 将控制器返回值包装成统一响应格式。
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ResponseFormat<T>
> {
  /**
   * 拦截控制器响应并补充统一字段。
   * @param context 当前执行上下文。
   * @param next 后续处理器。
   * @returns 返回统一格式的响应流。
   */
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ResponseFormat<T>> {
    const ctx = context.switchToHttp();
    const _response = ctx.getResponse();
    const request = ctx.getRequest();

    return next.handle().pipe(
      map((data) => {
        // 处理空数据
        if (data === null || data === undefined) {
          return {
            code: HttpStatus.OK,
            message: '操作成功',
            data: null,
            timestamp: new Date().toISOString(),
            path: request.url,
          };
        }

        // 如果返回的数据已经是标准格式，直接返回
        if (
          data &&
          typeof data === 'object' &&
          'code' in data &&
          'message' in data
        ) {
          return {
            ...data,
            timestamp: new Date().toISOString(),
            path: request.url,
          };
        }

        // 标准成功响应格式
        return {
          code: HttpStatus.OK,
          message: '操作成功',
          data: data,
          timestamp: new Date().toISOString(),
          path: request.url,
        };
      }),
    );
  }
}
