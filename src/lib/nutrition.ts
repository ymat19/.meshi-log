import type { MealEntry, Nutrition, NutrientKey } from '../data/types'

// A meal's total nutrition, derived by summing its items. The entry itself
// stores no total, so this is the only way a meal total exists — there is
// nothing to drift from the breakdown.
export function entryTotals(entry: MealEntry): Nutrition {
  return sumNutrition(entry.items.map((i) => i.nutrition))
}

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

// Today's calendar date in JST (YYYY-MM-DD), independent of the runtime tz.
export function todayJST(): string {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  return jst.toISOString().slice(0, 10)
}

// Whole calendar days between two YYYY-MM-DD strings (a - b).
function daysBetween(a: string, b: string): number {
  const da = Date.parse(`${a}T00:00:00Z`)
  const db = Date.parse(`${b}T00:00:00Z`)
  return Math.round((da - db) / 86_400_000)
}

export interface SoberStreak {
  days: number // 禁酒○日目 of this number
  // True when an actual drinking day anchors the streak; false when no alcohol
  // has ever been recorded (the streak is then counted from the first record).
  hasDrinkRecord: boolean
}

// 禁酒日数（○日目）。最後に飲んだ日を起点に数える。
// 「前日飲んでいたら 0 日目」= 昨日が最後の飲酒なら 0、一昨日なら 1 …。
// （= 最後の飲酒日からの経過日数 - 1。当日に飲んでいれば 0 で下限）。
// アルコールの記録が一度もなければ、最初の記録日からの経過日数を返す。
export function soberStreak(entries: MealEntry[], today = todayJST()): SoberStreak {
  let lastDrink: string | null = null
  let earliest: string | null = null
  for (const e of entries) {
    const date = e.datetime.slice(0, 10)
    if (earliest === null || date < earliest) earliest = date
    const drank = e.items.some((i) => (i.nutrition.alcohol_g ?? 0) > 0)
    if (drank && (lastDrink === null || date > lastDrink)) {
      lastDrink = date
    }
  }
  if (lastDrink) {
    return { days: Math.max(0, daysBetween(today, lastDrink) - 1), hasDrinkRecord: true }
  }
  return { days: earliest ? Math.max(0, daysBetween(today, earliest)) : 0, hasDrinkRecord: false }
}

export interface DailyTotal {
  date: string // YYYY-MM-DD
  totals: Nutrition
}

// Daily summed nutrition, sorted ascending by date (oldest first) for charts.
// Optionally limited to the most recent `days` calendar days that have data.
export function dailyTotals(entries: MealEntry[], days?: number): DailyTotal[] {
  const all = groupByDate(entries)
    .map(([date, es]) => ({ date, totals: sumNutrition(es.map(entryTotals)) }))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
  return typeof days === 'number' ? all.slice(-days) : all
}
