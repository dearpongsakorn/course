import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  CheckCircle2,
  FileText,
  HelpCircle,
  ListVideo,
  MessageSquare,
  Send,
  Sparkles,
  Star,
} from 'lucide-react'
import AIChatBox from '../components/AIChatBox'
import QuizCard from '../components/QuizCard'
import VideoPlayer from '../components/VideoPlayer'
import { useApi } from '../hooks/useApi'
import { api } from '../services/api'
import type { StudentEnrollment } from '../types/course'
import type { QuizQuestion } from '../types/quiz'

type AITab = 'summary' | 'ask' | 'quiz'

type LessonReview = {
  id: string
  rating: number
  text: string
  createdAt: string
}

const tabs: Array<{ id: AITab; label: string; icon: typeof FileText }> = [
  { id: 'summary', label: 'Summary', icon: FileText },
  { id: 'ask', label: 'Ask AI', icon: Bot },
  { id: 'quiz', label: 'Quiz', icon: HelpCircle },
]

function InlineAiText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)

  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={`${part}-${index}`} className="font-semibold text-white">
              {part.slice(2, -2)}
            </strong>
          )
        }

        return <span key={`${part}-${index}`}>{part}</span>
      })}
    </>
  )
}

function AiResponsePanel({ text }: { text: string }) {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !/^[-]{3,}$/.test(line))

  return (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 text-slate-100 shadow-2xl shadow-slate-950/25">
      <div className="flex items-center justify-between gap-4 border-b border-white/10 bg-white/[0.03] px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-white text-slate-950">
            <Sparkles size={17} />
          </span>
          <div>
            <p className="text-sm font-semibold text-white">AI Summary</p>
            <p className="text-xs text-slate-400">จัดรูปแบบให้อ่านง่ายจากเนื้อหาบทเรียน</p>
          </div>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300">
          Gemini
        </span>
      </div>

      <div className="space-y-4 px-5 py-5 text-sm leading-7 text-slate-200">
        {lines.map((line, index) => {
          const heading = line.match(/^(#{1,4})\s+(.+)$/)
          const bullet = line.match(/^[-*]\s+(.+)$/)

          if (heading) {
            return (
              <h4 key={`${line}-${index}`} className="pt-2 text-base font-semibold leading-7 text-white">
                <InlineAiText text={heading[2]} />
              </h4>
            )
          }

          if (bullet) {
            return (
              <div key={`${line}-${index}`} className="flex gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                <p>
                  <InlineAiText text={bullet[1]} />
                </p>
              </div>
            )
          }

          return (
            <p key={`${line}-${index}`} className="text-slate-200">
              <InlineAiText text={line} />
            </p>
          )
        })}
      </div>
    </div>
  )
}

export default function VideoLearning() {
  const { slug = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<AITab>('summary')
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [aiQuiz, setAiQuiz] = useState<QuizQuestion[] | null>(null)
  const [aiLoading, setAiLoading] = useState<'summary' | 'quiz' | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const [enrollment, setEnrollment] = useState<StudentEnrollment | null>(null)
  const [progressLoading, setProgressLoading] = useState(false)
  const [progressMessage, setProgressMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [reviewRating, setReviewRating] = useState(0)
  const [reviewText, setReviewText] = useState('')
  const [lessonReviews, setLessonReviews] = useState<LessonReview[]>([])
  const { data: course, error, loading } = useApi(() => api.getCourse(slug), [slug])

  const lessonId = searchParams.get('lesson')
  const lesson = useMemo(() => {
    if (!course) return undefined
    return course.lessons.find((item) => item.id === lessonId) ?? course.lessons[0]
  }, [course, lessonId])

  const lessonIndex = useMemo(() => {
    if (!course || !lesson) return -1
    return course.lessons.findIndex((item) => item.id === lesson.id)
  }, [course, lesson])

  const progressPercent = useMemo(() => {
    if (enrollment) return enrollment.progress
    if (!course || lessonIndex < 0) return 0
    return Math.round(((lessonIndex + 1) / Math.max(course.lessons.length, 1)) * 100)
  }, [course, enrollment, lessonIndex])

  const lessonCompleted = enrollment ? enrollment.completedLessons > lessonIndex : false

  const previousLesson = lessonIndex > 0 ? course?.lessons[lessonIndex - 1] : undefined
  const nextLesson = course && lessonIndex >= 0 ? course.lessons[lessonIndex + 1] : undefined
  const isEnrolledStudent = course?.viewerState?.role === 'student' && course.viewerState.isEnrolled
  const reviewStorageKey = lesson ? `mycourse:lesson-reviews:${lesson.id}` : null
  const lessonStatus = lessonCompleted
    ? 'เรียนแล้ว'
    : isEnrolledStudent
      ? 'ยังไม่จบ'
      : 'Preview'

  useEffect(() => {
    setEnrollment(course?.viewerState?.enrollment ?? null)
  }, [course?.viewerState?.enrollment])

  useEffect(() => {
    setReviewRating(0)
    setReviewText('')

    if (!reviewStorageKey) {
      setLessonReviews([])
      return
    }

    try {
      const savedReviews = window.localStorage.getItem(reviewStorageKey)
      setLessonReviews(savedReviews ? JSON.parse(savedReviews) : [])
    } catch {
      setLessonReviews([])
    }
  }, [reviewStorageKey])

  const openLesson = (nextLessonId: string) => {
    setAiSummary(null)
    setAiQuiz(null)
    setAiError(null)
    setProgressMessage(null)
    setSearchParams({ lesson: nextLessonId })
  }

  const generateSummary = async () => {
    if (!lesson) return
    setAiError(null)
    setAiLoading('summary')

    try {
      const result = await api.summarizeLesson(lesson.id)
      setAiSummary(result.summary)
    } catch (currentError) {
      setAiError(currentError instanceof Error ? currentError.message : 'สร้าง summary ไม่สำเร็จ')
    } finally {
      setAiLoading(null)
    }
  }

  const generateQuiz = async () => {
    if (!lesson) return
    setAiError(null)
    setAiLoading('quiz')

    try {
      const result = await api.generateLessonQuiz(lesson.id)
      setAiQuiz(result.questions)
    } catch (currentError) {
      setAiError(currentError instanceof Error ? currentError.message : 'สร้าง quiz ไม่สำเร็จ')
    } finally {
      setAiLoading(null)
    }
  }

  const completeLesson = async () => {
    if (!course || !lesson) return

    setProgressLoading(true)
    setProgressMessage(null)

    try {
      const nextEnrollment = await api.completeLesson(course.slug, lesson.id)
      setEnrollment(nextEnrollment)
      setProgressMessage({ tone: 'success', text: 'บันทึกความคืบหน้าเรียบร้อยแล้ว' })
    } catch (currentError) {
      setProgressMessage({
        tone: 'error',
        text: currentError instanceof Error ? currentError.message : 'บันทึกความคืบหน้าไม่สำเร็จ',
      })
    } finally {
      setProgressLoading(false)
    }
  }

  const submitReview = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const nextText = reviewText.trim()
    if (!nextText || reviewRating === 0 || !reviewStorageKey) return

    const nextReviews = [
      {
        id: `${Date.now()}`,
        rating: reviewRating,
        text: nextText,
        createdAt: new Intl.DateTimeFormat('th-TH', {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(new Date()),
      },
      ...lessonReviews,
    ].slice(0, 6)

    setLessonReviews(nextReviews)
    window.localStorage.setItem(reviewStorageKey, JSON.stringify(nextReviews))
    setReviewRating(0)
    setReviewText('')
  }

  if (loading) {
    return (
      <section className="container-page py-16">
        <div className="card p-8 text-sm text-slate-500">กำลังโหลดบทเรียนจากฐานข้อมูล...</div>
      </section>
    )
  }

  if (error || !course || !lesson) {
    return (
      <section className="container-page py-16">
        <div className="card p-8 text-center">
          <h1 className="text-2xl font-semibold text-slate-950">ไม่พบบทเรียน</h1>
          <p className="mt-2 text-sm text-slate-500">
            {error ?? 'บทเรียนนี้ยังไม่มีข้อมูลในระบบ'}
          </p>
          <Link to="/" className="btn-primary mt-6">
            กลับหน้าแรก
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="container-page py-6">
      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <Link
              to={`/courses/${course.slug}`}
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-950"
            >
              <ArrowLeft size={15} />
              กลับไปหน้าคอร์ส
            </Link>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
              บทเรียน {lessonIndex + 1} จาก {course.lessons.length}
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">{lesson.title}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{lesson.summary}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[520px] lg:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-medium uppercase text-slate-400">เวลา</p>
              <p className="mt-1 text-sm font-semibold text-slate-950">{lesson.duration}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-medium uppercase text-slate-400">ความคืบหน้า</p>
              <p className="mt-1 text-sm font-semibold text-emerald-700">{progressPercent}%</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-medium uppercase text-slate-400">สถานะ</p>
              <p className={`mt-1 text-sm font-semibold ${lessonCompleted ? 'text-emerald-700' : 'text-slate-950'}`}>
                {lessonStatus}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-medium uppercase text-slate-400">AI</p>
              <p className="mt-1 text-sm font-semibold text-slate-950">Summary, Ask AI, Quiz</p>
            </div>
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-500">
            <span>ความคืบหน้าของบทเรียน</span>
            <span>
              {lessonIndex + 1}/{course.lessons.length}
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-200">
            <div className="h-2 rounded-full bg-emerald-500 transition-all" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[300px_minmax(0,980px)] xl:justify-center">
        <aside className="card h-fit overflow-hidden xl:sticky xl:top-24">
          <div className="flex items-center gap-2 border-b border-slate-200 p-4">
            <ListVideo size={18} />
            <div>
              <h2 className="font-semibold text-slate-950">รายการบทเรียน</h2>
              <p className="text-xs text-slate-500">เลือกบทที่ต้องการเรียนต่อได้ทันที</p>
            </div>
          </div>
          <div className="divide-y divide-slate-200">
            {course.lessons.map((item, index) => {
              const active = item.id === lesson.id
              const completed = enrollment ? enrollment.completedLessons > index : false

              return (
                <button
                  key={item.id}
                  type="button"
                  className={`flex w-full items-start gap-3 p-4 text-left transition ${
                    active ? 'bg-slate-950 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                  onClick={() => openLesson(item.id)}
                >
                  <span
                    className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold ${
                      active ? 'bg-white text-slate-950' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{item.title}</span>
                    <span
                      className={`mt-1 flex items-center gap-2 text-xs ${
                        active ? 'text-slate-300' : 'text-slate-500'
                      }`}
                    >
                      <span>{item.duration}</span>
                      {completed ? (
                        <span
                          className={`rounded-full px-2 py-0.5 ${
                            active ? 'bg-emerald-400/20 text-emerald-100' : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          เรียนแล้ว
                        </span>
                      ) : null}
                      {item.preview && !isEnrolledStudent ? (
                        <span
                          className={`rounded-full px-2 py-0.5 ${
                            active ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          Preview
                        </span>
                      ) : null}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </aside>

        <div className="min-w-0 space-y-5">
          <VideoPlayer lesson={lesson} poster={course.coverImage} courseTitle={course.title} />

          <section className="rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/70">
            <div className="border-b border-slate-200 p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-950 text-white">
                    <Sparkles size={18} />
                  </span>
                  <div>
                    <h2 className="font-semibold text-slate-950">AI ผู้ช่วยบทเรียน</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      สรุป ถามตอบ และสร้างแบบทดสอบจากเนื้อหาบทนี้
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 rounded-lg bg-slate-100 p-1 ring-1 ring-slate-200 lg:min-w-[360px]">
                  {tabs.map((tab) => {
                    const Icon = tab.icon

                    return (
                      <button
                        key={tab.id}
                        type="button"
                        className={`flex items-center justify-center gap-2 rounded-md px-2 py-2 text-xs font-semibold transition sm:text-sm ${
                          activeTab === tab.id ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-600 hover:text-slate-950'
                        }`}
                        onClick={() => setActiveTab(tab.id)}
                      >
                        <Icon size={15} />
                        {tab.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="p-4">
              {activeTab === 'summary' && (
                <div className="space-y-4 text-sm leading-6 text-slate-600">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-slate-950">AI Summary Timeline</h3>
                      <p className="mt-1 text-sm text-slate-500">อ่านภาพรวมของบทนี้แบบสั้น กระชับ และนำไปใช้ต่อได้ง่าย</p>
                    </div>
                    <button
                      type="button"
                      className="btn-primary sm:w-auto"
                      onClick={generateSummary}
                      disabled={aiLoading === 'summary'}
                    >
                      {aiLoading === 'summary' ? 'กำลังสรุปด้วย Gemini...' : 'สรุปนาทีและคำพูด'}
                    </button>
                  </div>

                  {aiError ? <p className="rounded-md bg-rose-50 p-3 text-rose-700">{aiError}</p> : null}

                  <AiResponsePanel text={aiSummary ?? lesson.summary} />

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="font-semibold text-slate-950">ประเด็นที่ควรจำ</p>
                    <ul className="mt-3 space-y-2">
                      {course.outcomes.slice(0, 3).map((item) => (
                        <li key={item} className="flex gap-2">
                          <CheckCircle2 size={16} className="mt-1 shrink-0 text-emerald-600" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {activeTab === 'ask' ? <AIChatBox lessonId={lesson.id} lessonTitle={lesson.title} /> : null}

              {activeTab === 'quiz' && (
                <div className="space-y-3">
                  <button
                    type="button"
                    className="btn-primary w-full sm:w-auto"
                    onClick={generateQuiz}
                    disabled={aiLoading === 'quiz'}
                  >
                    {aiLoading === 'quiz' ? 'กำลังสร้าง Quiz ด้วย Gemini...' : 'Generate AI Quiz'}
                  </button>
                  {aiError ? <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{aiError}</p> : null}
                  <QuizCard questions={aiQuiz ?? lesson.quizQuestions} />
                </div>
              )}
            </div>
          </section>

          <div className="card p-5">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="w-full max-w-2xl">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-amber-50 text-amber-600 ring-1 ring-amber-100">
                    <MessageSquare size={18} />
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">ความคิดเห็นบทเรียน</h2>
                    <p className="mt-1 text-sm text-slate-500">ให้คะแนนและบันทึกความเห็นของคุณหลังเรียนบทนี้</p>
                  </div>
                </div>

                <form className="mt-5 space-y-4" onSubmit={submitReview}>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm font-medium text-slate-700">ให้ดาว</span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((rating) => {
                        const active = rating <= reviewRating

                        return (
                          <button
                            key={rating}
                            type="button"
                            aria-label={`${rating} ดาว`}
                            aria-pressed={active}
                            className={`inline-flex h-9 w-9 items-center justify-center rounded-md transition ${
                              active
                                ? 'bg-amber-50 text-amber-500 ring-1 ring-amber-200'
                                : 'text-slate-300 hover:bg-slate-100 hover:text-amber-400'
                            }`}
                            onClick={() => setReviewRating(rating)}
                          >
                            <Star size={19} fill={active ? 'currentColor' : 'none'} />
                          </button>
                        )
                      })}
                    </div>
                    {reviewRating > 0 ? <span className="text-sm font-semibold text-amber-600">{reviewRating}/5</span> : null}
                  </div>

                  <textarea
                    value={reviewText}
                    onChange={(event) => setReviewText(event.target.value)}
                    className="min-h-[112px] w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                    placeholder="เขียนความคิดเห็นหรือสิ่งที่อยากจดจำจากบทเรียนนี้"
                  />

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="btn-primary w-full justify-center sm:w-auto"
                      disabled={!reviewText.trim() || reviewRating === 0}
                    >
                      <Send size={16} />
                      ส่งความคิดเห็น
                    </button>
                  </div>
                </form>

                <div className="mt-5 space-y-3">
                  {lessonReviews.length > 0 ? (
                    lessonReviews.map((review) => (
                      <article key={review.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1 text-amber-500">
                            {[1, 2, 3, 4, 5].map((rating) => (
                              <Star
                                key={rating}
                                size={15}
                                fill={rating <= review.rating ? 'currentColor' : 'none'}
                                className={rating <= review.rating ? 'text-amber-500' : 'text-slate-300'}
                              />
                            ))}
                          </div>
                          <span className="text-xs text-slate-400">{review.createdAt}</span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-700">{review.text}</p>
                      </article>
                    ))
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                      ยังไม่มีความคิดเห็นสำหรับบทนี้
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[320px] lg:grid-cols-1">
                {course.viewerState?.role === 'student' && course.viewerState.isEnrolled ? (
                  <button
                    type="button"
                    className={lessonCompleted ? 'btn-secondary justify-between' : 'btn-primary justify-between'}
                    onClick={completeLesson}
                    disabled={progressLoading || lessonCompleted}
                  >
                    <span className="flex items-center gap-2">
                      <CheckCircle2 size={16} />
                      {progressLoading
                        ? 'กำลังบันทึก...'
                        : lessonCompleted
                          ? 'บันทึกแล้ว'
                          : 'บันทึกว่าเรียนจบ'}
                    </span>
                    <span className={lessonCompleted ? 'text-xs text-slate-500' : 'text-xs text-white/70'}>
                      {progressPercent}%
                    </span>
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn-secondary justify-between"
                  disabled={!previousLesson}
                  onClick={() => previousLesson && openLesson(previousLesson.id)}
                >
                  <span className="flex items-center gap-2">
                    <ArrowLeft size={16} />
                    บทก่อนหน้า
                  </span>
                  <span className="truncate text-xs text-slate-500">{previousLesson?.title ?? '-'}</span>
                </button>

                <button
                  type="button"
                  className="btn-primary justify-between"
                  disabled={!nextLesson}
                  onClick={() => nextLesson && openLesson(nextLesson.id)}
                >
                  <span className="flex items-center gap-2">
                    {nextLesson ? (lessonCompleted ? 'ไปบทถัดไป' : 'บทถัดไป') : 'เรียนครบแล้ว'}
                    <ArrowRight size={16} />
                  </span>
                  <span className="truncate text-xs text-white/70">{nextLesson?.title ?? '-'}</span>
                </button>
                {progressMessage ? (
                  <p
                    className={`rounded-md p-3 text-sm sm:col-span-2 lg:col-span-1 ${
                      progressMessage.tone === 'success'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-rose-50 text-rose-700'
                    }`}
                  >
                    {progressMessage.text}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
