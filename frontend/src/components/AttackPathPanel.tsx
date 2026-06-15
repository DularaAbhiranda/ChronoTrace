import { useState } from 'react'
import {
  Brain, Loader2, Eye, EyeOff, AlertTriangle, Target,
  ChevronDown, ChevronUp, Zap, Server, ShieldCheck,
} from 'lucide-react'
import { API_BASE, RISK_COLORS } from '../types'
import type { AttackPathReport, AttackPath, RiskLevel } from '../types'

const KEY_STORE = 'chronotrace_openai_key'

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide"
      style={{ backgroundColor: color + '22', color }}
    >
      {label}
    </span>
  )
}

function PathCard({ path }: { path: AttackPath }) {
  const [open, setOpen] = useState(false)
  const sev = RISK_COLORS[path.severity] ?? '#8b949e'
  return (
    <div className="border border-border rounded-lg bg-black/20">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 p-3 text-left hover:bg-white/5 transition-colors"
      >
        <Target className="w-4 h-4 shrink-0" style={{ color: sev }} />
        <span className="text-white text-sm font-mono font-semibold flex-1">{path.name}</span>
        <Badge label={path.severity} color={sev} />
        <Badge label={`${path.likelihood} likelihood`} color="#8b949e" />
        {open ? <ChevronUp className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3 border-t border-border/50 pt-3">
          <p className="text-muted text-xs leading-relaxed">{path.description}</p>

          {path.objective && (
            <p className="text-xs text-white/70"><span className="text-muted">Objective:</span> {path.objective}</p>
          )}

          {path.evidence?.length > 0 && (
            <div>
              <p className="text-[11px] text-muted font-semibold mb-1 uppercase tracking-wide">Evidence</p>
              <ul className="space-y-0.5">
                {path.evidence.map((ev, i) => (
                  <li key={i} className="text-xs text-white/80 font-mono">• {ev}</li>
                ))}
              </ul>
            </div>
          )}

          {path.steps?.length > 0 && (
            <div>
              <p className="text-[11px] text-muted font-semibold mb-1 uppercase tracking-wide">Kill chain</p>
              <ol className="space-y-1">
                {path.steps.map((s, i) => (
                  <li key={i} className="text-xs flex gap-2">
                    <span className="text-primary font-mono shrink-0">{i + 1}.</span>
                    <span className="text-white/80">
                      <span className="text-warning font-mono">[{s.phase}]</span> {s.action}
                      {s.tool_or_technique && (
                        <span className="text-muted"> — {s.tool_or_technique}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {path.defensive_recommendation && (
            <div className="flex items-start gap-2 p-2 bg-success/10 border border-success/20 rounded">
              <ShieldCheck className="w-3.5 h-3.5 text-success mt-0.5 shrink-0" />
              <p className="text-xs text-success/90">{path.defensive_recommendation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function AttackPathPanel({ jobId }: { jobId: string }) {
  const [key, setKey] = useState(() => localStorage.getItem(KEY_STORE) ?? '')
  const [showKey, setShowKey] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [report, setReport] = useState<AttackPathReport | null>(null)
  const [error, setError] = useState('')

  async function run() {
    const k = key.trim()
    if (!k) {
      setError('Enter your OpenAI API key first.')
      setStatus('error')
      return
    }
    localStorage.setItem(KEY_STORE, k)
    setStatus('loading')
    setError('')
    try {
      const res = await fetch(`${API_BASE}/scans/${jobId}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openai_api_key: k }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail || `Request failed (HTTP ${res.status})`)
      }
      const data = await res.json()
      setReport(data.analysis as AttackPathReport)
      setStatus('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed')
      setStatus('error')
    }
  }

  const rating = report ? RISK_COLORS[report.attack_surface_rating] ?? '#8b949e' : '#8b949e'

  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Brain className="w-4 h-4 text-[#bc8cff]" />
        <span className="text-white font-mono text-sm font-semibold">AI Attack-Path Analysis</span>
        <span className="text-muted text-xs font-mono ml-auto">OpenAI GPT-4o · your key, your quota</span>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex items-center flex-1">
          <input
            type={showKey ? 'text' : 'password'}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="OpenAI API key (sk-…)"
            className="w-full pr-8 px-3 py-2 bg-black/30 border border-border rounded-lg text-white text-xs font-mono outline-none focus:border-[#bc8cff]/60 placeholder:text-muted/40"
          />
          <button
            type="button"
            onClick={() => setShowKey((s) => !s)}
            className="absolute right-2 text-muted hover:text-white transition-colors"
          >
            {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
        <button
          onClick={run}
          disabled={status === 'loading'}
          className="shrink-0 flex items-center justify-center gap-2 px-4 py-2 bg-[#bc8cff] text-[#0d1117] font-mono font-semibold text-sm rounded-lg hover:bg-[#bc8cff]/90 disabled:opacity-50 transition-colors"
        >
          {status === 'loading' ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing…</>
          ) : (
            <><Brain className="w-4 h-4" /> {report ? 'Re-analyze' : 'Run AI Analysis'}</>
          )}
        </button>
      </div>

      <p className="text-muted text-[11px] mt-2">
        Sends this scan's findings to GPT-4o to map realistic attack paths. Takes 15–30s. Key stays in your browser.
      </p>

      {status === 'loading' && (
        <div className="flex items-center gap-2 mt-4 text-[#bc8cff] text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="font-mono">Analyzing attack surface… (15–30s)</span>
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-start gap-2 mt-4 p-3 bg-danger/10 border border-danger/30 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-danger mt-0.5 shrink-0" />
          <p className="text-danger text-xs">{error}</p>
        </div>
      )}

      {status === 'done' && report && (
        <div className="mt-4 space-y-4">
          {/* Executive summary + rating */}
          <div className="p-3 bg-black/20 border border-border rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] text-muted font-semibold uppercase tracking-wide">Attack surface</span>
              <Badge label={report.attack_surface_rating} color={rating} />
            </div>
            <p className="text-white/80 text-xs leading-relaxed">{report.executive_summary}</p>
          </div>

          {/* Attack paths */}
          {report.attack_paths?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-white font-mono font-semibold">
                Attack paths <span className="text-muted">({report.attack_paths.length})</span>
              </p>
              {report.attack_paths.map((p) => <PathCard key={p.id} path={p} />)}
            </div>
          )}

          {/* Quick wins */}
          {report.quick_wins?.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Zap className="w-3.5 h-3.5 text-warning" />
                <p className="text-xs text-white font-mono font-semibold">Quick wins</p>
              </div>
              <ul className="space-y-1">
                {report.quick_wins.map((w, i) => (
                  <li key={i} className="text-xs text-white/80">• {w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Infrastructure risks */}
          {report.infrastructure_risks?.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Server className="w-3.5 h-3.5 text-primary" />
                <p className="text-xs text-white font-mono font-semibold">Infrastructure risks</p>
              </div>
              <div className="space-y-1">
                {report.infrastructure_risks.map((r, i) => (
                  <div key={i} className="text-xs flex gap-2 flex-wrap">
                    <span className="text-white font-mono">{r.service}</span>
                    <span className="text-muted">— {r.risk}</span>
                    <span className="text-warning font-mono">CVSS ~{r.cvss_estimate}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
