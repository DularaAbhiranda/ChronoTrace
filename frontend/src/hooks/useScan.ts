import { useState, useCallback } from 'react'
import type { ScanJob, ScanRequest, NormalizedEvent, ActiveModule } from '../types'
import { API_BASE } from '../types'
import { useSSE, type SSEMessage } from './useSSE'

export type ScanPhase = 'idle' | 'scope' | 'scanning' | 'done' | 'error'

export interface SourceProgress {
  name: string
  done: boolean
  events_count: number
}

export function useScan() {
  const [phase, setPhase] = useState<ScanPhase>('idle')
  const [job, setJob] = useState<ScanJob | null>(null)
  const [progress, setProgress] = useState(0)
  const [sources, setSources] = useState<SourceProgress[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pendingDomain, setPendingDomain] = useState('')
  const [enrichmentKeys, setEnrichmentKeys] = useState<Record<string, string>>({})
  const [activeModules, setActiveModules] = useState<ActiveModule[]>([])

  const handleSSEMessage = useCallback((msg: SSEMessage) => {
    if (msg.type === 'progress' && msg.source) {
      setProgress(msg.progress ?? 0)
      setSources((prev) => {
        const existing = prev.find((s) => s.name === msg.source)
        if (existing) {
          return prev.map((s) =>
            s.name === msg.source
              ? { ...s, done: true, events_count: msg.events_count ?? 0 }
              : s,
          )
        }
        return [...prev, { name: msg.source!, done: true, events_count: msg.events_count ?? 0 }]
      })
    }
    if (msg.type === 'error' && msg.source) {
      setSources((prev) =>
        prev.map((s) => (s.name === msg.source ? { ...s, done: true } : s)),
      )
    }
  }, [])

  const handleSSEDone = useCallback(async () => {
    if (!job) return
    try {
      const resp = await fetch(`${API_BASE}/scans/${job.job_id}`)
      const data: ScanJob = await resp.json()
      setJob(data)
      setPhase('done')
      setProgress(100)
    } catch {
      setPhase('done')
    }
  }, [job])

  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  useSSE(activeJobId, handleSSEMessage, handleSSEDone)

  const submitDomain = useCallback((domain: string) => {
    setPendingDomain(domain)
    setPhase('scope')
  }, [])

  const confirmScan = useCallback(async (activeConfirm?: { domainTyped: string }) => {
    setPhase('scanning')
    setProgress(0)
    setSources([])
    setError(null)
    setJob(null)

    const request: ScanRequest = {
      domain: pendingDomain,
      confirmed_authorization: true,
      enabled_enrichment: enrichmentKeys,
    }
    if (activeModules.length > 0 && activeConfirm) {
      request.active_modules = activeModules
      request.active_authorization_confirmed = true
      request.active_domain_typed = activeConfirm.domainTyped
    }

    try {
      const resp = await fetch(`${API_BASE}/scans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })
      if (!resp.ok) {
        const err = await resp.json()
        throw new Error(err.detail || 'Failed to start scan')
      }
      const data = await resp.json()
      const partialJob: ScanJob = {
        job_id: data.job_id,
        domain: data.domain,
        status: 'running',
        progress: 0,
        events: [],
        created_at: new Date().toISOString(),
        completed_at: null,
        error: null,
        sources_completed: [],
        sources_total: 4 + Object.keys(enrichmentKeys).length + activeModules.length,
      }
      setJob(partialJob)
      setActiveJobId(data.job_id)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
      setPhase('error')
    }
  }, [pendingDomain, enrichmentKeys, activeModules])

  const cancelScope = useCallback(() => {
    setPhase('idle')
    setPendingDomain('')
  }, [])

  const reset = useCallback(() => {
    setPhase('idle')
    setJob(null)
    setProgress(0)
    setSources([])
    setError(null)
    setActiveJobId(null)
  }, [])

  const loadJob = useCallback(async (jobId: string) => {
    const resp = await fetch(`${API_BASE}/scans/${jobId}`)
    const data: ScanJob = await resp.json()
    setJob(data)
    setPhase('done')
    setProgress(100)
  }, [])

  return {
    phase,
    job,
    progress,
    sources,
    error,
    pendingDomain,
    enrichmentKeys,
    setEnrichmentKeys,
    activeModules,
    setActiveModules,
    submitDomain,
    confirmScan,
    cancelScope,
    reset,
    loadJob,
  }
}
