/**
 * 任务处理 Worker API
 * POST /api/tasks/process-tasks
 *
 * 从 TaskQueue 中获取任务并执行
 * 由外部 Cron Job 每分钟调用
 *
 * 支持的任务类型：
 * - ROUND_CYCLE: 轮次完整流程（大纲 → 章节 → AI评论）
 * - CATCH_UP: 追赶写作
 */

import { NextResponse } from 'next/server';
import { taskWorkerService } from '@/services/task-worker.service';
import { taskQueueService } from '@/services/task-queue.service';

export const dynamic = 'force-dynamic';
const globalState = globalThis as typeof globalThis & {
  __processTasksRunning?: boolean;
  __processTasksLastRun?: number;
};
const minIntervalMs = Number(process.env.PROCESS_TASKS_MIN_INTERVAL_MS || 20000);
const staleRunMs = Number(process.env.PROCESS_TASKS_STALE_MS || 10 * 60 * 1000);

async function runAndCleanup() {
  console.log('[ProcessTasks] 开始处理任务队列...');
  await taskWorkerService.triggerOnce();
  const cleanedCount = await taskQueueService.cleanup(24);
  console.log(`[ProcessTasks] 清理了 ${cleanedCount} 个旧任务`);
  console.log('[ProcessTasks] 任务处理完成');
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const syncParam = url.searchParams.get('sync');
  const forceSyncOnVercel = process.env.VERCEL === '1' && syncParam === null;
  const runAsync = forceSyncOnVercel ? false : syncParam !== '1';
  const nowMs = Date.now();
  console.log(`[ProcessTasks] 触发请求: now=${new Date(nowMs).toISOString()}, minIntervalMs=${minIntervalMs}, isRunning=${Boolean(globalState.__processTasksRunning)}, lastRun=${globalState.__processTasksLastRun ? new Date(globalState.__processTasksLastRun).toISOString() : 'none'}`);
  if (globalState.__processTasksRunning) {
    const lastRunMs = globalState.__processTasksLastRun;
    if (!lastRunMs || nowMs - lastRunMs > staleRunMs) {
      console.warn(`[ProcessTasks] 运行锁疑似卡死，自动释放: lastRun=${lastRunMs ? new Date(lastRunMs).toISOString() : 'none'}, staleRunMs=${staleRunMs}`);
      globalState.__processTasksRunning = false;
    }
  }
  if (globalState.__processTasksRunning) {
    console.log('[ProcessTasks] 跳过：已有任务处理中');
    return NextResponse.json({
      code: 0,
      data: { message: '任务处理中，跳过本次触发' },
      message: 'skipped',
    });
  }
  if (globalState.__processTasksLastRun && nowMs - globalState.__processTasksLastRun < minIntervalMs) {
    console.log('[ProcessTasks] 跳过：触发过于频繁');
    return NextResponse.json({
      code: 0,
      data: { message: '触发过于频繁，跳过本次触发' },
      message: 'skipped',
    });
  }
  globalState.__processTasksRunning = true;
  globalState.__processTasksLastRun = Date.now();
  console.log(`[ProcessTasks] 环境判断: NODE_ENV=${process.env.NODE_ENV}, VERCEL=${process.env.VERCEL}, runAsync=${runAsync}`);
  if (runAsync) {
    setImmediate(async () => {
      try {
        await runAndCleanup();
      } catch (error) {
        console.error('[ProcessTasks] 后台任务处理失败:', error);
      } finally {
        globalState.__processTasksRunning = false;
      }
    });
    return NextResponse.json({
      code: 0,
      data: { message: '任务已触发，将在后台异步执行' },
      message: 'triggered',
    });
  }

  try {
    await runAndCleanup();
    return NextResponse.json({
      code: 0,
      data: { message: '任务处理完成' },
      message: 'completed',
    });
  } catch (error) {
    console.error('[ProcessTasks] 任务处理失败:', error);
    return NextResponse.json(
      { code: 500, data: null, message: '任务处理失败: ' + (error as Error).message },
      { status: 500 }
    );
  } finally {
    globalState.__processTasksRunning = false;
  }
}

/**
 * GET /api/tasks/process-tasks - 获取队列状态
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get('run') === '1') {
    console.log('[ProcessTasks] GET 触发 run=1，转为执行任务处理');
    return POST(request);
  }
  return NextResponse.json({
    code: 0,
    data: { message: '使用 POST 调用以处理任务' },
    message: 'success',
  });
}
