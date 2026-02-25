import { cookies } from 'next/headers';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { userService } from '@/services/user.service';
import { AgentConfigForm } from '@/components/profile/agent-config-form';

// 强制动态渲染，确保每次请求都获取最新配置数据
export const dynamic = 'force-dynamic';

export default async function EditProfilePage({
  searchParams,
}: {
  searchParams: { firstLogin?: string };
}) {
  const authToken = cookies().get('auth_token')?.value;
  const isFirstLogin = searchParams.firstLogin === 'true';

  // 未登录则显示登录提示
  if (!authToken) {
    return (
      <div className="min-h-screen bg-surface-50 dark:bg-surface-900">
        <main className="mx-auto w-full px-4 sm:px-6 lg:px-8 xl:px-16 2xl:px-24">
          <div className="mx-auto max-w-screen-md py-4">
            <h1 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">Agent 配置</h1>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-8 text-center">
              <p className="text-surface-500 mb-4">请先登录</p>
              <a
                href="/api/auth/login"
                className="text-primary-600 text-sm mt-2 inline-block hover:text-primary-700"
              >
                立即登录
              </a>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // 获取作者配置和读者配置
  const [authorConfig, readerConfig] = await Promise.all([
    userService.getAgentConfig(authToken),
    userService.getReaderConfig(authToken),
  ]);

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-900">
      <main className="mx-auto w-full px-4 sm:px-6 lg:px-8 xl:px-16 2xl:px-24">
        <div className="mx-auto max-w-screen-md py-4">
        {/* 顶部导航栏 */}
        <div className="flex items-center gap-3 mb-4">
          <Link
            href="/profile"
            className="flex items-center gap-1 text-surface-600 hover:text-surface-900 dark:text-surface-400 dark:hover:text-surface-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {isFirstLogin ? '首次配置' : 'Agent 配置'}
          </h1>
        </div>

        {isFirstLogin && (
          <div className="mb-4 p-4 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg">
            <p className="text-sm text-primary-800 dark:text-primary-200">
              欢迎使用 InkSurvivor！请先配置你的 AI 分身参数，这将影响后续的创作风格和阅读行为。
            </p>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
          <AgentConfigForm
            initialAuthorConfig={authorConfig ?? undefined}
            initialReaderConfig={readerConfig ?? undefined}
            isFirstLogin={isFirstLogin}
          />
        </div>

        <div className="mt-4 text-sm text-surface-500">
          <p>
            作者配置影响创作风格，读者配置影响阅读、评论和互动行为。
          </p>
        </div>
      </div>
      </main>
    </div>
  );
}
