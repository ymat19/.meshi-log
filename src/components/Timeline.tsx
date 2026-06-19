import type { Config, MealEntry, MealType } from '../data/types'
import { groupByDate } from '../lib/nutrition'

function timeOf(datetime: string): string {
  return datetime.slice(11, 16)
}

export function Timeline({
  config,
  entries,
}: {
  config: Config
  entries: MealEntry[]
}) {
  const typeLabel = (t: MealType) =>
    config.mealTypes.find((mt) => mt.key === t)?.label ?? t
  const days = groupByDate(entries)

  return (
    <section className="timeline">
      <h2>タイムライン</h2>
      {days.map(([date, dayEntries]) => (
        <div key={date} className="timeline__day">
          <h3 className="timeline__date">{date}</h3>
          {dayEntries.map((entry) => (
            <MealCard key={entry.id} entry={entry} typeLabel={typeLabel(entry.type)} config={config} />
          ))}
        </div>
      ))}
    </section>
  )
}

function MealCard({
  entry,
  typeLabel,
  config,
}: {
  entry: MealEntry
  typeLabel: string
  config: Config
}) {
  return (
    <article className="card">
      {entry.photos[0] && (
        <img className="card__photo" src={entry.photos[0]} alt={entry.items[0]?.name ?? '食事'} />
      )}
      <div className="card__body">
        <div className="card__head">
          <span className="card__type">{typeLabel}</span>
          <span className="card__time">{timeOf(entry.datetime)}</span>
        </div>
        <div className="card__name">{entry.items.map((i) => i.name).join('、')}</div>
        {entry.memo && <p className="card__memo">{entry.memo}</p>}
        <div className="card__nutri">
          {config.nutrients.map((n) => {
            const v = entry.nutrition[n.key]
            if (typeof v !== 'number') return null
            return (
              <span key={n.key} className="chip">
                {n.label} {v}
                {n.unit}
              </span>
            )
          })}
        </div>
        {entry.tags.length > 0 && (
          <div className="card__tags">
            {entry.tags.map((t) => (
              <span key={t} className="tag">
                #{t}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  )
}
