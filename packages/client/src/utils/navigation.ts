/**
 * Navigation helper utilities
 * Provides centralized navigation functions for the application
 */

/**
 * Navigate to a path using window.location.href
 * Note: This is a temporary solution. Consider migrating to useNavigate hook from react-router-dom
 */
export function navigateTo(path: string) {
  window.location.href = path
}

/**
 * Navigate to project detail page
 */
export function navigateToProject(projectId: string) {
  navigateTo(`/projects/${projectId}`)
}

/**
 * Navigate to session detail page
 */
export function navigateToSession(sessionId: string) {
  navigateTo(`/sessions/${sessionId}`)
}

/**
 * Navigate to task detail page
 */
export function navigateToTask(taskId: string) {
  navigateTo(`/tasks/${taskId}`)
}
