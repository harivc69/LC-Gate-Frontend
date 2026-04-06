import { ThemeProvider, CssBaseline } from '@mui/material'
import { theme } from './theme'
import './styles/globals.css'
import Dashboard from './components/Dashboard'

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Dashboard />
    </ThemeProvider>
  )
}
