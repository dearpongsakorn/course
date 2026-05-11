import { useDeferredValue, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BadgePercent, BookOpenCheck, Filter, Gift, Search, SlidersHorizontal } from 'lucide-react'
import CourseCard from '../components/CourseCard'
import { useApi } from '../hooks/useApi'
import { api, authStorage } from '../services/api'
import type { Course } from '../types/course'

const categoryOptions = ['ทั้งหมด', 'Technology', 'Business', 'Design', 'Marketing', 'Data']
const levelOptions = ['ทั้งหมด', 'Beginner', 'Intermediate', 'Advanced']

type SortOption = 'popular' | 'rating' | 'price-low' | 'price-high'

const sortOptions: Array<{ value: SortOption; label: string }> = [
  { value: 'popular', label: 'ยอดนิยม' },
  { value: 'rating', label: 'คะแนนสูง' },
  { value: 'price-low', label: 'ราคาต่ำสุด' },
  { value: 'price-high', label: 'ราคาสูงสุด' },
]

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

export default function Courses() {
  const session = authStorage.getSession()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('ทั้งหมด')
  const [selectedLevel, setSelectedLevel] = useState('ทั้งหมด')
  const [sortBy, setSortBy] = useState<SortOption>('popular')
  const deferredSearchTerm = useDeferredValue(searchTerm)
  const { data: courses, error, loading } = useApi(() => api.getCourses(), [])

  const filteredCourses = useMemo(() => {
    const normalizedSearch = deferredSearchTerm.trim().toLowerCase()
    const filtered = (courses ?? []).filter((course) => {
      const matchesCategory = selectedCategory === 'ทั้งหมด' || course.category === selectedCategory
      const matchesLevel = selectedLevel === 'ทั้งหมด' || course.level === selectedLevel
      const matchesSearch =
        !normalizedSearch ||
        course.title.toLowerCase().includes(normalizedSearch) ||
        course.description.toLowerCase().includes(normalizedSearch) ||
        course.instructor.name.toLowerCase().includes(normalizedSearch)

      return matchesCategory && matchesLevel && matchesSearch
    })

    return sortCourses(filtered, sortBy)
  }, [courses, deferredSearchTerm, selectedCategory, selectedLevel, sortBy])

  const promotionCourses = useMemo(
    () => sortCourses((courses ?? []).filter((course) => course.isPopular), 'popular'),
    [courses],
  )
  const freeCourses = useMemo(
    () => sortCourses((courses ?? []).filter((course) => course.price === 0), 'popular'),
    [courses],
  )

  const totalCourses = courses?.length ?? 0

  return (
    <>
      <section className="border-b border-slate-200 bg-white dark:border-white/10 dark:bg-slate-950">
        <div className="container-page grid gap-6 py-12 sm:py-16 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
              <BookOpenCheck size={15} />
              Course Catalog
            </p>
            <h1 className="mt-4 text-3xl font-semibold text-slate-950 sm:text-4xl">
              ค้นหาคอร์สที่เหมาะกับคุณ
            </h1>
            <p className="mt-4 text-base leading-7 text-slate-600">
              คอร์สทั้งหมดอยู่ด้านบนเพื่อให้ค้นหาและสมัครเรียนได้เร็ว ส่วนคอร์สฟรีและโปรโมชั่นอยู่ด้านล่างเป็นรายการแนะนำเพิ่มเติม
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              ['ทั้งหมด', totalCourses],
              ['คอร์สฟรี', freeCourses.length],
              ['โปรโมชั่น', promotionCourses.length],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                <p className="text-2xl font-semibold text-slate-950">{value}</p>
                <p className="mt-1 text-sm text-slate-500">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page py-10 sm:py-12">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500">
              <BookOpenCheck size={16} />
              All Courses
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-950">คอร์สทั้งหมด</h2>
            <p className="mt-1 text-sm text-slate-500">ค้นหา กรอง และเรียงลำดับคอร์สทั้งหมดจากระบบ</p>
          </div>
          <Link to={session ? session.dashboardPath : '/login'} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-950 hover:text-slate-700 dark:text-white">
            {session ? 'ไปที่ Dashboard' : 'เข้าสู่ระบบเพื่อสมัครเรียน'}
            <ArrowRight size={15} />
          </Link>
        </div>

        <div className="card p-4 sm:p-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_180px] lg:items-end">
            <label className="block">
              <span className="field-label">ค้นหาคอร์ส</span>
              <div className="relative mt-2">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="field-input mt-0 pl-10"
                />
              </div>
            </label>

            <label className="block">
              <span className="field-label">ระดับ</span>
              <select
                className="field-input"
                value={selectedLevel}
                onChange={(event) => setSelectedLevel(event.target.value)}
              >
                {levelOptions.map((level) => (
                  <option key={level}>{level}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="field-label">เรียงตาม</span>
              <select
                className="field-input"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as SortOption)}
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-4 dark:border-white/10">
            {categoryOptions.map((category) => (
              <button
                key={category}
                type="button"
                className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
                  selectedCategory === category
                    ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white'
                }`}
                onClick={() => setSelectedCategory(category)}
              >
                <Filter size={14} />
                {category}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 flex items-center gap-2 text-sm text-slate-500">
          <SlidersHorizontal size={15} />
          {loading ? 'กำลังโหลดคอร์ส...' : `พบ ${filteredCourses.length} คอร์ส`}
        </div>

        {loading ? (
          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="card h-80 animate-pulse bg-slate-100 dark:bg-slate-900" />
            ))}
          </div>
        ) : null}

        {error ? <div className="card mt-6 p-6 text-sm text-rose-600">{error}</div> : null}

        {!loading && !error && filteredCourses.length === 0 ? (
          <div className="card mt-6 p-8 text-center">
            <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-md bg-slate-950 text-white dark:bg-white dark:text-slate-950">
              <Search size={20} />
            </span>
            <h2 className="mt-4 text-lg font-semibold text-slate-950">ยังไม่พบคอร์สที่ตรงกับการค้นหา</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              ลองเปลี่ยนคำค้นหา หมวดหมู่ ระดับ หรือการเรียงลำดับเพื่อดูคอร์สอื่น
            </p>
            <button
              type="button"
              className="btn-secondary mt-5"
              onClick={() => {
                setSearchTerm('')
                setSelectedCategory('ทั้งหมด')
                setSelectedLevel('ทั้งหมด')
                setSortBy('popular')
              }}
            >
              ล้างตัวกรอง
            </button>
          </div>
        ) : null}

        {!loading && !error && filteredCourses.length > 0 ? (
          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredCourses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        ) : null}
      </section>

      {!loading && !error && freeCourses.length > 0 ? (
        <section className="border-y border-slate-200 bg-white py-10 dark:border-white/10 dark:bg-slate-950 sm:py-12">
          <div className="container-page">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                  <Gift size={16} className="text-emerald-500" />
                  Free Courses
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-slate-950 sm:text-3xl">คอร์สฟรี</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  รายการสำหรับทดลองเรียนหรือเริ่มปูพื้นฐานก่อนสมัครคอร์สอื่น
                </p>
              </div>
              <span className="w-fit rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300">
                {freeCourses.length} คอร์สฟรี
              </span>
            </div>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {freeCourses.slice(0, 3).map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {!loading && !error && promotionCourses.length > 0 ? (
        <section className="bg-slate-950 py-10 text-white sm:py-12">
          <div className="container-page">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/10 px-3 py-1 text-sm font-semibold text-slate-200">
                  <BadgePercent size={16} className="text-amber-300" />
                  Promotion
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">โปรโมชั่น</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                  คอร์สเด่นที่ถูกเลือกให้แนะนำเป็นพิเศษ อยู่ท้ายหน้าเพื่อไม่รบกวนการค้นหาคอร์สหลัก
                </p>
              </div>
              <span className="w-fit rounded-md border border-white/15 bg-white/10 px-3 py-1 text-sm font-semibold text-slate-200">
                {promotionCourses.length} คอร์ส
              </span>
            </div>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {promotionCourses.slice(0, 3).map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </>
  )
}
