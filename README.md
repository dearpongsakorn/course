# MyCourse Platform

เว็บแอประบบคอร์สออนไลน์ที่แยกโครงสร้างเป็น frontend และ backend ชัดเจน พร้อม Docker สำหรับรันทั้งระบบ

## Project Structure

```txt
mycourse/
  frontend/        React + TypeScript + Vite + Tailwind CSS
  backend/         Node.js mock API
  docker-compose.yml
  package.json     root scripts สำหรับ dev/build/docker
```

## Local Development

```bash
npm run frontend:dev
npm run backend:dev
```

Frontend dev server จะรันด้วย Vite และ backend API จะรันที่ `http://localhost:4000`

## Docker

```bash
npm run docker:build
npm run docker:up
```

หลังรัน Docker แล้วเปิดเว็บที่ `http://localhost:8080`

Docker Compose จะรัน 3 services:

- `frontend`: React build เสิร์ฟด้วย Nginx
- `backend`: Node.js API
- `postgres`: PostgreSQL ฐานข้อมูลจริง พร้อม seed จาก `backend/db/init.sql`

ถ้าปรับ schema หรือ seed ใน `backend/db/init.sql` แล้วต้องการสร้างฐานข้อมูลใหม่ทั้งหมด ให้รัน:

```bash
docker compose down -v
docker compose up -d --build
```

API หลัก:

- `GET /api/health`
- `GET /api/courses`
- `GET /api/courses/:slug`
- `GET /api/users`
- `GET /api/student/dashboard`
- `GET /api/teacher/dashboard`
- `GET /api/admin/dashboard`
- `POST /api/courses`

## AI API

Local AI has been removed from the runtime. The backend keeps the AI endpoints ready for an external provider such as Gemini API.

AI endpoints:

- `POST /api/ai/lessons/:lessonId/transcript`
- `POST /api/ai/lessons/:lessonId/summarize`
- `POST /api/ai/lessons/:lessonId/ask`
- `POST /api/ai/lessons/:lessonId/quiz`

Configure `AI_PROVIDER`, `AI_MODEL`, and provider API keys before using Summary, Ask AI, and Quiz features.

## Frontend Routes

- `/`
- `/login`
- `/register`
- `/student`
- `/teacher`
- `/admin`
- `/courses/:slug`
- `/learn/:slug`
