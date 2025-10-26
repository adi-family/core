import { Link } from "react-router-dom"
import { useState, useEffect, useMemo } from "react"
import { useAuth } from "@clerk/clerk-react"
import { createAuthenticatedClient } from "@/lib/client"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@adi-simple/ui/card'
import {
  PRICING,
  calculateCostBreakdown,
  formatCost,
  formatTokens,
  type ApiUsageMetric
} from '@/config/pricing'

export function HomePage() {
  const { getToken } = useAuth()
  const client = useMemo(() => createAuthenticatedClient(getToken), [getToken])
  const [usageMetrics, setUsageMetrics] = useState<ApiUsageMetric[]>([])
  const [loading, setLoading] = useState(true)

  // Load usage metrics
  useEffect(() => {
    const loadMetrics = async () => {
      try {
        const response = await client.admin['usage-metrics'].$get()
        if (response.ok) {
          const data = await response.json()
          setUsageMetrics(data.recent as ApiUsageMetric[])
        }
      } catch (error) {
        console.error('Failed to load usage metrics:', error)
      } finally {
        setLoading(false)
      }
    }
    loadMetrics()
  }, [client])

  // Calculate totals
  const totals = useMemo(() => {
    if (usageMetrics.length === 0) {
      return { totalCost: 0, tokenCost: 0, ciCost: 0, totalTokens: 0 }
    }

    return usageMetrics.reduce(
      (acc, metric) => {
        const breakdown = calculateCostBreakdown(metric)
        return {
          totalCost: acc.totalCost + breakdown.totalCost,
          tokenCost: acc.tokenCost + breakdown.tokenCost,
          ciCost: acc.ciCost + breakdown.ciCost,
          totalTokens: acc.totalTokens + breakdown.totalTokens
        }
      },
      { totalCost: 0, tokenCost: 0, ciCost: 0, totalTokens: 0 }
    )
  }, [usageMetrics])

  return (
    <div className="mx-auto p-6 max-w-7xl min-h-[calc(100vh-3.5rem)]">
      <div className="mb-12 pt-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-6xl font-bold tracking-tight uppercase mb-4 bg-gradient-to-r from-gray-900 via-gray-700 to-gray-900 bg-clip-text text-transparent">ADI</h1>
            <p className="text-gray-600 text-sm uppercase tracking-wide">
              Database entity viewer for projects, tasks, sessions, and messages
            </p>
          </div>

          {/* Cost Counter */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-6 min-w-[280px]">
            <div className="text-sm font-medium text-blue-900 mb-2">Platform Cost (Last 100 API calls)</div>
            {loading ? (
              <div className="text-2xl font-bold text-blue-600">Loading...</div>
            ) : (
              <>
                <div className="text-4xl font-bold text-blue-600 mb-3">{formatCost(totals.totalCost)}</div>
                <div className="space-y-1 text-xs text-blue-800">
                  <div className="flex justify-between">
                    <span>Tokens:</span>
                    <span className="font-medium">{formatTokens(totals.totalTokens)} ({formatCost(totals.tokenCost)})</span>
                  </div>
                  <div className="flex justify-between">
                    <span>CI Time:</span>
                    <span className="font-medium">{formatCost(totals.ciCost)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-blue-200">
                    <span>API Calls:</span>
                    <span className="font-medium">{usageMetrics.length}</span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-blue-200 text-xs text-blue-700">
                  <div>💰 ${PRICING.PER_MILLION_TOKENS}/M tokens</div>
                  <div>⏱️ ${PRICING.PER_CI_HOUR.toFixed(4)}/hour CI</div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-md">
        <Link to="/setup-project">
          <Card className="cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-xl border-2 border-gray-300 hover:border-blue-500">
            <CardHeader>
              <CardTitle className="text-gray-900">Setup Project</CardTitle>
              <CardDescription>
                Create a new project in the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Create GitLab, Jira, or Parent projects with custom configuration
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
