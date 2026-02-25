'use client';

import { useTheme } from '@/components/providers/theme-provider';
import { Sun, Moon, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';

const THEME_CONFIG = {
  light: {
    icon: Sun,
    label: '明亮',
    ariaLabel: '切换到明亮模式',
  },
  dark: {
    icon: Moon,
    label: '暗色',
    ariaLabel: '切换到暗色模式',
  },
  system: {
    icon: Monitor,
    label: '跟随系统',
    ariaLabel: '切换到跟随系统',
  },
};

const THEME_ORDER = ['light', 'dark', 'system'] as const;

/**
 * 主题切换按钮组件
 * 点击在 明亮 -> 暗色 -> 跟随系统 之间循环切换
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const handleClick = () => {
    const currentIndex = THEME_ORDER.indexOf(theme);
    const nextIndex = (currentIndex + 1) % THEME_ORDER.length;
    setTheme(THEME_ORDER[nextIndex]);
  };

  // 获取当前主题配置
  const currentConfig = THEME_CONFIG[theme];
  const Icon = currentConfig.icon;

  return (
    <button
      onClick={handleClick}
      className={cn(
        'relative flex items-center justify-center p-2 rounded-lg transition-all duration-200',
        'text-surface-600 hover:text-surface-900 dark:text-surface-400 dark:hover:text-surface-100',
        'hover:bg-surface-100 dark:hover:bg-surface-800',
        'focus:outline-none focus:ring-2 focus:ring-primary-500',
        className
      )}
      aria-label={currentConfig.ariaLabel}
      title={currentConfig.label}
    >
      <Icon className="w-5 h-5 transition-transform duration-300" />

      {/* 主题图标动画容器 */}
      <span className="sr-only">
        当前主题: {currentConfig.label}
        {theme === 'system' && ` (${resolvedTheme === 'dark' ? '暗色' : '明亮'})`}
      </span>
    </button>
  );
}

/**
 * 主题切换下拉菜单版本
 * 显示当前主题并支持下拉选择
 */
export function ThemeToggleDropdown({ className }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const currentConfig = THEME_CONFIG[theme];

  return (
    <div className={cn('relative inline-block', className)}>
      <button
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200',
          'text-surface-600 hover:text-surface-900 dark:text-surface-400 dark:hover:text-surface-100',
          'hover:bg-surface-100 dark:hover:bg-surface-800',
          'focus:outline-none focus:ring-2 focus:ring-primary-500'
        )}
        aria-label={`当前主题: ${currentConfig.label}，点击切换`}
        aria-haspopup="true"
      >
        <currentConfig.icon className="w-5 h-5" />
        <span className="text-sm font-medium hidden sm:inline">{currentConfig.label}</span>
      </button>

      {/* 下拉菜单 */}
      <div className="absolute right-0 mt-2 w-36 bg-white dark:bg-surface-800 rounded-xl shadow-lg border border-gray-100 dark:border-surface-700 py-1 z-50 opacity-0 invisible transform scale-95 transition-all duration-200">
        {THEME_ORDER.map((t) => {
          const config = THEME_CONFIG[t];
          const isActive = theme === t;

          return (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                isActive
                  ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                  : 'text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700'
              )}
            >
              <config.icon className="w-4 h-4" />
              <span>{config.label}</span>
              {t === 'system' && (
                <span className="text-xs text-surface-400 ml-auto">
                  ({resolvedTheme === 'dark' ? '暗' : '亮'})
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
