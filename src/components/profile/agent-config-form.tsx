'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { BookOpen, Eye } from 'lucide-react';
import { AuthorConfigForm } from './author-config-form';
import { ReaderConfigForm } from './reader-config-form';
import type { AuthorConfig, ReaderConfig, ConfigType } from '@/types/agent-config';
import { DEFAULT_AUTHOR_CONFIG, DEFAULT_READER_CONFIG } from '@/types/agent-config';

/**
 * Agent 配置表单组件 - 支持作者/读者角色切换
 */
export function AgentConfigForm({
  initialAuthorConfig,
  initialReaderConfig,
  isFirstLogin = false,
}: {
  initialAuthorConfig?: AuthorConfig;
  initialReaderConfig?: ReaderConfig;
  isFirstLogin?: boolean;
}) {
  const { success, error: showError } = useToast();
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [activeTab, setActiveTab] = useState<ConfigType>('author');

  const [authorConfig, setAuthorConfig] = useState<AuthorConfig>({
    ...DEFAULT_AUTHOR_CONFIG,
    ...initialAuthorConfig,
  });

  const [readerConfig, setReaderConfig] = useState<ReaderConfig>(
    initialReaderConfig || DEFAULT_READER_CONFIG
  );

  // 从 SecondMe 导入个人设置
  const handleImportFromSecondMe = async () => {
    setImporting(true);
    try {
      const response = await fetch('/api/user/secondme-params');
      const data = await response.json();

      if (!response.ok || data.code !== 0) {
        throw new Error(data.message || '获取 SecondMe 数据失败');
      }

      const { userInfo, shades, softMemory } = data.data || {};

      const parts: string[] = [];
      if (userInfo?.selfIntroduction) {
        parts.push(`自我介绍：${userInfo.selfIntroduction}`);
      }
      if (userInfo?.bio) {
        parts.push(`个人简介：${userInfo.bio}`);
      }
      if (shades && shades.length > 0) {
        const shadeNames = shades.map((s: { shadeNamePublic?: string; shadeName: string }) =>
          s.shadeNamePublic || s.shadeName
        ).join('、');
        parts.push(`兴趣标签：${shadeNames}`);
      }
      if (softMemory && softMemory.length > 0) {
        const memories = softMemory.slice(0, 3).map((m: { factContent: string }) => m.factContent).join('；');
        parts.push(`重要记忆：${memories}`);
      }

      const importText = parts.join('\n');

      if (activeTab === 'author') {
        setAuthorConfig({
          ...authorConfig,
          writerPersonality: importText || authorConfig.writerPersonality,
          secondMeBio: userInfo?.selfIntroduction || userInfo?.bio || '',
          secondMeShades: shades?.map((s: { shadeNamePublic?: string; shadeName: string }) => s.shadeNamePublic || s.shadeName) || [],
          secondMeSoftMemory: softMemory?.map((m: { factContent: string }) => m.factContent) || [],
        });
      } else {
        setReaderConfig({
          ...readerConfig,
          readerPersonality: importText || readerConfig.readerPersonality,
          secondMeBio: userInfo?.selfIntroduction || userInfo?.bio || '',
          secondMeShades: shades?.map((s: { shadeNamePublic?: string; shadeName: string }) => s.shadeNamePublic || s.shadeName) || [],
          secondMeSoftMemory: softMemory?.map((m: { factContent: string }) => m.factContent) || [],
        });
      }

      success('已从 SecondMe 导入个人设置');
    } catch (err) {
      const message = err instanceof Error ? err.message : '导入失败';
      showError(message);
    } finally {
      setImporting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      console.log('[AgentConfig] Saving author config...');
      const authorRes = await fetch('/api/user/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'author', ...authorConfig }),
      });

      const authorResult = await authorRes.json();
      console.log('[AgentConfig] Author save result:', authorResult);

      if (!authorRes.ok) {
        throw new Error(authorResult.message || '保存作者配置失败');
      }

      console.log('[AgentConfig] Saving reader config...');
      const readerRes = await fetch('/api/user/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'reader', ...readerConfig }),
      });

      const readerResult = await readerRes.json();
      console.log('[AgentConfig] Reader save result:', readerResult);

      if (!readerRes.ok) {
        throw new Error(readerResult.message || '保存读者配置失败');
      }

      console.log('[AgentConfig] All configs saved successfully');
      success('保存成功');
    } catch (err) {
      const message = err instanceof Error ? err.message : '保存失败';
      showError(message);
      console.error('[AgentConfig] Save error:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 角色切换 Tab */}
      <div className="flex gap-2 p-1 bg-surface-100 dark:bg-surface-800 rounded-lg">
        <button
          type="button"
          onClick={() => setActiveTab('author')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-all',
            activeTab === 'author'
              ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm'
              : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100'
          )}
        >
          <BookOpen className="w-4 h-4" />
          作者配置
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('reader')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-all',
            activeTab === 'reader'
              ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm'
              : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100'
          )}
        >
          <Eye className="w-4 h-4" />
          读者配置
        </button>
      </div>

      {/* 作者配置表单 */}
      {activeTab === 'author' && (
        <AuthorConfigForm
          config={authorConfig}
          importing={importing}
          onConfigChange={setAuthorConfig}
          onImportFromSecondMe={handleImportFromSecondMe}
        />
      )}

      {/* 读者配置表单 */}
      {activeTab === 'reader' && (
        <ReaderConfigForm
          config={readerConfig}
          importing={importing}
          onConfigChange={setReaderConfig}
          onImportFromSecondMe={handleImportFromSecondMe}
        />
      )}

      {/* 保存按钮 */}
      <Button onClick={handleSave} disabled={saving} className="w-full py-3">
        {saving ? '保存中...' : isFirstLogin ? '开始创作' : '保存配置'}
      </Button>
    </div>
  );
}
