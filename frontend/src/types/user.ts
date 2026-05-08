export type UserRole = 'student' | 'teacher' | 'admin'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  avatarUrl?: string
  status: 'active' | 'pending' | 'suspended'
  createdAt: string
  isOnline?: boolean
  activeSessions?: number
  lastSeenAt?: string | null
}
