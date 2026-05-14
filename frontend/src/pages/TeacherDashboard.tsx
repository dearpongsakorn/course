import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  Bell,
  BookOpen,
  Camera,
  CircleDollarSign,
  Clock3,
  Edit3,
  Eye,
  EyeOff,
  Home,
  ImagePlus,
  LibraryBig,
  LoaderCircle,
  LogOut,
  Mail,
  Plus,
  Search,
  Settings,
  Star,
  Trash2,
  UserRound,
  UsersRound,
  Video,
  X,
} from 'lucide-react'
import { useApi } from '../hooks/useApi'
import { api, authStorage, type StudentProfile } from '../services/api'
import type { Course, Lesson } from '../types/course'

const defaultCover =
  'https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&w=1200&q=80'
const directMuxVideoUploadEnabled = import.meta.env.VITE_DIRECT_MUX_VIDEO_UPLOAD === 'true'
const directR2VideoUploadEnabled = import.meta.env.VITE_DIRECT_R2_VIDEO_UPLOAD === 'true'

const createEmptyDraft = () => ({
  title: '',
  description: '',
  price: '0',
  category: 'Technology',
  level: 'Beginner',
  duration: '',
  outcomes: '',
  coverImageUrl: '',
})

type CourseDraft = ReturnType<typeof createEmptyDraft>
type FormMode = 'create' | 'edit'
type LessonDraft = {
  title: string
  duration: string
  summary: string
  preview: boolean
  videoUrl: string
}
type TeacherProfileDraft = Pick<StudentProfile, 'name' | 'headline' | 'bio' | 'phone' | 'avatarUrl'>

const emptyLessonDraft: LessonDraft = {
  title: '',
  duration: '',
  summary: '',
  preview: true,
  videoUrl: '',
}
const maxVideoUploadBytes = 1024 * 1024 * 1024

const formatUploadSpeed = (bytesPerSecond: number) => {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return 'กำลังคำนวณความเร็ว'
  if (bytesPerSecond >= 1024 * 1024) return `${(bytesPerSecond / 1024 / 1024).toFixed(1)} MB/s`
  if (bytesPerSecond >= 1024) return `${Math.round(bytesPerSecond / 1024)} KB/s`
  return `${Math.round(bytesPerSecond)} B/s`
}

const getMuxPlayerEmbedUrl = (value: string | null | undefined) => {
  if (!value) return null

  try {
    const url = new URL(value)
    if (url.hostname.toLowerCase() !== 'player.mux.com') return null

    const playbackId = url.pathname.split('/').filter(Boolean)[0]
    return playbackId ? `https://player.mux.com/${playbackId}` : null
  } catch {
    return null
  }
}

const formatVideoDuration = (durationSeconds: number) => {
  const totalSeconds = Math.max(0, Math.round(durationSeconds))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const paddedSeconds = String(seconds).padStart(2, '0')

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${paddedSeconds}`
  }

  return `${String(minutes).padStart(2, '0')}:${paddedSeconds}`
}

const readVideoDuration = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const video = document.createElement('video')
    const objectUrl = URL.createObjectURL(file)
    let settled = false
    let timeoutId: number | undefined

    const cleanup = () => {
      if (timeoutId) window.clearTimeout(timeoutId)
      URL.revokeObjectURL(objectUrl)
      video.removeAttribute('src')
      video.load()
    }

    const settle = (callback: () => void) => {
      if (settled) return
      settled = true
      callback()
      cleanup()
    }

    const resolveIfReady = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        settle(() => resolve(formatVideoDuration(video.duration)))
        return true
      }

      return false
    }

    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      if (resolveIfReady()) return

      try {
        video.currentTime = Number.MAX_SAFE_INTEGER
      } catch {
        settle(() => reject(new Error('Unable to read video duration')))
      }
    }
    video.ondurationchange = resolveIfReady
    video.onseeked = resolveIfReady
    video.onerror = () => {
      settle(() => reject(new Error('Unable to read video duration')))
    }
    timeoutId = window.setTimeout(() => {
      settle(() => reject(new Error('Timed out while reading video duration')))
    }, 12000)
    video.src = objectUrl
  })

const createVideoPoster = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const video = document.createElement('video')
    const canvas = document.createElement('canvas')
    const objectUrl = URL.createObjectURL(file)
    let settled = false
    let timeoutId: number | undefined

    const cleanup = () => {
      if (timeoutId) window.clearTimeout(timeoutId)
      URL.revokeObjectURL(objectUrl)
      video.removeAttribute('src')
      video.load()
    }

    const settle = (callback: () => void) => {
      if (settled) return
      settled = true
      callback()
      cleanup()
    }

    const capture = () => {
      const width = video.videoWidth
      const height = video.videoHeight

      if (!width || !height) {
        settle(() => reject(new Error('Unable to create video poster')))
        return
      }

      const maxPosterWidth = 960
      const scale = Math.min(1, maxPosterWidth / width)
      const posterWidth = Math.max(1, Math.round(width * scale))
      const posterHeight = Math.max(1, Math.round(height * scale))

      canvas.width = posterWidth
      canvas.height = posterHeight
      canvas.getContext('2d')?.drawImage(video, 0, 0, posterWidth, posterHeight)
      settle(() => resolve(canvas.toDataURL('image/jpeg', 0.84)))
    }

    video.muted = true
    video.playsInline = true
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0
      const targetTime = duration > 2 ? Math.min(Math.max(duration * 0.15, 1), duration - 0.2) : 0

      if (targetTime > 0) {
        video.currentTime = targetTime
      } else {
        capture()
      }
    }
    video.onseeked = capture
    video.onloadeddata = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 2) capture()
    }
    video.onerror = () => settle(() => reject(new Error('Unable to create video poster')))
    timeoutId = window.setTimeout(() => {
      settle(() => reject(new Error('Timed out while creating video poster')))
    }, 12000)
    video.src = objectUrl
  })

const draftFromLesson = (lesson: Lesson): LessonDraft => ({
  title: lesson.title,
  duration: lesson.duration,
  summary: lesson.summary,
  preview: lesson.preview,
  videoUrl: lesson.videoUrl ?? '',
})

const emptyTeacherProfile: TeacherProfileDraft = {
  name: '',
  headline: '',
  bio: '',
  phone: '',
  avatarUrl: '',
}

const draftFromCourse = (course: Course): CourseDraft => {
  return {
    title: course.title,
    description: course.description,
    price: String(course.price),
    category: course.category,
    level: course.level,
    duration: course.duration,
    outcomes: course.outcomes.join('\n'),
    coverImageUrl: course.coverImage.startsWith('/uploads/') ? '' : course.coverImage,
  }
}

const courseStatusMeta = {
  draft: {
    label: 'ฉบับร่าง',
    badgeClass: 'border-amber-200 bg-amber-50 text-amber-700',
    actionLabel: 'รอแอดมินตรวจ',
  },
  published: {
    label: 'เผยแพร่แล้ว',
    badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    actionLabel: 'ซ่อน',
  },
  hidden: {
    label: 'ซ่อนอยู่',
    badgeClass: 'border-slate-200 bg-slate-50 text-slate-600',
    actionLabel: 'เผยแพร่',
  },
} satisfies Record<Course['status'], { label: string; badgeClass: string; actionLabel: string }>

const getCourseStatusMeta = (status: Course['status'] | undefined) =>
  courseStatusMeta[status ?? 'published'] ?? courseStatusMeta.published

const teacherNavItems = [
  { to: '/teacher', label: 'หน้าหลัก', icon: Home },
  { to: '/teacher', label: 'คอร์สของฉัน', icon: Video },
  { to: '/teacher', label: 'สร้างคอร์ส', icon: ImagePlus },
  { to: '/teacher', label: 'นักเรียน', icon: UserRound },
  { to: '/teacher', label: 'รายได้', icon: CircleDollarSign },
  { to: '/teacher', label: 'ข้อความ', icon: Mail },
  { to: '/teacher', label: 'รีวิว', icon: Star },
  { to: '/teacher?section=profile', label: 'การตั้งค่า', icon: Settings },
]

function TeacherShell({
  activeSection,
  teacherName,
  teacherEmail,
  avatarUrl,
  onCreateCourse,
  children,
}: {
  activeSection: 'courses' | 'profile'
  teacherName: string
  teacherEmail: string
  avatarUrl?: string
  onCreateCourse: () => void
  children: React.ReactNode
}) {
  const handleLogout = async () => {
    try {
      await api.logout()
    } catch {
      // Keep local state aligned even if the server session already expired.
    } finally {
      authStorage.clearSession()
      window.location.assign('/')
    }
  }

  return (
    <div className="min-h-screen bg-white text-black lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="hidden min-h-screen bg-black text-white lg:flex lg:flex-col">
        <div className="flex h-24 items-center px-8">
          <Link to="/teacher" className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-white text-black">
              <BookOpen size={20} />
            </span>
            <span className="text-xl font-semibold tracking-tight">เรียนโปร</span>
          </Link>
        </div>

        <nav className="space-y-2 px-5">
          {teacherNavItems.map((item, index) => {
            const Icon = item.icon
            const active =
              item.to.includes('profile') ? activeSection === 'profile' : index === 0 && activeSection === 'courses'
            const navClassName = [
              'flex items-center gap-4 rounded-lg px-4 py-3 text-sm font-medium transition',
              active ? 'bg-white/12 text-white shadow-inner shadow-white/5' : 'text-white/78 hover:bg-white/8 hover:text-white',
            ].join(' ')

            if (item.label === 'สร้างคอร์ส') {
              return (
                <button key={item.label} type="button" className={`${navClassName} w-full text-left`} onClick={onCreateCourse}>
                  <Icon size={19} />
                  <span>{item.label}</span>
                </button>
              )
            }

            return (
              <Link
                key={`${item.label}-${item.to}`}
                to={item.to}
                className={navClassName}
              >
                <Icon size={19} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="mt-auto px-7 pb-7">
          <button
            type="button"
            className="mb-8 inline-flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-white/78 transition hover:bg-white/8 hover:text-white"
            onClick={handleLogout}
          >
            <LogOut size={19} />
            ออกจากระบบ
          </button>

          <div className="border-t border-white/10 pt-7">
            <div className="flex items-center gap-3">
              {avatarUrl ? (
                <img src={avatarUrl} alt={teacherName} className="h-11 w-11 rounded-full object-cover" />
              ) : (
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-black">
                  <UserRound size={18} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{teacherName}</p>
                <p className="truncate text-xs text-white/55">{teacherEmail || 'ครูผู้สอน'}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <main className="min-w-0">
        <div className="mx-auto max-w-[1560px] px-4 py-5 sm:px-6 lg:px-8">
          <header className="mb-8 flex items-center justify-between gap-4">
            <Link to="/teacher" className="flex items-center gap-3 lg:hidden">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-black text-white">
                <BookOpen size={20} />
              </span>
              <span className="text-lg font-semibold">เรียนโปร</span>
            </Link>
            <div className="ml-auto flex items-center gap-3">
              <button
                type="button"
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-zinc-200 bg-white text-black transition hover:border-black"
                aria-label="แจ้งเตือน"
              >
                <Bell size={18} />
              </button>
              <button
                type="button"
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-black px-4 text-sm font-semibold text-white transition hover:bg-zinc-800"
                onClick={onCreateCourse}
              >
                <Plus size={17} />
                สร้างคอร์สใหม่
              </button>
              {avatarUrl ? (
                <img src={avatarUrl} alt={teacherName} className="h-11 w-11 rounded-full object-cover" />
              ) : (
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-black text-white">
                  <UserRound size={17} />
                </span>
              )}
            </div>
          </header>
          <nav className="mb-6 flex gap-2 overflow-x-auto pb-2 lg:hidden">
            {teacherNavItems.map((item, index) => {
              const Icon = item.icon
              const active =
                item.to.includes('profile') ? activeSection === 'profile' : index === 0 && activeSection === 'courses'
              const mobileClassName = [
                'inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition',
                active ? 'border-black bg-black text-white' : 'border-zinc-200 bg-white text-black hover:border-black',
              ].join(' ')

              if (item.label === 'สร้างคอร์ส') {
                return (
                  <button key={item.label} type="button" className={mobileClassName} onClick={onCreateCourse}>
                    <Icon size={16} />
                    {item.label}
                  </button>
                )
              }

              return (
                <Link key={`${item.label}-${item.to}-mobile`} to={item.to} className={mobileClassName}>
                  <Icon size={16} />
                  {item.label}
                </Link>
              )
            })}
          </nav>
          {children}
        </div>
      </main>
    </div>
  )
}

function CourseFormModal({
  mode,
  draft,
  coverPreview,
  coverFile,
  formMessage,
  saving,
  coverUploadProgress,
  onClose,
  onSubmit,
  onDraftChange,
  onCoverChange,
}: {
  mode: FormMode
  draft: CourseDraft
  coverPreview: string
  coverFile: File | null
  formMessage: { tone: 'success' | 'error'; text: string } | null
  saving: boolean
  coverUploadProgress: number | null
  onClose: () => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  onDraftChange: <K extends keyof CourseDraft>(key: K, value: CourseDraft[K]) => void
  onCoverChange: (event: React.ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-slate-950/60 p-0 sm:p-4 lg:p-6">
      <div className="flex h-full w-full max-w-[1500px] flex-col overflow-hidden rounded-none border border-slate-200 bg-white shadow-2xl sm:h-[calc(100vh-2rem)] sm:rounded-lg lg:h-[calc(100vh-3rem)]">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 sm:px-6">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-950">
              {mode === 'create' ? 'สร้างคอร์สใหม่' : 'แก้ไขคอร์ส'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {mode === 'create'
                ? 'สร้างข้อมูลคอร์สก่อน แล้วเพิ่มบทเรียนจากปุ่มบทเรียนในตาราง'
                : 'ปรับข้อมูลคอร์สและรูปปกได้จาก popup นี้'}
            </p>
          </div>
          <button type="button" className="btn-ghost" onClick={onClose} aria-label="ปิด popup">
            <X size={18} />
          </button>
        </div>

        <form className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 xl:p-7" onSubmit={onSubmit}>
          {formMessage ? (
            <div
              className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
                formMessage.tone === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-rose-200 bg-rose-50 text-rose-700'
              }`}
            >
              {formMessage.text}
            </div>
          ) : null}
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
            <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="field-label">ชื่อคอร์ส</span>
              <input
                className="field-input"
                required
                placeholder="เช่น React สำหรับทีมโปรดักชัน"
                value={draft.title}
                onChange={(event) => onDraftChange('title', event.target.value)}
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="field-label">รายละเอียดคอร์ส</span>
              <textarea
                className="field-input min-h-20 resize-y"
                required
                placeholder="อธิบายภาพรวม สิ่งที่ผู้เรียนจะได้ และผลลัพธ์หลังเรียนจบ"
                value={draft.description}
                onChange={(event) => onDraftChange('description', event.target.value)}
              />
            </label>

            <label className="block">
              <span className="field-label">ราคา</span>
              <input
                className="field-input"
                type="number"
                min="0"
                value={draft.price}
                onChange={(event) => onDraftChange('price', event.target.value)}
              />
            </label>

            <label className="block">
              <span className="field-label">หมวดหมู่</span>
              <select
                className="field-input"
                value={draft.category}
                onChange={(event) => onDraftChange('category', event.target.value)}
              >
                <option>Technology</option>
                <option>Business</option>
                <option>Design</option>
                <option>Marketing</option>
                <option>Data</option>
              </select>
            </label>

            <label className="block">
              <span className="field-label">ระดับ</span>
              <select
                className="field-input"
                value={draft.level}
                onChange={(event) => onDraftChange('level', event.target.value)}
              >
                <option>Beginner</option>
                <option>Intermediate</option>
                <option>Advanced</option>
              </select>
            </label>

            <label className="block">
              <span className="field-label">ระยะเวลา</span>
              <input
                className="field-input"
                placeholder="6 ชม. 30 นาที"
                value={draft.duration}
                onChange={(event) => onDraftChange('duration', event.target.value)}
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="field-label">ผลลัพธ์การเรียนรู้</span>
              <textarea
                className="field-input min-h-20 resize-y"
                placeholder="ใส่ 1 หัวข้อต่อ 1 บรรทัด"
                value={draft.outcomes}
                onChange={(event) => onDraftChange('outcomes', event.target.value)}
              />
            </label>

            </div>

            <div className="grid gap-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-950">
                  <ImagePlus size={16} />
                  รูปปกคอร์ส
                </div>
                <img
                  src={coverPreview}
                  alt="Course cover preview"
                  className="mt-3 aspect-video w-full rounded-md border border-slate-200 object-cover"
                />
                <div className="mt-3 space-y-3">
                  <label className="block">
                    <span className="field-label">อัปโหลดรูปปก</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="field-input file:mr-3 file:rounded-md file:border-0 file:bg-slate-950 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
                      onChange={onCoverChange}
                      disabled={saving}
                    />
                  </label>
                  <label className="block">
                    <span className="field-label">หรือใส่ URL รูปปก</span>
                    <input
                      className="field-input"
                      placeholder={defaultCover}
                      value={draft.coverImageUrl}
                      onChange={(event) => onDraftChange('coverImageUrl', event.target.value)}
                    />
                  </label>
                  {coverFile ? <p className="text-xs text-slate-500">{coverFile.name}</p> : null}
                  {coverUploadProgress !== null ? (
                    <div className="rounded-md border border-slate-200 bg-white p-3">
                      <div className="flex items-center justify-between gap-3 text-xs font-medium text-slate-600">
                        <span>กำลังอัปโหลดรูปปก</span>
                        <span>{coverUploadProgress}%</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                        <span
                          className="block h-full rounded-full bg-slate-950 transition-all"
                          style={{ width: `${coverUploadProgress}%` }}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>


            </div>
          </div>

          <div className="sticky bottom-0 -mx-4 mt-4 flex items-center justify-end gap-3 border-t border-slate-200 bg-white/95 px-4 py-4 backdrop-blur sm:-mx-5 sm:px-5 xl:-mx-7 xl:px-7">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
              ยกเลิก
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? (
                <>
                  <LoaderCircle size={16} className="animate-spin" />
                  กำลังบันทึก...
                </>
              ) : mode === 'create' ? (
                <>
                  <Plus size={16} />
                  สร้างคอร์ส
                </>
              ) : (
                <>
                  <Edit3 size={16} />
                  บันทึกการแก้ไข
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DeleteModal({
  course,
  deleting,
  onCancel,
  onConfirm,
}: {
  course: Course
  deleting: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start gap-4">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-rose-50 text-rose-700">
            <AlertTriangle size={20} />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-slate-950">ลบคอร์สนี้ใช่ไหม</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              คอร์ส <span className="font-medium text-slate-950">{course.title}</span> จะถูกลบออกจากระบบ
              พร้อมบทเรียนและข้อมูลที่ผูกกับคอร์สนี้
            </p>
            <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
              การลบนี้ย้อนกลับไม่ได้
            </p>
          </div>
        </div>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={deleting}>
            ยกเลิก
          </button>
          <button type="button" className="btn-primary bg-rose-700 hover:bg-rose-800" onClick={onConfirm} disabled={deleting}>
            {deleting ? (
              <>
                <LoaderCircle size={16} className="animate-spin" />
                กำลังลบ...
              </>
            ) : (
              <>
                <Trash2 size={16} />
                ลบคอร์ส
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function LessonManagerModal({
  course,
  draft,
  editingLessonId,
  saving,
  uploading,
  uploadProgress,
  uploadSpeedText,
  videoPreviewUrl,
  videoPosterUrl,
  message,
  onClose,
  onNew,
  onSelect,
  onDraftChange,
  onVideoChange,
  onSubmit,
  onDelete,
}: {
  course: Course
  draft: LessonDraft
  editingLessonId: string | null
  saving: boolean
  uploading: boolean
  uploadProgress: number | null
  uploadSpeedText: string | null
  videoPreviewUrl: string | null
  videoPosterUrl: string | null
  message: { tone: 'success' | 'error'; text: string } | null
  onClose: () => void
  onNew: () => void
  onSelect: (lesson: Lesson) => void
  onDraftChange: <K extends keyof LessonDraft>(key: K, value: LessonDraft[K]) => void
  onVideoChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  onDelete: (lessonId: string) => void
}) {
  const videoPreviewSrc = videoPreviewUrl || draft.videoUrl
  const muxEmbedUrl = videoPreviewUrl ? null : getMuxPlayerEmbedUrl(draft.videoUrl)
  const [videoPreviewError, setVideoPreviewError] = useState(false)
  const uploadStatusText = directMuxVideoUploadEnabled
    ? uploadProgress !== null && uploadProgress >= 92
      ? 'อัปโหลดครบแล้ว กำลังรอ Mux ประมวลผลวิดีโอ...'
      : 'กำลังอัปโหลดวิดีโอไป Mux'
    : directR2VideoUploadEnabled
    ? uploadProgress !== null && uploadProgress >= 99
      ? 'อัปโหลดครบแล้ว กำลังยืนยันไฟล์กับ Cloudflare R2...'
      : uploadProgress !== null && uploadProgress >= 98
        ? 'ส่งไฟล์ครบแล้ว กำลังรวมส่วนวิดีโอ...'
      : 'กำลังอัปโหลดวิดีโอไป Cloudflare R2'
    : uploadProgress !== null && uploadProgress >= 92
      ? 'อัปโหลดไฟล์ครบแล้ว กำลังตรวจวิดีโอ...'
      : 'กำลังอัปโหลดวิดีโอ'

  const controlsBusy = saving || uploading

  useEffect(() => {
    setVideoPreviewError(false)
  }, [videoPreviewSrc])


  const showFirstVideoFrame = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = event.currentTarget
    setVideoPreviewError(false)

    if (videoPosterUrl) return

    if (video.duration > 0.2 && video.currentTime < 0.05) {
      video.currentTime = 0.1
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-slate-950/35 p-0 backdrop-blur-sm sm:p-4 lg:p-6">
      <div className="flex h-full w-full max-w-[1480px] flex-col overflow-hidden rounded-none border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.18)] sm:h-[calc(100vh-2rem)] sm:rounded-lg lg:h-[calc(100vh-3rem)]">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold tracking-tight text-slate-950">จัดการบทเรียน</h2>
            <p className="mt-1 truncate text-sm text-slate-500">
              {course.title} · {editingLessonId ? 'แก้ไขบทเรียน' : 'เพิ่มบทเรียนใหม่'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="btn-primary px-3 py-2" onClick={onNew}>
              <Plus size={16} />
              บทเรียนใหม่
            </button>
            <button type="button" className="btn-ghost h-10 w-10 px-0" onClick={onClose} aria-label="ปิด popup">
              <X size={18} />
            </button>
          </div>
        </div>

        {course.lessons.length ? (
          <div className="border-b border-slate-200 bg-white px-5 py-3 sm:px-6">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {course.lessons.map((lesson, index) => (
                <button
                  key={lesson.id}
                  type="button"
                  className={[
                    'flex min-w-max items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold transition',
                    editingLessonId === lesson.id
                      ? 'border-slate-950 bg-slate-950 text-white shadow-sm shadow-slate-950/15'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-950',
                  ].join(' ')}
                  onClick={() => onSelect(lesson)}
                >
                  <span>{index + 1}. {lesson.title || 'ไม่มีชื่อบทเรียน'}</span>
                  {lesson.preview ? <span className={editingLessonId === lesson.id ? 'text-xs text-white/60' : 'text-xs text-slate-400'}>Preview</span> : null}
                  {lesson.videoUrl ? <span className={editingLessonId === lesson.id ? 'text-xs text-white/60' : 'text-xs text-slate-400'}>มีวิดีโอ</span> : null}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 bg-slate-50/70">
          <form className="min-h-0 h-full overflow-y-auto p-5 sm:p-6 xl:p-8" onSubmit={onSubmit}>
            {message ? (
              <div
                className={`mb-5 rounded-lg border px-4 py-3 text-sm ${
                  message.tone === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-rose-200 bg-rose-50 text-rose-700'
                }`}
              >
                {message.text}
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,0.95fr)_minmax(480px,1.05fr)]">
              <label className="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/60 sm:col-span-2">
                <span className="field-label">ชื่อบทเรียน</span>
                <input
                  className="field-input border-slate-200 bg-slate-50/60 shadow-none focus:bg-white"
                  value={draft.title}
                  onChange={(event) => onDraftChange('title', event.target.value)}
                  placeholder="บทเรียนที่ 1: เริ่มต้นคอร์ส"
                  required
                />
              </label>

              <label className="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/60 xl:col-start-1">
                <span className="field-label">ความยาววิดีโอ</span>
                <input
                  className="field-input border-slate-200 bg-slate-50/60 shadow-none focus:bg-white"
                  value={draft.duration}
                  onChange={(event) => onDraftChange('duration', event.target.value)}
                  placeholder="12:30"
                />
              </label>


              <label className="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/60 xl:col-start-2 xl:row-span-2">
                <span className="field-label">อัปโหลดวิดีโอหลัก</span>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {directMuxVideoUploadEnabled
                    ? 'อัปโหลดตรงไป Mux เพื่อให้ Mux ประมวลผลและสร้างลิงก์วิดีโอพร้อมเล่นให้อัตโนมัติ'
                    : directR2VideoUploadEnabled
                    ? 'อัปโหลดตรงไป Cloudflare R2 แบบ multipart เพื่อให้ไฟล์ใหญ่ไม่ต้องผ่าน backend แนะนำใช้ MP4 H.264/AAC เพื่อให้เปิดเล่นได้ทันที'
                    : 'อัปโหลดเข้า backend local ระบบจะตรวจวิดีโอและจัดไฟล์ให้อยู่ในรูปแบบที่ browser เล่นได้'}
                </p>
                <input
                  type="file"
                  accept="video/*"
                  className="field-input border-dashed border-slate-300 bg-slate-50/60 py-5 text-center shadow-none file:mr-3 file:rounded-md file:border-0 file:bg-slate-950 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white focus:bg-white"
                  onChange={onVideoChange}
                  disabled={uploading}
                />
                {uploading ? (
                  <div className="mt-3 rounded-md border border-slate-200 bg-white p-3 shadow-sm shadow-slate-200/60">
                    <div className="flex items-center justify-between gap-3 text-xs font-medium text-slate-600">
                      <span>{uploadStatusText}</span>
                      <span>{uploadSpeedText ? `${uploadSpeedText} · ${uploadProgress ?? 0}%` : `${uploadProgress ?? 0}%`}</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                      <span
                        className="block h-full rounded-full bg-slate-950 transition-all"
                        style={{ width: `${uploadProgress ?? 0}%` }}
                      />
                    </div>
                  </div>
                ) : null}
              </label>

              <label className="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/60 xl:col-start-1">
                <span className="field-label">สรุปบทเรียน</span>
                <textarea
                  className="field-input min-h-40 resize-y border-slate-200 bg-slate-50/60 shadow-none focus:bg-white"
                  value={draft.summary}
                  onChange={(event) => onDraftChange('summary', event.target.value)}
                  placeholder="เขียนสรุปสั้น ๆ ของบทเรียน"
                />
              </label>

              {videoPreviewUrl || draft.videoUrl ? (
                <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-950 shadow-sm shadow-slate-200/70 sm:col-span-2">
                  {muxEmbedUrl ? (
                    <iframe
                      className="aspect-video max-h-[52vh] w-full bg-slate-950"
                      src={muxEmbedUrl}
                      title="ตัวอย่างวิดีโอจาก Mux"
                      allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                      allowFullScreen
                    />
                  ) : (
                    <video
                      className="aspect-video max-h-[52vh] w-full bg-slate-950 object-contain"
                      controls
                      playsInline
                      preload="metadata"
                      poster={videoPosterUrl ?? undefined}
                      src={videoPreviewSrc}
                      onError={() => setVideoPreviewError(true)}
                      onLoadedMetadata={showFirstVideoFrame}
                      onLoadedData={() => setVideoPreviewError(false)}
                    />
                  )}
                  {videoPreviewError && !muxEmbedUrl ? (
                    <p className="border-t border-rose-400/20 bg-rose-950/40 px-4 py-2 text-xs text-rose-100">
                      แสดงตัวอย่างวิดีโอไม่ได้ อาจเป็นไฟล์ที่ browser ไม่รองรับ หรือเป็นลิงก์ที่ไม่ใช่ไฟล์วิดีโอโดยตรง
                    </p>
                  ) : videoPreviewUrl ? (
                    <p className="border-t border-white/10 px-4 py-2 text-xs text-slate-300">
                      กำลังแสดงตัวอย่างจากไฟล์ในเครื่อง หลังบันทึกแล้วระบบจะใช้ URL วิดีโอที่อัปโหลด
                    </p>
                  ) : null}
                </div>
              ) : null}


              <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm shadow-slate-200/60 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={draft.preview}
                  onChange={(event) => onDraftChange('preview', event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 accent-slate-950"
                />
                <span>
                  <span className="block font-medium text-slate-800">เปิดให้บทเรียนนี้เป็นวิดีโอตัวอย่างก่อนซื้อ</span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    ตอนนี้ระบบใช้วิดีโอหลักไฟล์เดียวกันเป็น preview ถ้าต้องการคลิปตัวอย่างแยก ต้องเพิ่มช่องไฟล์และฐานข้อมูลอีกชุด
                  </span>
                </span>
              </label>

            </div>

            <div className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                {editingLessonId ? (
                  <button
                    type="button"
                    className="btn-secondary border-slate-200 bg-white text-slate-700 hover:border-slate-950 hover:bg-white hover:text-slate-950"
                    onClick={() => onDelete(editingLessonId)}
                    disabled={controlsBusy}
                  >
                    <Trash2 size={16} />
                    ลบบทเรียน
                  </button>
                ) : null}
              </div>
              <button type="submit" className="btn-primary" disabled={controlsBusy}>
                {saving || uploading ? (
                  <>
                    <LoaderCircle size={16} className="animate-spin" />
                    กำลังบันทึก...
                  </>
                ) : (
                  <>
                    <Video size={16} />
                    {editingLessonId ? 'บันทึกบทเรียน' : 'เพิ่มบทเรียน'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function TeacherDashboard() {
  const [searchParams] = useSearchParams()
  const activeSection = searchParams.get('section') === 'profile' ? 'profile' : 'courses'
  const { data, error, loading } = useApi(() => api.getTeacherDashboard(), [])
  const [courses, setCourses] = useState<Course[]>([])
  const [courseSearch, setCourseSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | Course['status']>('all')
  const [teacherProfile, setTeacherProfile] = useState<StudentProfile | null>(null)
  const [profileDraft, setProfileDraft] = useState<TeacherProfileDraft>(emptyTeacherProfile)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [savingProfile, setSavingProfile] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingSlug, setDeletingSlug] = useState<string | null>(null)
  const [updatingStatusSlug, setUpdatingStatusSlug] = useState<string | null>(null)
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [formMode, setFormMode] = useState<FormMode>('create')
  const [formOpen, setFormOpen] = useState(false)
  const [editingSlug, setEditingSlug] = useState<string | null>(null)
  const [lessonCourse, setLessonCourse] = useState<Course | null>(null)
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null)
  const [lessonDraft, setLessonDraft] = useState<LessonDraft>(emptyLessonDraft)
  const [lessonMessage, setLessonMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [savingLesson, setSavingLesson] = useState(false)
  const [uploadingLessonVideo, setUploadingLessonVideo] = useState(false)
  const [lessonUploadProgress, setLessonUploadProgress] = useState<number | null>(null)
  const [lessonUploadSpeedText, setLessonUploadSpeedText] = useState<string | null>(null)
  const [lessonVideoPreviewUrl, setLessonVideoPreviewUrl] = useState<string | null>(null)
  const [lessonVideoPosterUrl, setLessonVideoPosterUrl] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Course | null>(null)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string>(defaultCover)
  const [coverUploadProgress, setCoverUploadProgress] = useState<number | null>(null)
  const [draft, setDraft] = useState<CourseDraft>(() => createEmptyDraft())

  useEffect(() => {
    queueMicrotask(() => {
      if (data?.courses) setCourses(data.courses)
    })
  }, [data?.courses])

  const currentTeacherProfile = data
    ? teacherProfile ??
      data.profile ?? {
        name: data.user.name,
        headline: '',
        bio: '',
        learningGoal: '',
        phone: '',
        avatarUrl: data.user.avatarUrl ?? '',
        updatedAt: null,
      }
    : null

  useEffect(() => {
    if (!data || !currentTeacherProfile) return

    setProfileDraft({
      name: currentTeacherProfile.name || data.user.name,
      headline: currentTeacherProfile.headline,
      bio: currentTeacherProfile.bio,
      phone: currentTeacherProfile.phone,
      avatarUrl: currentTeacherProfile.avatarUrl || data.user.avatarUrl || '',
    })
  }, [
    currentTeacherProfile?.avatarUrl,
    currentTeacherProfile?.bio,
    currentTeacherProfile?.headline,
    currentTeacherProfile?.name,
    currentTeacherProfile?.phone,
    currentTeacherProfile?.updatedAt,
    data?.user.avatarUrl,
    data?.user.id,
    data?.user.name,
  ])

  const editingCourse = useMemo(
    () => courses.find((course) => course.slug === editingSlug) ?? null,
    [courses, editingSlug],
  )
  const teacherStats = useMemo(() => {
    const published = courses.filter((course) => (course.status ?? 'published') === 'published').length
    const draft = courses.filter((course) => (course.status ?? 'published') === 'draft').length
    const totalStudents = courses.reduce((total, course) => total + course.students, 0)
    const totalLessons = courses.reduce((total, course) => total + (course.lessonCount ?? course.lessons.length), 0)
    const totalRevenue = courses.reduce((total, course) => total + course.price * course.students, 0)

    return {
      totalCourses: courses.length,
      published,
      draft,
      totalStudents,
      totalLessons,
      totalRevenue,
    }
  }, [courses])
  const filteredCourses = useMemo(() => {
    const normalizedSearch = courseSearch.trim().toLowerCase()

    return courses.filter((course) => {
      const courseStatus = course.status ?? 'published'
      const matchesStatus = statusFilter === 'all' || courseStatus === statusFilter
      const matchesSearch =
        !normalizedSearch ||
        course.title.toLowerCase().includes(normalizedSearch) ||
        course.category.toLowerCase().includes(normalizedSearch)

      return matchesStatus && matchesSearch
    })
  }, [courseSearch, courses, statusFilter])
  const resetDraft = () => {
    setDraft(createEmptyDraft())
    setCoverFile(null)
    setCoverPreview(defaultCover)
    setCoverUploadProgress(null)
    setEditingSlug(null)
  }

  const clearLessonVideoPreview = () => {
    setLessonVideoPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current)
      return null
    })
    setLessonVideoPosterUrl(null)
  }

  const closeFormModal = () => {
    setFormOpen(false)
    resetDraft()
  }

  const openCreateModal = () => {
    resetDraft()
    setFormMode('create')
    setFormOpen(true)
    setMessage(null)
  }

  const openEditModal = (course: Course) => {
    setFormMode('edit')
    setEditingSlug(course.slug)
    setDraft(draftFromCourse(course))
    setCoverFile(null)
    setCoverPreview(course.coverImage)
    setCoverUploadProgress(null)
    setFormOpen(true)
    setMessage(null)
  }

  const openLessonManager = (course: Course) => {
    setLessonCourse(course)
    setEditingLessonId(course.lessons[0]?.id ?? null)
    setLessonDraft(course.lessons[0] ? draftFromLesson(course.lessons[0]) : emptyLessonDraft)
    setLessonMessage(null)
  }

  const closeLessonManager = () => {
    setLessonCourse(null)
    setEditingLessonId(null)
    setLessonDraft(emptyLessonDraft)
    setLessonMessage(null)
    setUploadingLessonVideo(false)
    setLessonUploadProgress(null)
    setLessonUploadSpeedText(null)
    clearLessonVideoPreview()
  }

  const startNewLesson = () => {
    setEditingLessonId(null)
    setLessonDraft(emptyLessonDraft)
    setLessonMessage(null)
    setLessonUploadProgress(null)
    setLessonUploadSpeedText(null)
    clearLessonVideoPreview()
  }

  const selectLesson = (lesson: Lesson) => {
    setEditingLessonId(lesson.id)
    setLessonDraft(draftFromLesson(lesson))
    setLessonMessage(null)
    setLessonUploadProgress(null)
    setLessonUploadSpeedText(null)
    clearLessonVideoPreview()
  }

  const handleLessonDraftChange = <K extends keyof LessonDraft>(key: K, value: LessonDraft[K]) => {
    setLessonDraft((current) => ({ ...current, [key]: value }))
  }

  const replaceCourse = (course: Course) => {
    setCourses((current) => current.map((item) => (item.id === course.id ? course : item)))
    setLessonCourse(course)
  }

  const handleDraftChange = <K extends keyof CourseDraft>(key: K, value: CourseDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))

    if (key === 'coverImageUrl' && !coverFile) {
      setCoverPreview(String(value) || editingCourse?.coverImage || defaultCover)
    }
  }

  const handleCoverChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    setCoverFile(file)

    if (!file) {
      setCoverPreview(draft.coverImageUrl || editingCourse?.coverImage || defaultCover)
      return
    }

    setCoverPreview(URL.createObjectURL(file))
  }

  const handleLessonVideoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) return

    if (file.size > maxVideoUploadBytes) {
      setLessonMessage({
        tone: 'error',
        text: 'วิดีโอต้องไม่เกิน 1GB',
      })
      event.target.value = ''
      return
    }

    const previewUrl = URL.createObjectURL(file)
    setLessonVideoPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current)
      return previewUrl
    })
    setLessonVideoPosterUrl(null)

    createVideoPoster(file)
      .then((posterUrl) => setLessonVideoPosterUrl(posterUrl))
      .catch(() => undefined)

    readVideoDuration(file)
      .then((duration) => {
        setLessonDraft((current) => ({ ...current, duration }))
      })
      .catch(() => {
        // Some browser/codecs may not expose metadata before upload; the teacher can still edit the field manually.
      })

    setUploadingLessonVideo(true)
    setLessonUploadProgress(0)
    setLessonUploadSpeedText(null)
    setLessonMessage(null)

    try {
      let lastProgressSample = { progress: 0, timestamp: performance.now() }
      const uploaded = await api.uploadVideoAsset({
        file,
        onProgress: (progress) => {
          setLessonUploadProgress(progress)

          const now = performance.now()
          const elapsedSeconds = (now - lastProgressSample.timestamp) / 1000
          const progressDelta = progress - lastProgressSample.progress
          const uploadProgressMax = directMuxVideoUploadEnabled ? 90 : directR2VideoUploadEnabled ? 98 : 99

          if (elapsedSeconds >= 0.4 && progressDelta > 0 && progress <= uploadProgressMax) {
            const uploadedByteDelta = (Math.min(progressDelta, uploadProgressMax) / uploadProgressMax) * file.size
            setLessonUploadSpeedText(formatUploadSpeed(uploadedByteDelta / elapsedSeconds))
            lastProgressSample = { progress, timestamp: now }
          }
        },
      })
      setLessonDraft((current) => ({ ...current, videoUrl: uploaded.fileUrl }))
      setLessonVideoPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current)
        return null
      })
      setLessonVideoPosterUrl(null)
      setLessonMessage({
        tone: 'success',
        text:
          uploaded.storage === 'mux'
            ? 'อัปโหลดวิดีโอไป Mux สำเร็จ ได้ลิงก์สำหรับเล่นวิดีโอแล้ว'
            : uploaded.storage === 'r2'
              ? 'อัปโหลดวิดีโอไป Cloudflare R2 สำเร็จ'
              : 'อัปโหลดวิดีโอสำเร็จ ระบบตรวจและแปลงเป็นไฟล์ที่ browser เล่นได้แล้ว',
      })
    } catch (currentError) {
      setLessonMessage({
        tone: 'error',
        text: currentError instanceof Error ? currentError.message : 'อัปโหลดวิดีโอไม่สำเร็จ',
      })
    } finally {
      setUploadingLessonVideo(false)
      setLessonUploadProgress(null)
      setLessonUploadSpeedText(null)
      event.target.value = ''
    }
  }

  const saveLesson = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!lessonCourse) return

    setSavingLesson(true)
    setLessonMessage(null)

    try {
      const nextCourse = await api.saveLesson(lessonCourse.slug, editingLessonId, {
        title: lessonDraft.title,
        duration: lessonDraft.duration || '00:00',
        summary: lessonDraft.summary,
        preview: lessonDraft.preview,
        videoUrl: lessonDraft.videoUrl || undefined,
      })
      replaceCourse(nextCourse)

      const nextLesson =
        editingLessonId
          ? nextCourse.lessons.find((lesson) => lesson.id === editingLessonId)
          : nextCourse.lessons[nextCourse.lessons.length - 1]

      setEditingLessonId(nextLesson?.id ?? null)
      if (nextLesson) setLessonDraft(draftFromLesson(nextLesson))
      setLessonMessage({
        tone: 'success',
        text: lessonDraft.videoUrl
          ? 'บันทึกบทเรียนแล้ว ระบบจะถอดสคริปต์ด้วย AI ให้อัตโนมัติ'
          : 'บันทึกบทเรียนเรียบร้อยแล้ว',
      })
    } catch (currentError) {
      setLessonMessage({
        tone: 'error',
        text: currentError instanceof Error ? currentError.message : 'บันทึกบทเรียนไม่สำเร็จ',
      })
    } finally {
      setSavingLesson(false)
    }
  }

  const deleteLesson = async (lessonId: string) => {
    if (!lessonCourse) return

    setSavingLesson(true)
    setLessonMessage(null)

    try {
      const nextCourse = await api.deleteLesson(lessonCourse.slug, lessonId)
      replaceCourse(nextCourse)
      const nextLesson = nextCourse.lessons[0]
      setEditingLessonId(nextLesson?.id ?? null)
      setLessonDraft(nextLesson ? draftFromLesson(nextLesson) : emptyLessonDraft)
      setLessonMessage({ tone: 'success', text: 'ลบบทเรียนเรียบร้อยแล้ว' })
    } catch (currentError) {
      setLessonMessage({
        tone: 'error',
        text: currentError instanceof Error ? currentError.message : 'ลบบทเรียนไม่สำเร็จ',
      })
    } finally {
      setSavingLesson(false)
    }
  }

  const handleProfileAvatarChange = async (file: File | undefined) => {
    if (!file) return

    setUploadingAvatar(true)
    setProfileError(null)

    try {
      const uploaded = await api.uploadAsset({ kind: 'avatar', file })
      setProfileDraft((current) => ({ ...current, avatarUrl: uploaded.fileUrl }))
    } catch (currentError) {
      setProfileError(currentError instanceof Error ? currentError.message : 'อัปโหลดรูปโปรไฟล์ไม่สำเร็จ')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const saveTeacherProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!currentTeacherProfile) return

    setSavingProfile(true)
    setProfileError(null)

    try {
      const nextProfile = await api.updateTeacherProfile({
        name: profileDraft.name,
        headline: profileDraft.headline,
        bio: profileDraft.bio,
        phone: profileDraft.phone,
        avatarUrl: profileDraft.avatarUrl,
        learningGoal: currentTeacherProfile.learningGoal,
      })
      setTeacherProfile(nextProfile)

      const session = authStorage.getSession()
      if (session) {
        authStorage.setSession({
          ...session,
          user: {
            ...session.user,
            name: nextProfile.name || profileDraft.name,
            avatarUrl: nextProfile.avatarUrl || undefined,
          },
        })
      }
    } catch (currentError) {
      setProfileError(currentError instanceof Error ? currentError.message : 'บันทึกโปรไฟล์ไม่สำเร็จ')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setMessage(null)

    try {
      let coverImage = draft.coverImageUrl.trim() || editingCourse?.coverImage || defaultCover

      if (coverFile) {
        setCoverUploadProgress(0)
        const uploadedCover = await api.uploadAsset({ kind: 'cover', file: coverFile, onProgress: setCoverUploadProgress })
        coverImage = uploadedCover.fileUrl
      }

      const payload = {
        title: draft.title,
        description: draft.description,
        coverImage,
        price: Number(draft.price || 0),
        category: draft.category,
        level: draft.level,
        duration: draft.duration || '0 ชม.',
        outcomes: draft.outcomes
          .split('\n')
          .map((item) => item.trim())
          .filter(Boolean),
      }

      const course =
        formMode === 'edit' && editingCourse
          ? await api.updateCourse(editingCourse.slug, payload)
          : await api.createCourse(payload)

      setCourses((current) => {
        if (formMode === 'edit' && editingCourse) {
          return current.map((item) => (item.slug === editingCourse.slug ? course : item))
        }

        return [course, ...current]
      })

      setMessage({
        tone: 'success',
        text:
          formMode === 'edit'
            ? 'บันทึกการแก้ไขคอร์สเรียบร้อยแล้ว'
            : 'สร้างคอร์สเป็นฉบับร่างแล้ว รอแอดมินตรวจสอบก่อนเผยแพร่',
      })
      closeFormModal()
    } catch (currentError) {
      setMessage({
        tone: 'error',
        text: currentError instanceof Error ? currentError.message : 'ไม่สามารถบันทึกคอร์สได้',
      })
    } finally {
      setSaving(false)
      setCoverUploadProgress(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return

    setDeletingSlug(deleteTarget.slug)
    setMessage(null)

    try {
      await api.deleteCourse(deleteTarget.slug)
      setCourses((current) => current.filter((item) => item.slug !== deleteTarget.slug))
      setDeleteTarget(null)
      setMessage({ tone: 'success', text: 'ลบคอร์สเรียบร้อยแล้ว' })
    } catch (currentError) {
      setMessage({
        tone: 'error',
        text: currentError instanceof Error ? currentError.message : 'ไม่สามารถลบคอร์สได้',
      })
    } finally {
      setDeletingSlug(null)
    }
  }

  const toggleCourseStatus = async (course: Course) => {
    const currentStatus = course.status ?? 'published'
    const nextStatus: Course['status'] = currentStatus === 'published' ? 'hidden' : 'published'

    setUpdatingStatusSlug(course.slug)
    setMessage(null)

    try {
      const nextCourse = await api.updateCourseStatus(course.slug, nextStatus)
      setCourses((current) => current.map((item) => (item.slug === course.slug ? nextCourse : item)))
      setMessage({
        tone: 'success',
        text: nextStatus === 'published' ? 'เผยแพร่คอร์สเรียบร้อยแล้ว' : 'ซ่อนคอร์สเรียบร้อยแล้ว',
      })
    } catch (currentError) {
      setMessage({
        tone: 'error',
        text: currentError instanceof Error ? currentError.message : 'เปลี่ยนสถานะคอร์สไม่สำเร็จ',
      })
    } finally {
      setUpdatingStatusSlug(null)
    }
  }

  if (loading) {
    return <div className="card p-6 text-sm text-slate-500">กำลังโหลดพื้นที่ทำงานของคุณครู...</div>
  }

  if (error) {
    return <div className="card p-6 text-sm text-rose-600">{error}</div>
  }

  if (!data || !currentTeacherProfile) return null

  const recentActivityCourses = courses.slice(0, 4)

  if (activeSection === 'profile') {
    return (
      <TeacherShell
        activeSection="profile"
        teacherName={currentTeacherProfile.name || data.user.name}
        teacherEmail={data.user.email}
        avatarUrl={currentTeacherProfile.avatarUrl || data.user.avatarUrl}
        onCreateCourse={openCreateModal}
      >
        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-950">โปรไฟล์คุณครู</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            แก้ไขชื่อ รูปโปรไฟล์ และข้อมูลติดต่อที่ใช้แสดงในระบบ
          </p>
        </section>

        <section className="mt-6 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <form className="grid gap-0 lg:grid-cols-[280px_minmax(0,1fr)]" onSubmit={saveTeacherProfile}>
            <div className="border-b border-slate-200 bg-slate-50 p-5 lg:border-b-0 lg:border-r">
              <div className="flex flex-col items-start gap-4">
                {profileDraft.avatarUrl ? (
                  <img src={profileDraft.avatarUrl} alt="รูปโปรไฟล์" className="h-32 w-32 rounded-lg object-cover" />
                ) : (
                  <span className="inline-flex h-32 w-32 items-center justify-center rounded-lg bg-slate-950 text-white">
                    <UserRound size={40} />
                  </span>
                )}

                <div>
                  <p className="text-sm font-semibold text-slate-950">รูปโปรไฟล์</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">รองรับ JPG, PNG, WEBP ไม่เกิน 5MB</p>
                  <label className="btn-secondary mt-3 inline-flex cursor-pointer px-3 py-2">
                    <Camera size={16} />
                    {uploadingAvatar ? 'กำลังอัปโหลด...' : 'อัปโหลดรูป'}
                    <input
                      type="file"
                      className="hidden"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={uploadingAvatar}
                      onChange={(event) => handleProfileAvatarChange(event.target.files?.[0])}
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
                  value={profileDraft.name}
                  onChange={(event) => setProfileDraft((current) => ({ ...current, name: event.target.value }))}
                  placeholder="ชื่อคุณครู"
                  required
                />
              </label>

              <label className="block">
                <span className="field-label">ตำแหน่ง / ความเชี่ยวชาญ</span>
                <input
                  className="field-input"
                  value={profileDraft.headline}
                  onChange={(event) => setProfileDraft((current) => ({ ...current, headline: event.target.value }))}
                  placeholder="เช่น Frontend Instructor"
                />
              </label>

              <label className="block">
                <span className="field-label">เกี่ยวกับคุณครู</span>
                <textarea
                  className="field-input min-h-28 resize-y"
                  value={profileDraft.bio}
                  onChange={(event) => setProfileDraft((current) => ({ ...current, bio: event.target.value }))}
                  placeholder="แนะนำประสบการณ์การสอนหรือแนวทางการสอน"
                />
              </label>

              <label className="block">
                <span className="field-label">เบอร์ติดต่อ</span>
                <input
                  className="field-input"
                  value={profileDraft.phone}
                  onChange={(event) => setProfileDraft((current) => ({ ...current, phone: event.target.value }))}
                  placeholder="เบอร์ติดต่อ"
                />
              </label>

              {profileError ? <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{profileError}</p> : null}

              <div className="flex justify-end border-t border-slate-200 pt-4">
                <button type="submit" className="btn-primary" disabled={savingProfile || uploadingAvatar}>
                  {savingProfile ? 'กำลังบันทึก...' : 'บันทึกโปรไฟล์'}
                </button>
              </div>
            </div>
          </form>
        </section>
      </TeacherShell>
    )
  }

  return (
    <>
      <TeacherShell
        activeSection="courses"
        teacherName={currentTeacherProfile.name || data.user.name}
        teacherEmail={data.user.email}
        avatarUrl={currentTeacherProfile.avatarUrl || data.user.avatarUrl}
        onCreateCourse={openCreateModal}
      >
        <section className="mb-8">
          <p className="text-base font-medium text-zinc-700">สวัสดีตอนเช้า</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-black">
            ครู{currentTeacherProfile.name || data.user.name}
          </h1>
          <p className="mt-3 text-base text-zinc-600">ยินดีต้อนรับสู่แผงควบคุมของคุณ</p>
        </section>

        {message ? (
          <section
            className={`mb-6 rounded-lg border px-4 py-3 text-sm ${
              message.tone === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-rose-200 bg-rose-50 text-rose-700'
            }`}
          >
            {message.text}
          </section>
        ) : null}

        <section className="mb-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: 'คอร์สทั้งหมด',
              value: teacherStats.totalCourses,
              icon: LibraryBig,
              note: 'คอร์ส',
              trend: false,
            },
            {
              label: 'นักเรียนทั้งหมด',
              value: teacherStats.totalStudents.toLocaleString('th-TH'),
              icon: UsersRound,
              note: 'เพิ่มขึ้นจากเดือนที่แล้ว',
              trend: true,
            },
            {
              label: 'บทเรียนรวม',
              value: teacherStats.totalLessons,
              icon: Video,
              note: 'บทเรียน',
              trend: false,
            },
            {
              label: 'รายได้รวม',
              value: `${teacherStats.totalRevenue.toLocaleString('th-TH')} บาท`,
              icon: CircleDollarSign,
              note: 'จากเดือนที่แล้ว',
              trend: true,
            },
          ].map((item) => {
            const Icon = item.icon

            return (
            <div
              key={item.label}
              className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
            >
              <span
                className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-black"
              >
                <Icon size={22} />
              </span>
              <p className="mt-5 text-sm font-medium text-zinc-600">{item.label}</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-black">{item.value}</p>
              <p className={item.trend ? 'mt-3 text-xs font-medium text-emerald-700' : 'mt-3 text-xs font-medium text-zinc-500'}>
                {item.trend ? `↑ ${item.note}` : item.note}
              </p>
            </div>
          )})}
        </section>

        <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-black">คอร์สของฉัน</h2>
              <div className="mt-5 flex flex-wrap gap-8 border-b border-zinc-200">
                {[
                  { value: 'all', label: 'ทั้งหมด' },
                  { value: 'published', label: 'เผยแพร่แล้ว' },
                  { value: 'draft', label: 'ร่าง' },
                  { value: 'hidden', label: 'ซ่อนอยู่' },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    className={[
                      'border-b-2 pb-2 text-sm font-medium transition',
                      statusFilter === item.value ? 'border-black text-black' : 'border-transparent text-zinc-500 hover:text-black',
                    ].join(' ')}
                    onClick={() => setStatusFilter(item.value as 'all' | Course['status'])}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="relative block min-w-0 sm:w-72">
                <span className="sr-only">ค้นหาคอร์ส</span>
                <Search
                  size={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
                />
                <input
                  value={courseSearch}
                  onChange={(event) => setCourseSearch(event.target.value)}
                  className="h-10 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 text-sm text-black outline-none transition placeholder:text-zinc-400 focus:border-black"
                  placeholder="ค้นหาคอร์ส"
                />
              </label>
              <button type="button" className="h-10 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-black transition hover:border-black">
                ดูทั้งหมด
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse">
              <thead className="border-y border-zinc-200 bg-white text-xs font-semibold text-zinc-500">
                <tr>
                  <th className="table-cell">คอร์ส</th>
                  <th className="table-cell">ผู้เรียน</th>
                  <th className="table-cell">รายได้</th>
                  <th className="table-cell">จัดการ</th>
                  <th className="table-cell"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {filteredCourses.map((course) => (
                  <tr key={course.id} className="transition hover:bg-zinc-50/70">
                    <td className="px-5 py-4 text-left text-sm">
                      <div className="flex items-center gap-5">
                        <img src={course.coverImage} alt={course.title} className="h-16 w-32 rounded-md bg-black object-cover" />
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-black">{course.title}</p>
                            <span
                              className="rounded-full border border-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-600"
                            >
                              {getCourseStatusMeta(course.status).label}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-zinc-500">
                            อัปเดตล่าสุด {course.updatedAt ? new Date(course.updatedAt).toLocaleDateString('th-TH') : '-'} · {course.category}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-zinc-600">
                      <p className="text-xs text-zinc-500">นักเรียน</p>
                      <p className="mt-1 font-semibold text-black">{course.students.toLocaleString('th-TH')}</p>
                    </td>
                    <td className="px-5 py-4 text-sm text-zinc-600">
                      <p className="text-xs text-zinc-500">รายได้</p>
                      <p className="mt-1 font-semibold text-black">{(course.price * course.students).toLocaleString('th-TH')} บาท</p>
                    </td>
                    <td className="px-5 py-4 text-sm">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className="btn-secondary px-3 py-2" onClick={() => openLessonManager(course)}>
                          <Video size={15} />
                          จัดการคอร์ส
                        </button>
                        <button type="button" className="btn-secondary px-3 py-2" onClick={() => openEditModal(course)}>
                          <Edit3 size={15} />
                          แก้ไข
                        </button>
                        <button
                          type="button"
                          className="btn-secondary px-3 py-2"
                          onClick={() => toggleCourseStatus(course)}
                          disabled={updatingStatusSlug === course.slug || (course.status ?? 'published') === 'draft'}
                        >
                          {updatingStatusSlug === course.slug ? (
                            <LoaderCircle size={15} className="animate-spin" />
                          ) : (course.status ?? 'published') === 'draft' ? (
                            <Clock3 size={15} />
                          ) : (course.status ?? 'published') === 'published' ? (
                            <EyeOff size={15} />
                          ) : (
                            <Eye size={15} />
                          )}
                          {getCourseStatusMeta(course.status).actionLabel}
                        </button>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-md text-zinc-700 transition hover:bg-zinc-100"
                        onClick={() => setDeleteTarget(course)}
                        aria-label="ลบคอร์ส"
                        title="ลบคอร์ส"
                      >
                        <Trash2 size={17} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredCourses.length === 0 ? (
              <div className="p-8 text-center">
                <h3 className="text-lg font-semibold text-slate-950">ไม่พบคอร์สที่ตรงกับตัวกรอง</h3>
                <p className="mt-2 text-sm text-slate-500">ลองเปลี่ยนคำค้นหาหรือสถานะคอร์ส</p>
              </div>
            ) : null}
          </div>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-black">รายได้</h2>
                <p className="mt-5 text-3xl font-semibold tracking-tight text-black">
                  {teacherStats.totalRevenue.toLocaleString('th-TH')} บาท
                </p>
                <p className="mt-2 text-sm text-zinc-500">รายได้รวมจากคอร์สทั้งหมด</p>
              </div>
              <button
                type="button"
                className="h-10 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-black transition hover:border-black"
              >
                เดือนนี้
              </button>
            </div>

            <div className="mt-8 h-44">
              <svg className="h-full w-full" viewBox="0 0 720 180" role="img" aria-label="กราฟรายได้">
                {[35, 70, 105, 140].map((y) => (
                  <line key={y} x1="0" y1={y} x2="720" y2={y} stroke="#e4e4e7" strokeWidth="1" />
                ))}
                <polyline
                  points="0,120 80,118 160,72 240,95 320,123 400,83 480,65 560,91 640,69 720,61"
                  fill="none"
                  stroke="#09090b"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {[0, 80, 160, 240, 320, 400, 480, 560, 640, 720].map((x, index) => {
                  const y = [120, 118, 72, 95, 123, 83, 65, 91, 69, 61][index]

                  return <circle key={x} cx={x} cy={y} r="5" fill="#fff" stroke="#09090b" strokeWidth="2" />
                })}
              </svg>
            </div>

            <Link to="/teacher" className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-black">
              ดูรายงานทั้งหมด
              <span aria-hidden="true">→</span>
            </Link>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-lg font-semibold tracking-tight text-black">กิจกรรมล่าสุด</h2>
              <button
                type="button"
                className="h-10 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-black transition hover:border-black"
              >
                ดูทั้งหมด
              </button>
            </div>

            <div className="mt-6 space-y-5">
              {recentActivityCourses.length > 0 ? (
                recentActivityCourses.map((course, index) => {
                  const statusMeta = getCourseStatusMeta(course.status)
                  const activityText =
                    (course.status ?? 'published') === 'draft'
                      ? 'บันทึกเป็นฉบับร่าง'
                      : (course.status ?? 'published') === 'hidden'
                        ? 'ซ่อนคอร์สจากหน้าร้านแล้ว'
                        : 'มีนักเรียนสมัครเรียนในคอร์ส'
                  const ActivityIcon = index % 2 === 0 ? UsersRound : Star

                  return (
                    <div key={course.id} className="flex items-start gap-4">
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-black">
                        <ActivityIcon size={18} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-black">{activityText}</p>
                          <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-600">
                            {statusMeta.label}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-sm text-zinc-500">{course.title}</p>
                      </div>
                      <p className="shrink-0 text-xs text-zinc-500">
                        {course.updatedAt ? new Date(course.updatedAt).toLocaleDateString('th-TH') : 'ล่าสุด'}
                      </p>
                    </div>
                  )
                })
              ) : (
                <div className="rounded-lg border border-dashed border-zinc-200 p-6 text-center text-sm text-zinc-500">
                  ยังไม่มีกิจกรรมล่าสุด
                </div>
              )}
            </div>
          </div>
        </section>
      </TeacherShell>

      {formOpen ? (
        <CourseFormModal
          mode={formMode}
          draft={draft}
          coverPreview={coverPreview}
          coverFile={coverFile}
          formMessage={message}
          saving={saving}
          coverUploadProgress={coverUploadProgress}
          onClose={closeFormModal}
          onSubmit={handleSubmit}
          onDraftChange={handleDraftChange}
          onCoverChange={handleCoverChange}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteModal
          course={deleteTarget}
          deleting={deletingSlug === deleteTarget.slug}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      ) : null}

      {lessonCourse ? (
        <LessonManagerModal
          course={lessonCourse}
          draft={lessonDraft}
          editingLessonId={editingLessonId}
          saving={savingLesson}
          uploading={uploadingLessonVideo}
          uploadProgress={lessonUploadProgress}
          uploadSpeedText={lessonUploadSpeedText}
          videoPreviewUrl={lessonVideoPreviewUrl}
          videoPosterUrl={lessonVideoPosterUrl}
          message={lessonMessage}
          onClose={closeLessonManager}
          onNew={startNewLesson}
          onSelect={selectLesson}
          onDraftChange={handleLessonDraftChange}
          onVideoChange={handleLessonVideoChange}
          onSubmit={saveLesson}
          onDelete={deleteLesson}
        />
      ) : null}
    </>
  )
}
