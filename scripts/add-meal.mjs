// Safely appends a confirmed MealEntry to the monthly data file and keeps
// public/data/index.json in sync. Avoids hand-editing JSON (error-prone).
//
// Usage: node scripts/add-meal.mjs <entry.json>
//   <entry.json> is a file containing a single MealEntry object.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const entryPath = process.argv[2]
if (!entryPath) {
  console.error('usage: node scripts/add-meal.mjs <entry.json>')
  process.exit(1)
}

const entry = JSON.parse(await readFile(entryPath, 'utf8'))
if (!entry.datetime || !entry.type) {
  console.error('entry requires "datetime" and "type"')
  process.exit(1)
}

const month = entry.datetime.slice(0, 7) // YYYY-MM
const dataDir = 'public/data'
const monthFile = path.join(dataDir, `${month}.json`)
const indexFile = path.join(dataDir, 'index.json')

await mkdir(dataDir, { recursive: true })

const entries = existsSync(monthFile)
  ? JSON.parse(await readFile(monthFile, 'utf8'))
  : []

// Replace any existing entry with the same id (idempotent re-logging/edits).
const next = (entry.id ? entries.filter((e) => e.id !== entry.id) : entries)
  .concat(entry)
  .sort((a, b) => (a.datetime < b.datetime ? -1 : 1))

await writeFile(monthFile, JSON.stringify(next, null, 2) + '\n')

const index = existsSync(indexFile)
  ? JSON.parse(await readFile(indexFile, 'utf8'))
  : { months: [] }
if (!index.months.includes(month)) {
  index.months.push(month)
  index.months.sort()
  await writeFile(indexFile, JSON.stringify(index, null, 2) + '\n')
}

console.log(`added meal to ${monthFile} (${next.length} entries in ${month})`)
