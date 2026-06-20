import type { MealEntry, MealType, Nutrition } from '../types'
import { mockPhoto } from './sampleImages'

// Deterministic PRNG (mulberry32) so a given seed always yields the same
// dataset — previews stay stable across reloads and layout tweaks.
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Dish {
  name: string
  tags: string[]
  type: MealType
  base: Nutrition
}

const DISHES: Dish[] = [
  { name: '焼き鮭定食', tags: ['和食', '自炊'], type: 'breakfast',
    base: { energy_kcal: 480, protein_g: 30, fat_g: 14, saturated_fat_g: 3, carbohydrate_g: 60, sugar_g: 56, fiber_g: 4, salt_g: 2.4 } },
  { name: 'トーストと卵', tags: ['洋食', '自炊'], type: 'breakfast',
    base: { energy_kcal: 420, protein_g: 16, fat_g: 18, saturated_fat_g: 6, carbohydrate_g: 48, sugar_g: 45, fiber_g: 3, salt_g: 1.8 } },
  { name: '醤油ラーメン', tags: ['外食', '麺'], type: 'lunch',
    base: { energy_kcal: 720, protein_g: 26, fat_g: 22, saturated_fat_g: 7, carbohydrate_g: 95, sugar_g: 90, fiber_g: 5, salt_g: 6.8 } },
  { name: '幕の内弁当', tags: ['中食', 'コンビニ'], type: 'lunch',
    base: { energy_kcal: 650, protein_g: 24, fat_g: 18, saturated_fat_g: 5, carbohydrate_g: 92, sugar_g: 86, fiber_g: 6, salt_g: 3.2 } },
  { name: '鶏の唐揚げ定食', tags: ['外食', '揚げ物'], type: 'dinner',
    base: { energy_kcal: 850, protein_g: 38, fat_g: 40, saturated_fat_g: 9, carbohydrate_g: 80, sugar_g: 75, fiber_g: 5, salt_g: 4.1 } },
  { name: '野菜炒めと白米', tags: ['和食', '自炊'], type: 'dinner',
    base: { energy_kcal: 600, protein_g: 22, fat_g: 18, saturated_fat_g: 4, carbohydrate_g: 82, sugar_g: 76, fiber_g: 7, salt_g: 2.9 } },
  { name: 'ビールとつまみ', tags: ['お酒'], type: 'dinner',
    base: { energy_kcal: 350, protein_g: 8, fat_g: 12, saturated_fat_g: 3, carbohydrate_g: 22, sugar_g: 20, fiber_g: 2, salt_g: 2.0, alcohol_g: 20 } },
  { name: 'チョコと珈琲', tags: ['間食', '甘味'], type: 'snack',
    base: { energy_kcal: 220, protein_g: 3, fat_g: 12, saturated_fat_g: 7, carbohydrate_g: 26, sugar_g: 24, fiber_g: 2, salt_g: 0.2 } },
  { name: 'ヨーグルト', tags: ['間食'], type: 'snack',
    base: { energy_kcal: 120, protein_g: 6, fat_g: 4, saturated_fat_g: 2, carbohydrate_g: 16, sugar_g: 15, fiber_g: 0, salt_g: 0.1 } },
]

const HOURS: Record<MealType, number> = { breakfast: 7, lunch: 12, dinner: 19, snack: 15 }

function jitter(base: Nutrition, factor: number): Nutrition {
  const out: Nutrition = {}
  for (const [k, v] of Object.entries(base) as [keyof Nutrition, number][]) {
    out[k] = Math.round(v * factor * 10) / 10
  }
  return out
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export interface GeneratedMonth {
  month: string // YYYY-MM
  entries: MealEntry[]
}

// Generates `days` days of meals ending at `endDate`, grouped by month.
export function generateMeals(endDate: Date, days: number, seed = 42): GeneratedMonth[] {
  const rand = mulberry32(seed)
  const byMonth = new Map<string, MealEntry[]>()

  for (let d = 0; d < days; d++) {
    const date = new Date(endDate)
    date.setDate(endDate.getDate() - d)
    const y = date.getFullYear()
    const m = date.getMonth() + 1
    const day = date.getDate()
    const month = `${y}-${pad(m)}`

    // Three core meals daily; snacks roughly half the time.
    const types: MealType[] = ['breakfast', 'lunch', 'dinner']
    if (rand() > 0.5) types.push('snack')

    for (const type of types) {
      const candidates = DISHES.filter((dish) => dish.type === type)
      const dish = candidates[Math.floor(rand() * candidates.length)]
      const minute = Math.floor(rand() * 60)
      const datetime = `${month}-${pad(day)}T${pad(HOURS[type])}:${pad(minute)}:00+09:00`
      const nutrition = jitter(dish.base, 0.85 + rand() * 0.3)

      // Some meals are shot from multiple angles / multiple plates — emit a few
      // photos now and then so the gallery + badge UI shows up in previews.
      const photoCount = rand() > 0.7 ? 2 + Math.floor(rand() * 2) : 1
      const photos = Array.from({ length: photoCount }, (_, i) =>
        mockPhoto(photoCount > 1 ? `${dish.name} ${i + 1}` : dish.name, Math.floor(rand() * 1000)),
      )

      const entry: MealEntry = {
        id: `${datetime}-${type}`,
        datetime,
        type,
        photos,
        items: [{ name: dish.name, nutrition }],
        nutrition,
        memo: '',
        tags: dish.tags,
        estimated: true,
        schemaVersion: 1,
      }

      if (!byMonth.has(month)) byMonth.set(month, [])
      byMonth.get(month)!.push(entry)
    }
  }

  return [...byMonth.entries()].map(([month, entries]) => ({ month, entries }))
}
