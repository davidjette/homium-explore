import { Routes, Route, useLocation } from 'react-router-dom'
import { LandingNav, ToolNav, Footer } from './design-system/Layout'
import Landing from './pages/Landing'
import Explorer from './pages/Explorer'
import Studio from './pages/Studio'
import Program from './pages/Program'

export default function App() {
  const { pathname } = useLocation()
  const isLanding = pathname === '/'

  return (
    <div className="min-h-screen flex flex-col">
      {isLanding ? <LandingNav /> : <ToolNav />}
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/explore" element={<Explorer />} />
          <Route path="/design" element={<Studio />} />
          <Route path="/program" element={<Program />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}
