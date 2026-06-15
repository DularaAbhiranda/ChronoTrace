import { X, ExternalLink, Clock, Database, Tag, Star } from 'lucide-react'
import type { NormalizedEvent } from '../types'
import { SOURCE_COLORS, SOURCE_LABELS, EVENT_TYPE_LABELS } from '../types'

interface EventDetailProps {
  event: NormalizedEvent
  onClose: () => void
}

function formatTimestamp(ts: string): string {
  try {
    return new Date(ts).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      timeZoneName: 'short',
    })
  } catch {
    return ts
  }
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted text-xs font-mono">{label}</span>
      <span className="text-white text-xs font-mono break-all">{value}</span>
    </div>
  )
}

export function EventDetail({ event, onClose }: EventDetailProps) {
  const color = SOURCE_COLORS[event.source]

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <div className="flex items-start justify-between p-4 border-b border-border"
        style={{ borderLeftColor: color, borderLeftWidth: 3 }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-xs font-mono px-2 py-0.5 rounded-full"
              style={{ backgroundColor: color + '20', color }}
            >
              {SOURCE_LABELS[event.source]}
            </span>
            <span className="text-xs font-mono text-muted bg-white/5 px-2 py-0.5 rounded-full">
              {EVENT_TYPE_LABELS[event.event_type]}
            </span>
          </div>
          <p className="text-white text-sm font-mono truncate" title={event.subject}>
            {event.subject}
          </p>
        </div>
        <button onClick={onClose} className="shrink-0 ml-2 text-muted hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-3">
        <DetailRow
          label="Timestamp"
          value={
            <span className="flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-muted" />
              {formatTimestamp(event.timestamp)}
            </span>
          }
        />
        <DetailRow label="Confidence" value={
          <span className="flex items-center gap-1.5">
            <Star className="w-3 h-3 text-warning" />
            {event.confidence}
          </span>
        } />
        <DetailRow label="Subject" value={event.subject} />
        <DetailRow label="Event ID" value={<span className="text-muted/70">{event.id}</span>} />

        {Object.entries(event.details).length > 0 && (
          <div>
            <p className="text-muted text-xs font-mono mb-2 flex items-center gap-1.5">
              <Database className="w-3 h-3" />
              Raw Details
            </p>
            <div className="bg-black/40 rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
              {Object.entries(event.details).map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <span className="text-muted text-xs font-mono shrink-0">{k}:</span>
                  <span className="text-white/80 text-xs font-mono break-all">
                    {Array.isArray(v)
                      ? v.join(', ')
                      : typeof v === 'object' && v !== null
                      ? JSON.stringify(v)
                      : String(v)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!!event.details.wayback_url && (
          <a
            href={event.details.wayback_url as string}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-xs font-mono text-primary hover:underline"
          >
            <ExternalLink className="w-3 h-3" />
            View archived snapshot
          </a>
        )}
        {!!event.details.crt_sh_url && (
          <a
            href={event.details.crt_sh_url as string}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-xs font-mono text-primary hover:underline"
          >
            <ExternalLink className="w-3 h-3" />
            View on crt.sh
          </a>
        )}
      </div>
    </div>
  )
}
