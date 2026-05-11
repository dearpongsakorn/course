import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertCircle, Eye, EyeOff, GraduationCap, UserPlus, UsersRound } from 'lucide-react'
import { api, authStorage } from '../services/api'
import type { UserRole } from '../types/user'

const roles: Array<{
  value: Extract<UserRole, 'student' | 'teacher'>
  label: string
  description: string
  icon: typeof GraduationCap
}> = [
  {
    value: 'student',
    label: 'นักเรียน',
    description: 'เรียนคอร์สและติดตามความคืบหน้า',
    icon: GraduationCap,
  },
  {
    value: 'teacher',
    label: 'คุณครู',
    description: 'สร้างคอร์สและจัดการบทเรียน',
    icon: UsersRound,
  },
]

export default function Register() {
  const navigate = useNavigate()
  const [role, setRole] = useState<Extract<UserRole, 'student' | 'teacher'>>('student')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

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
      <div className="card w-full max-w-xl overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-950 p-6 text-white dark:border-white/10 dark:bg-white dark:text-slate-950 sm:p-8">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-white text-slate-950 dark:bg-slate-950 dark:text-white">
            <UserPlus size={20} />
          </span>
          <h1 className="mt-4 text-2xl font-semibold">สมัครสมาชิก</h1>
          <p className="mt-2 text-sm leading-6 text-slate-300 dark:text-slate-600">
            สร้างบัญชีใหม่แล้วเข้าสู่ dashboard ตามบทบาทที่เลือกโดยอัตโนมัติ
          </p>
        </div>

        <div className="p-6 sm:p-8">
          <div className="mb-5">
            <span className="field-label">เลือกประเภทบัญชี</span>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {roles.map((item) => {
                const Icon = item.icon
                const active = role === item.value

                return (
                  <button
                    key={item.value}
                    type="button"
                    className={`rounded-lg border p-4 text-left transition ${
                      active
                        ? 'border-slate-950 bg-slate-950 text-white shadow-md shadow-slate-300/50 dark:border-white dark:bg-white dark:text-slate-950 dark:shadow-black/30'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-950 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-white dark:hover:bg-white/10'
                    }`}
                    onClick={() => setRole(item.value)}
                  >
                    <div className="flex items-start gap-3">
                      <Icon size={20} />
                      <div>
                        <p className="text-sm font-semibold">{item.label}</p>
                        <p className={`mt-1 text-xs leading-5 ${active ? 'text-slate-300 dark:text-slate-600' : 'text-slate-500'}`}>
                          {item.description}
                        </p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
            <label className="block sm:col-span-2">
              <span className="field-label">ชื่อผู้ใช้</span>
              <input name="name" className="field-input" autoComplete="name" required />
            </label>

            <label className="block sm:col-span-2">
              <span className="field-label">อีเมล</span>
              <input name="email" className="field-input" type="email" autoComplete="email" required />
            </label>

            <label className="block">
              <span className="field-label">รหัสผ่าน</span>
              <div className="relative mt-2">
                <input
                  name="password"
                  className="field-input mt-0 pr-11"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 dark:hover:bg-white/10 dark:hover:text-white"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>

            <label className="block">
              <span className="field-label">ยืนยันรหัสผ่าน</span>
              <div className="relative mt-2">
                <input
                  name="confirmPassword"
                  className="field-input mt-0 pr-11"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 dark:hover:bg-white/10 dark:hover:text-white"
                  onClick={() => setShowConfirmPassword((current) => !current)}
                  aria-label={showConfirmPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                >
                  {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>

            {role === 'teacher' ? (
              <label className="block sm:col-span-2">
                <span className="field-label">ความเชี่ยวชาญ</span>
                <input name="title" className="field-input" />
              </label>
            ) : null}

            <p className="rounded-md bg-slate-50 p-3 text-xs leading-5 text-slate-500 dark:bg-white/5 dark:text-slate-400 sm:col-span-2">
              รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร
            </p>

            {error ? (
              <div className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm leading-6 text-rose-700 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-300 sm:col-span-2">
                <AlertCircle size={17} className="mt-0.5 shrink-0" />
                {error}
              </div>
            ) : null}

            <button type="submit" className="btn-primary py-3 sm:col-span-2" disabled={loading}>
              {loading ? 'กำลังสร้างบัญชี...' : 'สร้างบัญชี'}
              <UserPlus size={16} />
            </button>
          </form>
        </div>

        <p className="border-t border-slate-200 px-6 py-5 text-center text-sm text-slate-500 dark:border-white/10 sm:px-8">
          มีบัญชีอยู่แล้ว?{' '}
          <Link to="/login" className="font-semibold text-slate-950 hover:underline dark:text-white">
            เข้าสู่ระบบ
          </Link>
        </p>
      </div>
    </section>
  )
}
