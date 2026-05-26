import { Loader2, CheckCircle, XCircle, Wifi } from 'lucide-react'
import type { SourceProgress } from '../hooks/useScan'
import { SOURCE_LABELS } from '../types'

const SOURCE_ICONS: Record<string, string> = {
  wayback: '🕰️',
  crt_sh: '🔒',
  rdap: '📋',
  dns: '🌐',
  shodan: '🔍',
  virustotal: '🛡️',
  hibp: '🚨',
  securitytrails: '📡',
}

interface ScanProgressProps {
  domain: string
  progress: number
  sources: SourceProgress[]
  sourcesTotal: number
}

export function ScanProgress({ domain, progress, sources, sourcesTotal }: ScanProgressProps) {
  const coreOrder = ['wayback', 'crt_sh', 'rdap', 'dns', 'shodan', 'virustotal', 'hibp', 'securitytrails']

  const allSources = coreOrder
    .filter((s) => {
      const isCore = ['wayback', 'crt_sh', 'rdap', 'dns'].includes(s)
      const inEnrichment = sources.some((sp) => sp.name === s)
      return isCore || inEnrichment
    })
    .slice(0, sourcesTotal)

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-surface border border-border rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Wifi className="w-4 h-4 text-primary animate-pulse" />
          </div>
          <div>
            <p className="text-white font-mono font-semibold text-sm">Tracing {domain}</p>
            <p className="text-muted text-xs font-mono">Querying {sourcesTotal} data sources…</p>
          </div>
          <span className="ml-auto text-primary font-mono font-bold text-sm">{progress}%</span>
        </div>

        <div className="h-1.5 bg-black/40 rounded-full mb-6 overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          {allSources.map((name) => {
            const sp = sources.find((s) => s.name === name)
            const label = SOURCE_LABELS[name as keyof typeof SOURCE_LABELS] ?? name
            const icon = SOURCE_ICONS[name] ?? '📊'
            return (
              <div
                key={name}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-all
                  ${sp?.done
                    ? (sp.events_count > 0 ? 'border-success/30 bg-success/5' : 'border-border bg-black/20')
                    : 'border-border bg-black/20 opacity-60'
                  }`}
              >
                <span className="text-base">{icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono text-white truncate">{label}</p>
                  {sp && (
                    <p className="text-xs font-mono text-muted">
                      {sp.events_count > 0 ? `${sp.events_count} events` : 'no data'}
                    </p>
                  )}
                </div>
                {sp?.done ? (
                  sp.events_count > 0
                    ? <CheckCircle className="w-3.5 h-3.5 text-success shrink-0" />
                    : <XCircle className="w-3.5 h-3.5 text-muted shrink-0" />
                ) : (
                  <Loader2 className="w-3.5 h-3.5 text-muted shrink-0 animate-spin" />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
