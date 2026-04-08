import { useState, useEffect, useRef, useCallback } from 'react'

/* ── Greeting ── */
function useGreeting() {
  const h = new Date().getHours()
  if (h < 5)  return { text:'Good Night',    emoji:'🌙' }
  if (h < 12) return { text:'Good Morning',  emoji:'🌅' }
  if (h < 17) return { text:'Good Afternoon',emoji:'☀️' }
  if (h < 21) return { text:'Good Evening',  emoji:'🌆' }
  return       { text:'Good Night',          emoji:'🌙' }
}

/* ── Animated counter ── */
function CountUp({ value, prefix = '₹', duration = 1000 }) {
  const [disp, setDisp] = useState(0)
  const raf = useRef(null)
  useEffect(() => {
    const end = Number(value); const t0 = performance.now()
    const step = (now) => {
      const p = Math.min((now - t0) / duration, 1)
      const e = 1 - Math.pow(1 - p, 3)
      setDisp(Math.round(end * e))
      if (p < 1) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf.current)
  }, [value])
  return <span>{prefix}{disp.toLocaleString('en-IN')}</span>
}

/* ── Neumorphic card wrapper ── */
function NeuCard({ children, style = {}, accent, onClick }) {
  const [pressed, setPressed] = useState(false)
  return (
    <div onClick={onClick}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      style={{
        background: 'linear-gradient(145deg,#ffffff,#f0f0f0)',
        borderRadius: 20,
        border: accent ? `1px solid ${accent}20` : '1px solid rgba(255,255,255,0.9)',
        boxShadow: pressed
          ? 'inset 2px 2px 6px rgba(0,0,0,0.1), inset -1px -1px 4px rgba(255,255,255,0.8)'
          : '5px 5px 14px rgba(0,0,0,0.08), -3px -3px 8px rgba(255,255,255,0.9), inset 0 1px 0 rgba(255,255,255,0.8)',
        padding: 18, marginBottom: 14,
        transition: 'box-shadow 0.15s',
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}>
      {children}
    </div>
  )
}

/* ── Section header ── */
function SectionHeader({ title, right, accent = '#7c3aed' }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <div style={{ width:3, height:16, borderRadius:2, background:`linear-gradient(to bottom,${accent},${accent}50)` }} />
        <p style={{ fontSize:12, fontWeight:700, color:'#374151', textTransform:'uppercase', letterSpacing:'0.12em', margin:0, fontFamily:'Poppins,sans-serif' }}>{title}</p>
      </div>
      {right}
    </div>
  )
}

/* ── Progress bar ── */
function ProgressBar({ pct, color, height = 7 }) {
  const [w, setW] = useState(0)
  useEffect(() => { const t = setTimeout(() => setW(pct), 300); return () => clearTimeout(t) }, [pct])
  return (
    <div style={{ height, borderRadius: height, background:'linear-gradient(145deg,#e0e0e0,#f5f5f5)', boxShadow:'inset 2px 2px 4px rgba(0,0,0,0.1), inset -1px -1px 2px rgba(255,255,255,0.8)', overflow:'hidden' }}>
      <div style={{ height:'100%', width:`${w}%`, borderRadius:height, background:`linear-gradient(90deg,${color},${color}cc)`, transition:'width 1.1s cubic-bezier(.34,1.1,.64,1)', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.4),transparent)', animation:'shimBar 2s infinite' }} />
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════
   MAIN HOME COMPONENT
════════════════════════════════════════════ */
export default function Home({ setActiveTab, setPrevTab, activeTab, logs = [], overallTotal = 0, currentUser, onLogout }) {
  const greeting = useGreeting()
  const [time, setTime]           = useState(new Date())
  const [clickedBtn, setClickedBtn] = useState(null)

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const navigate = (id) => {
    setClickedBtn(id)
    setTimeout(() => { setClickedBtn(null); setPrevTab(activeTab); setActiveTab(id) }, 160)
  }

  const userName = currentUser?.name || localStorage.getItem('acr_username') || 'User'
  const displayName = userName.charAt(0).toUpperCase() + userName.slice(1)

  const themeAccent = (() => {
    const t = localStorage.getItem('acr_theme') || 'violet'
    const map = { violet:'#7c3aed', emerald:'#059669', rose:'#e11d48', amber:'#d97706', cyan:'#0891b2', orange:'#ea580c' }
    return map[t] || '#7c3aed'
  })()

  // Daily quotes
  const DAILY_QUOTES = [
    'Track every rupee. Own every decision.',
    'Financial freedom begins with awareness.',
    'Small savings today, big dreams tomorrow.',
    'Discipline in spending is discipline in life.',
    'Know where your money goes, control where it grows.',
    'Wealth is built one conscious choice at a time.',
    'Your budget is your blueprint for success.',
  ]
  const todayQuote = DAILY_QUOTES[new Date().getDay()]

  // Computed stats
  const todayLogs = logs.filter(l => {
    const d = new Date(l.id); const now = new Date()
    return d.getDate()===now.getDate() && d.getMonth()===now.getMonth()
  })
  const todayTotal  = todayLogs.reduce((s,l) => s+l.amount, 0)
  const avgPerEntry = logs.length ? Math.round(overallTotal/logs.length) : 0

  // Top category
  const catTotals = logs.reduce((acc,l) => { acc[l.category]=(acc[l.category]||0)+l.amount; return acc }, {})
  const topCat    = Object.entries(catTotals).sort((a,b)=>b[1]-a[1])[0]

  // Days active & streak
  const daysActive = logs.length ? Math.max(1, Math.floor((new Date()-new Date(logs[logs.length-1].id))/86400000)+1) : 0

  // This week vs last week
  const msDay = 86400000
  const now   = new Date()
  const thisWeekTotal = logs.filter(l=>(now-new Date(l.id))<7*msDay).reduce((s,l)=>s+l.amount,0)
  const lastWeekTotal = logs.filter(l=>{const d=now-new Date(l.id);return d>=7*msDay&&d<14*msDay}).reduce((s,l)=>s+l.amount,0)
  const weekChange    = lastWeekTotal>0 ? Math.round(((thisWeekTotal-lastWeekTotal)/lastWeekTotal)*100) : null

  // AI-style tip
  const aiTips = [
    topCat ? `You spend most on ${topCat[0]} — consider a monthly limit 💡` : 'Start tracking to unlock personalized tips 💡',
    avgPerEntry > 500 ? `Your avg spend is ₹${avgPerEntry.toLocaleString()} — try splitting into smaller entries 📊` : 'Your spending entries look well-distributed 👍',
    daysActive >= 3 ? `${daysActive} days of consistent tracking — great habit! 🔥` : 'Track daily for smarter insights 📈',
    weekChange!==null && weekChange>10 ? `Spending up ${weekChange}% vs last week — time to review! ⚠️` : 'Your spending is on track this week ✅',
  ]
  const todayTip = aiTips[new Date().getDay() % aiTips.length]

  // Recent activity (last 4)
  const recentLogs = [...logs].slice(0,4)

  // Quick actions
  const QUICK_ACTIONS = [
    { id:'expense', icon:'💰', label:'+ Add Expense', sub:'Log spending',    bg:'#fef3c7', border:'#fde68a', accent:'#d97706' },
    { id:'ledger',  icon:'🤝', label:'View Ledger',   sub:'Track debts',     bg:'#ecfdf5', border:'#a7f3d0', accent:'#059669' },
    { id:'market',  icon:'📰', label:'Check News',    sub:'Stay updated',    bg:'#eff6ff', border:'#bfdbfe', accent:'#1d4ed8' },
    { id:'cricket', icon:'🏏', label:'Cricket Live',  sub:'Scores & more',   bg:'#fdf4ff', border:'#e9d5ff', accent:'#7c3aed' },
    { id:'astro',   icon:'✨', label:'Astro Insights', sub:'Your forecast',  bg:'#faf5ff', border:'#ddd6fe', accent:'#6d28d9' },
    { id:'space',   icon:'🚀', label:'Space World',   sub:'ISS tracker',     bg:'#f0f9ff', border:'#bae6fd', accent:'#0ea5e9' },
    { id:'chat',    icon:'🤖', label:'AI Chat',       sub:'Ask anything',    bg:'#f0fdf4', border:'#bbf7d0', accent:'#16a34a' },
    { id:'profile', icon:'👤', label:'My Profile',    sub:'Settings & more', bg:'#fff1f2', border:'#fecdd3', accent:'#e11d48' },
  ]

  // Category icons
  const catIcon = (cat) => {
    const map = { Food:'🍽',Petrol:'⛽',Smoke:'🚬',Liquor:'🍺',Groceries:'🛒','Mobile Recharge':'📱','Electricity Bill':'⚡','Water Bill':'💧','Hotel Food':'🏨',CSD:'🏪',Other:'💸' }
    return map[cat] || '💸'
  }
  const catColor = (cat) => {
    const map = { Food:'#f59e0b',Petrol:'#3b82f6',Smoke:'#6b7280',Liquor:'#a78bfa',Groceries:'#10b981','Mobile Recharge':'#0891b2','Electricity Bill':'#d97706','Water Bill':'#06b6d4','Hotel Food':'#f43f5e',CSD:'#7c3aed',Other:'#64748b' }
    return map[cat] || '#7c3aed'
  }

  return (
    <>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=Syne:wght@700;800&display=swap');
      .home-root * { font-family:'Poppins',sans-serif !important; }
      .home-root .syne { font-family:'Syne',sans-serif !important; }
      @keyframes slideUp  { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
      @keyframes fadeIn   { from{opacity:0} to{opacity:1} }
      @keyframes shimBar  { 0%{transform:translateX(-100%)} 100%{transform:translateX(250%)} }
      @keyframes pulseDot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.8)} }
      @keyframes quoteIn  { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
      @keyframes ripple   { to{transform:scale(4);opacity:0} }
      .qa-card:hover { transform:translateY(-3px) !important; }
      .qa-card:active { transform:scale(0.95) !important; }
      .act-row:hover { background:linear-gradient(145deg,#f9f9f9,#f0f0f0) !important; }
    `}</style>

    <div className="home-root" style={{ maxWidth:520, margin:'0 auto', paddingBottom:32, background:'transparent', minHeight:'100vh' }}>

      {/* ══════════════════════════════════
          1. TOP HEADER
      ══════════════════════════════════ */}
      <div style={{ padding:'16px 18px 0', animation:'fadeIn 0.4s ease-out both' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          {/* Logo + brand */}
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ position:'relative' }}>
              <img src="/logo.jpg" alt="ACR MAX" style={{ width:42, height:42, borderRadius:'50%', objectFit:'cover', border:`2.5px solid ${themeAccent}`, boxShadow:`3px 3px 10px ${themeAccent}30, -2px -2px 6px rgba(255,255,255,0.9)` }} />
              <div style={{ position:'absolute', bottom:1, right:1, width:10, height:10, borderRadius:'50%', background:'#22c55e', border:'2px solid #fff', boxShadow:'0 0 4px rgba(34,197,94,0.5)' }} />
            </div>
            <div>
              <p className="syne" style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:17, color:'#1a1a1a', margin:0, letterSpacing:'0.04em' }}>ACR MAX</p>
              <p style={{ fontSize:9, color:themeAccent, margin:0, fontWeight:700, letterSpacing:'0.12em' }}>BETA 1.0</p>
            </div>
          </div>
          {/* Greeting + clock */}
          <div style={{ textAlign:'right' }}>
            <p style={{ fontSize:13, fontWeight:700, color:'#1a1a1a', margin:'0 0 1px' }}>{greeting.emoji} {greeting.text}</p>
            <p style={{ fontSize:12, color:'#6b7280', margin:0, fontWeight:600, fontFamily:'monospace !important' }}>
              {time.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true})}
            </p>
          </div>
        </div>
      </div>

      <div style={{ padding:'0 18px' }}>

      {/* ══════════════════════════════════
          2. WELCOME + DASHBOARD CARD
      ══════════════════════════════════ */}
      <div style={{
        borderRadius:22, marginBottom:14, overflow:'hidden',
        background:'linear-gradient(145deg,#ffffff,#e8e8e8)',
        border:'1.5px solid rgba(255,255,255,0.95)',
        boxShadow:'6px 6px 18px rgba(0,0,0,0.09),-4px -4px 12px rgba(255,255,255,0.98),inset 0 1px 0 rgba(255,255,255,0.9)',
        animation:'slideUp 0.4s ease-out 0.05s both',
        position:'relative',
      }}>
        {/* Accent top stripe in theme color */}
        <div style={{ height:4, background:`linear-gradient(90deg,transparent,${themeAccent},${themeAccent}80,transparent)` }} />
        <div style={{ padding:'18px 20px 20px', position:'relative' }}>
          {/* Decorative silver orbs */}
          <div style={{ position:'absolute', top:-10, right:-10, width:100, height:100, borderRadius:'50%', background:'radial-gradient(circle,rgba(255,255,255,0.8),transparent 65%)', pointerEvents:'none' }} />

          {/* Welcome + name */}
          <p style={{ fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.14em', margin:'0 0 3px', fontFamily:'Poppins,sans-serif' }}>Welcome back</p>
          <p className="syne" style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:24, color:'#1a1a1a', margin:'0 0 12px', lineHeight:1.1 }}>{displayName} 👋</p>

          {/* Key insight badges */}
          <div style={{ display:'flex', gap:7, flexWrap:'wrap', marginBottom:14 }}>
            {topCat && (
              <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'5px 12px', background:'linear-gradient(145deg,#f5f5f5,#e8e8e8)', border:'1px solid #e2e8f0', borderRadius:20, boxShadow:'2px 2px 5px rgba(0,0,0,0.07),-1px -1px 3px rgba(255,255,255,0.9)' }}>
                <span style={{ fontSize:12 }}>{catIcon(topCat[0])}</span>
                <span style={{ fontSize:11, fontWeight:600, color:'#374151', fontFamily:'Poppins,sans-serif' }}>Top: {topCat[0]} — ₹{topCat[1].toLocaleString('en-IN')}</span>
              </div>
            )}
            {weekChange !== null && (
              <div style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'5px 12px', background: weekChange>0?'linear-gradient(145deg,#fff1f2,#fee2e2)':'linear-gradient(145deg,#f0fdf4,#dcfce7)', border:`1px solid ${weekChange>0?'#fca5a5':'#bbf7d0'}`, borderRadius:20, boxShadow:'2px 2px 5px rgba(0,0,0,0.06),-1px -1px 3px rgba(255,255,255,0.9)' }}>
                <span style={{ fontSize:11 }}>{weekChange > 0 ? '📈' : '📉'}</span>
                <span style={{ fontSize:11, fontWeight:700, color: weekChange>0?'#dc2626':'#16a34a', fontFamily:'Poppins,sans-serif' }}>{weekChange > 0 ? `+${weekChange}%` : `${weekChange}%`} this week</span>
              </div>
            )}
          </div>

          {/* Stats bar — neumorphic inset */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1px 1fr 1px 1fr', background:'linear-gradient(145deg,#e4e4e4,#f5f5f5)', borderRadius:14, overflow:'hidden', boxShadow:'inset 3px 3px 7px rgba(0,0,0,0.09),inset -2px -2px 5px rgba(255,255,255,0.9)', border:'1px solid #e2e8f0' }}>
            {[
              { label:'Today', value:todayTotal, entries:todayLogs.length, fmt:true },
              { label:'Total', value:overallTotal, entries:logs.length, fmt:true },
              { label:'Avg/Entry', value:avgPerEntry, entries:null, fmt:true },
            ].map((s,i) => (
              <>
                {i>0 && <div key={`d${i}`} style={{ background:'rgba(0,0,0,0.06)' }} />}
                <div key={i} style={{ padding:'11px 6px', textAlign:'center' }}>
                  <p style={{ fontSize:9, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.08em', margin:'0 0 3px', fontFamily:'Poppins,sans-serif' }}>{s.label}</p>
                  <p className="syne" style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:15, color:'#1a1a1a', margin:0, lineHeight:1 }}>
                    {s.fmt ? <CountUp value={s.value} /> : s.value}
                  </p>
                  {s.entries !== null && <p style={{ fontSize:9, color:'#6b7280', margin:'3px 0 0', fontFamily:'Poppins,sans-serif' }}>{s.entries} entries</p>}
                </div>
              </>
            ))}
          </div>

          {/* Daily quote */}
          <div style={{ marginTop:14, padding:'10px 13px', background:'linear-gradient(145deg,#f5f5f5,#ebebeb)', borderRadius:12, border:'1px solid #e5e7eb', boxShadow:'inset 2px 2px 4px rgba(0,0,0,0.06),inset -1px -1px 3px rgba(255,255,255,0.9)', animation:'quoteIn 0.5s ease-out 0.4s both' }}>
            <p style={{ fontSize:11, fontWeight:500, color:'#374151', margin:'0 0 3px', lineHeight:1.55, fontStyle:'italic', fontFamily:'Poppins,sans-serif' }}>"{todayQuote}"</p>
            <p style={{ fontSize:9, fontWeight:700, color:'#9ca3af', margin:0, letterSpacing:'0.08em', fontFamily:'Poppins,sans-serif' }}>— ACR MAX</p>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════
          3. SMART WIDGETS ROW
      ══════════════════════════════════ */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14, animation:'slideUp 0.4s ease-out 0.1s both' }}>
        {/* Weekly Progress */}
        <div style={{ padding:'14px', background:'linear-gradient(145deg,#ffffff,#f0f0f0)', borderRadius:18, border:'1px solid rgba(255,255,255,0.9)', boxShadow:'4px 4px 12px rgba(0,0,0,0.08),-3px -3px 8px rgba(255,255,255,0.9)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
            <span style={{ fontSize:16 }}>📊</span>
            <p style={{ fontSize:10, fontWeight:700, color:'#374151', margin:0, fontFamily:'Poppins,sans-serif' }}>Weekly Goal</p>
          </div>
          <ProgressBar pct={Math.min((Math.min(daysActive,7)/7)*100,100)} color={themeAccent} />
          <p style={{ fontSize:10, color:'#6b7280', margin:'7px 0 0', fontFamily:'Poppins,sans-serif' }}>{Math.min(daysActive,7)}/7 days tracked</p>
        </div>

        {/* Streak tracker */}
        <div style={{ padding:'14px', background:'linear-gradient(145deg,#fffbeb,#fef3c7)', borderRadius:18, border:'1.5px solid #fde68a', boxShadow:'4px 4px 12px rgba(217,119,6,0.1),-3px -3px 8px rgba(255,255,255,0.9)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
            <span style={{ fontSize:20 }}>🔥</span>
            <p style={{ fontSize:10, fontWeight:700, color:'#92400e', margin:0, fontFamily:'Poppins,sans-serif' }}>Streak</p>
          </div>
          <p className="syne" style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:28, color:'#1a1a1a', margin:'0 0 2px' }}>{daysActive}</p>
          <p style={{ fontSize:10, color:'#6b7280', margin:0, fontFamily:'Poppins,sans-serif', fontWeight:600 }}>days active</p>
        </div>
      </div>

      {/* ── AI Tip ── */}
      <div style={{ padding:'12px 16px', background:'linear-gradient(145deg,#faf5ff,#f3e8ff)', borderRadius:16, border:'1.5px solid #ddd6fe', boxShadow:'3px 3px 10px rgba(124,58,237,0.08),-2px -2px 6px rgba(255,255,255,0.9)', marginBottom:14, display:'flex', alignItems:'center', gap:12, animation:'slideUp 0.4s ease-out 0.12s both' }}>
        <div style={{ width:36, height:36, borderRadius:12, background:'linear-gradient(135deg,#7c3aed20,#7c3aed10)', border:'1px solid #ddd6fe', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>💡</div>
        <div>
          <p style={{ fontSize:9, fontWeight:800, color:'#7c3aed', textTransform:'uppercase', letterSpacing:'0.1em', margin:'0 0 3px', fontFamily:'Poppins,sans-serif' }}>AI Daily Tip</p>
          <p style={{ fontSize:12, fontWeight:600, color:'#374151', margin:0, fontFamily:'Poppins,sans-serif', lineHeight:1.45 }}>{todayTip}</p>
        </div>
      </div>

      {/* ══════════════════════════════════
          4. QUICK ACTIONS — interactive cards
      ══════════════════════════════════ */}
      <NeuCard style={{ padding:'18px 14px 14px', marginBottom:14 }} accent={themeAccent}>
        <SectionHeader title="Quick Actions" accent={themeAccent} />
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px 8px' }}>
          {QUICK_ACTIONS.map((a,i) => (
            <button key={a.id} className="qa-card" onClick={() => navigate(a.id)}
              style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8, padding:'14px 6px 12px', background:`linear-gradient(145deg,${a.bg},#fff)`, border:`1.5px solid ${a.border}`, borderRadius:16, cursor:'pointer', transition:'all 0.2s', animation:`slideUp 0.35s ease-out ${i*40}ms both`, boxShadow:`3px 3px 10px rgba(0,0,0,0.07),-2px -2px 6px rgba(255,255,255,0.9)`, position:'relative', overflow:'hidden', transform: clickedBtn===a.id?'scale(0.93)':'scale(1)' }}>
              {/* Ripple overlay on click */}
              {clickedBtn===a.id && <div style={{ position:'absolute', inset:0, background:`${a.accent}15`, borderRadius:16 }} />}
              <div style={{ width:46, height:46, borderRadius:14, background:`linear-gradient(145deg,${a.bg},${a.border})`, border:`1.5px solid ${a.border}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, boxShadow:`inset 1px 1px 3px rgba(0,0,0,0.05),inset -1px -1px 2px rgba(255,255,255,0.8)`, transition:'all 0.2s' }}>
                {a.icon}
              </div>
              <div style={{ textAlign:'center' }}>
                <p style={{ fontSize:12, fontWeight:700, color:'#1a1a1a', margin:'0 0 2px', lineHeight:1.25, fontFamily:'Poppins,sans-serif' }}>{a.label}</p>
                <p style={{ fontSize:10, color:'#6b7280', margin:0, fontFamily:'Poppins,sans-serif', fontWeight:500 }}>{a.sub}</p>
              </div>
            </button>
          ))}
        </div>
      </NeuCard>

      {/* ══════════════════════════════════
          5. RECENT ACTIVITY FEED
      ══════════════════════════════════ */}
      {recentLogs.length > 0 && (
        <NeuCard style={{ marginBottom:14 }} accent="#059669">
          <SectionHeader title="Recent Activity" accent="#059669"
            right={<button onClick={()=>navigate('expense')} style={{ background:'none', border:'none', fontSize:11, fontWeight:700, color:themeAccent, cursor:'pointer', fontFamily:'Poppins,sans-serif' }}>See all →</button>} />
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            {recentLogs.map((log,i) => (
              <div key={log.id} className="act-row" style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 12px', borderRadius:13, background:'linear-gradient(145deg,#f8f8f8,#efefef)', border:'1px solid #f1f1f1', boxShadow:'2px 2px 5px rgba(0,0,0,0.05),-1px -1px 3px rgba(255,255,255,0.9)', transition:'all 0.15s', animation:`slideUp 0.3s ease-out ${i*50}ms both` }}>
                <div style={{ width:36, height:36, borderRadius:11, background:`${catColor(log.category)}15`, border:`1px solid ${catColor(log.category)}30`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0, boxShadow:'inset 1px 1px 3px rgba(0,0,0,0.06)' }}>
                  {catIcon(log.category)}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontSize:13, fontWeight:800, color:'#1a1a1a', margin:'0 0 1px', fontFamily:'Poppins,sans-serif' }}>
                    Added {log.category}
                    {log.note ? <span style={{ fontWeight:500, color:'#6b7280' }}> · {log.note}</span> : ''}
                  </p>
                  <p style={{ fontSize:10, color:'#9ca3af', margin:0, fontFamily:'Poppins,sans-serif' }}>
                    {log.time} · {new Date(log.id).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}
                  </p>
                </div>
                <p style={{ fontFamily:'Poppins,sans-serif', fontWeight:800, fontSize:14, color:catColor(log.category), margin:0, flexShrink:0 }}>₹{log.amount.toLocaleString('en-IN')}</p>
              </div>
            ))}
          </div>
        </NeuCard>
      )}

      {/* ══════════════════════════════════
          6. FOR YOU — personalization
      ══════════════════════════════════ */}
      {logs.length >= 3 && (
        <NeuCard style={{ marginBottom:14 }} accent={themeAccent}>
          <SectionHeader title="For You" accent={themeAccent} />
          <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
            {/* Spending pattern insight */}
            {topCat && (
              <div style={{ display:'flex', gap:10, padding:'12px 14px', background:`linear-gradient(145deg,${catColor(topCat[0])}08,#fff)`, borderRadius:14, border:`1px solid ${catColor(topCat[0])}20`, boxShadow:'2px 2px 6px rgba(0,0,0,0.05),-1px -1px 3px rgba(255,255,255,0.9)' }}>
                <div style={{ width:34, height:34, borderRadius:10, background:`${catColor(topCat[0])}15`, border:`1px solid ${catColor(topCat[0])}30`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>{catIcon(topCat[0])}</div>
                <div>
                  <p style={{ fontSize:12, fontWeight:700, color:'#1a1a1a', margin:'0 0 2px', fontFamily:'Poppins,sans-serif' }}>You spend most on {topCat[0]}</p>
                  <p style={{ fontSize:11, color:'#6b7280', margin:0, fontFamily:'Poppins,sans-serif' }}>₹{topCat[1].toLocaleString('en-IN')} logged — {overallTotal>0?Math.round((topCat[1]/overallTotal)*100):0}% of total</p>
                </div>
              </div>
            )}
            {/* Week comparison */}
            {weekChange !== null && (
              <div style={{ display:'flex', gap:10, padding:'12px 14px', background: weekChange>0?'linear-gradient(145deg,#fff1f2,#fff)':'linear-gradient(145deg,#f0fdf4,#fff)', borderRadius:14, border:`1px solid ${weekChange>0?'#fca5a5':'#bbf7d0'}`, boxShadow:'2px 2px 6px rgba(0,0,0,0.05),-1px -1px 3px rgba(255,255,255,0.9)' }}>
                <div style={{ width:34, height:34, borderRadius:10, background: weekChange>0?'#fee2e2':'#dcfce7', border:`1px solid ${weekChange>0?'#fca5a5':'#bbf7d0'}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>{weekChange>0?'📈':'📉'}</div>
                <div>
                  <p style={{ fontSize:12, fontWeight:700, color:'#1a1a1a', margin:'0 0 2px', fontFamily:'Poppins,sans-serif' }}>{weekChange>0?`Spending up ${weekChange}% this week`:`Spending down ${Math.abs(weekChange)}% this week`}</p>
                  <p style={{ fontSize:11, color:'#6b7280', margin:0, fontFamily:'Poppins,sans-serif' }}>{weekChange>0?'Review your budget to stay on track':'Great discipline! Keep it up 💪'}</p>
                </div>
              </div>
            )}
            {/* Tracking streak */}
            <div style={{ display:'flex', gap:10, padding:'12px 14px', background:'linear-gradient(145deg,#fffbeb,#fff)', borderRadius:14, border:'1px solid #fde68a', boxShadow:'2px 2px 6px rgba(0,0,0,0.05),-1px -1px 3px rgba(255,255,255,0.9)' }}>
              <div style={{ width:34, height:34, borderRadius:10, background:'#fef3c7', border:'1px solid #fde68a', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>🔥</div>
              <div>
                <p style={{ fontSize:12, fontWeight:700, color:'#1a1a1a', margin:'0 0 2px', fontFamily:'Poppins,sans-serif' }}>{daysActive} day{daysActive!==1?'s':''} of consistent tracking</p>
                <p style={{ fontSize:11, color:'#6b7280', margin:0, fontFamily:'Poppins,sans-serif' }}>{daysActive>=7?'You\'re building a strong financial habit 🏆':daysActive>=3?'Keep going — great momentum! 🚀':'Every day counts — stay consistent 💪'}</p>
              </div>
            </div>
          </div>
        </NeuCard>
      )}

      {/* ══════════════════════════════════
          7. SECURITY CERTIFICATIONS
      ══════════════════════════════════ */}
      <NeuCard style={{ marginBottom:14 }}>
        <SectionHeader title="Security & Compliance" accent="#059669" />
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:9, marginBottom:13 }}>
          {[
            { icon:'🔒', label:'SSL / TLS',    sub:'256-bit HTTPS',       color:'#065f46', bg:'#ecfdf5', border:'#a7f3d0' },
            { icon:'🛡️', label:'AES-256',       sub:'Military Cipher',     color:'#1e40af', bg:'#eff6ff', border:'#bfdbfe' },
            { icon:'🔥', label:'Firebase',      sub:'Google Cloud',        color:'#92400e', bg:'#fffbeb', border:'#fde68a' },
            { icon:'☁️', label:'Cloud Sync',    sub:'Real-time Secure',    color:'#075985', bg:'#f0f9ff', border:'#bae6fd' },
            { icon:'🚫', label:'Zero Ads',      sub:'No Data Sold',        color:'#991b1b', bg:'#fff1f2', border:'#fecdd3' },
            { icon:'👁️', label:'Privacy',       sub:'No Tracking',         color:'#5b21b6', bg:'#faf5ff', border:'#ddd6fe' },
          ].map((b,i) => (
            <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:5, padding:'13px 5px', background:`linear-gradient(145deg,${b.bg},#fff)`, border:`1.5px solid ${b.border}`, borderRadius:14, textAlign:'center', boxShadow:'3px 3px 8px rgba(0,0,0,0.06),-2px -2px 5px rgba(255,255,255,0.9)' }}>
              <span style={{ fontSize:22 }}>{b.icon}</span>
              <p style={{ fontSize:10, fontWeight:700, color:b.color, margin:0, lineHeight:1.2, fontFamily:'Poppins,sans-serif' }}>{b.label}</p>
              <p style={{ fontSize:8, color:'#9ca3af', margin:0, lineHeight:1.35, fontFamily:'Poppins,sans-serif' }}>{b.sub}</p>
            </div>
          ))}
        </div>
        <div style={{ padding:'11px 14px', background:'linear-gradient(145deg,#f8f8f8,#f0f0f0)', borderRadius:12, border:'1px solid #e5e7eb', boxShadow:'inset 2px 2px 4px rgba(0,0,0,0.06),inset -1px -1px 3px rgba(255,255,255,0.8)' }}>
          <p style={{ fontSize:11, color:'#374151', textAlign:'center', lineHeight:1.75, margin:0, fontWeight:500, fontFamily:'Poppins,sans-serif' }}>
            Protected with <strong style={{ color:'#1a1a1a' }}>AES-256 encryption</strong> · Hosted on <strong style={{ color:'#1a1a1a' }}>Google Firebase</strong> · We never sell or share your data.
          </p>
        </div>
      </NeuCard>

      {/* ══════════════════════════════════
          8. ABOUT & CREDITS
      ══════════════════════════════════ */}
      <NeuCard style={{ marginBottom:14 }} accent={themeAccent}>
        <SectionHeader title="About ACR MAX" accent={themeAccent} />

        {/* Brand */}
        <div style={{ display:'flex', alignItems:'center', gap:14, padding:'14px', background:'linear-gradient(145deg,#f5f5f5,#ebebeb)', borderRadius:16, border:'1px solid #e2e8f0', boxShadow:'inset 2px 2px 5px rgba(0,0,0,0.07),inset -1px -1px 3px rgba(255,255,255,0.9)', marginBottom:13 }}>
          <img src="/logo.jpg" alt="ACR MAX" style={{ width:54, height:54, borderRadius:'50%', objectFit:'cover', border:`2.5px solid ${themeAccent}50`, boxShadow:`3px 3px 10px ${themeAccent}25,-2px -2px 5px rgba(255,255,255,0.8)`, flexShrink:0 }} />
          <div>
            <p className="syne" style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:18, color:'#1a1a1a', margin:'0 0 2px' }}>ACR MAX</p>
            <p style={{ fontSize:10, fontWeight:700, color:themeAccent, margin:'0 0 4px', letterSpacing:'0.1em', fontFamily:'Poppins,sans-serif' }}>BETA 1.0 · MAXIMISING LIFES</p>
            <p style={{ fontSize:11, color:'#6b7280', margin:0, lineHeight:1.5, fontFamily:'Poppins,sans-serif' }}>Your all-in-one premium personal financial dashboard</p>
          </div>
        </div>

        {/* Developer */}
        <div style={{ padding:'16px', background:`linear-gradient(145deg,${themeAccent}06,#fff)`, borderRadius:16, border:`1.5px solid ${themeAccent}20`, boxShadow:`3px 3px 10px rgba(0,0,0,0.06),-2px -2px 6px rgba(255,255,255,0.9)`, marginBottom:13 }}>
          <p style={{ fontSize:9, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.14em', margin:'0 0 12px', textAlign:'center', fontFamily:'Poppins,sans-serif' }}>Concept · Design · Development</p>
          <div style={{ display:'flex', alignItems:'center', gap:13 }}>
            <div style={{ width:50, height:50, borderRadius:'50%', background:`linear-gradient(135deg,${themeAccent},${themeAccent}80)`, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:22, color:'#fff', flexShrink:0, boxShadow:`4px 4px 12px ${themeAccent}35,-2px -2px 6px rgba(255,255,255,0.8)` }}>A</div>
            <div>
              <p className="syne" style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:17, color:'#1a1a1a', margin:'0 0 2px' }}>Aswin C R</p>
              <p style={{ fontSize:11, fontWeight:700, color:themeAccent, margin:'0 0 3px', fontFamily:'Poppins,sans-serif' }}>Founder & Chief Executive Officer</p>
              <p style={{ fontSize:10, color:'#6b7280', margin:0, lineHeight:1.6, fontFamily:'Poppins,sans-serif' }}>Full Stack Developer · UI/UX Designer · Product Architect · Innovation Strategist</p>
            </div>
          </div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:12 }}>
            {['💡 Product Vision','🎨 UI/UX Design','⚙️ Engineering','☁️ Cloud Infra','🔐 Security'].map((tag,i) => (
              <span key={i} style={{ padding:'3px 10px', borderRadius:20, fontSize:9, fontWeight:700, background:`${themeAccent}12`, border:`1px solid ${themeAccent}28`, color:themeAccent, fontFamily:'Poppins,sans-serif' }}>{tag}</span>
            ))}
          </div>
        </div>

        {/* Tech stack */}
        <div style={{ marginBottom:13 }}>
          <p style={{ fontSize:9, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.12em', margin:'0 0 10px', fontFamily:'Poppins,sans-serif' }}>Powered By</p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:7 }}>
            {[
              {name:'React + Vite',color:'#0ea5e9',bg:'#f0f9ff',border:'#bae6fd'},
              {name:'Firebase',color:'#d97706',bg:'#fffbeb',border:'#fde68a'},
              {name:'Firestore',color:'#dc2626',bg:'#fff1f2',border:'#fecdd3'},
              {name:'Gemini AI',color:'#7c3aed',bg:'#faf5ff',border:'#ddd6fe'},
              {name:'Newsdata.io',color:'#059669',bg:'#ecfdf5',border:'#a7f3d0'},
              {name:'Tailwind CSS',color:'#0891b2',bg:'#f0f9ff',border:'#bae6fd'},
            ].map((t,i) => (
              <div key={i} style={{ padding:'8px 6px', borderRadius:11, background:`linear-gradient(145deg,${t.bg},#fff)`, border:`1.5px solid ${t.border}`, textAlign:'center', boxShadow:'2px 2px 5px rgba(0,0,0,0.05),-1px -1px 3px rgba(255,255,255,0.9)' }}>
                <p style={{ fontSize:10, fontWeight:700, color:t.color, margin:0, fontFamily:'Poppins,sans-serif' }}>{t.name}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Copyright */}
        <div style={{ textAlign:'center', padding:'13px', background:'linear-gradient(145deg,#f5f5f5,#ebebeb)', borderRadius:13, border:'1px solid #e2e8f0', boxShadow:'inset 2px 2px 5px rgba(0,0,0,0.06),inset -1px -1px 3px rgba(255,255,255,0.9)' }}>
          <p style={{ fontSize:11, fontWeight:700, color:'#374151', margin:'0 0 3px', fontFamily:'Poppins,sans-serif' }}>ACR MAX · Version 1.0 · Beta Release</p>
          <p style={{ fontSize:10, color:'#6b7280', margin:'0 0 6px', fontFamily:'Poppins,sans-serif' }}>April 2026 · acr-max.web.app</p>
          <div style={{ width:36, height:1, background:'#e5e7eb', margin:'0 auto 6px' }} />
          <p style={{ fontSize:9, color:'#9ca3af', margin:0, lineHeight:1.7, fontFamily:'Poppins,sans-serif' }}>
            © 2026 ACR MAX. All rights reserved.<br/>
            Unauthorized reproduction or distribution is strictly prohibited.<br/>
            All intellectual property rights belong to <strong style={{ color:'#475569' }}>Aswin C R</strong>.
          </p>
        </div>
      </NeuCard>

      {/* Status bar */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'6px 0 4px', animation:'fadeIn 0.5s ease-out 0.4s both' }}>
        <div style={{ width:7, height:7, borderRadius:'50%', background:'#22c55e', animation:'pulseDot 2s ease-in-out infinite', boxShadow:'0 0 4px rgba(34,197,94,0.5)' }} />
        <p style={{ fontSize:11, color:'#9ca3af', margin:0, fontWeight:500, fontFamily:'Poppins,sans-serif' }}>All systems operational · Cloud synced</p>
      </div>

      </div>{/* end padding wrapper */}
    </div>
    </>
  )
}