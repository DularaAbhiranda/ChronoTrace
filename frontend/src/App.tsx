import { useState, useMemo } from 'react'
import { Header } from './components/Header'
import { DomainInput } from './components/DomainInput'
import { ScopeModal } from './components/ScopeModal'
import { ScanProgress } from './components/ScanProgress'
import { ActiveProbePanel } from './components/ActiveProbePanel'
import { Timeline } from './components/Timeline'
import { FilterPanel } from './components/FilterPanel'
import { EventDetail } from './components/EventDetail'
import { ExportPanel } from './components/ExportPanel'
import { ApiKeyVault } from './components/ApiKeyVault'
import { HistoryPanel } from './components/HistoryPanel'
import { CompareView } from './components/CompareView'
import { useScan } from './hooks/useScan'
import type { NormalizedEvent, Filters, EventSource } from './types'
import {
  SOURCE_COLORS, SOURCE_LABELS, EVENT_TYPE_LABELS,
  ACTIVE_SOURCES, API_BASE,
} from './types'
import {
  Clock, Layers, Globe, Shield, ChevronDown, ChevronUp,
  GitCompare, RotateCcw, AlertCircle,
} from 'lucide-react'

const EMPTY_FILTERS: Filters = {
  sources: [],
  event_types: [],
  date_from: '',
  date_to: '',
  search: '',
}

export default function App() {
  const {
    phase, job, progress, sources, error,
    pendingDomain, enrichmentKeys, setEnrichmentKeys,
    activeModules, setActiveModules,
    submitDomain, confirmScan, cancelScope, reset, loadJob,
  } = useScan()

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [selectedEvent, setSelectedEvent] = useState<NormalizedEvent | null>(null)
  const [showKeys, setShowKeys] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showCompare, setShowCompare] = useState(false)
  const [showEventList, setShowEventList] = useState(true)
  const [eventListPage, setEventListPage] = useState(0)
  const PAGE_SIZE = 50

  const allEvents = job?.events ?? []

  const filteredEvents = useMemo(() => {
    return allEvents.filter((e) => {
      if (filters.sources.length > 0 && !filters.sources.includes(e.source)) return false
      if (filters.event_types.length > 0 && !filters.event_types.includes(e.event_type)) return false
      if (filters.date_from && e.timestamp < filters.date_from) return false
      if (filters.date_to && e.timestamp > filters.date_to + 'T23:59:59Z') return false
      if (filters.search && !e.subject.toLowerCase().includes(filters.search.toLowerCase())) return false
      return true
    })
  }, [allEvents, filters])

  const availableSources = useMemo(
    () => [...new Set(allEvents.map((e) => e.source))] as EventSource[],
    [allEvents],
  )

  const pagedEvents = filteredEvents.slice(eventListPage * PAGE_SIZE, (eventListPage + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(filteredEvents.length / PAGE_SIZE)

  const stats = useMemo(() => {
    const bySource: Record<string, number> = {}
    const byType: Record<string, number> = {}
    allEvents.forEach((e) => {
      bySource[e.source] = (bySource[e.source] ?? 0) + 1
      byType[e.event_type] = (byType[e.event_type] ?? 0) + 1
    })
    return { bySource, byType }
  }, [allEvents])

  const isDone = phase === 'done'

  return (
    <div className="min-h-screen bg-[#0d1117] flex flex-col">
      <Header onOpenKeys={() => setShowKeys(true)} onOpenHistory={() => setShowHistory(true)} />

      {/* Hero / Input area */}
      <div className="border-b border-border bg-surface/40">
        <div className="max-w-screen-2xl mx-auto px-4 py-8">
          {phase === 'idle' && (
            <div className="text-center mb-6">
              <h1 className="text-3xl font-bold text-white font-mono mb-2">
                Reconstruct any domain's <span className="text-primary">digital history</span>
              </h1>
              <p className="text-muted text-sm max-w-xl mx-auto">
                Aggregates Wayback Machine, Certificate Transparency, RDAP, and live DNS into one
                correlated timeline. Zero cost. Authorized use only.
              </p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="flex-1">
              <DomainInput
                onSubmit={submitDomain}
                disabled={phase === 'scanning'}
              />
            </div>
            {isDone && (
              <button
                onClick={reset}
                className="shrink-0 flex items-center gap-2 px-4 py-3 border border-border rounded-xl text-muted hover:text-white hover:border-white/30 transition-colors font-mono text-sm"
              >
                <RotateCcw className="w-4 h-4" />
                New
              </button>
            )}
          </div>

          {(phase === 'idle' || phase === 'scope') && (
            <ActiveProbePanel modules={activeModules} onChange={setActiveModules} />
          )}

          {isDone && job && (
            <div className="flex flex-wrap items-center gap-3 mt-4">
              <span className="text-muted text-xs font-mono">
                {allEvents.length} events · {job.sources_completed.length} sources · {job.completed_at?.slice(0, 10)}
              </span>
              <div className="flex gap-2 ml-auto">
                <button
                  onClick={() => setShowCompare(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-border rounded-lg text-xs text-muted hover:text-white hover:border-white/20 transition-colors font-mono"
                >
                  <GitCompare className="w-3.5 h-3.5" />
                  Compare
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 max-w-screen-2xl mx-auto w-full px-4 py-6">

        {phase === 'scanning' && job && (
          <div className="flex items-center justify-center pt-8">
            <ScanProgress
              domain={job.domain}
              progress={progress}
              sources={sources}
              sourcesTotal={job.sources_total}
            />
          </div>
        )}

        {phase === 'error' && (
          <div className="flex items-center justify-center pt-8">
            <div className="bg-surface border border-danger/30 rounded-xl p-6 max-w-md text-center">
              <AlertCircle className="w-8 h-8 text-danger mx-auto mb-3" />
              <p className="text-white font-mono font-semibold mb-2">Scan Failed</p>
              <p className="text-muted text-sm">{error}</p>
              <button onClick={reset} className="mt-4 px-4 py-2 bg-primary text-[#0d1117] font-mono text-sm rounded-lg hover:bg-primary/90 transition-colors">
                Try Again
              </button>
            </div>
          </div>
        )}

        {phase === 'idle' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            {[
              { icon: Clock, color: 'primary', title: 'Content Timeline', desc: 'Every archived snapshot from the Wayback Machine, timestamped and navigable.' },
              { icon: Shield, color: 'success', title: 'Certificate History', desc: 'All TLS certificates ever issued, revealing subdomains and their first-seen dates.' },
              { icon: Globe, color: 'warning', title: 'DNS & Registration', desc: 'RDAP registration data and live DNS records anchoring the present-day state.' },
            ].map(({ icon: Icon, color, title, desc }) => (
              <div key={title} className="bg-surface border border-border rounded-xl p-5">
                <div className={`w-9 h-9 rounded-lg mb-3 flex items-center justify-center`}
                  style={{ backgroundColor: `var(--color-${color}, #58a6ff)20` }}>
                  <Icon className="w-5 h-5" style={{ color: color === 'primary' ? '#58a6ff' : color === 'success' ? '#3fb950' : '#d29922' }} />
                </div>
                <h3 className="text-white font-semibold text-sm mb-1">{title}</h3>
                <p className="text-muted text-xs leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        )}

        {isDone && job && (
          <div className="space-y-6">
            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(stats.bySource).map(([src, count]) => (
                <div key={src} className="bg-surface border border-border rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: SOURCE_COLORS[src as EventSource] }} />
                    <span className="text-muted text-xs font-mono">{SOURCE_LABELS[src as EventSource] ?? src}</span>
                  </div>
                  <p className="text-white font-mono font-bold text-xl">{count}</p>
                </div>
              ))}
            </div>

            {/* Timeline */}
            <div className="bg-surface border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <Layers className="w-4 h-4 text-primary" />
                <span className="text-white font-mono text-sm font-semibold">Event Timeline</span>
                <span className="text-muted text-xs font-mono ml-auto">
                  {filteredEvents.length} events shown · scroll to zoom · drag to pan
                </span>
              </div>
              <Timeline events={filteredEvents} onSelectEvent={setSelectedEvent} />
            </div>

            {/* Bottom grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-1 space-y-4">
                <FilterPanel
                  filters={filters}
                  availableSources={availableSources}
                  onChange={(f) => { setFilters(f); setEventListPage(0) }}
                  totalEvents={allEvents.length}
                  filteredCount={filteredEvents.length}
                />
                <ExportPanel
                  jobId={job.job_id}
                  domain={job.domain}
                  filters={filters}
                />
              </div>

              <div className="lg:col-span-2 space-y-4">
                {selectedEvent && (
                  <EventDetail event={selectedEvent} onClose={() => setSelectedEvent(null)} />
                )}

                {/* Event list */}
                <div className="bg-surface border border-border rounded-xl overflow-hidden">
                  <button
                    onClick={() => setShowEventList((s) => !s)}
                    className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
                  >
                    <span className="text-white font-mono text-sm font-semibold">
                      Event List <span className="text-muted font-normal">({filteredEvents.length})</span>
                    </span>
                    {showEventList ? <ChevronUp className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />}
                  </button>

                  {showEventList && (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs font-mono">
                          <thead>
                            <tr className="border-t border-border bg-black/20">
                              <th className="text-left px-4 py-2.5 text-muted font-medium">Timestamp</th>
                              <th className="text-left px-4 py-2.5 text-muted font-medium">Source</th>
                              <th className="text-left px-4 py-2.5 text-muted font-medium">Type</th>
                              <th className="text-left px-4 py-2.5 text-muted font-medium">Subject</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pagedEvents.map((e) => (
                              <tr
                                key={e.id}
                                className="event-row border-t border-border/50 cursor-pointer"
                                onClick={() => setSelectedEvent(e)}
                              >
                                <td className="px-4 py-2.5 text-muted whitespace-nowrap">
                                  {e.timestamp.slice(0, 10)}
                                </td>
                                <td className="px-4 py-2.5 whitespace-nowrap">
                                  <span
                                    className="px-1.5 py-0.5 rounded text-[10px]"
                                    style={{
                                      backgroundColor: SOURCE_COLORS[e.source] + '25',
                                      color: SOURCE_COLORS[e.source],
                                    }}
                                  >
                                    {SOURCE_LABELS[e.source]}
                                  </span>
                                  {ACTIVE_SOURCES.has(e.source) && (
                                    <span className="ml-1 px-1 py-0.5 rounded text-[9px] bg-danger/20 text-danger font-semibold">
                                      ACTIVE
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-2.5 text-muted whitespace-nowrap">
                                  {EVENT_TYPE_LABELS[e.event_type]}
                                </td>
                                <td className="px-4 py-2.5 text-white/80 max-w-xs truncate">
                                  {e.subject}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {totalPages > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                          <button
                            disabled={eventListPage === 0}
                            onClick={() => setEventListPage((p) => p - 1)}
                            className="px-3 py-1.5 text-xs font-mono border border-border rounded-lg text-muted hover:text-white disabled:opacity-30 transition-colors"
                          >
                            ← Prev
                          </button>
                          <span className="text-muted text-xs font-mono">
                            Page {eventListPage + 1} / {totalPages}
                          </span>
                          <button
                            disabled={eventListPage >= totalPages - 1}
                            onClick={() => setEventListPage((p) => p + 1)}
                            className="px-3 py-1.5 text-xs font-mono border border-border rounded-lg text-muted hover:text-white disabled:opacity-30 transition-colors"
                          >
                            Next →
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {phase === 'scope' && (
        <ScopeModal
          domain={pendingDomain}
          activeModules={activeModules}
          onConfirm={confirmScan}
          onCancel={cancelScope}
        />
      )}
      {showKeys && (
        <ApiKeyVault
          keys={enrichmentKeys}
          onChange={setEnrichmentKeys}
          onClose={() => setShowKeys(false)}
        />
      )}
      {showHistory && (
        <HistoryPanel onLoadJob={loadJob} onClose={() => setShowHistory(false)} />
      )}
      {showCompare && job && (
        <CompareView events={job.events} onClose={() => setShowCompare(false)} />
      )}
    </div>
  )
}
