import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Fingerprint,
  Bot,
  CheckCircle2,
  MessageSquareText,
  PlayCircle,
  Sparkles,
} from 'lucide-react'
import CourseCard from '../components/CourseCard'
import { useApi } from '../hooks/useApi'
import { api } from '../services/api'

const features = [
  {
    icon: PlayCircle,
    title: 'เรียนผ่านวิดีโอ',
    description: 'จัดบทเรียนเป็นลำดับ พร้อม progress และ preview ก่อนซื้อ',
  },
  {
    icon: Sparkles,
    title: 'AI สรุปเนื้อหา',
    description: 'สรุปประเด็นสำคัญของแต่ละบทให้ผู้เรียนทบทวนได้เร็ว',
  },
  {
    icon: MessageSquareText,
    title: 'ถามตอบกับ AI',
    description: 'ถามคำถามจาก context ของวิดีโอและรับคำตอบแบบเข้าใจง่าย',
  },
  {
    icon: Bot,
    title: 'สร้าง Quiz อัตโนมัติ',
    description: 'แบบทดสอบมีตัวเลือก เฉลย และคำอธิบายสำหรับการทบทวน',
  },
]

export default function Home() {
  const { data: popularCourses, error, loading } = useApi(() => api.getCourses({ popular: true }), [])

  return (
    <>
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <img
          src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1800&q=80"
          alt="Online learning workspace"
          className="absolute inset-0 h-full w-full object-cover opacity-35"
        />
        <div className="absolute inset-0 bg-slate-950/70" />
        <div className="container-page relative flex min-h-[560px] items-center py-16 sm:min-h-[620px]">
          <div className="max-w-3xl">
            <p className="mb-4 text-sm font-medium text-slate-200">Modern Online Course App</p>
            <h1 className="text-4xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl">
              แพลตฟอร์มคอร์สออนไลน์สำหรับผู้เรียนและคุณครู
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-200 sm:text-lg">
              สร้าง เรียน และจัดการคอร์สผ่านวิดีโอ พร้อม AI Summary, Ask AI และ Quiz
              โดยข้อมูลคอร์สทั้งหมดมาจากฐานข้อมูลจริงผ่าน backend API
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/login" className="btn-primary bg-white text-slate-950 hover:bg-slate-200">
                <Fingerprint size={17} />
                เข้าสู่ระบบ
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white">
        <div className="container-page grid gap-4 py-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => {
            const Icon = feature.icon

            return (
              <div key={feature.title} className="rounded-lg border border-slate-200 p-5">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-slate-950 text-white">
                  <Icon size={18} />
                </span>
                <h2 className="mt-4 text-base font-semibold text-slate-950">{feature.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{feature.description}</p>
              </div>
            )
          })}
        </div>
      </section>

      <section className="container-page py-12 sm:py-16">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="section-title">คอร์สยอดนิยม</h2>
            <p className="section-subtitle">
              รายการนี้ถูกโหลดจาก PostgreSQL ผ่าน backend API ไม่ได้ฝังข้อมูลไว้ใน frontend
            </p>
          </div>
          <Link to="/login" className="btn-secondary w-fit">
            ไปที่ Dashboard
            <ArrowRight size={16} />
          </Link>
        </div>

        {loading && <div className="card mt-8 p-6 text-sm text-slate-500">กำลังโหลดคอร์สจากฐานข้อมูล...</div>}
        {error && <div className="card mt-8 p-6 text-sm text-rose-600">{error}</div>}
        {!loading && !error && (
          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {(popularCourses ?? []).map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        )}
      </section>

      <section className="bg-white">
        <div className="container-page grid gap-8 py-12 sm:py-16 lg:grid-cols-[1fr_420px] lg:items-center">
          <div>
            <h2 className="section-title">พร้อมต่อยอดเป็นระบบ production</h2>
            <p className="section-subtitle">
              Frontend แยกชั้น API client ชัดเจน ส่วน backend เชื่อม PostgreSQL และ Docker compose
              มี service ฐานข้อมูลพร้อมใช้งาน
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {['PostgreSQL database', 'Backend API routes', 'Docker compose', 'Role-based dashboards'].map(
                (item) => (
                  <div key={item} className="flex items-center gap-3 text-sm text-slate-700">
                    <CheckCircle2 size={17} className="text-slate-950" />
                    {item}
                  </div>
                ),
              )}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-950 p-5 text-white">
            <div className="grid grid-cols-2 gap-3">
              {[
                ['DB', 'PostgreSQL'],
                ['API', 'Node.js'],
                ['UI', 'React + TS'],
                ['AI', 'พร้อมเชื่อมต่อ'],
              ].map(([value, label]) => (
                <div key={label} className="rounded-lg border border-white/10 bg-white/5 p-4">
                  <p className="text-2xl font-semibold">{value}</p>
                  <p className="mt-1 text-sm text-slate-300">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
