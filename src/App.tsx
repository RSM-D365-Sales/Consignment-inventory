import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { DashboardPage } from './pages/DashboardPage'
import { CustomerDetailPage } from './pages/CustomerDetailPage'
import { SeasonReturnPage } from './pages/SeasonReturnPage'
import { TransfersPage } from './pages/TransfersPage'
import { SetupPage } from './pages/SetupPage'

export function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/customer/:customerId" element={<CustomerDetailPage />} />
        <Route path="/season-return" element={<SeasonReturnPage />} />
        <Route path="/season-return/:customerId" element={<SeasonReturnPage />} />
        <Route path="/transfers" element={<TransfersPage />} />
        <Route path="/setup" element={<SetupPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  )
}
