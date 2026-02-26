/**
 * SecondMe API 客户端
 *
 * 封装 SecondMe 平台的所有 API 调用
 * 自动处理 Token 刷新、流式响应、会话管理
 */

import {
  SecondMeUser,
  ChatRequest,
  SoftMemory,
  Shade,
  NoteAddRequest,
  NoteResponse,
  ReaderFeedback,
} from './types';
import { getValidUserToken, refreshAccessToken, saveUserToken } from './token';
import { SECONDME_CONFIG } from './config';
import { prisma } from '@/lib/prisma';

/**
 * 检查是否使用测试 Token
 */
export function isTestMode(): boolean {
  return !!SECONDME_CONFIG.TEST_TOKEN;
}

/**
 * 获取测试 Token（用于测试 API）
 */
export function getTestToken(): string {
  return SECONDME_CONFIG.TEST_TOKEN;
}

export class SecondMeClient {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * 获取有效的 Access Token（测试模式或自动刷新）
   */
  async getValidToken(): Promise<string> {
    // 测试模式：直接返回测试 Token
    if (SECONDME_CONFIG.TEST_TOKEN) {
      console.log('[SecondMeClient] 使用测试 Token');
      return SECONDME_CONFIG.TEST_TOKEN;
    }

    const user = await prisma.user.findUnique({
      where: { id: this.userId },
      select: {
        accessToken: true,
        refreshToken: true,
        tokenExpiresAt: true,
      },
    });

    if (!user || !user.accessToken) {
      throw new Error('User token not found');
    }

    // 如果 Token 即将过期，刷新它
    const expiresIn = user.tokenExpiresAt!.getTime() - Date.now();
    const threshold = SECONDME_CONFIG.TOKEN.REFRESH_THRESHOLD_MINUTES * 60 * 1000;

    if (expiresIn < threshold) {
      console.log('[SecondMeClient] Token expiring soon, refreshing');
      const newTokens = await refreshAccessToken(user.refreshToken!, this.userId);
      await saveUserToken(this.userId, newTokens);
      return newTokens.accessToken;
    }

    return user.accessToken;
  }

  /**
   * 获取用户信息
   */
  async getUserInfo(): Promise<SecondMeUser> {
    const token = await this.getValidToken();

    const response = await fetch(
      `${SECONDME_CONFIG.BASE_URL}${SECONDME_CONFIG.API.USER_INFO}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get user info: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[SecondMeClient] User info fetched');
    return data.data;
  }

  /**
   * 获取用户兴趣标签
   */
  async getShades(): Promise<Shade[]> {
    const token = await this.getValidToken();

    const response = await fetch(
      `${SECONDME_CONFIG.BASE_URL}${SECONDME_CONFIG.API.USER_SHADES}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get shades: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[SecondMeClient] Shades fetched');
    return data.data || [];
  }

  /**
   * 获取用户软记忆
   */
  async getSoftMemory(keyword?: string): Promise<SoftMemory[]> {
    const token = await this.getValidToken();

    const params = new URLSearchParams({
      pageNo: '1',
      pageSize: '20',
    });
    if (keyword) params.append('keyword', keyword);

    const response = await fetch(
      `${SECONDME_CONFIG.BASE_URL}${SECONDME_CONFIG.API.USER_SOFTMEMORY}?${params}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get soft memory: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[SecondMeClient] Soft memory fetched');
    return data.data?.list || [];
  }

  /**
   * 写入笔记/记忆
   */
  async writeNote(request: NoteAddRequest): Promise<NoteResponse> {
    const token = await this.getValidToken();

    const response = await fetch(
      `${SECONDME_CONFIG.BASE_URL}${SECONDME_CONFIG.API.NOTE_ADD}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: request.content,
          title: request.title || 'OpenNovel 创作记录',
          memoryType: request.memoryType || 'TEXT',
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to write note: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[SecondMeClient] Note written');
    return data.data;
  }

  /**
   * 流式发送消息（核心：Agent 对话）
   */
  async *streamChat(request: ChatRequest): AsyncGenerator<string> {
    const token = await this.getValidToken();

    const response = await fetch(
      `${SECONDME_CONFIG.BASE_URL}${SECONDME_CONFIG.API.CHAT_STREAM}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-App-Id': request.appId || 'opennovel',
        },
        body: JSON.stringify({
          message: request.message,
          systemPrompt: request.systemPrompt,
          sessionId: request.sessionId,
          enableWebSearch: request.enableWebSearch || false,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Chat API error: ${response.statusText}`);
    }

    // 解析 SSE 流
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let chunkCount = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        console.log(`[StreamChat] SSE 流结束，共收到 ${chunkCount} 个 chunk`);
        break;
      }

      chunkCount++;
      const lines = decoder.decode(value).split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            console.log(`[StreamChat] 收到 [DONE] 标志，共 ${chunkCount} 个 chunk`);
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) yield content;
          } catch {
            // 忽略解析错误
          }
        }
      }
    }
  }

  /**
   * 发送消息并获取完整响应（非流式）
   */
  async sendChat(request: ChatRequest): Promise<string> {
    let content = '';
    for await (const chunk of this.streamChat(request)) {
      content += chunk;
    }
    return content;
  }

  /**
   * 流式动作判断（用于反馈分析）
   */
  async *streamAction(message: string, actionControl: string): AsyncGenerator<ReaderFeedback> {
    const token = await this.getValidToken();

    const response = await fetch(
      `${SECONDME_CONFIG.BASE_URL}${SECONDME_CONFIG.API.ACT_STREAM}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          actionControl: `${actionControl}\n输出 JSON 对象，不要解释。`,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Act API error: ${response.statusText}`);
    }

    // 解析 JSON 流
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value);

      // 尝试解析完整的 JSON 对象
      try {
        const obj = JSON.parse(buffer);
        yield obj as ReaderFeedback;
        buffer = '';
      } catch {
        // 等待更多数据
        continue;
      }
    }
  }

  /**
   * 发送动作判断并获取完整响应
   */
  async sendAction(message: string, actionControl: string): Promise<ReaderFeedback> {
    let result: ReaderFeedback | null = null;
    for await (const feedback of this.streamAction(message, actionControl)) {
      result = feedback;
    }
    if (!result) {
      throw new Error('No action response received');
    }
    return result;
  }
}

let cachedToken: { userId: string; accessToken: string; expiresAt: number } | null = null;

/**
 * 获取当前登录用户的 Access Token
 * 从数据库中获取当前用户的 Token - 使用 User 表的合并字段
 */
export async function getCurrentUserToken(): Promise<string | null> {
  try {
    const { cookies } = await import('next/headers');
    const authToken = cookies().get('auth_token')?.value;
    let userId = authToken;

    if (!userId) {
      // 查找最后一个有效的 token 对应的用户
      const latestUser = await prisma.user.findFirst({
        where: { tokenIsValid: true },
        orderBy: { updatedAt: 'desc' },
        select: { id: true },
      });

      if (!latestUser) {
        console.log('[Token] 未找到 auth_token cookie');
        return null;
      }

      userId = latestUser.id;
    }

    if (
      cachedToken
      && cachedToken.userId === userId
      && cachedToken.expiresAt - Date.now() > 30_000
    ) {
      return cachedToken.accessToken;
    }

    const token = await getValidUserToken(userId);
    cachedToken = {
      userId,
      accessToken: token.accessToken,
      expiresAt: token.expiresAt.getTime(),
    };
    return token.accessToken;
  } catch (error) {
    console.error('[Token] 获取 Token 失败:', error);
    return null;
  }
}

/**
 * 根据用户 ID 获取用户的 Access Token
 * 用于 Agent 调用 LLM 时使用各自用户的 token
 *
 * @param userId - 用户 ID
 */
export async function getUserTokenById(userId: string): Promise<string | null> {
  try {
    if (
      cachedToken
      && cachedToken.userId === userId
      && cachedToken.expiresAt - Date.now() > 30_000
    ) {
      return cachedToken.accessToken;
    }

    const token = await getValidUserToken(userId);
    cachedToken = {
      userId,
      accessToken: token.accessToken,
      expiresAt: token.expiresAt.getTime(),
    };
    return token.accessToken;
  } catch (error) {
    console.error(`[Token] 获取用户 ${userId} Token 失败:`, error);
    return null;
  }
}

/**
 * 测试模式聊天函数（使用当前用户的 Token）
 * 用于测试 API，直接调用 SecondMe API
 *
 * @param message - 用户消息
 * @param systemPrompt - 系统提示词
 * @param appId - 应用 ID
 * @param token - 用户 Access Token
 */
export async function testModeSendChat(
  message: string,
  systemPrompt: string | undefined,
  appId: string = 'opennovel-test',
  token?: string
): Promise<string> {
  // 如果没有传入 Token，从数据库获取当前用户的 Token
  if (!token) {
    const dbToken = await getCurrentUserToken();
    if (dbToken) {
      token = dbToken;
    }
  }

  if (!token) {
    throw new Error('无法获取用户 Token，请确保已登录');
  }

  return await testModeSendChatWithRetry(message, systemPrompt, appId, token);
}

/**
 * API 调用层面的重试配置
 */
const API_RETRY_CONFIG = {
  maxRetries: 3,           // 最大重试次数
  baseDelayMs: 2000,       // 基础延迟（毫秒）
  maxDelayMs: 15000,       // 最大延迟（毫秒）
  backoffMultiplier: 2,    // 退避倍率
};

/**
 * 计算指数退避延迟
 */
function getExponentialBackoffDelay(attempt: number): number {
  const delay = API_RETRY_CONFIG.baseDelayMs * Math.pow(API_RETRY_CONFIG.backoffMultiplier, attempt - 1);
  // 添加随机抖动（±20%）
  const jitter = delay * 0.2 * (Math.random() * 2 - 1);
  return Math.min(delay + jitter, API_RETRY_CONFIG.maxDelayMs);
}

/**
 * 带重试的 SecondMe API 调用
 */
async function testModeSendChatWithRetry(
  message: string,
  systemPrompt: string | undefined,
  appId: string,
  token: string,
  maxRetries: number = API_RETRY_CONFIG.maxRetries
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (attempt === 1) {
        console.log(`[TestModeChat] 调用 SecondMe API (appId=${appId})...`);
      } else {
        console.log(`[TestModeChat] 重试 (${attempt}/${maxRetries})...`);
      }

      const response = await fetch(
        `${SECONDME_CONFIG.BASE_URL}${SECONDME_CONFIG.API.CHAT_STREAM}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-App-Id': appId,
          },
          body: JSON.stringify({
            message,
            systemPrompt: systemPrompt || '',
            enableWebSearch: false,
            model: 'google_ai_studio/gemini-2.0-flash',
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Chat API error: ${response.statusText} - ${error}`);
      }

      // 解析 SSE 流
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let content = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const lines = decoder.decode(value).split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') return content;
            try {
              const parsed = JSON.parse(data);
              const chunk = parsed.choices?.[0]?.delta?.content;
              if (chunk) content += chunk;
            } catch {
              // 忽略解析错误
            }
          }
        }
      }

      console.log(`[TestModeChat] API 调用成功`);
      return content;
    } catch (error) {
      lastError = error as Error;
      console.warn(`[TestModeChat] API 调用失败 (尝试 ${attempt}/${maxRetries}):`, lastError.message);

      if (attempt < maxRetries) {
        const delayMs = getExponentialBackoffDelay(attempt);
        console.log(`[TestModeChat] 等待 ${Math.round(delayMs)}ms 后重试...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  // 所有重试都用尽
  throw lastError;
}

/**
 * 创建 SecondMe 客户端的便捷函数
 */
export function createSecondMeClient(userId: string): SecondMeClient {
  return new SecondMeClient(userId);
}
