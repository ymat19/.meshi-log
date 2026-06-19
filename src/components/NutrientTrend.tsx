import { useMemo, useState } from 'react'
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

// Daily trend of a selected nutrient over a selectable period.
export function NutrientTrend({
  config,
  entries,
}: {
  config: Config
  entries: MealEntry[]
}) {
  const [nutrient, setNutrient] = useState<NutrientKey>(config.nutrients[0].key)
  const [days, setDays] = useState<number>(30)

  const def = config.nutrients.find((n) => n.key === nutrient)!
  const data = useMemo(
    () =>
      dailyTotals(entries, days).map((d) => ({
        date: d.date.slice(5), // MM-DD
        value: d.totals[nutrient] ?? 0,
      })),
    [entries, days, nutrient],
  )

  return (
    <section className="trend">
      <div className="trend__head">
        <h2>推移</h2>
        <div className="trend__controls">
          <select
            value={nutrient}
            onChange={(e) => setNutrient(e.target.value as NutrientKey)}
            aria-label="栄養素"
          >
            {config.nutrients.map((n) => (
              <option key={n.key} value={n.key}>
                {n.label}
              </option>
            ))}
          </select>
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
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
    </section>
  )
}
