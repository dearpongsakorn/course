import { Outlet } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import Sidebar from '../components/Sidebar'
import { authStorage } from '../services/api'
import type { User } from '../types/user'
import type { UserRole } from '../types/user'

interface DashboardLayoutProps {
  role: Extract<UserRole, 'student' | 'teacher' | 'admin'>
}

export default function DashboardLayout({ role }: DashboardLayoutProps) {
  const [user, setUser] = useState<User | null>(() => authStorage.getSession()?.user ?? null)

  useEffect(() => {
    return authStorage.subscribe(() => {
      setUser(authStorage.getSession()?.user ?? null)
    })
  }, [])

  return (
    <div className="app-shell">
      <Navbar />
      <div className="container-page grid gap-6 py-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <Sidebar role={role} user={user} />
        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
