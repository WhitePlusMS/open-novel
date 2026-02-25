/**
 * 管理员页面 - 赛季管理
 * 仅 WhitePlusMS 账号可访问完整管理功能
 * 其他用户可查看历史赛季
 */

import { prisma } from '@/lib/prisma';
import { checkAdminPermission } from '@/lib/utils/admin';
import { AdminSeasonClient } from './admin-season-client';
import { JsonValue } from '@prisma/client/runtime/library';

// 强制动态渲染（避免静态预渲染时访问数据库失败）
export const dynamic = 'force-dynamic';

// 赛季详情接口
interface SeasonDetail {
  id: string;
  seasonNumber: number;
  themeKeyword: string;
  status: string;
  constraints: string[];
  zoneStyles: string[];
  maxChapters: number;
  minChapters: number;
  roundDuration: number;
  rewards: Record<string, number>;
  startTime: Date | null;
  endTime: Date | null;
  participantCount: number;
  currentRound: number;
  roundPhase: string;
  roundStartTime: Date | null;
}

export default async function AdminPage() {
  // 服务器端验证管理员权限
  const { isAdmin, nickname } = await checkAdminPermission();

  // 获取当前赛季状态
  const currentSeason = await prisma.season.findFirst({
    where: { status: 'ACTIVE' },
    orderBy: { startTime: 'desc' },
  });

  // 获取所有历史赛季（包括 FINISHED）
  const allSeasons = await prisma.season.findMany({
    orderBy: { seasonNumber: 'desc' },
    take: 20, // 最近 20 个赛季
  });

  // 解析赛季详情
  const parseSeasonDetail = (season: {
    id: string;
    seasonNumber: number;
    themeKeyword: string;
    status: string;
    constraints: JsonValue;
    zoneStyles: JsonValue;
    maxChapters: number;
    minChapters: number;
    roundDuration: number;
    rewards: JsonValue;
    startTime: Date | null;
    endTime: Date | null;
    participantCount: number;
    currentRound: number;
    roundPhase: string | null;
    roundStartTime: Date | null;
  }): SeasonDetail => {
    const parseJsonField = (field: JsonValue): unknown => {
      if (typeof field === 'string') {
        try {
          return JSON.parse(field);
        } catch {
          return field;
        }
      }
      return field;
    };

    const constraints = parseJsonField(season.constraints);
    const zoneStyles = parseJsonField(season.zoneStyles);
    const rewards = parseJsonField(season.rewards) as Record<string, number> | null;

    return {
      id: season.id,
      seasonNumber: season.seasonNumber,
      themeKeyword: season.themeKeyword,
      status: season.status,
      constraints: Array.isArray(constraints) ? constraints : [],
      zoneStyles: Array.isArray(zoneStyles) ? zoneStyles : [],
      maxChapters: season.maxChapters,
      minChapters: season.minChapters,
      roundDuration: season.roundDuration || 20,
      rewards: rewards || {},
      startTime: season.startTime,
      endTime: season.endTime,
      participantCount: season.participantCount,
      currentRound: season.currentRound || 1,
      roundPhase: season.roundPhase || 'NONE',
      roundStartTime: season.roundStartTime,
    };
  };

  // 格式化赛季详情为可序列化对象
  const allSeasonsData = allSeasons.map(parseSeasonDetail);

  // 获取赛季状态（用于阶段推进）
  let phaseStatus = null;
  if (currentSeason) {
    phaseStatus = {
      currentRound: currentSeason.currentRound || 1,
      currentPhase: currentSeason.roundPhase || 'NONE',
      phaseDisplayName: getPhaseDisplayName(currentSeason.roundPhase as string || 'NONE'),
    };
  }

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-900">
      <main className="mx-auto w-full px-4 sm:px-6 lg:px-8 xl:px-16 2xl:px-24 py-8">
        <div className="mx-auto max-w-screen-xl">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              {isAdmin ? '赛季管理' : '历史赛季'}
            </h1>
            {isAdmin && (
              <p className="text-surface-500 dark:text-surface-400">
                管理员：{nickname}
              </p>
            )}
          </div>

          <AdminSeasonClient
            isAdmin={isAdmin}
            season={currentSeason ? {
              id: currentSeason.id,
              seasonNumber: currentSeason.seasonNumber,
              themeKeyword: currentSeason.themeKeyword,
              status: currentSeason.status,
            } : null}
            phaseStatus={phaseStatus}
            allSeasons={allSeasonsData}
          />
        </div>
      </main>
    </div>
  );
}

function getPhaseDisplayName(phase: string): string {
  const names: Record<string, string> = {
    NONE: '未开始',
    AI_WORKING: 'AI创作期',
    HUMAN_READING: '人类阅读期',
  };
  return names[phase] || phase;
}
