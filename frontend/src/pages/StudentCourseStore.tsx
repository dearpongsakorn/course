import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BookOpenCheck,
  Check,
  ChevronDown,
  Clock3,
  CreditCard,
  Filter,
  Menu,
  Search,
  ShoppingCart,
  Star,
  UserRound,
  UsersRound,
} from 'lucide-react'
import LearnProSidebar from '../components/LearnProSidebar'
import { useApi } from '../hooks/useApi'
import { api, cartStorage, studentDashboardStorage } from '../services/api'
import type { Course } from '../types/course'

const allOption = 'ทั้งหมด'
const categoryOptions = [allOption, 'Technology', 'Business', 'Design', 'Marketing', 'Data']
const levelOptions = [allOption, 'Beginner', 'Intermediate', 'Advanced']

type SortOption = 'popular' | 'rating' | 'price-low' | 'price-high'

const sortOptions: Array<{ value: SortOption; label: string }> = [
  { value: 'popular', label: 'ยอดนิยม' },
  { value: 'rating', label: 'คะแนนสูง' },
  { value: 'price-low', label: 'ราคาต่ำสุด' },
  { value: 'price-high', label: 'ราคาสูงสุด' },
]

const formatPrice = (price: number) =>
  price === 0
    ? 'ฟรี'
    : new Intl.NumberFormat('th-TH', {
        style: 'currency',
        currency: 'THB',
        maximumFractionDigits: 0,
      }).format(price)

const getLearningPath = (course: Course) => {
  const lastLessonId = course.viewerState?.enrollment?.lastLessonId
  return lastLessonId ? `/learn/${course.slug}?lesson=${lastLessonId}` : `/learn/${course.slug}`
}

const sortCourses = (items: Course[], sortBy: SortOption) => {
  const nextItems = [...items]

  if (sortBy === 'rating') return nextItems.sort((left, right) => right.rating - left.rating)
  if (sortBy === 'price-low') return nextItems.sort((left, right) => left.price - right.price)
  if (sortBy === 'price-high') return nextItems.sort((left, right) => right.price - left.price)

  return nextItems.sort((left, right) => {
    if (left.isPopular !== right.isPopular) return left.isPopular ? -1 : 1
    return right.students - left.students
  })
}

function StoreCourseCard({
  course,
  inCart,
  onAddToCart,
}: {
  course: Course
  inCart: boolean
  onAddToCart: (slug: string) => void
}) {
  const isEnrolled = Boolean(course.viewerState?.isEnrolled)
  const lessonCount = Math.max(course.lessonCount ?? 0, course.lessons.length)

  return (
    <article className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-black hover:shadow-md">
      <Link to={`/courses/${course.slug}`} className="relative block h-44 overflow-hidden bg-black">
        <img src={course.coverImage} alt={course.title} className="h-full w-full object-cover opacity-80 transition duration-300 hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-tr from-black via-black/45 to-transparent" />
        <span className="absolute left-4 top-4 rounded-full bg-white px-3 py-1 text-xs font-semibold text-black">
          {course.category}
        </span>
        {course.isPopular ? (
          <span className="absolute right-4 top-4 rounded-full bg-black px-3 py-1 text-xs font-semibold text-white">
            ยอดนิยม
          </span>
        ) : null}
        <div className="absolute bottom-4 left-4 right-4">
          <p className="text-xs font-medium text-white/75">โดย {course.instructor.name}</p>
          <h2 className="mt-1 line-clamp-2 text-lg font-semibold leading-6 text-white">{course.title}</h2>
        </div>
      </Link>

      <div className="p-5">
        <p className="line-clamp-2 min-h-[48px] text-sm leading-6 text-zinc-600">{course.description}</p>

        <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-zinc-600">
          <span className="inline-flex items-center gap-1 rounded-lg bg-zinc-50 px-3 py-2">
            <Clock3 size={13} />
            {course.duration}
          </span>
          <span className="inline-flex items-center gap-1 rounded-lg bg-zinc-50 px-3 py-2">
            <BookOpenCheck size={13} />
            {lessonCount} บทเรียน
          </span>
          <span className="inline-flex items-center gap-1 rounded-lg bg-zinc-50 px-3 py-2">
            <Star size={13} className="fill-black text-black" />
            {course.rating.toFixed(1)}
          </span>
          <span className="inline-flex items-center gap-1 rounded-lg bg-zinc-50 px-3 py-2">
            <UsersRound size={13} />
            {course.students.toLocaleString('th-TH')}
          </span>
        </div>

        <div className="mt-5 flex items-end justify-between gap-4 border-t border-zinc-200 pt-4">
          <div>
            <p className="text-xs font-medium text-zinc-500">{course.level}</p>
            <p className="mt-1 text-xl font-semibold text-black">{formatPrice(course.price)}</p>
          </div>
          {isEnrolled ? (
            <Link
              to={getLearningPath(course)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-black px-4 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              เข้าเรียน
              <ArrowRight size={16} />
            </Link>
          ) : (
            <Link
              to={`/checkout/${course.slug}`}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-black px-4 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              {course.price === 0 ? 'สมัครฟรี' : 'ซื้อคอร์ส'}
              <CreditCard size={16} />
            </Link>
          )}
        </div>

        {!isEnrolled ? (
          <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
            <button
              type="button"
              className={[
                'inline-flex h-10 items-center justify-center gap-2 rounded-md border px-3 text-sm font-semibold transition',
                inCart
                  ? 'border-zinc-200 bg-zinc-100 text-zinc-500'
                  : 'border-zinc-200 bg-white text-black hover:border-black',
              ].join(' ')}
              onClick={() => onAddToCart(course.slug)}
              disabled={inCart}
            >
              {inCart ? <Check size={16} /> : <ShoppingCart size={16} />}
              {inCart ? 'อยู่ในตะกร้าแล้ว' : 'เพิ่มตะกร้า'}
            </button>
            <Link
              to={`/courses/${course.slug}`}
              className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-200 px-3 text-sm font-semibold text-black transition hover:border-black"
            >
              รายละเอียด
            </Link>
          </div>
        ) : null}
      </div>
    </article>
  )
}

export default function StudentCourseStore() {
  const { data: dashboard } = useApi(() => api.getStudentDashboard(), [], studentDashboardStorage.get())
  const { data: courses, error, loading } = useApi(() => api.getCourses(), [])
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [cartItems, setCartItems] = useState(() => cartStorage.getItems())
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState(allOption)
  const [selectedLevel, setSelectedLevel] = useState(allOption)
  const [sortBy, setSortBy] = useState<SortOption>('popular')
  const deferredSearchTerm = useDeferredValue(searchTerm)

  useEffect(() => cartStorage.subscribe(() => setCartItems(cartStorage.getItems())), [])

  const publishedCourses = useMemo(() => (courses ?? []).filter((course) => course.status === 'published'), [courses])
  const paidCourses = publishedCourses.filter((course) => course.price > 0).length
  const freeCourses = publishedCourses.filter((course) => course.price === 0).length
  const enrolledCourses = publishedCourses.filter((course) => course.viewerState?.isEnrolled).length

  const filteredCourses = useMemo(() => {
    const normalizedSearch = deferredSearchTerm.trim().toLowerCase()
    const filtered = publishedCourses.filter((course) => {
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
  }, [deferredSearchTerm, publishedCourses, selectedCategory, selectedLevel, sortBy])

  const resetFilters = () => {
    setSearchTerm('')
    setSelectedCategory(allOption)
    setSelectedLevel(allOption)
    setSortBy('popular')
  }

  const handleAddToCart = (slug: string) => {
    setCartItems(cartStorage.addItem(slug))
  }

  const profileName = dashboard?.profile.name || dashboard?.user.name || 'ผู้เรียน'
  const profileAvatarUrl = dashboard?.profile.avatarUrl || dashboard?.user.avatarUrl
  const profileLabel = dashboard?.profile.headline || 'บัญชีผู้เรียน'

  return (
    <div className="student-page-shell">
      <LearnProSidebar
        active="all-courses"
        profileName={profileName}
        profileAvatarUrl={profileAvatarUrl}
        profileLabel={profileLabel}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />

      <main className="student-page-main min-w-0">
        <div className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6 lg:px-8">
          <header className="mb-6 flex items-center gap-4">
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-zinc-200 bg-white lg:hidden"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="เปิดเมนู"
            >
              <Menu size={20} />
            </button>
            <label className="relative hidden flex-1 md:block xl:max-w-[560px]">
              <Search size={19} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="h-12 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-12 pr-4 text-sm outline-none transition placeholder:text-zinc-500 focus:border-black focus:bg-white"
                placeholder="ค้นหาคอร์สที่อยากซื้อ..."
              />
            </label>
            <div className="ml-auto flex items-center gap-3">
              <Link to="/courses?cart=1" className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-zinc-200 bg-white text-black">
                <ShoppingCart size={19} />
                {cartItems.length > 0 ? (
                  <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-black px-1 text-[11px] font-semibold text-white">
                    {cartItems.length}
                  </span>
                ) : null}
              </Link>
              <Link to="/student?section=profile" className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white py-1 pl-1 pr-3">
                {profileAvatarUrl ? (
                  <img src={profileAvatarUrl} alt={profileName} className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-black text-white">
                    <UserRound size={16} />
                  </span>
                )}
                <span className="hidden text-sm font-semibold sm:inline">{profileName}</span>
              </Link>
            </div>
          </header>

          <section className="mb-7 grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
            <div className="relative overflow-hidden rounded-xl border border-zinc-200 bg-white p-7 shadow-sm">
              <div className="max-w-2xl">
                <p className="text-sm font-semibold text-zinc-500">เลือกซื้อคอร์สสำหรับนักเรียน</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-black sm:text-4xl">
                  ค้นหาคอร์สใหม่ แล้วสมัครเรียนต่อได้ทันที
                </h1>
                <p className="mt-3 text-base leading-7 text-zinc-600">
                  หน้านี้ใช้ระบบคอร์ส ตะกร้า และ checkout เดิมทั้งหมด นักเรียนสามารถดูรายละเอียด เพิ่มลงตะกร้า หรือซื้อคอร์สได้จากที่เดียว
                </p>
              </div>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  to="/courses?cart=1"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-black px-5 text-sm font-semibold text-white transition hover:bg-zinc-800"
                >
                  ไปที่ตะกร้า
                  <ShoppingCart size={16} />
                </Link>
                <button
                  type="button"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-zinc-200 bg-white px-5 text-sm font-semibold text-black transition hover:border-black"
                  onClick={resetFilters}
                >
                  ล้างตัวกรอง
                </button>
              </div>
            </div>

            <aside className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              {[
                ['คอร์สพร้อมซื้อ', publishedCourses.length],
                ['คอร์สฟรี', freeCourses],
                ['คอร์สเสียเงิน', paidCourses],
                ['เรียนอยู่แล้ว', enrolledCourses],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
                  <p className="text-3xl font-semibold text-black">{value}</p>
                  <p className="mt-1 text-sm text-zinc-500">{label}</p>
                </div>
              ))}
            </aside>
          </section>

          <section className="grid gap-6 xl:grid-cols-[290px_minmax(0,1fr)]">
            <aside className="h-fit rounded-xl border border-zinc-200 bg-white p-5 shadow-sm xl:sticky xl:top-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-black">ตัวกรอง</h2>
                <Filter size={18} />
              </div>

              <label className="relative mt-5 block md:hidden">
                <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="h-11 w-full rounded-lg border border-zinc-200 bg-zinc-50 pl-11 pr-4 text-sm outline-none focus:border-black focus:bg-white"
                  placeholder="ค้นหาคอร์ส..."
                />
              </label>

              <div className="mt-6 space-y-5">
                <label className="block">
                  <span className="text-sm font-semibold text-black">หมวดหมู่</span>
                  <select
                    value={selectedCategory}
                    onChange={(event) => setSelectedCategory(event.target.value)}
                    className="mt-2 h-11 w-full appearance-none rounded-lg border border-zinc-200 bg-white px-3 text-sm text-black outline-none focus:border-black"
                  >
                    {categoryOptions.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-black">ระดับ</span>
                  <select
                    value={selectedLevel}
                    onChange={(event) => setSelectedLevel(event.target.value)}
                    className="mt-2 h-11 w-full appearance-none rounded-lg border border-zinc-200 bg-white px-3 text-sm text-black outline-none focus:border-black"
                  >
                    {levelOptions.map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="relative block">
                  <span className="text-sm font-semibold text-black">เรียงตาม</span>
                  <select
                    value={sortBy}
                    onChange={(event) => setSortBy(event.target.value as SortOption)}
                    className="mt-2 h-11 w-full appearance-none rounded-lg border border-zinc-200 bg-white px-3 pr-9 text-sm text-black outline-none focus:border-black"
                  >
                    {sortOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="pointer-events-none absolute bottom-3.5 right-3 text-zinc-500" />
                </label>
              </div>
            </aside>

            <div className="min-w-0">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-black">คอร์สที่เปิดขาย</h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    {loading ? 'กำลังโหลดคอร์ส...' : `พบ ${filteredCourses.length} คอร์ส`}
                  </p>
                </div>
                <Link to="/courses?cart=1" className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-zinc-200 px-4 text-sm font-semibold text-black transition hover:border-black">
                  ตะกร้าของฉัน
                  <ShoppingCart size={16} />
                </Link>
              </div>

              {loading ? (
                <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="h-[430px] animate-pulse rounded-xl border border-zinc-200 bg-zinc-100" />
                  ))}
                </div>
              ) : null}

              {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">{error}</div> : null}

              {!loading && !error && filteredCourses.length === 0 ? (
                <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center shadow-sm">
                  <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 text-black">
                    <Search size={24} />
                  </span>
                  <h3 className="mt-5 text-xl font-semibold text-black">ไม่พบคอร์สที่ตรงกับตัวกรอง</h3>
                  <p className="mt-2 text-sm text-zinc-500">ลองเปลี่ยนคำค้นหา หมวดหมู่ ระดับ หรือการเรียงลำดับใหม่</p>
                  <button type="button" className="mt-6 h-11 rounded-md bg-black px-5 text-sm font-semibold text-white" onClick={resetFilters}>
                    ล้างตัวกรอง
                  </button>
                </div>
              ) : null}

              {!loading && !error && filteredCourses.length > 0 ? (
                <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
                  {filteredCourses.map((course) => (
                    <StoreCourseCard
                      key={course.id}
                      course={course}
                      inCart={cartItems.includes(course.slug)}
                      onAddToCart={handleAddToCart}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
