import { useState } from 'react'
import { ThemeProvider, CssBaseline } from '@mui/material'
import { createTheme } from '@mui/material/styles'
import CodeEditor from './components/CodeEditor'
import ContainerDashboard from './components/ContainerDashboard'
import { Box, Container, Paper } from '@mui/material'

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
  },
})

function App() {
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Container maxWidth="xl">
        <Box sx={{ mt: 4, mb: 4 }}>
          <Paper sx={{ p: 3 }}>
            <CodeEditor />
          </Paper>
          <Box sx={{ mt: 3 }}>
            <Paper sx={{ p: 3 }}>
              <ContainerDashboard />
            </Paper>
          </Box>
        </Box>
      </Container>
    </ThemeProvider>
  )
}

export default App
