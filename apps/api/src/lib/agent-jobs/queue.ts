import type { AgentJob, Prisma } from '@prisma/client';
import { prisma } from '../prisma';

export const JOB_GROWTH_CONVERSATION_RUN = 'growth_conversation_run';
export const JOB_GROWTH_METRICS_COLLECT = 'growth_metrics_collect';

export type EnqueueAgentJobInput = {
  workspaceId?: string | null;
  type: string;
  payload: Prisma.InputJsonValue;
  maxAttempts?: number;
  nextRunAt?: Date;
};

export async function enqueueAgentJob(input: EnqueueAgentJobInput): Promise<AgentJob> {
  return prisma.agentJob.create({
    data: {
      workspaceId: input.workspaceId ?? null,
      type: input.type,
      payload: input.payload,
      maxAttempts: input.maxAttempts ?? 5,
      status: 'pending',
      nextRunAt: input.nextRunAt ?? new Date(),
    },
  });
}

/**
 * Reserva hasta `limit` jobs pendientes listos (nextRunAt <= now).
 * Marca running, incrementa attempts, setea lockedBy/lockedAt.
 */
export async function claimNextJobs(limit: number, workerId: string): Promise<AgentJob[]> {
  const take = Math.min(50, Math.max(1, limit));
  const now = new Date();

  const candidates = await prisma.agentJob.findMany({
    where: {
      status: 'pending',
      nextRunAt: { lte: now },
    },
    orderBy: { nextRunAt: 'asc' },
    take,
  });

  const claimed: AgentJob[] = [];
  for (const job of candidates) {
    const updated = await prisma.agentJob.updateMany({
      where: { id: job.id, status: 'pending' },
      data: {
        status: 'running',
        attempts: { increment: 1 },
        lockedAt: now,
        lockedBy: workerId,
        lastError: null,
      },
    });
    if (updated.count === 0) continue;
    const row = await prisma.agentJob.findUnique({ where: { id: job.id } });
    if (row) claimed.push(row);
  }
  return claimed;
}

export async function completeJob(jobId: string): Promise<void> {
  await prisma.agentJob.update({
    where: { id: jobId },
    data: {
      status: 'completed',
      completedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      lastError: null,
    },
  });
}

/** Backoff: attempts^2 * 5s (usa attempts ya incrementado al claim). */
export function computeBackoffMs(attempts: number): number {
  const a = Math.max(1, attempts);
  return a * a * 5000;
}

export async function failJob(jobId: string, error: string): Promise<void> {
  const job = await prisma.agentJob.findUnique({ where: { id: jobId } });
  if (!job) return;

  const message = error.slice(0, 4000);
  if (job.attempts >= job.maxAttempts) {
    await prisma.agentJob.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        lastError: message,
        completedAt: new Date(),
        lockedAt: null,
        lockedBy: null,
      },
    });
    return;
  }

  const delay = computeBackoffMs(job.attempts);
  await prisma.agentJob.update({
    where: { id: jobId },
    data: {
      status: 'pending',
      lastError: message,
      nextRunAt: new Date(Date.now() + delay),
      lockedAt: null,
      lockedBy: null,
    },
  });
}

export async function cancelJob(jobId: string): Promise<void> {
  await prisma.agentJob.updateMany({
    where: {
      id: jobId,
      status: { in: ['pending', 'running'] },
    },
    data: {
      status: 'cancelled',
      completedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
    },
  });
}

/** Recupera jobs stuck en running. */
export async function recoverStaleJobs(staleMs = 15 * 60 * 1000): Promise<number> {
  const cutoff = new Date(Date.now() - staleMs);
  const stale = await prisma.agentJob.findMany({
    where: {
      status: 'running',
      lockedAt: { lt: cutoff },
    },
    take: 100,
  });

  let recovered = 0;
  for (const job of stale) {
    if (job.attempts >= job.maxAttempts) {
      await prisma.agentJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          lastError: job.lastError ?? 'stale lock — max attempts',
          completedAt: new Date(),
          lockedAt: null,
          lockedBy: null,
        },
      });
    } else {
      await prisma.agentJob.update({
        where: { id: job.id },
        data: {
          status: 'pending',
          nextRunAt: new Date(),
          lockedAt: null,
          lockedBy: null,
          lastError: 'recovered from stale lock',
        },
      });
    }
    recovered += 1;
  }
  return recovered;
}

export type AgentJobHandler = (job: AgentJob) => Promise<void>;

export async function processAgentJobsTick(
  handlers: Record<string, AgentJobHandler>,
  options?: { limit?: number; workerId?: string },
): Promise<{ processed: number; failed: number }> {
  await recoverStaleJobs();
  const workerId = options?.workerId ?? `worker-${process.pid}`;
  const jobs = await claimNextJobs(options?.limit ?? 5, workerId);
  let processed = 0;
  let failed = 0;

  for (const job of jobs) {
    const handler = handlers[job.type];
    if (!handler) {
      await failJob(job.id, `No handler for job type: ${job.type}`);
      failed += 1;
      continue;
    }
    try {
      await handler(job);
      await completeJob(job.id);
      processed += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await failJob(job.id, message);
      failed += 1;
    }
  }

  return { processed, failed };
}
