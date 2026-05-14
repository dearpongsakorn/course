import { Outlet } from 'react-router-dom'
import { useLocation } from 'react-router-dom'
import Navbar from '../components/Navbar'

export default function MainLayout() {
  const location = useLocation()
  const isLearningPage = location.pathname.startsWith('/learn/')
  const isCoursesCatalog = location.pathname === '/courses'
  const isCoursePreviewPage = /^\/courses\/[^/]+$/.test(location.pathname)

  if (isLearningPage || isCoursesCatalog || isCoursePreviewPage) {
    return <Outlet />
  }

  return (
    <div className="app-shell">
      <Navbar />
      <main>
        <Outlet />
      </main>
      <footer className="border-t border-zinc-100 bg-zinc-50">
        <div className="container-page grid gap-10 py-12 text-sm text-zinc-500 md:grid-cols-[1.3fr_0.5fr_0.5fr_0.8fr_1fr]">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-[6px] bg-black text-white">
              ▮▮
            </span>
            <p>เรียนรู้วันนี้ เพื่ออนาคตที่ดีกว่าในวันพรุ่งนี้</p>
          </div>
          <div>
            <p className="font-bold text-black">Company</p>
            <div className="mt-4 space-y-2">
              <p>About</p>
              <p>Careers</p>
              <p>Blog</p>
            </div>
          </div>
          <div>
            <p className="font-bold text-black">Support</p>
            <div className="mt-4 space-y-2">
              <p>Help Center</p>
              <p>Contact Us</p>
              <p>Terms of Service</p>
            </div>
          </div>
          <div>
            <p className="font-bold text-black">Follow Us</p>
            <div className="mt-4 flex gap-4 text-black">
              <span className="font-bold">f</span>
              <span className="font-bold">𝕏</span>
              <span className="font-bold">◎</span>
              <span className="font-bold">▶</span>
            </div>
          </div>
          <p className="self-end md:text-right">© 2024 LearnPro. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
