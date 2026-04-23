import { Routes, Route, useLocation } from 'react-router-dom'
import { LandingNav, ToolNav, PublicNav, Footer, Container } from './design-system/Layout'
import { useAuthContext } from './components/shared/AuthProvider'
import { H2, Body } from './design-system/Typography'
import ProfileSetupModal from './components/shared/ProfileSetupModal'
import SignInModal from './components/shared/SignInModal'
import Landing from './pages/Landing'
import Explorer from './pages/Explorer'
import Studio from './pages/Studio'
import Program from './pages/Program'
import Dashboard from './pages/Dashboard'
import Admin from './pages/Admin'
import Programs from './pages/Programs'
import CheckAddress, { UDF_CONFIG, THHI_CONFIG } from './pages/tools/CheckAddress'
import CheckAddressIndex from './pages/public/CheckAddressIndex'

function RequireActive({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isActive, loading, signOut } = useAuthContext()

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
          <SignInModal />
        </div>
      </Container>
    </div>
  )

  if (!isActive) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Container>
        <div className="max-w-md mx-auto text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-amber-50 flex items-center justify-center">
            <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <img src={import.meta.env.BASE_URL + 'homium-wordmark.svg'} alt="Homium" className="h-7 mx-auto mb-4" />
          <H2>Your account is under review</H2>
          <Body className="mt-3 text-lightGray">
            Thank you for registering! A Homium administrator will review your account shortly.
            You'll receive an email once your account has been approved.
          </Body>
          <Body className="mt-6 text-lightGray text-sm">
            In the meantime, you can still{' '}
            <a href="/explore" className="text-green hover:underline">explore programs</a>
            {' '}on the public page.
          </Body>
          <button
            onClick={() => signOut()}
            className="mt-6 font-body text-sm text-lightGray hover:text-dark underline cursor-pointer"
          >
            Sign out
          </button>
        </div>
      </Container>
    </div>
  )

  return <>{children}</>
}

function RequireTeam({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isTeam, loading } = useAuthContext()

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <p className="font-body text-lightGray">Loading...</p>
    </div>
  )

  if (!isAuthenticated) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Container>
        <div className="max-w-md mx-auto text-center">
          <H2>Sign in to continue</H2>
          <Body className="mt-3 mb-8 text-lightGray">Team access required.</Body>
          <SignInModal />
        </div>
      </Container>
    </div>
  )

  if (!isTeam) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Container>
        <div className="max-w-md mx-auto text-center">
          <H2>Access Denied</H2>
          <Body className="mt-3 text-lightGray">
            This page is available to Homium team members. Contact a Homium administrator for access.
          </Body>
        </div>
      </Container>
    </div>
  )

  return <>{children}</>
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAdmin, loading } = useAuthContext()

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <p className="font-body text-lightGray">Loading...</p>
    </div>
  )

  if (!isAuthenticated) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Container>
        <div className="max-w-md mx-auto text-center">
          <H2>Sign in to continue</H2>
          <Body className="mt-3 mb-8 text-lightGray">Admin access required.</Body>
          <SignInModal />
        </div>
      </Container>
    </div>
  )

  if (!isAdmin) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Container>
        <div className="max-w-md mx-auto text-center">
          <H2>Access Denied</H2>
          <Body className="mt-3 text-lightGray">
            You don't have permission to view this page. Contact a Homium administrator for access.
          </Body>
        </div>
      </Container>
    </div>
  )

  return <>{children}</>
}

export default function App() {
  const { pathname } = useLocation()
  const isLanding = pathname === '/'
  const isPublic = pathname.startsWith('/check-address')
  const { needsProfile, isAuthenticated, isActive, loading, signOut, profile } = useAuthContext()

  return (
    <div className="min-h-screen flex flex-col">
      {isLanding ? <LandingNav /> : isPublic ? <PublicNav /> : <ToolNav />}
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/check-address" element={<CheckAddressIndex />} />
          <Route path="/check-address/udf" element={<CheckAddress config={UDF_CONFIG} />} />
          <Route path="/check-address/thhi" element={<CheckAddress config={THHI_CONFIG} />} />
          <Route path="/explore" element={<Explorer />} />
          <Route path="/design" element={
            <RequireActive><Studio /></RequireActive>
          } />
          <Route path="/program" element={
            <RequireActive><Program /></RequireActive>
          } />
          <Route path="/dashboard" element={
            <RequireActive><Dashboard /></RequireActive>
          } />
          <Route path="/data" element={
            <RequireTeam><Programs /></RequireTeam>
          } />
          <Route path="/tools/check-address" element={
            <RequireTeam><CheckAddress config={UDF_CONFIG} /></RequireTeam>
          } />
          <Route path="/tools/check-address-thhi" element={
            <RequireTeam><CheckAddress config={THHI_CONFIG} /></RequireTeam>
          } />
          <Route path="/admin" element={
            <RequireAdmin><Admin /></RequireAdmin>
          } />
        </Routes>
      </main>
      <Footer />

      {/* Profile setup modal — shown after first OAuth sign-in */}
      {!loading && isAuthenticated && needsProfile && !isPublic && !isLanding && <ProfileSetupModal />}

      {/* Pending approval overlay — shown after profile setup for registered users */}
      {!loading && isAuthenticated && !needsProfile && profile && !isActive && !isPublic && !isLanding && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-dark/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-amber-50 flex items-center justify-center">
              <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <img src={import.meta.env.BASE_URL + 'homium-wordmark.svg'} alt="Homium" className="h-7 mx-auto mb-4" />
            <H2>Your account is under review</H2>
            <Body className="mt-3 text-lightGray">
              Thank you for registering! A Homium administrator will review your account shortly.
              You'll receive an email once your account has been approved.
            </Body>
            <button
              onClick={() => signOut()}
              className="mt-8 font-body text-sm text-lightGray hover:text-dark underline cursor-pointer"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
