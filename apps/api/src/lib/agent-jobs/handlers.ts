import {
  executeGrowthConversationRun,
} from '../agents/growth/conversations/run';
import { collectInterventionMetrics } from '../agents/growth/conversations/metrics';
import {
  JOB_GROWTH_CONVERSATION_RUN,
  JOB_GROWTH_METRICS_COLLECT,
  processAgentJobsTick,
  type AgentJobHandler,
} from './queue';

const handlers: Record<string, AgentJobHandler> = {
  [JOB_GROWTH_CONVERSATION_RUN]: async (job) => {
    const payload = job.payload as { runId?: string };
    if (!payload?.runId) throw new Error('growth_conversation_run sin runId');
    await executeGrowthConversationRun(payload.runId);
  },
  [JOB_GROWTH_METRICS_COLLECT]: async (job) => {
    const payload = job.payload as { workspaceId?: string; interventionId?: string };
    if (!payload?.workspaceId) throw new Error('growth_metrics_collect sin workspaceId');
    await collectInterventionMetrics(payload.workspaceId, payload.interventionId);
  },
};

export async function tickAgentJobs() {
  return processAgentJobsTick(handlers, {
    limit: 3,
    workerId: `api-${process.pid}`,
  });
}
