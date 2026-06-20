import { useCallback, useEffect, useState } from 'react'
import type { Config, MealEntry, MealType } from '../data/types'
import { groupByDate } from '../lib/nutrition'

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
  const [galleryOpen, setGalleryOpen] = useState(false)
  const photoCount = entry.photos.length
  const alt = entry.items[0]?.name ?? '食事'

  return (
    <article className="card">
      {entry.photos[0] && (
        <button
          type="button"
          className="card__photo-wrap"
          onClick={() => setGalleryOpen(true)}
          aria-label={
            photoCount > 1 ? `写真を${photoCount}枚すべて見る` : '写真を拡大する'
          }
        >
          <img className="card__photo" src={entry.photos[0]} alt={alt} />
          {photoCount > 1 && (
            <span className="card__photo-badge" aria-hidden="true">
              <PhotoIcon />
              {photoCount}
            </span>
          )}
        </button>
      )}
      <div className="card__body">
        <div className="card__head">
          <span className="card__type">{typeLabel}</span>
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
      {galleryOpen && (
        <PhotoGallery photos={entry.photos} alt={alt} onClose={() => setGalleryOpen(false)} />
      )}
    </article>
  )
}

function PhotoGallery({
  photos,
  alt,
  onClose,
}: {
  photos: string[]
  alt: string
  onClose: () => void
}) {
  const [index, setIndex] = useState(0)
  const count = photos.length

  const go = useCallback(
    (delta: number) => setIndex((i) => (i + delta + count) % count),
    [count],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [go, onClose])

  return (
    <div className="gallery" role="dialog" aria-modal="true" onClick={onClose}>
      <button type="button" className="gallery__close" aria-label="閉じる" onClick={onClose}>
        ×
      </button>
      <figure className="gallery__stage" onClick={(e) => e.stopPropagation()}>
        <img className="gallery__img" src={photos[index]} alt={`${alt}（${index + 1}/${count}）`} />
        {count > 1 && (
          <>
            <button
              type="button"
              className="gallery__nav gallery__nav--prev"
              aria-label="前の写真"
              onClick={() => go(-1)}
            >
              ‹
            </button>
            <button
              type="button"
              className="gallery__nav gallery__nav--next"
              aria-label="次の写真"
              onClick={() => go(1)}
            >
              ›
            </button>
            <figcaption className="gallery__counter">
              {index + 1} / {count}
            </figcaption>
          </>
        )}
      </figure>
      {count > 1 && (
        <div className="gallery__thumbs" onClick={(e) => e.stopPropagation()}>
          {photos.map((p, i) => (
            <button
              type="button"
              key={p + i}
              className={`gallery__thumb${i === index ? ' is-active' : ''}`}
              aria-label={`${i + 1}枚目を表示`}
              onClick={() => setIndex(i)}
            >
              <img src={p} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function PhotoIcon() {
  return (
    <svg
      className="card__photo-badge-icon"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="14" height="14" rx="2" />
      <path d="M21 7v12a2 2 0 0 1-2 2H7" />
    </svg>
  )
}
