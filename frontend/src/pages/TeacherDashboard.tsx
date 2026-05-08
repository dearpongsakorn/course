import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Edit3,
  ImagePlus,
  LoaderCircle,
  Plus,
  Trash2,
  UploadCloud,
  Video,
  X,
} from 'lucide-react'
import { useApi } from '../hooks/useApi'
import { api } from '../services/api'
import type { Course } from '../types/course'

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
  lessonTitle: '',
  lessonSummary: '',
  lessonDuration: '',
  lessonPreview: true,
  videoUrl: '',
})

type CourseDraft = ReturnType<typeof createEmptyDraft>
type FormMode = 'create' | 'edit'

const formatBytes = (value: number) => {
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

const draftFromCourse = (course: Course): CourseDraft => {
  const firstLesson = course.lessons[0]

  return {
    title: course.title,
    description: course.description,
    price: String(course.price),
    category: course.category,
    level: course.level,
    duration: course.duration,
    outcomes: course.outcomes.join('\n'),
    coverImageUrl: course.coverImage.startsWith('/uploads/') ? '' : course.coverImage,
    lessonTitle: firstLesson?.title ?? '',
    lessonSummary: firstLesson?.summary ?? '',
    lessonDuration: firstLesson?.duration ?? '',
    lessonPreview: firstLesson?.preview ?? true,
    videoUrl: firstLesson?.videoUrl ?? '',
  }
}

function CourseFormModal({
  mode,
  draft,
  coverPreview,
  videoPreview,
  coverFile,
  videoFile,
  uploadingVideo,
  formMessage,
  saving,
  onClose,
  onSubmit,
  onDraftChange,
  onCoverChange,
  onVideoChange,
}: {
  mode: FormMode
  draft: CourseDraft
  coverPreview: string
  videoPreview: string
  coverFile: File | null
  videoFile: File | null
  uploadingVideo: boolean
  formMessage: { tone: 'success' | 'error'; text: string } | null
  saving: boolean
  onClose: () => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  onDraftChange: <K extends keyof CourseDraft>(key: K, value: CourseDraft[K]) => void
  onCoverChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  onVideoChange: (event: React.ChangeEvent<HTMLInputElement>) => void
}) {
  const [videoPreviewError, setVideoPreviewError] = useState(false)

  useEffect(() => {
    queueMicrotask(() => {
      setVideoPreviewError(false)
    })
  }, [videoPreview])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/55 px-4 py-8">
      <div className="w-full max-w-5xl rounded-lg border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              {mode === 'create' ? 'สร้างคอร์สใหม่' : 'แก้ไขคอร์ส'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {mode === 'create'
                ? 'สร้างคอร์สพร้อมบทเรียนแรกใน popup เดียว'
                : 'ปรับข้อมูล รูปปก และวิดีโอของคอร์สนี้ได้จาก popup เดียว'}
            </p>
          </div>
          <button type="button" className="btn-ghost" onClick={onClose} aria-label="ปิด popup">
            <X size={18} />
          </button>
        </div>

        <form className="p-5 sm:p-6" onSubmit={onSubmit}>
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
          <div className="grid gap-4 sm:grid-cols-2">
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
                className="field-input min-h-28 resize-y"
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
                className="field-input min-h-24 resize-y"
                placeholder="ใส่ 1 หัวข้อต่อ 1 บรรทัด"
                value={draft.outcomes}
                onChange={(event) => onDraftChange('outcomes', event.target.value)}
              />
            </label>

            <div className="sm:col-span-2 grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-950">
                  <ImagePlus size={16} />
                  รูปปกคอร์ส
                </div>
                <img
                  src={coverPreview}
                  alt="Course cover preview"
                  className="mt-4 aspect-video w-full rounded-md border border-slate-200 object-cover"
                />
                <div className="mt-4 space-y-3">
                  <label className="block">
                    <span className="field-label">อัปโหลดรูปปก</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="field-input file:mr-3 file:rounded-md file:border-0 file:bg-slate-950 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
                      onChange={onCoverChange}
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
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-950">
                  <Video size={16} />
                  วิดีโอบทเรียนแรก
                </div>
                <div className="mt-4 flex min-h-52 flex-col justify-between rounded-md border border-dashed border-slate-300 bg-white p-4">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-slate-950 text-white">
                      <UploadCloud size={18} />
                    </span>
                    <div>
                      <p className="font-medium text-slate-950">อัปโหลดไฟล์ MP4</p>
                      <p className="mt-1 text-sm leading-6 text-slate-500">
                        รองรับไฟล์วิดีโอสำหรับบทเรียนแรก สูงสุด 500MB และระบบจะแปลงเป็น MP4 แบบที่เว็บเล่นได้ให้อัตโนมัติ
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    <input
                      type="file"
                      accept="video/mp4,.mp4"
                      className="field-input file:mr-3 file:rounded-md file:border-0 file:bg-slate-950 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
                      onChange={onVideoChange}
                    />
                    <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      {uploadingVideo
                        ? 'กำลังอัปโหลดและแปลงวิดีโอสำหรับ preview...'
                        : videoFile
                        ? `${videoFile.name} • ${formatBytes(videoFile.size)}`
                        : draft.videoUrl
                          ? 'ใช้วิดีโอเดิมของคอร์สนี้'
                          : 'ยังไม่ได้เลือกไฟล์วิดีโอ'}
                    </div>
                    <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-950">
                      {videoPreview ? (
                        videoPreviewError ? (
                          <div className="aspect-video bg-slate-950">
                            <img
                              src={coverPreview}
                              alt="Video preview fallback"
                              className="h-full w-full object-cover opacity-80"
                            />
                          </div>
                        ) : (
                          <video
                            className="aspect-video w-full bg-slate-950 object-contain"
                            controls
                            playsInline
                            preload="metadata"
                            poster={coverPreview}
                            src={videoPreview}
                            onLoadedData={() => setVideoPreviewError(false)}
                            onError={() => setVideoPreviewError(true)}
                          />
                        )
                      ) : (
                        <div className="flex aspect-video items-center justify-center text-sm text-slate-300">
                          ยังไม่มีพรีวิววิดีโอ
                        </div>
                      )}
                    </div>
                    {videoPreviewError ? (
                      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                        เบราว์เซอร์พรีวิวไฟล์ต้นฉบับนี้ไม่ได้ แต่หลังบันทึกระบบจะแปลงวิดีโอให้และหน้าเรียนจะเล่นได้ตามปกติ
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="sm:col-span-2 grid gap-4 rounded-lg border border-slate-200 bg-white p-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-950">ตั้งค่าบทเรียนแรก</h3>
                <p className="mt-1 text-sm text-slate-500">ใช้ทั้งตอนสร้างคอร์สใหม่และตอนแก้ไขคอร์สเดิม</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="field-label">ชื่อบทเรียน</span>
                  <input
                    className="field-input"
                    placeholder="บทเรียนที่ 1: เริ่มต้นคอร์ส"
                    value={draft.lessonTitle}
                    onChange={(event) => onDraftChange('lessonTitle', event.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="field-label">ความยาววิดีโอ</span>
                  <input
                    className="field-input"
                    placeholder="12:30"
                    value={draft.lessonDuration}
                    onChange={(event) => onDraftChange('lessonDuration', event.target.value)}
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="field-label">สรุปบทเรียน</span>
                  <textarea
                    className="field-input min-h-24 resize-y"
                    placeholder="เขียนสรุปสั้น ๆ ของบทเรียนแรก เพื่อใช้แสดงในหน้าเรียน"
                    value={draft.lessonSummary}
                    onChange={(event) => onDraftChange('lessonSummary', event.target.value)}
                  />
                </label>
                <label className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={draft.lessonPreview}
                    onChange={(event) => onDraftChange('lessonPreview', event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  เปิดให้บทเรียนแรกเป็นตัวอย่างก่อนซื้อ
                </label>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-200 pt-5">
            <button type="button" className="btn-secondary" onClick={onClose}>
              ยกเลิก
            </button>
            <button type="submit" className="btn-primary" disabled={saving || uploadingVideo}>
              {saving ? (
                <>
                  <LoaderCircle size={16} className="animate-spin" />
                  กำลังบันทึก...
                </>
              ) : uploadingVideo ? (
                <>
                  <LoaderCircle size={16} className="animate-spin" />
                  กำลังเตรียมวิดีโอ...
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
          </div>
        </div>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            ยกเลิก
          </button>
          <button type="button" className="btn-primary bg-rose-700 hover:bg-rose-800" onClick={onConfirm} disabled={deleting}>
            {deleting ? 'กำลังลบ...' : 'ยืนยันการลบ'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function TeacherDashboard() {
  const { data, error, loading } = useApi(() => api.getTeacherDashboard(), [])
  const [courses, setCourses] = useState<Course[]>([])
  const [saving, setSaving] = useState(false)
  const [deletingSlug, setDeletingSlug] = useState<string | null>(null)
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [formMode, setFormMode] = useState<FormMode>('create')
  const [formOpen, setFormOpen] = useState(false)
  const [editingSlug, setEditingSlug] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Course | null>(null)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const [videoPreview, setVideoPreview] = useState<string>('')
  const [coverPreview, setCoverPreview] = useState<string>(defaultCover)
  const [draft, setDraft] = useState<CourseDraft>(() => createEmptyDraft())

  useEffect(() => {
    queueMicrotask(() => {
      if (data?.courses) setCourses(data.courses)
    })
  }, [data?.courses])

  const editingCourse = useMemo(
    () => courses.find((course) => course.slug === editingSlug) ?? null,
    [courses, editingSlug],
  )

  const resetDraft = () => {
    setDraft(createEmptyDraft())
    setCoverFile(null)
    setVideoFile(null)
    setUploadingVideo(false)
    setVideoPreview('')
    setCoverPreview(defaultCover)
    setEditingSlug(null)
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
    setVideoFile(null)
    setVideoPreview(course.lessons[0]?.videoUrl ?? '')
    setCoverPreview(course.coverImage)
    setFormOpen(true)
    setMessage(null)
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

  const handleVideoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    setVideoFile(file)

    if (!file) {
      const fallbackVideoUrl = draft.videoUrl || editingCourse?.lessons[0]?.videoUrl || ''
      setVideoPreview(fallbackVideoUrl)
      return
    }

    setUploadingVideo(true)
    setVideoPreview('')
    setMessage(null)

    try {
      const uploadedVideo = await api.uploadAsset({ kind: 'video', file })
      setDraft((current) => ({ ...current, videoUrl: uploadedVideo.fileUrl }))
      setVideoPreview(uploadedVideo.fileUrl)
    } catch (currentError) {
      setDraft((current) => ({ ...current, videoUrl: editingCourse?.lessons[0]?.videoUrl ?? '' }))
      setVideoPreview(editingCourse?.lessons[0]?.videoUrl || '')
      setMessage({
        tone: 'error',
        text: currentError instanceof Error ? currentError.message : 'ไม่สามารถอัปโหลดวิดีโอสำหรับ preview ได้',
      })
    } finally {
      setUploadingVideo(false)
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setMessage(null)

    try {
      let coverImage = draft.coverImageUrl.trim() || editingCourse?.coverImage || defaultCover
      let videoUrl = draft.videoUrl || editingCourse?.lessons[0]?.videoUrl || ''

      if (coverFile) {
        const uploadedCover = await api.uploadAsset({ kind: 'cover', file: coverFile })
        coverImage = uploadedCover.fileUrl
      }

      if (videoFile && !draft.videoUrl) {
        const uploadedVideo = await api.uploadAsset({ kind: 'video', file: videoFile })
        videoUrl = uploadedVideo.fileUrl
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
        lessonTitle: draft.lessonTitle || 'บทเรียนที่ 1',
        lessonSummary: draft.lessonSummary || 'เริ่มต้นคอร์สนี้ด้วยวิดีโอแนะนำบทเรียน',
        lessonDuration: draft.lessonDuration || '00:00',
        lessonPreview: draft.lessonPreview,
        videoUrl: videoUrl || undefined,
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

  if (loading) {
    return <div className="card p-6 text-sm text-slate-500">กำลังโหลดพื้นที่ทำงานของคุณครู...</div>
  }

  if (error) {
    return <div className="card p-6 text-sm text-rose-600">{error}</div>
  }

  if (!data) return null

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

        <section className="card overflow-hidden">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-lg font-semibold text-slate-950">คอร์สของฉัน</h2>
            <p className="mt-1 text-sm text-slate-500">
              กดสร้างคอร์สเพื่อเปิด popup ใหม่ กดแก้ไขหรือกดลบจากแต่ละรายการได้ทันที
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse">
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
                {courses.map((course) => (
                  <tr key={course.id}>
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        <img src={course.coverImage} alt={course.title} className="h-12 w-16 rounded-md object-cover" />
                        <div>
                          <p className="font-medium text-slate-950">{course.title}</p>
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
                      <div className="flex gap-2">
                        <button type="button" className="btn-secondary px-3 py-2" onClick={() => openEditModal(course)}>
                          <Edit3 size={15} />
                          แก้ไข
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
          </div>
        </section>
      </div>

      {formOpen ? (
        <CourseFormModal
          mode={formMode}
          draft={draft}
          coverPreview={coverPreview}
          videoPreview={videoPreview}
          coverFile={coverFile}
          videoFile={videoFile}
          uploadingVideo={uploadingVideo}
          formMessage={message}
          saving={saving}
          onClose={closeFormModal}
          onSubmit={handleSubmit}
          onDraftChange={handleDraftChange}
          onCoverChange={handleCoverChange}
          onVideoChange={handleVideoChange}
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
    </>
  )
}
