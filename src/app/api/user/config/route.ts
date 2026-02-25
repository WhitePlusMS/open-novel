/**
 * 更新 Agent/Reader 配置
 * PUT /api/user/config
 * Body: { type: 'author' | 'reader', ...config }
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { userService, AgentConfig, ReaderConfig } from '@/services/user.service';

// API 响应 DTO
interface ApiResponse<T = unknown> {
  code: string;
  message?: string;
  data?: T;
}

export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest) {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(2, 8);

  try {
    const authToken = cookies().get('auth_token')?.value;

    console.log(`[User][${requestId}] PUT /api/user/config - token:`, authToken ? authToken.substring(0, 10) + '...' : 'null');

    if (!authToken) {
      console.error(`[User][${requestId}] Unauthorized - no auth token`);
      return NextResponse.json(
        { code: 'UNAUTHORIZED', message: '未登录' } as ApiResponse,
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { type, ...configData } = body as { type?: string; [key: string]: unknown };

    console.log(`[User][${requestId}] Config type:`, type);
    console.log(`[User][${requestId}] Config data keys:`, Object.keys(configData));

    if (type === 'reader') {
      // 保存 Reader 配置
      const { readerPersonality, readingPreferences, commentingBehavior, interactionBehavior } = configData as {
        readerPersonality?: string;
        readingPreferences?: ReaderConfig['readingPreferences'];
        commentingBehavior?: ReaderConfig['commentingBehavior'];
        interactionBehavior?: ReaderConfig['interactionBehavior'];
      };

      const readerConfig: ReaderConfig = {
        readerPersonality: readerPersonality ?? '',
        readingPreferences: readingPreferences ?? {
          preferredGenres: [],
          minRatingThreshold: 3.0,
        },
        commentingBehavior: commentingBehavior ?? {
          enabled: true,
          commentProbability: 0.5,
          ratingThreshold: 6,
        },
        interactionBehavior: interactionBehavior ?? {
          pokeEnabled: true,
          giftEnabled: true,
        },
      };

      await userService.updateReaderConfig(authToken, readerConfig);

      const duration = Date.now() - startTime;
      console.log(`[User][${requestId}] Reader config updated - duration: ${duration}ms`);

      return NextResponse.json({
        code: 'SUCCESS',
        message: '读者配置保存成功',
        data: { success: true },
      } as ApiResponse<{ success: boolean }>);
    } else {
      // 保存作者配置（默认）
      const {
        writerPersonality,
        writingStyle,
        writingLengthPreference,
        adaptability,
        preferredGenres,
        wordCountTarget,
      } = configData as Record<string, unknown>;

      // 转换 writingStyle 为合法类型
      const validWritingStyles = ['严肃', '幽默', '浪漫', '悬疑', '多变'] as const;
      const inputWritingStyle = (writingStyle as string) || '多变';

      const validWritingLengthPreferences = ['short', 'medium', 'long'] as const;
      const inputWritingLengthPreference = (writingLengthPreference as string) || 'medium';

      const config: AgentConfig = {
        writerPersonality: (writerPersonality as string) ?? '',
        writingStyle: validWritingStyles.includes(inputWritingStyle as typeof validWritingStyles[number])
          ? inputWritingStyle as typeof validWritingStyles[number]
          : '多变',
        writingLengthPreference: validWritingLengthPreferences.includes(inputWritingLengthPreference as typeof validWritingLengthPreferences[number])
          ? inputWritingLengthPreference as typeof validWritingLengthPreferences[number]
          : 'medium',
        adaptability: (adaptability as number) ?? 0.8,
        preferredGenres: (preferredGenres as string[]) ?? [],
        wordCountTarget: (wordCountTarget as number) ?? 2000,
      };

      console.log(`[User][${requestId}] Author config:`, JSON.stringify(config));

      await userService.updateAgentConfig(authToken, config);

      const duration = Date.now() - startTime;
      console.log(`[User][${requestId}] Agent config updated - duration: ${duration}ms`);

      return NextResponse.json({
        code: 'SUCCESS',
        message: '作者配置保存成功',
        data: { success: true },
      } as ApiResponse<{ success: boolean }>);
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[User][${requestId}] Error - duration: ${duration}ms:`, error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: errorMessage } as ApiResponse,
      { status: 500 }
    );
  }
}

/**
 * 获取 Agent/Reader 配置
 * GET /api/user/config?type=author|reader
 */
export async function GET(request: NextRequest) {
  try {
    const authToken = cookies().get('auth_token')?.value;
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'author';

    if (!authToken) {
      return NextResponse.json(
        { error: '未登录', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    let config: AgentConfig | ReaderConfig | null = null;

    if (type === 'reader') {
      config = await userService.getReaderConfig(authToken);
    } else {
      config = await userService.getAgentConfig(authToken);
    }

    return NextResponse.json({
      data: config,
    });
  } catch (error) {
    console.error('[User] Get config error:', error);
    return NextResponse.json(
      { error: '内部服务器错误', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
