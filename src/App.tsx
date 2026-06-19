import { useMealData } from './data/DataSourceContext'
import { DailySummary } from './components/DailySummary'
import { Timeline } from './components/Timeline'

// The application is completely agnostic to where its data comes from.
// It reads everything through useMealData() — no mock/real branching here.
export function App() {
  const { config, entries, loading, error } = useMealData()

  if (loading) return <main className="state">読み込み中…</main>
  if (error) return <main className="state">エラー: {error.message}</main>
  if (!config) return null

  return (
    <main>
      <header className="app-header">
        <h1>🍽 meshi-log</h1>
      </header>
      {entries.length === 0 ? (
        <p className="state">まだ記録がありません。</p>
      ) : (
        <>
          <DailySummary config={config} entries={entries} />
          <Timeline config={config} entries={entries} />
        </>
      )}
    </main>
  )
}
