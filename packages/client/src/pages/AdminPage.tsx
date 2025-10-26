import { useState, useMemo, useEffect } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { createAuthenticatedClient } from '@/lib/client'
import {
  PRICING,
  calculateCostBreakdown,
  formatCost,
  formatTokens,
  formatDuration,
  type ApiUsageMetric
} from '@/config/pricing'

interface WorkerRepository {
  id: string
  project_id: string
  project_name: string
  current_version: string
  gitlab_path: string
  gitlab_host: string
  updated_at: string
}

interface RefreshResult {
  project: string
  success: boolean
  error?: string
  filesUpdated?: number
  fileErrors?: Array<{ file: string; error: string }>
}

interface RefreshResponse {
  success: boolean
  message: string
  results: RefreshResult[]
  summary: {
    total: number
    succeeded: number
    failed: number
  }
}

export function AdminPage() {
  const { getToken } = useAuth()
  const client = useMemo(() => createAuthenticatedClient(getToken), [getToken])

  const [activeTab, setActiveTab] = useState<'repositories' | 'usage'>('repositories')
  const [repositories, setRepositories] = useState<WorkerRepository[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshResults, setRefreshResults] = useState<RefreshResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Usage metrics state
  const [usageMetrics, setUsageMetrics] = useState<ApiUsageMetric[]>([])
  const [usageLoading, setUsageLoading] = useState(false)

  // Load worker repositories
  const loadRepositories = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await client.admin['worker-repos'].$get()
      if (response.ok) {
        const data = await response.json()
        setRepositories(data.repositories as WorkerRepository[])
      } else {
        setError('Failed to load worker repositories')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  // Refresh all worker repositories
  const handleRefresh = async () => {
    setRefreshing(true)
    setError(null)
    setRefreshResults(null)

    try {
      const response = await client.admin['refresh-worker-repos'].$post({})
      if (response.ok) {
        const data = await response.json() as RefreshResponse
        setRefreshResults(data)
        // Reload repositories to see updated timestamps
        await loadRepositories()
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to refresh worker repositories')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setRefreshing(false)
    }
  }

  // Load usage metrics
  const loadUsageMetrics = async () => {
    setUsageLoading(true)
    setError(null)
    try {
      const response = await client.admin['usage-metrics'].$get()
      if (response.ok) {
        const data = await response.json()
        setUsageMetrics(data.recent as ApiUsageMetric[])
      } else {
        setError('Failed to load usage metrics')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setUsageLoading(false)
    }
  }

  // Load on mount
  useEffect(() => {
    loadRepositories()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load usage metrics when tab changes
  useEffect(() => {
    if (activeTab === 'usage' && usageMetrics.length === 0) {
      loadUsageMetrics()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  // Calculate totals
  const totals = useMemo(() => {
    if (usageMetrics.length === 0) {
      return { totalCost: 0, tokenCost: 0, ciCost: 0, totalTokens: 0, ciHours: 0 }
    }

    return usageMetrics.reduce(
      (acc, metric) => {
        const breakdown = calculateCostBreakdown(metric)
        return {
          totalCost: acc.totalCost + breakdown.totalCost,
          tokenCost: acc.tokenCost + breakdown.tokenCost,
          ciCost: acc.ciCost + breakdown.ciCost,
          totalTokens: acc.totalTokens + breakdown.totalTokens,
          ciHours: acc.ciHours + breakdown.ciHours
        }
      },
      { totalCost: 0, tokenCost: 0, ciCost: 0, totalTokens: 0, ciHours: 0 }
    )
  }, [usageMetrics])

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">System Administration</h1>
        <p className="text-gray-600">
          Manage worker repositories and API usage tracking
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('repositories')}
            className={`pb-4 px-2 font-medium border-b-2 transition-colors ${
              activeTab === 'repositories'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Worker Repositories
          </button>
          <button
            onClick={() => setActiveTab('usage')}
            className={`pb-4 px-2 font-medium border-b-2 transition-colors ${
              activeTab === 'usage'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            API Usage
          </button>
        </div>
      </div>

      {/* Worker Repositories Tab */}
      {activeTab === 'repositories' && (<div>
      {/* Worker Repositories Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold mb-1">Worker Repositories</h2>
            <p className="text-sm text-gray-600">
              GitLab repositories that execute CI/CD pipelines for each project
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadRepositories}
              disabled={loading}
              className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Reload'}
            </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {refreshing ? 'Refreshing...' : 'Refresh All Repositories'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Refresh Results */}
        {refreshResults && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <h3 className="font-semibold mb-2">Refresh Complete</h3>
            <p className="text-sm mb-3">{refreshResults.message}</p>
            <div className="flex gap-4 text-sm mb-4">
              <span className="text-green-700">
                ✓ Succeeded: {refreshResults.summary.succeeded}
              </span>
              {refreshResults.summary.failed > 0 && (
                <span className="text-red-700">
                  ✗ Failed: {refreshResults.summary.failed}
                </span>
              )}
            </div>

            {/* Detailed Results */}
            <details className="text-sm">
              <summary className="cursor-pointer font-medium mb-2">
                View Details
              </summary>
              <div className="space-y-2 mt-2">
                {refreshResults.results.map((result, i) => (
                  <div
                    key={i}
                    className={`p-2 rounded ${
                      result.success ? 'bg-green-50' : 'bg-red-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{result.project}</span>
                      {result.success ? (
                        <span className="text-green-700">
                          ✓ {result.filesUpdated} files updated
                        </span>
                      ) : (
                        <span className="text-red-700">✗ Failed</span>
                      )}
                    </div>
                    {result.error && (
                      <p className="text-xs text-red-600 mt-1">{result.error}</p>
                    )}
                    {result.fileErrors && result.fileErrors.length > 0 && (
                      <div className="mt-2 text-xs space-y-1">
                        <p className="font-medium text-orange-700">File errors:</p>
                        {result.fileErrors.map((fe, idx) => (
                          <div key={idx} className="text-orange-600 ml-2">
                            • {fe.file}: {fe.error}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}

        {/* Repositories Table */}
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : repositories.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No worker repositories found. They will be created automatically when
            you trigger your first pipeline.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left">
                  <th className="pb-3 font-semibold">Project</th>
                  <th className="pb-3 font-semibold">GitLab Repository</th>
                  <th className="pb-3 font-semibold">Version</th>
                  <th className="pb-3 font-semibold">Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {repositories.map((repo) => (
                  <tr key={repo.id} className="border-b border-gray-100">
                    <td className="py-3">
                      <div className="font-medium">{repo.project_name}</div>
                    </td>
                    <td className="py-3">
                      <a
                        href={`${repo.gitlab_host}/${repo.gitlab_path}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline font-mono text-xs"
                      >
                        {repo.gitlab_path}
                      </a>
                    </td>
                    <td className="py-3">
                      <span className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">
                        {repo.current_version}
                      </span>
                    </td>
                    <td className="py-3 text-gray-600">
                      {new Date(repo.updated_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info Panel */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">
          About Worker Repositories
        </h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>
            • Each project has its own dedicated GitLab repository for running
            CI/CD pipelines
          </li>
          <li>
            • Worker repositories contain templates for evaluation, code
            generation, and task execution
          </li>
          <li>
            • Click "Refresh All Repositories" to update all repos with the latest
            CI templates
          </li>
          <li>
            • Repositories are automatically created when you trigger your first
            pipeline for a project
          </li>
        </ul>
      </div>
      </div>)}

      {/* API Usage Tab */}
      {activeTab === 'usage' && (<div>
        {/* Pricing Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-blue-900 mb-2">Platform Pricing</h3>
          <div className="text-sm text-blue-800 space-y-1">
            <div>💰 <strong>${PRICING.PER_MILLION_TOKENS}</strong> per 1M tokens</div>
            <div>⏱️ <strong>${PRICING.PER_CI_HOUR.toFixed(8)}</strong> per hour CI time (≈ ${(PRICING.PER_CI_HOUR / 60).toFixed(6)} per minute)</div>
          </div>
        </div>

        {/* Usage Summary Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-sm text-gray-600 mb-1">Total Cost</div>
            <div className="text-2xl font-bold">{formatCost(totals.totalCost)}</div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-sm text-gray-600 mb-1">Token Cost</div>
            <div className="text-2xl font-bold">{formatCost(totals.tokenCost)}</div>
            <div className="text-xs text-gray-500 mt-1">
              {formatTokens(totals.totalTokens)} @ ${PRICING.PER_MILLION_TOKENS}/M
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-sm text-gray-600 mb-1">CI Cost</div>
            <div className="text-2xl font-bold">{formatCost(totals.ciCost)}</div>
            <div className="text-xs text-gray-500 mt-1">
              {totals.ciHours.toFixed(2)}h @ ${PRICING.PER_CI_HOUR.toFixed(4)}/h
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-sm text-gray-600 mb-1">API Calls</div>
            <div className="text-2xl font-bold">{usageMetrics.length}</div>
            <div className="text-xs text-gray-500 mt-1">Last 100 calls</div>
          </div>
        </div>

        {/* Recent Usage Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Recent API Usage</h2>
            <button
              onClick={loadUsageMetrics}
              disabled={usageLoading}
              className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              {usageLoading ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {usageLoading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : usageMetrics.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No usage data available yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left">
                    <th className="pb-3 font-semibold">Date</th>
                    <th className="pb-3 font-semibold">Provider</th>
                    <th className="pb-3 font-semibold">Goal</th>
                    <th className="pb-3 font-semibold">Phase</th>
                    <th className="pb-3 font-semibold">Tokens</th>
                    <th className="pb-3 font-semibold">CI Time</th>
                    <th className="pb-3 font-semibold">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {usageMetrics.map((metric) => {
                    const breakdown = calculateCostBreakdown(metric)
                    return (
                      <tr key={metric.id} className="border-b border-gray-100">
                        <td className="py-3 text-gray-600">
                          {new Date(metric.created_at).toLocaleString()}
                        </td>
                        <td className="py-3 capitalize">{metric.provider}</td>
                        <td className="py-3 capitalize">{metric.goal}</td>
                        <td className="py-3 text-gray-600 text-xs">{metric.operation_phase}</td>
                        <td className="py-3">{formatTokens(breakdown.totalTokens)}</td>
                        <td className="py-3">{formatDuration(metric.ci_duration_seconds)}</td>
                        <td className="py-3 font-medium">{formatCost(breakdown.totalCost)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>)}
    </div>
  )
}
