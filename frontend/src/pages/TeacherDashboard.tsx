import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  BookOpen,
  Camera,
  CircleDollarSign,
  Edit3,
  Eye,
  EyeOff,
  ImagePlus,
  LibraryBig,
  LoaderCircle,
  Plus,
  Search,
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
        settle(() => reject(new Error('ไม่สามารถอ่านความยาววิดีโอได้')))
      }
    }
    video.ondurationchange = resolveIfReady
    video.onseeked = resolveIfReady
    video.onerror = () => {
      settle(() => reject(new Error('ไม่สามารถอ่านความยาววิดีโอได้')))
    }
    timeoutId = window.setTimeout(() => {
      settle(() => reject(new Error('อ่านความยาววิดีโอไม่ทันเวลา')))
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
        settle(() => reject(new Error('ไม่สามารถสร้างภาพตัวอย่างวิดีโอได้')))
        return
      }

      canvas.width = width
      canvas.height = height
      canvas.getContext('2d')?.drawImage(video, 0, 0, width, height)
      settle(() => resolve(canvas.toDataURL('image/jpeg', 0.84)))
    }

    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
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
    video.onerror = () => settle(() => reject(new Error('ไม่สามารถสร้างภาพตัวอย่างวิดีโอได้')))
    timeoutId = window.setTimeout(() => {
      settle(() => reject(new Error('สร้างภาพตัวอย่างวิดีโอไม่ทันเวลา')))
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
    actionLabel: 'เผยแพร่',
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
  const [videoPreviewError, setVideoPreviewError] = useState(false)

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
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-slate-950/60 p-0 sm:p-4 lg:p-6">
      <div className="flex h-full w-full flex-col overflow-hidden rounded-none border border-slate-200 bg-white shadow-2xl sm:h-[calc(100vh-2rem)] sm:rounded-lg lg:h-[calc(100vh-3rem)]">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">จัดการบทเรียน</h2>
            <p className="mt-1 text-sm text-slate-500">
              {course.title} · {editingLessonId ? 'แก้ไขบทเรียน' : 'เพิ่มบทเรียนใหม่'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="btn-secondary" onClick={onNew}>
              <Plus size={16} />
              บทเรียนใหม่
            </button>
            <button type="button" className="btn-ghost" onClick={onClose} aria-label="ปิด popup">
              <X size={18} />
            </button>
          </div>
        </div>

        {course.lessons.length ? (
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-3 sm:px-6">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {course.lessons.map((lesson, index) => (
                <button
                  key={lesson.id}
                  type="button"
                  className={[
                    'flex min-w-max items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition',
                    editingLessonId === lesson.id
                      ? 'border-slate-950 bg-white text-slate-950 shadow-sm'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950',
                  ].join(' ')}
                  onClick={() => onSelect(lesson)}
                >
                  <span>{index + 1}. {lesson.title || 'ไม่มีชื่อบทเรียน'}</span>
                  {lesson.preview ? <span className="text-xs text-slate-400">Preview</span> : null}
                  {lesson.videoUrl ? <span className="text-xs text-slate-400">มีวิดีโอ</span> : null}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="min-h-0 flex-1">
          <form className="min-h-0 h-full overflow-y-auto p-5 sm:p-6 xl:p-8" onSubmit={onSubmit}>
            {message ? (
              <div
                className={`rounded-lg border px-4 py-3 text-sm ${
                  message.tone === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-rose-200 bg-rose-50 text-rose-700'
                }`}
              >
                {message.text}
              </div>
            ) : null}

            <div className="mt-4 grid gap-5 sm:grid-cols-2 xl:grid-cols-[minmax(0,0.95fr)_minmax(480px,1.05fr)]">
              <label className="block sm:col-span-2">
                <span className="field-label">ชื่อบทเรียน</span>
                <input
                  className="field-input"
                  value={draft.title}
                  onChange={(event) => onDraftChange('title', event.target.value)}
                  placeholder="บทเรียนที่ 1: เริ่มต้นคอร์ส"
                  required
                />
              </label>

              <label className="block xl:col-start-1">
                <span className="field-label">ความยาววิดีโอ</span>
                <input
                  className="field-input"
                  value={draft.duration}
                  onChange={(event) => onDraftChange('duration', event.target.value)}
                  placeholder="12:30"
                />
              </label>

              <label className="block xl:col-start-2 xl:row-span-2">
                <span className="field-label">อัปโหลดวิดีโอหลัก MP4</span>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  ไฟล์นี้คือวิดีโอเต็มของบทเรียน ถ้าเปิดตัวอย่างก่อนซื้อ ผู้เรียนที่ยังไม่สมัครจะดูไฟล์นี้ได้ด้วย
                </p>
                <input
                  type="file"
                  accept="video/mp4,.mp4"
                  className="field-input file:mr-3 file:rounded-md file:border-0 file:bg-slate-950 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
                  onChange={onVideoChange}
                  disabled={uploading}
                />
                {uploading ? (
                  <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3 text-xs font-medium text-slate-600">
                      <span>กำลังอัปโหลดวิดีโอ</span>
                      <span>{uploadProgress ?? 0}%</span>
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

              <label className="block xl:col-start-1">
                <span className="field-label">สรุปบทเรียน</span>
                <textarea
                  className="field-input min-h-40 resize-y"
                  value={draft.summary}
                  onChange={(event) => onDraftChange('summary', event.target.value)}
                  placeholder="เขียนสรุปสั้น ๆ ของบทเรียน"
                />
              </label>

              {videoPreviewSrc ? (
                <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-950 sm:col-span-2">
                  <video
                    className="aspect-video max-h-[52vh] w-full bg-slate-950 object-contain"
                    controls
                    playsInline
                    preload="auto"
                    poster={videoPosterUrl ?? undefined}
                    src={videoPreviewSrc}
                    onError={() => setVideoPreviewError(true)}
                    onLoadedMetadata={showFirstVideoFrame}
                    onLoadedData={() => setVideoPreviewError(false)}
                  />
                  {videoPreviewError ? (
                    <p className="border-t border-rose-400/20 bg-rose-950/40 px-4 py-2 text-xs text-rose-100">
                      แสดงตัวอย่างวิดีโอไม่ได้ อาจเกิดจาก codec ที่ browser ไม่รองรับ หรือ URL วิดีโอยังเข้าถึงไม่ได้
                    </p>
                  ) : videoPreviewUrl ? (
                    <p className="border-t border-white/10 px-4 py-2 text-xs text-slate-300">
                      กำลังแสดงตัวอย่างจากไฟล์ในเครื่อง หลังบันทึกแล้วระบบจะใช้ URL วิดีโอที่อัปโหลด
                    </p>
                  ) : null}
                </div>
              ) : null}

              <label className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={draft.preview}
                  onChange={(event) => onDraftChange('preview', event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <span>
                  <span className="block font-medium text-slate-800">เปิดให้บทเรียนนี้เป็นวิดีโอตัวอย่างก่อนซื้อ</span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    ตอนนี้ระบบใช้วิดีโอหลักไฟล์เดียวกันเป็น preview ถ้าต้องการคลิปตัวอย่างแยก ต้องเพิ่มช่องไฟล์และฐานข้อมูลอีกชุด
                  </span>
                </span>
              </label>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                {editingLessonId ? (
                  <button
                    type="button"
                    className="btn-secondary text-rose-700"
                    onClick={() => onDelete(editingLessonId)}
                    disabled={saving || uploading}
                  >
                    <Trash2 size={16} />
                    ลบบทเรียน
                  </button>
                ) : null}
              </div>
              <button type="submit" className="btn-primary" disabled={saving || uploading}>
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
    clearLessonVideoPreview()
  }

  const startNewLesson = () => {
    setEditingLessonId(null)
    setLessonDraft(emptyLessonDraft)
    setLessonMessage(null)
    setLessonUploadProgress(null)
    clearLessonVideoPreview()
  }

  const selectLesson = (lesson: Lesson) => {
    setEditingLessonId(lesson.id)
    setLessonDraft(draftFromLesson(lesson))
    setLessonMessage(null)
    setLessonUploadProgress(null)
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
    setLessonMessage(null)

    try {
      const uploaded = await api.uploadVideoAsset({ file, onProgress: setLessonUploadProgress })
      setLessonDraft((current) => ({ ...current, videoUrl: uploaded.fileUrl }))
      setLessonVideoPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current)
        return null
      })
      setLessonMessage({
        tone: 'success',
        text: uploaded.storage === 'r2' ? 'อัปโหลดวิดีโอไป Cloudflare R2 สำเร็จ' : 'อัปโหลดวิดีโอสำเร็จ',
      })
    } catch (currentError) {
      setLessonMessage({
        tone: 'error',
        text: currentError instanceof Error ? currentError.message : 'อัปโหลดวิดีโอไม่สำเร็จ',
      })
    } finally {
      setUploadingLessonVideo(false)
      setLessonUploadProgress(null)
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
      setLessonMessage({ tone: 'success', text: 'บันทึกบทเรียนเรียบร้อยแล้ว' })
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
        text: formMode === 'edit' ? 'บันทึกการแก้ไขคอร์สเรียบร้อยแล้ว' : 'สร้างคอร์สเรียบร้อยแล้ว',
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

  if (activeSection === 'profile') {
    return (
      <div className="space-y-6">
        <section className="card p-5 sm:p-6">
          <h1 className="text-2xl font-semibold text-slate-950">โปรไฟล์คุณครู</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            แก้ไขชื่อ รูปโปรไฟล์ และข้อมูลติดต่อที่ใช้แสดงในระบบ
          </p>
        </section>

        <section className="card overflow-hidden">
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
      </div>
    )
  }

  return (
    <>
      <div className="space-y-6">
        <section className="card p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-slate-500">Teacher Studio</p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-950">จัดการคอร์สของ {data.user.name}</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                หน้าเดียวสำหรับดูคอร์สทั้งหมดของคุณครู แล้วค่อยจัดการผ่าน popup ตามงานที่ต้องการ
              </p>
            </div>
            <button type="button" className="btn-primary" onClick={openCreateModal}>
              <Plus size={16} />
              สร้างคอร์ส
            </button>
          </div>
        </section>

        {message ? (
          <section
            className={`rounded-lg border px-4 py-3 text-sm ${
              message.tone === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-rose-200 bg-rose-50 text-rose-700'
            }`}
          >
            {message.text}
          </section>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            {
              label: 'คอร์สทั้งหมด',
              value: teacherStats.totalCourses,
              icon: LibraryBig,
              accentClass: 'bg-sky-50 text-sky-700 ring-sky-100 dark:bg-sky-400/10 dark:text-sky-200 dark:ring-sky-400/15',
            },
            {
              label: 'เผยแพร่แล้ว',
              value: teacherStats.published,
              icon: Eye,
              accentClass:
                'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-400/10 dark:text-emerald-200 dark:ring-emerald-400/15',
            },
            {
              label: 'ผู้เรียนรวม',
              value: teacherStats.totalStudents.toLocaleString('th-TH'),
              icon: UsersRound,
              accentClass:
                'bg-violet-50 text-violet-700 ring-violet-100 dark:bg-violet-400/10 dark:text-violet-200 dark:ring-violet-400/15',
            },
            {
              label: 'บทเรียนรวม',
              value: teacherStats.totalLessons,
              icon: BookOpen,
              accentClass:
                'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-400/10 dark:text-amber-200 dark:ring-amber-400/15',
            },
            {
              label: 'รายได้รวม',
              value: `${teacherStats.totalRevenue.toLocaleString('th-TH')} บาท`,
              icon: CircleDollarSign,
              accentClass:
                'bg-rose-50 text-rose-700 ring-rose-100 dark:bg-rose-400/10 dark:text-rose-200 dark:ring-rose-400/15',
            },
          ].map((item) => {
            const Icon = item.icon

            return (
            <div
              key={item.label}
              className="flex items-center gap-3 rounded-lg border border-slate-200/80 bg-white px-4 py-3 shadow-sm shadow-slate-200/50 transition hover:border-slate-300 dark:border-white/10 dark:bg-slate-900 dark:shadow-black/20"
            >
              <span
                className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md ring-1 ${item.accentClass}`}
              >
                <Icon size={18} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-xl font-semibold text-slate-950">{item.value}</p>
                <p className="mt-0.5 truncate text-xs font-medium text-slate-500">{item.label}</p>
              </div>
            </div>
          )})}
        </section>

        <section className="card overflow-hidden">
          <div className="flex flex-col gap-4 border-b border-slate-200 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">คอร์สของฉัน</h2>
              <p className="mt-1 text-sm text-slate-500">
                กดสร้างคอร์สเพื่อเปิด popup ใหม่ กดแก้ไขหรือกดลบจากแต่ละรายการได้ทันที
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="relative block min-w-0 sm:w-72">
                <span className="sr-only">ค้นหาคอร์ส</span>
                <Search
                  size={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={courseSearch}
                  onChange={(event) => setCourseSearch(event.target.value)}
                  className="h-10 w-full rounded-md border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-200"
                  placeholder="ค้นหาคอร์ส"
                />
              </label>
              <label className="block sm:w-36">
                <span className="sr-only">สถานะ</span>
                <select
                  className="h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-200"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as 'all' | Course['status'])}
                >
                  <option value="all">ทั้งหมด</option>
                  <option value="published">เผยแพร่</option>
                  <option value="draft">ฉบับร่าง</option>
                  <option value="hidden">ซ่อน</option>
                </select>
              </label>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="table-cell">คอร์ส</th>
                  <th className="table-cell">หมวดหมู่</th>
                  <th className="table-cell">ราคา</th>
                  <th className="table-cell">ผู้เรียน</th>
                  <th className="table-cell">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredCourses.map((course) => (
                  <tr key={course.id}>
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        <img src={course.coverImage} alt={course.title} className="h-12 w-16 rounded-md object-cover" />
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-slate-950">{course.title}</p>
                            <span
                              className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                                getCourseStatusMeta(course.status).badgeClass
                              }`}
                            >
                              {getCourseStatusMeta(course.status).label}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500">
                            {course.lessonCount ?? course.lessons.length} บทเรียน
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell text-slate-600">{course.category}</td>
                    <td className="table-cell text-slate-600">{course.price.toLocaleString('th-TH')} บาท</td>
                    <td className="table-cell text-slate-600">{course.students.toLocaleString('th-TH')}</td>
                    <td className="table-cell">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className="btn-secondary px-3 py-2" onClick={() => openEditModal(course)}>
                          <Edit3 size={15} />
                          แก้ไข
                        </button>
                        <button type="button" className="btn-secondary px-3 py-2" onClick={() => openLessonManager(course)}>
                          <Video size={15} />
                          บทเรียน
                        </button>
                        <button
                          type="button"
                          className="btn-secondary px-3 py-2"
                          onClick={() => toggleCourseStatus(course)}
                          disabled={updatingStatusSlug === course.slug}
                        >
                          {updatingStatusSlug === course.slug ? (
                            <LoaderCircle size={15} className="animate-spin" />
                          ) : (course.status ?? 'published') === 'published' ? (
                            <EyeOff size={15} />
                          ) : (
                            <Eye size={15} />
                          )}
                          {getCourseStatusMeta(course.status).actionLabel}
                        </button>
                        <button
                          type="button"
                          className="btn-secondary px-3 py-2 text-rose-700"
                          onClick={() => setDeleteTarget(course)}
                        >
                          <Trash2 size={15} />
                          ลบ
                        </button>
                      </div>
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
      </div>

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
