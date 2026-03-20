/**
 * Admin — User Management
 *
 * Lists all users with search, role filter, and inline role editing.
 * Requires admin role (enforced by RequireAdmin wrapper in App.tsx).
 */
import { useState, useEffect, useCallback } from 'react'
import { Container } from '../design-system/Layout'
import { H1, Body, Label } from '../design-system/Typography'
import { Button } from '../design-system/Button'
import { useAuthContext } from '../components/shared/AuthProvider'
import { useAdminUsers, type AdminUser } from '../hooks/useAdminUsers'

export default function Admin() {
  const { profile } = useAuthContext()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [page, setPage] = useState(1)
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const { users, total, totalPages, loading, error, refetch, updateRole } = useAdminUsers({
    search: debouncedSearch,
    role: roleFilter,
    page,
  })

  const handleRoleChange = useCallback(async (userId: string, newRole: string) => {
    if (userId === profile?.id && newRole !== 'admin') {
      alert('You cannot remove your own admin role.')
      return
    }
    await updateRole(userId, newRole)
  }, [profile?.id, updateRole])

  return (
    <>
      <section className="bg-white pt-16 pb-12 border-b border-border">
        <Container>
          <Label className="text-green mb-3 block">Admin</Label>
          <H1>User Management</H1>
          <Body className="mt-2 text-lightGray">
            {total} registered user{total !== 1 ? 's' : ''}
          </Body>
        </Container>
      </section>

      <section className="py-12">
        <Container>
          {/* Filters */}
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
              onChange={e => { setRoleFilter(e.target.value); setPage(1); }}
              className="px-4 py-2.5 border border-border rounded-lg font-body text-sm text-dark bg-white focus:outline-none focus:ring-2 focus:ring-green/30 focus:border-green"
            >
              <option value="">All Roles</option>
              <option value="admin">Admin</option>
              <option value="team">Team</option>
              <option value="registered">Registered</option>
            </select>
          </div>

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
                      <th className="text-left py-3 px-4 font-body text-xs font-bold uppercase tracking-wider text-lightGray">User</th>
                      <th className="text-left py-3 px-4 font-body text-xs font-bold uppercase tracking-wider text-lightGray">Organization</th>
                      <th className="text-left py-3 px-4 font-body text-xs font-bold uppercase tracking-wider text-lightGray">Role</th>
                      <th className="text-left py-3 px-4 font-body text-xs font-bold uppercase tracking-wider text-lightGray">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user: AdminUser) => (
                      <UserRow
                        key={user.id}
                        user={user}
                        isSelf={user.id === profile?.id}
                        onRoleChange={handleRoleChange}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-8">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    Previous
                  </Button>
                  <span className="font-body text-sm text-lightGray px-4">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </Container>
      </section>
    </>
  )
}

function UserRow({ user, isSelf, onRoleChange }: {
  user: AdminUser
  isSelf: boolean
  onRoleChange: (userId: string, role: string) => void
}) {
  const initials = (user.name || user.email)
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

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
          </div>
        </div>
      </td>
      <td className="py-3 px-4">
        <span className="font-body text-sm text-gray">{user.organization || '—'}</span>
      </td>
      <td className="py-3 px-4">
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
        <span className="font-body text-sm text-lightGray">
          {new Date(user.created_at).toLocaleDateString()}
        </span>
      </td>
    </tr>
  )
}
