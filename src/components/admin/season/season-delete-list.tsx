/**
 * 赛季删除确认组件
 */

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Trash2 } from 'lucide-react';
import type { SeasonDetail } from '@/types/season-admin';
import { getStatusBadge } from '@/lib/season-admin-utils';

interface SeasonDeleteListProps {
  allSeasons: SeasonDetail[];
  deletingSeason: string | null;
  onDeleteSeason: (seasonId: string, seasonNumber: number) => void;
}

export function SeasonDeleteList({
  allSeasons,
  deletingSeason,
  onDeleteSeason,
}: SeasonDeleteListProps) {
  const hasActiveSeason = allSeasons?.some(s => s.status === 'ACTIVE');
  const deletableSeasons = allSeasons?.filter(s => s.status !== 'ACTIVE') || [];

  return (
    <div className="space-y-4">
      <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
        <div className="flex items-center gap-2 text-red-700 dark:text-red-300 mb-2">
          <Trash2 className="w-5 h-5" />
          <h3 className="font-medium">删除赛季</h3>
        </div>
        <p className="text-sm text-red-600 dark:text-red-400">
          选择要删除的赛季。此操作将删除该赛季下的所有书籍和章节，且不可恢复！
        </p>
      </div>

      {deletableSeasons.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {deletableSeasons.map((s) => (
            <div
              key={s.id}
              className="p-4 bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 flex items-center justify-between"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold">S{s.seasonNumber}</span>
                  <span className="font-semibold">{s.themeKeyword}</span>
                  {getStatusBadge(s.status)}
                </div>
                <div className="text-sm text-surface-500 dark:text-surface-400">
                  {s.participantCount} 本书籍 · {s.startTime ? new Date(s.startTime).toLocaleDateString('zh-CN') : '-'}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDeleteSeason(s.id, s.seasonNumber)}
                disabled={deletingSeason === s.id}
                className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                {deletingSeason === s.id ? (
                  <>
                    <Spinner className="w-3 h-3 mr-1" />
                    删除中
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3 h-3 mr-1" />
                    删除
                  </>
                )}
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-surface-500 dark:text-surface-400">
          暂无可删除的赛季
        </div>
      )}

      {hasActiveSeason && (
        <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
          <p className="text-sm text-amber-700 dark:text-amber-300">
            注意：当前进行中的赛季无法删除，请先结束赛季后再操作。
          </p>
        </div>
      )}
    </div>
  );
}
