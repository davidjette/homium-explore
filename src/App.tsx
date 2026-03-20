import { Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { LandingNav, ToolNav, Footer } from './design-system/Layout'
import { useAuthContext } from './components/shared/AuthProvider'
import ProfileSetupModal from './components/shared/ProfileSetupModal'
import Landing from './pages/Landing'
import Explorer from './pages/Explorer'
import Studio from './pages/Studio'
import Program from './pages/Program'
import Dashboard from './pages/Dashboard'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuthContext()

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <p className="font-body text-lightGray">Loading...</p>
    </div>
  )

  if (!isAuthenticated) return <Navigate to="/" replace />

  return <>{children}</>
}

export default function App() {
  const { pathname } = useLocation()
  const isLanding = pathname === '/'
  const { needsProfile, isAuthenticated, loading } = useAuthContext()

  return (
    <div className="min-h-screen flex flex-col">
      {isLanding ? <LandingNav /> : <ToolNav />}
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/explore" element={<Explorer />} />
          <Route path="/design" element={
            <RequireAuth><Studio /></RequireAuth>
          } />
          <Route path="/program" element={
            <RequireAuth><Program /></RequireAuth>
          } />
          <Route path="/dashboard" element={
            <RequireAuth><Dashboard /></RequireAuth>
          } />
        </Routes>
      </main>
      <Footer />

      {/* Profile setup modal — shown after first OAuth sign-in */}
      {!loading && isAuthenticated && needsProfile && <ProfileSetupModal />}
    </div>
  )
}
