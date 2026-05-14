import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Award,
  BookOpenCheck,
  CalendarDays,
  ChevronRight,
  Download,
  Menu,
  Printer,
  Search,
  Sparkles,
  Trophy,
  UserRound,
} from 'lucide-react'
import LearnProSidebar from '../components/LearnProSidebar'
import { useApi } from '../hooks/useApi'
import { api, studentDashboardStorage, type StudentCourse } from '../services/api'

const formatDate = (value?: string | null) => {
  if (!value) return '-'

  return new Intl.DateTimeFormat('th-TH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

const certificateIdFor = (item: StudentCourse, userId: string) =>
  `MC-${userId.slice(-4).toUpperCase()}-${item.course.id.slice(-6).toUpperCase()}`

function CertificatePreview({ item, studentName, certificateId }: { item: StudentCourse; studentName: string; certificateId: string }) {
  return (
    <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-200 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-400">Certificate Preview</p>
        <h2 className="mt-2 text-lg font-semibold text-black">ตัวอย่างใบประกาศนียบัตร</h2>
      </div>

      <div className="p-5">
        <div className="relative overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 p-7 sm:p-9">
          <div className="absolute right-6 top-6 text-zinc-200">
            <Award size={96} strokeWidth={1.3} />
          </div>
          <div className="relative">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-black text-white">
                <BookOpenCheck size={22} />
              </span>
              <div>
                <p className="text-sm font-semibold text-black">My Course</p>
                <p className="text-xs text-zinc-500">Online Learning Certificate</p>
              </div>
            </div>

            <div className="my-10 border-y border-zinc-200 py-9 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">Certificate of Completion</p>
              <h3 className="mt-5 text-3xl font-semibold tracking-tight text-black sm:text-4xl">{studentName}</h3>
              <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-zinc-600">
                ได้เรียนจบคอร์ส <span className="font-semibold text-black">{item.course.title}</span> ครบตามเงื่อนไขของระบบ
              </p>
            </div>

            <div className="grid gap-4 text-sm sm:grid-cols-3">
              <div>
                <p className="text-xs text-zinc-500">เลขที่ใบประกาศ</p>
                <p className="mt-1 font-semibold text-black">{certificateId}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">วันที่เรียนจบ</p>
                <p className="mt-1 font-semibold text-black">{formatDate(item.enrollment.lastAccessedAt ?? item.enrollment.joinedAt)}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">ผู้สอน</p>
                <p className="mt-1 font-semibold text-black">{item.course.instructor.name}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function CertificateRow({
  item,
  active,
  onSelect,
}: {
  item: StudentCourse
  active: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      className={[
        'flex w-full flex-col gap-4 border-b border-zinc-200 p-4 text-left transition last:border-b-0 md:flex-row md:items-center',
        active ? 'bg-zinc-50' : 'bg-white hover:bg-zinc-50',
      ].join(' ')}
      onClick={onSelect}
    >
      <div className="relative h-20 w-full overflow-hidden rounded-md bg-black md:w-32">
        <img src={item.course.coverImage} alt={item.course.title} className="h-full w-full object-cover opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-tr from-black via-black/45 to-transparent" />
        <Trophy className="absolute bottom-3 left-3 text-white" size={24} />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-1 text-base font-semibold text-black">{item.course.title}</h3>
        <p className="mt-1 text-sm text-zinc-500">โดย {item.course.instructor.name}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-600">
          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1">
            <CalendarDays size={13} />
            จบเมื่อ {formatDate(item.enrollment.lastAccessedAt ?? item.enrollment.joinedAt)}
          </span>
          <span className="rounded-full bg-black px-3 py-1 font-semibold text-white">เรียนครบ 100%</span>
        </div>
      </div>
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-black">
        <ChevronRight size={18} />
      </span>
    </button>
  )
}

export default function StudentCertificates() {
  const { data, error, loading } = useApi(() => api.getStudentDashboard(), [], studentDashboardStorage.get())
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null)

  const completedCourses = useMemo(
    () => (data?.courses ?? []).filter((item) => item.enrollment.progress >= 100),
    [data?.courses],
  )
  const selectedCertificate = completedCourses.find((item) => item.course.id === selectedCourseId) ?? completedCourses[0] ?? null
  const profileName = data?.profile.name || data?.user.name || 'ผู้เรียน'

  if (loading && !data) {
    return <div className="min-h-screen bg-white p-6 text-sm text-zinc-500">กำลังโหลดใบประกาศนียบัตร...</div>
  }

  if (error && !data) {
    return <div className="min-h-screen bg-white p-6 text-sm text-rose-600">{error}</div>
  }

  if (!data) return null

  return (
    <div className="student-page-shell">
      <LearnProSidebar
        active="certificates"
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
                placeholder="ค้นหาใบประกาศนียบัตร..."
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
              <p className="text-sm font-semibold text-zinc-500">ใบประกาศนียบัตรของฉัน</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-black sm:text-4xl">
                เก็บความสำเร็จจากคอร์สที่เรียนจบ
              </h1>
              <p className="mt-3 text-base leading-7 text-zinc-600">
                ใบประกาศจะแสดงจากคอร์สที่คุณเรียนครบ 100% โดยอิงจากความคืบหน้าจริงในระบบ
              </p>
            </div>
            <div className="pointer-events-none absolute right-10 top-1/2 hidden -translate-y-1/2 lg:block">
              <Sparkles className="text-black" size={72} strokeWidth={1.5} />
            </div>
          </section>

          <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_520px]">
            <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-zinc-200 p-5">
                <div>
                  <h2 className="text-lg font-semibold text-black">รายการใบประกาศ</h2>
                  <p className="mt-1 text-sm text-zinc-500">ทั้งหมด {completedCourses.length} ใบ</p>
                </div>
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-black text-white">
                  <Trophy size={21} />
                </span>
              </div>

              {completedCourses.length > 0 ? (
                completedCourses.map((item) => (
                  <CertificateRow
                    key={item.course.id}
                    item={item}
                    active={selectedCertificate?.course.id === item.course.id}
                    onSelect={() => setSelectedCourseId(item.course.id)}
                  />
                ))
              ) : (
                <div className="p-10 text-center">
                  <span className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 text-black">
                    <Trophy size={28} />
                  </span>
                  <h3 className="mt-5 text-xl font-semibold text-black">ยังไม่มีใบประกาศนียบัตร</h3>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-zinc-500">
                    เมื่อเรียนคอร์สครบ 100% ใบประกาศของคอร์สนั้นจะแสดงที่หน้านี้โดยอัตโนมัติ
                  </p>
                  <Link
                    to="/student?section=my-courses"
                    className="mt-6 inline-flex h-11 items-center justify-center rounded-md bg-black px-5 text-sm font-semibold text-white transition hover:bg-zinc-800"
                  >
                    กลับไปเรียนต่อ
                  </Link>
                </div>
              )}
            </section>

            <aside className="space-y-5">
              {selectedCertificate ? (
                <>
                  <CertificatePreview
                    item={selectedCertificate}
                    studentName={profileName}
                    certificateId={certificateIdFor(selectedCertificate, data.user.id)}
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-black px-5 text-sm font-semibold text-white transition hover:bg-zinc-800"
                      onClick={() => window.print()}
                    >
                      <Printer size={17} />
                      พิมพ์ใบประกาศ
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-zinc-200 bg-white px-5 text-sm font-semibold text-black transition hover:border-black"
                      onClick={() => window.print()}
                    >
                      <Download size={17} />
                      ดาวน์โหลด
                    </button>
                  </div>
                </>
              ) : null}
            </aside>
          </div>
        </div>
      </main>
    </div>
  )
}
