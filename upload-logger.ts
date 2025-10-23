import { readFileSync } from 'fs'

const gitlabHost = 'https://gitlab.com'
const gitlabToken = process.env.GITLAB_TOKEN!
const projectId = '75530560'
const version = '2025-10-18-01'

async function uploadFile(filePath: string, gitlabPath: string) {
  const content = readFileSync(filePath, 'utf-8')
  const encodedContent = Buffer.from(content).toString('base64')

  const response = await fetch(`${gitlabHost}/api/v4/projects/${projectId}/repository/files/${encodeURIComponent(gitlabPath)}`, {
    method: 'POST',
    headers: {
      'PRIVATE-TOKEN': gitlabToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      branch: 'main',
      content: encodedContent,
      commit_message: '✨ Add logger for worker scripts',
      encoding: 'base64'
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    // File might already exist, try updating instead
    if (errorText.includes('already exists')) {
      console.log(`File exists, updating instead...`)
      const updateResponse = await fetch(`${gitlabHost}/api/v4/projects/${projectId}/repository/files/${encodeURIComponent(gitlabPath)}`, {
        method: 'PUT',
        headers: {
          'PRIVATE-TOKEN': gitlabToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          branch: 'main',
          content: encodedContent,
          commit_message: '✨ Add logger for worker scripts',
          encoding: 'base64'
        })
      })

      if (!updateResponse.ok) {
        throw new Error(`Failed to update: ${await updateResponse.text()}`)
      }
      return
    }
    throw new Error(`GitLab API error: ${response.status}\n${errorText}`)
  }
}

async function main() {
  console.log('Uploading logger.ts...')

  await uploadFile(
    './packages/worker/templates/2025-10-18-01/worker-scripts/shared/logger.ts',
    `${version}/worker-scripts/shared/logger.ts`
  )

  console.log('✅ Logger uploaded successfully')
}

main().catch(console.error)
