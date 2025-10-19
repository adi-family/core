/**
 * Backend API Client for Worker
 * Re-exports client from backend to avoid circular dependencies
 */

export { createBackendClient, type BackendClient } from '../backend/api-client'
