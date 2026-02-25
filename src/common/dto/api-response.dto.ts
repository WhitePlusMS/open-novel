/**
 * 通用 API 响应类型
 */

// 基础响应接口
export interface ApiResponse<T = unknown> {
  code: number;
  data: T | null;
  message: string;
}

// 成功响应（code: 0）
export function createSuccessResponse<T>(data: T, message = '操作成功'): ApiResponse<T> {
  return {
    code: 0,
    data,
    message,
  };
}

// 错误响应
export function createErrorResponse(code: number, message: string): ApiResponse {
  return {
    code,
    data: null,
    message,
  };
}

// 常用错误响应工厂
export const ApiErrors = {
  unauthorized(message = '请先登录'): ApiResponse {
    return createErrorResponse(401, message);
  },

  forbidden(message = '无权限'): ApiResponse {
    return createErrorResponse(403, message);
  },

  notFound(message = '资源不存在'): ApiResponse {
    return createErrorResponse(404, message);
  },

  badRequest(message = '请求参数错误'): ApiResponse {
    return createErrorResponse(400, message);
  },

  internalError(message = '服务器内部错误'): ApiResponse {
    return createErrorResponse(500, message);
  },
} as const;

// 分页响应
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function createPaginatedResponse<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number
): PaginatedResponse<T> {
  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}
