import type { Course, StudentEnrollment } from '../types/course'
import type { QuizQuestion } from '../types/quiz'
import type { User, UserRole } from '../types/user'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''
const DIRECT_MUX_VIDEO_UPLOAD = import.meta.env.VITE_DIRECT_MUX_VIDEO_UPLOAD === 'true'
const DIRECT_R2_VIDEO_UPLOAD = import.meta.env.VITE_DIRECT_R2_VIDEO_UPLOAD === 'true'
const configuredR2VideoUploadConcurrency = Number(import.meta.env.VITE_R2_VIDEO_UPLOAD_CONCURRENCY ?? 5)
const R2_VIDEO_UPLOAD_CONCURRENCY = Math.min(
  8,
  Math.max(1, Number.isFinite(configuredR2VideoUploadConcurrency) ? configuredR2VideoUploadConcurrency : 5),
)

interface ApiResponse<T> {
  data: T
}

export interface StudentCourse {
  course: Course
  enrollment: StudentEnrollment
}

export interface StudentDashboardData {
  user: User
  profile: StudentProfile
  courses: StudentCourse[]
  stats: {
    enrolledCourses: number
    averageProgress: number
    completedLessons: number
  }
}

export interface StudentProfile {
  name: string
  headline: string
  bio: string
  learningGoal: string
  phone: string
  avatarUrl: string
  updatedAt: string | null
}

export interface TeacherDashboardData {
  user: User
  profile?: StudentProfile
  courses: Course[]
}

export interface AdminDashboardData {
  users: User[]
  courses: Course[]
  stats: {
    totalUsers: number
    totalCourses: number
    totalTeachers: number
    totalStudents: number
    activeUsers: number
  }
}

export interface CreateCoursePayload {
  title: string
  description: string
  coverImage: string
  price: number
  category: string
  level: string
  duration: string
  outcomes: string[]
  lessonTitle?: string
  lessonSummary?: string
  lessonDuration?: string
  lessonPreview?: boolean
  videoUrl?: string
}

export type UpdateCoursePayload = CreateCoursePayload

export interface LessonPayload {
  title: string
  duration: string
  summary: string
  preview: boolean
  videoUrl?: string
}

export interface EnrollCourseResponse {
  courseSlug: string
  enrollment: StudentEnrollment
}

export interface AuthSession {
  token: string
  user: User
  dashboardPath: string
}

export interface UploadAssetPayload {
  kind: 'cover' | 'video' | 'avatar'
  file: File
  onProgress?: (progress: number) => void
}

export interface UploadAssetResponse {
  kind: 'cover' | 'video' | 'avatar'
  fileName: string
  fileUrl: string
  storage?: 'local' | 'r2' | 'mux'
}

export interface UploadVideoAssetPayload {
  file: File
  onProgress?: (progress: number) => void
}

export interface UploadedVideoDiagnostics {
  fileUrl: string
  exists: boolean
  isBrowserFriendly: boolean
  videoCodec: string | null
  audioCodec: string | null
}

interface MuxDirectUploadStartResponse {
  provider: 'mux'
  uploadId: string
  uploadUrl: string
  timeout: number
  status: string
}

interface MuxDirectUploadStatusResponse {
  provider: 'mux'
  uploadId: string
  status: string
  assetId?: string
  assetStatus?: string
  playbackId?: string
  playbackUrl?: string
  error?: string
}

interface R2MultipartStartResponse {
  kind: 'video'
  key: string
  uploadId: string
  fileName: string
  fileUrl: string
  partSize: number
  maxBytes: number
  storage: 'r2'
}

interface R2MultipartSignPartResponse {
  url: string
  expiresIn: number
}

interface R2MultipartUploadedPart {
  partNumber: number
  etag: string
}

export interface LoginPayload {
  email: string
  password: string
  role?: UserRole
}

export interface RegisterPayload {
  name: string
  email: string
  password: string
  role: Extract<UserRole, 'student' | 'teacher'>
  title?: string
}

export interface AiSummaryResponse {
  summary: string
}

export interface AiAnswerResponse {
  question: string
  answer: string
}

export interface AiQuizResponse {
  questions: QuizQuestion[]
}

const authStorageKey = 'mycourse_auth'
const authChangeEvent = 'mycourse-auth-change'
const cartStorageKey = 'mycourse_cart'
const cartChangeEvent = 'mycourse-cart-change'
const studentDashboardCacheKey = 'mycourse_student_dashboard_cache'

class ApiRequestError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
  }
}

export const authStorage = {
  getSession: (): AuthSession | null => {
    const raw = localStorage.getItem(authStorageKey)
    return raw ? (JSON.parse(raw) as AuthSession) : null
  },
  setSession: (session: AuthSession) => {
    localStorage.setItem(authStorageKey, JSON.stringify(session))
    window.dispatchEvent(new Event(authChangeEvent))
  },
  clearSession: () => {
    localStorage.removeItem(authStorageKey)
    localStorage.removeItem(studentDashboardCacheKey)
    window.dispatchEvent(new Event(authChangeEvent))
  },
  subscribe: (listener: () => void) => {
    window.addEventListener(authChangeEvent, listener)
    window.addEventListener('storage', listener)

    return () => {
      window.removeEventListener(authChangeEvent, listener)
      window.removeEventListener('storage', listener)
    }
  },
}

export const studentDashboardStorage = {
  get: (): StudentDashboardData | null => {
    const raw = localStorage.getItem(studentDashboardCacheKey)
    if (!raw) return null

    try {
      return JSON.parse(raw) as StudentDashboardData
    } catch {
      localStorage.removeItem(studentDashboardCacheKey)
      return null
    }
  },
  set: (dashboard: StudentDashboardData) => {
    localStorage.setItem(studentDashboardCacheKey, JSON.stringify(dashboard))
  },
  clear: () => {
    localStorage.removeItem(studentDashboardCacheKey)
  },
}

export const cartStorage = {
  getItems: (): string[] => {
    const raw = localStorage.getItem(cartStorageKey)
    if (!raw) return []

    try {
      const items = JSON.parse(raw)
      return Array.isArray(items) ? items.filter((item): item is string => typeof item === 'string') : []
    } catch {
      return []
    }
  },
  addItem: (courseSlug: string) => {
    const nextItems = Array.from(new Set([...cartStorage.getItems(), courseSlug]))
    localStorage.setItem(cartStorageKey, JSON.stringify(nextItems))
    window.dispatchEvent(new Event(cartChangeEvent))
    return nextItems
  },
  removeItem: (courseSlug: string) => {
    const nextItems = cartStorage.getItems().filter((item) => item !== courseSlug)
    localStorage.setItem(cartStorageKey, JSON.stringify(nextItems))
    window.dispatchEvent(new Event(cartChangeEvent))
    return nextItems
  },
  clearItems: () => {
    localStorage.removeItem(cartStorageKey)
    window.dispatchEvent(new Event(cartChangeEvent))
    return []
  },
  subscribe: (listener: () => void) => {
    window.addEventListener(cartChangeEvent, listener)
    window.addEventListener('storage', listener)

    return () => {
      window.removeEventListener(cartChangeEvent, listener)
      window.removeEventListener('storage', listener)
    }
  },
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = authStorage.getSession()?.token
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
    ...init,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }))
    throw new ApiRequestError(error.message ?? 'Request failed', response.status)
  }

  const payload = (await response.json()) as ApiResponse<T>
  return payload.data
}

async function uploadRequest<T>(
  path: string,
  formData: FormData,
  onProgress?: (progress: number) => void,
): Promise<T> {
  const token = authStorage.getSession()?.token

  if (!onProgress) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }))
      throw new ApiRequestError(error.message ?? 'Request failed', response.status)
    }

    const payload = (await response.json()) as ApiResponse<T>
    return payload.data
  }

  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    xhr.open('POST', `${API_BASE_URL}${path}`)
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)))
      }
    }
    xhr.onload = () => {
      const payload = (() => {
        try {
          return JSON.parse(xhr.responseText || '{}') as Partial<ApiResponse<T>> & { message?: string }
        } catch {
          return { message: 'Request failed' }
        }
      })()

      if (xhr.status >= 200 && xhr.status < 300 && 'data' in payload) {
        onProgress(100)
        resolve(payload.data as T)
        return
      }

      reject(new ApiRequestError(payload.message ?? 'Request failed', xhr.status || 500))
    }
    xhr.onerror = () => reject(new ApiRequestError('เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ', 0))
    xhr.onabort = () => reject(new ApiRequestError('ยกเลิกการอัปโหลดแล้ว', 0))
    xhr.send(formData)
  })
}

async function uploadVideoRequest(payload: UploadVideoAssetPayload): Promise<UploadAssetResponse> {
  const token = authStorage.getSession()?.token

  return new Promise<UploadAssetResponse>((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    xhr.open('POST', `${API_BASE_URL}/api/uploads/video`)
    xhr.setRequestHeader('Content-Type', payload.file.type || 'video/mp4')
    xhr.setRequestHeader('X-File-Name', encodeURIComponent(payload.file.name))
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        payload.onProgress?.(Math.min(99, Math.round((event.loaded / event.total) * 100)))
      }
    }
    xhr.onload = () => {
      const responsePayload = (() => {
        try {
          return JSON.parse(xhr.responseText || '{}') as Partial<ApiResponse<UploadAssetResponse>> & { message?: string }
        } catch {
          return { message: 'Request failed' }
        }
      })()

      if (xhr.status >= 200 && xhr.status < 300 && 'data' in responsePayload) {
        payload.onProgress?.(100)
        resolve(responsePayload.data as UploadAssetResponse)
        return
      }

      reject(new ApiRequestError(responsePayload.message ?? 'Request failed', xhr.status || 500))
    }
    xhr.onerror = () => reject(new ApiRequestError('เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ', 0))
    xhr.onabort = () => reject(new ApiRequestError('ยกเลิกการอัปโหลดแล้ว', 0))
    xhr.send(payload.file)
  })
}

const uploadBlobToSignedUrl = (
  url: string,
  blob: Blob,
  onProgress?: (loadedBytes: number) => void,
) =>
  new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    xhr.open('PUT', url)
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const etag = xhr.getResponseHeader('ETag')

        if (!etag) {
          reject(new Error('Cloudflare R2 ต้องตั้งค่า CORS ให้ expose header ETag ก่อนใช้อัปโหลดตรง'))
          return
        }

        resolve(etag)
        return
      }

      reject(new Error(`อัปโหลดวิดีโอไป Cloudflare R2 ไม่สำเร็จ (${xhr.status})`))
    }
    xhr.onerror = () => reject(new Error('เชื่อมต่อ Cloudflare R2 ไม่สำเร็จ'))
    xhr.onabort = () => reject(new Error('ยกเลิกการอัปโหลดวิดีโอแล้ว'))
    xhr.send(blob)
  })

const uploadBlobToMuxUrl = (url: string, file: File, onProgress?: (progress: number) => void) =>
  new Promise<void>(async (resolve, reject) => {
    const chunkSize = 20 * 1024 * 1024
    const totalSize = file.size

    const uploadChunk = (start: number) =>
      new Promise<void>((chunkResolve, chunkReject) => {
        const end = Math.min(start + chunkSize, totalSize)
        const chunk = file.slice(start, end, file.type || 'video/mp4')
        const xhr = new XMLHttpRequest()

        xhr.open('PUT', url)
        if (file.type) xhr.setRequestHeader('Content-Type', file.type)
        if (totalSize > chunkSize) {
          xhr.setRequestHeader('Content-Range', `bytes ${start}-${end - 1}/${totalSize}`)
        }
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const loadedBytes = start + event.loaded
            onProgress?.(Math.min(90, Math.round((loadedBytes / totalSize) * 90)))
          }
        }
        xhr.onload = () => {
          if ((xhr.status >= 200 && xhr.status < 300) || xhr.status === 308) {
            onProgress?.(Math.min(90, Math.round((end / totalSize) * 90)))
            chunkResolve()
            return
          }

          chunkReject(new Error(`อัปโหลดวิดีโอไป Mux ไม่สำเร็จ (${xhr.status})`))
        }
        xhr.onerror = () => chunkReject(new Error('เชื่อมต่อ Mux direct upload ไม่สำเร็จ'))
        xhr.onabort = () => chunkReject(new Error('ยกเลิกการอัปโหลดวิดีโอไป Mux แล้ว'))
        xhr.send(chunk)
      })

    try {
      for (let start = 0; start < totalSize; start += chunkSize) {
        await uploadChunk(start)
      }

      onProgress?.(92)
      resolve()
    } catch (error) {
      reject(error)
    }
  })

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

const pollMuxDirectUpload = async (
  uploadId: string,
  onProgress?: (progress: number) => void,
): Promise<MuxDirectUploadStatusResponse> => {
  const maxAttempts = 360

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const status = await request<MuxDirectUploadStatusResponse>(
      `/api/uploads/mux/direct-upload/${encodeURIComponent(uploadId)}`,
    )

    if (
      status.error ||
      ['errored', 'cancelled', 'timed_out'].includes(status.status) ||
      status.assetStatus === 'errored'
    ) {
      throw new Error(status.error ?? `Mux upload ${status.assetStatus === 'errored' ? 'asset errored' : status.status}`)
    }

    if (status.playbackUrl && status.assetStatus === 'ready') {
      onProgress?.(100)
      return status
    }

    onProgress?.(Math.min(99, 92 + Math.floor((attempt / maxAttempts) * 7)))
    await wait(5000)
  }

  throw new Error('Mux ยังประมวลผลวิดีโอไม่เสร็จ กรุณารอสักครู่แล้วลองตรวจสถานะอีกครั้ง')
}

const uploadVideoAssetToMux = async (payload: UploadVideoAssetPayload): Promise<UploadAssetResponse> => {
  payload.onProgress?.(0)

  const directUpload = await request<MuxDirectUploadStartResponse>('/api/uploads/mux/direct-upload', {
    method: 'POST',
    body: JSON.stringify({
      fileName: payload.file.name,
      mimeType: payload.file.type || 'application/octet-stream',
      fileSize: payload.file.size,
    }),
  })

  await uploadBlobToMuxUrl(directUpload.uploadUrl, payload.file, payload.onProgress)
  const muxVideo = await pollMuxDirectUpload(directUpload.uploadId, payload.onProgress)

  if (!muxVideo.playbackUrl) {
    throw new Error('Mux ยังไม่ส่ง playback URL กลับมา')
  }

  return {
    kind: 'video',
    fileName: payload.file.name,
    fileUrl: muxVideo.playbackUrl,
    storage: 'mux',
  }
}

const uploadVideoAssetToR2 = async (payload: UploadVideoAssetPayload): Promise<UploadAssetResponse> => {
  const start = await request<R2MultipartStartResponse>('/api/uploads/r2/multipart/start', {
    method: 'POST',
    body: JSON.stringify({
      kind: 'video',
      fileName: payload.file.name,
      mimeType: payload.file.type || 'video/mp4',
      fileSize: payload.file.size,
    }),
  })
  const totalParts = Math.ceil(payload.file.size / start.partSize)
  const uploadedParts: R2MultipartUploadedPart[] = []
  const partProgress = new Map<number, number>()
  let nextPartNumber = 1
  let lastReportedProgress = 0
  const uploadableSize = Math.max(1, payload.file.size)

  const reportProgress = () => {
    const uploadedBytes = Array.from(partProgress.values()).reduce((total, loaded) => total + loaded, 0)
    const progress = Math.min(98, Math.max(1, Math.round((uploadedBytes / uploadableSize) * 98)))
    lastReportedProgress = Math.max(lastReportedProgress, progress)
    payload.onProgress?.(lastReportedProgress)
  }

  const uploadNextPart = async () => {
    while (nextPartNumber <= totalParts) {
      const partNumber = nextPartNumber
      nextPartNumber += 1

      const startByte = (partNumber - 1) * start.partSize
      const endByte = Math.min(startByte + start.partSize, payload.file.size)
      const chunk = payload.file.slice(startByte, endByte)
      const signedPart = await request<R2MultipartSignPartResponse>('/api/uploads/r2/multipart/sign-part', {
        method: 'POST',
        body: JSON.stringify({
          key: start.key,
          uploadId: start.uploadId,
          partNumber,
        }),
      })
      const etag = await uploadBlobToSignedUrl(signedPart.url, chunk, (loadedBytes) => {
        const currentLoadedBytes = partProgress.get(partNumber) ?? 0
        partProgress.set(partNumber, Math.max(currentLoadedBytes, loadedBytes))
        reportProgress()
      })

      partProgress.set(partNumber, chunk.size)
      uploadedParts.push({ partNumber, etag })
      reportProgress()
    }
  }

  payload.onProgress?.(1)

  try {
    const workerCount = Math.min(R2_VIDEO_UPLOAD_CONCURRENCY, totalParts)
    await Promise.all(Array.from({ length: workerCount }, () => uploadNextPart()))
    payload.onProgress?.(99)

    const completedUpload = await request<UploadAssetResponse>('/api/uploads/r2/multipart/complete', {
      method: 'POST',
      body: JSON.stringify({
        key: start.key,
        uploadId: start.uploadId,
        parts: uploadedParts.sort((left, right) => left.partNumber - right.partNumber),
      }),
    })

    payload.onProgress?.(100)
    return completedUpload
  } catch (error) {
    await request<{ ok: boolean }>('/api/uploads/r2/multipart/abort', {
      method: 'POST',
      body: JSON.stringify({
        key: start.key,
        uploadId: start.uploadId,
      }),
    }).catch(() => undefined)

    throw error
  }
}

export const api = {
  login: (payload: LoginPayload) =>
    request<AuthSession>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  register: (payload: RegisterPayload) =>
    request<AuthSession>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  me: () => request<User>('/api/auth/me'),
  logout: () =>
    request<{ ok: boolean }>('/api/auth/logout', {
      method: 'POST',
    }),
  saveTranscript: (lessonId: string, transcript: string) =>
    request<{ lessonId: string; transcript: string }>(`/api/ai/lessons/${lessonId}/transcript`, {
      method: 'POST',
      body: JSON.stringify({ transcript, source: 'manual' }),
    }),
  transcribeLesson: (lessonId: string) =>
    request<{ lessonId: string; transcript: string; source: string }>(`/api/ai/lessons/${lessonId}/transcribe`, {
      method: 'POST',
    }),
  summarizeLesson: (lessonId: string) =>
    request<AiSummaryResponse>(`/api/ai/lessons/${lessonId}/summarize`, {
      method: 'POST',
    }),
  askLesson: (lessonId: string, question: string) =>
    request<AiAnswerResponse>(`/api/ai/lessons/${lessonId}/ask`, {
      method: 'POST',
      body: JSON.stringify({ question }),
    }),
  generateLessonQuiz: (lessonId: string) =>
    request<AiQuizResponse>(`/api/ai/lessons/${lessonId}/quiz`, {
      method: 'POST',
    }),
  uploadAsset: (payload: UploadAssetPayload) => {
    const formData = new FormData()
    formData.set('kind', payload.kind)
    formData.set('file', payload.file)

    return uploadRequest<UploadAssetResponse>('/api/uploads', formData, payload.onProgress)
  },
  uploadVideoAsset: async (payload: UploadVideoAssetPayload) => {
    if (DIRECT_MUX_VIDEO_UPLOAD) {
      return uploadVideoAssetToMux(payload)
    }

    if (!DIRECT_R2_VIDEO_UPLOAD) {
      return uploadVideoRequest(payload)
    }

    try {
      return await uploadVideoAssetToR2(payload)
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 501) {
        return uploadVideoRequest(payload)
      }

      throw error
    }
  },
  inspectUploadedVideo: (fileUrl: string) =>
    request<UploadedVideoDiagnostics>(`/api/uploads/video/inspect?fileUrl=${encodeURIComponent(fileUrl)}`),
  getCourses: (params?: { popular?: boolean; teacherId?: string }) => {
    const searchParams = new URLSearchParams()

    if (params?.popular) searchParams.set('popular', 'true')
    if (params?.teacherId) searchParams.set('teacherId', params.teacherId)

    const queryString = searchParams.toString()
    return request<Course[]>(`/api/courses${queryString ? `?${queryString}` : ''}`)
  },
  getCourse: (slug: string) => request<Course>(`/api/courses/${slug}`),
  enrollCourse: (slug: string) =>
    request<EnrollCourseResponse>(`/api/courses/${slug}/enroll`, {
      method: 'POST',
    }),
  createCourse: (payload: CreateCoursePayload) =>
    request<Course>('/api/courses', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateCourse: (slug: string, payload: UpdateCoursePayload) =>
    request<Course>(`/api/courses/${slug}/update`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateCourseStatus: (slug: string, status: Course['status']) =>
    request<Course>(`/api/courses/${slug}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),
  updateCoursePopularity: (slug: string, isPopular: boolean) =>
    request<Course>(`/api/courses/${slug}/popular`, {
      method: 'POST',
      body: JSON.stringify({ isPopular }),
    }),
  deleteCourse: (slug: string) =>
    request<{ ok: boolean; slug: string }>(`/api/courses/${slug}/delete`, {
      method: 'POST',
    }),
  saveLesson: (slug: string, lessonId: string | null, payload: LessonPayload) =>
    request<Course>(`/api/courses/${slug}/lessons${lessonId ? `/${lessonId}` : ''}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  deleteLesson: (slug: string, lessonId: string) =>
    request<Course>(`/api/courses/${slug}/lessons/${lessonId}/delete`, {
      method: 'POST',
    }),
  rememberCurrentLesson: (slug: string, lessonId: string) =>
    request<StudentEnrollment>(`/api/courses/${slug}/lessons/${lessonId}/current`, {
      method: 'POST',
    }),
  completeLesson: (slug: string, lessonId: string) =>
    request<StudentEnrollment>(`/api/courses/${slug}/lessons/${lessonId}/complete`, {
      method: 'POST',
    }),
  getStudentDashboard: async () => {
    const dashboard = await request<StudentDashboardData>('/api/student/dashboard')
    studentDashboardStorage.set(dashboard)
    return dashboard
  },
  updateStudentProfile: (payload: Omit<StudentProfile, 'updatedAt'>) =>
    request<StudentProfile>('/api/student/profile', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getTeacherDashboard: () => request<TeacherDashboardData>('/api/teacher/dashboard'),
  updateTeacherProfile: (payload: Omit<StudentProfile, 'updatedAt'>) =>
    request<StudentProfile>('/api/teacher/profile', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getAdminDashboard: () => request<AdminDashboardData>('/api/admin/dashboard'),
}
