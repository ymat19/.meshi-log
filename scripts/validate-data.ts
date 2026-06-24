// Validates that every recorded meal carries all *required* nutrients — both at
// the entry-total level AND for every individual food item.
//
// The Nutrition type is an open record of optional fields, so TypeScript alone
// cannot guarantee that real data actually fills them in — missing values just
// silently aggregate to 0 on the dashboard. This script closes that gap at CI
// time (and at commit time via the husky pre-commit hook): config.ts is the
// single source of truth for which nutrients are required, and any entry — or
// any item within it — missing one of them fails the build / blocks the commit.
//
// alcohol_g stays optional by design: it is only present when the meal actually
// contained alcohol (a sober day legitimately omits it).

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
  // Which item is incomplete, or 'エントリ合計' for the entry-level total.
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
    // Entry-total level.
    const entryMissing = missingFrom(entry.nutrition)
    if (entryMissing.length > 0) {
      problems.push({ file, id: entry.id, where: 'エントリ合計', missing: entryMissing })
    }
    // Item level: every food item must carry a full nutrition breakdown.
    for (const item of entry.items ?? []) {
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
      `（全エントリの合計と、各 item の nutrition すべてに必要です。\n` +
      ` 任意項目は config.ts で required を付けないことで除外できます。例: alcohol_g）\n`,
  )
  process.exit(1)
}

console.log(
  `✅ データ検証OK: 全エントリ合計と全 item が必須栄養素 (${requiredKeys.join(', ')}) を保持しています。`,
)
