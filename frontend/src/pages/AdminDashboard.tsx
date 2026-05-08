import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Activity, BookOpen, Eye, GraduationCap, ShieldCheck, Users } from 'lucide-react'
import { useApi } from '../hooks/useApi'
import { api } from '../services/api'
import type { Course } from '../types/course'
import type { User } from '../types/user'

type AdminSection = 'overview' | 'users' | 'courses'

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

  const onlineUsers = data.users.filter((user) => user.isOnline)
  const offlineUsers = data.users.filter((user) => !user.isOnline)
  const publishedCourses = data.courses.filter((course) => course.status === 'published')
  const draftCourses = data.courses.filter((course) => course.status === 'draft')

  const formatDate = (value?: string | null) =>
    value
      ? new Intl.DateTimeFormat('th-TH', {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(new Date(value))
      : '-'

  if (activeSection === 'users') {
    return (
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
            <h2 className="text-lg font-semibold text-slate-950">รายชื่อผู้ใช้</h2>
            <p className="mt-1 text-sm text-slate-500">สีเขียวคือกำลังใช้งาน สีแดงคือไม่ได้ใช้งานระบบ</p>
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
                {data.users.map((user) => (
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
          </div>
        </section>

        {selectedUser ? (
          <section className="card p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <p className="text-sm text-slate-500">User Inspection</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-950">{selectedUser.name}</h2>
              </div>
              <button type="button" className="btn-secondary px-3 py-2" onClick={() => setSelectedUser(null)}>
                ปิด
              </button>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <InfoTile label="อีเมล" value={selectedUser.email} />
              <InfoTile label="Role" value={selectedUser.role} />
              <InfoTile label="Session" value={`${selectedUser.activeSessions ?? 0}`} />
              <InfoTile label="ใช้งานล่าสุด" value={formatDate(selectedUser.lastSeenAt)} />
            </div>
          </section>
        ) : null}
      </div>
    )
  }

  if (activeSection === 'courses') {
    return (
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
            <h2 className="text-lg font-semibold text-slate-950">รายการคอร์ส</h2>
            <p className="mt-1 text-sm text-slate-500">ข้อมูลจากตาราง courses และ lessons</p>
          </div>
          <div className="divide-y divide-slate-200">
            {data.courses.map((course) => (
              <div key={course.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                <img src={course.coverImage} alt={course.title} className="h-24 w-full rounded-lg object-cover sm:w-32" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-950">{course.title}</p>
                    <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                      {courseStatusLabel[course.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {course.category} · {course.lessonCount ?? course.lessons.length} บทเรียน ·{' '}
                    {course.students.toLocaleString('th-TH')} ผู้เรียน
                  </p>
                </div>
                <button type="button" className="btn-secondary w-fit" onClick={() => setSelectedCourse(course)}>
                  <Eye size={15} />
                  ตรวจสอบ
                </button>
              </div>
            ))}
          </div>
        </section>

        {selectedCourse ? (
          <section className="card p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <p className="text-sm text-slate-500">Course Inspection</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-950">{selectedCourse.title}</h2>
              </div>
              <button type="button" className="btn-secondary px-3 py-2" onClick={() => setSelectedCourse(null)}>
                ปิด
              </button>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
              <img src={selectedCourse.coverImage} alt={selectedCourse.title} className="aspect-video w-full rounded-lg object-cover" />
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <InfoTile label="ผู้สอน" value={selectedCourse.instructor.name} />
                <InfoTile label="สถานะ" value={courseStatusLabel[selectedCourse.status]} />
                <InfoTile label="บทเรียน" value={`${selectedCourse.lessonCount ?? selectedCourse.lessons.length}`} />
                <InfoTile label="ผู้เรียน" value={selectedCourse.students.toLocaleString('th-TH')} />
              </div>
            </div>
          </section>
        ) : null}
      </div>
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
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <InfoTile label="เผยแพร่แล้ว" value={`${publishedCourses.length} คอร์ส`} />
            <InfoTile label="ฉบับร่าง" value={`${draftCourses.length} คอร์ส`} />
          </div>
        </div>
      </section>
    </div>
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
