import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import LandingPage from './pages/landing'
import ScanPage from './pages/scan'
import ScanDemoPage from './pages/scan-demo'
import ScanLivePage from './pages/scan-live'
import ScanAgentPage from './pages/scan-agent'
import ReportPage from './pages/report'
import DashboardOverviewPage from './pages/dashboard/overview'
import DnsPage from './pages/dashboard/dns'
import TlsPage from './pages/dashboard/tls'
import SignInPage from './pages/auth/sign-in'
import SignUpPage from './pages/auth/sign-up'
import HistoryPage from './pages/history'
import HowItWorksPage from './pages/how-it-works'
import NotFoundPage from './pages/not-found'

function ScrollManager() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (hash) {
      const element = document.getElementById(hash.slice(1))
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return
      }
    }
    window.scrollTo({ top: 0, left: 0 })
  }, [pathname, hash])

  return null
}

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <ScrollManager />
      <Navbar />
      <main id="main" className="flex-1">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/scan" element={<ScanPage />} />
          <Route path="/scan/demo" element={<ScanDemoPage />} />
          <Route path="/scan/live" element={<ScanLivePage />} />
          <Route path="/scan/agent" element={<ScanAgentPage />} />
          <Route path="/reports/demo" element={<ReportPage />} />
          <Route path="/reports/:scanId" element={<ReportPage />} />
          <Route path="/dashboard" element={<DashboardOverviewPage />} />
          <Route path="/dashboard/dns" element={<DnsPage />} />
          <Route path="/dashboard/tls" element={<TlsPage />} />
          <Route path="/sign-in" element={<SignInPage />} />
          <Route path="/sign-up" element={<SignUpPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/how-it-works" element={<HowItWorksPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}
