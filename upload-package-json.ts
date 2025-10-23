import { readFileSync } from 'fs'

const gitlabHost = 'https://gitlab.com'
const gitlabToken = process.env.GITLAB_TOKEN!
const projectId = '75530560'
const version = '2025-10-18-01'

async function main() {
  console.log('Uploading updated package.json...')

  const filePath = `./packages/worker/templates/${version}/worker-scripts/package.json`
  const gitlabPath = `${version}/worker-scripts/package.json`

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
      commit_message: '📦 Add Anthropic SDK to package.json',
      encoding: 'base64'
    })
  })

  if (!response.ok) {
    throw new Error(`Failed: ${await response.text()}`)
  }

  console.log('✅ package.json uploaded successfully')
  console.log('⚠️  Note: You\'ll need to clear the GitLab cache and rerun prepare stage for dependencies to update')
}

main().catch(console.error)
