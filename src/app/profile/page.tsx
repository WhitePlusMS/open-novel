import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { userService } from '@/services/user.service';
import { UserInfo } from '@/components/profile/user-info';
import { StatsCard } from '@/components/profile/stats-card';
import { SeasonCard } from '@/components/profile/season-card';
import { LogoutButton } from '@/components/profile/logout-button';
import { Button } from '@/components/ui/button';
import { Plus, BookOpen, Trophy } from 'lucide-react';

// 强制动态渲染，确保每次请求都获取最新数据
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const authToken = cookies().get('auth_token')?.value;

  // 未登录则显示登录提示
  if (!authToken) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-surface-900 dark:to-surface-800">
        <main className="mx-auto w-full px-4 sm:px-6 lg:px-8 xl:px-16 2xl:px-24">
          <div className="mx-auto max-w-screen-xl py-8">
            <div className="overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-card p-8 text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary-100 to-primary-300 flex items-center justify-center">
                <BookOpen className="h-10 w-10 text-primary-500" />
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-6">登录后可查看个人中心</p>
              <Link
                href="/api/auth/login"
                className="inline-block"
              >
                <Button>
                  立即登录
                </Button>
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const user = await userService.getUserById(authToken);
  if (!user) {
    redirect('/api/auth/login');
  }

  // 一次性获取用户统计数据（动态计算）
  const userStats = await userService.getUserStats(user.id);
  const agentConfig = await userService.getAgentConfig(user.id);
  const level = await userService.getUserLevel(user.id);
  const participations = await userService.getSeasonParticipations(user.id);
  const { books } = await userService.getUserBooks(user.id, { limit: 10 });

  // 使用动态计算的统计数据
  const booksWritten = userStats.booksCompleted;
  const seasonsJoined = userStats.seasonsJoined;
  const totalInk = userStats.totalInk;
  const highestRank = userStats.highestRank;

  // 获取正在参赛的书籍
  const activeSeason = await prisma.season.findFirst({
    where: { status: 'ACTIVE' },
    select: { id: true, seasonNumber: true, themeKeyword: true },
  });
  const booksInProgress = activeSeason
    ? await prisma.book.findFirst({
        where: {
          authorId: user.id,
          seasonId: activeSeason.id,
          status: 'ACTIVE',
        },
        include: {
          season: { select: { seasonNumber: true, themeKeyword: true } },
          _count: { select: { chapters: true } },
        },
      })
    : null;

  const userData = {
    id: user.id,
    nickname: user.nickname,
    avatar: user.avatar ?? undefined,
    email: user.email ?? undefined,
    agentConfig: agentConfig ?? undefined,
  };

  // 构建 level 数据（User 表合并后的字段）
  const levelData = level ? {
    level: level.level ?? 1,
    title: level.levelTitle ?? '新手',
    totalPoints: level.totalPoints ?? 0,
  } : undefined;

  const stats = {
    booksWritten: booksWritten,
    booksCompleted: userStats.booksCompleted,
    booksInProgress: booksInProgress ? 1 : 0,
    booksInProgressDetail: booksInProgress
      ? {
          id: booksInProgress.id,
          title: booksInProgress.title,
          seasonNumber: booksInProgress.season?.seasonNumber ?? 0,
          themeKeyword: booksInProgress.season?.themeKeyword ?? '',
          chapterCount: booksInProgress._count.chapters,
        }
      : null,
    seasonsJoined: seasonsJoined,
    totalInk: totalInk,
    highestRank: highestRank,
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-surface-900 dark:to-surface-800">
      <main className="mx-auto w-full px-4 sm:px-6 lg:px-8 xl:px-16 2xl:px-24">
        <div className="mx-auto max-w-screen-xl py-6">
        {/* 用户信息 */}
        <UserInfo user={userData} level={levelData} />

        {/* 创作统计 */}
        <StatsCard stats={stats} />

        {/* 赛季战绩 */}
        {participations.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="h-5 w-5 text-gray-700 dark:text-gray-300" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">赛季战绩</h3>
            </div>

            {participations.map((p) => (
              <SeasonCard key={p.id} participation={p} />
            ))}
          </div>
        )}

        {/* 我的书籍 */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">我的书籍</h3>
            <Link href="/create">
              <Button size="sm" variant="outline" className="gap-1">
                <Plus className="h-4 w-4" />
                新建
              </Button>
            </Link>
          </div>

          {books && books.length > 0 ? (
            <div className="space-y-3">
              {books.map((book) => (
                <Link
                  key={book.id}
                  href={`/book/${book.id}`}
                  className="block overflow-hidden rounded-xl bg-white dark:bg-gray-800 shadow-card transition-all hover:shadow-card-hover"
                >
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{book.title}</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {book._count?.chapters ?? 0} 章 · {book.status === 'COMPLETED' ? '已完结' : '连载中'}
                        </p>
                      </div>
                      <span className="ml-3 flex-shrink-0 rounded-full bg-gray-100 dark:bg-gray-700 px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-300">
                        {book.zoneStyle}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl bg-white dark:bg-gray-800 shadow-card p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                <BookOpen className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-500 dark:text-gray-400 mb-4">暂无书籍</p>
              <Link href="/create" className="inline-block">
                <Button size="sm">立即创建</Button>
              </Link>
            </div>
          )}
        </div>

        {/* 退出登录 */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <LogoutButton />
        </div>
      </div>
      </main>
    </div>
  );
}
