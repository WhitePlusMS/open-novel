// 评论列表 API
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { commentService } from '@/services/comment.service';
import { CommentResponseDto } from '@/common/dto/comment.dto';
import { COMMENT_DEFAULTS } from '@/config/comment.constants';

export const dynamic = 'force-dynamic';

// 解析查询参数
function parseQueryParams(url: string) {
  const urlObj = new URL(url);
  const chapterId = urlObj.searchParams.get('chapterId') || undefined;
  const isHuman = urlObj.searchParams.get('isHuman');
  const limit = parseInt(urlObj.searchParams.get('limit') || String(COMMENT_DEFAULTS.DEFAULT_LIMIT), 10);
  const offset = parseInt(urlObj.searchParams.get('offset') || String(COMMENT_DEFAULTS.DEFAULT_OFFSET), 10);

  return {
    chapterId,
    isHuman: isHuman === 'true' ? true : isHuman === 'false' ? false : undefined,
    limit: Math.min(limit, COMMENT_DEFAULTS.MAX_LIMIT),
    offset,
  };
}

/**
 * GET /api/books/:id/comments - 获取评论列表
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();

  try {
    const { id: bookId } = await params;
    const { chapterId, isHuman, limit, offset } = parseQueryParams(request.url);

    const { comments, total } = await commentService.getComments(bookId, {
      chapterId,
      isHuman,
      limit,
      offset,
    });

    const commentItems = comments.map((comment) => CommentResponseDto.fromEntity(comment as unknown as Record<string, unknown>));

    const duration = Date.now() - startTime;
    console.log(`✓ GET /api/books/${bookId}/comments 200 in ${duration}ms (${total} total)`);

    return NextResponse.json({
      code: 0,
      data: {
        comments: commentItems,
        total,
        limit,
        offset,
      },
      message: 'success',
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`✗ GET /api/books/:id/comments 500 in ${duration}ms - ${error instanceof Error ? error.message : 'Unknown error'}`);
    return NextResponse.json(
      { code: 500, data: null, message: '获取评论列表失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/books/:id/comments - 发表评论
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();

  try {
    const { id: bookId } = await params;

    // 从 Cookie 获取当前登录用户
    const authToken = cookies().get('auth_token')?.value;

    if (!authToken) {
      const duration = Date.now() - startTime;
      console.log(`✗ POST /api/books/${bookId}/comments 401 in ${duration}ms (not logged in)`);
      return NextResponse.json(
        { code: 401, data: null, message: '请先登录' },
        { status: 401 }
      );
    }

    // 检查用户是否存在
    const user = await prisma.user.findUnique({
      where: { id: authToken },
      select: { id: true, nickname: true },
    });

    if (!user) {
      const duration = Date.now() - startTime;
      console.log(`✗ POST /api/books/${bookId}/comments 404 in ${duration}ms (user not found)`);
      return NextResponse.json(
        { code: 404, data: null, message: '用户不存在' },
        { status: 404 }
      );
    }

    const userId = user.id;

    const body = await request.json();
    const { chapterId, content, isHuman, aiRole } = body;

    if (!content) {
      const duration = Date.now() - startTime;
      console.log(`✗ POST /api/books/${bookId}/comments 400 in ${duration}ms (empty content)`);
      return NextResponse.json(
        { code: 400, data: null, message: '评论内容不能为空' },
        { status: 400 }
      );
    }

    const comment = await commentService.createComment({
      bookId,
      chapterId,
      userId,
      content,
      isHuman: isHuman !== false,
      aiRole,
    });

    const responseData = CommentResponseDto.fromEntity(comment);

    const duration = Date.now() - startTime;
    console.log(`✓ POST /api/books/${bookId}/comments 201 in ${duration}ms`);

    return NextResponse.json({
      code: 0,
      data: responseData,
      message: '评论成功',
    }, { status: 201 });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`✗ POST /api/books/:id/comments 500 in ${duration}ms - ${error instanceof Error ? error.message : 'Unknown error'}`);
    return NextResponse.json(
      { code: 500, data: null, message: '评论失败' },
      { status: 500 }
    );
  }
}
