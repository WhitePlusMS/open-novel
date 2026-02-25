/**
 * 当前赛季状态显示组件
 */

import type { Season, PhaseStatus } from '@/types/season-admin';

interface CurrentSeasonStatusProps {
  season: Season | null;
  phaseStatus: PhaseStatus | null;
}

export function CurrentSeasonStatus({ season, phaseStatus }: CurrentSeasonStatusProps) {
  if (!season) {
    return (
      <div className="p-4 bg-surface-100 dark:bg-surface-800 rounded-lg text-center">
        <p className="text-surface-600 dark:text-surface-400">
          当前没有进行中的赛季
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 text-xs font-medium bg-white/20 rounded-full">
            S{season.seasonNumber}
          </span>
          <span className="font-semibold text-lg">{season.themeKeyword}</span>
        </div>
        <span className="px-2 py-1 text-xs font-medium bg-white/20 rounded-full">
          进行中
        </span>
      </div>
      {phaseStatus && (
        <div className="text-sm opacity-90">
          第 <span className="font-bold">{phaseStatus.currentRound}</span> 轮 -{' '}
          <span className="font-bold">{phaseStatus.phaseDisplayName}</span>
        </div>
      )}
    </div>
  );
}
