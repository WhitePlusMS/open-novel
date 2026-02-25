/**
 * 历史赛季列表组件
 */

import { Spinner } from '@/components/ui/spinner';
import { Trophy } from 'lucide-react';
import { BookCard } from '@/components/home/book-card';
import type { SeasonDetail, LeaderboardData } from '@/types/season-admin';
import { getStatusBadge, getPhaseDisplayName, formatConstraints, formatZoneStyles } from '@/lib/season-admin-utils';

interface SeasonHistoryListProps {
  allSeasons: SeasonDetail[];
  leaderboardData: Record<string, LeaderboardData>;
}

export function SeasonHistoryList({
  allSeasons,
  leaderboardData,
}: SeasonHistoryListProps) {
  if (!allSeasons || allSeasons.length === 0) {
    return (
      <div className="text-center py-8 text-surface-500 dark:text-surface-400">
        暂无历史赛季
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {allSeasons.map((s) => (
        <SeasonHistoryCard
          key={s.id}
          season={s}
          leaderboard={leaderboardData[s.id]}
        />
      ))}
    </div>
  );
}

interface SeasonHistoryCardProps {
  season: SeasonDetail;
  leaderboard?: LeaderboardData;
}

function SeasonHistoryCard({
  season,
  leaderboard,
}: SeasonHistoryCardProps) {
  return (
    <div className="p-4 bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold">S{season.seasonNumber}</span>
          <span className="text-lg font-semibold">{season.themeKeyword}</span>
          {getStatusBadge(season.status)}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <div className="text-surface-500 dark:text-surface-400">开始时间</div>
          <div className="font-medium">
            {season.startTime ? new Date(season.startTime).toLocaleString('zh-CN') : '-'}
          </div>
        </div>
        <div>
          <div className="text-surface-500 dark:text-surface-400">结束时间</div>
          <div className="font-medium">
            {season.endTime ? new Date(season.endTime).toLocaleString('zh-CN') : '-'}
          </div>
        </div>
        <div>
          <div className="text-surface-500 dark:text-surface-400">参赛书籍</div>
          <div className="font-medium">{season.participantCount} 本</div>
        </div>
        <div>
          <div className="text-surface-500 dark:text-surface-400">最大章节</div>
          <div className="font-medium">{season.maxChapters} 章</div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <div className="text-surface-500 dark:text-surface-400">轮次时长</div>
          <div className="font-medium">{season.roundDuration || 20} 分钟</div>
        </div>
        <div>
          <div className="text-surface-500 dark:text-surface-400">当前状态</div>
          <div className="font-medium">
            {season.status === 'ACTIVE'
              ? `第 ${season.currentRound} 轮 - ${getPhaseDisplayName(season.roundPhase)}`
              : getPhaseDisplayName(season.roundPhase)}
          </div>
        </div>
      </div>

      {/* 约束和分区 */}
      <div className="mt-3 text-sm">
        <div className="text-surface-500 dark:text-surface-400 mb-1">
          约束: {formatConstraints(season.constraints)}
        </div>
        <div className="text-surface-500 dark:text-surface-400">
          分区: {formatZoneStyles(season.zoneStyles)}
        </div>
      </div>

      {/* 奖励 */}
      {season.rewards && Object.keys(season.rewards).length > 0 && (
        <div className="mt-3 text-sm">
          <div className="text-surface-500 dark:text-surface-400">奖励:</div>
          <div className="flex gap-3 mt-1">
            {season.rewards.first && <span className="text-yellow-600">🥇 {season.rewards.first} Ink</span>}
            {season.rewards.second && <span className="text-gray-500">🥈 {season.rewards.second} Ink</span>}
            {season.rewards.third && <span className="text-amber-700">🥉 {season.rewards.third} Ink</span>}
          </div>
        </div>
      )}

      {/* 排行榜 */}
      {season.status !== 'ACTIVE' && season.participantCount > 0 && (
        <SeasonLeaderboard leaderboard={leaderboard} />
      )}
    </div>
  );
}

interface SeasonLeaderboardProps {
  leaderboard?: LeaderboardData;
}

function SeasonLeaderboard({ leaderboard }: SeasonLeaderboardProps) {
  if (!leaderboard) {
    return (
      <div className="mt-4">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="w-4 h-4 text-yellow-500" />
          <span className="text-sm font-medium">热度排行 TOP 10</span>
        </div>
        <div className="text-center py-4">
          <Spinner className="w-6 h-6 mx-auto" />
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-2">加载中...</p>
        </div>
      </div>
    );
  }

  if (leaderboard.loading) {
    return (
      <div className="mt-4">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="w-4 h-4 text-yellow-500" />
          <span className="text-sm font-medium">热度排行 TOP 10</span>
        </div>
        <div className="text-center py-4">
          <Spinner className="w-6 h-6 mx-auto" />
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-2">加载中...</p>
        </div>
      </div>
    );
  }

  if (!leaderboard.books || leaderboard.books.length === 0) {
    return (
      <div className="mt-4">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="w-4 h-4 text-yellow-500" />
          <span className="text-sm font-medium">热度排行 TOP 10</span>
        </div>
        <div className="text-center py-4 text-surface-500 dark:text-surface-400">
          暂无书籍数据
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="w-4 h-4 text-yellow-500" />
        <span className="text-sm font-medium">热度排行 TOP 10</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {leaderboard.books.map((book) => (
          <BookCard
            key={book.bookId}
            book={{
              id: book.bookId,
              title: book.title,
              coverImage: book.coverImage,
              shortDesc: book.shortDesc,
              zoneStyle: book.zoneStyle,
              status: book.status || 'COMPLETED',
              heat: book.heat,
              chapterCount: book.chapterCount,
              viewCount: book.viewCount || 0,
              commentCount: book.commentCount || 0,
              author: { nickname: book.author },
            }}
            rank={book.rank}
            showSeason={false}
          />
        ))}
      </div>
    </div>
  );
}
