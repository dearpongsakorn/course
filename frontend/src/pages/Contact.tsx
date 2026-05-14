import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Clock3, Mail, MessageCircle, Send, ShieldCheck } from 'lucide-react'

const contactCards = [
  {
    icon: Mail,
    title: 'อีเมลทีมงาน',
    value: 'support@mycourse.app',
    description: 'เหมาะสำหรับคำถามเรื่องบัญชี คอร์ส และการชำระเงิน',
    href: 'mailto:support@mycourse.app',
  },
  {
    icon: Clock3,
    title: 'เวลาตอบกลับ',
    value: 'ภายใน 1 วันทำการ',
    description: 'แนบชื่อคอร์สหรืออีเมลบัญชีผู้ใช้เพื่อให้ตรวจสอบได้เร็วขึ้น',
  },
  {
    icon: ShieldCheck,
    title: 'ฝ่ายผู้สอน',
    value: 'Course support',
    description: 'ช่วยดูเรื่องอัปโหลดวิดีโอ จัดบทเรียน และข้อมูลโปรไฟล์ผู้สอน',
  },
]

export default function Contact() {
  const [sent, setSent] = useState(false)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    event.currentTarget.reset()
    setSent(true)
  }

  return (
    <>
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <img
          src="/my-course-logo.png"
          alt="My Course support logo"
          className="absolute inset-0 h-full w-full bg-white object-contain opacity-20"
        />
        <div className="absolute inset-0 bg-slate-950/75" />
        <div className="container-page relative grid min-h-[440px] gap-8 py-16 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-center">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-semibold leading-tight text-white sm:text-5xl">ติดต่อเรา</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-200 sm:text-lg">
              ส่งคำถามถึงทีม My Course ได้ทั้งเรื่องการใช้งาน บัญชีผู้เรียน การจัดคอร์สของคุณครู
              หรือปัญหาในหน้าเรียน เราจะช่วยไล่ให้เป็นขั้นตอน
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="mailto:support@mycourse.app"
                className="inline-flex items-center justify-center gap-2 rounded-md bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-sm shadow-black/20 transition hover:bg-slate-200"
              >
                <Mail size={17} />
                ส่งอีเมล
              </a>
              <Link
                to="/courses"
                className="inline-flex items-center justify-center gap-2 rounded-md border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white hover:text-slate-950"
              >
                ดูคอร์สทั้งหมด
                <ArrowRight size={17} />
              </Link>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/10 p-5 shadow-2xl shadow-black/30 backdrop-blur">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-white text-slate-950">
                <MessageCircle size={20} />
              </span>
              <div>
                <p className="font-semibold text-white">Support desk</p>
                <p className="mt-1 text-sm text-slate-300">พร้อมรับเรื่องจากผู้เรียนและผู้สอน</p>
              </div>
            </div>
            <div className="mt-5 space-y-3 border-t border-white/10 pt-5 text-sm text-slate-200">
              <div className="flex items-center justify-between gap-4">
                <span>สถานะ</span>
                <span className="font-semibold text-emerald-300">เปิดรับข้อความ</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>ช่องทางหลัก</span>
                <span className="font-semibold">อีเมล + ฟอร์ม</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>เหมาะกับ</span>
                <span className="font-semibold">Course platform</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container-page py-12 sm:py-16">
        <div className="grid gap-4 md:grid-cols-3">
          {contactCards.map((item) => {
            const Icon = item.icon
            const cardContent = (
              <>
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-slate-950 text-white dark:bg-white dark:text-slate-950">
                  <Icon size={18} />
                </span>
                <h2 className="mt-4 text-base font-semibold text-slate-950">{item.title}</h2>
                <p className="mt-2 text-sm font-semibold text-slate-700">{item.value}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
              </>
            )

            return item.href ? (
              <a key={item.title} href={item.href} className="card p-5 transition hover:-translate-y-0.5 hover:border-slate-300">
                {cardContent}
              </a>
            ) : (
              <div key={item.title} className="card p-5">
                {cardContent}
              </div>
            )
          })}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <form className="card p-5 sm:p-6" onSubmit={handleSubmit}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">ส่งข้อความถึงเรา</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  ระบุรายละเอียดให้ชัด เช่น ชื่อคอร์ส บัญชีที่ใช้ และปัญหาที่เจอ เพื่อให้ทีมงานช่วยตรวจได้เร็ว
                </p>
              </div>
              <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100 sm:inline-flex">
                <Send size={18} />
              </span>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label>
                <span className="field-label">ชื่อ</span>
                <input className="field-input" name="name" placeholder="ชื่อของคุณ" required />
              </label>
              <label>
                <span className="field-label">อีเมล</span>
                <input className="field-input" name="email" type="email" placeholder="you@example.com" required />
              </label>
              <label className="sm:col-span-2">
                <span className="field-label">หัวข้อ</span>
                <input className="field-input" name="subject" placeholder="เช่น อัปโหลดวิดีโอไม่ได้" required />
              </label>
              <label className="sm:col-span-2">
                <span className="field-label">ข้อความ</span>
                <textarea
                  className="field-input min-h-[160px] resize-y"
                  name="message"
                  placeholder="เล่ารายละเอียดที่ต้องการให้ทีมงานช่วยดู"
                  required
                />
              </label>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {sent ? (
                <p className="text-sm text-emerald-700">รับข้อความไว้แล้ว ทีมงานจะติดต่อกลับตามข้อมูลที่ระบุ</p>
              ) : null}
              <button type="submit" className="btn-primary sm:ml-auto">
                <Send size={16} />
                ส่งข้อความ
              </button>
            </div>
          </form>

          <aside className="card h-fit p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-slate-950">ก่อนส่งข้อความ</h2>
            <div className="mt-5 space-y-4 text-sm leading-6 text-slate-600">
              <p>ถ้าเป็นปัญหาหน้าเรียน ให้แนบชื่อคอร์ส ชื่อบทเรียน และอธิบายขั้นตอนที่ทำก่อนเกิดปัญหา</p>
              <p>ถ้าเป็นปัญหาผู้สอน ให้อธิบายว่าเกิดในขั้นตอนสร้างคอร์ส อัปโหลดวิดีโอ หรือแก้ไขบทเรียน</p>
              <p>ข้อมูลที่ครบจะช่วยให้ทีมงานตอบกลับได้ตรงจุดและเร็วขึ้น</p>
            </div>
          </aside>
        </div>
      </section>
    </>
  )
}
