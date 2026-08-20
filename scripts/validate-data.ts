// Validates that every recorded food item carries all *required* nutrients.
//
// A meal's total is DERIVED by summing its items (entryTotals in
// lib/nutrition.ts) — the entry stores no redundant total — so "合計 = 食品の
// 合計" holds by construction and needs no checking. What still needs guarding
// is that the breakdown is complete: every item must carry all required
// nutrients, or the dashboard silently aggregates a missing value as 0.
//
// The Nutrition type is an open record of optional fields, so TypeScript alone
// cannot guarantee data fills them in. This script closes that gap at CI time
// (and at commit time via the husky pre-commit hook): config.ts is the single
// source of truth for which nutrients are required.
//
// The third check catches the same drift when the *portion* differs, which the
// name-based check cannot see: 「アボカド（約70g）」 and 「アボカド（約75g）」 are
// different names, so nothing stopped them from being derived off two different
// 100g bases (176kcal vs 187kcal). Any two items whose names agree once their
// size is stripped must agree per 100g/100ml as well.
//
// alcohol_g stays optional by design: it is only present when the item actually
// contained alcohol (a sober meal legitimately omits it).
//
// The second check guards against a different failure: copying a past record's
// numbers into a new entry without re-deriving them. When the same item name
// carries two different nutrition breakdowns, one of them is stale — either the
// value drifted, or the name hides an adjustment (a smaller portion, a side
// left out) that belongs in the name itself. Both cases are data bugs, so the
// same name must always mean the same numbers.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { config } from '../src/data/config'
import type { MealEntry, Nutrition, NutrientKey } from '../src/data/types'

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = resolve(here, '../public/data')

const requiredKeys = config.nutrients
  .filter((n) => n.required)
  .map((n) => n.key) as NutrientKey[]

interface Conflict {
  name: string
  // Where each distinct breakdown for this name appears.
  variants: { signature: string; at: string[] }[]
}

interface Problem {
  file: string
  id: string
  // Which item is incomplete, or 'items' when a meal has no items at all.
  where: string
  missing: NutrientKey[]
}

const problems: Problem[] = []

// item 名 -> 栄養値のシグネチャ -> 出現箇所
const byName = new Map<string, Map<string, string[]>>()

// Required nutrients only: an item that also logs alcohol_g still describes the
// same food, and comparing keys in a fixed order keeps the signature stable.
const signatureOf = (n: Nutrition | undefined): string =>
  requiredKeys.map((k) => `${k}=${(n ?? {})[k]}`).join(' ')

const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(path, 'utf8'))

// Required nutrients absent (or non-numeric) on a given nutrition record.
const missingFrom = (n: Nutrition | undefined): NutrientKey[] =>
  requiredKeys.filter((k) => typeof (n ?? {})[k] !== 'number')


// --- 同一食品・別分量の換算ズレ検出 --------------------------------------
// 品名から分量（g / ml、「×2本」等の本数も含む）を読み取る。読み取れない品目は
// 換算の比較対象にならない（比較の土台が無いだけで、エラーではない）。
const portionOf = (name: string): number | null => {
  // ml を優先する。「ザバス（20g・200ml）」のように、たんぱく質量などの g 表記が
  // 先に来る品名があるため、容量表記があればそちらが分量。
  const unit =
    name.match(/(\d+(?:\.\d+)?)\s*ml(?![a-z])/i) ??
    name.match(/(\d+(?:\.\d+)?)\s*g(?![a-z])/i)
  if (!unit) return null
  const count = name.match(/[×x]\s*(\d+)/)
  return Number(unit[1]) * (count ? Number(count[1]) : 1)
}

// 分量・記号・空白を落として「同じ食品か」を判定するキー。
const foodKeyOf = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[（）()\[\]【】,、・/／\s\-−ー℃%％]/g, '')
    .replace(/\d+(?:\.\d+)?(ml|g|kg|本|枚|個|袋|杯|缶|パック|人前|切れ|尾|房|片)?/g, '')
    .replace(/[×x]/g, '')

interface Scaled {
  name: string
  at: string
  portion: number
  per100: Record<string, number>
}

interface ScaleConflict {
  key: string
  nutrient: NutrientKey
  low: { name: string; at: string; value: number }
  high: { name: string; at: string; value: number }
}

const byFood = new Map<string, Scaled[]>()

// 比較の許容: 相対2%まで（丸め由来）。加えて「実際の一食分に効くか」で足切りする。
// 100g 換算のズレを一番小さい分量に戻したとき 2kcal / 0.1g 未満なら、それは
// 小数の丸めであって出典の食い違いではない。
const RELATIVE_TOLERANCE = 0.02
const servingFloorOf = (k: NutrientKey): number => (k === 'energy_kcal' ? 2 : 0.1)

const index = readJson(resolve(dataDir, 'index.json')) as { months: string[] }

for (const month of index.months) {
  const file = `${month}.json`
  const entries = readJson(resolve(dataDir, file)) as MealEntry[]
  for (const entry of entries) {
    // A meal with no items has no derivable nutrition at all.
    if (!entry.items || entry.items.length === 0) {
      problems.push({ file, id: entry.id, where: 'items', missing: requiredKeys })
      continue
    }
    // Every food item must carry a full nutrition breakdown.
    for (const item of entry.items) {
      const itemMissing = missingFrom(item.nutrition)
      if (itemMissing.length > 0) {
        problems.push({ file, id: entry.id, where: item.name, missing: itemMissing })
        continue
      }
      const portion = portionOf(item.name)
      if (portion && portion > 0) {
        const per100 = Object.fromEntries(
          requiredKeys.map((k) => [k, ((item.nutrition[k] as number) / portion) * 100]),
        )
        const key = foodKeyOf(item.name)
        byFood.set(key, [
          ...(byFood.get(key) ?? []),
          { name: item.name, at: entry.id, portion, per100 },
        ])
      }

      const variants = byName.get(item.name) ?? new Map<string, string[]>()
      const signature = signatureOf(item.nutrition)
      variants.set(signature, [...(variants.get(signature) ?? []), entry.id])
      byName.set(item.name, variants)
    }
  }
}

const conflicts: Conflict[] = [...byName]
  .filter(([, variants]) => variants.size > 1)
  .map(([name, variants]) => ({
    name,
    variants: [...variants].map(([signature, at]) => ({ signature, at })),
  }))

const scaleConflicts: ScaleConflict[] = []
for (const [key, group] of byFood) {
  if (group.length < 2) continue
  for (const k of requiredKeys) {
    const sorted = [...group].sort((a, b) => a.per100[k] - b.per100[k])
    const low = sorted[0]
    const high = sorted[sorted.length - 1]
    const spread = high.per100[k] - low.per100[k]
    if (spread / Math.max(high.per100[k], 1e-9) <= RELATIVE_TOLERANCE) continue
    const smallestPortion = Math.min(...group.map((g) => g.portion))
    if ((spread * smallestPortion) / 100 < servingFloorOf(k)) continue
    scaleConflicts.push({
      key,
      nutrient: k,
      low: { name: low.name, at: low.at, value: low.per100[k] },
      high: { name: high.name, at: high.at, value: high.per100[k] },
    })
  }
}

if (problems.length > 0) {
  console.error(
    `\n❌ データ検証に失敗: 必須栄養素が欠けている箇所が ${problems.length} 件あります。\n`,
  )
  for (const p of problems) {
    console.error(`  [${p.file}] ${p.id}`)
    console.error(`      ${p.where} の欠落: ${p.missing.join(', ')}`)
  }
  console.error(
    `\n必須栄養素: ${requiredKeys.join(', ')}\n` +
      `（各 item の nutrition すべてに必要です。一食の合計はこれらの item から\n` +
      ` 自動で導出されます。任意項目は config.ts で required を付けないことで\n` +
      ` 除外できます。例: alcohol_g）\n`,
  )
  process.exit(1)
}

if (conflicts.length > 0) {
  console.error(
    `\n❌ データ検証に失敗: 同じ item 名なのに栄養値が食い違う品目が ${conflicts.length} 件あります。\n`,
  )
  for (const c of conflicts) {
    console.error(`  「${c.name}」`)
    for (const v of c.variants) {
      console.error(`      ${v.signature}`)
      console.error(`        ← ${v.at.join(', ')}`)
    }
  }
  console.error(
    `\n同じ品名は同じ数値でなければなりません。食い違う場合、どちらかが\n` +
      `「過去記録からの流用」で古いまま／前提違いのまま残っています。\n` +
      `・既製品なら公式表示を引き直し、両方を公式値に揃える\n` +
      `・量やみそ汁の有無など前提が違うなら、その違いを item 名に書く\n` +
      `  （例:「うまトマチーズ牛めし（並盛・みそ汁なし）」「〜の半分」）\n`,
  )
  process.exit(1)
}

if (scaleConflicts.length > 0) {
  console.error(
    `\n❌ データ検証に失敗: 同じ食品なのに 100g/100ml 換算が食い違う組み合わせが ${scaleConflicts.length} 件あります。\n`,
  )
  for (const c of scaleConflicts) {
    console.error(`  「${c.key}」 ${c.nutrient}`)
    console.error(`      ${c.low.value.toFixed(2)} ← ${c.low.name} (${c.low.at})`)
    console.error(`      ${c.high.value.toFixed(2)} ← ${c.high.name} (${c.high.at})`)
  }
  console.error(
    `\n分量が違っても、同じ食品なら 100g/100ml あたりの値は一致していなければ\n` +
      `なりません。食い違うのは、記録ごとに別々の出典・別々の版（七訂と八訂など）\n` +
      `から推定しているためです。出典を1つに決め、その食品の過去記録を全部その\n` +
      `出典で引き直してください（食い違った時点で、その品目の過去記録は全部\n` +
      `信用できなくなります。片方だけ直すのは禁止）。\n` +
      `・許容は相対2%まで（丸め由来のみ）。0を埋めて回避するのは禁止。\n`,
  )
  process.exit(1)
}

console.log(
  `✅ データ検証OK: 全 item が必須栄養素 (${requiredKeys.join(', ')}) を保持しています` +
    `（一食の合計は item から導出）。同名 item の栄養値の食い違いも、` +
    `同一食品の 100g/100ml 換算の食い違いもありません。`,
)
