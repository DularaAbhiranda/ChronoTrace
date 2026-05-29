/* ChronoTrace landing page — typewriter + animated terminal demo
   ─────────────────────────────────────────────────────────────── */

// ─────────────────── Hero typewriter ───────────────────
// Cycles through several example commands so the hero never feels static.

const TYPE_COMMANDS = [
  "chronotrace example.com",
  "chronotrace target.com --active -y",
  "chronotrace mysite.com --json -o audit.json",
  "chronotrace target.com --port-scan --axfr --dir-probe",
  "chronotrace --list-modules",
];

(function startTypewriter() {
  const el = document.getElementById("typewriter");
  if (!el) return;

  let cmdIndex = 0;
  let charIndex = 0;
  let deleting = false;

  function tick() {
    const current = TYPE_COMMANDS[cmdIndex];

    if (!deleting) {
      charIndex++;
      el.textContent = current.slice(0, charIndex);
      if (charIndex >= current.length) {
        deleting = true;
        setTimeout(tick, 2200);   // hold full text before deleting
        return;
      }
      setTimeout(tick, 55 + Math.random() * 40);
    } else {
      charIndex--;
      el.textContent = current.slice(0, charIndex);
      if (charIndex <= 0) {
        deleting = false;
        cmdIndex = (cmdIndex + 1) % TYPE_COMMANDS.length;
        setTimeout(tick, 400);
        return;
      }
      setTimeout(tick, 25);
    }
  }
  tick();
})();

// ─────────────────── Animated terminal demo ───────────────────
// Plays a scripted ChronoTrace scan output, line by line, with realistic timing.

const DEMO_SCRIPT = [
  { t: 0,    line: '<span class="t-prompt">$</span> <span class="t-cmd">chronotrace example.com --active -y</span>', delay: 600 },
  { t: 1,    line: '' },
  { t: 2,    line: '<span class="t-banner"> ██████╗██╗  ██╗██████╗  ██████╗ ███╗   ██╗ ██████╗ ████████╗██████╗  █████╗  ██████╗███████╗</span>' },
  { t: 3,    line: '<span class="t-banner">██╔════╝██║  ██║██╔══██╗██╔═══██╗████╗  ██║██╔═══██╗╚══██╔══╝██╔══██╗██╔══██╗██╔════╝██╔════╝</span>' },
  { t: 4,    line: '<span class="t-banner">██║     ███████║██████╔╝██║   ██║██╔██╗ ██║██║   ██║   ██║   ██████╔╝███████║██║     █████╗</span>' },
  { t: 5,    line: '<span class="t-banner">██║     ██╔══██║██╔══██╗██║   ██║██║╚██╗██║██║   ██║   ██║   ██╔══██╗██╔══██║██║     ██╔══╝</span>' },
  { t: 6,    line: '<span class="t-banner">╚██████╗██║  ██║██║  ██║╚██████╔╝██║ ╚████║╚██████╔╝   ██║   ██║  ██║██║  ██║╚██████╗███████╗</span>' },
  { t: 7,    line: '<span class="t-banner"> ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝ ╚═════╝    ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚══════╝</span>' },
  { t: 8,    line: '' },
  { t: 9,    line: '         <span class="t-warn">Domain History · Certificate Transparency · Active Recon</span>' },
  { t: 10,   line: '        <span class="t-muted">v1.0.0  by Dulara Abhiranda · github.com/DularaAbhiranda/ChronoTrace</span>', delay: 300 },
  { t: 11,   line: '' },
  { t: 12,   line: '<span class="t-cmd">Target:</span>   example.com' },
  { t: 13,   line: '<span class="t-cmd">Passive:</span>  wayback, crt_sh, rdap, dns' },
  { t: 14,   line: '<span class="t-err">Active:</span>   port_scan, http_probe, tls_live, well_known, dns_axfr, dir_probe' },
  { t: 15,   line: '<span class="t-cmd">Started:</span>  2026-05-27 00:42:11', delay: 800 },
  { t: 16,   line: '' },
  { t: 17,   line: '<span class="t-cmd">Running connectors...</span>', delay: 500 },
  { t: 18,   line: '<span class="t-ok">[+]</span> dns                  <span class="t-muted">0.3s</span>      <span class="t-cmd">5</span> events', delay: 700 },
  { t: 19,   line: '<span class="t-ok">[+]</span> rdap                 <span class="t-muted">1.7s</span>      <span class="t-cmd">2</span> events', delay: 1100 },
  { t: 20,   line: '<span class="t-ok">[+]</span> tls_live             <span class="t-muted">0.4s</span>      <span class="t-cmd">1</span> events', delay: 400 },
  { t: 21,   line: '<span class="t-ok">[+]</span> http_probe           <span class="t-muted">0.9s</span>      <span class="t-cmd">2</span> events', delay: 600 },
  { t: 22,   line: '<span class="t-ok">[+]</span> dns_axfr             <span class="t-muted">1.3s</span>      <span class="t-cmd">2</span> events', delay: 500 },
  { t: 23,   line: '<span class="t-ok">[+]</span> well_known           <span class="t-muted">3.1s</span>      <span class="t-cmd">5</span> events', delay: 1800 },
  { t: 24,   line: '<span class="t-ok">[+]</span> port_scan            <span class="t-muted">5.0s</span>      <span class="t-cmd">5</span> events', delay: 1900 },
  { t: 25,   line: '<span class="t-ok">[+]</span> dir_probe            <span class="t-muted">6.6s</span>     <span class="t-cmd">27</span> events', delay: 1700 },
  { t: 26,   line: '<span class="t-ok">[+]</span> crt_sh              <span class="t-muted">26.2s</span>   <span class="t-cmd">1119</span> events', delay: 2200 },
  { t: 27,   line: '<span class="t-ok">[+]</span> wayback             <span class="t-muted">85.7s</span>   <span class="t-cmd">4991</span> events', delay: 2400 },
  { t: 28,   line: '' },
  { t: 29,   line: '<span class="t-cmd">          Source Summary</span>' },
  { t: 30,   line: '<span class="t-muted">┏━━━━━━━━━━━━━┳━━━━━━━━┳━━━━━━━━━━┓</span>' },
  { t: 31,   line: '<span class="t-muted">┃</span> <span class="t-cyan">Source</span>      <span class="t-muted">┃</span> <span class="t-cyan">Events</span> <span class="t-muted">┃</span> <span class="t-cyan">Status</span>   <span class="t-muted">┃</span>' },
  { t: 32,   line: '<span class="t-muted">┡━━━━━━━━━━━━━╇━━━━━━━━╇━━━━━━━━━━┩</span>' },
  { t: 33,   line: '<span class="t-muted">│</span> wayback     <span class="t-muted">│</span>   <span class="t-cmd">4991</span> <span class="t-muted">│</span> <span class="t-ok">OK</span>       <span class="t-muted">│</span>' },
  { t: 34,   line: '<span class="t-muted">│</span> crt_sh      <span class="t-muted">│</span>   <span class="t-cmd">1119</span> <span class="t-muted">│</span> <span class="t-ok">OK</span>       <span class="t-muted">│</span>' },
  { t: 35,   line: '<span class="t-muted">│</span> rdap        <span class="t-muted">│</span>      <span class="t-cmd">2</span> <span class="t-muted">│</span> <span class="t-ok">OK</span>       <span class="t-muted">│</span>' },
  { t: 36,   line: '<span class="t-muted">│</span> dns         <span class="t-muted">│</span>      <span class="t-cmd">5</span> <span class="t-muted">│</span> <span class="t-ok">OK</span>       <span class="t-muted">│</span>' },
  { t: 37,   line: '<span class="t-muted">│</span> port_scan   <span class="t-muted">│</span>      <span class="t-cmd">5</span> <span class="t-muted">│</span> <span class="t-ok">OK</span>       <span class="t-muted">│</span>' },
  { t: 38,   line: '<span class="t-muted">│</span> http_probe  <span class="t-muted">│</span>      <span class="t-cmd">2</span> <span class="t-muted">│</span> <span class="t-ok">OK</span>       <span class="t-muted">│</span>' },
  { t: 39,   line: '<span class="t-muted">│</span> tls_live    <span class="t-muted">│</span>      <span class="t-cmd">1</span> <span class="t-muted">│</span> <span class="t-ok">OK</span>       <span class="t-muted">│</span>' },
  { t: 40,   line: '<span class="t-muted">│</span> well_known  <span class="t-muted">│</span>      <span class="t-cmd">5</span> <span class="t-muted">│</span> <span class="t-ok">OK</span>       <span class="t-muted">│</span>' },
  { t: 41,   line: '<span class="t-muted">│</span> dns_axfr    <span class="t-muted">│</span>      <span class="t-cmd">2</span> <span class="t-muted">│</span> <span class="t-ok">OK</span>       <span class="t-muted">│</span>' },
  { t: 42,   line: '<span class="t-muted">│</span> dir_probe   <span class="t-muted">│</span>     <span class="t-cmd">27</span> <span class="t-muted">│</span> <span class="t-ok">OK</span>       <span class="t-muted">│</span>' },
  { t: 43,   line: '<span class="t-muted">└─────────────┴────────┴──────────┘</span>', delay: 500 },
  { t: 44,   line: '' },
  { t: 45,   line: '<span class="t-warn">╭─────────── Scan Complete ───────────╮</span>' },
  { t: 46,   line: '<span class="t-warn">│</span> <span class="t-cmd">6157</span> total events across <span class="t-cmd">9</span> sources  <span class="t-warn">│</span>' },
  { t: 47,   line: '<span class="t-warn">│</span> Date range: <span class="t-muted">1995-08-14 → 2026-05-27</span> <span class="t-warn">│</span>' },
  { t: 48,   line: '<span class="t-warn">╰─────────────────────────────────────╯</span>' },
  { t: 49,   line: '' },
  { t: 50,   line: '<span class="t-muted">Elapsed: 85.8s</span>' },
  { t: 51,   line: '<span class="t-prompt">$</span> <span class="t-cursor"></span>', delay: 0 },
];

(function startDemo() {
  const body = document.getElementById("demo-body");
  const restartBtn = document.getElementById("demo-restart");
  if (!body) return;

  let timeouts = [];

  function clearAll() {
    timeouts.forEach(clearTimeout);
    timeouts = [];
    body.innerHTML = "";
  }

  function run() {
    clearAll();
    let cumulative = 0;
    DEMO_SCRIPT.forEach((step, i) => {
      const delay = step.delay !== undefined ? step.delay : 80;
      cumulative += delay;
      const id = setTimeout(() => {
        const line = document.createElement("div");
        line.innerHTML = step.line || "&nbsp;";
        body.appendChild(line);
        // auto-scroll to bottom
        body.scrollTop = body.scrollHeight;
      }, cumulative);
      timeouts.push(id);
    });

    // Auto-replay after the demo finishes + 8s pause
    const replayId = setTimeout(() => {
      run();
    }, cumulative + 8000);
    timeouts.push(replayId);
  }

  // Wait for the demo section to scroll into view before starting
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting && body.children.length === 0) {
        run();
      }
    });
  }, { threshold: 0.2 });
  obs.observe(body);

  if (restartBtn) restartBtn.addEventListener("click", run);
})();

// ─────────────────── Copy buttons ───────────────────

document.querySelectorAll(".copy-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = document.getElementById(btn.dataset.target);
    if (!target) return;

    // Extract command lines (skip comments and outputs)
    const text = Array.from(target.querySelectorAll("*"))
      .filter((n) => !n.classList.contains("comment") && !n.classList.contains("output"))
      .map((n) => n.textContent)
      .join("")
      .replace(/\$ /g, "")
      .replace(/PS> /g, "")
      .replace(/^\s*[\r\n]/gm, "")
      .trim();

    // Fallback: just copy the text content directly if extraction looks empty
    const finalText = text || target.textContent.trim();

    navigator.clipboard.writeText(finalText).then(() => {
      btn.textContent = "✓ copied";
      btn.classList.add("copied");
      setTimeout(() => {
        btn.textContent = "copy";
        btn.classList.remove("copied");
      }, 2000);
    }).catch(() => {
      btn.textContent = "(copy failed)";
    });
  });
});

// ─────────────────── Subtle CRT glitch on hover (banner only) ───────────────────

const banner = document.querySelector(".ascii-banner");
if (banner) {
  banner.addEventListener("mouseenter", () => {
    banner.style.transition = "transform 0.05s";
    let frames = 0;
    const id = setInterval(() => {
      banner.style.transform = `translateX(${(Math.random() - 0.5) * 4}px)`;
      frames++;
      if (frames > 6) {
        clearInterval(id);
        banner.style.transform = "";
      }
    }, 50);
  });
}
