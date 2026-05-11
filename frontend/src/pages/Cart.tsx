import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, BookOpenCheck, LoaderCircle, ShoppingBag, Trash2, X } from 'lucide-react'
import { api, authStorage, cartStorage } from '../services/api'
import type { Course } from '../types/course'

const formatPrice = (price: number) =>
  new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0,
  }).format(price)

export default function Cart() {
  const navigate = useNavigate()
  const location = useLocation()
  const closeTarget =
    typeof location.state === 'object' &&
    location.state &&
    'from' in location.state &&
    typeof location.state.from === 'string' &&
    !location.state.from.startsWith('/cart')
      ? location.state.from
      : null
  const session = authStorage.getSession()
  const [cartItems, setCartItems] = useState(() => cartStorage.getItems())
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [checkoutSlug, setCheckoutSlug] = useState<string | null>(null)
  const [checkoutAll, setCheckoutAll] = useState(false)

  useEffect(() => cartStorage.subscribe(() => setCartItems(cartStorage.getItems())), [])

  useEffect(() => {
    let active = true

    setLoading(true)
    setError(null)

    api
      .getCourses()
      .then((result) => {
        if (active) setCourses(result)
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
  }, [])

  const cartCourses = useMemo(() => {
    const orderedSlugs = new Set(cartItems)
    return courses.filter((course) => orderedSlugs.has(course.slug))
  }, [cartItems, courses])

  const totalPrice = cartCourses.reduce((sum, course) => sum + course.price, 0)
  const freeCourseCount = cartCourses.filter((course) => course.price === 0).length
  const paidCourseCount = cartCourses.length - freeCourseCount

  const removeCourse = (slug: string) => {
    setSuccessMessage(null)
    setCartItems(cartStorage.removeItem(slug))
  }

  const clearCart = () => {
    setSuccessMessage(null)
    setCartItems(cartStorage.clearItems())
  }

  const closeCart = () => {
    if (closeTarget) {
      navigate(closeTarget)
      return
    }

    if (window.history.length > 1) {
      navigate(-1)
      return
    }

    navigate('/')
  }

  const ensureStudentSession = () => {
    if (!session) {
      navigate('/login')
      return false
    }

    if (session.user.role !== 'student') {
      navigate(session.dashboardPath)
      return false
    }

    return true
  }

  const checkoutCourse = async (course: Course) => {
    if (!ensureStudentSession()) return

    setCheckoutSlug(course.slug)
    setError(null)
    setSuccessMessage(null)

    try {
      const result = await api.enrollCourse(course.slug)
      cartStorage.removeItem(course.slug)
      setCartItems(cartStorage.getItems())
      setSuccessMessage(`ลงทะเบียน "${course.title}" สำเร็จแล้ว กำลังพาไปหน้าเรียน...`)

      window.setTimeout(() => {
        navigate(
          result.enrollment.lastLessonId
            ? `/learn/${course.slug}?lesson=${result.enrollment.lastLessonId}`
            : `/learn/${course.slug}`,
          { replace: true },
        )
      }, 650)
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : 'ไม่สามารถลงทะเบียนคอร์สได้')
    } finally {
      setCheckoutSlug(null)
    }
  }

  const checkoutAllCourses = async () => {
    if (!ensureStudentSession() || cartCourses.length === 0) return

    setCheckoutAll(true)
    setError(null)
    setSuccessMessage(null)

    try {
      let firstEnrollmentPath = session?.dashboardPath ?? '/student'

      for (const course of cartCourses) {
        const result = await api.enrollCourse(course.slug)
        cartStorage.removeItem(course.slug)

        if (firstEnrollmentPath === (session?.dashboardPath ?? '/student')) {
          firstEnrollmentPath = result.enrollment.lastLessonId
            ? `/learn/${course.slug}?lesson=${result.enrollment.lastLessonId}`
            : `/learn/${course.slug}`
        }
      }

      cartStorage.clearItems()
      setCartItems([])
      setSuccessMessage(`ลงทะเบียนสำเร็จแล้ว ${cartCourses.length} คอร์ส กำลังพาไปหน้าเรียน...`)

      window.setTimeout(() => {
        navigate(firstEnrollmentPath, { replace: true })
      }, 650)
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : 'ไม่สามารถลงทะเบียนทั้งหมดได้')
    } finally {
      setCheckoutAll(false)
    }
  }

  return (
    <section className="min-h-[calc(100vh-64px)] bg-slate-50 dark:bg-slate-950">
      <div className="container-page py-6 sm:py-8">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-slate-950 text-white shadow-sm shadow-slate-950/15 dark:bg-white dark:text-slate-950">
              <ShoppingBag size={20} />
            </span>
            <div>
              <h1 className="text-2xl font-semibold text-slate-950 dark:text-white">ตะกร้าคอร์ส</h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                ตรวจรายการก่อนลงทะเบียน แล้วกลับไปหน้าที่เปิดค้างไว้ได้ทันที
              </p>
            </div>
          </div>
          <button type="button" className="btn-secondary w-fit px-3 py-2" onClick={closeCart}>
            ปิดตะกร้า
            <X size={16} />
          </button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-white/10">
              <div>
                <p className="text-sm font-semibold text-slate-950 dark:text-white">รายการคอร์ส</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{cartCourses.length} รายการในตะกร้า</p>
              </div>
              <button type="button" className="btn-ghost px-2 py-2" onClick={closeCart} aria-label="ปิดตะกร้า">
                <X size={18} />
              </button>
            </div>

            <div className="p-5">
            {loading ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500 dark:border-white/10 dark:bg-slate-950 dark:text-slate-400">
                กำลังโหลดตะกร้า...
              </div>
            ) : error ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
                {error}
              </div>
            ) : successMessage ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-sm font-medium text-emerald-700">
                {successMessage}
              </div>
            ) : cartCourses.length === 0 ? (
              <div className="grid min-h-[360px] place-items-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center dark:border-white/15 dark:bg-slate-950">
                <div>
                  <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-lg bg-white text-slate-950 shadow-sm dark:bg-slate-900 dark:text-white">
                    <ShoppingBag size={24} />
                  </span>
                  <h3 className="mt-5 text-lg font-semibold text-slate-950 dark:text-white">ตะกร้ายังว่าง</h3>
                  <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-500 dark:text-slate-400">
                    เลือกคอร์สที่สนใจแล้วเพิ่มเข้าตะกร้าเพื่อกลับมาลงทะเบียนทีหลัง
                  </p>
                  <Link to="/courses" className="btn-primary mt-5">
                    ดูคอร์สทั้งหมด
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-white/10 dark:border-white/10">
                {cartCourses.map((course) => (
                  <article key={course.id} className="bg-white p-3 dark:bg-slate-950 sm:p-4">
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <img src={course.coverImage} alt={course.title} className="aspect-video w-full rounded-md object-cover sm:h-24 sm:w-36" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="line-clamp-2 text-sm font-semibold text-slate-950 dark:text-white">{course.title}</p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{course.instructor.name}</p>
                          </div>
                          <button
                            type="button"
                            className="btn-ghost shrink-0 px-2 py-1.5 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                            onClick={() => removeCourse(course.slug)}
                            aria-label={`ลบ ${course.title}`}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <p className="font-semibold text-slate-950 dark:text-white">
                            {course.price === 0 ? 'ฟรี' : formatPrice(course.price)}
                          </p>
                          <button
                            type="button"
                            className="btn-primary px-3 py-2 sm:w-auto"
                            onClick={() => checkoutCourse(course)}
                            disabled={checkoutSlug === course.slug || checkoutAll}
                          >
                            {checkoutSlug === course.slug ? <LoaderCircle size={15} className="animate-spin" /> : <BookOpenCheck size={15} />}
                            {checkoutSlug === course.slug ? 'กำลังลงทะเบียน...' : 'ลงทะเบียน'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
            </div>
          </section>

          <aside className="card h-fit p-5 lg:sticky lg:top-24">
            <p className="text-sm font-semibold text-slate-950 dark:text-white">สรุปตะกร้า</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-center dark:border-white/10 dark:bg-slate-950">
                <p className="text-xs text-slate-500 dark:text-slate-400">ทั้งหมด</p>
                <p className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">{cartCourses.length}</p>
              </div>
              <div className="rounded-md border border-emerald-100 bg-emerald-50 p-3 text-center dark:border-emerald-400/20 dark:bg-emerald-400/10">
                <p className="text-xs text-slate-500 dark:text-slate-400">ฟรี</p>
                <p className="mt-1 text-lg font-semibold text-emerald-700">{freeCourseCount}</p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-center dark:border-white/10 dark:bg-slate-950">
                <p className="text-xs text-slate-500 dark:text-slate-400">เสียเงิน</p>
                <p className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">{paidCourseCount}</p>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-5 dark:border-white/10">
              <span className="text-sm text-slate-500 dark:text-slate-400">รวมทั้งหมด</span>
              <span className="text-2xl font-semibold text-slate-950 dark:text-white">{formatPrice(totalPrice)}</span>
            </div>
            <div className="mt-4 grid gap-2">
              {cartCourses.length > 0 ? (
                <button
                  type="button"
                  className="btn-primary w-full py-3"
                  onClick={checkoutAllCourses}
                  disabled={checkoutAll || Boolean(checkoutSlug)}
                >
                  {checkoutAll ? <LoaderCircle size={16} className="animate-spin" /> : <BookOpenCheck size={16} />}
                  {checkoutAll ? 'กำลังลงทะเบียน...' : 'ลงทะเบียนทั้งหมด'}
                </button>
              ) : null}
              <Link to="/courses" className="btn-secondary w-full py-3">
                เลือกคอร์สเพิ่ม
                <ArrowRight size={16} />
              </Link>
              <button type="button" className="btn-secondary w-full" onClick={clearCart} disabled={cartCourses.length === 0}>
                ล้างตะกร้า
              </button>
            </div>
          </aside>
        </div>
      </div>
    </section>
  )
}
