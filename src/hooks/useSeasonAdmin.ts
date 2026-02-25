/**
 * 赛季管理后台自定义 Hook
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type {
  SeasonQueueItem,
  SeasonConfigForm,
  LeaderboardData,
  SeasonAdminTab,
  SeasonActionType,
  DebugActionType,
} from '@/types/season-admin';
import { getDefaultConfigForm } from '@/lib/season-admin-utils';

// 赛季相关 API
const SEASON_QUEUE_API = '/api/admin/season-queue';
const SEASON_API = '/api/admin/seasons';

interface UseSeasonAdminOptions {
  seasonNumber: number;
  isAdmin: boolean;
}

/**
 * 赛季管理后台 Hook
 */
export function useSeasonAdmin({ seasonNumber, isAdmin }: UseSeasonAdminOptions) {
  const router = useRouter();

  // Tab 状态
  const [activeTab, setActiveTab] = useState<SeasonAdminTab>(isAdmin ? 'queue' : 'history');

  // 处理中状态
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionType, setActionType] = useState<SeasonActionType>(null);
  const [deletingSeason, setDeletingSeason] = useState<string | null>(null);
  const [debugAction, setDebugAction] = useState<DebugActionType>(null);

  // 调试按钮可见性
  const isLocalDev = typeof window !== 'undefined' &&
    window.location.hostname === 'localhost' &&
    window.location.port === '3000';

  // 赛季队列状态
  const [seasonQueue, setSeasonQueue] = useState<SeasonQueueItem[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [editingItem, setEditingItem] = useState<SeasonQueueItem | null>(null);
  const [optimizingItem, setOptimizingItem] = useState<string | null>(null);

  // 表单状态
  const [configForm, setConfigForm] = useState<SeasonConfigForm>(() =>
    getDefaultConfigForm(seasonNumber)
  );

  // 排行榜数据
  const [leaderboardData, setLeaderboardData] = useState<Record<string, LeaderboardData>>({});
  const leaderboardDataRef = useRef(leaderboardData);

  // 同步 leaderboardData 到 ref
  useEffect(() => {
    leaderboardDataRef.current = leaderboardData;
  }, [leaderboardData]);

  // 获取赛季排行榜
  const fetchSeasonLeaderboard = useCallback(async (seasonId: string) => {
    const currentData = leaderboardDataRef.current;
    if (currentData[seasonId]?.books?.length > 0 && !currentData[seasonId]?.loading) {
      return;
    }

    setLeaderboardData(prev => ({
      ...prev,
      [seasonId]: { ...prev[seasonId], loading: true, books: prev[seasonId]?.books || [] },
    }));

    try {
      const response = await fetch(`/api/seasons/${seasonId}/leaderboard?limit=10&type=heat`);
      const result = await response.json();
      if (result.code === 0 && result.data?.data) {
        setLeaderboardData(prev => ({
          ...prev,
          [seasonId]: {
            loading: false,
            books: result.data.data,
          },
        }));
      }
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
      setLeaderboardData(prev => ({
        ...prev,
        [seasonId]: { ...prev[seasonId], loading: false, books: [] },
      }));
    }
  }, []);

  // 获取赛季队列
  const fetchSeasonQueue = async () => {
    setQueueLoading(true);
    try {
      const response = await fetch(SEASON_QUEUE_API);
      const result = await response.json();
      if (result.code === 0) {
        setSeasonQueue(result.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch season queue:', err);
    } finally {
      setQueueLoading(false);
    }
  };

  // 初始化加载
  useEffect(() => {
    fetchSeasonQueue();
  }, []);

  // 重置表单
  const resetForm = useCallback(() => {
    const nextNumber = seasonQueue.length === 0
      ? seasonNumber + 1
      : Math.max(...seasonQueue.map(q => q.seasonNumber), seasonNumber) + 1;
    setConfigForm(getDefaultConfigForm(nextNumber));
    setEditingItem(null);
  }, [seasonQueue, seasonNumber]);

  // 配置表单变更处理
  const handleConfigChange = (field: keyof SeasonConfigForm, value: string | number) => {
    setConfigForm(prev => ({ ...prev, [field]: value }));
  };

  // 轮次时长变更处理（最小值 6 分钟）
  const handleRoundDurationChange = (value: number) => {
    setConfigForm(prev => ({ ...prev, roundDuration: Math.max(6, value) }));
  };

  // 奖励字段变更处理
  const handleRewardChange = (field: 'rewardFirst' | 'rewardSecond' | 'rewardThird', value: number) => {
    setConfigForm(prev => ({ ...prev, [field]: value }));
  };

  // 保存到队列
  const handleSaveToQueue = async () => {
    if (!configForm.themeKeyword.trim()) {
      alert('请输入赛季主题');
      return;
    }

    setIsProcessing(true);
    try {
      const payload = {
        seasonNumber: configForm.seasonNumber,
        themeKeyword: configForm.themeKeyword,
        constraints: configForm.constraints.split('\n').filter(Boolean),
        zoneStyles: configForm.zoneStyles,
        maxChapters: configForm.maxChapters,
        minChapters: configForm.minChapters,
        roundDuration: configForm.roundDuration,
        rewards: {
          first: configForm.rewardFirst,
          second: configForm.rewardSecond,
          third: configForm.rewardThird,
        },
        plannedStartTime: configForm.plannedStartTime || null,
        intervalHours: configForm.intervalHours,
      };

      let response;
      if (editingItem) {
        response = await fetch(`${SEASON_QUEUE_API}/${editingItem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        response = await fetch(SEASON_QUEUE_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const result = await response.json();
      if (result.code === 0) {
        alert(editingItem ? '更新成功' : '已添加到队列');
        fetchSeasonQueue();
        resetForm();
      } else {
        alert(result.message || '操作失败');
      }
    } catch (err) {
      alert('操作失败: ' + (err as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  // 立即创建赛季
  const handleCreateNow = async () => {
    if (!configForm.themeKeyword.trim()) {
      alert('请输入赛季主题');
      return;
    }

    setIsProcessing(true);
    setActionType('start');
    try {
      const response = await fetch('/api/admin/test/start-season', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seasonNumber: configForm.seasonNumber,
          themeKeyword: configForm.themeKeyword,
          constraints: configForm.constraints.split('\n').filter(Boolean),
          zoneStyles: configForm.zoneStyles,
          maxChapters: configForm.maxChapters,
          minChapters: configForm.minChapters,
          roundDuration: configForm.roundDuration,
          rewards: {
            first: configForm.rewardFirst,
            second: configForm.rewardSecond,
            third: configForm.rewardThird,
          },
        }),
      });
      const result = await response.json();
      if (result.code === 0) {
        alert(`赛季开始！${result.data.joinCount || 0} 个 Agent 参赛`);
        router.refresh();
      } else {
        alert(result.message || '开始失败');
      }
    } catch (err) {
      alert('开始失败: ' + (err as Error).message);
    } finally {
      setIsProcessing(false);
      setActionType(null);
    }
  };

  // 编辑队列中的赛季
  const handleEdit = (item: SeasonQueueItem) => {
    const rewards = item.rewards || { first: 1000, second: 500, third: 200 };

    setConfigForm({
      seasonNumber: item.seasonNumber,
      themeKeyword: item.themeKeyword,
      constraints: item.constraints.join('\n'),
      zoneStyles: item.zoneStyles,
      maxChapters: item.maxChapters,
      minChapters: item.minChapters,
      roundDuration: item.roundDuration || 20,
      rewardFirst: rewards.first || 1000,
      rewardSecond: rewards.second || 500,
      rewardThird: rewards.third || 200,
      plannedStartTime: item.plannedStartTime ? new Date(item.plannedStartTime).toISOString().slice(0, 16) : '',
      intervalHours: item.intervalHours,
    });
    setEditingItem(item);
    setActiveTab('queue');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 删除队列中的赛季
  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个赛季配置吗？')) return;

    try {
      const response = await fetch(`${SEASON_QUEUE_API}/${id}`, { method: 'DELETE' });
      const result = await response.json();
      if (result.code === 0) {
        fetchSeasonQueue();
        if (editingItem?.id === id) {
          resetForm();
        }
      } else {
        alert(result.message || '删除失败');
      }
    } catch (err) {
      alert('删除失败: ' + (err as Error).message);
    }
  };

  // LLM 优化
  const handleLLMOptimize = async (item: SeasonQueueItem) => {
    setOptimizingItem(item.id);
    try {
      const response = await fetch(`${SEASON_QUEUE_API}/${item.id}/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: '' }),
      });
      const result = await response.json();
      if (result.code === 0) {
        alert('优化建议已生成！请查看详情');
        fetchSeasonQueue();
      } else {
        alert(result.message || '优化失败');
      }
    } catch (err) {
      alert('优化失败: ' + (err as Error).message);
    } finally {
      setOptimizingItem(null);
    }
  };

  // 批量发布
  const handleBatchPublish = async (count: number) => {
    if (!confirm(`确定要立即发布 ${count} 个赛季吗？`)) return;

    setIsProcessing(true);
    try {
      const baseTime = new Date().toISOString();
      const response = await fetch(`${SEASON_QUEUE_API}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count, baseStartTime: baseTime }),
      });
      const result = await response.json();
      if (result.code === 0) {
        const published = result.data as unknown[];
        alert(`成功发布 ${published.length} 个赛季！`);
        fetchSeasonQueue();
        router.refresh();
      } else {
        alert(result.message || '发布失败');
      }
    } catch (err) {
      alert('发布失败: ' + (err as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  // 推进阶段
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
        alert(`推进成功！当前: 第 ${result.data?.currentRound} 轮 - ${result.data?.phaseDisplayName}`);
        router.refresh();
      } else {
        alert(result.message || '推进失败');
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
        alert('赛季已结束！');
        router.refresh();
      } else {
        alert(result.message || '结束失败');
      }
    } catch (err) {
      alert('结束失败: ' + (err as Error).message);
    } finally {
      setIsProcessing(false);
      setActionType(null);
    }
  };

  // 调试：处理任务队列
  const handleProcessTasks = async () => {
    setDebugAction('processTasks');
    try {
      const response = await fetch('/api/tasks/process-tasks', { method: 'POST' });
      const result = await response.json();
      alert(result.message || '任务已触发');
    } catch (err) {
      alert('触发失败: ' + (err as Error).message);
    } finally {
      setDebugAction(null);
    }
  };

  // 调试：赛季自动推进
  const handleSeasonAutoAdvance = async () => {
    setDebugAction('autoAdvance');
    try {
      const response = await fetch('/api/tasks/season-auto-advance', { method: 'GET' });
      const result = await response.json();
      alert(result.message || '执行完成');
    } catch (err) {
      alert('触发失败: ' + (err as Error).message);
    } finally {
      setDebugAction(null);
    }
  };

  // 调试：Reader Agent
  const handleReaderAgents = async () => {
    setDebugAction('readerAgents');
    try {
      const response = await fetch('/api/tasks/reader-agents', { method: 'POST' });
      const result = await response.json();
      alert(result.message || '任务已触发');
    } catch (err) {
      alert('触发失败: ' + (err as Error).message);
    } finally {
      setDebugAction(null);
    }
  };

  // 删除历史赛季
  const handleDeleteSeason = async (seasonId: string, seasonNumber: number) => {
    if (!confirm(`确定要删除 S${seasonNumber} 赛季吗？此操作将删除该赛季下的所有书籍和章节，且不可恢复！`)) {
      return;
    }

    if (!confirm(`再次确认：删除 S${seasonNumber} 赛季的所有数据？`)) {
      return;
    }

    setDeletingSeason(seasonId);
    try {
      const response = await fetch(`${SEASON_API}/${seasonId}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if (result.code === 0) {
        alert(`S${seasonNumber} 删除成功！\n共删除 ${result.data?.deletedBooks || 0} 本书籍和 ${result.data?.deletedChapters || 0} 个章节`);
        setLeaderboardData(prev => {
          const newData = { ...prev };
          delete newData[seasonId];
          return newData;
        });
        router.refresh();
      } else {
        alert(result.message || '删除失败');
      }
    } catch (err) {
      alert('删除失败: ' + (err as Error).message);
    } finally {
      setDeletingSeason(null);
    }
  };

  // 加载历史赛季排行榜
  const loadHistoryLeaderboards = useCallback((allSeasons: { id: string; status: string }[]) => {
    if (activeTab === 'history' && allSeasons && allSeasons.length > 0) {
      const finishedSeasons = allSeasons.filter(s => s.status !== 'ACTIVE');
      finishedSeasons.forEach(s => {
        fetchSeasonLeaderboard(s.id);
      });
    }
  }, [activeTab, fetchSeasonLeaderboard]);

  return {
    // 状态
    activeTab,
    setActiveTab,
    isProcessing,
    actionType,
    deletingSeason,
    debugAction,
    isLocalDev,

    // 队列状态
    seasonQueue,
    queueLoading,
    editingItem,
    optimizingItem,

    // 表单状态
    configForm,

    // 排行榜
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
    fetchSeasonQueue,
    loadHistoryLeaderboards,
  };
}
