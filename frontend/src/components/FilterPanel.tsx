import { Search, X } from 'lucide-react'
import type { Filters, EventSource, EventType } from '../types'
import { SOURCE_COLORS, SOURCE_LABELS, EVENT_TYPE_LABELS } from '../types'

const ALL_SOURCES: EventSource[] = ['wayback', 'crt_sh', 'rdap', 'dns', 'shodan', 'virustotal', 'hibp']
const ALL_TYPES: EventType[] = ['snapshot', 'certificate', 'subdomain', 'registration', 'dns_record', 'exposure', 'tech_change']

interface FilterPanelProps {
  filters: Filters
  availableSources: EventSource[]
  onChange: (f: Filters) => void
  totalEvents: number
  filteredCount: number
}

export function FilterPanel({ filters, availableSources, onChange, totalEvents, filteredCount }: FilterPanelProps) {
  const toggleSource = (s: EventSource) => {
    const next = filters.sources.includes(s)
      ? filters.sources.filter((x) => x !== s)
      : [...filters.sources, s]
    onChange({ ...filters, sources: next })
  }

  const toggleType = (t: EventType) => {
    const next = filters.event_types.includes(t)
      ? filters.event_types.filter((x) => x !== t)
      : [...filters.event_types, t]
    onChange({ ...filters, event_types: next })
  }

  const clearAll = () => onChange({ sources: [], event_types: [], date_from: '', date_to: '', search: '' })

  const hasFilters =
    filters.sources.length > 0 ||
    filters.event_types.length > 0 ||
    filters.date_from ||
    filters.date_to ||
    filters.search

  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-white font-mono text-sm font-semibold">Filters</span>
          <span className="text-xs font-mono text-muted bg-black/40 px-2 py-0.5 rounded">
            {filteredCount} / {totalEvents}
          </span>
        </div>
        {hasFilters && (
          <button
            onClick={clearAll}
            className="flex items-center gap-1 text-xs text-muted hover:text-white font-mono transition-colors"
          >
            <X className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
        <input
          type="text"
          placeholder="Search subjects…"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="w-full pl-8 pr-3 py-2 bg-black/30 border border-border rounded-lg text-white text-xs font-mono outline-none focus:border-primary/60 placeholder:text-muted/40"
        />
      </div>

      <div className="mb-4">
        <p className="text-muted text-xs font-mono mb-2">Sources</p>
        <div className="flex flex-wrap gap-1.5">
          {availableSources.filter((s) => ALL_SOURCES.includes(s)).map((s) => {
            const active = filters.sources.length === 0 || filters.sources.includes(s)
            return (
              <button
                key={s}
                onClick={() => toggleSource(s)}
                className={`px-2.5 py-1 rounded-full text-xs font-mono border transition-all ${
                  active ? 'opacity-100' : 'opacity-30'
                }`}
                style={{
                  borderColor: SOURCE_COLORS[s] + '60',
                  backgroundColor: active ? SOURCE_COLORS[s] + '20' : 'transparent',
                  color: active ? SOURCE_COLORS[s] : '#8b949e',
                }}
              >
                {SOURCE_LABELS[s]}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mb-4">
        <p className="text-muted text-xs font-mono mb-2">Event Types</p>
        <div className="flex flex-wrap gap-1.5">
          {ALL_TYPES.map((t) => {
            const active = filters.event_types.length === 0 || filters.event_types.includes(t)
            return (
              <button
                key={t}
                onClick={() => toggleType(t)}
                className={`px-2.5 py-1 rounded-full text-xs font-mono border border-border transition-all ${
                  active ? 'bg-white/10 text-white' : 'text-muted opacity-40'
                }`}
              >
                {EVENT_TYPE_LABELS[t]}
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-muted text-xs font-mono mb-1">From</p>
          <input
            type="date"
            value={filters.date_from}
            onChange={(e) => onChange({ ...filters, date_from: e.target.value })}
            className="w-full px-2.5 py-1.5 bg-black/30 border border-border rounded-lg text-white text-xs font-mono outline-none focus:border-primary/60"
          />
        </div>
        <div>
          <p className="text-muted text-xs font-mono mb-1">To</p>
          <input
            type="date"
            value={filters.date_to}
            onChange={(e) => onChange({ ...filters, date_to: e.target.value })}
            className="w-full px-2.5 py-1.5 bg-black/30 border border-border rounded-lg text-white text-xs font-mono outline-none focus:border-primary/60"
          />
        </div>
      </div>
    </div>
  )
}
