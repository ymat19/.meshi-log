import type { Config, MealEntry } from '../data/types'
import { sumNutrition } from '../lib/nutrition'

// Shows aggregated nutrition totals for the most recent day that has records.
export function DailySummary({
  config,
  entries,
}: {
  config: Config
  entries: MealEntry[]
}) {
  const latestDate = entries[0].datetime.slice(0, 10)
  const ofDay = entries.filter((e) => e.datetime.slice(0, 10) === latestDate)
  const totals = sumNutrition(ofDay.map((e) => e.nutrition))

  return (
    <section className="summary">
      <h2>
        {latestDate} の合計
        <span className="summary__count">{ofDay.length} 食</span>
      </h2>
      <div className="summary__grid">
        {config.nutrients.map((n) => (
          <div key={n.key} className="summary__cell">
            <div className="summary__value">{totals[n.key] ?? 0}</div>
            <div className="summary__label">
              {n.label}
              <span className="summary__unit">{n.unit}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
