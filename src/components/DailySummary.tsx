import type { Config, MealEntry } from '../data/types'
import { entryTotals, sumNutrition } from '../lib/nutrition'

// Shows aggregated nutrition totals for the most recent day that has records,
// each compared against its daily target.
export function DailySummary({
  config,
  entries,
}: {
  config: Config
  entries: MealEntry[]
}) {
  const latestDate = entries[0].datetime.slice(0, 10)
  const ofDay = entries.filter((e) => e.datetime.slice(0, 10) === latestDate)
  const totals = sumNutrition(ofDay.map(entryTotals))

  return (
    <section className="summary">
      <h2>
        {latestDate} の合計
        <span className="summary__count">{ofDay.length} 食</span>
      </h2>
      <div className="summary__grid">
        {config.nutrients.map((n) => {
          const value = totals[n.key] ?? 0
          const pct = n.target ? Math.round((value / n.target) * 100) : null
          // 目標型 ('reach') wants pct >= 100; 上限型 ('limit', the default)
          // wants pct <= 100. The "bad" side decides the red/green colouring.
          const over =
            pct !== null &&
            (n.goal === 'reach' ? pct < 100 : pct > 100)
          return (
            <div key={n.key} className="summary__cell">
              <div className="summary__value">{value}</div>
              {n.target != null && (
                <div className="summary__target">
                  / {n.target}
                  {pct !== null && (
                    <span
                      className={
                        'summary__pct' + (over ? ' summary__pct--over' : ' summary__pct--ok')
                      }
                    >
                      {pct}%
                    </span>
                  )}
                </div>
              )}
              <div className="summary__label">
                {n.label}
                <span className="summary__unit">{n.unit}</span>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
