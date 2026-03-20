/**
 * Dashboard — User's saved fund designs
 *
 * Lists fund_configs owned by the authenticated user.
 * Actions: view results, edit in wizard, delete.
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Container, Section } from '../design-system/Layout'
import { H1, H2, Body, Label } from '../design-system/Typography'
import { Card } from '../design-system/Card'
import { Button } from '../design-system/Button'
import { fmtDollar } from '../lib/api'
import { useAuthContext } from '../components/shared/AuthProvider'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

interface SavedFund {
  id: string
  name: string
  state?: string
  totalRaise: number
  scenarioCount: number
  createdAt: string
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { session } = useAuthContext()
  const [funds, setFunds] = useState<SavedFund[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    loadFunds()
  }, [session])

  const loadFunds = async () => {
    if (!session?.access_token) return

    setLoading(true)
    setError('')
    try {
      const resp = await fetch(`${API_BASE}/v2/funds/db?limit=50`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      })
      if (!resp.ok) throw new Error('Failed to load designs')
      const json = await resp.json()
      if (json.success) {
        setFunds(json.data.funds || [])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load designs')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (fundId: string) => {
    if (!session?.access_token) return
    if (!confirm('Delete this design? This cannot be undone.')) return

    setDeleting(fundId)
    try {
      const resp = await fetch(`${API_BASE}/v2/funds/db/${fundId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })
      if (resp.ok) {
        setFunds(prev => prev.filter(f => f.id !== fundId))
      }
    } catch {
      // Silently fail — fund might already be deleted
    } finally {
      setDeleting(null)
    }
  }

  return (
    <>
      <section className="bg-white pt-16 pb-12 border-b border-border">
        <Container>
          <Label className="text-green mb-3 block">Dashboard</Label>
          <H1>My Designs</H1>
          <Body className="mt-2 text-lightGray">
            Your saved homeownership program designs.
          </Body>
        </Container>
      </section>

      <Section>
        {loading ? (
          <div className="text-center py-12">
            <Body className="text-lightGray">Loading your designs...</Body>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <Body className="text-red-600">{error}</Body>
            <Button variant="outline" className="mt-4" onClick={loadFunds}>Retry</Button>
          </div>
        ) : funds.length === 0 ? (
          <div className="text-center py-12">
            <H2 className="mb-4">No designs yet</H2>
            <Body className="text-lightGray mb-6">
              Create your first homeownership program design to get started.
            </Body>
            <Button onClick={() => navigate('/design')}>
              Design a Program
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {funds.map(fund => (
              <Card key={fund.id} className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-heading text-lg text-dark truncate">{fund.name}</h3>
                    <div className="flex flex-wrap gap-4 mt-2 font-body text-sm text-lightGray">
                      {fund.state && <span>{fund.state}</span>}
                      <span>{fmtDollar(fund.totalRaise)} raise</span>
                      <span>{fund.scenarioCount} scenarios</span>
                      <span>Created {new Date(fund.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/design`)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(fund.id)}
                      disabled={deleting === fund.id}
                    >
                      {deleting === fund.id ? 'Deleting...' : 'Delete'}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Section>
    </>
  )
}
