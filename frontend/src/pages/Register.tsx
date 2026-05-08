import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import { api, authStorage } from '../services/api'
import type { UserRole } from '../types/user'

const roles: Array<Extract<UserRole, 'student' | 'teacher'>> = ['student', 'teacher']

export default function Register() {
  const navigate = useNavigate()
  const [role, setRole] = useState<Extract<UserRole, 'student' | 'teacher'>>('student')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const password = String(formData.get('password'))
    const confirmPassword = String(formData.get('confirmPassword'))

    if (password !== confirmPassword) {
      setError('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน')
      return
    }

    setError(null)
    setLoading(true)

    try {
      const session = await api.register({
        name: String(formData.get('name')),
        email: String(formData.get('email')),
        password,
        role,
        title: role === 'teacher' ? String(formData.get('title')) : undefined,
      })
      authStorage.setSession(session)
      navigate(session.dashboardPath)
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : 'สมัครสมาชิกไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="container-page flex min-h-[calc(100vh-8rem)] items-center justify-center py-10">
      <div className="card w-full max-w-lg p-6 sm:p-8">
        <div className="mb-6">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-slate-950 text-white">
            <UserPlus size={20} />
          </span>
          <h1 className="mt-4 text-2xl font-semibold text-slate-950">สมัครสมาชิก</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            สร้างบัญชีใหม่เพื่อเริ่มใช้งานระบบจริง ข้อมูลจะถูกบันทึกลงฐานข้อมูลโดยตรง
          </p>
        </div>

        <div className="mb-5 grid grid-cols-2 rounded-lg bg-slate-100 p-1">
          {roles.map((item) => (
            <button
              key={item}
              type="button"
              className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                role === item ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'
              }`}
              onClick={() => setRole(item)}
            >
              {item === 'student' ? 'นักเรียน' : 'คุณครู'}
            </button>
          ))}
        </div>

        <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
          <label className="block sm:col-span-2">
            <span className="field-label">ชื่อผู้ใช้</span>
            <input name="name" className="field-input" placeholder="ชื่อ-นามสกุล" autoComplete="name" required />
          </label>
          <label className="block sm:col-span-2">
            <span className="field-label">อีเมล</span>
            <input name="email" className="field-input" type="email" placeholder="you@example.com" autoComplete="email" required />
          </label>
          <label className="block">
            <span className="field-label">รหัสผ่าน</span>
            <input name="password" className="field-input" type="password" placeholder="อย่างน้อย 8 ตัวอักษร" autoComplete="new-password" required minLength={8} />
          </label>
          <label className="block">
            <span className="field-label">ยืนยันรหัสผ่าน</span>
            <input name="confirmPassword" className="field-input" type="password" placeholder="••••••••" autoComplete="new-password" required minLength={8} />
          </label>
          {role === 'teacher' && (
            <label className="block sm:col-span-2">
              <span className="field-label">ความเชี่ยวชาญ</span>
              <input name="title" className="field-input" placeholder="เช่น Frontend, Design, Marketing" />
            </label>
          )}
          {error && <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700 sm:col-span-2">{error}</p>}
          <button type="submit" className="btn-primary sm:col-span-2" disabled={loading}>
            {loading ? 'กำลังสร้างบัญชี...' : 'สร้างบัญชี'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          มีบัญชีอยู่แล้ว?{' '}
          <Link to="/login" className="font-medium text-slate-950 hover:underline">
            เข้าสู่ระบบ
          </Link>
        </p>
      </div>
    </section>
  )
}
