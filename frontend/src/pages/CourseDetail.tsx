import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowRight,
  Award,
  BookOpenCheck,
  Bookmark,
  CheckCircle2,
  Clock3,
  CreditCard,
  Download,
  Globe2,
  Heart,
  PlayCircle,
  Share2,
  Smartphone,
  Star,
  Users,
} from 'lucide-react'
import LearnProSidebar from '../components/LearnProSidebar'
import VideoPlayer from '../components/VideoPlayer'
import { api } from '../services/api'
import type { Course } from '../types/course'

const formatPrice = (price: number) =>
  price === 0
    ? 'ฟรี'
    : new Intl.NumberFormat('th-TH', {
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
      <section className="min-h-screen bg-white text-black lg:pl-[280px]">
        <LearnProSidebar active="all-courses" />
        <div className="p-6">
          <div className="rounded-xl border border-zinc-200 bg-white p-8 text-sm text-zinc-500 shadow-sm">
            กำลังโหลดรายละเอียดคอร์ส...
          </div>
        </div>
      </section>
    )
  }

  if (error || !course) {
    return (
      <section className="min-h-screen bg-white text-black lg:pl-[280px]">
        <LearnProSidebar active="all-courses" />
        <div className="p-6">
          <div className="mx-auto max-w-xl rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
            <h1 className="text-2xl font-semibold text-black">ไม่พบคอร์ส</h1>
            <p className="mt-2 text-sm text-zinc-500">{error ?? 'คอร์สนี้อาจถูกลบหรือ URL ไม่ถูกต้อง'}</p>
            <Link to="/courses" className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-black px-5 text-sm font-semibold text-white">
              กลับไปดูคอร์สทั้งหมด
            </Link>
          </div>
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
  const checkoutPath = `/checkout/${course.slug}`
  const startLearningPath = course.viewerState?.enrollment?.lastLessonId
    ? lessonPathFor(course.viewerState.enrollment.lastLessonId)
    : `/learn/${course.slug}`
  const targetLearners = [
    `ผู้ที่ต้องการเริ่มต้นสาย ${course.category}`,
    `ผู้เรียนระดับ ${course.level} ที่อยากเรียนแบบเป็นลำดับ`,
    'คนที่ต้องการทบทวนด้วย AI Summary และ Quiz',
    'เจ้าของธุรกิจหรือทีมที่อยากเพิ่มทักษะให้ทำงานได้จริง',
  ]
  const includedItems = [
    ['วิดีโอคุณภาพสูง', 'เรียนรู้ผ่านวิดีโอแบบ HD', PlayCircle],
    ['แบบฝึกหัด', 'ฝึกทำแบบฝึกในทุกบท', BookOpenCheck],
    ['ไฟล์สำหรับดาวน์โหลด', 'Template และแหล่งข้อมูล', Download],
    ['สอบวัดความรู้', 'แบบทดสอบในทุกหมวด', Award],
  ]

  return (
    <section className="min-h-screen bg-white text-black lg:pl-[280px]">
      <LearnProSidebar active="all-courses" />

      <main className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-10">
        <div className="mb-8 flex flex-wrap items-center gap-2 text-sm text-zinc-500">
          <Link to="/" className="hover:text-black">หน้าหลัก</Link>
          <span>›</span>
          <Link to="/courses" className="hover:text-black">คอร์สทั้งหมด</Link>
          <span>›</span>
          <span className="text-zinc-700">{course.title}</span>
        </div>

        <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_430px]">
          <div className="min-w-0">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-black">{course.category}</p>
                <h1 className="mt-3 text-4xl font-semibold tracking-tight text-black">{course.title}</h1>
                <p className="mt-5 max-w-3xl text-lg leading-8 text-zinc-700">{course.description}</p>

                <div className="mt-5 flex flex-wrap items-center gap-5 text-sm text-zinc-600">
                  <span className="inline-flex items-center gap-1">
                    <Star size={17} className="fill-amber-400 text-amber-400" />
                    <span className="font-semibold text-black">{course.rating.toFixed(1)}</span>
                    <span>({course.students.toLocaleString('th-TH')} รีวิว)</span>
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Users size={17} />
                    {course.students.toLocaleString('th-TH')} ผู้เรียน
                  </span>
                </div>

                <div className="mt-6 flex items-center gap-3">
                  <img src={course.instructor.avatarUrl} alt={course.instructor.name} className="h-12 w-12 rounded-full object-cover" />
                  <div>
                    <p className="text-sm text-zinc-500">สอนโดย <span className="font-semibold text-black">{course.instructor.name}</span></p>
                    <p className="mt-1 text-sm text-zinc-600">{course.instructor.title}</p>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 gap-3">
                <button type="button" className="inline-flex h-12 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-black transition hover:border-black">
                  <Heart size={18} />
                  บันทึก
                </button>
                <button type="button" className="inline-flex h-12 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-black transition hover:border-black">
                  <Share2 size={18} />
                  แชร์
                </button>
              </div>
            </div>

            {previewLesson ? (
              <div className="mt-8">
                <VideoPlayer lesson={previewLesson} poster={course.coverImage} courseTitle={course.title} compact />
                <div className="mt-4 flex items-center gap-3 text-sm text-zinc-600">
                  <Bookmark size={17} className="text-black" />
                  <span className="font-semibold text-black">ดูตัวอย่างคอร์สนี้</span>
                  <span>ตัวอย่างบทเรียน: {previewLesson.title}</span>
                </div>
              </div>
            ) : null}

            <div className="mt-8 border-b border-zinc-200">
              <div className="flex gap-8 overflow-x-auto">
                {['รายละเอียด', 'บทเรียน', `รีวิว (${course.students.toLocaleString('th-TH')})`, 'ผู้สอน'].map((item, index) => (
                  <button
                    key={item}
                    type="button"
                    className={[
                      'border-b-2 pb-4 text-sm font-semibold transition',
                      index === 0 ? 'border-black text-black' : 'border-transparent text-zinc-500 hover:text-black',
                    ].join(' ')}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <section className="py-8">
              <h2 className="text-2xl font-semibold text-black">สิ่งที่คุณจะได้เรียนรู้</h2>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {(course.outcomes.length ? course.outcomes : targetLearners).slice(0, 6).map((item) => (
                  <div key={item} className="flex gap-3 text-sm leading-7 text-zinc-700">
                    <CheckCircle2 size={17} className="mt-1 shrink-0 fill-black text-white" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="border-t border-zinc-200 py-8">
              <h2 className="text-2xl font-semibold text-black">คอร์สนี้มีอะไรบ้าง</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {includedItems.map(([title, description, Icon]) => (
                  <div key={title as string} className="flex items-center gap-4 rounded-xl border border-zinc-200 bg-white p-4">
                    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-black">
                      <Icon size={19} />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-black">{title as string}</p>
                      <p className="mt-1 text-xs leading-5 text-zinc-500">{description as string}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="border-t border-zinc-200 py-8">
              <h2 className="text-2xl font-semibold text-black">บทเรียนในคอร์ส</h2>
              <div className="mt-5 divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white">
                {course.lessons.map((lesson, index) => (
                  <div key={lesson.id} className="flex items-center justify-between gap-4 p-4 transition hover:bg-zinc-50">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-sm font-semibold text-black">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-black">{lesson.title}</p>
                        <p className="mt-1 text-xs text-zinc-500">{lesson.duration}</p>
                      </div>
                    </div>
                    {isEnrolled ? (
                      <Link to={lessonPathFor(lesson.id)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-200 px-3 text-sm font-semibold text-black transition hover:border-black">
                        เข้าเรียน
                        <ArrowRight size={15} />
                      </Link>
                    ) : lesson.preview ? (
                      <span className="rounded-full bg-black px-3 py-1 text-xs font-semibold text-white">Preview</span>
                    ) : (
                      <BookOpenCheck size={17} className="text-zinc-400" />
                    )}
                  </div>
                ))}
              </div>
            </section>

            {recommendedCourses.length > 0 ? (
              <section className="border-t border-zinc-200 py-8">
                <h2 className="text-2xl font-semibold text-black">คอร์สที่แนะนำ</h2>
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  {recommendedCourses.map((item) => (
                    <Link key={item.id} to={`/courses/${item.slug}`} className="group rounded-xl border border-zinc-200 bg-white p-3 transition hover:border-black">
                      <img src={item.coverImage} alt={item.title} className="aspect-video w-full rounded-lg object-cover" />
                      <p className="mt-3 line-clamp-2 text-sm font-semibold text-black group-hover:underline">{item.title}</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{formatPrice(item.price)}</p>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          <aside className="space-y-6 xl:sticky xl:top-8 xl:self-start">
            <section className="rounded-xl border border-zinc-200 bg-white p-7 shadow-sm">
              <div className="flex items-end justify-between gap-4">
                <p className="text-4xl font-semibold tracking-tight text-black">{formatPrice(course.price)}</p>
                {course.price > 0 ? (
                  <div className="text-right">
                    <p className="text-sm text-zinc-400 line-through">{formatPrice(Math.round(course.price * 1.45))}</p>
                    <span className="mt-1 inline-flex rounded-full bg-black px-3 py-1 text-xs font-semibold text-white">ลด 33%</span>
                  </div>
                ) : null}
              </div>

              <div className="mt-7 space-y-3">
                {isEnrolled ? (
                  <Link to={startLearningPath} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-black text-sm font-semibold text-white transition hover:bg-zinc-800">
                    เรียนต่อ
                    <ArrowRight size={16} />
                  </Link>
                ) : (
                  <Link to={checkoutPath} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-black text-sm font-semibold text-white transition hover:bg-zinc-800">
                    <CreditCard size={16} />
                    {course.price === 0 ? 'ลงทะเบียนเรียนฟรี' : 'ซื้อคอร์สนี้'}
                  </Link>
                )}
                <Link to="/courses" className="inline-flex h-12 w-full items-center justify-center rounded-lg border border-zinc-200 bg-white text-sm font-semibold text-black transition hover:border-black">
                  ดูคอร์สอื่น
                </Link>
              </div>

              <div className="mt-7 space-y-4 text-sm text-zinc-700">
                {[
                  [Clock3, 'เรียนได้ตลอดชีพ'],
                  [Award, 'อัปเดตคอร์สฟรีตลอดชีพ'],
                  [BookOpenCheck, 'ใบประกาศนียบัตรเมื่อเรียนจบ'],
                  [Smartphone, 'เรียนผ่านมือถือและทีวีได้'],
                ].map(([Icon, text]) => (
                  <div key={text as string} className="flex items-center gap-3">
                    <Icon size={18} className="text-black" />
                    <span>{text as string}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-zinc-200 bg-white p-7 shadow-sm">
              <h2 className="text-xl font-semibold text-black">คอร์สนี้เหมาะกับใคร</h2>
              <div className="mt-5 space-y-4 text-sm leading-7 text-zinc-700">
                {targetLearners.map((item) => (
                  <div key={item} className="flex gap-3">
                    <CheckCircle2 size={17} className="mt-1 shrink-0 text-black" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-zinc-200 bg-white p-7 shadow-sm">
              <h2 className="text-xl font-semibold text-black">รายละเอียดคอร์ส</h2>
              <div className="mt-5 space-y-5 text-sm">
                {[
                  [BookOpenCheck, 'บทเรียนทั้งหมด', `${course.lessons.length} บทเรียน`],
                  [Clock3, 'ความยาวคอร์ส', course.duration],
                  [Star, 'ระดับ', course.level],
                  [Users, 'ผู้เรียน', `${course.students.toLocaleString('th-TH')} คน`],
                  [Globe2, 'ภาษา', 'ไทย'],
                  [Clock3, 'ล่าสุดอัปเดต', course.updatedAt ? new Date(course.updatedAt).toLocaleDateString('th-TH') : '-'],
                ].map(([Icon, label, value]) => (
                  <div key={label as string} className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-3 text-zinc-600">
                      <Icon size={17} className="text-black" />
                      {label as string}
                    </span>
                    <span className="text-right font-medium text-black">{value as string}</span>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </main>
    </section>
  )
}
