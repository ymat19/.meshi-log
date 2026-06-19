import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { MealDataSource } from './MealDataSource'
import type { Config, MealEntry } from './types'

const DataSourceContext = createContext<MealDataSource | null>(null)

export function DataSourceProvider({
  source,
  children,
}: {
  source: MealDataSource
  children: ReactNode
}) {
  return (
    <DataSourceContext.Provider value={source}>
      {children}
    </DataSourceContext.Provider>
  )
}

export interface MealData {
  config: Config | null
  entries: MealEntry[]
  loading: boolean
  error: Error | null
}

// The single hook the UI uses to read data. It talks only to the injected
// MealDataSource interface, so mock and real modes are indistinguishable here.
export function useMealData(): MealData {
  const source = useContext(DataSourceContext)
  if (!source) throw new Error('useMealData must be used within DataSourceProvider')

  const [config, setConfig] = useState<Config | null>(null)
  const [entries, setEntries] = useState<MealEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    Promise.all([source.getConfig(), source.getEntries()])
      .then(([c, e]) => {
        if (!alive) return
        setConfig(c)
        setEntries(e)
      })
      .catch((err) => alive && setError(err as Error))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [source])

  return { config, entries, loading, error }
}
