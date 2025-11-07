import { z } from 'zod'
import { ConfigBase } from './config/base'
import {
  API_BASE_URL,
  SERVICE_FQDN_CLIENT,
  GITLAB_HOST,
  GITLAB_TOKEN,
  GITLAB_USER,
  ENCRYPTION_KEY,
} from '../backend/config'

const NonEmpty = z.string().min(1)

const GitLabSchema = z.object({
  host: NonEmpty,
  token: NonEmpty,
  user: NonEmpty,
  encryptionKey: NonEmpty,
})

// Environment variables not in backend/config.ts
const APP_VERSION = process.env.APP_VERSION || ''
const WORKER_TEMPLATE_VERSION = process.env.WORKER_TEMPLATE_VERSION || ''

export class BackendConfig extends ConfigBase {
  protected namespace = 'backend:config'

  get appVersion() {
    return this.required('APP_VERSION', NonEmpty, APP_VERSION)
  }

  get serviceFqdnClient() {
    return this.required('SERVICE_FQDN_CLIENT', NonEmpty, SERVICE_FQDN_CLIENT)
  }

  get templateVersion() {
    return this.required('WORKER_TEMPLATE_VERSION', NonEmpty, WORKER_TEMPLATE_VERSION)
  }

  get apiBaseUrl() {
    return this.required('API_BASE_URL', NonEmpty, API_BASE_URL)
  }

  get gitlab() {
    return this.group('GITLAB', GitLabSchema, {
      host: GITLAB_HOST,
      token: GITLAB_TOKEN,
      user: GITLAB_USER,
      encryptionKey: ENCRYPTION_KEY,
    })
  }
}

export const backendConfig = new BackendConfig()
