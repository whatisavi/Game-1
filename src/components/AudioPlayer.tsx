import React, { useEffect, useRef, useState } from 'react'

type Props = {
  src?: string
  initialVolume?: number
}

export default function AudioPlayer({ src = '/music - quiet please. (128k).mp3', initialVolume = 0.15 }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [volume, setVolume] = useState(initialVolume)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const a = new Audio(src)
    a.loop = true
    a.preload = 'auto'
    a.volume = volume
    audioRef.current = a
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onCan = () => setReady(true)
    a.addEventListener('play', onPlay)
    a.addEventListener('pause', onPause)
    a.addEventListener('canplay', onCan)

    // Attempt to autoplay on mount (may be blocked by browser). Swallow errors.
    ;(async () => {
      try {
        await a.play()
      } catch (e) {
        // autoplay blocked
      }
    })()

    return () => {
      a.removeEventListener('play', onPlay)
      a.removeEventListener('pause', onPause)
      a.removeEventListener('canplay', onCan)
      a.pause()
      a.src = ''
      audioRef.current = null
    }
  }, [src])

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  return (
    <div style={{ padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.02)' }}>
      <div style={{ fontSize: 13, marginBottom: 6 }}>Background music</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          onClick={async () => {
            if (!audioRef.current) return
            try {
              if (audioRef.current.paused) await audioRef.current.play()
              else audioRef.current.pause()
            } catch {}
          }}
          disabled={!ready && !playing}
        >
          {playing ? 'Pause' : 'Play'}
        </button>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          Volume
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={e => setVolume(Number(e.target.value))}
          />
        </label>
      </div>
      <div style={{ fontSize: 12, opacity: 0.9, marginTop: 6 }}>
        File: <code style={{ fontSize: 11 }}>{src}</code>. If audio doesn't start, press Play.
      </div>
    </div>
  )
}
import React, { useEffect, useRef, useState } from 'react'

type Props = {
  src?: string
  initialVolume?: number
}

export default function AudioPlayer({ src = '/music - quiet please. (128k).mp3', initialVolume = 0.15 }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [volume, setVolume] = useState(initialVolume)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const a = new Audio(src)
    a.loop = true
    a.preload = 'auto'
    a.volume = volume
    audioRef.current = a
    a.addEventListener('play', () => setPlaying(true))
    a.addEventListener('pause', () => setPlaying(false))
    a.addEventListener('canplay', () => setReady(true))

    // Attempt to autoplay on mount (may be blocked by browser). Swallow errors.
    (async () => {
      try {
        await a.play()
      } catch (e) {
        // autoplay blocked
      }
    })()

    return () => {
      a.pause()
      a.src = ''
      audioRef.current = null
    }
  }, [src])

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 13 }}>
        Background music: <strong style={{ fontSize: 12 }}>{src}</strong>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          onClick={async () => {
            if (!audioRef.current) return
            try {
              if (audioRef.current.paused) await audioRef.current.play()
              else audioRef.current.pause()
            } catch {}
          }}
          disabled={!ready && !playing}
        >
          {playing ? 'Pause' : 'Play'}
        </button>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          Volume
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={e => setVolume(Number(e.target.value))}
          />
        </label>
      </div>
      <div style={{ fontSize: 12, opacity: 0.9 }}>
        Note: browsers may block autoplay. If audio doesn't start automatically, press Play.
      </div>
    </div>
  )
}
import React, { useEffect, useImperativeHandle, useRef, forwardRef, useState } from 'react'

export type AudioHandle = {
  play: () => Promise<void>
  pause: () => void
  toggle: () => Promise<void>
}

type Props = {
  src?: string
}

const AudioPlayer = forwardRef<AudioHandle, Props>(({ src = '/music.mp3' }, ref) => {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [volume, setVolume] = useState(0.6)
  const [currentSrc, setCurrentSrc] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [urlInput, setUrlInput] = useState('')

  // On mount, check if /music.mp3 exists; if not, prompt for URL
  useEffect(() => {
    let mounted = true
    async function probe() {
      try {
        const res = await fetch(src, { method: 'HEAD' })
        if (!mounted) return
        if (res.ok) {
          setCurrentSrc(src)
          setMessage(null)
        } else {
          setCurrentSrc(null)
          setMessage('No local music found at /music.mp3 — provide a URL or place file in public/')
        }
      } catch (e) {
        if (!mounted) return
        setCurrentSrc(null)
        setMessage('No local music found at /music.mp3 — provide a URL or place file in public/')
      }
    }
    probe()
    return () => {
      mounted = false
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
        audioRef.current = null
      }
    }
  }, [src])

  // Update audio element when currentSrc or volume changes
  useEffect(() => {
    if (!currentSrc) return
    if (!audioRef.current) {
      audioRef.current = new Audio(currentSrc)
      audioRef.current.loop = true
      audioRef.current.preload = 'auto'
      audioRef.current.addEventListener('play', () => setPlaying(true))
      audioRef.current.addEventListener('pause', () => setPlaying(false))
      audioRef.current.addEventListener('ended', () => setPlaying(false))
    }
    audioRef.current.src = currentSrc
    audioRef.current.volume = volume
  }, [currentSrc, volume])

  useImperativeHandle(ref, () => ({
    async play() {
      if (!audioRef.current) return
      try {
        await audioRef.current.play()
      } catch (e) {
        // autoplay blocked — user interaction needed; swallow error
      }
    },
    pause() {
      audioRef.current?.pause()
    },
    async toggle() {
      if (!audioRef.current) return
      if (audioRef.current.paused) {
        try {
          await audioRef.current.play()
        } catch {}
      } else {
        audioRef.current.pause()
      }
    },
  }))

  return (
    <div className="audio-player">
      {message && <div style={{ color: '#ffd', marginBottom: 8 }}>{message}</div>}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          onClick={async () => {
            if (!audioRef.current) return
            try {
              if (audioRef.current.paused) await audioRef.current.play()
              else audioRef.current.pause()
            } catch (e) {
              // ignore
            }
          }}
          aria-pressed={playing}
          disabled={!currentSrc}
        >
          {playing ? 'Pause music' : 'Play music'}
        </button>
        <label style={{ marginLeft: 8 }}>
          Volume
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={e => setVolume(Number(e.target.value))}
            style={{ marginLeft: 8 }}
          />
        </label>
      </div>

      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 12, opacity: 0.9 }}>Provide an audio URL to use instead:</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <input value={urlInput} onChange={e => setUrlInput(e.target.value)} placeholder="https://.../music.mp3" style={{ flex: 1 }} />
          <button
            onClick={() => {
              if (!urlInput) return
              setCurrentSrc(urlInput)
              setMessage(null)
            }}
          >
            Use URL
          </button>
        </div>
      </div>
    </div>
  )
})

export default AudioPlayer
