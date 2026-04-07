import { useState, useEffect, useRef, useMemo } from 'react'

const fmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`

import { db } from '../firebase'
import { doc, onSnapshot } from 'firebase/firestore'

/* ── THEMES ─────────────────────────────────────────────────────────────────── */
const THEMES = [
  {
    id: 'violet', name: 'Violet', icon: '💜',
    accent: '#a78bfa', grad: 'linear-gradient(135deg,#7c3aed,#4f46e5)',
    bg: '#0d0b1e', desc: 'Default — deep space violet',
  },
  {
    id: 'emerald', name: 'Emerald', icon: '💚',
    accent: '#34d399', grad: 'linear-gradient(135deg,#059669,#047857)',
    bg: '#030f0a', desc: 'Forest — rich emerald green',
  },
  {
    id: 'rose', name: 'Rose', icon: '🌹',
    accent: '#fb7185', grad: 'linear-gradient(135deg,#e11d48,#be123c)',
    bg: '#120509', desc: 'Crimson — bold rose red',
  },
  {
    id: 'amber', name: 'Amber', icon: '🌙',
    accent: '#fbbf24', grad: 'linear-gradient(135deg,#d97706,#b45309)',
    bg: '#100c02', desc: 'Gold — warm amber luxury',
  },
  {
    id: 'cyan', name: 'Cyan', icon: '🌊',
    accent: '#22d3ee', grad: 'linear-gradient(135deg,#0891b2,#0e7490)',
    bg: '#020d12', desc: 'Ocean — electric cyan',
  },
  {
    id: 'orange', name: 'Orange', icon: '🔥',
    accent: '#fb923c', grad: 'linear-gradient(135deg,#ea580c,#c2410c)',
    bg: '#100701', desc: 'Ember — fiery orange',
  },
]

/* ── Apply theme to <html> ──────────────────────────────────────────────────── */
function applyTheme(id) {
  document.documentElement.setAttribute('data-theme', id)
  localStorage.setItem('acr_theme', id)
}

/* ── Animated counter ─────────────────────────────────────────────────────── */
function AnimCount({ value }) {
  const [disp, setDisp] = useState(0)
  const raf = useRef(null)
  useEffect(() => {
    const start = disp, end = Number(value)
    if (start === end) return
    const dur = 800, t0 = performance.now()
    const step = (now) => {
      const p = Math.min((now - t0) / dur, 1)
      const e = 1 - Math.pow(1 - p, 3)
      setDisp(Math.round(start + (end - start) * e))
      if (p < 1) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf.current)
  }, [value])
  return <span>₹{disp.toLocaleString('en-IN')}</span>
}

/* ── Circular ring ────────────────────────────────────────────────────────── */
function Ring({ pct, color, size = 80, stroke = 7, children }) {
  const r = (size - stroke * 2) / 2
  const circ = 2 * Math.PI * r
  const [ap, setAp] = useState(0)
  useEffect(() => { const t = setTimeout(() => setAp(pct), 120); return () => clearTimeout(t) }, [pct])
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={circ - (ap / 100) * circ}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.34,1.1,.64,1)', filter: `drop-shadow(0 0 6px ${color}80)` }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{children}</div>
    </div>
  )
}

/* ── Sparkline ────────────────────────────────────────────────────────────── */
function Sparkline({ data, color }) {
  if (!data || data.length < 2) return null
  const w = 120, h = 36, max = Math.max(...data, 1)
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h * 0.9}`)
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }}>
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={2}
        strokeLinecap="round" strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 4px ${color}60)` }} />
    </svg>
  )
}

/* ── Category bar ─────────────────────────────────────────────────────────── */
function CatBar({ name, total, max, color, rank }) {
  const pct = max > 0 ? (total / max) * 100 : 0
  const [w, setW] = useState(0)
  useEffect(() => { const t = setTimeout(() => setW(pct), 150 + rank * 80); return () => clearTimeout(t) }, [pct])
  return (
    <div style={{ marginBottom: 14, animation: `slideIn 0.4s ease-out ${rank * 70}ms both` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}`, display: 'inline-block' }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>{name}</span>
        </div>
        <span style={{ fontSize: 13, fontWeight: 800, color: '#fff', fontFamily: 'Syne,sans-serif' }}>{fmt(total)}</span>
      </div>
      <div style={{ height: 5, borderRadius: 5, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 5, width: `${w}%`,
          background: `linear-gradient(90deg,${color},${color}cc)`,
          boxShadow: `0 0 10px ${color}50`,
          transition: 'width 1.1s cubic-bezier(.34,1.1,.64,1)',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.25),transparent)', animation: 'shimBar 1.8s infinite' }} />
        </div>
      </div>
    </div>
  )
}

/* ── Milestone ────────────────────────────────────────────────────────────── */
function Milestone({ days, streak, label, icon }) {
  const unlocked = streak >= days
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, opacity: unlocked ? 1 : 0.32, transition: 'all 0.4s' }}>
      <div style={{
        width: 54, height: 54, borderRadius: '50%',
        background: unlocked ? 'linear-gradient(135deg,#f59e0b,#ef4444)' : 'rgba(255,255,255,0.06)',
        border: unlocked ? '2px solid rgba(245,158,11,0.5)' : '2px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
        boxShadow: unlocked ? '0 0 20px rgba(245,158,11,0.35)' : 'none',
        transition: 'all 0.5s',
        animation: unlocked ? 'popIn 0.5s cubic-bezier(.34,1.56,.64,1) both' : 'none',
      }}>{icon}</div>
      <span style={{ fontSize: 11, fontWeight: 700, color: unlocked ? '#fbbf24' : 'rgba(255,255,255,0.25)', textAlign: 'center' }}>{label}</span>
    </div>
  )
}

/* ── Theme Card ───────────────────────────────────────────────────────────── */
function ThemeCard({ theme, active, onSelect, flash }) {
  return (
    <button onClick={() => onSelect(theme.id)}
      style={{
        position: 'relative', padding: '14px 12px', borderRadius: 16, cursor: 'pointer',
        background: active
          ? `linear-gradient(135deg,${theme.accent}22,${theme.accent}0a)`
          : 'rgba(255,255,255,0.04)',
        border: active
          ? `2px solid ${theme.accent}`
          : '2px solid rgba(255,255,255,0.08)',
        transition: 'all 0.3s cubic-bezier(.34,1.1,.64,1)',
        transform: active ? 'scale(1.04)' : 'scale(1)',
        boxShadow: active ? `0 0 20px ${theme.accent}40, 0 8px 24px rgba(0,0,0,0.3)` : '0 4px 14px rgba(0,0,0,0.2)',
        overflow: 'hidden',
        fontFamily: 'DM Sans,sans-serif',
        textAlign: 'left',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.borderColor = theme.accent + '60' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.transform = 'scale(1)'; if (!active) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
    >
      {/* flash overlay on select */}
      {flash && (
        <div style={{ position: 'absolute', inset: 0, background: theme.accent, borderRadius: 14, animation: 'themeFlash 0.6s ease-out forwards', pointerEvents: 'none' }} />
      )}

      {/* colour swatch */}
      <div style={{
        width: '100%', height: 36, borderRadius: 10, marginBottom: 10,
        background: theme.grad,
        boxShadow: active ? `0 4px 16px ${theme.accent}50` : 'none',
        transition: 'box-shadow 0.3s',
      }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
        <span style={{ fontSize: 16 }}>{theme.icon}</span>
        <span style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 14, color: active ? theme.accent : '#fff' }}>{theme.name}</span>
        {active && (
          <span style={{
            marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: theme.accent,
            background: `${theme.accent}20`, padding: '2px 8px', borderRadius: 20,
            border: `1px solid ${theme.accent}40`,
          }}>ACTIVE</span>
        )}
      </div>
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', margin: 0, fontWeight: 500 }}>{theme.desc}</p>
    </button>
  )
}

/* ─────────────────────────────────────────────────────────────────────────── */
export default function Profile({ logs, setLogs, overallTotal, summaryData, currentUser, onLogout }) {

  const [activeTheme, setActiveTheme] = useState('violet')
  const [flashTheme, setFlashTheme] = useState(null)
  const [trackSmoking, setTrackSmoking] = useState(false)
  const [userName, setUserName] = useState(currentUser?.name || 'User')
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(currentUser?.name || 'User')
  const [showReset, setShowReset] = useState(false)
  const [resetDone, setResetDone] = useState(false)
  const [themeToast, setThemeToast] = useState(null)
  const [ledgerEntries, setLedgerEntries] = useState([])

  /* Subscribe to ledger from Firestore */
  useEffect(() => {
    if (!currentUser?.username) return
    const ref = doc(db, 'acr_ledger', currentUser.username.toLowerCase())
    const unsub = onSnapshot(ref, (snap) => {
      setLedgerEntries(snap.exists() ? (snap.data().entries || []) : [])
    })
    return () => unsub()
  }, [currentUser?.username])

  const ledgerLent = ledgerEntries.filter(e => e.type === 'lent' && !e.settled).reduce((s, e) => s + e.amount, 0)
  const ledgerBorrowed = ledgerEntries.filter(e => e.type === 'borrowed' && !e.settled).reduce((s, e) => s + e.amount, 0)
  const ledgerOverdue = ledgerEntries.filter(e => !e.settled && e.dueDate && Math.ceil((new Date(e.dueDate) - new Date()) / 86400000) < 0).length
  const ledgerActive = ledgerEntries.filter(e => !e.settled).length

  /* load persisted prefs */
  useEffect(() => {
    const s = localStorage.getItem('acr_smoke_tracker')
    if (s) setTrackSmoking(JSON.parse(s))
    const key = `acr_username_${currentUser?.username}`
    const n = localStorage.getItem(key)
    if (n) { setUserName(n); setNameInput(n) }
    const t = localStorage.getItem('acr_theme') || 'violet'
    setActiveTheme(t)
    applyTheme(t)
  }, [])

  useEffect(() => { localStorage.setItem('acr_smoke_tracker', JSON.stringify(trackSmoking)) }, [trackSmoking])

  const handleSelectTheme = (id) => {
    setFlashTheme(id)
    setTimeout(() => setFlashTheme(null), 600)
    setActiveTheme(id)
    applyTheme(id)
    const t = THEMES.find(t => t.id === id)
    setThemeToast(t.name)
    setTimeout(() => setThemeToast(null), 2200)
  }

  /* derived stats */
  const smokeLogs = useMemo(() => logs.filter(l => l.category === 'Smoke'), [logs])
  const streak = useMemo(() => {
    const today = new Date()
    if (smokeLogs.length === 0) {
      if (!logs.length) return 0
      return Math.floor((today - new Date(logs[logs.length - 1].id)) / 86400000)
    }
    return Math.max(0, Math.floor((today - new Date(smokeLogs[0].id)) / 86400000))
  }, [smokeLogs, logs])

  const moneySaved = streak * 20
  const lastSmokeDate = smokeLogs.length ? new Date(smokeLogs[0].id) : null
  const motivation = streak === 0 ? 'Start fresh today 💪'
    : streak < 3 ? 'Good start, keep going! 🔥'
    : streak < 7 ? 'Stay strong, you got this 💯'
    : streak < 30 ? 'Building real discipline 🚀'
    : 'Absolute beast mode 🏆'

  const avgPerEntry = logs.length ? Math.round(overallTotal / logs.length) : 0
  const topCat = summaryData?.[0]?.name || 'N/A'
  const topCatTotal = summaryData?.[0]?.total || 0
  const maxCatTotal = summaryData?.[0]?.total || 1

  const sparkData = useMemo(() => {
    const h = Array(12).fill(0)
    const now = new Date().getHours()
    logs.forEach(l => {
      const lh = parseInt(l.time?.split(':')[0] || '0')
      const idx = ((lh - now + 24) % 24)
      if (idx < 12) h[11 - idx] += l.amount
    })
    return h
  }, [logs])

  const daysActive = useMemo(() => {
    if (!logs.length) return 0
    const first = new Date(logs[logs.length - 1].id)
    return Math.max(1, Math.floor((new Date() - first) / 86400000) + 1)
  }, [logs])

  const catRings = useMemo(() =>
    (summaryData || []).slice(0, 3).map(c => ({
      name: c.name, total: c.total, color: c.color,
      pct: overallTotal ? Math.round((c.total / overallTotal) * 100) : 0,
    })), [summaryData, overallTotal])

  const handleReset = () => {
    setLogs([])
    setResetDone(true)
    setShowReset(false)
    setTimeout(() => setResetDone(false), 2500)
  }

  const saveName = () => {
    const n = nameInput.trim() || 'User'
    setUserName(n)
    localStorage.setItem(`acr_username_${currentUser?.username}`, n)
    setEditingName(false)
  }

  const currentTheme = THEMES.find(t => t.id === activeTheme) || THEMES[0]

  const panel = {
    background: 'linear-gradient(135deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))',
    border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: 18, padding: 18,
    boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
  }

  const initials = userName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  return (
    <>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:ital,wght@0,400;0,500;0,700;1,400&display=swap');
      .prof { font-family:'DM Sans',sans-serif; color:#f1f5f9; }
      @keyframes slideUp   { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }
      @keyframes slideIn   { from{opacity:0;transform:translateX(-16px)} to{opacity:1;transform:translateX(0)} }
      @keyframes popIn     { 0%{opacity:0;transform:scale(0.7)} 70%{transform:scale(1.06)} 100%{opacity:1;transform:scale(1)} }
      @keyframes floatY    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
      @keyframes shimBar   { 0%{transform:translateX(-100%)} 100%{transform:translateX(250%)} }
      @keyframes glowPulse2{ 0%,100%{opacity:0.5;transform:scale(1)} 50%{opacity:1;transform:scale(1.1)} }
      @keyframes fadeIn    { from{opacity:0} to{opacity:1} }
      @keyframes streakPop { 0%{transform:scale(1)} 50%{transform:scale(1.08)} 100%{transform:scale(1)} }
      @keyframes themeFlash{ 0%{opacity:0} 30%{opacity:0.18} 100%{opacity:0} }
      @keyframes toastSlide{ from{opacity:0;transform:translateX(-50%) translateY(20px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
      .card-hover { transition:transform 0.22s,box-shadow 0.22s; }
      .card-hover:hover { transform:translateY(-3px); box-shadow:0 20px 48px rgba(0,0,0,0.45)!important; }
      .prof input::placeholder { color:rgba(255,255,255,0.25)!important; }
      @media(max-width:640px){
        .prof-hero{padding:14px 14px 12px!important;border-radius:16px!important;margin-bottom:12px!important;}
        .prof-avatar{width:46px!important;height:46px!important;font-size:16px!important;box-shadow:none!important;}
        .prof-name{font-size:16px!important;}
        .prof-total{font-size:18px!important;}
        .prof-mini-stats{gap:5px!important;margin-top:10px!important;}
        .prof-mini-stat{padding:7px 8px!important;border-radius:10px!important;}
        .prof-mini-stat .ms-val{font-size:11px!important;}
        .prof-mini-stat .ms-lbl{font-size:8px!important;}
        .prof-mini-stat .ms-icon{font-size:12px!important;}
        .card-hover{padding:14px!important;border-radius:16px!important;margin-bottom:10px!important;}
        .prof p{font-size:11px!important;}
        .prof .section-title{font-size:13px!important;}
      }
    `}</style>

    <div className="prof" style={{ maxWidth: 860, margin: '0 auto', paddingBottom: 40, position: 'relative' }}>

      {/* ambient blobs - use theme colors */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '5%', left: '55%', width: 380, height: 380, borderRadius: '50%', background: `radial-gradient(circle,var(--blob-1),transparent 70%)`, animation: 'floatY 10s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', top: '55%', left: '-5%', width: 280, height: 280, borderRadius: '50%', background: `radial-gradient(circle,var(--blob-2),transparent 70%)`, animation: 'floatY 13s ease-in-out infinite reverse' }} />
      </div>

      {/* ── HERO HEADER ── */}
      <div className="prof-hero" style={{
        position: 'relative', zIndex: 10, borderRadius: 26, overflow: 'hidden',
        marginBottom: 20, animation: 'slideUp 0.5s ease-out both',
        background: `linear-gradient(135deg,${currentTheme.accent}28 0%,${currentTheme.accent}14 40%,rgba(52,211,153,0.1) 100%)`,
        border: `1px solid ${currentTheme.accent}30`,
        boxShadow: `0 20px 60px rgba(0,0,0,0.4), 0 0 40px ${currentTheme.accent}15`,
        padding: '32px 32px 28px',
        transition: 'background 0.5s,border 0.5s,box-shadow 0.5s',
      }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', border: `1px solid ${currentTheme.accent}18`, pointerEvents: 'none', transition: 'border 0.5s' }} />
        <div style={{ position: 'absolute', top: -70, right: -70, width: 280, height: 280, borderRadius: '50%', border: `1px solid ${currentTheme.accent}08`, pointerEvents: 'none' }} />

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap' }}>
          {/* Avatar */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{
              width: 90, height: 90, borderRadius: '50%',
              background: currentTheme.grad,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 32, fontWeight: 800, color: '#fff', fontFamily: 'Syne,sans-serif',
              boxShadow: `0 0 30px ${currentTheme.accent}50`,
              border: '3px solid rgba(255,255,255,0.15)',
              transition: 'background 0.5s,box-shadow 0.5s',
            }} className="prof-avatar">{initials}</div>
            <div style={{ position: 'absolute', bottom: 2, right: 2, width: 18, height: 18, borderRadius: '50%', background: '#34d399', border: '2px solid rgba(15,10,40,0.8)', boxShadow: '0 0 8px #34d39980' }} />
          </div>

          {/* Name */}
          <div style={{ flex: 1, minWidth: 180 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>Welcome back</p>
            {editingName ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <input value={nameInput} onChange={e => setNameInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveName()} autoFocus
                  style={{ padding: '8px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.1)', border: `1px solid ${currentTheme.accent}60`, color: '#fff', fontSize: 18, fontWeight: 700, fontFamily: 'Syne,sans-serif', outline: 'none', width: 180 }} />
                <button onClick={saveName} style={{ background: currentTheme.grad, border: 'none', color: '#fff', padding: '8px 16px', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: 13, fontFamily: 'DM Sans,sans-serif' }}>Save</button>
                <button onClick={() => setEditingName(false)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 18 }}>✕</button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <h2 style={{ fontFamily: 'Syne,sans-serif', fontSize: 28, fontWeight: 800, color: '#fff', margin: 0 }}>{userName}</h2>
                <button onClick={() => setEditingName(true)} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.4)', fontSize: 12, padding: '3px 10px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>✏ Edit</button>
              </div>
            )}
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: 0 }}>ACR MAX · {daysActive}d active · {currentTheme.icon} {currentTheme.name}</p>
          </div>

          {/* Total */}
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Total Tracked</p>
            <p style={{ fontFamily: 'Syne,sans-serif', fontSize: 32, fontWeight: 800, color: '#fff', margin: 0, lineHeight: 1 }}><AnimCount value={overallTotal} /></p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>{logs.length} transactions</p>
          </div>
        </div>

        {/* mini stats */}
        <div className="prof-mini-stats" style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
          {[
            { label: 'Avg / Entry', value: fmt(avgPerEntry), icon: '📐', color: '#60a5fa' },
            { label: 'Top Category', value: topCat, icon: '🏆', color: '#f472b6' },
            { label: 'Days Active', value: `${daysActive}d`, icon: '📅', color: '#34d399' },
            { label: 'Smoke-Free', value: `${streak}d`, icon: '🚭', color: '#fbbf24' },
          ].map((s, i) => (
            <div key={i} style={{ flex: '1 1 100px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 14, padding: '10px 14px', animation: `slideUp 0.4s ease-out ${0.2 + i * 0.06}s both` }}>
              <div style={{ fontSize: 16, marginBottom: 3 }}>{s.icon}</div>
              <p style={{ fontFamily: 'Syne,sans-serif', fontSize: 16, fontWeight: 800, color: s.color, margin: 0 }}>{s.value}</p>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          THEME PICKER
      ══════════════════════════════════════════════ */}
      <div className="card-hover" style={{ ...panel, position: 'relative', zIndex: 10, marginBottom: 16, animation: 'slideUp 0.45s ease-out 0.12s both', borderTop: `2px solid ${currentTheme.accent}50` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div>
            <p style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, color: '#fff', fontSize: 14, margin: 0 }} className='section-title'>🎨 App Theme</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 3 }}>Changes the entire app colour instantly</p>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: `${currentTheme.accent}15`, border: `1px solid ${currentTheme.accent}35`,
            borderRadius: 20, padding: '6px 14px',
            transition: 'all 0.4s',
          }}>
            <span style={{ fontSize: 16 }}>{currentTheme.icon}</span>
            <span style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: 13, color: currentTheme.accent, transition: 'color 0.4s' }}>{currentTheme.name}</span>
          </div>
        </div>

        {/* Theme dropdown select */}
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, borderRadius: '50%', background: currentTheme.accent, boxShadow: `0 0 8px ${currentTheme.accent}80`, pointerEvents: 'none', zIndex: 2 }} />
            <select
              value={activeTheme}
              onChange={e => handleSelectTheme(e.target.value)}
              style={{
                width: '100%', padding: '11px 14px 11px 38px',
                background: `linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.04))`,
                border: `1.5px solid ${currentTheme.accent}50`,
                borderRadius: 14, color: '#fff', fontSize: 14,
                fontFamily: 'DM Sans,sans-serif', fontWeight: 700,
                outline: 'none', cursor: 'pointer',
                boxShadow: `0 0 0 3px ${currentTheme.accent}15`,
                appearance: 'none', WebkitAppearance: 'none',
                transition: 'all 0.3s',
              }}>
              {THEMES.map(t => (
                <option key={t.id} value={t.id} style={{ background: '#0d0b2e', fontWeight: 700 }}>
                  {t.icon} {t.name} — {t.desc}
                </option>
              ))}
            </select>
            <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'rgba(255,255,255,0.4)', pointerEvents: 'none' }}>▼</div>
          </div>
        </div>
      </div>

      {/* ── SMART LEDGER SUMMARY ── */}
      <div className="card-hover" style={{ ...panel, marginBottom: 16, animation: 'slideUp 0.45s ease-out 0.15s both', borderTop: '2px solid rgba(14,165,233,0.4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <p style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, color: '#fff', fontSize: 14, margin: 0 }} className='section-title'>🤝 Smart Ledger</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 3 }}>Money lent, borrowed & pending</p>
          </div>
          {ledgerOverdue > 0 && (
            <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 800, background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', animation: 'ledgerPulse 2s infinite' }}>
              ⚠ {ledgerOverdue} Overdue
            </span>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginBottom: ledgerActive > 0 ? 14 : 0 }}>
          {/* Will Receive */}
          <div style={{ padding: '14px', borderRadius: 14, background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', textAlign: 'center' }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 6px' }}>Will Receive</p>
            <p style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 20, color: '#34d399', margin: 0, textShadow: '0 0 10px rgba(52,211,153,0.4)' }}>₹{ledgerLent.toLocaleString('en-IN')}</p>
            <p style={{ fontSize: 10, color: 'rgba(52,211,153,0.5)', margin: '4px 0 0', fontWeight: 600 }}>↑ Lent out</p>
          </div>
          {/* Will Pay */}
          <div style={{ padding: '14px', borderRadius: 14, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', textAlign: 'center' }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 6px' }}>Will Pay</p>
            <p style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 20, color: '#f87171', margin: 0, textShadow: '0 0 10px rgba(239,68,68,0.4)' }}>₹{ledgerBorrowed.toLocaleString('en-IN')}</p>
            <p style={{ fontSize: 10, color: 'rgba(239,68,68,0.5)', margin: '4px 0 0', fontWeight: 600 }}>↓ Borrowed</p>
          </div>
        </div>

        {/* Active entries list */}
        {ledgerActive === 0 ? (
          <p style={{ textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.2)', padding: '8px 0' }}>No active ledger entries</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ledgerEntries.filter(e => !e.settled).slice(0, 4).map(e => {
              const daysLeft = e.dueDate ? Math.ceil((new Date(e.dueDate) - new Date()) / 86400000) : null
              const isLent = e.type === 'lent'
              const accent = isLent ? '#34d399' : '#f87171'
              return (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 12, border: `1px solid ${daysLeft !== null && daysLeft < 0 ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.06)'}` }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: e.color || accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                    {e.person.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 700, color: '#fff', fontSize: 13, margin: 0 }}>{e.person}</p>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', margin: 0 }}>
                      {e.category} · {isLent ? 'to receive' : 'to pay'}
                      {daysLeft !== null && (daysLeft < 0 ? <span style={{ color: '#f87171', fontWeight: 700 }}> · overdue {Math.abs(daysLeft)}d</span> : daysLeft === 0 ? <span style={{ color: '#fbbf24', fontWeight: 700 }}> · due today</span> : <span> · {daysLeft}d left</span>)}
                    </p>
                  </div>
                  <p style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 15, color: accent, margin: 0, flexShrink: 0 }}>₹{e.amount.toLocaleString('en-IN')}</p>
                </div>
              )
            })}
            {ledgerActive > 4 && <p style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.25)', margin: '4px 0 0' }}>+{ledgerActive - 4} more in Smart Ledger</p>}
          </div>
        )}
      </div>

      {/* ── SPENDING RINGS + ACTIVITY ── */}
      <div style={{ position: 'relative', zIndex: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16, marginBottom: 16 }}>

        <div className="card-hover" style={{ ...panel, animation: 'slideUp 0.45s ease-out 0.2s both' }}>
          <p style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, color: '#fff', fontSize: 13, marginBottom: 14 }}>Top Spending Rings</p>
          {catRings.length === 0
            ? <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No data yet</p>
            : catRings.map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: i < catRings.length - 1 ? 18 : 0, animation: `slideIn 0.4s ease-out ${i * 80}ms both` }}>
                <Ring pct={c.pct} color={c.color} size={64} stroke={6}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', fontFamily: 'Syne,sans-serif' }}>{c.pct}%</span>
                </Ring>
                <div>
                  <p style={{ fontWeight: 700, color: '#fff', fontSize: 14, margin: '0 0 2px' }}>{c.name}</p>
                  <p style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, color: c.color, fontSize: 16, margin: 0, textShadow: `0 0 12px ${c.color}60` }}>{fmt(c.total)}</p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', margin: 0 }}>{c.pct}% of total</p>
                </div>
              </div>
            ))
          }
        </div>

        <div className="card-hover" style={{ ...panel, animation: 'slideUp 0.45s ease-out 0.26s both' }}>
          <p style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, color: '#fff', fontSize: 13, marginBottom: 4 }}>Activity Today</p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)', marginBottom: 18 }}>Last 12 hours pattern</p>
          <div style={{ marginBottom: 18 }}>
            <Sparkline data={sparkData} color={currentTheme.accent} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Highest spend', value: logs.length ? fmt(Math.max(...logs.map(l => l.amount))) : '—', color: '#f87171' },
              { label: 'Lowest spend', value: logs.length ? fmt(Math.min(...logs.map(l => l.amount))) : '—', color: '#34d399' },
              { label: 'Categories', value: summaryData?.length || 0, color: '#60a5fa' },
              { label: 'Total entries', value: logs.length, color: '#fbbf24' },
            ].map((row, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 10 }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>{row.label}</span>
                <span style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 14, color: row.color }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── CATEGORY BREAKDOWN ── */}
      <div className="card-hover" style={{ ...panel, position: 'relative', zIndex: 10, marginBottom: 16, animation: 'slideUp 0.45s ease-out 0.3s both' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <p style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, color: '#fff', fontSize: 13, margin: 0 }}>Spending Breakdown</p>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)', fontWeight: 600 }}>{summaryData?.length || 0} categories</span>
        </div>
        {!summaryData?.length
          ? <p style={{ color: 'rgba(255,255,255,0.22)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Add expenses to see breakdown</p>
          : summaryData.map((c, i) => <CatBar key={c.name} name={c.name} total={c.total} max={maxCatTotal} color={c.color} rank={i} />)
        }
      </div>

      {/* ── SMOKE TRACKER ── */}
      <div style={{ position: 'relative', zIndex: 10, marginBottom: 16, animation: 'slideUp 0.45s ease-out 0.36s both' }}>
        <div className="card-hover" style={{
          ...panel,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: trackSmoking ? 12 : 0,
          border: trackSmoking ? '1px solid rgba(251,191,36,0.25)' : '1px solid rgba(255,255,255,0.09)',
        }}>
          <div>
            <p style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, color: '#fff', fontSize: 13, margin: '0 0 2px' }}>🚬 Smoke-Free Tracker</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', margin: 0 }}>Track your days without smoking</p>
          </div>
          <button onClick={() => setTrackSmoking(t => !t)} style={{
            width: 52, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer', position: 'relative',
            background: trackSmoking ? 'linear-gradient(135deg,#f59e0b,#ef4444)' : 'rgba(255,255,255,0.1)',
            boxShadow: trackSmoking ? '0 0 16px rgba(245,158,11,0.4)' : 'none',
            transition: 'all 0.3s',
          }}>
            <div style={{ position: 'absolute', top: 3, left: trackSmoking ? 26 : 4, width: 22, height: 22, borderRadius: '50%', background: '#fff', transition: 'left 0.3s cubic-bezier(.34,1.56,.64,1)', boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }} />
          </button>
        </div>

        {trackSmoking && (
          <div style={{ background: 'linear-gradient(135deg,rgba(245,158,11,0.1),rgba(239,68,68,0.07))', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 22, padding: 24, animation: 'slideUp 0.4s ease-out both' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24, flexWrap: 'wrap' }}>
              <Ring pct={Math.min((streak / 30) * 100, 100)} color="#f59e0b" size={96} stroke={8}>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontFamily: 'Syne,sans-serif', fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 }}>{streak}</p>
                  <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', margin: 0, fontWeight: 700, textTransform: 'uppercase' }}>days</p>
                </div>
              </Ring>
              <div style={{ flex: 1, minWidth: 140 }}>
                <p style={{ fontFamily: 'Syne,sans-serif', fontSize: 22, fontWeight: 800, color: '#fbbf24', margin: '0 0 4px' }}>🔥 {streak} day{streak !== 1 ? 's' : ''} clean</p>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: '0 0 8px' }}>{lastSmokeDate ? `Last: ${lastSmokeDate.toLocaleDateString('en-IN')}` : 'No smoking recorded 🚀'}</p>
                <p style={{ fontSize: 13, color: '#34d399', fontWeight: 700, margin: '0 0 4px' }}>💰 Saved ₹{moneySaved}</p>
                <p style={{ fontSize: 13, color: '#a78bfa', fontWeight: 600, margin: 0 }}>🧠 {motivation}</p>
              </div>
            </div>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>Milestones</p>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'space-around', flexWrap: 'wrap' }}>
              <Milestone days={1} streak={streak} label="First Day" icon="🌱" />
              <Milestone days={3} streak={streak} label="3 Days" icon="🔥" />
              <Milestone days={7} streak={streak} label="One Week" icon="⚡" />
              <Milestone days={14} streak={streak} label="Two Weeks" icon="💎" />
              <Milestone days={30} streak={streak} label="One Month" icon="🏆" />
            </div>
          </div>
        )}
      </div>

      {/* ── SETTINGS ── */}
      <div className="card-hover" style={{ ...panel, position: 'relative', zIndex: 10, marginBottom: 16, animation: 'slideUp 0.45s ease-out 0.42s both' }}>
        <p style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, color: '#fff', fontSize: 13, marginBottom: 14 }}>⚙️ Settings</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { icon: '📤', label: 'Export Data', sub: 'CSV, JSON or text report', color: '#60a5fa', action: () => alert('Export available in Expense → Export tab') },
            { icon: '🌙', label: 'Dark Mode', sub: 'Always on — premium default', color: '#a78bfa', action: () => alert('Dark mode is always on in ACR MAX 🌙') },
          ].map((item, i) => (
            <button key={i} onClick={item.action}
              style={{
                width: '100%', padding: '14px 18px', borderRadius: 14, textAlign: 'left',
                background: `${item.color}0d`, border: `1px solid ${item.color}22`,
                color: item.color, fontWeight: 700, fontSize: 14, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 12, transition: 'background 0.2s',
                fontFamily: 'DM Sans,sans-serif',
              }}
              onMouseEnter={e => e.currentTarget.style.background = `${item.color}1a`}
              onMouseLeave={e => e.currentTarget.style.background = `${item.color}0d`}>
              <span style={{ fontSize: 20 }}>{item.icon}</span>
              <div>
                <p style={{ margin: 0, fontWeight: 700 }}>{item.label}</p>
                <p style={{ margin: 0, fontSize: 11, color: `${item.color}88`, fontWeight: 400 }}>{item.sub}</p>
              </div>
            </button>
          ))}

          <button onClick={() => setShowReset(true)}
            style={{
              width: '100%', padding: '14px 18px', borderRadius: 14, textAlign: 'left',
              background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)',
              color: '#f87171', fontWeight: 700, fontSize: 14, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 12, transition: 'background 0.2s',
              fontFamily: 'DM Sans,sans-serif',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.13)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.07)'}>
            <span style={{ fontSize: 20 }}>🗑️</span>
            <div>
              <p style={{ margin: 0, fontWeight: 700 }}>Reset All Data</p>
              <p style={{ margin: 0, fontSize: 11, color: 'rgba(248,113,113,0.55)', fontWeight: 400 }}>Clear all expense logs permanently</p>
            </div>
          </button>
        </div>
      </div>

      {/* ── SUMMARY ── */}
      <div className="card-hover" style={{
        position: 'relative', zIndex: 10,
        background: `linear-gradient(135deg,${currentTheme.accent}10,rgba(255,255,255,0.03))`,
        border: `1px solid ${currentTheme.accent}20`,
        borderRadius: 22, padding: 24,
        animation: 'slideUp 0.45s ease-out 0.48s both',
        transition: 'background 0.5s,border 0.5s',
      }}>
        <p style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, color: '#fff', fontSize: 13, marginBottom: 10 }}>📊 Your Summary</p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.75, margin: 0 }}>
          You've tracked <b style={{ color: currentTheme.accent }}>{logs.length} expenses</b> totaling{' '}
          <b style={{ color: '#34d399' }}>{fmt(overallTotal)}</b> over{' '}
          <b style={{ color: '#60a5fa' }}>{daysActive} day{daysActive !== 1 ? 's' : ''}</b>.{' '}
          {topCat !== 'N/A' && <>Biggest category: <b style={{ color: '#f472b6' }}>{topCat}</b> at <b style={{ color: '#f472b6' }}>{fmt(topCatTotal)}</b>. </>}
          {streak > 0 && trackSmoking && <><b style={{ color: '#fbbf24' }}>{streak} day{streak !== 1 ? 's' : ''} smoke-free</b> — saved <b style={{ color: '#34d399' }}>₹{moneySaved}</b>. </>}
          Keep building those strong habits 🚀
        </p>
      </div>

      {/* ── RESET MODAL ── */}
      {showReset && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.2s ease-out both' }}>
          <div style={{ background: 'linear-gradient(135deg,rgba(25,15,55,0.98),rgba(15,10,35,0.98))', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 22, padding: 32, maxWidth: 360, width: '90%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.7)', animation: 'popIn 0.3s cubic-bezier(.34,1.56,.64,1) both' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <h3 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, color: '#fff', fontSize: 20, marginBottom: 8 }}>Reset All Data?</h3>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginBottom: 24, lineHeight: 1.6 }}>This will permanently delete all <b style={{ color: '#f87171' }}>{logs.length} expense entries</b>. This cannot be undone.</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setShowReset(false)} style={{ flex: 1, padding: '12px', borderRadius: 12, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', fontWeight: 700, cursor: 'pointer', fontSize: 14, fontFamily: 'DM Sans,sans-serif' }}>Cancel</button>
              <button onClick={handleReset} style={{ flex: 1, padding: '12px', borderRadius: 12, background: 'linear-gradient(135deg,#ef4444,#dc2626)', border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14, fontFamily: 'Syne,sans-serif' }}>Yes, Reset</button>
            </div>
          </div>
        </div>
      )}

      {/* ── TOASTS ── */}
      {resetDone && (
        <div style={{ position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg,#34d399,#059669)', color: '#fff', padding: '12px 28px', borderRadius: 40, fontWeight: 700, fontSize: 14, zIndex: 200, boxShadow: '0 8px 32px rgba(52,211,153,0.4)', animation: 'toastSlide 0.4s ease-out both', fontFamily: 'DM Sans,sans-serif' }}>✓ All data cleared!</div>
      )}
      {themeToast && (
        <div style={{
          position: 'fixed', bottom: 100, left: '50%',
          background: currentTheme.grad,
          color: '#fff', padding: '12px 28px', borderRadius: 40,
          fontWeight: 700, fontSize: 14, zIndex: 200,
          boxShadow: `0 8px 32px ${currentTheme.accent}50`,
          animation: 'toastSlide 0.4s ease-out both',
          fontFamily: 'DM Sans,sans-serif',
          display: 'flex', alignItems: 'center', gap: 8,
          whiteSpace: 'nowrap',
        }}>
          <span style={{ fontSize: 18 }}>{currentTheme.icon}</span>
          {themeToast} theme applied!
        </div>
      )}
    </div>
    </>
  )
}