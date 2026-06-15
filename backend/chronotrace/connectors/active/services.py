"""Port → service-name mapping shared by the port-scan modules.

Combines a curated table of common / modern application ports with the
operating system's own services database (``socket.getservbyport``), so the
scanners can name far more ports than a hand-maintained list alone — anything
in the OS ``/etc/services`` (hundreds of ports) is covered for free, while the
curated table keeps modern app-layer ports (mongodb, elasticsearch, redis, …)
deterministic and well-labelled.
"""
import socket

# Curated names: well-known ports plus modern app-layer services that the OS
# services file often lacks or labels unhelpfully (e.g. 27017 -> mongodb).
PORT_SERVICES: dict[int, str] = {
    21: "ftp", 22: "ssh", 23: "telnet", 25: "smtp", 53: "dns",
    67: "dhcp", 69: "tftp", 80: "http", 88: "kerberos", 110: "pop3",
    111: "rpc", 123: "ntp", 135: "msrpc", 137: "netbios-ns", 139: "netbios",
    143: "imap", 161: "snmp", 179: "bgp", 389: "ldap", 443: "https",
    445: "smb", 465: "smtps", 514: "syslog", 515: "printer", 587: "submission",
    631: "ipp", 636: "ldaps", 873: "rsync", 993: "imaps", 995: "pop3s",
    1080: "socks", 1194: "openvpn", 1433: "mssql", 1521: "oracle", 1723: "pptp",
    2049: "nfs", 2082: "cpanel", 2083: "cpanel-ssl", 2086: "whm", 2087: "whm-ssl",
    2095: "webmail", 2096: "webmail-ssl", 2181: "zookeeper", 2222: "ssh-alt",
    2375: "docker", 2376: "docker-tls", 3000: "node-dev", 3128: "squid-proxy",
    3306: "mysql", 3389: "rdp", 4444: "metasploit", 4567: "galera",
    5000: "upnp", 5432: "postgres", 5601: "kibana", 5672: "amqp", 5900: "vnc",
    5984: "couchdb", 6379: "redis", 6443: "kubernetes", 7001: "weblogic",
    7474: "neo4j", 8000: "http-alt", 8008: "http-alt", 8080: "http-proxy",
    8081: "http-alt", 8086: "influxdb", 8088: "http-alt", 8443: "https-alt",
    8500: "consul", 8888: "http-alt", 9000: "http-mgmt", 9042: "cassandra",
    9090: "prometheus", 9092: "kafka", 9200: "elasticsearch", 9300: "elasticsearch",
    9418: "git", 9443: "https-alt", 9929: "nmap-test", 10000: "webmin",
    11211: "memcached", 15672: "rabbitmq-mgmt", 27017: "mongodb",
    27018: "mongodb", 27019: "mongodb", 31337: "elite",
    50070: "hadoop", 50075: "hadoop",
}


def service_name(port: int) -> str:
    """Best-effort service name for a TCP port.

    Curated table first (deterministic, covers modern app ports), then the OS
    services database, then ``"unknown"``.
    """
    if port in PORT_SERVICES:
        return PORT_SERVICES[port]
    try:
        return socket.getservbyport(port, "tcp")
    except (OSError, OverflowError, TypeError):
        return "unknown"
