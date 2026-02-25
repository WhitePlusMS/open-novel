'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { SeasonBanner } from '@/components/home/season-banner';
import { BookList, type Book } from '@/components/home/book-list';
import { ZoneTabs } from '@/components/home/zone-tabs';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Alert } from '@/components/ui/alert';
import { UserPlus, Sparkles, Settings, Zap, ArrowRight, BookOpen, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * 获取阶段显示名称
 */
function getPhaseDisplayName(phase: string): string {
  const names: Record<string, string> = {
    NONE: '准备中',
    READING: '阅读窗口期',
    OUTLINE: '大纲生成期',
    WRITING: '章节创作期',
  };
  return names[phase] || phase;
}

interface Season {
  id: string;
  seasonNumber: number;
  themeKeyword: string;
  endTime: Date | string;
  participantCount: number;
  // 轮次状态
  currentRound?: number;
  currentPhase?: string;
  roundStartTime?: Date | string | null;
  phaseDurations?: {
    reading: number;
    outline: number;
    writing: number;
  };
  // 赛季详情
  constraints?: string[];
  zoneStyles?: string[];
  maxChapters?: number;
}

// 赛季数据（带书籍）接口
interface SeasonWithBooks {
  id: string;
  seasonNumber: number;
  status: string;
  themeKeyword: string;
  constraints: string[];
  zoneStyles: string[];
  roundDuration: number;
  startTime: Date | string;
  endTime: Date | string;
  signupDeadline: Date | string;
  maxChapters: number;
  minChapters: number;
  rewards: unknown;  // JSONB 类型
  participantCount: number;
  currentRound: number;
  currentPhase: string;
  roundStartTime: Date | string | null;
  books: Book[];
}

// 已结束赛季简要信息（用于 Banner 显示）
interface FinishedSeasonBrief {
  id: string;
  seasonNumber: number;
  themeKeyword: string;
  endTime: Date | string;
}

interface HomeContentProps {
  season: Season | null;
  realParticipantCount?: number; // 真实参与数
  books: Book[] | null | undefined;
  seasonsWithBooks?: SeasonWithBooks[]; // 已结束赛季的前5名书籍
  latestFinishedSeason?: FinishedSeasonBrief | null; // 最新结束的赛季信息
  previousSeason?: FinishedSeasonBrief | null; // 上一赛季（用于折叠面板显示）
  totalStats: {
    authors: number;
    books: number;
    seasons: number;
  };
  currentStats: {
    authors: number;
    books: number;
    seasonNumber: number;
  } | null;
}

export function HomeContent({
  season,
  realParticipantCount = 0,
  books,
  seasonsWithBooks,
  latestFinishedSeason = null,
  previousSeason = null,
  totalStats,
  currentStats,
}: HomeContentProps) {
  const { user, isLoading, error, login, clearError } = useAuth();
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionType, setActionType] = useState<'init' | 'start' | 'nextPhase' | 'endSeason' | null>(null);
  const [phaseStatus, setPhaseStatus] = useState<{
    currentRound: number;
    currentPhase: string;
    phaseDisplayName: string;
  } | null>(null);
  const [currentZone, setCurrentZone] = useState('');
  // 客户端状态保存书籍数据，避免切换分区时数据丢失
  const [clientBooks, setClientBooks] = useState<Book[]>([]);

  // 手动刷新函数
  const handleRefresh = useCallback(() => {
    router.refresh();
  }, [router]);

  // 轮询：定期刷新页面数据（替代 WebSocket Realtime）
  // 优化：60 秒间隔 + 页面可见时立即刷新，减少不必要的请求
  useEffect(() => {
    if (!user) return;

    // 1. 定时轮询：每 60 秒刷新一次
    const interval = setInterval(() => {
      console.log('[Polling] Refreshing page data...');
      router.refresh();
    }, 60000);

    // 2. 页面可见时刷新（用户切换回页面时立即更新）
    const handleVisibility = () => {
      if (!document.hidden) {
        console.log('[Polling] Page visible, refreshing...');
        router.refresh();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user, router]);

  // 初始化客户端书籍数据
  useEffect(() => {
    if (books && books.length > 0) {
      setClientBooks(books);
    }
  }, [books]);

  // 优化：直接从 props 中的 season 数据获取阶段状态，避免重复 API 调用
  // season props 已经包含 currentRound 和 currentPhase
  useEffect(() => {
    if (season && user) {
      const roundPhase = season.currentPhase || 'NONE';
      const phaseDisplayName = getPhaseDisplayName(roundPhase);
      setPhaseStatus({
        currentRound: season.currentRound || 1,
        currentPhase: roundPhase,
        phaseDisplayName,
      });
    }
  }, [season, user]);

  // 获取 S0 赛季状态 - 注意：这个调用没有使用结果，是无用的，可以注释掉或删除
  // 如果需要 S0 检测，应该在服务端判断后通过 props 传递
  /*
  useEffect(() => {
    const fetchS0Status = async () => {
      try {
        const response = await fetch('/api/seasons/status');
        const result = await response.json();
        if (result.code === 0 && result.data) {
          // S0 赛季检测：seasonNumber 为 0
        }
      } catch (err) {
        console.error('Failed to fetch S0 status:', err);
      }
    };

    if (user) {
      fetchS0Status();
    }
  }, [user]);
  */

  useEffect(() => {
    if (error) {
      const url = new URL(window.location.href);
      if (url.searchParams.has('error')) {
        url.searchParams.delete('error');
        window.history.replaceState({}, '', url.toString());
      }
    }
  }, [error]);

  // 初始化 S0 赛季
  const handleInitS0 = async () => {
    setIsProcessing(true);
    setActionType('init');
    try {
      const response = await fetch('/api/admin/test/init-s0', {
        method: 'POST',
      });
      const result = await response.json();
      if (result.code === 0) {
        router.refresh();
        alert(`初始化成功！${result.data.agentsCreated} 个 Agent 已就绪`);
      } else {
        alert('初始化失败: ' + result.message);
      }
    } catch (err) {
      alert('初始化失败: ' + (err as Error).message);
    } finally {
      setIsProcessing(false);
      setActionType(null);
    }
  };

  // 开始 S0 赛季
  const handleStartS0 = async () => {
    setIsProcessing(true);
    setActionType('start');
    try {
      const response = await fetch('/api/admin/test/start-s0', {
        method: 'POST',
      });
      const result = await response.json();
      if (result.code === 0) {
        router.refresh();
        alert(`赛季开始！${result.data.joinCount} 个 Agent 参赛，${result.data.skipCount} 个弃权`);
      } else {
        alert('开始失败: ' + result.message);
      }
    } catch (err) {
      alert('开始失败: ' + (err as Error).message);
    } finally {
      setIsProcessing(false);
      setActionType(null);
    }
  };

  // 推进赛季阶段
  const handleNextPhase = async () => {
    setIsProcessing(true);
    setActionType('nextPhase');
    try {
      const response = await fetch('/api/admin/test/next-phase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'NEXT_PHASE' }),
      });
      const result = await response.json();
      if (result.code === 0) {
        // 更新本地状态
        if (result.data) {
          setPhaseStatus({
            currentRound: result.data.currentRound,
            currentPhase: result.data.currentPhase,
            phaseDisplayName: result.data.phaseDisplayName,
          });
        }
        alert(`推进成功！当前: 第 ${result.data?.currentRound} 轮 - ${result.data?.phaseDisplayName}`);
      } else {
        alert('推进失败: ' + result.message);
      }
    } catch (err) {
      alert('推进失败: ' + (err as Error).message);
    } finally {
      setIsProcessing(false);
      setActionType(null);
    }
  };

  // 结束赛季
  const handleEndSeason = async () => {
    if (!confirm('确定要结束当前赛季吗？')) return;
    setIsProcessing(true);
    setActionType('endSeason');
    try {
      const response = await fetch('/api/admin/test/next-phase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'END_SEASON' }),
      });
      const result = await response.json();
      if (result.code === 0) {
        router.refresh();
        alert('赛季已结束！');
      } else {
        alert('结束失败: ' + result.message);
      }
    } catch (err) {
      alert('结束失败: ' + (err as Error).message);
    } finally {
      setIsProcessing(false);
      setActionType(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  // 已登录时显示完整首页
  if (user) {
    // S0 赛季判断：seasonNumber 为 0
    const seasonNum = season?.seasonNumber;
    const isS0Season = seasonNum == 0 || String(seasonNum) === '0';
    const hasRealBooks = realParticipantCount > 0 || (books && books.length > 0);

    // 判断是否显示已完成赛季的历史榜单
    const showHistorySeasons = !season || (season && !isS0Season && !hasRealBooks);
    const hasFinishedSeasons = seasonsWithBooks && seasonsWithBooks.length > 0;

    return (
      <>
        {/* 刷新控制栏 */}
        <div className="flex items-center justify-end mb-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            className="gap-1 text-surface-500 hover:text-surface-700"
          >
            <RefreshCw className="w-3 h-3" />
            刷新
          </Button>
        </div>

        {/* 赛季 Banner */}
        <SeasonBanner season={season || undefined} latestFinishedSeason={latestFinishedSeason || undefined} previousSeason={previousSeason || undefined} />

        {/* 平台统计 */}
        <PlatformStats
          season={season}
          totalStats={totalStats}
          currentStats={currentStats}
        />

        {/* 分区 Tab - 放在往届赛季精彩作品上面 */}
        <ZoneTabs currentZone={currentZone} onZoneChange={setCurrentZone} />

        {/* 已结束赛季的历史榜单 */}
        {showHistorySeasons && hasFinishedSeasons && (
          <div className="mt-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-3 px-1">
              往届赛季精彩作品
            </h2>
            {seasonsWithBooks!.map((seasonData) => (
              <div key={seasonData.id} className="mb-6">
                {/* 赛季标题 */}
                <div className="flex items-center gap-2 mb-3 px-1">
                  <span className="text-sm font-medium text-surface-500 dark:text-surface-400">
                    S{seasonData.seasonNumber}
                  </span>
                  <span className="text-base font-semibold text-gray-900 dark:text-gray-100">
                    {seasonData.themeKeyword}
                  </span>
                  <span className="text-xs px-2 py-0.5 bg-surface-100 dark:bg-surface-700 rounded-full text-surface-500 dark:text-surface-400">
                    {seasonData.books.length} 部作品
                  </span>
                </div>
                {/* 赛季内的书籍列表 */}
                <BookList initialBooks={seasonData.books} showSeason={false} zone={currentZone} />
              </div>
            ))}
          </div>
        )}

        {/* S0 测试赛季操作区域 */}
        {isS0Season && hasRealBooks && (
          <div className="my-4 p-6 bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-900/20 dark:to-orange-800/10 rounded-lg border border-amber-200 dark:border-amber-800">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/50 mb-3">
                <Settings className="w-8 h-8 text-amber-600" />
              </div>
              <h3 className="text-lg font-bold text-amber-900 dark:text-amber-100 mb-2">
                S0 测试赛季
              </h3>

              <p className="text-sm text-amber-700 dark:text-amber-300 mb-4">
                已参赛 {realParticipantCount} 本书
              </p>

              {/* 阶段推进按钮 - 第一章完成后显示 */}
              {phaseStatus && (
                <div className="mb-4 p-4 bg-white/50 dark:bg-amber-900/20 rounded-lg">
                  <div className="text-sm text-amber-800 dark:text-amber-200 mb-3">
                    <div className="font-semibold">当前阶段状态</div>
                    <div className="mt-1">
                      第 <span className="font-bold">{phaseStatus.currentRound}</span> 轮 - <span className="font-bold">{phaseStatus.phaseDisplayName}</span>
                    </div>
                  </div>

                  {/* 推进到下一阶段 */}
                  <Button
                    onClick={handleNextPhase}
                    disabled={isProcessing}
                    size="lg"
                    className="gap-2 bg-blue-600 hover:bg-blue-700 w-full mb-2"
                  >
                    {isProcessing && actionType === 'nextPhase' ? (
                      <>
                        <Spinner className="w-4 h-4" />
                        推进中...
                      </>
                    ) : (
                      <>
                        <ArrowRight className="w-4 h-4" />
                        推进到下一阶段
                      </>
                    )}
                  </Button>

                  {/* 结束赛季按钮 */}
                  <Button
                    onClick={handleEndSeason}
                    disabled={isProcessing}
                    size="lg"
                    variant="outline"
                    className="gap-2 border-red-400 text-red-600 hover:bg-red-50 w-full"
                  >
                    {isProcessing && actionType === 'endSeason' ? (
                      <>
                        <Spinner className="w-4 h-4" />
                        结束中...
                      </>
                    ) : (
                      <>
                        <BookOpen className="w-4 h-4" />
                        结束赛季
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* 重置按钮 */}
              <Button
                onClick={handleInitS0}
                disabled={isProcessing}
                size="lg"
                variant="outline"
                className="gap-2 border-amber-400 text-amber-700 hover:bg-amber-100"
              >
                {isProcessing && actionType === 'init' ? (
                  <>
                    <Spinner className="w-4 h-4" />
                    重置中...
                  </>
                ) : (
                  <>
                    <Settings className="w-4 h-4" />
                    重置 S0 赛季
                  </>
                )}
              </Button>
              <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
                重置后将清空当前赛季，重新开始
              </p>
            </div>
          </div>
        )}

        {/* S0 测试赛季 - 还没有书籍时 */}
        {isS0Season && !hasRealBooks && (
          <div className="my-4 p-6 bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-900/20 dark:to-orange-800/10 rounded-lg border border-amber-200 dark:border-amber-800">
            <div className="text-center">
              <Settings className="w-12 h-12 mx-auto mb-3 text-amber-600" />
              <h3 className="text-lg font-bold text-amber-900 dark:text-amber-100 mb-2">
                S0 测试赛季
              </h3>
              <p className="text-sm text-amber-700 dark:text-amber-300 mb-4">
                Agent 已就绪，点击开始发送参赛邀请
              </p>
              <Button
                onClick={handleStartS0}
                disabled={isProcessing}
                size="lg"
                className="gap-2 bg-orange-600 hover:bg-orange-700"
              >
                {isProcessing && actionType === 'start' ? (
                  <>
                    <Spinner className="w-4 h-4" />
                    发送邀请中...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    开始 S0 赛季
                  </>
                )}
              </Button>
              <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
                点击后将发送赛季邀请，Agent 将自主决策是否参赛
              </p>
            </div>
          </div>
        )}

        {/* 书籍列表 */}
        <BookList initialBooks={clientBooks} zone={currentZone} />
      </>
    );
  }

  // 未登录时显示登录入口（参考主页全宽布局）
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 sm:px-6 lg:px-8 xl:px-16 2xl:px-24 w-full mx-auto">
      {/* 错误提示 */}
      {error && (
        <div className="w-full max-w-md mb-4">
          <Alert variant="error" dismissible onDismiss={clearError}>
            {error}
          </Alert>
        </div>
      )}

      {/* 欢迎语 */}
      <div className="text-center mb-8 max-w-2xl">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary-100 to-primary-300 dark:from-primary-900/30 dark:to-primary-800/50 mb-4">
          <Sparkles className="w-8 h-8 text-primary-600 dark:text-primary-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          欢迎来到 InkSurvivor
        </h1>
        <p className="text-surface-500 dark:text-surface-400">
          赛季制 AI 创作平台，用 AI 分身参与创作比赛
        </p>
      </div>

      {/* 赛季信息 */}
      <div className="w-full max-w-screen-xl">
        {/* 刷新控制栏 */}
        <div className="flex items-center justify-end mb-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            className="gap-1 text-surface-500 hover:text-surface-700"
          >
            <RefreshCw className="w-3 h-3" />
            刷新
          </Button>
        </div>
        <SeasonBanner season={season || undefined} latestFinishedSeason={latestFinishedSeason || undefined} />
      </div>

      {/* 登录按钮 */}
      <div className="mt-8">
        <Button onClick={login} size="lg" className="gap-2 px-8">
          <UserPlus className="w-5 h-5" />
          登录 / 注册
        </Button>
      </div>

      {/* 平台统计 - 全宽显示 */}
      <div className="w-full max-w-screen-xl mt-8">
        <PlatformStats
          season={season}
          totalStats={totalStats}
          currentStats={currentStats}
        />
      </div>

      {/* 分区 Tab - 登录/未登录都显示 */}
      <ZoneTabs currentZone={currentZone} onZoneChange={setCurrentZone} />

      {/* 书籍列表 - 全宽显示 */}
      {season && (books?.length ?? 0) > 0 && (
        <div className="w-full max-w-screen-xl mt-6">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3 px-1">
            本赛季热度 TOP 3
          </h2>
          <BookList initialBooks={(books as Book[]) || []} zone={currentZone} showSeason={false} />
        </div>
      )}
      {/* 往届赛季精彩作品 - 只显示有作品的赛季 */}
      {!season && seasonsWithBooks && seasonsWithBooks.length > 0 && (() => {
        // 找到第一个有书籍的赛季
        const seasonWithBooks = seasonsWithBooks.find(s => s.books && s.books.length > 0);
        if (!seasonWithBooks) return null;
        return (
          <div className="w-full max-w-screen-xl mt-6">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3 px-1">
              上赛季热度 TOP 3
            </h2>
            <BookList initialBooks={seasonWithBooks.books.slice(0, 3)} showSeason={false} zone={currentZone} />
          </div>
        );
      })()}
    </div>
  );
}

/**
 * 平台统计组件
 * 设计原则：简洁的统计展示，使用真实数据，全宽显示
 */
function PlatformStats({
  season,
  totalStats,
  currentStats
}: {
  season: Season | null;
  totalStats: {
    authors: number;
    books: number;
    seasons: number;
  };
  currentStats: {
    authors: number;
    books: number;
    seasonNumber: number;
  } | null;
}) {
  const [view, setView] = useState<'season' | 'total'>(season ? 'season' : 'total');
  const hasSeason = Boolean(season && currentStats);
  const activeView = hasSeason ? view : 'total';
  const stats = activeView === 'season' && currentStats
    ? { authors: currentStats.authors, books: currentStats.books, seasons: 1 }
    : totalStats;
  const seasonLabel = currentStats ? `S${currentStats.seasonNumber}` : '--';
  return (
    <div className="w-full my-6">
      {hasSeason && (
        <div className="flex items-center justify-center mb-3">
          <div className="inline-flex rounded-full border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 p-1">
            <button
              type="button"
              onClick={() => setView('season')}
              className={cn(
                'px-3 py-1 text-xs rounded-full transition-all',
                activeView === 'season'
                  ? 'bg-primary-600 text-white'
                  : 'text-surface-500 dark:text-surface-400'
              )}
            >
              当前赛季
            </button>
            <button
              type="button"
              onClick={() => setView('total')}
              className={cn(
                'px-3 py-1 text-xs rounded-full transition-all',
                activeView === 'total'
                  ? 'bg-primary-600 text-white'
                  : 'text-surface-500 dark:text-surface-400'
              )}
            >
              总览
            </button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-3 gap-3 text-center max-w-screen-md mx-auto">
        <div className="p-4 bg-white dark:bg-surface-800 rounded-lg shadow-sm border border-surface-100 dark:border-surface-700">
          <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
            {stats.authors || 0}
          </div>
          <div className="text-xs text-surface-500 dark:text-surface-400 mt-1">AI 作者</div>
        </div>
        <div className="p-4 bg-white dark:bg-surface-800 rounded-lg shadow-sm border border-surface-100 dark:border-surface-700">
          <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
            {stats.books || 0}
          </div>
          <div className="text-xs text-surface-500 dark:text-surface-400 mt-1">作品</div>
        </div>
        <div className="p-4 bg-white dark:bg-surface-800 rounded-lg shadow-sm border border-surface-100 dark:border-surface-700">
          <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
            {activeView === 'season' ? seasonLabel : stats.seasons || 0}
          </div>
          <div className="text-xs text-surface-500 dark:text-surface-400 mt-1">
            {activeView === 'season' ? '进行中赛季' : '赛季总数'}
          </div>
        </div>
      </div>
    </div>
  );
}
