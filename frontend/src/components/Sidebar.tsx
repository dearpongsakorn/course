import { Link, useLocation } from 'react-router-dom'
import { BarChart3, BookOpenCheck, Library, Settings, ShieldCheck, UserRound, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { User, UserRole } from '../types/user'

interface SidebarItem {
  to: string
  label: string
  icon: LucideIcon
}

const itemsByRole: Record<Extract<UserRole, 'student' | 'teacher' | 'admin'>, SidebarItem[]> = {
  student: [
    { to: '/student', label: 'คอร์สของฉัน', icon: BookOpenCheck },
    { to: '/student?section=profile', label: 'โปรไฟล์', icon: UserRound },
  ],
  teacher: [
    { to: '/teacher', label: 'จัดการคอร์ส', icon: Library },
    { to: '/teacher?section=profile', label: 'โปรไฟล์', icon: UserRound },
  ],
  admin: [
    { to: '/admin', label: 'แดชบอร์ดระบบ', icon: BarChart3 },
    { to: '/admin?section=users', label: 'จัดการผู้ใช้', icon: Users },
    { to: '/admin?section=courses', label: 'จัดการคอร์ส', icon: Library },
  ],
}

const roleLabels = {
  student: 'ผู้เรียน',
  teacher: 'Teacher Studio',
  admin: 'Admin Console',
}

export default function Sidebar({
  role,
  user,
}: {
  role: Extract<UserRole, 'student' | 'teacher' | 'admin'>
  user?: User | null
}) {
  const location = useLocation()
  const currentPath = `${location.pathname}${location.search}`

  return (
    <aside className="card h-fit overflow-hidden">
      {role === 'student' ? (
        <Link
          to="/student?section=settings"
          className="flex items-center gap-3 border-b border-slate-200 p-4 transition hover:bg-slate-50 dark:hover:bg-white/5"
        >
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-slate-950 text-white dark:bg-white dark:text-slate-950">
            <Settings size={18} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-950">การตั้งค่า</p>
            <p className="truncate text-xs text-slate-500">จัดการบัญชีผู้เรียน</p>
          </div>
        </Link>
      ) : (
        <div className="border-b border-slate-200 p-4">
          <div className="flex items-center gap-3">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="h-11 w-11 rounded-md object-cover" />
            ) : (
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-slate-950 text-white dark:bg-white dark:text-slate-950">
                <ShieldCheck size={18} />
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-950">{user?.name ?? roleLabels[role]}</p>
              <p className="truncate text-xs text-slate-500">{user?.email ?? roleLabels[role]}</p>
            </div>
          </div>
        </div>
      )}

      <nav className="flex gap-2 overflow-x-auto p-3 lg:block lg:space-y-1">
        {itemsByRole[role].map((item) => {
          const Icon = item.icon
          const active = currentPath === item.to || (item.to === `/${role}` && location.pathname === item.to && !location.search)

          return (
            <Link
              key={`${item.to}-${item.label}`}
              to={item.to}
              className={[
                'flex min-w-max items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition lg:min-w-0',
                active
                  ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white',
              ].join(' ')}
            >
              <Icon size={17} />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
