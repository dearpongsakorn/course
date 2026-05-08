import { useState } from 'react'
import { CheckCircle2, Circle, XCircle } from 'lucide-react'
import type { QuizQuestion } from '../types/quiz'

interface QuizCardProps {
  questions: QuizQuestion[]
}

export default function QuizCard({ questions }: QuizCardProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({})

  const correctCount = questions.filter((question) => {
    const selectedId = answers[question.id]
    const selected = question.options.find((option) => option.id === selectedId)

    return selected?.isCorrect
  }).length

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-col gap-2 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">AI Quiz</h2>
          <p className="mt-1 text-sm text-slate-500">แบบทดสอบจากเนื้อหาในวิดีโอ</p>
        </div>
        <span className="w-fit rounded-md bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
          {correctCount}/{questions.length} ถูก
        </span>
      </div>

      <div className="space-y-4 p-4">
        {questions.map((question, index) => {
          const selectedId = answers[question.id]
          const selectedOption = question.options.find((option) => option.id === selectedId)

          return (
            <section key={question.id} className="rounded-lg border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-950">
                {index + 1}. {question.question}
              </p>
              <div className="mt-3 space-y-2">
                {question.options.map((option) => {
                  const selected = selectedId === option.id
                  const showResult = Boolean(selectedId)
                  const isWrongSelected = selected && !option.isCorrect
                  const isCorrectOption = showResult && option.isCorrect

                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={`flex w-full items-start gap-3 rounded-md border px-3 py-2 text-left text-sm transition ${
                        isCorrectOption
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                          : isWrongSelected
                            ? 'border-rose-300 bg-rose-50 text-rose-800'
                            : selected
                              ? 'border-slate-950 bg-slate-50 text-slate-950'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                      onClick={() =>
                        setAnswers((current) => ({ ...current, [question.id]: option.id }))
                      }
                    >
                      {isCorrectOption ? (
                        <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
                      ) : isWrongSelected ? (
                        <XCircle size={17} className="mt-0.5 shrink-0" />
                      ) : (
                        <Circle size={17} className="mt-0.5 shrink-0" />
                      )}
                      <span>{option.text}</span>
                    </button>
                  )
                })}
              </div>

              {selectedOption && (
                <div className="mt-3 rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-600">
                  <span className="font-semibold text-slate-950">เฉลย: </span>
                  {question.explanation}
                </div>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
