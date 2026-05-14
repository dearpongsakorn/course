import 'dotenv/config'
import http from 'node:http'
import { spawn } from 'node:child_process'
import crypto from 'node:crypto'
import path from 'node:path'
import { createReadStream, createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
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
const transcodeUploadedVideos = process.env.TRANSCODE_UPLOADED_VIDEOS === 'true'
const validateUploadedVideos = process.env.VALIDATE_UPLOADED_VIDEOS === 'true'
const normalizeExistingUploads = process.env.NORMALIZE_EXISTING_UPLOADS === 'true'
const autoTranscribeLessons = process.env.AUTO_TRANSCRIBE_LESSONS === 'true'
const maxAutoTranscribeVideoBytes = Number(process.env.MAX_AUTO_TRANSCRIBE_VIDEO_MB ?? 100) * 1024 * 1024
const muxAudioWaitSeconds = Math.max(30, Number(process.env.MUX_AUDIO_WAIT_SECONDS ?? 1800) || 1800)
const muxAudioDownloadMaxBytes = Number(process.env.MUX_AUDIO_DOWNLOAD_MAX_MB ?? 1024) * 1024 * 1024
const transcriptionChunkSeconds = Math.max(60, Number(process.env.TRANSCRIPTION_CHUNK_SECONDS ?? 600) || 600)
const ffmpegThreads = Math.max(1, Number(process.env.FFMPEG_THREADS ?? 2) || 2)
const adminEmail = (process.env.ADMIN_EMAIL ?? 'admin@example.com').trim().toLowerCase()
const adminPassword = process.env.ADMIN_PASSWORD ?? 'Admin12345'
const studentEmail = (process.env.STUDENT_EMAIL ?? 'mintra@example.com').trim().toLowerCase()
const studentPassword = process.env.STUDENT_PASSWORD ?? 'Student12345'
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const uploadsDir = path.join(rootDir, 'uploads')
const uploadsTempDir = path.join(uploadsDir, 'tmp')
const maxVideoUploadBytes = Number(process.env.MAX_VIDEO_UPLOAD_MB ?? 1024) * 1024 * 1024
const maxImageUploadBytes = Number(process.env.MAX_IMAGE_UPLOAD_MB ?? 5) * 1024 * 1024
const maxRawUploadBytes = maxVideoUploadBytes + 50 * 1024 * 1024
const r2Endpoint = (process.env.R2_ENDPOINT ?? '').replace(/\/+$/g, '')
const r2AccountId = process.env.R2_ACCOUNT_ID ?? ''
const r2Bucket = process.env.R2_BUCKET ?? ''
const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID ?? ''
const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY ?? ''
const r2PublicBaseUrl = (process.env.R2_PUBLIC_BASE_URL ?? '').replace(/\/+$/g, '')
const muxTokenId = process.env.MUX_TOKEN_ID ?? ''
const muxTokenSecret = process.env.MUX_TOKEN_SECRET ?? ''
const muxCorsOrigin =
  (process.env.MUX_CORS_ORIGIN ?? (frontendOrigin === '*' ? 'http://localhost:5173' : frontendOrigin)).trim() ||
  'http://localhost:5173'
const muxVideoQuality = process.env.MUX_VIDEO_QUALITY ?? 'basic'
const muxUploadTimeoutSeconds = Math.min(
  604800,
  Math.max(60, Number(process.env.MUX_UPLOAD_TIMEOUT_SECONDS ?? 3600) || 3600),
)
const muxTestUploads = process.env.MUX_TEST_UPLOADS === 'true'
const muxUploadEnabled = Boolean(muxTokenId && muxTokenSecret)
const r2StorageEnabled = Boolean(
  r2Bucket &&
    r2AccessKeyId &&
    r2SecretAccessKey &&
    r2PublicBaseUrl &&
    (r2Endpoint || r2AccountId),
)
const configuredR2MultipartPartMb = Number(process.env.R2_MULTIPART_PART_MB ?? 64)
const r2MultipartPartSize =
  Math.max(5, Number.isFinite(configuredR2MultipartPartMb) ? configuredR2MultipartPartMb : 64) * 1024 * 1024
const configuredR2PresignExpiresSeconds = Number(process.env.R2_PRESIGN_EXPIRES_SECONDS ?? 900)
const r2PresignExpiresSeconds = Math.min(
  3600,
  Math.max(60, Number.isFinite(configuredR2PresignExpiresSeconds) ? configuredR2PresignExpiresSeconds : 900),
)
const geminiClient =
  aiProvider === 'gemini' && geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null

const sendJson = (response, statusCode, payload) => {
  response.writeHead(statusCode, {
    'Access-Control-Allow-Origin': frontendOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-File-Name',
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
  isOnline: row.is_online ?? undefined,
  activeSessions: row.active_sessions !== undefined ? Number(row.active_sessions) : undefined,
  lastSeenAt: row.last_seen_at ?? undefined,
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

const upsertSeedUserCredential = async ({ id, name, email, role, password, avatarUrl = null, title = null, bio = null }) => {
  const { passwordHash, passwordSalt } = hashPassword(password)

  await query(
    `
      INSERT INTO users (id, name, email, role, avatar_url, title, bio, status, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', CURRENT_DATE)
      ON CONFLICT (id) DO UPDATE
      SET
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        status = 'active'
    `,
    [id, name, email, role, avatarUrl, title, bio],
  )

  await query(
    `
      INSERT INTO user_passwords (user_id, password_hash, password_salt, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (user_id) DO UPDATE
      SET
        password_hash = EXCLUDED.password_hash,
        password_salt = EXCLUDED.password_salt,
        updated_at = NOW()
    `,
    [id, passwordHash, passwordSalt],
  )
}

const ensureSeedCredentials = async () => {
  await upsertSeedUserCredential({
    id: 'u-admin-1',
    name: 'Admin LearnOS',
    email: adminEmail,
    role: 'admin',
    password: adminPassword,
  })

  await upsertSeedUserCredential({
    id: 'u-student-1',
    name: 'มินตรา แก้ว',
    email: studentEmail,
    role: 'student',
    password: studentPassword,
    avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80',
  })
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

const ensureCourseSchema = async () => {
  await query(`
    ALTER TABLE courses
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published'
  `)

  await query(`
    UPDATE courses
    SET status = 'published'
    WHERE status IS NULL OR status = ''
  `)

  await query(`
    ALTER TABLE lessons
    ADD COLUMN IF NOT EXISTS ai_status TEXT NOT NULL DEFAULT 'idle'
  `)

  await query(`
    ALTER TABLE lessons
    ADD COLUMN IF NOT EXISTS ai_error TEXT
  `)

  await query(`
    ALTER TABLE enrollments
    ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `)

  await query(`
    UPDATE lessons
    SET ai_status = CASE
      WHEN video_url IS NULL OR video_url = '' THEN 'idle'
      WHEN ai_status IS NULL OR ai_status = '' THEN 'pending'
      ELSE ai_status
    END
  `)
}

const getLessonContent = async (lessonId) => {
  const result = await query(
    `
      SELECT
        l.id,
        l.title,
        l.duration,
        l.summary,
        COALESCE(t.transcript, l.summary) AS content,
        t.transcript AS transcript,
        t.source AS transcript_source
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
  let response

  try {
    response = await client.models.generateContent({
      model: aiModel,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        temperature: json ? 0.2 : 0.55,
        ...(json ? { responseMimeType: 'application/json' } : {}),
      },
    })
  } catch (error) {
    const status = Number(error?.status ?? error?.statusCode ?? 500)
    const message = String(error?.message ?? '')
    const friendlyError = new Error(
      status === 429 || message.toLowerCase().includes('quota')
        ? 'AI ใช้งานเกินโควต้า Gemini ชั่วคราว กรุณารอสักครู่แล้วลองใหม่'
        : message || 'ไม่สามารถเชื่อมต่อ Gemini ได้',
    )
    friendlyError.statusCode = status === 429 ? 429 : status >= 400 && status < 500 ? status : 503
    throw friendlyError
  }

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

const isLessonRelatedQuestion = (question, lessonTitle = '') => {
  const normalizedQuestion = String(question ?? '').toLowerCase()
  const normalizedTitle = String(lessonTitle ?? '').toLowerCase()
  const lessonSignals = [
    'บทเรียน',
    'บทนี้',
    'ในบท',
    'คอร์ส',
    'คลิป',
    'วิดีโอ',
    'เนื้อหา',
    'ที่เรียน',
    'จากบท',
    'ในบทนี้',
    'สรุปบท',
    'transcript',
    'lesson',
    'course',
    'video',
  ]

  if (lessonSignals.some((signal) => normalizedQuestion.includes(signal))) return true

  return normalizedTitle
    .split(/\s+/)
    .filter((word) => word.length >= 4)
    .some((word) => normalizedQuestion.includes(word))
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

const toSha256Hex = (value) => crypto.createHash('sha256').update(value).digest('hex')

const hmac = (key, value, encoding) => crypto.createHmac('sha256', key).update(value).digest(encoding)

const getR2SigningKey = (dateStamp) => {
  const dateKey = hmac(`AWS4${r2SecretAccessKey}`, dateStamp)
  const regionKey = hmac(dateKey, 'auto')
  const serviceKey = hmac(regionKey, 's3')
  return hmac(serviceKey, 'aws4_request')
}

const getR2Endpoint = () => r2Endpoint || `https://${r2AccountId}.r2.cloudflarestorage.com`

const encodeR2Uri = (value) =>
  encodeURIComponent(String(value)).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  )

const buildR2ObjectPath = (key) =>
  `/${encodeR2Uri(r2Bucket)}/${String(key)
    .split('/')
    .map((part) => encodeR2Uri(part))
    .join('/')}`

const canonicalR2QueryString = (entries = []) =>
  entries
    .map(([key, value]) => [encodeR2Uri(key), encodeR2Uri(value ?? '')])
    .sort(([leftKey, leftValue], [rightKey, rightValue]) => {
      if (leftKey !== rightKey) return leftKey < rightKey ? -1 : 1
      if (leftValue === rightValue) return 0
      return leftValue < rightValue ? -1 : 1
    })
    .map(([key, value]) => `${key}=${value}`)
    .join('&')

const buildR2ObjectUrl = (key, queryEntries = []) => {
  const queryString = canonicalR2QueryString(queryEntries)
  return `${getR2Endpoint()}${buildR2ObjectPath(key)}${queryString ? `?${queryString}` : ''}`
}

const signR2Request = ({ method, key, queryEntries = [], headers = {}, body = Buffer.alloc(0) }) => {
  const url = new URL(buildR2ObjectUrl(key, queryEntries))
  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = amzDate.slice(0, 8)
  const payloadHash = toSha256Hex(body)
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`
  const headersToSign = {
    ...headers,
    host: url.host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  }
  const canonicalHeaderEntries = Object.entries(headersToSign)
    .map(([name, value]) => [name.toLowerCase(), String(value).trim().replace(/\s+/g, ' ')])
    .sort(([leftName], [rightName]) => leftName.localeCompare(rightName))
  const canonicalHeaders = canonicalHeaderEntries.map(([name, value]) => `${name}:${value}`).join('\n')
  const signedHeaders = canonicalHeaderEntries.map(([name]) => name).join(';')
  const canonicalRequest = [
    method,
    url.pathname,
    canonicalR2QueryString(queryEntries),
    `${canonicalHeaders}\n`,
    signedHeaders,
    payloadHash,
  ].join('\n')
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    toSha256Hex(canonicalRequest),
  ].join('\n')
  const signature = hmac(getR2SigningKey(dateStamp), stringToSign, 'hex')
  const authorization = `AWS4-HMAC-SHA256 Credential=${r2AccessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
  const fetchHeaders = {
    ...headers,
    Authorization: authorization,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  }

  return { url: url.toString(), headers: fetchHeaders }
}

const fetchR2SignedRequest = async ({ method, key, queryEntries = [], headers = {}, body = Buffer.alloc(0) }) => {
  const signedRequest = signR2Request({ method, key, queryEntries, headers, body })

  return fetch(signedRequest.url, {
    method,
    headers: signedRequest.headers,
    body: method === 'GET' || method === 'HEAD' ? undefined : body,
  })
}

const createR2PresignedPartUrl = ({ key, uploadId, partNumber }) => {
  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = amzDate.slice(0, 8)
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`
  const url = new URL(buildR2ObjectUrl(key))
  const queryEntries = [
    ['partNumber', String(partNumber)],
    ['uploadId', uploadId],
    ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
    ['X-Amz-Credential', `${r2AccessKeyId}/${credentialScope}`],
    ['X-Amz-Date', amzDate],
    ['X-Amz-Expires', String(r2PresignExpiresSeconds)],
    ['X-Amz-SignedHeaders', 'host'],
  ]
  const canonicalRequest = [
    'PUT',
    url.pathname,
    canonicalR2QueryString(queryEntries),
    `host:${url.host}\n`,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n')
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    toSha256Hex(canonicalRequest),
  ].join('\n')
  const signature = hmac(getR2SigningKey(dateStamp), stringToSign, 'hex')

  return buildR2ObjectUrl(key, [...queryEntries, ['X-Amz-Signature', signature]])
}

const decodeXmlText = (value) =>
  String(value)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')

const escapeXmlText = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

const ensureR2MultipartReady = () => {
  if (r2StorageEnabled) return null

  return {
    statusCode: 501,
    payload: { message: 'Cloudflare R2 ยังไม่ได้ตั้งค่า ระบบจะใช้การอัปโหลดผ่าน backend แทน' },
  }
}

const getR2MultipartUploadId = async ({ key, contentType }) => {
  const response = await fetchR2SignedRequest({
    method: 'POST',
    key,
    queryEntries: [['uploads', '']],
    headers: { 'Content-Type': contentType },
  })
  const responseText = await response.text().catch(() => '')

  if (!response.ok) {
    throw new Error(`เริ่ม multipart upload ไป R2 ไม่สำเร็จ (${response.status})${responseText ? `: ${responseText}` : ''}`)
  }

  const uploadId = responseText.match(/<UploadId>([^<]+)<\/UploadId>/)?.[1]

  if (!uploadId) {
    throw new Error('R2 ไม่ได้ส่ง UploadId กลับมา')
  }

  return decodeXmlText(uploadId)
}

const completeR2MultipartUpload = async ({ key, uploadId, parts }) => {
  const completeBody = Buffer.from(
    [
      '<CompleteMultipartUpload>',
      ...parts.map(
        (part) =>
          `<Part><PartNumber>${part.partNumber}</PartNumber><ETag>${escapeXmlText(part.etag)}</ETag></Part>`,
      ),
      '</CompleteMultipartUpload>',
    ].join(''),
  )
  const response = await fetchR2SignedRequest({
    method: 'POST',
    key,
    queryEntries: [['uploadId', uploadId]],
    headers: { 'Content-Type': 'application/xml' },
    body: completeBody,
  })

  if (!response.ok) {
    const responseText = await response.text().catch(() => '')
    throw new Error(`ยืนยัน multipart upload ไป R2 ไม่สำเร็จ (${response.status})${responseText ? `: ${responseText}` : ''}`)
  }
}

const abortR2MultipartUpload = async ({ key, uploadId }) => {
  const response = await fetchR2SignedRequest({
    method: 'DELETE',
    key,
    queryEntries: [['uploadId', uploadId]],
  })

  return response.ok || response.status === 404
}

const putObjectToR2 = async ({ key, contentType, body }) => {
  if (!r2StorageEnabled) return null

  const endpoint = getR2Endpoint()
  const url = new URL(`${endpoint}/${r2Bucket}/${key}`)
  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = amzDate.slice(0, 8)
  const payloadHash = toSha256Hex(body)
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`
  const canonicalHeaders = [
    `host:${url.host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
  ].join('\n')
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date'
  const canonicalRequest = [
    'PUT',
    url.pathname,
    '',
    `${canonicalHeaders}\n`,
    signedHeaders,
    payloadHash,
  ].join('\n')
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    toSha256Hex(canonicalRequest),
  ].join('\n')
  const signature = hmac(getR2SigningKey(dateStamp), stringToSign, 'hex')
  const authorization = `AWS4-HMAC-SHA256 Credential=${r2AccessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: authorization,
      'Content-Type': contentType,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
    },
    body,
  })

  if (!response.ok) {
    const details = await response.text().catch(() => '')
    throw new Error(`อัปโหลดไป Cloudflare R2 ไม่สำเร็จ (${response.status})${details ? `: ${details}` : ''}`)
  }

  return `${r2PublicBaseUrl}/${key}`
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
        '-threads',
        String(ffmpegThreads),
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

const splitAudioForTranscription = async (inputPath, chunkSeconds = transcriptionChunkSeconds) => {
  const fileInfo = await stat(inputPath)

  if (fileInfo.size <= maxAutoTranscribeVideoBytes) {
    return [inputPath]
  }

  await ensureUploadsDir()
  const chunkDir = path.join(uploadsTempDir, `chunks-${crypto.randomUUID()}`)
  await mkdir(chunkDir, { recursive: true })
  const outputPattern = path.join(chunkDir, 'chunk-%03d.m4a')

  await new Promise((resolve, reject) => {
    const ffmpeg = spawn(
      ffmpegBinary,
      [
        '-y',
        '-i',
        inputPath,
        '-vn',
        '-ac',
        '1',
        '-ar',
        '16000',
        '-c:a',
        'aac',
        '-b:a',
        '64k',
        '-f',
        'segment',
        '-segment_time',
        String(chunkSeconds),
        '-reset_timestamps',
        '1',
        outputPattern,
      ],
      { stdio: ['ignore', 'ignore', 'pipe'] },
    )

    let errorOutput = ''
    ffmpeg.stderr.on('data', (chunk) => {
      errorOutput += String(chunk)
    })
    ffmpeg.on('error', reject)
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve(undefined)
        return
      }

      reject(new Error(`ไม่สามารถแบ่งไฟล์เสียงสำหรับ AI ได้${errorOutput ? `: ${errorOutput.trim()}` : ''}`))
    })
  })

  const { readdir } = await import('node:fs/promises')
  const chunkFiles = (await readdir(chunkDir))
    .filter((fileName) => fileName.endsWith('.m4a'))
    .sort()
    .map((fileName) => path.join(chunkDir, fileName))

  if (!chunkFiles.length) throw new Error('ไม่พบไฟล์เสียงที่แบ่งสำหรับ AI')

  return chunkFiles
}

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

const isBrowserFriendlyMp4 = (streams) => {
  const videoStream = streams.find((stream) => stream.codec_type === 'video')
  const audioStream = streams.find((stream) => stream.codec_type === 'audio')
  const videoCodec = String(videoStream?.codec_name ?? '').toLowerCase()
  const audioCodec = String(audioStream?.codec_name ?? '').toLowerCase()

  return videoCodec === 'h264' && (!audioStream || ['aac', 'mp3'].includes(audioCodec))
}

const getLocalUploadPath = (fileUrl) => {
  if (!fileUrl || !String(fileUrl).startsWith('/uploads/')) return null

  const fileName = path.basename(String(fileUrl))
  return path.join(uploadsDir, fileName)
}

const isRemoteHttpUrl = (value) => /^https?:\/\//i.test(String(value ?? ''))

const downloadRemoteFile = async (fileUrl) => {
  await ensureUploadsDir()

  const response = await fetch(fileUrl)

  if (!response.ok) {
    throw new Error(`ไม่สามารถดาวน์โหลดไฟล์วิดีโอจาก storage ได้ (${response.status})`)
  }

  const extension = path.extname(new URL(fileUrl).pathname) || '.mp4'
  const tempPath = path.join(uploadsTempDir, `remote-${crypto.randomUUID()}${extension}`)
  const bytes = Buffer.from(await response.arrayBuffer())
  await writeFile(tempPath, bytes)

  return tempPath
}

const downloadRemoteFileWithLimit = async (fileUrl, { maxBytes = maxAutoTranscribeVideoBytes } = {}) => {
  await ensureUploadsDir()

  const response = await fetch(fileUrl)

  if (!response.ok) {
    throw new Error(`Cannot download remote video (${response.status})`)
  }

  const contentLength = Number(response.headers.get('content-length') ?? 0)
  if (contentLength && contentLength > maxBytes) {
    throw new Error(`Remote video is larger than ${Math.round(maxBytes / 1024 / 1024)}MB`)
  }

  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.byteLength > maxBytes) {
    throw new Error(`Remote video is larger than ${Math.round(maxBytes / 1024 / 1024)}MB`)
  }

  const extension = path.extname(new URL(fileUrl).pathname) || '.mp4'
  const tempPath = path.join(uploadsTempDir, `remote-${crypto.randomUUID()}${extension}`)
  await writeFile(tempPath, bytes)

  return tempPath
}

const downloadRemoteFileStreamWithLimit = async (fileUrl, { maxBytes, extension: forcedExtension } = {}) => {
  await ensureUploadsDir()

  const response = await fetch(fileUrl)

  if (!response.ok || !response.body) {
    throw new Error(`Cannot download remote media (${response.status})`)
  }

  const contentLength = Number(response.headers.get('content-length') ?? 0)
  if (contentLength && maxBytes && contentLength > maxBytes) {
    throw new Error(`Remote media is larger than ${Math.round(maxBytes / 1024 / 1024)}MB`)
  }

  const extension = forcedExtension || path.extname(new URL(fileUrl).pathname) || '.m4a'
  const tempPath = path.join(uploadsTempDir, `remote-${crypto.randomUUID()}${extension}`)
  let downloadedBytes = 0

  const limitedStream = new TransformStream({
    transform(chunk, controller) {
      downloadedBytes += chunk.byteLength

      if (maxBytes && downloadedBytes > maxBytes) {
        controller.error(new Error(`Remote media is larger than ${Math.round(maxBytes / 1024 / 1024)}MB`))
        return
      }

      controller.enqueue(chunk)
    },
  })

  try {
    await pipeline(response.body.pipeThrough(limitedStream), createWriteStream(tempPath))
    return tempPath
  } catch (error) {
    await unlink(tempPath).catch(() => {})
    throw error
  }
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
ถอดเสียงพูดจากวิดีโอนี้เป็นภาษาไทย พร้อม timestamp เพื่อใช้ทำ AI Summary แบบอ้างอิงเวลา

กติกา:
- ถอดเฉพาะคำพูดที่ได้ยินจริง ห้ามแต่งเนื้อหาเพิ่ม
- ใส่ timestamp ทุกช่วงที่ผู้พูดเริ่มประเด็นใหม่ หรืออย่างน้อยทุก 15-30 วินาที
- รูปแบบแต่ละบรรทัดต้องเป็น: [MM:SS] คำพูดที่ได้ยิน
- ถ้าเสียงไม่ชัดให้ใส่ [ไม่ชัดเจน] เฉพาะจุดนั้น
- ส่งกลับเฉพาะ transcript ไม่ต้องสรุป
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

const transcribeMediaWithGemini = async (absolutePath) => {
  const chunkPaths = await splitAudioForTranscription(absolutePath)
  const temporaryChunks = chunkPaths.filter((chunkPath) => chunkPath !== absolutePath)
  const transcripts = []

  try {
    for (let index = 0; index < chunkPaths.length; index += 1) {
      const chunkTranscript = await transcribeVideoWithGemini(chunkPaths[index])
      transcripts.push(
        chunkPaths.length > 1
          ? `ช่วงที่ ${index + 1}\n${chunkTranscript.trim()}`
          : chunkTranscript.trim(),
      )
    }
  } finally {
    await Promise.all(temporaryChunks.map((chunkPath) => unlink(chunkPath).catch(() => {})))
  }

  return transcripts.filter(Boolean).join('\n\n').trim()
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

const updateLessonAiStatus = async (lessonId, status, errorMessage = null) => {
  await query(
    `
      UPDATE lessons
      SET ai_status = $1, ai_error = $2
      WHERE id = $3
    `,
    [status, errorMessage, lessonId],
  )
}

const autoTranscribeLesson = async (lessonId, videoUrl) => {
  if (aiProvider !== 'gemini') {
    console.warn(`Skip transcript for lesson ${lessonId}: AI_PROVIDER is not gemini`)
    await updateLessonAiStatus(lessonId, 'failed', 'AI_PROVIDER is not gemini')
    return
  }

  let absolutePath = getLocalUploadPath(videoUrl)
  let shouldDeleteTempFile = false

  try {
    await updateLessonAiStatus(lessonId, 'processing', null)

    if (!absolutePath && isMuxVideoUrl(videoUrl)) {
      absolutePath = await downloadMuxPlaybackForGemini(videoUrl)
      shouldDeleteTempFile = Boolean(absolutePath)
    } else if (!absolutePath && isRemoteHttpUrl(videoUrl)) {
      absolutePath = await downloadRemoteFileStreamWithLimit(videoUrl, {
        maxBytes: muxAudioDownloadMaxBytes,
        extension: path.extname(new URL(videoUrl).pathname) || '.mp4',
      })
      shouldDeleteTempFile = true
    }

    if (!absolutePath) {
      await updateLessonAiStatus(lessonId, 'failed', 'ไม่พบไฟล์วิดีโอสำหรับถอดสคริปต์')
      return
    }

    const transcript = await transcribeMediaWithGemini(absolutePath)
    await saveLessonTranscript(lessonId, transcript, 'gemini')
    await updateLessonAiStatus(lessonId, 'ready', null)
    console.log(`Generated Gemini transcript for lesson ${lessonId}`)
  } catch (error) {
    console.error(`Failed to generate Gemini transcript for lesson ${lessonId}`, error)
    await updateLessonAiStatus(
      lessonId,
      'failed',
      error instanceof Error ? error.message : 'AI transcription failed',
    )
  } finally {
    if (shouldDeleteTempFile && absolutePath) {
      await unlink(absolutePath).catch(() => {})
    }
  }
}

const queueAutoTranscribeLesson = (lessonId, videoUrl) => {
  if (!videoUrl) return
  if (!autoTranscribeLessons) return

  updateLessonAiStatus(lessonId, 'pending', null).catch((error) => {
    console.error(`Failed to mark transcript pending for lesson ${lessonId}`, error)
  })

  setTimeout(() => {
    autoTranscribeLesson(lessonId, videoUrl).catch((error) => {
      console.error(`Failed to queue transcript for lesson ${lessonId}`, error)
    })
  }, 0)
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

const readRawBody = async (request, maxBytes = maxRawUploadBytes) =>
  new Promise((resolve, reject) => {
    const chunks = []
    let totalBytes = 0

    request.on('data', (chunk) => {
      totalBytes += chunk.length

      if (totalBytes > maxBytes) {
        const error = new Error(`ไฟล์วิดีโอต้องไม่เกิน ${Math.round(maxVideoUploadBytes / 1024 / 1024)}MB`)
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
  const boundaryToken = Buffer.from(`--${boundary}`)
  const headerSeparator = Buffer.from('\r\n\r\n')
  const fields = {}
  let filePart = null
  let cursor = 0

  while (cursor < buffer.length) {
    const boundaryStart = buffer.indexOf(boundaryToken, cursor)
    if (boundaryStart === -1) break

    let segmentStart = boundaryStart + boundaryToken.length

    if (buffer[segmentStart] === 45 && buffer[segmentStart + 1] === 45) break
    if (buffer[segmentStart] === 13 && buffer[segmentStart + 1] === 10) segmentStart += 2

    const nextBoundaryStart = buffer.indexOf(boundaryToken, segmentStart)
    if (nextBoundaryStart === -1) break

    let segmentEnd = nextBoundaryStart
    if (buffer[segmentEnd - 2] === 13 && buffer[segmentEnd - 1] === 10) segmentEnd -= 2

    const segment = buffer.subarray(segmentStart, segmentEnd)
    cursor = nextBoundaryStart

    const headerEnd = segment.indexOf(headerSeparator)
    if (headerEnd === -1) continue

    const headerText = segment.subarray(0, headerEnd).toString('latin1')
    const bodyBuffer = segment.subarray(headerEnd + headerSeparator.length)
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
        buffer: bodyBuffer,
      }
    } else {
      fields[fieldName] = bodyBuffer.toString('utf8')
    }

  }

  return { fields, filePart }
}

const writeRequestBodyToFile = async (request, absolutePath, maxBytes = maxVideoUploadBytes) =>
  new Promise((resolve, reject) => {
    const output = createWriteStream(absolutePath)
    let totalBytes = 0
    let settled = false

    const finishWithError = (error) => {
      if (settled) return
      settled = true
      output.destroy()
      request.destroy()
      reject(error)
    }

    output.on('error', finishWithError)
    output.on('drain', () => request.resume())
    output.on('finish', () => {
      if (settled) return
      settled = true
      resolve(totalBytes)
    })

    request.on('data', (chunk) => {
      totalBytes += chunk.length

      if (totalBytes > maxBytes) {
        const error = new Error(`วิดีโอต้องไม่เกิน ${Math.round(maxVideoUploadBytes / 1024 / 1024)}MB`)
        error.statusCode = 413
        finishWithError(error)
        return
      }

      if (!output.write(chunk)) request.pause()
    })
    request.on('end', () => output.end())
    request.on('error', finishWithError)
    request.on('aborted', () => {
      const error = new Error('การอัปโหลดถูกยกเลิก')
      error.statusCode = 499
      finishWithError(error)
    })
  })

const persistUploadedVideoPath = async ({ fileName, mimeType, absolutePath, size }) => {
  if (mimeType !== 'video/mp4') {
    await unlink(absolutePath).catch(() => {})
    return { statusCode: 400, payload: { message: 'รองรับวิดีโอ MP4 เท่านั้น' } }
  }

  if (size > maxVideoUploadBytes) {
    await unlink(absolutePath).catch(() => {})
    return {
      statusCode: 400,
      payload: { message: `วิดีโอต้องไม่เกิน ${Math.round(maxVideoUploadBytes / 1024 / 1024)}MB` },
    }
  }

  const safeBaseName = path
    .basename(fileName)
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/^-|-$/g, '')
  const extension = path.extname(safeBaseName) || '.mp4'
  const outputFileName = `video-${Date.now()}-${crypto.randomUUID()}.mp4`
  const outputPath = path.join(r2StorageEnabled ? uploadsTempDir : uploadsDir, outputFileName)
  let tempInputPath = absolutePath
  let storedVideoPath = absolutePath

  try {
    if (transcodeUploadedVideos) {
      let canReuseOriginal = false

      try {
        canReuseOriginal = isBrowserFriendlyMp4(await probeVideoStreams(tempInputPath))
      } catch (error) {
        console.warn('Could not inspect uploaded video codec, transcoding instead', error)
      }

      if (canReuseOriginal) {
        storedVideoPath = tempInputPath
      } else {
        await transcodeVideoToMp4(tempInputPath, outputPath)
        storedVideoPath = outputPath
      }
    }

    if (validateUploadedVideos) {
      try {
        const finalStreams = await probeVideoStreams(storedVideoPath)
        const videoStream = finalStreams.find((stream) => stream.codec_type === 'video')

        if (!videoStream || !isBrowserFriendlyMp4(finalStreams)) {
          throw new Error('ไม่พบ video stream')
        }
      } catch (error) {
        const invalidVideoError = new Error(
          'ไฟล์วิดีโอไม่สมบูรณ์หรือ browser อ่านภาพไม่ได้ กรุณา export เป็น MP4 แบบ H.264/AAC แล้วอัปโหลดใหม่',
        )
        invalidVideoError.statusCode = 400
        throw invalidVideoError
      }
    }

    if (r2StorageEnabled) {
      try {
        const uploadedUrl = await putObjectToR2({
          key: `videos/${outputFileName}`,
          contentType: 'video/mp4',
          body: await readFile(storedVideoPath),
        })

        return {
          statusCode: 201,
          payload: {
            data: {
              kind: 'video',
              fileName: outputFileName,
              fileUrl: uploadedUrl,
              storage: 'r2',
            },
          },
        }
      } finally {
        await unlink(storedVideoPath).catch(() => {})
      }
    }

    if (storedVideoPath !== outputPath) {
      await rename(storedVideoPath, outputPath)
      tempInputPath = ''
      storedVideoPath = outputPath
    }

    return {
      statusCode: 201,
      payload: {
        data: {
          kind: 'video',
          fileName: outputFileName,
          fileUrl: `/uploads/${outputFileName}`,
          storage: 'local',
        },
      },
    }
  } finally {
    if (tempInputPath) {
      await unlink(tempInputPath).catch(() => {})
    }
    if (storedVideoPath !== outputPath && storedVideoPath !== tempInputPath) {
      await unlink(storedVideoPath).catch(() => {})
    }
  }
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

  const maxBytes = kind === 'video' ? maxVideoUploadBytes : maxImageUploadBytes

  if (buffer.byteLength > maxBytes) {
    return {
      statusCode: 400,
      payload: {
        message:
          kind === 'video'
            ? `วิดีโอต้องไม่เกิน ${Math.round(maxVideoUploadBytes / 1024 / 1024)}MB`
            : `รูปต้องไม่เกิน ${Math.round(maxImageUploadBytes / 1024 / 1024)}MB`,
      },
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
    let tempInputPath = path.join(uploadsTempDir, `input-${crypto.randomUUID()}${extension}`)
    const outputFileName = `${kind}-${Date.now()}-${crypto.randomUUID()}.mp4`
    const outputPath = path.join(r2StorageEnabled ? uploadsTempDir : uploadsDir, outputFileName)
    let storedVideoPath = outputPath

    await writeFile(tempInputPath, buffer)

    try {
      let canReuseOriginal = !transcodeUploadedVideos

      if (transcodeUploadedVideos) {
        try {
          canReuseOriginal = isBrowserFriendlyMp4(await probeVideoStreams(tempInputPath))
        } catch (error) {
          console.warn('Could not inspect uploaded video codec, transcoding instead', error)
        }
      }

      if (canReuseOriginal) {
        if (r2StorageEnabled) {
          storedVideoPath = tempInputPath
        } else {
          await rename(tempInputPath, outputPath)
          tempInputPath = ''
        }
      } else {
        await transcodeVideoToMp4(tempInputPath, outputPath)
      }
    } finally {
      if (tempInputPath && storedVideoPath !== tempInputPath) {
        await unlink(tempInputPath).catch(() => {})
      }
    }

    try {
      const finalStreams = await probeVideoStreams(storedVideoPath)
      const videoStream = finalStreams.find((stream) => stream.codec_type === 'video')

      if (!videoStream || !isBrowserFriendlyMp4(finalStreams)) {
        throw new Error('ไม่พบ video stream')
      }
    } catch (error) {
      await unlink(storedVideoPath).catch(() => {})
      const invalidVideoError = new Error(
        'ไฟล์วิดีโอไม่สมบูรณ์หรือ browser อ่านภาพไม่ได้ กรุณา export เป็น MP4 แบบ H.264/AAC แล้วอัปโหลดใหม่',
      )
      invalidVideoError.statusCode = 400
      throw invalidVideoError
    }

    if (r2StorageEnabled) {
      try {
        const uploadedUrl = await putObjectToR2({
          key: `videos/${outputFileName}`,
          contentType: 'video/mp4',
          body: await readFile(storedVideoPath),
        })

        return {
          statusCode: 201,
          payload: {
            data: {
              kind,
              fileName: outputFileName,
              fileUrl: uploadedUrl,
              storage: 'r2',
            },
          },
        }
      } finally {
        await unlink(storedVideoPath).catch(() => {})
      }
    }

    return {
      statusCode: 201,
      payload: {
        data: {
          kind,
          fileName: outputFileName,
          fileUrl: `/uploads/${outputFileName}`,
          storage: 'local',
        },
      },
    }
  }

  if (r2StorageEnabled) {
    const uploadedUrl = await putObjectToR2({
      key: `${kind}s/${finalFileName}`,
      contentType: mimeType,
      body: buffer,
    })

    return {
      statusCode: 201,
      payload: {
        data: {
          kind,
          fileName: finalFileName,
          fileUrl: uploadedUrl,
          storage: 'r2',
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
        storage: 'local',
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
  const contentLength = Number(request.headers['content-length'] ?? 0)

  if (contentLength > maxRawUploadBytes) {
    return {
      statusCode: 413,
      payload: { message: `ไฟล์วิดีโอต้องไม่เกิน ${Math.round(maxVideoUploadBytes / 1024 / 1024)}MB` },
    }
  }

  if (contentType.includes('multipart/form-data')) {
    if (contentLength > maxImageUploadBytes + 1024 * 1024) {
      return {
        statusCode: 400,
        payload: {
          message: 'กรุณารีเฟรชหน้าเว็บแล้วอัปโหลดวิดีโอใหม่ ระบบจะใช้โหมดอัปโหลดไฟล์ใหญ่ที่ไม่กิน RAM',
        },
      }
    }

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

const saveVideoUploadStream = async (request) => {
  const authUser = await getAuthUser(request)

  if (!authUser) {
    return { statusCode: 401, payload: { message: 'กรุณาเข้าสู่ระบบก่อนอัปโหลดไฟล์' } }
  }

  if (!['teacher', 'admin'].includes(authUser.role)) {
    return { statusCode: 403, payload: { message: 'บัญชีนี้ไม่มีสิทธิ์อัปโหลดไฟล์คอร์ส' } }
  }

  const contentType = String(request.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase()
  const contentLength = Number(request.headers['content-length'] ?? 0)

  if (contentLength > maxVideoUploadBytes) {
    return {
      statusCode: 413,
      payload: { message: `วิดีโอต้องไม่เกิน ${Math.round(maxVideoUploadBytes / 1024 / 1024)}MB` },
    }
  }

  if (contentType !== 'video/mp4') {
    return { statusCode: 400, payload: { message: 'รองรับวิดีโอ MP4 เท่านั้น' } }
  }

  await ensureUploadsDir()

  const fileName = decodeURIComponent(String(request.headers['x-file-name'] ?? 'video.mp4')).trim() || 'video.mp4'
  const tempPath = path.join(uploadsTempDir, `stream-${crypto.randomUUID()}.mp4`)

  try {
    const size = await writeRequestBodyToFile(request, tempPath, maxVideoUploadBytes)

    return persistUploadedVideoPath({
      fileName,
      mimeType: contentType,
      absolutePath: tempPath,
      size,
    })
  } catch (error) {
    await unlink(tempPath).catch(() => {})
    throw error
  }
}

const authorizeCourseAssetUpload = async (request) => {
  const authUser = await getAuthUser(request)

  if (!authUser) {
    return {
      authUser: null,
      error: { statusCode: 401, payload: { message: 'กรุณาเข้าสู่ระบบก่อนอัปโหลดไฟล์' } },
    }
  }

  if (!['teacher', 'admin'].includes(authUser.role)) {
    return {
      authUser,
      error: { statusCode: 403, payload: { message: 'บัญชีนี้ไม่มีสิทธิ์อัปโหลดไฟล์คอร์ส' } },
    }
  }

  return { authUser, error: null }
}

const muxRequest = async (pathName, { method = 'GET', body } = {}) => {
  if (!muxUploadEnabled) {
    const error = new Error('ยังไม่ได้ตั้งค่า MUX_TOKEN_ID และ MUX_TOKEN_SECRET ใน backend/.env')
    error.statusCode = 501
    throw error
  }

  const response = await fetch(`https://api.mux.com/video/v1${pathName}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${muxTokenId}:${muxTokenSecret}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    const messages = payload.error?.messages
    const message = Array.isArray(messages)
      ? messages.join(', ')
      : payload.error?.message || payload.message || 'Mux API request failed'
    const error = new Error(message)
    error.statusCode = response.status
    throw error
  }

  return payload.data
}

const createMuxDirectUpload = async (request) => {
  const { error } = await authorizeCourseAssetUpload(request)
  if (error) return error

  const body = await readBody(request)
  const fileName = String(body.fileName ?? 'lesson-video').trim() || 'lesson-video'
  const fileSize = Number(body.fileSize ?? 0)

  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    return { statusCode: 400, payload: { message: 'ข้อมูลวิดีโอไม่ครบ' } }
  }

  if (fileSize > maxVideoUploadBytes) {
    return {
      statusCode: 413,
      payload: { message: `วิดีโอต้องไม่เกิน ${Math.round(maxVideoUploadBytes / 1024 / 1024)}MB` },
    }
  }

  try {
    const upload = await muxRequest('/uploads', {
      method: 'POST',
      body: {
        cors_origin: muxCorsOrigin,
        timeout: muxUploadTimeoutSeconds,
        test: muxTestUploads,
        new_asset_settings: {
          playback_policies: ['public'],
          video_quality: muxVideoQuality,
          static_renditions: [
            {
              resolution: 'audio-only',
            },
          ],
          meta: {
            title: fileName,
          },
        },
      },
    })

    return {
      statusCode: 201,
      payload: {
        data: {
          provider: 'mux',
          uploadId: upload.id,
          uploadUrl: upload.url,
          timeout: upload.timeout,
          status: upload.status,
        },
      },
    }
  } catch (currentError) {
    return {
      statusCode: currentError.statusCode ?? 502,
      payload: { message: currentError.message },
    }
  }
}

const getMuxDirectUploadStatus = async (request, uploadId) => {
  const { error } = await authorizeCourseAssetUpload(request)
  if (error) return error

  if (!uploadId || !/^[a-zA-Z0-9_-]+$/.test(uploadId)) {
    return { statusCode: 400, payload: { message: 'Mux upload id ไม่ถูกต้อง' } }
  }

  try {
    const upload = await muxRequest(`/uploads/${encodeURIComponent(uploadId)}`)
    let asset = null
    let playbackId = null

    if (upload.asset_id) {
      asset = await muxRequest(`/assets/${encodeURIComponent(upload.asset_id)}`)
      playbackId = asset.playback_ids?.find((item) => item.policy === 'public')?.id ?? asset.playback_ids?.[0]?.id ?? null
    }

    return {
      statusCode: 200,
      payload: {
        data: {
          provider: 'mux',
          uploadId: upload.id,
          status: upload.status,
          assetId: upload.asset_id ?? undefined,
          assetStatus: asset?.status ?? undefined,
          playbackId: playbackId ?? undefined,
          playbackUrl: playbackId ? `https://player.mux.com/${playbackId}` : undefined,
          error: upload.error?.message ?? asset?.errors?.messages?.join(', ') ?? undefined,
        },
      },
    }
  } catch (currentError) {
    return {
      statusCode: currentError.statusCode ?? 502,
      payload: { message: currentError.message },
    }
  }
}

const isSafeR2VideoKey = (key) => /^videos\/video-\d+-[0-9a-f-]+\.mp4$/i.test(key)

const normalizeR2MultipartParts = (parts) => {
  if (!Array.isArray(parts) || parts.length === 0) return null

  const normalizedParts = []
  const seenPartNumbers = new Set()

  for (const part of parts) {
    const partNumber = Number(part?.partNumber)
    const rawEtag = String(part?.etag ?? '').trim()

    if (
      !Number.isInteger(partNumber) ||
      partNumber < 1 ||
      partNumber > 10000 ||
      !rawEtag ||
      seenPartNumbers.has(partNumber)
    ) {
      return null
    }

    seenPartNumbers.add(partNumber)
    normalizedParts.push({
      partNumber,
      etag: rawEtag.startsWith('"') ? rawEtag : `"${rawEtag}"`,
    })
  }

  return normalizedParts.sort((left, right) => left.partNumber - right.partNumber)
}

const startR2MultipartVideoUpload = async (request) => {
  const { error } = await authorizeCourseAssetUpload(request)
  if (error) return error

  const r2ReadyError = ensureR2MultipartReady()
  if (r2ReadyError) return r2ReadyError

  const body = await readBody(request)
  const fileName = String(body.fileName ?? '').trim()
  const mimeType = String(body.mimeType ?? '').trim().toLowerCase()
  const fileSize = Number(body.fileSize ?? 0)
  const isMp4 = mimeType === 'video/mp4' || fileName.toLowerCase().endsWith('.mp4')

  if (String(body.kind ?? 'video') !== 'video' || !fileName || !Number.isFinite(fileSize) || fileSize <= 0) {
    return { statusCode: 400, payload: { message: 'ข้อมูลวิดีโอไม่ครบ' } }
  }

  if (!isMp4) {
    return { statusCode: 400, payload: { message: 'รองรับวิดีโอ MP4 เท่านั้น' } }
  }

  if (fileSize > maxVideoUploadBytes) {
    return {
      statusCode: 413,
      payload: { message: `วิดีโอต้องไม่เกิน ${Math.round(maxVideoUploadBytes / 1024 / 1024)}MB` },
    }
  }

  const outputFileName = `video-${Date.now()}-${crypto.randomUUID()}.mp4`
  const key = `videos/${outputFileName}`
  const uploadId = await getR2MultipartUploadId({ key, contentType: 'video/mp4' })

  return {
    statusCode: 201,
    payload: {
      data: {
        kind: 'video',
        key,
        uploadId,
        fileName: outputFileName,
        fileUrl: `${r2PublicBaseUrl}/${key}`,
        partSize: r2MultipartPartSize,
        maxBytes: maxVideoUploadBytes,
        storage: 'r2',
      },
    },
  }
}

const signR2MultipartVideoPart = async (request) => {
  const { error } = await authorizeCourseAssetUpload(request)
  if (error) return error

  const r2ReadyError = ensureR2MultipartReady()
  if (r2ReadyError) return r2ReadyError

  const body = await readBody(request)
  const key = String(body.key ?? '').trim()
  const uploadId = String(body.uploadId ?? '').trim()
  const partNumber = Number(body.partNumber)

  if (!isSafeR2VideoKey(key) || !uploadId || uploadId.length > 2048) {
    return { statusCode: 400, payload: { message: 'ข้อมูล multipart upload ไม่ถูกต้อง' } }
  }

  if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10000) {
    return { statusCode: 400, payload: { message: 'เลข part ไม่ถูกต้อง' } }
  }

  return {
    statusCode: 200,
    payload: {
      data: {
        url: createR2PresignedPartUrl({ key, uploadId, partNumber }),
        expiresIn: r2PresignExpiresSeconds,
      },
    },
  }
}

const finishR2MultipartVideoUpload = async (request) => {
  const { error } = await authorizeCourseAssetUpload(request)
  if (error) return error

  const r2ReadyError = ensureR2MultipartReady()
  if (r2ReadyError) return r2ReadyError

  const body = await readBody(request)
  const key = String(body.key ?? '').trim()
  const uploadId = String(body.uploadId ?? '').trim()
  const parts = normalizeR2MultipartParts(body.parts)

  if (!isSafeR2VideoKey(key) || !uploadId || uploadId.length > 2048 || !parts) {
    return { statusCode: 400, payload: { message: 'ข้อมูล multipart upload ไม่ครบ' } }
  }

  await completeR2MultipartUpload({ key, uploadId, parts })

  return {
    statusCode: 201,
    payload: {
      data: {
        kind: 'video',
        fileName: key.split('/').pop(),
        fileUrl: `${r2PublicBaseUrl}/${key}`,
        storage: 'r2',
      },
    },
  }
}

const cancelR2MultipartVideoUpload = async (request) => {
  const { error } = await authorizeCourseAssetUpload(request)
  if (error) return error

  const r2ReadyError = ensureR2MultipartReady()
  if (r2ReadyError) return r2ReadyError

  const body = await readBody(request)
  const key = String(body.key ?? '').trim()
  const uploadId = String(body.uploadId ?? '').trim()

  if (!isSafeR2VideoKey(key) || !uploadId || uploadId.length > 2048) {
    return { statusCode: 400, payload: { message: 'ข้อมูล multipart upload ไม่ถูกต้อง' } }
  }

  await abortR2MultipartUpload({ key, uploadId })

  return { statusCode: 200, payload: { data: { ok: true } } }
}

const inspectUploadedVideo = async (request, url) => {
  const { error } = await authorizeCourseAssetUpload(request)
  if (error) return error

  const fileUrl = String(url.searchParams.get('fileUrl') ?? '').trim()
  const absolutePath = getLocalUploadPath(fileUrl)

  if (!fileUrl || !absolutePath) {
    return { statusCode: 400, payload: { message: 'fileUrl ไม่ถูกต้อง' } }
  }

  try {
    await stat(absolutePath)
  } catch {
    return { statusCode: 404, payload: { message: 'ไม่พบไฟล์วิดีโอ' } }
  }

  try {
    const streams = await probeVideoStreams(absolutePath)
    const videoStream = streams.find((stream) => stream.codec_type === 'video')
    const audioStream = streams.find((stream) => stream.codec_type === 'audio')

    return {
      statusCode: 200,
      payload: {
        data: {
          fileUrl,
          exists: true,
          isBrowserFriendly: isBrowserFriendlyMp4(streams),
          videoCodec: String(videoStream?.codec_name ?? '').toLowerCase() || null,
          audioCodec: String(audioStream?.codec_name ?? '').toLowerCase() || null,
        },
      },
    }
  } catch {
    return {
      statusCode: 200,
      payload: {
        data: {
          fileUrl,
          exists: true,
          isBrowserFriendly: false,
          videoCodec: null,
          audioCodec: null,
        },
      },
    }
  }
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

const getManageableLesson = async (request, lessonId) => {
  const authUser = await getAuthUser(request)

  if (!authUser) {
    return {
      lesson: null,
      error: { statusCode: 401, payload: { message: 'Unauthorized' } },
    }
  }

  const result = await query(
    `
      SELECT l.id, l.title, l.video_url AS "videoUrl", c.teacher_id AS "teacherId"
      FROM lessons l
      JOIN courses c ON c.id = l.course_id
      WHERE l.id = $1
      LIMIT 1
    `,
    [lessonId],
  )
  const lesson = result.rows[0] ?? null

  if (!lesson) {
    return {
      lesson: null,
      error: { statusCode: 404, payload: { message: 'Lesson not found' } },
    }
  }

  if (authUser.role !== 'admin' && lesson.teacherId !== authUser.id) {
    return {
      lesson: null,
      error: { statusCode: 403, payload: { message: 'Forbidden' } },
    }
  }

  return { lesson, error: null }
}

const getAiAccessibleLesson = async (request, lessonId) => {
  const authUser = await getAuthUser(request)

  if (!authUser) {
    return {
      lesson: null,
      error: { statusCode: 401, payload: { message: 'Unauthorized' } },
    }
  }

  const result = await query(
    `
      SELECT
        l.id,
        l.title,
        l.video_url AS "videoUrl",
        c.id AS "courseId",
        c.teacher_id AS "teacherId",
        e.student_id AS "enrolledStudentId"
      FROM lessons l
      JOIN courses c ON c.id = l.course_id
      LEFT JOIN enrollments e ON e.course_id = c.id AND e.student_id = $2
      WHERE l.id = $1
      LIMIT 1
    `,
    [lessonId, authUser.id],
  )
  const lesson = result.rows[0] ?? null

  if (!lesson) {
    return {
      lesson: null,
      error: { statusCode: 404, payload: { message: 'Lesson not found' } },
    }
  }

  const canUseAi =
    authUser.role === 'admin' ||
    lesson.teacherId === authUser.id ||
    (authUser.role === 'student' && lesson.enrolledStudentId === authUser.id)

  if (!canUseAi) {
    return {
      lesson: null,
      error: { statusCode: 403, payload: { message: 'Forbidden' } },
    }
  }

  return { lesson, error: null }
}

const isMuxVideoUrl = (value) => {
  try {
    const hostname = new URL(String(value)).hostname.toLowerCase()
    return hostname === 'player.mux.com' || hostname === 'stream.mux.com'
  } catch {
    return false
  }
}

const getMuxPlaybackId = (value) => {
  try {
    const url = new URL(String(value))
    const hostname = url.hostname.toLowerCase()

    if (hostname === 'player.mux.com') {
      return url.pathname.split('/').filter(Boolean)[0] ?? null
    }

    if (hostname === 'stream.mux.com') {
      return (url.pathname.split('/').filter(Boolean)[0] ?? '').replace(/\.(m3u8|mp4)$/i, '') || null
    }
  } catch {
    return null
  }

  return null
}

const downloadMuxPlaybackForGemini = async (videoUrl) => {
  const playbackId = getMuxPlaybackId(videoUrl)
  if (!playbackId) return null

  const encodedPlaybackId = encodeURIComponent(playbackId)
  const candidates = [
    {
      url: `https://stream.mux.com/${encodedPlaybackId}/audio.m4a`,
      extension: '.m4a',
      maxBytes: muxAudioDownloadMaxBytes,
    },
    {
      url: `https://stream.mux.com/${encodedPlaybackId}/low.mp4`,
      extension: '.mp4',
      maxBytes: maxAutoTranscribeVideoBytes,
    },
  ]

  const maxAttempts = Math.max(1, Math.ceil(muxAudioWaitSeconds / 10))

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    for (const candidate of candidates) {
      try {
        return await downloadRemoteFileStreamWithLimit(candidate.url, {
          extension: candidate.extension,
          maxBytes: candidate.maxBytes,
        })
      } catch {
        // Try the next available Mux static rendition.
      }
    }

    if (attempt < maxAttempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, 10000))
    }
  }

  return null
}

const transcribeLessonVideo = async (request, lessonId) => {
  if (aiProvider !== 'gemini') {
    return { statusCode: 400, payload: { message: 'AI transcription requires AI_PROVIDER=gemini' } }
  }

  const { lesson, error } = await getAiAccessibleLesson(request, lessonId)
  if (error) return error

  const videoUrl = String(lesson.videoUrl ?? '').trim()
  if (!videoUrl) {
    return { statusCode: 400, payload: { message: 'Lesson video is required before transcription' } }
  }

  let absolutePath = getLocalUploadPath(videoUrl)
  let shouldDeleteTempFile = false

  try {
    if (!absolutePath && isMuxVideoUrl(videoUrl)) {
      absolutePath = await downloadMuxPlaybackForGemini(videoUrl)
      shouldDeleteTempFile = Boolean(absolutePath)
    }

    if (!absolutePath) {
      return {
        statusCode: 400,
        payload: {
          message:
            'AI ถอดสคริปต์ต้องมีไฟล์วิดีโอหรือเสียงที่ backend ดาวน์โหลดมาให้ Gemini อ่านได้ ตอนนี้ลิงก์วิดีโอนี้ไม่มีไฟล์ MP4 ที่ดาวน์โหลดได้โดยตรง กรุณาอัปโหลดไฟล์ต้นฉบับ หรือใช้วิดีโอที่มีไฟล์ MP4 playback ให้ AI อ่าน',
        },
      }
    }

    const transcript = await transcribeMediaWithGemini(absolutePath)
    await saveLessonTranscript(lessonId, transcript, 'gemini')

    return { statusCode: 200, payload: { data: { lessonId, transcript, source: 'gemini' } } }
  } catch (error) {
    console.error(`Failed to transcribe lesson ${lessonId}`, error)
    return {
      statusCode: 500,
      payload: { message: error instanceof Error ? error.message : 'Failed to transcribe lesson video' },
    }
  } finally {
    if (shouldDeleteTempFile && absolutePath) {
      await unlink(absolutePath).catch(() => {})
    }
  }
}

const summarizeLesson = async (lessonId) => {
  await ensureAiSchema()
  const lesson = await getLessonContent(lessonId)

  if (!lesson) return { statusCode: 404, payload: { message: 'Lesson not found' } }

  const hasTimestamp = /\[(?:\d{1,2}:)?\d{1,2}:\d{2}\]/.test(String(lesson.content ?? ''))
  const timestampRule = hasTimestamp
    ? '- ใช้ timestamp จาก transcript เท่านั้น ห้ามเดาเวลาใหม่'
    : '- transcript นี้ยังไม่มี timestamp ให้เขียนประโยคนี้ก่อน timeline: "ยังไม่มี timestamp ใน transcript จึงระบุนาทีแบบแม่นยำไม่ได้" ถ้ามี transcript ยาวพอ ให้แบ่งเป็น "ช่วงที่ 1", "ช่วงที่ 2" ตามลำดับเนื้อหาแทน'

  const prompt = `
คุณคือผู้ช่วย AI ภาษาไทย
สรุปบทเรียนนี้จาก transcript/summary ที่ให้มา โดยต้องช่วยผู้เรียนรู้ว่าแต่ละช่วงเวลาพูดอะไรแบบรายนาที

รูปแบบคำตอบที่ต้องการ:
1. ภาพรวมบทเรียน 1 ย่อหน้า
2. Timeline รายช่วงนาที
   - ถ้ามี timestamp ให้จัดกลุ่มเป็นช่วงเวลา เช่น [00:00-00:59], [01:00-01:59], [02:00-02:59]
   - สรุปให้ครอบคลุมทุกช่วงนาทีที่มีเนื้อหาสำคัญ ไม่จำกัดแค่ 5-8 ช่วง
   - ถ้าช่วงใดมี timestamp หลายจุด ให้รวมเป็นหนึ่งช่วงนาทีและสรุปใจความ 1-3 ประโยค
   - ยกคำพูดสั้น ๆ จาก transcript ได้เมื่อช่วยให้เข้าใจ แต่ต้องไม่แต่งคำพูดใหม่
   - ถ้าไม่ได้ยกคำพูดตรงจาก transcript ให้บอกว่าเป็นการสรุป ไม่ใช่คำพูดตรงในวิดีโอ
   - ถ้าบทเรียนยาวมาก ให้สรุปอย่างน้อย 12 ช่วง และไม่เกิน 40 ช่วง โดยยังเรียงตามเวลา
3. ประเด็นที่ควรจำ 3-5 ข้อ
4. วิเคราะห์เพิ่มเติมจาก AI
   - แยกจากเนื้อหาในบทเรียนอย่างชัดเจน
   - อธิบายว่าผู้เรียนควรเข้าใจต่อยอดอย่างไร
   - ยกตัวอย่างการใช้งานจริง 2-3 ตัวอย่าง
   - ระบุข้อควรระวังหรือข้อผิดพลาดที่พบบ่อย
   - แนะนำสิ่งที่ควรเรียนต่อหรือฝึกต่อ

กติกา:
${timestampRule}
- ถ้าข้อมูลเป็นเพียง summary สั้น ๆ และไม่มี transcript ให้บอกตรง ๆ ว่ายังสรุปรายช่วงนาทีไม่ได้เพราะไม่มี transcript
- ส่วน "ภาพรวม", "Timeline", และ "ประเด็นที่ควรจำ" ต้องยึดจาก transcript/summary เป็นหลัก
- ส่วน "วิเคราะห์เพิ่มเติมจาก AI" สามารถใช้ความรู้ทั่วไปเพื่ออธิบายต่อยอดได้ แต่ต้องไม่เขียนให้เหมือนเป็นคำพูดในวิดีโอ
- ห้ามใช้คำว่า "ครู" แทนตัว AI หรือทำให้เข้าใจว่าเป็นคำพูดของผู้สอน ถ้าเป็นคำแนะนำของ AI ให้ใช้ "ฉันแนะนำว่า..."
- ตอบเป็นภาษาไทย อ่านง่าย แต่ให้ละเอียดพอสำหรับใช้ทบทวนวิดีโอ

ชื่อบทเรียน: ${lesson.title}
ความยาวบทเรียน: ${lesson.duration ?? '-'}
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

  const lessonRelated = isLessonRelatedQuestion(question, lesson.title)
  const prompt = lessonRelated
    ? `
คำสั่งสำคัญสำหรับสไตล์คำตอบ:
- แทนตัวเองว่า "ฉัน" เท่านั้น ไม่ใช้คำว่า "ครู" เรียกตัวเอง
- ตอบเป็นธรรมชาติ อธิบายง่าย ๆ เหมือนคุยกับคนที่เพิ่งเริ่มเรียน
- อธิบายให้ผู้เรียนเข้าใจเหตุผลหรือความหมาย ไม่ใช่ตอบแค่สรุปสั้น ๆ
- ยกตัวอย่างเมื่อช่วยให้เข้าใจคำตอบได้ชัดขึ้น
- ตอบแบบละเอียดเป็นค่าเริ่มต้น ชัดเจน ถูกต้อง และครบประเด็นพอให้ผู้เรียนเข้าใจจริง
- ถ้าคำถามซับซ้อน ให้แบ่งเป็นหัวข้อ bullet หรือลำดับขั้นตอน
- ให้ตอบยาวและอธิบายเต็มที่ได้ โดยจัดย่อหน้าให้อ่านง่าย ไม่อัดเป็นก้อนเดียว

คุณคือผู้ช่วย AI ภาษาไทยที่คุยกับผู้เรียนอย่างเป็นกันเอง
ตอบคำถามได้ทั่วไป ไม่จำกัดเฉพาะเนื้อหาในบทเรียน
ถ้าคำถามเกี่ยวกับบทเรียน ให้ใช้ transcript/summary เป็นแหล่งข้อมูลหลักก่อน แล้วเสริมได้เมื่อช่วยให้เข้าใจ
ถ้าคำถามไม่เกี่ยวกับบทเรียน ให้ตอบจากความรู้ทั่วไปอย่างตรงไปตรงมา และห้ามโยงกลับไปหาเนื้อหาบทเรียน

น้ำเสียง:
- พูดเหมือนผู้ช่วยที่เข้าใจบทเรียน เป็นกันเอง สุภาพ และใจเย็น
- อธิบายให้เข้าใจง่าย ไม่ใช้ศัพท์ยากเกินจำเป็น
- ถ้ามีศัพท์เทคนิค ให้แปลเป็นภาษาง่าย ๆ ก่อน แล้วค่อยยกตัวอย่าง
- ถ้าคำตอบมีหลายขั้น ให้ไล่อธิบายทีละขั้น เพื่อให้ตามทัน
- ตอบตรงคำถามก่อน แล้วค่อยอธิบายเหตุผล วิธีคิด ตัวอย่าง ข้อควรระวัง และภาพรวมที่เกี่ยวข้อง
- ไม่ต้องอธิบายทั้งหมดของบทเรียน ให้ตอบเฉพาะสิ่งที่ผู้เรียนถาม
- ใช้คำพูดธรรมชาติ เช่น "ให้เข้าใจง่าย ๆ คือ...", "ตรงนี้หมายถึง...", "ฉันขอเสริมนิดเดียว..."
- ห้ามพูดเหมือนระบบ AI เช่น "ในฐานะ AI", "โมเดล", "ข้อมูลที่ให้มา", "จาก prompt"

รูปแบบคำตอบ:
- ไม่จำเป็นต้องใส่หัวข้อทุกครั้ง ให้ตอบเหมือนบทสนทนากับผู้ช่วย
- ถ้าคำถามง่าย ให้ยังอธิบายที่มา เหตุผล และตัวอย่างสั้น ๆ เพื่อให้เข้าใจ ไม่ตอบแค่คำตอบสุดท้าย
- ถ้าคำถามซับซ้อน ให้ใช้ bullet ขั้นตอน หรือหัวข้อย่อยเพื่อให้อ่านง่าย
- ถ้ายกตัวอย่าง ให้ขึ้นต้นว่า "เช่น" และเลือกตัวอย่างที่เข้าใจง่าย
- ถ้าเป็นเรื่องเรียน ให้จัดคำตอบแบบนี้เมื่อเหมาะสม: อธิบายหลักการ, วิธีคิดทีละขั้น, ตัวอย่าง, ข้อควรจำ, และ "สรุปง่าย ๆ" ท้ายคำตอบ
- ถ้าต้องแยกความรู้จากบทเรียนกับความรู้ทั่วไป ให้เขียนให้ชัด เช่น "ฉันสรุปจากบทเรียนว่า..." แล้ว "ฉันเสริมว่า..."
- ไม่ต้องปิดท้ายด้วยคำถาม เว้นแต่ผู้เรียนขอให้ช่วยฝึก

กติกา:
- ให้ตัดสินก่อนว่าคำถามเป็น "คำถามเกี่ยวกับบทเรียน" หรือ "คำถามทั่วไป"
- ถ้าเป็นคำถามทั่วไป เช่น กินอะไรดี, ช่วยคิดหน่อย, วางแผนชีวิต, แต่งเรื่อง, เขียนโค้ด, ข่าว, สุขภาพทั่วไป, การเงินทั่วไป, หรือเรื่องอื่นที่ไม่เกี่ยวกับบทเรียน ให้ตอบคำถามนั้นทันทีจากความรู้ทั่วไป
- สำหรับคำถามทั่วไป ห้ามตอบว่า "ในบทเรียนนี้ยังไม่มีข้อมูล", ห้ามถามกลับให้ผู้เรียนถามเรื่องบทเรียน, และห้ามฝืนโยงกลับเข้า transcript/summary
- ถ้าคำถามเกี่ยวกับบทเรียน ให้ยึดเนื้อหาบทเรียนเป็นหลักก่อน แล้วค่อยเสริมด้วยความรู้ทั่วไปเมื่อช่วยให้เข้าใจ
- ถ้าคำถามทั่วไปที่ไม่เกี่ยวกับบทเรียน ให้ตอบได้ตามปกติ ไม่ต้องฝืนโยงเข้าบทเรียน
- ห้ามใช้คำว่า "ครู" แทนตัว AI ในคำตอบ ให้ใช้ "ฉัน" เท่านั้น
- ถ้าต้องอ้างคำพูดจากบทเรียน ให้ยกคำพูดสั้น ๆ จาก transcript ในเครื่องหมายคำพูด แล้วอธิบายต่อด้วยภาษาของคุณ
- ถ้าไม่ได้ยกคำพูดตรงในเครื่องหมายคำพูด ให้บอกให้ชัดว่าเป็นการสรุปจากบทเรียน ไม่ใช่คำพูดตรงในคลิป
- ถ้าผู้เรียนถามเรื่องในบทเรียนโดยตรง แต่บทเรียนไม่มีข้อมูลส่วนนั้น ให้บอกว่า "ฉันไม่เห็นข้อมูลส่วนนี้ในบทเรียน" แล้วค่อยอธิบายด้วยความรู้ทั่วไปอย่างระมัดระวัง
- ห้ามแต่ง timestamp หรือแต่งคำพูดว่าอยู่ในวิดีโอถ้า transcript ไม่ได้ระบุไว้
- ให้ความยาวคำตอบมากพอสำหรับความเข้าใจ เน้นอธิบายละเอียด ชัดเจน และถูกต้องมากกว่าสั้น
- ถ้าคำถามต้องการคำอธิบาย ให้ขยายความอย่างละเอียด ไม่ตอบห้วนหรือข้ามขั้นตอนสำคัญ
- ห้ามสรุปทั้งบทเรียนถ้าผู้เรียนถามแค่จุดเดียว
- เขียนคำตอบยาวได้ แต่ต้องเป็นระเบียบ อ่านง่าย และเกี่ยวข้องกับคำถามโดยตรง

ชื่อบทเรียน: ${lesson.title}
เนื้อหา:
${lesson.content}

คำถาม: ${question}
`
    : `
คุณคือผู้ช่วย AI ภาษาไทยที่คุยกับผู้ใช้แบบเป็นกันเอง

กติกาสำคัญ:
- คำถามนี้เป็นคำถามทั่วไป ไม่เกี่ยวกับบทเรียน
- ห้ามพูดถึงบทเรียน คอร์ส คลิป วิดีโอ transcript หรือเนื้อหาที่เรียน
- ห้ามตอบว่า "ในบทเรียนนี้ยังไม่มีข้อมูล"
- ห้ามใช้คำว่า "ครู" แทนตัวเอง ให้แทนตัวเองว่า "ฉัน" เท่านั้น
- ตอบคำถามจากความรู้ทั่วไปอย่างตรงไปตรงมา เป็นธรรมชาติ และช่วยคิดให้ผู้ใช้จริง ๆ
- ถ้าคำถามสั้นหรือกำกวม ให้เดาบริบทแบบสมเหตุสมผลก่อน แล้วตอบให้ใช้งานได้ทันที
- ถ้าเกี่ยวกับเรื่องที่เปลี่ยนตามเวลา เช่น ข่าว ราคา หุ้น สภาพอากาศ หรือข้อมูลล่าสุด ให้บอกว่าควรตรวจข้อมูลล่าสุดประกอบ

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

  const savedQuestions = []

  for (const [questionIndex, question] of questions.entries()) {
    const questionId = `q-ai-${crypto.randomUUID()}`
    const savedQuestion = {
      id: questionId,
      question: String(question.question ?? ''),
      explanation: String(question.explanation ?? ''),
      options: [],
    }

    await query(
      `
        INSERT INTO quiz_questions (id, lesson_id, question, explanation, sort_order)
        VALUES ($1, $2, $3, $4, $5)
      `,
      [
        questionId,
        lessonId,
        savedQuestion.question,
        savedQuestion.explanation,
        questionIndex + 1,
      ],
    )

    for (const [optionIndex, option] of (question.options ?? []).entries()) {
      const optionId = `qo-ai-${crypto.randomUUID()}`
      const savedOption = {
        id: optionId,
        text: String(option.text ?? ''),
        isCorrect: Boolean(option.isCorrect),
      }

      await query(
        `
          INSERT INTO quiz_options (id, question_id, text, is_correct, sort_order)
          VALUES ($1, $2, $3, $4, $5)
        `,
        [
          optionId,
          questionId,
          savedOption.text,
          savedOption.isCorrect,
          optionIndex + 1,
        ],
      )
      savedQuestion.options.push(savedOption)
    }

    savedQuestions.push(savedQuestion)
  }

  await saveAiOutput({ lessonId, outputType: 'quiz', prompt, result: { questions: savedQuestions } })

  return { statusCode: 200, payload: { data: { questions: savedQuestions } } }
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

const requireRole = async (request, roles) => {
  const authUser = await getAuthUser(request)

  if (!authUser || !roles.includes(authUser.role)) {
    return {
      authUser: null,
      error: {
        statusCode: authUser ? 403 : 401,
        payload: { message: authUser ? 'Forbidden' : 'Unauthorized' },
      },
    }
  }

  return { authUser, error: null }
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

const loginIdentifierToEmail = (identifier) => {
  const normalized = String(identifier ?? '').trim().toLowerCase()
  const aliases = {
    admin: adminEmail,
    student: studentEmail,
    learner: studentEmail,
    'นักเรียน': studentEmail,
  }

  return aliases[normalized] ?? normalized
}

const login = async (request) => {
  const body = await readBody(request)
  const email = loginIdentifierToEmail(body.email)
  const password = String(body.password ?? '')
  const role = body.role ? String(body.role) : null

  if (!email || !password) {
    return { statusCode: 400, payload: { message: 'Email or username and password are required' } }
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
  status: row.status,
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

const getCourses = async ({ popular, teacherId, includeUnpublished = false } = {}) => {
  const clauses = []
  const values = []

  if (!includeUnpublished) {
    values.push('published')
    clauses.push(`c.status = $${values.length}`)
  }

  if (popular) {
    values.push(true)
    clauses.push(`c.is_popular = $${values.length}`)
  }

  if (teacherId) {
    values.push(teacherId)
    clauses.push(`c.teacher_id = $${values.length}`)
  }

  const result = await query(
    `${courseSelect}${clauses.length ? ` WHERE ${clauses.join(' AND ')}` : ''} ORDER BY c.updated_at DESC`,
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
        l.ai_status,
        l.ai_error,
        ai.ai_summary,
        (lt.lesson_id IS NOT NULL) AS has_transcript,
        q.id AS question_id,
        q.question,
        q.explanation,
        o.id AS option_id,
        o.text AS option_text,
        o.is_correct
      FROM lessons l
      LEFT JOIN LATERAL (
        SELECT result->>'summary' AS ai_summary
        FROM ai_outputs ao
        WHERE ao.lesson_id = l.id AND ao.output_type = 'summary'
        ORDER BY ao.created_at DESC
        LIMIT 1
      ) ai ON TRUE
      LEFT JOIN lesson_transcripts lt ON lt.lesson_id = l.id
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
        aiStatus: row.ai_status ?? 'idle',
        aiError: row.ai_error ?? null,
        aiSummary: row.ai_summary ?? null,
        hasTranscript: Boolean(row.has_transcript),
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

const getTeacherDashboardCourses = async (teacherId) => {
  const result = await query(
    `
      SELECT
        c.*,
        COUNT(l.id) OVER (PARTITION BY c.id)::int AS lesson_count,
        u.id AS instructor_id,
        u.name AS instructor_name,
        u.title AS instructor_title,
        u.bio AS instructor_bio,
        u.avatar_url AS instructor_avatar_url,
        u.rating AS instructor_rating,
        u.total_students AS instructor_total_students,
        l.id AS lesson_id,
        l.title AS lesson_title,
        l.duration AS lesson_duration,
        l.preview AS lesson_preview,
        l.video_url AS lesson_video_url,
        l.summary AS lesson_summary,
        l.ai_status AS lesson_ai_status,
        l.ai_error AS lesson_ai_error,
        (lt.lesson_id IS NOT NULL) AS lesson_has_transcript
      FROM courses c
      JOIN users u ON u.id = c.teacher_id
      LEFT JOIN lessons l ON l.course_id = c.id
      LEFT JOIN lesson_transcripts lt ON lt.lesson_id = l.id
      WHERE c.teacher_id = $1
      ORDER BY c.updated_at DESC, l.sort_order
    `,
    [teacherId],
  )

  const courseMap = new Map()

  for (const row of result.rows) {
    if (!courseMap.has(row.id)) {
      courseMap.set(row.id, {
        ...toCourseSummary(row),
        lessons: [],
      })
    }

    if (!row.lesson_id) continue

    courseMap.get(row.id).lessons.push({
      id: row.lesson_id,
      title: row.lesson_title,
      duration: row.lesson_duration,
      preview: row.lesson_preview,
      videoUrl: row.lesson_video_url ?? undefined,
      summary: row.lesson_summary,
      aiStatus: row.lesson_ai_status ?? 'idle',
      aiError: row.lesson_ai_error ?? null,
      aiSummary: null,
      hasTranscript: Boolean(row.lesson_has_transcript),
      quizQuestions: [],
    })
  }

  return Array.from(courseMap.values())
}

const getEnrollmentRecord = async (studentId, courseId) => {
  const result = await query(
    `
      SELECT course_id, progress, completed_lessons, last_lesson_id, last_accessed_at, joined_at
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
    lastAccessedAt: row.last_accessed_at,
    joinedAt: row.joined_at,
  }
}

const getCourseForViewer = async (slug, viewer) => {
  const course = await getCourseBySlug(slug)

  if (!course) return null

  const canManage =
    viewer?.role === 'admin' || (viewer?.role === 'teacher' && course.instructor.id === viewer.id)

  if (course.status !== 'published' && !canManage) return null

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
        e.last_accessed_at,
        e.joined_at,
        c.slug
      FROM enrollments e
      JOIN courses c ON c.id = e.course_id
      WHERE e.student_id = $1
      ORDER BY COALESCE(e.last_accessed_at, e.joined_at::timestamptz) DESC
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
        lastAccessedAt: enrollment.last_accessed_at,
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

const updateTeacherProfile = async (request) => {
  const authUser = await getAuthUser(request)

  if (!authUser || authUser.role !== 'teacher') {
    return { statusCode: 401, payload: { message: 'กรุณาเข้าสู่ระบบด้วยบัญชีคุณครู' } }
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

  return {
    user: toUser(user),
    profile: await getUserProfile(teacherId),
    courses: await getTeacherDashboardCourses(teacherId),
  }
}

const getAdminDashboard = async () => {
  const [usersResult, courses, statsResult] = await Promise.all([
    query(`
      SELECT
        u.*,
        COUNT(s.token)::int AS active_sessions,
        COALESCE(COUNT(s.token) > 0, false) AS is_online,
        MAX(s.created_at) AS last_seen_at
      FROM users u
      LEFT JOIN auth_sessions s ON s.user_id = u.id AND s.expires_at > NOW()
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `),
    getCourses({ includeUnpublished: true }),
    query(`
      SELECT
        COUNT(*)::int AS total_users,
        COUNT(*) FILTER (WHERE role = 'teacher')::int AS total_teachers,
        COUNT(*) FILTER (WHERE role = 'student')::int AS total_students,
        COUNT(DISTINCT s.user_id)::int AS active_users
      FROM users u
      LEFT JOIN auth_sessions s ON s.user_id = u.id AND s.expires_at > NOW()
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
      activeUsers: statsResult.rows[0].active_users,
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
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, 0, $11, false, 'draft', CURRENT_DATE)
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
        INSERT INTO lessons (id, course_id, title, duration, preview, video_url, summary, ai_status, ai_error, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL, 1)
      `,
      [
        lessonId,
        id,
        String(body.lessonTitle ?? 'บทเรียนที่ 1'),
        String(body.lessonDuration ?? '00:00'),
        Boolean(body.lessonPreview ?? true),
        body.videoUrl ? String(body.videoUrl) : null,
        String(body.lessonSummary ?? 'บทเรียนแรกของคอร์สนี้'),
        body.videoUrl ? 'pending' : 'idle',
      ],
    )

    if (body.videoUrl) queueAutoTranscribeLesson(lessonId, String(body.videoUrl))
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

  return { statusCode: 200, payload: { data: await getCourseBySlug(nextSlug) } }
}

const saveCourseLesson = async (request, slug, lessonId) => {
  const authUser = await getAuthUser(request)
  const permission = await getManageableCourseBySlug(slug, authUser)

  if (permission.statusCode !== 200) {
    return permission
  }

  const body = await readBody(request)
  const title = String(body.title ?? '').trim()
  const duration = String(body.duration ?? '').trim() || '00:00'
  const summary = String(body.summary ?? '').trim()
  const preview = Boolean(body.preview)
  const videoUrl = String(body.videoUrl ?? '').trim()

  if (!title) {
    return { statusCode: 400, payload: { message: 'กรุณากรอกชื่อบทเรียน' } }
  }

  if (lessonId) {
    const lessonResult = await query(
      `
        SELECT id
        FROM lessons
        WHERE id = $1 AND course_id = $2
        LIMIT 1
      `,
      [lessonId, permission.course.id],
    )

    if (!lessonResult.rows[0]) {
      return { statusCode: 404, payload: { message: 'Lesson not found' } }
    }

    await query(
      `
        UPDATE lessons
        SET
          title = $1,
          duration = $2,
          preview = $3,
          video_url = $4,
          summary = $5,
          ai_status = CASE WHEN $4::text IS NULL OR $4::text = '' THEN 'idle' ELSE 'pending' END,
          ai_error = NULL
        WHERE id = $6
      `,
      [title, duration, preview, videoUrl || null, summary, lessonId],
    )

    if (videoUrl) queueAutoTranscribeLesson(lessonId, videoUrl)
  } else {
    const sortResult = await query(
      'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort_order FROM lessons WHERE course_id = $1',
      [permission.course.id],
    )
    const nextLessonId = `lesson-${crypto.randomUUID()}`

    await query(
      `
        INSERT INTO lessons (id, course_id, title, duration, preview, video_url, summary, ai_status, ai_error, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL, $9)
      `,
      [
        nextLessonId,
        permission.course.id,
        title,
        duration,
        preview,
        videoUrl || null,
        summary,
        videoUrl ? 'pending' : 'idle',
        Number(sortResult.rows[0].next_sort_order),
      ],
    )

    if (videoUrl) queueAutoTranscribeLesson(nextLessonId, videoUrl)
  }

  return { statusCode: 200, payload: { data: await getCourseBySlug(permission.course.slug) } }
}

const updateCourseStatus = async (request, slug) => {
  const authUser = await getAuthUser(request)
  const permission = await getManageableCourseBySlug(slug, authUser)

  if (permission.statusCode !== 200) {
    return permission
  }

  const body = await readBody(request)
  const status = String(body.status ?? '').trim()

  if (!['draft', 'published', 'hidden'].includes(status)) {
    return { statusCode: 400, payload: { message: 'สถานะคอร์สไม่ถูกต้อง' } }
  }

  if (status === 'published' && authUser.role !== 'admin') {
    return { statusCode: 403, payload: { message: 'คอร์สฉบับร่างต้องรอแอดมินตรวจสอบและอนุมัติก่อนเผยแพร่' } }
  }

  await query('UPDATE courses SET status = $1, updated_at = CURRENT_DATE WHERE id = $2', [
    status,
    permission.course.id,
  ])

  return { statusCode: 200, payload: { data: await getCourseBySlug(permission.course.slug) } }
}

const updateCoursePopularity = async (request, slug) => {
  const authUser = await getAuthUser(request)

  if (!authUser || authUser.role !== 'admin') {
    return { statusCode: authUser ? 403 : 401, payload: { message: authUser ? 'Forbidden' : 'Unauthorized' } }
  }

  const course = await getCourseBySlug(slug)

  if (!course) {
    return { statusCode: 404, payload: { message: 'Course not found' } }
  }

  const body = await readBody(request)
  const isPopular = Boolean(body.isPopular)

  await query('UPDATE courses SET is_popular = $1, updated_at = CURRENT_DATE WHERE id = $2', [
    isPopular,
    course.id,
  ])

  return { statusCode: 200, payload: { data: await getCourseBySlug(course.slug) } }
}

const deleteCourseLesson = async (request, slug, lessonId) => {
  const authUser = await getAuthUser(request)
  const permission = await getManageableCourseBySlug(slug, authUser)

  if (permission.statusCode !== 200) {
    return permission
  }

  const result = await query(
    `
      DELETE FROM lessons
      WHERE id = $1 AND course_id = $2
      RETURNING id
    `,
    [lessonId, permission.course.id],
  )

  if (!result.rows[0]) {
    return { statusCode: 404, payload: { message: 'Lesson not found' } }
  }

  return { statusCode: 200, payload: { data: await getCourseBySlug(permission.course.slug) } }
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

  if (course.status !== 'published') {
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

const rememberCurrentCourseLesson = async (request, slug, lessonId) => {
  const authUser = await getAuthUser(request)

  if (!authUser) {
    return { statusCode: 401, payload: { message: 'Unauthorized' } }
  }

  if (authUser.role !== 'student') {
    return { statusCode: 403, payload: { message: 'Forbidden' } }
  }

  const course = await getCourseBySlug(slug)

  if (!course || course.status !== 'published') {
    return { statusCode: 404, payload: { message: 'Course not found' } }
  }

  const lessonExists = course.lessons.some((lesson) => lesson.id === lessonId)

  if (!lessonExists) {
    return { statusCode: 404, payload: { message: 'Lesson not found' } }
  }

  const enrollment = await getEnrollmentRecord(authUser.id, course.id)

  if (!enrollment) {
    return { statusCode: 403, payload: { message: 'Please enroll before saving lesson progress' } }
  }

  await query(
    `
      UPDATE enrollments
      SET last_lesson_id = $1, last_accessed_at = NOW()
      WHERE student_id = $2 AND course_id = $3
    `,
    [lessonId, authUser.id, course.id],
  )

  return {
    statusCode: 200,
    payload: {
      data: await getEnrollmentRecord(authUser.id, course.id),
    },
  }
}

const completeCourseLesson = async (request, slug, lessonId) => {
  const authUser = await getAuthUser(request)

  if (!authUser) {
    return { statusCode: 401, payload: { message: 'กรุณาเข้าสู่ระบบก่อนบันทึกความคืบหน้า' } }
  }

  if (authUser.role !== 'student') {
    return { statusCode: 403, payload: { message: 'บัญชีนี้ไม่สามารถบันทึกความคืบหน้าการเรียนได้' } }
  }

  const course = await getCourseBySlug(slug)

  if (!course || course.status !== 'published') {
    return { statusCode: 404, payload: { message: 'Course not found' } }
  }

  const lessonIndex = course.lessons.findIndex((lesson) => lesson.id === lessonId)

  if (lessonIndex < 0) {
    return { statusCode: 404, payload: { message: 'Lesson not found' } }
  }

  const enrollment = await getEnrollmentRecord(authUser.id, course.id)

  if (!enrollment) {
    return { statusCode: 403, payload: { message: 'กรุณาสมัครเรียนคอร์สนี้ก่อนบันทึกความคืบหน้า' } }
  }

  const completedLessons = Math.max(enrollment.completedLessons, lessonIndex + 1)
  const progress = Math.min(100, Math.round((completedLessons / Math.max(course.lessons.length, 1)) * 100))

  await query(
    `
      UPDATE enrollments
      SET progress = $1, completed_lessons = $2, last_lesson_id = $3, last_accessed_at = NOW()
      WHERE student_id = $4 AND course_id = $5
    `,
    [progress, completedLessons, lessonId, authUser.id, course.id],
  )

  return {
    statusCode: 200,
    payload: {
      data: await getEnrollmentRecord(authUser.id, course.id),
    },
  }
}

const routeRequest = async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host}`)

  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Origin': frontendOrigin,
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-File-Name',
    })
    response.end()
    return
  }

  if (url.pathname === '/api/health' && request.method === 'GET') {
    await query('SELECT 1')
    await ensureAuthSchema()
    await ensureSeedCredentials()
    await ensureCourseSchema()
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

    if (request.method === 'POST' && action === 'transcribe') {
      const result = await transcribeLessonVideo(request, lessonId)
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

  if (url.pathname === '/api/uploads/video' && request.method === 'POST') {
    const result = await saveVideoUploadStream(request)
    sendJson(response, result.statusCode, result.payload)
    return
  }

  if (url.pathname === '/api/uploads/video/inspect' && request.method === 'GET') {
    const result = await inspectUploadedVideo(request, url)
    sendJson(response, result.statusCode, result.payload)
    return
  }

  if (url.pathname === '/api/uploads/mux/direct-upload' && request.method === 'POST') {
    const result = await createMuxDirectUpload(request)
    sendJson(response, result.statusCode, result.payload)
    return
  }

  if (url.pathname.startsWith('/api/uploads/mux/direct-upload/') && request.method === 'GET') {
    const uploadId = decodeURIComponent(url.pathname.replace('/api/uploads/mux/direct-upload/', ''))
    const result = await getMuxDirectUploadStatus(request, uploadId)
    sendJson(response, result.statusCode, result.payload)
    return
  }

  if (url.pathname === '/api/uploads/r2/multipart/start' && request.method === 'POST') {
    const result = await startR2MultipartVideoUpload(request)
    sendJson(response, result.statusCode, result.payload)
    return
  }

  if (url.pathname === '/api/uploads/r2/multipart/sign-part' && request.method === 'POST') {
    const result = await signR2MultipartVideoPart(request)
    sendJson(response, result.statusCode, result.payload)
    return
  }

  if (url.pathname === '/api/uploads/r2/multipart/complete' && request.method === 'POST') {
    const result = await finishR2MultipartVideoUpload(request)
    sendJson(response, result.statusCode, result.payload)
    return
  }

  if (url.pathname === '/api/uploads/r2/multipart/abort' && request.method === 'POST') {
    const result = await cancelR2MultipartVideoUpload(request)
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

  if (url.pathname.startsWith('/api/courses/') && request.method === 'POST' && url.pathname.endsWith('/status')) {
    const slug = decodeURIComponent(url.pathname.replace('/api/courses/', '').replace('/status', ''))
    const result = await updateCourseStatus(request, slug)
    sendJson(response, result.statusCode, result.payload)
    return
  }

  if (url.pathname.startsWith('/api/courses/') && request.method === 'POST' && url.pathname.endsWith('/popular')) {
    const slug = decodeURIComponent(url.pathname.replace('/api/courses/', '').replace('/popular', ''))
    const result = await updateCoursePopularity(request, slug)
    sendJson(response, result.statusCode, result.payload)
    return
  }

  if (url.pathname.startsWith('/api/courses/') && request.method === 'POST' && url.pathname.includes('/lessons')) {
    const lessonPath = url.pathname.replace('/api/courses/', '')
    const [encodedSlug, , encodedLessonId, action] = lessonPath.split('/')
    const slug = decodeURIComponent(encodedSlug ?? '')
    const lessonId = encodedLessonId ? decodeURIComponent(encodedLessonId) : ''
    const result =
      action === 'complete'
        ? await completeCourseLesson(request, slug, lessonId)
        : action === 'current'
          ? await rememberCurrentCourseLesson(request, slug, lessonId)
        : action === 'delete'
          ? await deleteCourseLesson(request, slug, lessonId)
          : await saveCourseLesson(request, slug, lessonId || null)

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
    const { error: roleError } = await requireRole(request, ['admin'])
    if (roleError) {
      sendJson(response, roleError.statusCode, roleError.payload)
      return
    }

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

  if (url.pathname === '/api/teacher/profile' && request.method === 'POST') {
    const result = await updateTeacherProfile(request)
    sendJson(response, result.statusCode, result.payload)
    return
  }

  if (url.pathname === '/api/admin/dashboard' && request.method === 'GET') {
    const { error: roleError } = await requireRole(request, ['admin'])
    if (roleError) {
      sendJson(response, roleError.statusCode, roleError.payload)
      return
    }

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
  .then(ensureSeedCredentials)
  .then(ensureCourseSchema)
  .then(ensureAiSchema)
  .then(() => (normalizeExistingUploads ? normalizeExistingUploadedVideos() : undefined))
  .then(() => {
    server.listen(port, '0.0.0.0', () => {
      console.log(`Backend API listening on port ${port}`)
    })
  })
  .catch((error) => {
    console.error('Failed to initialize auth schema', error)
    process.exit(1)
  })
