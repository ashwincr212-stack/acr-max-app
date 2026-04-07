import { useState, useEffect, useRef } from 'react'

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

    const stars = Array.from({ length: 120 }, () => ({
      x: Math.random(), y: Math.random(),
      r: Math.random() * 1.4 + 0.2,
      speed: Math.random() * 0.0003 + 0.00008,
      opacity: Math.random() * 0.7 + 0.15,
      twinkleSpeed: Math.random() * 0.02 + 0.005,
      twinkleOffset: Math.random() * Math.PI * 2,
    }))

    let t = 0
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      t += 1
      stars.forEach(s => {
        const tw = 0.5 + 0.5 * Math.sin(t * s.twinkleSpeed + s.twinkleOffset)
        ctx.beginPath()
        ctx.arc(s.x * canvas.width, s.y * canvas.height, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${s.opacity * tw})`
        ctx.fill()
        s.y -= s.speed
        if (s.y < 0) s.y = 1
      })
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [])
  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }} />
}

/* ── Orbiting planet decoration ───────────────────────────────────────────── */
function OrbitRing({ size, duration, color, children, delay = 0 }) {
  return (
    <div style={{
      position: 'absolute', width: size, height: size,
      borderRadius: '50%',
      border: `1px solid ${color}`,
      left: '50%', top: '50%',
      transform: 'translate(-50%,-50%)',
      animation: `orbitSpin ${duration}s linear infinite`,
      animationDelay: `${delay}s`,
    }}>
      {children}
    </div>
  )
}

/* ── Glowing input ────────────────────────────────────────────────────────── */
function AstroInput({ label, type = 'text', value, onChange, placeholder }) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ flex: 1 }}>
      <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{label}</label>
      <input
        type={type} value={value} onChange={onChange} placeholder={placeholder}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          width: '100%', padding: '14px 16px',
          background: focused ? 'rgba(167,139,250,0.08)' : 'rgba(255,255,255,0.05)',
          border: focused ? '1px solid rgba(167,139,250,0.6)' : '1px solid rgba(255,255,255,0.1)',
          borderRadius: 14, color: '#fff', fontSize: 15, outline: 'none',
          fontFamily: 'DM Sans,sans-serif', fontWeight: 600,
          boxShadow: focused ? '0 0 0 3px rgba(124,58,237,0.15), 0 0 20px rgba(167,139,250,0.1)' : 'none',
          transition: 'all 0.3s',
        }}
      />
    </div>
  )
}

/* ── Cosmic card ──────────────────────────────────────────────────────────── */
function CosmicCard({ icon, title, content, accent, delay, isEmpty }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative', overflow: 'hidden',
        borderRadius: 22, padding: '28px 24px',
        background: `linear-gradient(135deg,${accent}12 0%,rgba(255,255,255,0.04) 100%)`,
        border: `1px solid ${accent}28`,
        borderTop: `2px solid ${accent}`,
        boxShadow: hovered ? `0 20px 48px rgba(0,0,0,0.4), 0 0 30px ${accent}20` : '0 8px 28px rgba(0,0,0,0.3)',
        transform: hovered ? 'translateY(-5px)' : 'translateY(0)',
        transition: 'all 0.35s cubic-bezier(.34,1.1,.64,1)',
        animation: `slideUp 0.5s ease-out ${delay}ms both`,
        cursor: 'default',
      }}
    >
      {/* shimmer sweep on hover */}
      {hovered && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `linear-gradient(105deg,transparent 30%,${accent}08 50%,transparent 70%)`,
          animation: 'cardShimmer 0.8s ease-out forwards',
        }} />
      )}

      {/* glow orb top-right */}
      <div style={{
        position: 'absolute', top: -20, right: -20,
        width: 80, height: 80, borderRadius: '50%',
        background: accent, opacity: hovered ? 0.18 : 0.08,
        filter: 'blur(20px)', transition: 'opacity 0.3s',
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* icon with pulse ring */}
        <div style={{ position: 'relative', display: 'inline-block', marginBottom: 16 }}>
          <div style={{
            fontSize: 36,
            filter: `drop-shadow(0 0 12px ${accent}80)`,
            animation: isEmpty ? 'none' : `iconFloat 3s ease-in-out infinite ${delay}ms`,
          }}>{icon}</div>
          {!isEmpty && (
            <div style={{
              position: 'absolute', inset: -6, borderRadius: '50%',
              border: `1px solid ${accent}40`,
              animation: 'pulseRing 2s ease-out infinite',
            }} />
          )}
        </div>

        <h4 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, color: '#fff', fontSize: 17, marginBottom: 10 }}>{title}</h4>

        {isEmpty ? (
          <div>
            <div style={{ height: 12, background: 'rgba(255,255,255,0.06)', borderRadius: 6, marginBottom: 8, width: '90%' }} />
            <div style={{ height: 12, background: 'rgba(255,255,255,0.06)', borderRadius: 6, marginBottom: 8, width: '75%' }} />
            <div style={{ height: 12, background: 'rgba(255,255,255,0.06)', borderRadius: 6, width: '60%' }} />
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', marginTop: 12, fontStyle: 'italic' }}>Generate to reveal ✨</p>
          </div>
        ) : (
          <p style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.75, fontSize: 14, margin: 0 }}>{content}</p>
        )}
      </div>
    </div>
  )
}

/* ── Zodiac symbol map ────────────────────────────────────────────────────── */
function getZodiac(dob) {
  if (!dob) return { sign: '✨', name: 'Unknown', color: '#a78bfa' }
  const d = new Date(dob)
  const m = d.getMonth() + 1, day = d.getDate()
  const signs = [
    { name: 'Capricorn', sign: '♑', color: '#6b7280', range: [[1,1],[1,19]] },
    { name: 'Aquarius',  sign: '♒', color: '#60a5fa', range: [[1,20],[2,18]] },
    { name: 'Pisces',    sign: '♓', color: '#818cf8', range: [[2,19],[3,20]] },
    { name: 'Aries',     sign: '♈', color: '#f87171', range: [[3,21],[4,19]] },
    { name: 'Taurus',    sign: '♉', color: '#34d399', range: [[4,20],[5,20]] },
    { name: 'Gemini',    sign: '♊', color: '#fbbf24', range: [[5,21],[6,20]] },
    { name: 'Cancer',    sign: '♋', color: '#c4b5fd', range: [[6,21],[7,22]] },
    { name: 'Leo',       sign: '♌', color: '#fb923c', range: [[7,23],[8,22]] },
    { name: 'Virgo',     sign: '♍', color: '#6ee7b7', range: [[8,23],[9,22]] },
    { name: 'Libra',     sign: '♎', color: '#f9a8d4', range: [[9,23],[10,22]] },
    { name: 'Scorpio',   sign: '♏', color: '#ef4444', range: [[10,23],[11,21]] },
    { name: 'Sagittarius',sign:'♐', color: '#a78bfa', range: [[11,22],[12,21]] },
    { name: 'Capricorn', sign: '♑', color: '#6b7280', range: [[12,22],[12,31]] },
  ]
  return signs.find(s => {
    const [[sm,sd],[em,ed]] = s.range
    return (m === sm && day >= sd) || (m === em && day <= ed)
  }) || { name: 'Capricorn', sign: '♑', color: '#6b7280' }
}

/* ─────────────────────────────────────────────────────────────────────────── */
export default function Astro(props) {
  const { isProfileSaved, setIsProfileSaved, astroProfile, setAstroProfile, astroInsights, generateAstroData, isAstroThinking } = props

  const [particlesBurst, setParticlesBurst] = useState(false)
  const zodiac = getZodiac(astroProfile.dob)

  const handleGenerate = () => {
    setParticlesBurst(true)
    setTimeout(() => setParticlesBurst(false), 1000)
    generateAstroData()
  }

  const cards = [
    { icon: '🎨', title: 'Lucky Color', accent: '#a78bfa', delay: 0 },
    { icon: '✨', title: 'Best Time (Muhurtham)', accent: '#34d399', delay: 100 },
    { icon: '⚠️', title: 'Caution Times', accent: '#f87171', delay: 200 },
  ]

  return (
    <>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:ital,wght@0,400;0,500;0,700;1,400&display=swap');
      @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&display=swap');
      .astro-root { font-family:'DM Sans',sans-serif; color:#f1f5f9; }

      @keyframes slideUp      { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }
      @keyframes slideIn      { from{opacity:0;transform:translateX(-14px)} to{opacity:1;transform:translateX(0)} }
      @keyframes popIn        { 0%{opacity:0;transform:scale(0.7)} 70%{transform:scale(1.06)} 100%{opacity:1;transform:scale(1)} }
      @keyframes fadeIn       { from{opacity:0} to{opacity:1} }
      @keyframes floatY       { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
      @keyframes iconFloat    { 0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(-6px) rotate(3deg)} }
      @keyframes orbitSpin    { from{transform:translate(-50%,-50%) rotate(0deg)} to{transform:translate(-50%,-50%) rotate(360deg)} }
      @keyframes orbitSpinRev { from{transform:translate(-50%,-50%) rotate(0deg)} to{transform:translate(-50%,-50%) rotate(-360deg)} }
      @keyframes pulseRing    { 0%{opacity:0.8;transform:scale(1)} 100%{opacity:0;transform:scale(1.6)} }
      @keyframes glowPulse    { 0%,100%{opacity:0.5;transform:scale(1)} 50%{opacity:1;transform:scale(1.12)} }
      @keyframes shimmerSweep { 0%{background-position:-200% center} 100%{background-position:200% center} }
      @keyframes cardShimmer  { 0%{transform:translateX(-100%)} 100%{transform:translateX(200%)} }
      @keyframes starPop      { 0%{opacity:1;transform:scale(0)} 50%{opacity:1;transform:scale(1.2)} 100%{opacity:0;transform:scale(0.5) translateY(-60px)} }
      @keyframes rotateHalo   { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      @keyframes textGlow     { 0%,100%{text-shadow:0 0 20px rgba(167,139,250,0.5)} 50%{text-shadow:0 0 40px rgba(167,139,250,0.9),0 0 80px rgba(167,139,250,0.3)} }
      @keyframes zodiacPop    { 0%{opacity:0;transform:scale(0.5) rotate(-20deg)} 70%{transform:scale(1.1) rotate(3deg)} 100%{opacity:1;transform:scale(1) rotate(0deg)} }
      @keyframes thinkingDot  { 0%,80%,100%{transform:scale(0);opacity:0.3} 40%{transform:scale(1);opacity:1} }

      .generate-btn:hover { filter:brightness(1.12); transform:translateY(-2px) scale(1.02); }
      .generate-btn:active { transform:scale(0.97); }
      .astro-root input::placeholder { color:rgba(255,255,255,0.2)!important; }
      .thinking-dot { animation: thinkingDot 1.4s ease-in-out infinite; }
      .thinking-dot:nth-child(2) { animation-delay:0.2s; }
      .thinking-dot:nth-child(3) { animation-delay:0.4s; }
    `}</style>

    <div className="astro-root" style={{ maxWidth: 900, margin: '0 auto', paddingBottom: 40, position: 'relative' }}>

      {/* ── SETUP SCREEN ── */}
      {!isProfileSaved ? (
        <div style={{ position: 'relative', zIndex: 10, animation: 'fadeIn 0.5s ease-out both' }}>

          {/* Hero setup panel */}
          <div style={{
            position: 'relative', overflow: 'hidden', borderRadius: 28,
            background: 'linear-gradient(135deg,rgba(124,58,237,0.2),rgba(79,70,229,0.12),rgba(15,10,40,0.9))',
            border: '1px solid rgba(167,139,250,0.25)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
            padding: '0',
          }}>
            {/* Starfield bg */}
            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 28 }}>
              <Starfield />
              {/* nebula blobs */}
              <div style={{ position: 'absolute', top: '-20%', right: '-10%', width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle,rgba(167,139,250,0.18),transparent 65%)', animation: 'floatY 8s ease-in-out infinite' }} />
              <div style={{ position: 'absolute', bottom: '-10%', left: '20%', width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle,rgba(52,211,153,0.1),transparent 65%)', animation: 'floatY 11s ease-in-out infinite reverse' }} />
            </div>

            {/* Content */}
            <div style={{ position: 'relative', zIndex: 2, padding: '24px 20px 24px' }}>
              {/* top title */}
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 6 }}>
                  <img src="/logo.jpg" alt="ACR MAX" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid rgba(167,139,250,0.45)' }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(167,139,250,0.7)', letterSpacing: '0.12em' }}>ACR MAX</span>
                </div>
                <div style={{ fontSize: 36, marginBottom: 8, animation: 'iconFloat 4s ease-in-out infinite', filter: 'drop-shadow(0 0 16px rgba(167,139,250,0.6))' }}>🔮</div>
                <h2 style={{
                  fontFamily: 'Cinzel,Syne,sans-serif', fontSize: 22, fontWeight: 700, color: '#fff', margin: '0 0 5px',
                  animation: 'textGlow 3s ease-in-out infinite',
                }}>Astro Insights</h2>
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, margin: 0 }}>Enter birth details to unlock your cosmic dashboard</p>
              </div>

              {/* form */}
              <div style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16, padding: 18,
                backdropFilter: 'blur(16px)',
                maxWidth: 560, margin: '0 auto',
              }}>
                <div style={{ marginBottom: 14 }}>
                  <AstroInput label="Full Name" value={astroProfile.name} onChange={e => setAstroProfile({ ...astroProfile, name: e.target.value })} placeholder="e.g. Rahul Kumar" />
                </div>
                <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                  <AstroInput label="Date of Birth" type="date" value={astroProfile.dob} onChange={e => setAstroProfile({ ...astroProfile, dob: e.target.value })} />
                  <AstroInput label="Time of Birth" type="time" value={astroProfile.time} onChange={e => setAstroProfile({ ...astroProfile, time: e.target.value })} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <AstroInput label="Current Location" value={astroProfile.location} onChange={e => setAstroProfile({ ...astroProfile, location: e.target.value })} placeholder="e.g. Bengaluru, Karnataka" />
                </div>

                {/* zodiac preview */}
                {astroProfile.dob && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    background: `${zodiac.color}12`, border: `1px solid ${zodiac.color}30`,
                    borderRadius: 14, padding: '14px 18px', marginBottom: 20,
                    animation: 'zodiacPop 0.5s cubic-bezier(.34,1.56,.64,1) both',
                  }}>
                    <span style={{ fontSize: 32, color: zodiac.color, filter: `drop-shadow(0 0 10px ${zodiac.color}80)` }}>{zodiac.sign}</span>
                    <div>
                      <p style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, color: '#fff', fontSize: 16, margin: 0 }}>{zodiac.name}</p>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', margin: 0 }}>Your Sun Sign has been detected ✨</p>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => setIsProfileSaved(true)}
                  disabled={!astroProfile.name || !astroProfile.dob}
                  className="generate-btn"
                  style={{
                    width: '100%', padding: '12px', borderRadius: 13,
                    background: (!astroProfile.name || !astroProfile.dob)
                      ? 'rgba(167,139,250,0.2)'
                      : 'linear-gradient(135deg,#7c3aed,#4f46e5)',
                    border: 'none', color: '#fff',
                    fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 13,
                    cursor: (!astroProfile.name || !astroProfile.dob) ? 'not-allowed' : 'pointer',
                    opacity: (!astroProfile.name || !astroProfile.dob) ? 0.5 : 1,
                    boxShadow: (!astroProfile.name || !astroProfile.dob) ? 'none' : '0 4px 28px rgba(124,58,237,0.55)',
                    transition: 'all 0.3s cubic-bezier(.34,1.1,.64,1)',
                    letterSpacing: '0.02em',
                  }}>
                  🌙 Save Profile &amp; Unlock Dashboard
                </button>
              </div>
            </div>
          </div>
        </div>

      ) : (
        /* ── DASHBOARD ── */
        <div style={{ position: 'relative', zIndex: 10, animation: 'fadeIn 0.4s ease-out both' }}>

          {/* ── HERO BANNER ── */}
          <div style={{
            position: 'relative', overflow: 'hidden', borderRadius: 26,
            marginBottom: 22,
            background: 'linear-gradient(135deg,rgba(124,58,237,0.22),rgba(52,211,153,0.1),rgba(10,8,30,0.85))',
            border: '1px solid rgba(167,139,250,0.2)',
            boxShadow: '0 16px 60px rgba(0,0,0,0.45)',
            padding: '32px 32px 28px',
            animation: 'slideUp 0.5s ease-out both',
          }}>
            <Starfield />

            {/* orbit rings decorative */}
            <div style={{ position: 'absolute', right: 40, top: '50%', transform: 'translateY(-50%)', width: 140, height: 140, opacity: 0.35 }}>
              <OrbitRing size={140} duration={12} color="rgba(167,139,250,0.4)">
                <div style={{ position: 'absolute', top: -4, left: '50%', transform: 'translateX(-50%)', width: 8, height: 8, borderRadius: '50%', background: '#a78bfa', boxShadow: '0 0 8px #a78bfa' }} />
              </OrbitRing>
              <OrbitRing size={90} duration={8} color="rgba(52,211,153,0.4)" delay={-3}>
                <div style={{ position: 'absolute', top: -3, left: '50%', transform: 'translateX(-50%)', width: 6, height: 6, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 6px #34d399' }} />
              </OrbitRing>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontSize: 22, filter: 'drop-shadow(0 0 10px rgba(167,139,250,0.8))' }}>🪐</div>
            </div>

            <div style={{ position: 'relative', zIndex: 2, maxWidth: 520 }}>
              {/* zodiac badge */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: `${zodiac.color}20`, border: `1px solid ${zodiac.color}40`, borderRadius: 20, padding: '5px 14px', marginBottom: 14 }}>
                <span style={{ fontSize: 18, color: zodiac.color }}>{zodiac.sign}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: zodiac.color, letterSpacing: '0.06em' }}>{zodiac.name}</span>
              </div>

              <h2 style={{
                fontFamily: 'Cinzel,Syne,sans-serif', fontSize: 28, fontWeight: 700, color: '#fff',
                margin: '0 0 6px', textShadow: '0 0 30px rgba(167,139,250,0.4)',
              }}>Welcome, {astroProfile.name} 🌙</h2>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, margin: '0 0 22px' }}>
                Calibrating planetary data for <span style={{ color: '#a78bfa', fontWeight: 600 }}>{astroProfile.location}</span>
              </p>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={() => setIsProfileSaved(false)}
                  style={{
                    padding: '11px 20px', borderRadius: 12,
                    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)',
                    color: 'rgba(255,255,255,0.7)', fontWeight: 700, fontSize: 13,
                    cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'DM Sans,sans-serif',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}>
                  ✏ Edit Profile
                </button>

                <button onClick={handleGenerate} disabled={isAstroThinking}
                  className="generate-btn"
                  style={{
                    padding: '11px 24px', borderRadius: 12,
                    background: isAstroThinking ? 'rgba(167,139,250,0.2)' : 'linear-gradient(135deg,#7c3aed,#4f46e5)',
                    border: '1px solid rgba(167,139,250,0.35)',
                    color: '#fff', fontWeight: 800, fontSize: 14,
                    cursor: isAstroThinking ? 'not-allowed' : 'pointer',
                    boxShadow: isAstroThinking ? 'none' : '0 4px 22px rgba(124,58,237,0.5)',
                    transition: 'all 0.3s', fontFamily: 'Syne,sans-serif',
                    display: 'flex', alignItems: 'center', gap: 10,
                    animation: isAstroThinking ? 'glowPulse 1.5s infinite' : 'none',
                  }}>
                  {isAstroThinking ? (
                    <>
                      <span style={{ fontSize: 16 }}>✨</span>
                      <span>Reading Stars</span>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        {[0,1,2].map(i => (
                          <div key={i} className="thinking-dot" style={{ width: 5, height: 5, borderRadius: '50%', background: '#a78bfa', animationDelay: `${i * 0.2}s` }} />
                        ))}
                      </div>
                    </>
                  ) : (
                    <>🔮 Generate Daily Reading</>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* ── BIRTH PROFILE STRIP ── */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))',
            gap: 10, marginBottom: 22, animation: 'slideUp 0.45s ease-out 0.1s both',
          }}>
            {[
              { label: 'Born', value: astroProfile.dob ? new Date(astroProfile.dob).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—', icon: '📅', color: '#60a5fa' },
              { label: 'Birth Time', value: astroProfile.time || 'Not set', icon: '🕐', color: '#fbbf24' },
              { label: 'Location', value: astroProfile.location || '—', icon: '📍', color: '#34d399' },
              { label: 'Sun Sign', value: zodiac.name, icon: zodiac.sign, color: zodiac.color },
            ].map((item, i) => (
              <div key={i} style={{
                background: 'linear-gradient(135deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16, padding: '14px 16px',
                animation: `slideIn 0.35s ease-out ${i * 60}ms both`,
              }}>
                <div style={{ fontSize: 18, marginBottom: 4 }}>{item.icon}</div>
                <p style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, color: item.color, fontSize: 14, margin: '0 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.value}</p>
                <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>{item.label}</p>
              </div>
            ))}
          </div>

          {/* ── INSIGHT CARDS ── */}
          {astroInsights.length > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)',
              borderRadius: 14, padding: '12px 18px', marginBottom: 18,
              animation: 'slideUp 0.4s ease-out both',
            }}>
              <span style={{ fontSize: 18, animation: 'iconFloat 3s ease-in-out infinite' }}>🌟</span>
              <p style={{ color: '#6ee7b7', fontSize: 13, fontWeight: 600, margin: 0 }}>
                Your cosmic reading for {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })} is ready
              </p>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 18, marginBottom: 22 }}>
            {cards.map((card, i) => (
              <CosmicCard
                key={i}
                icon={card.icon}
                title={card.title}
                accent={card.accent}
                delay={card.delay}
                content={astroInsights[i] ? astroInsights[i].replace(/-/g, '') : ''}
                isEmpty={!astroInsights[i]}
              />
            ))}
          </div>

          {/* ── COSMIC TIP PANEL ── */}
          <div style={{
            position: 'relative', overflow: 'hidden', borderRadius: 20,
            background: 'linear-gradient(135deg,rgba(124,58,237,0.1),rgba(52,211,153,0.06))',
            border: '1px solid rgba(167,139,250,0.15)',
            padding: '22px 24px',
            animation: 'slideUp 0.5s ease-out 0.35s both',
          }}>
            <div style={{ position: 'absolute', top: -20, right: -20, width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle,rgba(167,139,250,0.15),transparent)', pointerEvents: 'none' }} />
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
              <span style={{ fontSize: 28, flexShrink: 0, animation: 'iconFloat 5s ease-in-out infinite' }}>🌌</span>
              <div>
                <p style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, color: '#fff', fontSize: 14, marginBottom: 5 }}>About Your Reading</p>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7, margin: 0 }}>
                  Your daily horoscope is calculated using Vedic astrology principles, personalized for{' '}
                  <span style={{ color: '#a78bfa', fontWeight: 600 }}>{astroProfile.name}</span> born under{' '}
                  <span style={{ color: zodiac.color, fontWeight: 600 }}>{zodiac.sign} {zodiac.name}</span>.
                  Rahu Kalam and Yama Gandam timings are computed for{' '}
                  <span style={{ color: '#34d399', fontWeight: 600 }}>{astroProfile.location}</span>.
                </p>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
    </>
  )
}