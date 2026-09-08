import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router'
import { ThemeProvider } from '@/app/theme-provider'
import { SidebarProvider } from '@/app/sidebar-provider'
import { DensityProvider } from '@/app/density-provider'
import { AuthProvider } from '@/features/auth/auth-provider'
import { Toaster } from '@/components/ui/sonner'
import { AppRoutes } from '@/app/routes'
import { ApiError } from '@/lib/api'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => {
        // Never retry a client error (bad request, not found, forbidden,
        // etc.) — retrying would just repeat the same failure. Only
        // transient/server-side failures get a couple of retries.
        if (error instanceof ApiError && error.status < 500) return false
        return failureCount < 2
      },
    },
  },
})

function App() {
  return (
    <ThemeProvider>
      <SidebarProvider>
        <DensityProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <BrowserRouter>
                <AppRoutes />
              </BrowserRouter>
              <Toaster />
            </AuthProvider>
          </QueryClientProvider>
        </DensityProvider>
      </SidebarProvider>
    </ThemeProvider>
  )
}

export default App
