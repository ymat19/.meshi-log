// Single source of truth for the shape of all meal data.
// Both the real (HTTP) and mock data sources produce exactly these types,
// so the application never needs to know which source it is consuming.

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

// Nutrition is an open-ended record keyed by nutrient. Every field is
// optional so entries and the mock generator can omit unknown values.
export interface Nutrition {
  energy_kcal?: number
  protein_g?: number
  fat_g?: number
  saturated_fat_g?: number
  carbohydrate_g?: number
  sugar_g?: number
  fiber_g?: number
  salt_g?: number
  alcohol_g?: number
}

export type NutrientKey = keyof Nutrition

export interface MealItem {
  name: string
  nutrition?: Nutrition
}

export interface MealEntry {
  id: string
  // ISO 8601 with JST offset, e.g. 2026-06-19T12:30:00+09:00.
  // NOTE: only the DATE part is meaningful (used for day-grouping and ordering).
  // The time-of-day is not captured reliably (stripped from uploads) and is not
  // displayed in the UI — do not treat it as the real meal time.
  datetime: string
  type: MealType
  photos: string[]
  items: MealItem[]
  nutrition: Nutrition // totals for the entry
  memo: string
  tags: string[]
  estimated: boolean // true when nutrition came from AI estimation
  schemaVersion: number
}

export interface NutrientDef {
  key: NutrientKey
  label: string
  unit: string
}

export interface MealTypeDef {
  key: MealType
  label: string
}

export interface Config {
  nutrients: NutrientDef[]
  mealTypes: MealTypeDef[]
}
