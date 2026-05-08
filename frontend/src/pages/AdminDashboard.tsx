import { BookOpen, GraduationCap, ShieldCheck, Users } from 'lucide-react'
import { useApi } from '../hooks/useApi'
import { api } from '../services/api'

export default function AdminDashboard() {
  const { data, error, loading } = useApi(() => api.getAdminDashboard(), [])

  if (loading) return <div className="card p-6 text-sm text-slate-500">กำลังโหลดภาพรวมระบบจากฐานข้อมูล...</div>
  if (error) return <div className="card p-6 text-sm text-rose-600">{error}</div>
  if (!data) return null

  const stats = [
    { label: 'ผู้ใช้ทั้งหมด', value: data.stats.totalUsers, icon: Users },
    { label: 'จำนวนคอร์ส', value: data.stats.totalCourses, icon: BookOpen },
    { label: 'จำนวนครู', value: data.stats.totalTeachers, icon: ShieldCheck },
    { label: 'จำนวนผู้เรียน', value: data.stats.totalStudents, icon: GraduationCap },
  ]

  return (
    <div className="space-y-6">
      <section className="card p-5 sm:p-6">
        <p className="text-sm text-slate-500">Admin Dashboard</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-950">ภาพรวมระบบคอร์สออนไลน์</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          จำนวนผู้ใช้ คอร์ส ครู และผู้เรียนถูกคำนวณจากตารางใน PostgreSQL
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-lg font-semibold text-slate-950">จัดการผู้ใช้</h2>
            <p className="mt-1 text-sm text-slate-500">รายการจากตาราง users</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="table-cell">ผู้ใช้</th>
                  <th className="table-cell">Role</th>
                  <th className="table-cell">สถานะ</th>
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
                      <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {user.status}
                      </span>
                    </td>
                    <td className="table-cell">
                      <button type="button" className="btn-secondary px-3 py-2">
                        จัดการ
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-lg font-semibold text-slate-950">จัดการคอร์ส</h2>
            <p className="mt-1 text-sm text-slate-500">รายการจากตาราง courses</p>
          </div>
          <div className="divide-y divide-slate-200">
            {data.courses.map((course) => (
              <div key={course.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                <img src={course.coverImage} alt={course.title} className="h-24 w-full rounded-lg object-cover sm:w-32" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-950">{course.title}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {course.category} · {course.lessonCount ?? course.lessons.length} บทเรียน ·{' '}
                    {course.students.toLocaleString('th-TH')} ผู้เรียน
                  </p>
                </div>
                <button type="button" className="btn-secondary w-fit">
                  ตรวจสอบ
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
