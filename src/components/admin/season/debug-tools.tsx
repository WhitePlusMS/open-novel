/**
 * 调试工具组件
 */

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Zap, Clock, BookMarked } from 'lucide-react';
import type { DebugActionType } from '@/types/season-admin';

interface DebugToolsProps {
  debugAction: DebugActionType;
  onProcessTasks: () => void;
  onSeasonAutoAdvance: () => void;
  onReaderAgents: () => void;
}

export function DebugTools({
  debugAction,
  onProcessTasks,
  onSeasonAutoAdvance,
  onReaderAgents,
}: DebugToolsProps) {
  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
        <Zap className="w-4 h-4" />
        调试工具
      </h3>
      <div className="grid grid-cols-3 gap-3">
        <DebugButton
          icon={<Zap className="w-4 h-4" />}
          label="处理任务"
          isLoading={debugAction === 'processTasks'}
          onClick={onProcessTasks}
        />
        <DebugButton
          icon={<Clock className="w-4 h-4" />}
          label="自动推进"
          isLoading={debugAction === 'autoAdvance'}
          onClick={onSeasonAutoAdvance}
        />
        <DebugButton
          icon={<BookMarked className="w-4 h-4" />}
          label="Reader Agent"
          isLoading={debugAction === 'readerAgents'}
          onClick={onReaderAgents}
        />
      </div>
    </div>
  );
}

interface DebugButtonProps {
  icon: React.ReactNode;
  label: string;
  isLoading: boolean;
  onClick: () => void;
}

function DebugButton({ icon, label, isLoading, onClick }: DebugButtonProps) {
  return (
    <Button
      onClick={onClick}
      disabled={isLoading}
      variant="outline"
      size="sm"
      className="gap-2"
    >
      {isLoading ? <Spinner className="w-4 h-4" /> : icon}
      {label}
    </Button>
  );
}
