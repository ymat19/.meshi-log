import type { Config, MealEntry } from './types'

// The one interface the application depends on. Real and mock implementations
// are interchangeable; nothing downstream of the composition root can tell
// them apart.
export interface MealDataSource {
  getConfig(): Promise<Config>
  getEntries(): Promise<MealEntry[]>
}
