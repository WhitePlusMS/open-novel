'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  CurrentSeasonStatus,
  SeasonConfigFormComponent,
  SeasonQueueList,
  SeasonHistoryList,
  SeasonDeleteList,
  ImmediateCreateForm,
  DebugTools,
  SeasonControlButtons,
} from '@/components/admin/season';
import { useSeasonAdmin } from '@/hooks/useSeasonAdmin';
import type { Season, PhaseStatus, SeasonDetail, SeasonAdminTab } from '@/types/season-admin';

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  colorClass?: string;
}

function TabButton({ active, onClick, children, colorClass = 'purple' }: TabButtonProps) {
  const activeClasses = {
    purple: 'border-purple-500 text-purple-600 dark:text-purple-400',
    red: 'border-red-500 text-red-600 dark:text-red-400',
  };
  const inactiveClasses = {
    purple: 'border-transparent text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100',
    red: 'border-transparent text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100',
  };

  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        active ? activeClasses[colorClass] : inactiveClasses[colorClass]
      }`}
    >
      {children}
    </button>
  );
}

/**
 * 管理员赛季管理客户端组件
 */
export function AdminSeasonClient({
  isAdmin,
  season,
  phaseStatus,
  allSeasons,
}: {
  isAdmin: boolean;
  season: Season | null;
  phaseStatus: PhaseStatus | null;
  allSeasons?: SeasonDetail[];
}) {
  const {
    // 状态
    activeTab,
    setActiveTab,
    isProcessing,
    actionType,
    deletingSeason,
    debugAction,
    isLocalDev,

    // 数据
    seasonQueue,
    queueLoading,
    editingItem,
    optimizingItem,
    configForm,
    leaderboardData,

    // 方法
    resetForm,
    handleConfigChange,
    handleRoundDurationChange,
    handleRewardChange,
    handleSaveToQueue,
    handleCreateNow,
    handleEdit,
    handleDelete,
    handleLLMOptimize,
    handleBatchPublish,
    handleNextPhase,
    handleEndSeason,
    handleProcessTasks,
    handleSeasonAutoAdvance,
    handleReaderAgents,
    handleDeleteSeason,
    loadHistoryLeaderboards,
  } = useSeasonAdmin({ seasonNumber: season?.seasonNumber || 0, isAdmin });

  // 加载历史赛季排行榜
  useEffect(() => {
    if (allSeasons) {
      loadHistoryLeaderboards(allSeasons);
    }
  }, [allSeasons, loadHistoryLeaderboards]);

  // 处理 Tab 切换
  const handleTabChange = (tab: SeasonAdminTab) => {
    if (tab === 'immediate') {
      resetForm();
    }
    setActiveTab(tab);
  };

  return (
    <div className="space-y-6">
      {/* 当前赛季状态 */}
      <CurrentSeasonStatus season={season} phaseStatus={phaseStatus} />

      {/* Tab 切换 - 仅管理员显示完整 Tab */}
      {isAdmin && (
        <div className="flex gap-2 border-b border-surface-200 dark:border-surface-700">
          <TabButton
            active={activeTab === 'queue'}
            onClick={() => setActiveTab('queue')}
          >
            赛季队列管理
          </TabButton>
          <TabButton
            active={activeTab === 'immediate'}
            onClick={() => handleTabChange('immediate')}
          >
            立即创建赛季
          </TabButton>
          <TabButton
            active={activeTab === 'history'}
            onClick={() => setActiveTab('history')}
          >
            历史赛季 ({allSeasons?.length || 0})
          </TabButton>
          <TabButton
            active={activeTab === 'delete'}
            onClick={() => setActiveTab('delete')}
            colorClass="red"
          >
            删除赛季
          </TabButton>
        </div>
      )}

      {/* 非管理员只显示历史赛季 Tab 标题 */}
      {!isAdmin && (
        <div className="mb-4">
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            历史赛季 ({allSeasons?.length || 0})
          </h2>
        </div>
      )}

      {/* 赛季队列管理 Tab */}
      {activeTab === 'queue' && isAdmin && (
        <div className="space-y-6">
          <SeasonConfigFormComponent
            configForm={configForm}
            editingItem={editingItem}
            isProcessing={isProcessing}
            onConfigChange={handleConfigChange}
            onRoundDurationChange={handleRoundDurationChange}
            onRewardChange={handleRewardChange}
            onSave={handleSaveToQueue}
            onReset={resetForm}
          />

          <SeasonQueueList
            seasonQueue={seasonQueue}
            loading={queueLoading}
            isProcessing={isProcessing}
            optimizingItem={optimizingItem}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onLLMOptimize={handleLLMOptimize}
            onBatchPublish={handleBatchPublish}
          />
        </div>
      )}

      {/* 立即创建 Tab */}
      {activeTab === 'immediate' && isAdmin && (
        <ImmediateCreateForm
          configForm={configForm}
          isProcessing={isProcessing}
          actionType={actionType}
          onConfigChange={handleConfigChange}
          onRoundDurationChange={handleRoundDurationChange}
          onRewardChange={handleRewardChange}
          onCreateNow={handleCreateNow}
        />
      )}

      {/* 历史赛季 Tab */}
      {activeTab === 'history' && (
        <SeasonHistoryList
          allSeasons={allSeasons || []}
          leaderboardData={leaderboardData}
          onDeleteSeason={handleDeleteSeason}
          deletingSeason={deletingSeason}
        />
      )}

      {/* 删除赛季 Tab */}
      {activeTab === 'delete' && isAdmin && (
        <SeasonDeleteList
          allSeasons={allSeasons || []}
          deletingSeason={deletingSeason}
          onDeleteSeason={handleDeleteSeason}
        />
      )}

      {/* 赛季控制按钮 - 仅管理员显示 */}
      {season && isAdmin && (
        <SeasonControlButtons
          isProcessing={isProcessing}
          actionType={actionType}
          onNextPhase={handleNextPhase}
          onEndSeason={handleEndSeason}
        />
      )}

      {/* 调试工具按钮 - 仅本地开发环境显示 */}
      {isAdmin && isLocalDev && (
        <DebugTools
          debugAction={debugAction}
          onProcessTasks={handleProcessTasks}
          onSeasonAutoAdvance={handleSeasonAutoAdvance}
          onReaderAgents={handleReaderAgents}
        />
      )}
    </div>
  );
}
