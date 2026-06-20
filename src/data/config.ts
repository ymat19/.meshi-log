import type { Config } from './types'

// Canonical app configuration: which nutrients and meal types exist and how
// they are labelled. Bundled with the app and returned by both data sources,
// so mock and real modes stay perfectly in sync.
export const config: Config = {
  // `target` is a daily reference amount (based on 日本人の食事摂取基準 2020 for an
  // adult, leaning toward metabolic-syndrome management). The trend chart plots
  // each nutrient as a percentage of its target so different units share one
  // axis. Tune these to your own targets — they are plain editable defaults.
  nutrients: [
    { key: 'energy_kcal', label: 'エネルギー', unit: 'kcal', required: true, target: 2000 },
    { key: 'protein_g', label: 'たんぱく質', unit: 'g', required: true, target: 65 },
    { key: 'fat_g', label: '脂質', unit: 'g', required: true, target: 60 },
    { key: 'saturated_fat_g', label: '飽和脂肪酸', unit: 'g', required: true, target: 16 },
    { key: 'carbohydrate_g', label: '炭水化物', unit: 'g', required: true, target: 300 },
    { key: 'sugar_g', label: '糖質', unit: 'g', required: true, target: 250 },
    { key: 'fiber_g', label: '食物繊維', unit: 'g', required: true, target: 21 },
    { key: 'salt_g', label: '食塩相当量', unit: 'g', required: true, target: 7.5 },
    // Only present when the meal contained alcohol; not required.
    { key: 'alcohol_g', label: 'アルコール', unit: 'g', target: 20 },
  ],
  mealTypes: [
    { key: 'breakfast', label: '朝食' },
    { key: 'lunch', label: '昼食' },
    { key: 'dinner', label: '夕食' },
    { key: 'snack', label: '間食' },
  ],
}
