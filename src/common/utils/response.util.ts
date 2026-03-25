import { HttpStatus } from '@nestjs/common';

/**
 * 描述统一成功响应体的基础结构。
 */
export type SuccessResponse<T> = {
  code: number;
  message: string;
  data: T;
  timestamp: string;
};

/**
 * 提供统一响应结构的构造方法。
 */
export class ResponseUtil {
  /**
   * 构建标准成功响应。
   * @param data 业务返回数据。
   * @param message 响应提示信息。
   * @param code 响应状态码。
   * @returns 返回统一格式的成功响应对象。
   */
  static success<T = any>(
    data: T,
    message: string = '操作成功',
    code: number = HttpStatus.OK,
  ) {
    return {
      code,
      message,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 构建标准错误响应。
   * @param message 错误提示信息。
   * @param code 响应状态码。
   * @param data 附带的错误上下文数据。
   * @returns 返回统一格式的错误响应对象。
   */
  static error(
    message: string = '操作失败',
    code: number = HttpStatus.BAD_REQUEST,
    data: any = null,
  ) {
    return {
      code,
      message,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 构建带分页信息的成功响应。
   * @param data 当前页的数据列表。
   * @param pagination 分页元数据。
   * @param pagination.page 当前页码。
   * @param pagination.limit 每页条数。
   * @param pagination.total 总记录数。
   * @param pagination.totalPages 总页数。
   * @param message 响应提示信息。
   * @param code 响应状态码。
   * @returns 返回包含分页信息的统一响应对象。
   */
  static paginated<T = any>(
    data: T[],
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    },
    message: string = '查询成功',
    code: number = HttpStatus.OK,
  ) {
    return {
      code,
      message,
      data,
      pagination,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 构建列表查询响应。
   * @param data 结果列表。
   * @param message 响应提示信息。
   * @param code 响应状态码。
   * @returns 返回统一格式的列表响应对象。
   */
  static list<T = any>(
    data: T[],
    message: string = '查询成功',
    code: number = HttpStatus.OK,
  ) {
    return {
      code,
      message,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 构建空结果响应。
   * @param message 响应提示信息。
   * @param code 响应状态码。
   * @returns 返回 `data` 为空的统一响应对象。
   */
  static empty(message: string = '暂无数据', code: number = HttpStatus.OK) {
    return {
      code,
      message,
      data: null,
      timestamp: new Date().toISOString(),
    };
  }
}
