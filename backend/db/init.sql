CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
  avatar_url TEXT,
  title TEXT,
  bio TEXT,
  rating NUMERIC(3, 2) DEFAULT 0,
  total_students INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  teacher_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  cover_image TEXT NOT NULL,
  price INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL,
  level TEXT NOT NULL,
  duration TEXT NOT NULL,
  rating NUMERIC(3, 2) NOT NULL DEFAULT 0,
  students INTEGER NOT NULL DEFAULT 0,
  outcomes JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_popular BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'published',
  updated_at DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  duration TEXT NOT NULL,
  preview BOOLEAN NOT NULL DEFAULT false,
  video_url TEXT,
  summary TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS quiz_questions (
  id TEXT PRIMARY KEY,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  explanation TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS quiz_options (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS enrollments (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  completed_lessons INTEGER NOT NULL DEFAULT 0,
  last_lesson_id TEXT REFERENCES lessons(id),
  joined_at DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE (student_id, course_id)
);

CREATE TABLE IF NOT EXISTS user_passwords (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS lesson_transcripts (
  lesson_id TEXT PRIMARY KEY REFERENCES lessons(id) ON DELETE CASCADE,
  transcript TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_outputs (
  id TEXT PRIMARY KEY,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  output_type TEXT NOT NULL CHECK (output_type IN ('summary', 'quiz', 'answer')),
  prompt TEXT NOT NULL,
  result JSONB NOT NULL,
  model TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO users (id, name, email, role, avatar_url, title, bio, rating, total_students, status, created_at)
VALUES
  ('u-student-1', 'มินตรา แก้ว', 'mintra@example.com', 'student', 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80', NULL, NULL, 0, 0, 'active', '2026-01-08'),
  ('u-student-2', 'ธีรภัทร์ นิล', 'teerapat@example.com', 'student', NULL, NULL, NULL, 0, 0, 'active', '2026-02-14'),
  ('u-teacher-1', 'ณัฐพล อินทร', 'nattapol@example.com', 'teacher', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80', 'Senior Frontend Engineer', 'สอนการออกแบบ React architecture, component system และ workflow ที่ทีมโปรดักชันใช้งานจริง', 4.9, 12600, 'active', '2025-11-20'),
  ('u-teacher-2', 'กานต์พิชชา วงศ์', 'kanpitcha@example.com', 'teacher', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80', 'Product Designer', 'เชี่ยวชาญ dashboard UX, design tokens และการทำงานร่วมกันระหว่าง designer กับ engineer', 4.8, 7800, 'active', '2025-12-02'),
  ('u-teacher-3', 'ศุภชัย เลิศ', 'supachai@example.com', 'teacher', 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=300&q=80', 'Data Strategy Consultant', 'ช่วยองค์กรออกแบบ metric tree, KPI dashboard และ data narrative สำหรับผู้บริหาร', 4.7, 9200, 'active', '2025-12-12'),
  ('u-admin-1', 'Admin LearnOS', 'admin@example.com', 'admin', NULL, NULL, NULL, 0, 0, 'active', '2025-10-01')
ON CONFLICT (id) DO NOTHING;

INSERT INTO courses (id, slug, teacher_id, title, description, cover_image, price, category, level, duration, rating, students, outcomes, is_popular, status, updated_at)
VALUES
  (
    'course-react-ai',
    'react-ai-productivity',
    'u-teacher-1',
    'React + AI สำหรับเว็บแอปยุคใหม่',
    'เรียนรู้การสร้างเว็บแอประดับโปรดักชันด้วย React, TypeScript และ AI assistant workflows ตั้งแต่โครงสร้างโปรเจกต์จนถึงการ deploy',
    'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1200&q=80',
    2490,
    'Technology',
    'Intermediate',
    '8 ชม. 30 นาที',
    4.9,
    1840,
    '["วางโครงสร้าง React + TypeScript ให้ดูแลต่อได้ง่าย","เชื่อม AI feature เข้ากับ user workflow อย่างเป็นระบบ","ออกแบบ component ที่พร้อมต่อ backend และ auth จริง"]',
    true,
    'published',
    '2026-04-12'
  ),
  (
    'course-design-system',
    'clean-design-system',
    'u-teacher-2',
    'Design System สำหรับ SaaS Dashboard',
    'สร้างระบบดีไซน์ที่เรียบง่าย สม่ำเสมอ และนำไปใช้กับ dashboard, forms, tables และ navigation ได้จริง',
    'https://images.unsplash.com/photo-1545235617-9465d2a55698?auto=format&fit=crop&w=1200&q=80',
    1890,
    'Design',
    'Beginner',
    '6 ชม. 10 นาที',
    4.8,
    970,
    '["สร้าง token สำหรับสี ฟอนต์ spacing และ component state","ออกแบบฟอร์มและตารางให้อ่านง่ายบนทุกขนาดหน้าจอ","เตรียม guideline สำหรับทีม product"]',
    true,
    'published',
    '2026-03-28'
  ),
  (
    'course-data-story',
    'data-storytelling',
    'u-teacher-3',
    'Data Storytelling สำหรับทีมธุรกิจ',
    'เปลี่ยนตัวเลขให้เป็น insight ด้วย dashboard, narrative และ presentation ที่ช่วยให้ทีมตัดสินใจเร็วขึ้น',
    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80',
    1590,
    'Data',
    'Beginner',
    '5 ชม. 45 นาที',
    4.7,
    1320,
    '["เลือก metric ที่ตอบโจทย์ธุรกิจ","จัดลำดับ insight ก่อนทำ dashboard","นำเสนอข้อมูลด้วยเรื่องเล่าที่กระชับ"]',
    false,
    'published',
    '2026-02-15'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO lessons (id, course_id, title, duration, preview, video_url, summary, sort_order)
VALUES
  ('lesson-react-1', 'course-react-ai', 'วางสถาปัตยกรรมโปรเจกต์ React', '18:20', true, 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', 'บทนี้สรุปหลักคิดเรื่อง feature-based structure, shared components, routing และ data boundaries เพื่อให้แอปโตได้โดยไม่รก', 1),
  ('lesson-react-2', 'course-react-ai', 'จัดการ state และข้อมูลจาก API', '24:05', false, NULL, 'แยก type, API client และ page logic ให้ชัด เพื่อให้ย้ายไปใช้ server state library หรือ auth จริงได้ง่าย', 2),
  ('lesson-react-3', 'course-react-ai', 'ออกแบบ AI Summary, Ask AI และ Quiz', '31:40', false, NULL, 'ออกแบบ AI feature ให้แยก input, context, output และ review state เพื่อให้ผลลัพธ์ตรวจสอบได้', 3),
  ('lesson-design-1', 'course-design-system', 'พื้นฐาน dashboard UX ที่ใช้งานได้จริง', '20:12', true, 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', 'Dashboard ที่ดีต้องให้ผู้ใช้เห็นสถานะสำคัญเร็ว ทำงานซ้ำได้ง่าย และลดการตัดสินใจที่ไม่จำเป็น', 1),
  ('lesson-design-2', 'course-design-system', 'สร้าง component state และ pattern library', '26:45', false, NULL, 'กำหนด state เช่น default, hover, active, disabled และ error เพื่อให้ UI ทั้งระบบมีพฤติกรรมสม่ำเสมอ', 2),
  ('lesson-data-1', 'course-data-story', 'หา insight จาก metric ที่มีอยู่', '19:30', true, 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', 'เริ่มจากคำถามธุรกิจ เลือก metric ที่ตอบคำถาม แล้วเชื่อม metric เข้ากับ action ที่ทีมทำต่อได้', 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO quiz_questions (id, lesson_id, question, explanation, sort_order)
VALUES
  ('q-react-1', 'lesson-react-1', 'เหตุผลหลักของการแยก shared component คืออะไร', 'Shared components เหมาะกับ UI pattern ที่ใช้ซ้ำและควรมี behavior consistent ทั้งระบบ', 1),
  ('q-react-2', 'lesson-react-2', 'ข้อมูลจาก API ที่ดีควรมีลักษณะอย่างไร', 'เมื่อ shape ของข้อมูลใกล้ของจริง การต่อ API ภายหลังจะเปลี่ยนเฉพาะ data layer เป็นหลัก', 1),
  ('q-react-3', 'lesson-react-3', 'AI quiz ควรแสดงอะไรนอกจากตัวเลือก', 'เฉลยและเหตุผลช่วยให้ผู้เรียนเข้าใจจุดที่ผิด ไม่ใช่แค่รู้ว่าข้อไหนถูก', 1),
  ('q-design-1', 'lesson-design-1', 'องค์ประกอบใดสำคัญที่สุดใน dashboard เชิงปฏิบัติการ', 'ผู้ใช้ dashboard มักทำงานซ้ำและต้องตัดสินใจเร็ว จึงต้องเห็นข้อมูลและ action สำคัญชัดเจน', 1),
  ('q-design-2', 'lesson-design-2', 'ทำไม disabled state จึงควรถูกออกแบบแยกต่างหาก', 'disabled state ช่วยป้องกัน action ที่ยังไม่พร้อมและสื่อสถานะของระบบอย่างสุภาพ', 1),
  ('q-data-1', 'lesson-data-1', 'จุดเริ่มต้นของ data storytelling ควรเป็นอะไร', 'เรื่องเล่าจากข้อมูลควรเริ่มจากคำถามที่ต้องตัดสินใจ ไม่ใช่เริ่มจากกราฟ', 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO quiz_options (id, question_id, text, is_correct, sort_order)
VALUES
  ('q-react-1-a', 'q-react-1', 'ลดการซ้ำของ UI และควบคุมมาตรฐานการใช้งาน', true, 1),
  ('q-react-1-b', 'q-react-1', 'ทำให้ bundle ใหญ่ขึ้น', false, 2),
  ('q-react-1-c', 'q-react-1', 'บังคับให้ทุกหน้าใช้ state เดียวกัน', false, 3),
  ('q-react-1-d', 'q-react-1', 'แทนที่ backend ทั้งหมด', false, 4),
  ('q-react-2-a', 'q-react-2', 'เขียนรวมกับ CSS', false, 1),
  ('q-react-2-b', 'q-react-2', 'มี shape ใกล้เคียงข้อมูลจริงจาก backend', true, 2),
  ('q-react-2-c', 'q-react-2', 'ใช้ any ทั้งหมด', false, 3),
  ('q-react-2-d', 'q-react-2', 'เก็บเฉพาะข้อความสั้น ๆ', false, 4),
  ('q-react-3-a', 'q-react-3', 'เฉลยและเหตุผลประกอบ', true, 1),
  ('q-react-3-b', 'q-react-3', 'เฉพาะคะแนนรวม', false, 2),
  ('q-react-3-c', 'q-react-3', 'ราคาใหม่ของคอร์ส', false, 3),
  ('q-react-3-d', 'q-react-3', 'ข้อมูลผู้ใช้ทุกคน', false, 4),
  ('q-design-1-a', 'q-design-1', 'ข้อมูลที่สแกนง่ายและ action ชัดเจน', true, 1),
  ('q-design-1-b', 'q-design-1', 'ภาพตกแต่งขนาดใหญ่ทุกหน้า', false, 2),
  ('q-design-1-c', 'q-design-1', 'สีหลักเพียงสีเดียวทั้งระบบ', false, 3),
  ('q-design-1-d', 'q-design-1', 'ซ่อนเมนูทั้งหมดไว้เสมอ', false, 4),
  ('q-design-2-a', 'q-design-2', 'เพื่อสื่อว่าผู้ใช้ยังทำ action นั้นไม่ได้', true, 1),
  ('q-design-2-b', 'q-design-2', 'เพื่อทำให้ปุ่มใหญ่ขึ้น', false, 2),
  ('q-design-2-c', 'q-design-2', 'เพื่อซ่อนข้อมูลราคา', false, 3),
  ('q-design-2-d', 'q-design-2', 'เพื่อแทนที่ validation', false, 4),
  ('q-data-1-a', 'q-data-1', 'คำถามหรือการตัดสินใจทางธุรกิจ', true, 1),
  ('q-data-1-b', 'q-data-1', 'เลือกกราฟที่สีสวยที่สุด', false, 2),
  ('q-data-1-c', 'q-data-1', 'รวมทุกตารางไว้หน้าเดียว', false, 3),
  ('q-data-1-d', 'q-data-1', 'ซ่อนสมมติฐานทั้งหมด', false, 4)
ON CONFLICT (id) DO NOTHING;

INSERT INTO enrollments (id, student_id, course_id, progress, completed_lessons, last_lesson_id, joined_at)
VALUES
  ('enrollment-1', 'u-student-1', 'course-react-ai', 68, 2, 'lesson-react-3', '2026-04-18'),
  ('enrollment-2', 'u-student-1', 'course-design-system', 35, 1, 'lesson-design-2', '2026-04-22'),
  ('enrollment-3', 'u-student-1', 'course-data-story', 12, 0, 'lesson-data-1', '2026-05-01')
ON CONFLICT (id) DO NOTHING;
