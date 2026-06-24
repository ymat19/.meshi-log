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
// alcohol_g stays optional by design: it is only present when the item actually
// contained alcohol (a sober meal legitimately omits it).

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

interface Problem {
  file: string
  id: string
  // Which item is incomplete, or 'items' when a meal has no items at all.
  where: string
  missing: NutrientKey[]
}

const problems: Problem[] = []

const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(path, 'utf8'))

// Required nutrients absent (or non-numeric) on a given nutrition record.
const missingFrom = (n: Nutrition | undefined): NutrientKey[] =>
  requiredKeys.filter((k) => typeof (n ?? {})[k] !== 'number')

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
      }
    }
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

console.log(
  `✅ データ検証OK: 全 item が必須栄養素 (${requiredKeys.join(', ')}) を保持しています` +
    `（一食の合計は item から導出）。`,
)
