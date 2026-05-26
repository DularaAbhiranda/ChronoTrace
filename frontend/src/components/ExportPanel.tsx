import { useState } from 'react'
import { Download, FileJson, FileText, Globe, Loader2 } from 'lucide-react'
import type { Filters } from '../types'
import { API_BASE } from '../types'

interface ExportPanelProps {
  jobId: string
  domain: string
  filters: Filters
}

export function ExportPanel({ jobId, domain, filters }: ExportPanelProps) {
  const [loading, setLoading] = useState<string | null>(null)

  const doExport = async (format: 'json' | 'csv' | 'html') => {
    setLoading(format)
    try {
      const body = {
        job_id: jobId,
        format,
        filters: {
          sources: filters.sources.length > 0 ? filters.sources : undefined,
          event_types: filters.event_types.length > 0 ? filters.event_types : undefined,
        },
      }
      const resp = await fetch(`${API_BASE}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `chronotrace-${domain}.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch {}
    setLoading(null)
  }

  const formats: { id: 'json' | 'csv' | 'html'; label: string; icon: typeof FileJson }[] = [
    { id: 'json', label: 'JSON', icon: FileJson },
    { id: 'csv', label: 'CSV', icon: FileText },
    { id: 'html', label: 'HTML', icon: Globe },
  ]

  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <Download className="w-4 h-4 text-muted" />
        <span className="text-white font-mono text-sm font-semibold">Export</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {formats.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => doExport(id)}
            disabled={loading !== null}
            className="flex flex-col items-center gap-1.5 p-3 bg-black/30 border border-border rounded-lg
              hover:border-primary/40 hover:bg-primary/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === id
              ? <Loader2 className="w-4 h-4 text-primary animate-spin" />
              : <Icon className="w-4 h-4 text-muted" />
            }
            <span className="text-xs font-mono text-muted">{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
