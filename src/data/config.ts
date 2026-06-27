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
  // 摂取エネルギー目標だけは「基礎代謝を下回らない」ことを優先して2,000kcalに置く。
  // 提案PFC(たんぱく質126g/脂質37g/炭水化物210g)はそのまま採用し、提案に値が無い
  // 成分は一般人口向けの目安そのままにせず、本人の現状と減量目標に合わせて個別設定する。
  // 本人: 男性29歳・170cm・76kg・BMI26.2(肥満1度)・体脂肪率24.9%・内臓脂肪レベル11・
  // 骨量不足、目標73kg・減量、運動週1。基礎代謝は推定1,751/実測1,615kcal、消費2,101/日。
  // 提案の摂取1,681kcalはBMRを割り込むため不採用とし、両BMRを上回る2,000kcalを採る。
  //  - エネルギー 2000kcal: BMRを下回らない減量ライン(消費2,101から約100kcal赤字)。
  //    提案PFCの合計(約1,677kcal)とは独立した下限の保護目標として置く。
  //  - たんぱく質 126g / 脂質 37g / 炭水化物 210g: 提案のPFCをそのまま採用。
  //  - 飽和脂肪酸 12g: 内臓脂肪レベル11・心血管リスクを踏まえ一般目安(7%E≒16g)より
  //    厳しく、脂質37gの約1/3に抑え残りは不飽和から摂る前提(≒5.4%E)。
  //  - 糖質 185g: 炭水化物210−食物繊維25(データ全体で一貫する導出規則)。
  //  - 食物繊維 25g: 減量中の満腹感・血糖/脂質コントロールを優先し、最低目安(21–22g)
  //    より高い到達目標(目標型)に引上げ。
  //  - 食塩 6.0g未満: 成人男性の一般目安(7.5g)ではなく、メタボ・高血圧リスク管理として
  //    厳しめの6gを本人基準で採用。
  // 体重・期間の管理は本アプリの責務外(食事記録に専念)。医療助言ではない編集可能な
  // 既定値で、体組成の変化を見て随時調整すること。
  nutrients: [
    { key: 'energy_kcal', label: 'エネルギー', unit: 'kcal', required: true, target: 2000 },
    { key: 'protein_g', label: 'たんぱく質', unit: 'g', required: true, target: 126, goal: 'reach' },
    { key: 'fat_g', label: '脂質', unit: 'g', required: true, target: 37 },
    { key: 'saturated_fat_g', label: '飽和脂肪酸', unit: 'g', required: true, target: 12 },
    { key: 'carbohydrate_g', label: '炭水化物', unit: 'g', required: true, target: 210 },
    { key: 'sugar_g', label: '糖質', unit: 'g', required: true, target: 185 },
    { key: 'fiber_g', label: '食物繊維', unit: 'g', required: true, target: 25, goal: 'reach' },
    { key: 'salt_g', label: '食塩相当量', unit: 'g', required: true, target: 6 },
    // Only present when the meal contained alcohol; not required.
    // 減量・内臓脂肪低減と禁酒記録の趣旨を優先し、飲む日の上限目安は適量(20g)の半分10g。
    { key: 'alcohol_g', label: 'アルコール', unit: 'g', target: 10 },
  ],
  mealTypes: [
    { key: 'breakfast', label: '朝食' },
    { key: 'lunch', label: '昼食' },
    { key: 'dinner', label: '夕食' },
    { key: 'snack', label: '間食' },
  ],
}
