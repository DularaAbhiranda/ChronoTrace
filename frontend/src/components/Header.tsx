import { useState } from 'react'
import { Clock, Key, History, Github, Shield } from 'lucide-react'

interface HeaderProps {
  onOpenKeys: () => void
  onOpenHistory: () => void
}

export function Header({ onOpenKeys, onOpenHistory }: HeaderProps) {
  return (
    <header className="border-b border-border bg-surface/80 backdrop-blur-sm sticky top-0 z-40">
      <div className="max-w-screen-2xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Clock className="w-4 h-4 text-primary" />
            </div>
            <span className="font-mono font-bold text-lg text-white tracking-tight">
              Chrono<span className="text-primary">Trace</span>
            </span>
          </div>
          <span className="hidden sm:block text-xs text-muted font-mono bg-border/50 px-2 py-0.5 rounded">
            v1.0 OSINT
          </span>
        </div>

        <nav className="flex items-center gap-1">
          <button
            onClick={onOpenHistory}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-muted hover:text-white hover:bg-white/5 transition-colors font-mono"
          >
            <History className="w-4 h-4" />
            <span className="hidden sm:inline">History</span>
          </button>
          <button
            onClick={onOpenKeys}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-muted hover:text-white hover:bg-white/5 transition-colors font-mono"
          >
            <Key className="w-4 h-4" />
            <span className="hidden sm:inline">API Keys</span>
          </button>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-muted hover:text-white hover:bg-white/5 transition-colors"
          >
            <Github className="w-4 h-4" />
          </a>
        </nav>
      </div>
    </header>
  )
}
