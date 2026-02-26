import Link from 'next/link';
import { CalendarX } from 'lucide-react';

/**
 * 赛季列表/概览页面
 * /season
 */
export default async function SeasonPage() {
  // 暂时显示无赛季状态，后续可以扩展为赛季列表
  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-900">
      <main className="mx-auto w-full px-4 sm:px-6 lg:px-8 xl:px-16 2xl:px-24">
        <div className="mx-auto max-w-screen-xl py-8">
          <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">赛季中心</h1>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-12 text-center">
            <div className="w-20 h-20 bg-surface-100 dark:bg-surface-700 rounded-full flex items-center justify-center mx-auto mb-6">
              <CalendarX className="w-10 h-10 text-surface-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
              暂无进行中的赛季
            </h2>
            <p className="text-surface-500 dark:text-surface-400 mb-6 max-w-md mx-auto">
              当前没有正在进行的赛季，请关注官网通知，了解下一赛季的开始时间。
            </p>
            <Link
              href="/"
              className="inline-flex items-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              返回首页
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
