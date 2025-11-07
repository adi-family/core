/**
 * Centralized Valtio stores for global state management
 *
 * All stores follow the same pattern:
 * - Automatic caching (30 seconds by default)
 * - Error handling
 * - Loading states
 * - Optimistic updates where applicable
 */

// Projects store
export {
  projectsStore,
  fetchProjects,
  toggleProjectEnabled,
  refreshProjects
} from './projects'

// Tasks store
export {
  tasksStore,
  fetchTasks,
  refreshTasks,
  getTasksByProject
} from './tasks'

// Task Sources store
export {
  taskSourcesStore,
  fetchTaskSources,
  syncTaskSource,
  refreshTaskSources,
  getTaskSourcesByProject
} from './task-sources'

// File Spaces store
export {
  fileSpacesStore,
  fetchFileSpaces,
  refreshFileSpaces,
  getFileSpacesByProject
} from './file-spaces'

// Usage Metrics store
export {
  usageMetricsStore,
  fetchUsageMetrics,
  refreshUsageMetrics,
  type ApiUsageMetric
} from './usage-metrics'

// Alerts store
export {
  alertsStore,
  fetchAlerts,
  refreshAlerts,
  type Alert
} from './alerts'
