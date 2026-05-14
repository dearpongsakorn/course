import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  BookOpen,
  Bot,
  ChevronRight,
  Home as HomeIcon,
  MonitorSmartphone,
  MoreVertical,
  PlayCircle,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  UserRound,
  Video,
} from 'lucide-react'
import { useApi } from '../hooks/useApi'
import { api } from '../services/api'
import type { Course } from '../types/course'

const featureHighlights = [
  {
    icon: Video,
    title: 'คอร์สคุณภาพ',
    description: 'เนื้อหาจากผู้สอนเชี่ยวชาญ และอัปเดตอยู่เสมอ',
  },
  {
    icon: Sparkles,
    title: 'AI ช่วยเรียนรู้',
    description: 'สรุปเนื้อหา ตอบคำถาม และแนะนำสิ่งที่ควรเรียน',
  },
  {
    icon: ShieldCheck,
    title: 'ใบรับรอง',
    description: 'รับใบรับรองเมื่อเรียนจบ เพิ่มโอกาสในหน้าที่การงาน',
  },
  {
    icon: MonitorSmartphone,
    title: 'เรียนได้ทุกอุปกรณ์',
    description: 'รองรับทุกอุปกรณ์ เรียนได้ทุกที่ ทุกเวลา',
  },
]

const showcaseCourses = [
  ['UI/UX Design Fundamentals', 'Lesson 8 • Color & Typography', '65%', 'UI/UX'],
  ['React Mastery Course', 'โดย Code Master', '75%', '⚛'],
  ['AI for Beginners', 'โดย AI Academy', '40%', 'AI'],
  ['Figma UI Design', 'โดย Design Hub', '90%', 'F'],
]

const sidebarItems = [BookOpen, HomeIcon, PlayCircle, ShieldCheck, Bot, Trophy, UserRound]

const formatPrice = (price: number) =>
  new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0,
  }).format(price)

function CourseTile({ course }: { course: Course }) {
  return (
    <Link
      to={`/courses/${course.slug}`}
      className="group min-w-[218px] rounded-[10px] border border-zinc-200 bg-white p-4 shadow-[0_14px_36px_rgba(0,0,0,0.05)] transition hover:-translate-y-1 hover:border-zinc-950 hover:shadow-[0_18px_42px_rgba(0,0,0,0.09)]"
    >
      <div className="flex items-start gap-3">
        <img
          src={course.coverImage}
          alt={course.title}
          className="h-14 w-14 rounded-[8px] bg-black object-cover ring-1 ring-zinc-200"
        />
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-sm font-bold leading-5 text-black">{course.title}</h3>
          <p className="mt-1 truncate text-xs text-zinc-500">{course.instructor.name}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-1.5 text-xs text-zinc-700">
        <Star size={13} className="fill-black text-black" />
        <span>{course.rating}</span>
        <span className="text-zinc-400">({course.students.toLocaleString('th-TH')})</span>
      </div>
      <p className="mt-6 text-lg font-extrabold tracking-tight text-black">
        {course.price === 0 ? 'ฟรี' : formatPrice(course.price)}
      </p>
    </Link>
  )
}

function DashboardPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[680px] overflow-hidden rounded-[18px] border border-zinc-200 bg-white shadow-[0_24px_70px_rgba(0,0,0,0.10)]">
      <div className="grid min-h-[480px] grid-cols-[64px_minmax(0,1fr)]">
        <aside className="flex flex-col items-center justify-between bg-black py-7 text-white">
          <div className="space-y-7">
            <BookOpen size={27} className="fill-white" />
            <div className="space-y-4">
              {sidebarItems.slice(1).map((Icon, index) => (
                <span
                  key={index}
                  className={`flex h-10 w-10 items-center justify-center rounded-[8px] ${
                    index === 0 ? 'bg-white/12' : 'text-white/80'
                  }`}
                >
                  <Icon size={17} />
                </span>
              ))}
            </div>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-[8px] text-white/70">
            <ArrowRight size={16} />
          </span>
        </aside>

        <div className="p-7 sm:p-9">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight text-black">Hello, John 👋</h2>
              <p className="mt-2 text-sm font-medium text-zinc-700">พร้อมเรียนรู้อะไรใหม่ ๆ วันนี้?</p>
            </div>
            <div className="flex items-center gap-4">
              <Search size={20} />
              <Bell size={19} />
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-zinc-700">
                <UserRound size={18} />
              </span>
            </div>
          </div>

          <div className="mt-10">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-bold text-black">เรียนต่อ</p>
            </div>
            <div className="flex items-center gap-4 rounded-[12px] border border-zinc-200 bg-white p-5 shadow-[0_12px_32px_rgba(0,0,0,0.06)]">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[8px] bg-black text-center text-xs font-bold leading-4 text-white">
                UI/UX
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-black">UI/UX Design Fundamentals</p>
                <p className="mt-1 text-xs text-zinc-500">Lesson 8 • Color & Typography</p>
              </div>
              <div className="hidden h-1 w-24 overflow-hidden rounded-full bg-zinc-200 sm:block">
                <div className="h-full w-[65%] rounded-full bg-black" />
              </div>
              <span className="text-sm font-semibold text-zinc-700">65%</span>
              <button type="button" className="rounded-[8px] bg-black px-4 py-2 text-xs font-bold text-white">
                เรียนต่อ
              </button>
              <ChevronRight size={17} />
            </div>
          </div>

          <div className="mt-8">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-bold text-black">คอร์สของฉัน</p>
              <Link to="/courses" className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500">
                ดูทั้งหมด
                <ArrowRight size={13} />
              </Link>
            </div>
            <div className="space-y-3">
              {showcaseCourses.slice(1).map(([title, owner, progress, mark], index) => (
                <div key={title} className="grid grid-cols-[48px_minmax(0,1fr)_80px_72px_20px] items-center gap-4 border-b border-zinc-100 py-2 last:border-b-0">
                  <div className="flex h-12 w-12 items-center justify-center rounded-[8px] bg-black text-sm font-bold text-white">
                    {mark}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-black">{title}</p>
                    <p className="mt-1 truncate text-xs text-zinc-500">{owner}</p>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-zinc-200">
                    <div
                      className="h-full rounded-full bg-black"
                      style={{ width: progress }}
                    />
                  </div>
                  <button type="button" className="rounded-[8px] border border-zinc-200 px-3 py-2 text-xs font-bold text-black">
                    {index === 2 ? 'ดูเนื้อหา' : 'เรียนต่อ'}
                  </button>
                  <MoreVertical size={16} className="text-zinc-500" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  const { data: popularCourses, error, loading } = useApi(() => api.getCourses({ popular: true }), [])
  const courses = popularCourses?.slice(0, 5) ?? []
  const hasPopularCourses = courses.length > 0

  return (
    <div className="bg-white text-black">
      <section className="container-page grid gap-12 pb-14 pt-14 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:pb-16 lg:pt-16">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900">
            <Sparkles size={15} />
            เรียนได้ทุกที่ ทุกเวลา
          </div>
          <h1 className="mt-8 max-w-[560px] text-[44px] font-black leading-[1.08] tracking-[0] text-black sm:text-[60px] lg:text-[64px]">
            เรียนรู้ทักษะใหม่
            <br />
            เพื่ออนาคตที่ดีกว่า
          </h1>
          <p className="mt-7 max-w-[430px] text-lg leading-9 text-zinc-600">
            แพลตฟอร์มคอร์สออนไลน์คุณภาพสูง พร้อม AI ช่วยสรุปเนื้อหา ตอบคำถาม
            และแนะนำสิ่งที่คุณควรเรียน
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/courses"
              className="inline-flex h-14 items-center justify-center gap-3 rounded-[8px] bg-black px-9 text-base font-bold text-white shadow-[0_12px_24px_rgba(0,0,0,0.18)] transition hover:bg-zinc-800"
            >
              เริ่มเรียนฟรี
              <ArrowRight size={19} />
            </Link>
            <Link
              to="/courses"
              className="inline-flex h-14 items-center justify-center gap-3 rounded-[8px] border border-zinc-300 bg-white px-8 text-base font-bold text-black transition hover:border-black"
            >
              <PlayCircle size={19} />
              สำรวจคอร์ส
            </Link>
          </div>
          <div className="mt-11 flex items-center gap-4">
            <div className="flex -space-x-3">
              {['A', 'B', 'C', 'D'].map((letter) => (
                <span key={letter} className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-zinc-200 text-xs font-bold text-zinc-700">
                  {letter}
                </span>
              ))}
            </div>
            <p className="text-sm leading-6 text-zinc-600">
              มีผู้เรียนแล้วมากกว่า 50,000 คน
              <br />
              จาก 120+ ประเทศทั่วโลก
            </p>
          </div>
        </div>

        <DashboardPreview />
      </section>

      <section id="features" className="container-page py-8">
        <div className="grid overflow-hidden rounded-[10px] bg-zinc-50 shadow-[0_18px_48px_rgba(0,0,0,0.04)] sm:grid-cols-2 lg:grid-cols-4">
          {featureHighlights.map((feature, index) => {
            const Icon = feature.icon

            return (
              <article key={feature.title} className={`p-8 ${index > 0 ? 'border-zinc-200 lg:border-l' : ''}`}>
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-black">
                  <Icon size={24} />
                </span>
                <h2 className="mt-7 text-lg font-extrabold text-black">{feature.title}</h2>
                <p className="mt-2 text-sm leading-7 text-zinc-600">{feature.description}</p>
              </article>
            )
          })}
        </div>
      </section>

      <section id="pricing" className="container-page py-12">
        <div className="mb-7 flex items-center justify-between gap-4">
          <h2 className="text-2xl font-extrabold tracking-tight text-black">คอร์สยอดนิยม</h2>
          <Link to="/courses" className="inline-flex items-center gap-2 text-sm font-semibold text-black">
            ดูทั้งหมด
            <ArrowRight size={16} />
          </Link>
        </div>

        {loading ? (
          <div className="rounded-[10px] border border-zinc-200 bg-white p-6 text-sm text-zinc-500">กำลังโหลดคอร์ส...</div>
        ) : null}
        {error ? (
          <div className="rounded-[10px] border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">{error}</div>
        ) : null}
        {!loading && !error && hasPopularCourses ? (
          <div className="relative">
            <button type="button" className="absolute -left-5 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-200 bg-white shadow-[0_10px_24px_rgba(0,0,0,0.08)] lg:flex">
              <ArrowLeft size={18} />
            </button>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {courses.map((course) => (
                <CourseTile key={course.id} course={course} />
              ))}
            </div>
            <button type="button" className="absolute -right-5 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-200 bg-white shadow-[0_10px_24px_rgba(0,0,0,0.08)] lg:flex">
              <ArrowRight size={18} />
            </button>
          </div>
        ) : null}
        {!loading && !error && !hasPopularCourses ? (
          <div className="rounded-[10px] border border-zinc-200 bg-white p-7 shadow-[0_14px_36px_rgba(0,0,0,0.05)]">
            <h3 className="text-lg font-extrabold text-black">ยังไม่ได้ตั้งคอร์สยอดนิยม</h3>
            <p className="mt-2 text-sm leading-7 text-zinc-600">
              เมื่อ admin ตั้งคอร์สเป็นยอดนิยม รายการจะแสดงตรงนี้โดยอัตโนมัติ
            </p>
          </div>
        ) : null}
      </section>

      <section id="about" className="container-page py-8">
        <article className="rounded-[10px] bg-zinc-50 px-8 py-9 shadow-[0_18px_48px_rgba(0,0,0,0.04)] sm:px-12">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="flex gap-8">
              <span className="text-6xl font-black leading-none text-zinc-500">“</span>
              <div>
                <p className="max-w-xl text-xl font-semibold leading-9 text-black">
                  เนื้อหาดี เข้าใจง่าย และมี AI ช่วยสรุปให้ด้วย ทำให้เรียนรู้ได้เร็วและสนุกมากครับ
                </p>
                <div className="mt-7 flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-200 text-zinc-700">
                    <UserRound size={20} />
                  </span>
                  <div>
                    <p className="font-bold text-black">ณัฐวุฒิ ป.</p>
                    <p className="text-sm text-zinc-500">Frontend Developer</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-2 lg:justify-end">
              <span className="h-2.5 w-4 rounded-full bg-black" />
              <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
            </div>
          </div>
        </article>
      </section>

      <section className="container-page py-14 text-center">
        <h2 className="text-3xl font-extrabold tracking-tight text-black">พร้อมเริ่มต้นการเรียนรู้แล้วหรือยัง?</h2>
        <p className="mt-3 text-base text-zinc-600">สมัครฟรีวันนี้ และเริ่มเรียนได้ทันที</p>
        <Link
          to="/courses"
          className="mt-8 inline-flex h-14 items-center justify-center gap-3 rounded-[8px] bg-black px-9 text-base font-bold text-white shadow-[0_12px_24px_rgba(0,0,0,0.18)] transition hover:bg-zinc-800"
        >
          เริ่มเรียนฟรี
          <ArrowRight size={19} />
        </Link>
      </section>
    </div>
  )
}
