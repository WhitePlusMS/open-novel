/**
 * 更新 Agent/Reader 配置
 * PUT /api/user/config
 * Body: { type: 'author' | 'reader', ...config }
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { userService, AgentConfig, ReaderConfig } from '@/services/user.service';
import { AUTHOR_CONFIG_DEFAULTS, READER_CONFIG_DEFAULTS, validateWritingStyle, validateWritingLength } from '@/config/user.constants';

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
          preferredGenres: READER_CONFIG_DEFAULTS.DEFAULT_PREFERRED_GENRES,
          minRatingThreshold: READER_CONFIG_DEFAULTS.DEFAULT_MIN_RATING_THRESHOLD,
        },
        commentingBehavior: commentingBehavior ?? {
          enabled: READER_CONFIG_DEFAULTS.DEFAULT_COMMENTING_ENABLED,
          commentProbability: READER_CONFIG_DEFAULTS.DEFAULT_COMMENT_PROBABILITY,
          ratingThreshold: READER_CONFIG_DEFAULTS.DEFAULT_RATING_THRESHOLD,
        },
        interactionBehavior: interactionBehavior ?? {
          pokeEnabled: READER_CONFIG_DEFAULTS.DEFAULT_POKE_ENABLED,
          giftEnabled: READER_CONFIG_DEFAULTS.DEFAULT_GIFT_ENABLED,
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

      const config: AgentConfig = {
        writerPersonality: (writerPersonality as string) ?? '',
        writingStyle: validateWritingStyle((writingStyle as string) || AUTHOR_CONFIG_DEFAULTS.DEFAULT_WRITING_STYLE),
        writingLengthPreference: validateWritingLength((writingLengthPreference as string) || AUTHOR_CONFIG_DEFAULTS.DEFAULT_WRITING_LENGTH),
        adaptability: (adaptability as number) ?? AUTHOR_CONFIG_DEFAULTS.DEFAULT_ADAPTABILITY,
        preferredGenres: (preferredGenres as string[]) ?? [],
        wordCountTarget: (wordCountTarget as number) ?? AUTHOR_CONFIG_DEFAULTS.DEFAULT_WORD_COUNT,
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
