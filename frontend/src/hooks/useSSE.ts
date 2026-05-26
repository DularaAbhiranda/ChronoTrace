import { useEffect, useRef, useCallback } from 'react'

export interface SSEMessage {
  type: 'progress' | 'error' | 'done' | 'ping'
  source?: string
  events_count?: number
  progress?: number
  message?: string
  job_id?: string
  total_events?: number
}

export function useSSE(
  jobId: string | null,
  onMessage: (msg: SSEMessage) => void,
  onDone: () => void,
) {
  const esRef = useRef<EventSource | null>(null)
  const onMessageRef = useRef(onMessage)
  const onDoneRef = useRef(onDone)

  onMessageRef.current = onMessage
  onDoneRef.current = onDone

  const close = useCallback(() => {
    esRef.current?.close()
    esRef.current = null
  }, [])

  useEffect(() => {
    if (!jobId) return
    close()

    const es = new EventSource(`/api/scans/${jobId}/stream`)
    esRef.current = es

    es.onmessage = (e) => {
      try {
        const msg: SSEMessage = JSON.parse(e.data)
        onMessageRef.current(msg)
        if (msg.type === 'done') {
          onDoneRef.current()
          es.close()
        }
      } catch {}
    }

    es.onerror = () => {
      es.close()
    }

    return close
  }, [jobId, close])

  return { close }
}
