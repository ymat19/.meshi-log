import type { MealEntry } from '../data/types'
import { soberStreak } from '../lib/nutrition'

// Prominent "禁酒○日目" counter shown at the top of the dashboard.
export function SoberBanner({ entries }: { entries: MealEntry[] }) {
  const { days, hasDrinkRecord } = soberStreak(entries)

  return (
    <section className="sober" aria-label="禁酒日数">
      <span className="sober__icon" aria-hidden>🚫🍺</span>
      <span className="sober__label">禁酒</span>
      <span className="sober__days">{days}</span>
      <span className="sober__unit">日目</span>
      {!hasDrinkRecord && <span className="sober__note">飲酒記録なし</span>}
    </section>
  )
}
