import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import Sidebar from '../components/Sidebar'
import { authStorage } from '../services/api'
import type { AuthSession } from '../services/api'
import type { User } from '../types/user'
import type { UserRole } from '../types/user'

interface DashboardLayoutProps {
  role: Extract<UserRole, 'student' | 'teacher' | 'admin'>
}

export default function DashboardLayout({ role }: DashboardLayoutProps) {
  const location = useLocation()
  const [session, setSession] = useState<AuthSession | null>(() => authStorage.getSession())
  const user: User | null = session?.user ?? null
  const contentClass = 'container-page grid gap-6 py-6 lg:grid-cols-[260px_minmax(0,1fr)]'

  useEffect(() => {
    return authStorage.subscribe(() => {
      setSession(authStorage.getSession())
    })
  }, [])

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (session.user.role !== role) {
    return <Navigate to={session.dashboardPath} replace />
  }

  if (role === 'student' || role === 'teacher') {
    return (
      <div className="min-h-screen bg-white text-black">
        <Outlet />
      </div>
    )
  }

  return (
    <div className="app-shell">
      <Navbar />
      <div className={contentClass}>
        <Sidebar role={role} user={user} />
        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
