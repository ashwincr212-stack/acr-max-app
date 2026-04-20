// AstroDaily.jsx
// Your original Astro.jsx — preserved 100% in design, logic, and structure.
// Changes from original:
//   1. Accepts props: { location, lang, onBack } — no internal location state needed
//   2. Firestore doc ID now includes lang: panchang/{date}_{location}_{lang}
//   3. normalizePanchangData now also reads from doc.normalized (your backend shape)
//   4. Adds back button in hero replacing the location-embedded header

import React, {
  useState, useEffect, useCallback, useMemo, memo, useRef,
} from "react";
import { db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

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

const IST_OFFSET_MS = 5.5 * 3600000;

// ─── TIME HELPERS (identical to original Astro.jsx) ───────────────────────────

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
  const hour = Number(hourRaw), minute = Number(minuteRaw);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return EMPTY_TIME;
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return EMPTY_TIME;
  return `${hour}:${String(minute).padStart(2,"0")} ${merRaw.toUpperCase()}`;
}

function cleanTime(raw) {
  if (raw === null || raw === undefined) return EMPTY_TIME;
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw.toLocaleTimeString("en-IN", { hour:"numeric",minute:"2-digit",hour12:true }).toUpperCase();
  }
  if (typeof raw !== "string" && typeof raw !== "number") return EMPTY_TIME;
  const trimmed = String(raw).trim();
  if (!trimmed) return EMPTY_TIME;
  const direct = trimmed.match(TIME_RE);
  if (direct) return canonicalTimeFromParts(direct[1], direct[2], `${direct[4]}${direct[5]}`);
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleTimeString("en-IN", { hour:"numeric",minute:"2-digit",hour12:true }).toUpperCase();
  }
  return EMPTY_TIME;
}

function cleanRange(raw) {
  if (!raw || typeof raw !== "string") return "";
  const norm = raw
    .replace(/Ã¢â‚¬[\u0093\u0094\u0095]/g,"-")
    .replace(/â€"|â€"|–|—|−/g,"-")
    .replace(/\s+to\s+/gi," - ").trim();
  const matches = [...norm.matchAll(new RegExp(TIME_RE.source,"gi"))];
  if (matches.length >= 2) {
    const s = canonicalTimeFromParts(matches[0][1],matches[0][2],`${matches[0][4]}${matches[0][5]}`);
    const e = canonicalTimeFromParts(matches[1][1],matches[1][2],`${matches[1][4]}${matches[1][5]}`);
    if (s !== EMPTY_TIME && e !== EMPTY_TIME) return `${s} - ${e}`;
  }
  const parts = norm.split(/\s+-\s+|\s*-\s*|\s+to\s+/i).map(p=>p.trim()).filter(Boolean);
  if (parts.length < 2) return "";
  const s = cleanTime(parts[0]), e = cleanTime(parts[parts.length-1]);
  if (s === EMPTY_TIME || e === EMPTY_TIME) return "";
  return `${s} - ${e}`;
}

function parseMins(ts) {
  if (!ts || ts === EMPTY_TIME) return null;
  const m = String(ts).match(TIME_RE);
  if (!m) return null;
  let h = parseInt(m[1],10), mn = parseInt(m[2],10), mer = `${m[4]}${m[5]}`.toUpperCase();
  if (h < 1 || h > 12 || mn < 0 || mn > 59) return null;
  if (mer === "AM" && h === 12) h = 0;
  if (mer === "PM" && h !== 12) h += 12;
  return h * 60 + mn;
}

function parseTimeOnIST(ts, ref = new Date()) {
  const mn = parseMins(ts);
  if (mn === null) return null;
  const { year, month, day } = getISTDateParts(ref);
  return new Date(Date.UTC(year, month, day, Math.floor(mn/60), mn%60) - IST_OFFSET_MS);
}

function parseRangeToDate(canonicalRange, ref = new Date()) {
  if (!canonicalRange) return null;
  const parts = canonicalRange.split(" - ");
  if (parts.length !== 2) return null;
  const s = parseTimeOnIST(parts[0].trim(), ref);
  const e = parseTimeOnIST(parts[1].trim(), ref);
  if (!s || !e) return null;
  return { start:s, end:e, startLabel:parts[0].trim(), endLabel:parts[1].trim() };
}

function nowISTFull() {
  const ist = new Date(Date.now() + IST_OFFSET_MS);
  const h = ist.getUTCHours(), mn = ist.getUTCMinutes(), s = ist.getUTCSeconds();
  const mer = h >= 12 ? "PM" : "AM", h12 = h % 12 || 12;
  return {
    display:`${h12}:${String(mn).padStart(2,"0")}:${String(s).padStart(2,"0")} ${mer}`,
    short:`${h12}:${String(mn).padStart(2,"0")} ${mer}`,
    totalMinutes:h*60+mn, totalSeconds:h*3600+mn*60+s,
    h,mn,s,mer,h12, now:new Date(),
  };
}

function fmtCountdown(secs) {
  if (secs <= 0) return "ending";
  const h=Math.floor(secs/3600), m=Math.floor((secs%3600)/60), s=secs%60;
  if (h>0) return `${h}h ${m}m`;
  if (m>0) return `${m}m ${s}s`;
  return `${s}s`;
}

function getDayPhase(pct) {
  if (pct===null||pct===undefined) return "Night";
  if (pct<5)  return "Dawn";
  if (pct<20) return "Morning";
  if (pct<45) return "Late Morning";
  if (pct<55) return "Noon";
  if (pct<75) return "Afternoon";
  if (pct<90) return "Evening";
  return "Dusk";
}

// ─── NORMALIZATION ───────────────────────────────────────────────────────────
// Extended from original: also reads from doc.normalized (your backend shape)
// so it works with both the old panchang/{date}_{loc} and new {date}_{loc}_{lang} docs.

function normalizePanchangData(raw) {
  if (!raw || typeof raw !== "object") return null;
  const ct = (v) => cleanTime(v);
  const cr = (v) => cleanRange(v);

  // Prefer backend-normalized English timing fields. Raw Panchang can be
  // translated, so it is only a fallback for old documents.
  const n = raw.normalized || {};
  const sourceRaw = raw.rawPanchang || raw;

  const normalizeDetail = (obj) => {
    if (!obj || typeof obj !== "object") return null;
    return {
      name:    obj.name    || obj.Name    || obj.title  || "",
      lord:    obj.lord    || obj.Lord    || obj.deity  || "",
      endTime: ct(obj.endTime||obj.end_time||obj.EndTime||obj.ends||obj.end||""),
      special: obj.special || obj.Special || obj.note   || "",
      summary: obj.summary || obj.Summary || obj.desc   || "",
    };
  };

  const pick = (...keys) => {
    for (const k of keys) {
      const v = n[k] ?? sourceRaw[k];
      if (v !== undefined && v !== null && v !== "") return v;
    }
    return "";
  };

  return {
    sunrise:  ct(pick("sunrise","Sunrise")),
    sunset:   ct(pick("sunset","Sunset")),
    moonrise: ct(pick("moonrise","Moonrise")),
    moonset:  ct(pick("moonset","Moonset")),
    rahuKalam:      cr(pick("rahuKalam","rahu_kalam","rahukalam")),
    yamagandam:     cr(pick("yamagandam","yama_gandam","Yamagandam")),
    gulikaKalam:    cr(pick("gulikaKalam","gulika_kalam","gulikakalam")),
    abhijitMuhurta: cr(pick("abhijitMuhurta","abhijit_muhurta","abhijit")),
    tithi:     normalizeDetail((typeof n.tithi==="object" ? n.tithi : null)         || sourceRaw.tithi     || sourceRaw.Tithi),
    nakshatra: normalizeDetail((typeof n.nakshatra==="object" ? n.nakshatra : null) || sourceRaw.nakshatra || sourceRaw.Nakshatra),
    yoga:      normalizeDetail((typeof n.yoga==="object" ? n.yoga : null)           || sourceRaw.yoga      || sourceRaw.Yoga),
    karana:    normalizeDetail((typeof n.karana==="object" ? n.karana : null)       || sourceRaw.karana    || sourceRaw.Karana),
    varName:   pick("varName","var_name","dayName","vara"),
    masaName:  pick("masaName","masa_name","masa","month"),
    paksha:    pick("paksha","Paksha"),
    samvat:    pick("samvat","Samvat"),
  };
}

function buildDisplayPanchangData(raw, normalized) {
  if (!raw || typeof raw !== "object") return normalized;

  const rawPanchang = raw.rawPanchang || raw;
  const adv = rawPanchang.advanced_details || {};
  const masa = adv.masa || {};

  const firstText = (...values) => {
    for (const value of values) {
      if (value !== undefined && value !== null && value !== "") return value;
    }
    return "";
  };

  const displayDetail = (rawDetail, normalizedDetail) => {
    const detail = rawDetail && typeof rawDetail === "object" ? rawDetail : {};
    const fallback = normalizedDetail && typeof normalizedDetail === "object" ? normalizedDetail : {};
    const nextValue = firstText(
      detail.next_tithi,
      detail.next_nakshatra,
      detail.next_yoga,
      detail.next_karana,
      fallback.next
    );

    return {
      name: firstText(detail.name, detail.Name, detail.title, fallback.name),
      number: firstText(detail.number, fallback.number),
      type: firstText(detail.type, fallback.type),
      pada: firstText(detail.pada, fallback.pada),
      lord: firstText(detail.lord, detail.Lord, fallback.lord),
      deity: firstText(detail.deity, detail.diety, detail.Deity, fallback.deity),
      startTime: firstText(fallback.startTime, cleanTime(detail.start), cleanTime(detail.startTime), cleanTime(detail.begins)),
      endTime: firstText(fallback.endTime, cleanTime(detail.end), cleanTime(detail.endTime), cleanTime(detail.ends)),
      next: nextValue,
      meaning: firstText(detail.meaning, detail.Meaning, fallback.meaning),
      special: firstText(detail.special, detail.Special, detail.note, fallback.special),
      summary: firstText(detail.summary, detail.Summary, detail.desc, fallback.summary),
      auspiciousDisha: Array.isArray(detail.auspicious_disha)
        ? detail.auspicious_disha
        : Array.isArray(fallback.auspiciousDisha)
          ? fallback.auspiciousDisha
          : [],
    };
  };

  return {
    ...normalized,
    varName: firstText(adv.vaara, rawPanchang.day?.name, rawPanchang.var_name, normalized?.varName),
    masaName: firstText(masa.amanta_name, rawPanchang.masa_name, normalized?.masaName),
    paksha: firstText(masa.paksha, rawPanchang.paksha, normalized?.paksha),
    samvat: firstText(adv.years?.vikram_samvaat_name, rawPanchang.samvat_name, normalized?.samvat),
    tithi: displayDetail(rawPanchang.tithi || rawPanchang.Tithi, normalized?.tithi),
    nakshatra: displayDetail(rawPanchang.nakshatra || rawPanchang.Nakshatra, normalized?.nakshatra),
    yoga: displayDetail(rawPanchang.yoga || rawPanchang.Yoga, normalized?.yoga),
    karana: displayDetail(rawPanchang.karana || rawPanchang.Karana, normalized?.karana),
  };
}

// ─── LIVE COMPUTATIONS ───────────────────────────────────────────────────────

function computeLiveState(normalized, nowMs) {
  if (!normalized) return { active:null, next:null };
  const now = new Date(nowMs);
  let active = null;
  for (const p of KALAM_PERIODS) {
    const r = parseRangeToDate(normalized[p.key], now);
    if (r && now >= r.start && now <= r.end) { active=p; break; }
  }
  let next = null;
  for (const p of KALAM_PERIODS) {
    const r = parseRangeToDate(normalized[p.key], now);
    if (!r || r.start <= now) continue;
    const secs = Math.floor((r.start - now)/1000);
    if (!next || secs < next.secs) next = { ...p, secs };
  }
  return { active, next };
}

function computeDayProgress(normalized, nowMs) {
  if (!normalized) return null;
  const sr = parseMins(normalized.sunrise), ss = parseMins(normalized.sunset);
  if (sr===null || ss===null || ss<=sr) return null;
  const ist = new Date(nowMs + IST_OFFSET_MS);
  const nowMin = ist.getUTCHours()*60+ist.getUTCMinutes();
  const total=ss-sr, elapsed=Math.min(Math.max(nowMin-sr,0),total);
  return Math.round((elapsed/total)*100);
}

function computeSmartStatus(normalized, active, next) {
  if (!normalized) return null;
  if (active) {
    const r = parseRangeToDate(normalized[active.key], new Date());
    return {
      type: active.type==="neutral"?"neutral":"bad",
      icon: active.type==="neutral"?"⚡":"🔴",
      title:`${active.label} Active`,
      message: GUIDANCE[active.type==="neutral"?"neutral":"bad"],
      extra: r ? `Ends ${r.endLabel}` : "",
      color: active.color,
    };
  }
  if (next) return { type:"good",icon:"✨",title:"Auspicious Time",message:GUIDANCE.good,extra:`Next: ${next.label} in ${fmtCountdown(next.secs)}`,color:"#2ed573" };
  if (KALAM_PERIODS.some(k => parseRangeToDate(normalized[k.key], new Date()))) {
    return { type:"good",icon:"✨",title:"Auspicious Time",message:GUIDANCE.good,extra:"",color:"#2ed573" };
  }
  return { type:"neutral",icon:"🕐",title:"Status Unknown",message:"Panchang times unavailable",extra:"",color:"#a29bfe" };
}

// ─── HOOKS ───────────────────────────────────────────────────────────────────

function useClock() {
  const [t, set] = useState(() => nowISTFull());
  useEffect(() => { const id=setInterval(()=>set(nowISTFull()),1000); return ()=>clearInterval(id); },[]);
  return t;
}

function useTick(ms=1000) {
  const [t,s] = useState(0);
  useEffect(() => { const id=setInterval(()=>s(v=>v+1),ms); return ()=>clearInterval(id); },[ms]);
  return t;
}

// ─── STAR PARTICLES (identical to original) ───────────────────────────────────

const Stars = memo(() => {
  const stars = useMemo(()=>Array.from({length:28},(_,i)=>({
    id:i,x:Math.random()*100,y:Math.random()*100,
    r:0.4+Math.random()*1.0,d:1.8+Math.random()*3,del:Math.random()*5,
  })),[]);
  return (
    <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none",overflow:"hidden"}} xmlns="http://www.w3.org/2000/svg">
      {stars.map(s=>(
        <circle key={s.id} cx={`${s.x}%`} cy={`${s.y}%`} r={s.r} fill="rgba(255,220,130,0.75)">
          <animate attributeName="opacity" values="0.1;0.85;0.1" dur={`${s.d}s`} begin={`${s.del}s`} repeatCount="indefinite"/>
        </circle>
      ))}
    </svg>
  );
});

// ─── HERO (updated: back button instead of standalone location display) ───────

const Hero = memo(({ today, onBack }) => {
  return (
    <div style={H.hero}>
      <div style={{ position:"absolute",inset:0,overflow:"hidden",borderRadius:"0 0 26px 26px" }}>
        <Stars/>
        <div style={H.orb1}/><div style={H.orb2}/><div style={H.orb3}/>
      </div>
      {/* Back button */}
      <button style={H.backBtn} onClick={onBack} aria-label="Back to Jyotish">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <div style={H.topBar}>
        <div style={H.appId}>
          <span style={H.om}>ॐ</span>
          <div>
            <div style={H.appName}>Daily Panchang</div>
            <div style={H.appSub}>Vedic Celestial Guide</div>
          </div>
        </div>
        <div style={H.livePill}>
          <span style={H.liveDot}/><span style={H.liveText}>LIVE</span>
        </div>
      </div>
      <div style={H.center}>
        <div style={H.dateLine}>{formatDateFull(today)}</div>
      </div>
    </div>
  );
});

// ─── META CHIPS ───────────────────────────────────────────────────────────────

const MetaChips = memo(({ p }) => {
  const chips = [p.varName, p.masaName && `${p.masaName} Masa`, p.paksha, p.samvat].filter(Boolean);
  if (!chips.length) return null;
  return (
    <div style={C.chips}>
      {chips.map((c,i)=><span key={i} style={C.chip}>{c}</span>)}
    </div>
  );
});

// ─── STATUS CARD (identical to original) ──────────────────────────────────────

const StatusCard = memo(({ status, active, normalized, nowMs }) => {
  useTick(1000);
  if (!status) return null;
  const secsLeft = active ? (() => {
    const r = parseRangeToDate(normalized?.[active.key], new Date(nowMs));
    return r ? Math.max(0, Math.floor((r.end - new Date(nowMs))/1000)) : 0;
  })() : 0;
  const prog = active ? (() => {
    const r = parseRangeToDate(normalized?.[active.key], new Date(nowMs));
    if (!r) return 0;
    return Math.min(100, Math.max(0, Math.round((new Date(nowMs)-r.start)/(r.end-r.start)*100)));
  })() : 0;
  const PAL = {
    bad:     { bg:"linear-gradient(140deg,#fff7ed,#fff1f2)",bdr:"rgba(220,38,38,0.16)", acc:"#dc2626",dim:"#b91c1c",track:"rgba(220,38,38,0.1)" },
    neutral: { bg:"linear-gradient(140deg,#fffbeb,#fff7ed)",bdr:"rgba(217,119,6,0.18)",  acc:"#d97706",dim:"#b45309",track:"rgba(217,119,6,0.12)"  },
    good:    { bg:"linear-gradient(140deg,#f0fdf4,#eff6ff)",bdr:"rgba(22,163,74,0.16)",   acc:"#16a34a",dim:"#15803d",track:"rgba(22,163,74,0.1)"  },
  };
  const pal = PAL[status.type] || PAL.good;
  const isLive = !!active;
  return (
    <div style={{...C.statusCard,background:pal.bg,border:`1px solid ${pal.bdr}`,boxShadow:isLive?`0 18px 42px ${pal.bdr}`:"0 12px 30px rgba(15,23,42,0.08)",animation:isLive?"statusPulse 3s ease-in-out infinite,slideUp 0.45s ease both":"slideUp 0.45s ease both"}}>
      <div style={C.scTop}>
        <div style={C.scTL}>
          <span style={{fontSize:26,lineHeight:1}}>{status.icon}</span>
          <div>
            <div style={{...C.scTitle,color:pal.acc}}>{status.title}</div>
            <div style={C.scMsg}>{status.message}</div>
          </div>
        </div>
        {isLive && <div style={{...C.scLive,background:`linear-gradient(135deg,${pal.dim},${pal.acc})`}}><span style={C.scLiveDot}/>LIVE</div>}
      </div>
      {isLive && active && (
        <div style={C.scPeriod}>
          <div style={C.scPRow}>
            <span style={{...C.scPName,color:pal.acc}}>{active.label} — ends in</span>
            <span style={{...C.scTimer,color:pal.acc}}>{fmtCountdown(secsLeft)}</span>
          </div>
          <div style={{...C.scTrack,background:pal.track}}>
            <div style={{...C.scFill,width:`${prog}%`,background:`linear-gradient(90deg,${pal.dim},${pal.acc})`,boxShadow:`0 0 8px ${pal.acc}60`}}/>
          </div>
          <div style={C.scTrackLbls}>
            <span style={C.scTLbl}>Started</span>
            <span style={{...C.scTLbl,color:"#666"}}>{100-prog}% left</span>
            <span style={C.scTLbl}>Ends</span>
          </div>
        </div>
      )}
      {status.extra && (
        <div style={{...C.scExtra,borderColor:pal.bdr}}>
          <span style={{...C.scExtraIcon,color:pal.acc}}>⏭</span>
          <span style={{...C.scExtraText,color:pal.acc}}>{status.extra}</span>
        </div>
      )}
      <div style={{...C.scGuide,borderColor:pal.bdr}}>
        <span style={{color:pal.dim,fontSize:11}}>✦</span>
        <span style={{...C.scGuideText,color:"#64748b"}}>
          {status.type==="bad"?"Delay major decisions until this period ends":status.type==="neutral"?"Minor activities are fine. Stay mindful":"Great window for new beginnings and decisions"}
        </span>
      </div>
    </div>
  );
});

// ─── PERIOD TRACKER (identical to original) ───────────────────────────────────

const PeriodTracker = memo(({ normalized, active, nowMs }) => {
  useTick(1000);
  const now = new Date(nowMs);
  const allPeriods = [
    ...KALAM_PERIODS,
    normalized?.abhijitMuhurta ? { key:"abhijitMuhurta",label:"Abhijit Muhurta",type:"good",icon:"☀",color:"#2ed573" } : null,
  ].filter(Boolean);
  return (
    <div style={C.tracker}>
      <div style={C.tHead}>
        <span style={C.tTitle}>Period Tracker</span>
        <span style={C.tSub}>Real-time · Updates live</span>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:7}}>
        {allPeriods.map(period => {
          const rangeStr = normalized?.[period.key];
          if (!rangeStr) return null;
          const range = parseRangeToDate(rangeStr, now);
          if (!range) return (
            <div key={period.key} style={{...C.tRow,opacity:0.55,background:"rgba(248,250,252,0.7)",border:"1px solid rgba(148,163,184,0.14)"}}>
              <div style={C.tRowMain}>
                <div style={C.tL}>
                  <span style={{...C.tIcon,color:period.color}}>{period.icon}</span>
                  <div><div style={{...C.tName,color:"#94a3b8"}}>{period.label}</div><div style={C.tTimes}>Times unavailable</div></div>
                </div>
                <span style={{...C.tPill,background:"rgba(148,163,184,0.12)",color:"#94a3b8"}}>—</span>
              </div>
            </div>
          );
          const isLive=now>=range.start&&now<=range.end, isDone=now>range.end, isUpcoming=now<range.start;
          const secsLeft=isLive?Math.max(0,Math.floor((range.end-now)/1000)):0;
          const secsUntil=isUpcoming?Math.max(0,Math.floor((range.start-now)/1000)):0;
          const prog=isLive?Math.min(100,Math.max(0,Math.round((now-range.start)/(range.end-range.start)*100))):0;
          const PILLS={live:{bg:period.color,fg:"#fff",txt:"LIVE"},upcoming:{bg:"rgba(148,163,184,0.14)",fg:"#64748b",txt:"SOON"},done:{bg:"rgba(148,163,184,0.1)",fg:"#94a3b8",txt:"DONE"}};
          const state=isLive?"live":isDone?"done":"upcoming"; const pill=PILLS[state];
          return (
            <div key={period.key} style={{...C.tRow,opacity:isDone?0.52:1,background:isLive?`linear-gradient(135deg,${period.color}14,#ffffff)`:"rgba(248,250,252,0.78)",border:isLive?`1px solid ${period.color}35`:"1px solid rgba(148,163,184,0.14)",boxShadow:isLive?`0 12px 24px ${period.color}18`:"0 4px 12px rgba(15,23,42,0.04)"}}>
              <div style={C.tRowMain}>
                <div style={C.tL}>
                  <span style={{...C.tIcon,color:period.color}}>{period.icon}</span>
                  <div>
                    <div style={{...C.tName,color:isLive?period.color:"#1f2937"}}>{period.label}</div>
                    <div style={C.tTimes}>{range.startLabel} – {range.endLabel}</div>
                  </div>
                </div>
                <div style={C.tR}>
                  {isLive&&<span style={{...C.tCdwn,color:period.color}}>{fmtCountdown(secsLeft)}</span>}
                  {isUpcoming&&<span style={C.tCdwn}>in {fmtCountdown(secsUntil)}</span>}
                  <span style={{...C.tPill,background:pill.bg,color:pill.fg}}>
                    {isLive&&<span style={{...C.tDot,background:period.color}}/>}
                    {pill.txt}
                  </span>
                </div>
              </div>
              {isLive&&<div style={C.tBar}><div style={{...C.tBarFill,width:`${prog}%`,background:`linear-gradient(90deg,${period.color}70,${period.color})`,boxShadow:`0 0 6px ${period.color}50`}}/></div>}
            </div>
          );
        })}
      </div>
    </div>
  );
});

// ─── SUN & MOON (identical to original) ──────────────────────────────────────

const SunMoon = memo(({ normalized, dayProg, nowMs }) => {
  useTick(1000);
  const phase = getDayPhase(dayProg);
  const now = new Date(nowMs);
  const events = [
    {key:"sunrise",label:"Sunrise",icon:"🌄",color:"#ffd32a",ring:"#f39c12",dark:"#6b4a00"},
    {key:"sunset",label:"Sunset",icon:"🌇",color:"#ff9f43",ring:"#e67e22",dark:"#7a3f00"},
    {key:"moonrise",label:"Moonrise",icon:"🌕",color:"#a29bfe",ring:"#6c5ce7",dark:"#3d2b8a"},
    {key:"moonset",label:"Moonset",icon:"🌑",color:"#74b9ff",ring:"#0984e3",dark:"#00427a"},
  ];
  return (
    <div style={C.smCard}>
      <div style={C.smHead}><span style={C.smTitle}>Sun & Moon</span><span style={C.smPhase}>{phase}</span></div>
      <div style={C.smGrid}>
        {events.map(ev=>{
          const val=normalized?.[ev.key];
          const hasValidTime=!!val&&val!==EMPTY_TIME&&parseMins(val)!==null;
          const eventTime=hasValidTime?parseTimeOnIST(val,now):null;
          const diffSecs=eventTime?Math.floor((eventTime-now)/1000):null;
          const isPast=diffSecs!==null&&diffSecs<-3600;
          const isJustNow=diffSecs!==null&&diffSecs>=-3600&&diffSecs<0;
          const isSoon=diffSecs!==null&&diffSecs>=0;
          const mins=hasValidTime?parseMins(val):null;
          const ist=new Date(nowMs+IST_OFFSET_MS);
          const nowMin=ist.getUTCHours()*60+ist.getUTCMinutes();
          const ringPct=mins!==null&&!isPast?Math.min(99,Math.max(0,Math.round(nowMin/mins*100))):isPast?100:0;
          const circ=Math.PI*2*14;
          return (
            <div key={ev.key} style={{...C.smCell,background:`linear-gradient(150deg,${ev.color}16,${ev.color}06)`,border:`1px solid ${ev.color}20`,opacity:isPast?0.42:1}}>
              <div style={C.smRing}>
                <svg width="38" height="38" viewBox="0 0 38 38">
                  <circle cx="19" cy="19" r="14" fill="none" stroke={`${ev.dark}60`} strokeWidth="3"/>
                  <circle cx="19" cy="19" r="14" fill="none" stroke={ev.ring} strokeWidth="3"
                    strokeDasharray={`${circ*ringPct/100} ${circ*(1-ringPct/100)}`}
                    strokeLinecap="round" transform="rotate(-90 19 19)"
                    style={{transition:"stroke-dasharray 1.2s ease"}}/>
                  <text x="19" y="24" textAnchor="middle" fontSize="14">{ev.icon}</text>
                </svg>
              </div>
              <div style={C.smInfo}>
                <div style={{...C.smLabel,color:ev.color}}>{ev.label}</div>
                <div style={C.smTime}>{hasValidTime?val:EMPTY_TIME}</div>
                <div style={{...C.smCd,color:isPast?"#444":`${ev.color}bb`}}>
                  {!hasValidTime?EMPTY_TIME:isPast?"Passed":isJustNow?"Just now":isSoon?`in ${fmtCountdown(diffSecs)}`:"Passed"}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

// ─── DAY ARC (identical to original) ─────────────────────────────────────────

const DayArc = memo(({ normalized, dayProg }) => {
  if (dayProg===null) return null;
  const phase=getDayPhase(dayProg),R=40,cx=63,cy=54;
  const ar=a=>(a*Math.PI)/180,ax=a=>cx+R*Math.cos(ar(a)),ay=a=>cy+R*Math.sin(ar(a));
  const fillA=-180+(dayProg/100)*180,sx=ax(fillA),sy=ay(fillA);
  const track=`M ${ax(-180)} ${ay(-180)} A ${R} ${R} 0 0 1 ${ax(0)} ${ay(0)}`;
  const fill=dayProg>0?`M ${ax(-180)} ${ay(-180)} A ${R} ${R} 0 ${fillA>0?1:0} 1 ${sx} ${sy}`:null;
  return (
    <div style={C.arcCard}>
      <div style={C.arcInner}>
        <div style={{position:"relative",flexShrink:0}}>
          <svg width="126" height="66" viewBox="0 0 126 66">
            <path d={track} fill="none" stroke="rgba(255,211,42,0.08)" strokeWidth="6" strokeLinecap="round"/>
            <path d={track} fill="none" stroke="rgba(255,211,42,0.03)" strokeWidth="13" strokeLinecap="round"/>
            {fill&&<path d={fill} fill="none" stroke="url(#ag)" strokeWidth="6" strokeLinecap="round"/>}
            {dayProg>1&&dayProg<99&&<><circle cx={sx} cy={sy} r="10" fill="rgba(255,211,42,0.12)"/><circle cx={sx} cy={sy} r="6" fill="#ffd32a" style={{filter:"drop-shadow(0 0 5px #ffd32a)"}}/><circle cx={sx} cy={sy} r="2.7" fill="#fff"/></>}
            <defs><linearGradient id="ag" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#f39c12"/><stop offset="100%" stopColor="#ffd32a"/></linearGradient></defs>
          </svg>
          <div style={C.arcPct}>{dayProg}%</div>
          <div style={C.arcPhase}>{phase}</div>
        </div>
        <div style={C.arcTimes}>
          {[{icon:"🌄",label:"Sunrise",val:normalized?.sunrise},{icon:"🌇",label:"Sunset",val:normalized?.sunset}].map(ev=>(
            <div key={ev.label} style={C.arcTimeItem}>
              <span style={C.arcIcon}>{ev.icon}</span>
              <div><div style={C.arcTLabel}>{ev.label}</div><div style={C.arcTVal}>{ev.val&&ev.val!=="—"?ev.val:"—"}</div></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

// ─── PANCHANG DETAILS (identical to original) ─────────────────────────────────

const PanCell = memo(({ label, detail }) => {
  const meta = [
    detail?.type && { label:"Type", value:detail.type },
    detail?.number && { label:"No.", value:detail.number },
    detail?.pada && { label:"Pada", value:detail.pada },
    detail?.lord && { label:"Lord", value:detail.lord },
    detail?.deity && { label:"Deity", value:detail.deity },
    detail?.startTime && detail.startTime !== EMPTY_TIME && { label:"Starts", value:detail.startTime },
    detail?.endTime && detail.endTime !== EMPTY_TIME && { label:"Until", value:detail.endTime },
    detail?.next && { label:"Next", value:detail.next },
  ].filter(Boolean);
  const textBlocks = [
    detail?.meaning && { label:"Meaning", value:detail.meaning },
    detail?.special && { label:"Special", value:detail.special },
    detail?.summary && { label:"Summary", value:detail.summary },
    detail?.auspiciousDisha?.length && { label:"Auspicious Direction", value:detail.auspiciousDisha.join(", ") },
  ].filter(Boolean);

  return (
    <div style={C.panCell}>
      <div style={C.panTop}>
        <span style={C.panLbl}>{label}</span>
        {detail?.endTime&&detail.endTime!==EMPTY_TIME&&<span style={C.panEnd}>until {detail.endTime}</span>}
      </div>
      <div style={C.panName}>{detail?.name||EMPTY_TIME}</div>
      {meta.length > 0 && (
        <div style={C.panMetaGrid}>
          {meta.map((item) => (
            <div key={`${label}-${item.label}`} style={C.panMetaItem}>
              <span style={C.panMetaLabel}>{item.label}</span>
              <span style={C.panMetaValue}>{item.value}</span>
            </div>
          ))}
        </div>
      )}
      {textBlocks.length > 0 && (
        <div style={C.panTextStack}>
          {textBlocks.map((item) => (
            <div key={`${label}-${item.label}`} style={C.panTextBlock}>
              <div style={C.panTextLabel}>{item.label}</div>
              <div style={C.panText}>{item.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

const PanDetails = memo(({ normalized }) => (
  <div style={C.panCard}>
    <div style={C.panHead}><span style={C.panTitle}>Panchang Insights</span><span style={C.panSub}>Full daily details</span></div>
    <div style={C.panGrid}>
      {[{label:"Tithi",d:normalized?.tithi},{label:"Nakshatra",d:normalized?.nakshatra},{label:"Yoga",d:normalized?.yoga},{label:"Karana",d:normalized?.karana}].map(({label,d})=>(
        <PanCell key={label} label={label} detail={d}/>
      ))}
    </div>
  </div>
));

// ─── SKELETON / ERROR (identical to original) ─────────────────────────────────

const Skel = memo(() => (
  <div>
    {[0,1,2].map(i=>(
      <div key={i} style={{...C.skelCard,animationDelay:`${i*90}ms`}}>
        <div style={{...C.skelLine,width:"38%",height:11,marginBottom:14}}/>
        {[88,70,82,58].map((w,j)=>(
          <div key={j} style={{display:"flex",gap:9,marginBottom:9,alignItems:"center"}}>
            <div style={{...C.skelLine,width:26,height:26,borderRadius:"50%",flexShrink:0}}/>
            <div style={{...C.skelLine,width:`${w}%`,height:12}}/>
          </div>
        ))}
      </div>
    ))}
  </div>
));

const Err = memo(({ msg, retry }) => (
  <div style={C.errCard}>
    <div style={{fontSize:50,marginBottom:12}}>🌙</div>
    <div style={C.errTitle}>Data Awaited</div>
    <div style={C.errMsg}>{msg}</div>
    <button style={C.errBtn} onClick={retry}>↻ Retry</button>
  </div>
));

// ─── MAIN ─────────────────────────────────────────────────────────────────────

export default function AstroDaily({ location = "Chennai", lang = "en", onBack }) {
  const [rawData, setRawData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const loadSeq = useRef(0);
  const today = useMemo(() => getTodayIST(), []);
  const clock = useClock();
  const normalized = useMemo(() => normalizePanchangData(rawData), [rawData]);
  const displayData = useMemo(() => buildDisplayPanchangData(rawData, normalized), [rawData, normalized]);
  const nowMs = clock.now.getTime();
  const { active, next } = useMemo(() => computeLiveState(normalized, nowMs), [normalized, nowMs]);
  const dayProg = useMemo(() => computeDayProgress(normalized, nowMs), [normalized, nowMs]);
  const status  = useMemo(() => computeSmartStatus(normalized, active, next), [normalized, active, next]);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    setLoading(true); setError(null); setRawData(null);
    try {
      // New doc ID includes lang: {date}_{location}_{lang}
      const snap = await getDoc(doc(db, "panchang", `${today}_${location}_${lang}`));
      if (seq !== loadSeq.current) return;
      const d = snap.exists() ? snap.data() : null;
      setRawData(d || null);
      if (!d) setError("Panchang data for today is not yet available. Check back after 2 AM IST.");
    } catch {
      if (seq !== loadSeq.current) return;
      setError("Unable to load Panchang. Please try again.");
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [location, lang, today]);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={R.root}>
      <Hero today={today} status={status} onBack={onBack}/>
      <div style={R.body}>
        {loading && <Skel/>}
        {!loading && error && <Err msg={error} retry={load}/>}
        {!loading && normalized && <>
          <MetaChips p={displayData}/>
          <StatusCard status={status} active={active} normalized={normalized} nowMs={nowMs}/>
          <PeriodTracker normalized={normalized} active={active} nowMs={nowMs}/>
          <SunMoon normalized={normalized} dayProg={dayProg} nowMs={nowMs}/>
          {normalized.sunrise!=="—"&&normalized.sunset!=="—"&&<DayArc normalized={normalized} dayProg={dayProg}/>}
          <PanDetails normalized={displayData}/>
          <div style={R.footer}>✦ Refreshes daily at 2 AM IST · Vedic Astrology ✦</div>
        </>}
      </div>
      <style>{CSS}</style>
    </div>
  );
}

// ─── CSS ─────────────────────────────────────────────────────────────────────
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
select option{background:#fffaf0;color:#111827}
`;

// ─── HERO STYLES (identical to original) ─────────────────────────────────────
const H = {
  hero:      { position:"relative",overflow:"hidden",borderRadius:"0 0 28px 28px",background:"linear-gradient(160deg,#fffdf6 0%,#f2fbff 48%,#fff1cd 100%)",borderBottom:"1px solid rgba(217,119,6,0.15)",boxShadow:"0 18px 46px rgba(217,119,6,0.13)" },
  backBtn:   { position:"absolute",top:14,left:14,zIndex:10,background:"rgba(255,255,255,0.82)",border:"1px solid rgba(217,119,6,0.18)",borderRadius:12,padding:"7px 9px",color:"#7a4b08",cursor:"pointer",display:"flex",alignItems:"center",lineHeight:1,boxShadow:"0 10px 22px rgba(217,119,6,0.1)" },
  orb1:      { position:"absolute",top:-82,left:-54,width:210,height:210,borderRadius:"50%",background:"radial-gradient(circle,rgba(251,191,36,0.28) 0%,rgba(251,191,36,0.12) 34%,transparent 72%)",animation:"floatOrb 10s ease-in-out infinite",pointerEvents:"none" },
  orb2:      { position:"absolute",top:-64,right:-60,width:190,height:190,borderRadius:"50%",background:"radial-gradient(circle,rgba(125,211,252,0.24) 0%,rgba(186,230,253,0.13) 36%,transparent 74%)",animation:"floatOrb 13s ease-in-out infinite reverse",pointerEvents:"none" },
  orb3:      { position:"absolute",bottom:-28,right:18,width:136,height:136,borderRadius:"50%",background:"radial-gradient(circle,rgba(251,146,60,0.18) 0%,rgba(251,191,36,0.08) 40%,transparent 72%)",animation:"orbPulse 7s ease-in-out infinite",pointerEvents:"none" },
  topBar:    { position:"relative",zIndex:2,display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 16px 0 58px" },
  appId:     { display:"flex",alignItems:"center",gap:8 },
  om:        { fontFamily:"'Playfair Display',serif",fontSize:24,color:"#d97706",textShadow:"0 0 18px rgba(251,191,36,0.4)",lineHeight:1 },
  appName:   { fontFamily:"'Playfair Display',serif",fontSize:16,fontWeight:700,color:"#172033",letterSpacing:"0.02em",lineHeight:1.05 },
  appSub:    { fontSize:8,color:"#9a6a16",letterSpacing:"0.08em",marginTop:2,fontWeight:800 },
  livePill:  { display:"flex",alignItems:"center",gap:5,background:"rgba(22,163,74,0.1)",border:"1px solid rgba(22,163,74,0.22)",borderRadius:18,padding:"4px 10px",boxShadow:"0 8px 18px rgba(22,163,74,0.08)" },
  liveDot:   { display:"inline-block",width:5,height:5,borderRadius:"50%",background:"#16a34a",animation:"blink 1.3s ease-in-out infinite" },
  liveText:  { fontSize:7.5,fontWeight:800,color:"#15803d",letterSpacing:"0.11em" },
  center:    { position:"relative",zIndex:2,textAlign:"left",padding:"18px 18px 22px" },
  dateLine:  { fontFamily:"'Playfair Display',serif",fontSize:25,color:"#111827",letterSpacing:"0",marginBottom:0,lineHeight:1.12,fontWeight:700,maxWidth:"92%" },
  locLine:   { fontSize:12,color:"#64748b",fontWeight:700,letterSpacing:"0.02em" },
  locEmoji:  { fontSize:12 },
  locName:   { fontSize:11.5,fontWeight:700,color:"rgba(255,255,255,0.86)" },
  locTag:    { fontSize:9,color:"rgba(255,255,255,0.3)" },
  ribbon:    { position:"relative",zIndex:2,display:"flex",alignItems:"center",gap:7,padding:"6px 14px 7px" },
  ribbonMid: { flex:1,minWidth:0 },
  ribbonTitle:{ display:"block",fontSize:10.5,fontWeight:800,lineHeight:1.15 },
  ribbonMsg:  { display:"block",fontSize:9,color:"rgba(255,255,255,0.4)",marginTop:1 },
  ribbonExtra:{ fontSize:8.5,color:"rgba(255,255,255,0.3)",fontWeight:600,whiteSpace:"nowrap",flexShrink:0 },
};

// ─── CARD STYLES (identical to original) ─────────────────────────────────────
const C = {
  chips:    { display:"flex",flexWrap:"wrap",gap:6,marginBottom:10,animation:"slideUp 0.33s ease both" },
  chip:     { fontSize:10,fontWeight:800,background:"rgba(255,255,255,0.9)",border:"1px solid rgba(217,119,6,0.14)",color:"#8a5a10",borderRadius:18,padding:"4px 10px",letterSpacing:"0.03em",boxShadow:"0 6px 16px rgba(217,119,6,0.07)" },
  statusCard:{ borderRadius:20,padding:"14px 14px 12px",marginBottom:10,overflow:"hidden" },
  scTop:    { display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:9,marginBottom:9 },
  scTL:     { display:"flex",alignItems:"flex-start",gap:11 },
  scTitle:  { fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:700,display:"block",lineHeight:1.2 },
  scMsg:    { fontSize:11,color:"#64748b",display:"block",marginTop:3 },
  scLive:   { display:"inline-flex",alignItems:"center",gap:5,color:"#fff",borderRadius:20,padding:"4px 10px",fontSize:9,fontWeight:900,letterSpacing:"0.1em",whiteSpace:"nowrap",flexShrink:0 },
  scLiveDot:{ display:"inline-block",width:5,height:5,borderRadius:"50%",background:"rgba(255,255,255,0.85)",animation:"blink 1s infinite" },
  scPeriod: { marginBottom:10 },
  scPRow:   { display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6 },
  scPName:  { fontSize:11,fontWeight:700,letterSpacing:"0.03em" },
  scTimer:  { fontSize:17,fontWeight:800,fontVariantNumeric:"tabular-nums",fontFamily:"'Sora',sans-serif" },
  scTrack:  { height:5,borderRadius:99,overflow:"hidden" },
  scFill:   { height:"100%",borderRadius:99,transition:"width 1s cubic-bezier(0.4,0,0.2,1)" },
  scTrackLbls:{ display:"flex",justifyContent:"space-between",marginTop:5 },
  scTLbl:   { fontSize:9,color:"#94a3b8",fontWeight:700 },
  scExtra:  { display:"flex",alignItems:"center",gap:7,marginTop:10,paddingTop:10,borderTop:"1px solid" },
  scExtraIcon:{ fontSize:13 },
  scExtraText:{ fontSize:11.5,fontWeight:700 },
  scGuide:  { display:"flex",alignItems:"center",gap:7,marginTop:9,paddingTop:9,borderTop:"1px solid" },
  scGuideText:{ fontSize:10.5,fontStyle:"italic" },
  tracker:  { background:"rgba(255,255,255,0.88)",border:"1px solid rgba(217,119,6,0.12)",borderRadius:20,padding:"12px 12px 10px",marginBottom:10,animation:"slideUp 0.48s 0.05s ease both",boxShadow:"0 14px 34px rgba(15,23,42,0.07)" },
  tHead:    { display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8,paddingBottom:6,borderBottom:"1px solid rgba(148,163,184,0.16)" },
  tTitle:   { fontFamily:"'Playfair Display',serif",fontSize:13,fontWeight:700,color:"#1f2937" },
  tSub:     { fontSize:9.5,color:"#94a3b8" },
  tRow:     { borderRadius:12,padding:"8px 10px",transition:"all 0.25s ease" },
  tRowMain: { display:"flex",justifyContent:"space-between",alignItems:"center",gap:8 },
  tL:       { display:"flex",alignItems:"center",gap:10 },
  tIcon:    { fontSize:15,lineHeight:1,flexShrink:0,fontFamily:"serif" },
  tName:    { fontSize:12,fontWeight:800,lineHeight:1.2,transition:"color 0.2s" },
  tTimes:   { fontSize:10,color:"#64748b",fontWeight:600,marginTop:2,fontVariantNumeric:"tabular-nums" },
  tR:       { display:"flex",alignItems:"center",gap:7 },
  tCdwn:    { fontSize:11.5,fontWeight:800,fontVariantNumeric:"tabular-nums",color:"#64748b" },
  tPill:    { display:"inline-flex",alignItems:"center",gap:4,fontSize:8.5,fontWeight:800,letterSpacing:"0.07em",borderRadius:20,padding:"2px 8px",whiteSpace:"nowrap" },
  tDot:     { display:"inline-block",width:4,height:4,borderRadius:"50%",animation:"blink 1.2s infinite" },
  tBar:     { height:3,borderRadius:99,background:"rgba(148,163,184,0.18)",marginTop:7,overflow:"hidden" },
  tBarFill: { height:"100%",borderRadius:99,transition:"width 1s cubic-bezier(0.4,0,0.2,1)" },
  smCard:   { background:"rgba(255,255,255,0.88)",border:"1px solid rgba(217,119,6,0.12)",borderRadius:20,padding:"10px 11px 11px",marginBottom:10,animation:"slideUp 0.48s 0.1s ease both",boxShadow:"0 14px 34px rgba(15,23,42,0.07)" },
  smHead:   { display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:7,paddingBottom:5,borderBottom:"1px solid rgba(148,163,184,0.16)" },
  smTitle:  { fontFamily:"'Playfair Display',serif",fontSize:12.5,fontWeight:700,color:"#1f2937" },
  smPhase:  { fontSize:8.5,color:"#8a5a10",fontWeight:700,letterSpacing:"0.05em" },
  smGrid:   { display:"grid",gridTemplateColumns:"1fr 1fr",gap:6 },
  smCell:   { borderRadius:12,padding:"7px 8px 6px",display:"flex",flexDirection:"row",alignItems:"center",gap:7,transition:"opacity 0.3s",minHeight:54 },
  smRing:   { flexShrink:0 },
  smInfo:   { textAlign:"left",width:"100%",minWidth:0 },
  smLabel:  { fontSize:8.5,fontWeight:700,letterSpacing:"0.05em",display:"block",marginBottom:1,whiteSpace:"nowrap" },
  smTime:   { fontSize:12.5,fontWeight:800,color:"#111827",fontVariantNumeric:"tabular-nums",whiteSpace:"nowrap" },
  smCd:     { fontSize:8.5,fontWeight:600,marginTop:1,display:"block",whiteSpace:"nowrap" },
  arcCard:  { background:"rgba(255,255,255,0.88)",border:"1px solid rgba(217,119,6,0.12)",borderRadius:20,padding:"10px 11px 9px",marginBottom:10,animation:"slideUp 0.48s 0.15s ease both",boxShadow:"0 14px 34px rgba(15,23,42,0.07)" },
  arcInner: { display:"flex",alignItems:"center",gap:9 },
  arcPct:   { position:"absolute",bottom:8,left:0,right:0,textAlign:"center",fontSize:14.5,fontWeight:800,color:"#d97706",fontVariantNumeric:"tabular-nums",fontFamily:"'Sora',sans-serif" },
  arcPhase: { fontSize:8,fontWeight:800,color:"#b45309",textTransform:"uppercase",letterSpacing:"0.08em",textAlign:"center",marginTop:0 },
  arcTimes: { flex:1,display:"flex",flexDirection:"column",gap:0 },
  arcTimeItem:{ display:"flex",alignItems:"center",gap:8,padding:"4px 0" },
  arcIcon:  { fontSize:15,lineHeight:1,width:19,textAlign:"center" },
  arcTLabel:{ fontSize:8.5,color:"#94a3b8",fontWeight:800,textTransform:"uppercase",letterSpacing:"0.06em" },
  arcTVal:  { fontSize:12.5,fontWeight:800,color:"#111827",fontVariantNumeric:"tabular-nums" },
  panCard:  { background:"rgba(255,255,255,0.9)",border:"1px solid rgba(217,119,6,0.12)",borderRadius:22,padding:"14px 12px 13px",marginBottom:10,animation:"slideUp 0.48s 0.2s ease both",boxShadow:"0 16px 38px rgba(15,23,42,0.08)" },
  panHead:  { display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:10,marginBottom:12,paddingBottom:8,borderBottom:"1px solid rgba(148,163,184,0.16)" },
  panTitle: { fontFamily:"'Playfair Display',serif",fontSize:16,fontWeight:700,color:"#172033" },
  panSub:   { fontSize:10,color:"#8a5a10",fontWeight:800,letterSpacing:"0.04em",whiteSpace:"nowrap" },
  panGrid:  { display:"grid",gridTemplateColumns:"1fr",gap:10 },
  panCell:  { background:"linear-gradient(145deg,#fffdf7 0%,#f8fcff 58%,#fff7e6 100%)",border:"1px solid rgba(217,119,6,0.14)",borderRadius:18,padding:"14px 14px 13px",cursor:"default",transition:"all 0.2s ease",position:"relative",overflow:"hidden",boxShadow:"0 10px 24px rgba(15,23,42,0.06)" },
  panTop:   { display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:8 },
  panLbl:   { fontSize:10,fontWeight:900,color:"#b45309",textTransform:"uppercase",letterSpacing:"0.1em" },
  panEnd:   { fontSize:10,color:"#64748b",fontWeight:800,background:"rgba(255,255,255,0.72)",border:"1px solid rgba(148,163,184,0.16)",borderRadius:16,padding:"3px 8px",whiteSpace:"nowrap" },
  panName:  { fontFamily:"'Playfair Display',serif",fontSize:21,fontWeight:700,color:"#111827",lineHeight:1.18,marginBottom:11 },
  panMetaGrid:{ display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:7,marginBottom:11 },
  panMetaItem:{ background:"rgba(255,255,255,0.76)",border:"1px solid rgba(148,163,184,0.14)",borderRadius:12,padding:"7px 8px",minWidth:0 },
  panMetaLabel:{ display:"block",fontSize:8.5,color:"#94a3b8",fontWeight:900,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:2 },
  panMetaValue:{ display:"block",fontSize:11.5,color:"#243044",fontWeight:800,lineHeight:1.25,overflowWrap:"anywhere" },
  panTextStack:{ display:"flex",flexDirection:"column",gap:8,borderTop:"1px solid rgba(148,163,184,0.16)",paddingTop:10 },
  panTextBlock:{ background:"rgba(255,255,255,0.54)",borderRadius:12,padding:"9px 10px" },
  panTextLabel:{ fontSize:9,color:"#b45309",fontWeight:900,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4 },
  panText:{ fontSize:12.5,color:"#334155",fontWeight:600,lineHeight:1.62,whiteSpace:"pre-wrap",overflowWrap:"anywhere" },
  skelCard: { background:"rgba(255,255,255,0.78)",borderRadius:18,padding:"13px 12px 14px",marginBottom:9,animation:"skelIn 0.4s ease both",border:"1px solid rgba(186,117,23,0.1)" },
  skelLine: { borderRadius:6,background:"linear-gradient(90deg,rgba(148,163,184,0.12) 25%,rgba(255,255,255,0.9) 50%,rgba(148,163,184,0.12) 75%)",backgroundSize:"800px 100%",animation:"shimmer 1.6s infinite linear" },
  errCard:  { background:"rgba(255,255,255,0.84)",border:"1px solid rgba(186,117,23,0.12)",borderRadius:22,padding:"38px 24px",textAlign:"center",animation:"slideUp 0.4s ease both",boxShadow:"0 12px 30px rgba(15,23,42,0.07)" },
  errTitle: { fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,color:"#b45309",marginBottom:8 },
  errMsg:   { fontSize:12.5,color:"#64748b",lineHeight:1.65,marginBottom:22 },
  errBtn:   { background:"linear-gradient(135deg,#f59e0b,#d97706)",color:"#fff",border:"none",borderRadius:28,padding:"10px 30px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Sora',sans-serif",boxShadow:"0 8px 18px rgba(217,119,6,0.22)" },
};

const R = {
  root:   { fontFamily:"'Sora',sans-serif",minHeight:"100svh",background:"radial-gradient(circle at 16% -6%, rgba(251,191,36,0.3), transparent 32%), radial-gradient(circle at 100% 2%, rgba(125,211,252,0.26), transparent 34%), radial-gradient(circle at 50% 42%, rgba(255,255,255,0.65), transparent 34%), linear-gradient(180deg,#fffdf6 0%,#f4fbff 44%,#fff7e6 100%)",color:"#111827",overflowX:"hidden",paddingBottom:"max(72px, env(safe-area-inset-bottom))",width:"100%" },
  body:   { width:"100%",maxWidth:"none",margin:0,padding:"12px 12px 0",position:"relative",zIndex:1 },
  footer: { textAlign:"center",fontSize:10,color:"#9a6a16",marginTop:12,fontStyle:"italic",letterSpacing:"0.03em" },
};
