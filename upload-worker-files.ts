import { CIRepositoryManager } from './packages/worker/ci-repository-manager'
import { createLogger } from './packages/utils/logger'

const logger = createLogger({ namespace: 'upload-worker' })

async function main() {
  logger.info('Uploading updated worker files to GitLab...')

  const manager = new CIRepositoryManager()
  const version = '2025-10-18-01'

  const source = {
    type: 'gitlab' as const,
    project_id: '75530560',
    project_path: 'artifical-developer/adi-worker-nosh',
    host: 'https://gitlab.com',
    user: 'artifical-developer',
    access_token_encrypted: '', // Will use decrypted token from env
  }

  await manager.uploadCIFiles({ source, version })

  logger.info('✅ Worker files uploaded successfully!')
}

main().catch((error) => {
  console.error('❌ Upload failed:', error)
  process.exit(1)
})
