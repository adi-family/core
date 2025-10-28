import { useState, useMemo, useEffect } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { createAuthenticatedClient } from '@/lib/client'
import { AnimatedPageContainer } from '@/components/AnimatedPageContainer'
import { TabsContainer, InfoPanel, ContentCard } from '@/components/TabsContainer'
import { Button } from '@adi-simple/ui/button'
import { designTokens } from '@/theme/tokens'
import { useExpertMode } from '@/contexts/ExpertModeContext'
import { Settings } from 'lucide-react'
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
  const { expertMode, toggleExpertMode } = useExpertMode()

  const [activeTab, setActiveTab] = useState<'repositories' | 'usage' | 'operations'>('repositories')
  const [repositories, setRepositories] = useState<WorkerRepository[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshResults, setRefreshResults] = useState<RefreshResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Usage metrics state
  const [usageMetrics, setUsageMetrics] = useState<ApiUsageMetric[]>([])
  const [usageLoading, setUsageLoading] = useState(false)

  // Operations state
  const [opsLoading, setOpsLoading] = useState<string | null>(null)
  const [opsResult, setOpsResult] = useState<{ type: string; message: string; success: boolean } | null>(null)

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

  // Operations handlers
  const handleOperation = async (operation: string) => {
    setOpsLoading(operation)
    setOpsResult(null)
    setError(null)

    try {
      const response = await client.admin.operations[operation as 'check-stale-pipelines' | 'recover-stuck-tasks' | 'create-missing-worker-repos'].$post({})
      if (response.ok) {
        const data = await response.json()
        setOpsResult({
          type: operation,
          message: data.message || 'Operation completed successfully',
          success: true
        })
        if (operation === 'create-missing-worker-repos') {
          setTimeout(() => {
            if (activeTab === 'repositories') {
              loadRepositories()
            }
          }, 5000)
        }
      } else {
        const errorData = await response.json()
        setError(errorData.error || `Failed to execute ${operation}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setOpsLoading(null)
    }
  }

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

  const tabs = [
    { id: 'repositories', label: 'Worker Repositories' },
    { id: 'usage', label: 'API Usage' },
    { id: 'operations', label: 'Operations' },
  ]

  return (
    <AnimatedPageContainer>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2 text-white">System Administration</h1>
          <p className="text-gray-400">
            Manage worker repositories and API usage tracking
          </p>
        </div>

        {/* Expert Mode Toggle */}
        <div className="flex items-center gap-3 bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-lg px-4 py-2.5">
          <Settings className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-300">Expert Mode</span>
          <button
            onClick={toggleExpertMode}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              expertMode ? 'bg-blue-500' : 'bg-gray-600'
            }`}
            aria-label="Toggle expert mode"
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                expertMode ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          <span className={`text-xs font-medium ${expertMode ? 'text-blue-400' : 'text-gray-500'}`}>
            {expertMode ? 'ON' : 'OFF'}
          </span>
        </div>
      </div>

      <TabsContainer tabs={tabs} activeTab={activeTab} onTabChange={(id) => setActiveTab(id as any)} />

      {/* Worker Repositories Tab */}
      {activeTab === 'repositories' && (
        <div className={designTokens.animations.fadeIn}>
          <ContentCard
            title="Worker Repositories"
            description="GitLab repositories that execute CI/CD pipelines for each project"
            actions={
              <>
                <Button
                  onClick={loadRepositories}
                  disabled={loading}
                  variant="outline"
                  size="sm"
                >
                  {loading ? 'Loading...' : 'Reload'}
                </Button>
                <Button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  size="sm"
                >
                  {refreshing ? 'Refreshing...' : 'Refresh All'}
                </Button>
              </>
            }
          >
            {error && (
              <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                <p className="text-sm text-red-200">{error}</p>
              </div>
            )}

            {refreshResults && (
              <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                <h3 className="font-semibold mb-2 text-white">Refresh Complete</h3>
                <p className="text-sm mb-3 text-gray-300">{refreshResults.message}</p>
                <div className="flex gap-4 text-sm mb-4">
                  <span className="text-green-300">
                    ✓ Succeeded: {refreshResults.summary.succeeded}
                  </span>
                  {refreshResults.summary.failed > 0 && (
                    <span className="text-red-300">
                      ✗ Failed: {refreshResults.summary.failed}
                    </span>
                  )}
                </div>

                <details className="text-sm">
                  <summary className="cursor-pointer font-medium mb-2 text-gray-300">
                    View Details
                  </summary>
                  <div className="space-y-2 mt-2">
                    {refreshResults.results.map((result, i) => (
                      <div
                        key={i}
                        className={`p-2 rounded-lg ${
                          result.success ? 'bg-green-500/10' : 'bg-red-500/10'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-white">{result.project}</span>
                          {result.success ? (
                            <span className="text-green-300">
                              ✓ {result.filesUpdated} files updated
                            </span>
                          ) : (
                            <span className="text-red-300">✗ Failed</span>
                          )}
                        </div>
                        {result.error && (
                          <p className="text-xs text-red-300 mt-1">{result.error}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            )}

            {loading ? (
              <div className="text-center py-8 text-gray-400">Loading...</div>
            ) : repositories.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                No worker repositories found. They will be created automatically when
                you trigger your first pipeline.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left">
                      <th className="pb-3 font-semibold text-gray-300">Project</th>
                      <th className="pb-3 font-semibold text-gray-300">GitLab Repository</th>
                      <th className="pb-3 font-semibold text-gray-300">Version</th>
                      <th className="pb-3 font-semibold text-gray-300">Last Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {repositories.map((repo) => (
                      <tr key={repo.id} className="border-b border-white/5">
                        <td className="py-3">
                          <div className="font-medium text-white">{repo.project_name}</div>
                        </td>
                        <td className="py-3">
                          <a
                            href={`${repo.gitlab_host}/${repo.gitlab_path}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:underline font-mono text-xs"
                          >
                            {repo.gitlab_path}
                          </a>
                        </td>
                        <td className="py-3">
                          <span className="px-2 py-1 bg-white/10 rounded text-xs font-mono text-gray-300">
                            {repo.current_version}
                          </span>
                        </td>
                        <td className="py-3 text-gray-400">
                          {new Date(repo.updated_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ContentCard>

          <InfoPanel title="About Worker Repositories">
            <ul className="space-y-1">
              <li>• Each project has its own dedicated GitLab repository for running CI/CD pipelines</li>
              <li>• Worker repositories contain templates for evaluation, code generation, and task execution</li>
              <li>• Click "Refresh All Repositories" to update all repos with the latest CI templates</li>
              <li>• Repositories are automatically created when you trigger your first pipeline for a project</li>
            </ul>
          </InfoPanel>
        </div>
      )}

      {/* Operations Tab */}
      {activeTab === 'operations' && (
        <div className={designTokens.animations.fadeIn}>
          <ContentCard
            title="System Operations"
            description="Trigger maintenance and monitoring tasks manually"
          >
            {error && (
              <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                <p className="text-sm text-red-200">{error}</p>
              </div>
            )}

            {opsResult && (
              <div className={`mb-4 p-4 rounded-xl ${
                opsResult.success
                  ? 'bg-green-500/10 border border-green-500/30'
                  : 'bg-red-500/10 border border-red-500/30'
              }`}>
                <h3 className="font-semibold mb-1 text-white">
                  {opsResult.success ? '✅ Success' : '❌ Failed'}
                </h3>
                <p className="text-sm text-gray-300">{opsResult.message}</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-white/10 rounded-xl p-4 bg-white/5 backdrop-blur-sm">
                <h3 className="font-semibold mb-2 text-white">Check Stale Pipelines</h3>
                <p className="text-sm text-gray-400 mb-4">
                  Poll GitLab for pipeline status updates and sync them to the database. Updates tasks that have completed pipelines.
                </p>
                <Button
                  onClick={() => handleOperation('check-stale-pipelines')}
                  disabled={opsLoading === 'check-stale-pipelines'}
                  className="w-full"
                  size="sm"
                >
                  {opsLoading === 'check-stale-pipelines' ? 'Running...' : 'Run Now'}
                </Button>
              </div>

              <div className="border border-white/10 rounded-xl p-4 bg-white/5 backdrop-blur-sm">
                <h3 className="font-semibold mb-2 text-white">Recover Stuck Tasks</h3>
                <p className="text-sm text-gray-400 mb-4">
                  Find tasks stuck in evaluating/implementing state and recover them based on their pipeline status.
                </p>
                <Button
                  onClick={() => handleOperation('recover-stuck-tasks')}
                  disabled={opsLoading === 'recover-stuck-tasks'}
                  className="w-full"
                  size="sm"
                >
                  {opsLoading === 'recover-stuck-tasks' ? 'Running...' : 'Run Now'}
                </Button>
              </div>

              <div className="border border-white/10 rounded-xl p-4 bg-white/5 backdrop-blur-sm">
                <h3 className="font-semibold mb-2 text-white">Create Missing Worker Repositories</h3>
                <p className="text-sm text-gray-400 mb-4">
                  Find projects without worker repositories and create them automatically. Runs in background.
                </p>
                <Button
                  onClick={() => handleOperation('create-missing-worker-repos')}
                  disabled={opsLoading === 'create-missing-worker-repos'}
                  className="w-full"
                  size="sm"
                >
                  {opsLoading === 'create-missing-worker-repos' ? 'Starting...' : 'Create Missing Repos'}
                </Button>
              </div>
            </div>
          </ContentCard>

          <InfoPanel title="About Operations">
            <ul className="space-y-1">
              <li>• <strong>Check Stale Pipelines:</strong> Normally runs every 10 minutes automatically</li>
              <li>• <strong>Recover Stuck Tasks:</strong> Finds tasks stuck in evaluating/implementing status</li>
              <li>• <strong>Create Missing Worker Repositories:</strong> Runs in background, check server logs</li>
              <li>• These operations are safe to run multiple times</li>
            </ul>
          </InfoPanel>
        </div>
      )}

      {/* API Usage Tab */}
      {activeTab === 'usage' && (
        <div className={designTokens.animations.fadeIn}>
          <InfoPanel title="Platform Pricing">
            <div className="space-y-1">
              <div>💰 <strong>${PRICING.PER_MILLION_TOKENS}</strong> per 1M tokens</div>
              <div>⏱️ <strong>${PRICING.PER_CI_HOUR.toFixed(8)}</strong> per hour CI time</div>
            </div>
          </InfoPanel>

          <div className="grid grid-cols-4 gap-4 my-6">
            {[
              { label: 'Total Cost', value: formatCost(totals.totalCost), color: 'blue' },
              { label: 'Token Cost', value: formatCost(totals.tokenCost), subtitle: `${formatTokens(totals.totalTokens)} @ $${PRICING.PER_MILLION_TOKENS}/M`, color: 'purple' },
              { label: 'CI Cost', value: formatCost(totals.ciCost), subtitle: `${totals.ciHours.toFixed(2)}h @ $${PRICING.PER_CI_HOUR.toFixed(4)}/h`, color: 'emerald' },
              { label: 'API Calls', value: usageMetrics.length.toString(), subtitle: 'Last 100 calls', color: 'amber' },
            ].map((stat, idx) => (
              <div key={idx} className="bg-white/5 backdrop-blur-md rounded-xl border border-white/10 p-4 hover:bg-white/10 transition-all">
                <div className="text-sm text-gray-400 mb-1">{stat.label}</div>
                <div className="text-2xl font-bold text-white">{stat.value}</div>
                {stat.subtitle && <div className="text-xs text-gray-500 mt-1">{stat.subtitle}</div>}
              </div>
            ))}
          </div>

          <ContentCard
            title="Recent API Usage"
            actions={
              <Button
                onClick={loadUsageMetrics}
                disabled={usageLoading}
                variant="outline"
                size="sm"
              >
                {usageLoading ? 'Loading...' : 'Refresh'}
              </Button>
            }
          >
            {usageLoading ? (
              <div className="text-center py-8 text-gray-400">Loading...</div>
            ) : usageMetrics.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                No usage data available yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left">
                      <th className="pb-3 font-semibold text-gray-300">Date</th>
                      <th className="pb-3 font-semibold text-gray-300">Provider</th>
                      <th className="pb-3 font-semibold text-gray-300">Goal</th>
                      <th className="pb-3 font-semibold text-gray-300">Phase</th>
                      <th className="pb-3 font-semibold text-gray-300">Tokens</th>
                      <th className="pb-3 font-semibold text-gray-300">CI Time</th>
                      <th className="pb-3 font-semibold text-gray-300">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usageMetrics.map((metric) => {
                      const breakdown = calculateCostBreakdown(metric)
                      return (
                        <tr key={metric.id} className="border-b border-white/5">
                          <td className="py-3 text-gray-400">
                            {new Date(metric.created_at).toLocaleString()}
                          </td>
                          <td className="py-3 capitalize text-white">{metric.provider}</td>
                          <td className="py-3 capitalize text-white">{metric.goal}</td>
                          <td className="py-3 text-gray-400 text-xs">{metric.operation_phase}</td>
                          <td className="py-3 text-white">{formatTokens(breakdown.totalTokens)}</td>
                          <td className="py-3 text-white">{formatDuration(metric.ci_duration_seconds)}</td>
                          <td className="py-3 font-medium text-white">{formatCost(breakdown.totalCost)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </ContentCard>
        </div>
      )}
    </AnimatedPageContainer>
  )
}
