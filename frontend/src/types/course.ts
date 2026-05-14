import type { QuizQuestion } from './quiz'

export type CourseCategory =
  | 'Technology'
  | 'Business'
  | 'Design'
  | 'Marketing'
  | 'Data'

export interface Instructor {
  id: string
  name: string
  title: string
  bio: string
  avatarUrl: string
  rating: number
  totalStudents: number
}

export interface Lesson {
  id: string
  title: string
  duration: string
  preview: boolean
  videoUrl?: string
  summary: string
  aiStatus?: 'idle' | 'pending' | 'processing' | 'ready' | 'failed'
  aiError?: string | null
  aiSummary?: string | null
  hasTranscript?: boolean
  quizQuestions: QuizQuestion[]
}

export interface Course {
  id: string
  slug: string
  title: string
  description: string
  coverImage: string
  price: number
  category: CourseCategory
  level: 'Beginner' | 'Intermediate' | 'Advanced'
  duration: string
  rating: number
  students: number
  instructor: Instructor
  lessons: Lesson[]
  lessonCount?: number
  outcomes: string[]
  isPopular?: boolean
  status: 'draft' | 'published' | 'hidden'
  updatedAt: string
  viewerState?: {
    role: 'student' | 'teacher' | 'admin' | null
    isEnrolled: boolean
    canEnroll: boolean
    enrollment?: StudentEnrollment
  }
}

export interface StudentEnrollment {
  courseId: string
  progress: number
  completedLessons: number
  lastLessonId: string | null
  lastAccessedAt?: string
  joinedAt: string
}
