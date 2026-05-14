import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  Check,
  ChevronDown,
  LoaderCircle,
  MoreVertical,
  Search,
  ShoppingBag,
  ShoppingCart,
  Star,
  Trash2,
  UsersRound,
  X,
} from 'lucide-react'
import LearnProSidebar from '../components/LearnProSidebar'
import { useApi } from '../hooks/useApi'
import { api, authStorage, cartStorage } from '../services/api'
import type { Course } from '../types/course'

const allOption = 'ทั้งหมด'
const categoryOptions = [allOption, 'Technology', 'Business', 'Design', 'Marketing', 'Data']
const levelOptions = [allOption, 'Beginner', 'Intermediate', 'Advanced']

type SortOption = 'popular' | 'rating' | 'price-low' | 'price-high'

const sortOptions: Array<{ value: SortOption; label: string }> = [
  { value: 'popular', label: 'ล่าสุด' },
  { value: 'rating', label: 'คะแนนสูง' },
  { value: 'price-low', label: 'ราคาต่ำสุด' },
  { value: 'price-high', label: 'ราคาสูงสุด' },
]

const statusMeta = {
  draft: { label: 'ร่าง', className: 'bg-white text-zinc-700' },
  published: { label: 'เผยแพร่แล้ว', className: 'bg-emerald-50 text-emerald-700' },
  hidden: { label: 'ซ่อนอยู่', className: 'bg-zinc-100 text-zinc-600' },
} satisfies Record<Course['status'], { label: string; className: string }>

const sortCourses = (items: Course[], sortBy: SortOption) => {
  const nextItems = [...items]

  if (sortBy === 'rating') return nextItems.sort((a, b) => b.rating - a.rating)
  if (sortBy === 'price-low') return nextItems.sort((a, b) => a.price - b.price)
  if (sortBy === 'price-high') return nextItems.sort((a, b) => b.price - a.price)

  return nextItems.sort((a, b) => {
    if (a.isPopular !== b.isPopular) return a.isPopular ? -1 : 1
    return b.students - a.students
  })
}

const formatPrice = (price: number) =>
  price === 0
    ? 'ฟรี'
    : new Intl.NumberFormat('th-TH', {
        style: 'currency',
        currency: 'THB',
        maximumFractionDigits: 0,
      }).format(price)

const coursePathFor = (course: Course) => `/courses/${course.slug}`
const learningPathFor = (course: Course) =>
  course.viewerState?.enrollment?.lastLessonId
    ? `/learn/${course.slug}?lesson=${course.viewerState.enrollment.lastLessonId}`
    : `/learn/${course.slug}`

function FilterCheckbox({
  label,
  count,
  checked,
  onClick,
}: {
  label: string
  count: number
  checked: boolean
  onClick: () => void
}) {
  return (
    <button type="button" className="flex w-full items-center gap-3 text-left text-sm text-zinc-700" onClick={onClick}>
      <span
        className={[
          'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px]',
          checked ? 'border-black bg-black text-white' : 'border-zinc-300 bg-white text-transparent',
        ].join(' ')}
      >
        ✓
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="text-xs text-zinc-500">{count}</span>
    </button>
  )
}

function CourseGridCard({
  course,
  inCart,
  onAddToCart,
}: {
  course: Course
  inCart: boolean
  onAddToCart: (slug: string) => void
}) {
  const meta = statusMeta[course.status] ?? statusMeta.published
  const isEnrolled = Boolean(course.viewerState?.isEnrolled)
  const canBuy = course.status === 'published' && !isEnrolled

  return (
    <article className="group overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-lg">
      <Link to={coursePathFor(course)} className="relative block aspect-[1.33] overflow-hidden bg-zinc-100">
        <img src={course.coverImage} alt={course.title} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/10" />
        <span className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-semibold shadow-sm ${meta.className}`}>
          {meta.label}
        </span>
        <button
          type="button"
          className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-white transition hover:bg-white/15"
          aria-label="ตัวเลือกคอร์ส"
        >
          <MoreVertical size={18} />
        </button>
      </Link>

      <div className="p-4">
        <Link to={coursePathFor(course)} className="line-clamp-2 min-h-11 text-sm font-semibold leading-6 text-black hover:underline">
          {course.title}
        </Link>

        <div className="mt-3 flex items-center gap-1 text-xs text-zinc-500">
          <UsersRound size={14} />
          <span>{course.students.toLocaleString('th-TH')} คนเรียน</span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          <span className="inline-flex items-center gap-1 text-amber-500">
            <Star size={14} className="fill-amber-400" />
            {course.rating.toFixed(1)}
          </span>
          <span>({Math.max(course.lessons.length, course.lessonCount ?? 0)})</span>
          <span>•</span>
          <span>{course.level}</span>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-900">{formatPrice(course.price)}</p>
          <BarChart3 size={17} className="text-zinc-500" />
        </div>

        <div className="mt-4">
          {isEnrolled ? (
            <Link
              to={learningPathFor(course)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-black px-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              เข้าเรียน
              <Check size={16} />
            </Link>
          ) : !canBuy ? (
            <button
              type="button"
              className="inline-flex h-10 w-full items-center justify-center rounded-md bg-zinc-100 px-3 text-sm font-semibold text-zinc-500"
              disabled
            >
              ยังไม่เปิดขาย
            </button>
          ) : null}

          <div className={isEnrolled || !canBuy ? 'mt-2 grid grid-cols-[1fr_auto] gap-2' : 'grid grid-cols-[1fr_auto] gap-2'}>
            <Link
              to={coursePathFor(course)}
              className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-200 px-3 text-sm font-semibold text-black transition hover:border-black"
            >
              ดูรายละเอียด
            </Link>
            <button
              type="button"
              className={[
                'inline-flex h-10 w-10 items-center justify-center rounded-md border text-sm font-semibold transition',
                !canBuy
                  ? 'cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400'
                  : inCart
                    ? 'border-zinc-200 bg-zinc-100 text-zinc-600 hover:border-black hover:text-black'
                    : 'border-zinc-200 bg-white text-black hover:border-black',
              ].join(' ')}
              disabled={!canBuy}
              onClick={() => onAddToCart(course.slug)}
              aria-label={inCart ? 'อยู่ในตะกร้าแล้ว' : 'เพิ่มลงตะกร้า'}
              title={inCart ? 'อยู่ในตะกร้าแล้ว' : 'เพิ่มลงตะกร้า'}
            >
              {inCart ? <Check size={17} /> : <ShoppingCart size={17} />}
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}

export default function Courses() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const session = authStorage.getSession()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState(allOption)
  const [selectedLevel, setSelectedLevel] = useState(allOption)
  const [sortBy, setSortBy] = useState<SortOption>('popular')
  const [cartItems, setCartItems] = useState(() => cartStorage.getItems())
  const [cartOpen, setCartOpen] = useState(() => searchParams.get('cart') === '1')
  const [cartError, setCartError] = useState<string | null>(null)
  const [cartMessage, setCartMessage] = useState<string | null>(null)
  const [checkoutSlug, setCheckoutSlug] = useState<string | null>(null)
  const [checkoutAll, setCheckoutAll] = useState(false)
  const deferredSearchTerm = useDeferredValue(searchTerm)
  const { data: courses, error: courseError, loading } = useApi(() => api.getCourses(), [])

  useEffect(() => cartStorage.subscribe(() => setCartItems(cartStorage.getItems())), [])

  useEffect(() => {
    if (searchParams.get('cart') === '1') setCartOpen(true)
  }, [searchParams])

  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const category of categoryOptions) map.set(category, category === allOption ? courses?.length ?? 0 : 0)
    for (const course of courses ?? []) map.set(course.category, (map.get(course.category) ?? 0) + 1)
    return map
  }, [courses])

  const levelCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const level of levelOptions) map.set(level, level === allOption ? courses?.length ?? 0 : 0)
    for (const course of courses ?? []) map.set(course.level, (map.get(course.level) ?? 0) + 1)
    return map
  }, [courses])

  const filteredCourses = useMemo(() => {
    const normalizedSearch = deferredSearchTerm.trim().toLowerCase()
    const filtered = (courses ?? []).filter((course) => {
      const matchesCategory = selectedCategory === allOption || course.category === selectedCategory
      const matchesLevel = selectedLevel === allOption || course.level === selectedLevel
      const matchesSearch =
        !normalizedSearch ||
        course.title.toLowerCase().includes(normalizedSearch) ||
        course.description.toLowerCase().includes(normalizedSearch) ||
        course.instructor.name.toLowerCase().includes(normalizedSearch)

      return matchesCategory && matchesLevel && matchesSearch
    })

    return sortCourses(filtered, sortBy)
  }, [courses, deferredSearchTerm, selectedCategory, selectedLevel, sortBy])

  const resetFilters = () => {
    setSearchTerm('')
    setSelectedCategory(allOption)
    setSelectedLevel(allOption)
    setSortBy('popular')
  }

  const handleAddToCart = (slug: string) => {
    setCartItems(cartStorage.addItem(slug))
    setCartOpen(true)
    setCartError(null)
    setCartMessage(null)
  }

  const closeCart = () => {
    setCartOpen(false)

    if (searchParams.get('cart') === '1') {
      const nextParams = new URLSearchParams(searchParams)
      nextParams.delete('cart')
      setSearchParams(nextParams, { replace: true })
    }
  }

  const removeCourse = (slug: string) => {
    setCartError(null)
    setCartMessage(null)
    setCartItems(cartStorage.removeItem(slug))
  }

  const clearCart = () => {
    setCartError(null)
    setCartMessage(null)
    setCartItems(cartStorage.clearItems())
  }

  const ensureStudentSession = () => {
    if (!session) {
      navigate('/login')
      return false
    }

    if (session.user.role !== 'student') {
      navigate(session.dashboardPath)
      return false
    }

    return true
  }

  const checkoutCourse = async (course: Course) => {
    if (!ensureStudentSession()) return

    setCheckoutSlug(course.slug)
    setCartError(null)
    setCartMessage(null)

    try {
      const result = await api.enrollCourse(course.slug)
      cartStorage.removeItem(course.slug)
      setCartItems(cartStorage.getItems())
      setCartMessage(`ลงทะเบียน "${course.title}" สำเร็จแล้ว กำลังพาไปหน้าเรียน...`)

      window.setTimeout(() => {
        navigate(
          result.enrollment.lastLessonId
            ? `/learn/${course.slug}?lesson=${result.enrollment.lastLessonId}`
            : `/learn/${course.slug}`,
          { replace: true },
        )
      }, 650)
    } catch (currentError) {
      setCartError(currentError instanceof Error ? currentError.message : 'ไม่สามารถลงทะเบียนคอร์สได้')
    } finally {
      setCheckoutSlug(null)
    }
  }

  const checkoutAllCourses = async () => {
    if (!ensureStudentSession() || cartCourses.length === 0) return

    setCheckoutAll(true)
    setCartError(null)
    setCartMessage(null)

    try {
      let firstEnrollmentPath = session?.dashboardPath ?? '/student'

      for (const course of cartCourses) {
        const result = await api.enrollCourse(course.slug)
        cartStorage.removeItem(course.slug)

        if (firstEnrollmentPath === (session?.dashboardPath ?? '/student')) {
          firstEnrollmentPath = result.enrollment.lastLessonId
            ? `/learn/${course.slug}?lesson=${result.enrollment.lastLessonId}`
            : `/learn/${course.slug}`
        }
      }

      cartStorage.clearItems()
      setCartItems([])
      setCartMessage(`ลงทะเบียนสำเร็จแล้ว ${cartCourses.length} คอร์ส กำลังพาไปหน้าเรียน...`)

      window.setTimeout(() => {
        navigate(firstEnrollmentPath, { replace: true })
      }, 650)
    } catch (currentError) {
      setCartError(currentError instanceof Error ? currentError.message : 'ไม่สามารถลงทะเบียนทั้งหมดได้')
    } finally {
      setCheckoutAll(false)
    }
  }

  const totalCourses = courses?.length ?? 0
  const publishedCourses = (courses ?? []).filter((course) => course.status === 'published').length
  const draftCourses = (courses ?? []).filter((course) => course.status === 'draft').length
  const hiddenCourses = (courses ?? []).filter((course) => course.status === 'hidden').length
  const popularCourses = (courses ?? []).filter((course) => course.isPopular).length
  const cartCourses = (courses ?? []).filter((course) => cartItems.includes(course.slug))
  const totalCartPrice = cartCourses.reduce((sum, course) => sum + course.price, 0)
  const freeCartCourses = cartCourses.filter((course) => course.price === 0).length
  const paidCartCourses = cartCourses.length - freeCartCourses

  return (
    <section className="min-h-screen bg-white text-black lg:pl-[280px]">
      <LearnProSidebar active="all-courses" />

      <main className="min-w-0">
        <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
          <header className="flex flex-col gap-5 border-b border-zinc-200 pb-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight text-black">คอร์สทั้งหมด</h1>
              <p className="mt-3 text-base text-zinc-600">เลือกดูและสมัครเรียนคอร์สทั้งหมดที่เปิดอยู่ในระบบ</p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="relative block sm:w-80">
                <span className="sr-only">ค้นหาคอร์ส</span>
                <Search size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-black" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="h-12 w-full rounded-lg border border-zinc-200 bg-white px-4 pr-11 text-sm text-black outline-none transition placeholder:text-zinc-400 focus:border-black"
                  placeholder="ค้นหาคอร์ส..."
                />
              </label>

              <label className="relative block sm:w-52">
                <span className="sr-only">เรียงตาม</span>
                <select
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value as SortOption)}
                  className="h-12 w-full appearance-none rounded-lg border border-zinc-200 bg-white px-4 pr-10 text-sm font-semibold text-black outline-none transition focus:border-black"
                >
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      เรียงตาม: {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-black" />
              </label>

              <button
                type="button"
                onClick={() => setCartOpen(true)}
                className="relative inline-flex h-12 w-12 items-center justify-center rounded-lg bg-black text-white transition hover:bg-zinc-800"
                aria-label="ตะกร้าสินค้า"
                title="ตะกร้าสินค้า"
              >
                <ShoppingCart size={18} />
                {cartItems.length > 0 ? (
                  <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[11px] font-semibold text-black shadow-sm">
                    {cartItems.length}
                  </span>
                ) : null}
              </button>
            </div>
          </header>

          <div className="grid gap-8 pt-8 lg:grid-cols-[300px_minmax(0,1fr)]">
            <aside className="h-fit rounded-xl border border-zinc-200 bg-white p-6 shadow-sm lg:sticky lg:top-6">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-lg font-semibold text-black">ตัวกรอง</h2>
                <button type="button" className="text-sm text-zinc-500 transition hover:text-black" onClick={resetFilters}>
                  ล้างทั้งหมด
                </button>
              </div>

              <div className="mt-7 border-b border-zinc-200 pb-6">
                <h3 className="mb-4 text-sm font-semibold text-black">หมวดหมู่</h3>
                <div className="space-y-3">
                  {categoryOptions.slice(1).map((category) => (
                    <FilterCheckbox
                      key={category}
                      label={category}
                      count={categoryCounts.get(category) ?? 0}
                      checked={selectedCategory === category}
                      onClick={() => setSelectedCategory(selectedCategory === category ? allOption : category)}
                    />
                  ))}
                </div>
              </div>

              <div className="border-b border-zinc-200 py-6">
                <h3 className="mb-4 text-sm font-semibold text-black">ระดับคอร์ส</h3>
                <div className="space-y-3">
                  {levelOptions.slice(1).map((level) => (
                    <FilterCheckbox
                      key={level}
                      label={level}
                      count={levelCounts.get(level) ?? 0}
                      checked={selectedLevel === level}
                      onClick={() => setSelectedLevel(selectedLevel === level ? allOption : level)}
                    />
                  ))}
                </div>
              </div>

              <div className="pt-6">
                <h3 className="mb-4 text-sm font-semibold text-black">ราคา</h3>
                <div className="space-y-3 text-sm text-zinc-700">
                  <button type="button" className="flex items-center gap-3" onClick={() => setSortBy('popular')}>
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-black">
                      <span className="h-2 w-2 rounded-full bg-black" />
                    </span>
                    ทั้งหมด
                  </button>
                  <button type="button" className="flex items-center gap-3" onClick={() => setSortBy('price-low')}>
                    <span className="h-4 w-4 rounded-full border border-zinc-300" />
                    ราคาต่ำก่อน
                  </button>
                  <button type="button" className="flex items-center gap-3" onClick={() => setSortBy('price-high')}>
                    <span className="h-4 w-4 rounded-full border border-zinc-300" />
                    ราคาสูงก่อน
                  </button>
                </div>
              </div>
            </aside>

            <section className="min-w-0">
              <div className="mb-7 flex flex-wrap gap-4 border-b border-zinc-200 pb-6">
                {[
                  ['ทั้งหมด', totalCourses],
                  ['เผยแพร่แล้ว', publishedCourses],
                  ['ยอดนิยม', popularCourses],
                  ['ร่าง', draftCourses],
                  ['ซ่อนอยู่', hiddenCourses],
                ].map(([label, count], index) => (
                  <button
                    key={label}
                    type="button"
                    className={[
                      'h-11 rounded-lg px-5 text-sm font-semibold transition',
                      index === 0 ? 'bg-black text-white shadow-sm' : 'bg-white text-zinc-600 hover:bg-zinc-100 hover:text-black',
                    ].join(' ')}
                    onClick={index === 0 ? resetFilters : undefined}
                  >
                    {label} ({count})
                  </button>
                ))}
              </div>

              <div className="mb-5 flex items-center justify-between gap-4 text-sm text-zinc-500">
                <span>{loading ? 'กำลังโหลดคอร์ส...' : `พบ ${filteredCourses.length} คอร์ส`}</span>
                <span>ทั้งหมด {totalCourses} คอร์ส</span>
              </div>

              {loading ? (
                <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, index) => (
                    <div key={index} className="h-80 animate-pulse rounded-lg border border-zinc-200 bg-zinc-100" />
                  ))}
                </div>
              ) : null}

              {courseError ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">{courseError}</div> : null}

              {!loading && !courseError && filteredCourses.length === 0 ? (
                <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center shadow-sm">
                  <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-100 text-black">
                    <Search size={20} />
                  </span>
                  <h2 className="mt-4 text-lg font-semibold text-black">ไม่พบคอร์สที่ตรงกับการค้นหา</h2>
                  <p className="mt-2 text-sm text-zinc-500">ลองเปลี่ยนคำค้นหา หมวดหมู่ ระดับ หรือการเรียงลำดับ</p>
                  <button type="button" className="mt-5 h-11 rounded-lg bg-black px-5 text-sm font-semibold text-white" onClick={resetFilters}>
                    ล้างตัวกรอง
                  </button>
                </div>
              ) : null}

              {!loading && !courseError && filteredCourses.length > 0 ? (
                <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {filteredCourses.map((course) => (
                    <CourseGridCard
                      key={course.id}
                      course={course}
                      inCart={cartItems.includes(course.slug)}
                      onAddToCart={handleAddToCart}
                    />
                  ))}
                </div>
              ) : null}
            </section>
          </div>
        </div>
      </main>

      <div
        className={[
          'fixed inset-0 z-[80] bg-black/35 transition-opacity duration-200',
          cartOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        ].join(' ')}
        onClick={closeCart}
      />
      <aside
        className={[
          'fixed inset-y-0 right-0 z-[90] flex w-full max-w-[440px] flex-col border-l border-zinc-200 bg-white text-black shadow-2xl transition-transform duration-300 ease-out',
          cartOpen ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
        aria-label="ตะกร้าสินค้า"
      >
        <header className="flex items-center justify-between border-b border-zinc-200 px-5 py-5">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-black text-white">
              <ShoppingBag size={20} />
            </span>
            <div>
              <h2 className="text-xl font-semibold text-black">ตะกร้าสินค้า</h2>
              <p className="mt-1 text-sm text-zinc-500">{cartCourses.length} รายการในตะกร้า</p>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-zinc-200 text-black transition hover:border-black"
            onClick={closeCart}
            aria-label="ปิดตะกร้า"
          >
            <X size={18} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {loading ? (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-5 text-sm text-zinc-500">กำลังโหลดตะกร้า...</div>
          ) : courseError || cartError ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
              {cartError ?? courseError}
            </div>
          ) : cartMessage ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-sm font-medium text-emerald-700">
              {cartMessage}
            </div>
          ) : cartCourses.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 text-black">
                <ShoppingBag size={26} />
              </span>
              <h3 className="mt-5 text-lg font-semibold text-black">ตะกร้ายังว่าง</h3>
              <p className="mt-2 max-w-xs text-sm leading-6 text-zinc-500">
                เลือกคอร์สที่สนใจ แล้วกดไอคอนตะกร้าเพื่อเพิ่มรายการก่อนลงทะเบียน
              </p>
              <button
                type="button"
                className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-md bg-black px-5 text-sm font-semibold text-white transition hover:bg-zinc-800"
                onClick={closeCart}
              >
                เลือกคอร์สเพิ่ม
                <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {cartCourses.map((course) => (
                <article key={course.id} className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm transition hover:border-black/50">
                  <div className="flex gap-3">
                    <img src={course.coverImage} alt={course.title} className="h-20 w-24 rounded-lg bg-zinc-100 object-cover" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-black">{course.title}</h3>
                          <p className="mt-1 text-xs text-zinc-500">{course.instructor.name}</p>
                        </div>
                        <button
                          type="button"
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-100 hover:text-rose-700"
                          onClick={() => removeCourse(course.slug)}
                          aria-label={`ลบ ${course.title}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <p className="mt-3 text-base font-semibold text-black">{course.price === 0 ? 'ฟรี' : formatPrice(course.price)}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-black text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
                    onClick={() => checkoutCourse(course)}
                    disabled={checkoutSlug === course.slug || checkoutAll}
                  >
                    {checkoutSlug === course.slug ? <LoaderCircle size={15} className="animate-spin" /> : <BookOpenCheck size={15} />}
                    {checkoutSlug === course.slug ? 'กำลังลงทะเบียน...' : 'ลงทะเบียนคอร์สนี้'}
                  </button>
                </article>
              ))}
            </div>
          )}
        </div>

        <footer className="border-t border-zinc-200 bg-white p-5">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-center">
              <p className="text-xs text-zinc-500">ทั้งหมด</p>
              <p className="mt-1 text-lg font-semibold text-black">{cartCourses.length}</p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-center">
              <p className="text-xs text-zinc-500">ฟรี</p>
              <p className="mt-1 text-lg font-semibold text-black">{freeCartCourses}</p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-center">
              <p className="text-xs text-zinc-500">เสียเงิน</p>
              <p className="mt-1 text-lg font-semibold text-black">{paidCartCourses}</p>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-zinc-200 pt-5">
            <span className="text-sm text-zinc-500">ยอดรวม</span>
            <span className="text-2xl font-semibold text-black">{formatPrice(totalCartPrice)}</span>
          </div>

          <div className="mt-4 grid gap-2">
            {cartCourses.length > 0 ? (
              <button
                type="button"
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-black text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
                onClick={checkoutAllCourses}
                disabled={checkoutAll || Boolean(checkoutSlug)}
              >
                {checkoutAll ? <LoaderCircle size={16} className="animate-spin" /> : <BookOpenCheck size={16} />}
                {checkoutAll ? 'กำลังลงทะเบียน...' : 'ลงทะเบียนทั้งหมด'}
              </button>
            ) : null}
            <button
              type="button"
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-zinc-200 bg-white text-sm font-semibold text-black transition hover:border-black"
              onClick={closeCart}
            >
              เลือกคอร์สเพิ่ม
              <ArrowRight size={16} />
            </button>
            <button
              type="button"
              className="inline-flex h-11 w-full items-center justify-center rounded-md border border-zinc-200 bg-white text-sm font-semibold text-black transition hover:border-black disabled:cursor-not-allowed disabled:text-zinc-400"
              onClick={clearCart}
              disabled={cartCourses.length === 0}
            >
              ล้างตะกร้า
            </button>
          </div>
        </footer>
      </aside>
    </section>
  )
}
