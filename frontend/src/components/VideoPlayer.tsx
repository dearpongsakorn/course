import { useEffect, useState } from 'react'
import { AlertCircle, PlayCircle } from 'lucide-react'
import type { Lesson } from '../types/course'

interface VideoPlayerProps {
  lesson: Lesson
  poster: string
  courseTitle: string
}

export default function VideoPlayer({ lesson, poster, courseTitle }: VideoPlayerProps) {
  const [playbackError, setPlaybackError] = useState<string | null>(null)

  useEffect(() => {
    queueMicrotask(() => {
      setPlaybackError(null)
    })
  }, [lesson.id, lesson.videoUrl])

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-950 shadow-sm">
      {lesson.videoUrl ? (
        <>
          <video
            className="aspect-video max-h-[68vh] w-full bg-slate-950 object-contain"
            controls
            playsInline
            preload="metadata"
            poster={poster}
            onLoadedData={() => setPlaybackError(null)}
            onError={() =>
              setPlaybackError(
                'วิดีโอนี้ยังเปิดได้ไม่สมบูรณ์ในเบราว์เซอร์ แม้ระบบจะพยายามแปลงไฟล์ให้อัตโนมัติแล้ว กรุณาอัปโหลดไฟล์ใหม่อีกครั้ง',
              )
            }
          >
            <source src={lesson.videoUrl} type="video/mp4" />
            เบราว์เซอร์นี้ไม่รองรับวิดีโอ
          </video>
          {playbackError ? (
            <div className="border-t border-amber-400/20 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <div className="flex items-start gap-2">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <p>{playbackError}</p>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <div className="flex aspect-video items-center justify-center bg-slate-950 text-white">
          <div className="text-center">
            <PlayCircle size={54} className="mx-auto mb-3" />
            <p className="text-sm text-slate-300">วิดีโอบทเรียนพร้อมเชื่อมต่อจาก backend</p>
          </div>
        </div>
      )}
      <div className="border-t border-white/10 bg-slate-950 p-4 text-white">
        <p className="text-xs uppercase text-slate-400">{courseTitle}</p>
        <h1 className="mt-1 text-lg font-semibold">{lesson.title}</h1>
      </div>
    </div>
  )
}
