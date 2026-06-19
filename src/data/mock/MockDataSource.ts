import type { Config, MealEntry } from '../types'
import type { MealDataSource } from '../MealDataSource'
import { config } from '../config'
import { generateMeals } from './generator'

// Mock data source: produces a rich, deterministic dataset in memory so the
// dashboard can be previewed fully even when little or no real data exists.
// Returns the same Config and MealEntry types as the real source.
export class MockDataSource implements MealDataSource {
  private readonly days: number
  private readonly seed: number

  constructor(days = 90, seed = 42) {
    this.days = days
    this.seed = seed
  }

  async getConfig(): Promise<Config> {
    return config
  }

  async getEntries(): Promise<MealEntry[]> {
    const months = generateMeals(new Date(), this.days, this.seed)
    return months
      .flatMap((m) => m.entries)
      .sort((a, b) => (a.datetime < b.datetime ? 1 : -1))
  }
}
