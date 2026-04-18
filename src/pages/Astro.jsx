/**
 * Astro.jsx — Premium Celestial Panchang App 2026
 * Dark immersive · Compact hero · Normalized city data · Robust live timers
 * Firebase Firestore + auth preserved exactly
 */

import React, {
  useState, useEffect, useCallback, useMemo, memo, useRef,
} from "react";
import { db } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const LOCATIONS = ["Chennai", "Bangalore", "Kochi"];
const IST_OFFSET_MS = 5.5 * 3600000;

const LOCATION_META = {
  Chennai:   { emoji: "🌊", tagline: "Bay of Bengal" },
  Bangalore: { emoji: "🌿", tagline: "Garden City"   },
  Kochi:     { emoji: "⛵", tagline: "Arabian Sea"   },
};

const KALAM_PERIODS = [
  { key: "rahuKalam",   label: "Rahu Kalam",   type: "bad",     icon: "☿", color: "#ff6b6b" },
  { key: "yamagandam",  label: "Yamagandam",   type: "bad",     icon: "♄", color: "#ff9f43" },
  { key: "gulikaKalam", label: "Gulika Kalam", type: "neutral", icon: "♅", color: "#ffd32a" },
];

const GUIDANCE = {
  bad:     "Avoid starting new ventures or important tasks",
  neutral: "Proceed with caution. Routine tasks are fine",
  good:    "Auspicious time. Ideal for important decisions",
};

// ─── PURE TIME HELPERS ────────────────────────────────────────────────────────

function getTodayIST() {
  const ist = new Date(Date.now() + IST_OFFSET_MS);
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth()+1).padStart(2,"0")}-${String(ist.getUTCDate()).padStart(2,"0")}`;
}

function getISTDateParts(ref = new Date()) {
  const ist = new Date(ref.getTime() + IST_OFFSET_MS);
  return { year: ist.getUTCFullYear(), month: ist.getUTCMonth(), day: ist.getUTCDate() };
}

function formatDateFull(ds) {
  if (!ds) return "";
  const [y, m, d] = ds.split("-");
  return new Date(Date.UTC(+y, +m-1, +d)).toLocaleDateString("en-IN", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

const EMPTY_TIME = "—";
const TIME_RE = /\b(\d{1,2})\s*:\s*(\d{2})(?:\s*:\s*(\d{2}))?\s*([APap])\.?\s*([Mm])\.?\b/;

function canonicalTimeFromParts(hourRaw, minuteRaw, merRaw) {
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return EMPTY_TIME;
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return EMPTY_TIME;
  return `${hour}:${String(minute).padStart(2, "0")} ${merRaw.toUpperCase()}`;
}

/** Normalises any raw time string to "H:MM AM/PM" or "—" */
function cleanTime(raw) {
  if (raw === null || raw === undefined) return EMPTY_TIME;
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase();
  }
  if (typeof raw !== "string" && typeof raw !== "number") return EMPTY_TIME;

  const trimmed = String(raw).trim();
  if (!trimmed) return EMPTY_TIME;

  const direct = trimmed.match(TIME_RE);
  if (direct) {
    return canonicalTimeFromParts(direct[1], direct[2], `${direct[4]}${direct[5]}`);
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase();
  }

  return EMPTY_TIME;
}

/** Normalises a range string to canonical "H:MM AM - H:MM PM" form or "" */
function cleanRange(raw) {
  if (!raw || typeof raw !== "string") return "";
  const norm = raw
    .replace(/Ã¢â‚¬[\u0093\u0094\u0095]/g, "-")
    .replace(/â€"|â€"|–|—|−/g, "-")
    .replace(/\s+to\s+/gi, " - ")
    .trim();

  const matches = [...norm.matchAll(new RegExp(TIME_RE.source, "gi"))];
  if (matches.length >= 2) {
    const s = canonicalTimeFromParts(matches[0][1], matches[0][2], `${matches[0][4]}${matches[0][5]}`);
    const e = canonicalTimeFromParts(matches[1][1], matches[1][2], `${matches[1][4]}${matches[1][5]}`);
    if (s !== EMPTY_TIME && e !== EMPTY_TIME) return `${s} - ${e}`;
  }

  const parts = norm.split(/\s+-\s+|\s*-\s*|\s+to\s+/i).map(p => p.trim()).filter(Boolean);
  if (parts.length < 2) return "";
  const s = cleanTime(parts[0]);
  const e = cleanTime(parts[parts.length - 1]);
  if (s === EMPTY_TIME || e === EMPTY_TIME) return "";
  return `${s} - ${e}`;
}

function parseMins(ts) {
  if (!ts || ts === EMPTY_TIME) return null;
  const m = String(ts).match(TIME_RE);
  if (!m) return null;
  let h = parseInt(m[1], 10), mn = parseInt(m[2], 10), mer = `${m[4]}${m[5]}`.toUpperCase();
  if (h < 1 || h > 12 || mn < 0 || mn > 59) return null;
  if (mer === "AM" && h === 12) h = 0;
  if (mer === "PM" && h !== 12) h += 12;
  return h * 60 + mn;
}

function parseTimeOnIST(ts, ref = new Date()) {
  const mn = parseMins(ts);
  if (mn === null) return null;
  const { year, month, day } = getISTDateParts(ref);
  return new Date(Date.UTC(year, month, day, Math.floor(mn / 60), mn % 60) - IST_OFFSET_MS);
}

/** Parse a CLEANED canonical range string "H:MM AM - H:MM PM" into {start,end} Dates */
function parseRangeToDate(canonicalRange, ref = new Date()) {
  if (!canonicalRange) return null;
  const parts = canonicalRange.split(" - ");
  if (parts.length !== 2) return null;
  const s = parseTimeOnIST(parts[0].trim(), ref);
  const e = parseTimeOnIST(parts[1].trim(), ref);
  if (!s || !e) return null;
  return { start: s, end: e, startLabel: parts[0].trim(), endLabel: parts[1].trim() };
}

function nowISTFull() {
  const ist = new Date(Date.now() + IST_OFFSET_MS);
  const h = ist.getUTCHours(), mn = ist.getUTCMinutes(), s = ist.getUTCSeconds();
  const mer = h >= 12 ? "PM" : "AM", h12 = h % 12 || 12;
  return {
    display: `${h12}:${String(mn).padStart(2,"0")}:${String(s).padStart(2,"0")} ${mer}`,
    short:   `${h12}:${String(mn).padStart(2,"0")} ${mer}`,
    totalMinutes: h * 60 + mn,
    totalSeconds: h * 3600 + mn * 60 + s,
    h, mn, s, mer, h12,
    now: new Date(),
  };
}

function fmtCountdown(secs) {
  if (secs <= 0) return "ending";
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function getDayPhase(pct) {
  if (pct === null || pct === undefined) return "Night";
  if (pct < 5)  return "Dawn";
  if (pct < 20) return "Morning";
  if (pct < 45) return "Late Morning";
  if (pct < 55) return "Noon";
  if (pct < 75) return "Afternoon";
  if (pct < 90) return "Evening";
  return "Dusk";
}

// ─── NORMALIZATION LAYER ──────────────────────────────────────────────────────

/**
 * normalizePanchangData — single source of truth for all UI data.
 * Accepts raw Firestore doc data and returns a stable, cleaned shape.
 * All time strings are normalized. All range strings are canonical.
 * Safe for all cities regardless of API format variations.
 */
function normalizePanchangData(raw) {
  if (!raw || typeof raw !== "object") return null;

  const ct = (v) => cleanTime(v);
  const cr = (v) => cleanRange(v);

  // Normalise nested object: picks common field names across API variants
  const normalizeDetail = (obj) => {
    if (!obj || typeof obj !== "object") return null;
    return {
      name:    obj.name    || obj.Name    || obj.title   || "",
      lord:    obj.lord    || obj.Lord    || obj.deity   || "",
      endTime: ct(obj.endTime || obj.end_time || obj.EndTime || obj.ends || ""),
      special: obj.special || obj.Special || obj.note    || "",
      summary: obj.summary || obj.Summary || obj.desc    || "",
    };
  };

  return {
    // Astronomy
    sunrise:  ct(raw.sunrise  || raw.Sunrise  || ""),
    sunset:   ct(raw.sunset   || raw.Sunset   || ""),
    moonrise: ct(raw.moonrise || raw.Moonrise || ""),
    moonset:  ct(raw.moonset  || raw.Moonset  || ""),

    // Inauspicious periods — all normalized to canonical range format
    rahuKalam:   cr(raw.rahuKalam   || raw.rahu_kalam   || raw.rahukalam   || ""),
    yamagandam:  cr(raw.yamagandam  || raw.yama_gandam  || raw.Yamagandam  || ""),
    gulikaKalam: cr(raw.gulikaKalam || raw.gulika_kalam || raw.gulikakalam || ""),
    abhijitMuhurta: cr(raw.abhijitMuhurta || raw.abhijit_muhurta || raw.abhijit || ""),

    // Panchang details
    tithi:     normalizeDetail(raw.tithi     || raw.Tithi),
    nakshatra: normalizeDetail(raw.nakshatra || raw.Nakshatra),
    yoga:      normalizeDetail(raw.yoga      || raw.Yoga),
    karana:    normalizeDetail(raw.karana    || raw.Karana),

    // Meta
    varName:   raw.varName   || raw.var_name   || raw.dayName || "",
    masaName:  raw.masaName  || raw.masa_name  || raw.masa    || "",
    paksha:    raw.paksha    || raw.Paksha     || "",
    samvat:    raw.samvat    || raw.Samvat     || "",
  };
}

// ─── LIVE COMPUTATIONS (from normalized data + current time) ─────────────────

function computeLiveState(normalized, nowMs) {
  if (!normalized) return { active: null, next: null };
  const now = new Date(nowMs);

  let active = null;
  for (const period of KALAM_PERIODS) {
    const range = parseRangeToDate(normalized[period.key], now);
    if (!range) continue;
    if (now >= range.start && now <= range.end) { active = period; break; }
  }

  let next = null;
  for (const period of KALAM_PERIODS) {
    const range = parseRangeToDate(normalized[period.key], now);
    if (!range || range.start <= now) continue;
    const secs = Math.floor((range.start - now) / 1000);
    if (!next || secs < next.secs) next = { ...period, secs };
  }

  return { active, next };
}

function computeDayProgress(normalized, nowMs) {
  if (!normalized) return null;
  const sr = parseMins(normalized.sunrise);
  const ss = parseMins(normalized.sunset);
  if (sr === null || ss === null || ss <= sr) return null;
  const ist = new Date(nowMs + IST_OFFSET_MS);
  const nowMin = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  const total = ss - sr, elapsed = Math.min(Math.max(nowMin - sr, 0), total);
  return Math.round((elapsed / total) * 100);
}

function computeSmartStatus(normalized, active, next) {
  if (!normalized) return null;
  if (active) {
    const range = parseRangeToDate(normalized[active.key], new Date());
    return {
      type: active.type === "neutral" ? "neutral" : "bad",
      icon: active.type === "neutral" ? "⚡" : "🔴",
      title: `${active.label} Active`,
      message: GUIDANCE[active.type === "neutral" ? "neutral" : "bad"],
      extra: range ? `Ends ${range.endLabel}` : "",
      color: active.color,
    };
  }
  if (next) {
    return {
      type: "good", icon: "✨", title: "Auspicious Time",
      message: GUIDANCE.good,
      extra: `Next: ${next.label} in ${fmtCountdown(next.secs)}`,
      color: "#2ed573",
    };
  }
  if (KALAM_PERIODS.some(k => parseRangeToDate(normalized[k.key], new Date()))) {
    return { type: "good", icon: "✨", title: "Auspicious Time", message: GUIDANCE.good, extra: "", color: "#2ed573" };
  }
  return { type: "neutral", icon: "🕐", title: "Status Unknown", message: "Panchang times unavailable", extra: "", color: "#a29bfe" };
}

// ─── FIRESTORE ────────────────────────────────────────────────────────────────

async function getUserLocation(uid) {
  try {
    const s = await getDoc(doc(db, "users", uid));
    if (s.exists()) return s.data().panchangLocation || "Chennai";
  } catch (_) {}
  return "Chennai";
}
async function saveUserLocation(uid, loc) {
  await setDoc(doc(db, "users", uid), { panchangLocation: loc }, { merge: true });
}
async function fetchPanchang(loc, date) {
  const s = await getDoc(doc(db, "panchang", `${date}_${loc}`));
  return s.exists() ? s.data() : null;
}

// ─── HOOKS ────────────────────────────────────────────────────────────────────

function useClock() {
  const [t, set] = useState(() => nowISTFull());
  useEffect(() => {
    const id = setInterval(() => set(nowISTFull()), 1000);
    return () => clearInterval(id);
  }, []);
  return t;
}

function useTick(ms = 1000) {
  const [t, s] = useState(0);
  useEffect(() => { const id = setInterval(() => s(v => v + 1), ms); return () => clearInterval(id); }, [ms]);
  return t;
}

// ─── STAR PARTICLES ───────────────────────────────────────────────────────────

const Stars = memo(() => {
  const stars = useMemo(() => Array.from({ length: 28 }, (_, i) => ({
    id: i,
    x: Math.random() * 100, y: Math.random() * 100,
    r: 0.4 + Math.random() * 1.0,
    d: 1.8 + Math.random() * 3, del: Math.random() * 5,
  })), []);

  return (
    <svg style={{ position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none",overflow:"hidden" }} xmlns="http://www.w3.org/2000/svg">
      {stars.map(s => (
        <circle key={s.id} cx={`${s.x}%`} cy={`${s.y}%`} r={s.r} fill="rgba(255,220,130,0.75)">
          <animate attributeName="opacity" values="0.1;0.85;0.1" dur={`${s.d}s`} begin={`${s.del}s`} repeatCount="indefinite"/>
        </circle>
      ))}
    </svg>
  );
});

// ─── HERO ─────────────────────────────────────────────────────────────────────

const Hero = memo(({ location, today, status }) => {
  const meta = LOCATION_META[location] || LOCATION_META.Chennai;
  const heroBg = status?.type === "bad"
    ? "linear-gradient(165deg,#10011a 0%,#1e0616 55%,#0a0010 100%)"
    : status?.type === "neutral"
    ? "linear-gradient(165deg,#0f0800 0%,#1c1100 55%,#080500 100%)"
    : "linear-gradient(165deg,#010a14 0%,#030e1c 55%,#000608 100%)";

  return (
    <div style={{ ...H.hero, background: heroBg }}>
      <div style={{ position:"absolute", inset:0, overflow:"hidden", borderRadius:"0 0 26px 26px" }}>
        <Stars/>
        <div style={H.orb1}/><div style={H.orb2}/><div style={H.orb3}/>
      </div>

      {/* Top bar */}
      <div style={H.topBar}>
        <div style={H.appId}>
          <span style={H.om}>ॐ</span>
          <div>
            <div style={H.appName}>Panchang</div>
            <div style={H.appSub}>Vedic Celestial Guide</div>
          </div>
        </div>
        <div style={H.livePill}>
          <span style={H.liveDot}/><span style={H.liveText}>LIVE</span>
        </div>
      </div>

      {/* Center */}
      <div style={H.center}>
        <div style={H.dateLine}>{formatDateFull(today)}</div>
        <div style={H.locLine}>
          <span style={H.locEmoji}>{meta.emoji}</span>
          <span style={H.locName}>{location}</span>
          <span style={H.locTag}>{meta.tagline}</span>
        </div>
      </div>

      {/* Status ribbon */}
      {status && (
        <div style={{
          ...H.ribbon,
          background: status.type==="bad"?"rgba(255,107,107,0.09)":status.type==="neutral"?"rgba(255,159,67,0.09)":"rgba(46,213,115,0.09)",
          borderTop:  status.type==="bad"?"1px solid rgba(255,107,107,0.16)":status.type==="neutral"?"1px solid rgba(255,159,67,0.16)":"1px solid rgba(46,213,115,0.16)",
        }}>
          <span style={{ fontSize:16, lineHeight:1, flexShrink:0 }}>{status.icon}</span>
          <div style={H.ribbonMid}>
            <span style={{
              ...H.ribbonTitle,
              color: status.type==="bad"?"#ff8585":status.type==="neutral"?"#ffbe76":"#7bed9f",
            }}>{status.title}</span>
            <span style={H.ribbonMsg}>{status.message}</span>
          </div>
          {status.extra && <span style={H.ribbonExtra}>{status.extra}</span>}
        </div>
      )}
    </div>
  );
});

// ─── LOCATION SELECTOR ────────────────────────────────────────────────────────

const LocSelector = memo(({ location, onChange, saving }) => {
  const meta = LOCATION_META[location] || LOCATION_META.Chennai;
  return (
    <div style={C.locCard}>
      <div style={C.locL}>
        <div style={C.locBox}><span style={{ fontSize:17 }}>{meta.emoji}</span></div>
        <div>
          <div style={C.locName}>{location}</div>
          <div style={C.locTag}>{meta.tagline}</div>
        </div>
      </div>
      <div style={C.locR}>
        {saving && <span style={C.saveDot}/>}
        <div style={C.selWrap}>
          <select value={location} onChange={onChange} style={C.sel} aria-label="Select city">
            {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <span style={C.selArrow}>▾</span>
        </div>
      </div>
    </div>
  );
});

// ─── META CHIPS ───────────────────────────────────────────────────────────────

const MetaChips = memo(({ p }) => {
  const chips = [
    p.varName,
    p.masaName && `${p.masaName} Masa`,
    p.paksha,
    p.samvat,
  ].filter(Boolean);
  if (!chips.length) return null;
  return (
    <div style={C.chips}>
      {chips.map((c, i) => <span key={i} style={C.chip}>{c}</span>)}
    </div>
  );
});

// ─── LIVE STATUS CARD ─────────────────────────────────────────────────────────

const StatusCard = memo(({ status, active, normalized, nowMs }) => {
  useTick(1000); // re-render every second for countdown
  if (!status) return null;

  const secsLeft = active ? (() => {
    const r = parseRangeToDate(normalized?.[active.key], new Date(nowMs));
    return r ? Math.max(0, Math.floor((r.end - new Date(nowMs)) / 1000)) : 0;
  })() : 0;

  const prog = active ? (() => {
    const r = parseRangeToDate(normalized?.[active.key], new Date(nowMs));
    if (!r) return 0;
    const total = r.end - r.start, el = new Date(nowMs) - r.start;
    return Math.min(100, Math.max(0, Math.round(el / total * 100)));
  })() : 0;

  const PAL = {
    bad:     { bg:"linear-gradient(140deg,#1c0505,#250a0a)", bdr:"rgba(255,107,107,0.2)",  acc:"#ff6b6b", dim:"#b83232", track:"rgba(255,107,107,0.12)" },
    neutral: { bg:"linear-gradient(140deg,#1a0f00,#261800)", bdr:"rgba(255,159,67,0.2)",   acc:"#ff9f43", dim:"#b86e2a", track:"rgba(255,159,67,0.12)"  },
    good:    { bg:"linear-gradient(140deg,#001510,#002018)", bdr:"rgba(46,213,115,0.2)",    acc:"#2ed573", dim:"#1a8a4a", track:"rgba(46,213,115,0.12)"  },
  };
  const pal = PAL[status.type] || PAL.good;
  const isLive = !!active;

  return (
    <div style={{
      ...C.statusCard,
      background: pal.bg,
      border: `1px solid ${pal.bdr}`,
      boxShadow: isLive
        ? `0 0 40px ${pal.bdr}, 0 8px 40px rgba(0,0,0,0.5)`
        : `0 8px 32px rgba(0,0,0,0.35)`,
      animation: isLive
        ? "statusPulse 3s ease-in-out infinite, slideUp 0.45s ease both"
        : "slideUp 0.45s ease both",
    }}>
      <div style={C.scTop}>
        <div style={C.scTL}>
          <span style={{ fontSize:26, lineHeight:1 }}>{status.icon}</span>
          <div>
            <div style={{ ...C.scTitle, color:pal.acc }}>{status.title}</div>
            <div style={C.scMsg}>{status.message}</div>
          </div>
        </div>
        {isLive && (
          <div style={{ ...C.scLive, background:`linear-gradient(135deg,${pal.dim},${pal.acc})` }}>
            <span style={C.scLiveDot}/>LIVE
          </div>
        )}
      </div>

      {isLive && active && (
        <div style={C.scPeriod}>
          <div style={C.scPRow}>
            <span style={{ ...C.scPName, color:pal.acc }}>{active.label} — ends in</span>
            <span style={{ ...C.scTimer, color:pal.acc }}>{fmtCountdown(secsLeft)}</span>
          </div>
          <div style={{ ...C.scTrack, background:pal.track }}>
            <div style={{
              ...C.scFill, width:`${prog}%`,
              background:`linear-gradient(90deg,${pal.dim},${pal.acc})`,
              boxShadow:`0 0 8px ${pal.acc}60`,
            }}/>
          </div>
          <div style={C.scTrackLbls}>
            <span style={C.scTLbl}>Started</span>
            <span style={{ ...C.scTLbl, color:"#666" }}>{100 - prog}% left</span>
            <span style={C.scTLbl}>Ends</span>
          </div>
        </div>
      )}

      {status.extra && (
        <div style={{ ...C.scExtra, borderColor:pal.bdr }}>
          <span style={{ ...C.scExtraIcon, color:pal.acc }}>⏭</span>
          <span style={{ ...C.scExtraText, color:pal.acc }}>{status.extra}</span>
        </div>
      )}

      <div style={{ ...C.scGuide, borderColor:pal.bdr }}>
        <span style={{ color:pal.dim, fontSize:11 }}>✦</span>
        <span style={{ ...C.scGuideText, color:"rgba(255,255,255,0.5)" }}>
          {status.type==="bad"
            ? "Delay major decisions until this period ends"
            : status.type==="neutral"
            ? "Minor activities are fine. Stay mindful"
            : "Great window for new beginnings and decisions"}
        </span>
      </div>
    </div>
  );
});

// ─── PERIOD TRACKER ───────────────────────────────────────────────────────────

const PeriodTracker = memo(({ normalized, active, nowMs }) => {
  useTick(1000);
  const now = new Date(nowMs);

  const allPeriods = [
    ...KALAM_PERIODS,
    normalized?.abhijitMuhurta
      ? { key:"abhijitMuhurta", label:"Abhijit Muhurta", type:"good", icon:"☀", color:"#2ed573" }
      : null,
  ].filter(Boolean);

  return (
    <div style={C.tracker}>
      <div style={C.tHead}>
        <span style={C.tTitle}>Period Tracker</span>
        <span style={C.tSub}>Real-time · Updates live</span>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
        {allPeriods.map(period => {
          const rangeStr = normalized?.[period.key];
          if (!rangeStr) return null;
          const range = parseRangeToDate(rangeStr, now);
          if (!range) return (
            <div key={period.key} style={{ ...C.tRow, opacity:0.3, background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.04)" }}>
              <div style={C.tRowMain}>
                <div style={C.tL}>
                  <span style={{ ...C.tIcon, color:period.color }}>{period.icon}</span>
                  <div>
                    <div style={{ ...C.tName, color:"rgba(255,255,255,0.4)" }}>{period.label}</div>
                    <div style={C.tTimes}>Times unavailable</div>
                  </div>
                </div>
                <span style={{ ...C.tPill, background:"rgba(255,255,255,0.04)", color:"#333" }}>—</span>
              </div>
            </div>
          );

          const isLive = now >= range.start && now <= range.end;
          const isDone = now > range.end;
          const isUpcoming = now < range.start;
          const secsLeft  = isLive ? Math.max(0, Math.floor((range.end - now) / 1000)) : 0;
          const secsUntil = isUpcoming ? Math.max(0, Math.floor((range.start - now) / 1000)) : 0;
          const prog = isLive ? Math.min(100, Math.max(0, Math.round((now - range.start) / (range.end - range.start) * 100))) : 0;

          const PILLS = {
            live:     { bg:period.color, fg:"#000", txt:"LIVE" },
            upcoming: { bg:"rgba(255,255,255,0.07)", fg:"#999", txt:"SOON" },
            done:     { bg:"rgba(255,255,255,0.03)", fg:"#444", txt:"DONE" },
          };
          const state = isLive ? "live" : isDone ? "done" : "upcoming";
          const pill = PILLS[state];

          return (
            <div key={period.key} style={{
              ...C.tRow,
              opacity: isDone ? 0.42 : 1,
              background: isLive ? `linear-gradient(135deg,${period.color}12,${period.color}06)` : "rgba(255,255,255,0.02)",
              border: isLive ? `1px solid ${period.color}28` : "1px solid rgba(255,255,255,0.05)",
              boxShadow: isLive ? `0 0 20px ${period.color}15,0 4px 16px rgba(0,0,0,0.3)` : "0 2px 8px rgba(0,0,0,0.2)",
            }}>
              <div style={C.tRowMain}>
                <div style={C.tL}>
                  <span style={{ ...C.tIcon, color:period.color }}>{period.icon}</span>
                  <div>
                    <div style={{ ...C.tName, color:isLive?period.color:"rgba(255,255,255,0.8)" }}>{period.label}</div>
                    <div style={C.tTimes}>{range.startLabel} – {range.endLabel}</div>
                  </div>
                </div>
                <div style={C.tR}>
                  {isLive && <span style={{ ...C.tCdwn, color:period.color }}>{fmtCountdown(secsLeft)}</span>}
                  {isUpcoming && <span style={C.tCdwn}>in {fmtCountdown(secsUntil)}</span>}
                  <span style={{ ...C.tPill, background:pill.bg, color:pill.fg }}>
                    {isLive && <span style={{ ...C.tDot, background:period.color }}/>}
                    {pill.txt}
                  </span>
                </div>
              </div>
              {isLive && (
                <div style={C.tBar}>
                  <div style={{
                    ...C.tBarFill, width:`${prog}%`,
                    background:`linear-gradient(90deg,${period.color}70,${period.color})`,
                    boxShadow:`0 0 6px ${period.color}50`,
                  }}/>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

// ─── SUN & MOON MODULE ────────────────────────────────────────────────────────

const SunMoon = memo(({ normalized, dayProg, nowMs }) => {
  useTick(1000);
  const phase = getDayPhase(dayProg);
  const now = new Date(nowMs);

  const events = [
    { key:"sunrise",  label:"Sunrise",  icon:"🌄", color:"#ffd32a", ring:"#f39c12", dark:"#6b4a00" },
    { key:"sunset",   label:"Sunset",   icon:"🌇", color:"#ff9f43", ring:"#e67e22", dark:"#7a3f00" },
    { key:"moonrise", label:"Moonrise", icon:"🌕", color:"#a29bfe", ring:"#6c5ce7", dark:"#3d2b8a" },
    { key:"moonset",  label:"Moonset",  icon:"🌑", color:"#74b9ff", ring:"#0984e3", dark:"#00427a" },
  ];

  return (
    <div style={C.smCard}>
      <div style={C.smHead}>
        <span style={C.smTitle}>Sun & Moon</span>
        <span style={C.smPhase}>{phase}</span>
      </div>
      <div style={C.smGrid}>
        {events.map(ev => {
          const val = normalized?.[ev.key];
          const hasValidTime = !!val && val !== EMPTY_TIME && parseMins(val) !== null;
          const eventTime = hasValidTime ? parseTimeOnIST(val, now) : null;
          const diffSecs = eventTime ? Math.floor((eventTime - now) / 1000) : null;
          const isPast = diffSecs !== null && diffSecs < -3600;
          const isJustNow = diffSecs !== null && diffSecs >= -3600 && diffSecs < 0;
          const isSoon = diffSecs !== null && diffSecs >= 0;
          const mins = hasValidTime ? parseMins(val) : null;
          const ist = new Date(nowMs + IST_OFFSET_MS);
          const nowMin = ist.getUTCHours() * 60 + ist.getUTCMinutes();
          // Ring: 0→1 as time progresses toward this event
          const ringPct = mins !== null && !isPast
            ? Math.min(99, Math.max(0, Math.round(nowMin / mins * 100)))
            : isPast ? 100 : 0;
          const circ = Math.PI * 2 * 14;

          return (
            <div key={ev.key} style={{
              ...C.smCell,
              background: `linear-gradient(150deg,${ev.color}16,${ev.color}06)`,
              border: `1px solid ${ev.color}20`,
              opacity: isPast ? 0.42 : 1,
            }}>
              <div style={C.smRing}>
                <svg width="38" height="38" viewBox="0 0 38 38">
                  <circle cx="19" cy="19" r="14" fill="none" stroke={`${ev.dark}60`} strokeWidth="3"/>
                  <circle cx="19" cy="19" r="14" fill="none" stroke={ev.ring} strokeWidth="3"
                    strokeDasharray={`${circ * ringPct / 100} ${circ * (1 - ringPct / 100)}`}
                    strokeLinecap="round" transform="rotate(-90 19 19)"
                    style={{ transition:"stroke-dasharray 1.2s ease" }}
                  />
                  <text x="19" y="24" textAnchor="middle" fontSize="14">{ev.icon}</text>
                </svg>
              </div>
              <div style={C.smInfo}>
                <div style={{ ...C.smLabel, color:ev.color }}>{ev.label}</div>
                <div style={C.smTime}>{hasValidTime ? val : EMPTY_TIME}</div>
                <div style={{ ...C.smCd, color:isPast?"#444":`${ev.color}bb` }}>
                  {!hasValidTime ? EMPTY_TIME
                    : isPast ? "Passed"
                    : isJustNow ? "Just now"
                    : isSoon ? `in ${fmtCountdown(diffSecs)}`
                    : "Passed"}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

// ─── DAY ARC ──────────────────────────────────────────────────────────────────

const DayArc = memo(({ normalized, dayProg }) => {
  if (dayProg === null) return null;
  const phase = getDayPhase(dayProg);
  const R = 40, cx = 63, cy = 54;
  const ar = a => (a * Math.PI) / 180;
  const ax = a => cx + R * Math.cos(ar(a));
  const ay = a => cy + R * Math.sin(ar(a));
  const fillA = -180 + (dayProg / 100) * 180;
  const sx = ax(fillA), sy = ay(fillA);
  const track = `M ${ax(-180)} ${ay(-180)} A ${R} ${R} 0 0 1 ${ax(0)} ${ay(0)}`;
  const fill = dayProg > 0 ? `M ${ax(-180)} ${ay(-180)} A ${R} ${R} 0 ${fillA > 0 ? 1 : 0} 1 ${sx} ${sy}` : null;

  return (
    <div style={C.arcCard}>
      <div style={C.arcInner}>
        <div style={{ position:"relative", flexShrink:0 }}>
          <svg width="126" height="66" viewBox="0 0 126 66">
            <path d={track} fill="none" stroke="rgba(255,211,42,0.08)" strokeWidth="6" strokeLinecap="round"/>
            <path d={track} fill="none" stroke="rgba(255,211,42,0.03)" strokeWidth="13" strokeLinecap="round"/>
            {fill && <path d={fill} fill="none" stroke="url(#ag)" strokeWidth="6" strokeLinecap="round"/>}
            {dayProg > 1 && dayProg < 99 && <>
              <circle cx={sx} cy={sy} r="10" fill="rgba(255,211,42,0.12)"/>
              <circle cx={sx} cy={sy} r="6" fill="#ffd32a" style={{ filter:"drop-shadow(0 0 5px #ffd32a)" }}/>
              <circle cx={sx} cy={sy} r="2.7" fill="#fff"/>
            </>}
            <defs>
              <linearGradient id="ag" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f39c12"/>
                <stop offset="100%" stopColor="#ffd32a"/>
              </linearGradient>
            </defs>
          </svg>
          <div style={C.arcPct}>{dayProg}%</div>
          <div style={C.arcPhase}>{phase}</div>
        </div>
        <div style={C.arcTimes}>
          {[
            { icon:"🌄", label:"Sunrise", val:normalized?.sunrise },
            { icon:"🌇", label:"Sunset",  val:normalized?.sunset  },
          ].map(ev => (
            <div key={ev.label} style={C.arcTimeItem}>
              <span style={C.arcIcon}>{ev.icon}</span>
              <div>
                <div style={C.arcTLabel}>{ev.label}</div>
                <div style={C.arcTVal}>{ev.val && ev.val !== "—" ? ev.val : "—"}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

// ─── PANCHANG DETAILS ─────────────────────────────────────────────────────────

const PanCell = memo(({ label, name, lord, endTime, special, summary }) => {
  const [open, setOpen] = useState(false);
  const hasMore = !!(special || summary);
  return (
    <div
      style={{ ...C.panCell, ...(open ? C.panCellOpen : {}) }}
      onClick={() => hasMore && setOpen(o => !o)}
      role={hasMore ? "button" : undefined}
      tabIndex={hasMore ? 0 : undefined}
      onKeyDown={hasMore ? (e => e.key === "Enter" && setOpen(o => !o)) : undefined}
    >
      <div style={C.panTop}>
        <span style={C.panLbl}>{label}</span>
        {endTime && endTime !== "—" && <span style={C.panEnd}>until {endTime}</span>}
      </div>
      <div style={C.panName}>{name || "—"}</div>
      {lord && <div style={C.panLord}>{lord}</div>}
      {hasMore && <span style={{ ...C.panCaret, transform:open?"rotate(90deg)":"rotate(0)" }}>›</span>}
      {open && (
        <div style={C.panExp}>
          {special && <div style={C.panExpLine}>✦ {special}</div>}
          {summary && <div style={C.panExpLine}>{summary}</div>}
        </div>
      )}
    </div>
  );
});

const PanDetails = memo(({ normalized }) => (
  <div style={C.panCard}>
    <div style={C.panHead}>
      <span style={C.panTitle}>Panchang</span>
      <span style={C.panSub}>Celestial positions</span>
    </div>
    <div style={C.panGrid}>
      {[
        { label:"Tithi",     d: normalized?.tithi     },
        { label:"Nakshatra", d: normalized?.nakshatra  },
        { label:"Yoga",      d: normalized?.yoga       },
        { label:"Karana",    d: normalized?.karana     },
      ].map(({ label, d }) => (
        <PanCell key={label} label={label}
          name={d?.name} lord={d?.lord} endTime={d?.endTime}
          special={d?.special} summary={d?.summary}
        />
      ))}
    </div>
  </div>
));

// ─── SKELETON ─────────────────────────────────────────────────────────────────

const Skel = memo(() => (
  <div>
    {[0, 1, 2].map(i => (
      <div key={i} style={{ ...C.skelCard, animationDelay:`${i * 90}ms` }}>
        <div style={{ ...C.skelLine, width:"38%", height:11, marginBottom:14 }}/>
        {[88, 70, 82, 58].map((w, j) => (
          <div key={j} style={{ display:"flex", gap:9, marginBottom:9, alignItems:"center" }}>
            <div style={{ ...C.skelLine, width:26, height:26, borderRadius:"50%", flexShrink:0 }}/>
            <div style={{ ...C.skelLine, width:`${w}%`, height:12 }}/>
          </div>
        ))}
      </div>
    ))}
  </div>
));

// ─── ERROR ────────────────────────────────────────────────────────────────────

const Err = memo(({ msg, retry }) => (
  <div style={C.errCard}>
    <div style={{ fontSize:50, marginBottom:12 }}>🌙</div>
    <div style={C.errTitle}>Data Awaited</div>
    <div style={C.errMsg}>{msg}</div>
    <button style={C.errBtn} onClick={retry}>↻ Retry</button>
  </div>
));

// ─── MAIN ─────────────────────────────────────────────────────────────────────

export default function AstroPage() {
  const [user, setUser]           = useState(null);
  const [loc, setLoc]             = useState("Chennai");
  const [rawData, setRawData]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [saving, setSaving]       = useState(false);
  const loadSeq = useRef(0);
  const today = useMemo(() => getTodayIST(), []);

  // Single shared live clock — city-independent
  const clock = useClock();

  // Normalize raw data whenever it changes
  const normalized = useMemo(() => normalizePanchangData(rawData), [rawData]);

  // Recompute all live state from normalized data + current time
  // This runs on every clock tick via useMemo with clock.now dependency
  const nowMs = clock.now.getTime();

  const { active, next } = useMemo(
    () => computeLiveState(normalized, nowMs),
    [normalized, nowMs]
  );

  const dayProg = useMemo(
    () => computeDayProgress(normalized, nowMs),
    [normalized, nowMs]
  );

  const status = useMemo(
    () => computeSmartStatus(normalized, active, next),
    [normalized, active, next]
  );

  // Auth
  useEffect(() => {
    const auth = getAuth();
    return onAuthStateChanged(auth, u => setUser(u));
  }, []);

  // Load saved location
  useEffect(() => {
    if (!user) return;
    getUserLocation(user.uid).then(setLoc);
  }, [user]);

  // Fetch panchang — resets instantly on city or date change
  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    const requestedLoc = loc;
    setLoading(true);
    setError(null);
    setRawData(null); // clear stale data immediately
    try {
      const d = await fetchPanchang(requestedLoc, today);
      if (seq !== loadSeq.current) return;
      setRawData(d || null);
      if (!d) setError("Panchang data for today is not yet available. Check back after 2 AM IST.");
    } catch {
      if (seq !== loadSeq.current) return;
      setError("Unable to load Panchang. Please try again.");
      setRawData(null);
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [loc, today]);

  useEffect(() => { load(); }, [load]);

  // Location change — instant UI clear + reload
  const handleLoc = useCallback(async e => {
    const l = e.target.value;
    loadSeq.current += 1;
    setLoc(l);
    setRawData(null); // instant clear of old city data
    setError(null);
    setLoading(true);
    if (user) {
      setSaving(true);
      await saveUserLocation(user.uid, l).catch(() => {});
      setSaving(false);
    }
  }, [user]);

  return (
    <div style={R.root}>
      <Hero location={loc} today={today} status={status}/>

      <div style={R.body}>
        <LocSelector location={loc} onChange={handleLoc} saving={saving}/>

        {loading && <Skel/>}
        {!loading && error && <Err msg={error} retry={load}/>}
        {!loading && normalized && <>
          <MetaChips p={normalized}/>
          <StatusCard status={status} active={active} normalized={normalized} nowMs={nowMs}/>
          <PeriodTracker normalized={normalized} active={active} nowMs={nowMs}/>
          <SunMoon normalized={normalized} dayProg={dayProg} nowMs={nowMs}/>
          {normalized.sunrise !== "—" && normalized.sunset !== "—" && (
            <DayArc normalized={normalized} dayProg={dayProg}/>
          )}
          <PanDetails normalized={normalized}/>
          <div style={R.footer}>✦ Refreshes daily at 2 AM IST · Vedic Astrology ✦</div>
        </>}
      </div>

      <style>{CSS}</style>
    </div>
  );
}

// ─── CSS ──────────────────────────────────────────────────────────────────────

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Sora:wght@300;400;500;600;700;800&display=swap');
@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
@keyframes shimmer{0%{background-position:-600px 0}100%{background-position:600px 0}}
@keyframes statusPulse{0%,100%{filter:brightness(1)}50%{filter:brightness(1.06)}}
@keyframes blink{0%,100%{opacity:1}50%{opacity:0.2}}
@keyframes floatOrb{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-18px) scale(1.05)}}
@keyframes orbPulse{0%,100%{opacity:0.5}50%{opacity:0.88}}
@keyframes skelIn{from{opacity:0}to{opacity:1}}
*{box-sizing:border-box;-webkit-font-smoothing:antialiased}
select option{background:#0d0618;color:#e8e0f0}
`;

// ─── HERO STYLES ──────────────────────────────────────────────────────────────

const H = {
  hero: {
    position:"relative", overflow:"hidden", borderRadius:"0 0 20px 20px",
  },
  orb1: { position:"absolute",top:-74,left:-52,width:170,height:170,borderRadius:"50%",background:"radial-gradient(circle,rgba(138,43,226,0.18) 0%,transparent 70%)",animation:"floatOrb 10s ease-in-out infinite",pointerEvents:"none" },
  orb2: { position:"absolute",top:-52,right:-62,width:150,height:150,borderRadius:"50%",background:"radial-gradient(circle,rgba(255,211,42,0.09) 0%,transparent 70%)",animation:"floatOrb 13s ease-in-out infinite reverse",pointerEvents:"none" },
  orb3: { position:"absolute",bottom:8,right:18,width:82,height:82,borderRadius:"50%",background:"radial-gradient(circle,rgba(255,107,107,0.07) 0%,transparent 70%)",animation:"orbPulse 7s ease-in-out infinite",pointerEvents:"none" },
  topBar: { position:"relative",zIndex:2,display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 14px 0" },
  appId:  { display:"flex",alignItems:"center",gap:7 },
  om:     { fontFamily:"'Playfair Display',serif",fontSize:19,color:"#ffd32a",textShadow:"0 0 10px rgba(255,211,42,0.6)",lineHeight:1 },
  appName:{ fontFamily:"'Playfair Display',serif",fontSize:13,fontWeight:600,color:"rgba(255,255,255,0.88)",letterSpacing:"0.04em",lineHeight:1.05 },
  appSub: { fontSize:7.5,color:"rgba(255,255,255,0.3)",letterSpacing:"0.07em",marginTop:0 },
  livePill:{ display:"flex",alignItems:"center",gap:5,background:"rgba(46,213,115,0.09)",border:"1px solid rgba(46,213,115,0.25)",borderRadius:18,padding:"2px 8px" },
  liveDot: { display:"inline-block",width:5,height:5,borderRadius:"50%",background:"#2ed573",animation:"blink 1.3s ease-in-out infinite" },
  liveText:{ fontSize:7.5,fontWeight:800,color:"#2ed573",letterSpacing:"0.11em" },
  center:  { position:"relative",zIndex:2,textAlign:"center",padding:"5px 14px 6px" },
  dateLine: { fontFamily:"'Playfair Display',serif",fontSize:12.5,color:"rgba(255,255,255,0.68)",letterSpacing:"0.02em",marginBottom:3,lineHeight:1.2 },
  locLine:  { display:"flex",alignItems:"center",justifyContent:"center",gap:4 },
  locEmoji: { fontSize:12 },
  locName:  { fontSize:11.5,fontWeight:700,color:"rgba(255,255,255,0.86)" },
  locTag:   { fontSize:9,color:"rgba(255,255,255,0.3)" },
  ribbon:   { position:"relative",zIndex:2,display:"flex",alignItems:"center",gap:7,padding:"6px 14px 7px" },
  ribbonMid:{ flex:1,minWidth:0 },
  ribbonTitle:{ display:"block",fontSize:10.5,fontWeight:800,lineHeight:1.15 },
  ribbonMsg:  { display:"block",fontSize:9,color:"rgba(255,255,255,0.4)",marginTop:1 },
  ribbonExtra:{ fontSize:8.5,color:"rgba(255,255,255,0.3)",fontWeight:600,whiteSpace:"nowrap",flexShrink:0 },
};

// ─── CARD STYLES ──────────────────────────────────────────────────────────────

const C = {
  // Location
  locCard: { display:"flex",alignItems:"center",justifyContent:"space-between",background:"rgba(255,255,255,0.035)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:14,padding:"8px 12px",marginBottom:9,animation:"slideUp 0.38s ease both" },
  locL:    { display:"flex",alignItems:"center",gap:10 },
  locBox:  { width:34,height:34,borderRadius:10,background:"linear-gradient(135deg,rgba(255,211,42,0.13),rgba(138,43,226,0.13))",display:"flex",alignItems:"center",justifyContent:"center" },
  locName: { fontSize:13.5,fontWeight:700,color:"rgba(255,255,255,0.88)" },
  locTag:  { fontSize:10,color:"rgba(255,255,255,0.28)",marginTop:1 },
  locR:    { display:"flex",alignItems:"center",gap:8 },
  saveDot: { width:6,height:6,borderRadius:"50%",background:"#2ed573",animation:"blink 1.2s infinite",display:"inline-block" },
  selWrap: { position:"relative",display:"flex",alignItems:"center" },
  sel:     { appearance:"none",WebkitAppearance:"none",background:"linear-gradient(135deg,rgba(255,211,42,0.09),rgba(138,43,226,0.09))",border:"1px solid rgba(255,211,42,0.16)",borderRadius:12,padding:"7px 28px 7px 12px",fontSize:12,fontWeight:700,color:"#ffd32a",cursor:"pointer",outline:"none",fontFamily:"'Sora',sans-serif" },
  selArrow:{ position:"absolute",right:9,fontSize:11,color:"#ffd32a",pointerEvents:"none" },
  // Chips
  chips: { display:"flex",flexWrap:"wrap",gap:5,marginBottom:9,animation:"slideUp 0.33s ease both" },
  chip:  { fontSize:9,fontWeight:700,background:"rgba(255,255,255,0.055)",border:"1px solid rgba(255,255,255,0.08)",color:"rgba(255,255,255,0.55)",borderRadius:18,padding:"2px 9px",letterSpacing:"0.04em" },
  // Status card
  statusCard:   { borderRadius:18,padding:"12px 12px 10px",marginBottom:9,overflow:"hidden" },
  scTop:        { display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:9,marginBottom:9 },
  scTL:         { display:"flex",alignItems:"flex-start",gap:11 },
  scTitle:      { fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:700,display:"block",lineHeight:1.2 },
  scMsg:        { fontSize:11,color:"rgba(255,255,255,0.42)",display:"block",marginTop:3 },
  scLive:       { display:"inline-flex",alignItems:"center",gap:5,color:"#000",borderRadius:20,padding:"4px 10px",fontSize:9,fontWeight:900,letterSpacing:"0.1em",whiteSpace:"nowrap",flexShrink:0 },
  scLiveDot:    { display:"inline-block",width:5,height:5,borderRadius:"50%",background:"rgba(0,0,0,0.4)",animation:"blink 1s infinite" },
  scPeriod:     { marginBottom:10 },
  scPRow:       { display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6 },
  scPName:      { fontSize:11,fontWeight:700,letterSpacing:"0.03em" },
  scTimer:      { fontSize:17,fontWeight:800,fontVariantNumeric:"tabular-nums",fontFamily:"'Sora',sans-serif" },
  scTrack:      { height:5,borderRadius:99,overflow:"hidden" },
  scFill:       { height:"100%",borderRadius:99,transition:"width 1s cubic-bezier(0.4,0,0.2,1)" },
  scTrackLbls:  { display:"flex",justifyContent:"space-between",marginTop:5 },
  scTLbl:       { fontSize:9,color:"rgba(255,255,255,0.22)",fontWeight:600 },
  scExtra:      { display:"flex",alignItems:"center",gap:7,marginTop:10,paddingTop:10,borderTop:"1px solid" },
  scExtraIcon:  { fontSize:13 },
  scExtraText:  { fontSize:11.5,fontWeight:700 },
  scGuide:      { display:"flex",alignItems:"center",gap:7,marginTop:9,paddingTop:9,borderTop:"1px solid" },
  scGuideText:  { fontSize:10.5,fontStyle:"italic" },
  // Tracker
  tracker: { background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:18,padding:"11px 11px 9px",marginBottom:9,animation:"slideUp 0.48s 0.05s ease both" },
  tHead:   { display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8,paddingBottom:6,borderBottom:"1px solid rgba(255,255,255,0.05)" },
  tTitle:  { fontFamily:"'Playfair Display',serif",fontSize:13,fontWeight:600,color:"rgba(255,255,255,0.82)" },
  tSub:    { fontSize:9.5,color:"rgba(255,255,255,0.26)" },
  tRow:    { borderRadius:12,padding:"8px 10px",transition:"all 0.25s ease" },
  tRowMain:{ display:"flex",justifyContent:"space-between",alignItems:"center",gap:8 },
  tL:      { display:"flex",alignItems:"center",gap:10 },
  tIcon:   { fontSize:15,lineHeight:1,flexShrink:0,fontFamily:"serif" },
  tName:   { fontSize:12,fontWeight:700,lineHeight:1.2,transition:"color 0.2s" },
  tTimes:  { fontSize:10,color:"rgba(255,255,255,0.32)",fontWeight:500,marginTop:2,fontVariantNumeric:"tabular-nums" },
  tR:      { display:"flex",alignItems:"center",gap:7 },
  tCdwn:   { fontSize:11.5,fontWeight:800,fontVariantNumeric:"tabular-nums",color:"rgba(255,255,255,0.42)" },
  tPill:   { display:"inline-flex",alignItems:"center",gap:4,fontSize:8.5,fontWeight:800,letterSpacing:"0.07em",borderRadius:20,padding:"2px 8px",whiteSpace:"nowrap" },
  tDot:    { display:"inline-block",width:4,height:4,borderRadius:"50%",animation:"blink 1.2s infinite" },
  tBar:    { height:3,borderRadius:99,background:"rgba(255,255,255,0.05)",marginTop:7,overflow:"hidden" },
  tBarFill:{ height:"100%",borderRadius:99,transition:"width 1s cubic-bezier(0.4,0,0.2,1)" },
  // Sun Moon
  smCard:  { background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:18,padding:"9px 10px 10px",marginBottom:9,animation:"slideUp 0.48s 0.1s ease both" },
  smHead:  { display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:7,paddingBottom:5,borderBottom:"1px solid rgba(255,255,255,0.05)" },
  smTitle: { fontFamily:"'Playfair Display',serif",fontSize:12.5,fontWeight:600,color:"rgba(255,255,255,0.82)" },
  smPhase: { fontSize:8.5,color:"rgba(255,255,255,0.26)",fontWeight:600,letterSpacing:"0.05em" },
  smGrid:  { display:"grid",gridTemplateColumns:"1fr 1fr",gap:6 },
  smCell:  { borderRadius:12,padding:"7px 8px 6px",display:"flex",flexDirection:"row",alignItems:"center",gap:7,transition:"opacity 0.3s",minHeight:54 },
  smRing:  { flexShrink:0 },
  smInfo:  { textAlign:"left",width:"100%",minWidth:0 },
  smLabel: { fontSize:8.5,fontWeight:700,letterSpacing:"0.05em",display:"block",marginBottom:1,whiteSpace:"nowrap" },
  smTime:  { fontSize:12.5,fontWeight:800,color:"rgba(255,255,255,0.88)",fontVariantNumeric:"tabular-nums",whiteSpace:"nowrap" },
  smCd:    { fontSize:8.5,fontWeight:600,marginTop:1,display:"block",whiteSpace:"nowrap" },
  // Arc
  arcCard:    { background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:18,padding:"9px 10px 8px",marginBottom:9,animation:"slideUp 0.48s 0.15s ease both" },
  arcInner:   { display:"flex",alignItems:"center",gap:9 },
  arcPct:     { position:"absolute",bottom:8,left:0,right:0,textAlign:"center",fontSize:14.5,fontWeight:800,color:"#ffd32a",fontVariantNumeric:"tabular-nums",fontFamily:"'Sora',sans-serif" },
  arcPhase:   { fontSize:8,fontWeight:700,color:"rgba(255,211,42,0.55)",textTransform:"uppercase",letterSpacing:"0.08em",textAlign:"center",marginTop:0 },
  arcTimes:   { flex:1,display:"flex",flexDirection:"column",gap:0 },
  arcTimeItem:{ display:"flex",alignItems:"center",gap:8,padding:"4px 0" },
  arcIcon:    { fontSize:15,lineHeight:1,width:19,textAlign:"center" },
  arcTLabel:  { fontSize:8.5,color:"rgba(255,255,255,0.32)",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em" },
  arcTVal:    { fontSize:12.5,fontWeight:800,color:"rgba(255,255,255,0.86)",fontVariantNumeric:"tabular-nums" },
  // Panchang
  panCard:    { background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:18,padding:"11px 10px 11px",marginBottom:9,animation:"slideUp 0.48s 0.2s ease both" },
  panHead:    { display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8,paddingBottom:6,borderBottom:"1px solid rgba(255,255,255,0.05)" },
  panTitle:   { fontFamily:"'Playfair Display',serif",fontSize:13,fontWeight:600,color:"rgba(255,255,255,0.82)" },
  panSub:     { fontSize:9.5,color:"rgba(255,255,255,0.26)" },
  panGrid:    { display:"grid",gridTemplateColumns:"1fr 1fr",gap:6 },
  panCell:    { background:"linear-gradient(145deg,rgba(138,43,226,0.1),rgba(255,211,42,0.055))",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,padding:"9px 10px",cursor:"default",transition:"all 0.2s ease",position:"relative",userSelect:"none" },
  panCellOpen:{ background:"linear-gradient(145deg,rgba(138,43,226,0.18),rgba(255,211,42,0.09))",boxShadow:"0 0 0 1px rgba(138,43,226,0.28)" },
  panTop:     { display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4 },
  panLbl:     { fontSize:9,fontWeight:800,color:"rgba(138,43,226,0.85)",textTransform:"uppercase",letterSpacing:"0.09em" },
  panEnd:     { fontSize:8.5,color:"rgba(255,255,255,0.28)",fontWeight:600 },
  panName:    { fontSize:13.5,fontWeight:800,color:"rgba(255,255,255,0.86)",lineHeight:1.2,marginBottom:2 },
  panLord:    { fontSize:9.5,color:"rgba(255,255,255,0.32)",fontWeight:500,marginTop:2 },
  panCaret:   { position:"absolute",bottom:8,right:10,fontSize:15,color:"rgba(138,43,226,0.65)",fontWeight:700,transition:"transform 0.2s ease",lineHeight:1 },
  panExp:     { marginTop:8,paddingTop:7,borderTop:"1px solid rgba(255,255,255,0.07)" },
  panExpLine: { fontSize:10,color:"rgba(200,180,255,0.7)",fontWeight:500,lineHeight:1.55,marginBottom:3 },
  // Skeleton
  skelCard:  { background:"rgba(255,255,255,0.02)",borderRadius:18,padding:"13px 12px 14px",marginBottom:9,animation:"skelIn 0.4s ease both" },
  skelLine:  { borderRadius:6,background:"linear-gradient(90deg,rgba(255,255,255,0.04) 25%,rgba(255,255,255,0.08) 50%,rgba(255,255,255,0.04) 75%)",backgroundSize:"800px 100%",animation:"shimmer 1.6s infinite linear" },
  // Error
  errCard:   { background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:22,padding:"38px 24px",textAlign:"center",animation:"slideUp 0.4s ease both" },
  errTitle:  { fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:600,color:"rgba(200,160,255,0.88)",marginBottom:8 },
  errMsg:    { fontSize:12.5,color:"rgba(255,255,255,0.38)",lineHeight:1.65,marginBottom:22 },
  errBtn:    { background:"linear-gradient(135deg,#6c3fd4,#b24eff)",color:"#fff",border:"none",borderRadius:28,padding:"10px 30px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Sora',sans-serif",boxShadow:"0 4px 16px rgba(138,43,226,0.35)" },
};

// ─── ROOT STYLES ──────────────────────────────────────────────────────────────

const R = {
  root:   { fontFamily:"'Sora',sans-serif",minHeight:"100vh",background:"#080510",color:"rgba(255,255,255,0.85)",overflowX:"hidden",paddingBottom:64 },
  body:   { maxWidth:480,margin:"0 auto",padding:"9px 10px 0",position:"relative",zIndex:1 },
  footer: { textAlign:"center",fontSize:10,color:"rgba(255,255,255,0.18)",marginTop:10,fontStyle:"italic",letterSpacing:"0.03em" },
};
