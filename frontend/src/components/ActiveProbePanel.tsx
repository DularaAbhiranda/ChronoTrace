import { useState } from 'react'
import { Zap, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
import type { ActiveModule } from '../types'
import { ACTIVE_MODULE_INFO } from '../types'

interface ActiveProbePanelProps {
  modules: ActiveModule[]
  onChange: (modules: ActiveModule[]) => void
}

// Ordered list — fast/safe first, slow/loud last
const ALL: ActiveModule[] = [
  'http_probe',
  'tls_live',
  'well_known',
  'dns_axfr',
  'port_scan',
  'port_scan_full',
  'dir_probe',
]

// Port scan variants are mutually exclusive — picking one auto-removes the other
const MUTEX_GROUPS: ActiveModule[][] = [['port_scan', 'port_scan_full']]

function applyMutex(selected: ActiveModule[], newlyAdded: ActiveModule): ActiveModule[] {
  let result = [...selected]
  for (const group of MUTEX_GROUPS) {
    if (group.includes(newlyAdded)) {
      result = result.filter((m) => !group.includes(m) || m === newlyAdded)
    }
  }
  return result
}

export function ActiveProbePanel({ modules, onChange }: ActiveProbePanelProps) {
  const [expanded, setExpanded] = useState(modules.length > 0)

  const toggle = (m: ActiveModule) => {
    if (modules.includes(m)) {
      onChange(modules.filter((x) => x !== m))
    } else {
      onChange(applyMutex([...modules, m], m))
    }
  }

  return (
    <div className="w-full max-w-3xl mx-auto mt-3">
      <button
        type="button"
        onClick={() => setExpanded((x) => !x)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-surface/50 border border-border rounded-lg hover:bg-surface transition-colors"
      >
        <div className="flex items-center gap-2">
          <Zap className={`w-4 h-4 ${modules.length > 0 ? 'text-danger' : 'text-muted'}`} />
          <span className="text-sm font-mono text-white">Active probing</span>
          {modules.length > 0 && (
            <span className="text-xs font-mono text-danger bg-danger/10 border border-danger/30 px-1.5 py-0.5 rounded">
              {modules.length} module{modules.length > 1 ? 's' : ''} enabled
            </span>
          )}
          {modules.length === 0 && (
            <span className="text-xs font-mono text-muted">off — passive only</span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />}
      </button>

      {expanded && (
        <div className="mt-2 p-4 bg-surface border border-border rounded-lg space-y-3">
          <div className="flex items-start gap-2 p-2.5 bg-danger/10 border border-danger/20 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-danger mt-0.5 shrink-0" />
            <p className="text-xs text-danger/90">
              Active modules send <b>live requests</b> to the target. Only enable on domains you own
              or have written authorization to probe. You will be asked to retype the domain to confirm.
            </p>
          </div>
          {ALL.map((m) => {
            const enabled = modules.includes(m)
            const info = ACTIVE_MODULE_INFO[m]
            return (
              <label
                key={m}
                className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                  enabled ? 'border-danger/40 bg-danger/5' : 'border-border hover:border-white/20'
                }`}
              >
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={() => toggle(m)}
                  className="mt-1 accent-red-500"
                />
                <div className="flex-1">
                  <p className="text-sm font-mono text-white">{info.label}</p>
                  <p className="text-xs text-muted mt-0.5">{info.desc}</p>
                  {info.warn && (
                    <p className="text-xs text-warning mt-1 flex items-start gap-1">
                      <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                      <span>{info.warn}</span>
                    </p>
                  )}
                </div>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}
