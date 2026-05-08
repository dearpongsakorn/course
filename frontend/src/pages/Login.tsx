import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LogIn } from 'lucide-react'
import { api, authStorage } from '../services/api'

export default function Login() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)

    setError(null)
    setLoading(true)

    try {
      const session = await api.login({
        email: String(formData.get('email')),
        password: String(formData.get('password')),
      })
      authStorage.setSession(session)
      navigate(session.dashboardPath)
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : 'เข้าสู่ระบบไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="container-page flex min-h-[calc(100vh-8rem)] items-center justify-center py-10">
      <div className="card w-full max-w-md p-6 sm:p-8">
        <div className="mb-6">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-slate-950 text-white">
            <LogIn size={20} />
          </span>
          <h1 className="mt-4 text-2xl font-semibold text-slate-950">เข้าสู่ระบบ</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            เข้าสู่ระบบด้วยบัญชีที่สมัครไว้ ระบบจะพาไปยังแดชบอร์ดตาม role ของบัญชีโดยอัตโนมัติ
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="field-label">อีเมล</span>
            <input
              name="email"
              className="field-input"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>
          <label className="block">
            <span className="field-label">รหัสผ่าน</span>
            <input
              name="password"
              className="field-input"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </label>
          {error && <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          ยังไม่มีบัญชี?{' '}
          <Link to="/register" className="font-medium text-slate-950 hover:underline">
            สมัครสมาชิก
          </Link>
        </p>
      </div>
    </section>
  )
}
