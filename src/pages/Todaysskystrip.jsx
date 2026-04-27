/**
 * TodaysSkyStrip — Premium animated celestial arc strip
 * Matches reference image: left labels | wide arc canvas | right countdown
 *
 * Props:
 *   sunrise   {string}  e.g. "6:10 AM"
 *   sunset    {string}  e.g. "6:37 PM"
 *   moonrise  {string}  e.g. "3:17 AM"
 *   moonset   {string}  e.g. "7:45 AM"  (optional)
 */

import { useEffect, useRef, useState, useMemo } from 'react'

const TIME_RE = /(\d{1,2}):(\d{2})(?::\d{2})?\s*([APap][Mm])/

function parseToMins(str) {
  if (!str || str === '—' || str === '--') return null
  const m = String(str).match(TIME_RE)
  if (!m) return null
  let h = parseInt(m[1], 10)
  const mn = parseInt(m[2], 10)
  const mer = m[3].toUpperCase()
  if (mer === 'AM' && h === 12) h = 0
  if (mer === 'PM' && h !== 12) h += 12
  return h * 60 + mn
}

function nowMins() {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60
}

function minsToLabel(mins) {
  if (mins == null) return '—'
  const h24 = Math.floor(mins) % 1440
  const h = Math.floor(h24 / 60) % 24
  const m = h24 % 60
  const mer = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${mer}`
}

function fmtCountdown(diffMins) {
  const total = Math.round(Math.abs(diffMins))
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function skyPhase(nowMin, srMin, ssMin) {
  if (srMin == null || ssMin == null) return 'night'
  if (nowMin < srMin - 40 || nowMin >= ssMin + 45) return 'night'
  if (nowMin < srMin) return 'dawn'
  if (nowMin < srMin + 75) return 'morning'
  if (nowMin < (srMin + ssMin) / 2 - 30) return 'day'
  if (nowMin < ssMin) return 'evening'
  return 'dusk'
}

const PHASE_BG = {
  morning: ['#0d0a25', '#1a0d35', '#3d1520', '#c05a2a', '#e8903a'],
  day:     ['#05111f', '#0a2040', '#1a3f6a', '#4a86b8', '#7ab8d8'],
  evening: ['#080615', '#1a0a30', '#6a1520', '#c84020', '#e87030'],
  dusk:    ['#04030e', '#110820', '#3a1230', '#882030', '#d06010'],
  night:   ['#010105', '#03050e', '#060a18', '#0c1428', '#111f3a'],
  dawn:    ['#06030f', '#18082a', '#501a40', '#b05028', '#e09040'],
}

const PHASE_GLOW = {
  morning: 'rgba(220,100,40,0.55)',
  day:     'rgba(70,140,200,0.3)',
  evening: 'rgba(200,70,30,0.55)',
  dusk:    'rgba(160,50,20,0.5)',
  night:   'rgba(20,40,100,0.2)',
  dawn:    'rgba(180,70,60,0.45)',
}

const GREETINGS = {
  dawn: 'Good Dawn', morning: 'Good Morning', day: 'Good Day',
  evening: 'Good Evening', dusk: 'Good Dusk', night: 'Good Night',
}

function Stars({ opacity }) {
  const pts = useMemo(() => {
    const out = []
    for (let i = 0; i < 52; i++) {
      out.push({
        x: ((i * 1373 + 7) % 997) / 997 * 100,
        y: ((i * 857  + 3) % 743) / 743 * 72,
        r: 0.35 + ((i * 313) % 100) / 100 * 0.95,
        delay: (i * 0.19) % 4.5,
        dur: 2.2 + (i * 0.11) % 2.3,
      })
    }
    return out
  }, [])
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none"
      style={{ position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none',opacity,transition:'opacity 2s ease' }}>
      {pts.map((s, i) => (
        <circle key={i} cx={`${s.x}%`} cy={`${s.y}%`} r={s.r} fill="white">
          <animate attributeName="opacity" values="0.08;0.80;0.08"
            dur={`${s.dur}s`} begin={`${s.delay}s`} repeatCount="indefinite" />
        </circle>
      ))}
    </svg>
  )
}

function bezier(t) {
  return {
    x: (1-t)**2*0 + 2*(1-t)*t*50 + t**2*100,
    y: (1-t)**2*100 + 2*(1-t)*t*5 + t**2*100,
  }
}

function bodyT(nowMin, riseMin, setMin) {
  if (riseMin == null || setMin == null) return 0.5
  let rise = riseMin, set = setMin
  if (set < rise) set += 1440
  let now = nowMin < rise ? nowMin + 1440 : nowMin
  return Math.max(0.01, Math.min(0.99, (now - rise) / (set - rise)))
}

function SkyLabel({ icon, label, time, dim = false }) {
  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:3 }}>
        <span style={{ fontSize:10, lineHeight:1 }}>{icon}</span>
        <span style={{ fontSize:8, fontWeight:700, letterSpacing:'0.04em',
          color: dim ? 'rgba(255,255,255,0.38)' : 'rgba(255,255,255,0.55)' }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize:12.5, fontWeight:800, lineHeight:1.15, letterSpacing:'-0.01em',
        color: dim ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.92)',
        fontFamily:'system-ui,-apple-system,sans-serif' }}>
        {time}
      </div>
    </div>
  )
}

export default function TodaysSkyStrip({ sunrise, sunset, moonrise, moonset }) {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 20000)
    return () => clearInterval(id)
  }, [])

  const [arcDraw, setArcDraw] = useState(0)
  const rafRef = useRef(null)
  useEffect(() => {
    let start = null
    const step = (ts) => {
      if (!start) start = ts
      const p = Math.min((ts - start) / 1100, 1)
      setArcDraw(1 - (1 - p) ** 3)
      if (p < 1) rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  const now   = nowMins()
  const srMin = parseToMins(sunrise)
  const ssMin = parseToMins(sunset)
  const mrMin = parseToMins(moonrise)
  const msMin = parseToMins(moonset)

  const phase    = skyPhase(now, srMin, ssMin)
  const bg       = PHASE_BG[phase]
  const isNight  = phase === 'night' || phase === 'dusk'
  const showSun  = !isNight && srMin != null
  const showMoon = (isNight || phase === 'evening' || phase === 'dusk') && mrMin != null

  const sunPos  = bezier(showSun  ? bodyT(now, srMin ?? 360, ssMin ?? 1110) : 0.5)
  const moonPos = bezier(showMoon ? bodyT(now, mrMin, msMin ?? mrMin + 480) : 0.5)

  const sunClipW  = `${(bodyT(now, srMin ?? 360, ssMin ?? 1110) * arcDraw * 100).toFixed(1)}%`
  const moonClipW = `${(bodyT(now, mrMin ?? 0, msMin ?? 480)    * arcDraw * 100).toFixed(1)}%`

  const countdown = useMemo(() => {
    const evs = []
    if (ssMin != null) { const d = ssMin - now; if (d > 0) evs.push({ label:'Sunset in',   diff:d, color:'#f59e0b' }) }
    if (srMin != null) { const d = (srMin > now ? srMin : srMin+1440) - now; evs.push({ label:'Sunrise in',  diff:d, color:'#f59e0b' }) }
    if (mrMin != null) { const d = (mrMin > now ? mrMin : mrMin+1440) - now; evs.push({ label:'Moonrise in', diff:d, color:'#a5b4fc' }) }
    if (msMin != null) { const d = (msMin > now ? msMin : msMin+1440) - now; evs.push({ label:'Moonset in',  diff:d, color:'#a5b4fc' }) }
    evs.sort((a,b) => a.diff - b.diff)
    return evs[0] ?? { label:'Sunrise in', diff:0, color:'#f59e0b' }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, srMin, ssMin, mrMin, msMin])

  return (
    <>
      <style>{`
        @keyframes _skyFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-1.8px)}}
        @keyframes _sunGlow{0%,100%{filter:drop-shadow(0 0 5px rgba(255,190,40,.8)) drop-shadow(0 0 12px rgba(255,150,20,.45))}50%{filter:drop-shadow(0 0 9px rgba(255,210,60,1)) drop-shadow(0 0 20px rgba(255,160,30,.65))}}
        @keyframes _moonGlow{0%,100%{filter:drop-shadow(0 0 5px rgba(160,180,255,.7)) drop-shadow(0 0 11px rgba(120,150,240,.35))}50%{filter:drop-shadow(0 0 9px rgba(180,200,255,.9)) drop-shadow(0 0 19px rgba(140,170,250,.5))}}
        @keyframes _skyShift{0%,100%{opacity:1}50%{opacity:0.92}}
        ._sky-sun{animation:_skyFloat 4.2s ease-in-out infinite,_sunGlow 3.8s ease-in-out infinite}
        ._sky-moon{animation:_skyFloat 5.4s ease-in-out infinite .9s,_moonGlow 4.4s ease-in-out infinite}
        ._sky-bg{animation:_skyShift 14s ease-in-out infinite}
      `}</style>

      <div style={{ position:'relative', width:'100%', height:80, borderRadius:20, overflow:'hidden', userSelect:'none', flexShrink:0 }}>

        {/* BG */}
        <div className="_sky-bg" style={{
          position:'absolute', inset:0,
          background:`linear-gradient(to bottom,${bg[0]} 0%,${bg[1]} 22%,${bg[2]} 52%,${bg[3]} 78%,${bg[4]} 100%)`,
          transition:'background 5s ease',
        }} />

        {/* Horizon glow */}
        <div style={{ position:'absolute', inset:0, pointerEvents:'none',
          background:`radial-gradient(ellipse 70% 32% at 50% 100%,${PHASE_GLOW[phase]},transparent)` }} />

        {/* Stars */}
        <Stars opacity={isNight ? 1 : phase === 'dawn' ? 0.4 : 0} />

        {/* Mountains */}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none"
          style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none' }}>
          <path d="M0,88 C6,84 13,80 20,83 C27,86 31,77 40,80 C49,83 54,75 62,78 C70,81 76,85 84,81 C90,78 95,82 100,80 L100,100 L0,100Z" fill="rgba(0,0,0,0.28)" />
          <path d="M0,94 C10,91 18,89 28,92 C38,95 45,90 56,92 C67,94 74,92 84,94 C90,95 96,93 100,94 L100,100 L0,100Z" fill="rgba(0,0,0,0.18)" />
        </svg>

        {/* LEFT */}
        <div style={{ position:'absolute', left:0, top:0, bottom:0, width:88, display:'flex', flexDirection:'column',
          justifyContent:'center', alignItems:'flex-start', padding:'0 0 0 11px', gap:0, zIndex:3 }}>
          <SkyLabel icon="🌅" label="Sunrise" time={sunrise || minsToLabel(srMin)} />
          <div style={{ width:52, height:1, background:'rgba(255,255,255,0.12)', margin:'4px 0' }} />
          <SkyLabel icon="🌇" label="Sunset" time={sunset || minsToLabel(ssMin)} dim />
        </div>

        {/* ARC canvas */}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none"
          style={{ position:'absolute', left:88, right:108, top:0, bottom:0,
            width:'calc(100% - 196px)', height:'100%', overflow:'visible', zIndex:2 }}>
          <defs>
            <linearGradient id="_skyArcS" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor="rgba(255,180,40,0)" />
              <stop offset="25%"  stopColor="rgba(255,190,50,0.7)" />
              <stop offset="75%"  stopColor="rgba(255,190,50,0.7)" />
              <stop offset="100%" stopColor="rgba(255,180,40,0)" />
            </linearGradient>
            <linearGradient id="_skyArcM" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor="rgba(140,160,255,0)" />
              <stop offset="25%"  stopColor="rgba(150,170,255,0.65)" />
              <stop offset="75%"  stopColor="rgba(150,170,255,0.65)" />
              <stop offset="100%" stopColor="rgba(140,160,255,0)" />
            </linearGradient>
            <clipPath id="_arcSunClip"><rect x="0" y="0" width={sunClipW}  height="100%" /></clipPath>
            <clipPath id="_arcMoonClip"><rect x="0" y="0" width={moonClipW} height="100%" /></clipPath>
          </defs>

          {/* Ghost arc */}
          <path d="M0,100 Q50,5 100,100" fill="none" stroke="rgba(255,255,255,0.10)"
            strokeWidth="0.9" strokeDasharray="2.8 2.2" />

          {/* Sun arc */}
          {showSun && (
            <path d="M0,100 Q50,5 100,100" fill="none"
              stroke="url(#_skyArcS)" strokeWidth="1.6" clipPath="url(#_arcSunClip)" />
          )}

          {/* Moon arc */}
          {showMoon && !showSun && (
            <path d="M0,100 Q50,5 100,100" fill="none"
              stroke="url(#_skyArcM)" strokeWidth="1.6" clipPath="url(#_arcMoonClip)" />
          )}

          {/* Sun body */}
          {showSun && (
            <g className="_sky-sun" transform={`translate(${sunPos.x},${sunPos.y})`}>
              <circle r="10"  fill="rgba(255,200,50,0.10)" />
              <circle r="6.5" fill="rgba(255,200,50,0.20)" />
              <circle r="4.2" fill="#ffdf40" />
              <circle r="2.8" fill="#fff8c0" />
            </g>
          )}

          {/* Moon body */}
          {showMoon && (
            <g className="_sky-moon" transform={`translate(${moonPos.x},${moonPos.y})`}>
              <circle r="9"   fill="rgba(180,200,255,0.08)" />
              <circle r="6"   fill="rgba(170,190,255,0.18)" />
              <circle r="4"   fill="#c8d4f8" />
              <circle r="3.2" cx="1.4" cy="-0.6" fill="rgba(30,40,90,0.58)" />
            </g>
          )}

          {/* Greeting */}
          <text x="50" y="55" textAnchor="middle" fill="rgba(255,255,255,0.5)"
            fontSize="7" fontWeight="700" fontFamily="system-ui,-apple-system,sans-serif"
            letterSpacing="0.04em">
            {GREETINGS[phase]}
          </text>

          {/* Now dot */}
          <circle cx="50" cy="100" r="3" fill="#f5c030">
            <animate attributeName="r" values="2.8;4.2;2.8" dur="3s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.85;1;0.85" dur="3s" repeatCount="indefinite" />
          </circle>
          <text x="50" y="95" textAnchor="middle" fill="rgba(245,192,48,0.8)"
            fontSize="5.5" fontWeight="800" fontFamily="system-ui,-apple-system,sans-serif"
            letterSpacing="0.06em">Now</text>
        </svg>

        {/* RIGHT */}
        <div style={{ position:'absolute', right:0, top:0, bottom:0, width:108, display:'flex',
          flexDirection:'column', justifyContent:'center', alignItems:'flex-end',
          padding:'0 11px 0 0', gap:0, zIndex:3 }}>

          {/* Moonrise row with dot */}
          <div style={{ display:'flex', alignItems:'center', gap:5, justifyContent:'flex-end' }}>
            <div style={{ textAlign:'right' }}>
              <div style={{ display:'flex', alignItems:'center', gap:3, justifyContent:'flex-end' }}>
                <span style={{ fontSize:8, fontWeight:700, color:'rgba(255,255,255,0.45)', letterSpacing:'0.04em' }}>Moonrise</span>
                <span style={{ fontSize:10 }}>🌙</span>
              </div>
              <div style={{ fontSize:12.5, fontWeight:800, color:'rgba(255,255,255,0.82)',
                fontFamily:'system-ui,-apple-system,sans-serif', letterSpacing:'-0.01em', lineHeight:1.1 }}>
                {moonrise || minsToLabel(mrMin)}
              </div>
            </div>
            <div style={{ width:5, height:5, borderRadius:'50%',
              background:'rgba(255,255,255,0.2)', border:'1px solid rgba(255,255,255,0.12)', flexShrink:0 }} />
          </div>

          <div style={{ width:72, height:1, background:'rgba(255,255,255,0.12)', margin:'4px 0', alignSelf:'flex-end' }} />

          {/* Countdown */}
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:8.5, fontWeight:700, color:'rgba(255,255,255,0.4)',
              letterSpacing:'0.04em', lineHeight:1 }}>
              {countdown.label}
            </div>
            <div style={{ fontSize:17, fontWeight:900, lineHeight:1.15, marginTop:1,
              color:countdown.color, fontFamily:'system-ui,-apple-system,sans-serif', letterSpacing:'-0.02em' }}>
              {fmtCountdown(countdown.diff)}
            </div>
          </div>
        </div>

        {/* Glass sheen */}
        <div style={{ position:'absolute', inset:0, borderRadius:20, pointerEvents:'none',
          background:'linear-gradient(to bottom,rgba(255,255,255,0.04) 0%,transparent 45%,rgba(0,0,0,0.22) 100%)' }} />

        {/* Border */}
        <div style={{ position:'absolute', inset:0, borderRadius:20, pointerEvents:'none',
          border:'1px solid rgba(255,255,255,0.09)' }} />
      </div>
    </>
  )
}