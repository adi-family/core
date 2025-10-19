import type { LockContext, SignalInfo } from '../db/worker-cache';
import type { BackendApiClient } from './api-client';
import { initTrafficLight as initTrafficLightDb } from '../db/worker-cache';
import type { Sql } from 'postgres';

export type { LockContext, SignalInfo, WorkerCache } from '../db/worker-cache';

export function initTrafficLight(clientOrSql: BackendApiClient | Sql, projectId: string) {
  // If it's a SQL client, use the DB version
  if ('unsafe' in clientOrSql) {
    return initTrafficLightDb(clientOrSql as Sql, projectId);
  }

  // Otherwise use the API client version
  const apiClient = clientOrSql as BackendApiClient;
  return {
    isSignaledBefore: async (issueId: string, date: Date): Promise<boolean> => {
      return apiClient.isSignaledBefore(projectId, issueId, date);
    },
    tryAcquireLock: async (ctx: LockContext): Promise<boolean> => {
      return apiClient.tryAcquireLock(projectId, ctx);
    },
    releaseLock: async (issueId: string): Promise<void> => {
      await apiClient.releaseLock(projectId, issueId);
    },
    signal: async (info: SignalInfo): Promise<void> => {
      await apiClient.signal(projectId, info);
    },
    getTaskId: async (issueId: string): Promise<string | null> => {
      return apiClient.getTaskId(projectId, issueId);
    }
  };
}
