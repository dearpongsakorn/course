import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { BookOpen, ChevronDown, Fingerprint, LogOut, Menu, Moon, ShoppingCart, Sun, UserRound, X } from 'lucide-react'
import { api, authStorage, cartStorage, type AuthSession } from '../services/api'

const publicNavItems = [
  { to: '/', label: 'หน้าแรก' },
  { to: '/courses', label: 'คอร์ส' },
]

const courseNavItem = publicNavItems[1]
const aboutNavItem = { to: '/#about', label: 'เกี่ยวกับ' }
const contactNavItem = { to: '/contact', label: 'ติดต่อเรา' }

const navItemClass = (isActive: boolean) =>
  [
    'rounded-md px-3 py-2 text-sm font-medium transition',
    isActive
      ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white',
  ].join(' ')

const logoutButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-md bg-rose-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-rose-800 focus:outline-none focus:ring-2 focus:ring-rose-700 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60'

type ThemeMode = 'light' | 'dark'
const themeStorageKey = 'learnos_theme'

const getInitialTheme = (): ThemeMode => {
  const savedTheme = localStorage.getItem(themeStorageKey)

  if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'

  return 'light'
}

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
    <span className={`${className} inline-flex items-center justify-center rounded-md bg-slate-950 text-white dark:bg-white dark:text-slate-950`}>
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
  const [cartCount, setCartCount] = useState(() => cartStorage.getItems().length)
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme())
  const currentPath = `${location.pathname}${location.search}`
  const currentLocation = `${location.pathname}${location.search}${location.hash}`
  const publicAboutActive = location.pathname === '/contact' || location.hash === '#about'
  const isNavItemActive = (to: string) => {
    if (to === '/') return location.pathname === '/' && !location.hash
    return currentPath === to
  }

  useEffect(() => authStorage.subscribe(() => setSession(authStorage.getSession())), [])
  useEffect(() => cartStorage.subscribe(() => setCartCount(cartStorage.getItems().length)), [])

  useEffect(() => {
    queueMicrotask(() => {
      setOpen(false)
    })
  }, [location.pathname])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem(themeStorageKey, theme)
  }, [theme])

  const dashboardPath = useMemo(() => {
    if (!session) return '/login'
    if (session.user.role === 'teacher') return '/teacher'
    if (session.user.role === 'admin') return '/admin'
    return '/student'
  }, [session])

  const navItems = useMemo(() => {
    if (!session) return publicNavItems

    if (session.user.role === 'student') {
      return [
        { to: '/student', label: 'คอร์สของฉัน' },
        { to: '/student?section=profile', label: 'โปรไฟล์' },
      ]
    }

    if (session.user.role === 'teacher') {
      return [
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

  const toggleTheme = () => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }

  const ThemeIcon = theme === 'dark' ? Sun : Moon

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 shadow-sm shadow-slate-200/60 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-slate-950">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-slate-950 text-white shadow-sm shadow-slate-950/15 dark:bg-white dark:text-slate-950 dark:shadow-white/10">
            <BookOpen size={19} />
          </span>
          <span className="text-lg font-semibold">LearnOS</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <Link key={item.to} to={item.to} className={navItemClass(isNavItemActive(item.to))}>
              {item.label}
            </Link>
          ))}
          {!session ? (
            <div className="group relative">
              <Link
                to={aboutNavItem.to}
                className={`${navItemClass(publicAboutActive)} inline-flex items-center gap-1`}
              >
                {aboutNavItem.label}
                <ChevronDown size={15} className="transition group-hover:rotate-180" />
              </Link>
              <div className="absolute left-0 top-full hidden min-w-44 pt-2 group-hover:block group-focus-within:block">
                <div className="rounded-lg border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-200/80 dark:border-white/10 dark:bg-slate-900 dark:shadow-black/40">
                  <Link
                    to={contactNavItem.to}
                    className="block rounded-md px-3 py-2.5 text-sm transition hover:bg-slate-100 dark:hover:bg-white/10"
                  >
                    <span className="block font-semibold text-slate-950 dark:text-white">{contactNavItem.label}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-slate-500 dark:text-slate-400">
                      ส่งข้อความถึงทีมงาน LearnOS
                    </span>
                  </Link>
                </div>
              </div>
            </div>
          ) : null}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <button
            type="button"
            className="group inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-800 shadow-sm shadow-slate-200/60 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-950 dark:border-white/15 dark:bg-slate-900 dark:text-slate-100 dark:shadow-black/30 dark:hover:bg-white dark:hover:text-slate-950"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'เปลี่ยนเป็นโหมดสว่าง' : 'เปลี่ยนเป็นโหมดมืด'}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            <ThemeIcon size={17} className="transition group-hover:scale-110" />
          </button>
          {session ? (
            <>
              <Link
                to={dashboardPath}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 text-sm font-medium text-slate-800 shadow-sm shadow-slate-200/60 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-950"
                aria-label="ไปยังแดชบอร์ด"
              >
                <UserAvatar session={session} />
                <span className="max-w-36 truncate">{session.user.name}</span>
              </Link>
              {session.user.role === 'student' ? (
                <Link
                  to="/cart"
                  state={{ from: currentLocation }}
                  className="relative inline-flex h-10 w-10 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm shadow-emerald-100 transition hover:bg-emerald-100"
                  aria-label="ตะกร้าคอร์ส"
                >
                  <ShoppingCart size={18} />
                  {cartCount > 0 ? (
                    <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[11px] font-semibold text-white">
                      {cartCount}
                    </span>
                  ) : null}
                </Link>
              ) : null}
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
            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 rounded-md border border-slate-200 bg-white p-3 text-sm font-medium text-slate-800 transition hover:bg-slate-100 dark:border-white/15 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-white dark:hover:text-slate-950"
              onClick={toggleTheme}
            >
              <ThemeIcon size={17} />
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </button>
            {navItems.map((item) => (
              <Link key={item.to} to={item.to} className={navItemClass(isNavItemActive(item.to))}>
                {item.label}
              </Link>
            ))}
            {!session ? (
              <div className="grid gap-2 rounded-lg border border-slate-200 p-2 dark:border-white/10">
                <Link to={aboutNavItem.to} className={navItemClass(publicAboutActive)}>
                  {aboutNavItem.label}
                </Link>
                <Link
                  to={contactNavItem.to}
                  className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  {contactNavItem.label}
                </Link>
              </div>
            ) : null}

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
                {session.user.role === 'student' ? (
                  <Link
                    to="/cart"
                    state={{ from: currentLocation }}
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
                ) : null}
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
