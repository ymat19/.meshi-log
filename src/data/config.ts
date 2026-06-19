import type { Config } from './types'

// Canonical app configuration: which nutrients and meal types exist and how
// they are labelled. Bundled with the app and returned by both data sources,
// so mock and real modes stay perfectly in sync.
export const config: Config = {
  nutrients: [
    { key: 'energy_kcal', label: 'エネルギー', unit: 'kcal' },
    { key: 'protein_g', label: 'たんぱく質', unit: 'g' },
    { key: 'fat_g', label: '脂質', unit: 'g' },
    { key: 'saturated_fat_g', label: '飽和脂肪酸', unit: 'g' },
    { key: 'carbohydrate_g', label: '炭水化物', unit: 'g' },
    { key: 'sugar_g', label: '糖質', unit: 'g' },
    { key: 'fiber_g', label: '食物繊維', unit: 'g' },
    { key: 'salt_g', label: '食塩相当量', unit: 'g' },
    { key: 'alcohol_g', label: 'アルコール', unit: 'g' },
  ],
  mealTypes: [
    { key: 'breakfast', label: '朝食' },
    { key: 'lunch', label: '昼食' },
    { key: 'dinner', label: '夕食' },
    { key: 'snack', label: '間食' },
  ],
}
