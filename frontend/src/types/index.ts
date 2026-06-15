export type EventSource =
  | 'wayback'
  | 'crt_sh'
  | 'rdap'
  | 'dns'
  | 'shodan'
  | 'virustotal'
  | 'hibp'
  | 'securitytrails'
  // Active (Tier 2)
  | 'port_scan'
  | 'http_probe'
  | 'tls_live'
  | 'well_known'
  | 'dns_axfr'
  | 'dir_probe'

export type EventType =
  | 'snapshot'
  | 'certificate'
  | 'subdomain'
  | 'registration'
  | 'dns_record'
  | 'exposure'
  | 'tech_change'
  | 'open_port'
  | 'http_fingerprint'
  | 'tls_chain'
  | 'well_known_file'
  | 'axfr_attempt'
  | 'discovered_path'

export type ActiveModule =
  | 'port_scan'
  | 'port_scan_full'
  | 'http_probe'
  | 'tls_live'
  | 'well_known'
  | 'dns_axfr'
  | 'dir_probe'

export const ACTIVE_SOURCES: Set<EventSource> = new Set([
  'port_scan', 'http_probe', 'tls_live', 'well_known', 'dns_axfr', 'dir_probe',
])

export const ACTIVE_MODULE_INFO: Record<ActiveModule, { label: string; desc: string; warn?: string }> = {
  port_scan:      { label: 'Port Scan (Top 20)',     desc: 'TCP connect-scan of 20 common ports with service-aware banner grab. ~5s.' },
  port_scan_full: { label: 'Port Scan (Full 1-65535)', desc: 'Full 65535-port TCP connect-scan with TLS handshake on HTTPS ports. Service-aware banner grab.', warn: 'Takes 5-15 min. Cloudflare-fronted targets will mostly drop connections.' },
  http_probe:     { label: 'HTTP Fingerprint',       desc: 'Live GET to http:// and https:// — headers, server tech, security headers audit.' },
  tls_live:       { label: 'TLS Inspection',         desc: 'Real TLS handshake on port 443 — actual served cert, cipher, validity.' },
  well_known:     { label: 'Well-known Files',       desc: 'robots.txt, sitemap.xml, security.txt, .well-known/* (~8 requests).' },
  dns_axfr:       { label: 'DNS Zone Transfer',      desc: 'Attempts AXFR against each nameserver. Almost always denied — gold when it works.' },
  dir_probe:      { label: 'Directory Probe',        desc: '~150 high-value paths: admin/, .env, .git/config, backups, API endpoints, debug pages. Scans for secret leakage in responses.', warn: 'Will appear in target server logs as ~150 GET requests.' },
}

export type Confidence = 'exact' | 'month' | 'year' | 'approximate'

export interface NormalizedEvent {
  id: string
  timestamp: string
  source: EventSource
  event_type: EventType
  subject: string
  details: Record<string, unknown>
  confidence: Confidence
}

export interface ScanJob {
  job_id: string
  domain: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number
  events: NormalizedEvent[]
  created_at: string
  completed_at: string | null
  error: string | null
  sources_completed: string[]
  sources_total: number
}

export interface ScanRequest {
  domain: string
  confirmed_authorization: boolean
  enabled_enrichment: Record<string, string>
  active_modules?: ActiveModule[]
  active_authorization_confirmed?: boolean
  active_domain_typed?: string
}

export interface HistoryEntry {
  job_id: string
  domain: string
  status: string
  created_at: string
  completed_at: string | null
  total_events: number
}

export interface Filters {
  sources: EventSource[]
  event_types: EventType[]
  date_from: string
  date_to: string
  search: string
}

export const SOURCE_COLORS: Record<EventSource, string> = {
  wayback: '#58a6ff',
  crt_sh: '#3fb950',
  rdap: '#d29922',
  dns: '#bc8cff',
  shodan: '#ff7b72',
  virustotal: '#f85149',
  hibp: '#f78166',
  securitytrails: '#79c0ff',
  // Active — red/orange palette to signal "live probe"
  port_scan: '#ff6b6b',
  http_probe: '#ffa657',
  tls_live: '#ff9bd2',
  well_known: '#ffd166',
  dns_axfr: '#ff8c66',
  dir_probe: '#ff5555',
}

export const SOURCE_LABELS: Record<EventSource, string> = {
  wayback: 'Wayback',
  crt_sh: 'crt.sh',
  rdap: 'RDAP',
  dns: 'DNS',
  shodan: 'Shodan',
  virustotal: 'VirusTotal',
  hibp: 'HIBP',
  securitytrails: 'SecurityTrails',
  port_scan: 'Port Scan',
  http_probe: 'HTTP Probe',
  tls_live: 'TLS Live',
  well_known: 'Well-Known',
  dns_axfr: 'AXFR',
  dir_probe: 'Dir Probe',
}

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  snapshot: 'Snapshot',
  certificate: 'Certificate',
  subdomain: 'Subdomain',
  registration: 'Registration',
  dns_record: 'DNS Record',
  exposure: 'Exposure',
  tech_change: 'Tech Change',
  open_port: 'Open Port',
  http_fingerprint: 'HTTP Fingerprint',
  tls_chain: 'TLS Chain',
  well_known_file: 'Well-Known File',
  axfr_attempt: 'AXFR Attempt',
  discovered_path: 'Discovered Path',
}

export const API_BASE = '/api'

// ── AI attack-path analysis (GPT-4o) ──
export type RiskLevel = 'Critical' | 'High' | 'Medium' | 'Low'

export interface AttackPathStep {
  phase: string
  action: string
  tool_or_technique: string
}

export interface AttackPath {
  id: string
  name: string
  description: string
  severity: RiskLevel
  likelihood: 'High' | 'Medium' | 'Low'
  evidence: string[]
  steps: AttackPathStep[]
  objective: string
  defensive_recommendation: string
}

export interface InfrastructureRisk {
  service: string
  risk: string
  cvss_estimate: string
}

export interface AttackPathReport {
  executive_summary: string
  attack_surface_rating: RiskLevel
  attack_paths: AttackPath[]
  quick_wins: string[]
  infrastructure_risks: InfrastructureRisk[]
}

export const RISK_COLORS: Record<RiskLevel, string> = {
  Critical: '#f85149',
  High: '#ff7b72',
  Medium: '#d29922',
  Low: '#3fb950',
}
