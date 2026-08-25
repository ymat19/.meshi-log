// この人にとっての「一人前」を、過去の記録そのものから出す。
//
// 量を写真の見た目から起こすと外す。2026-08-24 にカツオ1食の量を写真の幾何から
// 計算して 110g→240g→140g→110g→140g→120g と6回変え、実際は 60g だった。
// 一方この人の記録は食品ごとに驚くほど安定していて（パックごはんは23件すべて
// 180g、ザバスは26件すべて200ml、厚揚げは6件すべて150g）、履歴を引くだけで
// 写真から読むより桁違いに正確な量が手に入る。記録前にこれを引くこと。
//
//   npm run portions            全食品
//   npm run portions カツオ      品名で絞り込み
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const dataDir = resolve(dirname(fileURLToPath(import.meta.url)), '../public/data')

const foodKeyOf = (name) =>
  name
    .toLowerCase()
    .replace(/[（）()[\]【】,、・/／\s\-−ー℃%％]/g, '')
    .replace(/\d+(?:\.\d+)?(ml|g|kg|本|枚|個|袋|杯|缶|パック|人前|切れ|尾|房|片)?/g, '')
    .replace(/[×x]/g, '')

// 「×2本」は2つ食べたということなので、1つあたりの量に直して数える。
const unitPortionOf = (name) => {
  const unit =
    name.match(/(\d+(?:\.\d+)?)\s*ml(?![a-z])/i) ?? name.match(/(\d+(?:\.\d+)?)\s*g(?![a-z])/i)
  if (!unit) return null
  const count = Number(name.match(/[×x]\s*(\d+)/)?.[1] ?? 1)
  return { value: Number(unit[1]), unit: unit[0].replace(/[\d.\s]/g, '').toLowerCase(), count }
}

const filter = process.argv.slice(2).join(' ').trim()
const byFood = new Map()

for (const file of readdirSync(dataDir).filter((f) => /^\d{4}-\d{2}\.json$/.test(f)).sort()) {
  for (const entry of JSON.parse(readFileSync(resolve(dataDir, file), 'utf8'))) {
    for (const item of entry.items ?? []) {
      const p = unitPortionOf(item.name)
      if (!p) continue
      const key = foodKeyOf(item.name)
      const row = byFood.get(key) ?? { name: item.name, unit: p.unit, values: [], last: '' }
      row.values.push(p.value)
      if (entry.datetime > row.last) {
        row.last = entry.datetime
        row.name = item.name
      }
      byFood.set(key, row)
    }
  }
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

const known = JSON.parse(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'known-portions.json'), 'utf8')).portions
const knownByKey = new Map(Object.entries(known).map(([n, v]) => [foodKeyOf(n), v]))

const rows = [...byFood.entries()]
  .filter(([, r]) => !filter || r.name.includes(filter))
  .map(([key, r]) => ({
    key,
    name: r.name,
    n: r.values.length,
    med: median(r.values),
    spread: [...new Set(r.values)].sort((a, b) => a - b),
    unit: r.unit,
    known: knownByKey.get(key),
    last: r.last.slice(0, 10),
  }))
  .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))

if (rows.length === 0) {
  console.log(filter ? `「${filter}」に一致する記録はありません。` : '記録がありません。')
  process.exit(0)
}

console.log(`\n記録から見た「この人の一人前」${filter ? `（「${filter}」で絞り込み）` : ''}\n`)
for (const r of rows) {
  const basis = r.known
    ? `★${r.known.grams}${r.unit}（${r.known.source}）`
    : `${r.med}${r.unit}（過去${r.n}件の中央値）`
  const spread = r.spread.length > 1 ? `  記録された量: ${r.spread.join(' / ')}` : ''
  console.log(`  ${r.name}`)
  console.log(`      ${basis}   最終記録 ${r.last}${spread}`)
}
console.log(
  `\n★ は scripts/known-portions.json の値（一次情報で裏が取れた基準量）。` +
    `\n量はここから決める。写真は「いつもより多い / いつも通り / 少ない」の判定にだけ使い、` +
    `\n寸法や面積を測って重量を計算しない（外す）。\n`,
)
