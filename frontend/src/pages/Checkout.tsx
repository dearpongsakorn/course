import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle2, CreditCard, LoaderCircle, ShieldCheck } from 'lucide-react'
import { api, authStorage } from '../services/api'
import type { Course } from '../types/course'

const formatPrice = (price: number) =>
  new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0,
  }).format(price)

export default function Checkout() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const session = authStorage.getSession()
  const [course, setCourse] = useState<Course | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    setLoading(true)
    setError(null)

    api
      .getCourse(slug)
      .then((result) => {
        if (active) setCourse(result)
      })
      .catch((currentError: Error) => {
        if (active) setError(currentError.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [slug])

  const startLearningPath = course?.viewerState?.enrollment?.lastLessonId
    ? `/learn/${course.slug}?lesson=${course.viewerState.enrollment.lastLessonId}`
    : course
      ? `/learn/${course.slug}`
      : '/student'

  const handleCheckout = async () => {
    if (!course) return

    if (!session) {
      navigate('/login')
      return
    }

    if (session.user.role !== 'student') {
      navigate(session.dashboardPath)
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const result = await api.enrollCourse(course.slug)
      navigate(
        result.enrollment.lastLessonId
          ? `/learn/${course.slug}?lesson=${result.enrollment.lastLessonId}`
          : `/learn/${course.slug}`,
        { replace: true },
      )
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : 'ซื้อคอร์สไม่สำเร็จ')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <section className="container-page py-16">
        <div className="card p-8 text-sm text-slate-500">กำลังโหลดหน้าชำระเงิน...</div>
      </section>
    )
  }

  if (!course) {
    return (
      <section className="container-page py-16">
        <div className="card p-8 text-center">
          <h1 className="text-2xl font-semibold text-slate-950">ไม่พบคอร์ส</h1>
          <p className="mt-2 text-sm text-slate-500">{error ?? 'ไม่พบรายการที่ต้องการซื้อ'}</p>
          <Link to="/courses" className="btn-primary mt-6">
            กลับไปดูคอร์สทั้งหมด
          </Link>
        </div>
      </section>
    )
  }

  const isEnrolled = Boolean(course.viewerState?.isEnrolled)
  const totalPrice = course.price

  return (
    <section className="min-h-[calc(100vh-64px)] bg-slate-100 py-8 dark:bg-slate-950">
      <div className="container-page">
        <Link to={`/courses/${course.slug}`} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-950">
          <ArrowLeft size={16} />
          กลับไปหน้าคอร์ส
        </Link>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="card overflow-hidden">
            <div className="border-b border-slate-200 p-5 sm:p-6">
              <p className="text-sm font-semibold text-slate-500">Checkout</p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-950">ยืนยันการซื้อคอร์ส</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                ตรวจสอบคอร์สก่อนยืนยัน เมื่อซื้อแล้วคอร์สจะแสดงในหน้า Student Dashboard ทันที
              </p>
            </div>

            <div className="p-5 sm:p-6">
              <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900">
                <div className="flex flex-col gap-4 sm:flex-row">
                  <img src={course.coverImage} alt={course.title} className="aspect-video w-full rounded-lg object-cover sm:w-56" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap gap-2 text-xs font-semibold">
                      <span className="rounded-md bg-slate-100 px-2.5 py-1 text-slate-700">{course.category}</span>
                      <span className="rounded-md border border-slate-200 px-2.5 py-1 text-slate-600">{course.level}</span>
                      {isEnrolled ? (
                        <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-emerald-700">ซื้อแล้ว</span>
                      ) : null}
                    </div>
                    <h2 className="mt-3 text-xl font-semibold text-slate-950">{course.title}</h2>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{course.description}</p>
                    <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
                      <span>{course.lessons.length} บทเรียน</span>
                      <span>{course.duration}</span>
                      <span>{course.rating} คะแนน</span>
                    </div>
                  </div>
                </div>
              </article>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {['เข้าถึงบทเรียนทั้งหมด', 'เรียนต่อจากครั้งล่าสุด', 'AI Summary และ Quiz'].map((item) => (
                  <div key={item} className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-700">
                    <CheckCircle2 size={17} className="mb-2 text-emerald-600" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside className="card h-fit overflow-hidden lg:sticky lg:top-24">
            <div className="border-b border-slate-200 p-5">
              <h2 className="text-lg font-semibold text-slate-950">สรุปรายการ</h2>
            </div>
            <div className="space-y-4 p-5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">ราคาคอร์ส</span>
                <span className="font-semibold text-slate-950">{course.price === 0 ? 'ฟรี' : formatPrice(course.price)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 pt-4">
                <span className="font-semibold text-slate-950">รวมทั้งหมด</span>
                <span className="text-2xl font-semibold text-slate-950">{formatPrice(totalPrice)}</span>
              </div>

              {isEnrolled ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                  <div className="flex items-center gap-2 font-semibold">
                    <CheckCircle2 size={17} />
                    คุณซื้อคอร์สนี้แล้ว
                  </div>
                  <p className="mt-2 leading-6">สามารถกลับไปเรียนต่อได้ทันทีจากบทล่าสุด</p>
                </div>
              ) : null}

              {error ? <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}

              {isEnrolled ? (
                <Link to={startLearningPath} className="btn-primary w-full py-3">
                  เรียนต่อ
                  <ArrowRight size={16} />
                </Link>
              ) : (
                <button type="button" className="btn-primary w-full py-3" onClick={handleCheckout} disabled={submitting}>
                  {submitting ? <LoaderCircle size={16} className="animate-spin" /> : <CreditCard size={16} />}
                  {submitting ? 'กำลังยืนยัน...' : course.price === 0 ? 'ลงทะเบียนเรียนฟรี' : 'ยืนยันซื้อคอร์ส'}
                </button>
              )}

              <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-500">
                <ShieldCheck size={16} className="mt-0.5 shrink-0 text-slate-700" />
                ระบบตัวอย่างนี้จะลงทะเบียนคอร์สให้ทันทีหลังยืนยัน โดยยังไม่เชื่อมต่อ payment gateway จริง
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  )
}
