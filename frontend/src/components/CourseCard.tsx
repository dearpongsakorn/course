import { Link } from 'react-router-dom'
import { ArrowRight, BadgePercent, Clock3, Gift, Star, Users } from 'lucide-react'
import type { Course } from '../types/course'

interface CourseCardProps {
  course: Course
  progress?: number
  ctaLabel?: string
  ctaTo?: string
  cardTo?: string
  showDescription?: boolean
  showActions?: boolean
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0,
  }).format(price)

export default function CourseCard({
  course,
  progress,
  ctaLabel = 'ดูรายละเอียด',
  ctaTo,
  cardTo,
  showDescription = true,
  showActions = true,
}: CourseCardProps) {
  const primaryLink = cardTo ?? ctaTo ?? `/courses/${course.slug}`
  const isFree = course.price === 0

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-lg border border-slate-200/80 bg-white shadow-sm shadow-slate-200/70 transition hover:-translate-y-1 hover:border-slate-400 hover:shadow-xl hover:shadow-slate-300/40 dark:border-white/10 dark:bg-slate-900 dark:shadow-black/30 dark:hover:border-white/25 dark:hover:shadow-black/50">
      <Link to={primaryLink} className="relative block overflow-hidden">
        <img
          src={course.coverImage}
          alt={course.title}
          className="aspect-[16/10] w-full object-cover transition duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/55 via-slate-950/5 to-transparent opacity-80 transition group-hover:opacity-95" />
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          <span className="inline-flex items-center rounded-md bg-white/95 px-2.5 py-1 text-xs font-semibold text-slate-950 shadow-sm shadow-slate-950/10">
            {course.category}
          </span>
          {course.isPopular ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-950 px-2.5 py-1 text-xs font-semibold text-white shadow-sm shadow-slate-950/20">
              <BadgePercent size={13} />
              โปรโมชั่น
            </span>
          ) : null}
          {isFree ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-white shadow-sm shadow-emerald-950/20">
              <Gift size={13} />
              ฟรี
            </span>
          ) : null}
        </div>
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-3">
          <p className="truncate text-xs font-medium text-white/85">{course.instructor.name}</p>
          <span className="rounded-md border border-white/15 bg-white/90 px-2.5 py-1 text-xs font-semibold text-slate-950 shadow-sm">
            {isFree ? 'ฟรี' : formatPrice(course.price)}
          </span>
        </div>
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-medium">
          <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-600 dark:bg-white/5">
            {course.level}
          </span>
        </div>
        <h3 className="text-lg font-semibold leading-7 text-slate-950">{course.title}</h3>
        {showDescription ? (
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{course.description}</p>
        ) : null}

        <div className="mt-4 grid grid-cols-3 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-500 dark:border-white/10 dark:bg-slate-950">
          <span className="flex items-center justify-center gap-1.5 border-r border-slate-200 px-2 py-2 dark:border-white/10">
            <Clock3 size={14} />
            {course.duration}
          </span>
          <span className="flex items-center justify-center gap-1.5 border-r border-slate-200 px-2 py-2 dark:border-white/10">
            <Star size={14} className="fill-amber-400 text-amber-400" />
            {course.rating}
          </span>
          <span className="flex items-center justify-center gap-1.5 px-2 py-2">
            <Users size={14} />
            {course.students.toLocaleString('th-TH')}
          </span>
        </div>

        {typeof progress === 'number' && (
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-600">
              <span>ความคืบหน้า</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div
                className="h-2 rounded-full bg-emerald-500"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          </div>
        )}

        {showActions ? (
          <div className="mt-5 border-t border-slate-200 pt-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-base font-semibold text-slate-950">{isFree ? 'ฟรี' : formatPrice(course.price)}</p>
              <Link to={ctaTo ?? `/courses/${course.slug}`} className="btn-primary px-3.5 py-2">
                {ctaLabel}
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </article>
  )
}
