/**
 * 立即创建赛季表单组件
 */

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Play } from 'lucide-react';
import type { SeasonConfigForm, SeasonActionType } from '@/types/season-admin';
import { ALL_ZONES } from '@/lib/season-admin-utils';

interface ImmediateCreateFormProps {
  configForm: SeasonConfigForm;
  isProcessing: boolean;
  actionType: SeasonActionType;
  onConfigChange: (field: keyof SeasonConfigForm, value: string | number) => void;
  onRoundDurationChange: (value: number) => void;
  onRewardChange: (field: 'rewardFirst' | 'rewardSecond' | 'rewardThird', value: number) => void;
  onCreateNow: () => void;
}

export function ImmediateCreateForm({
  configForm,
  isProcessing,
  actionType,
  onConfigChange,
  onRoundDurationChange,
  onRewardChange,
  onCreateNow,
}: ImmediateCreateFormProps) {
  return (
    <div className="p-4 bg-surface-50 dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700">
      <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
        <Play className="w-4 h-4 text-green-600" />
        立即创建赛季
      </h3>

      <div className="grid gap-4">
        {/* 赛季编号、最小章节、最大章节 */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              赛季编号
            </label>
            <Input
              type="number"
              value={configForm.seasonNumber}
              onChange={(e) => onConfigChange('seasonNumber', parseInt(e.target.value) || 1)}
              min={1}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              最小章节
            </label>
            <Input
              type="number"
              value={configForm.minChapters}
              onChange={(e) => onConfigChange('minChapters', parseInt(e.target.value) || 3)}
              min={1}
              max={20}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              最大章节
            </label>
            <Input
              type="number"
              value={configForm.maxChapters}
              onChange={(e) => onConfigChange('maxChapters', parseInt(e.target.value) || 7)}
              min={1}
              max={20}
              className="w-full"
            />
          </div>
        </div>

        {/* 赛季主题 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            赛季主题 *
          </label>
          <Input
            value={configForm.themeKeyword}
            onChange={(e) => onConfigChange('themeKeyword', e.target.value)}
            placeholder="如：赛博朋克、科幻未来、古风穿越"
            className="w-full"
          />
        </div>

        {/* 硬性约束 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            硬性约束
          </label>
          <Textarea
            value={configForm.constraints}
            onChange={(e) => onConfigChange('constraints', e.target.value)}
            placeholder="不能出现真实地名&#10;主角必须有成长弧线"
            rows={2}
            className="w-full"
          />
        </div>

        {/* 全部分区提示 */}
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
            <span>本赛季支持所有分区：{ALL_ZONES.map(z => z.label).join('、')}</span>
          </div>
        </div>

        {/* 轮次时长 */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              轮次时长(分钟)
            </label>
            <Input
              type="number"
              value={configForm.roundDuration}
              onChange={(e) => onRoundDurationChange(parseInt(e.target.value) || 20)}
              min={6}
              className="w-full"
            />
          </div>
        </div>

        {/* 奖励配置 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            奖励配置 (Ink)
          </label>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="flex items-center gap-1 text-sm text-yellow-600 mb-1">
                🥇 一等奖
              </div>
              <Input
                type="number"
                value={configForm.rewardFirst}
                onChange={(e) => onRewardChange('rewardFirst', parseInt(e.target.value) || 0)}
                min={0}
                className="w-full"
                placeholder="1000"
              />
            </div>
            <div>
              <div className="flex items-center gap-1 text-sm text-gray-500 mb-1">
                🥈 二等奖
              </div>
              <Input
                type="number"
                value={configForm.rewardSecond}
                onChange={(e) => onRewardChange('rewardSecond', parseInt(e.target.value) || 0)}
                min={0}
                className="w-full"
                placeholder="500"
              />
            </div>
            <div>
              <div className="flex items-center gap-1 text-sm text-amber-700 mb-1">
                🥉 三等奖
              </div>
              <Input
                type="number"
                value={configForm.rewardThird}
                onChange={(e) => onRewardChange('rewardThird', parseInt(e.target.value) || 0)}
                min={0}
                className="w-full"
                placeholder="200"
              />
            </div>
          </div>
        </div>

        {/* 创建按钮 */}
        <Button
          onClick={onCreateNow}
          disabled={isProcessing || !configForm.themeKeyword.trim()}
          className="w-full gap-2 bg-green-600 hover:bg-green-700"
        >
          {isProcessing && actionType === 'start' ? (
            <>
              <Spinner className="w-4 h-4" />
              创建中...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              立即创建并开始赛季
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
