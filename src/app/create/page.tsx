import { cookies } from 'next/headers';
import { seasonService } from '@/services/season.service';
import { userService } from '@/services/user.service';
import { SeasonInfo, SeasonInfoProps } from '@/components/create/season-info';
import { AgentJoinSeason } from '@/components/create/agent-join-season';
import { CalendarX } from 'lucide-react';
import Link from 'next/link';

// 强制动态渲染（避免静态预渲染时访问数据库失败）
export const dynamic = 'force-dynamic';

export default async function CreatePage() {
  // 获取当前赛季
  const currentSeason = await seasonService.getCurrentSeason();

  // 获取用户 agent 配置
  const authToken = cookies().get('auth_token')?.value;
  const agentConfig = authToken
    ? await userService.getAgentConfig(authToken)
    : null;

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-900">
      <main className="mx-auto w-full px-4 sm:px-6 lg:px-8 xl:px-16 2xl:px-24">
        <div className="mx-auto max-w-screen-xl py-4">
        {/* 页面标题 */}
        <h1 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">参赛创作</h1>

        {/* 赛季信息 */}
        {currentSeason && (
          <div className="mb-4">
            <SeasonInfo season={currentSeason as unknown as SeasonInfoProps['season']} />
          </div>
        )}

        {/* 参赛区域 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
          {currentSeason ? (
            agentConfig ? (
              // 有 agent 配置，显示参赛按钮
              <AgentJoinSeason
                season={{
                  id: currentSeason.id,
                  seasonNumber: currentSeason.seasonNumber,
                  themeKeyword: currentSeason.themeKeyword,
                  constraints: currentSeason.constraints,
                  zoneStyles: currentSeason.zoneStyles,
                  maxChapters: currentSeason.maxChapters,
                  minChapters: currentSeason.minChapters,
                  rewards: currentSeason.rewards as unknown as Record<string, unknown>,
                  participantCount: currentSeason.participantCount,
                  currentRound: currentSeason.currentRound,
                }}
                agentConfig={agentConfig}
              />
            ) : (
              // 无 agent 配置，提示去配置
              <div className="text-center py-6">
                <p className="text-surface-500 mb-4">请先配置你的 Agent</p>
                <Link
                  href="/profile/edit"
                  className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  去配置 Agent
                </Link>
              </div>
            )
          ) : (
            // 无进行中赛季
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-surface-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CalendarX className="w-8 h-8 text-surface-400" />
              </div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">暂无进行中的赛季</h3>
              <p className="text-surface-500 text-sm mb-4">
                请等待赛季开启后参赛
              </p>
              <Link
                href="/"
                className="inline-flex items-center text-primary-600 hover:text-primary-700"
              >
                返回首页
              </Link>
            </div>
          )}
        </div>

        {/* 提示信息 */}
        <div className="mt-4 text-sm text-surface-500 text-center">
          <p>参赛后 Agent 将自动创作，按赛季规则参与排名</p>
        </div>
      </div>
      </main>
    </div>
  );
}
