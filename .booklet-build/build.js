// Generates ChronoTrace_User_Guide.docx — the official user booklet.
// Run with: node build.js

const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType,
  HeadingLevel, LevelFormat, BorderStyle, WidthType, ShadingType, PageBreak,
  Header, Footer, PageNumber, TabStopType, TabStopPosition,
} = require("docx");

// ───────────────────────── Style helpers ─────────────────────────

const COLOR = {
  primary: "0B5394",        // deep blue
  accent:  "C00000",        // red — warnings / active modules
  ok:      "2E7D32",        // green — safe / passive
  muted:   "555555",        // body text alt
  codeBg:  "F2F2F2",        // gray code background
  warnBg:  "FFF3CD",        // yellow callout
  warnBorder: "FFC107",
  errBg:   "F8D7DA",        // red callout
  errBorder: "DC3545",
  okBg:    "D4EDDA",        // green callout
  okBorder: "28A745",
};

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120, ...opts.spacing },
    alignment: opts.alignment,
    children: [new TextRun({
      text,
      size: opts.size || 22, // 11pt
      bold: opts.bold,
      italics: opts.italics,
      color: opts.color,
      font: opts.font,
    })],
  });
}

function bold(text, opts = {}) { return p(text, { ...opts, bold: true }); }

function heading(text, level = 1) {
  return new Paragraph({
    heading: level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
    spacing: { before: level === 1 ? 360 : 240, after: level === 1 ? 200 : 120 },
    pageBreakBefore: level === 1,
    children: [new TextRun({ text, bold: true, color: COLOR.primary, font: "Arial" })],
  });
}

function code(lines) {
  // Render code block as a single-cell table with gray shading
  const border = { style: BorderStyle.SINGLE, size: 4, color: "DDDDDD" };
  const text = Array.isArray(lines) ? lines.join("\n") : lines;
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [9360],
    rows: [new TableRow({
      children: [new TableCell({
        borders: { top: border, bottom: border, left: border, right: border },
        width: { size: 9360, type: WidthType.DXA },
        shading: { fill: COLOR.codeBg, type: ShadingType.CLEAR },
        margins: { top: 120, bottom: 120, left: 180, right: 180 },
        children: text.split("\n").map(line =>
          new Paragraph({
            spacing: { after: 0 },
            children: [new TextRun({ text: line || " ", font: "Consolas", size: 18 })],
          })
        ),
      })],
    })],
  });
}

function callout(title, body, type = "info") {
  const colors = {
    info:  { bg: COLOR.okBg, border: COLOR.okBorder, titleColor: COLOR.ok },
    warn:  { bg: COLOR.warnBg, border: COLOR.warnBorder, titleColor: "856404" },
    error: { bg: COLOR.errBg, border: COLOR.errBorder, titleColor: COLOR.accent },
  }[type];
  const border = { style: BorderStyle.SINGLE, size: 8, color: colors.border };
  const bodyParas = (Array.isArray(body) ? body : [body]).map(line =>
    new Paragraph({
      spacing: { after: 60 },
      children: [new TextRun({ text: line, size: 22, font: "Arial" })],
    })
  );
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [9360],
    rows: [new TableRow({
      children: [new TableCell({
        borders: { top: border, bottom: border, left: border, right: border },
        width: { size: 9360, type: WidthType.DXA },
        shading: { fill: colors.bg, type: ShadingType.CLEAR },
        margins: { top: 140, bottom: 140, left: 200, right: 200 },
        children: [
          new Paragraph({
            spacing: { after: 80 },
            children: [new TextRun({ text: title, bold: true, size: 22, color: colors.titleColor, font: "Arial" })],
          }),
          ...bodyParas,
        ],
      })],
    })],
  });
}

function bullets(items) {
  return items.map(text => new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { after: 80 },
    children: [new TextRun({ text, size: 22, font: "Arial" })],
  }));
}

function numbered(items) {
  return items.map(text => new Paragraph({
    numbering: { reference: "numbers", level: 0 },
    spacing: { after: 80 },
    children: [new TextRun({ text, size: 22, font: "Arial" })],
  }));
}

function table(rows, widths) {
  // rows[0] is header row
  const totalWidth = 9360;
  const cols = widths || rows[0].map(() => Math.floor(totalWidth / rows[0].length));
  // Normalize to exact total
  const sum = cols.reduce((a, b) => a + b, 0);
  if (sum !== totalWidth) cols[cols.length - 1] += totalWidth - sum;

  const border = { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" };
  const borders = { top: border, bottom: border, left: border, right: border };

  return new Table({
    width: { size: totalWidth, type: WidthType.DXA },
    columnWidths: cols,
    rows: rows.map((row, i) => new TableRow({
      tableHeader: i === 0,
      children: row.map((cell, j) => new TableCell({
        borders,
        width: { size: cols[j], type: WidthType.DXA },
        shading: i === 0 ? { fill: "E8EEF7", type: ShadingType.CLEAR } : undefined,
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({
          spacing: { after: 0 },
          children: [new TextRun({ text: cell, bold: i === 0, size: 20, font: "Arial" })],
        })],
      })),
    })),
  });
}

function spacer(height = 200) {
  return new Paragraph({ spacing: { after: height }, children: [new TextRun({ text: "" })] });
}

// ───────────────────────── Content sections ─────────────────────────

function coverPage() {
  return [
    spacer(2400),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [new TextRun({ text: "ChronoTrace", size: 96, bold: true, color: COLOR.primary, font: "Arial" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 480 },
      children: [new TextRun({ text: "User Guide & Field Manual", size: 36, color: COLOR.muted, font: "Arial" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [new TextRun({ text: "Domain History  ·  Certificate Transparency  ·  Active Recon", size: 22, italics: true, color: COLOR.muted, font: "Arial" })],
    }),
    spacer(2400),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new TextRun({ text: "Version 1.0", size: 24, bold: true, font: "Arial" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new TextRun({ text: "Released May 2026", size: 22, font: "Arial" })],
    }),
    spacer(800),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "Dulara Abhiranda", size: 22, bold: true, font: "Arial" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new TextRun({ text: "github.com/DularaAbhiranda/ChronoTrace", size: 20, color: COLOR.primary, font: "Consolas" })],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

function tocPage() {
  // Manual table of contents (Word's auto TOC requires field codes that docx-js doesn't fully render)
  const entries = [
    ["Chapter 1", "Introduction", "5"],
    ["Chapter 2", "Installation", "7"],
    ["Chapter 3", "Quick Start", "11"],
    ["Chapter 4", "Recipe 1: Just Exploring", "13"],
    ["Chapter 5", "Recipe 2: Securing Your Own Site", "16"],
    ["Chapter 6", "Recipe 3: Authorized Pentest Recon", "20"],
    ["Chapter 7", "Recipe 4: Brand Abuse Investigation", "24"],
    ["Chapter 8", "Recipe 5: Incident Response Timeline", "27"],
    ["Chapter 9", "Recipe 6: Research & Journalism", "30"],
    ["Chapter 10", "Recipe 7: Continuous Monitoring", "32"],
    ["Chapter 11", "Output Formats", "35"],
    ["Chapter 12", "Integration with Other Tools", "38"],
    ["Chapter 13", "Module Reference", "41"],
    ["Chapter 14", "Command Reference", "45"],
    ["Chapter 15", "Legal & Ethical Guidelines", "48"],
    ["Appendix A", "Glossary", "51"],
    ["Appendix B", "Reading a Real Scan Output", "53"],
    ["Appendix C", "FAQ & Troubleshooting", "57"],
  ];
  return [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 360 },
      children: [new TextRun({ text: "Contents", bold: true, color: COLOR.primary, font: "Arial" })],
    }),
    ...entries.map(([chap, title, page]) =>
      new Paragraph({
        spacing: { after: 120 },
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        children: [
          new TextRun({ text: chap, size: 22, bold: true, font: "Arial" }),
          new TextRun({ text: "    " + title, size: 22, font: "Arial" }),
          new TextRun({ text: "\t" + page, size: 22, font: "Arial", color: COLOR.muted }),
        ],
      })
    ),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

function chapter1Introduction() {
  return [
    heading("Chapter 1: Introduction"),
    bold("What is ChronoTrace?"),
    p("ChronoTrace is an OSINT reconnaissance tool that consolidates several public-data sources into a single, chronological timeline for any domain. It runs as a command-line tool on Kali Linux, Ubuntu, macOS, and Windows, and also ships with an optional web interface."),
    p("Where traditional OSINT workflows require running half a dozen separate tools (amass, crt.sh manual lookups, Wayback CLI, dig, whois) and stitching results together by hand, ChronoTrace queries all of them in parallel and presents one correlated view."),
    spacer(),
    bold("Who is this guide for?"),
    p("This booklet is written for a deliberately mixed audience. You do not need to be a security professional to use ChronoTrace — but every reader should understand what they are doing and why."),
    ...bullets([
      "Students learning OSINT and reconnaissance fundamentals",
      "Website owners who want to audit their own attack surface",
      "Authorized penetration testers and bug bounty hunters",
      "Brand-protection teams investigating phishing and impersonation",
      "Incident responders reconstructing breach timelines",
      "Journalists and researchers verifying public claims",
      "Threat intelligence analysts monitoring infrastructure",
    ]),
    spacer(),
    bold("What makes ChronoTrace different?"),
    table([
      ["Capability", "ChronoTrace", "Traditional alternative"],
      ["Subdomain discovery", "crt.sh + Wayback merged", "amass + manual crt.sh"],
      ["Historical content", "Wayback CDX paginated", "wayback_machine_downloader"],
      ["Registration info", "RDAP", "whois (legacy, less structured)"],
      ["Live DNS resolution", "dnspython, all record types", "dig + parsing"],
      ["Timeline view", "Single chronological output", "None — manual correlation"],
      ["Active probing", "Opt-in, gated by authorization", "Separate tools, separate flags"],
      ["Output formats", "Pretty / JSON / CSV", "Tool-specific"],
    ], [2400, 3480, 3480]),
    spacer(),
    bold("What ChronoTrace will NOT do"),
    p("Being honest about the limits is part of using any security tool well."),
    ...bullets([
      "It does not exploit vulnerabilities — it surfaces information",
      "It does not perform stealth SYN scans (no root / raw sockets)",
      "It does not brute-force passwords or perform credential attacks",
      "It does not bypass authentication, WAFs, or rate limits",
      "It does not guarantee complete coverage — third-party APIs can be flaky",
      "It does not absolve you of responsibility for how you use the data",
    ]),
    spacer(),
    callout("Important",
      "Active modules (port scan, directory probe, AXFR, HTTP fingerprint, TLS handshake, well-known harvesting) send live requests to the target. They will appear in the target's server logs and intrusion-detection systems. Only enable active modules on domains you own or have written authorization to test.",
      "warn"),
  ];
}

function chapter2Installation() {
  return [
    heading("Chapter 2: Installation"),
    bold("Prerequisites"),
    p("ChronoTrace requires Python 3.10 or newer. Most modern Linux distributions ship Python 3.11 or 3.12. Check your version:"),
    code("python3 --version"),
    p("If you see Python 3.10+ you are ready. Otherwise install a newer Python first."),
    spacer(),
    heading("Installing on Kali Linux", 2),
    p("Kali ships with Python and Git. The recommended path is via pipx, which installs ChronoTrace in an isolated environment so it does not conflict with system packages."),
    code([
      "# 1. Install pipx and jq (jq is used in many of the recipes later)",
      "sudo apt update && sudo apt install -y pipx jq",
      "",
      "# 2. Make sure pipx-installed commands are on your PATH",
      "pipx ensurepath",
      "",
      "# 3. Clone the repository",
      "git clone https://github.com/DularaAbhiranda/ChronoTrace.git",
      "cd ChronoTrace",
      "",
      "# 4. Install ChronoTrace",
      "pipx install ./backend",
      "",
      "# 5. Open a NEW terminal so PATH refreshes, then verify",
      "chronotrace --version",
    ]),
    p("You should see chronotrace 1.0.0 confirming the install succeeded."),
    spacer(),
    heading("Installing on Ubuntu, Debian, or other Linux", 2),
    p("The same steps as Kali work. If pipx is not yet packaged:"),
    code([
      "sudo apt install -y python3-pip git",
      "python3 -m pip install --user pipx",
      "python3 -m pipx ensurepath",
      "# then continue with the clone + pipx install steps above",
    ]),
    spacer(),
    heading("Installing on macOS", 2),
    code([
      "# Using Homebrew",
      "brew install pipx jq",
      "pipx ensurepath",
      "git clone https://github.com/DularaAbhiranda/ChronoTrace.git",
      "cd ChronoTrace",
      "pipx install ./backend",
    ]),
    spacer(),
    heading("Installing on Windows", 2),
    p("Windows users have two options: pipx in PowerShell, or a virtual environment."),
    code([
      "# Option A: pipx (requires Python 3.10+ on PATH)",
      "python -m pip install --user pipx",
      "python -m pipx ensurepath",
      "# restart PowerShell so the new PATH is loaded",
      "git clone https://github.com/DularaAbhiranda/ChronoTrace.git",
      "cd ChronoTrace",
      "pipx install .\\backend",
      "",
      "# Option B: Virtual environment (most portable)",
      "git clone https://github.com/DularaAbhiranda/ChronoTrace.git",
      "cd ChronoTrace\\backend",
      "python -m venv venv",
      "venv\\Scripts\\activate",
      "pip install -e .",
      "chronotrace --version",
    ]),
    spacer(),
    heading("Verifying the install", 2),
    p("Run a few harmless commands to confirm everything works:"),
    code([
      "chronotrace --version          # should print: chronotrace 1.0.0",
      "chronotrace --list-modules     # show all available data sources",
      "chronotrace --help             # show all command-line options",
    ]),
    spacer(),
    heading("Troubleshooting", 2),
    table([
      ["Error you see", "What it means", "How to fix"],
      ["command not found: chronotrace", "PATH not updated", "Open a new terminal, or run: pipx ensurepath"],
      ["externally-managed-environment", "System Python is protected (Kali, Debian)", "Use pipx instead of pip"],
      ["Python 3.10+ required", "Your Python is too old", "sudo apt install python3.11"],
      ["pip: command not found", "pip not installed", "sudo apt install python3-pip"],
      ["Cannot install: rust toolchain", "Pydantic build failed", "Upgrade pip: pip install --upgrade pip"],
    ], [3000, 3000, 3360]),
  ];
}

function chapter3QuickStart() {
  return [
    heading("Chapter 3: Quick Start"),
    p("This chapter gets you from zero to a real scan in two minutes. Read it before the recipes — every recipe assumes you understand the basics covered here."),
    spacer(),
    heading("Your first scan", 2),
    p("Type the simplest possible command:"),
    code("chronotrace example.com"),
    p("Wait about 60 seconds. ChronoTrace runs four passive sources in parallel and produces a chronological timeline."),
    spacer(),
    heading("Reading the output", 2),
    p("The output has three main sections:"),
    ...numbered([
      "Banner and header — name, version, target, modules running, start time",
      "Per-source status — green [+] marks for each source as it completes, with event count",
      "Source Summary table — totals from each source",
      "Detail tables — first 30 events from each source",
      "Final summary panel — total events, date range",
    ]),
    spacer(),
    bold("Example output for example.com"),
    code([
      "[+] dns                  0.4s      5 events",
      "[+] rdap                 1.7s      2 events",
      "[+] crt_sh               6.8s     71 events",
      "[+] wayback             12.3s   4991 events",
      "",
      "Total: 5069 events across 4 sources",
      "Date range: 1995-08-14 -> 2026-05-27",
    ]),
    spacer(),
    heading("The flags you will use most often", 2),
    table([
      ["Flag", "Effect"],
      ["--active", "Add safe active modules (HTTP probe, TLS, port scan, AXFR, well-known, dir probe)"],
      ["--full", "Everything including the full 1-65535 port scan (10-15 min)"],
      ["--only X,Y", "Run only these sources (e.g. --only wayback,crt_sh)"],
      ["-y", "Skip the interactive authorization prompt"],
      ["--json -o file.json", "Save results as JSON for later analysis"],
      ["--csv -o file.csv", "Save results as CSV for Excel"],
      ["--quiet", "Suppress banner and progress, just show data"],
      ["--no-color", "Plain text output (good for pipes and log files)"],
      ["--verbose", "Show detailed retry / error messages"],
    ], [2200, 7160]),
    spacer(),
    heading("Saving results", 2),
    p("The most useful flag combination for any serious work:"),
    code("chronotrace example.com --json -o scan-$(date +%Y-%m-%d).json"),
    p("This saves the full result as JSON with today's date in the filename. You can re-analyze it later, compare two scans, or feed it to other tools without re-running the scan."),
    spacer(),
    heading("A note on the safety prompt", 2),
    p("When you use --active, --full, or any individual active module flag, ChronoTrace will show an AUTHORIZATION REQUIRED banner and ask you to retype the target domain. This is intentional — it prevents accidentally scanning the wrong target."),
    p("If you are running ChronoTrace from a script or automated job, add -y to skip the prompt. Only do this when you have full authorization for the target."),
  ];
}

function recipeChapter({ title, who, learn, steps, lookFor, action, pitfalls }) {
  const blocks = [
    heading(title),
    callout("Who this is for", who, "info"),
    spacer(),
    bold("What you will learn"),
    p(learn),
    spacer(),
    bold("Step-by-step"),
    ...steps.flatMap(step => {
      const out = [
        new Paragraph({
          spacing: { before: 160, after: 80 },
          children: [
            new TextRun({ text: `Step ${step.n}: `, bold: true, size: 22, color: COLOR.primary, font: "Arial" }),
            new TextRun({ text: step.title, bold: true, size: 22, font: "Arial" }),
          ],
        }),
        p(step.desc),
      ];
      if (step.code) out.push(code(step.code));
      if (step.note) out.push(p(step.note, { italics: true, color: COLOR.muted }));
      return out;
    }),
  ];

  if (lookFor) {
    blocks.push(spacer(), bold("What to look for in the output"), table(lookFor, [3700, 5660]));
  }
  if (action) {
    blocks.push(spacer(), bold("What to do with the findings"), ...bullets(action));
  }
  if (pitfalls) {
    blocks.push(spacer(), callout("Common pitfalls", pitfalls, "warn"));
  }
  return blocks;
}

function chapter4Recipe1() {
  return recipeChapter({
    title: "Chapter 4 — Recipe 1: Just Exploring",
    who: "Students, beginners, anyone exploring OSINT for the first time. You are curious about what information is publicly available about any website, but you are not pursuing a specific security objective yet.",
    learn: "What kinds of information exist in public databases about any domain, and how ChronoTrace surfaces it. You will run safe passive scans against well-known targets.",
    steps: [
      { n: 1, title: "Run a basic scan",
        desc: "Pick a safe public target. example.com is the standard.",
        code: "chronotrace example.com" },
      { n: 2, title: "Watch the live progress",
        desc: "As each source completes, you will see a green [+] line with the event count. This usually takes 30 to 90 seconds." },
      { n: 3, title: "Read the per-source detail tables",
        desc: "Look at the Wayback table — every archived URL. Look at crt.sh — every TLS certificate. Look at DNS — the live records. Look at RDAP — when the domain was registered." },
      { n: 4, title: "Try other targets",
        desc: "Run the same command against different sites to see how their data differs.",
        code: [
          "chronotrace google.com           # large tech company",
          "chronotrace github.com           # complex infrastructure",
          "chronotrace whitehouse.gov       # government site",
          "chronotrace your-school.edu      # if you are a student",
        ]
      },
      { n: 5, title: "Save a scan for comparison",
        desc: "Run with the --json flag so you can study the raw data later.",
        code: "chronotrace github.com --json -o github-scan.json" },
      { n: 6, title: "Open the JSON file in a text editor",
        desc: "Look at how each event is structured. Each event has a timestamp, source, event_type, subject, and details object. This is the data format you will work with in later recipes." },
    ],
    lookFor: [
      ["Section in the output", "What it tells you"],
      ["RDAP", "When the domain was registered. Old domains (>10 years) are usually legitimate."],
      ["Wayback", "What the site looked like at different points in history."],
      ["crt.sh", "Every subdomain that ever had a TLS certificate issued for it."],
      ["DNS", "Where the site currently lives — IP addresses, mail servers, name servers."],
    ],
    pitfalls: [
      "Do not run --active or --full on random websites. Active modules send live requests and may appear in target server logs.",
      "Some sources may return zero events if their APIs are temporarily rate-limited. Try again in a few minutes.",
      "The crt.sh service is frequently slow or flaky — that is normal, not a ChronoTrace bug.",
    ],
  });
}

function chapter5Recipe2() {
  return recipeChapter({
    title: "Chapter 5 — Recipe 2: Securing Your Own Site",
    who: "Website owners, IT administrators, small business operators. You want to audit your own domain for security issues, forgotten subdomains, and missing protections.",
    learn: "What public information attackers can already see about your site, what subdomains you may have forgotten you exposed, and which security headers and admin pages need attention.",
    steps: [
      { n: 1, title: "Confirm you own the domain",
        desc: "This recipe uses active modules. Only proceed on a domain you control, where you have administrative access. Throughout the steps below, replace mysite.com with your actual domain." },
      { n: 2, title: "Run the full audit",
        desc: "Use --active to include the safe active modules. Save to JSON for analysis.",
        code: "chronotrace mysite.com --active -y -o my-audit.json --json",
        note: "Remove -y to be prompted to retype your domain as confirmation. Use -y only when you are certain." },
      { n: 3, title: "Extract every subdomain you have ever published",
        desc: "Many sites have dozens of subdomains they forgot about. Some were issued certificates years ago by a contractor and never decommissioned.",
        code: "jq -r '.events[] | select(.event_type==\"subdomain\") | .subject' my-audit.json | sort -u" },
      { n: 4, title: "Spot the suspicious ones",
        desc: "Look for subdomains named dev, staging, test, internal, admin, vpn, old, backup, beta. These are the most common targets for attackers.",
        code: "jq -r '.events[] | select(.event_type==\"subdomain\") | .subject' my-audit.json | sort -u | grep -Ei 'dev|staging|test|internal|admin|vpn|old|backup|beta'" },
      { n: 5, title: "Check for missing security headers",
        desc: "Modern websites should set a handful of HTTP headers that mitigate common attacks. ChronoTrace lists which ones are missing.",
        code: "jq '.events[] | select(.source==\"http_probe\") | .details.missing_security_headers' my-audit.json" },
      { n: 6, title: "Check for exposed admin or config paths",
        desc: "ChronoTrace probes about 150 common paths. A response with HTTP 200 on /admin/, /.env, or /.git/config is a critical finding.",
        code: "jq -r '.events[] | select(.source==\"dir_probe\" and .details.status_code != 301) | \"\\(.details.status_code) \\(.subject)\"' my-audit.json" },
      { n: 7, title: "Check your TLS posture",
        desc: "ChronoTrace performs a live TLS handshake. Look for outdated TLS versions or weak cipher suites.",
        code: "jq '.events[] | select(.source==\"tls_live\") | .details' my-audit.json" },
    ],
    lookFor: [
      ["Finding", "Action"],
      ["Subdomain you do not recognize", "Decommission it, or place it behind authentication."],
      ["Missing Strict-Transport-Security", "Add HSTS in your web server or CDN config."],
      ["Missing Content-Security-Policy", "Define a CSP — even a basic one stops most XSS."],
      ["Exposed /.env or /.git/config", "Block immediately at the web server. Rotate any leaked secrets."],
      ["Exposed /admin/ returning 200", "Add authentication. Restrict by IP if possible."],
      ["TLS 1.0 or 1.1 served", "Disable old TLS in your server / CDN."],
    ],
    action: [
      "Save the JSON file as a baseline. Re-run monthly and compare.",
      "Email each subdomain owner internally to confirm intent.",
      "For each missing security header, configure your web server or CDN to add it.",
      "If you find secrets in a /.env or /.git/ leak, rotate them today, not tomorrow.",
      "Add ChronoTrace to your monthly security review checklist.",
    ],
    pitfalls: [
      "If your site is behind Cloudflare, ChronoTrace mostly sees Cloudflare's edge — not your origin server. The 27 directory hits with identical 301 redirect sizes are usually Cloudflare's catch-all, not real exposed paths.",
      "AXFR will almost always be denied on modern DNS providers — that is correct, expected behavior.",
      "Port scans against a Cloudflare-fronted site show Cloudflare's edge ports, not your origin's.",
    ],
  });
}

function chapter6Recipe3() {
  return recipeChapter({
    title: "Chapter 6 — Recipe 3: Authorized Pentest Recon",
    who: "Penetration testers, red teamers, and bug-bounty hunters with explicit written authorization to test the target. This recipe assumes you have a signed scope document or are operating within a public bug-bounty program's defined scope.",
    learn: "How to perform fast, comprehensive external reconnaissance in the opening minutes of an engagement, and how to feed the output into the rest of your offensive toolkit.",
    steps: [
      { n: 1, title: "Verify authorization before doing anything",
        desc: "Read your scope document. Confirm the target domain and every subdomain you intend to probe is in scope. If you are uncertain, do not proceed — ask your client or program owner." },
      { n: 2, title: "Run the full active scan",
        desc: "Use --full to include the 1-65535 port scan. This takes 10-15 minutes but gives you complete surface coverage.",
        code: "chronotrace target.com --full -y -o recon.json --json",
        note: "If time is short, use --active instead. It runs all safe active modules in under a minute." },
      { n: 3, title: "Build your subdomain target list",
        desc: "Extract every unique subdomain from the scan output for use in subsequent tools.",
        code: [
          "jq -r '.events[] | select(.event_type==\"subdomain\") | .subject' recon.json | \\",
          "  sort -u > targets.txt",
          "wc -l targets.txt",
        ] },
      { n: 4, title: "Identify high-value targets",
        desc: "Internal-looking subdomains are usually less hardened than the main site.",
        code: [
          "grep -Ei 'admin|internal|dev|staging|test|wiki|jira|jenkins|api|backup|vpn|portal|old' targets.txt",
        ] },
      { n: 5, title: "Resolve and probe alive hosts",
        desc: "Check which subdomains are actually responding right now.",
        code: [
          "while read sub; do",
          "  code=$(curl -sk -o /dev/null -w \"%{http_code}\" \"https://$sub\" --max-time 5)",
          "  ip=$(dig +short \"$sub\" | head -1)",
          "  [[ \"$code\" != \"000\" ]] && echo \"$code  $sub  $ip\"",
          "done < targets.txt | sort -u > alive.txt",
        ] },
      { n: 6, title: "Pivot — recursively scan the most interesting subdomain",
        desc: "Re-run ChronoTrace on a juicy-looking internal subdomain to get its own surface.",
        code: "chronotrace internal-admin.target.com --active -y --json -o pivot.json" },
      { n: 7, title: "Feed into the rest of your toolkit",
        desc: "ChronoTrace is the first 90 seconds of an engagement. Now hand off to specialized tools.",
        code: [
          "# Vulnerability templates",
          "nuclei -l targets.txt -o nuclei-findings.txt",
          "",
          "# Deep port scanning where needed",
          "cut -d' ' -f3 alive.txt | sort -u | xargs -I {} nmap -sV -p- {}",
          "",
          "# Directory brute-force with a real wordlist",
          "ffuf -u https://target.com/FUZZ -w /usr/share/wordlists/dirb/big.txt -mc 200,401,403",
          "",
          "# Visual triage of all subdomains",
          "cat targets.txt | aquatone -out screenshots/",
        ] },
    ],
    lookFor: [
      ["Finding", "Why it matters"],
      ["Subdomain with 'admin' or 'internal' in name", "Usually less hardened than the main site."],
      ["Subdomain whose A record is NOT a Cloudflare IP", "Possible origin server — could bypass the WAF."],
      ["Subdomain CNAMEd to a third-party service", "Check for dangling resources (subdomain takeover)."],
      ["Cert recently issued for a never-seen subdomain", "Possible new deployment — fresh code, fresh bugs."],
      ["Cert SAN listing unrelated domains", "Operator may have leaked separate brands on shared cert."],
      ["TLS 1.0 / weak ciphers", "Transport-layer findings for the report."],
    ],
    action: [
      "Save the JSON output as evidence — date it, store it with engagement notes.",
      "Recursively scan high-value subdomains discovered.",
      "Hand the alive.txt to nuclei and aquatone in parallel.",
      "Document every subdomain takeover candidate found.",
      "Note any historical IP leakage in Wayback that may bypass current Cloudflare protection.",
    ],
    pitfalls: [
      "Make sure every subdomain you find is actually in your scope. CT logs reveal subdomains that may belong to third parties.",
      "Many dir_probe results on Cloudflare-fronted sites are 301 catch-alls, not real findings. Filter them out as shown in step 5.",
      "Do not run ChronoTrace against subdomains discovered through this scan unless they are also covered by your authorization.",
    ],
  });
}

function chapter7Recipe4() {
  return recipeChapter({
    title: "Chapter 7 — Recipe 4: Brand Abuse Investigation",
    who: "Marketing teams, brand-protection investigators, anti-phishing analysts. You suspect a domain is impersonating your brand or running a phishing campaign targeting your customers.",
    learn: "How to gather evidence that a suspicious domain is freshly-stood-up phishing infrastructure, and how to use that evidence in takedown requests.",
    steps: [
      { n: 1, title: "Scan the suspicious lookalike passively",
        desc: "Important — do not use active modules. The attackers monitor their server logs and you do not want to alert them.",
        code: "chronotrace suspicious-lookalike.com --only wayback,crt_sh,rdap,dns -o evidence.json --json" },
      { n: 2, title: "Check when the domain was registered",
        desc: "Recently registered domains (last 30 days) are a very strong indicator of phishing.",
        code: "jq '.events[] | select(.source==\"rdap\") | .details' evidence.json" },
      { n: 3, title: "Find the first TLS certificate",
        desc: "Certificate issuance dates show when the infrastructure was set up.",
        code: "jq -r '.events[] | select(.source==\"crt_sh\") | .timestamp' evidence.json | sort | head -1" },
      { n: 4, title: "Look for absent history",
        desc: "Legitimate sites have years of Wayback snapshots. Phishing sites typically have none, or a tiny number from the last few weeks.",
        code: "jq '.events[] | select(.source==\"wayback\") | .timestamp' evidence.json | sort | head -5" },
      { n: 5, title: "Compare against your legitimate brand",
        desc: "Run the same scan against your real domain to establish a baseline of what 'legitimate' looks like.",
        code: "chronotrace yourbrand.com --only rdap,crt_sh,wayback --json -o legitimate.json" },
      { n: 6, title: "Check the certificate's SAN for other malicious domains",
        desc: "Phishing operators sometimes provision certificates covering several lookalike domains at once.",
        code: "jq '.events[] | select(.source==\"crt_sh\") | .details | {issuer, not_before}' evidence.json | head -20" },
    ],
    lookFor: [
      ["Red flag", "What it means"],
      ["Domain registered in last 30 days", "Strong phishing indicator."],
      ["First cert issued in last 7 days", "Just stood up — likely active campaign."],
      ["Zero Wayback snapshots", "Brand new, never indexed."],
      ["Cert SAN includes domains like login.* or secure.*", "Built to fool users."],
      ["Cert from a different CA than your real site", "Operator does not have access to your usual cert process."],
      ["Cert SAN includes unrelated brand names", "Multi-target phishing campaign."],
    ],
    action: [
      "Save the JSON output as evidence for the takedown request.",
      "Report to the domain registrar's abuse contact (typically abuse@registrar.com).",
      "Report to Google Safe Browsing: safebrowsing.google.com/safebrowsing/report_phish",
      "Report to PhishTank and APWG.",
      "File takedown with the hosting provider (find via WHOIS or IP geolocation).",
      "For Sri Lankan targets, also report to SLCERT.",
      "Notify your fraud team to add the domain to internal blocklists.",
    ],
    pitfalls: [
      "Never use --active on a domain you are investigating for phishing. The attackers will see your requests and may take down the site, destroying evidence.",
      "Some legitimate businesses have brand-new domains for marketing campaigns. Cross-check before reporting.",
      "RDAP coverage varies by TLD. Sri Lankan .lk domains do not expose RDAP data.",
    ],
  });
}

function chapter8Recipe5() {
  return recipeChapter({
    title: "Chapter 8 — Recipe 5: Incident Response Timeline",
    who: "Incident responders, security operations teams investigating an active or recent breach. You need to reconstruct when attacker infrastructure was created, what was exposed, and when.",
    learn: "How to use ChronoTrace's chronological output to build a defensible timeline of attacker activity, with timestamps you can cite in incident reports.",
    steps: [
      { n: 1, title: "Capture the full history of the affected domain",
        desc: "Get every public record about the domain into one file for analysis.",
        code: "chronotrace affected-domain.com --json -o incident-timeline.json" },
      { n: 2, title: "Plot the certificate timeline",
        desc: "Every TLS cert ever issued, sorted chronologically. Look for certs issued shortly before the incident.",
        code: [
          "jq -r '.events[] | select(.source==\"crt_sh\") |",
          "  \"\\(.timestamp[:10])  \\(.subject)\"' incident-timeline.json | sort -u",
        ] },
      { n: 3, title: "Filter to the incident window",
        desc: "Narrow Wayback snapshots to the days surrounding the incident. Replace dates with your actual incident window.",
        code: [
          "jq -r '.events[] | select(.source==\"wayback\" and",
          "  .timestamp >= \"2026-05-10\" and",
          "  .timestamp <= \"2026-05-20\") |",
          "  \"\\(.timestamp[:10])  \\(.subject)\"' incident-timeline.json",
        ] },
      { n: 4, title: "Check current DNS for ongoing attacker control",
        desc: "Is the domain still pointing somewhere suspicious?",
        code: "jq '.events[] | select(.source==\"dns\") | .details' incident-timeline.json" },
      { n: 5, title: "Look for new subdomains around the incident date",
        desc: "Attackers frequently provision subdomains for beacons or exfiltration.",
        code: [
          "jq -r '.events[] | select(.event_type==\"subdomain\") |",
          "  \"\\(.timestamp[:10])  \\(.subject)\"' incident-timeline.json |",
          "  sort | grep '2026-05'",
        ] },
      { n: 6, title: "Compile the timeline",
        desc: "Synthesize findings into a chronological narrative for your incident report. Each line should have a timestamp, the public evidence (CT log, Wayback snapshot, DNS change), and your interpretation." },
    ],
    lookFor: [
      ["Evidence type", "Timeline value"],
      ["CT log first-seen of a subdomain", "When the attacker provisioned that infrastructure."],
      ["Wayback snapshot showing leaked content", "When data first appeared publicly."],
      ["New cert issued days before incident report", "Indicates premeditation."],
      ["Subdomain appearing then disappearing", "Likely transient beacon or exfil host."],
      ["DNS change to attacker-controlled IP", "Possible DNS hijacking."],
    ],
    action: [
      "Save the JSON output with the incident reference number in the filename.",
      "Build a narrative timeline document combining ChronoTrace data with internal logs.",
      "For each suspicious subdomain found, query your SIEM for matching traffic.",
      "Cross-reference IPs against threat intel feeds (AbuseIPDB, OTX, VirusTotal).",
      "Preserve evidence — Wayback URLs, cert details, RDAP records — for legal proceedings.",
    ],
    pitfalls: [
      "Wayback can be delayed by days or weeks. Absence of a snapshot does not mean a page did not exist.",
      "CT logs are typically populated within minutes of certificate issuance, but check multiple log sources for completeness.",
      "Always preserve the underlying Wayback URLs — they can be removed in rare cases.",
    ],
  });
}

function chapter9Recipe6() {
  return recipeChapter({
    title: "Chapter 9 — Recipe 6: Research & Journalism",
    who: "Journalists, fact-checkers, academic researchers, OSINT investigators. You want to verify what a website said at a specific point in time, find deleted content, or document changes to public-facing claims.",
    learn: "How to systematically search a site's archived history, find specific deleted pages, and produce citable evidence of past content.",
    steps: [
      { n: 1, title: "Pull the site's full Wayback history",
        desc: "For research purposes, you typically only need passive sources.",
        code: "chronotrace example-news-site.com --only wayback -o site-history.json --json" },
      { n: 2, title: "Find every snapshot of a specific page",
        desc: "Replace /about with the path you want to investigate.",
        code: [
          "jq -r '.events[] | select(.subject | contains(\"/about\")) |",
          "  \"\\(.timestamp[:10])  \\(.details.wayback_url)\"' site-history.json",
        ] },
      { n: 3, title: "Find snapshots in a date range",
        desc: "Useful when investigating what a site said before and after a specific event.",
        code: [
          "jq -r '.events[] | select(.source==\"wayback\" and",
          "  .timestamp >= \"2024-01-01\" and",
          "  .timestamp <= \"2024-12-31\") |",
          "  \"\\(.timestamp[:10])  \\(.subject)\"' site-history.json",
        ] },
      { n: 4, title: "Open the snapshots in your browser",
        desc: "Copy any wayback_url from the output and paste it into your browser. Wayback Machine will render the page exactly as it appeared on that date." },
      { n: 5, title: "Document with permanent links",
        desc: "Wayback URLs are stable. Cite them in your article with the exact archive date." },
      { n: 6, title: "Compare two versions side-by-side",
        desc: "Use a diff tool against the rendered HTML to find specific text changes.",
        code: [
          "curl -s 'https://web.archive.org/web/2024 01 01/example.com/about' > before.html",
          "curl -s 'https://web.archive.org/web/2024 12 31/example.com/about' > after.html",
          "diff before.html after.html | less",
        ] },
    ],
    lookFor: [
      ["Use case", "What to grep for in the timeline"],
      ["Deleted articles", "Snapshots with HTTP 200 followed by HTTP 404 later"],
      ["Renamed sections", "URLs that disappear, replaced by similar paths"],
      ["Quietly-edited statements", "Same URL captured before and after a date"],
      ["Removed team / staff pages", "Old /team or /people URLs no longer linked"],
      ["Changed policies", "/privacy, /terms, /policy snapshots across years"],
    ],
    action: [
      "Always cite the specific Wayback snapshot URL, not the live site.",
      "Note both the original capture date and the original publication date if visible.",
      "Save HTML files as backup — Wayback rarely removes content but it can happen.",
      "For high-stakes pieces, take screenshots of the rendered snapshot for visual evidence.",
    ],
    pitfalls: [
      "Wayback respects robots.txt retroactively for some sites — pages may be hidden if the site changes its robots.txt.",
      "Some sites use noarchive meta tags or X-Robots-Tag headers, preventing Wayback capture.",
      "Coverage varies by site popularity. Niche sites may have years between snapshots.",
    ],
  });
}

function chapter10Recipe7() {
  return recipeChapter({
    title: "Chapter 10 — Recipe 7: Continuous Monitoring",
    who: "Threat intelligence teams, security researchers tracking ongoing campaigns, anyone monitoring a specific domain over weeks or months.",
    learn: "How to set up scheduled scans, compare snapshots over time, and detect when a target's infrastructure changes.",
    steps: [
      { n: 1, title: "Take a baseline snapshot today",
        desc: "Save with today's date in the filename for clean comparisons later.",
        code: "chronotrace target.com --active -y --json -o ~/monitoring/target-$(date +%Y-%m-%d).json" },
      { n: 2, title: "Wait one week, take another snapshot",
        desc: "Repeat with a different date suffix.",
        code: "chronotrace target.com --active -y --json -o ~/monitoring/target-$(date +%Y-%m-%d).json" },
      { n: 3, title: "Find subdomains that newly appeared",
        desc: "Diff the two snapshots to surface only changes.",
        code: [
          "BASE=~/monitoring/target-2026-05-26.json",
          "NEW=~/monitoring/target-2026-06-02.json",
          "",
          "diff \\",
          "  <(jq -r '.events[] | select(.event_type==\"subdomain\") | .subject' $BASE | sort -u) \\",
          "  <(jq -r '.events[] | select(.event_type==\"subdomain\") | .subject' $NEW | sort -u) | \\",
          "  grep '^>'",
        ] },
      { n: 4, title: "Schedule it with cron",
        desc: "Run weekly at 9am Monday. Edit your crontab with: crontab -e",
        code: [
          "0 9 * * 1 /home/youruser/.local/bin/chronotrace target.com \\",
          "  --active -y --json -o /home/youruser/monitoring/target-$(date +\\%Y-\\%m-\\%d).json \\",
          "  --quiet --no-color",
        ] },
      { n: 5, title: "Alert on changes",
        desc: "Wrap the scan in a script that emails you if new subdomains appear.",
        code: [
          "#!/bin/bash",
          "TODAY=$(date +%Y-%m-%d)",
          "LAST_FILE=$(ls -t ~/monitoring/target-*.json | sed -n 2p)",
          "TODAY_FILE=~/monitoring/target-$TODAY.json",
          "",
          "chronotrace target.com --active -y --json -o $TODAY_FILE --quiet --no-color",
          "",
          "NEW=$(diff \\",
          "  <(jq -r '.events[] | select(.event_type==\"subdomain\") | .subject' $LAST_FILE | sort -u) \\",
          "  <(jq -r '.events[] | select(.event_type==\"subdomain\") | .subject' $TODAY_FILE | sort -u) | \\",
          "  grep '^>' | wc -l)",
          "",
          "if [ \"$NEW\" -gt 0 ]; then",
          "  echo \"ChronoTrace: $NEW new subdomains on target.com\" | mail -s \"ChronoTrace alert\" you@example.com",
          "fi",
        ] },
    ],
    lookFor: [
      ["Change detected", "Interpretation"],
      ["New subdomain in CT logs", "Target deployed new infrastructure (or attacker did)."],
      ["Subdomain disappeared", "Infrastructure was decommissioned (cleaned up after attack?)."],
      ["New IP in DNS records", "Migration or new hosting provider."],
      ["New tech detected in HTTP probe", "Site was rebuilt or migrated."],
      ["TLS cert renewed unexpectedly early", "Possible incident response or rotation."],
    ],
    action: [
      "Keep at least 90 days of historical scan JSON files.",
      "Maintain a running journal of detected changes with your interpretations.",
      "For each new subdomain, decide if it warrants its own deep scan.",
      "Build correlation rules with your SIEM if you also monitor logs.",
    ],
    pitfalls: [
      "Cron jobs run with a minimal PATH. Use the full path to chronotrace (typically /home/USER/.local/bin/chronotrace) in cron entries.",
      "The Wayback CDX API can be slow during peak hours — schedule scans during off-peak times if you run many of them.",
      "API rate limits exist on enrichment sources (Shodan, VirusTotal) — space your scans appropriately if using API keys.",
    ],
  });
}

function chapter11OutputFormats() {
  return [
    heading("Chapter 11: Output Formats"),
    p("ChronoTrace supports three output formats, each suited to a different workflow."),
    spacer(),
    heading("Pretty terminal output (default)", 2),
    p("Bold-colored tables with the ChronoTrace banner at the top. Best for interactive use."),
    code("chronotrace example.com"),
    p("Disable colors when piping or saving to a log file:"),
    code("chronotrace example.com --no-color > scan.txt"),
    spacer(),
    heading("JSON output", 2),
    p("Use JSON for any analysis beyond reading the tables yourself. JSON works with jq, can be loaded into Python or scripts, and integrates with other tools."),
    code("chronotrace example.com --json -o results.json"),
    p("The JSON structure looks like this:"),
    code([
      "{",
      "  \"domain\": \"example.com\",",
      "  \"scanned_at\": \"2026-05-27T00:30:00Z\",",
      "  \"tool\": \"chronotrace 1.0.0\",",
      "  \"errors\": {},",
      "  \"events\": [",
      "    {",
      "      \"id\": \"abc123...\",",
      "      \"timestamp\": \"2026-05-26T10:15:30Z\",",
      "      \"source\": \"crt_sh\",",
      "      \"event_type\": \"certificate\",",
      "      \"subject\": \"staffhelp.ikman.lk\",",
      "      \"details\": {",
      "        \"issuer\": \"C=US, O=Google Trust Services, CN=WE1\",",
      "        \"not_before\": \"2026-05-26\",",
      "        \"not_after\": \"2026-08-24\"",
      "      },",
      "      \"confidence\": \"exact\"",
      "    }",
      "  ]",
      "}",
    ]),
    spacer(),
    heading("CSV output", 2),
    p("CSV is convenient for Excel, Google Sheets, or quick spreadsheet review."),
    code("chronotrace example.com --csv -o results.csv"),
    p("Each row is one event with timestamp, source, event_type, subject, and a JSON details column."),
    spacer(),
    heading("Useful jq queries", 2),
    table([
      ["Question", "jq command"],
      ["All unique subdomains", "jq -r '.events[] | select(.event_type==\"subdomain\") | .subject' f.json | sort -u"],
      ["Events from one source only", "jq '.events[] | select(.source==\"wayback\")' f.json"],
      ["Events in a date range", "jq '.events[] | select(.timestamp>=\"2024-01\")' f.json"],
      ["Just the open ports", "jq '.events[] | select(.event_type==\"open_port\") | .subject' f.json"],
      ["Count events by source", "jq '[.events[] | .source] | group_by(.) | map({src:.[0], n:length})' f.json"],
      ["Sort by date, show timestamp + subject", "jq -r '.events | sort_by(.timestamp) | .[] | \"\\(.timestamp[:10]) \\(.subject)\"' f.json"],
    ], [3000, 6360]),
  ];
}

function chapter12Integration() {
  return [
    heading("Chapter 12: Integration with Other Tools"),
    p("ChronoTrace is the opening move of a reconnaissance workflow. It maps the surface; specialized tools probe each piece. Here are the common pipelines."),
    spacer(),
    heading("With nuclei (vulnerability scanning)", 2),
    p("nuclei runs templated checks for thousands of known vulnerabilities. Feed it your subdomain list."),
    code([
      "# 1. Get subdomains from ChronoTrace",
      "chronotrace target.com --json -o recon.json",
      "jq -r '.events[] | select(.event_type==\"subdomain\") | .subject' recon.json | sort -u > subs.txt",
      "",
      "# 2. Run nuclei against all of them",
      "nuclei -l subs.txt -t cves/ -o nuclei.txt",
    ]),
    spacer(),
    heading("With nmap (deep port scanning)", 2),
    p("ChronoTrace scans 20 or 65535 ports with TCP connect — slower than nmap. For deep service-version probing of specific hosts, use nmap."),
    code([
      "# Extract unique IPs and run nmap on them",
      "jq -r '.events[] | select(.source==\"dns\" and .subject | contains(\" A\")) | .details.values[]' recon.json | sort -u > ips.txt",
      "nmap -sV -sC -p- -iL ips.txt -oA nmap-out",
    ]),
    spacer(),
    heading("With ffuf or gobuster (directory brute-force)", 2),
    p("ChronoTrace probes 150 paths. For real brute-forcing with 100,000+ word wordlists, use ffuf."),
    code([
      "ffuf -u https://target.com/FUZZ \\",
      "  -w /usr/share/wordlists/dirb/big.txt \\",
      "  -mc 200,401,403 -mr '^(?!.*404)' \\",
      "  -o ffuf-results.json",
    ]),
    spacer(),
    heading("With aquatone (visual triage)", 2),
    p("aquatone takes screenshots of every URL in a list. Useful for visually identifying interesting subdomains in a large set."),
    code([
      "cat subs.txt | httprobe | aquatone -out screenshots/",
      "# open screenshots/aquatone_report.html in your browser",
    ]),
    spacer(),
    heading("With Burp Suite", 2),
    p("For web application testing, import ChronoTrace's discovered URLs as Burp's site map starting points."),
    ...numbered([
      "Run ChronoTrace, save as JSON",
      "Extract URLs: jq -r '.events[].subject' recon.json | grep '^http' | sort -u",
      "In Burp, set Target → Scope using these URLs",
      "Proxy your browser through Burp and visit each URL to populate the site map",
    ]),
    spacer(),
    heading("Complete pipeline example", 2),
    code([
      "#!/bin/bash",
      "TARGET=$1",
      "WORKDIR=$(date +recon-%Y-%m-%d-$TARGET)",
      "mkdir -p $WORKDIR",
      "",
      "# Phase 1: ChronoTrace surface discovery",
      "chronotrace $TARGET --active -y --json -o $WORKDIR/recon.json",
      "",
      "# Phase 2: Extract targets",
      "jq -r '.events[] | select(.event_type==\"subdomain\") | .subject' \\",
      "  $WORKDIR/recon.json | sort -u > $WORKDIR/subs.txt",
      "",
      "# Phase 3: Alive check",
      "cat $WORKDIR/subs.txt | httprobe > $WORKDIR/alive.txt",
      "",
      "# Phase 4: Screenshot",
      "cat $WORKDIR/alive.txt | aquatone -out $WORKDIR/screenshots",
      "",
      "# Phase 5: Vuln scan",
      "nuclei -l $WORKDIR/alive.txt -t cves/ -o $WORKDIR/nuclei.txt",
      "",
      "echo \"Recon complete: $WORKDIR/\"",
    ]),
  ];
}

function chapter13ModuleReference() {
  return [
    heading("Chapter 13: Module Reference"),
    p("Each module is documented with its data source, what it returns, and the typical scan time."),
    spacer(),
    heading("Passive sources (always safe)", 2),
    table([
      ["Module", "What it queries", "Returns", "Typical time"],
      ["wayback", "Wayback Machine CDX API", "Every URL ever archived, with timestamps", "5-90 seconds"],
      ["crt_sh", "crt.sh Certificate Transparency database", "Every TLS cert issued, plus derived subdomains", "5-60 seconds"],
      ["rdap", "RDAP servers (via rdap.org)", "Domain registration date, registrar, last change", "1-5 seconds"],
      ["dns", "Live DNS via dnspython", "A, AAAA, MX, NS, TXT, CNAME records", "<1 second"],
    ], [1800, 2800, 3260, 1500]),
    spacer(),
    heading("Active modules (require authorization)", 2),
    table([
      ["Module", "What it does", "Returns", "Typical time"],
      ["http_probe", "Live HTTP GET to http:// and https://", "Status, headers, tech detection, missing security headers", "1-3 seconds"],
      ["tls_live", "Real TLS handshake to port 443", "Served cert, cipher suite, TLS version, SAN list", "1-2 seconds"],
      ["well_known", "Fetch standard well-known paths", "robots.txt, sitemap.xml, security.txt, .well-known/*", "2-10 seconds"],
      ["port_scan", "TCP connect to 20 common ports", "Open ports + service-aware banners", "3-10 seconds"],
      ["port_scan_full", "TCP connect to ports 1-65535", "Complete open port list + banners + TLS info", "10-15 minutes"],
      ["dns_axfr", "Attempt AXFR against each NS server", "Either full zone records (rare) or denial reasons", "1-5 seconds"],
      ["dir_probe", "GET ~150 high-value paths", "HTTP status, content size, secret-leak detection", "5-15 seconds"],
    ], [1800, 2800, 3260, 1500]),
    spacer(),
    heading("Enrichment APIs (require user-supplied keys)", 2),
    table([
      ["Module", "Provider", "Cost", "Returns"],
      ["shodan", "shodan.io", "Free + paid tiers", "Historical host/port exposure, banners"],
      ["virustotal", "virustotal.com", "Free 500/day", "Reputation, passive DNS, file associations"],
      ["hibp", "haveibeenpwned.com", "Paid", "Email breach associations for the domain"],
    ], [1800, 2400, 2000, 3160]),
    p("Enrichment is enabled by passing --shodan-key, --vt-key, or --hibp-key on the command line."),
  ];
}

function chapter14CommandReference() {
  return [
    heading("Chapter 14: Command Reference"),
    p("Every command-line flag, explained. This is your quick-reference card."),
    spacer(),
    heading("Positional arguments", 2),
    code("chronotrace [domain]"),
    p("The target domain. Required for all scans. Examples: example.com, ikman.lk, subdomain.target.com."),
    spacer(),
    heading("Information flags", 2),
    table([
      ["Flag", "Effect"],
      ["-h, --help", "Show all available options"],
      ["-V, --version", "Print version and exit"],
      ["--list-modules", "Show all available passive and active modules"],
    ], [2400, 6960]),
    spacer(),
    heading("Source selection", 2),
    table([
      ["Flag", "Effect"],
      ["--passive", "Run passive sources (this is the default)"],
      ["--active", "Add safe active modules (no port_scan_full)"],
      ["--full", "Add ALL active modules including the 1-65535 port scan"],
      ["--only LIST", "Run ONLY the listed sources (e.g. --only wayback,crt_sh)"],
    ], [2400, 6960]),
    spacer(),
    heading("Individual active module flags", 2),
    table([
      ["Flag", "Module enabled"],
      ["--port-scan", "Top-20 port scan"],
      ["--port-scan-full", "Full 1-65535 port scan (mutex with --port-scan)"],
      ["--http-fingerprint", "Live HTTP probing"],
      ["--tls-inspect", "Live TLS handshake"],
      ["--well-known", "Fetch well-known paths"],
      ["--axfr", "DNS zone transfer attempt"],
      ["--dir-probe", "Directory and file probe"],
    ], [2400, 6960]),
    spacer(),
    heading("Authorization", 2),
    table([
      ["Flag", "Effect"],
      ["-y, --yes", "Skip the interactive confirmation prompt"],
    ], [2400, 6960]),
    p("Without -y, ChronoTrace will pause and ask you to retype the target domain. This prevents accidentally scanning the wrong host."),
    spacer(),
    heading("Enrichment", 2),
    table([
      ["Flag", "Effect"],
      ["--shodan-key KEY", "Enable Shodan enrichment with your API key"],
      ["--vt-key KEY", "Enable VirusTotal enrichment"],
      ["--hibp-key KEY", "Enable Have I Been Pwned enrichment"],
    ], [2400, 6960]),
    spacer(),
    heading("Output", 2),
    table([
      ["Flag", "Effect"],
      ["-o, --output FILE", "Write results to FILE"],
      ["--json", "Output as JSON"],
      ["--csv", "Output as CSV"],
      ["--quiet, -q", "Suppress banner and progress, just show data"],
      ["--verbose, -v", "Show detailed retry and error messages"],
      ["--no-color", "Plain text (good for pipes and log files)"],
      ["--max-events-shown N", "Max events shown per source in pretty output (default 30)"],
    ], [3000, 6360]),
    spacer(),
    heading("Exit codes", 2),
    table([
      ["Code", "Meaning"],
      ["0", "Success — at least one event returned"],
      ["1", "Completed but zero events returned (all sources empty or all failed)"],
      ["2", "Bad arguments — usually missing required positional"],
      ["3", "Authorization declined or domain mismatch"],
    ], [2400, 6960]),
  ];
}

function chapter15Legal() {
  return [
    heading("Chapter 15: Legal & Ethical Guidelines"),
    callout("Read this chapter before using active modules",
      "ChronoTrace can be used legally or illegally depending entirely on what target you point it at. The tool's safeguards (authorization prompts, scope confirmations) only work if you actually respect them. Nothing in this software prevents misuse — that responsibility is yours.",
      "warn"),
    spacer(),
    heading("What is legal", 2),
    ...bullets([
      "Scanning domains you personally own — your blog, your business website, your home server.",
      "Scanning domains your employer owns, with documented authorization from your security team.",
      "Scanning targets within an authorized penetration testing engagement, with a signed contract defining scope.",
      "Scanning targets within a public bug bounty program, strictly within the defined scope and out-of-scope rules.",
      "Passive scans (no --active flag) of public domains for research or journalism, generally — but legal nuances vary by jurisdiction.",
      "Scanning targets explicitly designed for scanning (scanme.nmap.org, testphp.vulnweb.com, OWASP Juice Shop).",
    ]),
    spacer(),
    heading("What is illegal", 2),
    ...bullets([
      "Active scanning of any domain you do not own and do not have authorization to test.",
      "Using ChronoTrace findings to gain unauthorized access to systems.",
      "Stalking, harassing, or surveilling individuals through their personal domains.",
      "Bypassing rate limits or other technical controls on third-party services.",
      "Aggregating data on private individuals in ways that violate GDPR, CCPA, or similar privacy law.",
    ]),
    spacer(),
    heading("Laws that apply", 2),
    table([
      ["Law / Region", "Relevant to"],
      ["Computer Fraud and Abuse Act (CFAA, USA)", "Unauthorized access — even passive recon can trigger this in extreme interpretations"],
      ["Computer Misuse Act 1990 (UK)", "Unauthorized access to computer material"],
      ["GDPR Article 32 (EU)", "Processing data about identifiable individuals from scan results"],
      ["Sri Lanka Computer Crime Act No. 24 of 2007", "Unauthorized access, attempts at access, illegal interception"],
      ["Indian IT Act Section 43 / 66", "Unauthorized access to computers"],
      ["Various state-level laws", "Vary widely — check your local jurisdiction"],
    ], [3500, 5860]),
    spacer(),
    heading("Authorization documents — what 'good' looks like", 2),
    p("Before running active modules against any target you do not personally own, you should have:"),
    ...bullets([
      "A written authorization letter signed by someone with authority over the target system",
      "A defined scope — exact domains, subdomains, IP ranges in and out of scope",
      "Clear time windows — when scanning is and is not permitted",
      "Emergency contact information — who to call if something goes wrong",
      "Indemnification language clarifying your liability boundaries",
      "Bug-bounty program agreement (acceptance of TOS counts as authorization)",
    ]),
    spacer(),
    heading("Responsible disclosure", 2),
    p("If you find a security issue on a target you are authorized to scan, follow responsible disclosure:"),
    ...numbered([
      "Document the finding with screenshots and ChronoTrace JSON output as evidence",
      "Identify the security contact — check the target's /.well-known/security.txt or security@ email",
      "Send a clear, professional report with reproduction steps",
      "Give the organization reasonable time to fix (typically 30-90 days)",
      "Do not publicly disclose until they have patched or the timeline expires",
      "Coordinate any public disclosure with the affected organization",
    ]),
    spacer(),
    callout("Final word",
      "Reconnaissance is reconnaissance. The tools do not care about your intent — but laws and people do. Use this tool to make the internet safer, not less safe.",
      "info"),
  ];
}

function appendixA() {
  return [
    heading("Appendix A: Glossary"),
    p("Common terms you will encounter in OSINT and reconnaissance work."),
    spacer(),
    table([
      ["Term", "Definition"],
      ["OSINT", "Open Source Intelligence — information collected from publicly available sources."],
      ["Active recon", "Reconnaissance that sends traffic to the target (port scans, HTTP requests)."],
      ["Passive recon", "Reconnaissance that queries third-party databases instead of the target."],
      ["CT logs", "Certificate Transparency logs — public, append-only logs of every TLS cert issued."],
      ["RDAP", "Registration Data Access Protocol — modern successor to WHOIS, structured JSON."],
      ["AXFR", "DNS zone transfer — request all records from a nameserver. Almost always denied."],
      ["CDX", "Wayback Machine's index API — fast bulk queries of archived URLs."],
      ["SAN", "Subject Alternative Name — additional domains covered by a TLS certificate."],
      ["CNAME", "DNS record type that aliases one domain to another."],
      ["TTL", "Time To Live — how long DNS resolvers cache a record."],
      ["Subdomain takeover", "Claiming a third-party resource (like a dangling S3 bucket) that a target's CNAME still points to."],
      ["Fingerprinting", "Identifying software/version from response headers, error pages, or behavior."],
      ["WAF", "Web Application Firewall — sits in front of a web app to block attacks."],
      ["CFAA", "Computer Fraud and Abuse Act — US federal anti-hacking statute."],
      ["jq", "Command-line JSON processor — used throughout this guide to query ChronoTrace output."],
      ["CIDR", "Classless Inter-Domain Routing — IP range notation like 192.168.1.0/24."],
      ["TLD", "Top-Level Domain — .com, .org, .lk, etc."],
      ["ccTLD", "Country-Code TLD — .uk, .lk, .jp, etc."],
      ["IDS / IPS", "Intrusion Detection / Prevention System — monitors network traffic for attacks."],
      ["WAF bypass", "Techniques to reach the origin server behind a Web Application Firewall."],
    ], [2400, 6960]),
  ];
}

function appendixB() {
  return [
    heading("Appendix B: Reading a Real Scan Output"),
    p("This walkthrough analyzes a real scan that surfaced 6157 events from 9 sources. Use it to build your interpretation skills."),
    spacer(),
    bold("The command that was run:"),
    code("chronotrace ikman.lk --active -y"),
    spacer(),
    bold("Summary of results:"),
    table([
      ["Source", "Events"],
      ["wayback", "4991"],
      ["crt_sh", "1119"],
      ["rdap", "0 (Sri Lankan .lk TLD does not expose RDAP)"],
      ["dns", "5"],
      ["port_scan", "5"],
      ["http_probe", "2"],
      ["tls_live", "1"],
      ["well_known", "5"],
      ["dns_axfr", "2 (both denied)"],
      ["dir_probe", "27"],
    ], [3000, 6360]),
    spacer(),
    bold("Key finding 1: Subdomain inventory"),
    p("Among the 1119 crt.sh events were these notable subdomains:"),
    ...bullets([
      "staffhelp.ikman.lk — internal staff help system",
      "wiki.it.ikman.lk — internal IT wiki",
      "support.it.ikman.lk — internal IT support",
      "status.admin.ikman.lk — admin status page",
      "marketing.ikman.lk — marketing team site",
      "helpcentersi/en/ta.ikman.lk — trilingual help in Sinhala, English, Tamil",
    ]),
    p("The *.it.* and admin.* subdomains are the headline findings. These are usually internal IT systems that someone provisioned a TLS cert for — and once in CT logs, they are public forever."),
    spacer(),
    bold("Key finding 2: TLS posture"),
    p("TLS 1.3 with AES_256_GCM_SHA384. This is modern, strong crypto. No transport-layer findings."),
    spacer(),
    bold("Key finding 3: Well-known files served"),
    p("Five files responded with HTTP 200:"),
    ...bullets([
      "/robots.txt (1,698 bytes) — standard, useful for understanding bot policy",
      "/.well-known/security.txt (917 bytes) — they have a published security contact (good)",
      "/.well-known/openid-configuration (917 bytes) — suggests OAuth/OIDC infrastructure",
      "/.well-known/change-password (917 bytes) — supports password manager auto-detection",
      "/ads.txt (45,824 bytes) — large list of authorized ad sellers",
    ]),
    spacer(),
    bold("Key finding 4: dir_probe noise"),
    p("Of 27 dir_probe events, 22 were HTTP 301 redirects with response bodies between 38 and 53 bytes. This pattern is Cloudflare's catch-all behavior — it returns the same redirect for every unrecognized path. These are NOT real findings."),
    p("Only 4-5 dir_probe results are useful — and three of them duplicate the well_known section above."),
    spacer(),
    bold("Lesson: noise filtering"),
    p("Tools surface raw data. The analyst's job is to filter signal from noise. For Cloudflare-fronted targets, treat 301 catch-alls as noise unless they redirect to interesting destinations."),
    spacer(),
    bold("What you would do next with these findings"),
    ...numbered([
      "Recursively scan wiki.it.ikman.lk and status.admin.ikman.lk — these are likely less hardened than the main site",
      "Build the complete subdomain inventory and feed it to nuclei",
      "Take screenshots of every alive subdomain with aquatone",
      "Cross-reference any new subdomains (last 30 days) against ChronoTrace runs from prior weeks",
    ]),
  ];
}

function appendixC() {
  return [
    heading("Appendix C: FAQ & Troubleshooting"),
    bold("Q: Why did wayback / crt.sh return 0 events?"),
    p("Most likely the API is rate-limited or experiencing a transient outage. crt.sh in particular is known for returning intermittent 502 Bad Gateway responses. ChronoTrace retries with exponential backoff, but persistent failures will show 0 events."),
    p("Try the scan again in a few minutes. Run with --verbose to see retry messages."),
    spacer(),
    bold("Q: Why is the port scan finding so few ports on my Cloudflare-fronted site?"),
    p("Cloudflare's edge intentionally accepts traffic on only a small set of ports (typically 80, 443, 8080, 8443, and sometimes 25). The 65535-port scan will find the same ports as the top-20 scan because Cloudflare drops everything else."),
    p("To assess your actual origin server's port exposure, you need to scan the origin IP directly — which is typically only accessible from inside your network."),
    spacer(),
    bold("Q: My .lk / .gov.lk / .ac.lk domain has no RDAP data. Why?"),
    p("The Sri Lankan .lk ccTLD does not expose public RDAP. ChronoTrace will return 0 events for the rdap source. This is not a bug — it is a ccTLD policy."),
    p("Some other ccTLDs (.jp, .cn) have similar limitations. The .com, .org, .net TLDs all support RDAP."),
    spacer(),
    bold("Q: All my dir_probe results look like 301 redirects with 40-byte responses. Are those real?"),
    p("Probably not. That pattern is Cloudflare's catch-all redirect — it returns the same generic redirect for every unrecognized path. Filter them out with:"),
    code("jq '.events[] | select(.source==\"dir_probe\" and .details.status_code != 301)' results.json"),
    spacer(),
    bold("Q: The dir_probe wordlist is too small. Can I use a bigger one?"),
    p("ChronoTrace's dir_probe has 150 high-value paths designed for fast surface checks. For real brute-forcing with 100,000+ word wordlists, use ffuf or gobuster:"),
    code("ffuf -u https://target.com/FUZZ -w /usr/share/wordlists/dirb/big.txt -mc 200,401,403"),
    spacer(),
    bold("Q: AXFR always says 'denied'. Is the module broken?"),
    p("No — denied is the correct, expected behavior for modern DNS infrastructure. Cloudflare, Route53, Google DNS, and all major providers refuse zone transfers from arbitrary clients. AXFR succeeding is exceptionally rare and indicates a critical misconfiguration."),
    spacer(),
    bold("Q: The chronotrace command is not found after I installed it. What's wrong?"),
    p("pipx installs scripts into ~/.local/bin/ which needs to be on your PATH. Run:"),
    code([
      "pipx ensurepath",
      "# then open a NEW terminal",
      "which chronotrace",
    ]),
    p("If which chronotrace returns nothing, your shell config is not loading ~/.local/bin/. Check ~/.bashrc or ~/.zshrc."),
    spacer(),
    bold("Q: How do I update ChronoTrace?"),
    code([
      "cd ~/ChronoTrace",
      "git pull",
      "pipx install ./backend --force",
    ]),
    spacer(),
    bold("Q: Can I use ChronoTrace through Tor or a proxy?"),
    p("Set the HTTP_PROXY and HTTPS_PROXY environment variables before running:"),
    code([
      "export HTTPS_PROXY=socks5://127.0.0.1:9050",
      "chronotrace target.com",
    ]),
    p("Note: passive sources (Wayback, crt.sh, RDAP) will still log your proxy IP. Active modules will route through the proxy."),
    spacer(),
    bold("Q: Does ChronoTrace work behind a corporate firewall?"),
    p("If your firewall blocks outbound HTTPS to web.archive.org, crt.sh, or rdap.org, those sources will fail. Try configuring HTTPS_PROXY to use your corporate proxy."),
    spacer(),
    bold("Q: How do I uninstall ChronoTrace?"),
    code("pipx uninstall chronotrace"),
    spacer(),
    bold("Q: How can I contribute to ChronoTrace?"),
    p("File issues and pull requests at github.com/DularaAbhiranda/ChronoTrace. Useful contributions:"),
    ...bullets([
      "New passive sources (Censys, SecurityTrails, AlienVault OTX)",
      "Improved dir_probe wordlists",
      "Better noise filtering for Cloudflare-fronted targets",
      "Translations of this booklet",
      "Web UI improvements",
    ]),
  ];
}

// ───────────────────────── Document assembly ─────────────────────────

const doc = new Document({
  creator: "Dulara Abhiranda",
  title: "ChronoTrace User Guide",
  description: "Field manual for ChronoTrace v1.0 — OSINT recon and active probing CLI",
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, color: COLOR.primary, font: "Arial" },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, color: COLOR.primary, font: "Arial" },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, color: COLOR.muted, font: "Arial" },
        paragraph: { spacing: { before: 180, after: 80 }, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      { reference: "bullets",
        levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "numbers",
        levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      },
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: "ChronoTrace User Guide", size: 18, italics: true, color: COLOR.muted, font: "Arial" })],
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "Page ", size: 18, color: COLOR.muted, font: "Arial" }),
            new TextRun({ children: [PageNumber.CURRENT], size: 18, color: COLOR.muted, font: "Arial" }),
          ],
        })],
      }),
    },
    children: [
      ...coverPage(),
      ...tocPage(),
      ...chapter1Introduction(),
      ...chapter2Installation(),
      ...chapter3QuickStart(),
      ...chapter4Recipe1(),
      ...chapter5Recipe2(),
      ...chapter6Recipe3(),
      ...chapter7Recipe4(),
      ...chapter8Recipe5(),
      ...chapter9Recipe6(),
      ...chapter10Recipe7(),
      ...chapter11OutputFormats(),
      ...chapter12Integration(),
      ...chapter13ModuleReference(),
      ...chapter14CommandReference(),
      ...chapter15Legal(),
      ...appendixA(),
      ...appendixB(),
      ...appendixC(),
    ],
  }],
});

Packer.toBuffer(doc).then(buf => {
  const out = path.join(__dirname, "..", "ChronoTrace_User_Guide.docx");
  fs.writeFileSync(out, buf);
  const stats = fs.statSync(out);
  console.log(`Generated: ${out}`);
  console.log(`Size: ${(stats.size / 1024).toFixed(1)} KB`);
});
