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
import type { Config, MealEntry, NutrientKey } from '../data/types'
import { dailyTotals } from '../lib/nutrition'

const PERIODS = [7, 30, 90] as const
const STORAGE_KEY = 'meshi-log:trend'

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
// rendered as its own line. Persisted to localStorage so it survives reloads.
interface TrendState {
  nutrients: NutrientKey[]
  selected: NutrientKey[]
}

// Read persisted state, dropping any keys no longer present in the config and
// keeping the selection a subset of the added tags. Tolerates the previous
// single-key `selected` format by coercing it into an array.
function loadState(validKeys: NutrientKey[], fallback: NutrientKey): TrendState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<TrendState> & {
        selected?: NutrientKey[] | NutrientKey | null
      }
      const nutrients = (parsed.nutrients ?? []).filter((k) =>
        validKeys.includes(k),
      )
      const rawSelected = Array.isArray(parsed.selected)
        ? parsed.selected
        : parsed.selected
          ? [parsed.selected]
          : []
      const selected = rawSelected.filter((k) => nutrients.includes(k))
      return { nutrients, selected }
    }
  } catch {
    // Malformed storage — fall through to the default below.
  }
  // First visit: start with the default nutrient set.
  return defaultState(validKeys, fallback)
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
  const [days, setDays] = useState<number>(30)
  const [adding, setAdding] = useState(false)
  const addRef = useRef<HTMLDivElement>(null)

  // Persist on every change.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // Ignore quota / privacy-mode failures — state still works in-memory.
    }
  }, [state])

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

  // Per-line stroke: each line turns red (DANGER) on the bad side of its own
  // 100% line, so even a mixed selection shows every nutrient's danger zone
  // correctly (上限型 reddens above 100, 目標型 below). Implemented as a vertical
  // gradient with a hard colour switch at the 100% offset within the line's own
  // value range. Flat lines (no range) fall back to a solid colour.
  const lineStrokes = useMemo(() => {
    return drawn.map((n) => {
      const color = colorFor(n.key)
      const isReach = n.goal === 'reach'
      const onBadSide = (pct: number) => (isReach ? pct < 100 : pct > 100)
      const vals = data
        .map((d) => d[n.key])
        .filter((v): v is number => typeof v === 'number')
      const id = `trend-grad-${n.key}`
      if (vals.length === 0) return { key: n.key, color, stroke: color }
      const dataMax = Math.max(...vals)
      const dataMin = Math.min(...vals)
      if (dataMax === dataMin) {
        // Flat line: one solid colour, red only if the whole line is bad.
        return { key: n.key, color, stroke: onBadSide(dataMax) ? DANGER : color }
      }
      // offset 0 = top (dataMax), offset 1 = bottom (dataMin); place the switch
      // where 100% falls, clamped into [0,1].
      const off = Math.min(1, Math.max(0, (dataMax - 100) / (dataMax - dataMin)))
      // Above 100 is the top region (0..off); below is the bottom (off..1).
      const topColor = isReach ? color : DANGER
      const botColor = isReach ? DANGER : color
      return { key: n.key, color, stroke: `url(#${id})`, id, off, topColor, botColor }
    })
  }, [drawn, data])

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
                    <stop offset={s.off} stopColor={s.topColor} />
                    <stop offset={s.off} stopColor={s.botColor} />
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
            <Tooltip
              formatter={(value, _name, item) => {
                const def = config.nutrients.find(
                  (n) => n.key === item.dataKey,
                )
                const pct = Math.round(Number(value))
                if (!def?.target) {
                  return [`${pct}`, def?.label ?? item.dataKey]
                }
                // Recover the real amount from the plotted percentage.
                const real = Math.round(((Number(value) / 100) * def.target) * 10) / 10
                return [`${real} ${def.unit}（目標比 ${pct}%）`, def.label]
              }}
              labelFormatter={(l) => `${l}`}
            />
            {drawn.map((n, i) => (
              <Line
                key={n.key}
                type="monotone"
                dataKey={n.key}
                name={n.label}
                stroke={lineStrokes[i].stroke}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: lineStrokes[i].color }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <p className="trend__empty">
          タグをクリックして表示する栄養素を選んでください
        </p>
      )}

      {zone === 'limit' && (
        <p className="trend__zone">
          <span className="trend__zone-ok">緑＝基準以下でOK</span>
          <span className="trend__zone-ng">赤＝超過注意（上限型）</span>
        </p>
      )}
      {zone === 'reach' && (
        <p className="trend__zone">
          <span className="trend__zone-ok">緑＝基準以上でOK</span>
          <span className="trend__zone-ng">赤＝不足注意（目標型）</span>
        </p>
      )}
      {zone === 'mixed' && (
        <p className="trend__zone trend__zone--mixed">
          <span className="trend__zone-ng">線が赤い区間＝注意</span>
          （上限型は100%超／目標型は100%未満）。1タイプだけ表示すると背景にも基準帯が出ます。
        </p>
      )}
    </section>
  )
}
