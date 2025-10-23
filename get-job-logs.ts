const gitlabHost = 'https://gitlab.com'
const gitlabToken = process.env.GITLAB_TOKEN!
const projectId = '75530560'
const pipelineId = '2115318899'

async function main() {
  // Get jobs
  const jobsResponse = await fetch(`${gitlabHost}/api/v4/projects/${projectId}/pipelines/${pipelineId}/jobs`, {
    headers: {
      'PRIVATE-TOKEN': gitlabToken
    }
  })

  const jobs = await jobsResponse.json()
  const executeJob = jobs.find((j: any) => j.name === 'execute')

  if (!executeJob) {
    console.log('Execute job not found')
    return
  }

  console.log(`Fetching logs for job ${executeJob.id}...`)

  const logsResponse = await fetch(`${gitlabHost}/api/v4/projects/${projectId}/jobs/${executeJob.id}/trace`, {
    headers: {
      'PRIVATE-TOKEN': gitlabToken
    }
  })

  const logs = await logsResponse.text()
  console.log(logs)

  process.exit(0)
}

main().catch(console.error)
