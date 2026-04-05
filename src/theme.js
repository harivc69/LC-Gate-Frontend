import { createTheme } from '@mui/material/styles'

export const theme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#07090f',
      paper:   '#0d1121',
    },
    primary: {
      main: '#1e8fff',
    },
    text: {
      primary:   '#d0e0f0',
      secondary: '#4a6a80',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", sans-serif',
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          margin: 0,
          padding: 0,
          overflow: 'hidden',
        },
      },
    },
  },
})
