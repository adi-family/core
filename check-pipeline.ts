const gitlabHost = 'https://gitlab.com'
const gitlabToken = process.env.GITLAB_TOKEN!
const projectId = '75530560'
const pipelineId = '2115318899'

async function main() {
  console.log(`Checking pipeline ${pipelineId}...`)

  const response = await fetch(`${gitlabHost}/api/v4/projects/${projectId}/pipelines/${pipelineId}`, {
    headers: {
      'PRIVATE-TOKEN': gitlabToken
    }
  })

  if (!response.ok) {
    throw new Error(`GitLab API error: ${response.status}`)
  }

  const pipeline = await response.json()
  console.log(`Status: ${pipeline.status}`)
  console.log(`Web URL: ${pipeline.web_url}`)

  // Get jobs
  const jobsResponse = await fetch(`${gitlabHost}/api/v4/projects/${projectId}/pipelines/${pipelineId}/jobs`, {
    headers: {
      'PRIVATE-TOKEN': gitlabToken
    }
  })

  const jobs = await jobsResponse.json()
  console.log('\nJobs:')
  for (const job of jobs) {
    console.log(`  - ${job.name}: ${job.status}`)
    if (job.status === 'failed') {
      console.log(`    Failure reason: ${job.failure_reason || 'unknown'}`)
    }
  }

  process.exit(0)
}

main().catch(console.error)
