import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  CheckCircle2,
  FileText,
  HelpCircle,
  ListVideo,
  Sparkles,
} from 'lucide-react'
import AIChatBox from '../components/AIChatBox'
import QuizCard from '../components/QuizCard'
import VideoPlayer from '../components/VideoPlayer'
import { useApi } from '../hooks/useApi'
import { api } from '../services/api'
import type { QuizQuestion } from '../types/quiz'

type AITab = 'summary' | 'ask' | 'quiz'

const tabs: Array<{ id: AITab; label: string; icon: typeof FileText }> = [
  { id: 'summary', label: 'Summary', icon: FileText },
  { id: 'ask', label: 'Ask AI', icon: Bot },
  { id: 'quiz', label: 'Quiz', icon: HelpCircle },
]

export default function VideoLearning() {
  const { slug = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<AITab>('summary')
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [aiQuiz, setAiQuiz] = useState<QuizQuestion[] | null>(null)
  const [aiLoading, setAiLoading] = useState<'summary' | 'quiz' | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
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
    if (!course || lessonIndex < 0) return 0
    return Math.round(((lessonIndex + 1) / Math.max(course.lessons.length, 1)) * 100)
  }, [course, lessonIndex])

  const previousLesson = lessonIndex > 0 ? course?.lessons[lessonIndex - 1] : undefined
  const nextLesson = course && lessonIndex >= 0 ? course.lessons[lessonIndex + 1] : undefined

  const openLesson = (nextLessonId: string) => {
    setAiSummary(null)
    setAiQuiz(null)
    setAiError(null)
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
      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-5">
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

          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[360px]">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-medium uppercase text-slate-400">เวลา</p>
              <p className="mt-1 text-sm font-semibold text-slate-950">{lesson.duration}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-medium uppercase text-slate-400">ความคืบหน้า</p>
              <p className="mt-1 text-sm font-semibold text-slate-950">{progressPercent}%</p>
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
            <div className="h-2 rounded-full bg-slate-950 transition-all" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[280px_minmax(0,980px)] xl:justify-center">
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
                      {item.preview ? (
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

          <section className="rounded-lg border border-slate-200 bg-white">
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

                <div className="grid grid-cols-3 rounded-lg bg-slate-200 p-1 lg:min-w-[360px]">
                  {tabs.map((tab) => {
                    const Icon = tab.icon

                    return (
                      <button
                        key={tab.id}
                        type="button"
                        className={`flex items-center justify-center gap-2 rounded-md px-2 py-2 text-xs font-semibold transition sm:text-sm ${
                          activeTab === tab.id ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600'
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

                  <p className="whitespace-pre-line rounded-lg border border-slate-200 bg-slate-50 p-4">
                    {aiSummary ?? lesson.summary}
                  </p>

                  <div className="rounded-lg bg-slate-50 p-4">
                    <p className="font-semibold text-slate-950">ประเด็นที่ควรจำ</p>
                    <ul className="mt-3 space-y-2">
                      {course.outcomes.slice(0, 3).map((item) => (
                        <li key={item} className="flex gap-2">
                          <CheckCircle2 size={16} className="mt-1 shrink-0 text-slate-950" />
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
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <h2 className="text-lg font-semibold text-slate-950">เกี่ยวกับบทเรียนนี้</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{lesson.summary}</p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[280px] lg:grid-cols-1">
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
                    บทถัดไป
                    <ArrowRight size={16} />
                  </span>
                  <span className="truncate text-xs text-white/70">{nextLesson?.title ?? '-'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
