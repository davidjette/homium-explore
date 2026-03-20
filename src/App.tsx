import { Routes, Route, useLocation } from 'react-router-dom'
import { LandingNav, ToolNav, Footer } from './design-system/Layout'
import { useAuthContext } from './components/shared/AuthProvider'
import { Button } from './design-system/Button'
import { H2, Body } from './design-system/Typography'
import { Container } from './design-system/Layout'
import ProfileSetupModal from './components/shared/ProfileSetupModal'
import Landing from './pages/Landing'
import Explorer from './pages/Explorer'
import Studio from './pages/Studio'
import Program from './pages/Program'
import Dashboard from './pages/Dashboard'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading, signInWithGoogle } = useAuthContext()

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <p className="font-body text-lightGray">Loading...</p>
    </div>
  )

  if (!isAuthenticated) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Container>
        <div className="max-w-md mx-auto text-center">
          <img src={import.meta.env.BASE_URL + 'homium-wordmark.svg'} alt="Homium" className="h-8 mx-auto mb-6" />
          <H2>Sign in to continue</H2>
          <Body className="mt-3 mb-8 text-lightGray">
            Create a free account to design homeownership programs, run fund models, and export reports.
          </Body>
          <Button onClick={signInWithGoogle}>
            Sign in with Google
          </Button>
        </div>
      </Container>
    </div>
  )

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
