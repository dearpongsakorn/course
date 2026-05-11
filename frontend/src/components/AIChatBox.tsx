import { useEffect, useMemo, useState } from 'react'
import { Bot, Send, UserRound } from 'lucide-react'
import { api } from '../services/api'

interface Message {
  id: string
  sender: 'user' | 'ai'
  text: string
  createdAt: string
}

interface AIChatBoxProps {
  lessonId: string
  lessonTitle: string
}

const chatStoragePrefix = 'learnos_ai_chat'

const createWelcomeMessage = (lessonTitle: string): Message => ({
  id: 'm-1',
  sender: 'ai',
  text: `ถามได้เลยเกี่ยวกับ "${lessonTitle}" คำตอบจะอ้างอิงจากเนื้อหาและ transcript ของบทเรียนนี้`,
  createdAt: new Date().toISOString(),
})

const getChatStorageKey = (lessonId: string) => `${chatStoragePrefix}:${lessonId}`

const getStoredMessages = (lessonId: string, lessonTitle: string): Message[] => {
  const raw = localStorage.getItem(getChatStorageKey(lessonId))

  if (!raw) return [createWelcomeMessage(lessonTitle)]

  try {
    const messages = JSON.parse(raw)

    if (!Array.isArray(messages)) return [createWelcomeMessage(lessonTitle)]

    const normalizedMessages = messages
      .filter(
        (message): message is Message =>
          typeof message?.id === 'string' &&
          (message.sender === 'user' || message.sender === 'ai') &&
          typeof message.text === 'string',
      )
      .map((message) => ({
        ...message,
        createdAt: typeof message.createdAt === 'string' ? message.createdAt : new Date().toISOString(),
      }))

    return normalizedMessages.length > 0 ? normalizedMessages : [createWelcomeMessage(lessonTitle)]
  } catch {
    return [createWelcomeMessage(lessonTitle)]
  }
}

const formatMessageTime = (value: string) =>
  new Intl.DateTimeFormat('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))

export default function AIChatBox({ lessonId, lessonTitle }: AIChatBoxProps) {
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<Message[]>(() => getStoredMessages(lessonId, lessonTitle))

  useEffect(() => {
    setMessages(getStoredMessages(lessonId, lessonTitle))
  }, [lessonId, lessonTitle])

  useEffect(() => {
    localStorage.setItem(getChatStorageKey(lessonId), JSON.stringify(messages))
  }, [lessonId, messages])

  const suggestedQuestions = useMemo(
    () => ['สรุปประเด็นสำคัญของบทนี้', 'ยกตัวอย่างที่ใช้ได้จริง', 'มีข้อควรระวังอะไรบ้าง'],
    [],
  )

  const askQuestion = async (text: string) => {
    const trimmed = text.trim()

    if (!trimmed || loading) return

    const userMessage: Message = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: trimmed,
      createdAt: new Date().toISOString(),
    }
    setMessages((current) => [...current, userMessage])
    setQuestion('')
    setLoading(true)

    try {
      const result = await api.askLesson(lessonId, trimmed)
      setMessages((current) => [
        ...current,
        {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: result.answer,
          createdAt: new Date().toISOString(),
        },
      ])
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: `ai-error-${Date.now()}`,
          sender: 'ai',
          text: error instanceof Error ? error.message : 'ไม่สามารถเชื่อมต่อ AI ได้ กรุณาตรวจสอบ Gemini API',
          createdAt: new Date().toISOString(),
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full min-h-[460px] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/70 dark:border-white/10 dark:bg-slate-900 dark:shadow-black/30">
      <div className="border-b border-slate-200 p-4">
        <h2 className="text-base font-semibold text-slate-950">Ask AI</h2>
        <p className="mt-1 text-sm text-slate-500">ถามตอบจาก transcript และ summary ของบทเรียนนี้</p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/70 p-4 dark:bg-slate-950">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex items-start gap-3 ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.sender === 'ai' ? (
              <span className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-950 text-white ring-1 ring-slate-800 dark:bg-white dark:text-slate-950">
                <Bot size={16} />
              </span>
            ) : null}

            <div
              className={`min-h-[44px] w-full max-w-[82%] whitespace-pre-wrap rounded-lg px-4 py-3 text-sm leading-6 shadow-sm ${
                message.sender === 'user'
                  ? 'bg-white text-slate-950 ring-1 ring-slate-200 dark:bg-white dark:text-slate-950'
                  : 'border border-slate-800 bg-slate-950 text-slate-100 shadow-slate-950/20'
              }`}
            >
              {message.text}
              <span
                className={`mt-2 block text-[11px] ${
                  message.sender === 'user' ? 'text-slate-500' : 'text-slate-400'
                }`}
              >
                {formatMessageTime(message.createdAt)}
              </span>
            </div>

            {message.sender === 'user' ? (
              <span className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-white/10">
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
