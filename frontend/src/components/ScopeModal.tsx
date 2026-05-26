import { useState } from 'react'
import { Shield, AlertTriangle, CheckCircle, Zap } from 'lucide-react'
import type { ActiveModule } from '../types'
import { ACTIVE_MODULE_INFO } from '../types'

interface ScopeModalProps {
  domain: string
  activeModules: ActiveModule[]
  onConfirm: (activeConfirm?: { domainTyped: string }) => void
  onCancel: () => void
}

export function ScopeModal({ domain, activeModules, onConfirm, onCancel }: ScopeModalProps) {
  const hasActive = activeModules.length > 0
  const [typedDomain, setTypedDomain] = useState('')
  const domainMatches = typedDomain.trim().toLowerCase() === domain.toLowerCase()

  const handleConfirm = () => {
    if (hasActive && !domainMatches) return
    onConfirm(hasActive ? { domainTyped: typedDomain.trim() } : undefined)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl animate-in my-4">
        <div className="p-6">
          <div className="flex items-start gap-4 mb-6">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              hasActive ? 'bg-danger/20' : 'bg-warning/20'
            }`}>
              {hasActive
                ? <Zap className="w-5 h-5 text-danger" />
                : <Shield className="w-5 h-5 text-warning" />}
            </div>
            <div>
              <h2 className="text-white font-semibold text-lg">
                {hasActive ? 'Active Probing — Authorization Required' : 'Authorization Required'}
              </h2>
              <p className="text-muted text-sm mt-1">
                {hasActive
                  ? 'Confirm authorization for live probing of this target.'
                  : 'Confirm you have authorization to scan this target.'}
              </p>
            </div>
          </div>

          <div className="bg-black/40 border border-border rounded-lg p-4 mb-5 font-mono">
            <p className="text-muted text-xs mb-1">Target domain</p>
            <p className="text-primary text-sm font-semibold">{domain}</p>
          </div>

          {hasActive && (
            <div className="mb-5 p-3 bg-danger/10 border border-danger/30 rounded-lg">
              <p className="text-xs text-danger font-mono font-semibold mb-2 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                Active modules will send live requests
              </p>
              <ul className="space-y-1">
                {activeModules.map((m) => (
                  <li key={m} className="text-xs text-danger/90 font-mono">
                    • {ACTIVE_MODULE_INFO[m].label}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-3 mb-5">
            {[
              'I own this domain, or have written authorization to assess it.',
              'I will not use findings for unauthorized access or malicious purposes.',
              hasActive
                ? 'I understand active probing sends live traffic and may appear in logs/IDS.'
                : 'I understand this tool surfaces historical OSINT data from public sources.',
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <CheckCircle className="w-4 h-4 text-success mt-0.5 shrink-0" />
                <p className="text-sm text-muted">{item}</p>
              </div>
            ))}
          </div>

          {hasActive && (
            <div className="mb-5">
              <p className="text-xs font-mono text-muted mb-1.5">
                Re-type the domain to confirm active probing authorization:
              </p>
              <input
                type="text"
                value={typedDomain}
                onChange={(e) => setTypedDomain(e.target.value)}
                placeholder={domain}
                className={`w-full px-3 py-2 bg-black/40 border rounded-lg text-white text-sm font-mono outline-none transition-colors ${
                  typedDomain && !domainMatches
                    ? 'border-danger/60'
                    : domainMatches
                    ? 'border-success/60'
                    : 'border-border focus:border-primary/60'
                }`}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          )}

          <div className="flex items-center gap-2 p-3 bg-danger/10 border border-danger/20 rounded-lg mb-5">
            <AlertTriangle className="w-4 h-4 text-danger shrink-0" />
            <p className="text-xs text-danger/90">
              Unauthorized reconnaissance may violate the CFAA and equivalent laws. Use responsibly.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 rounded-lg border border-border text-muted hover:text-white hover:border-white/30 transition-colors text-sm font-mono"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={hasActive && !domainMatches}
              className={`flex-1 px-4 py-2.5 rounded-lg font-mono font-semibold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                hasActive
                  ? 'bg-danger text-white hover:bg-danger/90'
                  : 'bg-primary text-[#0d1117] hover:bg-primary/90'
              }`}
            >
              {hasActive ? 'Confirm & Probe' : 'Confirm & Scan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
