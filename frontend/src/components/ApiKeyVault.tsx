import { useState } from 'react'
import { Key, X, Eye, EyeOff, Info } from 'lucide-react'

interface ApiKeyVaultProps {
  keys: Record<string, string>
  onChange: (keys: Record<string, string>) => void
  onClose: () => void
}

const SOURCES = [
  {
    id: 'shodan',
    label: 'Shodan',
    description: 'Host/port exposure, banners, service fingerprints',
    url: 'https://account.shodan.io/',
    free: true,
  },
  {
    id: 'virustotal',
    label: 'VirusTotal',
    description: 'Domain reputation, passive DNS, detected URLs',
    url: 'https://www.virustotal.com/gui/join-us',
    free: true,
  },
  {
    id: 'hibp',
    label: 'Have I Been Pwned',
    description: 'Breach associations for domain email addresses',
    url: 'https://haveibeenpwned.com/API/Key',
    free: false,
  },
]

function KeyField({
  id, value, onChange,
}: { id: string; value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative flex items-center">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Paste API key here…"
        className="w-full pr-8 px-3 py-2 bg-black/30 border border-border rounded-lg text-white text-xs font-mono outline-none focus:border-primary/60 placeholder:text-muted/40"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2 text-muted hover:text-white transition-colors"
      >
        {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>
    </div>
  )
}

export function ApiKeyVault({ keys, onChange, onClose }: ApiKeyVaultProps) {
  const update = (id: string, value: string) => {
    const next = { ...keys }
    if (value.trim()) {
      next[id] = value.trim()
    } else {
      delete next[id]
    }
    onChange(next)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-surface border border-border rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Key className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-sm">API Key Vault</h2>
              <p className="text-muted text-xs">Keys are stored in your browser session only.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="flex items-start gap-2 p-3 bg-primary/10 border border-primary/20 rounded-lg">
            <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <p className="text-xs text-primary/90">
              These optional keys enable enrichment sources. Your quota — not the platform's — is consumed.
              Keys are never sent to any server except the respective API endpoint.
            </p>
          </div>

          {SOURCES.map((s) => (
            <div key={s.id}>
              <div className="flex items-center justify-between mb-1.5">
                <div>
                  <span className="text-white text-sm font-mono font-semibold">{s.label}</span>
                  {!s.free && (
                    <span className="ml-2 text-xs text-warning font-mono bg-warning/10 px-1.5 py-0.5 rounded">
                      paid key
                    </span>
                  )}
                  {s.free && (
                    <span className="ml-2 text-xs text-success font-mono bg-success/10 px-1.5 py-0.5 rounded">
                      free tier
                    </span>
                  )}
                </div>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary font-mono hover:underline"
                >
                  Get key →
                </a>
              </div>
              <p className="text-muted text-xs mb-2">{s.description}</p>
              <KeyField
                id={s.id}
                value={keys[s.id] ?? ''}
                onChange={(v) => update(s.id, v)}
              />
            </div>
          ))}
        </div>

        <div className="p-5 pt-0">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 bg-primary text-[#0d1117] font-mono font-semibold text-sm rounded-lg hover:bg-primary/90 transition-colors"
          >
            Save & Close
          </button>
        </div>
      </div>
    </div>
  )
}
