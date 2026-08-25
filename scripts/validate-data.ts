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
// The fourth check keeps *annotations* out of item names. An item name is what
// the dashboard renders, and it must say only what was eaten: the food (brand
// and product name included) and how much of it. Everything else — where the
// number came from, how it was estimated, which other dish it was dropped into,
// whose leftovers it was, how many people split the plate, whether it was
// takeout — is commentary. It belongs in the entry's memo, where the reasoning
// already lives. Commentary in the name is not just noise: it silently splits
// one food across several names (「生卵 1個」 vs 「生卵 1個（まぜそばに投入）」),
// and the same-name check above then has nothing to compare, so the values are
// free to drift apart unnoticed. That is exactly how the egg and 焼き海苔
// records ended up on three different bases each.
//
// The fifth check keeps photo-derived metrology out of memos. A top-down photo
// carries no scale reference and no thickness, so a weight "measured" from it is
// not a measurement — it is a guess wearing units. On 2026-08-24 a katsuo portion
// was written up with pixel areas, a px/mm scale and a projected area in cm², and
// the number moved 110g→240g→140g→110g→140g→120g across six revisions before the
// portion was put on a scale: 60g. Every one of those was two to four times the
// real value, and each was more convincing than the last because it carried more
// digits. Numbers derived that way must not enter the record at all, so the memo
// may not cite pixels, projected area, or a scale factor as the basis of a
// quantity. A weight comes from the scale, the package, or the person.
//
// The sixth check anchors portions to what this person actually eats. Their own
// history is remarkably tight — pack rice is 180g in 23 records out of 23, the
// protein drink 200ml in 26 of 26, the atsuage 150g in 6 of 6 — so the median of
// past records is a far better estimate of a serving than anything read off a
// photograph. On 2026-08-24 that prior was available and ignored in favour of a
// pixel computation that came out at twice the real weight. So: when a food
// already has an established serving, recording a different one has to name the
// evidence that justified departing from it (the person said so, or a package
// says so). Asking them to weigh food is not an option — sending a photo is the
// whole point of this tool.
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
// 一次情報で裏が取れた基準量。履歴の中央値より、こちらを優先する。
const rawKnownPortions = (
  readJson(resolve(here, 'known-portions.json')) as {
    portions: Record<string, { grams: number; source: string; effectiveFrom?: string }>
  }
).portions


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

// known-portions.json は人が読める品名で書く。突き合わせは foodKey で行う。
const knownPortions = new Map(
  Object.entries(rawKnownPortions).map(([name, v]) => [foodKeyOf(name), v]),
)

// --- 品名に混じった注釈の検出 --------------------------------------------
// 品名に書いてよいのは「食品名（メーカー・商品名を含む）＋分量・実際に食べた内容」
// だけ。根拠・経緯・文脈は memo に書く。
const NAME_BANS: { pattern: RegExp; why: string }[] = [
  {
    pattern: /本人申告|記憶ベース|推定|流用|出典|表示値|非掲載|公式値|想定|不明|相当/,
    why: '出典・推定方法・確度は memo に書く',
  },
  {
    pattern: /テイクアウト|自炊|工場製/,
    why: '入手経路・調理者・製造元の説明は memo に書く',
  },
  {
    pattern: /シェア|\d+\s*人で|のうち/,
    why: 'シェアや入数の内訳計算は memo に書く（品名には実際に食べた数量だけ書く）',
  },
  {
    pattern: /に投入|に追加|にのせ|にかけ|に入れ/,
    why: 'どの料理に入れたかは memo に書く',
  },
  {
    pattern: /残り|昨日|一昨日|今朝|のぶん/,
    why: 'いつの食べ残しか・何食目のぶんかは memo に書く',
  },
]

// --- memo に混じった「写真からの計測」の検出 ------------------------------
// 真上からの写真には寸法の基準物も厚みも写らない。そこから出した「実測値」は
// measurement ではなく、単位の付いた当て推量である。量の根拠になれるのは
// 計りに乗せた値・商品の表示値・本人の申告だけ。
const MEMO_BANS: { pattern: RegExp; why: string }[] = [
  {
    // 「720px」「190px」のように画素を単位として量を語っているもの。「縮尺が
    // 写っていないので本人に聞いた」のような正しい記述は巻き込まないよう、
    // 数字を伴う画素表記と、写真計測に固有の語だけを対象にする。
    pattern: /\d+\s*px|画素数|投影面積|自己相関|形状係数|(?:px|ピクセル)\s*\/\s*mm|mm\s*\/\s*px/,
    why: '写真から寸法・重量を算出しない（量は計量値・表示値・本人申告で決める）',
  },
  {
    pattern: /(?:厚み|厚さ|奥行き?)を?(?:仮定|と仮定|と置|と見)/,
    why: '写真に写らない厚み・奥行きを仮定で埋めて重量を出さない',
  },
]

interface NameProblem {
  name: string
  at: string
  why: string
  matched: string
}

interface MemoProblem {
  at: string
  why: string
  matched: string
}

interface PortionProblem {
  at: string
  name: string
  portion: number
  reference: number
  basis: string
}

// 基準量から外れた量を書いてよいのは、一次情報がある場合だけ。
// 「本人がそう言った」「パッケージにそう書いてある」のどちらかが memo にあること。
const PORTION_EVIDENCE =
  /本人申告|本人回答|本人の申告|本人が|計量|量り|計り|内容量|表示値|パッケージ表示|公式表示|表示のとおり/

// memo は【品名】…… と品目ごとに区切って書く形式なので、品名が出てくる位置から
// 次の【 までを「その品目についての記述」とみなし、その中だけで根拠語を探す。
const hasEvidenceFor = (name: string, memo?: string): boolean => {
  if (!memo) return false
  const at = memo.indexOf(name)
  if (at < 0) return false
  const rest = memo.slice(at + name.length)
  const end = rest.indexOf('【')
  return PORTION_EVIDENCE.test(end < 0 ? rest : rest.slice(0, end))
}

const nameProblems: NameProblem[] = []
const memoProblems: MemoProblem[] = []
const portionProblems: PortionProblem[] = []

// --- 落ちた調味料の検出 --------------------------------------------------
// たれ・ポン酢・醤油のような調味料は、料理に絡んで沈むので写真にはまず写らない。
// 「写っていない＝かけていない」と読んで item ごと落とすと、その一食の食塩相当量
// だけが黙って消える。実際に、同じカツオのたたきを3食記録するあいだに、付属の
// たれを2食では計上し、3食目だけ「写真に無い・小袋は使い切ったはず」という推測で
// 0 にしていた（塩分 0.88g → 0.10g）。0 は「その食品に本当に含まれない」ときだけ
// 書いてよい値で、確認できないことの穴埋めに使ってはならない。
//
// そこで、ある料理が過去に「ほぼ毎回」同じ調味料を伴って記録されているのに、
// 今回だけ調味料がひとつも無い、という組み合わせを機械的に拾う。調味料を本当に
// かけていないなら、entry に他の調味料 item がある（別の味付けをした）か、
// そもそもその料理の常連ではない、のどちらかになるはずなので、この条件は
// 「聞かずに 0 にした」ケースだけを狙って当たる。
const CONDIMENT =
  /たれ|タレ|ぽん酢|ポン酢|醤油|しょうゆ|ソース|ドレッシング|マヨ|食塩|わさび|ワサビ|七味|ラー油|つゆ|ケチャップ|ふりかけ/

interface MissingCondiment {
  dish: string
  condiment: string
  seen: number
  total: number
  at: string
}

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

// entry ごとの item 名一覧（落ちた調味料の検出に使う）
const entryNames: { at: string; names: string[] }[] = []
// 基準量チェック用（memo も必要）
const entryPortions: { at: string; names: string[]; memo?: string }[] = []

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
    entryNames.push({ at: entry.id, names: entry.items.map((i) => i.name) })
    entryPortions.push({ at: entry.id, names: entry.items.map((i) => i.name), memo: entry.memo })

    for (const ban of MEMO_BANS) {
      const m = entry.memo?.match(ban.pattern)
      if (m) {
        memoProblems.push({ at: entry.id, why: ban.why, matched: m[0] })
      }
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

      for (const ban of NAME_BANS) {
        const m = item.name.match(ban.pattern)
        if (m) {
          nameProblems.push({ name: item.name, at: entry.id, why: ban.why, matched: m[0] })
        }
      }

      const variants = byName.get(item.name) ?? new Map<string, string[]>()
      const signature = signatureOf(item.nutrition)
      variants.set(signature, [...(variants.get(signature) ?? []), entry.id])
      byName.set(item.name, variants)
    }
  }
}

// --- 基準量からの逸脱 ------------------------------------------------------
// その食品の「この人にとっての一人前」は、known-portions.json（一次情報で裏が
// 取れた量）を最優先し、無ければ過去記録の中央値を使う。中央値は3件以上の実績が
// あるときだけ基準として扱う（2件では中央値が意味を持たない）。
// 対象は known-portions.json に載っている食品だけ。過去記録の中央値まで基準に
// すると、「×2本」（2本飲んだ）や葉物の自然なブレまで拾って誤検出だらけになり、
// 検査ごと無視されるようになる。中央値は estimate の出発点として `npm run portions`
// で参照するものであって、コミットを止める根拠にはしない。
// 基準量は「確定した日」以降の記録にだけ適用する。それ以前の記録は別の根拠で
// 書かれていて、いま遡って確かめる手段が無い。過去に遡って一律に落とすと、直せない
// ものを理由にコミットが永久に通らなくなる。
const referenceFor = (key: string, at: string): { grams: number; basis: string } | null => {
  const known = knownPortions.get(key)
  if (!known) return null
  if (known.effectiveFrom && at.slice(0, 10) < known.effectiveFrom) return null
  return { grams: known.grams, basis: known.source }
}

// 1.5倍/0.67倍を超える差だけを見る。丸めや盛りのブレは拾わない。
const PORTION_TOLERANCE = 1.5

for (const { at, names, memo } of entryPortions) {
  for (const name of names) {
    // 「×2本」「2個」は2つ食べたということなので、基準と比べるのは1つあたりの量。
    const count = Number(name.match(/[×x]\s*(\d+)/)?.[1] ?? 1)
    const total = portionOf(name)
    if (!total || total <= 0) continue
    const portion = total / count
    const ref = referenceFor(foodKeyOf(name), at)
    if (!ref || ref.grams <= 0) continue
    const ratio = portion / ref.grams
    if (ratio <= PORTION_TOLERANCE && ratio >= 1 / PORTION_TOLERANCE) continue
    // 一次情報が「その品目について」書かれているときだけ、基準から外れてよい。
    // memo のどこかに根拠語が1つあれば全品目が免除、では緩すぎる（この形式の memo は
    // 【品名】…… と品目ごとに区切って書くので、品名の直後だけを見る）。
    if (hasEvidenceFor(name, memo)) continue
    portionProblems.push({ at, name, portion, reference: ref.grams, basis: ref.basis })
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

// 料理（foodKey）-> その料理を含む entry
const dishEntries = new Map<string, { at: string; names: string[] }[]>()
for (const e of entryNames) {
  for (const key of new Set(e.names.map(foodKeyOf))) {
    dishEntries.set(key, [...(dishEntries.get(key) ?? []), e])
  }
}

const missingCondiments: MissingCondiment[] = []
for (const [dish, rows] of dishEntries) {
  // 3食以上の実績がないと「毎回この調味料で食べる」とは言えない。
  if (rows.length < 3) continue
  // 調味料そのものを主語にしても意味がない。
  if (rows.some((r) => r.names.some((n) => foodKeyOf(n) === dish && CONDIMENT.test(n)))) continue

  const together = new Map<string, number>()
  for (const r of rows) {
    for (const key of new Set(
      r.names.filter((n) => foodKeyOf(n) !== dish && CONDIMENT.test(n)).map(foodKeyOf),
    )) {
      together.set(key, (together.get(key) ?? 0) + 1)
    }
  }

  for (const [condiment, seen] of together) {
    // 「1食を除く全部」で同伴しているものだけ。たまたま1〜2回一緒だった、は拾わない。
    if (seen < 2 || seen < rows.length - 1 || seen >= rows.length) continue
    for (const r of rows) {
      if (r.names.some((n) => foodKeyOf(n) === condiment)) continue
      // 別の調味料で食べた回は、意図してそうしている。
      if (r.names.some((n) => CONDIMENT.test(n))) continue
      missingCondiments.push({ dish, condiment, seen, total: rows.length, at: r.at })
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

if (nameProblems.length > 0) {
  console.error(
    `\n❌ データ検証に失敗: item 名に注釈が入っている品目が ${nameProblems.length} 件あります。\n`,
  )
  for (const p of nameProblems) {
    console.error(`  「${p.name}」  (${p.at})`)
    console.error(`      「${p.matched}」 は注釈です — ${p.why}`)
  }
  console.error(
    `\nitem 名に書いてよいのは「食品名（メーカー・商品名を含む）＋分量・実際に\n` +
      `食べた内容」だけです。それ以外は entry の memo に書いてください。\n` +
      `・OK: 「相模屋 焼いておいしい絹厚揚げ 1枚（150g）」「松屋 牛めし（並盛）」\n` +
      `      「松のや ロースかつ定食（ライス大盛・みそ汁/キャベツ込み）」「ポテトサラダ 半分」\n` +
      `・NG: 「生卵 1個（まぜそばに投入）」「厚揚げ（2枚入りのうち1枚）」\n` +
      `      「温泉卵（松屋・公式表示値）」「牛めし（テイクアウト）」「唐揚げ（シェア半分）」\n` +
      `注釈は同じ食品を複数の品名に割り、上の同名チェックを無力化します。\n`,
  )
  process.exit(1)
}

if (memoProblems.length > 0) {
  console.error(
    `\n❌ データ検証に失敗: memo に写真からの計測を根拠として書いている記録が ${memoProblems.length} 件あります。\n`,
  )
  for (const p of memoProblems) {
    console.error(`  ${p.at}`)
    console.error(`      「${p.matched}」 — ${p.why}`)
  }
  console.error(
    `\n真上からの写真には、寸法の基準物も厚みも写っていません。そこから出した\n` +
      `「実測値」は measurement ではなく、単位の付いた当て推量です。桁と単位が\n` +
      `付くぶん、根拠のない数字より始末が悪くなります。\n` +
      `・量の根拠にしてよいもの: 計りに乗せた値／商品の栄養成分表示・内容量／本人の申告\n` +
      `・分からないときは 0 で埋めず、AskUserQuestion で聞く\n` +
      `検査を通すために語を言い換えるのは禁止です。導出そのものを記録から外してください。\n`,
  )
  process.exit(1)
}

if (portionProblems.length > 0) {
  console.error(
    `\n❌ データ検証に失敗: この人の基準量から大きく外れた分量が ${portionProblems.length} 件あります。\n`,
  )
  for (const p of portionProblems) {
    const times = (p.portion / p.reference).toFixed(2)
    console.error(`  「${p.name}」  (${p.at})`)
    console.error(`      基準 ${p.reference}（${p.basis}）に対して ${p.portion} — ${times}倍`)
  }
  console.error(
    `\nこの人の一人前は食品ごとにほぼ一定です（パックごはんは23件すべて180g、\n` +
      `ザバスは26件すべて200ml）。**写真から読んだ大きさより、この履歴のほうが\n` +
      `はるかに正確な手がかり**です。基準から外れた量を書くなら、その根拠が要ります。\n` +
      `・本人がそう言った → memo に「本人申告」「本人回答」と書く\n` +
      `・パッケージにそう書いてある → memo に「表示値」「内容量」と書く\n` +
      `・どちらも無い → 基準量をそのまま使う。写真の見た目で増減させない\n` +
      `一次情報が無いのに基準から動かした量は、確度が上がったのではなく下がっています。\n` +
      `裏が取れた基準量は scripts/known-portions.json に足してください。\n`,
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

if (missingCondiments.length > 0) {
  console.error(
    `\n❌ データ検証に失敗: いつも付けている調味料が落ちている記録が ${missingCondiments.length} 件あります。\n`,
  )
  for (const m of missingCondiments) {
    console.error(`  ${m.at}`)
    console.error(
      `      「${m.dish}」は ${m.total} 食中 ${m.seen} 食で「${m.condiment}」と一緒に記録されて` +
        `いますが、この一食には調味料の item がひとつもありません。`,
    )
  }
  console.error(
    `\nたれ・ポン酢・醤油は料理に絡んで沈むので、写真にはまず写りません。\n` +
      `「写っていない＝かけていない」と読んで item を落とすと、その一食の食塩相当量\n` +
      `だけが黙って消えます（0 は「その食品に本当に含まれない」ときだけ書ける値で、\n` +
      `確認できないことの穴埋めには使えません）。\n` +
      `・かけたなら item を足す（過去の同名 item と同一出典・同一換算で）\n` +
      `・本当にかけていない／別のものをかけたなら、その調味料を item にする\n` +
      `・どちらか分からないなら AskUserQuestion で聞く。本文に「無しで計上します、\n` +
      `  違ったら言ってください」と書いて確認をユーザーに投げるのは禁止です。\n`,
  )
  process.exit(1)
}

console.log(
  `✅ データ検証OK: 全 item が必須栄養素 (${requiredKeys.join(', ')}) を保持しています` +
    `（一食の合計は item から導出）。同名 item の栄養値の食い違いも、` +
    `同一食品の 100g/100ml 換算の食い違いも、item 名の注釈も、` +
    `いつも付けている調味料の抜けもありません。`,
)
