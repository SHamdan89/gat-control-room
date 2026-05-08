import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import GATControlRoom from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GATControlRoom />
  </StrictMode>,
)
