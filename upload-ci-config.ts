import { readFileSync } from 'fs'

const gitlabHost = 'https://gitlab.com'
const gitlabToken = process.env.GITLAB_TOKEN!
const projectId = '75530560'
const version = '2025-10-18-01'
const filePath = `${version}/.gitlab-ci-evaluation.yml`

async function main() {
  console.log('Uploading updated CI config to GitLab...')

  // Read the local template file
  const localFilePath = `./packages/worker/templates/${version}/.gitlab-ci-evaluation.yml`
  const content = readFileSync(localFilePath, 'utf-8')

  console.log('Local CI config loaded')

  // Base64 encode the content
  const encodedContent = Buffer.from(content).toString('base64')

  // Update the file on GitLab
  const response = await fetch(`${gitlabHost}/api/v4/projects/${projectId}/repository/files/${encodeURIComponent(filePath)}`, {
    method: 'PUT',
    headers: {
      'PRIVATE-TOKEN': gitlabToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      branch: 'main',
      content: encodedContent,
      commit_message: '🔧 Replace curl with bun fetch and fix all paths',
      encoding: 'base64'
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`GitLab API error: ${response.status} ${response.statusText}\n${errorText}`)
  }

  const result = await response.json()
  console.log('✅ CI config updated successfully')
  console.log('📝 File path:', result.file_path)
}

main().catch(console.error)
