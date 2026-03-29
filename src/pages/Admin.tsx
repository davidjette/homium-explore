/**
 * Admin — Homium SSO User Management
 *
 * Tabs: Users | Audit Log
 * Features: search, role filter, create user, inline role editing,
 *           per-user actions (reset password, confirm email, delete),
 *           last sign-in + confirmation status columns, audit log viewer.
 */
import { useState, useEffect, useCallback } from 'react'
import { Container } from '../design-system/Layout'
import { H1, H3, Body, Label } from '../design-system/Typography'
import { Button } from '../design-system/Button'
import { useAuthContext } from '../components/shared/AuthProvider'
import { useAdminUsers, useAuditLog, type AdminUser, type AuditLogEntry } from '../hooks/useAdminUsers'

type Tab = 'users' | 'audit'

export default function Admin() {
  const [tab, setTab] = useState<Tab>('users')

  return (
    <>
      <section className="bg-white pt-16 pb-0 border-b border-border">
        <Container>
          <Label className="text-green mb-3 block">Admin</Label>
          <H1>Homium SSO</H1>
          <Body className="mt-2 text-lightGray mb-6">
            Central user management across all Homium applications
          </Body>
          <div className="flex gap-0 -mb-px">
            <TabButton active={tab === 'users'} onClick={() => setTab('users')}>Users</TabButton>
            <TabButton active={tab === 'audit'} onClick={() => setTab('audit')}>Audit Log</TabButton>
          </div>
        </Container>
      </section>

      {tab === 'users' ? <UsersTab /> : <AuditLogTab />}
    </>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-3 font-body text-sm font-medium border-b-2 transition-colors cursor-pointer ${
        active
          ? 'border-green text-green'
          : 'border-transparent text-lightGray hover:text-dark hover:border-border'
      }`}
    >
      {children}
    </button>
  )
}

// ─── Users Tab ───────────────────────────────────────────────────────

function UsersTab() {
  const { profile } = useAuthContext()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [page, setPage] = useState(1)
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const {
    users, total, totalPages, loading, error, refetch,
    updateRole, createUser, resetPassword, confirmEmail, deleteUser,
  } = useAdminUsers({ search: debouncedSearch, role: roleFilter, page })

  const handleRoleChange = useCallback(async (userId: string, newRole: string) => {
    if (userId === profile?.id && newRole !== 'admin') {
      alert('You cannot remove your own admin role.')
      return
    }
    await updateRole(userId, newRole)
  }, [profile?.id, updateRole])

  return (
    <section className="py-8">
      <Container>
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 px-4 py-2.5 border border-border rounded-lg font-body text-sm text-dark placeholder:text-lightGray focus:outline-none focus:ring-2 focus:ring-green/30 focus:border-green"
          />
          <select
            value={roleFilter}
            onChange={e => { setRoleFilter(e.target.value); setPage(1) }}
            className="px-4 py-2.5 border border-border rounded-lg font-body text-sm text-dark bg-white focus:outline-none focus:ring-2 focus:ring-green/30 focus:border-green"
          >
            <option value="">All Roles</option>
            <option value="admin">Admin</option>
            <option value="team">Team</option>
            <option value="registered">Registered</option>
          </select>
          <Button onClick={() => setShowCreateModal(true)}>
            + Create User
          </Button>
        </div>

        <Body className="text-lightGray text-xs mb-4">{total} user{total !== 1 ? 's' : ''}</Body>

        {/* Table */}
        {loading ? (
          <div className="text-center py-12">
            <Body className="text-lightGray">Loading users...</Body>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <Body className="text-red-600">{error}</Body>
            <Button variant="outline" className="mt-4" onClick={refetch}>Retry</Button>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12">
            <Body className="text-lightGray">No users found.</Body>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <Th>User</Th>
                    <Th>Role</Th>
                    <Th>Status</Th>
                    <Th>Last Sign In</Th>
                    <Th>Joined</Th>
                    <Th className="text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user: AdminUser) => (
                    <UserRow
                      key={user.id}
                      user={user}
                      isSelf={user.id === profile?.id}
                      onRoleChange={handleRoleChange}
                      onResetPassword={resetPassword}
                      onConfirmEmail={confirmEmail}
                      onDelete={deleteUser}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  Previous
                </Button>
                <span className="font-body text-sm text-lightGray px-4">
                  Page {page} of {totalPages}
                </span>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                  Next
                </Button>
              </div>
            )}
          </>
        )}

        {showCreateModal && (
          <CreateUserModal
            onCreate={createUser}
            onClose={() => setShowCreateModal(false)}
          />
        )}
      </Container>
    </section>
  )
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`text-left py-3 px-4 font-body text-xs font-bold uppercase tracking-wider text-lightGray ${className}`}>
      {children}
    </th>
  )
}

// ─── User Row ────────────────────────────────────────────────────────

function UserRow({ user, isSelf, onRoleChange, onResetPassword, onConfirmEmail, onDelete }: {
  user: AdminUser
  isSelf: boolean
  onRoleChange: (userId: string, role: string) => void
  onResetPassword: (userId: string, email: string) => Promise<void>
  onConfirmEmail: (userId: string) => Promise<void>
  onDelete: (userId: string) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [actionMsg, setActionMsg] = useState('')

  const initials = (user.name || user.email)
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const isConfirmed = !!user.email_confirmed_at

  const handleAction = async (action: string) => {
    setMenuOpen(false)
    try {
      if (action === 'reset-password') {
        await onResetPassword(user.id, user.email)
        setActionMsg('Reset email sent')
      } else if (action === 'confirm') {
        await onConfirmEmail(user.id)
        setActionMsg('Email confirmed')
      } else if (action === 'delete') {
        if (confirm(`Delete ${user.email}? This removes them from all Homium apps.`)) {
          onDelete(user.id)
        }
      }
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : 'Action failed')
    }
    if (action !== 'delete') {
      setTimeout(() => setActionMsg(''), 3000)
    }
  }

  return (
    <tr className="border-b border-border/50 hover:bg-sectionAlt/50 transition-colors">
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          {user.avatar_url ? (
            <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-green text-white flex items-center justify-center font-body text-xs font-bold">
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-body text-sm font-medium text-dark truncate">
              {user.name || 'No name'}
              {isSelf && <span className="text-lightGray ml-1">(you)</span>}
            </p>
            <p className="font-body text-xs text-lightGray truncate">{user.email}</p>
            {user.providers && user.providers.length > 0 && (
              <p className="font-body text-[10px] text-lightGray/70 truncate">
                {user.providers.join(', ')}
              </p>
            )}
          </div>
        </div>
      </td>
      <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
        <select
          value={user.role_type}
          onChange={e => onRoleChange(user.id, e.target.value)}
          disabled={isSelf}
          className={`px-2 py-1 border border-border rounded font-body text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green/30 ${
            isSelf ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
          }`}
        >
          <option value="registered">Registered</option>
          <option value="team">Team</option>
          <option value="admin">Admin</option>
        </select>
      </td>
      <td className="py-3 px-4">
        <span className={`inline-flex items-center gap-1 font-body text-xs px-2 py-0.5 rounded-full ${
          isConfirmed ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isConfirmed ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          {isConfirmed ? 'Confirmed' : 'Pending'}
        </span>
      </td>
      <td className="py-3 px-4">
        <span className="font-body text-sm text-lightGray">
          {user.last_sign_in_at ? formatRelative(user.last_sign_in_at) : 'Never'}
        </span>
      </td>
      <td className="py-3 px-4">
        <span className="font-body text-sm text-lightGray">
          {new Date(user.created_at).toLocaleDateString()}
        </span>
      </td>
      <td className="py-3 px-4 text-right relative">
        {actionMsg ? (
          <span className="font-body text-xs text-green">{actionMsg}</span>
        ) : (
          <div className="relative inline-block">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="font-body text-xs text-lightGray hover:text-dark px-2 py-1 rounded hover:bg-sectionAlt cursor-pointer"
            >
              ...
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-border rounded-lg shadow-lg py-1 min-w-[180px]">
                  <MenuButton onClick={() => handleAction('reset-password')}>
                    Reset Password
                  </MenuButton>
                  {!isConfirmed && (
                    <MenuButton onClick={() => handleAction('confirm')}>
                      Confirm Email
                    </MenuButton>
                  )}
                  {!isSelf && (
                    <MenuButton onClick={() => handleAction('delete')} danger>
                      Delete User
                    </MenuButton>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </td>
    </tr>
  )
}

function MenuButton({ onClick, children, danger = false }: {
  onClick: () => void; children: React.ReactNode; danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`block w-full text-left px-4 py-2 font-body text-sm cursor-pointer ${
        danger ? 'text-red-600 hover:bg-red-50' : 'text-dark hover:bg-sectionAlt'
      }`}
    >
      {children}
    </button>
  )
}

// ─── Create User Modal ───────────────────────────────────────────────

function CreateUserModal({ onCreate, onClose }: {
  onCreate: (opts: { email: string; password?: string; role_type?: string; send_confirmation?: boolean }) => Promise<any>
  onClose: () => void
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [roleType, setRoleType] = useState('registered')
  const [sendConfirmation, setSendConfirmation] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    setSaving(true)
    setError('')
    try {
      await onCreate({
        email,
        password: password || undefined,
        role_type: roleType,
        send_confirmation: sendConfirmation,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6"
        onClick={e => e.stopPropagation()}
      >
        <H3 className="mb-4">Create User</H3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block font-body text-xs font-bold uppercase tracking-wider text-lightGray mb-1">
              Email *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg font-body text-sm focus:outline-none focus:ring-2 focus:ring-green/30 focus:border-green"
              placeholder="user@example.com"
            />
          </div>

          <div>
            <label className="block font-body text-xs font-bold uppercase tracking-wider text-lightGray mb-1">
              Password (optional)
            </label>
            <input
              type="text"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg font-body text-sm focus:outline-none focus:ring-2 focus:ring-green/30 focus:border-green"
              placeholder="Leave blank to require email setup"
            />
          </div>

          <div>
            <label className="block font-body text-xs font-bold uppercase tracking-wider text-lightGray mb-1">
              Role
            </label>
            <select
              value={roleType}
              onChange={e => setRoleType(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg font-body text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green/30 focus:border-green"
            >
              <option value="registered">Registered</option>
              <option value="team">Team</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={sendConfirmation}
              onChange={e => setSendConfirmation(e.target.checked)}
              className="rounded border-border text-green focus:ring-green/30"
            />
            <span className="font-body text-sm text-dark">Send confirmation email</span>
          </label>

          {error && (
            <p className="font-body text-sm text-red-600">{error}</p>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving || !email}>
              {saving ? 'Creating...' : 'Create User'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Audit Log Tab ───────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  login: 'Sign In',
  logout: 'Sign Out',
  user_signedup: 'Sign Up',
  user_invited: 'Invited',
  user_deleted: 'Deleted',
  token_refreshed: 'Token Refresh',
  user_recovery_requested: 'Password Reset',
  user_updated: 'Profile Updated',
}

function AuditLogTab() {
  const { entries, loading, error, fetchLog } = useAuditLog()
  const [actionFilter, setActionFilter] = useState('')

  useEffect(() => {
    fetchLog({ action: actionFilter || undefined, limit: 100 })
  }, [fetchLog, actionFilter])

  return (
    <section className="py-8">
      <Container>
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <select
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
            className="px-4 py-2.5 border border-border rounded-lg font-body text-sm text-dark bg-white focus:outline-none focus:ring-2 focus:ring-green/30 focus:border-green"
          >
            <option value="">All Events</option>
            <option value="login">Sign In</option>
            <option value="logout">Sign Out</option>
            <option value="user_signedup">Sign Up</option>
            <option value="user_recovery_requested">Password Reset</option>
            <option value="token_refreshed">Token Refresh</option>
          </select>
          <Button variant="outline" onClick={() => fetchLog({ action: actionFilter || undefined, limit: 100 })}>
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <Body className="text-lightGray">Loading audit log...</Body>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <Body className="text-red-600">{error}</Body>
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12">
            <Body className="text-lightGray">No audit events found.</Body>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <Th>Time</Th>
                  <Th>Event</Th>
                  <Th>User</Th>
                  <Th>IP Address</Th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry: AuditLogEntry) => (
                  <tr key={entry.id} className="border-b border-border/50 hover:bg-sectionAlt/50 transition-colors">
                    <td className="py-2.5 px-4">
                      <span className="font-body text-sm text-dark">
                        {new Date(entry.created_at).toLocaleString()}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="font-body text-sm text-dark">
                        {ACTION_LABELS[entry.payload?.action || ''] || entry.payload?.action || 'Unknown'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="font-body text-sm text-lightGray">
                        {entry.payload?.actor_username || entry.payload?.actor_id?.slice(0, 8) || '—'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="font-body text-sm text-lightGray font-mono">
                        {entry.ip_address || '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Container>
    </section>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────

function formatRelative(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}
