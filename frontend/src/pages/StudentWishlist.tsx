import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpenCheck,
  ChevronRight,
  Clock3,
  Heart,
  Menu,
  Search,
  Sparkles,
  Star,
  UserRound,
} from 'lucide-react'
import LearnProSidebar from '../components/LearnProSidebar'
import { useApi } from '../hooks/useApi'
import { api, studentDashboardStorage, type StudentCourse } from '../services/api'

const learningPathFor = (item: StudentCourse) =>
  item.enrollment.lastLessonId
    ? `/learn/${item.course.slug}?lesson=${item.enrollment.lastLessonId}`
    : `/learn/${item.course.slug}`

const formatPrice = (value: number) =>
  new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0,
  }).format(value)

function WishlistCard({ item }: { item: StudentCourse }) {
  return (
    <article className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-black hover:shadow-md">
      <div className="relative h-44 overflow-hidden bg-black">
        <img src={item.course.coverImage} alt={item.course.title} className="h-full w-full object-cover opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-tr from-black via-black/45 to-transparent" />
        <span className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-black">
          <Heart size={13} className="fill-black" />
          รายการโปรด
        </span>
        <div className="absolute bottom-4 left-4 right-4">
          <p className="text-xs font-medium text-white/75">{item.course.category}</p>
          <h2 className="mt-1 line-clamp-2 text-lg font-semibold leading-6 text-white">{item.course.title}</h2>
        </div>
      </div>

      <div className="p-5">
        <p className="line-clamp-2 min-h-[48px] text-sm leading-6 text-zinc-600">{item.course.description}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-600">
          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1">
            <Clock3 size={13} />
            {item.course.duration}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1">
            <Star size={13} className="fill-black text-black" />
            {item.course.rating.toFixed(1)}
          </span>
          <span className="rounded-full bg-zinc-100 px-3 py-1">{item.course.level}</span>
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-zinc-600">
            <span>ความคืบหน้า</span>
            <span>{item.enrollment.progress}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-zinc-200">
            <div className="h-1.5 rounded-full bg-black" style={{ width: `${Math.min(item.enrollment.progress, 100)}%` }} />
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3 border-t border-zinc-200 pt-4">
          <p className="text-base font-semibold text-black">{item.course.price === 0 ? 'ฟรี' : formatPrice(item.course.price)}</p>
          <Link
            to={learningPathFor(item)}
            className="inline-flex h-10 items-center justify-center rounded-md bg-black px-4 text-sm font-semibold text-white transition hover:bg-zinc-800"
          >
            {item.enrollment.progress > 0 ? 'เรียนต่อ' : 'เริ่มเรียน'}
          </Link>
        </div>
      </div>
    </article>
  )
}

export default function StudentWishlist() {
  const { data, error, loading } = useApi(() => api.getStudentDashboard(), [], studentDashboardStorage.get())
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  const wishlistCourses = useMemo(() => (data?.courses ?? []).slice(0, 3), [data?.courses])
  const profileName = data?.profile.name || data?.user.name || 'ผู้เรียน'

  if (loading && !data) {
    return <div className="min-h-screen bg-white p-6 text-sm text-zinc-500">กำลังโหลดรายการโปรด...</div>
  }

  if (error && !data) {
    return <div className="min-h-screen bg-white p-6 text-sm text-rose-600">{error}</div>
  }

  if (!data) return null

  return (
    <div className="student-page-shell">
      <LearnProSidebar
        active="wishlist"
        profileName={profileName}
        profileAvatarUrl={data.profile.avatarUrl || data.user.avatarUrl}
        profileLabel={data.profile.headline || 'บัญชีผู้เรียน'}
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
            <label className="relative hidden flex-1 md:block xl:max-w-[520px]">
              <Search size={19} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                className="h-12 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-12 pr-4 text-sm outline-none transition placeholder:text-zinc-500 focus:border-black focus:bg-white"
                placeholder="ค้นหาคอร์สในรายการโปรด..."
              />
            </label>
            <div className="ml-auto flex items-center gap-3 rounded-full border border-zinc-200 bg-white py-1 pl-1 pr-3">
              {data.profile.avatarUrl || data.user.avatarUrl ? (
                <img
                  src={data.profile.avatarUrl || data.user.avatarUrl}
                  alt={profileName}
                  className="h-9 w-9 rounded-full object-cover"
                />
              ) : (
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-black text-white">
                  <UserRound size={16} />
                </span>
              )}
              <span className="hidden text-sm font-semibold sm:inline">{profileName}</span>
            </div>
          </header>

          <section className="relative mb-7 overflow-hidden rounded-xl border border-zinc-200 bg-white p-7 shadow-sm">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-zinc-500">รายการโปรดของฉัน</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-black sm:text-4xl">
                เก็บคอร์สที่อยากกลับมาเรียนต่อ
              </h1>
              <p className="mt-3 text-base leading-7 text-zinc-600">
                หน้านี้แสดงคอร์สที่ถูกจัดเป็นรายการโปรดจากข้อมูลผู้เรียนเดิม โดยยังไม่เพิ่ม backend logic ใหม่
              </p>
            </div>
            <div className="pointer-events-none absolute right-10 top-1/2 hidden -translate-y-1/2 lg:block">
              <Heart className="fill-black text-black" size={76} strokeWidth={1.5} />
            </div>
          </section>

          <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_390px]">
            <section>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-black">คอร์สที่บันทึกไว้</h2>
                  <p className="mt-1 text-sm text-zinc-500">ทั้งหมด {wishlistCourses.length} คอร์ส</p>
                </div>
                <Link to="/courses" className="hidden items-center gap-2 text-sm font-medium text-black sm:inline-flex">
                  ค้นหาคอร์สเพิ่ม
                  <ChevronRight size={16} />
                </Link>
              </div>

              {wishlistCourses.length > 0 ? (
                <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
                  {wishlistCourses.map((item) => (
                    <WishlistCard key={item.course.id} item={item} />
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center shadow-sm">
                  <span className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 text-black">
                    <Heart size={28} />
                  </span>
                  <h3 className="mt-5 text-xl font-semibold text-black">ยังไม่มีรายการโปรด</h3>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-zinc-500">
                    เมื่อมีระบบบันทึกคอร์สโปรดจริง คอร์สที่บันทึกไว้จะแสดงที่หน้านี้
                  </p>
                  <Link
                    to="/courses"
                    className="mt-6 inline-flex h-11 items-center justify-center rounded-md bg-black px-5 text-sm font-semibold text-white transition hover:bg-zinc-800"
                  >
                    ค้นหาคอร์ส
                  </Link>
                </div>
              )}
            </section>

            <aside className="space-y-5">
              <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-black">ภาพรวมรายการโปรด</h2>
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-black text-white">
                    <Sparkles size={18} />
                  </span>
                </div>
                <div className="mt-6 grid grid-cols-2 gap-4">
                  <div className="rounded-lg bg-zinc-50 p-4">
                    <p className="text-3xl font-semibold text-black">{wishlistCourses.length}</p>
                    <p className="mt-1 text-sm text-zinc-500">คอร์สที่บันทึกไว้</p>
                  </div>
                  <div className="rounded-lg bg-zinc-50 p-4">
                    <p className="text-3xl font-semibold text-black">
                      {wishlistCourses.filter((item) => item.enrollment.progress > 0).length}
                    </p>
                    <p className="mt-1 text-sm text-zinc-500">เริ่มเรียนแล้ว</p>
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-black">คำแนะนำ</h2>
                <div className="mt-5 space-y-3">
                  {[
                    ['กลับไปเรียนต่อ', 'เลือกคอร์สที่ progress ยังไม่เต็ม 100% เพื่อเรียนต่อ'],
                    ['คัดคอร์สสำคัญ', 'เก็บคอร์สที่ต้องใช้บ่อยไว้ในรายการโปรด'],
                    ['ทบทวนสม่ำเสมอ', 'คอร์สที่บันทึกไว้เหมาะกับการกลับมาอ่านซ้ำ'],
                  ].map(([title, detail]) => (
                    <div key={title} className="flex gap-3 rounded-lg bg-zinc-50 p-4">
                      <BookOpenCheck size={18} className="mt-0.5 shrink-0 text-black" />
                      <div>
                        <p className="text-sm font-semibold text-black">{title}</p>
                        <p className="mt-1 text-sm leading-6 text-zinc-500">{detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </aside>
          </div>
        </div>
      </main>
    </div>
  )
}
