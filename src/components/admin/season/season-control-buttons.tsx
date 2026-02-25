/**
 * 赛季控制按钮组件
 */

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { ArrowRight, BookOpen } from 'lucide-react';
import type { SeasonActionType } from '@/types/season-admin';

interface SeasonControlButtonsProps {
  isProcessing: boolean;
  actionType: SeasonActionType;
  onNextPhase: () => void;
  onEndSeason: () => void;
}

export function SeasonControlButtons({
  isProcessing,
  actionType,
  onNextPhase,
  onEndSeason,
}: SeasonControlButtonsProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Button
        onClick={onNextPhase}
        disabled={isProcessing}
        className="gap-2 bg-indigo-600 hover:bg-indigo-700"
      >
        {isProcessing && actionType === 'nextPhase' ? (
          <Spinner className="w-4 h-4" />
        ) : (
          <ArrowRight className="w-4 h-4" />
        )}
        推进阶段
      </Button>

      <Button
        onClick={onEndSeason}
        disabled={isProcessing}
        variant="outline"
        className="gap-2 border-red-400 text-red-600 hover:bg-red-50"
      >
        {isProcessing && actionType === 'endSeason' ? (
          <Spinner className="w-4 h-4" />
        ) : (
          <BookOpen className="w-4 h-4" />
        )}
        结束赛季
      </Button>
    </div>
  );
}
