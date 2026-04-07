import { useState, useEffect, useRef } from 'react'

/* ── Starfield canvas ─────────────────────────────────────────────────────── */
function Starfield({ density = 80 }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let raf
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight }
    resize()
    window.addEventListener('resize', resize)
    const stars = Array.from({ length: density }, () => ({
      x: Math.random(), y: Math.random(),
      r: Math.random() * 1.5 + 0.2,
      speed: Math.random() * 0.0002 + 0.00005,
      opacity: Math.random() * 0.8 + 0.1,
      twinkle: Math.random() * 0.025 + 0.005,
      offset: Math.random() * Math.PI * 2,
    }))
    let t = 0
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      t++
      stars.forEach(s => {
        const tw = 0.45 + 0.55 * Math.sin(t * s.twinkle + s.offset)
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
  }, [density])
  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
}

/* ── Shooting star canvas ─────────────────────────────────────────────────── */
function ShootingStars() {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let raf
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight }
    resize()
    window.addEventListener('resize', resize)
    const meteors = []
    const spawn = () => {
      if (meteors.length < 3 && Math.random() < 0.008) {
        meteors.push({
          x: Math.random() * canvas.width * 0.7,
          y: Math.random() * canvas.height * 0.3,
          len: 80 + Math.random() * 120,
          speed: 8 + Math.random() * 10,
          opacity: 1,
          angle: Math.PI / 4 + (Math.random() - 0.5) * 0.3,
        })
      }
    }
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      spawn()
      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i]
        const grad = ctx.createLinearGradient(m.x, m.y, m.x - Math.cos(m.angle) * m.len, m.y - Math.sin(m.angle) * m.len)
        grad.addColorStop(0, `rgba(255,255,255,${m.opacity})`)
        grad.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.beginPath()
        ctx.moveTo(m.x, m.y)
        ctx.lineTo(m.x - Math.cos(m.angle) * m.len, m.y - Math.sin(m.angle) * m.len)
        ctx.strokeStyle = grad
        ctx.lineWidth = 1.5
        ctx.stroke()
        m.x += Math.cos(m.angle) * m.speed
        m.y += Math.sin(m.angle) * m.speed
        m.opacity -= 0.015
        if (m.opacity <= 0 || m.x > canvas.width || m.y > canvas.height) meteors.splice(i, 1)
      }
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [])
  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }} />
}

/* ── ISS SVG icon ─────────────────────────────────────────────────────────── */
function ISSIcon({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect x="13" y="7" width="6" height="18" rx="2" fill="#c4b5fd" />
      <rect x="2" y="13" width="28" height="6" rx="2" fill="#a78bfa" />
      <rect x="0" y="11" width="8" height="10" rx="2" fill="#7c3aed" opacity="0.8" />
      <rect x="24" y="11" width="8" height="10" rx="2" fill="#7c3aed" opacity="0.8" />
      <circle cx="16" cy="16" r="3" fill="#34d399" />
      <rect x="12" y="2" width="2" height="5" rx="1" fill="#60a5fa" />
      <rect x="18" y="2" width="2" height="5" rx="1" fill="#60a5fa" />
      <rect x="12" y="25" width="2" height="5" rx="1" fill="#60a5fa" />
      <rect x="18" y="25" width="2" height="5" rx="1" fill="#60a5fa" />
    </svg>
  )
}

/* ── Stat card ────────────────────────────────────────────────────────────── */
function SpaceStat({ label, value, unit, icon, color, delay = 0, pulse = false }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))',
      border: `1px solid ${color}30`,
      borderTop: `2px solid ${color}`,
      borderRadius: 18, padding: '18px 16px', textAlign: 'center',
      boxShadow: `0 6px 24px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.04)`,
      animation: `slideUp 0.5s ease-out ${delay}ms both`,
      position: 'relative', overflow: 'hidden',
      transition: 'transform 0.2s, box-shadow 0.2s',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 16px 36px rgba(0,0,0,0.4), 0 0 20px ${color}20` }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 6px 24px rgba(0,0,0,0.3)` }}
    >
      <div style={{ position: 'absolute', top: -16, right: -16, width: 60, height: 60, borderRadius: '50%', background: color, opacity: 0.1, filter: 'blur(14px)', pointerEvents: 'none' }} />
      <div style={{ fontSize: 22, marginBottom: 8, filter: `drop-shadow(0 0 8px ${color}60)`, animation: pulse ? 'iconFloat 3s ease-in-out infinite' : 'none' }}>{icon}</div>
      <p style={{ fontSize: 10, fontWeight: 700, color: `${color}cc`, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>{label}</p>
      <p style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 20, color: '#fff', margin: 0, lineHeight: 1 }}>{value}</p>
      {unit && <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 3, fontWeight: 500 }}>{unit}</p>}
    </div>
  )
}

/* ── Orbit altitude indicator ─────────────────────────────────────────────── */
function OrbitMeter({ velocity }) {
  const pct = Math.min((velocity / 30000) * 100, 100)
  return (
    <div style={{ padding: '16px 20px', background: 'rgba(255,255,255,0.04)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Speed relative to max orbital</span>
        <span style={{ fontSize: 11, fontWeight: 800, color: '#a78bfa' }}>{pct.toFixed(1)}%</span>
      </div>
      <div style={{ height: 6, borderRadius: 6, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 6,
          width: `${pct}%`,
          background: 'linear-gradient(90deg,#7c3aed,#a78bfa,#34d399)',
          boxShadow: '0 0 12px rgba(167,139,250,0.6)',
          transition: 'width 1s ease-out',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)', animation: 'shimBar 1.8s infinite' }} />
        </div>
      </div>
    </div>
  )
}

/* ── NASA APOD card ───────────────────────────────────────────────────────── */
function APODCard({ nasaData }) {
  const [expanded, setExpanded] = useState(false)
  if (!nasaData) {
    return (
      <div style={{
        background: 'linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))',
        border: '1px solid rgba(255,255,255,0.08)', borderRadius: 22,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: 320, flexDirection: 'column', gap: 16,
      }}>
        <div style={{ fontSize: 48, animation: 'iconFloat 3s ease-in-out infinite' }}>🌌</div>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 700, fontSize: 15, animation: 'glowPulse 2s infinite' }}>Connecting to NASA…</p>
      </div>
    )
  }

  const words = nasaData.explanation?.split(' ') || []
  const short = words.slice(0, 48).join(' ') + (words.length > 48 ? '…' : '')

  return (
    <div style={{
      borderRadius: 22, overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.08)',
      boxShadow: '0 16px 60px rgba(0,0,0,0.5)',
      animation: 'slideUp 0.5s ease-out 0.3s both',
    }}>
      {/* image / video */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        {nasaData.media_type === 'video' ? (
          <iframe src={nasaData.url} title="NASA APOD" style={{ width: '100%', height: 420, border: 0, display: 'block' }} />
        ) : (
          <img src={nasaData.url} alt={nasaData.title} referrerPolicy="no-referrer"
            style={{ width: '100%', height: 420, objectFit: 'cover', objectPosition: 'center', display: 'block', transition: 'transform 0.6s', cursor: 'zoom-in' }}
            onMouseEnter={e => e.target.style.transform = 'scale(1.03)'}
            onMouseLeave={e => e.target.style.transform = 'scale(1)'}
          />
        )}
        {/* overlay gradient */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 140, background: 'linear-gradient(to top,rgba(8,6,24,0.95),transparent)', pointerEvents: 'none' }} />
        {/* NASA badge */}
        <div style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 20, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14 }}>🚀</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.8)', letterSpacing: '0.08em' }}>NASA APOD</span>
        </div>
        {/* date badge */}
        <div style={{ position: 'absolute', top: 16, left: 16, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 20, padding: '6px 14px' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
        </div>
        {/* title on image bottom */}
        <div style={{ position: 'absolute', bottom: 16, left: 20, right: 20 }}>
          <h3 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 22, color: '#fff', margin: 0, textShadow: '0 2px 12px rgba(0,0,0,0.8)' }}>{nasaData.title}</h3>
        </div>
      </div>

      {/* description */}
      <div style={{ background: 'linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))', padding: '24px 24px 20px' }}>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.8, margin: 0 }}>
          {expanded ? nasaData.explanation : short}
        </p>
        {words.length > 48 && (
          <button onClick={() => setExpanded(e => !e)}
            style={{ marginTop: 12, background: 'none', border: 'none', color: '#a78bfa', fontWeight: 700, fontSize: 13, cursor: 'pointer', padding: 0, fontFamily: 'DM Sans,sans-serif' }}>
            {expanded ? '▲ Show less' : '▼ Read more'}
          </button>
        )}
      </div>
    </div>
  )
}

/* ── Coordinate display ───────────────────────────────────────────────────── */
function CoordDisplay({ value, label, color }) {
  const [anim, setAnim] = useState(value)
  useEffect(() => { setAnim(value) }, [value])
  return (
    <div style={{ textAlign: 'center', padding: '14px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.06)' }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: `${color}99`, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>{label}</p>
      <p style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 18, color, margin: 0, transition: 'all 0.5s', fontVariantNumeric: 'tabular-nums' }}>{parseFloat(anim).toFixed(4)}°</p>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────── */
export default function Space({ issData, issLocation, nasaData }) {
  const [mapLoaded, setMapLoaded] = useState(false)
  const [orbitDeg, setOrbitDeg] = useState(0)
  const [pulseRing, setPulseRing] = useState(0)

  /* Spin the decorative orbit ring based on velocity */
  useEffect(() => {
    const interval = setInterval(() => {
      setOrbitDeg(d => (d + 0.08) % 360)
      setPulseRing(p => p + 1)
    }, 50)
    return () => clearInterval(interval)
  }, [])

  if (!issData) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 52, animation: 'iconFloat 3s ease-in-out infinite' }}>🚀</div>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 700, fontSize: 15 }}>Loading Space Data…</p>
      </div>
    )
  }

  const lat = parseFloat(issData.lat)
  const lng = parseFloat(issData.lng)
  const vel = parseFloat(issData.vel)
  const minLng = lng - 18, maxLng = lng + 18, minLat = lat - 18, maxLat = lat + 18
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${minLng},${minLat},${maxLng},${maxLat}&layer=mapnik&marker=${lat},${lng}`

  /* orbit period ~92 min, show time since last full orbit */
  const orbitPeriodMin = 92
  const minutesNow = new Date().getMinutes()
  const orbitProgress = Math.round((minutesNow % orbitPeriodMin / orbitPeriodMin) * 100)

  return (
    <>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;700&family=Share+Tech+Mono&display=swap');
      .space-root { font-family:'DM Sans',sans-serif; color:#f1f5f9; }
      @keyframes slideUp    { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }
      @keyframes slideIn    { from{opacity:0;transform:translateX(-14px)} to{opacity:1;transform:translateX(0)} }
      @keyframes iconFloat  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
      @keyframes floatY     { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-14px)} }
      @keyframes glowPulse  { 0%,100%{opacity:0.5} 50%{opacity:1} }
      @keyframes shimBar    { 0%{transform:translateX(-100%)} 100%{transform:translateX(250%)} }
      @keyframes radarPing  { 0%{transform:scale(0.5);opacity:1} 100%{transform:scale(2.8);opacity:0} }
      @keyframes liveBlink  { 0%,100%{opacity:1} 50%{opacity:0.3} }
      @keyframes scanLine   { 0%{top:0} 100%{top:100%} }
      @keyframes popIn      { 0%{opacity:0;transform:scale(0.85)} 70%{transform:scale(1.03)} 100%{opacity:1;transform:scale(1)} }
      @keyframes fadeIn     { from{opacity:0} to{opacity:1} }
      .iss-map iframe { filter: invert(1) hue-rotate(180deg) saturate(1.2) brightness(0.85); }
    `}</style>

    <div className="space-root" style={{ maxWidth: 900, margin: '0 auto', paddingBottom: 40 }}>

      {/* ── PAGE HEADER ── */}
      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 24, marginBottom: 20, padding: '28px 28px 24px', background: 'linear-gradient(135deg,rgba(10,6,30,0.95),rgba(6,16,48,0.9))', border: '1px solid rgba(99,102,241,0.2)', boxShadow: '0 16px 60px rgba(0,0,0,0.5)', animation: 'slideUp 0.5s ease-out both' }}>
        <Starfield density={60} />
        <ShootingStars />
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          {/* spinning orbit visual */}
          <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '1px dashed rgba(99,102,241,0.35)', transform: `rotate(${orbitDeg}deg)` }}>
              <div style={{ position: 'absolute', top: -4, left: '50%', transform: 'translateX(-50%)', filter: 'drop-shadow(0 0 6px #a78bfa)' }}>
                <ISSIcon size={20} />
              </div>
            </div>
            <div style={{ position: 'absolute', inset: 10, borderRadius: '50%', border: '1px dashed rgba(52,211,153,0.25)', transform: `rotate(${-orbitDeg * 1.5}deg)` }}>
              <div style={{ position: 'absolute', top: -3, left: '50%', transform: 'translateX(-50%)', width: 6, height: 6, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 6px #34d399' }} />
            </div>
            <div style={{ position: 'absolute', inset: '30%', borderRadius: '50%', background: 'radial-gradient(circle,#1e40af,#0d1b4b)', border: '1px solid rgba(99,102,241,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>🌍</div>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <img src="/logo.jpg" alt="ACR MAX" style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid rgba(99,102,241,0.45)' }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(99,102,241,0.7)', letterSpacing: '0.1em' }}>ACR MAX</span>
            </div>
            <h2 style={{ fontFamily: 'Syne,sans-serif', fontSize: 22, fontWeight: 800, margin: '0 0 2px', background: 'linear-gradient(135deg,#fff 20%,#a78bfa 60%,#34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>🚀 Space World</h2>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, margin: 0 }}>Live ISS · NASA APOD</p>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 20, padding: '6px 14px' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', animation: 'liveBlink 1s infinite', boxShadow: '0 0 6px #ef4444' }} />
            <span style={{ fontSize: 11, fontWeight: 800, color: '#fca5a5', letterSpacing: '0.1em' }}>LIVE</span>
          </div>
        </div>
      </div>

      {/* ── ISS TRACKER ── */}
      <div style={{ borderRadius: 22, overflow: 'hidden', border: '1px solid rgba(99,102,241,0.2)', boxShadow: '0 16px 60px rgba(0,0,0,0.5)', marginBottom: 20, animation: 'slideUp 0.5s ease-out 0.1s both' }}>

        {/* tracker header */}
        <div style={{ padding: '18px 24px', background: 'linear-gradient(135deg,rgba(99,102,241,0.25),rgba(79,70,229,0.15))', borderBottom: '1px solid rgba(99,102,241,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <ISSIcon size={28} />
            <div>
              <p style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 16, color: '#fff', margin: 0 }}>ISS Live Tracker</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', margin: 0 }}>International Space Station · 408 km altitude</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)', borderRadius: 20, padding: '5px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 6px #34d399', animation: 'liveBlink 1.5s infinite' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#34d399' }}>TRACKING</span>
            </div>
          </div>
        </div>

        {/* MAP */}
        <div className="iss-map" style={{ position: 'relative', width: '100%', height: 380, background: '#020818', overflow: 'hidden' }}>
          {lat !== 0 ? (
            <>
              <iframe
                width="100%" height="100%"
                style={{ border: 0, display: 'block', opacity: mapLoaded ? 1 : 0, transition: 'opacity 0.6s' }}
                src={mapUrl}
                title="ISS Live Map"
                className="pointer-events-none"
                onLoad={() => setMapLoaded(true)}
              />
              {/* scan line effect */}
              <div style={{ position: 'absolute', left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,transparent,rgba(52,211,153,0.4),transparent)', animation: 'scanLine 3s linear infinite', pointerEvents: 'none' }} />
              {/* ISS position marker overlay */}
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none', zIndex: 5 }}>
                <div style={{ position: 'relative', width: 60, height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid rgba(52,211,153,0.6)', animation: 'radarPing 2s ease-out infinite' }} />
                  <div style={{ position: 'absolute', inset: 8, borderRadius: '50%', border: '1px solid rgba(52,211,153,0.4)', animation: 'radarPing 2s ease-out 0.6s infinite' }} />
                  <ISSIcon size={28} />
                </div>
              </div>
              {/* coordinate hud */}
              <div style={{ position: 'absolute', bottom: 12, left: 12, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 12, padding: '8px 14px', fontFamily: 'Share Tech Mono,monospace', fontSize: 12, color: '#34d399', pointerEvents: 'none' }}>
                LAT {lat.toFixed(4)}° · LON {lng.toFixed(4)}°
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 14 }}>
              <div style={{ fontSize: 40, animation: 'iconFloat 3s ease-in-out infinite' }}>🛰️</div>
              <p style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 700, animation: 'glowPulse 2s infinite' }}>Initializing GPS…</p>
            </div>
          )}
        </div>

        {/* TELEMETRY */}
        <div style={{ background: 'linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))', padding: 20 }}>

          {/* location banner */}
          <div style={{
            background: 'linear-gradient(135deg,rgba(99,102,241,0.2),rgba(79,70,229,0.12))',
            border: '1px solid rgba(99,102,241,0.25)',
            borderRadius: 12, padding: '10px 14px', marginBottom: 12,
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(99,102,241,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>📍</div>
              <div style={{ position: 'absolute', inset: -4, borderRadius: '50%', border: '1px solid rgba(99,102,241,0.4)', animation: 'radarPing 2.5s ease-out infinite' }} />
            </div>
            <div style={{ flex: 1, minWidth: 100 }}>
              <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>Currently over</p>
              <p style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 14, color: '#fff', margin: 0 }}>{issLocation || 'Locating…'}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>Orbit #{Math.floor(Date.now() / (92 * 60 * 1000))}</p>
              <p style={{ fontFamily: 'Share Tech Mono,monospace', fontSize: 13, color: '#a78bfa', margin: 0 }}>{new Date().toUTCString().slice(17, 25)} UTC</p>
            </div>
          </div>

          {/* stat grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 12 }}>
            <SpaceStat label="Latitude"  value={lat.toFixed(4)} unit="degrees" icon="↕"  color="#60a5fa" delay={0} />
            <SpaceStat label="Longitude" value={lng.toFixed(4)} unit="degrees" icon="↔"  color="#a78bfa" delay={60} />
            <SpaceStat label="Velocity"  value={vel.toFixed(0)} unit="km/h"    icon="⚡" color="#34d399" delay={120} pulse />
            <SpaceStat label="Altitude"  value="~408"           unit="km above earth" icon="🌐" color="#f472b6" delay={180} />
          </div>

          {/* orbit speed meter */}
          <OrbitMeter velocity={vel} />

          {/* fun facts strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginTop: 12 }}>
            {[
              { label: 'Orbits per day', value: '15.5', icon: '🔄', color: '#fbbf24' },
              { label: 'Orbit time', value: '92 min', icon: '⏱', color: '#60a5fa' },
              { label: 'Crew onboard', value: '7', icon: '👨‍🚀', color: '#34d399' },
              { label: 'Years in orbit', value: '25+', icon: '🏆', color: '#f472b6' },
            ].map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', animation: `slideIn 0.35s ease-out ${i * 50}ms both` }}>
                <span style={{ fontSize: 18, filter: `drop-shadow(0 0 6px ${f.color}60)` }}>{f.icon}</span>
                <div>
                  <p style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, color: f.color, fontSize: 15, margin: 0 }}>{f.value}</p>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', margin: 0, fontWeight: 600 }}>{f.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── ISS ABOUT STRIP ── */}
      <div style={{
        background: 'linear-gradient(135deg,rgba(99,102,241,0.09),rgba(255,255,255,0.03))',
        border: '1px solid rgba(99,102,241,0.16)',
        borderRadius: 18, padding: '18px 22px', marginBottom: 22,
        display: 'flex', gap: 14, alignItems: 'flex-start',
        animation: 'slideUp 0.5s ease-out 0.25s both',
      }}>
        <span style={{ fontSize: 28, flexShrink: 0, animation: 'iconFloat 5s ease-in-out infinite' }}>🛸</span>
        <div>
          <p style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, color: '#fff', fontSize: 14, marginBottom: 5 }}>About the ISS</p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.75, margin: 0 }}>
            The International Space Station travels at <span style={{ color: '#34d399', fontWeight: 700 }}>~27,600 km/h</span>, completing an orbit every <span style={{ color: '#60a5fa', fontWeight: 700 }}>92 minutes</span>. It orbits at approximately <span style={{ color: '#f472b6', fontWeight: 700 }}>408 km</span> above Earth's surface — visible to the naked eye at dawn and dusk. Location data updates every <span style={{ color: '#fbbf24', fontWeight: 700 }}>5 seconds</span>.
          </p>
        </div>
      </div>

      {/* ── NASA APOD ── */}
      <div style={{ animation: 'slideUp 0.5s ease-out 0.3s both' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div style={{ fontSize: 24, filter: 'drop-shadow(0 0 10px rgba(251,191,36,0.6))' }}>🌌</div>
          <div>
            <p style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 18, color: '#fff', margin: 0 }}>Astronomy Picture of the Day</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', margin: 0 }}>Curated daily by NASA — updated every 24 hours</p>
          </div>
        </div>
        <APODCard nasaData={nasaData} />
      </div>

    </div>
    </>
  )
}