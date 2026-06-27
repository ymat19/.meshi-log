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
  // エネルギー2,000kcal(基礎代謝を下回らない下限)と、トレーナーのご提案プランのPFC
  // (たんぱく質126g/脂質37g/炭水化物210g)は固定値。ここは動かさない。
  // 提案に値が無い成分(飽和脂肪酸・糖質・食物繊維・食塩・アルコール)は、提案の食事
  // (脂質37g・炭水化物210g)で日々ムリなく届く"実現可能な範囲"の標準値に置く。攻めた
  // 健康目標ではなく、現実に運用できる水準を優先する。
  //  - 飽和脂肪酸 14g: 脂質37gの現実的な内訳(約4割)に収まる上限の目安。
  //  - 糖質 189g: 炭水化物210−食物繊維21(データ全体で一貫する導出規則)。
  //  - 食物繊維 21g: 成人男性の標準的な摂取目安。届く範囲の到達目標(目標型)。
  //  - 食塩 7g: 無理なく達成しうるライン(一般目安7.5gよりやや控えめ程度)。
  //  - アルコール 20g: 飲む日の上限目安(節度ある適度な飲酒)。
  // 本人: 男性29歳・170cm・76kg・BMI26.2・目標73kg・運動週1、消費2,101kcal/日。
  // 体重・期間の管理は本アプリの責務外(食事記録に専念)。医療助言ではない編集可能な
  // 既定値で、実際に続けられるかを見て随時調整すること。
  nutrients: [
    { key: 'energy_kcal', label: 'エネルギー', unit: 'kcal', required: true, target: 2000 },
    { key: 'protein_g', label: 'たんぱく質', unit: 'g', required: true, target: 126, goal: 'reach' },
    { key: 'fat_g', label: '脂質', unit: 'g', required: true, target: 37 },
    { key: 'saturated_fat_g', label: '飽和脂肪酸', unit: 'g', required: true, target: 14 },
    { key: 'carbohydrate_g', label: '炭水化物', unit: 'g', required: true, target: 210 },
    { key: 'sugar_g', label: '糖質', unit: 'g', required: true, target: 189 },
    { key: 'fiber_g', label: '食物繊維', unit: 'g', required: true, target: 21, goal: 'reach' },
    { key: 'salt_g', label: '食塩相当量', unit: 'g', required: true, target: 7 },
    // Only present when the meal contained alcohol; not required.
    // 飲む日の上限目安は節度ある適度な飲酒の純アルコール20g(無理のない実現可能な範囲)。
    { key: 'alcohol_g', label: 'アルコール', unit: 'g', target: 20 },
  ],
  mealTypes: [
    { key: 'breakfast', label: '朝食' },
    { key: 'lunch', label: '昼食' },
    { key: 'dinner', label: '夕食' },
    { key: 'snack', label: '間食' },
  ],
}
