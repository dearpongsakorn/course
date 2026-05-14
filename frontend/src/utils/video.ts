export type VideoSource =
  | { kind: 'youtube'; embedUrl: string }
  | { kind: 'mux'; embedUrl: string; playbackId: string }
  | { kind: 'direct'; src: string }

const toYouTubeEmbedUrl = (value: string) => {
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase().replace(/^www\./, '')

    if (host === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0]
      return id ? `https://www.youtube.com/embed/${id}` : null
    }

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (url.pathname === '/watch') {
        const id = url.searchParams.get('v')
        return id ? `https://www.youtube.com/embed/${id}` : null
      }

      if (url.pathname.startsWith('/embed/')) {
        const id = url.pathname.split('/')[2]
        return id ? `https://www.youtube.com/embed/${id}` : null
      }

      if (url.pathname.startsWith('/shorts/')) {
        const id = url.pathname.split('/')[2]
        return id ? `https://www.youtube.com/embed/${id}` : null
      }
    }
  } catch {
    return null
  }

  return null
}

const toMuxVideoSource = (value: string): Extract<VideoSource, { kind: 'mux' }> | null => {
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase().replace(/^www\./, '')

    if (host === 'player.mux.com') {
      const playbackId = url.pathname.split('/').filter(Boolean)[0]
      return playbackId ? { kind: 'mux', embedUrl: url.toString(), playbackId } : null
    }

    if (host === 'stream.mux.com') {
      const fileName = url.pathname.split('/').filter(Boolean)[0] ?? ''
      const playbackId = fileName.replace(/\.m3u8$/i, '')
      return playbackId ? { kind: 'mux', embedUrl: `https://player.mux.com/${playbackId}`, playbackId } : null
    }
  } catch {
    return null
  }

  return null
}

export const resolveVideoSource = (value?: string | null): VideoSource | null => {
  const url = String(value ?? '').trim()
  if (!url) return null

  const youtubeEmbedUrl = toYouTubeEmbedUrl(url)
  if (youtubeEmbedUrl) {
    return { kind: 'youtube', embedUrl: youtubeEmbedUrl }
  }

  const muxVideoSource = toMuxVideoSource(url)
  if (muxVideoSource) {
    return muxVideoSource
  }

  return { kind: 'direct', src: url }
}
