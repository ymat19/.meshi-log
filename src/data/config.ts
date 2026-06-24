import type { Config } from './types'

// Canonical app configuration: which nutrients and meal types exist and how
// they are labelled. Bundled with the app and returned by both data sources,
// so mock and real modes stay perfectly in sync.
export const config: Config = {
  // `target` is a daily reference amount. The trend chart plots each nutrient as
  // a percentage of its target so different units share one axis.
  //
  // `goal` marks whether the target is an upper limit to stay under ('limit',
  // the default) or a minimum to reach ('reach'). Only たんぱく質・食物繊維 are
  // 目標型; everything else is 上限型. Drives the good/bad colouring everywhere.
  //
  // These targets are personalised for a weight-loss / metabolic-syndrome phase
  // (身長170cm・体重76kg・BMI26.2＝肥満1度・体脂肪率24.9%・内臓脂肪レベル11・実測
  // 基礎代謝1,615kcal）, derived from a deep-research pass over the evidence:
  //  - エネルギー 1800kcal: 実測BMR(1,615)を下回らず、座位TDEE(≈2,260–2,500)から
  //    約500–700kcal赤字＝週0.5kg減。肥満症診療GL2022の目標体重(63.6kg)×25kcal
  //    ≒1,590kcal と、緩やかな減量の中間に置いた持続可能なライン。
  //  - たんぱく質 110g: 減量中の除脂肪・骨量維持に1.4–1.6g/kg体重（筋肉54kg・骨量
  //    不足の維持目的）。ISSN/減量レビューの推奨域。
  //  - 脂質 50g(総E25%) / 飽和脂肪酸 14g(7%E) / 炭水化物 225g(50%E) / 糖質 200g
  //    (炭水化物−食物繊維): 肥満症GL2022・動脈硬化予防GL2022のPFC配分に整合。
  //  - 食物繊維 22g: 食事摂取基準2025で30–49歳男性が21→22gに引上げ。
  //  - 食塩 6.0g: メタボ・高血圧重症化予防の目標(6.0g未満)。
  // 出典: 日本人の食事摂取基準2025 / 肥満症診療ガイドライン2022(日本肥満学会) /
  // 動脈硬化性疾患予防ガイドライン2022 / 厚労省 特定保健指導・e-ヘルスネット。
  // 医療助言ではない編集可能な既定値。体組成の変化を見て微調整すること。
  nutrients: [
    { key: 'energy_kcal', label: 'エネルギー', unit: 'kcal', required: true, target: 1800 },
    { key: 'protein_g', label: 'たんぱく質', unit: 'g', required: true, target: 110, goal: 'reach' },
    { key: 'fat_g', label: '脂質', unit: 'g', required: true, target: 50 },
    { key: 'saturated_fat_g', label: '飽和脂肪酸', unit: 'g', required: true, target: 14 },
    { key: 'carbohydrate_g', label: '炭水化物', unit: 'g', required: true, target: 225 },
    { key: 'sugar_g', label: '糖質', unit: 'g', required: true, target: 200 },
    { key: 'fiber_g', label: '食物繊維', unit: 'g', required: true, target: 22, goal: 'reach' },
    { key: 'salt_g', label: '食塩相当量', unit: 'g', required: true, target: 6 },
    // Only present when the meal contained alcohol; not required.
    // 減量中はできるだけ控える前提だが、上限の目安は節度ある適度な飲酒の純アル20g。
    { key: 'alcohol_g', label: 'アルコール', unit: 'g', target: 20 },
  ],
  mealTypes: [
    { key: 'breakfast', label: '朝食' },
    { key: 'lunch', label: '昼食' },
    { key: 'dinner', label: '夕食' },
    { key: 'snack', label: '間食' },
  ],
}
