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
  // 摂取エネルギー目標は「基礎代謝を下回らない」2,000kcal(消費2,101から約100kcal赤字)。
  // PFCはトレーナーのご提案プラン(P126/F37/C210、約1,681kcal)を参考に、その配分比
  // (おおむねP30%/F20%/C50%E)を保ったまま2,000kcalへ等倍スケール(×約1.19)する。
  // 重要: エネルギー=4P+9F+4C なので、提案PFCそのままだと合計は約1,677kcalにしかならず
  // 「エネルギー2,000」を同時に満たせない(達成不能な組合せ)。スケールすることで各目標を
  // 同時達成でき(PFC合計≒エネルギー)、現実に運用できる値になる。
  // 提案に値が無い成分は本人の現状と減量目標に合わせて個別設定(一般人口の目安そのまま
  // にしない)。本人: 男性29歳・170cm・76kg・BMI26.2(肥満1度)・体脂肪率24.9%・内臓脂肪
  // レベル11・骨量不足、目標73kg・運動週1、基礎代謝 推定1,751/実測1,615kcal。
  //  - エネルギー 2000kcal / たんぱく質 150g / 脂質 44g / 炭水化物 250g:
  //    提案配分を2,000kcalへ等倍化。高たんぱくは減量中の除脂肪・骨量維持にも資する。
  //  - 飽和脂肪酸 13g: 内臓脂肪・心血管リスクを踏まえ脂質44gの約1/4–1/3に抑える(≒5.9%E)。
  //  - 糖質 225g: 炭水化物250−食物繊維25(データ全体で一貫する導出規則)。
  //  - 食物繊維 25g: 減量中の満腹感・血糖/脂質コントロールを優先した到達目標(目標型)。
  //  - 食塩 6.0g未満: 成人男性の一般目安(7.5g)でなくメタボ・高血圧リスク管理の厳しめ値。
  // 体重・期間の管理は本アプリの責務外(食事記録に専念)。医療助言ではない編集可能な
  // 既定値で、体組成の変化を見て随時調整すること。
  nutrients: [
    { key: 'energy_kcal', label: 'エネルギー', unit: 'kcal', required: true, target: 2000 },
    { key: 'protein_g', label: 'たんぱく質', unit: 'g', required: true, target: 150, goal: 'reach' },
    { key: 'fat_g', label: '脂質', unit: 'g', required: true, target: 44 },
    { key: 'saturated_fat_g', label: '飽和脂肪酸', unit: 'g', required: true, target: 13 },
    { key: 'carbohydrate_g', label: '炭水化物', unit: 'g', required: true, target: 250 },
    { key: 'sugar_g', label: '糖質', unit: 'g', required: true, target: 225 },
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
