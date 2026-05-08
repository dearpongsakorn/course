import { Link } from 'react-router-dom'
import { ArrowRight, Clock3, Star, Users } from 'lucide-react'
import type { Course } from '../types/course'

interface CourseCardProps {
  course: Course
  progress?: number
  ctaLabel?: string
  ctaTo?: string
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
  showDescription = true,
  showActions = true,
}: CourseCardProps) {
  return (
    <article className="card flex h-full flex-col overflow-hidden">
      <Link to={`/courses/${course.slug}`} className="block overflow-hidden">
        <img
          src={course.coverImage}
          alt={course.title}
          className="aspect-[16/10] w-full object-cover transition duration-300 hover:scale-105"
        />
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-medium">
          <span className="rounded-md bg-slate-100 px-2.5 py-1 text-slate-700">
            {course.category}
          </span>
          <span className="rounded-md border border-slate-200 px-2.5 py-1 text-slate-600">
            {course.level}
          </span>
        </div>
        <h3 className="text-lg font-semibold leading-7 text-slate-950">{course.title}</h3>
        {showDescription ? (
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{course.description}</p>
        ) : null}

        <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <Clock3 size={14} />
            {course.duration}
          </span>
          <span className="flex items-center gap-1.5">
            <Star size={14} className="fill-slate-900 text-slate-900" />
            {course.rating}
          </span>
          <span className="flex items-center gap-1.5">
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
                className="h-2 rounded-full bg-slate-950"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          </div>
        )}

        {showActions ? (
          <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-4">
            <p className="text-base font-semibold text-slate-950">{formatPrice(course.price)}</p>
            <Link to={ctaTo ?? `/courses/${course.slug}`} className="btn-secondary px-3 py-2">
              {ctaLabel}
              <ArrowRight size={15} />
            </Link>
          </div>
        ) : null}
      </div>
    </article>
  )
}
