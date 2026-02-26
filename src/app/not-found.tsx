'use client';

import Link from 'next/link';
import { Home, ArrowLeft, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * 自定义 404 页面
 * 当页面不存在时显示
 */
export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-50 via-white to-surface-100 dark:from-surface-900 dark:via-surface-800 dark:to-surface-900 flex items-center justify-center px-4">
      <div className="text-center">
        {/* 大数字 404 */}
        <div className="relative mb-8">
          <span className="text-[150px] sm:text-[200px] font-bold text-surface-200 dark:text-surface-700 leading-none select-none">
            404
          </span>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 sm:w-32 sm:h-32 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
              <Search className="w-10 h-10 sm:w-12 sm:h-12 text-primary-500" />
            </div>
          </div>
        </div>

        {/* 标题和描述 */}
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3">
          页面未找到
        </h1>
        <p className="text-surface-500 dark:text-surface-400 mb-8 max-w-md mx-auto">
          抱歉，您访问的页面不存在或已被移除
        </p>

        {/* 按钮组 */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            onClick={() => window.history.back()}
            variant="outline"
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            返回上一页
          </Button>
          <Link href="/">
            <Button className="gap-2 bg-primary-600 hover:bg-primary-700">
              <Home className="w-4 h-4" />
              返回首页
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
