import { useState, type FormEvent } from 'react'
import { Search, AlertCircle } from 'lucide-react'

interface DomainInputProps {
  onSubmit: (domain: string) => void
  disabled?: boolean
}

function normalizeDomain(input: string): string {
  let d = input.trim().toLowerCase()
  if (d.startsWith('http://') || d.startsWith('https://')) {
    try {
      d = new URL(d).hostname
    } catch {}
  }
  return d.replace(/\/$/, '')
}

function isValidDomain(domain: string): boolean {
  return /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(domain)
}

export function DomainInput({ onSubmit, disabled }: DomainInputProps) {
  const [value, setValue] = useState('')
  const [validationError, setValidationError] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const domain = normalizeDomain(value)
    if (!domain) {
      setValidationError('Please enter a domain.')
      return
    }
    if (!isValidDomain(domain)) {
      setValidationError('Enter a valid domain (e.g. example.com).')
      return
    }
    setValidationError('')
    onSubmit(domain)
  }

  return (
    <div className="w-full max-w-3xl mx-auto">
      <form onSubmit={handleSubmit} className="relative">
        <div
          className={`flex items-center gap-2 bg-surface border rounded-xl px-4 py-3 transition-all
            ${validationError ? 'border-danger/70' : 'border-border hover:border-primary/50 focus-within:border-primary'}`}
        >
          <Search className="w-5 h-5 text-muted shrink-0" />
          <input
            type="text"
            value={value}
            onChange={(e) => { setValue(e.target.value); setValidationError('') }}
            placeholder="example.com — enter domain or URL to investigate"
            disabled={disabled}
            className="flex-1 bg-transparent text-white font-mono text-sm outline-none placeholder:text-muted/50 disabled:opacity-50"
            autoFocus
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="submit"
            disabled={disabled || !value.trim()}
            className="shrink-0 px-4 py-1.5 bg-primary text-[#0d1117] font-mono font-semibold text-sm rounded-lg
              hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Trace
          </button>
        </div>
      </form>
      {validationError && (
        <p className="mt-2 flex items-center gap-1.5 text-danger text-xs font-mono">
          <AlertCircle className="w-3.5 h-3.5" />
          {validationError}
        </p>
      )}
    </div>
  )
}
