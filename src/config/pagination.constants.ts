/**
 * 通用分页和 API 相关常量
 */

export const PAGINATION_DEFAULTS = {
  // 通用分页默认值
  DEFAULT_LIMIT: 20,
  DEFAULT_OFFSET: 0,
  MAX_LIMIT: 100,
} as const;

export const API_STATUS_CODES = {
  // HTTP 状态码
  OK: 0,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_ERROR: 500,
} as const;

// 常用错误消息
export const ERROR_MESSAGES = {
  UNAUTHORIZED: '请先登录',
  NOT_FOUND: '资源不存在',
  BAD_REQUEST: '请求参数错误',
  INTERNAL_ERROR: '服务器内部错误',
} as const;
