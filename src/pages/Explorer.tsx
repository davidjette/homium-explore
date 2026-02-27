import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * /explore now redirects to the landing page's embedded affordability tool.
 * The tool lives at /#affordability on the main landing page.
 */
export default function Explorer() {
  const navigate = useNavigate()
  useEffect(() => {
    navigate('/', { replace: true })
    // After navigation, scroll to the tool section
    setTimeout(() => {
      document.getElementById('affordability')?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }, [navigate])
  return null
}
