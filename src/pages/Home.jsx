import { useState, useEffect, useRef, useCallback } from 'react'

/* ── Starfield canvas ─────────────────────────────────────────────────────── */
function Starfield() {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let raf
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight }
    resize()
    window.addEventListener('resize', resize)
    const stars = Array.from({ length: 140 }, () => ({
      x: Math.random(), y: Math.random(),
      r: Math.random() * 1.6 + 0.2,
      speed: Math.random() * 0.00015 + 0.00004,
      opacity: Math.random() * 0.7 + 0.1,
      tw: Math.random() * 0.022 + 0.005,
      off: Math.random() * Math.PI * 2,
    }))
    let t = 0
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      t++
      stars.forEach(s => {
        const tw = 0.4 + 0.6 * Math.sin(t * s.tw + s.off)
        ctx.beginPath()
        ctx.arc(s.x * canvas.width, s.y * canvas.height, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${s.opacity * tw})`
        ctx.fill()
        s.y -= s.speed
        if (s.y < 0) { s.y = 1; s.x = Math.random() }
      })
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [])
  return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }} />
}

/* ── Click ripple effect ──────────────────────────────────────────────────── */
function useRipple() {
  const [ripples, setRipples] = useState([])
  const addRipple = useCallback((e, color = '#a78bfa') => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const id = Date.now() + Math.random()
    setRipples(r => [...r, { id, x, y, color }])
    setTimeout(() => setRipples(r => r.filter(rip => rip.id !== id)), 700)
  }, [])
  const RippleContainer = ({ color }) => (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 'inherit', pointerEvents: 'none', zIndex: 0 }}>
      {ripples.map(r => (
        <div key={r.id} style={{
          position: 'absolute',
          left: r.x, top: r.y,
          width: 8, height: 8,
          borderRadius: '50%',
          background: r.color,
          transform: 'translate(-50%,-50%) scale(0)',
          opacity: 0.6,
          animation: 'rippleOut 0.65s ease-out forwards',
          pointerEvents: 'none',
        }} />
      ))}
    </div>
  )
  return { addRipple, RippleContainer }
}

/* ── Floating particle ────────────────────────────────────────────────────── */
function FloatingParticles() {
  const particles = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    size: 3 + Math.random() * 5,
    left: `${5 + Math.random() * 90}%`,
    delay: Math.random() * 8,
    duration: 8 + Math.random() * 12,
    color: ['#a78bfa','#34d399','#f472b6','#60a5fa','#fbbf24'][i % 5],
  }))
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 1, overflow: 'hidden' }}>
      {particles.map(p => (
        <div key={p.id} style={{
          position: 'absolute',
          bottom: '-10px',
          left: p.left,
          width: p.size,
          height: p.size,
          borderRadius: '50%',
          background: p.color,
          opacity: 0.35,
          boxShadow: `0 0 8px ${p.color}`,
          animation: `particleRise ${p.duration}s ease-in-out ${p.delay}s infinite`,
        }} />
      ))}
    </div>
  )
}

/* ── Animated greeting ────────────────────────────────────────────────────── */
function useGreeting() {
  const h = new Date().getHours()
  if (h < 5)  return { text: 'Good Night', emoji: '🌙' }
  if (h < 12) return { text: 'Good Morning', emoji: '🌅' }
  if (h < 17) return { text: 'Good Afternoon', emoji: '☀️' }
  if (h < 21) return { text: 'Good Evening', emoji: '🌆' }
  return { text: 'Good Night', emoji: '🌙' }
}

/* ── Live clock ───────────────────────────────────────────────────────────── */
function LiveClock() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontFamily: 'Share Tech Mono,monospace', fontSize: 38, fontWeight: 700, color: '#fff', margin: 0, letterSpacing: '0.05em', textShadow: '0 0 30px rgba(167,139,250,0.5)' }}>
        {time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
      </p>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', margin: '4px 0 0', fontWeight: 500 }}>
        {time.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      </p>
    </div>
  )
}

/* ── Nav card config ──────────────────────────────────────────────────────── */
const NAV_CARDS = [
  {
    id: 'expense', icon: '💰', label: 'Expense Tracker',
    sub: 'Track & analyze spending',
    grad: 'linear-gradient(135deg,#7c3aed,#4f46e5)',
    glow: 'rgba(124,58,237,0.5)',
    accent: '#a78bfa',
    pattern: '₹ $ ₹ $ ₹',
    size: 'large',
  },
  {
    id: 'ledger', icon: '🤝', label: 'Smart Ledger',
    sub: 'Track money & reminders',
    grad: 'linear-gradient(135deg,#0c4a6e,#075985,#0369a1)',
    glow: 'rgba(14,165,233,0.5)',
    accent: '#38bdf8',
    pattern: '₹ 🤝 ₹ 🤝',
    size: 'normal',
  },
  {
    id: 'astro', icon: '✨', label: 'Astro Insights',
    sub: 'Daily cosmic readings',
    grad: 'linear-gradient(135deg,#0f0c29,#302b63,#24243e)',
    glow: 'rgba(167,139,250,0.45)',
    accent: '#c4b5fd',
    pattern: '♈ ♊ ♋ ♌ ♍',
    size: 'normal',
  },
  {
    id: 'cricket', icon: '🏏', label: 'Cricket World',
    sub: 'Live IPL scores',
    grad: 'linear-gradient(135deg,#064e3b,#065f46)',
    glow: 'rgba(52,211,153,0.45)',
    accent: '#34d399',
    pattern: '🏏 ⚡ 🏏 ⚡',
    size: 'normal',
  },
  {
    id: 'space', icon: '🚀', label: 'Space World',
    sub: 'Live ISS · NASA APOD',
    grad: 'linear-gradient(135deg,#030712,#0c1445,#0e1a6e)',
    glow: 'rgba(96,165,250,0.45)',
    accent: '#60a5fa',
    pattern: '🌍 🛸 🌍 🛸',
    size: 'normal',
  },
  {
    id: 'market', icon: '📈', label: 'Market Pulse',
    sub: 'Stocks & finance',
    grad: 'linear-gradient(135deg,#14532d,#166534)',
    glow: 'rgba(34,197,94,0.45)',
    accent: '#86efac',
    pattern: '↑ ↓ ↑ ↑ ↓',
    size: 'normal',
  },
  {
    id: 'profile', icon: '👤', label: 'My Profile',
    sub: 'Settings & themes',
    grad: 'linear-gradient(135deg,#1e1b4b,#312e81)',
    glow: 'rgba(167,139,250,0.4)',
    accent: '#a78bfa',
    pattern: '⚙ ✦ ⚙ ✦',
    size: 'normal',
  },
  {
    id: 'chat', icon: '🤖', label: 'AI Quick Chat',
    sub: 'Personal assistant',
    grad: 'linear-gradient(135deg,#1c1917,#292524)',
    glow: 'rgba(251,191,36,0.4)',
    accent: '#fbbf24',
    pattern: '💬 ✦ 💬 ✦',
    size: 'normal',
  },
]

/* ── Individual nav card ──────────────────────────────────────────────────── */
function NavCard({ card, onClick, index }) {
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)
  const [ripples, setRipples] = useState([])
  const isLarge = card.size === 'large'

  const handleClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const id = Date.now()
    setPressed(true)
    setRipples(r => [...r, { id, x, y }])
    setTimeout(() => setPressed(false), 200)
    setTimeout(() => setRipples(r => r.filter(rip => rip.id !== id)), 700)
    setTimeout(() => onClick(card.id), 120)
  }

  return (
    <button
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleClick}
      style={{
        position: 'relative', overflow: 'hidden',
        borderRadius: 22, padding: isLarge ? '28px 24px' : '22px 20px',
        background: card.grad,
        border: `1px solid ${card.accent}25`,
        boxShadow: hovered
          ? `0 20px 50px ${card.glow}, 0 0 0 1px ${card.accent}30`
          : `0 8px 28px rgba(0,0,0,0.35)`,
        transform: pressed ? 'scale(0.96)' : hovered ? 'translateY(-5px) scale(1.01)' : 'translateY(0) scale(1)',
        transition: 'transform 0.25s cubic-bezier(.34,1.56,.64,1), box-shadow 0.25s ease',
        cursor: 'pointer', textAlign: 'left',
        animation: `slideUp 0.5s ease-out ${index * 60}ms both`,
        gridColumn: isLarge ? 'span 2' : 'span 1',
      }}
    >
      {/* ripples */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 22, pointerEvents: 'none' }}>
        {ripples.map(r => (
          <div key={r.id} style={{
            position: 'absolute', left: r.x, top: r.y,
            width: 10, height: 10, borderRadius: '50%',
            background: card.accent, opacity: 0.5,
            transform: 'translate(-50%,-50%) scale(0)',
            animation: 'rippleOut 0.65s ease-out forwards',
          }} />
        ))}
      </div>

      {/* top glow orb */}
      <div style={{
        position: 'absolute', top: -30, right: -30,
        width: 120, height: 120, borderRadius: '50%',
        background: card.accent, opacity: hovered ? 0.18 : 0.08,
        filter: 'blur(30px)', transition: 'opacity 0.35s',
        pointerEvents: 'none',
      }} />

      {/* subtle pattern text bg */}
      <div style={{
        position: 'absolute', top: 8, right: 12,
        fontSize: 11, fontWeight: 700, letterSpacing: '0.15em',
        color: `${card.accent}18`, fontFamily: 'monospace',
        userSelect: 'none', pointerEvents: 'none',
        lineHeight: 1.8,
      }}>{card.pattern}</div>

      {/* shimmer sweep on hover */}
      {hovered && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `linear-gradient(105deg,transparent 35%,${card.accent}08 50%,transparent 65%)`,
          animation: 'cardShimmer 0.9s ease-out',
        }} />
      )}

      {/* content */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{
          fontSize: isLarge ? 42 : 32,
          marginBottom: isLarge ? 14 : 10,
          filter: `drop-shadow(0 0 12px ${card.accent}70)`,
          animation: hovered ? 'iconBounce 0.5s cubic-bezier(.34,1.56,.64,1)' : 'none',
          display: 'inline-block',
          transition: 'transform 0.3s',
          transform: hovered ? 'scale(1.12) rotate(-4deg)' : 'scale(1) rotate(0deg)',
        }}>{card.icon}</div>

        <p style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: isLarge ? 20 : 16, color: '#fff', margin: '0 0 4px', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>{card.label}</p>
        <p style={{ fontSize: 12, color: `${card.accent}bb`, margin: 0, fontWeight: 600 }}>{card.sub}</p>

        {/* arrow indicator */}
        <div style={{
          position: 'absolute', right: 0, bottom: 0,
          width: 28, height: 28, borderRadius: '50%',
          background: `${card.accent}18`, border: `1px solid ${card.accent}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, color: card.accent,
          transform: hovered ? 'translate(2px,-2px)' : 'translate(0,0)',
          transition: 'transform 0.25s',
        }}>→</div>
      </div>
    </button>
  )
}

/* ── Quick stats bar ──────────────────────────────────────────────────────── */
function QuickStats({ overallTotal = 0, logsCount = 0 }) {
  const stats = [
    { label: "Today's Spend", value: `₹${Number(overallTotal).toLocaleString('en-IN')}`, icon: '💸', color: '#a78bfa' },
    { label: 'Entries', value: logsCount, icon: '📋', color: '#34d399' },
    { label: 'ISS Altitude', value: '~408 km', icon: '🛸', color: '#60a5fa' },
    { label: 'System', value: 'Online', icon: '⚡', color: '#fbbf24' },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10 }}>
      {stats.map((s, i) => (
        <div key={i} style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderTop: `2px solid ${s.color}`,
          borderRadius: 16, padding: '12px 14px', textAlign: 'center',
          animation: `slideUp 0.4s ease-out ${0.4 + i * 0.06}s both`,
          transition: 'transform 0.2s, box-shadow 0.2s',
        }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 24px rgba(0,0,0,0.3), 0 0 12px ${s.color}20` }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
        >
          <div style={{ fontSize: 18, marginBottom: 4, filter: `drop-shadow(0 0 6px ${s.color}60)` }}>{s.icon}</div>
          <p style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 16, color: s.color, margin: '0 0 2px' }}>{s.value}</p>
          <p style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.3)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</p>
        </div>
      ))}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────── */
export default function Home({ setActiveTab, setPrevTab, activeTab, logs = [], overallTotal = 0, currentUser, onLogout }) {
  const greeting = useGreeting()
  const [mounted, setMounted] = useState(false)
  const [clickFlash, setClickFlash] = useState(null)
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    setMounted(true)
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const navigate = (id) => {
    setClickFlash(id)
    setTimeout(() => { setClickFlash(null); setPrevTab(activeTab); setActiveTab(id) }, 150)
  }

  const userName = currentUser?.name || localStorage.getItem('acr_username') || 'User'
  const themeAccent = (() => {
    const t = localStorage.getItem('acr_theme') || 'violet'
    const map = { violet:'#a78bfa', emerald:'#34d399', rose:'#fb7185', amber:'#fbbf24', cyan:'#22d3ee', orange:'#fb923c' }
    return map[t] || '#a78bfa'
  })()

  // Quick action items - compact icon grid like PhonePe
  const QUICK_ACTIONS = [
    { id: 'expense', icon: '💰', label: 'Expenses' },
    { id: 'ledger',  icon: '🤝', label: 'Ledger' },
    { id: 'market',  icon: '📰', label: 'News' },
    { id: 'cricket', icon: '🏏', label: 'Cricket' },
    { id: 'astro',   icon: '✨', label: 'Astro' },
    { id: 'space',   icon: '🚀', label: 'Space' },
    { id: 'chat',    icon: '🤖', label: 'AI Chat' },
    { id: 'profile', icon: '👤', label: 'Profile' },
  ]

  const todayLogs = logs.filter(l => {
    const d = new Date(l.id)
    const now = new Date()
    return d.getDate() === now.getDate() && d.getMonth() === now.getMonth()
  })
  const todayTotal = todayLogs.reduce((s, l) => s + l.amount, 0)

  return (
    <>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;700&display=swap');
      .home-root { font-family:'DM Sans',sans-serif; color:#f1f5f9; }
      @keyframes slideUp   { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
      @keyframes fadeIn    { from{opacity:0} to{opacity:1} }
      @keyframes rippleOut { to{transform:translate(-50%,-50%) scale(28);opacity:0} }
      @keyframes flashIn   { 0%{opacity:0} 30%{opacity:0.08} 100%{opacity:0} }
      @keyframes floatY    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
      @keyframes glowRing  { 0%,100%{box-shadow:0 0 0 2px rgba(167,139,250,0.15)} 50%{box-shadow:0 0 0 3px rgba(167,139,250,0.35)} }
      @keyframes qaHover   { to{transform:translateY(-3px)} }
      .qa-btn:active { transform:scale(0.92)!important; }
    `}</style>

    <div className="home-root" style={{ maxWidth: 520, margin: '0 auto', paddingBottom: 24, position: 'relative', zIndex: 2 }}>

      {clickFlash && <div style={{ position:'fixed', inset:0, background:'rgba(167,139,250,0.05)', pointerEvents:'none', zIndex:50, animation:'flashIn 0.3s ease-out forwards' }} />}

      {/* ── TOP HEADER — compact like a real app ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 0 16px', animation:'fadeIn 0.4s ease-out both' }}>
        {/* Logo + name */}
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <img src="/logo.jpg" alt="ACR MAX" style={{ width:38, height:38, borderRadius:'50%', objectFit:'cover', border:`2px solid ${themeAccent}50`, boxShadow:`0 0 10px ${themeAccent}30` }} />
          <div>
            <p style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:15, color:'#fff', margin:0, letterSpacing:'0.04em' }}>ACR MAX</p>
            <p style={{ fontSize:10, color:`${themeAccent}`, margin:0, fontWeight:600, letterSpacing:'0.08em' }}>BETA 1.0</p>
          </div>
        </div>
        {/* Greeting + time */}
        <div style={{ textAlign:'right' }}>
          <p style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.5)', margin:'0 0 1px' }}>{greeting.emoji} {greeting.text}</p>
          <p style={{ fontSize:11, color:'rgba(255,255,255,0.3)', margin:0, fontFamily:'monospace' }}>
            {time.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12:true })}
          </p>
        </div>
      </div>

      {/* ── BALANCE CARD — premium but compact ── */}
      <div style={{
        borderRadius:20, padding:'20px 20px 18px',
        background:`linear-gradient(135deg,rgba(15,10,40,0.95),rgba(25,15,55,0.9))`,
        border:`1px solid ${themeAccent}22`,
        boxShadow:`0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)`,
        marginBottom:16,
        animation:'slideUp 0.4s ease-out 0.05s both',
        position:'relative', overflow:'hidden',
      }}>
        <div style={{ position:'absolute', top:-40, right:-40, width:140, height:140, borderRadius:'50%', background:`radial-gradient(circle,${themeAccent}15,transparent 65%)`, pointerEvents:'none' }} />

        <p style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.35)', textTransform:'uppercase', letterSpacing:'0.12em', margin:'0 0 4px' }}>Welcome back</p>
        <p style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:22, color:'#fff', margin:'0 0 14px' }}>{userName} 👋</p>

        <div style={{ display:'flex', gap:0, background:'rgba(255,255,255,0.04)', borderRadius:14, overflow:'hidden' }}>
          <div style={{ flex:1, padding:'10px 10px', textAlign:'center' }}>
            <p style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'0.08em', margin:'0 0 3px' }}>Today</p>
            <p style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:15, color: todayTotal > 0 ? '#f87171' : themeAccent, margin:0, lineHeight:1 }}>₹{todayTotal.toLocaleString('en-IN')}</p>
            <p style={{ fontSize:9, color:'rgba(255,255,255,0.2)', margin:'2px 0 0' }}>{todayLogs.length} entries</p>
          </div>
          <div style={{ width:1, background:'rgba(255,255,255,0.06)', flexShrink:0 }} />
          <div style={{ flex:1, padding:'10px 10px', textAlign:'center' }}>
            <p style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'0.08em', margin:'0 0 3px' }}>Total</p>
            <p style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:15, color:themeAccent, margin:0, lineHeight:1 }}>₹{overallTotal.toLocaleString('en-IN')}</p>
            <p style={{ fontSize:9, color:'rgba(255,255,255,0.2)', margin:'2px 0 0' }}>{logs.length} entries</p>
          </div>
          <div style={{ width:1, background:'rgba(255,255,255,0.06)', flexShrink:0 }} />
          <div style={{ flex:1, padding:'10px 10px', textAlign:'center' }}>
            <p style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'0.08em', margin:'0 0 3px' }}>Avg</p>
            <p style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:15, color:'#60a5fa', margin:0, lineHeight:1 }}>₹{logs.length ? Math.round(overallTotal/logs.length).toLocaleString('en-IN') : 0}</p>
            <p style={{ fontSize:9, color:'rgba(255,255,255,0.2)', margin:'2px 0 0' }}>per entry</p>
          </div>
        </div>
      </div>

      {/* ── QUICK ACTIONS GRID — PhonePe style ── */}
      <div style={{
        borderRadius:20, padding:'16px 12px 12px',
        background:'linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))',
        border:'1px solid rgba(255,255,255,0.07)',
        marginBottom:16,
        animation:'slideUp 0.4s ease-out 0.1s both',
      }}>
        <p style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.25)', textTransform:'uppercase', letterSpacing:'0.12em', margin:'0 0 10px 4px' }}>Quick Access</p>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'4px 0' }}>
          {QUICK_ACTIONS.map((a, i) => (
            <button key={a.id} className="qa-btn" onClick={() => navigate(a.id)}
              style={{
                display:'flex', flexDirection:'column', alignItems:'center', gap:6,
                padding:'8px 2px', background:'none', border:'none', cursor:'pointer',
                borderRadius:14, transition:'all 0.15s',
                animation:`slideUp 0.35s ease-out ${i * 35}ms both`,
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}>
              <div style={{
                width:40, height:40, borderRadius:12,
                background:`linear-gradient(135deg,rgba(255,255,255,0.1),rgba(255,255,255,0.04))`,
                border:'1px solid rgba(255,255,255,0.09)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:18,
                boxShadow:'0 2px 8px rgba(0,0,0,0.2)',
                transition:'all 0.2s',
              }}>
                {a.icon}
              </div>
              <span style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.55)', textAlign:'center', lineHeight:1.2 }}>{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── RECENT ACTIVITY — last 3 expenses ── */}
      {logs.length > 0 && (
        <div style={{
          borderRadius:20, padding:'16px 16px 8px',
          background:'linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))',
          border:'1px solid rgba(255,255,255,0.07)',
          marginBottom:16,
          animation:'slideUp 0.4s ease-out 0.2s both',
        }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <p style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.25)', textTransform:'uppercase', letterSpacing:'0.12em', margin:0 }}>Recent</p>
            <button onClick={() => navigate('expense')} style={{ background:'none', border:'none', fontSize:11, fontWeight:700, color:themeAccent, cursor:'pointer', padding:0 }}>See all →</button>
          </div>
          {logs.slice(0,4).map((log, i) => (
            <div key={log.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom: i < Math.min(logs.length-1, 3) ? '1px solid rgba(255,255,255,0.05)' : 'none', animation:`slideUp 0.3s ease-out ${i*50}ms both` }}>
              <div style={{ width:36, height:36, borderRadius:12, background:`${log.color}20`, border:`1px solid ${log.color}30`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>
                {log.category === 'Food' ? '🍽' : log.category === 'Petrol' ? '⛽' : log.category === 'Smoke' ? '🚬' : log.category === 'Liquor' ? '🍺' : log.category === 'Groceries' ? '🛒' : log.category === 'Mobile Recharge' ? '📱' : '💸'}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ fontSize:13, fontWeight:700, color:'#fff', margin:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{log.category}</p>
                <p style={{ fontSize:11, color:'rgba(255,255,255,0.3)', margin:0 }}>{log.time}{log.note ? ` · ${log.note}` : ''}</p>
              </div>
              <p style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:14, color:log.color, margin:0, flexShrink:0 }}>₹{log.amount.toLocaleString('en-IN')}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── SYSTEM STATUS ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'8px 0', animation:'fadeIn 0.5s ease-out 0.4s both' }}>
        <div style={{ width:6, height:6, borderRadius:'50%', background:'#34d399', boxShadow:'0 0 6px #34d399' }} />
        <p style={{ fontSize:11, color:'rgba(255,255,255,0.2)', margin:0, fontWeight:600 }}>All systems online · Cloud synced</p>
      </div>

    </div>
    </>
  )
}