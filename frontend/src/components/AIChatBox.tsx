import { useMemo, useState } from 'react'
import { Bot, Send, UserRound } from 'lucide-react'
import { api } from '../services/api'

interface Message {
  id: string
  sender: 'user' | 'ai'
  text: string
}

interface AIChatBoxProps {
  lessonId: string
  lessonTitle: string
}

export default function AIChatBox({ lessonId, lessonTitle }: AIChatBoxProps) {
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'm-1',
      sender: 'ai',
      text: `ถามได้เลยเกี่ยวกับ "${lessonTitle}" คำตอบจะอ้างอิงจากเนื้อหาและ transcript ของบทเรียนนี้`,
    },
  ])

  const suggestedQuestions = useMemo(
    () => ['สรุปประเด็นสำคัญของบทนี้', 'ยกตัวอย่างที่ใช้ได้จริง', 'มีข้อควรระวังอะไรบ้าง'],
    [],
  )

  const askQuestion = async (text: string) => {
    const trimmed = text.trim()

    if (!trimmed || loading) return

    const userMessage: Message = { id: `u-${Date.now()}`, sender: 'user', text: trimmed }
    setMessages((current) => [...current, userMessage])
    setQuestion('')
    setLoading(true)

    try {
      const result = await api.askLesson(lessonId, trimmed)
      setMessages((current) => [...current, { id: `ai-${Date.now()}`, sender: 'ai', text: result.answer }])
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: `ai-error-${Date.now()}`,
          sender: 'ai',
          text: error instanceof Error ? error.message : 'ไม่สามารถเชื่อมต่อ AI ได้ กรุณาตรวจสอบ Gemini API',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full min-h-[460px] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-200 p-4">
        <h2 className="text-base font-semibold text-slate-950">Ask AI</h2>
        <p className="mt-1 text-sm text-slate-500">ถามตอบจาก transcript และ summary ของบทเรียนนี้</p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50/70 p-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex items-start gap-3 ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.sender === 'ai' ? (
              <span className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-950 text-white">
                <Bot size={16} />
              </span>
            ) : null}

            <div
              className={`min-h-[44px] w-full max-w-[82%] rounded-lg px-3 py-2 text-sm leading-6 shadow-sm ${
                message.sender === 'user'
                  ? 'bg-slate-950 text-white'
                  : 'border border-slate-200 bg-white text-slate-700'
              }`}
            >
              {message.text}
            </div>

            {message.sender === 'user' ? (
              <span className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-700">
                <UserRound size={16} />
              </span>
            ) : null}
          </div>
        ))}

        {loading ? <p className="text-sm text-slate-500">Gemini กำลังคิด...</p> : null}
      </div>

      <div className="border-t border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap gap-2">
          {suggestedQuestions.map((item) => (
            <button
              key={item}
              type="button"
              className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
              onClick={() => askQuestion(item)}
              disabled={loading}
            >
              {item}
            </button>
          ))}
        </div>

        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            askQuestion(question)
          }}
        >
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            rows={2}
            className="field-input mt-0 min-h-[52px] resize-none"
            placeholder="พิมพ์คำถามเกี่ยวกับบทเรียน"
            disabled={loading}
          />
          <button type="submit" className="btn-primary h-[52px] shrink-0 px-3" aria-label="ส่งคำถาม" disabled={loading}>
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  )
}
