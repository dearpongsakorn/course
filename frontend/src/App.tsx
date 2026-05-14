import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import DashboardLayout from './layouts/DashboardLayout'
import MainLayout from './layouts/MainLayout'
import AdminDashboard from './pages/AdminDashboard'
import Checkout from './pages/Checkout'
import Contact from './pages/Contact'
import CourseDetail from './pages/CourseDetail'
import Courses from './pages/Courses'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import StudentCertificates from './pages/StudentCertificates'
import StudentCourseStore from './pages/StudentCourseStore'
import StudentDashboard from './pages/StudentDashboard'
import StudentWishlist from './pages/StudentWishlist'
import TeacherDashboard from './pages/TeacherDashboard'
import VideoLearning from './pages/VideoLearning'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route index element={<Home />} />
          <Route path="courses" element={<Courses />} />
          <Route path="contact" element={<Contact />} />
          <Route path="cart" element={<Navigate to="/courses?cart=1" replace />} />
          <Route path="checkout/:slug" element={<Checkout />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="courses/:slug" element={<CourseDetail />} />
          <Route path="learn/:slug" element={<VideoLearning />} />
        </Route>

        <Route element={<DashboardLayout role="student" />}>
          <Route path="student" element={<StudentDashboard />} />
          <Route path="student/store" element={<StudentCourseStore />} />
          <Route path="student/certificates" element={<StudentCertificates />} />
          <Route path="student/wishlist" element={<StudentWishlist />} />
        </Route>

        <Route element={<DashboardLayout role="teacher" />}>
          <Route path="teacher" element={<TeacherDashboard />} />
        </Route>

        <Route element={<DashboardLayout role="admin" />}>
          <Route path="admin" element={<AdminDashboard />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
