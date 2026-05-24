import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

// ============================================================
// GAT CONTROL ROOM v3 — Enhanced
// localStorage persistence · live Update parsing · mobile-first
// ============================================================

const C = {
  bg:           "#1E1D1A",
  surface:      "#2B2A27",
  surfaceAlt:   "#323129",
  surfaceHigh:  "#3A3830",
  border:       "#3D3B33",
  borderLight:  "#4A4840",
  textPrimary:  "#EEEEEE",
  textSecondary:"#A8A49A",
  textMuted:    "#6B6860",
  green:        "#1DB954",
  greenDim:     "#1DB95418",
  greenGlow:    "#1DB95430",
  greenDeep:    "#17A349",
  greenText:    "#4ADE80",
  red:          "#F87171",
  redDim:       "#F8717118",
  yellow:       "#FBBF24",
  yellowDim:    "#FBBF2418",
  white:        "#F5F4F0",
  blue:         "#60A5FA",
  blueDim:      "#60A5FA22",
};

const mono  = "'SF Mono', 'Fira Code', 'Courier New', monospace";
const sans  = "'system-ui', '-apple-system', 'Segoe UI', sans-serif";

const fmt  = n => "$" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
const fmtK = n => n >= 1000 ? "$" + (n / 1000).toFixed(1) + "k" : fmt(n);
const fmtP = n => (n >= 0 ? "+" : "") + Number(n).toFixed(2) + "%";

function safeGet(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v !== null ? JSON.parse(v) : fallback;
  } catch { return fallback; }
}
function safeSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// ── Data version guard — bumping DATA_VERSION wipes stale localStorage ──
const DATA_VERSION = "v15";
(function resetIfStale() {
  if (safeGet("gat_version", null) !== DATA_VERSION) {
    ["gat_sgatData","gat_stocksData","gat_hardAssets","gat_perfData","gat_reData","gat_quantities","gat_livePrices","gat_sgat","gat_stk","gat_ast","gat_hist","gat_daily_snapshots"].forEach(k => {
      try { localStorage.removeItem(k); } catch {}
    });
    safeSet("gat_version", DATA_VERSION);
  }
})();

// ── Default data ──────────────────────────────────────────────
const DEFAULT_SGAT = { deployed: 0, pnl: 0, pnlPct: 0, trades: 0, agents: [], macro: { fg: null, btcDom: null, regime: null, btcPrice: null }, lastUpdated: null, fleetTotal: null, performance: null, checkResults: null, scan: null };
// checkResults shape: { passed: 0, failed: 0, warnings: 0, checkedAt: "HH:MM" }
// scan shape: [{ chain: "SOL", seen: 30, passed: 0 }, ...]
// performance shape: { trades: 0, winRate: null, avgPct: null, streak: null }

// Stocks scaled so holdings sum = $164,100
// Total nw = 164,100 + 18,500 + 42,300 + 22,450 + 100 = $247,450 — matches chart
const DEFAULT_STOCKS = {
  total: 0, ibkrCash: 265,
  holdings: [
    { ticker: "TSM",   name: "Taiwan Semi", target: 28, actual: 0, value: 0, shares: 0, weekChange: 0 },
    { ticker: "GOOGL", name: "Alphabet",    target: 25, actual: 0, value: 0, shares: 0, weekChange: 0 },
    { ticker: "AVGO",  name: "Broadcom",    target: 20, actual: 0, value: 0, shares: 0, weekChange: 0 },
    { ticker: "LLY",   name: "Eli Lilly",   target: 15, actual: 0, value: 0, shares: 0, weekChange: 0 },
    { ticker: "AMD",   name: "AMD",         target: 12, actual: 0, value: 0, shares: 0, weekChange: 0 },
  ]
};

const DEFAULT_ASSETS = [
  { icon: "🥇", name: "Gold",    note: "Long term — no sell target", currentValue: 111300, costBasis: 111300, changePct: 0 },
  { icon: "₿",  name: "Bitcoin", note: "Long term — no sell target", currentValue:  68800, costBasis:  68800, changePct: 0 },
];

const DEFAULT_RE = {
  houseValue:         530000,
  mortgageRemaining:  486874,
  monthlyPayment:       3954,
  payoffYear:           2045,
};

// nw = 0 (stocks) + 111,300 (gold) + 68,800 (btc) + 43,126 (house equity) + 0 (sgat) = $223,226
const DEFAULT_PERF = [
  { week: "Apr '26", total: 223226, prev: null },
  { week: "May '26", total: 276549, prev: 223226 },
];


// ── Base components ───────────────────────────────────────────
const Card = ({ children, style = {}, highlight = false }) => (
  <div style={{
    background: C.surface,
    border: `1px solid ${highlight ? C.green + "45" : C.border}`,
    borderRadius: 16,
    padding: "18px 20px",
    boxShadow: highlight ? `0 0 0 1px ${C.green}20, 0 4px 24px ${C.greenGlow}` : "0 1px 3px rgba(0,0,0,0.3)",
    ...style
  }}>{children}</div>
);

const SLabel = ({ children }) => (
  <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: C.textMuted,
    textTransform: "uppercase", fontFamily: sans, margin: "0 0 6px 0" }}>{children}</p>
);

const BigNum = ({ children, color = C.white, size = 28 }) => (
  <p style={{ fontSize: size, fontWeight: 700, color, fontFamily: mono,
    letterSpacing: "-0.03em", lineHeight: 1.15, margin: 0 }}>{children}</p>
);

const Body = ({ children, color = C.textSecondary, size = 13 }) => (
  <p style={{ fontSize: size, color, fontFamily: sans, lineHeight: 1.6, margin: 0 }}>{children}</p>
);

const Badge = ({ children, color = C.green }) => (
  <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px",
    borderRadius: 20, fontSize: 11, fontWeight: 600, color,
    background: color + "22", fontFamily: sans, letterSpacing: "0.02em" }}>{children}</span>
);

const Dot = ({ color = C.green }) => (
  <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%",
    background: color, boxShadow: `0 0 8px ${color}`,
    animation: "pulse 2.5s infinite", flexShrink: 0 }} />
);

const Bar = ({ value, max, color = C.green, h = 5 }) => (
  <div style={{ height: h, background: C.border, borderRadius: 3, overflow: "hidden" }}>
    <div style={{ height: "100%", width: `${Math.min(100, (value / max) * 100)}%`,
      background: color, borderRadius: 3, boxShadow: `0 0 10px ${color}50`,
      transition: "width 0.7s ease" }} />
  </div>
);

const Hr = ({ my = 16 }) => (
  <div style={{ height: 1, background: C.border, margin: `${my}px 0` }} />
);

const SHead = ({ icon, title, right }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12,
      fontWeight: 600, color: C.textSecondary, fontFamily: sans, letterSpacing: "0.04em" }}>
      <span style={{ fontSize: 14 }}>{icon}</span>{title}
    </div>
    {right}
  </div>
);

// ── Phase tracker ─────────────────────────────────────────────
const Phases = ({ current, isMobile }) => {
  const steps = [
    { n: 1, label: "Build",  desc: "Foundations" },
    { n: 2, label: "Flow",   desc: "SGAT → MGAT" },
    { n: 3, label: "Cycle",  desc: "Full loop"   },
    { n: 4, label: "Empire", desc: "Autonomous"  },
  ];
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 4 }}>
      {steps.map((s, i) => {
        const done   = s.n < current;
        const active = s.n === current;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, flex: 1 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, flex: 1 }}>
              <div style={{ width: isMobile ? 28 : 34, height: isMobile ? 28 : 34, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: isMobile ? 11 : 13, fontWeight: 700, fontFamily: mono,
                background: done ? C.green : active ? C.greenDim : C.surfaceAlt,
                color: done ? "#0B0B09" : active ? C.green : C.textMuted,
                border: `2px solid ${active ? C.green : done ? C.green : C.border}`,
                boxShadow: active ? `0 0 18px ${C.greenGlow}` : "none", transition: "all 0.3s" }}>
                {done ? "✓" : s.n}
              </div>
              <p style={{ fontSize: isMobile ? 9 : 10, fontWeight: 600, margin: 0,
                color: active ? C.green : done ? C.greenDeep : C.textMuted,
                fontFamily: sans, textAlign: "center" }}>{s.label}</p>
              {!isMobile && <p style={{ fontSize: 9, margin: 0, color: C.textMuted,
                fontFamily: sans, textAlign: "center" }}>{s.desc}</p>}
            </div>
            {i < steps.length - 1 && (
              <div style={{ width: isMobile ? 12 : 20, height: 2, background: done ? C.green : C.border,
                borderRadius: 1, marginBottom: isMobile ? 20 : 28, flexShrink: 0 }} />
            )}
          </div>
        );
      })}
    </div>
  );
};

// ── Chart tooltip ─────────────────────────────────────────────
const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const v    = payload[0]?.value;
  const prev = payload[0]?.payload?.prev;
  const chg  = prev ? ((v - prev) / prev) * 100 : 0;
  return (
    <div style={{ background: C.surfaceHigh, border: `1px solid ${C.border}`,
      borderRadius: 10, padding: "10px 14px", fontFamily: sans, fontSize: 12,
      boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
      <p style={{ color: C.textMuted, margin: "0 0 4px", fontSize: 11 }}>{label}</p>
      <p style={{ color: C.white, fontWeight: 700, fontSize: 16, margin: "0 0 2px", fontFamily: mono }}>{fmtK(v)}</p>
      {prev && <p style={{ color: chg >= 0 ? C.greenText : C.red, margin: 0, fontSize: 12 }}>{fmtP(chg)}</p>}
    </div>
  );
};

// ── Allocation bar ─────────────────────────────────────────────
const AllocBar = ({ items }) => {
  const cols = [C.green, C.greenDeep, C.yellow, "#F97316", C.red];
  return (
    <div>
      <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", gap: 2, marginBottom: 12 }}>
        {items.map((it, i) => (
          <div key={i} style={{ flex: it.pct, background: cols[i % cols.length], borderRadius: 3 }}
            title={`${it.name}: ${it.pct}%`} />
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px" }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6,
            fontSize: 12, color: C.textSecondary, fontFamily: sans }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: cols[i % cols.length], flexShrink: 0 }} />
            {it.name} <span style={{ color: C.textMuted }}>{it.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Stock row ─────────────────────────────────────────────────
const StockRow = ({ ticker, name, target, actual, value, weekChange, isMobile }) => {
  const drift = actual - target;
  const up    = weekChange >= 0;
  const warn  = Math.abs(drift) > 2;
  return (
    <div style={{ padding: "13px 0", borderBottom: `1px solid ${C.border}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 12 }}>
          <div style={{ width: isMobile ? 34 : 40, height: isMobile ? 34 : 40, borderRadius: 10,
            background: C.surfaceAlt, border: `1px solid ${C.border}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 700, color: C.greenText, fontFamily: mono }}>{ticker}</div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary, fontFamily: sans, margin: "0 0 2px" }}>{ticker}</p>
            {!isMobile && <p style={{ fontSize: 12, color: C.textMuted, fontFamily: sans, margin: 0 }}>{name}</p>}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: C.white, fontFamily: mono, margin: "0 0 2px" }}>{fmt(value)}</p>
          <p style={{ fontSize: 12, color: up ? C.greenText : C.red, fontFamily: sans, margin: 0 }}>
            {up ? "▲" : "▼"} {Math.abs(weekChange)}%
          </p>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <Bar value={actual} max={35} color={warn ? C.yellow : C.green} />
        </div>
        <div style={{ display: "flex", gap: 8, fontSize: 12, fontFamily: sans, color: C.textMuted, flexShrink: 0 }}>
          <span>T: {target}%</span>
          <span style={{ color: warn ? C.yellow : C.greenText }}>A: {actual}%</span>
          {warn && <Badge color={drift > 0 ? C.yellow : C.red}>{drift > 0 ? "+" : ""}{drift.toFixed(1)}%</Badge>}
        </div>
      </div>
    </div>
  );
};

// ── Asset row ─────────────────────────────────────────────────
const AssetRow = ({ icon, name, note, currentValue, changePct, isMobile }) => {
  const up = changePct >= 0;
  return (
    <div style={{ padding: "14px 0", borderBottom: `1px solid ${C.border}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 10 : 14 }}>
          <span style={{ fontSize: isMobile ? 20 : 24 }}>{icon}</span>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary, fontFamily: sans, margin: "0 0 2px" }}>{name}</p>
            {note && !isMobile && <p style={{ fontSize: 12, color: C.textMuted, fontFamily: sans, margin: 0 }}>{note}</p>}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: C.white, fontFamily: mono, margin: "0 0 2px" }}>{fmt(currentValue)}</p>
          <p style={{ fontSize: 12, color: up ? C.greenText : C.red, fontFamily: sans, margin: 0 }}>
            {up ? "+" : ""}{changePct.toFixed(1)}% this period
          </p>
        </div>
      </div>
    </div>
  );
};

// ── Paste zone ────────────────────────────────────────────────
const PasteZone = ({ icon, label, hint, value, onChange }) => (
  <div style={{ marginBottom: 20 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <SLabel>{label}</SLabel>
    </div>
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={hint}
      style={{ width: "100%", minHeight: 100, background: C.bg,
        border: `1px solid ${C.border}`, borderRadius: 10,
        color: C.textSecondary, fontSize: 13, fontFamily: mono,
        padding: "12px 14px", resize: "vertical", outline: "none",
        boxSizing: "border-box", lineHeight: 1.7, transition: "border-color 0.2s" }}
      onFocus={e => e.target.style.borderColor = C.green}
      onBlur={e => e.target.style.borderColor = C.border}
    />
  </div>
);

const parseSGATReport = (text, current) => {
  if (!text || !text.trim()) return null;
  try {
    const lines = text.trim().split("\n");
    const agents = [];

    let li = 0;
    while (li < lines.length) {
      const line = lines[li].trim();
      if (!line.toUpperCase().startsWith("SGAT_")) { li++; continue; }
      const parts = line.split("|").map(p => p.trim());
      if (parts.length < 4) { li++; continue; }

      // parts[0] = "SGAT_SOL: ABSTAIN"
      const nameMode = parts[0].match(/^(SGAT_\w+)[:\s]+(\w+)/i);
      if (!nameMode) { li++; continue; }
      const name = nameMode[1].toUpperCase();
      const mode = nameMode[2].toUpperCase();

      // parts[1] = "$126.07" or "$126.07 USDC"
      const usdcM = parts[1].match(/([\d]+\.?\d*)/);
      const usdc  = usdcM ? parseFloat(usdcM[1]) : 0;

      // parts[2] = "0 trades"
      const trdM  = parts[2].match(/(\d+)/);
      const FAILED_SWAP_MODES = ["SWAP_FAILED", "SWAP_NO_TXID"];
      const trd   = (trdM && !FAILED_SWAP_MODES.includes(mode)) ? parseInt(trdM[1]) : 0;

      // parts[3] = "PNL: $0.00" | "P&L: $4.21" | "P&L -$1.54" | "P&L $0" | "P&L —"
      // Strip $ first so "-$1.54" becomes "-1.54" before sign+number extraction
      const pnlClean = parts[3].replace(/\$/g, "");
      const pnlM  = pnlClean.match(/([-+]?\d+\.?\d*)/);
      const pnl   = pnlM ? parseFloat(pnlM[1]) : 0;

      // Look ahead for optional POSITION line
      // Format: POSITION: BTCB/USDC | Entry $82521.78 | Now $80958.31 | Size $80 | P&L -1.89% (-$1.51) | Total wallet $118.00
      let position = null;
      if (li + 1 < lines.length && lines[li + 1].trim().toUpperCase().startsWith("POSITION:")) {
        li++;
        const pp = lines[li].trim().split("|").map(p => p.trim());
        const symbolM  = pp[0]?.match(/POSITION:\s*(\S+)/i);
        const entryM   = pp[1]?.match(/([\d.]+)/);
        const nowM     = pp[2]?.match(/([\d.]+)/);
        const sizeM    = pp[3]?.match(/([\d.]+)/);
        const pctM     = pp[4]?.match(/([-+]?[\d.]+)%/);
        const upnlM    = pp[4]?.match(/\([-+]?\$?([\d.]+)\)/);
        const upnlSign = (pp[4] || "").includes("(-") ? -1 : 1;
        const walletM  = pp[5]?.match(/([\d.]+)/);
        const caM = pp[6]?.match(/CA[:\s]+([A-Za-z0-9]{20,})/i) || pp[5]?.match(/CA[:\s]+([A-Za-z0-9]{20,})/i);
        position = {
          symbol:         symbolM ? symbolM[1]                        : "",
          entry:          entryM  ? parseFloat(entryM[1])             : 0,
          current:        nowM    ? parseFloat(nowM[1])               : 0,
          size:           sizeM   ? parseFloat(sizeM[1])              : 0,
          pnl_pct:        pctM    ? parseFloat(pctM[1])               : 0,
          unrealized_pnl: upnlM  ? upnlSign * parseFloat(upnlM[1])   : 0,
          total_wallet:   walletM ? parseFloat(walletM[1])            : 0,
          address:        caM     ? caM[1]                            : null,
        };
      }

      agents.push({ name, mode, usdc, trades: trd, pnl, status: "✅", position });
      li++;
    }

    // Totals — use position.total_wallet when an open position exists
    const deployed = agents.length > 0
      ? Math.round(agents.reduce((s, a) => s + (a.position ? a.position.total_wallet : a.usdc), 0) * 100) / 100
      : current.deployed;
    const trades = agents.reduce((s, a) => s + a.trades, 0);
    const pnl    = Math.round(agents.reduce((s, a) => s + a.pnl, 0) * 100) / 100;
    const pnlPct = deployed > 0 && pnl !== 0
      ? parseFloat(((pnl / deployed) * 100).toFixed(2)) : 0;

    // Day — optional
    // MACRO line — "MACRO: FG:40 | DOM:58.46 | REGIME:BEAR"
    // also handles "MACRO: F&G 40 (Fear) | BTC Dom 58.46% | Regime: BEAR"
    const macroLine = lines.find(l => l.trim().toUpperCase().startsWith("MACRO:")) || "";
    const fgM        = macroLine.match(/F[G&]+[:\s]+(\d+)/i);
    const domM       = macroLine.match(/DOM[:\s]+([\d.]+)|BTC\s*Dom\s*([\d.]+)/i);
    const regM       = macroLine.match(/REGIME[:\s]+(\w+)/i);
    // BTC price: match "BTC $79,695" (not "BTC Dom")
    const btcPriceM  = macroLine.match(/BTC\s+\$?([\d,]+)(?!\s*Dom)/i);
    const macro = {
      fg:       fgM       ? parseInt(fgM[1])                               : current.macro?.fg,
      btcDom:   domM      ? parseFloat(domM[1] || domM[2])                 : current.macro?.btcDom,
      regime:   regM      ? regM[1].toUpperCase()                          : current.macro?.regime,
      btcPrice: btcPriceM ? parseFloat(btcPriceM[1].replace(/,/g, ""))    : current.macro?.btcPrice,
    };

    // Fleet total line: "FLEET TOTAL: $665.52"
    const fleetLine  = lines.find(l => /FLEET\s+TOTAL/i.test(l.trim())) || "";
    const fleetTotM  = fleetLine.match(/\$?([\d,]+\.?\d*)/);
    const fleetTotal = fleetTotM ? parseFloat(fleetTotM[1].replace(/,/g, "")) : null;

    // PERFORMANCE line: "PERFORMANCE: 12 trades | Win 67% | Avg 1.4%"
    // Also handles optional streak: "... | Streak +3"
    const perfLine   = lines.find(l => /^PERFORMANCE[:\s]/i.test(l.trim())) || "";
    let performance  = current.performance ?? null;
    if (perfLine) {
      const trdM2   = perfLine.match(/(\d+)\s*trades?/i);
      const winM    = perfLine.match(/Win[:\s]+([\d.]+)%/i);
      const avgM    = perfLine.match(/Avg[:\s]+([-+]?[\d.]+)%/i);
      const strM    = perfLine.match(/Streak[:\s]+([-+]?\d+)/i);
      performance   = {
        trades:   trdM2  ? parseInt(trdM2[1])     : (current.performance?.trades  ?? 0),
        winRate:  winM   ? parseFloat(winM[1])    : (current.performance?.winRate  ?? null),
        avgPct:   avgM   ? parseFloat(avgM[1])    : (current.performance?.avgPct   ?? null),
        streak:   strM   ? parseInt(strM[1])      : (current.performance?.streak   ?? null),
      };
    }

    // System check counts — handles single-line and separate-line formats
    const passedLine   = lines.find(l => /PASSED[:\s]+\d+/i.test(l))   || "";
    const failedLine   = lines.find(l => /FAILED[:\s]+\d+/i.test(l))   || "";
    const warningsLine = lines.find(l => /WARNINGS?[:\s]+\d+/i.test(l)) || "";
    let checkResults  = current.checkResults ?? null;
    const ckPassM = passedLine.match(/PASSED[:\s]+(\d+)/i);
    const ckFailM = failedLine.match(/FAILED[:\s]+(\d+)/i);
    const ckWarnM = warningsLine.match(/WARNINGS?[:\s]+(\d+)/i);
    if (ckPassM) {
      checkResults = {
        passed:    parseInt(ckPassM[1]),
        failed:    ckFailM   ? parseInt(ckFailM[1])   : 0,
        warnings:  ckWarnM  ? parseInt(ckWarnM[1])   : 0,
        checkedAt: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      };
    }

    // SCAN line: "SCAN: SOL 30/0 | BASE 2/0 | ETH 12/0 | BSC 9/0 | SUI 0/0"
    const scanLine = lines.find(l => /^SCAN[:\s]/i.test(l.trim())) || "";
    let scan = current.scan ?? null;
    if (scanLine) {
      const scanBody = scanLine.replace(/^SCAN[:\s]*/i, "");
      const entries  = scanBody.split("|").map(s => s.trim()).filter(Boolean);
      const parsed   = entries.map(e => {
        const m = e.match(/^(\S+)\s+(\d+)\/(\d+)/);
        return m ? { chain: m[1].toUpperCase(), seen: parseInt(m[2]), passed: parseInt(m[3]) } : null;
      }).filter(Boolean);
      if (parsed.length > 0) scan = parsed;
    }

    // Timestamp
    const tsM = text.match(/(\d{2}[\/\s]\d{2}[\/\s]\d{4}[,\s]+[\d:]+)/);
    const lastUpdated = tsM ? tsM[1].trim()
      : new Date().toLocaleString("en-GB", {
          day:"2-digit", month:"2-digit", year:"numeric",
          hour:"2-digit", minute:"2-digit"
        });

    if (agents.length === 0) return null;
    return { deployed, pnl, pnlPct, trades,
             agents, macro, lastUpdated, fleetTotal, performance, checkResults, scan };
  } catch(e) { console.error("parseSGAT:", e); return null; }
};

// ── System Check parser ───────────────────────────────────
const parseSysCheck = (text) => {
  if (!text || !text.trim()) return null;
  try {
    const passedM   = text.match(/PASSED[:\s]+(\d+)/i);
    const warningsM = text.match(/WARNINGS?[:\s]+(\d+)/i);
    const failedM   = text.match(/FAILED[:\s]+(\d+)/i);
    if (!passedM && !warningsM && !failedM) return null;

    const passed   = passedM   ? parseInt(passedM[1])   : 0;
    const warnings = warningsM ? parseInt(warningsM[1]) : 0;
    const failed   = failedM   ? parseInt(failedM[1])   : 0;

    // Overall status — look for explicit label first, then derive
    let status = "ALL SYSTEMS GO";
    if (text.match(/FAILURE/i)) status = "FAILURES";
    else if (failed > 0)       status = "FAILURES";
    else if (text.match(/WARNING/i) && warnings > 0) status = "WARNINGS";
    else if (warnings > 0)     status = "WARNINGS";

    // Timestamp from report header line e.g. "07/05/2026 10:28 Bahrain"
    const tsM = text.match(/(\d{2}[\/]\d{2}[\/]\d{4}[\s,]+[\d:]+)/);
    const timestamp = tsM
      ? tsM[1].trim()
      : new Date().toLocaleString("en-GB", {
          day: "2-digit", month: "2-digit", year: "numeric",
          hour: "2-digit", minute: "2-digit",
        });

    return { timestamp, passed, warnings, failed, status };
  } catch (e) { console.error("parseSysCheck:", e); return null; }
};

const parseStocksReport = (text, current) => {
  if (!text.trim()) return null;
  try {
    const lines = text.trim().split("\n").filter(l => l.trim());
    const parsed = [];
    for (const line of lines) {
      const tickerM = line.match(/^([A-Z]{1,5})[:\s]/);
      if (!tickerM) continue;
      const ticker  = tickerM[1];
      const sharesM = line.match(/(\d+)\s+shares?/i);
      const priceM  = line.match(/@\s*\$?([\d,]+\.?\d*)/);
      const valueM  = line.match(/=\s*\$?([\d,]+\.?\d*)/);
      const changeM = line.match(/([\+\-][\d.]+)\s*%/);
      const shares    = sharesM ? parseInt(sharesM[1]) : (current.holdings.find(h => h.ticker === ticker)?.shares || 0);
      const unitPrice = priceM  ? parseFloat(priceM[1].replace(/,/g, "")) : 0;
      // value: shares×price if both present, else = $value from line, else 0
      const value = (shares > 0 && unitPrice > 0)
        ? shares * unitPrice
        : valueM ? parseFloat(valueM[1].replace(/,/g, "")) : 0;
      if (shares === 0 && value === 0 && !sharesM) continue; // skip non-holding lines
      const wkChg = changeM ? parseFloat(changeM[1]) : 0;
      const exist  = current.holdings.find(h => h.ticker === ticker);
      parsed.push({
        ticker,
        name:       exist?.name   || ticker,
        target:     exist?.target || 20,
        actual:     0,
        value,
        shares,
        weekChange: wkChg,
      });
    }
    if (parsed.length === 0) return null;
    const total = parsed.reduce((s, h) => s + h.value, 0);
    parsed.forEach(h => {
      h.actual = total > 0 ? parseFloat(((h.value / total) * 100).toFixed(1)) : 0;
    });
    return { ...current, total, holdings: parsed };
  } catch { return null; }
};

const parseAssetsReport = (text, current) => {
  if (!text.trim()) return null;
  try {
    // Gold: accepts "= $18,500" or "Gold: $18,500"
    const goldVal = extractNum(text,
      /Gold[^=\n]*=\s*\$?([\d,]+)/i,
      /Gold[:\s]+\$?([\d,]+)/i
    );
    // BTC
    const btcVal = extractNum(text,
      /BTC[^=\n]*=\s*\$?([\d,]+)/i,
      /Bitcoin[^=\n]*=\s*\$?([\d,]+)/i,
      /BTC[:\s]+\$?([\d,]+)/i
    );
    // House value
    const houseRaw = extractNum(text,
      /House[^:=\n]*Still\s+\$?([\d,]+)/i,
      /House[:\s]+\$?([\d,]+)/i
    );
    // Mortgage paid this month (reduces remaining)
    const mortgagePaid = extractNum(text,
      /Mortgage[^:]*paid[^:]*:\s*\$?([\d,]+)/i
    );

    if (!goldVal && !btcVal && !houseRaw) return null;

    const next = current.map(a => {
      const old = a.currentValue;
      if (a.name === "Gold"    && goldVal != null) return { ...a, currentValue: goldVal,   changePct: ((goldVal   - old) / old) * 100 };
      if (a.name === "Bitcoin" && btcVal  != null) return { ...a, currentValue: btcVal,    changePct: ((btcVal    - old) / old) * 100 };
      if (a.name === "House"   && houseRaw != null) {
        // If mortgage paid given, add it to equity; otherwise take as equity directly
        const newEquity = mortgagePaid != null ? old + mortgagePaid : houseRaw;
        return { ...a, currentValue: newEquity, changePct: ((newEquity - old) / old) * 100 };
      }
      return a;
    });
    return next;
  } catch { return null; }
};

// ── Historical parser ─────────────────────────────────────────
const MONTH_ORDER = { Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12 };

const dateKey = (raw) => {
  if (!raw || raw.toLowerCase() === "today") return "today";
  const m = raw.match(/([A-Za-z]+)\s+(\d{4})/);
  if (!m) return null;
  const mon = m[1].slice(0, 3);
  const yr  = m[2].slice(2);
  return `${mon} '${yr}`;
};

const dateSort = (a, b) => {
  const parse = s => {
    const p = s.split(" '");
    if (p.length < 2) return 0;
    return parseInt("20" + p[1]) * 12 + (MONTH_ORDER[p[0]] || 0);
  };
  return parse(a) - parse(b);
};

const parseHistoricalText = (text, currentStocks, currentAssets) => {
  if (!text.trim()) return null;
  try {
    const lines = text.trim().split("\n").filter(l => l.trim());
    const byDate = {};   // { dateKey: { btc, gold, house, mortgage } }
    const todayVals = {};

    for (const line of lines) {
      const segs = line.split("|").map(s => s.trim()).filter(Boolean);
      if (segs.length < 2) continue;
      const assetRaw = segs[0].toLowerCase();

      for (let i = 1; i < segs.length; i++) {
        const seg = segs[i];
        // "Oct 2025: $38,000" or "Today: $185,000"
        const m = seg.match(/([A-Za-z]+(?:\s+\d{4})?|Today)[:\s]+\$?([\d,]+)/i);
        if (!m) continue;
        const dk = dateKey(m[1]);
        const val = parseFloat(m[2].replace(/,/g, ""));
        if (!dk) continue;

        const target = dk === "today" ? todayVals : (byDate[dk] = byDate[dk] || {});

        if (assetRaw.includes("btc") || assetRaw.includes("bitcoin")) target.btc = val;
        else if (assetRaw.includes("gold"))                            target.gold = val;
        else if (assetRaw.includes("house"))                           target.house = val;
        else if (assetRaw.includes("mortgage"))                        target.mortgage = val;
      }
    }

    // Build chart points — use constant stocks total for all historical points
    const stocksBase = currentStocks.total;
    const sgatBase   = 100; // minimal SGAT contribution in past

    const historicalPoints = Object.entries(byDate)
      .map(([dk, vals]) => {
        const btc  = vals.btc  || 0;
        const gold = vals.gold || 0;
        let house  = 0;
        if (vals.house && vals.mortgage) house = vals.house - vals.mortgage;
        else if (vals.house) house = vals.house;
        else if (vals.mortgage) house = (currentAssets.find(a => a.name === "House")?.currentValue || 22450);
        const total = btc + gold + house + stocksBase + sgatBase;
        return { week: dk, total, prev: null, _btc: btc, _gold: gold, _house: house };
      })
      .sort((a, b) => dateSort(a.week, b.week));

    // Add prev references
    for (let i = 1; i < historicalPoints.length; i++) {
      historicalPoints[i].prev = historicalPoints[i - 1].total;
    }

    // Handle today values → update current asset state
    const assetUpdates = {};
    if (todayVals.house && todayVals.mortgage) {
      assetUpdates.houseEquity = todayVals.house - todayVals.mortgage;
    } else if (todayVals.house) {
      assetUpdates.houseRaw = todayVals.house;
    }
    if (todayVals.btc)  assetUpdates.btc  = todayVals.btc;
    if (todayVals.gold) assetUpdates.gold = todayVals.gold;

    return { historicalPoints, assetUpdates };
  } catch(e) {
    console.error("Historical parse error:", e);
    return null;
  }
};

// ────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ────────────────────────────────────────────────────────────
export default function GATControlRoom() {
  // ── Mobile detection ─────────────────────────────────────
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  // ── UI state ──────────────────────────────────────────────
  const [tab,          setTab]         = useState("overview");
  const [copied,       setCopied]      = useState(false);
  const [updateStatus, setUpdateStatus] = useState(null);

  // ── Paste zone state (localStorage persisted) ─────────────
  const [sgat, setSgat] = useState(() => localStorage.getItem("gat_sgat") || "");
  const [stk,  setStk]  = useState(() => localStorage.getItem("gat_stk")  || "");
  const [ast,  setAst]  = useState(() => localStorage.getItem("gat_ast")  || "");
  const [hist, setHist] = useState(() => localStorage.getItem("gat_hist") || "");

  useEffect(() => { localStorage.setItem("gat_sgat", sgat); }, [sgat]);
  useEffect(() => { localStorage.setItem("gat_stk",  stk);  }, [stk]);
  useEffect(() => { localStorage.setItem("gat_ast",  ast);  }, [ast]);
  useEffect(() => { localStorage.setItem("gat_hist", hist); }, [hist]);

  // ── Dashboard data (localStorage persisted) ───────────────
  const [sgatData,   setSgatData]   = useState(() => safeGet("gat_sgatData",   DEFAULT_SGAT));
  const [stocksData, setStocksData] = useState(() => safeGet("gat_stocksData", DEFAULT_STOCKS));
  const [hardAssets, setHardAssets] = useState(() => safeGet("gat_hardAssets", DEFAULT_ASSETS));
  const [perfData,   setPerfData]   = useState(() => safeGet("gat_perfData",   DEFAULT_PERF));
  const [reData,     setReData]     = useState(() => safeGet("gat_reData",     DEFAULT_RE));

  useEffect(() => { safeSet("gat_sgatData",   sgatData);   }, [sgatData]);
  useEffect(() => { safeSet("gat_stocksData", stocksData); }, [stocksData]);
  useEffect(() => { safeSet("gat_hardAssets", hardAssets); }, [hardAssets]);
  useEffect(() => { safeSet("gat_perfData",   perfData);   }, [perfData]);
  useEffect(() => { safeSet("gat_reData",     reData);     }, [reData]);

  // ── Live prices ───────────────────────────────────────────
  // BTC + Gold: CoinGecko (no key). Stocks: Finnhub free key.
  const [quantities,  setQuantities]  = useState(() => safeGet("gat_quantities",  { goldOz: 32.1507, btcAmount: 1 }));
  const [finnhubKey,  setFinnhubKey]  = useState(() => localStorage.getItem("gat_fhkey") || "");
  const [livePrices,  setLivePrices]  = useState(() => safeGet("gat_livePrices",  {}));
  const [dexPrices,   setDexPrices]   = useState({});  // keyed by contract address
  const [priceStatus, setPriceStatus] = useState("idle"); // "loading" | "ok" | "error"

  useEffect(() => { safeSet("gat_quantities", quantities); }, [quantities]);
  useEffect(() => { safeSet("gat_livePrices", livePrices); }, [livePrices]);
  useEffect(() => { try { localStorage.setItem("gat_fhkey", finnhubKey); } catch {} }, [finnhubKey]);

  const fetchPrices = useCallback(async () => {
    setPriceStatus("loading");
    const updates = {};
    // BTC + Gold — CoinGecko, no key needed
    try {
      const r = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,pax-gold&vs_currencies=usd"
      );
      const d = await r.json();
      if (d?.bitcoin?.usd)      updates.btc  = d.bitcoin.usd;
      if (d?.["pax-gold"]?.usd) updates.gold = d["pax-gold"].usd;
    } catch {}
    // Stocks — Finnhub (free API key from finnhub.io)
    const key = finnhubKey.trim();
    if (key) {
      for (const h of stocksData.holdings) {
        try {
          const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${h.ticker}&token=${key}`);
          const d = await r.json();
          if (d?.c > 0) updates[h.ticker] = d.c;
        } catch {}
      }
    }
    if (Object.keys(updates).length > 0) {
      setLivePrices(prev => ({ ...prev, ...updates, lastFetch: Date.now() }));
      setPriceStatus("ok");
    } else {
      setPriceStatus("error");
    }
  }, [finnhubKey, stocksData.holdings]);

  useEffect(() => {
    fetchPrices();
    const id = setInterval(fetchPrices, 60000);
    return () => clearInterval(id);
  }, [fetchPrices]);

  // ── Auto-fetch SGAT fleet from Google Drive ───────────────
  const FLEET_URL = "https://docs.google.com/document/d/1gDBKZqLP6szncoKh4E5LD2p7LYCVly8gB0yqwfhqvYA/export?format=txt";
  const sgatDataRef = useRef(sgatData);
  useEffect(() => { sgatDataRef.current = sgatData; }, [sgatData]);

  const [fleetStatus,      setFleetStatus]      = useState("idle"); // "idle"|"loading"|"ok"|"error"
  const [fleetLastFetched, setFleetLastFetched] = useState(null);

  const fetchFleetData = useCallback(async () => {
    setFleetStatus("loading");
    try {
      const r = await fetch(FLEET_URL, { cache: "no-store" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const text = await r.text();
      const parsed = parseSGATReport(text, sgatDataRef.current);
      if (parsed) {
        setSgatData(parsed);
        setFleetLastFetched(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }));
        setFleetStatus("ok");
      } else {
        setFleetStatus("error");
      }
    } catch (e) {
      console.error("Fleet fetch error:", e);
      setFleetStatus("error");
    }
  }, []); // stable — reads sgatData via ref

  useEffect(() => {
    fetchFleetData();
    const id = setInterval(fetchFleetData, 60000);
    return () => clearInterval(id);
  }, [fetchFleetData]);

  // ── DexScreener live price fetch for held tokens with zero current price ──
  useEffect(() => {
    const addrs = sgatData.agents
      .map(a => a.position?.address)
      .filter(a => a && a.length > 10);
    if (addrs.length === 0) return;
    let cancelled = false;
    Promise.all(addrs.map(addr =>
      fetch(`https://api.dexscreener.com/latest/dex/tokens/${addr}`, { cache: "no-store" })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          const price = data?.pairs?.[0]?.priceUsd ? parseFloat(data.pairs[0].priceUsd) : null;
          return { addr, price };
        })
        .catch(() => ({ addr, price: null }))
    )).then(results => {
      if (cancelled) return;
      const next = {};
      results.forEach(({ addr, price }) => { if (price != null) next[addr] = price; });
      if (Object.keys(next).length > 0) setDexPrices(prev => ({ ...prev, ...next }));
    });
    return () => { cancelled = true; };
  }, [sgatData.agents]);

  // ── Live stocks (computed from share counts × live prices) ─
  const liveStocksData = useMemo(() => {
    const holdings = stocksData.holdings.map(h => {
      const lp    = livePrices[h.ticker];
      const value = lp && h.shares > 0 ? h.shares * lp : h.value;
      return { ...h, value };
    });
    const total = holdings.reduce((s, h) => s + h.value, 0);
    return {
      ...stocksData,
      total,
      holdings: total > 0
        ? holdings.map(h => ({ ...h, actual: parseFloat(((h.value / total) * 100).toFixed(1)) }))
        : holdings,
    };
  }, [stocksData, livePrices]);

  // ── Computed totals ───────────────────────────────────────
  const goldStored = hardAssets.find(a => a.name === "Gold")    ?.currentValue ?? 18500;
  const btcStored  = hardAssets.find(a => a.name === "Bitcoin") ?.currentValue ?? 42300;
  // Use live price × quantity when both are available, else stored value
  const goldVal   = quantities.goldOz > 0 && livePrices.gold
    ? Math.round(quantities.goldOz * livePrices.gold)
    : goldStored;
  const btcVal    = quantities.btcAmount > 0 && livePrices.btc
    ? Math.round(quantities.btcAmount * livePrices.btc)
    : btcStored;
  const netEquity = reData.houseValue - reData.mortgageRemaining;
  const ibkrCash  = stocksData.ibkrCash ?? 265;
  const nw        = liveStocksData.total + ibkrCash + goldVal + btcVal + netEquity + sgatData.deployed;

  const lastTwo  = perfData.slice(-2);
  const wkChg    = lastTwo.length >= 2 ? nw - lastTwo[0].total : 0;
  const wkChgPct = lastTwo.length >= 2 ? ((wkChg / lastTwo[0].total) * 100) : 0;

  // ── Overall gain (vs total cost basis) ───────────────────
  const goldCostBasis  = hardAssets.find(a => a.name === "Gold")?.costBasis    ?? 111300;
  const btcCostBasis   = hardAssets.find(a => a.name === "Bitcoin")?.costBasis ?? 68800;
  const totalCostBasis = goldCostBasis + btcCostBasis;
  const investmentGain = (goldVal - goldCostBasis) + (btcVal - btcCostBasis) + sgatData.pnl;
  const investmentGainPct = totalCostBasis > 0 ? (investmentGain / totalCostBasis) * 100 : 0;

  const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  // ── Signal state (persisted) ─────────────────────────────


  // ── ATLAS Weekly Signal state ───────────────────────────────
  const [awsSignal, setAwsSignal] = useState(() => {
    try { return localStorage.getItem("aws_weekly_signal") || ""; } catch { return ""; }
  });
  const [awsSaved,  setAwsSaved]  = useState(false);

  // ── System Check state ────────────────────────────────────
  const [sysCheckData, setSysCheckData] = useState(() => safeGet("gat_syscheck", { timestamp: "", passed: 0, warnings: 0, failed: 0, status: "" }));
  const [sysRaw,       setSysRaw]       = useState(() => localStorage.getItem("gat_sysraw") || "");
  useEffect(() => { safeSet("gat_syscheck", sysCheckData); }, [sysCheckData]);
  useEffect(() => { try { localStorage.setItem("gat_sysraw", sysRaw); } catch {} }, [sysRaw]);

  // ── Auto-fetch check_results.json from Google Drive ───────
  // FILE_ID set once after running ~/sgat/sync_check_to_drive.js on the Mac Mini
  const CHECK_RESULTS_DRIVE_ID = '1FEnlk1wK45An9zIjXBWujpYAM3h4iU-_xgxTC-2u7bY';
  // checkResultsUrl is now handled inside fetchCheckResults with fallback logic

  const parseCheckText = (text) => {
    const passedM   = text.match(/PASSED[:\s]+(\d+)/i);
    const failedM   = text.match(/FAILED[:\s]+(\d+)/i);
    const warningsM = text.match(/WARNINGS?[:\s]+(\d+)/i);
    if (!passedM) return null;
    const passed   = parseInt(passedM[1]);
    const failed   = failedM   ? parseInt(failedM[1])   : 0;
    const warnings = warningsM ? parseInt(warningsM[1]) : 0;
    const status   = failed > 0 ? "FAILURES" : warnings > 0 ? "WARNINGS" : passed > 0 ? "ALL SYSTEMS GO" : "Awaiting check data";
    const tsM = text.match(/TIMESTAMP[:\s]+([^\n]+)/i);
    const ts  = tsM ? new Date(tsM[1].trim()).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    return { passed, warnings, failed, status, timestamp: ts };
  };

  const fetchCheckResults = useCallback(async () => {
    const FILE_ID   = CHECK_RESULTS_DRIVE_ID;
    const urlsToTry = [
      // Docs export — works if file is a Google Doc
      `https://docs.google.com/document/d/${FILE_ID}/export?format=txt`,
      // Direct download — works for regular Drive files (may need CORS)
      `https://drive.google.com/uc?export=download&id=${FILE_ID}`,
    ];
    for (const url of urlsToTry) {
      try {
        console.log("[GAT syscheck] Trying:", url);
        const r = await fetch(url, { cache: "no-store" });
        console.log("[GAT syscheck] HTTP", r.status, "from", url);
        if (!r.ok) { console.warn("[GAT syscheck] Not OK, trying next"); continue; }
        const text = await r.text();
        console.log("[GAT syscheck] Response (first 120 chars):", text.slice(0, 120));
        const parsed = parseCheckText(text);
        if (!parsed) { console.warn("[GAT syscheck] No PASSED line found in response"); continue; }
        console.log("[GAT syscheck] Parsed:", parsed);
        setSysCheckData(parsed);
        return; // success
      } catch(e) {
        console.warn("[GAT syscheck] Fetch error for", url, "—", e.message);
      }
    }
    console.error("[GAT syscheck] All URLs failed — counters staying at last known value");
  }, [CHECK_RESULTS_DRIVE_ID]);

  useEffect(() => {
    fetchCheckResults();
    const id = setInterval(fetchCheckResults, 5 * 60 * 1000); // every 5 min
    return () => clearInterval(id);
  }, [fetchCheckResults]);

  // ── Daily snapshot — store one NW data point per day ─────
  useEffect(() => {
    if (!nw || nw <= 0) return;
    const todayLabel = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const stored = safeGet("gat_daily_snapshots", []);
    const alreadyToday = stored.some(s => s.week === todayLabel);
    if (!alreadyToday) {
      const prev = stored.length > 0 ? stored[stored.length - 1].total : null;
      const next = [...stored, { week: todayLabel, total: nw, prev }];
      // Keep last 90 days max
      const trimmed = next.slice(-90);
      safeSet("gat_daily_snapshots", trimmed);
      // Merge into perfData so chart updates
      setPerfData(prev => {
        const existing = new Set(prev.map(p => p.week));
        const newPts = trimmed.filter(p => !existing.has(p.week));
        return newPts.length > 0 ? [...prev, ...newPts] : prev;
      });
    }
  }, [nw]);

  // ── TOM Project state ─────────────────────────────────────
  const [tomData, setTomData] = useState(() => safeGet("gat_tom", {
    status: "planning",
    notes: "",
    milestones: [
      { id: 1, label: "Define briefing format", done: true },
      { id: 2, label: "Build data pipeline", done: false },
      { id: 3, label: "Dry run with wife", done: false },
      { id: 4, label: "Daily automation live", done: false },
    ]
  }));
  useEffect(() => { safeSet("gat_tom", tomData); }, [tomData]);

  // ── Apply Update ──────────────────────────────────────────
  const applyUpdate = useCallback(() => {
    let anySuccess = false;
    let anyError   = false;

    let newSgat   = sgatData;
    let newStocks = stocksData;
    let newAssets = hardAssets;

    if (sgat.trim()) {
      const parsed = parseSGATReport(sgat, sgatData);
      if (parsed) { newSgat = parsed;   anySuccess = true; }
      else          anyError = true;
    }
    if (stk.trim()) {
      const parsed = parseStocksReport(stk, stocksData);
      if (parsed) { newStocks = parsed; anySuccess = true; }
      else          anyError = true;
    }
    if (ast.trim()) {
      const parsed = parseAssetsReport(ast, hardAssets);
      if (parsed) { newAssets = parsed; anySuccess = true; }
      else          anyError = true;
    }

    // Compute new net worth using live prices where available
    const newGoldStored = newAssets.find(a => a.name === "Gold")   ?.currentValue ?? goldVal;
    const newBtcStored  = newAssets.find(a => a.name === "Bitcoin")?.currentValue ?? btcVal;
    const newGold   = quantities.goldOz > 0 && livePrices.gold ? Math.round(quantities.goldOz * livePrices.gold) : newGoldStored;
    const newBtc    = quantities.btcAmount > 0 && livePrices.btc ? Math.round(quantities.btcAmount * livePrices.btc) : newBtcStored;
    const newEquity = reData.houseValue - reData.mortgageRemaining;
    // For stocks, use live prices × shares if available
    const newStocksTotal = newStocks.holdings.reduce((s, h) => {
      const lp = livePrices[h.ticker];
      return s + (lp && h.shares > 0 ? h.shares * lp : h.value);
    }, 0);
    const newNW = newStocksTotal + newGold + newBtc + newEquity + newSgat.deployed;

    // Add today's data point to perf chart
    const todayKey  = new Date().toLocaleDateString("en-US", { month: "short", year: "2-digit" }).replace(" ", " '");
    const lastPoint = perfData[perfData.length - 1];
    if (!lastPoint || lastPoint.total !== newNW) {
      const newPoint = { week: todayKey, total: newNW, prev: lastPoint?.total ?? null };
      const filtered = perfData.filter(p => p.week !== todayKey);
      setPerfData([...filtered, newPoint]);
    }

    setSgatData(newSgat);
    setStocksData(newStocks);
    setHardAssets(newAssets);

    setUpdateStatus(anyError && !anySuccess ? "error" : "success");
    setTimeout(() => setUpdateStatus(null), 4000);
  }, [sgat, stk, ast, sgatData, stocksData, hardAssets, perfData, goldVal, btcVal, reData]);

  // ── Historical data watcher ───────────────────────────────
  const applyHistorical = useCallback(() => {
    if (!hist.trim()) return;
    const result = parseHistoricalText(hist, stocksData, hardAssets);
    if (!result) return;

    const { historicalPoints, assetUpdates } = result;

    // Merge historical with existing perf data
    if (historicalPoints.length > 0) {
      const existKeys = new Set(historicalPoints.map(p => p.week));
      // Keep existing points that aren't being replaced, plus always keep the latest real point
      const kept = perfData.filter(p => !existKeys.has(p.week));
      const merged = [...historicalPoints, ...kept].sort((a, b) => dateSort(a.week, b.week));
      // Rebuild prev
      for (let i = 0; i < merged.length; i++) {
        merged[i].prev = i > 0 ? merged[i - 1].total : null;
      }
      setPerfData(merged);
    }

    // Apply any today-value asset updates
    if (Object.keys(assetUpdates).length > 0) {
      setHardAssets(prev => prev.map(a => {
        if (a.name === "House" && assetUpdates.houseEquity != null)
          return { ...a, currentValue: assetUpdates.houseEquity };
        if (a.name === "House" && assetUpdates.houseRaw != null)
          return { ...a, currentValue: assetUpdates.houseRaw };
        if (a.name === "Gold"    && assetUpdates.gold != null)
          return { ...a, currentValue: assetUpdates.gold };
        if (a.name === "Bitcoin" && assetUpdates.btc  != null)
          return { ...a, currentValue: assetUpdates.btc };
        return a;
      }));
    }
  }, [hist, stocksData, hardAssets, perfData]);

  // ── Generate briefing ─────────────────────────────────────
  const genBriefing = () => {
    const lines = [
      `📊 GAT WEEKLY BRIEFING — ${today}`,
      "═".repeat(42),
      "",
      "EMPIRE",
      `  Total Net Worth : ${fmt(nw)}`,
      `  Week Change     : ${wkChg >= 0 ? "+" : ""}${fmt(wkChg)} (${fmtP(wkChgPct)})`,
      `  Phase           : 1 of 4`,
      "",
      "SGAT — CHARLIE",
      `  Deployed : ${fmt(sgatData.deployed)}`,
      `  P&L      : ${sgatData.pnl >= 0 ? "+" : ""}${fmt(sgatData.pnl)} (${sgatData.pnlPct >= 0 ? "+" : ""}${sgatData.pnlPct}%)`,
      `  Trades   : ${sgatData.trades}`,
      "",
      `STOCKS — ${fmt(liveStocksData.total)}`,
      ...liveStocksData.holdings.map(s =>
        `  ${s.ticker.padEnd(5)} ${fmt(s.value).padStart(8)}  ${s.shares}sh  T:${s.target}%  A:${s.actual}%  ${s.weekChange >= 0 ? "+" : ""}${s.weekChange}% wk`
      ),
      "",
      "HARD ASSETS",
      ...hardAssets.map(a =>
        `  ${a.name.padEnd(8)} ${fmt(a.currentValue)}  ${a.changePct >= 0 ? "+" : ""}${a.changePct.toFixed(1)}%`
      ),
      "",
      "─".repeat(42),
      "PASTE INTO ATLAS → GET WEEKLY SIGNAL",
    ];
    navigator.clipboard.writeText(lines.join("\n")).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  // ── Tabs ──────────────────────────────────────────────────
  const tabs = [
    { id: "overview", icon: "◉",  label: "Overview" },
    { id: "sgat",     icon: "⚡", label: "SGAT"     },
    { id: "stocks",   icon: "📈", label: "Stocks"   },
    { id: "assets",   icon: "🏛️", label: "Assets"   },
    { id: "tom",      icon: "🔮", label: "TOM"      },
    { id: "mgat",     icon: "🔒", label: "MGAT"     },
    { id: "update",   icon: "📋", label: "Update"   },
  ];

  // ── Responsive helpers ────────────────────────────────────
  const pad  = isMobile ? "16px 14px 48px" : "20px 20px 48px";
  const g2   = isMobile ? "1fr" : "1fr 1fr";
  const g3   = isMobile ? "1fr 1fr" : "1fr 1fr 1fr";
  const kpiSize = isMobile ? 20 : 22;

  // ── RENDER ────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.textPrimary, fontFamily: sans }}>
      <style>{`
        @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:0.35} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: ${C.bg}; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 2px; }
        textarea::placeholder { color: ${C.textMuted}; font-family: ${mono}; font-size: 12px; }
        button { cursor: pointer; transition: opacity 0.2s; }
        button:hover { opacity: 0.85; }
        input, textarea { -webkit-tap-highlight-color: transparent; }
        @media (max-width: 639px) {
          .tab-label-text { display: none; }
        }
      `}</style>

      {/* ── STICKY HEADER ── */}
      <div style={{ position: "sticky", top: 0, zIndex: 100,
        background: C.bg + "F2", backdropFilter: "blur(16px)",
        borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 880, margin: "0 auto", padding: "0 14px" }}>

          {/* Top row */}
          <div style={{ display: "flex", alignItems: "center",
            justifyContent: "space-between", height: isMobile ? 50 : 58 }}>
            {/* Logo */}
            <svg viewBox="20 58 397 145" style={{ height: isMobile ? 48 : 60, width: "auto", flexShrink: 0 }} xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="ll_gg" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#00E676"/>
                  <stop offset="100%" stopColor="#00C853"/>
                </linearGradient>
                <linearGradient id="ll_bg" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00E676"/>
                  <stop offset="100%" stopColor="#00C853"/>
                </linearGradient>
                <filter id="ll_bf" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur"/>
                  <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
                <filter id="ll_af" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur"/>
                  <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
              </defs>
              {/* Icon square */}
              <rect x="22" y="62" width="90" height="90" rx="10" fill="#212121"/>
              <rect x="22" y="62" width="90" height="90" rx="10" fill="none" stroke="#00E676" strokeWidth="1" opacity="0.3"/>
              <rect x="36" y="116" width="13" height="22" rx="2" fill="#00C853" opacity="0.4"/>
              <rect x="56" y="101" width="13" height="37" rx="2" fill="#00E676" opacity="0.65"/>
              <rect x="76" y="84" width="13" height="54" rx="2" fill="url(#ll_bg)" filter="url(#ll_bf)"/>
              <polyline points="70,78 83,66 96,78" fill="none" stroke="#00E676" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" filter="url(#ll_af)"/>
              <line x1="83" y1="66" x2="83" y2="82" stroke="#00E676" strokeWidth="2.5" strokeLinecap="round" filter="url(#ll_af)"/>
              {/* G */}
              <rect x="122" y="62" width="90" height="90" rx="10" fill="#212121"/>
              <rect x="122" y="62" width="90" height="90" rx="10" fill="none" stroke="#00E676" strokeWidth="1" opacity="0.12"/>
              <rect x="135" y="75" width="13" height="64" rx="4" fill="url(#ll_gg)"/>
              <rect x="135" y="75" width="64" height="13" rx="4" fill="url(#ll_gg)"/>
              <rect x="135" y="126" width="64" height="13" rx="4" fill="url(#ll_gg)"/>
              <rect x="164" y="101" width="35" height="12" rx="4" fill="url(#ll_gg)"/>
              <rect x="186" y="101" width="13" height="38" rx="4" fill="url(#ll_gg)"/>
              {/* A */}
              <rect x="222" y="62" width="90" height="90" rx="10" fill="#212121"/>
              <rect x="222" y="62" width="90" height="90" rx="10" fill="none" stroke="#00E676" strokeWidth="1" opacity="0.12"/>
              <rect x="235" y="75" width="13" height="64" rx="4" fill="url(#ll_gg)"/>
              <rect x="286" y="75" width="13" height="64" rx="4" fill="url(#ll_gg)"/>
              <rect x="235" y="75" width="64" height="13" rx="4" fill="url(#ll_gg)"/>
              <rect x="235" y="101" width="64" height="12" rx="4" fill="url(#ll_gg)"/>
              {/* T */}
              <rect x="322" y="62" width="90" height="90" rx="10" fill="#212121"/>
              <rect x="322" y="62" width="90" height="90" rx="10" fill="none" stroke="#00E676" strokeWidth="1" opacity="0.12"/>
              <rect x="335" y="75" width="64" height="13" rx="4" fill="url(#ll_gg)"/>
              <rect x="361" y="75" width="13" height="64" rx="4" fill="url(#ll_gg)"/>
              {/* Tagline */}
              <line x1="22" y1="162" x2="412" y2="162" stroke="#00E676" strokeWidth="0.5" opacity="0.3"/>
              <text x="22" y="195" fontFamily="'Courier New', monospace" fontSize="28" textLength="390" lengthAdjust="spacingAndGlyphs" fill="#00E676" opacity="0.75">GROWTH AUTONOMOUS TRADING</text>
            </svg>

            {/* Net worth */}
            <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 16 }}>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700, color: C.white,
                  fontFamily: mono, letterSpacing: "-0.03em", margin: 0 }}>{fmt(nw)}</p>
                <p style={{ fontSize: isMobile ? 10 : 12, color: C.greenText, fontFamily: sans, margin: "1px 0 0" }}>
                  {wkChg === 0 ? "Empire total" : `${wkChg >= 0 ? "+" : ""}${fmt(Math.abs(wkChg))} this week`}
                </p>
                <p style={{ fontSize: isMobile ? 10 : 11, fontFamily: mono, margin: "1px 0 0",
                  color: investmentGain >= 0 ? C.greenText : C.red }}>
                  {investmentGain >= 0 ? "+" : ""}{fmt(investmentGain)} ({investmentGain >= 0 ? "+" : ""}{investmentGainPct.toFixed(1)}%)
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <Dot /><Badge>Live</Badge>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 0, overflowX: "auto",
            scrollbarWidth: "none", msOverflowStyle: "none" }}>
            {tabs.map(t => {
              const active = tab === t.id;
              return (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: isMobile ? "8px 12px" : "9px 16px",
                  background: "transparent", border: "none",
                  borderBottom: `2px solid ${active ? C.green : "transparent"}`,
                  color: active ? C.green : C.textMuted,
                  fontSize: 13, fontWeight: active ? 600 : 500,
                  fontFamily: sans, whiteSpace: "nowrap",
                  transition: "all 0.2s", flexShrink: 0
                }}>
                  <span style={{ fontSize: 13 }}>{t.icon}</span>
                  <span className="tab-label-text">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── MAIN ── */}
      <div style={{ maxWidth: 880, margin: "0 auto", padding: pad, animation: "fadeUp 0.3s ease" }}>

        {/* ═══════════ OVERVIEW ═══════════ */}
        {tab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Empire chart */}
            <Card highlight>
              <SHead icon="📈" title="Empire Performance — All Assets Combined" right={
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {wkChg !== 0 && <Badge color={C.greenText}>{fmtP(wkChgPct)} this week</Badge>}
                  <Badge color={investmentGain >= 0 ? C.greenText : C.red}>
                    Overall: {fmtP(investmentGainPct)}
                  </Badge>
                </div>
              } />
              <BigNum color={C.greenText} size={isMobile ? 26 : 32}>{fmt(nw)}</BigNum>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 4 }}>
                <Body color={C.textMuted} size={12}>Stocks + Gold + BTC + House equity + SGAT</Body>
                <Body color={investmentGain >= 0 ? C.greenText : C.red} size={12}>
                  {investmentGain >= 0 ? "▲" : "▼"} {investmentGain >= 0 ? "+" : ""}{fmt(Math.abs(investmentGain))} vs cost basis
                </Body>
              </div>
              <div style={{ marginTop: 20 }}>
                <ResponsiveContainer width="100%" height={isMobile ? 140 : 170}>
                  <AreaChart data={perfData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={C.green} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={C.green} stopOpacity={0}   />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="week"
                      tick={{ fill: C.textMuted, fontSize: isMobile ? 9 : 11, fontFamily: sans }}
                      axisLine={false} tickLine={false}
                      interval={isMobile ? "preserveStartEnd" : 0}
                    />
                    <YAxis tickFormatter={fmtK}
                      tick={{ fill: C.textMuted, fontSize: isMobile ? 9 : 11, fontFamily: sans }}
                      axisLine={false} tickLine={false} width={isMobile ? 40 : 48}
                    />
                    <Tooltip content={<ChartTip />} />
                    <Area type="monotone" dataKey="total"
                      stroke={C.green} strokeWidth={2.5}
                      fill="url(#grad)"
                      dot={{ fill: C.green, r: isMobile ? 3 : 5, strokeWidth: 0 }}
                      activeDot={{ fill: C.green, r: isMobile ? 5 : 7, strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              {/* Period badges */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                {perfData.map((p, i) => {
                  const prev  = i > 0 ? perfData[i - 1].total : null;
                  const delta = prev ? ((p.total - prev) / prev * 100).toFixed(1) : null;
                  return (
                    <div key={i} style={{ padding: "4px 10px",
                      background: !delta ? C.surfaceAlt : delta > 0 ? C.greenDim : C.redDim,
                      borderRadius: 6, fontSize: 11, fontFamily: sans,
                      color: !delta ? C.textMuted : delta > 0 ? C.greenText : C.red }}>
                      {p.week}{delta ? ` · ${delta > 0 ? "+" : ""}${delta}%` : " · baseline"}
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Phase */}
            <Card>
              <SHead icon="🏛️" title="Empire Phase" />
              <Phases current={1} isMobile={isMobile} />
            </Card>

            {/* 4 KPIs */}
            <div style={{ display: "grid", gridTemplateColumns: g2, gap: 14 }}>
              <Card style={{ background: sgatData.pnl >= 0 ? C.greenDim : C.redDim, border: `1px solid ${sgatData.pnl >= 0 ? C.green : C.red}20` }}>
                <SLabel>SGAT P&L</SLabel>
                <BigNum color={sgatData.pnl >= 0 ? C.greenText : C.red} size={kpiSize}>
                  {sgatData.pnl >= 0 ? "+" : ""}{fmt(sgatData.pnl)}
                </BigNum>
                <Body size={12} color={sgatData.pnl >= 0 ? C.greenDeep : C.red}>
                  {sgatData.pnl >= 0 ? "+" : ""}{sgatData.pnlPct}% on {fmt(sgatData.deployed)}
                </Body>
              </Card>
              <Card>
                <SLabel>Stock Portfolio</SLabel>
                <BigNum size={kpiSize}>{fmt(liveStocksData.total + ibkrCash)}</BigNum>
                <Body size={12} color={C.textMuted}>incl. {fmt(ibkrCash)} cash</Body>
              </Card>
              <Card>
                <SLabel>Gold + BTC</SLabel>
                <BigNum size={kpiSize}>{fmt(goldVal + btcVal)}</BigNum>
                <Body size={12}>Long term hold — no sell</Body>
              </Card>
              <Card>
                <SLabel>House Equity</SLabel>
                <BigNum size={kpiSize}>{fmt(netEquity)}</BigNum>
                <Body size={12} color={C.greenText}>Net — mortgage deducted</Body>
              </Card>
            </div>

            {/* ── Live Market Snapshot (auto-fetched from fleet report) ── */}
            {sgatData.agents.length > 0 && (
              <Card style={{ border: `1px solid ${C.green}30` }}>
                <SHead icon="🌐" title="Market Snapshot" right={
                  fleetLastFetched
                    ? <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Dot color={C.green} />
                        <span style={{ fontSize: 11, color: C.greenText, fontFamily: sans }}>Live · {fleetLastFetched}</span>
                      </div>
                    : <Badge color={C.textMuted}>Fetching…</Badge>
                } />
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 10 }}>
                  {/* SGAT Fleet Total */}
                  <div style={{ background: C.surfaceAlt, borderRadius: 10, padding: "10px 14px" }}>
                    <p style={{ fontSize: 10, color: C.textMuted, fontFamily: sans, letterSpacing: "0.07em",
                      textTransform: "uppercase", margin: "0 0 4px" }}>SGAT Fleet</p>
                    <p style={{ fontSize: 17, fontWeight: 700, color: C.white, fontFamily: mono, margin: 0 }}>
                      {sgatData.fleetTotal != null ? fmt(sgatData.fleetTotal) : fmt(sgatData.deployed)}
                    </p>
                    <p style={{ fontSize: 10, color: C.greenText, fontFamily: sans, margin: "2px 0 0" }}>● Live</p>
                  </div>
                  {/* Regime */}
                  {sgatData.macro?.regime && (
                    <div style={{ background: C.surfaceAlt, borderRadius: 10, padding: "10px 14px" }}>
                      <p style={{ fontSize: 10, color: C.textMuted, fontFamily: sans, letterSpacing: "0.07em",
                        textTransform: "uppercase", margin: "0 0 4px" }}>Regime</p>
                      <p style={{ fontSize: 17, fontWeight: 700, fontFamily: mono, margin: 0,
                        color: sgatData.macro.regime === "FEAR" ? C.red
                          : sgatData.macro.regime === "GREED" ? C.greenText : C.yellow }}>
                        {sgatData.macro.regime}
                      </p>
                      <p style={{ fontSize: 10, color: C.greenText, fontFamily: sans, margin: "2px 0 0" }}>● Live</p>
                    </div>
                  )}
                  {/* F&G */}
                  {sgatData.macro?.fg != null && (
                    <div style={{ background: C.surfaceAlt, borderRadius: 10, padding: "10px 14px" }}>
                      <p style={{ fontSize: 10, color: C.textMuted, fontFamily: sans, letterSpacing: "0.07em",
                        textTransform: "uppercase", margin: "0 0 4px" }}>Fear & Greed</p>
                      <p style={{ fontSize: 17, fontWeight: 700, fontFamily: mono, margin: 0,
                        color: sgatData.macro.fg < 30 ? C.red : sgatData.macro.fg > 60 ? C.greenText : C.yellow }}>
                        {sgatData.macro.fg}
                      </p>
                      <p style={{ fontSize: 10, color: C.greenText, fontFamily: sans, margin: "2px 0 0" }}>● Live</p>
                    </div>
                  )}
                  {/* BTC Price */}
                  {sgatData.macro?.btcPrice != null && (
                    <div style={{ background: C.surfaceAlt, borderRadius: 10, padding: "10px 14px" }}>
                      <p style={{ fontSize: 10, color: C.textMuted, fontFamily: sans, letterSpacing: "0.07em",
                        textTransform: "uppercase", margin: "0 0 4px" }}>BTC Price</p>
                      <p style={{ fontSize: 17, fontWeight: 700, color: C.white, fontFamily: mono, margin: 0 }}>
                        {fmt(sgatData.macro.btcPrice)}
                      </p>
                      <p style={{ fontSize: 10, color: C.greenText, fontFamily: sans, margin: "2px 0 0" }}>● Live</p>
                    </div>
                  )}
                </div>
                {sgatData.lastUpdated && (
                  <p style={{ fontSize: 11, color: C.textMuted, fontFamily: mono, margin: "10px 0 0" }}>
                    Report timestamp: {sgatData.lastUpdated}
                  </p>
                )}
              </Card>
            )}

            {/* Empire Allocation */}
            {(() => {
              const segments = [
                { label: "Gold",       value: goldVal,              color: "#F59E0B" },
                { label: "BTC",        value: btcVal,               color: "#F97316" },
                { label: "Stocks",     value: liveStocksData.total + ibkrCash, color: C.green   },
                { label: "SGAT",       value: sgatData.deployed,    color: C.yellow  },
                { label: "House",      value: netEquity,            color: "#60A5FA" },
                { label: "MGAT",       value: 0,                    color: C.textMuted },
              ];
              const total = segments.reduce((s, x) => s + x.value, 0) || 1;
              return (
                <Card>
                  <SHead icon="🌐" title="Empire Allocation" right={
                    <span style={{ fontSize: 12, color: C.textMuted, fontFamily: mono }}>{fmt(total)}</span>
                  } />
                  {/* Horizontal stacked bar */}
                  <div style={{ display: "flex", height: 10, borderRadius: 6, overflow: "hidden", marginBottom: 16, gap: 1 }}>
                    {segments.filter(s => s.value > 0).map((s, i) => (
                      <div key={i} style={{
                        width: `${(s.value / total) * 100}%`,
                        background: s.color,
                        transition: "width 0.6s ease",
                        minWidth: s.value > 0 ? 2 : 0,
                      }} />
                    ))}
                  </div>
                  {/* Legend rows */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {segments.map((s, i) => {
                      const pct = total > 0 ? ((s.value / total) * 100).toFixed(1) : "0.0";
                      return (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 10, height: 10, borderRadius: 3,
                            background: s.color, flexShrink: 0 }} />
                          <span style={{ flex: 1, fontSize: 13, color: C.textSecondary, fontFamily: sans }}>
                            {s.label}{s.label === "MGAT" ? " 🔒" : ""}
                          </span>
                          <span style={{ fontSize: 13, fontFamily: mono, color: s.value > 0 ? C.textPrimary : C.textMuted }}>
                            {fmt(s.value)}
                          </span>
                          <span style={{ fontSize: 12, fontFamily: mono, color: s.color,
                            minWidth: 44, textAlign: "right" }}>
                            {pct}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              );
            })()}

            {/* Stock Allocation */}
            <Card>
              <SHead icon="📊" title="Stock Allocation" />
              <AllocBar items={stocksData.holdings.map(s => ({ name: s.ticker, pct: s.actual }))} />
            </Card>

            {/* ATLAS Weekly Signal */}
            <Card>
              <SHead icon="📡" title="ATLAS Weekly Signal" />
              {awsSignal.trim()
                ? <pre style={{ fontFamily: mono, fontSize: 12, color: C.textPrimary,
                    whiteSpace: "pre-wrap", wordBreak: "break-word",
                    background: C.surfaceAlt, borderRadius: 10, padding: "14px 16px",
                    border: `1px solid ${C.border}`, margin: 0, lineHeight: 1.6 }}>
                    {awsSignal.trim()}
                  </pre>
                : <Body size={13} color={C.textMuted}>No signal yet — paste from /AWS</Body>
              }
            </Card>

          </div>
        )}

        {/* ═══════════ SGAT ═══════════ */}
        {tab === "sgat" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* KPI row */}
            <div style={{ display: "grid", gridTemplateColumns: g3, gap: 14 }}>
              <Card highlight>
                <SLabel>Fleet Capital</SLabel>
                <BigNum size={kpiSize}>{sgatData.fleetTotal != null ? fmt(sgatData.fleetTotal) : fmt(sgatData.deployed)}</BigNum>
                <Body size={11} color={C.textMuted}>across 14 agents</Body>
              </Card>
              <Card style={{ background: sgatData.pnl >= 0 ? C.greenDim : C.redDim, border: `1px solid ${sgatData.pnl >= 0 ? C.green : C.red}20` }}>
                <SLabel>Total P&L</SLabel>
                <BigNum color={sgatData.pnl >= 0 ? C.greenText : C.red} size={kpiSize}>
                  {sgatData.pnl >= 0 ? "+" : ""}{fmt(sgatData.pnl)}
                </BigNum>
                <Body size={11} color={C.textMuted}>{sgatData.pnlPct >= 0 ? "+" : ""}{sgatData.pnlPct}% return</Body>
              </Card>
              <Card style={{ background: C.greenDim, border: `1px solid ${C.green}30` }}>
                <SLabel>Status</SLabel>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                  <Dot color={C.green} />
                  <p style={{ fontSize: 15, fontWeight: 700, color: C.greenText, fontFamily: sans, margin: 0 }}>Phase 1 — Active</p>
                </div>
              </Card>
            </div>

            {/* Macro card */}
            {sgatData.macro?.regime && (
              <Card style={{ border: `1px solid ${C.yellow}30` }}>
                <SHead icon="🌐" title="Macro Signal"
                  right={fleetLastFetched
                    ? <Badge color={C.greenText}>● Auto-fetched {fleetLastFetched}</Badge>
                    : sgatData.lastUpdated
                      ? <Badge color={C.textMuted}>Updated {sgatData.lastUpdated}</Badge>
                      : <Badge color={C.textMuted}>Fetching…</Badge>} />
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 6 }}>
                  {sgatData.macro.fg != null && (
                    <div style={{ background: C.surfaceAlt, borderRadius: 8, padding: "8px 14px", textAlign: "center" }}>
                      <Body size={11} color={C.textMuted}>Fear & Greed</Body>
                      <p style={{ fontSize: 18, fontWeight: 700, color: sgatData.macro.fg < 30 ? C.red : sgatData.macro.fg > 60 ? C.greenText : C.yellow, fontFamily: mono, margin: 0 }}>{sgatData.macro.fg}</p>
                    </div>
                  )}
                  {sgatData.macro.btcDom != null && (
                    <div style={{ background: C.surfaceAlt, borderRadius: 8, padding: "8px 14px", textAlign: "center" }}>
                      <Body size={11} color={C.textMuted}>BTC Dom</Body>
                      <p style={{ fontSize: 18, fontWeight: 700, color: C.white, fontFamily: mono, margin: 0 }}>{sgatData.macro.btcDom}%</p>
                    </div>
                  )}
                  {sgatData.macro.regime && (
                    <div style={{ background: C.surfaceAlt, borderRadius: 8, padding: "8px 14px", textAlign: "center" }}>
                      <Body size={11} color={C.textMuted}>Regime</Body>
                      <p style={{ fontSize: 16, fontWeight: 700, color: sgatData.macro.regime === "FEAR" ? C.red : sgatData.macro.regime === "GREED" ? C.greenText : C.yellow, fontFamily: mono, margin: 0 }}>{sgatData.macro.regime}</p>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Agent fleet table */}
            <Card>
              <SHead icon="🤖" title="Agent Fleet" right={
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {fleetStatus === "ok"
                    ? <Badge color={C.greenText}>● Live · {fleetLastFetched}</Badge>
                    : fleetStatus === "loading"
                      ? <Badge color={C.textMuted}>⟳ Fetching…</Badge>
                      : fleetStatus === "error"
                        ? <Badge color={C.red}>⚠ Fetch error</Badge>
                        : <Badge color={C.textMuted}>● 10 Active</Badge>
                  }
                  <button
                    onClick={fetchFleetData}
                    disabled={fleetStatus === "loading"}
                    style={{ padding: "3px 10px", background: "none",
                      border: `1px solid ${C.border}`, borderRadius: 6,
                      color: fleetStatus === "loading" ? C.textMuted : C.textSecondary,
                      fontSize: 12, fontFamily: sans, cursor: fleetStatus === "loading" ? "default" : "pointer",
                      opacity: fleetStatus === "loading" ? 0.5 : 1 }}>
                    {fleetStatus === "loading" ? "⟳" : "↻"} Refresh
                  </button>
                </div>
              } />
              {fleetStatus === "error" && (
                <Body size={12} color={C.red} style={{ marginBottom: 12 }}>
                  ⚠ Auto-fetch failed — check network. Retrying every 60 seconds.
                </Body>
              )}
              {fleetStatus === "loading" && !sgatData.lastUpdated && (
                <Body size={12} color={C.textMuted} style={{ marginBottom: 12 }}>
                  ⟳ Loading fleet data from Google Drive…
                </Body>
              )}
              {/* Table header */}
              <div style={{ display: "grid",
                gridTemplateColumns: isMobile ? "1fr 70px 65px" : "1fr 80px 70px 55px 70px",
                gap: 8, padding: "6px 10px", borderBottom: `1px solid ${C.border}`, marginBottom: 4 }}>
                {(isMobile ? ["Agent","Bal","Mode"] : ["Agent","Balance","Status","Trades","P&L"]).map(h => (
                  <p key={h} style={{ fontSize: 10, color: C.textMuted, fontFamily: sans,
                    letterSpacing: "0.07em", textTransform: "uppercase", margin: 0,
                    textAlign: h === "Agent" ? "left" : "right" }}>{h}</p>
                ))}
              </div>
              {(sgatData.agents.length > 0
                ? sgatData.agents
                : ["SGAT_SOL","SGAT_BASE","SGAT_BSC","SGAT_BTCB","SGAT_SUI","SGAT_SOL_N","SGAT_wETH","SGAT_BSC_N","SGAT_SUI_N","SGAT_CASH","SGAT_SOL_BC","SGAT_BASE_BC","SGAT_BSC_BC","SGAT_SUI_BC"].map(n => ({ name: n, status: "", mode: n === "SGAT_CASH" ? "FROZEN" : "—", usdc: n === "SGAT_CASH" ? 119 : 0, trades: 0, pnl: 0, position: null }))
              ).map((ag, i) => {
                const pos = ag.position || null;
                const modeColor = ag.mode === "ABSTAIN" ? C.textMuted : ag.mode === "CANDIDATE_FOUND" ? C.blue : ag.mode === "LONG" || ag.mode === "TRADED" ? C.greenText : ag.mode === "SHORT" ? C.red : C.yellow;
                const balance = pos ? (pos.total_wallet > 0 ? pos.total_wallet : ag.usdc || 0) : (ag.usdc || 0);
                return (
                  <div key={i} style={{
                    background: i % 2 === 0 ? C.surfaceAlt : "transparent",
                    borderRadius: 8, marginBottom: 3,
                    border: pos ? `1px solid ${C.yellow}30` : "none" }}>
                    {/* Main agent row */}
                    <div style={{ display: "grid",
                      gridTemplateColumns: isMobile ? "1fr 70px 65px" : "1fr 80px 70px 55px 70px",
                      gap: 8, padding: "10px 10px" }}>
                      {/* Agent name — on mobile, stacks trades+pnl below */}
                      <div style={{ alignSelf: "center" }}>
                        <p style={{ fontSize: isMobile ? 11 : 13, color: pos ? C.yellow : C.white, fontFamily: mono, margin: 0, fontWeight: 600 }}>{ag.name}</p>
                        {isMobile && (
                          <p style={{ fontSize: 10, color: C.textMuted, fontFamily: mono, margin: "2px 0 0" }}>
                            {ag.trades ?? 0} trades · {(ag.pnl || 0) >= 0 ? "+" : ""}{fmt(ag.pnl || 0)}
                          </p>
                        )}
                      </div>
                      <p style={{ fontSize: isMobile ? 11 : 13, color: C.white, fontFamily: mono, margin: 0, textAlign: "right", alignSelf: "center" }}>${balance.toFixed(2)}</p>
                      <div style={{ textAlign: "right", alignSelf: "center" }}>
                        <p style={{ fontSize: isMobile ? 10 : 11, color: modeColor, fontFamily: sans, margin: 0, fontWeight: 600 }}>{ag.mode}</p>
                        {ag.mode === "CANDIDATE_FOUND" && (
                          <p style={{ fontSize: 9, color: C.textMuted, fontFamily: sans, margin: "1px 0 0",
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>V3.2 — no trade</p>
                        )}
                      </div>
                      {!isMobile && <p style={{ fontSize: 13, color: C.textMuted, fontFamily: mono, margin: 0, textAlign: "right", alignSelf: "center" }}>{ag.trades ?? 0}</p>}
                      {!isMobile && (pos && (pos.pnl_pct !== 0 || pos.unrealized_pnl !== 0) ? (
                        <div style={{ textAlign: "right", alignSelf: "center" }}>
                          <p style={{ fontSize: 12, color: C.yellow, fontFamily: mono, margin: 0, fontWeight: 600 }}>
                            {pos.pnl_pct >= 0 ? "+" : ""}{pos.pnl_pct.toFixed(2)}%
                          </p>
                          <p style={{ fontSize: 10, color: C.yellow + "99", fontFamily: mono, margin: 0 }}>
                            ({pos.unrealized_pnl >= 0 ? "+" : ""}{fmt(pos.unrealized_pnl)})
                          </p>
                        </div>
                      ) : (
                        <p style={{ fontSize: 13, color: (ag.pnl || 0) >= 0 ? C.greenText : C.red, fontFamily: mono, margin: 0, textAlign: "right", alignSelf: "center" }}>
                          {(ag.pnl || 0) >= 0 ? "+" : ""}{fmt(ag.pnl || 0)}
                        </p>
                      ))}
                    </div>
                    {/* Position sub-row — only when a position is open */}
                    {pos && (
                      <div style={{ display: "flex", gap: 16, padding: "4px 10px 8px 10px",
                        borderTop: `1px solid ${C.yellow}20`, flexWrap: "wrap" }}>
                        <p style={{ fontSize: 11, color: C.yellow, fontFamily: mono, margin: 0, fontWeight: 600 }}>{pos.symbol}</p>
                        <p style={{ fontSize: 11, color: C.textMuted, fontFamily: mono, margin: 0 }}>Entry ${pos.entry < 1 ? pos.entry.toFixed(6) : pos.entry.toLocaleString("en-US", { maximumFractionDigits: 2 })}</p>
                        {(() => {
                          const liveP = pos.address ? dexPrices[pos.address] : null;
                          const displayP = liveP ?? (pos.current > 0 ? pos.current : null);
                          return (
                            <p style={{ fontSize: 11, color: liveP ? C.greenText : C.textMuted, fontFamily: mono, margin: 0 }}>
                              Now {displayP != null ? `$${displayP < 1 ? displayP.toFixed(6) : displayP.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : "—"}
                              {liveP && <span style={{ fontSize: 9, color: C.greenText, marginLeft: 3 }}>●</span>}
                            </p>
                          );
                        })()}
                        <p style={{ fontSize: 11, color: C.textMuted, fontFamily: mono, margin: 0 }}>Size ${pos.size.toFixed(0)}</p>
                        {(() => {
                          const liveP = pos.address ? dexPrices[pos.address] : null;
                          const nowPrice = liveP ?? (pos.current > 0 ? pos.current : null);
                          if (!nowPrice || !pos.entry) return null;
                          const pct = ((nowPrice - pos.entry) / pos.entry) * 100;
                          return (
                            <p style={{ fontSize: 11, fontWeight: 600, fontFamily: mono, margin: 0,
                              color: pct >= 0 ? C.greenText : C.red }}>
                              P&L: {pct >= 0 ? "+" : ""}{pct.toFixed(2)}%
                            </p>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                );
              })}
              <Hr />
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px" }}>
                <Body size={12} color={C.textMuted}>Fleet total</Body>
                <p style={{ fontSize: 13, fontWeight: 700, color: C.white, fontFamily: mono, margin: 0 }}>{sgatData.fleetTotal != null ? fmt(sgatData.fleetTotal) : fmt(sgatData.deployed)}</p>
              </div>
              {/* SCAN log row */}
              {sgatData.scan && (
                <>
                  <Hr my={0} />
                  <div style={{ padding: "8px 10px" }}>
                    <p style={{ fontSize: 10, color: C.textMuted, fontFamily: sans,
                      letterSpacing: "0.07em", textTransform: "uppercase", margin: "0 0 6px" }}>
                      Scan log — seen / passed
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {sgatData.scan.map(({ chain, seen, passed }) => (
                        <div key={chain} style={{
                          display: "flex", alignItems: "center", gap: 4,
                          padding: "3px 8px", borderRadius: 6,
                          background: C.surfaceAlt, border: `1px solid ${C.border}`,
                        }}>
                          <span style={{ fontSize: 11, color: C.textSecondary, fontFamily: mono, fontWeight: 600 }}>{chain}</span>
                          <span style={{ fontSize: 11, color: C.textMuted, fontFamily: mono }}>{seen}/</span>
                          <span style={{ fontSize: 11, fontFamily: mono, fontWeight: 700,
                            color: passed > 0 ? C.greenText : C.textMuted }}>{passed}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </Card>

            <Card>
              <SHead icon="⚡" title="Charlie — Reporter" right={<Badge color={C.greenText}>Active</Badge>} />
              <Body size={12} color={C.textMuted}>
                Pure Node.js reporter. 5 daily Telegram reports. No LLM in routine loop.
              </Body>
            </Card>

            {/* ── Performance Card ── */}
            <Card style={{ border: `1px solid ${C.green}30` }}>
              <SHead icon="📊" title="Fleet Performance" right={
                fleetLastFetched
                  ? <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <Dot color={C.green} />
                      <span style={{ fontSize:11, color:C.greenText, fontFamily:sans }}>Live · {fleetLastFetched}</span>
                    </div>
                  : <Badge color={C.textMuted}>Fetching…</Badge>
              } />
              {sgatData.performance ? (
                <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap:10 }}>
                  {/* Total trades */}
                  <div style={{ background:C.surfaceAlt, borderRadius:10, padding:"12px 14px", textAlign:"center" }}>
                    <p style={{ fontSize:10, color:C.textMuted, fontFamily:sans, letterSpacing:"0.07em",
                      textTransform:"uppercase", margin:"0 0 6px" }}>Total Trades</p>
                    <p style={{ fontSize:24, fontWeight:700, color:C.white, fontFamily:mono, margin:0 }}>
                      {sgatData.performance.trades}
                    </p>
                  </div>
                  {/* Win rate */}
                  <div style={{ background:C.surfaceAlt, borderRadius:10, padding:"12px 14px", textAlign:"center" }}>
                    <p style={{ fontSize:10, color:C.textMuted, fontFamily:sans, letterSpacing:"0.07em",
                      textTransform:"uppercase", margin:"0 0 6px" }}>Win Rate</p>
                    <p style={{ fontSize:24, fontWeight:700, fontFamily:mono, margin:0,
                      color: sgatData.performance.winRate == null ? C.textMuted
                        : sgatData.performance.winRate >= 55 ? C.greenText
                        : sgatData.performance.winRate >= 45 ? C.yellow : C.red }}>
                      {sgatData.performance.winRate != null ? `${sgatData.performance.winRate}%` : "—"}
                    </p>
                  </div>
                  {/* Avg P&L */}
                  <div style={{ background:C.surfaceAlt, borderRadius:10, padding:"12px 14px", textAlign:"center" }}>
                    <p style={{ fontSize:10, color:C.textMuted, fontFamily:sans, letterSpacing:"0.07em",
                      textTransform:"uppercase", margin:"0 0 6px" }}>Avg P&L</p>
                    <p style={{ fontSize:24, fontWeight:700, fontFamily:mono, margin:0,
                      color: sgatData.performance.avgPct == null ? C.textMuted
                        : sgatData.performance.avgPct >= 0 ? C.greenText : C.red }}>
                      {sgatData.performance.avgPct != null
                        ? `${sgatData.performance.avgPct >= 0 ? "+" : ""}${sgatData.performance.avgPct}%`
                        : "—"}
                    </p>
                  </div>
                  {/* Streak */}
                  <div style={{ background:C.surfaceAlt, borderRadius:10, padding:"12px 14px", textAlign:"center" }}>
                    <p style={{ fontSize:10, color:C.textMuted, fontFamily:sans, letterSpacing:"0.07em",
                      textTransform:"uppercase", margin:"0 0 6px" }}>Streak</p>
                    <p style={{ fontSize:24, fontWeight:700, fontFamily:mono, margin:0,
                      color: sgatData.performance.streak == null ? C.textMuted
                        : sgatData.performance.streak > 0 ? C.greenText
                        : sgatData.performance.streak < 0 ? C.red : C.textMuted }}>
                      {sgatData.performance.streak != null
                        ? `${sgatData.performance.streak > 0 ? "+" : ""}${sgatData.performance.streak}`
                        : "—"}
                    </p>
                  </div>
                </div>
              ) : (
                <div style={{ background:C.surfaceAlt, border:`1px solid ${C.border}`,
                  borderRadius:10, padding:"18px 16px", textAlign:"center" }}>
                  <p style={{ fontSize:13, color:C.textMuted, fontFamily:sans, margin:0 }}>
                    {fleetStatus === "loading" ? "⟳ Loading performance data…"
                      : fleetStatus === "ok" ? "No trades yet — no PERFORMANCE line in report"
                      : "Waiting for fleet data…"}
                  </p>
                  <p style={{ fontSize:11, color:C.textMuted, fontFamily:mono, margin:"8px 0 0",
                    padding:"6px 10px", background:C.bg, borderRadius:6, display:"inline-block" }}>
                    Expected: PERFORMANCE: X trades | Win X% | Avg X% | Streak +X
                  </p>
                </div>
              )}
            </Card>

            {/* ── Last System Check ── */}
            {(() => {
              const hasLive     = sgatData.agents.length > 0;
              const hasError    = hasLive && sgatData.agents.some(a => ["ERROR","FAILED","ERR"].includes(a.mode?.toUpperCase()));

              // Priority: 1) fleet Drive doc, 2) check_results Drive file, 3) agent error fallback
              const cr = sgatData.checkResults;
              const hasCheckData = !!cr;
              const hasSysData   = sysCheckData.passed > 0 || sysCheckData.failed > 0 || sysCheckData.warnings > 0 || !!sysCheckData.status;

              const displayPassed   = hasCheckData ? cr.passed   : sysCheckData.passed;
              const displayWarnings = hasCheckData ? cr.warnings : sysCheckData.warnings;
              const displayFailed   = hasCheckData ? cr.failed
                : (hasSysData ? sysCheckData.failed
                  : (hasLive && hasError ? sgatData.agents.filter(a => ["ERROR","FAILED","ERR"].includes(a.mode?.toUpperCase())).length : 0));

              const displayStatus = hasCheckData
                ? (cr.failed > 0 ? "FAILURES" : cr.warnings > 0 ? "WARNINGS" : cr.passed > 0 ? "ALL SYSTEMS GO" : "Awaiting check data")
                : (hasSysData ? sysCheckData.status
                  : (hasLive ? (hasError ? "FAILURES" : "Awaiting check data") : "Awaiting check data"));

              const displayTimestamp = hasCheckData
                ? `Last check: ${cr.checkedAt}`
                : (sysCheckData.timestamp ? `Last check: ${sysCheckData.timestamp}` : (fleetLastFetched ? `Fleet: ${fleetLastFetched}` : null));

              return (
            <Card>
              <SHead icon="🔧" title="Last System Check"
                right={displayTimestamp
                  ? <Badge color={hasCheckData ? C.greenText : C.textMuted}>{displayTimestamp}</Badge>
                  : <Badge color={C.textMuted}>No data yet</Badge>}
              />

              {/* Agent health one-liner — Task 3 */}
              {hasLive && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "8px 12px", borderRadius: 8, marginBottom: 12,
                  background: hasError ? C.redDim : C.greenDim,
                  border: `1px solid ${hasError ? C.red : C.green}30`,
                }}>
                  <span style={{ fontSize: 14 }}>{hasError ? "🔴" : "🟢"}</span>
                  <p style={{ fontSize: 13, fontWeight: 600, margin: 0, fontFamily: sans,
                    color: hasError ? C.red : C.greenText }}>
                    {hasError ? "Agent error detected" : "All agents healthy"}
                  </p>
                  {fleetLastFetched && (
                    <span style={{ fontSize: 11, color: C.textMuted, fontFamily: mono, marginLeft: "auto" }}>
                      Last checked: {fleetLastFetched}
                    </span>
                  )}
                </div>
              )}

              {/* Overall status banner */}
              {displayStatus === "ALL SYSTEMS GO" || displayStatus === "WARNINGS" || displayStatus === "FAILURES" ? (
                <div style={{
                  padding: "10px 14px", marginBottom: 14, borderRadius: 10,
                  background: displayStatus === "ALL SYSTEMS GO" ? C.greenDim
                    : displayStatus === "WARNINGS" ? C.yellowDim : C.redDim,
                  border: `1px solid ${displayStatus === "ALL SYSTEMS GO" ? C.green
                    : displayStatus === "WARNINGS" ? C.yellow : C.red}30`,
                }}>
                  <p style={{
                    fontSize: 13, fontWeight: 700, margin: 0, fontFamily: mono,
                    color: displayStatus === "ALL SYSTEMS GO" ? C.greenText
                      : displayStatus === "WARNINGS" ? C.yellow : C.red,
                  }}>
                    {displayStatus === "ALL SYSTEMS GO" ? "✅" : displayStatus === "WARNINGS" ? "⚠" : "❌"}{" "}
                    {displayStatus}
                  </p>
                </div>
              ) : displayStatus && (
                <div style={{ padding: "10px 14px", marginBottom: 14, borderRadius: 10,
                  background: C.surfaceAlt, border: `1px solid ${C.border}` }}>
                  <p style={{ fontSize: 13, fontWeight: 600, margin: 0, fontFamily: mono, color: C.textMuted }}>
                    ⏳ {displayStatus}
                  </p>
                </div>
              )}

              {/* Counts row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
                {[
                  { label: "PASSED",   val: displayPassed,   color: C.greenText },
                  { label: "WARNINGS", val: displayWarnings, color: C.yellow    },
                  { label: "FAILED",   val: displayFailed,   color: C.red       },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{
                    background: C.surfaceAlt, borderRadius: 10,
                    border: `1px solid ${C.border}`, padding: "12px 10px", textAlign: "center",
                  }}>
                    <p style={{ fontSize: 22, fontWeight: 700, color, fontFamily: mono, margin: "0 0 2px" }}>{val ?? "—"}</p>
                    <p style={{ fontSize: 10, color: C.textMuted, fontFamily: sans,
                      letterSpacing: "0.07em", textTransform: "uppercase", margin: 0 }}>{label}</p>
                  </div>
                ))}
              </div>

              <p style={{ fontSize: 11, color: C.textMuted, fontFamily: mono, margin: "12px 0 0" }}>
                {hasCheckData
                  ? `Counts from fleet report — auto-refreshed every 60s`
                  : hasSysData
                  ? `From Mac Mini check_results.json — refreshed every 5 min`
                  : `Waiting for check report · run sync_check_to_drive.js on Mac Mini`}
              </p>
            </Card>
              );
            })()}
          </div>
        )}

        {/* ═══════════ STOCKS ═══════════ */}
        {tab === "stocks" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: g2, gap: 14 }}>
              <Card>
                <SLabel>Portfolio Value</SLabel>
                <BigNum>{fmt(liveStocksData.total + ibkrCash)}</BigNum>
                {priceStatus === "ok"
                  ? <Body size={11} color={C.greenText}>● Live prices</Body>
                  : <Body size={11} color={C.textMuted}>incl. {fmt(ibkrCash)} cash</Body>}
              </Card>
              <Card>
                <SLabel>Cash Available</SLabel>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 14, color: C.textMuted, fontFamily: mono }}>$</span>
                  <input
                    type="number"
                    value={ibkrCash}
                    onChange={e => setStocksData(prev => ({ ...prev, ibkrCash: Number(e.target.value) }))}
                    style={{ flex: 1, background: "transparent", border: "none", outline: "none",
                      color: C.greenText, fontFamily: mono, fontSize: 22, fontWeight: 700,
                      letterSpacing: "-0.03em", width: "100%", padding: 0 }}
                  />
                </div>
                <Body size={11} color={C.textMuted}>Uninvested IBKR cash · included in portfolio total</Body>
              </Card>
            </div>
            <Card>
              <SHead icon="📊" title="Allocation"
                right={liveStocksData.holdings.every(h => h.shares === 0) ? <Badge color={C.textMuted}>Planned targets</Badge> : null} />
              <AllocBar items={liveStocksData.holdings.map(s => ({
                name: s.ticker,
                pct: s.shares > 0 ? s.actual : s.target,
              }))} />
              {liveStocksData.holdings.every(h => h.shares === 0) &&
                <Body size={11} color={C.textMuted} style={{ marginTop: 6 }}>Showing planned targets — updates when you own shares</Body>}
            </Card>
            <Card>
              <SHead icon="📈" title="Holdings" right={
                livePrices.lastFetch && liveStocksData.holdings.some(h => h.shares > 0)
                  ? <Badge color={C.greenText}>● Live · {new Date(livePrices.lastFetch).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"})}</Badge>
                  : liveStocksData.holdings.some(h => h.shares > 0)
                    ? <Badge color={C.textMuted}>No live prices</Badge>
                    : <Badge color={C.textMuted}>No positions yet</Badge>
              } />
              {liveStocksData.holdings.every(h => h.shares === 0) ? (
                <div style={{ padding: "24px 0", textAlign: "center" }}>
                  <Body size={13} color={C.textMuted}>No positions yet — buy first shares to start tracking</Body>
                  <Body size={12} color={C.textMuted} style={{ marginTop: 6 }}>
                    Planned: TSM · GOOGL · AVGO · LLY · AMD
                  </Body>
                </div>
              ) : liveStocksData.holdings.filter(h => h.shares > 0).map((s, i) => (
                <div key={i}>
                  <StockRow {...s} isMobile={isMobile} />
                  {livePrices[s.ticker] && s.shares > 0 && (
                    <p style={{ fontSize: 11, color: C.textMuted, fontFamily: mono,
                      paddingLeft: 4, marginBottom: 4 }}>
                      {s.shares} shares × {fmt(livePrices[s.ticker])}
                    </p>
                  )}
                </div>
              ))}
            </Card>
          </div>
        )}

        {/* ═══════════ ASSETS ═══════════ */}
        {tab === "assets" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* ── INVESTMENT EMPIRE ── */}
            <Card highlight>
              <SHead icon="📈" title="Investment Empire" right={
                <Badge color={C.green}>Active capital</Badge>
              } />
              <div style={{ padding: "10px 14px", marginBottom: 16,
                background: C.greenDim, borderRadius: 10, border: `1px solid ${C.green}20` }}>
                <Body size={13} color={C.greenText}>Growing capital — these are the machines that build the empire.</Body>
              </div>

              {/* Gold row */}
              {(() => {
                const gold = hardAssets.find(a => a.name === "Gold");
                const cost = gold?.costBasis ?? 111300;
                const pnl  = goldVal - cost;
                const pnlP = cost > 0 ? ((pnl / cost) * 100).toFixed(1) : "0.0";
                return (
                  <div style={{ padding: "14px 0", borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 14, color: C.white, fontFamily: sans, fontWeight: 600 }}>🥇 Gold</span>
                      <span style={{ fontSize: 16, fontWeight: 700, color: C.white, fontFamily: mono }}>{fmt(goldVal)}</span>
                    </div>
                    <div style={{ display: "flex", gap: 16, fontSize: 12, fontFamily: sans, flexWrap: "wrap" }}>
                      {quantities.goldOz > 0 && livePrices.gold ? (
                        <>
                          <span style={{ color: C.textMuted }}>{quantities.goldOz} oz × {fmt(livePrices.gold)}<span style={{ color: C.greenText }}> ●</span></span>
                          <span style={{ color: C.textMuted }}>Cost: <span style={{ color: C.textSecondary, fontFamily: mono }}>{fmt(cost)}</span></span>
                          <span style={{ color: pnl >= 0 ? C.greenText : C.red }}>P&L: {pnl >= 0 ? "+" : ""}{fmt(pnl)} ({pnl >= 0 ? "+" : ""}{pnlP}%)</span>
                        </>
                      ) : (
                        <>
                          <span style={{ color: C.textMuted }}>Cost basis: <span style={{ color: C.textSecondary, fontFamily: mono }}>{fmt(cost)}</span></span>
                          <span style={{ color: C.textMuted }}>Enter oz in Update tab for live P&amp;L</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* BTC row */}
              {(() => {
                const btc  = hardAssets.find(a => a.name === "Bitcoin");
                const cost = btc?.costBasis ?? 68500;
                const pnl  = btcVal - cost;
                const pnlP = cost > 0 ? ((pnl / cost) * 100).toFixed(1) : "0.0";
                return (
                  <div style={{ padding: "14px 0", borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 14, color: C.white, fontFamily: sans, fontWeight: 600 }}>₿ Bitcoin</span>
                      <span style={{ fontSize: 16, fontWeight: 700, color: C.white, fontFamily: mono }}>{fmt(btcVal)}</span>
                    </div>
                    <div style={{ display: "flex", gap: 16, fontSize: 12, fontFamily: sans, flexWrap: "wrap" }}>
                      {quantities.btcAmount > 0 && livePrices.btc ? (
                        <>
                          <span style={{ color: C.textMuted }}>{quantities.btcAmount} BTC × {fmt(livePrices.btc)}<span style={{ color: C.greenText }}> ●</span></span>
                          <span style={{ color: C.textMuted }}>Cost: <span style={{ color: C.textSecondary, fontFamily: mono }}>{fmt(cost)}</span></span>
                          <span style={{ color: pnl >= 0 ? C.greenText : C.red }}>P&L: {pnl >= 0 ? "+" : ""}{fmt(pnl)} ({pnl >= 0 ? "+" : ""}{pnlP}%)</span>
                        </>
                      ) : (
                        <>
                          <span style={{ color: C.textMuted }}>Cost basis: <span style={{ color: C.textSecondary, fontFamily: mono }}>{fmt(cost)}</span></span>
                          <span style={{ color: C.textMuted }}>Enter BTC amount in Update tab for live P&amp;L</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Stocks row */}
              <div style={{ padding: "14px 0", borderBottom: `1px solid ${C.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 14, color: C.white, fontFamily: sans, fontWeight: 600 }}>📊 Stocks</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: C.white, fontFamily: mono }}>{fmt(liveStocksData.total + ibkrCash)}</span>
                </div>
                <Body size={12} color={C.textMuted}>
                  {liveStocksData.holdings.filter(h => h.shares > 0).length > 0 ? `${liveStocksData.holdings.filter(h => h.shares > 0).length} holdings` : "No positions yet"} · {fmt(ibkrCash)} cash ·{" "}
                  <span style={{ color: C.green, cursor: "pointer" }}
                    onClick={() => setTab("stocks")}>→ Stocks tab</span>
                </Body>
              </div>

              {/* SGAT row */}
              <div style={{ padding: "14px 0", borderBottom: `1px solid ${C.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 14, color: C.white, fontFamily: sans, fontWeight: 600 }}>⚡ SGAT Fleet</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: C.white, fontFamily: mono }}>{fmt(sgatData.deployed)}</span>
                </div>
                <Body size={12} color={C.textMuted}>
                  {sgatData.agents.length > 0 ? `${sgatData.agents.length} agents · ` : ""}
                  P&L {sgatData.pnl >= 0 ? "+" : ""}{fmt(sgatData.pnl)} ·{" "}
                  <span style={{ color: C.green, cursor: "pointer" }}
                    onClick={() => setTab("sgat")}>→ SGAT tab</span>
                </Body>
                {sgatData.agents.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                    {sgatData.agents.map((ag, i) => (
                      <span key={i} style={{ fontSize: 10, color: C.textMuted, fontFamily: mono,
                        background: C.surfaceAlt, borderRadius: 4, padding: "2px 6px" }}>
                        {ag.name.replace("SGAT_","")} ${(ag.usdc||0).toFixed(0)}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Total */}
              <div style={{ padding: "16px 0 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, color: C.textMuted, fontFamily: sans, letterSpacing: "0.06em", textTransform: "uppercase" }}>Total Investment Empire</span>
                  <span style={{ fontSize: 20, fontWeight: 700, color: C.greenText, fontFamily: mono }}>
                    {fmt(goldVal + btcVal + liveStocksData.total + sgatData.deployed)}
                  </span>
                </div>
              </div>
            </Card>

            {/* ── REAL ESTATE ── */}
            <Card>
              <SHead icon="🏠" title="Real Estate" right={
                <Badge color={C.yellow}>Family wealth</Badge>
              } />
              <div style={{ padding: "10px 14px", marginBottom: 16,
                background: C.yellowDim, borderRadius: 10, border: `1px solid ${C.yellow}20` }}>
                <Body size={13} color={C.yellow}>Long-term family wealth — not counted in empire total. Separate story.</Body>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: g2, gap: 12 }}>
                {[
                  { label: "House Current Value",   val: fmt(reData.houseValue),        color: C.textPrimary   },
                  { label: "Mortgage Remaining",     val: "−" + fmt(reData.mortgageRemaining), color: C.red    },
                  { label: "Net Equity",             val: fmt(netEquity),                color: C.greenText     },
                  { label: "Monthly Payment",        val: fmt(reData.monthlyPayment),    color: C.textSecondary },
                  { label: "Payoff Year",            val: String(reData.payoffYear),     color: C.textSecondary },
                  { label: "Equity %",               val: ((netEquity / reData.houseValue) * 100).toFixed(1) + "%", color: C.greenText },
                ].map((r, i) => (
                  <div key={i} style={{ padding: "14px 16px", background: C.surfaceAlt,
                    borderRadius: 10, border: `1px solid ${C.border}` }}>
                    <SLabel>{r.label}</SLabel>
                    <p style={{ fontSize: 16, fontWeight: 700, color: r.color, fontFamily: mono, margin: 0 }}>{r.val}</p>
                  </div>
                ))}
              </div>
              <Hr />
              <Body size={13} color={C.textMuted}>
                Net equity grows every month as mortgage reduces — even if property price stays flat.
                Update house value and mortgage in the Update tab.
              </Body>
            </Card>

          </div>
        )}

        {/* ═══════════ MGAT ═══════════ */}
        {/* ═══════════ TOM ═══════════ */}
        {tab === "tom" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Card highlight>
              <SHead icon="🔮" title="The Oracle Machine" right={
                <Badge color={C.yellow}>Planning Phase</Badge>
              } />
              <Body size={13} color={C.textSecondary} style={{ marginBottom: 16 }}>
                AI-powered daily briefing system for Solomon's wife. Delivers a personalised morning brief — weather, calendar, family priorities, market context — automatically, every day.
              </Body>
              {/* Status tracker */}
              {[
                { key: "not_started", label: "Foundation" },
                { key: "planning",    label: "Planning"    },
                { key: "building",    label: "Building"    },
                { key: "testing",     label: "Testing"     },
                { key: "live",        label: "Live"        },
              ].map((s, i) => {
                const phases = ["not_started","planning","building","testing","live"];
                const current = phases.indexOf(tomData.status);
                const mine    = phases.indexOf(s.key);
                const isActive = s.key === tomData.status;
                const isDone   = mine < current;
                return (
                  <div key={s.key} onClick={() => setTomData(p => ({ ...p, status: s.key }))}
                    style={{ display: "flex", alignItems: "center", gap: 14,
                      padding: "12px 14px", marginBottom: 6, borderRadius: 10, cursor: "pointer",
                      background: isActive ? C.greenDim : isDone ? C.surfaceAlt : C.surfaceAlt,
                      border: `1px solid ${isActive ? C.green : isDone ? C.border : C.border}`,
                      transition: "all 0.2s" }}>
                    <div style={{ width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                      background: isActive ? C.green : isDone ? C.greenDeep : C.surfaceHigh,
                      display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <p style={{ margin: 0, fontSize: 12, color: isDone || isActive ? "#0B0B09" : C.textMuted, fontWeight: 700 }}>
                        {isDone ? "✓" : i + 1}
                      </p>
                    </div>
                    <Body size={13} color={isActive ? C.greenText : isDone ? C.textSecondary : C.textMuted}>
                      {s.label}
                    </Body>
                    {isActive && <Badge color={C.greenText} style={{ marginLeft: "auto" }}>Current</Badge>}
                  </div>
                );
              })}
            </Card>

            {/* Milestones */}
            <Card>
              <SHead icon="🎯" title="Milestones" />
              {tomData.milestones.map(ms => (
                <div key={ms.id} onClick={() => setTomData(p => ({
                  ...p,
                  milestones: p.milestones.map(m => m.id === ms.id ? { ...m, done: !m.done } : m)
                }))} style={{ display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 0", borderBottom: `1px solid ${C.border}`, cursor: "pointer" }}>
                  <div style={{ width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                    border: `2px solid ${ms.done ? C.green : C.border}`,
                    background: ms.done ? C.green : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {ms.done && <p style={{ margin: 0, fontSize: 11, color: "#0B0B09", fontWeight: 900 }}>✓</p>}
                  </div>
                  <Body size={13} color={ms.done ? C.textMuted : C.textPrimary}
                    style={{ textDecoration: ms.done ? "line-through" : "none" }}>
                    {ms.label}
                  </Body>
                </div>
              ))}
            </Card>

            {/* Next milestone card */}
            <Card style={{ border: `1px solid ${C.yellow}30` }}>
              <SHead icon="📅" title="Next Milestone" right={<Badge color={C.yellow}>Scheduled</Badge>} />
              <Body size={13} color={C.textSecondary}>Dry run with wife — present first automated morning brief and gather feedback on format, timing, and content.</Body>
            </Card>

            {/* Notes */}
            <Card>
              <SHead icon="📝" title="Project Notes" />
              <textarea
                value={tomData.notes}
                onChange={e => setTomData(p => ({ ...p, notes: e.target.value }))}
                placeholder="Add notes, ideas, blockers..."
                rows={5}
                style={{ width: "100%", background: C.surfaceAlt, border: `1px solid ${C.border}`,
                  borderRadius: 10, padding: "12px 14px", color: C.textPrimary,
                  fontFamily: sans, fontSize: 13, lineHeight: 1.6, outline: "none",
                  resize: "vertical", boxSizing: "border-box" }}
              />
              <Body size={11} color={C.textMuted}>Notes auto-save as you type.</Body>
            </Card>
          </div>
        )}

        {tab === "mgat" && (
          <Card style={{ textAlign: "center", padding: "48px 24px" }}>
            <p style={{ fontSize: 40, margin: "0 0 12px" }}>🔒</p>
            <p style={{ fontSize: 20, fontWeight: 700, color: C.white, fontFamily: mono, margin: "0 0 8px" }}>MGAT — Coming Soon</p>
            <p style={{ fontSize: 13, color: C.textMuted, fontFamily: sans, margin: 0 }}>Gated on SGAT Phase 1 completion</p>
          </Card>
        )}

        {/* ═══════════ UPDATE ═══════════ */}
        {tab === "update" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Historical — one time */}
            <Card style={{ border: `1px solid ${C.yellow}25` }}>
              <SHead icon="📅" title="Hard Asset History — One Time Setup" right={
                <Badge color={C.yellow}>Do once</Badge>
              } />
              <Body size={13} color={C.textMuted}>
                Paste historical values for Gold, BTC and House to populate the performance chart
                with real data. After saving, the chart will reflect your actual history.
              </Body>
              <Hr />
              <PasteZone
                icon="📅" label="Historical values"
                hint={`BTC | Oct 2025: $38,000 | Dec 2025: $45,000 | Feb 2026: $52,000 | Apr 2026: $42,300\nGold | Oct 2025: $16,200 | Dec 2025: $17,100 | Feb 2026: $18,000 | Apr 2026: $18,500\nHouse value | Today: $185,000\nMortgage remaining | Today: $162,550`}
                value={hist} onChange={setHist}
              />
              <button
                onClick={applyHistorical}
                style={{ width: "100%", padding: "12px",
                  background: C.surfaceAlt, border: `1px solid ${C.yellow}50`,
                  borderRadius: 12, color: C.yellow, fontSize: 14, fontWeight: 700,
                  fontFamily: sans, letterSpacing: "0.02em" }}>
                📅 Apply Historical Data to Chart
              </button>
            </Card>

            {/* Live price setup */}
            <Card style={{ border: `1px solid ${C.green}25` }}>
              <SHead icon="📡" title="Live Price Setup" right={
                livePrices.lastFetch
                  ? <Badge color={C.greenText}>● Live · {new Date(livePrices.lastFetch).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"})}</Badge>
                  : <Badge color={C.textMuted}>Not connected</Badge>
              } />
              <Body size={13} color={C.textMuted}>
                BTC and Gold are fetched automatically via CoinGecko — no key needed.
                For stock prices, get a free key at <span style={{ color: C.green }}>finnhub.io</span> → Sign up → API keys.
              </Body>
              <Hr />
              <SLabel>Finnhub API Key (free — for stock prices)</SLabel>
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <input
                  type="password"
                  value={finnhubKey}
                  onChange={e => setFinnhubKey(e.target.value)}
                  placeholder="Paste your free Finnhub key here..."
                  style={{ flex: 1, background: C.surfaceAlt, border: `1px solid ${C.border}`,
                    borderRadius: 8, padding: "10px 12px", color: C.textPrimary,
                    fontFamily: mono, fontSize: 13, outline: "none" }}
                />
                <button onClick={fetchPrices}
                  style={{ padding: "10px 16px", background: C.green, border: "none",
                    borderRadius: 8, color: "#0B0B09", fontWeight: 700, fontFamily: sans, fontSize: 13 }}>
                  Refresh
                </button>
              </div>
              <SLabel>Your Holdings (for live P&L)</SLabel>
              <div style={{ display: "grid", gridTemplateColumns: g2, gap: 10, marginBottom: 4 }}>
                <div>
                  <SLabel>Gold — troy oz</SLabel>
                  <input type="number" step="0.01"
                    value={quantities.goldOz}
                    onChange={e => setQuantities(p => ({ ...p, goldOz: parseFloat(e.target.value) || 0 }))}
                    style={{ width: "100%", background: C.surfaceAlt, border: `1px solid ${C.border}`,
                      borderRadius: 8, padding: "10px 12px", color: C.textPrimary,
                      fontFamily: mono, fontSize: 14, outline: "none" }}
                  />
                </div>
                <div>
                  <SLabel>Bitcoin — BTC amount</SLabel>
                  <input type="number" step="0.0001"
                    value={quantities.btcAmount}
                    onChange={e => setQuantities(p => ({ ...p, btcAmount: parseFloat(e.target.value) || 0 }))}
                    style={{ width: "100%", background: C.surfaceAlt, border: `1px solid ${C.border}`,
                      borderRadius: 8, padding: "10px 12px", color: C.textPrimary,
                      fontFamily: mono, fontSize: 14, outline: "none" }}
                  />
                </div>
              </div>
              <Body size={11} color={C.textMuted}>Stock shares are parsed from your IBKR paste below.</Body>
            </Card>

            {/* Weekly paste */}
            <Card>
              <SHead icon="📋" title="Weekly Update" right={
                <Badge color={C.green}>Every week</Badge>
              } />
              <Body size={13} color={C.textMuted}>
                SGAT fleet data is fetched automatically every 60 seconds from Google Drive.
                Paste share counts and optional asset overrides below, then hit Apply Update.
              </Body>
              <Hr />

              {/* ── SGAT Auto-Fetch Status ── */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 16 }}>⚡</span>
                  <SLabel>SGAT Fleet — Auto-Fetching from Google Drive</SLabel>
                </div>
                <div style={{
                  background: C.bg,
                  border: `1px solid ${
                    fleetStatus === "ok"    ? C.green + "45" :
                    fleetStatus === "error" ? C.red   + "45" : C.border
                  }`,
                  borderRadius: 10, padding: "14px 16px",
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {fleetStatus === "ok"      && <Dot color={C.green} />}
                      {fleetStatus === "loading"  && <span style={{ fontSize: 14, color: C.textMuted }}>⟳</span>}
                      {fleetStatus === "error"    && <span style={{ fontSize: 14, color: C.red }}>⚠</span>}
                      {fleetStatus === "idle"     && <span style={{ fontSize: 14, color: C.textMuted }}>○</span>}
                      <p style={{ fontSize: 13, fontWeight: 600, fontFamily: sans, margin: 0,
                        color: fleetStatus === "ok" ? C.greenText : fleetStatus === "error" ? C.red : C.textMuted }}>
                        {fleetStatus === "ok"       ? "Live — auto-refreshing every 60 seconds"
                          : fleetStatus === "loading" ? "Fetching fleet data…"
                          : fleetStatus === "error"   ? "Fetch failed — retrying every 60s"
                          : "Initialising…"}
                      </p>
                    </div>
                    {fleetLastFetched && (
                      <p style={{ fontSize: 12, color: C.textMuted, fontFamily: mono, margin: 0 }}>
                        Last updated: {fleetLastFetched}
                      </p>
                    )}
                  </div>
                  <p style={{ fontSize: 11, color: C.greenText, fontFamily: mono, margin: "0 0 10px" }}>
                    Connected ✅
                  </p>
                  {sgatData.agents.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {sgatData.agents.map((ag, i) => (
                        <div key={i} style={{ fontSize: 11, fontFamily: mono, color: C.textSecondary,
                          background: C.surfaceAlt, borderRadius: 6, padding: "3px 8px" }}>
                          {ag.name} <span style={{ color: C.greenText }}>${(ag.position ? ag.position.total_wallet : ag.usdc).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={fetchFleetData}
                  style={{ marginTop: 8, padding: "8px 18px", background: "none",
                    border: `1px solid ${C.border}`, borderRadius: 8,
                    color: C.textMuted, fontSize: 12, fontFamily: sans, cursor: "pointer" }}>
                  ↻ Fetch Now
                </button>
              </div>
              <PasteZone
                icon="📈" label="Stock Portfolio — share quantities from IBKR"
                hint={`TSM: 8 shares\nGOOGL: 6 shares\nAVGO: 2 shares\nLLY: 1 share\nAMD: 3 shares\n\n(Prices auto-fetched — no need to paste dollar values)`}
                value={stk} onChange={setStk}
              />
              <PasteZone
                icon="🏛️" label="Manual asset override (optional)"
                hint={`Only needed if live prices unavailable.\nGold: 5oz\nBTC: 0.45`}
                value={ast} onChange={setAst}
              />

              {/* Apply Update */}
              <button
                onClick={applyUpdate}
                style={{ width: "100%", padding: "14px", background: C.green,
                  border: "none", borderRadius: 12, color: "#0B0B09",
                  fontSize: 14, fontWeight: 700, fontFamily: sans, letterSpacing: "0.02em",
                  boxShadow: `0 4px 20px ${C.greenGlow}`, marginBottom: 14 }}>
                ◉ Apply Update
              </button>

              <Body size={12} color={C.textMuted}>
                Parses SGAT + share counts, updates every tab, adds today's point to the chart.
              </Body>
            </Card>

            {/* Real Estate inputs */}
            <Card style={{ border: `1px solid ${C.yellow}25` }}>
              <SHead icon="🏠" title="Real Estate" right={
                <Badge color={C.yellow}>Update when needed</Badge>
              } />
              <Body size={13} color={C.textMuted}>
                Update whenever you get a mortgage statement or property revaluation.
                These are manual inputs — not parsed from a paste zone.
              </Body>
              <Hr />
              <div style={{ display: "grid", gridTemplateColumns: g2, gap: 12, marginBottom: 14 }}>
                {[
                  { label: "House Current Value",  key: "houseValue",        prefix: "$" },
                  { label: "Mortgage Remaining",   key: "mortgageRemaining", prefix: "$" },
                  { label: "Monthly Payment",      key: "monthlyPayment",    prefix: "$" },
                  { label: "Payoff Year",          key: "payoffYear",        prefix: ""  },
                ].map(({ label, key, prefix }) => (
                  <div key={key}>
                    <SLabel>{label}</SLabel>
                    <div style={{ display: "flex", alignItems: "center",
                      background: C.surfaceAlt, border: `1px solid ${C.border}`,
                      borderRadius: 8, overflow: "hidden" }}>
                      {prefix && (
                        <span style={{ padding: "0 10px", color: C.textMuted,
                          fontFamily: mono, fontSize: 14, borderRight: `1px solid ${C.border}` }}>
                          {prefix}
                        </span>
                      )}
                      <input
                        type="number"
                        value={reData[key]}
                        onChange={e => setReData(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                        style={{ flex: 1, background: "transparent", border: "none", outline: "none",
                          padding: "10px 12px", color: C.textPrimary, fontFamily: mono,
                          fontSize: 14, width: "100%" }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <Body size={12} color={C.textMuted}>
                Changes save automatically to localStorage as you type.
              </Body>
            </Card>

            {/* ATLAS Weekly Signal input */}
            <Card>
              <SHead icon="📡" title="ATLAS Weekly Signal" />
              <Body size={13} color={C.textMuted}>
                Paste the compact summary output from /AWS here to save it to the Overview tab.
              </Body>
              <Hr />
              <textarea
                value={awsSignal}
                onChange={e => setAwsSignal(e.target.value)}
                placeholder="Paste /AWS compact summary here..."
                style={{ width: "100%", minHeight: 160, background: C.surfaceAlt,
                  border: `1px solid ${C.border}`, borderRadius: 10, color: C.textPrimary,
                  fontFamily: mono, fontSize: 12, padding: "12px 14px",
                  resize: "vertical", outline: "none", boxSizing: "border-box" }}
              />
              <button
                onClick={() => {
                  try { localStorage.setItem("aws_weekly_signal", awsSignal); } catch {}
                  setAwsSaved(true);
                  setTimeout(() => setAwsSaved(false), 2000);
                }}
                style={{ width: "100%", marginTop: 10, padding: "13px",
                  background: awsSaved ? C.greenDeep : C.green,
                  border: "none", borderRadius: 12, color: "#0B0B09",
                  fontSize: 14, fontWeight: 700, fontFamily: sans,
                  letterSpacing: "0.02em", cursor: "pointer",
                  boxShadow: `0 4px 20px ${C.greenGlow}`, transition: "all 0.3s" }}>
                {awsSaved ? "✓ Saved" : "Save Signal"}
              </button>
            </Card>
          </div>
        )}

        {/* Footer */}
        <p style={{ textAlign: "center", paddingTop: 24,
          fontSize: 11, color: C.textMuted, fontFamily: sans, letterSpacing: "0.04em" }}>
          GAT Control Room v3 · {today}
        </p>
      </div>

  