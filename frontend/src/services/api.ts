import type { Course, StudentEnrollment } from '../types/course'
import type { QuizQuestion } from '../types/quiz'
import type { User, UserRole } from '../types/user'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''
const DIRECT_R2_VIDEO_UPLOAD = import.meta.env.VITE_DIRECT_R2_VIDEO_UPLOAD === 'true'

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
  storage?: 'local' | 'r2'
}

export interface UploadVideoAssetPayload {
  file: File
  onProgress?: (progress: number) => void
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

const authStorageKey = 'learnos_auth'
const authChangeEvent = 'learnos-auth-change'
const cartStorageKey = 'learnos_cart'
const cartChangeEvent = 'learnos-cart-change'

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

  const reportProgress = () => {
    const uploadedBytes = Array.from(partProgress.values()).reduce((total, loaded) => total + loaded, 0)
    const progress = Math.min(99, Math.round((uploadedBytes / payload.file.size) * 100))
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

  payload.onProgress?.(0)

  try {
    const workerCount = Math.min(3, totalParts)
    await Promise.all(Array.from({ length: workerCount }, () => uploadNextPart()))

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
    if (!DIRECT_R2_VIDEO_UPLOAD) {
      return api.uploadAsset({ kind: 'video', file: payload.file, onProgress: payload.onProgress })
    }

    try {
      return await uploadVideoAssetToR2(payload)
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 501) {
        return api.uploadAsset({ kind: 'video', file: payload.file, onProgress: payload.onProgress })
      }

      throw error
    }
  },
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
  completeLesson: (slug: string, lessonId: string) =>
    request<StudentEnrollment>(`/api/courses/${slug}/lessons/${lessonId}/complete`, {
      method: 'POST',
    }),
  getStudentDashboard: () => request<StudentDashboardData>('/api/student/dashboard'),
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
