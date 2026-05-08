import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { BookOpen, Fingerprint, LogOut, Menu, ShoppingCart, UserRound, X } from 'lucide-react'
import { api, authStorage, cartStorage, type AuthSession } from '../services/api'

const publicNavItems = [
  { to: '/', label: 'หน้าแรก' },
  { to: '/courses', label: 'คอร์ส' },
]

const courseNavItem = publicNavItems[1]

const navItemClass = (isActive: boolean) =>
  [
    'rounded-md px-3 py-2 text-sm font-medium transition',
    isActive
      ? 'bg-slate-950 text-white'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950',
  ].join(' ')

const logoutButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-md bg-rose-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-rose-800 focus:outline-none focus:ring-2 focus:ring-rose-700 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60'

function UserAvatar({ session, className = 'h-8 w-8' }: { session: AuthSession; className?: string }) {
  if (session.user.avatarUrl) {
    return (
      <img
        src={session.user.avatarUrl}
        alt={session.user.name}
        className={`${className} rounded-md object-cover ring-1 ring-slate-200`}
      />
    )
  }

  return (
    <span className={`${className} inline-flex items-center justify-center rounded-md bg-slate-950 text-white`}>
      <UserRound size={16} />
    </span>
  )
}

export default function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [session, setSession] = useState<AuthSession | null>(() => authStorage.getSession())
  const [loggingOut, setLoggingOut] = useState(false)
  const [studentHasCourses, setStudentHasCourses] = useState(false)
  const [cartCount, setCartCount] = useState(() => cartStorage.getItems().length)
  const currentPath = `${location.pathname}${location.search}`

  useEffect(() => authStorage.subscribe(() => setSession(authStorage.getSession())), [])
  useEffect(() => cartStorage.subscribe(() => setCartCount(cartStorage.getItems().length)), [])

  useEffect(() => {
    let active = true

    if (session?.user.role !== 'student') {
      setStudentHasCourses(false)
      return () => {
        active = false
      }
    }

    setStudentHasCourses(false)
    api
      .getStudentDashboard()
      .then((dashboard) => {
        if (active) setStudentHasCourses(dashboard.courses.length > 0)
      })
      .catch(() => {
        if (active) setStudentHasCourses(false)
      })

    return () => {
      active = false
    }
  }, [session?.token, session?.user.role])

  useEffect(() => {
    queueMicrotask(() => {
      setOpen(false)
    })
  }, [location.pathname])

  const dashboardPath = useMemo(() => {
    if (!session) return '/login'
    if (session.user.role === 'teacher') return '/teacher'
    if (session.user.role === 'admin') return '/admin'
    return studentHasCourses ? '/student' : '/courses'
  }, [session, studentHasCourses])

  const navItems = useMemo(() => {
    if (!session) return publicNavItems

    if (session.user.role === 'student') {
      if (!studentHasCourses) return [courseNavItem]

      return [
        courseNavItem,
        { to: '/student', label: 'คอร์สของฉัน' },
        { to: '/student?section=profile', label: 'โปรไฟล์' },
      ]
    }

    if (session.user.role === 'teacher') {
      return [
        courseNavItem,
        { to: '/teacher', label: 'จัดการคอร์ส' },
        { to: '/teacher?section=profile', label: 'โปรไฟล์' },
      ]
    }

    return [
      courseNavItem,
      { to: '/admin', label: 'แดชบอร์ดระบบ' },
      { to: '/admin?section=users', label: 'จัดการผู้ใช้' },
      { to: '/admin?section=courses', label: 'จัดการคอร์ส' },
    ]
  }, [session, studentHasCourses])

  const handleLogout = async () => {
    setLoggingOut(true)

    try {
      await api.logout()
    } catch {
      // Keep the local UI in sync even if the server session has already expired.
    } finally {
      authStorage.clearSession()
      setLoggingOut(false)
      navigate('/')
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-slate-950">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-slate-950 text-white">
            <BookOpen size={19} />
          </span>
          <span className="text-lg font-semibold">LearnOS</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <Link key={item.to} to={item.to} className={navItemClass(currentPath === item.to || (item.to === '/' && location.pathname === '/'))}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {session ? (
            <>
              <Link
                to={dashboardPath}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 text-sm font-medium text-slate-800 transition hover:bg-slate-100 hover:text-slate-950"
                aria-label="ไปยังแดชบอร์ด"
              >
                <UserAvatar session={session} />
                <span className="max-w-36 truncate">{session.user.name}</span>
              </Link>
              <Link
                to="/courses"
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-md border border-amber-200 bg-amber-50 text-amber-700 transition hover:bg-amber-100"
                aria-label="ตะกร้าคอร์ส"
              >
                <ShoppingCart size={18} />
                {cartCount > 0 ? (
                  <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[11px] font-semibold text-white">
                    {cartCount}
                  </span>
                ) : null}
              </Link>
              <button type="button" className={logoutButtonClass} onClick={handleLogout} disabled={loggingOut}>
                <LogOut size={16} />
                {loggingOut ? 'กำลังออกจากระบบ...' : 'ออกจากระบบ'}
              </button>
            </>
          ) : (
            <Link to="/login" className="btn-primary">
              <Fingerprint size={16} />
              เข้าสู่ระบบ
            </Link>
          )}
        </div>

        <button
          type="button"
          className="btn-ghost md:hidden"
          onClick={() => setOpen((value) => !value)}
          aria-label="เปิดเมนู"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-slate-200 bg-white md:hidden">
          <div className="container-page space-y-2 py-4">
            {navItems.map((item) => (
              <Link key={item.to} to={item.to} className={navItemClass(currentPath === item.to || (item.to === '/' && location.pathname === '/'))}>
                {item.label}
              </Link>
            ))}

            {session ? (
              <div className="grid gap-2 pt-2">
                <Link
                  to={dashboardPath}
                  className="flex items-center gap-3 rounded-md border border-slate-200 bg-white p-3 text-slate-900 transition hover:bg-slate-100"
                  aria-label="ไปยังแดชบอร์ด"
                >
                  <UserAvatar session={session} className="h-10 w-10" />
                  <span className="min-w-0 truncate text-sm font-semibold">{session.user.name}</span>
                </Link>
                <Link
                  to="/courses"
                  className="flex items-center justify-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-800 transition hover:bg-amber-100"
                  aria-label="ตะกร้าคอร์ส"
                >
                  <ShoppingCart size={17} className="text-amber-600" />
                  ตะกร้า
                  {cartCount > 0 ? (
                    <span className="rounded-full bg-rose-600 px-2 py-0.5 text-xs font-semibold text-white">
                      {cartCount}
                    </span>
                  ) : null}
                </Link>
                <button type="button" className={logoutButtonClass} onClick={handleLogout} disabled={loggingOut}>
                  <LogOut size={16} />
                  {loggingOut ? 'กำลังออกจากระบบ...' : 'ออกจากระบบ'}
                </button>
              </div>
            ) : (
              <div className="grid gap-2 pt-2">
                <Link to="/login" className="btn-primary">
                  <Fingerprint size={16} />
                  เข้าสู่ระบบ
                </Link>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </header>
  )
}
