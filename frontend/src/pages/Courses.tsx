import { useDeferredValue, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import CourseCard from '../components/CourseCard'
import { useApi } from '../hooks/useApi'
import { api } from '../services/api'

const categoryOptions = ['ทั้งหมด', 'Technology', 'Business', 'Design', 'Marketing', 'Data']

export default function Courses() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('ทั้งหมด')
  const deferredSearchTerm = useDeferredValue(searchTerm)
  const { data: courses, error, loading } = useApi(() => api.getCourses(), [])

  const filteredCourses = useMemo(() => {
    const normalizedSearch = deferredSearchTerm.trim().toLowerCase()

    return (courses ?? []).filter((course) => {
      const matchesCategory =
        selectedCategory === 'ทั้งหมด' || course.category === selectedCategory
      const matchesSearch =
        !normalizedSearch ||
        course.title.toLowerCase().includes(normalizedSearch) ||
        course.description.toLowerCase().includes(normalizedSearch) ||
        course.instructor.name.toLowerCase().includes(normalizedSearch)

      return matchesCategory && matchesSearch
    })
  }, [courses, deferredSearchTerm, selectedCategory])

  return (
    <>
      <section className="border-b border-slate-200 bg-white">
        <div className="container-page py-12 sm:py-16">
          <div className="max-w-3xl">
            <p className="text-sm font-medium text-slate-500">Course Catalog</p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-950 sm:text-4xl">
              คอร์สทั้งหมดในระบบ
            </h1>
            <p className="mt-4 text-base leading-7 text-slate-600">
              รวมคอร์สทั้งหมดจากฐานข้อมูลจริง ค้นหา เรียงดูตามหมวดหมู่
              และเข้าไปดูรายละเอียดแต่ละคอร์สได้ทันที
            </p>
          </div>
        </div>
      </section>

      <section className="container-page py-8 sm:py-10">
        <div className="card p-4 sm:p-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
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
                  placeholder="ค้นหาจากชื่อคอร์ส รายละเอียด หรือชื่อผู้สอน"
                />
              </div>
            </label>

            <div className="flex flex-wrap gap-2">
              {categoryOptions.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                    selectedCategory === category
                      ? 'bg-slate-950 text-white'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                  }`}
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between text-sm text-slate-500">
          <p>{loading ? 'กำลังโหลดคอร์ส...' : `พบ ${filteredCourses.length} คอร์ส`}</p>
          <Link to="/login" className="font-medium text-slate-950 hover:text-slate-700">
            เข้าสู่ระบบเพื่อสมัครเรียน
          </Link>
        </div>

        {loading && (
          <div className="card mt-6 p-6 text-sm text-slate-500">กำลังโหลดคอร์สจากฐานข้อมูล...</div>
        )}
        {error && <div className="card mt-6 p-6 text-sm text-rose-600">{error}</div>}

        {!loading && !error && filteredCourses.length === 0 && (
          <div className="card mt-6 p-8 text-center">
            <h2 className="text-lg font-semibold text-slate-950">ยังไม่พบคอร์สที่ตรงกับการค้นหา</h2>
            <p className="mt-2 text-sm text-slate-500">ลองเปลี่ยนคำค้นหาหรือเลือกหมวดหมู่อื่น</p>
          </div>
        )}

        {!loading && !error && filteredCourses.length > 0 && (
          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredCourses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        )}
      </section>
    </>
  )
}
