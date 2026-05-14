import { Link, useNavigate } from 'react-router-dom'
import {
  Heart,
  Home,
  LibraryBig,
  LogIn,
  LogOut,
  Mail,
  Settings,
  Trophy,
  UserRound,
  Video,
  X,
} from 'lucide-react'
import { api, authStorage } from '../services/api'

type SidebarKey =
  | 'home'
  | 'all-courses'
  | 'my-courses'
  | 'certificates'
  | 'wishlist'
  | 'messages'
  | 'settings'

interface LearnProSidebarProps {
  active: SidebarKey
  profileName?: string
  profileAvatarUrl?: string
  profileLabel?: string
  className?: string
  mobileOpen?: boolean
  onMobileClose?: () => void
}

export default function LearnProSidebar({
  active,
  profileName,
  profileAvatarUrl,
  profileLabel,
  className = '',
  mobileOpen = false,
  onMobileClose,
}: LearnProSidebarProps) {
  const navigate = useNavigate()
  const session = authStorage.getSession()
  const role = session?.user.role
  const dashboardPath = session?.dashboardPath ?? '/courses'
  const settingsPath =
    role === 'student' ? '/student?section=settings' : role === 'teacher' ? '/teacher?section=profile' : '/login'
  const studentPath = role === 'student' ? '/student' : '/login'
  const myCoursesPath = role === 'student' ? '/student?section=my-courses' : role === 'teacher' ? '/teacher' : '/login'
  const certificatesPath = role === 'student' ? '/student/certificates' : studentPath
  const wishlistPath = role === 'student' ? '/student/wishlist' : studentPath
  const displayName = profileName ?? session?.user.name ?? 'ผู้เยี่ยมชม'
  const avatarUrl = profileAvatarUrl ?? session?.user.avatarUrl

  const navItems = [
    { key: 'home', to: dashboardPath, label: 'หน้าหลัก', icon: Home },
    { key: 'my-courses', to: myCoursesPath, label: 'คอร์สของฉัน', icon: Video },
    { key: 'all-courses', to: '/courses', label: 'ค้นหาคอร์ส', icon: LibraryBig },
    { key: 'certificates', to: certificatesPath, label: 'ใบประกาศนียบัตร', icon: Trophy },
    { key: 'wishlist', to: wishlistPath, label: 'รายการโปรด', icon: Heart },
    { key: 'messages', to: studentPath, label: 'ข้อความ', icon: Mail },
    { key: 'settings', to: settingsPath, label: 'การตั้งค่า', icon: Settings },
  ] as const

  const handleLogout = async () => {
    if (!session) {
      navigate('/login')
      return
    }

    try {
      await api.logout()
    } catch {
      // Keep local state aligned even if the server session has already expired.
    } finally {
      authStorage.clearSession()
      onMobileClose?.()
      navigate('/')
    }
  }

  return (
    <>
      <div
        className={[
          'fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 ease-out lg:hidden',
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        ].join(' ')}
        onClick={onMobileClose}
      />
      <aside
        className={[
          'fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col bg-black text-white transition-transform duration-300 ease-out lg:z-40 lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          className,
        ].join(' ')}
      >
        <div className="flex h-20 items-center justify-between px-8">
          <Link to={dashboardPath} className="flex items-center gap-3" onClick={onMobileClose}>
            <span className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white text-black">
              <img src="/my-course-logo.png" alt="My Course" className="h-full w-full object-cover" />
            </span>
            <span className="text-xl font-semibold tracking-tight">My Course</span>
          </Link>
          <button type="button" className="rounded-md p-2 text-white/70 lg:hidden" onClick={onMobileClose} aria-label="ปิดเมนู">
            <X size={20} />
          </button>
        </div>

        <nav className="student-sidebar-nav space-y-2 px-5">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = active === item.key

            return (
              <Link
                key={item.key}
                to={item.to}
                onClick={onMobileClose}
                className={[
                  'flex items-center gap-4 rounded-lg px-4 py-3 text-sm font-medium transition duration-200 ease-out',
                  isActive ? 'bg-white/12 text-white shadow-inner shadow-white/5' : 'text-white/78 hover:bg-white/8 hover:text-white',
                ].join(' ')}
              >
                <Icon size={19} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="mt-auto px-7 pb-7">
          <div className="border-t border-white/10 pt-5">
            <div className="flex items-center gap-3">
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} className="h-11 w-11 rounded-full object-cover" />
              ) : (
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-black">
                  <UserRound size={18} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{displayName}</p>
                <p className="truncate text-xs text-white/55">{profileLabel ?? session?.user.email ?? 'เลือกคอร์สที่สนใจ'}</p>
              </div>
              <button
                type="button"
                className="rounded-md p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
                onClick={handleLogout}
                aria-label={session ? 'ออกจากระบบ' : 'เข้าสู่ระบบ'}
              >
                {session ? <LogOut size={17} /> : <LogIn size={17} />}
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
