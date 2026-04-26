// AstroFestivals.jsx
// Festivals & Yogas — reads from Firestore doc.festivals, doc.yogas, doc.rawFestivals.
// Design: exact same token system as Astro.jsx.

import React, { useState, useEffect, useMemo, memo } from "react";
import { db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";

const IST_OFFSET_MS = 5.5 * 3600000;

function getTodayIST() {
  const ist = new Date(Date.now() + IST_OFFSET_MS);
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth()+1).padStart(2,"0")}-${String(ist.getUTCDate()).padStart(2,"0")}`;
}

// ─── HIGHLIGHT DETECTION ──────────────────────────────────────────────────────

const HIGHLIGHT_KW = [
  "akshaya","tritiya","diwali","deepawali","navratri","dussehra","holi","makar",
  "sankranti","krishna","janmashtami","ganesh","chaturthi","shivaratri","pongal",
  "onam","vishu","ugadi","gudi","baisakhi","ekadashi","purnima","amavasya","navaratri",
];

function isHighlight(name = "") {
  const l = name.toLowerCase();
  return HIGHLIGHT_KW.some(k => l.includes(k));
}

// ─── NORMALIZERS ──────────────────────────────────────────────────────────────

function normalizeFestival(item) {
  if (!item) return null;
  if (typeof item === "string") return { name:item, significance:"", type:"" };
  return {
    name: item.festival_name || item.name || item.title || "",
    significance: item.significance || item.description || "",
    type: item.type || item.category || "",
  };
}

function normalizeYoga(item) {
  if (!item) return null;
  if (typeof item === "string") return { name:item, significance:"", day:"", type:"" };
  return {
    name: item.yoga_name || item.name || "",
    significance: item.significance || item.description || "",
    day: item.yoga_day || item.day || "",
    type: item.yoga_type || item.type || "",
  };
}

function asList(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return Object.values(value).flat();
  return [];
}

// ─── FESTIVAL CARD ────────────────────────────────────────────────────────────

const FestivalCard = memo(({ item }) => {
  const hi = isHighlight(item.name);
  return (
    <div style={{
      background: hi
        ? "linear-gradient(140deg,rgba(255,211,42,0.12),rgba(255,159,67,0.06))"
        : "rgba(255,255,255,0.025)",
      border: `1px solid ${hi ? "rgba(255,211,42,0.28)" : "rgba(255,255,255,0.06)"}`,
      borderRadius:16, padding:"12px 13px", marginBottom:9,
      position:"relative", overflow:"hidden",
      animation:"slideUp 0.4s ease both",
      boxShadow: hi ? "0 0 32px rgba(255,211,42,0.08),0 4px 16px rgba(0,0,0,0.25)" : "0 2px 10px rgba(0,0,0,0.2)",
    }}>
      {hi && (
        <div style={{ position:"absolute",top:0,right:0,background:"linear-gradient(135deg,rgba(255,211,42,0.18),rgba(255,159,67,0.12))",borderBottomLeftRadius:10,padding:"3px 10px",fontSize:9,fontWeight:800,color:"#ffd32a",letterSpacing:"0.1em" }}>
          ✦ SPECIAL
        </div>
      )}
      <div style={{ display:"flex",alignItems:"flex-start",gap:11 }}>
        <div style={{
          width:36,height:36,borderRadius:10,flexShrink:0,marginTop:1,
          background: hi ? "rgba(255,211,42,0.12)" : "rgba(255,255,255,0.04)",
          border: `1px solid ${hi ? "rgba(255,211,42,0.22)" : "rgba(255,255,255,0.06)"}`,
          display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,
        }}>
          {hi ? "🪔" : "🗓️"}
        </div>
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ fontSize:hi?15:13.5, fontFamily:"'Playfair Display',serif", fontWeight:hi?700:600, color:hi?"rgba(255,230,130,0.95)":"rgba(255,255,255,0.86)", lineHeight:1.25, marginBottom:item.significance?5:0 }}>
            {item.name || "—"}
          </div>
          {item.significance && (
            <div style={{ fontSize:11,color:"rgba(255,255,255,0.38)",lineHeight:1.55 }}>
              {item.significance}
            </div>
          )}
          {item.type && (
            <span style={{ display:"inline-block",marginTop:6,fontSize:8.5,fontWeight:700,background:hi?"rgba(255,211,42,0.1)":"rgba(255,255,255,0.05)",border:`1px solid ${hi?"rgba(255,211,42,0.2)":"rgba(255,255,255,0.08)"}`,borderRadius:18,padding:"2px 9px",color:hi?"#ffd32a":"rgba(255,255,255,0.38)",letterSpacing:"0.06em",textTransform:"uppercase" }}>
              {item.type}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

// ─── YOGA CARD ────────────────────────────────────────────────────────────────

const YogaCard = memo(({ item }) => (
  <div style={{
    background:"linear-gradient(140deg,rgba(162,155,254,0.08),rgba(162,155,254,0.03))",
    border:"1px solid rgba(162,155,254,0.15)",
    borderRadius:16, padding:"12px 13px", marginBottom:9,
    animation:"slideUp 0.4s ease both",
  }}>
    <div style={{ display:"flex",alignItems:"flex-start",gap:11 }}>
      <div style={{ width:36,height:36,borderRadius:10,flexShrink:0,marginTop:1,background:"rgba(162,155,254,0.1)",border:"1px solid rgba(162,155,254,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17 }}>
        ☯️
      </div>
      <div style={{ flex:1 }}>
        <div style={{ fontFamily:"'Playfair Display',serif",fontSize:13.5,fontWeight:600,color:"rgba(200,195,255,0.88)",lineHeight:1.25,marginBottom:item.significance?5:0 }}>
          {item.name || "—"}
        </div>
        {item.significance && (
          <div style={{ fontSize:11,color:"rgba(255,255,255,0.38)",lineHeight:1.55 }}>{item.significance}</div>
        )}
        <div style={{ display:"flex",gap:7,marginTop:6,flexWrap:"wrap" }}>
          {item.day && <span style={{ fontSize:8.5,fontWeight:700,background:"rgba(162,155,254,0.1)",border:"1px solid rgba(162,155,254,0.2)",borderRadius:18,padding:"2px 9px",color:"#a29bfe",letterSpacing:"0.06em",textTransform:"uppercase" }}>{item.day}</span>}
          {item.type && <span style={{ fontSize:8.5,fontWeight:700,background:"rgba(162,155,254,0.06)",border:"1px solid rgba(162,155,254,0.12)",borderRadius:18,padding:"2px 9px",color:"rgba(162,155,254,0.65)",letterSpacing:"0.06em",textTransform:"uppercase" }}>{item.type}</span>}
        </div>
      </div>
    </div>
  </div>
));

// ─── EMPTY STATE ──────────────────────────────────────────────────────────────

const EmptyState = memo(({ message }) => (
  <div style={{ background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:18,padding:"36px 20px",textAlign:"center" }}>
    <div style={{ fontSize:38,marginBottom:10 }}>🌸</div>
    <div style={{ fontFamily:"'Playfair Display',serif",fontSize:15,color:"rgba(255,255,255,0.36)",lineHeight:1.5 }}>{message}</div>
  </div>
));

// ─── SKELETON ─────────────────────────────────────────────────────────────────

const Skel = memo(() => (
  <div>
    {[0,1,2].map(i=>(
      <div key={i} style={{background:"rgba(255,255,255,0.02)",borderRadius:16,padding:"13px 12px",marginBottom:9,animationDelay:`${i*80}ms`,animation:"skelIn 0.4s ease both"}}>
        <div style={{width:"55%",height:12,borderRadius:6,background:"linear-gradient(90deg,rgba(255,255,255,0.04) 25%,rgba(255,255,255,0.08) 50%,rgba(255,255,255,0.04) 75%)",backgroundSize:"800px 100%",animation:"shimmer 1.6s infinite linear",marginBottom:10}}/>
        <div style={{width:"80%",height:9,borderRadius:6,background:"linear-gradient(90deg,rgba(255,255,255,0.03) 25%,rgba(255,255,255,0.06) 50%,rgba(255,255,255,0.03) 75%)",backgroundSize:"800px 100%",animation:"shimmer 1.6s infinite linear"}}/>
      </div>
    ))}
    <style>{`@keyframes skelIn{from{opacity:0}to{opacity:1}} @keyframes shimmer{0%{background-position:-600px 0}100%{background-position:600px 0}}`}</style>
  </div>
));

// ─── MAIN ─────────────────────────────────────────────────────────────────────

export default function AstroFestivals({ location = "Chennai", lang = "en", onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("festivals");
  const today = useMemo(() => getTodayIST(), []);

  const load = async () => {
    setLoading(true); setError(null);
    const id = `${today}_${location}_${lang}`;
    try {
      const snap = await getDoc(doc(db, "panchang", id));
      if (snap.exists()) setData(snap.data());
      else { setData(null); setError("No data for today."); }
    } catch (err) { setData(null); setError(err.message); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [location, lang]);

  // Prefer selected-language API payloads for visible text. Canonical arrays
  // remain a safe fallback for older docs or sparse language responses.
  const rawFestivals = data?.rawFestivals || {};
  const rawFestivalList = asList(rawFestivals?.festival_list);
  const rawFestivalFallback = asList(rawFestivals?.festivals);
  const rawYogaList = asList(rawFestivals?.yogas);
  const festivalSource = rawFestivalList.length
    ? rawFestivalList
    : rawFestivalFallback.length
      ? rawFestivalFallback
      : asList(data?.festivals);
  const yogaSource = rawYogaList.length ? rawYogaList : asList(data?.yogas);
  const festivals = festivalSource.map(normalizeFestival).filter(f => f?.name);
  const yogas = yogaSource.map(normalizeYoga).filter(y => y?.name);

  // Sort: highlighted first
  const sortedFests = [
    ...festivals.filter(f => isHighlight(f.name)),
    ...festivals.filter(f => !isHighlight(f.name)),
  ];

  const displayDate = new Date().toLocaleDateString("en-IN", { weekday:"short",day:"numeric",month:"short" });

  const TABS = [
    { id:"festivals", label:"Festivals", count:festivals.length, accent:"#ffd32a" },
    { id:"yogas",     label:"Yogas",     count:yogas.length,     accent:"#a29bfe" },
  ];

  return (
    <div style={R.root}>
      <style>{CSS}</style>

      {/* Header */}
      <div style={R.header}>
        <div style={{ position:"absolute",inset:0,overflow:"hidden",borderRadius:"0 0 16px 16px" }}>
          <div style={R.orb1}/><div style={R.orb2}/>
        </div>
        <button style={R.backBtn} onClick={onBack} aria-label="Back">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div style={{ position:"relative",zIndex:2,textAlign:"center",padding:"12px 14px 10px" }}>
          <div style={{ fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,color:"rgba(255,255,255,0.88)",marginBottom:2 }}>Festivals & Yogas</div>
          <div style={{ fontSize:10,color:"rgba(255,211,42,0.55)",letterSpacing:"0.06em" }}>{location} · {displayDate}</div>
        </div>
      </div>

      {/* Body */}
      <div style={R.body}>
        {loading && <Skel/>}

        {!loading && error && (
          <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:22,padding:"38px 24px",textAlign:"center",animation:"slideUp 0.4s ease both"}}>
            <div style={{fontSize:46,marginBottom:10}}>🌙</div>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:17,color:"rgba(200,160,255,0.88)",marginBottom:14}}>Data Awaited</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.35)",lineHeight:1.65,marginBottom:22}}>{error}</div>
            <button style={{background:"linear-gradient(135deg,#6c3fd4,#b24eff)",color:"#fff",border:"none",borderRadius:28,padding:"10px 28px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Sora',sans-serif"}} onClick={load}>↻ Retry</button>
          </div>
        )}

        {!loading && !error && data && (
          <>
            {/* Tab switcher — same style as chip/pill pattern in Astro.jsx */}
            <div style={R.tabRow}>
              {TABS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  style={{
                    flex:1, padding:"9px 0",
                    background: tab===t.id ? `${t.accent}14` : "transparent",
                    border: `1px solid ${tab===t.id ? `${t.accent}30` : "transparent"}`,
                    borderRadius:10,
                    color: tab===t.id ? t.accent : "rgba(255,255,255,0.3)",
                    fontSize:12, fontFamily:"'Sora',sans-serif",
                    fontWeight: tab===t.id ? 700 : 500,
                    cursor:"pointer", transition:"all 0.15s ease",
                    letterSpacing:"0.02em",
                  }}
                >
                  {t.label}{t.count > 0 ? ` (${t.count})` : ""}
                </button>
              ))}
            </div>

            {tab === "festivals" && (
              sortedFests.length > 0
                ? sortedFests.map((f,i) => <FestivalCard key={i} item={f}/>)
                : <EmptyState message="No festivals today. Auspicious days await." />
            )}
            {tab === "yogas" && (
              yogas.length > 0
                ? yogas.map((y,i) => <YogaCard key={i} item={y}/>)
                : <EmptyState message="No special yogas recorded for today." />
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
*{box-sizing:border-box;-webkit-font-smoothing:antialiased}
`;

const R = {
  root:   { fontFamily:"'Sora',sans-serif",minHeight:"100vh",width:"100%",background:"transparent",color:"rgba(255,255,255,0.85)",overflowX:"hidden",paddingBottom:"max(96px, env(safe-area-inset-bottom))" },
  header: { position:"relative",overflow:"hidden",borderRadius:"0 0 16px 16px",background:"linear-gradient(165deg,#0f0a00 0%,#1c1500 55%,#080510 100%)" },
  orb1:   { position:"absolute",top:-50,left:-40,width:140,height:140,borderRadius:"50%",background:"radial-gradient(circle,rgba(255,211,42,0.12) 0%,transparent 70%)",animation:"floatOrb 10s ease-in-out infinite",pointerEvents:"none" },
  orb2:   { position:"absolute",top:-40,right:-50,width:120,height:120,borderRadius:"50%",background:"radial-gradient(circle,rgba(162,155,254,0.08) 0%,transparent 70%)",animation:"floatOrb 13s ease-in-out infinite reverse",pointerEvents:"none" },
  backBtn:{ position:"absolute",top:10,left:10,zIndex:10,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"5px 7px",color:"rgba(255,255,255,0.6)",cursor:"pointer",display:"flex",alignItems:"center",lineHeight:1 },
  body:   { width:"100%",maxWidth:"none",margin:0,padding:"10px 4px 0" },
  tabRow: { display:"flex",gap:7,marginBottom:12,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,padding:4 },
};
