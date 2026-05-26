from pydantic import BaseModel
from typing import Optional, Any, List, Dict
from enum import Enum


class EventSource(str, Enum):
    WAYBACK = "wayback"
    CRT_SH = "crt_sh"
    RDAP = "rdap"
    DNS = "dns"
    SHODAN = "shodan"
    VIRUSTOTAL = "virustotal"
    HIBP = "hibp"
    SECURITYTRAILS = "securitytrails"
    # Active (Tier 2) sources — require active authorization
    PORT_SCAN = "port_scan"
    HTTP_PROBE = "http_probe"
    TLS_LIVE = "tls_live"
    WELL_KNOWN = "well_known"
    DNS_AXFR = "dns_axfr"
    DIR_PROBE = "dir_probe"


# Active sources require additional authorization
ACTIVE_SOURCES: set = {
    EventSource.PORT_SCAN,
    EventSource.HTTP_PROBE,
    EventSource.TLS_LIVE,
    EventSource.WELL_KNOWN,
    EventSource.DNS_AXFR,
    EventSource.DIR_PROBE,
}


class EventType(str, Enum):
    SNAPSHOT = "snapshot"
    CERTIFICATE = "certificate"
    SUBDOMAIN = "subdomain"
    REGISTRATION = "registration"
    DNS_RECORD = "dns_record"
    EXPOSURE = "exposure"
    TECH_CHANGE = "tech_change"
    # Active event types
    OPEN_PORT = "open_port"
    HTTP_FINGERPRINT = "http_fingerprint"
    TLS_CHAIN = "tls_chain"
    WELL_KNOWN_FILE = "well_known_file"
    AXFR_ATTEMPT = "axfr_attempt"
    DISCOVERED_PATH = "discovered_path"


class Confidence(str, Enum):
    EXACT = "exact"
    MONTH = "month"
    YEAR = "year"
    APPROXIMATE = "approximate"


class NormalizedEvent(BaseModel):
    id: str
    timestamp: str
    source: EventSource
    event_type: EventType
    subject: str
    details: Dict[str, Any] = {}
    confidence: Confidence = Confidence.EXACT


class ScanJob(BaseModel):
    job_id: str
    domain: str
    status: str
    progress: int = 0
    events: List[NormalizedEvent] = []
    created_at: str
    completed_at: Optional[str] = None
    error: Optional[str] = None
    sources_completed: List[str] = []
    sources_total: int = 0


class ScanRequest(BaseModel):
    domain: str
    confirmed_authorization: bool
    enabled_enrichment: Dict[str, str] = {}
    # Tier 2: active probing
    active_modules: List[str] = []  # subset of: port_scan, http_probe, tls_live, well_known
    active_authorization_confirmed: bool = False
    active_domain_typed: Optional[str] = None  # user re-typed the domain as confirmation


class ExportRequest(BaseModel):
    job_id: str
    format: str
    filters: Optional[Dict[str, Any]] = None
