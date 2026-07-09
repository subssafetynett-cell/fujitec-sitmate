import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import App from './App.jsx'
import './index.css';
import { ThemeProvider, CssBaseline } from "@mui/material";
import { BrowserRouter } from "react-router-dom";
import theme from './Theme.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { NotificationProvider } from './context/NotificationContext.jsx';
import SessionManager from './components/SessionManager.jsx';
import PageLoadingFallback from './components/PageLoadingFallback.jsx';
import PwaUpdatePrompt from './components/PwaUpdatePrompt.jsx';
import PwaInstallPrompt from './components/PwaInstallPrompt.jsx';
import OfflineStatusBanner from './components/OfflineStatusBanner.jsx';
import { queryClient } from './lib/queryClient.js';
import { startOfflineSync } from './utils/offlineSync.js';

const routerBasename =
  import.meta.env.BASE_URL && import.meta.env.BASE_URL !== '/'
    ? import.meta.env.BASE_URL.replace(/\/$/, '')
    : undefined

startOfflineSync()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <BrowserRouter basename={routerBasename}>
        <AuthProvider>
          <NotificationProvider>
            <QueryClientProvider client={queryClient}>
              <SessionManager />
              <CssBaseline /> {/* resets default browser styles */}
              <OfflineStatusBanner />
              <Suspense fallback={<PageLoadingFallback />}>
                <App />
              </Suspense>
              <PwaInstallPrompt />
              <PwaUpdatePrompt />
            </QueryClientProvider>
          </NotificationProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
)

