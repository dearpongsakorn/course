import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BookOpenCheck, Camera, Clock3, Trophy, UserRound } from 'lucide-react'
import CourseCard from '../components/CourseCard'
import { useApi } from '../hooks/useApi'
import { api, authStorage, type StudentProfile } from '../services/api'

type ProfileDraft = Pick<StudentProfile, 'name' | 'avatarUrl'>

const emptyProfile: ProfileDraft = {
  name: '',
  avatarUrl: '',
}

export default function StudentDashboard() {
  const [searchParams] = useSearchParams()
  const activeSection = searchParams.get('section') === 'profile' ? 'profile' : 'courses'
  const { data, error, loading } = useApi(() => api.getStudentDashboard(), [])
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [draft, setDraft] = useState<ProfileDraft>(emptyProfile)
  const [draftReadyForUserId, setDraftReadyForUserId] = useState<string | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [savingProfile, setSavingProfile] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  if (loading) return <div className="card p-6 text-sm text-slate-500">กำลังโหลดข้อมูลผู้เรียนจากฐานข้อมูล...</div>
  if (error) return <div className="card p-6 text-sm text-rose-600">{error}</div>
  if (!data) return null

  const currentProfile = profile ?? data.profile
  const displayName = currentProfile.name || data.user.name
  const avatarUrl = currentProfile.avatarUrl || data.user.avatarUrl || ''

  if (draftReadyForUserId !== data.user.id) {
    setDraft({
      name: displayName,
      avatarUrl,
    })
    setDraftReadyForUserId(data.user.id)
  }

  const handleAvatarChange = async (file: File | undefined) => {
    if (!file) return

    setUploadingAvatar(true)
    setProfileError(null)

    try {
      const uploaded = await api.uploadAsset({ kind: 'avatar', file })
      setDraft((current) => ({ ...current, avatarUrl: uploaded.fileUrl }))
    } catch (currentError) {
      setProfileError(currentError instanceof Error ? currentError.message : 'อัปโหลดรูปโปรไฟล์ไม่สำเร็จ')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const saveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSavingProfile(true)
    setProfileError(null)

    try {
      const nextProfile = await api.updateStudentProfile({
        name: draft.name,
        avatarUrl: draft.avatarUrl,
        headline: '',
        bio: '',
        learningGoal: '',
        phone: '',
      })
      setProfile(nextProfile)

      const session = authStorage.getSession()
      if (session) {
        authStorage.setSession({
          ...session,
          user: {
            ...session.user,
            name: nextProfile.name || draft.name,
            avatarUrl: nextProfile.avatarUrl || undefined,
          },
        })
      }
    } catch (currentError) {
      setProfileError(currentError instanceof Error ? currentError.message : 'บันทึกโปรไฟล์ไม่สำเร็จ')
    } finally {
      setSavingProfile(false)
    }
  }

  if (activeSection === 'profile') {
    return (
      <div className="space-y-6">
        <section className="card p-5 sm:p-6">
          <h1 className="text-2xl font-semibold text-slate-950">โปรไฟล์ผู้เรียน</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            เปลี่ยนชื่อและรูปโปรไฟล์ที่ใช้แสดงในระบบ
          </p>
        </section>

        <section className="card overflow-hidden">
          <form className="grid gap-0 lg:grid-cols-[280px_minmax(0,1fr)]" onSubmit={saveProfile}>
            <div className="border-b border-slate-200 bg-slate-50 p-5 lg:border-b-0 lg:border-r">
              <div className="flex flex-col items-start gap-4">
                {draft.avatarUrl ? (
                  <img src={draft.avatarUrl} alt="รูปโปรไฟล์" className="h-32 w-32 rounded-lg object-cover" />
                ) : (
                  <span className="inline-flex h-32 w-32 items-center justify-center rounded-lg bg-slate-950 text-white">
                    <UserRound size={40} />
                  </span>
                )}

                <div>
                  <p className="text-sm font-semibold text-slate-950">รูปโปรไฟล์</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">รองรับ JPG, PNG, WEBP ไม่เกิน 5MB</p>
                  <label className="btn-secondary mt-3 inline-flex cursor-pointer px-3 py-2">
                    <Camera size={16} />
                    {uploadingAvatar ? 'กำลังอัปโหลด...' : 'อัปโหลดรูป'}
                    <input
                      type="file"
                      className="hidden"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={uploadingAvatar}
                      onChange={(event) => handleAvatarChange(event.target.files?.[0])}
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="space-y-4 p-5">
              <label className="block">
                <span className="field-label">ชื่อที่แสดง</span>
                <input
                  className="field-input"
                  value={draft.name}
                  onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                  placeholder="ชื่อ-นามสกุล"
                  required
                />
              </label>

              {profileError ? <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{profileError}</p> : null}

              <div className="flex justify-end border-t border-slate-200 pt-4">
                <button type="submit" className="btn-primary" disabled={savingProfile || uploadingAvatar}>
                  {savingProfile ? 'กำลังบันทึก...' : 'บันทึกโปรไฟล์'}
                </button>
              </div>
            </div>
          </form>
        </section>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="card overflow-hidden p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          {avatarUrl ? (
            <img src={avatarUrl} alt={displayName} className="h-24 w-24 rounded-lg object-cover" />
          ) : (
            <span className="inline-flex h-24 w-24 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-white">
              <UserRound size={36} />
            </span>
          )}
          <div>
            <p className="text-sm text-slate-500">ยินดีต้อนรับกลับ</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-950">{displayName}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              ติดตามคอร์ส หมวดหมู่ และความคืบหน้าการเรียนจากข้อมูลจริงในระบบ
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { label: 'คอร์สที่สมัคร', value: data.stats.enrolledCourses, icon: BookOpenCheck },
          { label: 'Progress เฉลี่ย', value: `${data.stats.averageProgress}%`, icon: Trophy },
          { label: 'บทเรียนที่ทำแล้ว', value: `${data.stats.completedLessons} บท`, icon: Clock3 },
        ].map((stat) => {
          const Icon = stat.icon

          return (
            <div key={stat.label} className="stat-card">
              <Icon size={20} className="text-slate-500" />
              <p className="mt-4 text-2xl font-semibold text-slate-950">{stat.value}</p>
              <p className="mt-1 text-sm text-slate-500">{stat.label}</p>
            </div>
          )
        })}
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-slate-950">หมวดหมู่คอร์สของฉัน</h2>
          <p className="mt-1 text-sm text-slate-500">ดูคอร์สที่สมัครไว้ แยกตามหมวดหมู่และความคืบหน้า</p>
        </div>
        <div className="grid gap-5 xl:grid-cols-2">
          {data.courses.map((item) => (
            <CourseCard
              key={item.course.id}
              course={item.course}
              progress={item.enrollment.progress}
              ctaLabel="เรียนต่อ"
              ctaTo={`/learn/${item.course.slug}`}
              showDescription={false}
            />
          ))}
        </div>
      </section>
    </div>
  )
}
