import { useState, useEffect, useRef, useMemo } from 'react'
import { db } from '../firebase'
import { doc, onSnapshot } from 'firebase/firestore'

const fmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`

/* ── THEMES ── */
const THEMES = [
  { id:'violet', name:'Violet', icon:'💜', accent:'#7c3aed', grad:'linear-gradient(135deg,#7c3aed,#4f46e5)', desc:'Deep space violet' },
  { id:'emerald',name:'Emerald',icon:'💚', accent:'#059669', grad:'linear-gradient(135deg,#059669,#047857)', desc:'Forest emerald' },
  { id:'rose',   name:'Rose',   icon:'🌹', accent:'#e11d48', grad:'linear-gradient(135deg,#e11d48,#be123c)', desc:'Bold crimson rose' },
  { id:'amber',  name:'Amber',  icon:'🌙', accent:'#d97706', grad:'linear-gradient(135deg,#d97706,#b45309)', desc:'Warm amber gold' },
  { id:'cyan',   name:'Cyan',   icon:'🌊', accent:'#0891b2', grad:'linear-gradient(135deg,#0891b2,#0e7490)', desc:'Electric ocean' },
  { id:'orange', name:'Orange', icon:'🔥', accent:'#ea580c', grad:'linear-gradient(135deg,#ea580c,#c2410c)', desc:'Fiery ember' },
]
function applyTheme(id) {
  document.documentElement.setAttribute('data-theme', id)
  localStorage.setItem('acr_theme', id)
}

/* ── Animated progress bar ── */
function ProgressBar({ pct, color, height = 8 }) {
  const [w, setW] = useState(0)
  useEffect(() => { const t = setTimeout(() => setW(pct), 200); return () => clearTimeout(t) }, [pct])
  return (
    <div style={{ height, borderRadius: height, background: 'linear-gradient(145deg,#e0e0e0,#f5f5f5)', boxShadow: 'inset 2px 2px 5px rgba(0,0,0,0.1), inset -1px -1px 3px rgba(255,255,255,0.8)', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${w}%`, borderRadius: height, background: `linear-gradient(90deg,${color},${color}cc)`, transition: 'width 1.2s cubic-bezier(.34,1.1,.64,1)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.35),transparent)', animation: 'shimBar 2s infinite' }} />
      </div>
    </div>
  )
}

/* ── Achievement badge ── */
function AchievementBadge({ icon, label, sub, unlocked, color }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      padding: '14px 8px',
      background: unlocked ? `linear-gradient(145deg,#fff,${color}15)` : 'linear-gradient(145deg,#f5f5f5,#e8e8e8)',
      borderRadius: 16,
      border: unlocked ? `1.5px solid ${color}40` : '1.5px solid #e2e8f0',
      boxShadow: unlocked
        ? `4px 4px 10px rgba(0,0,0,0.08), -2px -2px 6px rgba(255,255,255,0.9), inset 0 1px 0 rgba(255,255,255,0.8)`
        : `2px 2px 6px rgba(0,0,0,0.06), -1px -1px 4px rgba(255,255,255,0.8)`,
      opacity: unlocked ? 1 : 0.45,
      transition: 'all 0.4s',
      position: 'relative', overflow: 'hidden',
    }}>
      {unlocked && <div style={{ position: 'absolute', top: 0, right: 0, width: 8, height: 8, borderRadius: '0 16px 0 8px', background: color }} />}
      <span style={{ fontSize: 24, filter: unlocked ? 'none' : 'grayscale(1)' }}>{icon}</span>
      <p style={{ fontSize: 10, fontWeight: 700, color: unlocked ? '#1a1a1a' : '#9ca3af', margin: 0, textAlign: 'center', lineHeight: 1.3, fontFamily: 'Poppins,sans-serif' }}>{label}</p>
      <p style={{ fontSize: 8, color: unlocked ? color : '#9ca3af', margin: 0, textAlign: 'center', fontFamily: 'Poppins,sans-serif', fontWeight: 600 }}>{sub}</p>
    </div>
  )
}

/* ── Insight card ── */
function InsightCard({ icon, text, sub, color, bg, delay = 0 }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12, padding: '13px 14px',
      background: `linear-gradient(145deg,${bg},#fff)`,
      border: `1.5px solid ${color}25`,
      borderRadius: 14,
      boxShadow: `3px 3px 8px rgba(0,0,0,0.07), -2px -2px 5px rgba(255,255,255,0.9)`,
      animation: `slideIn 0.4s ease-out ${delay}ms both`,
    }}>
      <div style={{ width: 36, height: 36, borderRadius: 12, background: `linear-gradient(135deg,${color}20,${color}10)`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{icon}</div>
      <div>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', margin: '0 0 2px', fontFamily: 'Poppins,sans-serif', lineHeight: 1.4 }}>{text}</p>
        {sub && <p style={{ fontSize: 11, color: '#6b7280', margin: 0, fontFamily: 'Poppins,sans-serif' }}>{sub}</p>}
      </div>
    </div>
  )
}

/* ── Neu card wrapper ── */
function NeuCard({ children, style = {}, accent }) {
  return (
    <div style={{
      background: 'linear-gradient(145deg,#ffffff,#f0f0f0)',
      borderRadius: 20,
      border: accent ? `1px solid ${accent}20` : '1px solid rgba(255,255,255,0.9)',
      boxShadow: '6px 6px 16px rgba(0,0,0,0.08), -4px -4px 10px rgba(255,255,255,0.9), inset 0 1px 0 rgba(255,255,255,0.8)',
      padding: 18,
      marginBottom: 14,
      ...style,
    }}>
      {children}
    </div>
  )
}

/* ── Section header ── */
function SectionHeader({ title, accent }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
      <div style={{ width: 3, height: 16, borderRadius: 2, background: `linear-gradient(to bottom,${accent},${accent}50)` }} />
      <p style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.12em', margin: 0, fontFamily: 'Poppins,sans-serif' }}>{title}</p>
    </div>
  )
}

/* ═════════════════════════════════════════════════════
   MAIN PROFILE COMPONENT
═════════════════════════════════════════════════════ */
export default function Profile({ logs, setLogs, overallTotal, summaryData, currentUser, onLogout }) {
  const [activeTheme, setActiveTheme]   = useState('violet')
  const [trackSmoking, setTrackSmoking] = useState(false)
  const [userName, setUserName]         = useState(currentUser?.name || 'User')
  const [editingName, setEditingName]   = useState(false)
  const [nameInput, setNameInput]       = useState(currentUser?.name || 'User')
  const [showReset, setShowReset]       = useState(false)
  const [resetDone, setResetDone]       = useState(false)
  const [themeToast, setThemeToast]     = useState(null)
  const [ledgerEntries, setLedgerEntries] = useState([])

  /* Ledger sync */
  useEffect(() => {
    if (!currentUser?.username) return
    const ref = doc(db, 'acr_ledger', currentUser.username.toLowerCase())
    const unsub = onSnapshot(ref, (snap) => {
      setLedgerEntries(snap.exists() ? (snap.data().entries || []) : [])
    })
    return () => unsub()
  }, [currentUser?.username])

  /* Load prefs */
  useEffect(() => {
    const s = localStorage.getItem('acr_smoke_tracker')
    if (s) setTrackSmoking(JSON.parse(s))
    const key = `acr_username_${currentUser?.username}`
    const n = localStorage.getItem(key)
    if (n) { setUserName(n); setNameInput(n) }
    const t = localStorage.getItem('acr_theme') || 'violet'
    setActiveTheme(t); applyTheme(t)
  }, [])

  useEffect(() => { localStorage.setItem('acr_smoke_tracker', JSON.stringify(trackSmoking)) }, [trackSmoking])

  const handleSelectTheme = (id) => {
    setActiveTheme(id); applyTheme(id)
    const t = THEMES.find(t => t.id === id)
    setThemeToast(t.name); setTimeout(() => setThemeToast(null), 2000)
  }

  const saveName = () => {
    const n = nameInput.trim() || 'User'
    setUserName(n)
    localStorage.setItem(`acr_username_${currentUser?.username}`, n)
    setEditingName(false)
  }

  const handleReset = () => {
    setLogs([]); setResetDone(true); setShowReset(false)
    setTimeout(() => setResetDone(false), 2500)
  }

  /* ── Computed values ── */
  const smokeLogs = useMemo(() => logs.filter(l => l.category === 'Smoke'), [logs])
  const streak = useMemo(() => {
    const today = new Date()
    if (smokeLogs.length === 0) { if (!logs.length) return 0; return Math.floor((today - new Date(logs[logs.length - 1].id)) / 86400000) }
    return Math.max(0, Math.floor((today - new Date(smokeLogs[0].id)) / 86400000))
  }, [smokeLogs, logs])

  const moneySaved    = streak * 20
  const daysActive    = useMemo(() => { if (!logs.length) return 0; return Math.max(1, Math.floor((new Date() - new Date(logs[logs.length-1].id)) / 86400000) + 1) }, [logs])
  const topCat        = summaryData?.[0]?.name || null
  const topCatPct     = summaryData?.[0] && overallTotal ? Math.round((summaryData[0].total / overallTotal) * 100) : 0
  const avgPerEntry   = logs.length ? Math.round(overallTotal / logs.length) : 0
  const ledgerActive  = ledgerEntries.filter(e => !e.settled).length
  const ledgerOverdue = ledgerEntries.filter(e => !e.settled && e.dueDate && Math.ceil((new Date(e.dueDate) - new Date()) / 86400000) < 0).length

  /* ── Spending change vs last week ── */
  const spendChange = useMemo(() => {
    const now = new Date(); const msDay = 86400000
    const thisWeek = logs.filter(l => (now - new Date(l.id)) < 7 * msDay).reduce((s,l) => s + l.amount, 0)
    const lastWeek = logs.filter(l => { const d = now - new Date(l.id); return d >= 7 * msDay && d < 14 * msDay }).reduce((s,l) => s + l.amount, 0)
    if (!lastWeek) return null
    return Math.round(((thisWeek - lastWeek) / lastWeek) * 100)
  }, [logs])

  /* ── Level system ── */
  const level = overallTotal >= 100000 ? { name:'Gold', icon:'🥇', color:'#d97706', next:null, pct:100 }
    : overallTotal >= 25000  ? { name:'Silver', icon:'🥈', color:'#6b7280', next:'Gold', pct: Math.round((overallTotal/100000)*100) }
    : { name:'Bronze', icon:'🥉', color:'#92400e', next:'Silver', pct: Math.round((overallTotal/25000)*100) }

  /* ── Streak level ── */
  const streakLabel = streak === 0 ? 'Start your streak!' : streak < 3 ? 'Good start 🔥' : streak < 7 ? 'Building momentum 💪' : streak < 30 ? 'Real discipline 🚀' : 'Beast mode 🏆'

  /* ── Initials ── */
  const initials = userName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  const currentTheme = THEMES.find(t => t.id === activeTheme) || THEMES[0]
  const acc = currentTheme.accent

  return (
    <>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=Syne:wght@700;800&display=swap');
      .prof { font-family:'Poppins',sans-serif; color:#1a1a1a; }
      @keyframes slideUp   { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
      @keyframes slideIn   { from{opacity:0;transform:translateX(-12px)} to{opacity:1;transform:translateX(0)} }
      @keyframes fadeIn    { from{opacity:0} to{opacity:1} }
      @keyframes popIn     { 0%{opacity:0;transform:scale(0.8)} 70%{transform:scale(1.04)} 100%{opacity:1;transform:scale(1)} }
      @keyframes shimBar   { 0%{transform:translateX(-100%)} 100%{transform:translateX(250%)} }
      @keyframes toastSlide{ from{opacity:0;transform:translateX(-50%) translateY(16px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
      .prof input::placeholder { color:#9ca3af !important; }
      .neu-hover { transition:transform 0.2s,box-shadow 0.2s; cursor:pointer; }
      .neu-hover:hover { transform:translateY(-2px); }
    `}</style>

    <div className="prof" style={{ maxWidth: 860, margin: '0 auto', paddingBottom: 48 }}>

      {/* ═══════════════════════════════════
          1. PROFILE HEADER
      ═══════════════════════════════════ */}
      <div style={{
        borderRadius: 24, overflow: 'hidden', marginBottom: 14,
        background: `linear-gradient(135deg, ${acc}ee, ${acc}99)`,
        boxShadow: `6px 6px 20px ${acc}30, -3px -3px 10px rgba(255,255,255,0.6)`,
        animation: 'slideUp 0.4s ease-out both',
      }}>
        {/* Top stripe */}
        <div style={{ height: 3, background: 'rgba(255,255,255,0.3)' }} />

        <div style={{ padding: '22px 20px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* Avatar */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{ width: 70, height: 70, borderRadius: '50%', background: 'rgba(255,255,255,0.25)', border: '3px solid rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 26, color: '#fff', boxShadow: '3px 3px 10px rgba(0,0,0,0.15)' }}>
                {initials}
              </div>
              {/* Online dot */}
              <div style={{ position: 'absolute', bottom: 2, right: 2, width: 14, height: 14, borderRadius: '50%', background: '#22c55e', border: '2px solid #fff' }} />
            </div>

            {/* Name + badges */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {editingName ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                  <input value={nameInput} onChange={e => setNameInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveName()} autoFocus
                    style={{ padding: '7px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.2)', border: '1.5px solid rgba(255,255,255,0.5)', color: '#fff', fontSize: 16, fontWeight: 700, outline: 'none', fontFamily: 'Poppins,sans-serif', width: 150 }} />
                  <button onClick={saveName} style={{ background: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.4)', color: '#fff', padding: '7px 14px', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 12, fontFamily: 'Poppins,sans-serif' }}>Save</button>
                  <button onClick={() => setEditingName(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 16 }}>✕</button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                  <h2 style={{ fontFamily: 'Syne,sans-serif', fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 }}>{userName}</h2>
                  <button onClick={() => setEditingName(true)} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: 'rgba(255,255,255,0.7)', fontSize: 10, padding: '2px 8px', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontFamily: 'Poppins,sans-serif' }}>✏ Edit</button>
                </div>
              )}
              {/* Status badges row */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: 'rgba(255,255,255,0.2)', color: '#fff', backdropFilter: 'blur(4px)' }}>
                  {level.icon} {level.name} Saver
                </span>
                {streak > 0 && (
                  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: 'rgba(255,255,255,0.2)', color: '#fff' }}>
                    🔥 {streak}d Streak
                  </span>
                )}
                <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: 'rgba(255,255,255,0.2)', color: '#fff' }}>
                  📅 {daysActive}d Active
                </span>
              </div>
            </div>

            {/* Key stat */}
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 3px', fontFamily: 'Poppins,sans-serif' }}>Tracked</p>
              <p style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 20, color: '#fff', margin: 0 }}>{fmt(overallTotal)}</p>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', margin: '2px 0 0', fontFamily: 'Poppins,sans-serif' }}>{logs.length} entries</p>
            </div>
          </div>

          {/* Level progress bar */}
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.75)', fontFamily: 'Poppins,sans-serif' }}>{level.icon} {level.name} Level</span>
              {level.next && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', fontFamily: 'Poppins,sans-serif' }}>Next: {level.next} → {level.pct}%</span>}
            </div>
            <div style={{ height: 6, borderRadius: 6, background: 'rgba(255,255,255,0.2)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${level.pct}%`, borderRadius: 6, background: 'rgba(255,255,255,0.7)', transition: 'width 1.2s ease-out' }} />
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════
          2. SMART INSIGHTS
      ═══════════════════════════════════ */}
      <NeuCard accent={acc}>
        <SectionHeader title="Smart Insights" accent={acc} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {topCat && (
            <InsightCard icon="💡" text={`You spend most on ${topCat}`} sub={`${topCatPct}% of your total spending — ${fmt(summaryData[0]?.total || 0)}`} color="#7c3aed" bg="#faf5ff" delay={0} />
          )}
          {spendChange !== null && (
            <InsightCard
              icon={spendChange > 0 ? '📈' : '📉'}
              text={spendChange > 0 ? `Spending up ${spendChange}% this week` : `Spending down ${Math.abs(spendChange)}% this week`}
              sub={spendChange > 0 ? 'Higher than last week — review your budget' : 'Great job! You\'re spending less than last week'}
              color={spendChange > 0 ? '#dc2626' : '#16a34a'}
              bg={spendChange > 0 ? '#fff1f2' : '#f0fdf4'}
              delay={80}
            />
          )}
          {streak > 0 && trackSmoking && (
            <InsightCard icon="🚭" text={`${streak} day${streak>1?'s':''} smoke-free — saved ${fmt(moneySaved)}`} sub={streakLabel} color="#d97706" bg="#fffbeb" delay={160} />
          )}
          {avgPerEntry > 0 && (
            <InsightCard icon="📊" text={`Average spend ₹${avgPerEntry.toLocaleString('en-IN')} per entry`} sub={avgPerEntry > 1000 ? 'High avg — consider categorising more carefully' : 'Healthy average transaction size'} color="#0891b2" bg="#f0f9ff" delay={240} />
          )}
          {ledgerOverdue > 0 && (
            <InsightCard icon="⚠️" text={`${ledgerOverdue} overdue payment${ledgerOverdue>1?'s':''} in Smart Ledger`} sub="Review your ledger to settle pending amounts" color="#dc2626" bg="#fff1f2" delay={320} />
          )}
          {!logs.length && (
            <InsightCard icon="🌱" text="Start tracking to unlock insights" sub="Add your first expense to see personalised analysis" color="#16a34a" bg="#f0fdf4" delay={0} />
          )}
        </div>
      </NeuCard>

      {/* ═══════════════════════════════════
          3. ACHIEVEMENTS
      ═══════════════════════════════════ */}
      <NeuCard accent={acc}>
        <SectionHeader title="Achievements" accent={acc} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 9 }}>
          <AchievementBadge icon="🌱" label="First Log"    sub="Logged 1st"       unlocked={logs.length >= 1}   color="#16a34a" />
          <AchievementBadge icon="💰" label="Saver"        sub="₹1,000 tracked"   unlocked={overallTotal >= 1000}  color="#d97706" />
          <AchievementBadge icon="🔥" label="3-Day Streak" sub="3 days active"     unlocked={daysActive >= 3}    color="#ea580c" />
          <AchievementBadge icon="⚡" label="Power User"   sub="10+ entries"       unlocked={logs.length >= 10}  color="#7c3aed" />
          <AchievementBadge icon="🎯" label="Goal Keeper"  sub="Budget on track"   unlocked={logs.length >= 5}   color="#0891b2" />
          <AchievementBadge icon="🏆" label="Silver Saver" sub="₹25,000 tracked"   unlocked={overallTotal >= 25000} color="#6b7280" />
          {trackSmoking && <>
            <AchievementBadge icon="🚭" label="2 Days Clean" sub="Smoke-free"      unlocked={streak >= 2}   color="#16a34a" />
            <AchievementBadge icon="💎" label="Week Clean"   sub="7 days clean"    unlocked={streak >= 7}   color="#0891b2" />
            <AchievementBadge icon="👑" label="Month Clean"  sub="30 days clean"   unlocked={streak >= 30}  color="#d97706" />
          </>}
        </div>
      </NeuCard>

      {/* ═══════════════════════════════════
          4. PROGRESS & GOALS
      ═══════════════════════════════════ */}
      <NeuCard accent={acc}>
        <SectionHeader title="Progress & Goals" accent={acc} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Weekly tracking streak */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', margin: '0 0 2px', fontFamily: 'Poppins,sans-serif' }}>📅 Weekly Tracking</p>
                <p style={{ fontSize: 11, color: '#6b7280', margin: 0, fontFamily: 'Poppins,sans-serif' }}>{Math.min(daysActive,7)}/7 days tracked this cycle</p>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: acc, fontFamily: 'Poppins,sans-serif', alignSelf: 'center' }}>{Math.round((Math.min(daysActive,7)/7)*100)}%</span>
            </div>
            <ProgressBar pct={(Math.min(daysActive,7)/7)*100} color={acc} height={9} />
          </div>

          {/* Level progress */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', margin: '0 0 2px', fontFamily: 'Poppins,sans-serif' }}>{level.icon} {level.name} Saver Level</p>
                <p style={{ fontSize: 11, color: '#6b7280', margin: 0, fontFamily: 'Poppins,sans-serif' }}>{level.next ? `${fmt(overallTotal)} / ${level.name === 'Bronze' ? '₹25,000' : '₹1,00,000'} to ${level.next}` : 'Maximum level reached! 🏆'}</p>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: level.color, fontFamily: 'Poppins,sans-serif', alignSelf: 'center' }}>{level.pct}%</span>
            </div>
            <ProgressBar pct={level.pct} color={level.color} height={9} />
          </div>

          {/* Smoke-free tracker toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: trackSmoking ? 'linear-gradient(145deg,#fffbeb,#fef3c7)' : 'linear-gradient(145deg,#f8f8f8,#efefef)', border: trackSmoking ? '1.5px solid #fde68a' : '1.5px solid #e2e8f0', borderRadius: 14, boxShadow: '3px 3px 8px rgba(0,0,0,0.06), -2px -2px 5px rgba(255,255,255,0.9)' }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', margin: '0 0 2px', fontFamily: 'Poppins,sans-serif' }}>🚭 Smoke-Free Tracker</p>
              <p style={{ fontSize: 11, color: '#6b7280', margin: 0, fontFamily: 'Poppins,sans-serif' }}>{trackSmoking ? `${streak} day${streak!==1?'s':''} clean · ${fmt(moneySaved)} saved` : 'Enable to track smoke-free days'}</p>
            </div>
            <button onClick={() => setTrackSmoking(t => !t)} style={{
              width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', position: 'relative',
              background: trackSmoking ? 'linear-gradient(135deg,#d97706,#f59e0b)' : 'linear-gradient(145deg,#e0e0e0,#f5f5f5)',
              boxShadow: trackSmoking ? '2px 2px 6px rgba(217,119,6,0.3), -1px -1px 3px rgba(255,255,255,0.7)' : '2px 2px 5px rgba(0,0,0,0.12), -1px -1px 3px rgba(255,255,255,0.9)',
              transition: 'all 0.3s',
            }}>
              <div style={{ position: 'absolute', top: 3, left: trackSmoking ? 24 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '1px 1px 4px rgba(0,0,0,0.15)', transition: 'left 0.3s cubic-bezier(.34,1.56,.64,1)' }} />
            </button>
          </div>
        </div>
      </NeuCard>

      {/* ═══════════════════════════════════
          5. THEME
      ═══════════════════════════════════ */}
      <NeuCard accent={acc}>
        <SectionHeader title="App Theme" accent={acc} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: currentTheme.grad, flexShrink: 0, boxShadow: `3px 3px 8px ${acc}30, -1px -1px 4px rgba(255,255,255,0.8)` }} />
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', margin: 0, fontFamily: 'Poppins,sans-serif' }}>{currentTheme.icon} {currentTheme.name}</p>
            <p style={{ fontSize: 11, color: '#6b7280', margin: 0, fontFamily: 'Poppins,sans-serif' }}>{currentTheme.desc}</p>
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, borderRadius: '50%', background: currentTheme.grad, pointerEvents: 'none', zIndex: 2, boxShadow: `2px 2px 5px ${acc}30` }} />
          <select value={activeTheme} onChange={e => handleSelectTheme(e.target.value)} style={{
            width: '100%', padding: '11px 14px 11px 40px',
            background: 'linear-gradient(145deg,#e8e8e8,#ffffff)',
            boxShadow: 'inset 3px 3px 7px rgba(0,0,0,0.1), inset -2px -2px 5px rgba(255,255,255,0.9)',
            border: `1.5px solid ${acc}30`, borderRadius: 14,
            color: '#1a1a1a', fontSize: 13, fontFamily: 'Poppins,sans-serif', fontWeight: 600,
            outline: 'none', cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none',
          }}>
            {THEMES.map(t => <option key={t.id} value={t.id}>{t.icon} {t.name} — {t.desc}</option>)}
          </select>
          <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#9ca3af', pointerEvents: 'none' }}>▼</div>
        </div>
      </NeuCard>

      {/* ═══════════════════════════════════
          6. SETTINGS
      ═══════════════════════════════════ */}
      <NeuCard>
        <SectionHeader title="Settings" accent="#6b7280" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {[
            { icon:'📤', label:'Export Data', sub:'CSV, JSON or text report', color:'#0891b2', action:() => alert('Go to Expenses → Export tab') },
            { icon:'🌙', label:'Dark Mode', sub:'Currently using light theme', color:'#7c3aed', action:() => alert('Toggle in app.css — dark theme available on main branch') },
          ].map((item, i) => (
            <button key={i} onClick={item.action} style={{
              width: '100%', padding: '13px 16px', borderRadius: 14, textAlign: 'left',
              background: `linear-gradient(145deg,${item.color}08,#fff)`,
              border: `1.5px solid ${item.color}18`,
              boxShadow: `3px 3px 8px rgba(0,0,0,0.06), -2px -2px 5px rgba(255,255,255,0.9)`,
              display: 'flex', alignItems: 'center', gap: 12,
              cursor: 'pointer', fontFamily: 'Poppins,sans-serif', transition: 'all 0.2s',
            }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, background: `linear-gradient(135deg,${item.color}20,${item.color}10)`, border: `1px solid ${item.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{item.icon}</div>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: '#1a1a1a' }}>{item.label}</p>
                <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>{item.sub}</p>
              </div>
              <span style={{ marginLeft: 'auto', fontSize: 14, color: '#9ca3af' }}>›</span>
            </button>
          ))}
          <button onClick={() => setShowReset(true)} style={{
            width: '100%', padding: '13px 16px', borderRadius: 14, textAlign: 'left',
            background: 'linear-gradient(145deg,#fff1f2,#fff)',
            border: '1.5px solid #fca5a5',
            boxShadow: '3px 3px 8px rgba(220,38,38,0.07), -2px -2px 5px rgba(255,255,255,0.9)',
            display: 'flex', alignItems: 'center', gap: 12,
            cursor: 'pointer', fontFamily: 'Poppins,sans-serif',
          }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: '#fee2e2', border: '1px solid #fca5a5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🗑️</div>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: '#dc2626' }}>Reset All Data</p>
              <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>Clear all expense logs permanently</p>
            </div>
            <span style={{ marginLeft: 'auto', fontSize: 14, color: '#9ca3af' }}>›</span>
          </button>
        </div>
      </NeuCard>

      {/* ═══════════════════════════════════
          7. ABOUT & CREDITS
      ═══════════════════════════════════ */}
      <NeuCard accent={acc}>
        <SectionHeader title="About ACR MAX" accent={acc} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px', background: 'linear-gradient(145deg,#f8f8f8,#efefef)', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: 'inset 2px 2px 5px rgba(0,0,0,0.07), inset -1px -1px 3px rgba(255,255,255,0.9)', marginBottom: 12 }}>
          <img src="/logo.jpg" alt="ACR MAX" style={{ width: 54, height: 54, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${acc}40`, boxShadow: `3px 3px 10px ${acc}25, -2px -2px 5px rgba(255,255,255,0.8)`, flexShrink: 0 }} />
          <div>
            <p style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 17, color: '#1a1a1a', margin: '0 0 2px' }}>ACR MAX</p>
            <p style={{ fontSize: 10, fontWeight: 700, color: acc, margin: '0 0 4px', letterSpacing: '0.1em' }}>BETA 1.0 · MAXIMISING LIFES</p>
            <p style={{ fontSize: 11, color: '#6b7280', margin: 0, lineHeight: 1.5 }}>All-in-one premium personal finance dashboard</p>
          </div>
        </div>

        {/* Developer */}
        <div style={{ padding: '14px', background: `linear-gradient(145deg,${acc}08,#fff)`, borderRadius: 14, border: `1.5px solid ${acc}20`, boxShadow: `3px 3px 8px rgba(0,0,0,0.06), -2px -2px 5px rgba(255,255,255,0.9)`, marginBottom: 12 }}>
          <p style={{ fontSize: 9, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.14em', margin: '0 0 10px', textAlign: 'center', fontFamily: 'Poppins,sans-serif' }}>Concept · Design · Development</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 46, height: 46, borderRadius: '50%', background: `linear-gradient(135deg,${acc},${acc}80)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 20, color: '#fff', flexShrink: 0, boxShadow: `3px 3px 10px ${acc}35, -2px -2px 5px rgba(255,255,255,0.8)` }}>A</div>
            <div>
              <p style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 16, color: '#1a1a1a', margin: '0 0 2px' }}>Aswin C R</p>
              <p style={{ fontSize: 11, fontWeight: 600, color: acc, margin: '0 0 3px', fontFamily: 'Poppins,sans-serif' }}>Founder & Chief Executive</p>
              <p style={{ fontSize: 10, color: '#6b7280', margin: 0, fontFamily: 'Poppins,sans-serif' }}>Full Stack Developer · UI/UX Designer · Product Architect</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
            {['💡 Product Vision','🎨 UI/UX Design','⚙️ Engineering','🔐 Security','☁️ Cloud Infra'].map((tag,i) => (
              <span key={i} style={{ padding:'3px 10px', borderRadius:20, fontSize:9, fontWeight:700, background:`${acc}12`, border:`1px solid ${acc}25`, color:acc, fontFamily:'Poppins,sans-serif' }}>{tag}</span>
            ))}
          </div>
        </div>

        {/* Tech pills */}
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 9, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 9px', fontFamily: 'Poppins,sans-serif' }}>Powered By</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 7 }}>
            {[['React + Vite','#0ea5e9','#eff6ff','#bfdbfe'],['Firebase','#d97706','#fffbeb','#fde68a'],['Firestore','#dc2626','#fff1f2','#fecdd3'],['Gemini AI','#7c3aed','#faf5ff','#ddd6fe'],['Newsdata.io','#059669','#f0fdf4','#bbf7d0'],['Tailwind CSS','#0891b2','#f0f9ff','#bae6fd']].map(([t,c,bg,br],i) => (
              <div key={i} style={{ padding:'8px 6px', borderRadius:11, background:`linear-gradient(145deg,${bg},#fff)`, border:`1.5px solid ${br}`, textAlign:'center', boxShadow:'2px 2px 5px rgba(0,0,0,0.06),-1px -1px 3px rgba(255,255,255,0.9)' }}>
                <p style={{ fontSize:10, fontWeight:700, color:c, margin:0, fontFamily:'Poppins,sans-serif' }}>{t}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Copyright */}
        <div style={{ textAlign:'center', padding:'12px', background:'linear-gradient(145deg,#f5f5f5,#ebebeb)', borderRadius:12, border:'1px solid #e2e8f0', boxShadow:'inset 2px 2px 5px rgba(0,0,0,0.06),inset -1px -1px 3px rgba(255,255,255,0.9)' }}>
          <p style={{ fontSize:11, fontWeight:700, color:'#374151', margin:'0 0 3px', fontFamily:'Poppins,sans-serif' }}>ACR MAX · Version 1.0 · Beta Release</p>
          <p style={{ fontSize:10, color:'#6b7280', margin:'0 0 5px', fontFamily:'Poppins,sans-serif' }}>April 2026 · acr-max.web.app</p>
          <div style={{ width:36, height:1, background:'#e2e8f0', margin:'7px auto' }} />
          <p style={{ fontSize:9, color:'#9ca3af', margin:0, lineHeight:1.65, fontFamily:'Poppins,sans-serif' }}>© 2026 ACR MAX. All rights reserved.<br/>Unauthorized reproduction strictly prohibited.<br/>All IP rights belong to <strong style={{ color:'#475569' }}>Aswin C R</strong>.</p>
        </div>
      </NeuCard>

      {/* ── RESET MODAL ── */}
      {showReset && (
        <div style={{ position:'fixed', inset:0, zIndex:100, background:'rgba(0,0,0,0.4)', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center', animation:'fadeIn 0.2s ease-out both' }}>
          <div style={{ background:'linear-gradient(145deg,#ffffff,#f0f0f0)', border:'1px solid rgba(255,255,255,0.9)', borderRadius:22, padding:28, maxWidth:340, width:'90%', textAlign:'center', boxShadow:'8px 8px 24px rgba(0,0,0,0.15),-4px -4px 12px rgba(255,255,255,0.8)', animation:'popIn 0.3s cubic-bezier(.34,1.56,.64,1) both' }}>
            <div style={{ fontSize:44, marginBottom:14 }}>⚠️</div>
            <h3 style={{ fontFamily:'Syne,sans-serif', fontWeight:800, color:'#1a1a1a', fontSize:18, marginBottom:8 }}>Reset All Data?</h3>
            <p style={{ color:'#6b7280', fontSize:13, marginBottom:22, lineHeight:1.6, fontFamily:'Poppins,sans-serif' }}>This will permanently delete all <strong style={{ color:'#dc2626' }}>{logs.length} expense entries</strong>. This cannot be undone.</p>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setShowReset(false)} style={{ flex:1, padding:'12px', borderRadius:12, background:'linear-gradient(145deg,#f5f5f5,#e8e8e8)', border:'1.5px solid #e2e8f0', color:'#475569', fontWeight:700, cursor:'pointer', fontSize:13, fontFamily:'Poppins,sans-serif', boxShadow:'3px 3px 8px rgba(0,0,0,0.08),-2px -2px 5px rgba(255,255,255,0.9)' }}>Cancel</button>
              <button onClick={handleReset} style={{ flex:1, padding:'12px', borderRadius:12, background:'linear-gradient(135deg,#dc2626,#ef4444)', border:'none', color:'#fff', fontWeight:700, cursor:'pointer', fontSize:13, fontFamily:'Poppins,sans-serif', boxShadow:'3px 3px 10px rgba(220,38,38,0.3)' }}>Yes, Reset</button>
            </div>
          </div>
        </div>
      )}

      {/* ── TOASTS ── */}
      {resetDone && (
        <div style={{ position:'fixed', bottom:100, left:'50%', transform:'translateX(-50%)', background:'linear-gradient(135deg,#16a34a,#22c55e)', color:'#fff', padding:'11px 24px', borderRadius:40, fontWeight:700, fontSize:13, zIndex:200, boxShadow:'4px 4px 14px rgba(22,163,74,0.3)', animation:'toastSlide 0.4s ease-out both', fontFamily:'Poppins,sans-serif', whiteSpace:'nowrap' }}>✓ All data cleared!</div>
      )}
      {themeToast && (
        <div style={{ position:'fixed', bottom:100, left:'50%', background:currentTheme.grad, color:'#fff', padding:'11px 24px', borderRadius:40, fontWeight:700, fontSize:13, zIndex:200, boxShadow:`4px 4px 14px ${acc}30`, animation:'toastSlide 0.4s ease-out both', fontFamily:'Poppins,sans-serif', display:'flex', alignItems:'center', gap:7, whiteSpace:'nowrap' }}>
          <span style={{ fontSize:16 }}>{currentTheme.icon}</span>{themeToast} theme applied!
        </div>
      )}
    </div>
    </>
  )
}