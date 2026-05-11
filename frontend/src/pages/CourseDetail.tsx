import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowRight,
  Award,
  BookOpenCheck,
  CheckCircle2,
  Quote,
  Star,
  Target,
  Users,
} from 'lucide-react'
import VideoPlayer from '../components/VideoPlayer'
import { api } from '../services/api'
import type { Course } from '../types/course'

const formatPrice = (price: number) =>
  new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0,
  }).format(price)

export default function CourseDetail() {
  const { slug = '' } = useParams()
  const [course, setCourse] = useState<Course | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [suggestedCourses, setSuggestedCourses] = useState<Course[]>([])

  useEffect(() => {
    let active = true

    queueMicrotask(() => {
      if (!active) return

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
    })

    api
      .getCourses()
      .then((result) => {
        if (active) setSuggestedCourses(result)
      })
      .catch(() => {
        if (active) setSuggestedCourses([])
      })

    return () => {
      active = false
    }
  }, [slug])

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
  const recommendedCourses = suggestedCourses
    .filter((item) => item.slug !== course.slug)
    .sort((left, right) => {
      const leftCategoryMatch = left.category === course.category ? 1 : 0
      const rightCategoryMatch = right.category === course.category ? 1 : 0
      if (leftCategoryMatch !== rightCategoryMatch) return rightCategoryMatch - leftCategoryMatch
      return right.rating - left.rating
    })
    .slice(0, 3)
  const isEnrolled = course.viewerState?.isEnrolled ?? false
  const lessonPathFor = (lessonId: string) => `/learn/${course.slug}?lesson=${lessonId}`
  const targetLearners = [
    `${course.level} learners ที่อยากเรียนแบบเป็นลำดับ`,
    `คนที่สนใจสาย ${course.category} และต้องการลงมือเรียนจริง`,
    'ผู้เรียนที่ต้องการสรุปบทเรียนและ quiz ช่วยทบทวน',
  ]
  const reviews = [
    {
      name: 'ผู้เรียนคอร์สนี้',
      quote: 'เนื้อหาแบ่งเป็นบทชัดเจน กลับมาเรียนต่อได้ง่ายและเห็น progress ตลอด',
    },
    {
      name: 'สายทบทวนก่อนสอบ',
      quote: 'AI Summary กับ Quiz ช่วยให้จับประเด็นของแต่ละบทได้ไวขึ้นมาก',
    },
  ]

  return (
    <>
      <section className="container-page grid gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-8">
          {!isEnrolled && previewLesson ? (
            <div>
              <h2 className="section-title">ตัวอย่างวิดีโอก่อนสมัครเรียน</h2>
              <div className="mt-5">
                <VideoPlayer lesson={previewLesson} poster={course.coverImage} courseTitle={course.title} />
              </div>
            </div>
          ) : null}

          <div className="card overflow-hidden">
            <div className="grid gap-0 lg:grid-cols-[320px_minmax(0,1fr)]">
              <div className="border-b border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5 lg:border-b-0 lg:border-r">
                <p className="text-sm font-semibold text-slate-500">ผู้สอน</p>
                <div className="mt-4 flex items-center gap-3">
                  <img
                    src={course.instructor.avatarUrl}
                    alt={course.instructor.name}
                    className="h-16 w-16 rounded-md object-cover"
                  />
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-semibold text-slate-950">{course.instructor.name}</h2>
                    <p className="mt-1 text-sm text-slate-500">{course.instructor.title}</p>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-600">{course.instructor.bio}</p>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-md border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-950">
                    <p className="flex items-center gap-1 text-sm font-semibold text-slate-950">
                      <Star size={14} className="fill-amber-400 text-amber-400" />
                      {course.instructor.rating}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">คะแนนผู้สอน</p>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-950">
                    <p className="text-sm font-semibold text-slate-950">
                      {course.instructor.totalStudents.toLocaleString('th-TH')}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">ผู้เรียนทั้งหมด</p>
                  </div>
                </div>
              </div>

              <div className="p-5 sm:p-6">
                <p className="text-sm font-semibold text-slate-500">คำอธิบายคอร์ส</p>
                <h2 className="mt-2 text-xl font-semibold text-slate-950">{course.title}</h2>
                <p className="mt-4 text-sm leading-7 text-slate-600">{course.description}</p>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  {[
                    ['หมวดหมู่', course.category],
                    ['ระยะเวลา', course.duration],
                    ['บทเรียน', `${course.lessons.length} บท`],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
                      <p className="text-xs text-slate-500">{label}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-950">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="card p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-slate-950 text-white">
                  <Target size={18} />
                </span>
                <div>
                  <h2 className="text-xl font-semibold text-slate-950">เหมาะสำหรับใคร</h2>
                  <p className="mt-1 text-sm text-slate-500">ช่วยให้ผู้เรียนตัดสินใจได้เร็วขึ้น</p>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                {targetLearners.map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-lg border border-slate-200 p-4 text-sm leading-6 text-slate-700 dark:border-white/10 dark:text-slate-300">
                    <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-emerald-500" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-slate-950 text-white">
                  <Award size={18} />
                </span>
                <div>
                  <h2 className="text-xl font-semibold text-slate-950">สิ่งที่ทำให้คอร์สนี้เด่น</h2>
                  <p className="mt-1 text-sm text-slate-500">ครบทั้งเนื้อหา เครื่องมือ และการติดตามผล</p>
                </div>
              </div>
              <div className="mt-5 grid gap-3">
                {[
                  ['บทเรียน', isEnrolled ? `${course.lessons.length} บทเรียน` : `${course.lessons.length} บท พร้อม preview`],
                  ['ผู้เรียน', `${course.students.toLocaleString('th-TH')} คน`],
                  ['คะแนน', `${course.rating} จาก 5`],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                    <span className="text-sm text-slate-500">{label}</span>
                    <span className="text-sm font-semibold text-slate-950">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-slate-200 p-5 sm:p-6">
              <h2 className="text-xl font-semibold text-slate-950">รายการบทเรียน</h2>
              <p className="mt-1 text-sm text-slate-500">
                {isEnrolled
                  ? 'บทเรียนจริงที่ผู้เรียนต้องเรียน เรียงตามลำดับและกดเข้าเรียนได้ทันที'
                  : 'โครงสร้างบทเรียนเรียงตามลำดับจริง พร้อมตัวอย่างวิดีโอบทที่เปิดให้ดูได้ก่อนสมัคร'}
              </p>
            </div>
            <div className="divide-y divide-slate-200">
              {course.lessons.map((lesson, index) => (
                <div key={lesson.id} className="flex items-center justify-between gap-4 p-4 transition hover:bg-slate-50 sm:p-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-sm font-semibold text-slate-700">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-slate-950">{lesson.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{lesson.duration}</p>
                    </div>
                  </div>
                  {isEnrolled ? (
                    <Link to={lessonPathFor(lesson.id)} className="btn-secondary px-3 py-2">
                      เข้าเรียน
                      <ArrowRight size={15} />
                    </Link>
                  ) : lesson.preview ? (
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

          <div className="card p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-slate-950 text-white">
                <Quote size={18} />
              </span>
              <div>
                <h2 className="text-xl font-semibold text-slate-950">รีวิวจากผู้เรียน</h2>
                <p className="mt-1 text-sm text-slate-500">ตัวอย่าง feedback สำหรับช่วยตัดสินใจก่อนสมัคร</p>
              </div>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {reviews.map((review) => (
                <article key={review.name} className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                  <div className="flex gap-1 text-amber-400">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Star key={index} size={14} className="fill-current" />
                    ))}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-300">“{review.quote}”</p>
                  <p className="mt-4 text-sm font-semibold text-slate-950">{review.name}</p>
                </article>
              ))}
            </div>
          </div>
        </div>

        <aside className="lg:sticky lg:top-24">
          <div className="card overflow-hidden">
            <div className="border-b border-slate-200 p-5 dark:border-white/10">
              <h2 className="text-lg font-semibold text-slate-950">คอร์สที่แนะนำ</h2>
              <p className="mt-1 text-sm text-slate-500">คอร์สใกล้เคียงที่เหมาะสำหรับเรียนต่อ</p>
            </div>

            {recommendedCourses.length > 0 ? (
              <div className="divide-y divide-slate-200 dark:divide-white/10">
                {recommendedCourses.map((item) => (
                  <Link
                    key={item.id}
                    to={`/courses/${item.slug}`}
                    className="group block p-4 transition hover:bg-slate-50 dark:hover:bg-white/5"
                  >
                    <div className="flex gap-3">
                      <img
                        src={item.coverImage}
                        alt={item.title}
                        className="h-20 w-24 shrink-0 rounded-md object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap gap-1.5">
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                            {item.category}
                          </span>
                          <span className="rounded-md border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                            {item.level}
                          </span>
                        </div>
                        <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-5 text-slate-950 transition group-hover:text-slate-700">
                          {item.title}
                        </h3>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1">
                            <Star size={13} className="fill-amber-400 text-amber-400" />
                            {item.rating}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Users size={13} />
                            {item.students.toLocaleString('th-TH')}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-slate-950">
                        {item.price === 0 ? 'ฟรี' : formatPrice(item.price)}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 transition group-hover:text-slate-950">
                        ดูคอร์ส
                        <ArrowRight size={13} />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-5">
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-500">
                  ยังไม่มีคอร์สแนะนำในตอนนี้
                </div>
              </div>
            )}

            <div className="border-t border-slate-200 p-4 dark:border-white/10">
              <Link to="/courses" className="btn-secondary w-full py-2.5">
                ดูคอร์สทั้งหมด
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </aside>
      </section>
    </>
  )
}

