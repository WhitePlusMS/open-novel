/**
 * 任务队列服务
 *
 * 管理异步任务的创建、处理和执行
 * 支持多种任务类型：ROUND_CYCLE, CATCH_UP, READER_AGENT
 */

import { prisma } from '@/lib/prisma';
import { now } from '@/lib/timezone';
import { Prisma } from '@prisma/client';

export type TaskType =
  | 'ROUND_CYCLE'       // 轮次完整流程：大纲→章节→AI评论（合并任务）
  | 'CATCH_UP'         // 追赶写作
  | 'READER_AGENT';    // Reader Agent 阅读

export type TaskStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface TaskPayload {
  seasonId?: string;
  bookId?: string;
  chapterId?: string;
  round?: number;
  step?: string;
  [key: string]: unknown;
}

export interface CreateTaskDto {
  taskType: TaskType;
  payload: TaskPayload;
  priority?: number;
  maxAttempts?: number;
  step?: string;
}

export interface TaskItem {
  id: string;
  taskType: TaskType;
  payload: TaskPayload;
  status: TaskStatus;
  priority: number;
  attempts: number;
  maxAttempts: number;
  seasonId?: string;
  round?: number;
  step?: string;
  errorMessage?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class TaskQueueService {
  /**
   * 创建新任务
   */
  async create(dto: CreateTaskDto): Promise<TaskItem> {
    const seasonId = dto.payload.seasonId;
    const round = dto.payload.round;
    const step = dto.step ?? dto.payload.step ?? dto.taskType;
    if (
      seasonId &&
      round &&
      (dto.taskType === 'ROUND_CYCLE' || dto.taskType === 'CATCH_UP')
    ) {
      const existing = await prisma.taskQueue.findFirst({
        where: {
          taskType: dto.taskType,
          status: { in: ['PENDING', 'PROCESSING'] },
          seasonId: String(seasonId),
          round: Number(round),
          step,
        },
      });
      if (existing) {
        console.log(`[TaskQueue] Skip duplicate task: type=${existing.taskType}, id=${existing.id}, seasonId=${seasonId}, round=${round}, step=${step}, status=${existing.status}`);
        return this.formatTask(existing);
      }
    }
    const task = await prisma.taskQueue.create({
      data: {
        taskType: dto.taskType,
        seasonId: seasonId ? String(seasonId) : undefined,
        round: round ?? undefined,
        step,
        payload: dto.payload as Prisma.InputJsonValue,
        status: 'PENDING',
        priority: dto.priority ?? 0,
        attempts: 0,
        maxAttempts: dto.maxAttempts ?? 3,
      },
    });

    console.log(`[TaskQueue] Created task: type=${task.taskType}, id=${task.id}, seasonId=${seasonId ?? 'unknown'}, round=${round ?? 'unknown'}, step=${step ?? 'unknown'}, priority=${task.priority}`);
    return this.formatTask(task);
  }

  /**
   * 获取下一个待处理任务
   */
  async getNextTask(
    client: Prisma.TransactionClient | typeof prisma = prisma,
    lockDurationMs: number = 5 * 60 * 1000
  ): Promise<TaskItem | null> {
    const nowDate = now();
    const staleBefore = new Date(nowDate.getTime() - lockDurationMs);

    // 查找状态为 PENDING 或 PROCESSING 但已超时的任务
    const task = await client.taskQueue.findFirst({
      where: {
        OR: [
          { status: 'PENDING' },
          {
            status: 'PROCESSING',
            startedAt: {
              lt: staleBefore,
            },
          },
        ],
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' },
      ],
      take: 1,
    });

    if (!task) {
      return null;
    }

    // 标记为处理中
    const updateResult = await client.taskQueue.updateMany({
      where: {
        id: task.id,
        status: task.status,
        ...(task.status === 'PROCESSING' ? { startedAt: { lt: staleBefore } } : {}),
      },
      data: {
        status: 'PROCESSING',
        startedAt: nowDate,
        attempts: { increment: 1 },
      },
    });
    if (updateResult.count === 0) {
      return null;
    }

    return this.formatTask(task);
  }

  /**
   * 标记任务完成
   */
  async complete(taskId: string): Promise<void> {
    await prisma.taskQueue.update({
      where: { id: taskId },
      data: {
        status: 'COMPLETED',
        completedAt: now(),
      },
    });
    console.log(`[TaskQueue] Task completed: id=${taskId}`);
  }

  /**
   * 标记任务失败
   */
  async fail(taskId: string, errorMessage: string): Promise<void> {
    const task = await prisma.taskQueue.findUnique({ where: { id: taskId } });
    if (!task) return;

    // 如果还有重试次数，重置为 PENDING
    if (task.attempts < task.maxAttempts) {
      await prisma.taskQueue.update({
        where: { id: taskId },
        data: {
          status: 'PENDING',
          errorMessage,
          startedAt: null,
        },
      });
      console.log(`[TaskQueue] Task failed, will retry: id=${taskId}, attempt=${task.attempts}/${task.maxAttempts}`);
    } else {
      await prisma.taskQueue.update({
        where: { id: taskId },
        data: {
          status: 'FAILED',
          errorMessage,
          completedAt: now(),
        },
      });
      console.error(`[TaskQueue] Task failed permanently: id=${taskId}`, errorMessage);
      await this.recordRoundGapsAfterFailure(task);
    }
  }

  /**
   * 获取任务统计
   */
  async getStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    const [pending, processing, completed, failed] = await Promise.all([
      prisma.taskQueue.count({ where: { status: 'PENDING' } }),
      prisma.taskQueue.count({ where: { status: 'PROCESSING' } }),
      prisma.taskQueue.count({ where: { status: 'COMPLETED' } }),
      prisma.taskQueue.count({ where: { status: 'FAILED' } }),
    ]);

    return { pending, processing, completed, failed };
  }

  /**
   * 清理已完成的任务（可选）
   */
  async cleanup(olderThanHours: number = 24): Promise<number> {
    const result = await prisma.taskQueue.deleteMany({
      where: {
        status: { in: ['COMPLETED', 'FAILED'] },
        createdAt: {
          lt: new Date(now().getTime() - olderThanHours * 60 * 60 * 1000),
        },
      },
    });

    console.log(`[TaskQueue] Cleaned up ${result.count} old tasks`);
    return result.count;
  }

  /**
   * 根据 ID 获取任务
   */
  async getTaskById(taskId: string): Promise<TaskItem | null> {
    const task = await prisma.taskQueue.findUnique({
      where: { id: taskId },
    });

    if (!task) return null;
    return this.formatTask(task);
  }

  /**
   * 格式化任务返回
   */
  private formatTask(task: {
    id: string;
    taskType: string;
    seasonId?: string | null;
    round?: number | null;
    step?: string | null;
    payload: Prisma.JsonValue;
    status: string;
    priority: number;
    attempts: number;
    maxAttempts: number;
    errorMessage?: string | null;
    startedAt?: Date | null;
    completedAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): TaskItem {
    return {
      id: task.id,
      taskType: task.taskType as TaskType,
      payload: task.payload as TaskPayload,
      status: task.status as TaskStatus,
      priority: task.priority,
      attempts: task.attempts,
      maxAttempts: task.maxAttempts,
      seasonId: task.seasonId ?? undefined,
      round: task.round ?? undefined,
      step: task.step ?? undefined,
      errorMessage: task.errorMessage ?? undefined,
      startedAt: task.startedAt ?? undefined,
      completedAt: task.completedAt ?? undefined,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };
  }

  private async recordRoundGapsAfterFailure(task: {
    taskType: string;
    seasonId?: string | null;
    round?: number | null;
    payload: Prisma.JsonValue;
  }): Promise<void> {
    if (task.taskType !== 'ROUND_CYCLE' && task.taskType !== 'CATCH_UP') return;
    const payload = task.payload as TaskPayload;
    const seasonId = task.seasonId ?? payload.seasonId;
    const round = task.round ?? payload.round;
    if (!seasonId || !round) return;
    const { chapterWritingService } = await import('./chapter-writing.service');
    await chapterWritingService.recordRoundGaps(seasonId, round, 'TASK_FAILED');
  }
}

export const taskQueueService = new TaskQueueService();
