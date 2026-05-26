import { useState, useEffect } from 'react'
import { History, X, ChevronRight, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import type { HistoryEntry } from '../types'
import { API_BASE } from '../types'

interface HistoryPanelProps {
  onLoadJob: (jobId: string) => void
  onClose: () => void
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function HistoryPanel({ onLoadJob, onClose }: HistoryPanelProps) {
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API_BASE}/history`)
      .then((r) => r.json())
      .then((d) => { setEntries(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-surface border border-border rounded-2xl shadow-2xl mt-14 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-primary" />
            <span className="text-white font-mono text-sm font-semibold">Scan History</span>
          </div>
          <button onClick={onClose} className="text-muted hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-5 h-5 text-muted animate-spin" />
            </div>
          ) : entries.length === 0 ? (
            <div className="p-8 text-center">
              <Clock className="w-8 h-8 text-muted mx-auto mb-2" />
              <p className="text-muted text-sm font-mono">No scans yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {entries.map((e) => (
                <button
                  key={e.job_id}
                  onClick={() => { onLoadJob(e.job_id); onClose() }}
                  className="w-full flex items-center gap-3 p-4 hover:bg-white/5 transition-colors text-left"
                >
                  {e.status === 'completed'
                    ? <CheckCircle className="w-4 h-4 text-success shrink-0" />
                    : e.status === 'failed'
                    ? <XCircle className="w-4 h-4 text-danger shrink-0" />
                    : <Loader2 className="w-4 h-4 text-warning shrink-0 animate-spin" />
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-mono truncate">{e.domain}</p>
                    <p className="text-muted text-xs font-mono">
                      {e.total_events} events · {timeAgo(e.created_at)}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
