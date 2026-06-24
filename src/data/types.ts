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
  // Every food item carries its own full nutrition breakdown — it is the single
  // source of truth. A meal's total is always derived by summing its items
  // (see entryTotals in lib/nutrition.ts); the entry never stores a redundant
  // total that could drift from the breakdown.
  nutrition: Nutrition
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
  memo: string
  tags: string[]
  estimated: boolean // true when nutrition came from AI estimation
  schemaVersion: number
}

export interface NutrientDef {
  key: NutrientKey
  label: string
  unit: string
  // When true, every recorded entry MUST carry this nutrient (validated in CI).
  // Optional nutrients (e.g. alcohol) are only present when relevant.
  required?: boolean
  // Reference daily amount used to plot the trend as a percentage of target,
  // so nutrients with very different units/scales share one axis. For nutrients
  // you want to meet (protein, fibre) this is a recommended minimum; for ones
  // you want to cap (salt, saturated fat, sugar, alcohol, energy) it is an
  // upper guideline. Editable defaults — not medical advice.
  target?: number
  // Which direction of the target is the "bad" one, so the UI can show whether
  // crossing 100% is good or bad:
  //  - 'limit' (上限型): stay UNDER the target — exceeding it is the warning.
  //  - 'reach' (目標型): reach the target — falling short is the warning.
  // Defaults to 'limit' when unset.
  goal?: 'limit' | 'reach'
}

export interface MealTypeDef {
  key: MealType
  label: string
}

export interface Config {
  nutrients: NutrientDef[]
  mealTypes: MealTypeDef[]
}
