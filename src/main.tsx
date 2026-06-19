import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { DataSourceProvider } from './data/DataSourceContext'
import { createDataSource, isMockMode } from './data/createDataSource'
import './styles.css'

// Composition root: the only layer aware of mock vs real. It injects the
// chosen data source and (separately from <App/>) shows a mock badge so the
// app component itself stays oblivious to the distinction.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DataSourceProvider source={createDataSource()}>
      {isMockMode() && <div className="mock-badge">MOCK</div>}
      <App />
    </DataSourceProvider>
  </StrictMode>,
)
