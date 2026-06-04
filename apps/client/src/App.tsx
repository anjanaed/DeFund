import './App.css'
import './AppPages.css'
import './ModalAndProject.css'
import './DashboardTabs.css'
import './Wallet.css'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { config } from './config/wagmi'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/common/ProtectedRoute'
import LandingPage from './pages/LandingPage'
import HomePage from './pages/HomePage'
import ExplorePage from './pages/ExplorePage'
import DashboardPage from './pages/DashboardPage'
import CreatorStudioPage from './pages/CreatorStudioPage'
import ProjectDetailPage from './pages/ProjectDetailPage'
import AdminLayout from './layouts/AdminLayout'
import AdminLoginPage from './pages/admin/AdminLoginPage'
import AdminDashboardPage from './pages/admin/AdminDashboardPage'
import AdminVerificationPage from './pages/admin/AdminVerificationPage'
import AdminRiskPage from './pages/admin/AdminRiskPage'
import AdminMilestonePage from './pages/admin/AdminMilestonePage'
import AdminProjectReviewPage from './pages/admin/AdminProjectReviewPage'
import AdminRiskDetailsPage from './pages/admin/AdminRiskDetailsPage'
import AdminMilestoneDetailsPage from './pages/admin/AdminMilestoneDetailsPage'
import AdminRefundProposalsPage from './pages/admin/AdminRefundProposalsPage'
import AdminUsersPage from './pages/admin/AdminUsersPage'
import AdminGovernancePage from './pages/admin/AdminGovernancePage'
import { Toaster } from 'sonner'

const queryClient = new QueryClient()

function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Router>
            <Toaster position="top-right" richColors closeButton />
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/home" element={<HomePage />} />
              <Route path="/explore" element={<ExplorePage />} />
              <Route path="/project/:id" element={<ProjectDetailPage />} />

              {/* Protected user routes */}
              <Route element={<ProtectedRoute />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/creator-studio" element={<CreatorStudioPage />} />
              </Route>

              {/* Admin login — public */}
              <Route path="/admin/login" element={<AdminLoginPage />} />

              {/* Protected admin routes */}
              <Route element={<ProtectedRoute requireAdmin />}>
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<Navigate to="dashboard" replace />} />
                  <Route path="dashboard" element={<AdminDashboardPage />} />
                  <Route path="verification" element={<AdminVerificationPage />} />
                  <Route path="verification/:id" element={<AdminProjectReviewPage />} />
                  <Route path="risk" element={<AdminRiskPage />} />
                  <Route path="risk/:id" element={<AdminRiskDetailsPage />} />
                  <Route path="milestones" element={<AdminMilestonePage />} />
                  <Route path="milestones/:id" element={<AdminMilestoneDetailsPage />} />
                  <Route path="refund-proposals" element={<AdminRefundProposalsPage />} />
                  <Route path="users" element={<AdminUsersPage />} />
                  <Route path="governance" element={<AdminGovernancePage />} />
                </Route>
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Router>
        </AuthProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}

export default App
