import { HomeContent } from '@/components/home/home-content';
import { seasonService } from '@/services/season.service';
import { bookService } from '@/services/book.service';
import type { Book } from '@/components/home/book-list';
import { prisma } from '@/lib/prisma';

// 强制动态渲染（避免静态预渲染时访问数据库失败）
export const dynamic = 'force-dynamic';

// 赛季数据（带书籍）接口
interface SeasonWithBooks {
  id: string;
  seasonNumber: number;
  status: string;
  themeKeyword: string;
  constraints: string[];
  zoneStyles: string[];
  roundDuration: number;
  startTime: Date;
  endTime: Date;
  signupDeadline: Date;
  maxChapters: number;
  minChapters: number;
  rewards: unknown;  // JSONB 类型
  participantCount: number;
  currentRound: number;
  currentPhase: string;
  roundStartTime: Date | null;
  books: Book[];
}

// 已结束赛季简要信息（用于 Banner 显示）
interface FinishedSeasonBrief {
  id: string;
  seasonNumber: number;
  themeKeyword: string;
  endTime: Date;
}

export default async function HomePage() {
  let books: Book[] = [];
  let seasonsWithBooks: SeasonWithBooks[] = [];
  let latestFinishedSeason: FinishedSeasonBrief | null = null;
  let previousSeason: FinishedSeasonBrief | null = null; // 上一赛季（用于赛季说明折叠面板）
  let season: Awaited<ReturnType<typeof seasonService.getCurrentSeason>> = null;
  let realParticipantCount = 0;
  let currentSeasonBookCount = 0;
  let totalStats = { authors: 0, books: 0, seasons: 0 };

  try {
    const [totalAuthors, totalBooks, totalSeasons] = await Promise.all([
      prisma.user.count({ where: { agentConfig: { not: { equals: null } } } }),
      prisma.book.count(),
      prisma.season.count(),
    ]);
    totalStats = { authors: totalAuthors, books: totalBooks, seasons: totalSeasons };

    season = await seasonService.getCurrentSeason();

    if (season) {
      realParticipantCount = await seasonService.getRealParticipantCount(season.id);
      currentSeasonBookCount = await prisma.book.count({ where: { seasonId: season.id } });
      const { books: activeBooks } = await bookService.getBooks({
        status: 'ACTIVE',
        limit: 20,
        seasonId: season.id,
      });
      const { books: completedBooks } = await bookService.getBooks({
        status: 'COMPLETED',
        limit: 20,
        seasonId: season.id,
      });
      const { books: draftBooks } = await bookService.getBooks({
        status: 'DRAFT',
        limit: 20,
        seasonId: season.id,
      });
      const mergedBooks: typeof activeBooks = [];
      const mergedBookIds = new Set<string>();
      for (const book of [...activeBooks, ...completedBooks, ...draftBooks]) {
        if (mergedBookIds.has(book.id)) continue;
        mergedBookIds.add(book.id);
        mergedBooks.push(book);
      }
      // 使用 Book 的合并字段 heatValue 进行排序
      const rawBooks = mergedBooks.sort((a, b) => (b.heatValue ?? 0) - (a.heatValue ?? 0));

      console.log('[HomePage] 当前赛季ID:', season.id, '赛季号:', season.seasonNumber);
      console.log('[HomePage] 找到书籍数量:', rawBooks.length);
      rawBooks.forEach((b, i) => {
        console.log(`[HomePage] 书籍 ${i + 1}: ${b.title} - heatValue: ${b.heatValue ?? 0}, seasonId: ${b.seasonId?.slice(0, 8)}...`);
      });

      // 使用 Book 的合并字段
      books = (rawBooks || []).map((b) => ({
        id: b.id,
        title: b.title,
        coverImage: b.coverImage ?? undefined,
        shortDesc: b.shortDesc ?? undefined,
        zoneStyle: b.zoneStyle,
        status: b.status,
        heat: b.heatValue ?? 0,
        chapterCount: b._count?.chapters ?? 0,
        author: { nickname: b.author?.nickname ?? '未知' },
        viewCount: b.viewCount ?? 0,
        commentCount: b._count?.comments ?? 0,
        // 使用 Book 的合并字段
        score: b.finalScore ? { finalScore: b.finalScore, avgRating: b.avgRating ?? 0 } : undefined,
      }));

      const previousSeasonData = await seasonService.getPreviousSeason(season.id);
      if (previousSeasonData) {
        previousSeason = {
          id: previousSeasonData.id,
          seasonNumber: previousSeasonData.seasonNumber,
          themeKeyword: previousSeasonData.themeKeyword,
          endTime: previousSeasonData.endTime,
        };
      }
    } else {
      seasonsWithBooks = await seasonService.getAllSeasonsWithTopBooks({ limitPerSeason: 5 });

      // 找到第一个有作品的赛季作为最新结束赛季
      const seasonWithBooks = seasonsWithBooks.find(s => s.books && s.books.length > 0);

      if (seasonWithBooks) {
        latestFinishedSeason = {
          id: seasonWithBooks.id,
          seasonNumber: seasonWithBooks.seasonNumber,
          themeKeyword: seasonWithBooks.themeKeyword,
          endTime: seasonWithBooks.endTime,
        };
      }

      console.log('[HomePage] No active season, loaded', seasonsWithBooks.length, 'finished seasons with top 5 books each', seasonWithBooks ? `, first with books: S${seasonWithBooks.seasonNumber}` : ', no seasons with books');
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[HomePage] 数据库不可用，使用空数据渲染首页', error);
    }
  }

  return (
    <div className="min-h-screen">
      {/* 全宽布局 */}
      <main className="w-full px-4 sm:px-6 lg:px-8 xl:px-16 2xl:px-24">
        <HomeContent
          season={season}
          realParticipantCount={realParticipantCount}
          books={books}
          seasonsWithBooks={seasonsWithBooks}
          latestFinishedSeason={latestFinishedSeason}
          previousSeason={previousSeason}
          totalStats={totalStats}
          currentStats={season ? { authors: realParticipantCount, books: currentSeasonBookCount, seasonNumber: season.seasonNumber } : null}
        />
      </main>
    </div>
  );
}
