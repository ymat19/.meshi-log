import type { MealEntry, Nutrition, NutrientKey } from '../data/types'

// Sums a set of nutrition records key by key, ignoring undefined values.
export function sumNutrition(records: Nutrition[]): Nutrition {
  const total: Nutrition = {}
  for (const rec of records) {
    for (const [k, v] of Object.entries(rec) as [NutrientKey, number | undefined][]) {
      if (typeof v === 'number') total[k] = (total[k] ?? 0) + v
    }
  }
  // Round to one decimal to avoid float noise.
  for (const k of Object.keys(total) as NutrientKey[]) {
    total[k] = Math.round((total[k] as number) * 10) / 10
  }
  return total
}

// Groups entries (already newest-first) by their JST calendar date (YYYY-MM-DD).
export function groupByDate(entries: MealEntry[]): [string, MealEntry[]][] {
  const map = new Map<string, MealEntry[]>()
  for (const e of entries) {
    const date = e.datetime.slice(0, 10)
    if (!map.has(date)) map.set(date, [])
    map.get(date)!.push(e)
  }
  return [...map.entries()]
}

export interface DailyTotal {
  date: string // YYYY-MM-DD
  totals: Nutrition
}

// Daily summed nutrition, sorted ascending by date (oldest first) for charts.
// Optionally limited to the most recent `days` calendar days that have data.
export function dailyTotals(entries: MealEntry[], days?: number): DailyTotal[] {
  const all = groupByDate(entries)
    .map(([date, es]) => ({ date, totals: sumNutrition(es.map((e) => e.nutrition)) }))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
  return typeof days === 'number' ? all.slice(-days) : all
}
