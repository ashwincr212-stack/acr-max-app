import { useState, useEffect, useRef } from 'react'
import { db } from '../firebase'
import {
  doc, getDoc, setDoc, serverTimestamp
} from 'firebase/firestore'

/* ═══════════════════════════════════════════════
   ACR MAX — Mystery Box v2
   4-hour cooldown · 3 spins · Premium glassmorphism
   Skill-based game · Coins = virtual, no money value
═══════════════════════════════════════════════ */

const MAX_SPINS    = 3
const COOLDOWN_MS  = 4 * 60 * 60 * 1000  // 4 hours

/* Strictly controlled rewards only */
const REWARDS = [
  { label:'5',   coins:5,   color:'#64748B', weight:50 },
  { label:'10',  coins:10,  color:'#0EA5E9', weight:30 },
  { label:'50',  coins:50,  color:'#8B5CF6', weight:15 },
  { label:'100', coins:100, color:'#F59E0B', weight:5  },
]

/* Weighted pick — pure math, no boosters */
function pickReward() {
  const total = REWARDS.reduce((s,r)=>s+r.weight,0)
  let rand = Math.random() * total
  for (const r of REWARDS) { rand -= r.weight; if (rand <= 0) return r }
  return REWARDS[0]
}

/* Strip undefined — Firestore safety */
function clean(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([,v])=>v!==undefined&&v!==null))
}

/* ═══ SPIN WHEEL CANVAS ═══ */
const WHEEL_COLORS = ['#1E40AF','#7C3AED','#0369A1','#6D28D9','#1D4ED8','#5B21B6','#2563EB','#4C1D95']

function SpinWheel({ spinning, targetIdx, onSpinEnd, size = 240 }) {
  const canvasRef = useRef(null)
  const rotRef    = useRef(0)
  const animRef   = useRef(null)
  const segments  = REWARDS.length
  const segAngle  = 360 / segments

  // Draw wheel
  const drawWheel = (rotation = 0) => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    const cx = size/2, cy = size/2, r = size/2 - 6
    ctx.clearRect(0,0,size,size)

    REWARDS.forEach((seg, i) => {
      const start = ((i * segAngle + rotation) - 90) * Math.PI/180
      const end   = (((i+1) * segAngle + rotation) - 90) * Math.PI/180

      // Segment
      ctx.beginPath()
      ctx.moveTo(cx,cy)
      ctx.arc(cx,cy,r,start,end)
      ctx.closePath()
      ctx.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length]
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'
      ctx.lineWidth = 2
      ctx.stroke()

      // Label
      ctx.save()
      ctx.translate(cx,cy)
      ctx.rotate((start+end)/2)
      ctx.textAlign = 'right'
      ctx.fillStyle = '#fff'
      ctx.font = `bold ${size > 200 ? 13 : 11}px Poppins,sans-serif`
      ctx.shadowColor = 'rgba(0,0,0,0.5)'
      ctx.shadowBlur = 3
      ctx.fillText(seg.coins+'💰', r-14, 5)
      ctx.restore()
    })

    // Outer ring
    ctx.beginPath()
    ctx.arc(cx,cy,r,0,Math.PI*2)
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'
    ctx.lineWidth = 3
    ctx.stroke()

    // Center
    ctx.beginPath()
    ctx.arc(cx,cy,26,0,Math.PI*2)
    const grad = ctx.createRadialGradient(cx,cy,4,cx,cy,26)
    grad.addColorStop(0,'#1e40af')
    grad.addColorStop(1,'#0f172a')
    ctx.fillStyle = grad
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.font = '16px serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('🎯',cx,cy)
  }

  useEffect(() => { drawWheel(0) }, [])

  useEffect(() => {
    if (!spinning || targetIdx < 0) return
    cancelAnimationFrame(animRef.current)

    const from    = rotRef.current % 360
    const target  = (360 - (targetIdx * segAngle + segAngle/2 - 270) % 360) % 360
    const extra   = 1440 + target  // 4 full spins + land on target
    const dur     = 3500
    const t0      = performance.now()

    const animate = (now) => {
      const p    = Math.min((now - t0) / dur, 1)
      const ease = 1 - Math.pow(1 - p, 4)
      const rot  = from + extra * ease
      rotRef.current = rot
      drawWheel(rot)
      if (p < 1) animRef.current = requestAnimationFrame(animate)
      else { rotRef.current = rot % 360; onSpinEnd?.() }
    }
    animRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animRef.current)
  }, [spinning])

  return (
    <div style={{ position:'relative', display:'inline-block' }}>
      {/* Pointer */}
      <div style={{ position:'absolute', top:-4, left:'50%', transform:'translateX(-50%)', zIndex:10, fontSize:20,
        filter:'drop-shadow(0 2px 4px rgba(0,0,0,0.5))', color:'#F59E0B' }}>▼</div>
      <canvas ref={canvasRef} width={size} height={size}
        style={{ borderRadius:'50%', boxShadow:'0 0 40px rgba(99,102,241,0.5), 0 8px 32px rgba(0,0,0,0.4)', display:'block' }}/>
    </div>
  )
}

/* ═══ TOAST ═══ */
function Toast({ msg, onDone }) {
  useEffect(()=>{ const t=setTimeout(onDone,2800); return ()=>clearTimeout(t) },[])
  return (
    <div style={{ position:'fixed', bottom:100, left:'50%', transform:'translateX(-50%)', zIndex:1100,
      padding:'12px 24px', background:'linear-gradient(135deg,#1e40af,#7c3aed)',
      borderRadius:40, boxShadow:'0 8px 32px rgba(99,102,241,0.5)',
      animation:'toastIn 0.4s cubic-bezier(.34,1.56,.64,1)' }}>
      <p style={{ fontFamily:'Poppins,sans-serif', fontWeight:800, fontSize:15, color:'#fff', margin:0 }}>{msg}</p>
    </div>
  )
}

/* ═══ MAIN MYSTERY BOX MODAL ═══ */
export function MysteryBoxModal({ userId, isOpen, onClose, onReward }) {
  const [spinsUsed, setSpinsUsed]   = useState(0)
  const [lastSpin,  setLastSpin]    = useState(null)
  const [cdStr,     setCdStr]       = useState('')
  const [locked,    setLocked]      = useState(false)
  const [spinning,  setSpinning]    = useState(false)
  const [targetIdx, setTargetIdx]   = useState(-1)
  const [reward,    setReward]      = useState(null)
  const [showReveal,setShowReveal]  = useState(false)
  const [loading,   setLoading]     = useState(true)
  const [toast,     setToast]       = useState('')
  const timerRef = useRef(null)

  /* ── Load state from Firestore ── */
  const loadState = async () => {
    if (!userId) return
    setLoading(true)
    try {
      const ref  = doc(db, 'ipl_wallets', userId)
      const snap = await getDoc(ref)
      const mb   = snap.exists() ? (snap.data().mysteryBox || {}) : {}
      const used = mb.spinsUsed || 0
      const last = mb.lastSpinTime?.toDate?.() || null

      // Check if 4-hour cooldown has passed → reset
      if (last && (Date.now() - last.getTime()) >= COOLDOWN_MS) {
        // Reset — update Firestore
        await setDoc(ref, { mysteryBox: { spinsUsed:0, lastSpinTime: last } }, { merge:true })
        setSpinsUsed(0); setLastSpin(null); setLocked(false)
      } else {
        setSpinsUsed(used)
        setLastSpin(last)
        setLocked(used >= MAX_SPINS)
      }
    } catch(e) {
      console.error('MysteryBox load error:', e)
      setSpinsUsed(0); setLocked(false)
    }
    setLoading(false)
  }

  useEffect(() => { if (isOpen && userId) loadState() }, [isOpen, userId])

  /* ── Live countdown timer (1-second ticks) ── */
  useEffect(() => {
    clearInterval(timerRef.current)
    if (!locked || !lastSpin) { setCdStr(''); return }

    const tick = () => {
      const elapsed = Date.now() - lastSpin.getTime()
      const remaining = Math.max(0, COOLDOWN_MS - elapsed)
      if (remaining <= 0) {
        setCdStr(''); setLocked(false); setSpinsUsed(0); clearInterval(timerRef.current)
        loadState(); return
      }
      const h = Math.floor(remaining / 3600000)
      const m = Math.floor((remaining % 3600000) / 60000)
      const s = Math.floor((remaining % 60000) / 1000)
      setCdStr(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`)
    }
    tick()
    timerRef.current = setInterval(tick, 1000)
    return () => clearInterval(timerRef.current)
  }, [locked, lastSpin])

  /* ── Spin ── */
  const doSpin = () => {
    if (spinning || locked || loading || spinsUsed >= MAX_SPINS) return
    const picked = pickReward()
    const idx    = REWARDS.findIndex(r => r.label === picked.label)
    setReward(picked)
    setTargetIdx(idx)
    setSpinning(true)
    setShowReveal(false)
  }

  /* ── After spin animation ends ── */
  const onSpinEnd = async () => {
    setSpinning(false)
    setShowReveal(true)
    if (!reward || !userId) return

    const newUsed = spinsUsed + 1
    const now     = new Date()

    try {
      const walletRef = doc(db, 'ipl_wallets', userId)
      // Update mystery box state inside wallet doc (avoids permissions issue)
      await setDoc(walletRef, clean({
        mysteryBox: {
          spinsUsed: newUsed,
          lastSpinTime: serverTimestamp()
        },
        coins: reward.coins > 0
          ? (await getDoc(walletRef)).data()?.coins + reward.coins
          : undefined
      }), { merge: true })

      // Re-fetch coins properly
      const wSnap = await getDoc(walletRef)
      const cur   = wSnap.exists() ? (wSnap.data().coins || 500) : 500
      await setDoc(walletRef, { coins: cur + reward.coins }, { merge: true })

      setSpinsUsed(newUsed)
      setLastSpin(now)
      const willLock = newUsed >= MAX_SPINS
      setLocked(willLock)
      setToast(`🎉 You won ${reward.coins} coins!`)
      onReward?.({ coins: reward.coins })
    } catch(e) {
      console.error('Spin save error:', e)
      setToast(`⚠ Save error: ${e.message}`)
    }
  }

  if (!isOpen) return null

  const spinsLeft = Math.max(0, MAX_SPINS - spinsUsed)

  return (
    <>
    <style>{`
      @keyframes toastIn { 0%{opacity:0;transform:translateX(-50%) translateY(20px)} 100%{opacity:1;transform:translateX(-50%) translateY(0)} }
      @keyframes revealPop { 0%{opacity:0;transform:scale(0.6) rotate(-8deg)} 70%{transform:scale(1.08) rotate(2deg)} 100%{opacity:1;transform:scale(1) rotate(0)} }
      @keyframes glowPulse { 0%,100%{box-shadow:0 0 20px rgba(99,102,241,0.4)} 50%{box-shadow:0 0 40px rgba(99,102,241,0.8)} }
      @keyframes shimmer   { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
    `}</style>

    {toast && <Toast msg={toast} onDone={()=>setToast('')}/>}

    {/* Backdrop */}
    <div onClick={onClose} style={{ position:'fixed',inset:0,zIndex:810,background:'rgba(0,0,0,0.75)',backdropFilter:'blur(10px)' }}/>

    {/* Sheet */}
    <div style={{ position:'fixed',inset:0,zIndex:811,display:'flex',alignItems:'flex-end',justifyContent:'center',pointerEvents:'none' }}>
      <div style={{ width:'100%',maxWidth:480,pointerEvents:'all',
        background:'linear-gradient(180deg,rgba(15,23,42,0.97) 0%,rgba(30,27,75,0.99) 100%)',
        backdropFilter:'blur(24px)',
        borderRadius:'24px 24px 0 0',
        border:'1px solid rgba(99,102,241,0.3)',
        boxShadow:'0 -8px 48px rgba(99,102,241,0.25), inset 0 1px 0 rgba(255,255,255,0.08)',
        padding:'20px 20px 40px',
        maxHeight:'92vh', overflowY:'auto' }}>

        {/* Handle */}
        <div style={{ width:36,height:4,borderRadius:2,background:'rgba(255,255,255,0.2)',margin:'0 auto 18px'}}/>

        {/* Header */}
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:18 }}>
          <div>
            <p style={{ fontFamily:'Poppins,sans-serif',fontWeight:900,fontSize:20,color:'#fff',margin:'0 0 3px',letterSpacing:'-0.01em' }}>🎁 Mystery Box</p>
            <p style={{ fontSize:11,color:'rgba(255,255,255,0.45)',margin:0,fontFamily:'Poppins,sans-serif' }}>
              {loading ? 'Loading…' : locked ? `🔒 Resets in ${cdStr}` : `${spinsLeft} of ${MAX_SPINS} spins remaining`}
            </p>
          </div>
          <button onClick={onClose} style={{ width:32,height:32,borderRadius:10,background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.12)',color:'rgba(255,255,255,0.6)',fontSize:16,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>✕</button>
        </div>

        {/* Spin dots */}
        <div style={{ display:'flex',gap:8,justifyContent:'center',marginBottom:20 }}>
          {Array.from({length:MAX_SPINS}).map((_,i)=>(
            <div key={i} style={{ width:40,height:40,borderRadius:12,
              background: i < spinsLeft
                ? 'linear-gradient(135deg,#3B82F6,#8B5CF6)'
                : 'rgba(255,255,255,0.07)',
              border: i < spinsLeft
                ? '1px solid rgba(99,102,241,0.6)'
                : '1px solid rgba(255,255,255,0.08)',
              display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,
              boxShadow: i < spinsLeft ? '0 4px 12px rgba(99,102,241,0.35)' : 'none',
              transition:'all 0.3s' }}>
              {i < spinsLeft ? '🎯' : '✓'}
            </div>
          ))}
        </div>

        {/* Wheel */}
        <div style={{ display:'flex',justifyContent:'center',marginBottom:20 }}>
          {showReveal && reward ? (
            <div style={{ textAlign:'center',animation:'revealPop 0.5s cubic-bezier(.34,1.56,.64,1)' }}>
              <div style={{ width:100,height:100,borderRadius:'50%',margin:'0 auto 12px',
                background:`linear-gradient(135deg,${reward.color},${reward.color}80)`,
                display:'flex',alignItems:'center',justifyContent:'center',fontSize:40,
                boxShadow:`0 8px 32px ${reward.color}60` }}>💰</div>
              <p style={{ fontFamily:'Poppins,sans-serif',fontWeight:900,fontSize:36,color:'#fff',margin:'0 0 4px' }}>
                +{reward.coins}
              </p>
              <p style={{ fontSize:13,color:'rgba(255,255,255,0.55)',margin:'0 0 20px',fontFamily:'Poppins,sans-serif' }}>coins added to wallet!</p>
              <button onClick={()=>{setShowReveal(false);setReward(null)}} style={{ padding:'10px 28px',borderRadius:22,border:'none',background:'rgba(255,255,255,0.1)',color:'rgba(255,255,255,0.7)',fontFamily:'Poppins,sans-serif',fontWeight:700,fontSize:13,cursor:'pointer' }}>
                Continue
              </button>
            </div>
          ) : (
            <SpinWheel spinning={spinning} targetIdx={targetIdx} onSpinEnd={onSpinEnd} size={240}/>
          )}
        </div>

        {/* Spin button */}
        {!showReveal && (
          <>
            {locked ? (
              <div style={{ textAlign:'center' }}>
                <div style={{ padding:'16px',background:'rgba(255,255,255,0.05)',borderRadius:16,border:'1px solid rgba(255,255,255,0.08)',marginBottom:8 }}>
                  <p style={{ fontFamily:'Poppins,sans-serif',fontWeight:800,fontSize:14,color:'rgba(255,255,255,0.4)',margin:'0 0 6px' }}>🔒 You are out of spins</p>
                  <p style={{ fontFamily:'Poppins,sans-serif',fontSize:11,color:'rgba(255,255,255,0.3)',margin:'0 0 10px' }}>Resets automatically after 4 hours</p>
                  <div style={{ padding:'10px 20px',background:'rgba(0,0,0,0.3)',borderRadius:12,border:'1px solid rgba(255,255,255,0.07)',display:'inline-block' }}>
                    <p style={{ fontFamily:'monospace',fontWeight:900,fontSize:22,color:'#60A5FA',margin:0,letterSpacing:'0.05em' }}>⏳ {cdStr}</p>
                  </div>
                </div>
              </div>
            ) : (
              <button onClick={doSpin} disabled={spinning||loading}
                style={{ width:'100%',padding:'15px',borderRadius:14,border:'none',cursor:spinning?'not-allowed':'pointer',
                  fontFamily:'Poppins,sans-serif',fontWeight:900,fontSize:15,color:'#fff',
                  background: spinning ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg,#3B82F6,#8B5CF6)',
                  boxShadow: spinning ? 'none' : '0 6px 24px rgba(99,102,241,0.45)',
                  transition:'all 0.2s',
                  animation: !spinning && !loading ? 'glowPulse 2s ease-in-out infinite' : 'none' }}>
                {spinning ? '🌀 Spinning…' : `🎯 Spin Now (${spinsLeft} left)`}
              </button>
            )}
          </>
        )}

        {/* Reward guide */}
        {!showReveal && (
          <div style={{ marginTop:16,display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6 }}>
            {REWARDS.map((r,i)=>(
              <div key={i} style={{ textAlign:'center',padding:'8px 4px',background:'rgba(255,255,255,0.04)',borderRadius:10,border:'1px solid rgba(255,255,255,0.07)' }}>
                <p style={{ fontFamily:'Poppins,sans-serif',fontWeight:800,fontSize:14,color:'#fff',margin:'0 0 1px' }}>{r.coins}💰</p>
                <p style={{ fontSize:8,color:'rgba(255,255,255,0.3)',margin:0,fontFamily:'Poppins,sans-serif' }}>{r.weight}%</p>
              </div>
            ))}
          </div>
        )}

        {/* Disclaimer */}
        <p style={{ fontSize:9,color:'rgba(255,255,255,0.18)',textAlign:'center',margin:'14px 0 0',fontFamily:'Poppins,sans-serif',lineHeight:1.6 }}>
          Skill-based game · Coins are virtual tokens · No monetary value
        </p>
      </div>
    </div>
    </>
  )
}

/* ═══ MYSTERY BOX CARD (Home widget) ═══ */
export function MysteryBoxCard({ userId, onClick }) {
  const [spinsLeft, setSpinsLeft] = useState(MAX_SPINS)
  const [locked,    setLocked]    = useState(false)
  const [cdStr,     setCdStr]     = useState('')
  const timerRef = useRef(null)

  useEffect(()=>{
    if (!userId) return
    const load = async () => {
      try {
        const snap = await getDoc(doc(db,'ipl_wallets',userId))
        const mb   = snap.exists() ? (snap.data().mysteryBox||{}) : {}
        const used = mb.spinsUsed || 0
        const last = mb.lastSpinTime?.toDate?.() || null
        if (last && (Date.now()-last.getTime()) >= COOLDOWN_MS) {
          setSpinsLeft(MAX_SPINS); setLocked(false)
        } else {
          setSpinsLeft(Math.max(0,MAX_SPINS-used)); setLocked(used>=MAX_SPINS)
          if (used >= MAX_SPINS && last) startTimer(last)
        }
      } catch { setSpinsLeft(MAX_SPINS) }
    }
    load()
    return () => clearInterval(timerRef.current)
  },[userId])

  const startTimer = (last) => {
    clearInterval(timerRef.current)
    const tick = () => {
      const rem = Math.max(0, COOLDOWN_MS-(Date.now()-last.getTime()))
      if (rem===0){setLocked(false);setSpinsLeft(MAX_SPINS);clearInterval(timerRef.current);return}
      const h=Math.floor(rem/3600000),m=Math.floor((rem%3600000)/60000),s=Math.floor((rem%60000)/1000)
      setCdStr(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`)
    }
    tick(); timerRef.current=setInterval(tick,1000)
  }

  return (
    <button onClick={onClick} style={{ width:'100%',textAlign:'left',border:'none',padding:0,background:'none',cursor:'pointer' }}>
      <div style={{ padding:'12px 14px',
        background:'linear-gradient(135deg,rgba(15,23,42,0.95),rgba(30,27,75,0.98))',
        borderRadius:16,
        border:'1px solid rgba(99,102,241,0.35)',
        boxShadow:'0 4px 20px rgba(99,102,241,0.2), inset 0 1px 0 rgba(255,255,255,0.06)',
        position:'relative',overflow:'hidden',
        animation:'glowPulse 3s ease-in-out infinite',
        transition:'transform 0.2s' }}
        onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'}
        onMouseLeave={e=>e.currentTarget.style.transform='translateY(0)'}>

        {/* Shimmer sweep */}
        <div style={{ position:'absolute',top:0,left:0,right:0,bottom:0,
          background:'linear-gradient(105deg,transparent 40%,rgba(255,255,255,0.04) 50%,transparent 60%)',
          backgroundSize:'400px 100%',animation:'shimmer 3s ease-in-out infinite',
          pointerEvents:'none' }}/>

        <div style={{ display:'flex',alignItems:'center',gap:11,position:'relative' }}>
          <div style={{ width:42,height:42,borderRadius:13,
            background:'linear-gradient(135deg,#3B82F6,#8B5CF6)',
            display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0,
            boxShadow:'0 4px 14px rgba(99,102,241,0.5)' }}>🎁</div>
          <div style={{ flex:1,minWidth:0 }}>
            <p style={{ fontFamily:'Poppins,sans-serif',fontWeight:800,fontSize:13,color:'#fff',margin:'0 0 2px' }}>Mystery Box</p>
            <p style={{ fontSize:10,color:'rgba(255,255,255,0.45)',margin:0,fontFamily:'Poppins,sans-serif' }}>
              {locked ? `🔒 ${cdStr}` : 'Spin & win coins'}
            </p>
          </div>
          {/* Spin dots */}
          <div style={{ display:'flex',gap:4,flexShrink:0 }}>
            {Array.from({length:MAX_SPINS}).map((_,i)=>(
              <div key={i} style={{ width:9,height:9,borderRadius:3,
                background:i<spinsLeft?'#3B82F6':'rgba(255,255,255,0.1)',
                boxShadow:i<spinsLeft?'0 0 6px rgba(59,130,246,0.7)':'none',
                transition:'all 0.3s' }}/>
            ))}
          </div>
        </div>
      </div>
    </button>
  )
}