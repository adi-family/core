import { z } from 'zod'
import { ConfigBase } from './config/base'

const NonEmpty = z.string().min(1)

export class ClientConfig extends ConfigBase {
  protected namespace = 'client:config'

  get appVersion() {
    return this.required('VITE_APP_VERSION', NonEmpty, import.meta.env.VITE_APP_VERSION)
  }

  get apiUrl() {
    return this.required('VITE_API_URL', NonEmpty, import.meta.env.VITE_API_URL)
  }
}

export const clientConfig = new ClientConfig()

