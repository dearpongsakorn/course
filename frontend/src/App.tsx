import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import DashboardLayout from './layouts/DashboardLayout'
import MainLayout from './layouts/MainLayout'
import AdminDashboard from './pages/AdminDashboard'
import CourseDetail from './pages/CourseDetail'
import Courses from './pages/Courses'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import StudentDashboard from './pages/StudentDashboard'
import TeacherDashboard from './pages/TeacherDashboard'
import VideoLearning from './pages/VideoLearning'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route index element={<Home />} />
          <Route path="courses" element={<Courses />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="courses/:slug" element={<CourseDetail />} />
          <Route path="learn/:slug" element={<VideoLearning />} />
        </Route>

        <Route element={<DashboardLayout role="student" />}>
          <Route path="student" element={<StudentDashboard />} />
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
