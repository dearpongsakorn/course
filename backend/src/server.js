import 'dotenv/config'
import http from 'node:http'
import { spawn } from 'node:child_process'
import crypto from 'node:crypto'
import path from 'node:path'
import { createReadStream } from 'node:fs'
import { mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { GoogleGenAI } from '@google/genai'
import { query } from './db.js'

const port = Number(process.env.PORT ?? 4000)
const frontendOrigin = process.env.FRONTEND_ORIGIN ?? '*'
const aiProvider = process.env.AI_PROVIDER ?? 'none'
const aiModel = process.env.AI_MODEL ?? 'not-configured'
const transcribeModel = process.env.TRANSCRIBE_MODEL ?? aiModel
const geminiApiKey = process.env.GEMINI_API_KEY ?? ''
const ffmpegBinary = process.env.FFMPEG_PATH ?? 'ffmpeg'
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const uploadsDir = path.join(rootDir, 'uploads')
const uploadsTempDir = path.join(uploadsDir, 'tmp')
const geminiClient =
  aiProvider === 'gemini' && geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null

const sendJson = (response, statusCode, payload) => {
  response.writeHead(statusCode, {
    'Access-Control-Allow-Origin': frontendOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Content-Type': 'application/json; charset=utf-8',
  })
  response.end(JSON.stringify(payload))
}

const sendFile = async (request, response, absolutePath) => {
  const extension = path.extname(absolutePath).toLowerCase()
  const contentTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4',
  }
  const fileInfo = await stat(absolutePath)
  const fileSize = fileInfo.size
  const range = request.headers.range

  if (range) {
    const match = String(range).match(/bytes=(\d*)-(\d*)/)
    const start = match?.[1] ? Number(match[1]) : 0
    const end = match?.[2] ? Number(match[2]) : fileSize - 1
    const safeStart = Number.isFinite(start) ? start : 0
    const safeEnd = Number.isFinite(end) ? Math.min(end, fileSize - 1) : fileSize - 1

    response.writeHead(206, {
      'Access-Control-Allow-Origin': frontendOrigin,
      'Content-Type': contentTypes[extension] ?? 'application/octet-stream',
      'Accept-Ranges': 'bytes',
      'Content-Range': `bytes ${safeStart}-${safeEnd}/${fileSize}`,
      'Content-Length': safeEnd - safeStart + 1,
      'Cache-Control': 'public, max-age=31536000, immutable',
    })

    if (request.method === 'HEAD') {
      response.end()
      return
    }

    createReadStream(absolutePath, { start: safeStart, end: safeEnd }).pipe(response)
    return
  }

  response.writeHead(200, {
    'Access-Control-Allow-Origin': frontendOrigin,
    'Content-Type': contentTypes[extension] ?? 'application/octet-stream',
    'Accept-Ranges': 'bytes',
    'Content-Length': fileSize,
    'Cache-Control': 'public, max-age=31536000, immutable',
  })

  if (request.method === 'HEAD') {
    response.end()
    return
  }

  createReadStream(absolutePath).pipe(response)
}

const toUser = (row) => ({
  id: row.id,
  name: row.name,
  email: row.email,
  role: row.role,
  avatarUrl: row.avatar_url ?? undefined,
  status: row.status,
  createdAt: row.created_at,
})

const hashPassword = (password, salt = crypto.randomBytes(16).toString('hex')) => {
  const passwordHash = crypto.pbkdf2Sync(password, salt, 120000, 64, 'sha512').toString('hex')

  return { passwordHash, passwordSalt: salt }
}

const verifyPassword = (password, passwordHash, passwordSalt) => {
  const { passwordHash: incomingHash } = hashPassword(password, passwordSalt)
  const incoming = Buffer.from(incomingHash, 'hex')
  const stored = Buffer.from(passwordHash, 'hex')

  return incoming.length === stored.length && crypto.timingSafeEqual(incoming, stored)
}

const ensureAuthSchema = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS user_passwords (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await query(`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    )
  `)
  await query(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      headline TEXT NOT NULL DEFAULT '',
      bio TEXT NOT NULL DEFAULT '',
      learning_goal TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}

const ensureAiSchema = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS lesson_transcripts (
      lesson_id TEXT PRIMARY KEY REFERENCES lessons(id) ON DELETE CASCADE,
      transcript TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'manual',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await query(`
    CREATE TABLE IF NOT EXISTS ai_outputs (
      id TEXT PRIMARY KEY,
      lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
      output_type TEXT NOT NULL CHECK (output_type IN ('summary', 'quiz', 'answer')),
      prompt TEXT NOT NULL,
      result JSONB NOT NULL,
      model TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}

const getLessonContent = async (lessonId) => {
  const result = await query(
    `
      SELECT
        l.id,
        l.title,
        l.summary,
        COALESCE(t.transcript, l.summary) AS content
      FROM lessons l
      LEFT JOIN lesson_transcripts t ON t.lesson_id = l.id
      WHERE l.id = $1
      LIMIT 1
    `,
    [lessonId],
  )

  return result.rows[0] ?? null
}

const getGeminiText = (response) => {
  if (typeof response.text === 'function') return response.text()
  if (typeof response.text === 'string') return response.text

  const candidateParts = response.candidates?.[0]?.content?.parts ?? []
  return candidateParts.map((part) => part.text ?? '').join('').trim()
}

const ensureGeminiClient = () => {
  if (aiProvider !== 'gemini') {
    const error = new Error(
      aiProvider === 'none'
        ? 'ยังไม่ได้ตั้งค่า AI provider กรุณาตั้งค่า Gemini API ก่อนใช้งาน AI'
        : `AI provider "${aiProvider}" ยังไม่ได้เชื่อมต่อใน backend`,
    )
    error.statusCode = 503
    throw error
  }

  if (!geminiClient) {
    const error = new Error('ไม่พบ GEMINI_API_KEY กรุณาตั้งค่า backend/.env หรือ docker env ให้ถูกต้อง')
    error.statusCode = 503
    throw error
  }

  return geminiClient
}

const callGemini = async (prompt, { json = false } = {}) => {
  const client = ensureGeminiClient()
  const response = await client.models.generateContent({
    model: aiModel,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      temperature: 0.2,
      ...(json ? { responseMimeType: 'application/json' } : {}),
    },
  })

  const text = getGeminiText(response)
  if (!text) throw new Error('Gemini did not return text')

  return text
}

const callAiProvider = async (prompt, options = {}) => {
  if (aiProvider === 'gemini') return callGemini(prompt, options)

  const error = new Error(
    aiProvider === 'none'
      ? 'ยังไม่ได้ตั้งค่า AI provider กรุณาตั้งค่า Gemini API ก่อนใช้งาน AI'
      : `AI provider "${aiProvider}" ยังไม่ได้เชื่อมต่อใน backend`,
  )
  error.statusCode = 503
  throw error
}

const parseJsonResponse = (text) => {
  try {
    return JSON.parse(text)
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('AI did not return valid JSON')
    return JSON.parse(match[0])
  }
}

const saveAiOutput = async ({ lessonId, outputType, prompt, result }) => {
  await query(
    `
      INSERT INTO ai_outputs (id, lesson_id, output_type, prompt, result, model)
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [`ai-${crypto.randomUUID()}`, lessonId, outputType, prompt, JSON.stringify(result), aiModel],
  )
}

const ensureUploadsDir = async () => {
  await mkdir(uploadsDir, { recursive: true })
  await mkdir(uploadsTempDir, { recursive: true })
}

const transcodeVideoToMp4 = async (inputPath, outputPath) =>
  new Promise((resolve, reject) => {
    const ffmpeg = spawn(
      ffmpegBinary,
      [
        '-y',
        '-i',
        inputPath,
        '-map',
        '0:v:0',
        '-map',
        '0:a:0?',
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '23',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-movflags',
        '+faststart',
        outputPath,
      ],
      { stdio: ['ignore', 'ignore', 'pipe'] },
    )

    let errorOutput = ''
    ffmpeg.stderr.on('data', (chunk) => {
      errorOutput += String(chunk)
    })

    ffmpeg.on('error', (error) => {
      if (error.message.includes('ENOENT')) {
        const missingBinaryError = new Error('ไม่พบ ffmpeg สำหรับแปลงวิดีโออัตโนมัติ')
        missingBinaryError.statusCode = 500
        reject(missingBinaryError)
        return
      }

      reject(error)
    })

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve(undefined)
        return
      }

      const transcodeError = new Error(
        `ไม่สามารถแปลงวิดีโอเป็น MP4 แบบ H.264 ได้${errorOutput ? `: ${errorOutput.trim()}` : ''}`,
      )
      transcodeError.statusCode = 400
      reject(transcodeError)
    })
  })

const probeVideoStreams = async (absolutePath) =>
  new Promise((resolve, reject) => {
    const ffprobe = spawn(
      ffmpegBinary.replace(/ffmpeg$/i, 'ffprobe'),
      [
        '-v',
        'error',
        '-show_entries',
        'stream=codec_type,codec_name',
        '-of',
        'json',
        absolutePath,
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    )

    let stdout = ''
    let stderr = ''

    ffprobe.stdout.on('data', (chunk) => {
      stdout += String(chunk)
    })

    ffprobe.stderr.on('data', (chunk) => {
      stderr += String(chunk)
    })

    ffprobe.on('error', (error) => {
      if (error.message.includes('ENOENT')) {
        const missingBinaryError = new Error('ไม่พบ ffprobe สำหรับตรวจสอบไฟล์วิดีโอ')
        missingBinaryError.statusCode = 500
        reject(missingBinaryError)
        return
      }

      reject(error)
    })

    ffprobe.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || 'ไม่สามารถตรวจสอบ codec ของวิดีโอได้'))
        return
      }

      try {
        const payload = JSON.parse(stdout)
        resolve(Array.isArray(payload.streams) ? payload.streams : [])
      } catch {
        reject(new Error('ไม่สามารถอ่านผลตรวจสอบวิดีโอได้'))
      }
    })
  })

const getLocalUploadPath = (fileUrl) => {
  if (!fileUrl || !String(fileUrl).startsWith('/uploads/')) return null

  const fileName = path.basename(String(fileUrl))
  return path.join(uploadsDir, fileName)
}

const mimeTypeForFile = (absolutePath) => {
  const extension = path.extname(absolutePath).toLowerCase()
  const mimeTypes = {
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.m4v': 'video/mp4',
    '.mp3': 'audio/mpeg',
    '.m4a': 'audio/mp4',
    '.wav': 'audio/wav',
    '.webm': 'video/webm',
  }

  return mimeTypes[extension] ?? 'application/octet-stream'
}

const transcribeVideoWithGemini = async (absolutePath) => {
  const client = ensureGeminiClient()
  const mediaBuffer = await readFile(absolutePath)
  const prompt = `
ถอดสคริปต์เสียงพูดจากวิดีโอนี้เป็นภาษาไทย
- ถอดเฉพาะคำพูดที่ได้ยินจริง
- ถ้าเสียงไม่ชัดให้ใส่ [ไม่ชัดเจน] เฉพาะจุดนั้น
- ห้ามแต่งเนื้อหาเพิ่ม
- ส่งกลับเป็นข้อความ transcript เท่านั้น
`
  const response = await client.models.generateContent({
    model: transcribeModel,
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: mimeTypeForFile(absolutePath),
              data: mediaBuffer.toString('base64'),
            },
          },
        ],
      },
    ],
    config: {
      temperature: 0,
    },
  })

  const transcript = getGeminiText(response).trim()
  if (!transcript) throw new Error('Gemini did not return transcript')

  return transcript
}

const saveLessonTranscript = async (lessonId, transcript, source = 'manual') => {
  if (!transcript.trim()) return

  await ensureAiSchema()
  await query(
    `
      INSERT INTO lesson_transcripts (lesson_id, transcript, source, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (lesson_id)
      DO UPDATE SET transcript = EXCLUDED.transcript, source = EXCLUDED.source, updated_at = NOW()
    `,
    [lessonId, transcript.trim(), source],
  )
}

const autoTranscribeLesson = async (lessonId, videoUrl) => {
  const absolutePath = getLocalUploadPath(videoUrl)
  if (!absolutePath) return

  if (aiProvider !== 'gemini') {
    console.warn(`Skip transcript for lesson ${lessonId}: AI_PROVIDER is not gemini`)
    return
  }

  try {
    await stat(absolutePath)
    const transcript = await transcribeVideoWithGemini(absolutePath)
    await saveLessonTranscript(lessonId, transcript, 'gemini')
    console.log(`Generated Gemini transcript for lesson ${lessonId}`)
  } catch (error) {
    console.error(`Failed to generate Gemini transcript for lesson ${lessonId}`, error)
  }
}

const normalizeExistingUploadedVideos = async () => {
  await ensureUploadsDir()

  const result = await query(
    `
      SELECT id, video_url
      FROM lessons
      WHERE video_url IS NOT NULL
        AND video_url LIKE '/uploads/%'
    `,
  )

  for (const lesson of result.rows) {
    const absolutePath = getLocalUploadPath(lesson.video_url)

    if (!absolutePath) continue

    try {
      await stat(absolutePath)
    } catch {
      continue
    }

    try {
      const streams = await probeVideoStreams(absolutePath)
      const videoStream = streams.find((stream) => stream.codec_type === 'video')
      const audioStream = streams.find((stream) => stream.codec_type === 'audio')
      const videoCodec = String(videoStream?.codec_name ?? '').toLowerCase()
      const audioCodec = String(audioStream?.codec_name ?? '').toLowerCase()
      const needsTranscode =
        videoCodec !== 'h264' || (audioStream && !['aac', 'mp3'].includes(audioCodec))

      if (!needsTranscode) continue

      const tempOutputPath = path.join(uploadsTempDir, `normalized-${crypto.randomUUID()}.mp4`)
      await transcodeVideoToMp4(absolutePath, tempOutputPath)
      await rename(tempOutputPath, absolutePath)
      console.log(`Normalized lesson video ${lesson.id} to H.264/AAC`)
    } catch (error) {
      console.error(`Failed to normalize lesson video ${lesson.id}`, error)
    }
  }
}

const parseDataUrl = (value) => {
  const match = String(value).match(/^data:([^;]+);base64,(.+)$/)

  if (!match) {
    const error = new Error('รูปแบบไฟล์อัปโหลดไม่ถูกต้อง')
    error.statusCode = 400
    throw error
  }

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], 'base64'),
  }
}

const readRawBody = async (request, maxBytes = 550 * 1024 * 1024) =>
  new Promise((resolve, reject) => {
    const chunks = []
    let totalBytes = 0

    request.on('data', (chunk) => {
      totalBytes += chunk.length

      if (totalBytes > maxBytes) {
        const error = new Error('ไฟล์วิดีโอต้องไม่เกิน 500MB')
        error.statusCode = 413
        reject(error)
        request.destroy()
        return
      }

      chunks.push(chunk)
    })
    request.on('end', () => resolve(Buffer.concat(chunks)))
    request.on('error', reject)
  })

const parseMultipartFormData = (contentType, buffer) => {
  const boundaryMatch = String(contentType).match(/boundary=(?:"([^"]+)"|([^;]+))/i)

  if (!boundaryMatch) {
    const error = new Error('ไม่พบ boundary ของไฟล์อัปโหลด')
    error.statusCode = 400
    throw error
  }

  const boundary = boundaryMatch[1] ?? boundaryMatch[2]
  const boundaryToken = `--${boundary}`
  const rawText = buffer.toString('latin1')
  const segments = rawText
    .split(boundaryToken)
    .slice(1, -1)
    .map((segment) => {
      let normalized = segment
      if (normalized.startsWith('\r\n')) normalized = normalized.slice(2)
      if (normalized.endsWith('\r\n')) normalized = normalized.slice(0, -2)
      return normalized
    })
    .filter(Boolean)

  const fields = {}
  let filePart = null

  for (const segment of segments) {
    const headerEnd = segment.indexOf('\r\n\r\n')
    if (headerEnd === -1) continue

    const headerText = segment.slice(0, headerEnd)
    const bodyText = segment.slice(headerEnd + 4)
    const disposition = headerText.match(/name="([^"]+)"/i)

    if (!disposition) continue

    const fieldName = disposition[1]
    const fileNameMatch = headerText.match(/filename="([^"]*)"/i)

    if (fileNameMatch?.[1]) {
      const mimeTypeMatch = headerText.match(/content-type:\s*([^\r\n]+)/i)
      filePart = {
        fieldName,
        fileName: fileNameMatch[1],
        mimeType: mimeTypeMatch?.[1]?.trim() ?? 'application/octet-stream',
        buffer: Buffer.from(bodyText, 'latin1'),
      }
    } else {
      fields[fieldName] = Buffer.from(bodyText, 'latin1').toString('utf8')
    }
  }

  return { fields, filePart }
}

const persistUploadedFile = async ({ kind, fileName, mimeType, buffer }) => {
  const allowedTypes =
    kind === 'video'
      ? new Set(['video/mp4'])
      : new Set(['image/jpeg', 'image/png', 'image/webp'])

  if (!allowedTypes.has(mimeType)) {
    return {
      statusCode: 400,
      payload: { message: kind === 'video' ? 'รองรับวิดีโอ MP4 เท่านั้น' : 'รองรับรูป JPG, PNG, WEBP' },
    }
  }

  const maxBytes = kind === 'video' ? 500 * 1024 * 1024 : 5 * 1024 * 1024

  if (buffer.byteLength > maxBytes) {
    return {
      statusCode: 400,
      payload: { message: kind === 'video' ? 'วิดีโอต้องไม่เกิน 500MB' : 'รูปต้องไม่เกิน 5MB' },
    }
  }

  const safeBaseName = path
    .basename(fileName)
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/^-|-$/g, '')
  const extension = path.extname(safeBaseName) || (kind === 'video' ? '.mp4' : '.jpg')
  const finalFileName = `${kind}-${Date.now()}-${crypto.randomUUID()}${extension}`
  const absolutePath = path.join(uploadsDir, finalFileName)

  await ensureUploadsDir()

  if (kind === 'video') {
    const tempInputPath = path.join(uploadsTempDir, `input-${crypto.randomUUID()}${extension}`)
    const outputFileName = `${kind}-${Date.now()}-${crypto.randomUUID()}.mp4`
    const outputPath = path.join(uploadsDir, outputFileName)

    await writeFile(tempInputPath, buffer)

    try {
      await transcodeVideoToMp4(tempInputPath, outputPath)
    } finally {
      await unlink(tempInputPath).catch(() => {})
    }

    return {
      statusCode: 201,
      payload: {
        data: {
          kind,
          fileName: outputFileName,
          fileUrl: `/uploads/${outputFileName}`,
        },
      },
    }
  }

  await writeFile(absolutePath, buffer)

  return {
    statusCode: 201,
    payload: {
      data: {
        kind,
        fileName: finalFileName,
        fileUrl: `/uploads/${finalFileName}`,
      },
    },
  }
}

const saveUploadAsset = async (request) => {
  const authUser = await getAuthUser(request)

  if (!authUser) {
    return { statusCode: 401, payload: { message: 'กรุณาเข้าสู่ระบบก่อนอัปโหลดไฟล์' } }
  }

  const contentType = String(request.headers['content-type'] ?? '')

  if (contentType.includes('multipart/form-data')) {
    const rawBody = await readRawBody(request)
    const { fields, filePart } = parseMultipartFormData(contentType, rawBody)
    const kind = String(fields.kind ?? '').trim()

    if (!['cover', 'video', 'avatar'].includes(kind) || !filePart) {
      return { statusCode: 400, payload: { message: 'ข้อมูลไฟล์ไม่ครบ' } }
    }

    if (['cover', 'video'].includes(kind) && !['teacher', 'admin'].includes(authUser.role)) {
      return { statusCode: 403, payload: { message: 'บัญชีนี้ไม่มีสิทธิ์อัปโหลดไฟล์คอร์ส' } }
    }

    return persistUploadedFile({
      kind,
      fileName: filePart.fileName,
      mimeType: filePart.mimeType,
      buffer: filePart.buffer,
    })
  }

  const body = await readBody(request)
  const kind = String(body.kind ?? '')
  const fileName = String(body.fileName ?? '').trim()
  const dataUrl = String(body.dataUrl ?? '')

  if (!['cover', 'video', 'avatar'].includes(kind) || !fileName || !dataUrl) {
    return { statusCode: 400, payload: { message: 'ข้อมูลไฟล์ไม่ครบ' } }
  }

  if (['cover', 'video'].includes(kind) && !['teacher', 'admin'].includes(authUser.role)) {
    return { statusCode: 403, payload: { message: 'บัญชีนี้ไม่มีสิทธิ์อัปโหลดไฟล์คอร์ส' } }
  }

  const { mimeType, buffer } = parseDataUrl(dataUrl)
  return persistUploadedFile({ kind, fileName, mimeType, buffer })
}

const saveTranscript = async (request, lessonId) => {
  const body = await readBody(request)
  const transcript = String(body.transcript ?? '').trim()

  if (!transcript) {
    return { statusCode: 400, payload: { message: 'Transcript is required' } }
  }

  await saveLessonTranscript(lessonId, transcript, body.source ?? 'manual')

  return { statusCode: 200, payload: { data: { lessonId, transcript } } }
}

const summarizeLesson = async (lessonId) => {
  await ensureAiSchema()
  const lesson = await getLessonContent(lessonId)

  if (!lesson) return { statusCode: 404, payload: { message: 'Lesson not found' } }

  const prompt = `
คุณคือผู้ช่วยสอนออนไลน์ภาษาไทย
สรุปเนื้อหาบทเรียนนี้ให้อ่านง่าย แบ่งเป็น:
1. สรุปภาพรวม 1 ย่อหน้า
2. ประเด็นสำคัญ 5 ข้อ
3. สิ่งที่ผู้เรียนควรจำ

ชื่อบทเรียน: ${lesson.title}
เนื้อหา:
${lesson.content}
`
  const summary = await callAiProvider(prompt)
  const result = { summary }
  await saveAiOutput({ lessonId, outputType: 'summary', prompt, result })

  return { statusCode: 200, payload: { data: result } }
}

const askLessonAi = async (request, lessonId) => {
  await ensureAiSchema()
  const body = await readBody(request)
  const question = String(body.question ?? '').trim()

  if (!question) return { statusCode: 400, payload: { message: 'Question is required' } }

  const lesson = await getLessonContent(lessonId)
  if (!lesson) return { statusCode: 404, payload: { message: 'Lesson not found' } }

  const prompt = `
ตอบคำถามจากเนื้อหาบทเรียนเท่านั้น ถ้าไม่มีข้อมูลให้บอกว่า "ในบทเรียนนี้ยังไม่มีข้อมูลส่วนนั้น"
ตอบเป็นภาษาไทย กระชับ และยกเหตุผลจากเนื้อหา

ชื่อบทเรียน: ${lesson.title}
เนื้อหา:
${lesson.content}

คำถาม: ${question}
`
  const answer = await callAiProvider(prompt)
  const result = { question, answer }
  await saveAiOutput({ lessonId, outputType: 'answer', prompt, result })

  return { statusCode: 200, payload: { data: result } }
}

const generateLessonQuiz = async (lessonId) => {
  await ensureAiSchema()
  const lesson = await getLessonContent(lessonId)

  if (!lesson) return { statusCode: 404, payload: { message: 'Lesson not found' } }

  const prompt = `
สร้างแบบทดสอบจากเนื้อหาบทเรียนนี้ จำนวน 5 ข้อ
ตอบกลับเป็น JSON เท่านั้น รูปแบบ:
{
  "questions": [
    {
      "question": "คำถาม",
      "options": [
        {"text":"ตัวเลือก", "isCorrect": true},
        {"text":"ตัวเลือก", "isCorrect": false},
        {"text":"ตัวเลือก", "isCorrect": false},
        {"text":"ตัวเลือก", "isCorrect": false}
      ],
      "explanation": "เฉลย"
    }
  ]
}

ชื่อบทเรียน: ${lesson.title}
เนื้อหา:
${lesson.content}
`
  const raw = await callAiProvider(prompt, { json: true })
  const parsed = parseJsonResponse(raw)
  const questions = Array.isArray(parsed.questions) ? parsed.questions : []

  if (!questions.length) throw new Error('AI did not create quiz questions')

  await query('DELETE FROM quiz_questions WHERE lesson_id = $1', [lessonId])

  for (const [questionIndex, question] of questions.entries()) {
    const questionId = `q-ai-${crypto.randomUUID()}`
    await query(
      `
        INSERT INTO quiz_questions (id, lesson_id, question, explanation, sort_order)
        VALUES ($1, $2, $3, $4, $5)
      `,
      [
        questionId,
        lessonId,
        String(question.question ?? ''),
        String(question.explanation ?? ''),
        questionIndex + 1,
      ],
    )

    for (const [optionIndex, option] of (question.options ?? []).entries()) {
      await query(
        `
          INSERT INTO quiz_options (id, question_id, text, is_correct, sort_order)
          VALUES ($1, $2, $3, $4, $5)
        `,
        [
          `qo-ai-${crypto.randomUUID()}`,
          questionId,
          String(option.text ?? ''),
          Boolean(option.isCorrect),
          optionIndex + 1,
        ],
      )
    }
  }

  await saveAiOutput({ lessonId, outputType: 'quiz', prompt, result: { questions } })

  return { statusCode: 200, payload: { data: { questions } } }
}

const getBearerToken = (request) => {
  const authorization = request.headers.authorization ?? ''
  const [scheme, token] = authorization.split(' ')

  return scheme?.toLowerCase() === 'bearer' ? token : null
}

const getAuthUser = async (request) => {
  const token = getBearerToken(request)

  if (!token) return null

  const result = await query(
    `
      SELECT u.*
      FROM auth_sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token = $1 AND s.expires_at > NOW()
      LIMIT 1
    `,
    [token],
  )

  return result.rows[0] ?? null
}

const createSession = async (userId) => {
  const token = crypto.randomBytes(32).toString('hex')
  await query(
    `
      INSERT INTO auth_sessions (token, user_id, expires_at)
      VALUES ($1, $2, NOW() + INTERVAL '7 days')
    `,
    [token, userId],
  )

  return token
}

const dashboardPathForRole = (role) => {
  if (role === 'teacher') return '/teacher'
  if (role === 'admin') return '/admin'

  return '/student'
}

const login = async (request) => {
  const body = await readBody(request)
  const email = String(body.email ?? '').trim().toLowerCase()
  const password = String(body.password ?? '')
  const role = body.role ? String(body.role) : null

  if (!email || !password) {
    return { statusCode: 400, payload: { message: 'Email and password are required' } }
  }

  const result = await query(
    `
      SELECT u.*, p.password_hash, p.password_salt
      FROM users u
      JOIN user_passwords p ON p.user_id = u.id
      WHERE LOWER(u.email) = $1
      LIMIT 1
    `,
    [email],
  )
  const user = result.rows[0]

  if (!user || !verifyPassword(password, user.password_hash, user.password_salt)) {
    return { statusCode: 401, payload: { message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' } }
  }

  if (role && user.role !== role) {
    return { statusCode: 403, payload: { message: 'บัญชีนี้ไม่ได้อยู่ใน role ที่เลือก' } }
  }

  const token = await createSession(user.id)
  const userData = toUser(user)

  return {
    statusCode: 200,
    payload: {
      data: {
        token,
        user: userData,
        dashboardPath: dashboardPathForRole(userData.role),
      },
    },
  }
}

const register = async (request) => {
  const body = await readBody(request)
  const name = String(body.name ?? '').trim()
  const email = String(body.email ?? '').trim().toLowerCase()
  const password = String(body.password ?? '')
  const role = String(body.role ?? 'student')
  const title = body.title ? String(body.title).trim() : null

  if (!name || !email || !password) {
    return { statusCode: 400, payload: { message: 'Name, email and password are required' } }
  }

  if (!['student', 'teacher'].includes(role)) {
    return { statusCode: 400, payload: { message: 'Role must be student or teacher' } }
  }

  if (password.length < 8) {
    return { statusCode: 400, payload: { message: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' } }
  }

  const existing = await query('SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1', [email])

  if (existing.rows[0]) {
    return { statusCode: 409, payload: { message: 'อีเมลนี้ถูกใช้งานแล้ว' } }
  }

  const userId = `u-${role}-${crypto.randomUUID()}`
  const { passwordHash, passwordSalt } = hashPassword(password)

  const userResult = await query(
    `
      INSERT INTO users (id, name, email, role, title, status, created_at)
      VALUES ($1, $2, $3, $4, $5, 'active', CURRENT_DATE)
      RETURNING *
    `,
    [userId, name, email, role, role === 'teacher' ? title : null],
  )
  await query(
    `
      INSERT INTO user_passwords (user_id, password_hash, password_salt)
      VALUES ($1, $2, $3)
    `,
    [userId, passwordHash, passwordSalt],
  )

  const user = toUser(userResult.rows[0])
  const token = await createSession(user.id)

  return {
    statusCode: 201,
    payload: {
      data: {
        token,
        user,
        dashboardPath: dashboardPathForRole(user.role),
      },
    },
  }
}

const toInstructor = (row) => ({
  id: row.instructor_id,
  name: row.instructor_name,
  title: row.instructor_title,
  bio: row.instructor_bio,
  avatarUrl: row.instructor_avatar_url,
  rating: Number(row.instructor_rating),
  totalStudents: Number(row.instructor_total_students),
})

const toCourseSummary = (row) => ({
  id: row.id,
  slug: row.slug,
  title: row.title,
  description: row.description,
  coverImage: row.cover_image,
  price: Number(row.price),
  category: row.category,
  level: row.level,
  duration: row.duration,
  rating: Number(row.rating),
  students: Number(row.students),
  instructor: toInstructor(row),
  lessons: [],
  lessonCount: Number(row.lesson_count ?? 0),
  outcomes: row.outcomes ?? [],
  isPopular: row.is_popular,
  updatedAt: row.updated_at,
})

const courseSelect = `
  SELECT
    c.*,
    (SELECT COUNT(*)::int FROM lessons l WHERE l.course_id = c.id) AS lesson_count,
    u.id AS instructor_id,
    u.name AS instructor_name,
    u.title AS instructor_title,
    u.bio AS instructor_bio,
    u.avatar_url AS instructor_avatar_url,
    u.rating AS instructor_rating,
    u.total_students AS instructor_total_students
  FROM courses c
  JOIN users u ON u.id = c.teacher_id
`

const getCourses = async ({ popular, teacherId } = {}) => {
  const clauses = ['c.status = $1']
  const values = ['published']

  if (popular) {
    values.push(true)
    clauses.push(`c.is_popular = $${values.length}`)
  }

  if (teacherId) {
    values.push(teacherId)
    clauses.push(`c.teacher_id = $${values.length}`)
  }

  const result = await query(
    `${courseSelect} WHERE ${clauses.join(' AND ')} ORDER BY c.updated_at DESC`,
    values,
  )

  return result.rows.map(toCourseSummary)
}

const getCourseBySlug = async (slug) => {
  const courseResult = await query(`${courseSelect} WHERE c.slug = $1 LIMIT 1`, [slug])
  const courseRow = courseResult.rows[0]

  if (!courseRow) return null

  const lessonsResult = await query(
    `
      SELECT
        l.id AS lesson_id,
        l.title AS lesson_title,
        l.duration,
        l.preview,
        l.video_url,
        l.summary,
        q.id AS question_id,
        q.question,
        q.explanation,
        o.id AS option_id,
        o.text AS option_text,
        o.is_correct
      FROM lessons l
      LEFT JOIN quiz_questions q ON q.lesson_id = l.id
      LEFT JOIN quiz_options o ON o.question_id = q.id
      WHERE l.course_id = $1
      ORDER BY l.sort_order, q.sort_order, o.sort_order
    `,
    [courseRow.id],
  )

  const lessonMap = new Map()

  for (const row of lessonsResult.rows) {
    if (!lessonMap.has(row.lesson_id)) {
      lessonMap.set(row.lesson_id, {
        id: row.lesson_id,
        title: row.lesson_title,
        duration: row.duration,
        preview: row.preview,
        videoUrl: row.video_url ?? undefined,
        summary: row.summary,
        quizQuestions: [],
      })
    }

    if (!row.question_id) continue

    const lesson = lessonMap.get(row.lesson_id)
    let question = lesson.quizQuestions.find((item) => item.id === row.question_id)

    if (!question) {
      question = {
        id: row.question_id,
        question: row.question,
        options: [],
        explanation: row.explanation,
      }
      lesson.quizQuestions.push(question)
    }

    if (row.option_id) {
      question.options.push({
        id: row.option_id,
        text: row.option_text,
        isCorrect: row.is_correct,
      })
    }
  }

  return {
    ...toCourseSummary(courseRow),
    lessons: Array.from(lessonMap.values()),
  }
}

const getEnrollmentRecord = async (studentId, courseId) => {
  const result = await query(
    `
      SELECT course_id, progress, completed_lessons, last_lesson_id, joined_at
      FROM enrollments
      WHERE student_id = $1 AND course_id = $2
      LIMIT 1
    `,
    [studentId, courseId],
  )

  const row = result.rows[0]

  if (!row) return null

  return {
    courseId: row.course_id,
    progress: Number(row.progress),
    completedLessons: Number(row.completed_lessons),
    lastLessonId: row.last_lesson_id,
    joinedAt: row.joined_at,
  }
}

const getCourseForViewer = async (slug, viewer) => {
  const course = await getCourseBySlug(slug)

  if (!course) return null

  let enrollment = null

  if (viewer?.role === 'student') {
    enrollment = await getEnrollmentRecord(viewer.id, course.id)
  }

  return {
    ...course,
    viewerState: {
      role: viewer?.role ?? null,
      isEnrolled: Boolean(enrollment),
      canEnroll: viewer?.role === 'student' && !enrollment,
      ...(enrollment ? { enrollment } : {}),
    },
  }
}

const getManageableCourseBySlug = async (slug, authUser) => {
  const result = await query(
    `
      SELECT id, slug, teacher_id
      FROM courses
      WHERE slug = $1
      LIMIT 1
    `,
    [slug],
  )
  const course = result.rows[0]

  if (!course) return { statusCode: 404, payload: { message: 'Course not found' } }

  if (!authUser || !['teacher', 'admin'].includes(authUser.role)) {
    return { statusCode: 401, payload: { message: 'กรุณาเข้าสู่ระบบด้วยบัญชีคุณครูหรือแอดมิน' } }
  }

  if (authUser.role === 'teacher' && course.teacher_id !== authUser.id) {
    return { statusCode: 403, payload: { message: 'คุณไม่มีสิทธิ์จัดการคอร์สนี้' } }
  }

  return { statusCode: 200, course }
}

const getStudentDashboard = async (studentId) => {
  const userResult = await query('SELECT * FROM users WHERE id = $1 AND role = $2 LIMIT 1', [
    studentId,
    'student',
  ])
  const user = userResult.rows[0]

  if (!user) return null

  const enrollmentResult = await query(
    `
      SELECT
        e.course_id,
        e.progress,
        e.completed_lessons,
        e.last_lesson_id,
        e.joined_at,
        c.slug
      FROM enrollments e
      JOIN courses c ON c.id = e.course_id
      WHERE e.student_id = $1
      ORDER BY e.joined_at DESC
    `,
    [studentId],
  )

  const courses = []

  for (const enrollment of enrollmentResult.rows) {
    const course = await getCourseBySlug(enrollment.slug)
    courses.push({
      course,
      enrollment: {
        courseId: enrollment.course_id,
        progress: Number(enrollment.progress),
        completedLessons: Number(enrollment.completed_lessons),
        lastLessonId: enrollment.last_lesson_id,
        joinedAt: enrollment.joined_at,
      },
    })
  }

  const averageProgress = courses.length
    ? Math.round(
        courses.reduce((total, item) => total + item.enrollment.progress, 0) / courses.length,
      )
    : 0
  const completedLessons = courses.reduce(
    (total, item) => total + item.enrollment.completedLessons,
    0,
  )

  return {
    user: toUser(user),
    profile: await getUserProfile(studentId),
    courses,
    stats: {
      enrolledCourses: courses.length,
      averageProgress,
      completedLessons,
    },
  }
}

const getUserProfile = async (userId) => {
  const result = await query(
    `
      SELECT u.name, p.headline, p.bio, p.learning_goal, p.phone, p.updated_at, u.avatar_url
      FROM users u
      LEFT JOIN user_profiles p ON p.user_id = u.id
      WHERE u.id = $1
      LIMIT 1
    `,
    [userId],
  )
  const profile = result.rows[0]

  if (!profile) {
    return {
      name: '',
      headline: '',
      bio: '',
      learningGoal: '',
      phone: '',
      avatarUrl: '',
      updatedAt: null,
    }
  }

  return {
    name: profile.name ?? '',
    headline: profile.headline ?? '',
    bio: profile.bio ?? '',
    learningGoal: profile.learning_goal ?? '',
    phone: profile.phone ?? '',
    avatarUrl: profile.avatar_url ?? '',
    updatedAt: profile.updated_at,
  }
}

const updateStudentProfile = async (request) => {
  const authUser = await getAuthUser(request)

  if (!authUser || authUser.role !== 'student') {
    return { statusCode: 401, payload: { message: 'กรุณาเข้าสู่ระบบด้วยบัญชีนักเรียน' } }
  }

  const body = await readBody(request)
  const name = String(body.name ?? '').trim()
  const headline = String(body.headline ?? '').trim()
  const bio = String(body.bio ?? '').trim()
  const learningGoal = String(body.learningGoal ?? '').trim()
  const phone = String(body.phone ?? '').trim()
  const avatarUrl = String(body.avatarUrl ?? '').trim()

  if (!name) {
    return { statusCode: 400, payload: { message: 'กรุณากรอกชื่อ' } }
  }

  await query(
    `
      INSERT INTO user_profiles (user_id, headline, bio, learning_goal, phone, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        headline = EXCLUDED.headline,
        bio = EXCLUDED.bio,
        learning_goal = EXCLUDED.learning_goal,
        phone = EXCLUDED.phone,
        updated_at = NOW()
    `,
    [authUser.id, headline, bio, learningGoal, phone],
  )

  await query('UPDATE users SET name = $1, avatar_url = $2 WHERE id = $3', [
    name,
    avatarUrl || null,
    authUser.id,
  ])

  return { statusCode: 200, payload: { data: await getUserProfile(authUser.id) } }
}

const getTeacherDashboard = async (teacherId) => {
  const userResult = await query('SELECT * FROM users WHERE id = $1 AND role = $2 LIMIT 1', [
    teacherId,
    'teacher',
  ])
  const user = userResult.rows[0]

  if (!user) return null

  const courseSummaries = await getCourses({ teacherId })
  const courses = (
    await Promise.all(courseSummaries.map((course) => getCourseBySlug(course.slug)))
  ).filter(Boolean)

  return {
    user: toUser(user),
    courses,
  }
}

const getAdminDashboard = async () => {
  const [usersResult, courses, statsResult] = await Promise.all([
    query('SELECT * FROM users ORDER BY created_at DESC'),
    getCourses(),
    query(`
      SELECT
        COUNT(*)::int AS total_users,
        COUNT(*) FILTER (WHERE role = 'teacher')::int AS total_teachers,
        COUNT(*) FILTER (WHERE role = 'student')::int AS total_students
      FROM users
    `),
  ])

  return {
    users: usersResult.rows.map(toUser),
    courses,
    stats: {
      totalUsers: statsResult.rows[0].total_users,
      totalCourses: courses.length,
      totalTeachers: statsResult.rows[0].total_teachers,
      totalStudents: statsResult.rows[0].total_students,
    },
  }
}

const readBody = async (request) =>
  new Promise((resolve, reject) => {
    let body = ''

    request.on('data', (chunk) => {
      body += chunk
    })
    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch (error) {
        reject(error)
      }
    })
  })

const createCourse = async (request) => {
  const body = await readBody(request)
  const authUser = await getAuthUser(request)
  const id = `course-${Date.now()}`
  const title = String(body.title ?? '').trim()
  const generatedSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  const slug = body.slug || generatedSlug || id

  if (!title) {
    throw new Error('Course title is required')
  }

  if (!authUser || !['teacher', 'admin'].includes(authUser.role)) {
    const error = new Error('กรุณาเข้าสู่ระบบด้วยบัญชีคุณครูหรือแอดมิน')
    error.statusCode = 401
    throw error
  }

  const result = await query(
    `
      INSERT INTO courses (
        id, slug, teacher_id, title, description, cover_image, price, category,
        level, duration, rating, students, outcomes, is_popular, status, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, 0, $11, false, 'published', CURRENT_DATE)
      RETURNING slug
    `,
    [
      id,
      slug,
      authUser.role === 'teacher' ? authUser.id : String(body.teacherId ?? ''),
      title,
      body.description,
      body.coverImage,
      Number(body.price ?? 0),
      body.category,
      body.level ?? 'Beginner',
      body.duration ?? '0 ชม.',
      JSON.stringify(body.outcomes ?? []),
    ],
  )

  if (body.lessonTitle || body.videoUrl || body.lessonSummary) {
    const lessonId = `lesson-${crypto.randomUUID()}`
    await query(
      `
        INSERT INTO lessons (id, course_id, title, duration, preview, video_url, summary, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 1)
      `,
      [
        lessonId,
        id,
        String(body.lessonTitle ?? 'บทเรียนที่ 1'),
        String(body.lessonDuration ?? '00:00'),
        Boolean(body.lessonPreview ?? true),
        body.videoUrl ? String(body.videoUrl) : null,
        String(body.lessonSummary ?? 'บทเรียนแรกของคอร์สนี้'),
      ],
    )

    if (body.videoUrl) {
      await autoTranscribeLesson(lessonId, String(body.videoUrl))
    }
  }

  return getCourseBySlug(result.rows[0].slug)
}

const updateCourse = async (request, slug) => {
  const authUser = await getAuthUser(request)
  const permission = await getManageableCourseBySlug(slug, authUser)

  if (permission.statusCode !== 200) {
    return permission
  }

  const body = await readBody(request)
  const title = String(body.title ?? '').trim()

  if (!title) {
    return { statusCode: 400, payload: { message: 'Course title is required' } }
  }

  const generatedSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  const nextSlug = generatedSlug || permission.course.slug

  await query(
    `
      UPDATE courses
      SET
        slug = $1,
        title = $2,
        description = $3,
        cover_image = $4,
        price = $5,
        category = $6,
        level = $7,
        duration = $8,
        outcomes = $9,
        updated_at = CURRENT_DATE
      WHERE id = $10
    `,
    [
      nextSlug,
      title,
      String(body.description ?? ''),
      String(body.coverImage ?? ''),
      Number(body.price ?? 0),
      String(body.category ?? 'Technology'),
      String(body.level ?? 'Beginner'),
      String(body.duration ?? '0 ชม.'),
      JSON.stringify(body.outcomes ?? []),
      permission.course.id,
    ],
  )

  const lessonResult = await query(
    `
      SELECT id
      FROM lessons
      WHERE course_id = $1
      ORDER BY sort_order
      LIMIT 1
    `,
    [permission.course.id],
  )
  const firstLesson = lessonResult.rows[0]

  if (firstLesson) {
    await query(
      `
        UPDATE lessons
        SET
          title = $1,
          duration = $2,
          preview = $3,
          video_url = $4,
          summary = $5
        WHERE id = $6
      `,
      [
        String(body.lessonTitle ?? 'บทเรียนที่ 1'),
        String(body.lessonDuration ?? '00:00'),
        Boolean(body.lessonPreview ?? true),
        body.videoUrl ? String(body.videoUrl) : null,
        String(body.lessonSummary ?? 'บทเรียนแรกของคอร์สนี้'),
        firstLesson.id,
      ],
    )

    if (body.videoUrl) {
      await autoTranscribeLesson(firstLesson.id, String(body.videoUrl))
    }
  } else if (body.lessonTitle || body.videoUrl || body.lessonSummary) {
    const lessonId = `lesson-${crypto.randomUUID()}`
    await query(
      `
        INSERT INTO lessons (id, course_id, title, duration, preview, video_url, summary, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 1)
      `,
      [
        lessonId,
        permission.course.id,
        String(body.lessonTitle ?? 'บทเรียนที่ 1'),
        String(body.lessonDuration ?? '00:00'),
        Boolean(body.lessonPreview ?? true),
        body.videoUrl ? String(body.videoUrl) : null,
        String(body.lessonSummary ?? 'บทเรียนแรกของคอร์สนี้'),
      ],
    )

    if (body.videoUrl) {
      await autoTranscribeLesson(lessonId, String(body.videoUrl))
    }
  }

  return { statusCode: 200, payload: { data: await getCourseBySlug(nextSlug) } }
}

const deleteCourse = async (request, slug) => {
  const authUser = await getAuthUser(request)
  const permission = await getManageableCourseBySlug(slug, authUser)

  if (permission.statusCode !== 200) {
    return permission
  }

  await query('DELETE FROM courses WHERE id = $1', [permission.course.id])

  return {
    statusCode: 200,
    payload: {
      data: {
        ok: true,
        slug: permission.course.slug,
      },
    },
  }
}

const enrollInCourse = async (request, slug) => {
  const authUser = await getAuthUser(request)

  if (!authUser) {
    return { statusCode: 401, payload: { message: 'กรุณาเข้าสู่ระบบก่อนสมัครเรียน' } }
  }

  if (authUser.role !== 'student') {
    return { statusCode: 403, payload: { message: 'บัญชีนี้ไม่สามารถสมัครเรียนคอร์สได้' } }
  }

  const course = await getCourseBySlug(slug)

  if (!course) {
    return { statusCode: 404, payload: { message: 'Course not found' } }
  }

  const existingEnrollment = await getEnrollmentRecord(authUser.id, course.id)

  if (existingEnrollment) {
    return {
      statusCode: 200,
      payload: {
        data: {
          courseSlug: slug,
          enrollment: existingEnrollment,
        },
      },
    }
  }

  const firstLessonId = course.lessons[0]?.id ?? null

  await query(
    `
      INSERT INTO enrollments (
        id, student_id, course_id, progress, completed_lessons, last_lesson_id, joined_at
      )
      VALUES ($1, $2, $3, 0, 0, $4, CURRENT_DATE)
    `,
    [`enrollment-${crypto.randomUUID()}`, authUser.id, course.id, firstLessonId],
  )
  await query(
    `
      UPDATE courses
      SET students = students + 1, updated_at = CURRENT_DATE
      WHERE id = $1
    `,
    [course.id],
  )

  const enrollment = await getEnrollmentRecord(authUser.id, course.id)

  return {
    statusCode: 201,
    payload: {
      data: {
        courseSlug: slug,
        enrollment,
      },
    },
  }
}

const routeRequest = async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host}`)

  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Origin': frontendOrigin,
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    })
    response.end()
    return
  }

  if (url.pathname === '/api/health' && request.method === 'GET') {
    await query('SELECT 1')
    await ensureAuthSchema()
    sendJson(response, 200, {
      status: 'ok',
      service: 'mycourse-backend',
      database: 'postgres',
      timestamp: new Date().toISOString(),
    })
    return
  }

  if (url.pathname.startsWith('/uploads/') && ['GET', 'HEAD'].includes(request.method ?? '')) {
    const fileName = path.basename(url.pathname.replace('/uploads/', ''))
    const absolutePath = path.join(uploadsDir, fileName)

    try {
      await stat(absolutePath)
      await sendFile(request, response, absolutePath)
    } catch {
      sendJson(response, 404, { message: 'File not found' })
    }
    return
  }

  if (url.pathname === '/api/auth/login' && request.method === 'POST') {
    await ensureAuthSchema()
    const result = await login(request)
    sendJson(response, result.statusCode, result.payload)
    return
  }

  if (url.pathname === '/api/auth/register' && request.method === 'POST') {
    await ensureAuthSchema()
    const result = await register(request)
    sendJson(response, result.statusCode, result.payload)
    return
  }

  if (url.pathname === '/api/auth/me' && request.method === 'GET') {
    const user = await getAuthUser(request)
    sendJson(response, user ? 200 : 401, user ? { data: toUser(user) } : { message: 'Unauthorized' })
    return
  }

  if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
    const token = getBearerToken(request)
    if (token) await query('DELETE FROM auth_sessions WHERE token = $1', [token])
    sendJson(response, 200, { data: { ok: true } })
    return
  }

  if (url.pathname.startsWith('/api/ai/lessons/')) {
    const parts = url.pathname.split('/')
    const lessonId = decodeURIComponent(parts[4] ?? '')
    const action = parts[5]

    if (request.method === 'POST' && action === 'transcript') {
      const result = await saveTranscript(request, lessonId)
      sendJson(response, result.statusCode, result.payload)
      return
    }

    if (request.method === 'POST' && action === 'summarize') {
      const result = await summarizeLesson(lessonId)
      sendJson(response, result.statusCode, result.payload)
      return
    }

    if (request.method === 'POST' && action === 'ask') {
      const result = await askLessonAi(request, lessonId)
      sendJson(response, result.statusCode, result.payload)
      return
    }

    if (request.method === 'POST' && action === 'quiz') {
      const result = await generateLessonQuiz(lessonId)
      sendJson(response, result.statusCode, result.payload)
      return
    }
  }

  if (url.pathname === '/api/courses' && request.method === 'GET') {
    const popular = url.searchParams.get('popular') === 'true'
    const teacherId = url.searchParams.get('teacherId') ?? undefined
    sendJson(response, 200, { data: await getCourses({ popular, teacherId }) })
    return
  }

  if (url.pathname === '/api/courses' && request.method === 'POST') {
    sendJson(response, 201, { data: await createCourse(request) })
    return
  }

  if (url.pathname === '/api/uploads' && request.method === 'POST') {
    const result = await saveUploadAsset(request)
    sendJson(response, result.statusCode, result.payload)
    return
  }

  if (url.pathname.startsWith('/api/courses/') && request.method === 'GET') {
    const slug = decodeURIComponent(url.pathname.replace('/api/courses/', ''))
    const authUser = await getAuthUser(request)
    const course = await getCourseForViewer(slug, authUser)
    sendJson(response, course ? 200 : 404, course ? { data: course } : { message: 'Course not found' })
    return
  }

  if (url.pathname.startsWith('/api/courses/') && request.method === 'POST' && url.pathname.endsWith('/update')) {
    const slug = decodeURIComponent(url.pathname.replace('/api/courses/', '').replace('/update', ''))
    const result = await updateCourse(request, slug)
    sendJson(response, result.statusCode, result.payload)
    return
  }

  if (url.pathname.startsWith('/api/courses/') && request.method === 'POST' && url.pathname.endsWith('/delete')) {
    const slug = decodeURIComponent(url.pathname.replace('/api/courses/', '').replace('/delete', ''))
    const result = await deleteCourse(request, slug)
    sendJson(response, result.statusCode, result.payload)
    return
  }

  if (url.pathname.startsWith('/api/courses/') && request.method === 'POST' && url.pathname.endsWith('/enroll')) {
    const slug = decodeURIComponent(url.pathname.replace('/api/courses/', '').replace('/enroll', ''))
    const result = await enrollInCourse(request, slug)
    sendJson(response, result.statusCode, result.payload)
    return
  }

  if (url.pathname === '/api/users' && request.method === 'GET') {
    const result = await query('SELECT * FROM users ORDER BY created_at DESC')
    sendJson(response, 200, { data: result.rows.map(toUser) })
    return
  }

  if (url.pathname === '/api/student/dashboard' && request.method === 'GET') {
    const authUser = await getAuthUser(request)
    if (!authUser || authUser.role !== 'student') {
      sendJson(response, 401, { message: 'กรุณาเข้าสู่ระบบด้วยบัญชีนักเรียน' })
      return
    }

    const dashboard = await getStudentDashboard(authUser.id)
    sendJson(response, dashboard ? 200 : 404, dashboard ? { data: dashboard } : { message: 'Student not found' })
    return
  }

  if (url.pathname === '/api/student/profile' && request.method === 'POST') {
    const result = await updateStudentProfile(request)
    sendJson(response, result.statusCode, result.payload)
    return
  }

  if (url.pathname === '/api/teacher/dashboard' && request.method === 'GET') {
    const authUser = await getAuthUser(request)
    if (!authUser || authUser.role !== 'teacher') {
      sendJson(response, 401, { message: 'กรุณาเข้าสู่ระบบด้วยบัญชีคุณครู' })
      return
    }

    const dashboard = await getTeacherDashboard(authUser.id)
    sendJson(response, dashboard ? 200 : 404, dashboard ? { data: dashboard } : { message: 'Teacher not found' })
    return
  }

  if (url.pathname === '/api/admin/dashboard' && request.method === 'GET') {
    sendJson(response, 200, { data: await getAdminDashboard() })
    return
  }

  sendJson(response, 404, { message: 'Route not found' })
}

const server = http.createServer((request, response) => {
  routeRequest(request, response).catch((error) => {
    console.error(error)

    if (error.code === '23505') {
      sendJson(response, 409, { message: 'ข้อมูลนี้มีอยู่ในระบบแล้ว' })
      return
    }

    if (error.message?.includes('required')) {
      sendJson(response, 400, { message: error.message })
      return
    }

    if (error.statusCode) {
      sendJson(response, error.statusCode, { message: error.message })
      return
    }

    sendJson(response, 500, {
      message: 'Internal server error',
      detail: process.env.NODE_ENV === 'production' ? undefined : error.message,
    })
  })
})

ensureAuthSchema()
  .then(ensureAiSchema)
  .then(normalizeExistingUploadedVideos)
  .then(() => {
    server.listen(port, '0.0.0.0', () => {
      console.log(`Backend API listening on port ${port}`)
    })
  })
  .catch((error) => {
    console.error('Failed to initialize auth schema', error)
    process.exit(1)
  })
