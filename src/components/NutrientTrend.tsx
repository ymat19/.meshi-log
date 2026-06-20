import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Config, MealEntry, NutrientKey } from '../data/types'
import { dailyTotals } from '../lib/nutrition'

const PERIODS = [7, 30, 90] as const
const STORAGE_KEY = 'meshi-log:trend'

// Which nutrient tags the user has added, and which one is currently shown.
// Persisted to localStorage so the selection survives reloads.
interface TrendState {
  nutrients: NutrientKey[]
  selected: NutrientKey | null
}

// Read persisted state, dropping any keys no longer present in the config and
// repairing the selection so it always points at an existing tag (or null).
function loadState(validKeys: NutrientKey[], fallback: NutrientKey): TrendState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<TrendState>
      const nutrients = (parsed.nutrients ?? []).filter((k) =>
        validKeys.includes(k),
      )
      const selected =
        parsed.selected && nutrients.includes(parsed.selected)
          ? parsed.selected
          : (nutrients[0] ?? null)
      return { nutrients, selected }
    }
  } catch {
    // Malformed storage — fall through to the default below.
  }
  // First visit: start with a single nutrient so the chart isn't empty.
  return { nutrients: [fallback], selected: fallback }
}

// Daily trend of a selected nutrient over a selectable period.
export function NutrientTrend({
  config,
  entries,
}: {
  config: Config
  entries: MealEntry[]
}) {
  const validKeys = config.nutrients.map((n) => n.key)
  const fallback = config.nutrients[0].key

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

  const selectNutrient = (key: NutrientKey) =>
    setState((s) => ({ ...s, selected: key }))

  const addNutrient = (key: NutrientKey) => {
    setState((s) => ({ nutrients: [...s.nutrients, key], selected: key }))
    setAdding(false)
  }

  const removeNutrient = (key: NutrientKey) =>
    setState((s) => {
      const nutrients = s.nutrients.filter((k) => k !== key)
      const selected =
        s.selected === key ? (nutrients[0] ?? null) : s.selected
      return { nutrients, selected }
    })

  const def = config.nutrients.find((n) => n.key === state.selected)
  const available = config.nutrients.filter(
    (n) => !state.nutrients.includes(n.key),
  )

  const data = useMemo(
    () =>
      state.selected
        ? dailyTotals(entries, days).map((d) => ({
            date: d.date.slice(5), // MM-DD
            value: d.totals[state.selected!] ?? 0,
          }))
        : [],
    [entries, days, state.selected],
  )

  return (
    <section className="trend">
      <div className="trend__head">
        <h2>推移</h2>
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

      <div className="trend__tags">
        {config.nutrients
          .filter((n) => state.nutrients.includes(n.key))
          .map((n) => (
            <span
              key={n.key}
              className={`ntag${n.key === state.selected ? ' is-active' : ''}`}
            >
              <button
                className="ntag__label"
                onClick={() => selectNutrient(n.key)}
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
          ))}

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

      {def ? (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={data}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={16} />
            <YAxis tick={{ fontSize: 11 }} width={40} />
            <Tooltip
              formatter={(v: number) => [`${v} ${def.unit}`, def.label]}
              labelFormatter={(l) => `${l}`}
            />
            <Bar dataKey="value" fill="#85b79d" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <p className="trend__empty">＋ から栄養素を追加してください</p>
      )}
    </section>
  )
}
