import type { Course, StudentEnrollment } from '../types/course'
import type { QuizQuestion } from '../types/quiz'
import type { User, UserRole } from '../types/user'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

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
}

export interface UploadAssetResponse {
  kind: 'cover' | 'video' | 'avatar'
  fileName: string
  fileUrl: string
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
    throw new Error(error.message ?? 'Request failed')
  }

  const payload = (await response.json()) as ApiResponse<T>
  return payload.data
}

async function uploadRequest<T>(path: string, formData: FormData): Promise<T> {
  const token = authStorage.getSession()?.token
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }))
    throw new Error(error.message ?? 'Request failed')
  }

  const payload = (await response.json()) as ApiResponse<T>
  return payload.data
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

    return uploadRequest<UploadAssetResponse>('/api/uploads', formData)
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
  deleteCourse: (slug: string) =>
    request<{ ok: boolean; slug: string }>(`/api/courses/${slug}/delete`, {
      method: 'POST',
    }),
  getStudentDashboard: () => request<StudentDashboardData>('/api/student/dashboard'),
  updateStudentProfile: (payload: Omit<StudentProfile, 'updatedAt'>) =>
    request<StudentProfile>('/api/student/profile', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getTeacherDashboard: () => request<TeacherDashboardData>('/api/teacher/dashboard'),
  getAdminDashboard: () => request<AdminDashboardData>('/api/admin/dashboard'),
}
