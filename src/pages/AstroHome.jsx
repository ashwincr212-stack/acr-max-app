// AstroHome.jsx
// Entry hub for the Astro feature.
// Design: matches Astro.jsx exactly — Sora/Playfair fonts, same dark palette,
// same card/pill/animation patterns. City + language selectors. 3 nav cards.

import React, { useState, useEffect, memo, useMemo } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  LOCATIONS, LANGUAGES, LOCATION_META,
  getUserAstroPrefs, saveUserAstroPrefs,
} from "./astroHelpers";

// ─── STAR PARTICLES (same as Astro.jsx) ──────────────────────────────────────

const Stars = memo(() => {
  const stars = useMemo(() => Array.from({ length: 22 }, (_, i) => ({
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

// ─── NAV CARD ICONS ───────────────────────────────────────────────────────────

const IconDaily = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/>
    <line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/>
    <line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
);
const IconDetails = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
    <line x1="10" y1="9" x2="8" y2="9"/>
  </svg>
);
const IconFestivals = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);

// ─── NAV CARDS CONFIG ─────────────────────────────────────────────────────────

const NAV_CARDS = [
  {
    id:      "daily",
    icon:    <IconDaily />,
    label:   "Daily Panchang",
    sub:     "Tithi · Nakshatra · Yoga · Live status",
    accent:  "#ffd32a",
    accentDim: "#6b4a00",
    grad:    "linear-gradient(140deg,rgba(255,211,42,0.12),rgba(255,211,42,0.04))",
    border:  "rgba(255,211,42,0.2)",
  },
  {
    id:      "details",
    icon:    <IconDetails />,
    label:   "Detailed Panchang",
    sub:     "Positions · Muhurta · Samvat · Raw data",
    accent:  "#a29bfe",
    accentDim: "#3d2b8a",
    grad:    "linear-gradient(140deg,rgba(162,155,254,0.12),rgba(162,155,254,0.04))",
    border:  "rgba(162,155,254,0.2)",
  },
  {
    id:      "festivals",
    icon:    <IconFestivals />,
    label:   "Festivals & Yogas",
    sub:     "Auspicious days · Events · Special yogas",
    accent:  "#2ed573",
    accentDim: "#1a8a4a",
    grad:    "linear-gradient(140deg,rgba(46,213,115,0.12),rgba(46,213,115,0.04))",
    border:  "rgba(46,213,115,0.2)",
  },
];

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export default function AstroHome({ onNavigate, onBack }) {
  const [user, setUser]   = useState(null);
  const [loc, setLoc]     = useState("Chennai");
  const [lang, setLang]   = useState("en");
  const [saving, setSaving] = useState(false);
  const [pressed, setPressed] = useState(null);
  const [prefsReady, setPrefsReady] = useState(false);

  const meta = LOCATION_META[loc] || LOCATION_META.Chennai;

  // Auth listener
  useEffect(() => {
    const auth = getAuth();
    return onAuthStateChanged(auth, u => setUser(u));
  }, []);

  // Load prefs
  useEffect(() => {
    if (!user) { setPrefsReady(true); return; }
    getUserAstroPrefs(user.uid).then(p => {
      setLoc(p.panchangLocation);
      setLang(p.panchangLanguage);
      setPrefsReady(true);
    });
  }, [user]);

  // Save prefs (debounced)
  useEffect(() => {
    if (!prefsReady || !user?.uid) return;
    const t = setTimeout(() => {
      saveUserAstroPrefs(user.uid, { panchangLocation: loc, panchangLanguage: lang });
    }, 700);
    return () => clearTimeout(t);
  }, [loc, lang, prefsReady, user]);

  const handleLocChange = async (e) => {
    const l = e.target.value;
    setLoc(l);
    if (user?.uid) {
      setSaving(true);
      await saveUserAstroPrefs(user.uid, { panchangLocation: l }).catch(() => {});
      setSaving(false);
    }
  };

  const handleLangChange = async (e) => {
    const l = e.target.value;
    setLang(l);
    if (user?.uid) {
      setSaving(true);
      await saveUserAstroPrefs(user.uid, { panchangLanguage: l }).catch(() => {});
      setSaving(false);
    }
  };

  const handleNav = (cardId) => {
    setPressed(cardId);
    setTimeout(() => {
      setPressed(null);
      onNavigate(cardId, { location: loc, lang });
    }, 130);
  };

  const todayLabel = (() => {
    const now = new Date(Date.now() + 5.5 * 3600000);
    return now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  })();

  return (
    <div style={S.root}>
      <style>{CSS}</style>

      {/* ── HERO ── */}
      <div style={S.hero}>
        <div style={{ position:"absolute",inset:0,overflow:"hidden",borderRadius:"0 0 20px 20px" }}>
          <Stars />
          <div style={S.orb1}/><div style={S.orb2}/>
        </div>
        {/* Back button */}
        <button style={S.backBtn} onClick={onBack} aria-label="Back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div style={{ position:"relative",zIndex:2,textAlign:"center",padding:"14px 14px 10px" }}>
          <div style={S.om}>ॐ</div>
          <div style={S.heroTitle}>Jyotish</div>
          <div style={S.heroSub}>Vedic Celestial Guide</div>
          <div style={S.datePill}>
            <span style={{ fontSize:9 }}>🕐</span>
            <span>{todayLabel}</span>
          </div>
        </div>
      </div>

      {/* ── BODY ── */}
      <div style={S.body}>

        {/* Location + Language selectors */}
        <div style={S.prefCard}>
          {/* Location */}
          <div style={S.prefRow}>
            <div style={S.prefL}>
              <div style={S.prefIconBox}><span style={{ fontSize:15 }}>{meta.emoji}</span></div>
              <div>
                <div style={S.prefName}>{loc}</div>
                <div style={S.prefTag}>{meta.tagline}</div>
              </div>
            </div>
            <div style={S.prefR}>
              {saving && <span style={S.saveDot}/>}
              <div style={S.selWrap}>
                <select value={loc} onChange={handleLocChange} style={S.sel} aria-label="Select city">
                  {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
                <span style={S.selArrow}>▾</span>
              </div>
            </div>
          </div>
          {/* Divider */}
          <div style={S.prefDivider}/>
          {/* Language */}
          <div style={S.prefRow}>
            <div style={S.prefL}>
              <div style={{ ...S.prefIconBox, background:"linear-gradient(135deg,rgba(162,155,254,0.13),rgba(46,213,115,0.09))" }}>
                <span style={{ fontSize:13 }}>🌐</span>
              </div>
              <div>
                <div style={S.prefName}>{LANGUAGES.find(l => l.code === lang)?.label || "English"}</div>
                <div style={S.prefTag}>Display language</div>
              </div>
            </div>
            <div style={S.prefR}>
              <div style={S.selWrap}>
                <select value={lang} onChange={handleLangChange} style={{ ...S.sel, color:"#a29bfe", borderColor:"rgba(162,155,254,0.22)", background:"linear-gradient(135deg,rgba(162,155,254,0.09),rgba(46,213,115,0.06))" }} aria-label="Select language">
                  {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                </select>
                <span style={{ ...S.selArrow, color:"#a29bfe" }}>▾</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section label */}
        <div style={S.sectionLabel}>Choose a view</div>

        {/* Nav cards */}
        {NAV_CARDS.map((card, i) => (
          <div
            key={card.id}
            style={{
              ...S.navCard,
              background: card.grad,
              border: `1px solid ${pressed === card.id ? card.accent + "55" : card.border}`,
              boxShadow: pressed === card.id
                ? `0 0 24px ${card.accentDim}50, 0 6px 20px rgba(0,0,0,0.4)`
                : `0 4px 16px rgba(0,0,0,0.25)`,
              transform: pressed === card.id ? "scale(0.975)" : "scale(1)",
              animationDelay: `${0.07 + i * 0.07}s`,
            }}
            onClick={() => handleNav(card.id)}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === "Enter" && handleNav(card.id)}
          >
            {/* Left glow strip */}
            <div style={{ ...S.cardStrip, background:`linear-gradient(180deg, ${card.accent}30, ${card.accent}08)` }}/>
            {/* Icon */}
            <div style={{ ...S.cardIcon, background:`${card.accentDim}55`, border:`1px solid ${card.accent}28`, color:card.accent }}>
              {card.icon}
            </div>
            {/* Text */}
            <div style={S.cardText}>
              <div style={{ ...S.cardLabel, color:"rgba(255,255,255,0.88)" }}>{card.label}</div>
              <div style={S.cardSub}>{card.sub}</div>
            </div>
            {/* Chevron */}
            <svg style={{ color:`${card.accent}70`, flexShrink:0 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </div>
        ))}

        <div style={S.footer}>✦ Select your city and language · then tap a view ✦</div>
      </div>
    </div>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Sora:wght@300;400;500;600;700;800&display=swap');
@keyframes slideUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
@keyframes floatOrb{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-14px) scale(1.04)}}
@keyframes blink{0%,100%{opacity:1}50%{opacity:0.15}}
*{box-sizing:border-box;-webkit-font-smoothing:antialiased}
select option{background:#0d0618;color:#e8e0f0}
`;

const S = {
  root: { fontFamily:"'Sora',sans-serif",minHeight:"100vh",width:"100%",background:"transparent",color:"rgba(255,255,255,0.85)",overflowX:"hidden",paddingBottom:"max(96px, env(safe-area-inset-bottom))" },
  hero: { position:"relative",overflow:"hidden",borderRadius:"0 0 20px 20px" },
  orb1: { position:"absolute",top:-60,left:-40,width:160,height:160,borderRadius:"50%",background:"radial-gradient(circle,rgba(138,43,226,0.16) 0%,transparent 70%)",animation:"floatOrb 10s ease-in-out infinite",pointerEvents:"none" },
  orb2: { position:"absolute",top:-40,right:-50,width:130,height:130,borderRadius:"50%",background:"radial-gradient(circle,rgba(255,211,42,0.09) 0%,transparent 70%)",animation:"floatOrb 13s ease-in-out infinite reverse",pointerEvents:"none" },
  backBtn: { position:"absolute",top:12,left:12,zIndex:10,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"6px 8px",color:"rgba(255,255,255,0.6)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1 },
  om: { fontFamily:"'Playfair Display',serif",fontSize:26,color:"#ffd32a",textShadow:"0 0 14px rgba(255,211,42,0.55)",lineHeight:1,marginBottom:4 },
  heroTitle: { fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700,color:"rgba(255,255,255,0.9)",letterSpacing:"0.02em",lineHeight:1.1,marginBottom:3 },
  heroSub:   { fontSize:10,color:"rgba(255,255,255,0.3)",letterSpacing:"0.1em",marginBottom:10 },
  datePill:  { display:"inline-flex",alignItems:"center",gap:5,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:18,padding:"4px 12px",fontSize:10,color:"rgba(255,255,255,0.38)",letterSpacing:"0.03em" },
  body: { width:"100%",maxWidth:"none",margin:0,padding:"8px 2px 0" },
  // Pref card (same pattern as locCard in Astro.jsx)
  prefCard: { background:"rgba(255,255,255,0.035)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:16,padding:"4px 0",marginBottom:12,animation:"slideUp 0.38s ease both" },
  prefRow:  { display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 12px" },
  prefDivider: { height:"1px",background:"rgba(255,255,255,0.05)",margin:"0 12px" },
  prefL:    { display:"flex",alignItems:"center",gap:10 },
  prefIconBox: { width:34,height:34,borderRadius:10,background:"linear-gradient(135deg,rgba(255,211,42,0.13),rgba(138,43,226,0.13))",display:"flex",alignItems:"center",justifyContent:"center" },
  prefName: { fontSize:13.5,fontWeight:700,color:"rgba(255,255,255,0.88)" },
  prefTag:  { fontSize:10,color:"rgba(255,255,255,0.28)",marginTop:1 },
  prefR:    { display:"flex",alignItems:"center",gap:8 },
  saveDot:  { width:6,height:6,borderRadius:"50%",background:"#2ed573",animation:"blink 1.2s infinite",display:"inline-block" },
  selWrap:  { position:"relative",display:"flex",alignItems:"center" },
  sel:      { appearance:"none",WebkitAppearance:"none",background:"linear-gradient(135deg,rgba(255,211,42,0.09),rgba(138,43,226,0.09))",border:"1px solid rgba(255,211,42,0.16)",borderRadius:12,padding:"7px 28px 7px 12px",fontSize:12,fontWeight:700,color:"#ffd32a",cursor:"pointer",outline:"none",fontFamily:"'Sora',sans-serif" },
  selArrow: { position:"absolute",right:9,fontSize:11,color:"#ffd32a",pointerEvents:"none" },
  // Section label
  sectionLabel: { fontSize:9,fontWeight:800,letterSpacing:"0.12em",textTransform:"uppercase",color:"rgba(255,255,255,0.22)",marginBottom:8,paddingLeft:2 },
  // Nav cards
  navCard: { display:"flex",alignItems:"center",gap:13,borderRadius:16,padding:"12px 13px",marginBottom:9,cursor:"pointer",transition:"all 0.17s ease",animation:"slideUp 0.45s ease both",WebkitTapHighlightColor:"transparent",position:"relative",overflow:"hidden",userSelect:"none" },
  cardStrip: { position:"absolute",left:0,top:0,width:3,height:"100%",borderRadius:"16px 0 0 16px" },
  cardIcon:  { width:42,height:42,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 },
  cardText:  { flex:1,minWidth:0 },
  cardLabel: { fontSize:14,fontWeight:700,lineHeight:1.2,marginBottom:3,letterSpacing:"0.01em" },
  cardSub:   { fontSize:10.5,color:"rgba(255,255,255,0.32)",lineHeight:1.4 },
  footer: { textAlign:"center",fontSize:10,color:"rgba(255,255,255,0.18)",marginTop:14,fontStyle:"italic",letterSpacing:"0.03em",paddingBottom:10 },
};
