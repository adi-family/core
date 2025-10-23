import { readFileSync } from 'fs'

const gitlabHost = 'https://gitlab.com'
const gitlabToken = process.env.GITLAB_TOKEN!
const projectId = '75530560'
const version = '2025-10-18-01'

const files = [
  'evaluation-pipeline.ts',
  'claude-pipeline.ts',
  'codex-pipeline.ts',
  'gemini-pipeline.ts',
  'upload-results.ts'
]

async function uploadFile(filename: string) {
  const filePath = `./packages/worker/templates/${version}/worker-scripts/${filename}`
  const gitlabPath = `${version}/worker-scripts/${filename}`

  console.log(`Uploading ${filename}...`)

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
      commit_message: `🔧 Fix logger imports in ${filename}`,
      encoding: 'base64'
    })
  })

  if (!response.ok) {
    throw new Error(`Failed to upload ${filename}: ${await response.text()}`)
  }

  console.log(`✅ ${filename}`)
}

async function main() {
  console.log('Uploading updated pipeline files...\n')

  for (const file of files) {
    await uploadFile(file)
  }

  console.log('\n✅ All pipeline files uploaded successfully!')
}

main().catch(console.error)
