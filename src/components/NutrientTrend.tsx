import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Config, MealEntry, NutrientKey } from '../data/types'
import { dailyTotals } from '../lib/nutrition'

const PERIODS = [7, 30, 90] as const
const DEFAULT_DAYS = 30

// Chart view state lives in the URL query string (not localStorage) so a view
// is shareable/bookmarkable and survives reloads without hidden device-local
// state. `?mock` (handled elsewhere) is preserved untouched.
//   n   = added nutrient tags (comma-separated)
//   sel = the subset currently drawn — omitted when it equals `n` (all drawn)
//   d   = period in days — omitted when it is the default (30)
// All three are omitted entirely when the view is the default, keeping the
// common-case URL clean.
const QS_NUTRIENTS = 'n'
const QS_SELECTED = 'sel'
const QS_PERIOD = 'd'

// Colour a line segment turns when it sits on the "bad" side of its 100% line
// (above for 上限型, below for 目標型). Shared with the warning band fill so the
// danger signal reads the same whether the selection is mixed or homogeneous.
const DANGER = '#e0556d'

// Stable colour per nutrient, assigned by its position in the config so a
// nutrient always draws (and lights up its tag) in the same colour regardless
// of which others are selected.
const PALETTE = [
  '#85b79d',
  '#e08e6d',
  '#6d9fe0',
  '#c98bd1',
  '#d1b86d',
  '#7bc4c4',
  '#d17b95',
  '#9d85b7',
  '#8aa86d',
] as const

// The nutrients shown by default (first visit and after pressing リセット).
// Chosen to surface what matters most for metabolic-syndrome management:
// energy budget, saturated fat, sugar, and protein.
const DEFAULT_NUTRIENTS: readonly NutrientKey[] = [
  'energy_kcal',
  'saturated_fat_g',
  'sugar_g',
  'protein_g',
] as const

// The default tag/selection set, filtered to nutrients the config actually
// defines so a config change can never leave the chart referencing a dead key.
function defaultState(validKeys: NutrientKey[], fallback: NutrientKey): TrendState {
  const keys = DEFAULT_NUTRIENTS.filter((k) => validKeys.includes(k))
  const list = keys.length > 0 ? [...keys] : [fallback]
  return { nutrients: list, selected: list }
}

// Which nutrient tags the user has added, and which of them are currently
// drawn. Multiple nutrients can be selected at once — every selected tag is
// rendered as its own line. Reflected into the URL query string so it survives
// reloads and can be shared.
interface TrendState {
  nutrients: NutrientKey[]
  selected: NutrientKey[]
}

// Order-insensitive set equality. Selection/tag order has no rendering meaning
// (tags and lines are always laid out in config order), so we compare as sets.
function sameSet(a: NutrientKey[], b: NutrientKey[]): boolean {
  if (a.length !== b.length) return false
  const set = new Set(a)
  return b.every((k) => set.has(k))
}

// Parse a comma-separated key list, dropping anything the config no longer
// defines so a config change can never leave the chart referencing a dead key.
function parseKeys(raw: string | null, validKeys: NutrientKey[]): NutrientKey[] {
  if (!raw) return []
  return raw
    .split(',')
    .filter((k): k is NutrientKey => validKeys.includes(k as NutrientKey))
}

// Read state from the URL query string. Falls back to the default set when no
// nutrients are specified. A present-but-empty `sel` is honoured as "nothing
// drawn"; an absent `sel` means "all added tags drawn".
function loadState(validKeys: NutrientKey[], fallback: NutrientKey): TrendState {
  const params = new URLSearchParams(window.location.search)
  if (!params.has(QS_NUTRIENTS)) return defaultState(validKeys, fallback)
  const nutrients = parseKeys(params.get(QS_NUTRIENTS), validKeys)
  if (nutrients.length === 0) return defaultState(validKeys, fallback)
  const selected = params.has(QS_SELECTED)
    ? parseKeys(params.get(QS_SELECTED), validKeys).filter((k) =>
        nutrients.includes(k),
      )
    : [...nutrients]
  return { nutrients, selected }
}

// Read the period from the URL, accepting only the offered options.
function loadPeriod(): number {
  const raw = new URLSearchParams(window.location.search).get(QS_PERIOD)
  const n = raw ? Number(raw) : NaN
  return (PERIODS as readonly number[]).includes(n) ? n : DEFAULT_DAYS
}

// Daily trend of any number of selected nutrients over a selectable period.
export function NutrientTrend({
  config,
  entries,
}: {
  config: Config
  entries: MealEntry[]
}) {
  const validKeys = config.nutrients.map((n) => n.key)
  const fallback = config.nutrients[0].key

  const colorFor = (key: NutrientKey) =>
    PALETTE[validKeys.indexOf(key) % PALETTE.length]

  const [state, setState] = useState<TrendState>(() =>
    loadState(validKeys, fallback),
  )
  const [days, setDays] = useState<number>(() => loadPeriod())
  const [adding, setAdding] = useState(false)
  const addRef = useRef<HTMLDivElement>(null)

  // Reflect state into the URL on every change, preserving any other params
  // (e.g. ?mock) and omitting anything equal to its default so the common-case
  // URL stays clean. Uses replaceState so toggling tags doesn't spam history.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const def = defaultState(validKeys, fallback)
    const isDefault =
      sameSet(state.nutrients, def.nutrients) &&
      sameSet(state.selected, def.selected)
    if (isDefault) {
      params.delete(QS_NUTRIENTS)
      params.delete(QS_SELECTED)
    } else {
      params.set(QS_NUTRIENTS, state.nutrients.join(','))
      if (sameSet(state.selected, state.nutrients)) {
        params.delete(QS_SELECTED)
      } else {
        params.set(QS_SELECTED, state.selected.join(','))
      }
    }
    if (days === DEFAULT_DAYS) params.delete(QS_PERIOD)
    else params.set(QS_PERIOD, String(days))

    const qs = params.toString()
    const url = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`
    window.history.replaceState(null, '', url)
  }, [state, days, validKeys, fallback])

  // Close the add menu when clicking elsewhere.
  useEffect(() => {
    if (!adding) return
    const onDown = (e: MouseEvent) => {
      if (addRef.current && !addRef.current.contains(e.target as Node)) {
        setAdding(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [adding])

  // Toggle a tag in/out of the drawn set.
  const toggleNutrient = (key: NutrientKey) =>
    setState((s) => ({
      ...s,
      selected: s.selected.includes(key)
        ? s.selected.filter((k) => k !== key)
        : [...s.selected, key],
    }))

  const addNutrient = (key: NutrientKey) => {
    setState((s) => ({
      nutrients: [...s.nutrients, key],
      selected: [...s.selected, key],
    }))
    setAdding(false)
  }

  const removeNutrient = (key: NutrientKey) =>
    setState((s) => ({
      nutrients: s.nutrients.filter((k) => k !== key),
      selected: s.selected.filter((k) => k !== key),
    }))

  // Restore the default nutrient set (and selection).
  const reset = () => setState(defaultState(validKeys, fallback))

  const available = config.nutrients.filter(
    (n) => !state.nutrients.includes(n.key),
  )

  // Keep the drawn nutrients in config order so lines and legend are stable.
  const drawn = config.nutrients.filter((n) => state.selected.includes(n.key))

  // The 100% line means opposite things for 上限型 (stay under) and 目標型
  // (reach it), so the good/bad zones can only be shaded when every drawn
  // nutrient points the same way. With a mixed selection a single horizontal
  // band would be misleading, so we show a hint instead of a band.
  const reachCount = drawn.filter((n) => n.goal === 'reach').length
  const zone =
    drawn.length === 0
      ? 'none'
      : reachCount === drawn.length
        ? 'reach' // all 目標型: good above 100, bad below
        : reachCount === 0
          ? 'limit' // all 上限型: good below 100, bad above
          : 'mixed'

  // Each line is plotted as a percentage of that nutrient's daily target, so
  // nutrients with wildly different units/scales (kcal vs g) share one axis and
  // none gets pinned to the bottom. The tooltip recovers the real amount.
  const data = useMemo(
    () =>
      dailyTotals(entries, days).map((d) => {
        const row: Record<string, number | string> = { date: d.date.slice(5) }
        for (const n of drawn) {
          const value = d.totals[n.key] ?? 0
          row[n.key] = n.target ? (value / n.target) * 100 : value
        }
        return row
      }),
    [entries, days, drawn],
  )

  // Each nutrient is drawn as its own solid colour line so it stays
  // identifiable. On the "bad" side of its 100% line (above for 上限型, below
  // for 目標型) we OVERLAY a red dashed line, so the danger stretch reads as the
  // nutrient's colour and red alternating — flagging risk without two lines
  // collapsing into indistinguishable solid red. `danger` is the overlay stroke:
  //   null            → no overlay (the line never crosses into its bad side)
  //   DANGER          → solid red overlay (whole line is on the bad side)
  //   url(#id)        → gradient: red on the bad side, transparent on the safe
  // The gradient is vertical; offset 0 = top (dataMax), 1 = bottom (dataMin),
  // switching opacity at where 100% falls within the line's own value range.
  const lineStrokes = useMemo(() => {
    return drawn.map((n) => {
      const color = colorFor(n.key)
      const isReach = n.goal === 'reach'
      const onBadSide = (pct: number) => (isReach ? pct < 100 : pct > 100)
      const vals = data
        .map((d) => d[n.key])
        .filter((v): v is number => typeof v === 'number')
      const id = `trend-danger-${n.key}`
      if (vals.length === 0) return { key: n.key, color, danger: null as string | null }
      const dataMax = Math.max(...vals)
      const dataMin = Math.min(...vals)
      if (dataMax === dataMin) {
        return { key: n.key, color, danger: onBadSide(dataMax) ? DANGER : null }
      }
      const off = Math.min(1, Math.max(0, (dataMax - 100) / (dataMax - dataMin)))
      if (off <= 0) return { key: n.key, color, danger: isReach ? DANGER : null }
      if (off >= 1) return { key: n.key, color, danger: isReach ? null : DANGER }
      // Red on the bad side (opacity 1), transparent on the safe side.
      const topOpacity = isReach ? 0 : 1 // top region (0..off) = above 100
      const botOpacity = isReach ? 1 : 0 // bottom region (off..1) = below 100
      return { key: n.key, color, danger: `url(#${id})`, id, off, topOpacity, botOpacity }
    })
  }, [drawn, data])

  // Custom tooltip: each nutrient may be rendered as two overlapping lines
  // (base + red danger overlay) sharing a dataKey, so dedupe by key to avoid
  // listing it twice. Also recovers the real amount from the plotted %.
  const renderTip = (props: {
    active?: boolean
    label?: string | number
    payload?: { dataKey?: string | number; value?: number }[]
  }) => {
    if (!props.active || !props.payload?.length) return null
    const seen = new Set<string>()
    const rows: JSX.Element[] = []
    for (const item of props.payload) {
      const key = String(item.dataKey)
      if (seen.has(key)) continue
      seen.add(key)
      const def = config.nutrients.find((n) => n.key === key)
      const pct = Math.round(Number(item.value))
      const text =
        def?.target == null
          ? `${pct}`
          : `${Math.round(((Number(item.value) / 100) * def.target) * 10) / 10} ${def.unit}（目標比 ${pct}%）`
      rows.push(
        <div className="trend__tip-row" key={key}>
          <span className="trend__tip-name" style={{ color: colorFor(key as NutrientKey) }}>
            {def?.label ?? key}
          </span>
          <span className="trend__tip-val">{text}</span>
        </div>,
      )
    }
    return (
      <div className="trend__tip">
        <div className="trend__tip-label">{props.label}</div>
        {rows}
      </div>
    )
  }

  return (
    <section className="trend">
      <div className="trend__head">
        <h2>推移</h2>
        <div className="trend__controls">
          <button className="trend__reset" onClick={reset}>
            リセット
          </button>
          <div className="trend__periods">
            {PERIODS.map((p) => (
              <button
                key={p}
                className={p === days ? 'is-active' : ''}
                onClick={() => setDays(p)}
              >
                {p}日
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="trend__tags">
        {config.nutrients
          .filter((n) => state.nutrients.includes(n.key))
          .map((n) => {
            const active = state.selected.includes(n.key)
            const color = colorFor(n.key)
            return (
              <span
                key={n.key}
                className={`ntag${active ? ' is-active' : ''}`}
                style={
                  active ? { background: color, borderColor: color } : undefined
                }
              >
                <button
                  className="ntag__label"
                  onClick={() => toggleNutrient(n.key)}
                >
                  {n.label}
                </button>
                <button
                  className="ntag__remove"
                  onClick={() => removeNutrient(n.key)}
                  aria-label={`${n.label}を外す`}
                >
                  ×
                </button>
              </span>
            )
          })}

        {available.length > 0 && (
          <div className="ntag-add" ref={addRef}>
            <button
              className="ntag-add__btn"
              onClick={() => setAdding((v) => !v)}
              aria-label="栄養素を追加"
              aria-expanded={adding}
            >
              ＋
            </button>
            {adding && (
              <div className="ntag-menu" role="menu">
                {available.map((n) => (
                  <button
                    key={n.key}
                    role="menuitem"
                    onClick={() => addNutrient(n.key)}
                  >
                    {n.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {drawn.length > 0 ? (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart
            data={data}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <defs>
              {lineStrokes.map((s) =>
                s.id ? (
                  <linearGradient key={s.id} id={s.id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset={s.off} stopColor={DANGER} stopOpacity={s.topOpacity} />
                    <stop offset={s.off} stopColor={DANGER} stopOpacity={s.botOpacity} />
                  </linearGradient>
                ) : null,
              )}
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            {/* Shade the good (green) / warning (red) zones around the 100%
                line. Only meaningful when all drawn nutrients share a goal
                direction — see `zone` above. */}
            {zone === 'limit' && (
              <>
                <ReferenceArea y1={0} y2={100} fill="#85b79d" fillOpacity={0.06} />
                <ReferenceArea
                  y1={100}
                  fill="#e0556d"
                  fillOpacity={0.08}
                  label={{ value: '超過注意', position: 'insideTopLeft', fontSize: 10, fill: '#c0455c' }}
                />
              </>
            )}
            {zone === 'reach' && (
              <>
                <ReferenceArea y1={100} fill="#85b79d" fillOpacity={0.06} />
                <ReferenceArea
                  y1={0}
                  y2={100}
                  fill="#e0556d"
                  fillOpacity={0.08}
                  label={{ value: '不足注意', position: 'insideBottomLeft', fontSize: 10, fill: '#c0455c' }}
                />
              </>
            )}
            <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={16} />
            <YAxis
              tick={{ fontSize: 11 }}
              width={44}
              // Always keep the 100% target line in view, even on low-intake days.
              domain={[0, (max: number) => Math.max(110, Math.ceil(max / 10) * 10)]}
              tickFormatter={(v: number) => `${v}%`}
            />
            <ReferenceLine
              y={100}
              stroke="#e8a13a"
              strokeWidth={1.5}
              strokeDasharray="6 4"
              ifOverflow="extendDomain"
              label={{
                value: '基準 100%',
                position: 'insideTopRight',
                fontSize: 11,
                fontWeight: 700,
                fill: '#c97e16',
              }}
            />
            <Tooltip content={renderTip} />
            {drawn.map((n, i) => {
              const s = lineStrokes[i]
              return (
                <Fragment key={n.key}>
                  <Line
                    type="monotone"
                    dataKey={n.key}
                    name={n.label}
                    stroke={s.color}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: s.color }}
                    isAnimationActive={false}
                  />
                  {s.danger && (
                    // Red dashes over the bad stretch; gaps reveal the base
                    // colour, so danger reads as colour+red alternating.
                    <Line
                      type="monotone"
                      dataKey={n.key}
                      stroke={s.danger}
                      strokeWidth={2}
                      strokeDasharray="6 6"
                      dot={false}
                      activeDot={false}
                      legendType="none"
                      isAnimationActive={false}
                    />
                  )}
                </Fragment>
              )
            })}
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <p className="trend__empty">
          タグをクリックして表示する栄養素を選んでください
        </p>
      )}

      {zone === 'limit' && (
        <p className="trend__zone">
          <span className="trend__zone-ok">緑帯＝基準以下でOK</span>
          <span className="trend__zone-ng">赤い破線＝超過注意（上限型）</span>
        </p>
      )}
      {zone === 'reach' && (
        <p className="trend__zone">
          <span className="trend__zone-ok">緑帯＝基準以上でOK</span>
          <span className="trend__zone-ng">赤い破線＝不足注意（目標型）</span>
        </p>
      )}
      {zone === 'mixed' && (
        <p className="trend__zone trend__zone--mixed">
          <span className="trend__zone-ng">赤い破線の区間＝注意</span>
          （上限型は100%超／目標型は100%未満）。1タイプだけ表示すると背景にも基準帯が出ます。
        </p>
      )}
    </section>
  )
}
