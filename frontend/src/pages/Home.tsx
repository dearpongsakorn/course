import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock3,
  Fingerprint,
  GraduationCap,
  MessageSquareText,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
} from 'lucide-react'
import CourseCard from '../components/CourseCard'
import { useApi } from '../hooks/useApi'
import { api } from '../services/api'

const features = [
  {
    icon: PlayCircle,
    title: 'เรียนต่อเนื่องเป็นลำดับ',
    description: 'จัดบทเรียน วิดีโอ และ progress ไว้ในที่เดียว ผู้เรียนกลับมาเรียนต่อได้ง่าย',
  },
  {
    icon: Sparkles,
    title: 'AI สรุปบทเรียน',
    description: 'ช่วยจับประเด็นสำคัญจากเนื้อหา เพื่อให้ทบทวนได้เร็วขึ้นหลังเรียนจบแต่ละบท',
  },
  {
    icon: MessageSquareText,
    title: 'ถามตอบกับ AI',
    description: 'ถามคำถามจากเนื้อหาบทเรียน และเก็บประวัติการคุยไว้ต่อบทเรียน',
  },
  {
    icon: Bot,
    title: 'Quiz สำหรับทบทวน',
    description: 'สร้างแบบทดสอบจากบทเรียนพร้อมเฉลย เพื่อเช็กความเข้าใจก่อนเรียนต่อ',
  },
]

const stats = [
  { label: 'เส้นทางสำหรับผู้เรียน', value: 'Student', icon: GraduationCap },
  { label: 'ระบบผู้สอนจัดคอร์ส', value: 'Teacher', icon: Users },
  { label: 'คุมคอร์สยอดนิยม', value: 'Admin', icon: ShieldCheck },
]

const benefits = [
  'หน้าเรียนพร้อมวิดีโอ บทเรียน และเครื่องมือ AI',
  'ติดตามความคืบหน้ารายคอร์สและเรียนต่อจากครั้งล่าสุด',
  'ผู้สอนเพิ่มคอร์ส บทเรียน และวิดีโอได้จาก dashboard',
  'ผู้ดูแลเลือกคอร์สยอดนิยมบนหน้าแรกได้เอง',
]

const testimonials = [
  {
    name: 'มินตรา',
    role: 'ผู้เรียน',
    quote: 'หน้าเรียนต่อช่วยให้กลับมาเรียนได้เร็ว ไม่ต้องจำว่าค้างบทไหนไว้',
  },
  {
    name: 'ณัฐพล',
    role: 'ผู้สอน',
    quote: 'จัดบทเรียนและดูภาพรวมคอร์สได้ในที่เดียว เหมาะกับคอร์สออนไลน์จริง',
  },
  {
    name: 'ทีมดูแลระบบ',
    role: 'Admin',
    quote: 'เลือกคอร์สยอดนิยมและตรวจภาพรวมผู้ใช้ได้ง่ายขึ้นมาก',
  },
]

export default function Home() {
  const { data: popularCourses, error, loading } = useApi(() => api.getCourses({ popular: true }), [])
  const hasPopularCourses = Boolean(popularCourses?.length)

  return (
    <>
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <img
          src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1800&q=80"
          alt="Online learning workspace"
          className="absolute inset-0 h-full w-full object-cover opacity-35"
        />
        <div className="absolute inset-0 bg-slate-950/75" />
        <div className="container-page relative flex min-h-[600px] items-center py-16 sm:min-h-[660px]">
          <div className="max-w-3xl">
            <p className="mb-4 inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/10 px-3 py-1 text-sm font-medium text-slate-100">
              <Sparkles size={15} />
              Online Course Platform
            </p>
            <h1 className="text-4xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl">
              เรียนออนไลน์ให้ต่อเนื่อง พร้อม AI ช่วยสรุปและทบทวนบทเรียน
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-200 sm:text-lg">
              แพลตฟอร์มคอร์สออนไลน์สำหรับผู้เรียน ผู้สอน และผู้ดูแลระบบ ครบตั้งแต่หน้าคอร์ส วิดีโอเรียน
              dashboard ความคืบหน้า ไปจนถึงเครื่องมือ AI ในบทเรียน
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/courses" className="inline-flex items-center justify-center gap-2 rounded-md bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-sm shadow-black/20 transition hover:bg-slate-200">
                ดูคอร์สทั้งหมด
                <ArrowRight size={17} />
              </Link>
              <Link to="/login" className="inline-flex items-center justify-center gap-2 rounded-md border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white hover:text-slate-950">
                <Fingerprint size={17} />
                เข้าสู่ระบบ
              </Link>
            </div>
            <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
              {stats.map((stat) => {
                const Icon = stat.icon

                return (
                  <div key={stat.label} className="rounded-lg border border-white/10 bg-white/10 p-4">
                    <Icon size={18} className="text-slate-200" />
                    <p className="mt-3 text-xl font-semibold">{stat.value}</p>
                    <p className="mt-1 text-xs text-slate-300">{stat.label}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white dark:border-white/10 dark:bg-slate-950">
        <div className="container-page grid gap-4 py-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => {
            const Icon = feature.icon

            return (
              <div key={feature.title} className="rounded-lg border border-slate-200 p-5 dark:border-white/10 dark:bg-slate-900">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-slate-950 text-white dark:bg-white dark:text-slate-950">
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
              คอร์สที่ผู้ดูแลระบบเลือกให้แสดงบนหน้าแรก เพื่อช่วยให้ผู้เรียนเริ่มจากรายการที่แนะนำก่อน
            </p>
          </div>
          <Link to="/courses" className="btn-secondary w-fit">
            ดูคอร์สทั้งหมด
            <ArrowRight size={16} />
          </Link>
        </div>

        {loading && <div className="card mt-8 p-6 text-sm text-slate-500">กำลังโหลดคอร์ส...</div>}
        {error && <div className="card mt-8 p-6 text-sm text-rose-600">{error}</div>}
        {!loading && !error && hasPopularCourses ? (
          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {popularCourses?.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        ) : null}
        {!loading && !error && !hasPopularCourses ? (
          <div className="card mt-8 grid gap-5 overflow-hidden p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-white/10 dark:text-slate-300">
                <Star size={14} className="fill-amber-400 text-amber-400" />
                ยังไม่ได้ตั้งคอร์สยอดนิยม
              </span>
              <h3 className="mt-4 text-xl font-semibold text-slate-950">เลือกคอร์สเด่นจากหน้า Admin เพื่อแสดงตรงนี้</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                เมื่อ admin กดตั้งคอร์สเป็นยอดนิยม รายการจะมาแสดงบนหน้าแรกโดยอัตโนมัติ
                ทำให้หน้าเว็บไม่ต้องแก้โค้ดทุกครั้งที่ต้องการเปลี่ยนคอร์สแนะนำ
              </p>
            </div>
            <Link to="/admin" className="btn-primary justify-self-start lg:justify-self-end">
              ไปหน้า Admin
              <ArrowRight size={16} />
            </Link>
          </div>
        ) : null}
      </section>

      <section id="about" className="scroll-mt-20 bg-white dark:bg-slate-950">
        <div className="container-page grid gap-8 py-12 sm:py-16 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center">
          <div>
            <p className="text-sm font-semibold text-slate-500">ทำไมต้องเรียนกับเรา</p>
            <h2 className="section-title mt-2">ระบบที่ออกแบบให้เรียนต่อได้จริง ไม่ใช่แค่ดูวิดีโอจบแล้วหายไป</h2>
            <p className="section-subtitle">
              โครงสร้างเว็บเน้นการเรียนซ้ำ การทบทวน และการจัดการคอร์สให้ครบทั้งสามบทบาท
              โดยใช้ธีมดำขาวเป็นหลักและใช้สีเฉพาะสถานะสำคัญ
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {benefits.map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-lg border border-slate-200 p-4 text-sm leading-6 text-slate-700 dark:border-white/10 dark:text-slate-300">
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-500" />
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-950 p-5 text-white shadow-lg shadow-slate-300/40 dark:border-white/10 dark:shadow-black/30">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <p className="text-sm text-slate-300">Learning Health</p>
                <p className="mt-1 text-2xl font-semibold">พร้อมเรียนต่อ</p>
              </div>
              <Clock3 size={24} className="text-emerald-300" />
            </div>
            <div className="mt-5 space-y-4">
              {[
                ['Progress', 'ติดตามรายคอร์ส', '72%'],
                ['AI Tools', 'สรุป ถามตอบ Quiz', '3 โหมด'],
                ['Dashboard', 'ผู้เรียน ผู้สอน Admin', 'ครบ'],
              ].map(([label, description, value]) => (
                <div key={label} className="rounded-lg border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold">{label}</p>
                      <p className="mt-1 text-sm text-slate-300">{description}</p>
                    </div>
                    <p className="text-sm font-semibold text-emerald-300">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="container-page py-12 sm:py-16">
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="section-title">เสียงจากผู้ใช้งาน</h2>
            <p className="section-subtitle">ตัวอย่างมุมมองจากบทบาทหลักในระบบ</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {testimonials.map((item) => (
            <article key={item.name} className="card p-5">
              <div className="mb-4 flex gap-1 text-amber-400">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Star key={index} size={15} className="fill-current" />
                ))}
              </div>
              <p className="text-sm leading-6 text-slate-700">“{item.quote}”</p>
              <div className="mt-5 border-t border-slate-200 pt-4">
                <p className="font-semibold text-slate-950">{item.name}</p>
                <p className="mt-1 text-xs text-slate-500">{item.role}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  )
}
