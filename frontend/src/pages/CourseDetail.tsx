import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Clock3,
  CreditCard,
  PlayCircle,
  ShoppingCart,
  Star,
  Users,
} from 'lucide-react'
import VideoPlayer from '../components/VideoPlayer'
import { api, authStorage, cartStorage } from '../services/api'
import type { Course } from '../types/course'

const formatPrice = (price: number) =>
  new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0,
  }).format(price)

export default function CourseDetail() {
  const navigate = useNavigate()
  const { slug = '' } = useParams()
  const session = authStorage.getSession()
  const [course, setCourse] = useState<Course | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [enrolling, setEnrolling] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [cartAdded, setCartAdded] = useState(false)

  useEffect(() => {
    let active = true

    queueMicrotask(() => {
      if (!active) return

      setLoading(true)
      setError(null)
      setActionError(null)

      api
        .getCourse(slug)
        .then((result) => {
          if (!active) return

          if (result.viewerState?.role === 'student' && result.viewerState.isEnrolled) {
            const lastLessonId = result.viewerState.enrollment?.lastLessonId
            navigate(lastLessonId ? `/learn/${result.slug}?lesson=${lastLessonId}` : `/learn/${result.slug}`, {
              replace: true,
            })
            return
          }

          setCourse(result)
        })
        .catch((currentError: Error) => {
          if (active) setError(currentError.message)
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    })

    return () => {
      active = false
    }
  }, [navigate, slug])

  if (loading) {
    return (
      <section className="container-page py-16">
        <div className="card p-8 text-sm text-slate-500">กำลังโหลดรายละเอียดคอร์ส...</div>
      </section>
    )
  }

  if (error || !course) {
    return (
      <section className="container-page py-16">
        <div className="card p-8 text-center">
          <h1 className="text-2xl font-semibold text-slate-950">ไม่พบคอร์ส</h1>
          <p className="mt-2 text-sm text-slate-500">
            {error ?? 'คอร์สนี้อาจถูกลบหรือ URL ไม่ถูกต้อง'}
          </p>
          <Link to="/courses" className="btn-primary mt-6">
            กลับไปดูคอร์สทั้งหมด
          </Link>
        </div>
      </section>
    )
  }

  const previewLesson = course.lessons.find((lesson) => lesson.preview) ?? course.lessons[0]
  const viewerRole = course.viewerState?.role ?? session?.user.role ?? null
  const isStudent = viewerRole === 'student'
  const isEnrolled = course.viewerState?.isEnrolled ?? false

  const handleEnroll = async () => {
    if (!session) {
      navigate('/login')
      return
    }

    setEnrolling(true)
    setActionError(null)

    try {
      const result = await api.enrollCourse(course.slug)
      navigate(
        result.enrollment.lastLessonId
          ? `/learn/${course.slug}?lesson=${result.enrollment.lastLessonId}`
          : `/learn/${course.slug}`,
        { replace: true },
      )
    } catch (currentError) {
      setActionError(currentError instanceof Error ? currentError.message : 'ไม่สามารถสมัครเรียนได้')
    } finally {
      setEnrolling(false)
    }
  }

  const handleAddToCart = () => {
    cartStorage.addItem(course.slug)
    setCartAdded(true)
  }

  return (
    <>
      <section className="bg-white">
        <div className="container-page grid gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
          <div>
            <div className="flex flex-wrap gap-2 text-xs font-medium">
              <span className="rounded-md bg-slate-100 px-2.5 py-1 text-slate-700">{course.category}</span>
              <span className="rounded-md border border-slate-200 px-2.5 py-1 text-slate-600">{course.level}</span>
            </div>
            <h1 className="mt-5 text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
              {course.title}
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">{course.description}</p>
            <div className="mt-6 flex flex-wrap gap-4 text-sm text-slate-600">
              <span className="flex items-center gap-2">
                <Star size={16} className="fill-slate-950 text-slate-950" />
                {course.rating} คะแนน
              </span>
              <span className="flex items-center gap-2">
                <Users size={16} />
                {course.students.toLocaleString('th-TH')} ผู้เรียน
              </span>
              <span className="flex items-center gap-2">
                <Clock3 size={16} />
                {course.duration}
              </span>
            </div>
          </div>

          <aside className="card overflow-hidden">
            <img src={course.coverImage} alt={course.title} className="aspect-video w-full object-cover" />
            <div className="p-5">
              <p className="text-2xl font-semibold text-slate-950">{formatPrice(course.price)}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
                <span
                  className={`rounded-md px-2.5 py-1 ${
                    isEnrolled ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {isEnrolled ? 'ลงทะเบียนแล้ว' : 'พร้อมสมัครเรียน'}
                </span>
                {viewerRole ? (
                  <span className="rounded-md border border-slate-200 px-2.5 py-1 text-slate-600">
                    บัญชี {viewerRole}
                  </span>
                ) : null}
              </div>
              <div className="mt-4 grid gap-2">
                {isEnrolled ? (
                  <Link to={`/learn/${course.slug}`} className="btn-primary">
                    เรียนต่อ
                    <ArrowRight size={16} />
                  </Link>
                ) : isStudent ? (
                  <>
                    <button type="button" className="btn-primary" onClick={handleEnroll} disabled={enrolling}>
                      {enrolling ? 'กำลังซื้อคอร์ส...' : 'ซื้อคอร์ส'}
                      <CreditCard size={16} className="text-emerald-300" />
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800 transition hover:bg-amber-100"
                      onClick={handleAddToCart}
                    >
                      <ShoppingCart size={16} className="text-amber-600" />
                      {cartAdded ? 'เพิ่มในตะกร้าแล้ว' : 'เพิ่มตะกร้า'}
                    </button>
                  </>
                ) : (
                  <Link to={session ? session.dashboardPath : '/login'} className="btn-primary">
                    {session ? 'ไปยังหน้าของฉัน' : 'เข้าสู่ระบบเพื่อสมัครเรียน'}
                    <ArrowRight size={16} />
                  </Link>
                )}

                {session ? (
                  !isStudent && !isEnrolled ? (
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      คอร์สนี้เปิดให้สมัครด้วยบัญชี student เพื่อให้ flow การเรียนชัดเจน
                    </div>
                  ) : null
                ) : (
                  <Link to="/register" className="btn-secondary">
                    สมัครสมาชิกใหม่
                  </Link>
                )}
              </div>
              {actionError ? (
                <p className="mt-3 rounded-md bg-rose-50 p-3 text-sm text-rose-700">{actionError}</p>
              ) : null}
            </div>
          </aside>
        </div>
      </section>

      <section className="container-page grid gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-8">
          {previewLesson ? (
            <div>
              <h2 className="section-title">ตัวอย่างวิดีโอก่อนสมัครเรียน</h2>
              <div className="mt-5">
                <VideoPlayer lesson={previewLesson} poster={course.coverImage} courseTitle={course.title} />
              </div>
            </div>
          ) : null}

          <div className="card p-5 sm:p-6">
            <h2 className="text-xl font-semibold text-slate-950">สิ่งที่จะได้จากคอร์สนี้</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {course.outcomes.map((outcome) => (
                <div key={outcome} className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-slate-950" />
                  {outcome}
                </div>
              ))}
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-slate-200 p-5 sm:p-6">
              <h2 className="text-xl font-semibold text-slate-950">รายการบทเรียน</h2>
              <p className="mt-1 text-sm text-slate-500">
                โครงสร้างบทเรียนเรียงตามลำดับจริง พร้อมตัวอย่างวิดีโอบทที่เปิดให้ดูได้ก่อนสมัคร
              </p>
            </div>
            <div className="divide-y divide-slate-200">
              {course.lessons.map((lesson, index) => (
                <div key={lesson.id} className="flex items-center justify-between gap-4 p-4 sm:p-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-sm font-semibold text-slate-700">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-slate-950">{lesson.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{lesson.duration}</p>
                    </div>
                  </div>
                  {lesson.preview ? (
                    <span className="rounded-md bg-slate-950 px-2.5 py-1 text-xs font-medium text-white">
                      Preview
                    </span>
                  ) : (
                    <BookOpenCheck size={17} className="text-slate-400" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-5">
          <div className="card p-5">
            <h2 className="text-lg font-semibold text-slate-950">ผู้สอน</h2>
            <div className="mt-4 flex items-center gap-3">
              <img
                src={course.instructor.avatarUrl}
                alt={course.instructor.name}
                className="h-14 w-14 rounded-md object-cover"
              />
              <div>
                <p className="font-semibold text-slate-950">{course.instructor.name}</p>
                <p className="text-sm text-slate-500">{course.instructor.title}</p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">{course.instructor.bio}</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="font-semibold text-slate-950">{course.instructor.rating}</p>
                <p className="text-xs text-slate-500">คะแนนผู้สอน</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="font-semibold text-slate-950">
                  {course.instructor.totalStudents.toLocaleString('th-TH')}
                </p>
                <p className="text-xs text-slate-500">ผู้เรียนทั้งหมด</p>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <h2 className="text-lg font-semibold text-slate-950">AI Features</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              {['AI Summary', 'Ask AI', 'AI Quiz พร้อมเฉลย'].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <PlayCircle size={16} className="text-slate-950" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </>
  )
}

