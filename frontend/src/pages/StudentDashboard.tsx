import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  BookOpenCheck,
  Camera,
  Clock3,
  ListVideo,
  PlayCircle,
  Settings,
  Trophy,
  UserRound,
} from 'lucide-react'
import { useApi } from '../hooks/useApi'
import { api, authStorage, type StudentCourse, type StudentProfile } from '../services/api'

type ProfileDraft = Pick<StudentProfile, 'name' | 'avatarUrl'>
type CourseFilter = 'all' | 'active' | 'completed' | 'not-started'

const emptyProfile: ProfileDraft = {
  name: '',
  avatarUrl: '',
}

const courseFilterOptions: Array<{ value: CourseFilter; label: string }> = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'active', label: 'กำลังเรียน' },
  { value: 'completed', label: 'เรียนจบแล้ว' },
  { value: 'not-started', label: 'ยังไม่เริ่ม' },
]

const getLessonTitle = (item: StudentCourse) => {
  const lessonId = item.enrollment.lastLessonId
  const lesson = item.course.lessons.find((courseLesson) => courseLesson.id === lessonId)

  if (lesson) return lesson.title
  if (item.enrollment.progress >= 100) return 'เรียนครบทุกบทแล้ว'
  return item.course.lessons[0]?.title ?? 'เริ่มบทเรียนแรก'
}

export default function StudentDashboard() {
  const [searchParams] = useSearchParams()
  const section = searchParams.get('section')
  const activeSection = section === 'settings' || section === 'profile' ? section : 'courses'
  const { data, error, loading } = useApi(() => api.getStudentDashboard(), [])
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [draft, setDraft] = useState<ProfileDraft>(emptyProfile)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [savingProfile, setSavingProfile] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [courseFilter, setCourseFilter] = useState<CourseFilter>('all')

  const currentProfile = data ? (profile ?? data.profile) : null

  useEffect(() => {
    if (!data || !currentProfile) return

    const nextDraft = {
      name: currentProfile.name || data.user.name,
      avatarUrl: currentProfile.avatarUrl || data.user.avatarUrl || '',
    }

    setDraft(nextDraft)
  }, [
    currentProfile?.avatarUrl,
    currentProfile?.name,
    currentProfile?.updatedAt,
    data?.user.avatarUrl,
    data?.user.id,
    data?.user.name,
  ])

  const continueCourse = useMemo(() => {
    if (!data?.courses.length) return null

    const inProgress = data.courses
      .filter((item) => item.enrollment.progress > 0 && item.enrollment.progress < 100)
      .sort((left, right) => Number(Boolean(right.enrollment.lastLessonId)) - Number(Boolean(left.enrollment.lastLessonId)))

    return inProgress[0] ?? data.courses.find((item) => item.enrollment.progress < 100) ?? data.courses[0]
  }, [data?.courses])

  const filteredCourses = useMemo(() => {
    const courses = data?.courses ?? []

    if (courseFilter === 'active') {
      return courses.filter((item) => item.enrollment.progress > 0 && item.enrollment.progress < 100)
    }

    if (courseFilter === 'completed') {
      return courses.filter((item) => item.enrollment.progress >= 100)
    }

    if (courseFilter === 'not-started') {
      return courses.filter((item) => item.enrollment.progress <= 0)
    }

    return courses
  }, [courseFilter, data?.courses])

  if (loading) return <div className="card p-6 text-sm text-slate-500">กำลังโหลดข้อมูลผู้เรียน...</div>
  if (error) return <div className="card p-6 text-sm text-rose-600">{error}</div>
  if (!data || !currentProfile) return null

  const learningPathFor = (item: StudentCourse) =>
    item.enrollment.lastLessonId
      ? `/learn/${item.course.slug}?lesson=${item.enrollment.lastLessonId}`
      : `/learn/${item.course.slug}`

  const handleAvatarChange = async (file: File | undefined) => {
    if (!file) return

    setUploadingAvatar(true)
    setProfileError(null)

    try {
      const uploaded = await api.uploadAsset({ kind: 'avatar', file })
      setDraft((current) => ({ ...current, avatarUrl: uploaded.fileUrl }))
    } catch (currentError) {
      setProfileError(currentError instanceof Error ? currentError.message : 'อัปโหลดรูปบัญชีไม่สำเร็จ')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const saveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSavingProfile(true)
    setProfileError(null)

    try {
      const nextProfile = await api.updateStudentProfile({
        name: draft.name,
        avatarUrl: draft.avatarUrl,
        headline: currentProfile.headline,
        bio: currentProfile.bio,
        learningGoal: currentProfile.learningGoal,
        phone: currentProfile.phone,
      })
      setProfile(nextProfile)

      const session = authStorage.getSession()
      if (session) {
        authStorage.setSession({
          ...session,
          user: {
            ...session.user,
            name: nextProfile.name || draft.name,
            avatarUrl: nextProfile.avatarUrl || undefined,
          },
        })
      }
    } catch (currentError) {
      setProfileError(currentError instanceof Error ? currentError.message : 'บันทึกการตั้งค่าไม่สำเร็จ')
    } finally {
      setSavingProfile(false)
    }
  }

  if (activeSection === 'settings' || activeSection === 'profile') {
    const isSettings = activeSection === 'settings'

    return (
      <div className="space-y-6">
        <section className="card p-5 sm:p-6">
          <h1 className="text-2xl font-semibold text-slate-950">{isSettings ? 'การตั้งค่า' : 'โปรไฟล์ผู้เรียน'}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            {isSettings ? 'ตั้งค่าชื่อและรูปที่ใช้แสดงในบัญชีผู้เรียน' : 'เปลี่ยนชื่อและรูปโปรไฟล์ที่ใช้แสดงในระบบ'}
          </p>
        </section>

        <section className="card overflow-hidden">
          <form className="grid gap-0 lg:grid-cols-[280px_minmax(0,1fr)]" onSubmit={saveProfile}>
            <div className="border-b border-slate-200 bg-slate-50 p-5 lg:border-b-0 lg:border-r">
              <div className="flex flex-col items-start gap-4">
                {draft.avatarUrl ? (
                  <img src={draft.avatarUrl} alt="รูปบัญชี" className="h-32 w-32 rounded-lg object-cover" />
                ) : (
                  <span className="inline-flex h-32 w-32 items-center justify-center rounded-lg bg-slate-950 text-white">
                    <UserRound size={40} />
                  </span>
                )}

                <div>
                  <p className="text-sm font-semibold text-slate-950">{isSettings ? 'รูปบัญชี' : 'รูปโปรไฟล์'}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">รองรับ JPG, PNG, WEBP ไม่เกิน 5MB</p>
                  <label className="btn-secondary mt-3 inline-flex cursor-pointer px-3 py-2">
                    <Camera size={16} />
                    {uploadingAvatar ? 'กำลังอัปโหลด...' : 'อัปโหลดรูป'}
                    <input
                      type="file"
                      className="hidden"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={uploadingAvatar}
                      onChange={(event) => handleAvatarChange(event.target.files?.[0])}
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="space-y-4 p-5">
              <label className="block">
                <span className="field-label">ชื่อที่แสดง</span>
                <input
                  className="field-input"
                  value={draft.name}
                  onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                  placeholder="ชื่อ-นามสกุล"
                  required
                />
              </label>

              {profileError ? <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{profileError}</p> : null}

              <div className="flex justify-end border-t border-slate-200 pt-4">
                <button type="submit" className="btn-primary" disabled={savingProfile || uploadingAvatar}>
                  {savingProfile ? 'กำลังบันทึก...' : isSettings ? 'บันทึกการตั้งค่า' : 'บันทึกโปรไฟล์'}
                </button>
              </div>
            </div>
          </form>
        </section>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="card overflow-hidden p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500">
              <Settings size={16} />
              การตั้งค่า
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-950">จัดการบัญชีผู้เรียน</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              ปรับชื่อ รูปบัญชี และกลับมาเรียนต่อจากคอร์สของคุณได้ในหน้าเดียว
            </p>
          </div>
          <Link to="/student?section=settings" className="btn-secondary w-fit">
            เปิดการตั้งค่า
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {continueCourse ? (
        <section className="overflow-hidden rounded-lg bg-slate-950 text-white shadow-lg shadow-slate-950/15 dark:border dark:border-white/10 dark:bg-white dark:text-slate-950 dark:shadow-black/30">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_460px] 2xl:grid-cols-[minmax(0,1fr)_560px]">
            <div className="p-5 sm:p-6 lg:p-7">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold dark:border-slate-200 dark:bg-slate-100">
                  <PlayCircle size={14} />
                  เรียนต่อจากครั้งล่าสุด
                </span>
                <span className="rounded-md bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-200 dark:bg-emerald-50 dark:text-emerald-700">
                  {continueCourse.enrollment.progress}% สำเร็จแล้ว
                </span>
              </div>
              <h2 className="mt-4 max-w-2xl text-2xl font-semibold leading-9 sm:text-3xl">
                {continueCourse.course.title}
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-300 dark:text-slate-600">
                บทล่าสุด: {getLessonTitle(continueCourse)}
              </p>
              <div className="mt-5 max-w-xl">
                <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-300 dark:text-slate-600">
                  <span>ความคืบหน้ารวม</span>
                  <span>{continueCourse.enrollment.completedLessons} / {continueCourse.course.lessons.length} บท</span>
                </div>
                <div className="h-2 rounded-full bg-white/15 dark:bg-slate-200">
                  <div
                    className="h-2 rounded-full bg-emerald-400 dark:bg-emerald-500"
                    style={{ width: `${Math.min(continueCourse.enrollment.progress, 100)}%` }}
                  />
                </div>
              </div>
              <Link to={learningPathFor(continueCourse)} className="mt-6 inline-flex items-center gap-2 rounded-md bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-800">
                เรียนต่อ
                <ArrowRight size={16} />
              </Link>
            </div>
            <div className="min-h-56 border-t border-white/10 bg-white/5 p-4 dark:border-slate-200 dark:bg-slate-50 lg:border-l lg:border-t-0">
              <img
                src={continueCourse.course.coverImage}
                alt={continueCourse.course.title}
                className="h-full min-h-48 w-full rounded-lg object-cover"
              />
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        {[
          {
            label: 'คอร์สที่สมัคร',
            value: data.stats.enrolledCourses,
            icon: BookOpenCheck,
            accent: 'bg-sky-500',
            iconClass: 'bg-sky-50 text-sky-600 ring-sky-100 dark:bg-sky-400/10 dark:text-sky-300 dark:ring-sky-400/20',
            surfaceClass: 'border-sky-100 bg-sky-50/55 shadow-sky-100/70 dark:border-sky-400/20 dark:bg-sky-400/10',
          },
          {
            label: 'Progress เฉลี่ย',
            value: `${data.stats.averageProgress}%`,
            icon: Trophy,
            accent: 'bg-emerald-500',
            iconClass: 'bg-emerald-50 text-emerald-600 ring-emerald-100 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/20',
            surfaceClass: 'border-emerald-100 bg-emerald-50/55 shadow-emerald-100/70 dark:border-emerald-400/20 dark:bg-emerald-400/10',
          },
          {
            label: 'บทเรียนที่ทำแล้ว',
            value: `${data.stats.completedLessons} บท`,
            icon: Clock3,
            accent: 'bg-violet-500',
            iconClass: 'bg-violet-50 text-violet-600 ring-violet-100 dark:bg-violet-400/10 dark:text-violet-300 dark:ring-violet-400/20',
            surfaceClass: 'border-violet-100 bg-violet-50/55 shadow-violet-100/70 dark:border-violet-400/20 dark:bg-violet-400/10',
          },
        ].map((stat) => {
          const Icon = stat.icon

          return (
            <div
              key={stat.label}
              className={`overflow-hidden rounded-lg border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${stat.surfaceClass}`}
            >
              <div className={`-mx-5 -mt-5 mb-5 h-1 ${stat.accent}`} />
              <div className="flex items-start justify-between gap-4">
                <span className={`inline-flex h-11 w-11 items-center justify-center rounded-md ring-1 ${stat.iconClass}`}>
                  <Icon size={20} />
                </span>
                <p className="text-3xl font-semibold leading-none text-slate-950">{stat.value}</p>
              </div>
              <p className="mt-4 text-sm font-medium text-slate-600">{stat.label}</p>
            </div>
          )
        })}
      </section>

      <section>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">คอร์สของฉัน</h2>
            <p className="mt-1 text-sm text-slate-500">ดูสถานะและความคืบหน้าของแต่ละคอร์ส</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="block">
              <span className="sr-only">กรองคอร์ส</span>
              <select
                className="field-input mt-0 min-w-40"
                value={courseFilter}
                onChange={(event) => setCourseFilter(event.target.value as CourseFilter)}
              >
                {courseFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <Link to="/courses" className="btn-secondary shrink-0 px-3 py-2">
              ดูคอร์สเพิ่มเติม
            </Link>
          </div>
        </div>
        {filteredCourses.length > 0 ? (
          <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3 min-[1800px]:grid-cols-4">
            {filteredCourses.map((item) => {
              const nextLessonIndex =
                item.enrollment.progress >= 100
                  ? -1
                  : Math.min(item.enrollment.completedLessons, Math.max(item.course.lessons.length - 1, 0))
              const nextLesson = item.course.lessons.find((lesson) => lesson.id === item.enrollment.lastLessonId) ?? item.course.lessons[nextLessonIndex]

              return (
                <article key={item.course.id} className="overflow-hidden rounded-lg border border-slate-200/80 bg-white shadow-sm shadow-slate-200/70 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-300/40 dark:border-white/10 dark:bg-slate-900 dark:shadow-black/30">
                  <div className="relative">
                    <img src={item.course.coverImage} alt={item.course.title} className="aspect-[16/8] w-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4">
                      <span className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                        <ListVideo size={14} />
                        {item.course.lessons.length} บทเรียนที่ต้องเรียน
                      </span>
                      <h3 className="mt-3 line-clamp-2 text-xl font-semibold leading-7 text-white">{item.course.title}</h3>
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-medium text-slate-500">บทถัดไป</p>
                        <p className="mt-1 line-clamp-1 text-sm font-semibold text-slate-950">
                          {nextLesson?.title ?? 'เรียนครบทุกบทแล้ว'}
                        </p>
                      </div>
                      <Link to={learningPathFor(item)} className="btn-primary shrink-0 px-3 py-2">
                        {item.enrollment.progress >= 100 ? 'ทบทวน' : 'เรียนต่อ'}
                        <ArrowRight size={15} />
                      </Link>
                    </div>

                    <div className="mt-4">
                      <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-600">
                        <span>ความคืบหน้า</span>
                        <span>{item.enrollment.progress}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className="h-2 rounded-full bg-emerald-500"
                          style={{ width: `${Math.min(item.enrollment.progress, 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-white/10 dark:bg-slate-950">
                      <div>
                        <p className="text-xs text-slate-500">บทเรียนทั้งหมด</p>
                        <p className="mt-1 font-semibold text-slate-950">{item.course.lessons.length} บท</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">เรียนแล้ว</p>
                        <p className="mt-1 font-semibold text-slate-950">{item.enrollment.completedLessons} บท</p>
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        ) : data.courses.length > 0 ? (
          <div className="card p-8 text-center">
            <h3 className="text-lg font-semibold text-slate-950">ไม่มีคอร์สในตัวกรองนี้</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              ลองเลือกตัวกรองอื่นเพื่อดูคอร์สที่สมัครไว้
            </p>
          </div>
        ) : (
          <div className="card p-8 text-center">
            <h3 className="text-lg font-semibold text-slate-950">ยังไม่มีคอร์สที่สมัคร</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              เลือกคอร์สที่สนใจจากหน้าคอร์สทั้งหมด เมื่อสมัครแล้วคอร์สจะแสดงในหน้านี้
            </p>
            <Link to="/courses" className="btn-primary mt-5">
              ดูคอร์สทั้งหมด
            </Link>
          </div>
        )}
      </section>
    </div>
  )
}
