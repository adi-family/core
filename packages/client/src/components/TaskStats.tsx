import { useState, useEffect, useMemo } from "react"
import { useAuth } from "@clerk/clerk-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter, Cell } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from '@adi-simple/ui/card'
import { createAuthenticatedClient } from "@/lib/client"
import { getTaskStatsConfig } from '@adi/api-contracts/tasks'

interface TaskStatsProps {
  filters?: {
    project_id?: string
    task_source_id?: string
    evaluated_only?: string
    sort_by?: string
    search?: string
  }
}

interface StatsData {
  total: number
  evaluated: number
  implemented: number
  inProgress: number
  avgComplexity: string
  quadrantData: {
    x: number
    y: number
    title: string
    id: string
    impactLabel: string
    effortLabel: string
  }[]
  taskTypeData: { name: string; value: number }[]
  effortData: { name: string; value: number }[]
  riskData: { name: string; value: number }[]
}

const COLORS = {
  primary: '#3b82f6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  purple: '#8b5cf6',
  pink: '#ec4899',
  teal: '#14b8a6',
  indigo: '#64748b',
  cyan: '#64748b',
}

export function TaskStats({ filters }: TaskStatsProps) {
  const { getToken } = useAuth()
  const client = useMemo(() => createAuthenticatedClient(getToken), [getToken])
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true)
      try {
        const queryParams: Record<string, string> = {}
        if (filters?.project_id) queryParams.project_id = filters.project_id
        if (filters?.task_source_id) queryParams.task_source_id = filters.task_source_id
        if (filters?.evaluated_only) queryParams.evaluated_only = filters.evaluated_only
        if (filters?.sort_by) queryParams.sort_by = filters.sort_by
        if (filters?.search) queryParams.search = filters.search

        const data = await client.run(getTaskStatsConfig, { query: queryParams })
        setStats(data)
      } catch (error) {
        console.error('Error fetching task stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [client, filters])

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-gray-400">Loading statistics...</div>
      </div>
    )
  }

  if (!stats || stats.total === 0) {
    return null
  }

  return (
    <div className="space-y-6 mb-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-neutral-800/40 backdrop-blur-xl border border-neutral-700/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Total Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{stats.total}</div>
          </CardContent>
        </Card>

        <Card className="bg-neutral-800/40 backdrop-blur-xl border border-neutral-700/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Evaluated</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-400">{stats.evaluated}</div>
            <div className="text-xs text-gray-500 mt-1">
              {stats.total > 0 ? Math.round((stats.evaluated / stats.total) * 100) : 0}%
            </div>
          </CardContent>
        </Card>

        <Card className="bg-neutral-800/40 backdrop-blur-xl border border-neutral-700/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Implemented</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-neutral-400">{stats.implemented}</div>
            <div className="text-xs text-gray-500 mt-1">
              {stats.total > 0 ? Math.round((stats.implemented / stats.total) * 100) : 0}%
            </div>
          </CardContent>
        </Card>

        <Card className="bg-neutral-800/40 backdrop-blur-xl border border-neutral-700/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-400">{stats.inProgress}</div>
            <div className="text-xs text-gray-500 mt-1">
              {stats.total > 0 ? Math.round((stats.inProgress / stats.total) * 100) : 0}%
            </div>
          </CardContent>
        </Card>

        <Card className="bg-neutral-800/40 backdrop-blur-xl border border-neutral-700/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Avg Complexity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-400">{stats.avgComplexity}</div>
            <div className="text-xs text-gray-500 mt-1">out of 10</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Impact vs Effort Quadrant */}
        {stats.quadrantData.length > 0 && (
          <Card className="bg-neutral-800/40 backdrop-blur-xl border border-neutral-700/50 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg text-white">Priority Matrix: Impact vs Effort</CardTitle>
              <p className="text-sm text-gray-400 mt-1">Quick Wins (High Impact, Low Effort) are in the top-left</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <ScatterChart
                  margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    type="number"
                    dataKey="x"
                    name="Effort"
                    domain={[0.5, 3.5]}
                    ticks={[1, 2, 3]}
                    tickFormatter={(value) => {
                      const labels: Record<number, string> = { 1: 'Low', 2: 'Medium', 3: 'High' }
                      return labels[value] || ''
                    }}
                    stroke="#9ca3af"
                    label={{ value: 'Effort', position: 'bottom', fill: '#9ca3af' }}
                  />
                  <YAxis
                    type="number"
                    dataKey="y"
                    name="Impact"
                    domain={[0.5, 3.5]}
                    ticks={[1, 2, 3]}
                    tickFormatter={(value) => {
                      const labels: Record<number, string> = { 1: 'Low', 2: 'Medium', 3: 'High' }
                      return labels[value] || ''
                    }}
                    stroke="#9ca3af"
                    label={{ value: 'Impact', angle: -90, position: 'left', fill: '#9ca3af' }}
                  />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #475569',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                    labelStyle={{ color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                    formatter={(value: any, name: string, props: any) => {
                      if (name === 'Effort') return [props.payload.effortLabel, 'Effort']
                      if (name === 'Impact') return [props.payload.impactLabel, 'Impact']
                      return [value, name]
                    }}
                    labelFormatter={(label: any, payload: any) => {
                      if (payload && payload[0]) {
                        return payload[0].payload.title
                      }
                      return label
                    }}
                  />
                  <Scatter name="Tasks" data={stats.quadrantData} fill="#3b82f6">
                    {stats.quadrantData.map((entry, index) => {
                      // Color based on quadrant
                      let fillColor = COLORS.primary
                      if (entry.y >= 2.5 && entry.x <= 2) {
                        fillColor = COLORS.success // Quick Wins (top-left)
                      } else if (entry.y >= 2.5 && entry.x >= 2.5) {
                        fillColor = COLORS.warning // Major Projects (top-right)
                      } else if (entry.y <= 2 && entry.x <= 2) {
                        fillColor = COLORS.indigo // Fill Ins (bottom-left)
                      } else if (entry.y <= 2 && entry.x >= 2.5) {
                        fillColor = COLORS.danger // Time Wasters (bottom-right)
                      }
                      return <Cell key={`cell-${index}`} fill={fillColor} />
                    })}
                  </Scatter>
                  {/* Reference lines for quadrants */}
                  <CartesianGrid
                    stroke="#475569"
                    strokeWidth={2}
                    horizontal={false}
                    verticalPoints={[2]}
                  />
                  <CartesianGrid
                    stroke="#475569"
                    strokeWidth={2}
                    vertical={false}
                    horizontalPoints={[2]}
                  />
                </ScatterChart>
              </ResponsiveContainer>
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.success }}></div>
                  <span className="text-gray-300">Quick Wins</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.warning }}></div>
                  <span className="text-gray-300">Major Projects</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.indigo }}></div>
                  <span className="text-gray-300">Fill Ins</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.danger }}></div>
                  <span className="text-gray-300">Time Wasters</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Task Types */}
        {stats.taskTypeData.length > 0 && (
          <Card className="bg-neutral-800/40 backdrop-blur-xl border border-neutral-700/50">
            <CardHeader>
              <CardTitle className="text-lg text-white">Task Types</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={stats.taskTypeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="name"
                    stroke="#9ca3af"
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                    labelStyle={{ color: '#fff' }}
                  />
                  <Bar dataKey="value" fill={COLORS.primary} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Effort Estimates */}
        {stats.effortData.length > 0 && (
          <Card className="bg-neutral-800/40 backdrop-blur-xl border border-neutral-700/50">
            <CardHeader>
              <CardTitle className="text-lg text-white">Effort Estimates</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={stats.effortData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                    labelStyle={{ color: '#fff' }}
                  />
                  <Bar dataKey="value" fill={COLORS.purple} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Risk Levels */}
        {stats.riskData.length > 0 && (
          <Card className="bg-neutral-800/40 backdrop-blur-xl border border-neutral-700/50">
            <CardHeader>
              <CardTitle className="text-lg text-white">Risk Levels</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={stats.riskData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                    labelStyle={{ color: '#fff' }}
                  />
                  <Bar dataKey="value" fill={COLORS.warning} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
