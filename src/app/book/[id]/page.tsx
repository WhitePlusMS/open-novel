import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ArrowLeft, Flame, BookOpen, MessageCircle, CheckCircle, User, Star, Heart, Coins } from 'lucide-react';
import { bookService } from '@/services/book.service';
import { OutlineDisplay } from '@/components/book/outline-display';
import { CommentList } from '@/components/comments/comment-list';
import { FavoriteButton } from '@/components/book/favorite-button';
import { CompleteButton } from '@/components/book/complete-button';
import { ShareButton } from '@/components/book/share-button';
import { CatchUpButton } from '@/components/book/catch-up-button';
import { cookies } from 'next/headers';
import { safeJsonField } from '@/lib/utils/jsonb-utils';
import type { Character, ChapterPlan } from '@/types/outline';
import { getZoneConfig } from '@/lib/utils/zone';

interface BookPageProps {
  params: { id: string };
}

export default async function BookPage({ params }: BookPageProps) {
  const book = await bookService.getBookById(params.id);

  if (!book) {
    notFound();
  }

  // 从 Book 的合并字段获取热度，从 _count 获取章节数
  const heatValue = book.heatValue ?? 0;
  const chapterCount = book._count?.chapters ?? 0;
  const likeCount = book.likeCount ?? 0;
  const favoriteCount = book.favoriteCount ?? 0;
  const zoneConfig = getZoneConfig(book.zoneStyle);
  const zoneStyle = zoneConfig
    ? { bg: zoneConfig.bg, text: zoneConfig.text, label: zoneConfig.label }
    : { bg: 'bg-surface-100', text: 'text-surface-700', label: book.zoneStyle };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - 固定顶部 */}
      <header className="sticky top-0 bg-white/80 backdrop-blur-lg border-b border-gray-200 z-50">
        <main className="mx-auto w-full px-4 sm:px-6 lg:px-8 xl:px-16 2xl:px-24">
          <div className="mx-auto max-w-screen-xl flex items-center gap-3 py-3">
            <Link href="/" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
              <ArrowLeft className="w-5 h-5" aria-hidden="true" />
              <span className="text-sm font-medium">返回</span>
            </Link>
            <h1 className="flex-1 truncate text-sm font-medium">{book.title}</h1>
            <ShareButton bookId={params.id} bookTitle={book.title} />
          </div>
        </main>
      </header>

      {/* 书籍信息卡片 */}
      <div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8 xl:px-16 2xl:px-24 py-6">
        <div className="overflow-hidden rounded-2xl bg-white shadow-card">
          <div className="p-6">
            <div className="flex gap-6">
              {/* 封面 */}
              <div className="relative h-44 w-32 flex-shrink-0 overflow-hidden rounded-lg shadow-md bg-gradient-to-br from-primary-100 to-primary-300">
                {book.coverImage ? (
                  <Image
                    src={book.coverImage}
                    alt={book.title}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <BookOpen className="h-12 w-12 text-primary-400" />
                  </div>
                )}
              </div>

              {/* 信息区 */}
              <div className="flex-1">
                {/* 标题 */}
                <h2 className="mb-2 text-2xl font-bold text-gray-900">
                  {book.title}
                </h2>

                {/* 作者 */}
                <div className="mb-3 flex items-center gap-2">
                  <User className="h-5 w-5 text-gray-400" />
                  <span className="font-medium text-gray-900">@{book.author.nickname}</span>
                </div>

                {/* 标签 */}
                <div className="mb-4 flex items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-sm font-medium ${zoneStyle.bg} ${zoneStyle.text}`}>
                    {zoneStyle.label}
                  </span>
                  <span className={`rounded-full px-3 py-1 text-sm font-medium ${book.status === 'COMPLETED' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                    {book.status === 'COMPLETED' ? '已完结' : '连载中'}
                  </span>
                </div>

                {/* 评分 */}
                {book.avgRating !== undefined && book.avgRating !== null && book.avgRating > 0 && (
                  <div className="flex items-center gap-2">
                    <Star className="h-6 w-6 fill-yellow-400 text-yellow-400" />
                    <span className="text-3xl font-bold text-gray-900">{book.avgRating.toFixed(1)}</span>
                    <span className="text-sm text-gray-500">/10</span>
                  </div>
                )}
              </div>
            </div>

            {/* 简介 */}
            {book.shortDesc && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-sm leading-relaxed text-gray-600">
                  {book.shortDesc}
                </p>
              </div>
            )}

            {/* 统计数据 */}
            <div className="mt-4 grid grid-cols-5 gap-2 border-t border-gray-100 pt-4">
              <div className="text-center">
                <div className="mb-2 flex justify-center">
                  <BookOpen className="h-5 w-5 text-primary-500" />
                </div>
                <div className="text-xl font-bold text-gray-900">{chapterCount}</div>
                <div className="text-xs text-gray-500">章节</div>
              </div>
              <div className="text-center">
                <div className="mb-2 flex justify-center">
                  <Flame className="h-5 w-5 text-heat" />
                </div>
                <div className="text-xl font-bold text-gray-900">{heatValue.toLocaleString()}</div>
                <div className="text-xs text-gray-500">热度</div>
              </div>
              <div className="text-center">
                <div className="mb-2 flex justify-center">
                  <Heart className="h-5 w-5 text-red-500" />
                </div>
                <div className="text-xl font-bold text-gray-900">{likeCount.toLocaleString()}</div>
                <div className="text-xs text-gray-500">赞</div>
              </div>
              <div className="text-center">
                <div className="mb-2 flex justify-center">
                  <Coins className="h-5 w-5 text-yellow-500" />
                </div>
                <div className="text-xl font-bold text-gray-900">{favoriteCount.toLocaleString()}</div>
                <div className="text-xs text-gray-500">打赏</div>
              </div>
              <div className="text-center">
                <div className="mb-2 flex justify-center">
                  <MessageCircle className="h-5 w-5 text-blue-500" />
                </div>
                <div className="text-xl font-bold text-gray-900">{book._count?.comments || 0}</div>
                <div className="text-xs text-gray-500">评论</div>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Link
                href={`/book/${params.id}/chapter/1`}
                className="flex items-center justify-center gap-2 rounded-lg bg-primary-500 px-6 py-3 font-medium text-white shadow-md transition-all hover:bg-primary-600 hover:shadow-lg"
              >
                <BookOpen className="h-5 w-5" />
                开始阅读
              </Link>
              <FavoriteButton bookId={params.id} />
            </div>

            {/* 完本按钮（仅作者可见） */}
            <div className="mt-3">
              <CompleteButton
                bookId={params.id}
                currentStatus={book.status}
                isAuthor={book.authorId === cookies().get('auth_token')?.value}
              />
            </div>

            {/* 章节补全按钮（仅作者可见） */}
            <CatchUpButton
              bookId={params.id}
              isAuthor={book.authorId === cookies().get('auth_token')?.value}
            />
          </div>
        </div>
      </div>

      {/* 大纲 - 使用 Book 的合并字段 */}
      {(book.originalIntent || book.characters || book.chaptersPlan) && (
        <div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8 xl:px-16 2xl:px-24 py-4">
          <div className="overflow-hidden rounded-2xl bg-white shadow-card">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">作品大纲</h3>
              <OutlineDisplay
                outline={{
                  summary: book.originalIntent || '',
                  characters_json: safeJsonField<Character[]>(book.characters, []),
                  chapters: safeJsonField<ChapterPlan[]>(book.chaptersPlan, []),
                }}
                versions={(book.outlineVersions || []).map((v: Record<string, unknown>) => ({
                  version: v.version as number,
                  roundCreated: v.roundCreated as number,
                  reason: v.reason as string | null,
                  createdAt: (v.createdAt as Date).toISOString(),
                }))}
              />
            </div>
          </div>
        </div>
      )}

      {/* 章节列表 */}
      <div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8 xl:px-16 2xl:px-24 py-4">
        <div className="overflow-hidden rounded-2xl bg-white shadow-card">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">章节列表</h3>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {book.chapters.map((chapter) => (
              <Link
                key={chapter.id}
                href={`/book/${params.id}/chapter/${chapter.chapterNumber}`}
                className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      第{chapter.chapterNumber}章
                    </span>
                    {chapter.status === 'PUBLISHED' && (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                  </div>
                  <h4 className="text-gray-900 dark:text-gray-100 font-medium truncate">
                    {chapter.title}
                  </h4>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400 ml-4">
                  {chapter.status === 'PUBLISHED' && (
                    <>
                      <span className="flex items-center gap-1">
                        <Flame className="h-4 w-4 text-heat" />
                        {chapter.readCount}
                      </span>
                    </>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* 评论区域 */}
      <div id="comments" className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8 xl:px-16 2xl:px-24 py-4 pb-8">
        <div className="overflow-hidden rounded-2xl bg-white shadow-card">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">全部评论</h3>
          </div>
          <div className="p-4">
            <CommentList bookId={params.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
