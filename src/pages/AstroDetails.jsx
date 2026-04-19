// AstroDetails.jsx
// Detailed Panchang — full rawPanchang + normalized data.
// Design: exact same token system as Astro.jsx (Sora/Playfair, #080510, purple accents).

import React, { useState, useEffect, useMemo, memo } from "react";
import { db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";

const IST_OFFSET_MS = 5.5 * 3600000;

function getTodayIST() {
  const ist = new Date(Date.now() + IST_OFFSET_MS);
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth()+1).padStart(2,"0")}-${String(ist.getUTCDate()).padStart(2,"0")}`;
}

function safeStr(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "object") {
    try { return JSON.stringify(v); } catch { return null; }
  }
  const s = String(v).trim();
  return s || null;
}

// ─── SECTION CARD ─────────────────────────────────────────────────────────────

const SectionCard = memo(({ title, emoji, accentColor = "#a29bfe", rows = [], collapsible = false, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  const validRows = rows.filter(r => r.value !== null && r.value !== undefined && String(r.value).trim() !== "");
  if (!validRows.length) return null;

  return (
    <div style={{ ...D.card, borderColor:`${accentColor}22`, marginBottom:9 }}>
      <div
        style={{ ...D.cardHead, cursor:collapsible?"pointer":"default", borderBottomColor:open?`${accentColor}15`:"transparent" }}
        onClick={collapsible?()=>setOpen(o=>!o):undefined}
      >
        <div style={{ display:"flex",alignItems:"center",gap:8 }}>
          <span style={{ fontSize:15 }}>{emoji}</span>
          <span style={{ fontFamily:"'Playfair Display',serif",fontSize:13,fontWeight:600,color:"rgba(255,255,255,0.82)" }}>{title}</span>
        </div>
        {collapsible && (
          <svg style={{ color:`${accentColor}80`,transform:open?"rotate(180deg)":"rotate(0)",transition:"transform 0.2s",flexShrink:0 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        )}
      </div>
      {open && (
        <div style={D.cardBody}>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px 14px" }}>
            {validRows.map((row, i) => (
              <div key={i} style={{ gridColumn:row.full?"span 2":"span 1" }}>
                <div style={D.rowLabel}>{row.label}</div>
                <div style={D.rowVal}>{String(row.value)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

// ─── SKELETON ─────────────────────────────────────────────────────────────────

const Skel = memo(() => (
  <div>
    {[0,1,2,3].map(i=>(
      <div key={i} style={{background:"rgba(255,255,255,0.02)",borderRadius:18,padding:"13px 12px",marginBottom:9,animation:"skelIn 0.4s ease both",animationDelay:`${i*80}ms`}}>
        <div style={{...D.skelLine,width:"40%",height:11,marginBottom:12}}/>
        {[80,60,72].map((w,j)=>(<div key={j} style={{...D.skelLine,width:`${w}%`,height:10,marginBottom:8}}/>))}
      </div>
    ))}
    <style>{`@keyframes skelIn{from{opacity:0}to{opacity:1}} @keyframes shimmer{0%{background-position:-600px 0}100%{background-position:600px 0}}`}</style>
  </div>
));

// ─── MAIN ─────────────────────────────────────────────────────────────────────

export default function AstroDetails({ location = "Chennai", lang = "en", onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [docId, setDocId] = useState("");
  const today = useMemo(() => getTodayIST(), []);

  const load = async () => {
    setLoading(true); setError(null);
    const id = `${today}_${location}_${lang}`;
    setDocId(id);
    try {
      const snap = await getDoc(doc(db, "panchang", id));
      if (snap.exists()) setData(snap.data());
      else { setData(null); setError("Document not found for today."); }
    } catch (err) {
      setData(null); setError(err.message);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [location, lang]);

  const n = data?.normalized || {};
  const raw = data?.rawPanchang || {};

  // ── Section builders ──────────────────────────────────────────────────────

  const pick = (...keys) => {
    for (const k of keys) {
      const v = n[k] ?? raw[k];
      if (v !== undefined && v !== null && String(v).trim() !== "") return safeStr(v);
    }
    return null;
  };

  const objDetail = (obj) => {
    if (!obj || typeof obj !== "object") return [];
    return Object.entries(obj)
      .filter(([,v]) => v !== null && v !== undefined && String(v).trim() !== "")
      .map(([k, v]) => ({ label:k.replace(/_/g," "), value:safeStr(v), full:String(safeStr(v)||"").length > 25 }));
  };

  const tithiRows = [
    { label:"Name",     value: pick("tithi")  || safeStr(n.tithi?.name) },
    { label:"Number",   value: pick("tithi_number") || safeStr(n.tithi?.number) },
    { label:"End Time", value: pick("tithi_end") || safeStr(n.tithi?.endTime) },
    { label:"Lord",     value: safeStr(n.tithi?.lord) },
    { label:"Paksha",   value: pick("paksha","Paksha") },
  ];
  const nakshatraRows = [
    { label:"Name",     value: pick("nakshatra") || safeStr(n.nakshatra?.name) },
    { label:"Number",   value: pick("nakshatra_number") || safeStr(n.nakshatra?.number) },
    { label:"End Time", value: pick("nakshatra_end") || safeStr(n.nakshatra?.endTime) },
    { label:"Lord",     value: safeStr(n.nakshatra?.lord) },
    { label:"Pada",     value: safeStr(n.nakshatra?.pada) },
  ];
  const yogaRows = [
    { label:"Name",     value: pick("yoga") || safeStr(n.yoga?.name) },
    { label:"Number",   value: safeStr(n.yoga?.number) },
    { label:"End Time", value: pick("yoga_end") || safeStr(n.yoga?.endTime) },
    { label:"Lord",     value: safeStr(n.yoga?.lord) },
    { label:"Special",  value: safeStr(n.yoga?.special), full:true },
  ];
  const karanaRows = [
    { label:"Name",     value: pick("karana") || safeStr(n.karana?.name) },
    { label:"End Time", value: pick("karana_end") || safeStr(n.karana?.endTime) },
    { label:"Lord",     value: safeStr(n.karana?.lord) },
  ];
  const masaRows = [
    { label:"Masa",          value: pick("masaName","masa_name","masa","month") },
    { label:"Paksha",        value: pick("paksha","Paksha") },
    { label:"Vara",          value: pick("varName","var_name","vara","dayName") },
    { label:"Samvat",        value: pick("samvat","Samvat") },
    { label:"Vikram Samvat", value: pick("vikram_samvat","vikramSamvat") },
    { label:"Shaka Samvat",  value: pick("shaka_samvat","shakaSamvat") },
    { label:"Kali Yuga",     value: pick("kali_yuga","kaliYuga") },
    { label:"Ayanamsa",      value: pick("ayanamsa","Ayanamsa") },
  ];
  const sunRows = [
    { label:"Sunrise",   value: pick("sunrise","Sunrise") },
    { label:"Sunset",    value: pick("sunset","Sunset") },
    { label:"Rasi",      value: pick("sun_rasi","sunRasi") || safeStr(n.sun?.rasi) },
    { label:"Longitude", value: pick("sun_longitude","sunLongitude") || safeStr(n.sun?.longitude) },
    { label:"Degree",    value: safeStr(n.sun?.degree) },
  ];
  const moonRows = [
    { label:"Moonrise",       value: pick("moonrise","Moonrise") },
    { label:"Moonset",        value: pick("moonset","Moonset") },
    { label:"Rasi",           value: pick("rasi","moon_rasi","moonRasi") || safeStr(n.moon?.rasi) },
    { label:"Longitude",      value: pick("moon_longitude","moonLongitude") || safeStr(n.moon?.longitude) },
    { label:"Next Full Moon", value: pick("next_full_moon","nextFullMoon","full_moon_date") },
    { label:"Next New Moon",  value: pick("next_new_moon","nextNewMoon","new_moon_date") },
  ];
  const auspRows = [
    { label:"Abhijit Muhurta",   value: pick("abhijitMuhurta","abhijit_muhurta","abhijit"), full:true },
    { label:"Brahma Muhurta",    value: pick("brahma_muhurta","brahmaMuhurta"), full:true },
    { label:"Amrit Kalam",       value: pick("amrit_kalam","amritKalam"), full:true },
    { label:"Disha Shool",       value: pick("disha_shool","dishaShool") },
    { label:"Moon Yogini Nivas", value: pick("moon_yogini_nivas","yogini_nivas","yoginiNivas") },
  ];
  const inauspRows = [
    { label:"Rahu Kalam",  value: pick("rahuKalam","rahu_kalam","rahukalam"), full:true },
    { label:"Yamagandam",  value: pick("yamagandam","yama_gandam"), full:true },
    { label:"Gulika Kalam",value: pick("gulikaKalam","gulika_kalam","gulikakalam"), full:true },
    { label:"Dur Muhurta", value: pick("dur_muhurta","durMuhurta"), full:true },
    { label:"Varjyam",     value: pick("varjyam","Varjyam"), full:true },
  ];

  // Raw panchang flat rows (only scalar/short values not already shown)
  const shownKeys = new Set(["normalized","festivals","yogas","rawFestivals","fetchedAt","source","date","location","lang","languageLabel"]);
  const rawRows = Object.entries(raw)
    .filter(([k,v]) => !shownKeys.has(k) && v !== null && v !== undefined && String(v).trim() !== "")
    .map(([k,v]) => ({ label:k.replace(/_/g," "), value:safeStr(v), full:String(safeStr(v)||"").length>30 }));

  const displayDate = new Date().toLocaleDateString("en-IN", { weekday:"short",day:"numeric",month:"short" });

  return (
    <div style={R.root}>
      <style>{CSS}</style>

      {/* Header — matches Astro.jsx hero style */}
      <div style={R.header}>
        <div style={{ position:"absolute",inset:0,overflow:"hidden",borderRadius:"0 0 16px 16px" }}>
          <div style={R.orb1}/><div style={R.orb2}/>
        </div>
        <button style={R.backBtn} onClick={onBack} aria-label="Back">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div style={{ position:"relative",zIndex:2,textAlign:"center",padding:"12px 14px 10px" }}>
          <div style={{ fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,color:"rgba(255,255,255,0.88)",marginBottom:2 }}>Detailed Panchang</div>
          <div style={{ fontSize:10,color:"rgba(162,155,254,0.65)",letterSpacing:"0.06em" }}>{location} · {displayDate}</div>
        </div>
      </div>

      {/* Body */}
      <div style={R.body}>
        {loading && <Skel/>}

        {!loading && error && (
          <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:22,padding:"38px 24px",textAlign:"center",animation:"slideUp 0.4s ease both"}}>
            <div style={{fontSize:46,marginBottom:10}}>🌙</div>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:17,color:"rgba(200,160,255,0.88)",marginBottom:8}}>Data Awaited</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.3)",marginBottom:6,fontFamily:"monospace"}}>{docId}</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.35)",lineHeight:1.65,marginBottom:22}}>{error}</div>
            <button style={{background:"linear-gradient(135deg,#6c3fd4,#b24eff)",color:"#fff",border:"none",borderRadius:28,padding:"10px 28px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Sora',sans-serif"}} onClick={load}>↻ Retry</button>
          </div>
        )}

        {!loading && !error && data && (
          <>
            <SectionCard title="Tithi"          emoji="🌙" accentColor="#b48c50" rows={tithiRows}    defaultOpen />
            <SectionCard title="Nakshatra"      emoji="⭐" accentColor="#a29bfe" rows={nakshatraRows} defaultOpen />
            <SectionCard title="Yoga"           emoji="☯️" accentColor="#fd79a8" rows={yogaRows}     defaultOpen />
            <SectionCard title="Karana"         emoji="🔢" accentColor="#2ed573" rows={karanaRows}   defaultOpen />
            <SectionCard title="Masa & Samvat"  emoji="📅" accentColor="#ffd32a" rows={masaRows}     collapsible defaultOpen />
            <SectionCard title="Sun Position"   emoji="☀️" accentColor="#ff9f43" rows={sunRows}      collapsible defaultOpen />
            <SectionCard title="Moon Position"  emoji="🌕" accentColor="#74b9ff" rows={moonRows}     collapsible defaultOpen />
            <SectionCard title="Auspicious"     emoji="✨" accentColor="#2ed573" rows={auspRows}     collapsible defaultOpen />
            <SectionCard title="Inauspicious"   emoji="⚠️" accentColor="#ff6b6b" rows={inauspRows}   collapsible defaultOpen />
            {rawRows.length > 0 && (
              <SectionCard title="Raw Panchang" emoji="📜" accentColor="#a29bfe" rows={rawRows} collapsible defaultOpen={false} />
            )}
            {data.fetchedAt && (
              <div style={{textAlign:"center",marginTop:8,fontSize:9.5,color:"rgba(255,255,255,0.16)",letterSpacing:"0.06em",fontStyle:"italic"}}>
                Fetched: {new Date(data.fetchedAt?.seconds ? data.fetchedAt.seconds*1000 : data.fetchedAt).toLocaleString("en-IN")}
                {data.source && ` · ${data.source}`}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── CSS ─────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Sora:wght@300;400;500;600;700;800&display=swap');
@keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes floatOrb{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-14px) scale(1.04)}}
@keyframes shimmer{0%{background-position:-600px 0}100%{background-position:600px 0}}
*{box-sizing:border-box;-webkit-font-smoothing:antialiased}
`;

const D = {
  card:     { background:"rgba(255,255,255,0.025)",border:"1px solid",borderRadius:18,overflow:"hidden",animation:"slideUp 0.42s ease both" },
  cardHead: { display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 13px",borderBottom:"1px solid" },
  cardBody: { padding:"11px 13px 13px" },
  rowLabel: { fontSize:9,fontWeight:700,color:"rgba(255,255,255,0.28)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:3 },
  rowVal:   { fontSize:13,fontWeight:600,color:"rgba(255,255,255,0.82)",lineHeight:1.4 },
  skelLine: { borderRadius:6,background:"linear-gradient(90deg,rgba(255,255,255,0.04) 25%,rgba(255,255,255,0.08) 50%,rgba(255,255,255,0.04) 75%)",backgroundSize:"800px 100%",animation:"shimmer 1.6s infinite linear" },
};

const R = {
  root:   { fontFamily:"'Sora',sans-serif",minHeight:"100vh",background:"#080510",color:"rgba(255,255,255,0.85)",overflowX:"hidden",paddingBottom:64 },
  header: { position:"relative",overflow:"hidden",borderRadius:"0 0 16px 16px",background:"linear-gradient(165deg,#0e0820 0%,#130d28 55%,#080510 100%)" },
  orb1:   { position:"absolute",top:-50,left:-40,width:140,height:140,borderRadius:"50%",background:"radial-gradient(circle,rgba(162,155,254,0.16) 0%,transparent 70%)",animation:"floatOrb 10s ease-in-out infinite",pointerEvents:"none" },
  orb2:   { position:"absolute",top:-40,right:-50,width:120,height:120,borderRadius:"50%",background:"radial-gradient(circle,rgba(255,211,42,0.07) 0%,transparent 70%)",animation:"floatOrb 13s ease-in-out infinite reverse",pointerEvents:"none" },
  backBtn:{ position:"absolute",top:10,left:10,zIndex:10,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"5px 7px",color:"rgba(255,255,255,0.6)",cursor:"pointer",display:"flex",alignItems:"center",lineHeight:1 },
  body:   { maxWidth:480,margin:"0 auto",padding:"12px 10px 0" },
};