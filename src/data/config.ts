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
  // These targets follow the trainer's ご提案プラン (proposed weight-loss plan):
  // 男性29歳・身長170cm・体重76kg、目標73kg(-3kg)、基礎代謝1,751kcal・消費2,101kcal/日。
  // 提案は総エネルギーと3大栄養素(PFC)だけを定めるので、エネルギー・たんぱく質・
  // 脂質・炭水化物はその値をそのまま採用し、提案が触れない成分(飽和脂肪酸・糖質・
  // 食物繊維・食塩)はガイドラインから補完する。
  //  - エネルギー 1681kcal: 提案の摂取カロリー(消費2,101から約420kcal赤字)。
  //  - たんぱく質 126g(504kcal): 提案値。減量中の除脂肪維持に約1.7g/kg(目標体重比)。
  //  - 脂質 37g(333kcal≈総E20%) / 炭水化物 210g(840kcal=総E50%): 提案のPFC配分。
  //  - 飽和脂肪酸 13g: 提案に無いのでガイドライン。動脈硬化予防GL2022の7%E＝1,681×7%/9。
  //  - 糖質 188g: 炭水化物210−食物繊維22(データ全体で一貫する導出規則)。
  //  - 食物繊維 22g: 食事摂取基準2025で30–49歳男性が21→22gに引上げ。
  //  - 食塩 6.0g: メタボ・高血圧重症化予防の目標(6.0g未満)。
  // 出典: トレーナー作成の目標設定シート(ご提案プラン) / 日本人の食事摂取基準2025 /
  // 動脈硬化性疾患予防ガイドライン2022 / 厚労省 特定保健指導・e-ヘルスネット。
  // 体重・期間の管理は本アプリの責務外(食事記録に専念)。医療助言ではない編集可能な
  // 既定値で、体組成の変化を見て微調整すること。
  nutrients: [
    { key: 'energy_kcal', label: 'エネルギー', unit: 'kcal', required: true, target: 1681 },
    { key: 'protein_g', label: 'たんぱく質', unit: 'g', required: true, target: 126, goal: 'reach' },
    { key: 'fat_g', label: '脂質', unit: 'g', required: true, target: 37 },
    { key: 'saturated_fat_g', label: '飽和脂肪酸', unit: 'g', required: true, target: 13 },
    { key: 'carbohydrate_g', label: '炭水化物', unit: 'g', required: true, target: 210 },
    { key: 'sugar_g', label: '糖質', unit: 'g', required: true, target: 188 },
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
