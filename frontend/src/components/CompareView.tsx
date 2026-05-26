import { useState } from 'react'
import { GitCompare, X, ArrowRight, ExternalLink } from 'lucide-react'
import type { NormalizedEvent } from '../types'

interface CompareViewProps {
  events: NormalizedEvent[]
  onClose: () => void
}

function getWaybackSnapshots(events: NormalizedEvent[]) {
  return events
    .filter((e) => e.source === 'wayback' && e.event_type === 'snapshot')
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
}

export function CompareView({ events, onClose }: CompareViewProps) {
  const snapshots = getWaybackSnapshots(events)
  const [leftTs, setLeftTs] = useState(snapshots[0]?.timestamp ?? '')
  const [rightTs, setRightTs] = useState(snapshots[snapshots.length - 1]?.timestamp ?? '')

  const leftSnap = snapshots.find((s) => s.timestamp === leftTs)
  const rightSnap = snapshots.find((s) => s.timestamp === rightTs)

  const getWaybackUrl = (ev: NormalizedEvent) =>
    ev.details.wayback_url as string | undefined

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-5xl bg-surface border border-border rounded-2xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <GitCompare className="w-5 h-5 text-primary" />
            <h2 className="text-white font-semibold font-mono">Snapshot Comparison</h2>
          </div>
          <button onClick={onClose} className="text-muted hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {snapshots.length < 2 ? (
          <div className="flex-1 flex items-center justify-center p-8 text-muted font-mono text-sm">
            Need at least 2 Wayback snapshots to compare. Run a scan first.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 p-5 border-b border-border shrink-0">
              <div>
                <p className="text-muted text-xs font-mono mb-1.5">Earlier snapshot</p>
                <select
                  value={leftTs}
                  onChange={(e) => setLeftTs(e.target.value)}
                  className="w-full px-3 py-2 bg-black/40 border border-border rounded-lg text-white text-xs font-mono outline-none focus:border-primary/60"
                >
                  {snapshots.map((s) => (
                    <option key={s.id} value={s.timestamp}>
                      {s.timestamp.slice(0, 10)} — {s.subject.slice(0, 50)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-muted text-xs font-mono mb-1.5">Later snapshot</p>
                <select
                  value={rightTs}
                  onChange={(e) => setRightTs(e.target.value)}
                  className="w-full px-3 py-2 bg-black/40 border border-border rounded-lg text-white text-xs font-mono outline-none focus:border-primary/60"
                >
                  {snapshots.map((s) => (
                    <option key={s.id} value={s.timestamp}>
                      {s.timestamp.slice(0, 10)} — {s.subject.slice(0, 50)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex-1 overflow-hidden grid grid-cols-2 gap-0">
              {[leftSnap, rightSnap].map((snap, i) => (
                <div
                  key={i}
                  className={`flex flex-col ${i === 0 ? 'border-r border-border' : ''}`}
                >
                  <div className="p-3 bg-black/20 border-b border-border flex items-center justify-between">
                    <div>
                      <p className="text-white text-xs font-mono font-semibold">
                        {i === 0 ? 'Earlier' : 'Later'} — {snap?.timestamp.slice(0, 10)}
                      </p>
                      <p className="text-muted text-xs font-mono truncate max-w-xs">
                        {snap?.subject}
                      </p>
                    </div>
                    {snap && getWaybackUrl(snap) && (
                      <a
                        href={getWaybackUrl(snap)}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-xs text-primary font-mono hover:underline shrink-0 ml-2"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Open
                      </a>
                    )}
                  </div>
                  <div className="flex-1 overflow-auto p-3">
                    {snap && getWaybackUrl(snap) ? (
                      <iframe
                        src={getWaybackUrl(snap)}
                        className="w-full h-64 border-0 rounded"
                        title={`Snapshot ${i}`}
                        sandbox="allow-scripts allow-same-origin"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-32 text-muted text-xs font-mono">
                        No preview available
                      </div>
                    )}
                    {snap && (
                      <div className="mt-3 space-y-1.5">
                        {Object.entries(snap.details).map(([k, v]) => (
                          <div key={k} className="flex gap-2 text-xs font-mono">
                            <span className="text-muted shrink-0">{k}:</span>
                            <span className="text-white/80 break-all">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
