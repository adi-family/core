import { useState, useMemo } from "react"
import { useAuth } from "@clerk/clerk-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@adi-simple/ui/card'
import { Input } from '@adi-simple/ui/input'
import { Label } from '@adi-simple/ui/label'
import { ProjectSelect } from "@adi-simple/ui/project-select"
import { GitlabSecretAutocomplete } from "@adi-simple/ui/gitlab-secret-autocomplete"
import { GitlabRepositorySelect } from "@adi-simple/ui/gitlab-repository-select"
import { createAuthenticatedClient } from "@/lib/client"
import type { Secret } from "@adi-simple/types"

export function DebugGitlabSecretPage() {
  const { getToken } = useAuth()
  const client = useMemo(() => createAuthenticatedClient(getToken), [getToken])

  const [projectId, setProjectId] = useState("")
  const [host, setHost] = useState("https://gitlab.com")
  const [selectedSecretId, setSelectedSecretId] = useState<string | null>(null)
  const [requiredScopes, setRequiredScopes] = useState("api")
  const [selectedSecret, setSelectedSecret] = useState<Secret | null>(null)
  const [selectedRepositoryId, setSelectedRepositoryId] = useState<number | null>(null)
  const [selectedRepository, setSelectedRepository] = useState<any>(null)

  return (
    <div className="mx-auto">
      <Card className="border-gray-200/60 bg-white/90 backdrop-blur-md shadow-lg hover:shadow-xl transition-all duration-200 mb-6">
        <CardHeader className="bg-gradient-to-r from-neutral-600 to-neutral-500 text-white">
          <CardTitle className="text-2xl uppercase tracking-wide">
            Debug: Gitlab Components
          </CardTitle>
          <CardDescription className="text-gray-300">
            Test and debug GitLab integration components
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* GitlabSecretAutocomplete Section */}
          <div className="p-4 border border-gray-200/60 bg-gray-50/50 space-y-4">
            <h3 className="text-xs uppercase tracking-wide font-medium">GITLAB SECRET AUTOCOMPLETE</h3>

            {/* Configuration for Secret Autocomplete */}
            <div className="p-4 border border-neutral-200/60 bg-neutral-50/50 space-y-4">
              <h4 className="text-xs uppercase tracking-wide font-medium text-neutral-800">
                COMPONENT CONFIGURATION
              </h4>

              <ProjectSelect
                client={client}
                value={projectId}
                onChange={(id) => setProjectId(id)}
                required={true}
              />

              <div className="space-y-2">
                <Label htmlFor="host" className="text-xs uppercase tracking-wide">
                  GITLAB HOST
                </Label>
                <Input
                  id="host"
                  type="text"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  className="bg-white/90 backdrop-blur-sm border-gray-300 focus:border-neutral-500 focus:ring-neutral-500"
                  placeholder="https://gitlab.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="scopes" className="text-xs uppercase tracking-wide">
                  REQUIRED SCOPES (COMMA-SEPARATED)
                </Label>
                <Input
                  id="scopes"
                  type="text"
                  value={requiredScopes}
                  onChange={(e) => setRequiredScopes(e.target.value)}
                  className="bg-white/90 backdrop-blur-sm border-gray-300 focus:border-neutral-500 focus:ring-neutral-500"
                  placeholder="api, read_api"
                />
              </div>
            </div>

            {/* Component Test */}
            {projectId ? (
              <GitlabSecretAutocomplete
                client={client}
                projectId={projectId}
                host={host}
                value={selectedSecretId}
                onChange={(secretId, secret) => {
                  console.log("Selected secret ID:", secretId, secret)
                  setSelectedSecretId(secretId)
                  setSelectedSecret(secret || null)
                }}
                onSecretCreated={(secret) => {
                  console.log("Secret created:", secret)
                  setSelectedSecret(secret)
                }}
                requiredScopes={requiredScopes.split(",").map(s => s.trim()).filter(s => s)}
                required={true}
              />
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p className="text-xs uppercase tracking-wide">
                  Please select a project to test the component
                </p>
              </div>
            )}
          </div>

          {/* GitlabRepositorySelect Section */}
          <div className="p-4 border border-green-200/60 bg-green-50/50 space-y-4">
            <h3 className="text-xs uppercase tracking-wide font-medium text-green-800">
              GITLAB REPOSITORY SELECT
            </h3>

            {/* Configuration for Repository Select */}
            <div className="p-4 border border-neutral-200/60 bg-neutral-50/50 space-y-4">
              <h4 className="text-xs uppercase tracking-wide font-medium text-neutral-800">
                COMPONENT CONFIGURATION
              </h4>

              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide">
                  GITLAB HOST
                </Label>
                <div className="font-mono text-sm bg-white/90 p-3 border border-gray-200">
                  {host}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide">
                  TOKEN (FROM SELECTED SECRET)
                </Label>
                <div className="font-mono text-sm bg-white/90 p-3 border border-gray-200">
                  {selectedSecret ? "•••••••••••••••••••" : <span className="text-gray-400">No secret selected</span>}
                </div>
              </div>
            </div>

            {/* Component Test */}
            {selectedSecret && selectedSecret.id ? (
              <GitlabRepositorySelect
                client={client}
                host={host}
                secretId={selectedSecret.id}
                value={selectedRepositoryId}
                onChange={(repoId, repo) => {
                  console.log("Selected repository ID:", repoId, repo)
                  setSelectedRepositoryId(repoId)
                  setSelectedRepository(repo)
                }}
                required={true}
              />
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p className="text-xs uppercase tracking-wide">
                  Please select a GitLab token secret first
                </p>
              </div>
            )}
          </div>

          {/* State Display */}
          <div className="p-4 border border-purple-200/60 bg-purple-50/50 space-y-4">
            <h3 className="text-xs uppercase tracking-wide font-medium text-purple-800">
              COMPONENT STATE
            </h3>

            <div className="space-y-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500">
                  PROJECT ID
                </div>
                <div className="font-mono text-sm mt-1">
                  {projectId || <span className="text-gray-400">not selected</span>}
                </div>
              </div>

              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500">
                  SELECTED SECRET ID
                </div>
                <div className="font-mono text-sm mt-1">
                  {selectedSecretId || <span className="text-gray-400">null</span>}
                </div>
              </div>

              {selectedSecret && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-500">
                    SELECTED SECRET
                  </div>
                  <div className="bg-white/90 p-3 border border-gray-200 mt-1 font-mono text-xs">
                    <pre>{JSON.stringify(selectedSecret, null, 2)}</pre>
                  </div>
                </div>
              )}

              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500">
                  SELECTED REPOSITORY ID
                </div>
                <div className="font-mono text-sm mt-1">
                  {selectedRepositoryId || <span className="text-gray-400">null</span>}
                </div>
              </div>

              {selectedRepository && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-500">
                    REPOSITORY DETAILS
                  </div>
                  <div className="bg-white/90 p-3 border border-gray-200 mt-1 font-mono text-xs">
                    <pre>{JSON.stringify(selectedRepository, null, 2)}</pre>
                  </div>
                </div>
              )}

              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500">
                  CALLBACK LOGS
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  Open browser console to see onChange and onSecretCreated logs
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
