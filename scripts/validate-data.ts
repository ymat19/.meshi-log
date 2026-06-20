// Validates that every recorded meal entry carries all *required* nutrients.
//
// The Nutrition type is an open record of optional fields, so TypeScript alone
// cannot guarantee that real data actually fills them in — missing values just
// silently aggregate to 0 on the dashboard. This script closes that gap at CI
// time: config.ts is the single source of truth for which nutrients are
// required, and any entry missing one of them fails the build.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { config } from '../src/data/config'
import type { MealEntry, NutrientKey } from '../src/data/types'

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = resolve(here, '../public/data')

const requiredKeys = config.nutrients
  .filter((n) => n.required)
  .map((n) => n.key) as NutrientKey[]

interface Problem {
  file: string
  id: string
  missing: NutrientKey[]
}

const problems: Problem[] = []

const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(path, 'utf8'))

const index = readJson(resolve(dataDir, 'index.json')) as { months: string[] }

for (const month of index.months) {
  const file = `${month}.json`
  const entries = readJson(resolve(dataDir, file)) as MealEntry[]
  for (const entry of entries) {
    const n = entry.nutrition ?? {}
    const missing = requiredKeys.filter((k) => typeof n[k] !== 'number')
    if (missing.length > 0) {
      problems.push({ file, id: entry.id, missing })
    }
  }
}

if (problems.length > 0) {
  console.error(
    `\n❌ データ検証に失敗: 必須栄養素が欠けているエントリが ${problems.length} 件あります。\n`,
  )
  for (const p of problems) {
    console.error(`  [${p.file}] ${p.id}`)
    console.error(`      欠落: ${p.missing.join(', ')}`)
  }
  console.error(
    `\n必須栄養素: ${requiredKeys.join(', ')}\n` +
      `（任意項目は config.ts で required を付けないことで除外できます）\n`,
  )
  process.exit(1)
}

console.log(
  `✅ データ検証OK: 全エントリが必須栄養素 (${requiredKeys.join(', ')}) を保持しています。`,
)
