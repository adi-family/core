import { readFileSync } from 'fs'

const gitlabHost = 'https://gitlab.com'
const gitlabToken = process.env.GITLAB_TOKEN!
const projectId = '75530560'
const version = '2025-10-18-01'

async function main() {
  console.log('Uploading api-client.ts...')

  const filePath = `./packages/worker/templates/${version}/worker-scripts/shared/api-client.ts`
  const gitlabPath = `${version}/worker-scripts/shared/api-client.ts`

  const content = readFileSync(filePath, 'utf-8')
  const encodedContent = Buffer.from(content).toString('base64')

  const response = await fetch(`${gitlabHost}/api/v4/projects/${projectId}/repository/files/${encodeURIComponent(gitlabPath)}`, {
    method: 'PUT',
    headers: {
      'PRIVATE-TOKEN': gitlabToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      branch: 'main',
      content: encodedContent,
      commit_message: '🔄 Replace Hono RPC client with standalone fetch client',
      encoding: 'base64'
    })
  })

  if (!response.ok) {
    throw new Error(`Failed: ${await response.text()}`)
  }

  console.log('✅ api-client.ts uploaded successfully')
}

main().catch(console.error)
