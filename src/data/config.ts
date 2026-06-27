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
  // 摂取エネルギーは「基礎代謝を下回らない」ことを最優先に置く。トレーナーの
  // ご提案プラン(男性29歳・身長170cm・体重76kg、目標73kg、基礎代謝1,751kcal・
  // 消費2,101kcal/日)は摂取1,681kcalを示すが、これはシート記載の基礎代謝1,751kcalを
  // 割り込むため不採用とし、推定BMR(1,751)・過去の実測BMR(1,615)の双方を上回る
  // 2,000kcalを採る。消費2,101に対し約100kcalの緩やかな赤字。PFCは提案が重視する
  // たんぱく質量(126g)を踏襲しつつ、残りを2,000kcalにガイドラインのE比で再配分する。
  //  - エネルギー 2000kcal: 基礎代謝を下回らない範囲での緩やかな減量ライン。
  //  - たんぱく質 126g(504kcal≈25%E): 提案値を踏襲。減量中の除脂肪維持に約1.7g/kg。
  //  - 脂質 55g(495kcal≈25%E) / 炭水化物 250g(1000kcal=50%E): 残りエネルギーを
  //    動脈硬化予防GL2022・肥満症GL2022のPFC配分(脂質25%E前後・炭水化物50%E)で配分。
  //  - 飽和脂肪酸 16g: 動脈硬化予防GL2022の7%E＝2,000×7%/9。
  //  - 糖質 228g: 炭水化物250−食物繊維22(データ全体で一貫する導出規則)。
  //  - 食物繊維 22g: 食事摂取基準2025で30–49歳男性が21→22gに引上げ。
  //  - 食塩 6.0g: メタボ・高血圧重症化予防の目標(6.0g未満)。
  // 出典: トレーナー作成の目標設定シート(ご提案プラン/基本項目) / 日本人の食事摂取
  // 基準2025 / 動脈硬化性疾患予防ガイドライン2022 / 肥満症診療ガイドライン2022 /
  // 厚労省 特定保健指導・e-ヘルスネット。体重・期間の管理は本アプリの責務外(食事
  // 記録に専念)。医療助言ではない編集可能な既定値で、体組成の変化を見て微調整すること。
  nutrients: [
    { key: 'energy_kcal', label: 'エネルギー', unit: 'kcal', required: true, target: 2000 },
    { key: 'protein_g', label: 'たんぱく質', unit: 'g', required: true, target: 126, goal: 'reach' },
    { key: 'fat_g', label: '脂質', unit: 'g', required: true, target: 55 },
    { key: 'saturated_fat_g', label: '飽和脂肪酸', unit: 'g', required: true, target: 16 },
    { key: 'carbohydrate_g', label: '炭水化物', unit: 'g', required: true, target: 250 },
    { key: 'sugar_g', label: '糖質', unit: 'g', required: true, target: 228 },
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
