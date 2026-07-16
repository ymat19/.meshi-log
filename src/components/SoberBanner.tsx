import type { MealEntry } from '../data/types'
import { entryTotals, soberStreak, sumNutrition, todayJST } from '../lib/nutrition'

// Prominent "禁酒○日目" counter shown at the top of the dashboard, with
// today's (JST) total energy displayed large beneath it.
export function SoberBanner({ entries }: { entries: MealEntry[] }) {
  const { days, hasDrinkRecord } = soberStreak(entries)

  const today = todayJST()
  const ofToday = entries.filter((e) => e.datetime.slice(0, 10) === today)
  const kcal = sumNutrition(ofToday.map(entryTotals)).energy_kcal ?? 0

  return (
    <section className="sober" aria-label="禁酒日数と今日のカロリー">
      <div className="sober__top">
        <span className="sober__icon" aria-hidden>🚫🍺</span>
        <span className="sober__label">禁酒</span>
        <span className="sober__days">{days}</span>
        <span className="sober__unit">日目</span>
        {!hasDrinkRecord && <span className="sober__note">飲酒記録なし</span>}
      </div>
      <div className="sober__calorie" aria-label="今日のカロリー">
        <span className="sober__calorie-label">今日のカロリー</span>
        <span className="sober__calorie-value">{kcal}</span>
        <span className="sober__calorie-unit">kcal</span>
      </div>
    </section>
  )
}
