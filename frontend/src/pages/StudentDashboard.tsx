import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Bell,
  BookOpenCheck,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  Menu,
  MoreVertical,
  Search,
  Sparkles,
  UserRound,
} from 'lucide-react'
import { api, authStorage, studentDashboardStorage, type StudentCourse, type StudentProfile } from '../services/api'
import { useApi } from '../hooks/useApi'
import LearnProSidebar from '../components/LearnProSidebar'

type ProfileDraft = Pick<StudentProfile, 'name' | 'avatarUrl'>
type CourseFilter = 'all' | 'active' | 'completed' | 'saved'

const emptyProfile: ProfileDraft = {
  name: '',
  avatarUrl: '',
}

const courseFilterOptions: Array<{ value: CourseFilter; label: string }> = [
  { value: 'all', label: 'คอร์สทั้งหมด' },
  { value: 'active', label: 'กำลังเรียน' },
  { value: 'completed', label: 'เรียนจบแล้ว' },
  { value: 'saved', label: 'บันทึกไว้' },
]

const learningPathFor = (item: StudentCourse) =>
  item.enrollment.lastLessonId
    ? `/learn/${item.course.slug}?lesson=${item.enrollment.lastLessonId}`
    : `/learn/${item.course.slug}`

const getLessonTitle = (item: StudentCourse) => {
  const lessonId = item.enrollment.lastLessonId
  const lesson = item.course.lessons.find((courseLesson) => courseLesson.id === lessonId)

  if (lesson) return lesson.title
  if (item.enrollment.progress >= 100) return 'เรียนครบทุกบทแล้ว'
  return item.course.lessons[0]?.title ?? 'เริ่มบทเรียนแรก'
}

const getNextLessonMeta = (item: StudentCourse) => {
  const currentLesson = getLessonTitle(item)
  const lessonIndex = item.enrollment.progress >= 100 ? item.course.lessons.length : item.enrollment.completedLessons + 1

  return `บทที่ ${Math.max(1, lessonIndex)} - ${currentLesson}`
}

const formatNumber = (value: number) => value.toLocaleString('en-US')

function CourseThumb({ item, compact = false }: { item: StudentCourse; compact?: boolean }) {
  return (
    <div className={`relative overflow-hidden rounded-md bg-black ${compact ? 'h-16 w-28' : 'h-20 w-32'}`}>
      <img src={item.course.coverImage} alt={item.course.title} className="h-full w-full object-cover opacity-75" />
      <div className="absolute inset-0 bg-gradient-to-tr from-black via-black/50 to-black/10" />
      <div className="absolute inset-x-3 bottom-2">
        <p className="line-clamp-2 text-xs font-semibold leading-4 text-white">{item.course.title}</p>
      </div>
    </div>
  )
}

function ProfilePanel({
  currentProfile,
  draft,
  setDraft,
  profileError,
  uploadingAvatar,
  savingProfile,
  onAvatarChange,
  onSubmit,
}: {
  currentProfile: StudentProfile
  draft: ProfileDraft
  setDraft: React.Dispatch<React.SetStateAction<ProfileDraft>>
  profileError: string | null
  uploadingAvatar: boolean
  savingProfile: boolean
  onAvatarChange: (file: File | undefined) => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <h1 className="text-3xl font-semibold tracking-tight text-black">ตั้งค่า</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-500">จัดการโปรไฟล์ผู้เรียนและข้อมูลที่แสดงในบัญชีของคุณ</p>
        <div className="mt-8 flex items-center gap-4">
          {draft.avatarUrl ? (
            <img src={draft.avatarUrl} alt={draft.name} className="h-24 w-24 rounded-full object-cover" />
          ) : (
            <span className="inline-flex h-24 w-24 items-center justify-center rounded-full bg-black text-white">
              <UserRound size={34} />
            </span>
          )}
          <div>
            <p className="font-semibold text-black">{currentProfile.name || 'ผู้เรียน'}</p>
            <p className="mt-1 text-sm text-zinc-500">{currentProfile.headline || 'สมาชิกผู้เรียน'}</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <form className="space-y-5" onSubmit={onSubmit}>
          <label className="block">
            <span className="text-sm font-semibold text-black">ชื่อที่แสดง</span>
            <input
              className="mt-2 h-12 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-4 text-sm text-black outline-none transition focus:border-black focus:bg-white"
              value={draft.name}
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
              placeholder="ชื่อของคุณ"
              required
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-black">รูปโปรไฟล์</span>
            <input
              type="file"
              className="mt-2 w-full rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-4 py-4 text-sm text-zinc-600 file:mr-3 file:rounded-md file:border-0 file:bg-black file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploadingAvatar}
              onChange={(event) => onAvatarChange(event.target.files?.[0])}
            />
          </label>

          {profileError ? <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{profileError}</p> : null}

          <div className="flex justify-end border-t border-zinc-200 pt-5">
            <button type="submit" className="rounded-md bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800" disabled={savingProfile || uploadingAvatar}>
              {savingProfile ? 'กำลังบันทึก...' : 'บันทึกโปรไฟล์'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

export default function StudentDashboard() {
  const [searchParams] = useSearchParams()
  const section = searchParams.get('section')
  const activeSection = section === 'settings' || section === 'profile' || section === 'my-courses' ? section : 'home'
  const { data, error, loading } = useApi(() => api.getStudentDashboard(), [], studentDashboardStorage.get())
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [draft, setDraft] = useState<ProfileDraft>(emptyProfile)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [savingProfile, setSavingProfile] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [courseFilter, setCourseFilter] = useState<CourseFilter>('all')
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const myCoursesSectionRef = useRef<HTMLElement | null>(null)

  const currentProfile = data ? (profile ?? data.profile) : null

  useEffect(() => {
    if (!data || !currentProfile) return

    setDraft({
      name: currentProfile.name || data.user.name,
      avatarUrl: currentProfile.avatarUrl || data.user.avatarUrl || '',
    })
  }, [
    currentProfile?.avatarUrl,
    currentProfile?.name,
    currentProfile?.updatedAt,
    data?.user.avatarUrl,
    data?.user.id,
    data?.user.name,
  ])

  useEffect(() => {
    if (activeSection === 'my-courses') {
      myCoursesSectionRef.current?.scrollIntoView({ block: 'start' })
    }
  }, [activeSection])

  const continueCourse = useMemo(() => {
    if (!data?.courses.length) return null

    return data.courses.find((item) => item.enrollment.progress < 100) ?? data.courses[0]
  }, [data?.courses])

  const filteredCourses = useMemo(() => {
    const courses = data?.courses ?? []

    if (courseFilter === 'active') {
      return courses.filter((item) => item.enrollment.progress > 0 && item.enrollment.progress < 100)
    }

    if (courseFilter === 'completed') {
      return courses.filter((item) => item.enrollment.progress >= 100)
    }

    if (courseFilter === 'saved') {
      return courses.slice(0, 3)
    }

    return courses
  }, [courseFilter, data?.courses])

  const recommendedCourses = useMemo(() => {
    const courses = data?.courses ?? []
    if (courses.length <= 1) return courses
    return [...courses].sort((left, right) => right.course.rating - left.course.rating).slice(0, 4)
  }, [data?.courses])

  if (loading && !data) {
    return <div className="min-h-screen bg-white p-6 text-sm text-zinc-500">กำลังโหลดแดชบอร์ดผู้เรียน...</div>
  }

  if (error && !data) {
    return <div className="min-h-screen bg-white p-6 text-sm text-rose-600">{error}</div>
  }

  if (!data || !currentProfile) return null

  const handleAvatarChange = async (file: File | undefined) => {
    if (!file) return

    setUploadingAvatar(true)
    setProfileError(null)

    try {
      const uploaded = await api.uploadAsset({ kind: 'avatar', file })
      setDraft((current) => ({ ...current, avatarUrl: uploaded.fileUrl }))
    } catch (currentError) {
      setProfileError(currentError instanceof Error ? currentError.message : 'อัปโหลดไม่สำเร็จ')
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
      setProfileError(currentError instanceof Error ? currentError.message : 'บันทึกไม่สำเร็จ')
    } finally {
      setSavingProfile(false)
    }
  }

  const coursesInProgress = data.courses.filter((item) => item.enrollment.progress > 0 && item.enrollment.progress < 100).length
  const weeklyBars = [72, 48, 86, 38, 26, 28, 42]

  return (
    <div className="student-page-shell">
      <LearnProSidebar
        active={
          activeSection === 'settings' || activeSection === 'profile'
            ? 'settings'
            : activeSection === 'my-courses'
              ? 'my-courses'
              : 'home'
        }
        profileName={currentProfile.name || data.user.name}
        profileAvatarUrl={currentProfile.avatarUrl || data.user.avatarUrl}
        profileLabel={currentProfile.headline || 'บัญชีผู้เรียน'}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />

      <main className="student-page-main min-w-0">
        <div className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6 lg:px-8">
          <header className="mb-6 flex items-center gap-4">
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-zinc-200 bg-white lg:hidden"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="เปิดเมนู"
            >
              <Menu size={20} />
            </button>
            <label className="relative hidden flex-1 md:block xl:max-w-[520px]">
              <Search size={19} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                className="h-12 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-12 pr-4 text-sm outline-none transition placeholder:text-zinc-500 focus:border-black focus:bg-white"
                placeholder="ค้นหาคอร์สหรือบทเรียน..."
              />
            </label>
            <div className="ml-auto flex items-center gap-3">
              <Link to="/courses?cart=1" className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-zinc-200 bg-white text-black">
                <BookOpenCheck size={19} />
              </Link>
              <button type="button" className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-zinc-200 bg-white">
                <Bell size={18} />
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-black" />
              </button>
              <Link to="/student?section=profile" className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white py-1 pl-1 pr-3">
                {currentProfile.avatarUrl ? (
                  <img src={currentProfile.avatarUrl} alt={currentProfile.name} className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-black text-white">
                    <UserRound size={16} />
                  </span>
                )}
                <span className="hidden text-sm font-semibold sm:inline">สวัสดี, {currentProfile.name || data.user.name}</span>
                <ChevronDown size={16} />
              </Link>
            </div>
          </header>

          {activeSection === 'settings' || activeSection === 'profile' ? (
            <div key={activeSection} className="student-section-panel">
              <ProfilePanel
                currentProfile={currentProfile}
                draft={draft}
                setDraft={setDraft}
                profileError={profileError}
                uploadingAvatar={uploadingAvatar}
                savingProfile={savingProfile}
                onAvatarChange={handleAvatarChange}
                onSubmit={saveProfile}
              />
            </div>
          ) : (
            <div key={activeSection} className="student-section-panel grid gap-7 xl:grid-cols-[minmax(0,1fr)_430px]">
              <div className="min-w-0 space-y-7">
                <section className="relative overflow-hidden rounded-xl border border-zinc-200 bg-white p-7 shadow-sm">
                  <div className="max-w-xl">
                    <h1 className="text-3xl font-semibold tracking-tight text-black sm:text-4xl">
                      สวัสดี, {currentProfile.name || data.user.name}
                    </h1>
                    <p className="mt-2 text-base text-zinc-600">พร้อมเรียนสิ่งใหม่วันนี้หรือยัง?</p>
                  </div>
                  <div className="pointer-events-none absolute right-10 top-1/2 hidden -translate-y-1/2 lg:block">
                    <div className="relative h-32 w-44">
                      <div className="absolute bottom-3 left-5 h-12 w-28 rounded-full bg-black/10 blur-xl" />
                      <Sparkles className="absolute right-5 top-3 text-black" size={42} />
                      <GraduationCap className="absolute bottom-7 left-8 text-black" size={78} strokeWidth={1.6} />
                    </div>
                  </div>
                </section>

                {continueCourse ? (
                  <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">เรียนต่อจากครั้งล่าสุด</p>
                    <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-center">
                      <CourseThumb item={continueCourse} compact />
                      <div className="min-w-0 flex-1">
                        <h2 className="line-clamp-1 text-base font-semibold text-black">{continueCourse.course.title}</h2>
                        <p className="mt-1 line-clamp-1 text-sm text-zinc-500">{getNextLessonMeta(continueCourse)}</p>
                      </div>
                      <div className="flex min-w-[190px] items-center gap-3">
                        <div className="h-1.5 flex-1 rounded-full bg-zinc-200">
                          <div className="h-1.5 rounded-full bg-black" style={{ width: `${Math.min(continueCourse.enrollment.progress, 100)}%` }} />
                        </div>
                        <span className="w-10 text-sm font-semibold text-black">{continueCourse.enrollment.progress}%</span>
                      </div>
                      <Link to={learningPathFor(continueCourse)} className="inline-flex h-10 items-center justify-center rounded-md bg-black px-5 text-sm font-semibold text-white transition hover:bg-zinc-800">
                        เรียนต่อ
                      </Link>
                      <Link to={learningPathFor(continueCourse)} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200">
                        <ChevronRight size={18} />
                      </Link>
                    </div>
                  </section>
                ) : null}

                <section ref={myCoursesSectionRef} className="scroll-mt-6">
                  <div className="mb-4 flex items-end justify-between">
                    <div>
                      <h2 className="text-xl font-semibold tracking-tight text-black">คอร์สของฉัน</h2>
                      <div className="mt-4 flex flex-wrap gap-8 border-b border-zinc-200">
                        {courseFilterOptions.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            className={[
                              'border-b-2 pb-2 text-sm font-medium transition',
                              courseFilter === option.value ? 'border-black text-black' : 'border-transparent text-zinc-500 hover:text-black',
                            ].join(' ')}
                            onClick={() => setCourseFilter(option.value)}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Link to="/courses" className="hidden items-center gap-2 text-sm font-medium text-black sm:inline-flex">
                      ดูทั้งหมด
                      <ArrowRightIcon />
                    </Link>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
                    {filteredCourses.length > 0 ? (
                      filteredCourses.map((item) => (
                        <article key={item.course.id} className="flex flex-col gap-4 border-b border-zinc-200 p-4 last:border-b-0 md:flex-row md:items-center">
                          <CourseThumb item={item} compact />
                          <div className="min-w-0 flex-1">
                            <h3 className="line-clamp-1 text-base font-semibold text-black">{item.course.title}</h3>
                            <p className="mt-1 text-sm text-zinc-500">โดย {item.course.instructor.name}</p>
                          </div>
                          <div className="flex min-w-[190px] items-center gap-3">
                            <div className="h-1.5 flex-1 rounded-full bg-zinc-200">
                              <div className="h-1.5 rounded-full bg-black" style={{ width: `${Math.min(item.enrollment.progress, 100)}%` }} />
                            </div>
                            <span className="w-10 text-sm text-zinc-700">{item.enrollment.progress}%</span>
                          </div>
                          <Link
                            to={learningPathFor(item)}
                            className={[
                              'inline-flex h-10 min-w-24 items-center justify-center rounded-md border px-4 text-sm font-semibold transition',
                              item.enrollment.progress >= 100
                                ? 'border-zinc-200 bg-zinc-100 text-black hover:bg-zinc-200'
                                : 'border-zinc-200 bg-white text-black hover:border-black',
                            ].join(' ')}
                          >
                            {item.enrollment.progress >= 100 ? 'ทบทวน' : 'เรียนต่อ'}
                          </Link>
                          <button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-md text-zinc-700 hover:bg-zinc-100">
                            <MoreVertical size={18} />
                          </button>
                        </article>
                      ))
                    ) : (
                      <div className="p-10 text-center">
                        <h3 className="text-lg font-semibold text-black">ไม่มีคอร์สในตัวกรองนี้</h3>
                        <p className="mt-2 text-sm text-zinc-500">ลองเลือกแท็บอื่น หรือค้นหาคอร์สใหม่เพิ่มเติม</p>
                      </div>
                    )}
                    {filteredCourses.length > 4 ? (
                      <button type="button" className="flex h-12 w-full items-center justify-center gap-2 border-t border-zinc-200 text-sm font-medium text-zinc-600 hover:text-black">
                        แสดงเพิ่มเติม
                        <ChevronDown size={16} />
                      </button>
                    ) : null}
                  </div>
                </section>

                <section>
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-xl font-semibold tracking-tight text-black">คอร์สแนะนำสำหรับคุณ</h2>
                    <Link to="/courses" className="inline-flex items-center gap-2 text-sm font-medium text-black">
                      ดูทั้งหมด
                      <ArrowRightIcon />
                    </Link>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {recommendedCourses.map((item) => (
                      <Link key={item.course.id} to={`/courses/${item.course.slug}`} className="group block">
                        <CourseThumb item={item} />
                        <h3 className="mt-3 line-clamp-1 text-sm font-semibold text-black group-hover:underline">{item.course.title}</h3>
                        <p className="mt-1 text-xs text-zinc-500">{item.course.rating.toFixed(1)} ★ ({formatNumber(item.course.students)})</p>
                      </Link>
                    ))}
                  </div>
                </section>
              </div>

              <aside className="space-y-6">
                <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
                  <div className="grid grid-cols-2 divide-x divide-zinc-200">
                    <div>
                      <p className="text-4xl font-semibold text-black">{data.stats.completedLessons || data.stats.enrolledCourses}</p>
                      <p className="mt-2 text-sm leading-5 text-zinc-600">บทเรียน<br />ที่เรียนจบ</p>
                    </div>
                    <div className="pl-8">
                      <p className="text-4xl font-semibold text-black">{coursesInProgress}</p>
                      <p className="mt-2 text-sm leading-5 text-zinc-600">กำลังเรียน</p>
                    </div>
                  </div>
                </section>

                <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-black">ผู้ช่วยเอไอ</h2>
                    <Link to="/learn" className="inline-flex items-center gap-2 text-sm text-zinc-600">
                      ดูทั้งหมด
                      <ArrowRightIcon />
                    </Link>
                  </div>
                  <div className="mt-5 rounded-lg bg-zinc-50 p-4">
                    <p className="text-sm text-zinc-600">สวัสดี {currentProfile.name || 'คุณ'} วันนี้อยากให้ช่วยเรื่องอะไร?</p>
                    <div className="mt-4 divide-y divide-zinc-200 overflow-hidden rounded-lg bg-white">
                      {['สรุปบทเรียนนี้', 'อธิบายหัวข้อนี้', 'สร้างแบบทดสอบ', 'แนะนำคอร์สถัดไป'].map((item) => (
                        <button key={item} type="button" className="flex w-full items-center justify-between px-4 py-4 text-left text-sm font-medium text-black hover:bg-zinc-50">
                          <span>{item}</span>
                          <ChevronRight size={17} />
                        </button>
                      ))}
                    </div>
                    <button type="button" className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-black text-sm font-semibold text-white hover:bg-zinc-800">
                      <Sparkles size={17} />
                      ถามเอไอ
                    </button>
                  </div>
                </section>

                <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-black">ความคืบหน้ารายสัปดาห์</h2>
                    <button type="button" className="inline-flex items-center gap-1 text-sm text-zinc-600">
                      สัปดาห์นี้
                      <ChevronDown size={15} />
                    </button>
                  </div>
                  <p className="mt-7 text-3xl font-semibold text-black">{Math.max(1, data.stats.completedLessons * 2)} ชม. 45 นาที</p>
                  <p className="mt-1 text-sm text-zinc-500">เวลาเรียนรวม</p>
                  <div className="mt-8 flex h-28 items-end justify-between gap-4">
                    {weeklyBars.map((height, index) => (
                      <div key={`${height}-${index}`} className="flex flex-1 flex-col items-center gap-3">
                        <div
                          className={[
                            'w-full max-w-4 rounded-full',
                            index === 2 ? 'bg-black' : 'bg-zinc-200',
                          ].join(' ')}
                          style={{ height: `${height}%` }}
                        />
                        <span className="text-xs text-zinc-500">{['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.'][index]}</span>
                      </div>
                    ))}
                  </div>
                  <Link to="/student" className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-zinc-700">
                    ดูรายงานทั้งหมด
                    <ArrowRightIcon />
                  </Link>
                </section>
              </aside>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function ArrowRightIcon() {
  return <ChevronRight size={16} />
}
