import type { AppConfig } from '../models/config'
import type { D365Service } from './d365Service'
import { MockD365Service } from './mockD365Service'
import { LiveD365Service } from './liveD365Service'

export type { D365Service, CreateTransferInput } from './d365Service'

/**
 * Factory that returns the right connector for the current config.
 * The UI calls this and depends only on the D365Service interface.
 */
export function createD365Service(config: AppConfig): D365Service {
  return config.mode === 'live'
    ? new LiveD365Service(config)
    : new MockD365Service(config)
}
