import { useEffect, useMemo, useRef, useState } from 'react'
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
import type { Config, MealEntry, NutrientDef, NutrientKey } from '../data/types'
import { dailyTotals } from '../lib/nutrition'

const PERIODS = [7, 30, 90] as const
const DEFAULT_DAYS = 30

// Chart view state lives in BOTH the URL query string and localStorage.
//   - The URL makes a view shareable/bookmarkable and survives reloads.
//   - localStorage remembers the last view on this device so a plain visit
//     (no query string) restores it instead of snapping back to the default.
// Priority on load: the query string always wins when present; only when NONE
// of the chart params appear in the URL do we fall back to localStorage.
// The URL still omits anything equal to its default so the common-case URL
// stays clean, while localStorage always stores the full current state.
//   n   = added nutrient tags (comma-separated)
//   sel = the subset currently drawn — omitted when it equals `n` (all drawn)
//   d   = period in days — omitted when it is the default (30)
const QS_NUTRIENTS = 'n'
const QS_SELECTED = 'sel'
const QS_PERIOD = 'd'

// Where the last view is remembered on this device.
const STORAGE_KEY = 'meshi-log:trend'

// Colour a line segment turns when it sits on the "bad" side of its 100% line
// (above for 上限型, below for 目標型). Shared with the warning band fill so the
// danger signal reads the same across every chart.
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

// Which nutrient tags the user has added, and which of them are currently
// drawn. Multiple nutrients can be selected at once — each selected tag is
// rendered as its OWN chart (stacking one graph per nutrient), so wildly
// different units/scales never get crammed onto a single axis.
interface TrendState {
  nutrients: NutrientKey[]
  selected: NutrientKey[]
}

// The default tag/selection set, filtered to nutrients the config actually
// defines so a config change can never leave the chart referencing a dead key.
function defaultState(validKeys: NutrientKey[], fallback: NutrientKey): TrendState {
  const keys = DEFAULT_NUTRIENTS.filter((k) => validKeys.includes(k))
  const list = keys.length > 0 ? [...keys] : [fallback]
  return { nutrients: list, selected: list }
}

// Order-insensitive set equality. Selection/tag order has no rendering meaning
// (tags and charts are always laid out in config order), so we compare as sets.
function sameSet(a: NutrientKey[], b: NutrientKey[]): boolean {
  if (a.length !== b.length) return false
  const set = new Set(a)
  return b.every((k) => set.has(k))
}

// Keep only the entries that are keys the config still defines, so a config
// change (or stale localStorage) can never leave the chart referencing a dead
// key. Accepts any input shape (comma string, array, junk) defensively.
function sanitizeKeys(input: unknown, validKeys: NutrientKey[]): NutrientKey[] {
  const raw = typeof input === 'string' ? input.split(',') : input
  if (!Array.isArray(raw)) return []
  return raw.filter((k): k is NutrientKey => validKeys.includes(k as NutrientKey))
}

// Accept a period only if it is one of the offered options.
function validPeriod(n: unknown): number {
  return (PERIODS as readonly number[]).includes(n as number)
    ? (n as number)
    : DEFAULT_DAYS
}

interface View {
  state: TrendState
  days: number
}

// True when the URL carries any of the chart's params. When none are present
// we treat the URL as "unset" and fall back to localStorage.
function hasChartParams(params: URLSearchParams): boolean {
  return (
    params.has(QS_NUTRIENTS) ||
    params.has(QS_SELECTED) ||
    params.has(QS_PERIOD)
  )
}

// Build the view from the URL. A present-but-empty `sel` is honoured as
// "nothing drawn"; an absent `sel` means "all added tags drawn".
function fromUrl(
  params: URLSearchParams,
  validKeys: NutrientKey[],
  fallback: NutrientKey,
): View {
  const days = validPeriod(Number(params.get(QS_PERIOD)))
  if (!params.has(QS_NUTRIENTS)) return { state: defaultState(validKeys, fallback), days }
  const nutrients = sanitizeKeys(params.get(QS_NUTRIENTS), validKeys)
  if (nutrients.length === 0) return { state: defaultState(validKeys, fallback), days }
  const selected = params.has(QS_SELECTED)
    ? sanitizeKeys(params.get(QS_SELECTED), validKeys).filter((k) =>
        nutrients.includes(k),
      )
    : [...nutrients]
  return { state: { nutrients, selected }, days }
}

// Build the view from localStorage, or null when nothing usable is stored.
function fromStorage(validKeys: NutrientKey[]): View | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as {
      nutrients?: unknown
      selected?: unknown
      days?: unknown
    }
    const nutrients = sanitizeKeys(parsed.nutrients, validKeys)
    if (nutrients.length === 0) return null
    const selected = sanitizeKeys(parsed.selected, validKeys).filter((k) =>
      nutrients.includes(k),
    )
    return { state: { nutrients, selected }, days: validPeriod(parsed.days) }
  } catch {
    return null
  }
}

// Decide the initial view: the query string always wins when present; only a
// URL with no chart params at all falls back to localStorage, then default.
function loadInitial(validKeys: NutrientKey[], fallback: NutrientKey): View {
  const params = new URLSearchParams(window.location.search)
  if (hasChartParams(params)) return fromUrl(params, validKeys, fallback)
  return fromStorage(validKeys) ?? { state: defaultState(validKeys, fallback), days: DEFAULT_DAYS }
}

// A single nutrient's daily trend, plotted as a percentage of its target so the
// 100% line is always meaningful. Each selected nutrient gets one of these, so
// scales never collide and every chart carries its own good/warning band.
function TrendChart({
  nutrient,
  data,
  color,
}: {
  nutrient: NutrientDef
  data: { date: string; value: number | null }[]
  color: string
}) {
  const isReach = nutrient.goal === 'reach'
  const gradId = `trend-danger-${nutrient.key}`

  // The base line is the nutrient's colour; where it sits on the "bad" side of
  // its 100% line we OVERLAY a red dashed line, so danger reads as the
  // nutrient's colour and red alternating rather than a second full line.
  //   null      → never crosses into its bad side (no overlay)
  //   DANGER    → the whole line is on the bad side (solid red overlay)
  //   url(#id)  → a vertical gradient: red on the bad side, transparent on safe
  const danger = useMemo(() => {
    const onBadSide = (pct: number) => (isReach ? pct < 100 : pct > 100)
    const vals = data
      .map((d) => d.value)
      .filter((v): v is number => typeof v === 'number')
    if (vals.length === 0) return { stroke: null as string | null }
    const dataMax = Math.max(...vals)
    const dataMin = Math.min(...vals)
    if (dataMax === dataMin) {
      return { stroke: onBadSide(dataMax) ? DANGER : null }
    }
    const off = Math.min(1, Math.max(0, (dataMax - 100) / (dataMax - dataMin)))
    if (off <= 0) return { stroke: isReach ? DANGER : null }
    if (off >= 1) return { stroke: isReach ? null : DANGER }
    // offset 0 = top (dataMax), 1 = bottom (dataMin); the top region (0..off)
    // is the stretch above 100%, the bottom region (off..1) is below 100%.
    return {
      stroke: `url(#${gradId})`,
      off,
      topOpacity: isReach ? 0 : 1,
      botOpacity: isReach ? 1 : 0,
    }
  }, [data, isReach, gradId])

  const renderTip = (props: {
    active?: boolean
    label?: string | number
    payload?: { value?: number }[]
  }) => {
    if (!props.active || !props.payload?.length) return null
    const raw = Number(props.payload[0].value)
    const pct = Math.round(raw)
    const text =
      nutrient.target == null
        ? `${pct}`
        : `${Math.round((raw / 100) * nutrient.target * 10) / 10} ${nutrient.unit}（目標比 ${pct}%）`
    return (
      <div className="trend__tip">
        <div className="trend__tip-label">{props.label}</div>
        <div className="trend__tip-row">
          <span className="trend__tip-name" style={{ color }}>
            {nutrient.label}
          </span>
          <span className="trend__tip-val">{text}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="trend__chart">
      <div className="trend__chart-head">
        <span className="trend__chart-name" style={{ color }}>
          {nutrient.label}
        </span>
        <span className="trend__chart-target">
          {nutrient.target != null
            ? `基準 ${nutrient.target}${nutrient.unit}／日（${isReach ? '目標型' : '上限型'}）`
            : nutrient.unit}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            {danger.off != null && (
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset={danger.off} stopColor={DANGER} stopOpacity={danger.topOpacity} />
                <stop offset={danger.off} stopColor={DANGER} stopOpacity={danger.botOpacity} />
              </linearGradient>
            )}
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          {/* Good (green) / warning (red) zones around the 100% line. Each chart
              is a single nutrient, so the direction is unambiguous. */}
          {isReach ? (
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
          ) : (
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
          <Line
            type="monotone"
            dataKey="value"
            name={nutrient.label}
            stroke={color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: color }}
            connectNulls
            isAnimationActive={false}
          />
          {danger.stroke && (
            // Red dashes over the bad stretch; gaps reveal the base colour, so
            // danger reads as colour+red alternating.
            <Line
              type="monotone"
              dataKey="value"
              stroke={danger.stroke}
              strokeWidth={2}
              strokeDasharray="6 6"
              dot={false}
              activeDot={false}
              legendType="none"
              connectNulls
              isAnimationActive={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
      <p className="trend__zone">
        {isReach ? (
          <>
            <span className="trend__zone-ok">緑帯＝基準以上でOK</span>
            <span className="trend__zone-ng">赤い破線＝不足注意（目標型）</span>
          </>
        ) : (
          <>
            <span className="trend__zone-ok">緑帯＝基準以下でOK</span>
            <span className="trend__zone-ng">赤い破線＝超過注意（上限型）</span>
          </>
        )}
      </p>
    </div>
  )
}

// Daily trend of any number of selected nutrients over a selectable period.
// Each selected nutrient is rendered as its own chart.
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

  const initial = useMemo(
    () => loadInitial(validKeys, fallback),
    // Read once on mount; validKeys/fallback are stable for a given config.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const [state, setState] = useState<TrendState>(initial.state)
  const [days, setDays] = useState<number>(initial.days)
  const [adding, setAdding] = useState(false)
  const addRef = useRef<HTMLDivElement>(null)

  // Reflect state into the URL AND localStorage on every change. The URL
  // preserves any other params (e.g. ?mock) and omits anything equal to its
  // default so the common-case URL stays clean; localStorage always stores the
  // full current view so a plain visit can restore it. replaceState avoids
  // spamming history when toggling tags.
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

    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          nutrients: state.nutrients,
          selected: state.selected,
          days,
        }),
      )
    } catch {
      // Storage may be unavailable (private mode, quota) — the URL still holds
      // the view, so persistence is best-effort.
    }
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

  // Keep the drawn nutrients in config order so charts and legend are stable.
  const drawn = config.nutrients.filter((n) => state.selected.includes(n.key))

  // One row per date, holding each drawn nutrient's value as a percentage of
  // its target (falling back to the raw amount when no target is set). Sliced
  // out per chart below so every chart shares an identical date axis.
  const daily = useMemo(() => dailyTotals(entries, days), [entries, days])

  const seriesFor = (n: NutrientDef) =>
    daily.map((d) => {
      const value = d.totals[n.key] ?? 0
      return {
        date: d.date.slice(5),
        value: n.target ? (value / n.target) * 100 : value,
      }
    })

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
        <div className="trend__charts">
          {drawn.map((n) => (
            <TrendChart
              key={n.key}
              nutrient={n}
              data={seriesFor(n)}
              color={colorFor(n.key)}
            />
          ))}
        </div>
      ) : (
        <p className="trend__empty">
          タグをクリックして表示する栄養素を選んでください
        </p>
      )}
    </section>
  )
}
