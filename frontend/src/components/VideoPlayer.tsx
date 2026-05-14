import { useEffect, useState } from 'react'
import { AlertCircle, PlayCircle } from 'lucide-react'
import type { Lesson } from '../types/course'
import { resolveVideoSource } from '../utils/video'

interface VideoPlayerProps {
  lesson: Lesson
  poster: string
  courseTitle: string
  compact?: boolean
}

export default function VideoPlayer({ lesson, poster, courseTitle, compact = false }: VideoPlayerProps) {
  const [playbackError, setPlaybackError] = useState<string | null>(null)
  const videoSource = resolveVideoSource(lesson.videoUrl)

  useEffect(() => {
    queueMicrotask(() => {
      setPlaybackError(null)
    })
  }, [lesson.id, lesson.videoUrl])

  const showFirstVideoFrame = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = event.currentTarget
    setPlaybackError(null)

    if (video.duration > 0.2 && video.currentTime < 0.05) {
      video.currentTime = 0.1
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950 shadow-lg shadow-slate-950/20">
      {videoSource ? (
        <>
          {videoSource.kind === 'youtube' || videoSource.kind === 'mux' ? (
            <iframe
              className="aspect-video max-h-[68vh] w-full bg-slate-950"
              src={videoSource.embedUrl}
              title={lesson.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          ) : (
            <video
              className="aspect-video max-h-[68vh] w-full bg-slate-950 object-contain"
              controls
              playsInline
              preload="auto"
              poster={poster}
              onLoadedMetadata={showFirstVideoFrame}
              onLoadedData={() => setPlaybackError(null)}
              onError={() =>
                setPlaybackError('วิดีโอนี้เปิดไม่ได้ในเบราว์เซอร์ กรุณาตรวจสอบ URL หรือใช้ลิงก์ MP4 ที่เข้าถึงได้โดยตรง')
              }
            >
              <source src={videoSource.src} type="video/mp4" />
              เบราว์เซอร์นี้ไม่รองรับวิดีโอ
            </video>
          )}
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
        <div className="flex aspect-video items-center justify-center bg-[radial-gradient(circle_at_center,#1e293b_0,#020617_60%)] text-white">
          <div className="text-center">
            <PlayCircle size={54} className="mx-auto mb-3 text-slate-200" />
            <p className="text-sm text-slate-300">เพิ่มลิงก์วิดีโอของบทเรียนเพื่อแสดงตัวเล่นตรงนี้</p>
          </div>
        </div>
      )}
      {!compact ? (
        <div className="border-t border-white/10 bg-slate-950 p-4 text-white">
          <p className="text-xs uppercase text-slate-400">{courseTitle}</p>
          <h1 className="mt-1 text-lg font-semibold">{lesson.title}</h1>
        </div>
      ) : null}
    </div>
  )
}
