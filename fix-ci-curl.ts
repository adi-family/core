import { GitLabApiClient } from './packages/shared/gitlab-api-client'

const gitlabHost = 'https://gitlab.com'
const gitlabToken = process.env.GITLAB_ACCESS_TOKEN!
const projectId = '75530560'
const version = '2025-10-18-01'
const filePath = `${version}/.gitlab-ci-evaluation.yml`

async function main() {
  console.log('Fixing CI config to use fetch instead of curl...')

  const client = new GitLabApiClient(gitlabHost, gitlabToken)

  // Get current CI config
  const file = await client.getFile(projectId, filePath, 'main')
  let content = Buffer.from(file.content, 'base64').toString('utf-8')

  console.log('Current CI config fetched')

  // Replace curl commands with Bun fetch
  const curlPattern = /curl -X PATCH "\$API_BASE_URL\/pipeline-executions\/\$PIPELINE_EXECUTION_ID" \\\s+-H "Authorization: Bearer \$API_TOKEN" \\\s+-H "Content-Type: application\/json" \\\s+-d '(\{[^}]+\})'/g

  content = content.replace(curlPattern, (match, jsonData) => {
    return `bun -e "await fetch(process.env.API_BASE_URL + '/pipeline-executions/' + process.env.PIPELINE_EXECUTION_ID, { method: 'PATCH', headers: { 'Authorization': 'Bearer ' + process.env.API_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify(${jsonData}) })"`
  })

  console.log('Curl commands replaced with fetch')

  // Update the file on GitLab
  await client.updateFile(
    projectId,
    filePath,
    'main',
    content,
    '🔧 Replace curl with bun fetch for status updates'
  )

  console.log('✅ CI config updated successfully')
}

main().catch(console.error)
