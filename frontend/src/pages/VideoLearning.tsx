import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  FileText,
  GraduationCap,
  HelpCircle,
  Lock,
  Maximize2,
  MessageSquare,
  PlayCircle,
  Send,
  Sparkles,
  Star,
} from 'lucide-react'
import AIChatBox from '../components/AIChatBox'
import LearnProSidebar from '../components/LearnProSidebar'
import QuizCard from '../components/QuizCard'
import VideoPlayer from '../components/VideoPlayer'
import { useApi } from '../hooks/useApi'
import { api, authStorage } from '../services/api'
import type { StudentEnrollment } from '../types/course'
import type { QuizQuestion } from '../types/quiz'

type AITab = 'summary' | 'ask' | 'quiz'
type ContentTab = 'overview' | 'notes' | 'qa' | 'resources'

type LessonReview = {
  id: string
  rating: number
  text: string
  createdAt: string
}

const tabs: Array<{ id: AITab; label: string; icon: typeof FileText }> = [
  { id: 'summary', label: 'สรุป', icon: FileText },
  { id: 'ask', label: 'AI ผู้ช่วย', icon: Bot },
  { id: 'quiz', label: 'แบบทดสอบ', icon: HelpCircle },
]

const contentTabs: Array<{ id: ContentTab; label: string }> = [
  { id: 'overview', label: 'ภาพรวม' },
  { id: 'notes', label: 'โน้ต' },
  { id: 'qa', label: 'ถามตอบ' },
  { id: 'resources', label: 'ไฟล์เรียน' },
]

const lessonAiCacheKey = (lessonId: string, type: 'summary' | 'quiz') =>
  type === 'summary' ? `mycourse:lesson-ai:${type}:timeline-v2:${lessonId}` : `mycourse:lesson-ai:${type}:${lessonId}`

const hasTimelineSummary = (text?: string | null) => {
  if (!text) return false

  const timestampCount = text.match(/\[(?:\d{1,2}:)?\d{1,2}:\d{2}(?:\s*[-–]\s*(?:\d{1,2}:)?\d{1,2}:\d{2})?\]/g)?.length ?? 0
  return timestampCount >= 4 || /รายนาที|นาทีที่|ช่วงนาที/.test(text)
}

const getCachedQuiz = (lessonId: string): QuizQuestion[] | null => {
  try {
    const raw = window.localStorage.getItem(lessonAiCacheKey(lessonId, 'quiz'))
    const parsed = raw ? JSON.parse(raw) : null
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function InlineAiText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)

  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={`${part}-${index}`} className="font-semibold text-black">
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
    <div className="space-y-3 text-sm leading-7 text-zinc-700">
      {lines.map((line, index) => {
        const heading = line.match(/^(#{1,4})\s+(.+)$/)
        const bullet = line.match(/^[-*]\s+(.+)$/)

        if (heading) {
          return (
            <h4 key={`${line}-${index}`} className="pt-1 text-sm font-semibold leading-7 text-black">
              <InlineAiText text={heading[2]} />
            </h4>
          )
        }

        if (bullet) {
          return (
            <div key={`${line}-${index}`} className="flex gap-3">
              <CheckCircle2 size={15} className="mt-1 shrink-0 text-black" />
              <p>
                <InlineAiText text={bullet[1]} />
              </p>
            </div>
          )
        }

        return (
          <p key={`${line}-${index}`}>
            <InlineAiText text={line} />
          </p>
        )
      })}
    </div>
  )
}

export default function VideoLearning() {
  const { slug = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<AITab>('summary')
  const [contentTab, setContentTab] = useState<ContentTab>('overview')
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [aiQuiz, setAiQuiz] = useState<QuizQuestion[] | null>(null)
  const [aiLoading, setAiLoading] = useState<'transcript' | 'summary' | 'quiz' | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const [transcribedLessonIds, setTranscribedLessonIds] = useState<Set<string>>(() => new Set())
  const [enrollment, setEnrollment] = useState<StudentEnrollment | null>(null)
  const [progressLoading, setProgressLoading] = useState(false)
  const [progressMessage, setProgressMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [reviewRating, setReviewRating] = useState(0)
  const [reviewText, setReviewText] = useState('')
  const [lessonReviews, setLessonReviews] = useState<LessonReview[]>([])
  const { data: course, error, loading } = useApi(() => api.getCourse(slug), [slug])
  const sessionUser = authStorage.getSession()?.user

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
  const lessonStatus = lessonCompleted ? 'เรียนแล้ว' : isEnrolledStudent ? 'กำลังเรียน' : 'ตัวอย่าง'

  useEffect(() => {
    setEnrollment(course?.viewerState?.enrollment ?? null)
  }, [course?.viewerState?.enrollment])

  useEffect(() => {
    if (!course || !lesson || !isEnrolledStudent) return
    if (enrollment?.lastLessonId === lesson.id) return

    let cancelled = false

    api
      .rememberCurrentLesson(course.slug, lesson.id)
      .then((nextEnrollment) => {
        if (!cancelled) setEnrollment(nextEnrollment)
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [course?.slug, enrollment?.lastLessonId, isEnrolledStudent, lesson?.id])

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

  useEffect(() => {
    if (!lesson) return

    const cachedSummary = window.localStorage.getItem(lessonAiCacheKey(lesson.id, 'summary'))
    setAiError(null)
    window.localStorage.removeItem(`mycourse:lesson-ai:summary:${lesson.id}`)
    setAiSummary(cachedSummary ?? (hasTimelineSummary(lesson.aiSummary) ? lesson.aiSummary ?? null : null))
    setAiQuiz(getCachedQuiz(lesson.id))
  }, [lesson?.id])

  useEffect(() => {
    if (!lesson) return

    let cancelled = false
    const needsTranscript = Boolean(lesson.videoUrl) && !lesson.hasTranscript && !transcribedLessonIds.has(lesson.id)
    const needsSummary = !aiSummary && !lesson.aiSummary
    const currentQuiz = aiQuiz ?? lesson.quizQuestions
    const needsQuiz = currentQuiz.length === 0

    if (!needsSummary && !needsQuiz) return

    const runLessonAi = async () => {
      setAiError(null)

      if (needsTranscript) {
        setAiLoading('transcript')

        try {
          await api.transcribeLesson(lesson.id)
          if (!cancelled) {
            setTranscribedLessonIds((current) => new Set(current).add(lesson.id))
          }
        } catch (currentError) {
          if (!cancelled) {
            setTranscribedLessonIds((current) => new Set(current).add(lesson.id))
            setAiError(currentError instanceof Error ? currentError.message : 'ถอดสคริปต์ไม่สำเร็จ')
          }
        }
      }

      if (needsSummary) {
        setAiLoading('summary')

        try {
          const result = await api.summarizeLesson(lesson.id)
          if (cancelled) return
          setAiSummary(result.summary)
          window.localStorage.setItem(lessonAiCacheKey(lesson.id, 'summary'), result.summary)
        } catch (currentError) {
          if (!cancelled) {
            setAiError(currentError instanceof Error ? currentError.message : 'สร้างสรุปไม่สำเร็จ')
          }
        }
      }

      if (needsQuiz) {
        setAiLoading('quiz')

        try {
          const result = await api.generateLessonQuiz(lesson.id)
          if (cancelled) return
          setAiQuiz(result.questions)
          window.localStorage.setItem(lessonAiCacheKey(lesson.id, 'quiz'), JSON.stringify(result.questions))
        } catch (currentError) {
          if (!cancelled) {
            setAiError(currentError instanceof Error ? currentError.message : 'สร้างแบบทดสอบไม่สำเร็จ')
          }
        }
      }

      if (!cancelled) setAiLoading(null)
    }

    runLessonAi()

    return () => {
      cancelled = true
    }
  }, [aiQuiz, aiSummary, lesson, transcribedLessonIds])

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
      window.localStorage.setItem(lessonAiCacheKey(lesson.id, 'summary'), result.summary)
    } catch (currentError) {
      setAiError(currentError instanceof Error ? currentError.message : 'สร้างสรุปไม่สำเร็จ')
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
      window.localStorage.setItem(lessonAiCacheKey(lesson.id, 'quiz'), JSON.stringify(result.questions))
    } catch (currentError) {
      setAiError(currentError instanceof Error ? currentError.message : 'สร้างแบบทดสอบไม่สำเร็จ')
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
      <section className="min-h-screen bg-white p-6 text-black">
        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-sm text-zinc-500 shadow-sm">
          กำลังโหลดบทเรียน...
        </div>
      </section>
    )
  }

  if (error || !course || !lesson) {
    return (
      <section className="min-h-screen bg-white p-6 text-black">
        <div className="mx-auto max-w-xl rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-semibold text-black">ไม่พบบทเรียน</h1>
          <p className="mt-2 text-sm text-zinc-500">{error ?? 'บทเรียนนี้ยังไม่มีข้อมูลในระบบ'}</p>
          <Link to="/" className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-black px-5 text-sm font-semibold text-white">
            กลับหน้าหลัก
          </Link>
        </div>
      </section>
    )
  }

  const learnerAvatar = sessionUser?.avatarUrl

  return (
    <section className="min-h-screen bg-white text-black lg:pl-[280px]">
      <LearnProSidebar active="my-courses" />

      <main className="min-w-0">
        <div className="border-b border-zinc-200 bg-white px-4 py-4 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <Link
                to={`/courses/${course.slug}`}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white text-black transition hover:border-black"
                aria-label="กลับไปหน้าคอร์ส"
              >
                <ArrowLeft size={18} />
              </Link>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-black">{course.title}</p>
                <p className="truncate text-sm text-zinc-500">โดย {course.instructor.name}</p>
              </div>
            </div>

            <div className="hidden items-center gap-3 sm:flex">
              <button
                type="button"
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-black transition hover:border-black"
                onClick={() => setContentTab('notes')}
              >
                <ClipboardList size={17} />
                โน้ต
              </button>
              <button
                type="button"
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-black px-5 text-sm font-semibold text-white transition hover:bg-zinc-800"
                onClick={() => setActiveTab('ask')}
              >
                <Sparkles size={17} />
                AI ผู้ช่วย
              </button>
              {learnerAvatar ? (
                <img src={learnerAvatar} alt={sessionUser?.name ?? 'ผู้เรียน'} className="h-11 w-11 rounded-full object-cover" />
              ) : (
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-black">
                  <GraduationCap size={18} />
                </span>
              )}
              <ChevronDown size={16} className="text-zinc-600" />
            </div>
          </div>
        </div>

        <div className="mx-auto grid max-w-[1780px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_480px] lg:px-8 2xl:grid-cols-[minmax(0,1fr)_560px]">
          <div className="min-w-0">
            <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-600">บทเรียนที่ {lessonIndex + 1}</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-black">{lesson.title}</h1>
                <p className="mt-2 max-w-3xl text-base leading-7 text-zinc-600">{lesson.summary}</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {course.viewerState?.role === 'student' && course.viewerState.isEnrolled ? (
                  <button
                    type="button"
                    className={[
                      'inline-flex h-11 items-center gap-2 rounded-lg border px-4 text-sm font-semibold transition',
                      lessonCompleted
                        ? 'border-zinc-200 bg-zinc-50 text-zinc-500'
                        : 'border-zinc-200 bg-white text-black hover:border-black',
                    ].join(' ')}
                    onClick={completeLesson}
                    disabled={progressLoading || lessonCompleted}
                  >
                    <CheckCircle2 size={17} />
                    {progressLoading ? 'กำลังบันทึก...' : lessonCompleted ? 'เรียนจบแล้ว' : 'บันทึกว่าเรียนจบ'}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-zinc-200 bg-white text-black transition hover:border-black"
                  aria-label="ขยายวิดีโอ"
                >
                  <Maximize2 size={17} />
                </button>
              </div>
            </div>

            <VideoPlayer lesson={lesson} poster={course.coverImage} courseTitle={course.title} compact />

            <div className="mt-6 border-b border-zinc-200">
              <div className="flex gap-7 overflow-x-auto">
                {contentTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    className={[
                      'border-b-2 pb-3 text-sm font-semibold transition',
                      contentTab === tab.id ? 'border-black text-black' : 'border-transparent text-zinc-500 hover:text-black',
                    ].join(' ')}
                    onClick={() => setContentTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <section className="grid gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div>
                {contentTab === 'overview' ? (
                  <div className="text-sm leading-7 text-zinc-700">
                    <p>{lesson.summary || 'บทเรียนนี้จะพาคุณเรียนรู้เนื้อหาสำคัญ พร้อมตัวอย่างที่นำไปใช้ต่อได้จริง'}</p>
                    <h2 className="mt-5 font-semibold text-black">สิ่งที่คุณจะได้เรียนรู้</h2>
                    <ul className="mt-3 space-y-2">
                      {(course.outcomes.length ? course.outcomes : ['เข้าใจแนวคิดหลักของบทเรียน', 'นำตัวอย่างไปปรับใช้ได้', 'ทบทวนด้วย AI และแบบทดสอบ']).slice(0, 4).map((item) => (
                        <li key={item} className="flex gap-3">
                          <CheckCircle2 size={16} className="mt-1 shrink-0 text-black" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {contentTab === 'notes' ? (
                  <div className="rounded-xl border border-dashed border-zinc-200 p-5 text-sm leading-7 text-zinc-600">
                    ใช้พื้นที่นี้จดประเด็นสำคัญระหว่างเรียน และกลับมาเปิดทบทวนก่อนทำแบบทดสอบ
                  </div>
                ) : null}

                {contentTab === 'qa' ? (
                  <div className="rounded-xl border border-zinc-200 p-5">
                    <AIChatBox lessonId={lesson.id} lessonTitle={lesson.title} />
                  </div>
                ) : null}

                {contentTab === 'resources' ? (
                  <div className="rounded-xl border border-zinc-200 p-5 text-sm leading-7 text-zinc-600">
                    ไฟล์ประกอบบทเรียนจะแสดงในส่วนนี้เมื่อผู้สอนแนบไว้กับบทเรียน
                  </div>
                ) : null}
              </div>

              <aside className="rounded-xl bg-zinc-50 p-5">
                <div className="grid gap-5 text-sm">
                  <div className="flex gap-3">
                    <GraduationCap size={18} className="mt-1 text-black" />
                    <div>
                      <p className="text-zinc-500">ระดับ</p>
                      <p className="font-semibold text-black">{course.level}</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <FileText size={18} className="mt-1 text-black" />
                    <div>
                      <p className="text-zinc-500">บทเรียน</p>
                      <p className="font-semibold text-black">{course.lessons.length} บท</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <CheckCircle2 size={18} className="mt-1 text-black" />
                    <div>
                      <p className="text-zinc-500">สถานะ</p>
                      <p className="font-semibold text-black">{lessonStatus}</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <ClipboardList size={18} className="mt-1 text-black" />
                    <div>
                      <p className="text-zinc-500">ความคืบหน้า</p>
                      <p className="font-semibold text-black">{progressPercent}%</p>
                    </div>
                  </div>
                </div>
              </aside>
            </section>

            <div className="grid gap-4 border-t border-zinc-200 pt-6 lg:grid-cols-2">
              <button
                type="button"
                className="flex min-h-20 items-center justify-between rounded-xl border border-zinc-200 bg-white px-5 text-left transition hover:border-black disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!previousLesson}
                onClick={() => previousLesson && openLesson(previousLesson.id)}
              >
                <span className="flex items-center gap-4">
                  <ArrowLeft size={18} />
                  <span>
                    <span className="block text-sm font-semibold text-black">บทก่อนหน้า</span>
                    <span className="mt-1 block text-sm text-zinc-600">{previousLesson?.title ?? '-'}</span>
                  </span>
                </span>
              </button>

              <button
                type="button"
                className="flex min-h-20 items-center justify-between rounded-xl bg-black px-5 text-left text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!nextLesson}
                onClick={() => nextLesson && openLesson(nextLesson.id)}
              >
                <span>
                  <span className="block text-sm font-semibold">{nextLesson ? 'บทถัดไป' : 'เรียนครบแล้ว'}</span>
                  <span className="mt-1 block text-sm text-white/70">{nextLesson?.title ?? '-'}</span>
                </span>
                <ArrowRight size={18} />
              </button>
            </div>

            {progressMessage ? (
              <p
                className={`mt-4 rounded-lg p-3 text-sm ${
                  progressMessage.tone === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                }`}
              >
                {progressMessage.text}
              </p>
            ) : null}

            <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-5">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-black">
                  <MessageSquare size={18} />
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-black">ความคิดเห็นบทเรียน</h2>
                  <p className="mt-1 text-sm text-zinc-500">ให้คะแนนและบันทึกความเห็นของคุณหลังเรียนบทนี้</p>
                </div>
              </div>

              <form className="mt-5 space-y-4" onSubmit={submitReview}>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-medium text-zinc-700">ให้ดาว</span>
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
                            active ? 'bg-zinc-100 text-black' : 'text-zinc-300 hover:bg-zinc-100 hover:text-black'
                          }`}
                          onClick={() => setReviewRating(rating)}
                        >
                          <Star size={19} fill={active ? 'currentColor' : 'none'} />
                        </button>
                      )
                    })}
                  </div>
                  {reviewRating > 0 ? <span className="text-sm font-semibold text-black">{reviewRating}/5</span> : null}
                </div>

                <textarea
                  value={reviewText}
                  onChange={(event) => setReviewText(event.target.value)}
                  className="min-h-[112px] w-full rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-black outline-none transition placeholder:text-zinc-400 focus:border-black"
                  placeholder="เขียนความคิดเห็นหรือสิ่งที่อยากจดจำจากบทเรียนนี้"
                />

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-black px-5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
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
                    <article key={review.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1 text-black">
                          {[1, 2, 3, 4, 5].map((rating) => (
                            <Star
                              key={rating}
                              size={15}
                              fill={rating <= review.rating ? 'currentColor' : 'none'}
                              className={rating <= review.rating ? 'text-black' : 'text-zinc-300'}
                            />
                          ))}
                        </div>
                        <span className="text-xs text-zinc-400">{review.createdAt}</span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-zinc-700">{review.text}</p>
                    </article>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
                    ยังไม่มีความคิดเห็นสำหรับบทนี้
                  </div>
                )}
              </div>
            </section>
          </div>

          <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
            <section className="flex h-[720px] max-h-[calc(100vh-2rem)] min-h-[600px] flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex shrink-0 items-center gap-3">
                <Sparkles size={18} />
                <h2 className="text-lg font-semibold text-black">AI ผู้ช่วย</h2>
              </div>

              <div className="mt-5 grid shrink-0 grid-cols-3 border-b border-zinc-200 text-sm">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    className={[
                      'border-b-2 px-2 pb-3 font-semibold transition',
                      activeTab === tab.id ? 'border-black text-black' : 'border-transparent text-zinc-500 hover:text-black',
                    ].join(' ')}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="mt-5 min-h-0 flex-1 overflow-hidden">
                {activeTab === 'summary' ? (
                  <div className="flex h-full min-h-0 flex-col gap-4">
                    {aiError ? <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{aiError}</p> : null}
                    <div className="min-h-0 flex-1 overflow-y-auto rounded-lg bg-zinc-50/70 p-4">
                      <AiResponsePanel text={aiSummary ?? lesson.aiSummary ?? lesson.summary} />
                    </div>
                    <button
                      type="button"
                      className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-black transition hover:border-black"
                      onClick={generateSummary}
                      disabled={aiLoading === 'summary'}
                    >
                      <FileText size={16} />
                      {aiLoading === 'summary' ? 'AI กำลังสรุป...' : 'ให้ AI สรุป'}
                    </button>
                  </div>
                ) : null}

                {activeTab === 'ask' ? <AIChatBox lessonId={lesson.id} lessonTitle={lesson.title} className="h-full max-h-none" /> : null}

                {activeTab === 'quiz' ? (
                  <div className="flex h-full min-h-0 flex-col gap-4">
                    <button
                      type="button"
                      className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-black px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={generateQuiz}
                      disabled={aiLoading === 'quiz'}
                    >
                      <HelpCircle size={16} />
                      {aiLoading === 'quiz' ? 'AI กำลังออกข้อสอบ...' : 'ให้ AI ออกข้อสอบ'}
                    </button>
                    {aiError ? <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{aiError}</p> : null}
                    <div className="min-h-0 flex-1 overflow-y-auto rounded-lg bg-zinc-50/70 p-3">
                      <QuizCard questions={aiQuiz ?? lesson.quizQuestions} />
                    </div>
                  </div>
                ) : null}
              </div>
            </section>

            <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-lg font-semibold text-black">เนื้อหาคอร์ส</h2>
                <p className="text-sm text-zinc-500">{course.lessons.length} บทเรียน</p>
              </div>

              <div className="mt-5 space-y-1">
                {course.lessons.map((item, index) => {
                  const active = item.id === lesson.id
                  const completed = enrollment ? enrollment.completedLessons > index : false
                  const locked = !isEnrolledStudent && !item.preview

                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={[
                        'grid w-full grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-3 py-3 text-left text-sm transition',
                        active ? 'bg-zinc-100 text-black' : 'bg-white text-zinc-700 hover:bg-zinc-50',
                      ].join(' ')}
                      onClick={() => openLesson(item.id)}
                    >
                      <span className="text-xs text-zinc-500">{index + 1}.</span>
                      <span className="min-w-0 truncate font-medium">{item.title}</span>
                      <span className="flex items-center gap-3 text-xs text-zinc-500">
                        <span>{item.duration}</span>
                        {active ? <PlayCircle size={16} className="text-black" /> : completed ? <CheckCircle2 size={16} /> : locked ? <Lock size={15} /> : null}
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>
          </aside>
        </div>
      </main>
    </section>
  )
}
