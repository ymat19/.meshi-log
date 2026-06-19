import type { Config, MealEntry } from './types'
import type { MealDataSource } from './MealDataSource'
import { config } from './config'

const BASE = import.meta.env.BASE_URL

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`fetch failed: ${path} (${res.status})`)
  return (await res.json()) as T
}

// Real data source: reads the monthly JSON files committed to the repo and
// served by GitHub Pages. data/index.json lists which months exist.
export class HttpDataSource implements MealDataSource {
  async getConfig(): Promise<Config> {
    return config
  }

  async getEntries(): Promise<MealEntry[]> {
    const index = await fetchJson<{ months: string[] }>('data/index.json')
    const months = await Promise.all(
      index.months.map((m) =>
        fetchJson<MealEntry[]>(`data/${m}.json`).catch(() => [] as MealEntry[]),
      ),
    )
    return months.flat().sort((a, b) => (a.datetime < b.datetime ? 1 : -1))
  }
}
