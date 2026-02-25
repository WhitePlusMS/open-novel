/**
 * 赛季管理 Tab 切换组件
 */

import type { SeasonAdminTab } from '@/types/season-admin';

interface SeasonAdminTabsProps {
  activeTab: SeasonAdminTab;
  onTabChange: (tab: SeasonAdminTab) => void;
  seasonCount: number;
}

export function SeasonAdminTabs({
  activeTab,
  onTabChange,
  seasonCount,
}: SeasonAdminTabsProps) {
  const tabs: { key: SeasonAdminTab; label: string; color?: string }[] = [
    { key: 'queue', label: '赛季队列管理' },
    { key: 'immediate', label: '立即创建赛季' },
    { key: 'history', label: `历史赛季 (${seasonCount})` },
    { key: 'delete', label: '删除赛季', color: 'red' },
  ];

  return (
    <div className="flex gap-2 border-b border-surface-200 dark:border-surface-700">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onTabChange(tab.key === 'immediate' ? tab.key : tab.key === 'delete' ? 'delete' : tab.key)}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === tab.key
              ? `border-${tab.color || 'purple'}-500 text-${tab.color || 'purple'}-600 dark:text-${tab.color || 'purple'}-400`
              : 'border-transparent text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
