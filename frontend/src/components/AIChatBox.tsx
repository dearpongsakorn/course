import { useEffect, useRef, useState } from 'react'
import { Bot, Send, Trash2, UserRound } from 'lucide-react'
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
  className?: string
}

const chatStoragePrefix = 'mycourse_ai_chat'

const createWelcomeMessage = (lessonTitle: string): Message => ({
  id: 'm-1',
  sender: 'ai',
  text: `มีตรงไหนใน "${lessonTitle}" ที่ยังไม่เข้าใจ ถามได้เลยนะ`,
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

export default function AIChatBox({ lessonId, lessonTitle, className = 'h-[560px] max-h-[70vh]' }: AIChatBoxProps) {
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<Message[]>(() => getStoredMessages(lessonId, lessonTitle))
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setMessages(getStoredMessages(lessonId, lessonTitle))
  }, [lessonId, lessonTitle])

  useEffect(() => {
    localStorage.setItem(getChatStorageKey(lessonId), JSON.stringify(messages))
  }, [lessonId, messages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'end' })
  }, [messages, loading])

  const clearChat = () => {
    const welcomeMessage = createWelcomeMessage(lessonTitle)

    localStorage.removeItem(getChatStorageKey(lessonId))
    setQuestion('')
    setMessages([welcomeMessage])
  }

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
    <div
      className={[
        'flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/70 dark:border-white/10 dark:bg-slate-900 dark:shadow-black/30',
        className,
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-5">
        <h2 className="min-w-0 text-xl font-semibold tracking-tight text-slate-950">AI ผู้ช่วย</h2>
        <button
          type="button"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-slate-950 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="เคลียร์ข้อความแชท"
          title="เคลียร์ข้อความแชท"
          onClick={clearChat}
          disabled={loading}
        >
          <Trash2 size={18} />
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto bg-slate-50/70 p-5 dark:bg-slate-950">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex items-start gap-3 ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.sender === 'ai' ? (
              <span className="mt-1 hidden h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-950 text-white ring-1 ring-slate-800 sm:inline-flex dark:bg-white dark:text-slate-950">
                <Bot size={18} />
              </span>
            ) : null}

            <div
              className={`min-h-[52px] w-full max-w-[92%] whitespace-pre-wrap break-words rounded-xl px-4 py-3 text-base leading-7 shadow-sm sm:max-w-[88%] ${
                message.sender === 'user'
                  ? 'bg-white text-slate-950 ring-1 ring-slate-200 dark:bg-white dark:text-slate-950'
                  : 'border border-slate-800 bg-slate-950 text-slate-100 shadow-slate-950/20'
              }`}
            >
              {message.text}
              <span
                className={`mt-3 block text-xs ${
                  message.sender === 'user' ? 'text-slate-500' : 'text-slate-400'
                }`}
              >
                {formatMessageTime(message.createdAt)}
              </span>
            </div>

            {message.sender === 'user' ? (
              <span className="mt-1 hidden h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-700 ring-1 ring-slate-200 sm:inline-flex dark:bg-slate-800 dark:text-slate-200 dark:ring-white/10">
                <UserRound size={18} />
              </span>
            ) : null}
          </div>
        ))}

        {loading ? <p className="text-base text-slate-500">กำลังสรุปคำถาม...</p> : null}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-slate-200 bg-white p-5">
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
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                askQuestion(question)
              }
            }}
            rows={2}
            className="mt-0 min-h-[72px] w-full resize-none rounded-lg border border-slate-200 bg-white px-4 py-3 text-base leading-7 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-950"
            placeholder="พิมพ์คำถามเกี่ยวกับบทเรียน"
            disabled={loading}
          />
          <button
            type="submit"
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="ส่งคำถาม"
            disabled={loading}
          >
            <Send size={19} />
          </button>
        </form>
      </div>
    </div>
  )
}
