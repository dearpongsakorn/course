import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { BookOpen, LogIn, LogOut, Menu, UserPlus, UserRound, X } from 'lucide-react'
import { api, authStorage, type AuthSession } from '../services/api'

const navItems = [
  { to: '/', label: 'หน้าแรก' },
  { to: '/courses', label: 'คอร์ส' },
]

const navClass = ({ isActive }: { isActive: boolean }) =>
  [
    'rounded-md px-3 py-2 text-sm font-medium transition',
    isActive
      ? 'bg-slate-950 text-white'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950',
  ].join(' ')

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

  useEffect(() => authStorage.subscribe(() => setSession(authStorage.getSession())), [])

  useEffect(() => {
    queueMicrotask(() => {
      setOpen(false)
    })
  }, [location.pathname])

  const dashboardPath = useMemo(() => {
    if (!session) return '/login'
    if (session.user.role === 'teacher') return '/teacher'
    if (session.user.role === 'admin') return '/admin'
    return '/student'
  }, [session])

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
            <NavLink key={item.to} to={item.to} className={navClass} end={item.to === '/'}>
              {item.label}
            </NavLink>
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
              <button type="button" className="btn-primary" onClick={handleLogout} disabled={loggingOut}>
                <LogOut size={16} />
                {loggingOut ? 'กำลังออกจากระบบ...' : 'ออกจากระบบ'}
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-secondary">
                <LogIn size={16} />
                เข้าสู่ระบบ
              </Link>
              <Link to="/register" className="btn-primary">
                <UserPlus size={16} />
                สมัครสมาชิก
              </Link>
            </>
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
              <NavLink key={item.to} to={item.to} className={navClass} end={item.to === '/'}>
                {item.label}
              </NavLink>
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
                <button type="button" className="btn-primary" onClick={handleLogout} disabled={loggingOut}>
                  <LogOut size={16} />
                  {loggingOut ? 'กำลังออกจากระบบ...' : 'ออกจากระบบ'}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Link to="/login" className="btn-secondary">
                  <LogIn size={16} />
                  เข้าสู่ระบบ
                </Link>
                <Link to="/register" className="btn-primary">
                  <UserPlus size={16} />
                  สมัครสมาชิก
                </Link>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </header>
  )
}
