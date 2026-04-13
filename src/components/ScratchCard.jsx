import { useState, useEffect, useRef } from 'react'

/* ═══════════════════════════════════════════════════════════════
   ACR MAX — Gold Scratch Card Component
   Canvas-based scratch · Gold/silver premium design
   Coins are virtual tokens with no monetary value
═══════════════════════════════════════════════════════════════ */

const REVEAL_THRESHOLD = 55 // % scratched to auto-reveal

export default function ScratchCard({ reward, onScratched, scratched, t = {} }) {
  const canvasRef  = useRef(null)
  const drawing    = useRef(false)
  const [pct, setPct] = useState(0)
  const W = 300, H = 230

  /* Draw gold/silver overlay on mount */
  useEffect(() => {
    if (scratched) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    // Gold-silver metallic gradient
    const grd = ctx.createLinearGradient(0, 0, W, H)
    grd.addColorStop(0,   '#6a6a6a')
    grd.addColorStop(0.18,'#C0C0C0')
    grd.addColorStop(0.35,'#d4af37')
    grd.addColorStop(0.5, '#f4d03f')
    grd.addColorStop(0.65,'#d4af37')
    grd.addColorStop(0.82,'#C0C0C0')
    grd.addColorStop(1,   '#a87520')
    ctx.fillStyle = grd
    ctx.fillRect(0, 0, W, H)

    // Shine stripes
    for (let i = 0; i < 10; i++) {
      ctx.save()
      ctx.globalAlpha = 0.07
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      const x = (W * i) / 10
      ctx.moveTo(x, 0); ctx.lineTo(x + 18, 0); ctx.lineTo(x + 28, H); ctx.lineTo(x + 10, H)
      ctx.fill()
      ctx.restore()
    }

    // Pattern text overlay
    ctx.globalAlpha = 0.25
    ctx.fillStyle = '#3a2800'
    ctx.font = 'bold 12px Poppins, sans-serif'
    ctx.textAlign = 'center'
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        ctx.fillText('✦', 30 + c * 58, 30 + r * 44)
      }
    }
    ctx.globalAlpha = 1

    // Instruction text
    ctx.fillStyle = '#3a2800'
    ctx.globalAlpha = 0.6
    ctx.font = 'bold 14px Poppins, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('✦  SCRATCH HERE  ✦', W / 2, H / 2 + 6)
    ctx.globalAlpha = 1
  }, [scratched])

  /* Scratch at point */
  const scratchAt = (clientX, clientY) => {
    if (scratched) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx  = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    const x    = (clientX - rect.left) * (canvas.width / rect.width)
    const y    = (clientY - rect.top)  * (canvas.height / rect.height)

    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.arc(x, y, 30, 0, Math.PI * 2)
    ctx.fill()

    // Sample to estimate % revealed (check every ~20ms)
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    let transparent = 0
    for (let i = 3; i < data.length; i += 16) { // sample every 4th pixel
      if (data[i] < 128) transparent++
    }
    const p = Math.round((transparent / (canvas.width * canvas.height / 4)) * 100)
    setPct(Math.min(p, 100))
    if (p >= REVEAL_THRESHOLD && !scratched) onScratched()
  }

  const onTouchMove = (e) => {
    e.preventDefault()
    const t = e.touches[0]
    scratchAt(t.clientX, t.clientY)
  }
  const onMouseMove = (e) => { if (drawing.current) scratchAt(e.clientX, e.clientY) }

  return (
    <div style={{ width:'100%', maxWidth:300, margin:'0 auto', position:'relative' }}>

      {/* ── Reveal layer (behind canvas) ── */}
      <div style={{
        position: scratched ? 'relative' : 'absolute',
        inset: 0, borderRadius: 20, overflow:'hidden',
        background:'linear-gradient(135deg,#0d0b1e,#1a1a2e)',
        display:'flex', flexDirection:'column', alignItems:'center',
        justifyContent:'center', gap:10,
        height: scratched ? 230 : 'auto',
        border: '1px solid rgba(212,175,55,0.3)',
        boxShadow: '0 0 40px rgba(212,175,55,0.12), inset 0 0 60px rgba(212,175,55,0.05)',
      }}>
        {/* Glow border */}
        <div style={{ position:'absolute', inset:0, borderRadius:20, border:'1.5px solid rgba(212,175,55,0.35)' }}/>

        {/* Logo */}
        <img src="/logo.jpg" alt="ACR MAX"
          style={{ width:54, height:54, borderRadius:'50%',
            border:'2px solid rgba(212,175,55,0.55)',
            boxShadow:'0 0 24px rgba(212,175,55,0.45)', objectFit:'cover' }}/>

        {/* ACR MAX silver/gold text */}
        <p style={{
          fontFamily:'Syne,sans-serif', fontWeight:900, fontSize:22,
          letterSpacing:'0.1em', margin:'2px 0 0',
          background:'linear-gradient(135deg,#8a8a8a,#C0C0C0,#d4af37,#f4d03f,#c9922a)',
          WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text',
        }}>ACR MAX</p>

        {/* Slogan */}
        <p style={{ fontSize:9, color:'rgba(212,175,55,0.55)', fontFamily:'Poppins,sans-serif',
          letterSpacing:'0.18em', textTransform:'uppercase', margin:0 }}>Maximising Lifes</p>

        {/* Reward box */}
        <div style={{
          padding:'10px 28px', marginTop:4,
          background:'linear-gradient(135deg,rgba(212,175,55,0.14),rgba(212,175,55,0.07))',
          border:'1px solid rgba(212,175,55,0.4)', borderRadius:14,
          boxShadow:'0 0 28px rgba(212,175,55,0.2)',
        }}>
          <p style={{ fontFamily:'Syne,sans-serif', fontWeight:900, fontSize:32,
            color:'#f4d03f', margin:0, textShadow:'0 0 20px rgba(244,208,63,0.7)' }}>
            {reward} 💰
          </p>
        </div>

        {/* Signature */}
        <p style={{ fontSize:10, color:'rgba(255,255,255,0.18)', fontFamily:'cursive',
          margin:'4px 0 0', letterSpacing:'0.05em', fontStyle:'italic' }}>— Aswin CR</p>
      </div>

      {/* ── Scratch overlay canvas ── */}
      {!scratched && (
        <>
          <canvas
            ref={canvasRef} width={W} height={H}
            style={{ position:'relative', zIndex:1, width:'100%', height:H,
              borderRadius:20, cursor:'crosshair', touchAction:'none',
              display:'block', boxShadow:'0 8px 32px rgba(0,0,0,0.4)' }}
            onMouseDown={() => drawing.current = true}
            onMouseUp={()   => drawing.current = false}
            onMouseMove={onMouseMove}
            onTouchMove={onTouchMove}
            onTouchStart={() => {}}
            onTouchEnd={() => {}}
          />
          <p style={{ textAlign:'center', fontSize:10, color:'rgba(255,255,255,0.35)',
            fontFamily:'Poppins,sans-serif', marginTop:8 }}>
            {t.scratch || 'Scratch to reveal'} · {pct}%
          </p>
        </>
      )}
    </div>
  )
}