export interface QuizOption {
  id: string
  text: string
  isCorrect: boolean
}

export interface QuizQuestion {
  id: string
  question: string
  options: QuizOption[]
  explanation: string
}

export interface Quiz {
  lessonId: string
  questions: QuizQuestion[]
}
