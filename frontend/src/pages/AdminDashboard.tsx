import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Eye,
  GraduationCap,
  LoaderCircle,
  Search,
  ShieldCheck,
  Star,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { useApi } from '../hooks/useApi'
import { api } from '../services/api'
import type { Course } from '../types/course'
import type { User } from '../types/user'

type AdminSection = 'overview' | 'users' | 'courses'

const fallbackCourseCover =
  'https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&w=1200&q=80'

const courseStatusLabel: Record<Course['status'], string> = {
  draft: 'ฉบับร่าง',
  published: 'เผยแพร่แล้ว',
  hidden: 'ซ่อนอยู่',
}

export default function AdminDashboard() {
  const [searchParams] = useSearchParams()
  const activeSection = (searchParams.get('section') as AdminSection | null) ?? 'overview'
  const { data, error, loading } = useApi(() => api.getAdminDashboard(), [])
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Course | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [popularUpdatingSlug, setPopularUpdatingSlug] = useState<string | null>(null)
  const [statusUpdatingSlug, setStatusUpdatingSlug] = useState<string | null>(null)
  const [deletingSlug, setDeletingSlug] = useState<string | null>(null)
  const [courseActionError, setCourseActionError] = useState<string | null>(null)
  const [userSearch, setUserSearch] = useState('')
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | User['role']>('all')
  const [courseSearch, setCourseSearch] = useState('')
  const [courseStatusFilter, setCourseStatusFilter] = useState<'all' | Course['status']>('all')

  useEffect(() => {
    if (data?.courses) setCourses(data.courses)
  }, [data?.courses])

  const users = data?.users ?? []
  const filteredUsers = useMemo(() => {
    const normalizedSearch = userSearch.trim().toLowerCase()

    return users.filter((user) => {
      const matchesRole = userRoleFilter === 'all' || user.role === userRoleFilter
      const matchesSearch =
        !normalizedSearch ||
        user.name.toLowerCase().includes(normalizedSearch) ||
        user.email.toLowerCase().includes(normalizedSearch)

      return matchesRole && matchesSearch
    })
  }, [userRoleFilter, userSearch, users])
  const filteredCourses = useMemo(() => {
    const normalizedSearch = courseSearch.trim().toLowerCase()

    return courses.filter((course) => {
      const matchesStatus = courseStatusFilter === 'all' || course.status === courseStatusFilter
      const matchesSearch =
        !normalizedSearch ||
        course.title.toLowerCase().includes(normalizedSearch) ||
        course.category.toLowerCase().includes(normalizedSearch) ||
        course.instructor.name.toLowerCase().includes(normalizedSearch)

      return matchesStatus && matchesSearch
    })
  }, [courseSearch, courseStatusFilter, courses])

  if (loading) return <div className="card p-6 text-sm text-slate-500">กำลังโหลดแดชบอร์ดระบบ...</div>
  if (error) return <div className="card p-6 text-sm text-rose-600">{error}</div>
  if (!data) return null

  const stats = [
    { label: 'ผู้ใช้ทั้งหมด', value: data.stats.totalUsers, icon: Users },
    { label: 'คอร์สทั้งหมด', value: data.stats.totalCourses, icon: BookOpen },
    { label: 'คุณครู', value: data.stats.totalTeachers, icon: ShieldCheck },
    { label: 'นักเรียน', value: data.stats.totalStudents, icon: GraduationCap },
    { label: 'กำลังใช้งานอยู่', value: data.stats.activeUsers, icon: Activity },
  ]

  const onlineUsers = users.filter((user) => user.isOnline)
  const offlineUsers = users.filter((user) => !user.isOnline)
  const publishedCourses = courses.filter((course) => course.status === 'published')
  const draftCourses = courses.filter((course) => course.status === 'draft')
  const popularCourses = courses.filter((course) => course.isPopular)

  const updateCourseStatus = async (course: Course, status: Course['status']) => {
    setStatusUpdatingSlug(course.slug)
    setCourseActionError(null)

    try {
      const nextCourse = await api.updateCourseStatus(course.slug, status)
      setCourses((current) => current.map((item) => (item.slug === nextCourse.slug ? nextCourse : item)))
      setSelectedCourse((current) => (current?.slug === nextCourse.slug ? nextCourse : current))
    } catch (currentError) {
      setCourseActionError(currentError instanceof Error ? currentError.message : 'ไม่สามารถเปลี่ยนสถานะคอร์สได้')
    } finally {
      setStatusUpdatingSlug(null)
    }
  }

  const togglePopular = async (course: Course) => {
    setPopularUpdatingSlug(course.slug)
    setCourseActionError(null)

    try {
      const nextCourse = await api.updateCoursePopularity(course.slug, !course.isPopular)
      setCourses((current) => current.map((item) => (item.slug === nextCourse.slug ? nextCourse : item)))
      setSelectedCourse((current) => (current?.slug === nextCourse.slug ? nextCourse : current))
    } catch (currentError) {
      setCourseActionError(currentError instanceof Error ? currentError.message : 'ไม่สามารถอัปเดตคอร์สยอดนิยมได้')
    } finally {
      setPopularUpdatingSlug(null)
    }
  }

  const deleteCourse = async () => {
    if (!deleteTarget) return

    setDeletingSlug(deleteTarget.slug)
    setCourseActionError(null)

    try {
      await api.deleteCourse(deleteTarget.slug)
      setCourses((current) => current.filter((course) => course.slug !== deleteTarget.slug))
      setSelectedCourse((current) => (current?.slug === deleteTarget.slug ? null : current))
      setDeleteTarget(null)
    } catch (currentError) {
      setCourseActionError(currentError instanceof Error ? currentError.message : 'ไม่สามารถลบคอร์สได้')
    } finally {
      setDeletingSlug(null)
    }
  }

  const formatDate = (value?: string | null) =>
    value
      ? new Intl.DateTimeFormat('th-TH', {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(new Date(value))
      : '-'

  if (activeSection === 'users') {
    return (
      <>
        <div className="space-y-6">
          <section className="card p-5 sm:p-6">
            <p className="text-sm text-slate-500">Admin Console</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-950">จัดการผู้ใช้</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              ตรวจสอบบัญชีผู้ใช้ บทบาท และสถานะการใช้งานระบบจาก session ล่าสุด
            </p>
          </section>

          <section className="card overflow-hidden">
            <div className="border-b border-slate-200 p-5">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">รายชื่อผู้ใช้</h2>
                  <p className="mt-1 text-sm text-slate-500">สีเขียวคือกำลังใช้งาน สีแดงคือไม่ได้ใช้งานระบบ</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_130px]">
                  <label className="block">
                    <span className="field-label">ค้นหาผู้ใช้</span>
                    <div className="relative mt-2">
                      <Search
                        size={16}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <input
                        value={userSearch}
                        onChange={(event) => setUserSearch(event.target.value)}
                        className="field-input mt-0 pl-10"
                      />
                    </div>
                  </label>
                  <label className="block">
                    <span className="field-label">Role</span>
                    <select
                      className="field-input"
                      value={userRoleFilter}
                      onChange={(event) => setUserRoleFilter(event.target.value as 'all' | User['role'])}
                    >
                      <option value="all">ทั้งหมด</option>
                      <option value="student">student</option>
                      <option value="teacher">teacher</option>
                      <option value="admin">admin</option>
                    </select>
                  </label>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="table-cell">ผู้ใช้</th>
                    <th className="table-cell">Role</th>
                    <th className="table-cell">การใช้งาน</th>
                    <th className="table-cell">Session</th>
                    <th className="table-cell">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredUsers.map((user) => (
                    <tr key={user.id}>
                      <td className="table-cell">
                        <div>
                          <p className="font-medium text-slate-950">{user.name}</p>
                          <p className="text-xs text-slate-500">{user.email}</p>
                        </div>
                      </td>
                      <td className="table-cell capitalize text-slate-600">{user.role}</td>
                      <td className="table-cell">
                        <span
                          className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                            user.isOnline ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {user.isOnline ? 'กำลังใช้งาน' : 'ไม่ได้ใช้งาน'}
                        </span>
                      </td>
                      <td className="table-cell text-slate-600">{user.activeSessions ?? 0}</td>
                      <td className="table-cell">
                        <button type="button" className="btn-secondary px-3 py-2" onClick={() => setSelectedUser(user)}>
                          <Eye size={15} />
                          ตรวจสอบ
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredUsers.length === 0 ? (
                <div className="p-8 text-center">
                  <h3 className="text-lg font-semibold text-slate-950">ไม่พบผู้ใช้ที่ตรงกับตัวกรอง</h3>
                  <p className="mt-2 text-sm text-slate-500">ลองเปลี่ยนคำค้นหาหรือ role</p>
                </div>
              ) : null}
            </div>
          </section>
        </div>

        {selectedUser ? (
          <UserInspectionModal user={selectedUser} formatDate={formatDate} onClose={() => setSelectedUser(null)} />
        ) : null}
      </>
    )
  }

  if (activeSection === 'courses') {
    return (
      <>
        <div className="space-y-6">
          <section className="card p-5 sm:p-6">
          <p className="text-sm text-slate-500">Admin Console</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">จัดการคอร์ส</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            ตรวจสอบข้อมูลคอร์ส ผู้สอน จำนวนบทเรียน สถานะ และจำนวนผู้เรียนในระบบ
          </p>
          </section>

          <section className="card overflow-hidden">
          <div className="border-b border-slate-200 p-5">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-end">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">รายการคอร์ส</h2>
                <p className="mt-1 text-sm text-slate-500">ข้อมูลจากตาราง courses และ lessons</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px]">
                <label className="block">
                  <span className="field-label">ค้นหาคอร์ส</span>
                  <div className="relative mt-2">
                    <Search
                      size={16}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      value={courseSearch}
                      onChange={(event) => setCourseSearch(event.target.value)}
                      className="field-input mt-0 pl-10"
                    />
                  </div>
                </label>
                <label className="block">
                  <span className="field-label">สถานะ</span>
                  <select
                    className="field-input"
                    value={courseStatusFilter}
                    onChange={(event) => setCourseStatusFilter(event.target.value as 'all' | Course['status'])}
                  >
                    <option value="all">ทั้งหมด</option>
                    <option value="published">เผยแพร่</option>
                    <option value="draft">ฉบับร่าง</option>
                    <option value="hidden">ซ่อน</option>
                  </select>
                </label>
              </div>
            </div>
          </div>
          <div className="divide-y divide-slate-200">
            {courseActionError ? (
              <div className="border-b border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                {courseActionError}
              </div>
            ) : null}
            {filteredCourses.map((course) => (
              <div key={course.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                <CourseCoverImage course={course} className="h-24 w-full rounded-lg object-cover sm:w-32" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-950">{course.title}</p>
                    <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                      {courseStatusLabel[course.status]}
                    </span>
                    {course.isPopular ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                        <Star size={12} className="fill-amber-400 text-amber-400" />
                        ยอดนิยม
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {course.category} · {course.lessonCount ?? course.lessons.length} บทเรียน ·{' '}
                    {course.students.toLocaleString('th-TH')} ผู้เรียน
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {course.status !== 'published' ? (
                    <button
                      type="button"
                      className="btn-primary w-fit px-3 py-2"
                      onClick={() => updateCourseStatus(course, 'published')}
                      disabled={statusUpdatingSlug === course.slug}
                    >
                      {statusUpdatingSlug === course.slug ? <LoaderCircle size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
                      อนุมัติเผยแพร่
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-secondary w-fit px-3 py-2"
                      onClick={() => updateCourseStatus(course, 'hidden')}
                      disabled={statusUpdatingSlug === course.slug}
                    >
                      {statusUpdatingSlug === course.slug ? <LoaderCircle size={15} className="animate-spin" /> : <Eye size={15} />}
                      ซ่อนคอร์ส
                    </button>
                  )}
                  <button
                    type="button"
                    className={course.isPopular ? 'btn-primary w-fit px-3 py-2' : 'btn-secondary w-fit px-3 py-2'}
                    onClick={() => togglePopular(course)}
                    disabled={popularUpdatingSlug === course.slug}
                  >
                    {popularUpdatingSlug === course.slug ? (
                      <LoaderCircle size={15} className="animate-spin" />
                    ) : (
                      <Star size={15} className={course.isPopular ? 'fill-white text-white' : ''} />
                    )}
                    {course.isPopular ? 'ถอดยอดนิยม' : 'ตั้งยอดนิยม'}
                  </button>
                  <button type="button" className="btn-secondary w-fit" onClick={() => setSelectedCourse(course)}>
                    <Eye size={15} />
                    ตรวจสอบ
                  </button>
                  <button type="button" className="btn-secondary w-fit text-rose-700" onClick={() => setDeleteTarget(course)}>
                    <Trash2 size={15} />
                    ลบ
                  </button>
                </div>
              </div>
            ))}
            {filteredCourses.length === 0 ? (
              <div className="p-8 text-center">
                <h3 className="text-lg font-semibold text-slate-950">ไม่พบคอร์สที่ตรงกับตัวกรอง</h3>
                <p className="mt-2 text-sm text-slate-500">ลองเปลี่ยนคำค้นหาหรือสถานะคอร์ส</p>
              </div>
            ) : null}
          </div>
          </section>
        </div>

        {selectedCourse ? (
          <CourseInspectionModal course={selectedCourse} onClose={() => setSelectedCourse(null)} />
        ) : null}

        {deleteTarget ? (
          <DeleteCourseModal
            course={deleteTarget}
            deleting={deletingSlug === deleteTarget.slug}
            onCancel={() => setDeleteTarget(null)}
            onConfirm={deleteCourse}
          />
        ) : null}
      </>
    )
  }

  return (
    <div className="space-y-6">
      <section className="card p-5 sm:p-6">
        <p className="text-sm text-slate-500">Admin Console</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-950">แดชบอร์ดระบบ</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          หน้านี้ใช้ดูสุขภาพรวมของระบบ ส่วนการตรวจสอบละเอียดแยกไปที่จัดการผู้ใช้และจัดการคอร์ส
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map((stat) => {
          const Icon = stat.icon

          return (
            <div key={stat.label} className="stat-card">
              <Icon size={20} className="text-slate-500" />
              <p className="mt-4 text-3xl font-semibold text-slate-950">{stat.value}</p>
              <p className="mt-1 text-sm text-slate-500">{stat.label}</p>
            </div>
          )
        })}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="text-lg font-semibold text-slate-950">สถานะผู้ใช้</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <InfoTile label="กำลังใช้งาน" value={`${onlineUsers.length} คน`} tone="success" />
            <InfoTile label="ไม่ได้ใช้งาน" value={`${offlineUsers.length} คน`} tone="danger" />
          </div>
        </div>
        <div className="card p-5">
          <h2 className="text-lg font-semibold text-slate-950">สถานะคอร์ส</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <InfoTile label="เผยแพร่แล้ว" value={`${publishedCourses.length} คอร์ส`} />
            <InfoTile label="ฉบับร่าง" value={`${draftCourses.length} คอร์ส`} />
            <InfoTile label="Landing" value={`${popularCourses.length} คอร์สยอดนิยม`} />
          </div>
        </div>
      </section>
    </div>
  )
}

function ModalShell({
  title,
  eyebrow,
  onClose,
  children,
}: {
  title: string
  eyebrow: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6">
      <div className="w-full max-w-3xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl shadow-slate-950/30">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-950 p-5 text-white">
          <div>
            <p className="text-sm text-slate-300">{eyebrow}</p>
            <h2 className="mt-1 text-xl font-semibold">{title}</h2>
          </div>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-300 transition hover:bg-white/10 hover:text-white"
            onClick={onClose}
            aria-label="ปิด popup"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5 sm:p-6">{children}</div>
      </div>
    </div>
  )
}

function UserInspectionModal({
  user,
  formatDate,
  onClose,
}: {
  user: User
  formatDate: (value?: string | null) => string
  onClose: () => void
}) {
  return (
    <ModalShell title={user.name} eyebrow="User Inspection" onClose={onClose}>
      <div className="grid gap-4 md:grid-cols-2">
        <InfoTile label="อีเมล" value={user.email} />
        <InfoTile label="Role" value={user.role} />
        <InfoTile label="สถานะ" value={user.isOnline ? 'กำลังใช้งาน' : 'ไม่ได้ใช้งาน'} tone={user.isOnline ? 'success' : 'danger'} />
        <InfoTile label="Session" value={`${user.activeSessions ?? 0}`} />
        <InfoTile label="ใช้งานล่าสุด" value={formatDate(user.lastSeenAt)} />
      </div>
    </ModalShell>
  )
}

function CourseInspectionModal({ course, onClose }: { course: Course; onClose: () => void }) {
  return (
    <ModalShell title={course.title} eyebrow="Course Inspection" onClose={onClose}>
      <div className="grid gap-5 md:grid-cols-[240px_minmax(0,1fr)]">
        <CourseCoverImage course={course} className="aspect-video w-full rounded-lg object-cover" />
        <div className="grid gap-4 sm:grid-cols-2">
          <InfoTile label="ผู้สอน" value={course.instructor.name} />
          <InfoTile label="สถานะ" value={courseStatusLabel[course.status]} />
          <InfoTile label="Landing" value={course.isPopular ? 'คอร์สยอดนิยม' : 'ไม่แสดง'} />
          <InfoTile label="บทเรียน" value={`${course.lessonCount ?? course.lessons.length}`} />
          <InfoTile label="ผู้เรียน" value={course.students.toLocaleString('th-TH')} />
          <InfoTile label="หมวดหมู่" value={course.category} />
        </div>
      </div>
    </ModalShell>
  )
}

function CourseCoverImage({ course, className }: { course: Course; className: string }) {
  const [src, setSrc] = useState(course.coverImage || fallbackCourseCover)

  useEffect(() => {
    setSrc(course.coverImage || fallbackCourseCover)
  }, [course.coverImage])

  return (
    <img
      src={src}
      alt={course.title}
      className={className}
      loading="lazy"
      onError={() => {
        if (src !== fallbackCourseCover) setSrc(fallbackCourseCover)
      }}
    />
  )
}

function DeleteCourseModal({
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
    <ModalShell title="ลบคอร์สนี้ใช่ไหม" eyebrow="Confirm Delete" onClose={onCancel}>
      <div className="flex items-start gap-4">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-rose-50 text-rose-700">
          <AlertTriangle size={20} />
        </span>
        <div>
          <p className="text-sm leading-6 text-slate-600">
            คอร์ส <span className="font-semibold text-slate-950">{course.title}</span> จะถูกลบออกจากระบบ
            รวมถึงข้อมูลบทเรียนที่ผูกกับคอร์สนี้
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button type="button" className="btn-secondary" onClick={onCancel} disabled={deleting}>
              ยกเลิก
            </button>
            <button type="button" className="btn-primary bg-rose-700 hover:bg-rose-800" onClick={onConfirm} disabled={deleting}>
              {deleting ? <LoaderCircle size={16} className="animate-spin" /> : <Trash2 size={16} />}
              {deleting ? 'กำลังลบ...' : 'ยืนยันการลบ'}
            </button>
          </div>
        </div>
      </div>
    </ModalShell>
  )
}

function InfoTile({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: 'default' | 'success' | 'danger'
}) {
  const valueClass =
    tone === 'success' ? 'text-emerald-700' : tone === 'danger' ? 'text-rose-700' : 'text-slate-950'

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-medium uppercase text-slate-400">{label}</p>
      <p className={`mt-2 font-semibold ${valueClass}`}>{value}</p>
    </div>
  )
}
