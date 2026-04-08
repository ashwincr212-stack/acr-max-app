import { useState, useEffect, useRef } from 'react'
import {
  loginUser, registerUser, getUserByUsername,
  updatePassword, usernameExists, ensureAdminExists
} from '../firebase'

const HINT_QUESTIONS = [
  "What was the name of your first pet?",
  "What is your mother's maiden name?",
  "What city were you born in?",
  "What was the name of your first school?",
  "What is your favourite childhood movie?",
  "What street did you grow up on?",
  "What was your childhood nickname?",
]

function ParticleField() {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let raf
    const mouse = { x: -999, y: -999 }
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    window.addEventListener('resize', resize)
    window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY })
    const particles = Array.from({ length: 90 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.28,
      vy: (Math.random() - 0.5) * 0.28,
      r: Math.random() * 1.6 + 0.3,
      opacity: Math.random() * 0.5 + 0.08,
      gold: Math.random() > 0.62,
    }))
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particles.forEach((p, i) => {
        particles.slice(i + 1).forEach(q => {
          const d = Math.hypot(p.x - q.x, p.y - q.y)
          if (d < 100) { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.strokeStyle = `rgba(212,175,55,${(1 - d/100)*0.1})`; ctx.lineWidth = 0.5; ctx.stroke() }
        })
        const md = Math.hypot(p.x - mouse.x, p.y - mouse.y)
        if (md < 120) { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(mouse.x, mouse.y); ctx.strokeStyle = `rgba(212,175,55,${(1 - md/120)*0.28})`; ctx.lineWidth = 0.6; ctx.stroke() }
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2)
        ctx.fillStyle = p.gold ? `rgba(212,175,55,${p.opacity})` : `rgba(255,255,255,${p.opacity})`
        ctx.fill()
        p.x += p.vx; p.y += p.vy
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1
      })
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [])
  return <canvas ref={canvasRef} style={{ position:'fixed', inset:0, zIndex:0, pointerEvents:'none' }} />
}

const iSt = (f, e) => ({
  width:'100%', padding:'13px 16px',
  background: f ? 'rgba(212,175,55,0.06)' : 'rgba(255,255,255,0.04)',
  border: f ? '1px solid rgba(212,175,55,0.65)' : e ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(255,255,255,0.1)',
  borderRadius:12, color:'#fff', fontSize:14,
  fontFamily:'Poppins,sans-serif', fontWeight:500, outline:'none',
  transition:'all 0.3s', boxShadow: f ? '0 0 0 3px rgba(212,175,55,0.1)' : 'none',
})
const Lbl = ({ t }) => <label style={{ display:'block', fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.38)', textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:6 }}>{t}</label>

// ── LOGIN ──
function LoginForm({ onLogin, onGoSignup, onGoForgot }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [f, setF] = useState(null)

  const doLogin = async () => {
    if (!username.trim() || !password.trim()) { setError('Please enter your credentials.'); return }
    setLoading(true); setError('')
    try {
      const user = await loginUser(username.trim(), password)
      setSuccess(true)
      await new Promise(r => setTimeout(r, 700))
      onLogin(user)
    } catch (e) {
      setError(e.message.includes('not found') || e.message.includes('password') ? 'Invalid username or password.' : 'Connection error. Check internet.')
      setLoading(false)
    }
  }

  return (
    <div style={{ animation:'fadeInUp 0.5s ease-out both' }}>
      {/* ── BIG APP LOGO + NAME — clear, prominent ── */}
      <div style={{ textAlign:'center', marginBottom:24 }}>
        {/* Logo image — large, clear */}
        <div style={{ display:'inline-block', marginBottom:14 }}>
          <img src="/logo.jpg" alt="ACR MAX" style={{ width:100, height:100, borderRadius:'50%', objectFit:'cover', border:'3px solid rgba(212,175,55,0.6)', boxShadow:'0 0 0 6px rgba(212,175,55,0.12), 0 12px 40px rgba(0,0,0,0.4)', display:'block' }} />
        </div>
        {/* App name */}
        <h1 style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:28, letterSpacing:'0.06em', margin:'0 0 4px', background:'linear-gradient(135deg,#e8e8e8 20%,#d4af37 50%,#f4d03f 70%,#c9922a)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>ACR MAX</h1>
        {/* Tagline */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginBottom:10 }}>
          <div style={{ height:1, width:28, background:'linear-gradient(90deg,transparent,rgba(212,175,55,0.5))' }} />
          <p style={{ fontSize:10, fontWeight:700, color:'rgba(212,175,55,0.8)', letterSpacing:'0.2em', textTransform:'uppercase', margin:0 }}>Maximizing Lifes</p>
          <div style={{ height:1, width:28, background:'linear-gradient(90deg,rgba(212,175,55,0.5),transparent)' }} />
        </div>
        {/* Beta badge */}
        <div style={{ display:'inline-flex', alignItems:'center', gap:5, background:'rgba(212,175,55,0.1)', border:'1px solid rgba(212,175,55,0.35)', borderRadius:20, padding:'4px 14px' }}>
          <div style={{ width:5, height:5, borderRadius:'50%', background:'#d4af37' }} />
          <span style={{ fontSize:9, fontWeight:800, color:'#d4af37', letterSpacing:'0.15em' }}>BETA 1.0 · TEST 1</span>
        </div>
      </div>

      <p style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:15, color:'#fff', marginBottom:3 }}>Welcome back</p>
      <p style={{ fontSize:12, color:'rgba(255,255,255,0.4)', marginBottom:20 }}>Sign in with your authorized credentials</p>

      <div style={{ marginBottom:12 }}>
        <Lbl t="Username" />
        <div style={{ position:'relative' }}>
          <span style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', fontSize:13, color: f==='u' ? '#d4af37' : 'rgba(255,255,255,0.2)', transition:'color 0.3s' }}>👤</span>
          <input value={username} onChange={e=>{setUsername(e.target.value);setError('')}} onFocus={()=>setF('u')} onBlur={()=>setF(null)} onKeyDown={e=>e.key==='Enter'&&doLogin()} placeholder="Enter username" autoComplete="username" style={{...iSt(f==='u',error),paddingLeft:40}} />
        </div>
      </div>

      <div style={{ marginBottom:18 }}>
        <Lbl t="Password" />
        <div style={{ position:'relative' }}>
          <span style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', fontSize:13, color: f==='p' ? '#d4af37' : 'rgba(255,255,255,0.2)', transition:'color 0.3s' }}>🔒</span>
          <input type={showPass?'text':'password'} value={password} onChange={e=>{setPassword(e.target.value);setError('')}} onFocus={()=>setF('p')} onBlur={()=>setF(null)} onKeyDown={e=>e.key==='Enter'&&doLogin()} placeholder="Enter password" autoComplete="current-password" style={{...iSt(f==='p',error),paddingLeft:40,paddingRight:44}} />
          <button onClick={()=>setShowPass(s=>!s)} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:14, color:'rgba(255,255,255,0.28)' }}>{showPass?'🙈':'👁'}</button>
        </div>
        <div style={{ textAlign:'right', marginTop:5 }}>
          <button onClick={onGoForgot} style={{ background:'none', border:'none', cursor:'pointer', fontSize:11, color:'rgba(212,175,55,0.55)', fontFamily:'Poppins,sans-serif', fontWeight:600 }}>Forgot password?</button>
        </div>
      </div>

      {error && <div style={{ background:'rgba(239,68,68,0.09)', border:'1px solid rgba(239,68,68,0.28)', borderRadius:10, padding:'9px 13px', marginBottom:12, display:'flex', alignItems:'center', gap:8, animation:'errorShake 0.4s ease-out' }}><span>⚠️</span><p style={{ fontSize:12, color:'#fca5a5', fontWeight:600, margin:0 }}>{error}</p></div>}
      {success && <div style={{ background:'rgba(52,211,153,0.09)', border:'1px solid rgba(52,211,153,0.28)', borderRadius:10, padding:'9px 13px', marginBottom:12, display:'flex', alignItems:'center', gap:8 }}><span>✅</span><p style={{ fontSize:12, color:'#6ee7b7', fontWeight:600, margin:0 }}>Access granted! Loading…</p></div>}

      <button onClick={doLogin} disabled={loading||success} className="login-btn" style={{ width:'100%', padding:'13px', border:'none', borderRadius:12, fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:14, color:'#0a0c14', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:9, marginBottom:14 }}>
        {loading ? <><div style={{ width:16, height:16, border:'2px solid rgba(0,0,0,0.2)', borderTop:'2px solid #0a0c14', borderRadius:'50%', animation:'spinLoad 0.7s linear infinite' }} />Authenticating…</> : success ? '✓ Access Granted' : '🔐 Sign In to ACR MAX'}
      </button>
      <div style={{ textAlign:'center' }}>
        <span style={{ fontSize:12, color:'rgba(255,255,255,0.3)' }}>New here? </span>
        <button onClick={onGoSignup} style={{ background:'none', border:'none', cursor:'pointer', fontSize:12, color:'#d4af37', fontWeight:700, fontFamily:'Poppins,sans-serif', textDecoration:'underline' }}>Create Account</button>
      </div>
    </div>
  )
}

// ── SIGNUP ──
function SignupForm({ onGoLogin, onSignupSuccess }) {
  const [form, setForm] = useState({ name:'', username:'', email:'', dob:'', password:'', confirm:'', hint_q:HINT_QUESTIONS[0], hint_a:'' })
  const [showP, setShowP] = useState(false)
  const [showC, setShowC] = useState(false)
  const [f, setF] = useState(null)
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [step, setStep] = useState(1)
  const [agreedBeta, setAgreedBeta] = useState(false)
  const s = (k, v) => setForm(x => ({...x, [k]:v}))

  const v1 = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Required'
    if (!form.dob) e.dob = 'Required'
    else if ((new Date() - new Date(form.dob)) / (365.25*24*3600*1000) < 10) e.dob = 'Must be 10+'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Valid email required'
    setErrors(e); return !Object.keys(e).length
  }

  const v2 = async () => {
    const e = {}
    if (form.username.length < 3) e.username = 'Min 3 chars'
    else if (await usernameExists(form.username.trim())) e.username = 'Username taken'
    if (form.password.length < 6) e.password = 'Min 6 chars'
    if (form.password !== form.confirm) e.confirm = 'No match'
    setErrors(e); return !Object.keys(e).length
  }

  const next = async () => {
    if (step===1 && v1()) setStep(2)
    else if (step===2) { setLoading(true); const ok = await v2(); setLoading(false); if(ok) setStep(3) }
  }

  const submit = async () => {
    if (!form.hint_a.trim()) { setErrors({hint_a:'Required'}); return }
    setLoading(true)
    try {
      const u = { username:form.username.trim().toLowerCase(), password:form.password, name:form.name.trim(), role:'Member', dob:form.dob, email:form.email.trim(), hint_q:form.hint_q, hint_a:form.hint_a.trim().toLowerCase(), createdAt:new Date().toISOString().slice(0,10) }
      await registerUser(u)
      setSuccess(true)
      await new Promise(r=>setTimeout(r,800))
      onSignupSuccess(u)
    } catch(e) { setErrors({hint_a:e.message}); setLoading(false) }
  }

  const steps = ['Personal','Credentials','Security']

  return (
    <div style={{ animation:'fadeInUp 0.5s ease-out both' }}>
      <div style={{ textAlign:'center', marginBottom:18 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:12, marginBottom:4 }}>
          <img src="/logo.jpg" alt="ACR MAX" style={{ width:56, height:56, borderRadius:'50%', objectFit:'cover', border:'2.5px solid rgba(212,175,55,0.55)', boxShadow:'0 0 0 4px rgba(212,175,55,0.1), 0 8px 24px rgba(0,0,0,0.35)', display:'block', flexShrink:0 }} />
          <div style={{ textAlign:'left' }}>
            <h1 style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:20, letterSpacing:'0.06em', margin:'0 0 2px', background:'linear-gradient(135deg,#e0e0e0,#d4af37,#f4d03f)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>ACR MAX</h1>
            <p style={{ fontSize:11, fontWeight:700, color:'#d4af37', margin:'0 0 2px', letterSpacing:'0.08em' }}>Create Account</p>
            <p style={{ fontSize:9, color:'rgba(255,255,255,0.4)', margin:0 }}>Syncs across all your devices</p>
          </div>
        </div>
      </div>

      <div style={{ display:'flex', alignItems:'center', marginBottom:20 }}>
        {steps.map((st,i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', flex:1 }}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flex:1 }}>
              <div style={{ width:24, height:24, borderRadius:'50%', background:i+1<=step?'linear-gradient(135deg,#d4af37,#f4d03f)':'rgba(255,255,255,0.08)', border:i+1===step?'2px solid #d4af37':'2px solid rgba(255,255,255,0.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800, color:i+1<=step?'#0a0c14':'rgba(255,255,255,0.3)', transition:'all 0.4s' }}>{i+1<step?'✓':i+1}</div>
              <p style={{ fontSize:8, fontWeight:700, color:i+1<=step?'#d4af37':'rgba(255,255,255,0.22)', marginTop:3, letterSpacing:'0.08em', textTransform:'uppercase' }}>{st}</p>
            </div>
            {i<steps.length-1 && <div style={{ height:1, flex:1, background:i+1<step?'#d4af37':'rgba(255,255,255,0.08)', margin:'0 4px', marginBottom:14, transition:'background 0.4s' }} />}
          </div>
        ))}
      </div>

      {step===1 && (
        <div style={{ animation:'fadeInUp 0.3s ease-out both' }}>
          <div style={{ marginBottom:10 }}><Lbl t="Full Name" /><input value={form.name} onChange={e=>s('name',e.target.value)} onFocus={()=>setF('n')} onBlur={()=>setF(null)} placeholder="e.g. Rahul Kumar" style={iSt(f==='n',errors.name)} />{errors.name && <p style={{ fontSize:10, color:'#f87171', marginTop:3 }}>{errors.name}</p>}</div>
          <div style={{ marginBottom:10 }}><Lbl t="Date of Birth" /><input type="date" value={form.dob} onChange={e=>s('dob',e.target.value)} style={{ ...iSt(false,errors.dob), colorScheme:'dark' }} />{errors.dob && <p style={{ fontSize:10, color:'#f87171', marginTop:3 }}>{errors.dob}</p>}</div>
          <div style={{ marginBottom:16 }}><Lbl t="Email ID" /><input type="email" value={form.email} onChange={e=>s('email',e.target.value)} onFocus={()=>setF('e')} onBlur={()=>setF(null)} placeholder="you@example.com" style={iSt(f==='e',errors.email)} />{errors.email && <p style={{ fontSize:10, color:'#f87171', marginTop:3 }}>{errors.email}</p>}</div>
          <button onClick={next} className="login-btn" style={{ width:'100%', padding:'12px', border:'none', borderRadius:12, fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:13, color:'#0a0c14', cursor:'pointer' }}>Continue →</button>
        </div>
      )}

      {step===2 && (
        <div style={{ animation:'fadeInUp 0.3s ease-out both' }}>
          <div style={{ marginBottom:10 }}><Lbl t="Username" /><input value={form.username} onChange={e=>s('username',e.target.value)} onFocus={()=>setF('u')} onBlur={()=>setF(null)} placeholder="Unique (min 3 chars)" style={iSt(f==='u',errors.username)} />{errors.username && <p style={{ fontSize:10, color:'#f87171', marginTop:3 }}>{errors.username}</p>}</div>
          <div style={{ marginBottom:10 }}>
            <Lbl t="Password" />
            <div style={{ position:'relative' }}><input type={showP?'text':'password'} value={form.password} onChange={e=>s('password',e.target.value)} onFocus={()=>setF('p')} onBlur={()=>setF(null)} placeholder="Min 6 characters" style={{...iSt(f==='p',errors.password),paddingRight:40}} /><button onClick={()=>setShowP(x=>!x)} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:13, color:'rgba(255,255,255,0.28)' }}>{showP?'🙈':'👁'}</button></div>
            {errors.password && <p style={{ fontSize:10, color:'#f87171', marginTop:3 }}>{errors.password}</p>}
            {form.password && <div style={{ display:'flex', gap:3, marginTop:5 }}>{[1,2,3,4].map(i=><div key={i} style={{ flex:1, height:3, borderRadius:3, background:form.password.length>=i*3?(form.password.length>=10?'#34d399':form.password.length>=7?'#fbbf24':'#f87171'):'rgba(255,255,255,0.08)', transition:'background 0.3s' }} />)}</div>}
          </div>
          <div style={{ marginBottom:16 }}>
            <Lbl t="Confirm Password" />
            <div style={{ position:'relative' }}><input type={showC?'text':'password'} value={form.confirm} onChange={e=>s('confirm',e.target.value)} onFocus={()=>setF('c')} onBlur={()=>setF(null)} placeholder="Re-enter" style={{...iSt(f==='c',errors.confirm),paddingRight:40}} /><button onClick={()=>setShowC(x=>!x)} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:13, color:'rgba(255,255,255,0.28)' }}>{showC?'🙈':'👁'}</button></div>
            {errors.confirm && <p style={{ fontSize:10, color:'#f87171', marginTop:3 }}>{errors.confirm}</p>}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={()=>setStep(1)} style={{ flex:1, padding:'12px', borderRadius:12, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.5)', fontWeight:700, cursor:'pointer', fontSize:13, fontFamily:'Poppins,sans-serif' }}>← Back</button>
            <button onClick={next} disabled={loading} className="login-btn" style={{ flex:2, padding:'12px', border:'none', borderRadius:12, fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:13, color:'#0a0c14', cursor:'pointer' }}>{loading?'Checking…':'Continue →'}</button>
          </div>
        </div>
      )}

      {step===3 && (
        <div style={{ animation:'fadeInUp 0.3s ease-out both' }}>
          <div style={{ background:'rgba(212,175,55,0.07)', border:'1px solid rgba(212,175,55,0.18)', borderRadius:10, padding:'10px 13px', marginBottom:14, display:'flex', gap:9 }}>
            <span style={{ fontSize:16, flexShrink:0 }}>🔐</span>
            <p style={{ fontSize:11, color:'rgba(212,175,55,0.8)', lineHeight:1.6, margin:0 }}>Set a security question for recovery. Your account syncs across all devices!</p>
          </div>
          <div style={{ marginBottom:10 }}><Lbl t="Security Question" /><select value={form.hint_q} onChange={e=>s('hint_q',e.target.value)} style={{ ...iSt(false,false), cursor:'pointer' }}>{HINT_QUESTIONS.map(q=><option key={q} value={q} style={{ background:'#0d0b2e' }}>{q}</option>)}</select></div>
          <div style={{ marginBottom:16 }}><Lbl t="Your Answer" /><input value={form.hint_a} onChange={e=>s('hint_a',e.target.value)} placeholder="Case-insensitive" style={iSt(false,errors.hint_a)} />{errors.hint_a && <p style={{ fontSize:10, color:'#f87171', marginTop:3 }}>{errors.hint_a}</p>}</div>
          {success && <div style={{ background:'rgba(52,211,153,0.09)', border:'1px solid rgba(52,211,153,0.28)', borderRadius:10, padding:'9px 13px', marginBottom:12, display:'flex', alignItems:'center', gap:8 }}><span>✅</span><p style={{ fontSize:12, color:'#6ee7b7', fontWeight:600, margin:0 }}>Account created!</p></div>}
          {/* ── BETA AGREEMENT — must acknowledge ── */}
          {!success && (
            <div style={{ background:'rgba(212,175,55,0.06)', border:'1px solid rgba(212,175,55,0.2)', borderRadius:12, padding:'12px 14px', marginBottom:14 }}>
              <p style={{ fontSize:10, fontWeight:700, color:'rgba(212,175,55,0.9)', margin:'0 0 8px', letterSpacing:'0.08em', textTransform:'uppercase' }}>📋 Beta Agreement</p>
              <p style={{ fontSize:11, color:'rgba(255,255,255,0.55)', lineHeight:1.65, margin:'0 0 10px' }}>
                ACR MAX is currently in <strong style={{ color:'#d4af37' }}>Beta Test 1</strong>. By creating an account you acknowledge that:<br />
                • This is a test version and may have bugs or limited features<br />
                • Your data is stored securely on Google Firebase<br />
                • All intellectual property belongs to <strong style={{ color:'#d4af37' }}>Aswin C R</strong><br />
                • You agree to report issues and not misuse the platform
              </p>
              <label style={{ display:'flex', alignItems:'flex-start', gap:10, cursor:'pointer' }}>
                <input type="checkbox" checked={agreedBeta} onChange={e=>setAgreedBeta(e.target.checked)} style={{ width:16, height:16, marginTop:1, accentColor:'#d4af37', flexShrink:0, cursor:'pointer' }} />
                <span style={{ fontSize:11, fontWeight:600, color:'rgba(255,255,255,0.75)', lineHeight:1.5 }}>
                  I have read and agree to the Beta Test Agreement and <strong style={{ color:'#d4af37' }}>Terms of Service</strong>
                </span>
              </label>
            </div>
          )}

          <div style={{ display:'flex', gap:8 }}>
            <button onClick={()=>setStep(2)} style={{ flex:1, padding:'12px', borderRadius:12, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.5)', fontWeight:700, cursor:'pointer', fontSize:13, fontFamily:'Poppins,sans-serif' }}>← Back</button>
            <button onClick={submit} disabled={loading||success||!agreedBeta} className="login-btn" style={{ flex:2, padding:'12px', border:'none', borderRadius:12, fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:13, color:'#0a0c14', cursor: (!agreedBeta||loading||success)?'not-allowed':'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:7, opacity:(!agreedBeta&&!loading&&!success)?0.5:1 }}>
              {loading?<><div style={{ width:15, height:15, border:'2px solid rgba(0,0,0,0.2)', borderTop:'2px solid #0a0c14', borderRadius:'50%', animation:'spinLoad 0.7s linear infinite' }} />Creating Account…</>:success?'✓ Account Created!':'Create Account'}
            </button>
          </div>
        </div>
      )}

      <div style={{ textAlign:'center', marginTop:12 }}>
        <span style={{ fontSize:11, color:'rgba(255,255,255,0.28)' }}>Have an account? </span>
        <button onClick={onGoLogin} style={{ background:'none', border:'none', cursor:'pointer', fontSize:11, color:'#d4af37', fontWeight:700, fontFamily:'Poppins,sans-serif', textDecoration:'underline' }}>Sign In</button>
      </div>
    </div>
  )
}

// ── FORGOT ──
function ForgotForm({ onGoLogin }) {
  const [step, setStep] = useState(1)
  const [username, setUsername] = useState('')
  const [answer, setAnswer] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [foundUser, setFoundUser] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [f, setF] = useState(null)
  const [showN, setShowN] = useState(false)

  const find = async () => {
    setLoading(true); setError('')
    try {
      const user = await getUserByUsername(username.trim())
      if (!user) { setError('No account found.'); setLoading(false); return }
      if (!user.hint_q) { setError('No recovery question. Contact admin.'); setLoading(false); return }
      setFoundUser(user); setStep(2)
    } catch { setError('Connection error.') }
    setLoading(false)
  }

  const verify = () => {
    if (answer.trim().toLowerCase() !== foundUser.hint_a) { setError('Incorrect answer.'); return }
    setError(''); setStep(3)
  }

  const reset = async () => {
    if (newPass.length < 6) { setError('Min 6 chars.'); return }
    if (newPass !== confirmPass) { setError('No match.'); return }
    setLoading(true)
    try {
      await updatePassword(foundUser.username, newPass)
      setSuccess(true)
      setTimeout(() => onGoLogin(), 1800)
    } catch { setError('Update failed.') }
    setLoading(false)
  }

  return (
    <div style={{ animation:'fadeInUp 0.5s ease-out both' }}>
      <div style={{ textAlign:'center', marginBottom:20 }}>
        <div style={{ fontSize:38, marginBottom:8 }}>🔑</div>
        <h2 style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:18, color:'#fff', margin:'0 0 3px' }}>Password Recovery</h2>
        <p style={{ fontSize:11, color:'rgba(255,255,255,0.3)', margin:0 }}>Verify your identity to reset</p>
      </div>
      <div style={{ display:'flex', justifyContent:'center', gap:7, marginBottom:20 }}>
        {[1,2,3].map(i => <div key={i} style={{ width:i===step?22:8, height:8, borderRadius:4, background:i<=step?'#d4af37':'rgba(255,255,255,0.1)', transition:'all 0.4s' }} />)}
      </div>

      {step===1 && (
        <div>
          <div style={{ marginBottom:12 }}><Lbl t="Username" /><input value={username} onChange={e=>{setUsername(e.target.value);setError('')}} onFocus={()=>setF('u')} onBlur={()=>setF(null)} placeholder="Enter your username" style={iSt(f==='u',error)} onKeyDown={e=>e.key==='Enter'&&find()} />{error && <p style={{ fontSize:11, color:'#f87171', marginTop:4 }}>{error}</p>}</div>
          <button onClick={find} disabled={loading} className="login-btn" style={{ width:'100%', padding:'12px', border:'none', borderRadius:12, fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:13, color:'#0a0c14', cursor:'pointer', marginBottom:10 }}>{loading?'Searching…':'Find Account →'}</button>
        </div>
      )}
      {step===2 && foundUser && (
        <div>
          <div style={{ background:'rgba(212,175,55,0.07)', border:'1px solid rgba(212,175,55,0.2)', borderRadius:10, padding:'11px 13px', marginBottom:12 }}>
            <p style={{ fontSize:10, color:'rgba(212,175,55,0.8)', fontWeight:700, margin:'0 0 3px' }}>Security Question</p>
            <p style={{ fontSize:13, color:'#fff', fontWeight:700, margin:0 }}>{foundUser.hint_q}</p>
          </div>
          <div style={{ marginBottom:12 }}><Lbl t="Your Answer" /><input value={answer} onChange={e=>{setAnswer(e.target.value);setError('')}} onFocus={()=>setF('a')} onBlur={()=>setF(null)} placeholder="Type answer" style={iSt(f==='a',error)} onKeyDown={e=>e.key==='Enter'&&verify()} />{error && <p style={{ fontSize:11, color:'#f87171', marginTop:4 }}>{error}</p>}</div>
          <button onClick={verify} className="login-btn" style={{ width:'100%', padding:'12px', border:'none', borderRadius:12, fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:13, color:'#0a0c14', cursor:'pointer', marginBottom:10 }}>Verify →</button>
        </div>
      )}
      {step===3 && (
        <div>
          <div style={{ marginBottom:10 }}><Lbl t="New Password" /><div style={{ position:'relative' }}><input type={showN?'text':'password'} value={newPass} onChange={e=>{setNewPass(e.target.value);setError('')}} onFocus={()=>setF('n')} onBlur={()=>setF(null)} placeholder="Min 6 chars" style={{...iSt(f==='n',error),paddingRight:40}} /><button onClick={()=>setShowN(x=>!x)} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:13, color:'rgba(255,255,255,0.28)' }}>{showN?'🙈':'👁'}</button></div></div>
          <div style={{ marginBottom:12 }}><Lbl t="Confirm" /><input type="password" value={confirmPass} onChange={e=>{setConfirmPass(e.target.value);setError('')}} onFocus={()=>setF('c')} onBlur={()=>setF(null)} placeholder="Re-enter" style={iSt(f==='c',error)} />{error && <p style={{ fontSize:11, color:'#f87171', marginTop:4 }}>{error}</p>}</div>
          {success ? <div style={{ background:'rgba(52,211,153,0.09)', border:'1px solid rgba(52,211,153,0.28)', borderRadius:10, padding:'11px', textAlign:'center' }}><p style={{ fontSize:13, color:'#6ee7b7', fontWeight:700, margin:0 }}>✅ Reset! Redirecting…</p></div>
            : <button onClick={reset} disabled={loading} className="login-btn" style={{ width:'100%', padding:'12px', border:'none', borderRadius:12, fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:13, color:'#0a0c14', cursor:'pointer', marginBottom:10 }}>{loading?'Saving…':'🔐 Reset Password'}</button>}
        </div>
      )}
      <div style={{ textAlign:'center', marginTop:10 }}>
        <button onClick={onGoLogin} style={{ background:'none', border:'none', cursor:'pointer', fontSize:11, color:'rgba(212,175,55,0.55)', fontFamily:'Poppins,sans-serif', fontWeight:600 }}>← Back to Sign In</button>
      </div>
    </div>
  )
}

// ── DISCLAIMER ──
function DisclaimerModal({ onClose }) {
  const [read, setRead] = useState(false)
  const sections = [
    { icon:'🧪', title:'Beta Release', body:'ACR MAX 1.0 is a beta release for testing. Features may evolve.' },
    { icon:'⚖️', title:'Intellectual Property', body:'Designed & developed by Aswin CR. All rights reserved. Unauthorized use prohibited.' },
    { icon:'🔒', title:'Data Protection', body:'All data handled with strict confidentiality via Firebase security.' },
    { icon:'🛡️', title:'Data Usage', body:'Data used only to enhance app experience. Never sold or shared.' },
    { icon:'✅', title:'User Agreement', body:'By signing in you agree to these terms and all future updates.' },
  ]
  return (
    <div style={{ position:'fixed', inset:0, zIndex:300, background:'rgba(0,0,0,0.88)', backdropFilter:'blur(14px)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ width:'100%', maxWidth:480, maxHeight:'88vh', background:'linear-gradient(135deg,rgba(10,16,44,0.98),rgba(4,8,22,0.98))', border:'1px solid rgba(212,175,55,0.28)', borderRadius:20, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ height:3, background:'linear-gradient(90deg,transparent,#d4af37,#f4d03f,#d4af37,transparent)', flexShrink:0 }} />
        <div style={{ padding:'16px 20px 10px', borderBottom:'1px solid rgba(255,255,255,0.05)', flexShrink:0, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ display:'flex', alignItems:'center', gap:9 }}>
            <img src="/logo.jpg" alt="" style={{ width:28, height:28, borderRadius:'50%', objectFit:'cover', border:'1px solid rgba(212,175,55,0.35)' }} />
            <div><p style={{ fontFamily:'Syne,sans-serif', fontWeight:700, color:'#fff', fontSize:13, margin:0 }}>Beta Disclaimer</p><p style={{ fontSize:9, color:'rgba(212,175,55,0.55)', margin:0, fontWeight:600 }}>ACR MAX 1.0 · Legal</p></div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:7, color:'rgba(255,255,255,0.45)', fontSize:14, cursor:'pointer', width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
        </div>
        {!read && <p style={{ fontSize:10, color:'rgba(212,175,55,0.45)', padding:'6px 20px 0', fontWeight:600 }}>📜 Scroll to bottom to acknowledge</p>}
        <div onScroll={e=>{const el=e.target;if(el.scrollTop+el.clientHeight>=el.scrollHeight-10)setRead(true)}} style={{ flex:1, overflowY:'auto', padding:'12px 20px' }}>
          {sections.map((s,i) => (
            <div key={i} style={{ marginBottom:12, padding:'10px 12px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.05)', borderLeft:'3px solid rgba(212,175,55,0.4)', borderRadius:9 }}>
              <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:4 }}><span style={{ fontSize:14 }}>{s.icon}</span><p style={{ fontFamily:'Syne,sans-serif', fontWeight:700, color:'#d4af37', fontSize:12, margin:0 }}>{s.title}</p></div>
              <p style={{ fontSize:11, color:'rgba(255,255,255,0.5)', lineHeight:1.65, margin:0 }}>{s.body}</p>
            </div>
          ))}
          <div style={{ textAlign:'center', padding:'8px 0 3px', borderTop:'1px solid rgba(255,255,255,0.05)' }}>
            <p style={{ fontFamily:'Cinzel,sans-serif', fontSize:11, color:'#d4af37', fontWeight:600, marginBottom:2 }}>ACR MAX 1.0</p>
            <p style={{ fontSize:10, color:'rgba(255,255,255,0.22)' }}>© 2026 ACR MAX · <span style={{ color:'rgba(212,175,55,0.5)' }}>Aswin CR</span></p>
          </div>
        </div>
        <div style={{ padding:'10px 20px', borderTop:'1px solid rgba(255,255,255,0.05)', flexShrink:0, display:'flex', gap:8 }}>
          <button onClick={onClose} style={{ flex:1, padding:'10px', borderRadius:10, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.45)', fontWeight:700, cursor:'pointer', fontFamily:'Poppins,sans-serif', fontSize:12 }}>Close</button>
          <button onClick={onClose} disabled={!read} className={read?'login-btn':''} style={{ flex:2, padding:'10px', borderRadius:10, border:'none', background:read?undefined:'rgba(212,175,55,0.1)', color:read?'#0a0c14':'rgba(212,175,55,0.3)', fontWeight:800, cursor:read?'pointer':'not-allowed', fontFamily:'Syne,sans-serif', fontSize:12 }}>{read?'✓ Acknowledged':'📜 Scroll first'}</button>
        </div>
      </div>
    </div>
  )
}

// ── MAIN ──
export default function Login({ onLogin }) {
  const [view, setView] = useState('login')
  const [showDisclaimer, setShowDisclaimer] = useState(false)

  useEffect(() => {
    const saved = sessionStorage.getItem('acr_session')
    if (saved) { try { onLogin(JSON.parse(saved)) } catch {} }
    ensureAdminExists()
  }, [])

  const handleLogin = (user) => { sessionStorage.setItem('acr_session', JSON.stringify(user)); onLogin(user) }
  const handleSignup = (user) => { sessionStorage.setItem('acr_session', JSON.stringify(user)); onLogin(user) }

  return (
    <>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=Syne:wght@600;700;800&family=Cinzel:wght@600;700&display=swap');
      *{box-sizing:border-box;margin:0;padding:0;}
      html,body{height:100%;overflow:hidden;}
      @keyframes fadeInUp{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
      @keyframes fadeIn{from{opacity:0}to{opacity:1}}
      @keyframes scaleIn{from{opacity:0;transform:scale(0.9)}to{opacity:1;transform:scale(1)}}
      @keyframes goldGlow{0%,100%{text-shadow:0 0 16px rgba(212,175,55,0.4)}50%{text-shadow:0 0 40px rgba(212,175,55,0.85)}}
      @keyframes logoFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
      @keyframes orbitGold{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
      @keyframes spinLoad{to{transform:rotate(360deg)}}
      @keyframes errorShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
      @keyframes gridPulse{0%,100%{opacity:0.025}50%{opacity:0.055}}
      @keyframes scanMove{0%{top:0%}100%{top:100%}}
      
      input::placeholder{color:rgba(255,255,255,0.2)!important;}
      select option{background:#0d0b2e!important;}
      .login-btn{background:linear-gradient(135deg,#c9a227,#e8c230);transition:all 0.2s;border:none;}
      .login-btn:hover:not(:disabled){background:linear-gradient(135deg,#b8911f,#d4af37);box-shadow:0 6px 20px rgba(212,175,55,0.35);}
      .login-btn:active:not(:disabled){transform:scale(0.98);opacity:0.9;}
      .login-btn:disabled{opacity:0.55;cursor:not-allowed;}
      ::-webkit-scrollbar{width:3px;}
      ::-webkit-scrollbar-thumb{background:rgba(212,175,55,0.3);border-radius:3px;}
      @media(min-width:800px){.desk{display:flex!important;}.mob-prev{display:none!important;}}
    `}</style>

    <div style={{ position:'fixed', inset:0, zIndex:1000, background:'radial-gradient(ellipse at 25% 25%,#0b1738 0%,#04091a 45%,#020510 100%)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Poppins,sans-serif', overflow:'hidden' }}>
      <ParticleField />
      <div style={{ position:'absolute', inset:0, zIndex:1, pointerEvents:'none', backgroundImage:'linear-gradient(rgba(212,175,55,0.032) 1px,transparent 1px),linear-gradient(90deg,rgba(212,175,55,0.032) 1px,transparent 1px)', backgroundSize:'55px 55px', animation:'gridPulse 7s ease-in-out infinite' }} />
      <div style={{ position:'absolute', top:'-8%', left:'-4%', width:500, height:500, borderRadius:'50%', background:'radial-gradient(circle,rgba(212,175,55,0.07),transparent 65%)', zIndex:1, pointerEvents:'none' }} />
      <div style={{ position:'absolute', bottom:'-14%', right:'-4%', width:580, height:580, borderRadius:'50%', background:'radial-gradient(circle,rgba(20,50,140,0.12),transparent 65%)', zIndex:1, pointerEvents:'none' }} />
      <div style={{ position:'absolute', left:0, right:0, height:1, background:'linear-gradient(90deg,transparent,rgba(212,175,55,0.12),transparent)', animation:'scanMove 9s linear infinite', zIndex:2, pointerEvents:'none' }} />

      <div style={{ position:'relative', zIndex:10, display:'flex', gap:28, alignItems:'center', justifyContent:'center', width:'100%', maxWidth:980, padding:'16px' }}>

        {/* Desktop preview */}
        <div className="desk" style={{ display:'none', flex:'0 0 300px', flexDirection:'column', alignItems:'center', gap:12 }}>
          <img src="/main.jpg" alt="ACR MAX" style={{ width:'100%', borderRadius:16, border:'1px solid rgba(212,175,55,0.2)', boxShadow:'0 20px 60px rgba(0,0,0,0.5)', objectFit:'cover', animation:'fadeIn 1s ease-out 0.3s both' }} />
          <div style={{ textAlign:'center' }}>
            <p style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:10, color:'rgba(255,255,255,0.32)', letterSpacing:'0.08em', marginBottom:3 }}>CONCEPT, DESIGN &amp; DEVELOPMENT BY</p>
            <p style={{ fontFamily:'Cinzel,sans-serif', fontWeight:700, fontSize:15, color:'#d4af37', letterSpacing:'0.05em' }}>Aswin CR</p>
          </div>
        </div>

        {/* Auth card */}
        <div style={{ width:'100%', maxWidth:400, animation:'scaleIn 0.6s cubic-bezier(.34,1.1,.64,1) both' }}>
          <div style={{ background:'linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))', backdropFilter:'blur(28px)', WebkitBackdropFilter:'blur(28px)', borderRadius:20, border:'1px solid rgba(212,175,55,0.17)', boxShadow:'0 26px 70px rgba(0,0,0,0.55),inset 0 1px 0 rgba(255,255,255,0.07)', overflow:'hidden' }}>
            <div style={{ height:3, background:'linear-gradient(90deg,transparent,#d4af37,#f4d03f,#d4af37,transparent)' }} />
            <div style={{ padding: view==='signup' ? '20px 24px 16px' : '26px 26px 20px' }}>
              {view==='login'  && <LoginForm  onLogin={handleLogin} onGoSignup={()=>setView('signup')} onGoForgot={()=>setView('forgot')} />}
              {view==='signup' && <SignupForm  onGoLogin={()=>setView('login')} onSignupSuccess={handleSignup} />}
              {view==='forgot' && <ForgotForm  onGoLogin={()=>setView('login')} />}
              <div style={{ textAlign:'center', marginTop:12 }}>
                <button onClick={()=>setShowDisclaimer(true)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:10, color:'rgba(212,175,55,0.42)', fontWeight:600, textDecoration:'underline', fontFamily:'Poppins,sans-serif' }}>📋 Beta Disclaimer &amp; Legal Notice</button>
              </div>
            </div>
            {/* ── SECURITY CERTIFICATIONS & CREDITS ── */}
            <div style={{ padding:'16px 16px 18px', borderTop:'1px solid rgba(255,255,255,0.06)', background:'rgba(0,0,0,0.12)' }}>

              {/* Security header */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginBottom:14 }}>
                <div style={{ height:1, flex:1, background:'rgba(212,175,55,0.15)' }} />
                <p style={{ fontSize:9, fontWeight:800, color:'rgba(212,175,55,0.6)', textTransform:'uppercase', letterSpacing:'0.16em', margin:0, whiteSpace:'nowrap' }}>🔐 Security Certifications</p>
                <div style={{ height:1, flex:1, background:'rgba(212,175,55,0.15)' }} />
              </div>

              {/* 3x2 badge grid */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:7, marginBottom:10 }}>
                {[
                  { icon:'🔒', label:'SSL / TLS',  sub:'256-bit HTTPS',    color:'#34d399', bg:'rgba(52,211,153,0.07)',  border:'rgba(52,211,153,0.2)' },
                  { icon:'🛡️', label:'AES-256',    sub:'Military Cipher',  color:'#60a5fa', bg:'rgba(96,165,250,0.07)',  border:'rgba(96,165,250,0.2)' },
                  { icon:'🔥', label:'Firebase',   sub:'Google Cloud',     color:'#fbbf24', bg:'rgba(251,191,36,0.07)', border:'rgba(251,191,36,0.2)' },
                  { icon:'☁️', label:'Cloud Sync', sub:'Real-time',        color:'#38bdf8', bg:'rgba(56,189,248,0.07)', border:'rgba(56,189,248,0.2)' },
                  { icon:'🚫', label:'Zero Ads',   sub:'No Data Sold',     color:'#f87171', bg:'rgba(248,113,113,0.07)',border:'rgba(248,113,113,0.2)' },
                  { icon:'👁️', label:'Privacy',    sub:'No Tracking',      color:'#a78bfa', bg:'rgba(167,139,250,0.07)',border:'rgba(167,139,250,0.2)' },
                ].map((b,i) => (
                  <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, padding:'9px 4px', background:b.bg, border:`1px solid ${b.border}`, borderRadius:10 }}>
                    <span style={{ fontSize:18 }}>{b.icon}</span>
                    <p style={{ fontSize:9, fontWeight:700, color:b.color, margin:0, textAlign:'center', lineHeight:1.2 }}>{b.label}</p>
                    <p style={{ fontSize:7, color:`${b.color}70`, margin:0, textAlign:'center' }}>{b.sub}</p>
                  </div>
                ))}
              </div>

              {/* Trust statement */}
              <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:10, padding:'9px 12px', marginBottom:14, border:'1px solid rgba(255,255,255,0.06)' }}>
                <p style={{ fontSize:9, color:'rgba(255,255,255,0.4)', textAlign:'center', lineHeight:1.75, margin:0 }}>
                  Your data is encrypted with <strong style={{ color:'rgba(255,255,255,0.7)' }}>AES-256</strong> and stored securely on <strong style={{ color:'rgba(255,255,255,0.7)' }}>Google Firebase</strong>. We never sell, share, or misuse your personal information.
                </p>
              </div>

              {/* Divider */}
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                <div style={{ height:1, flex:1, background:'rgba(212,175,55,0.12)' }} />
                <p style={{ fontSize:9, fontWeight:800, color:'rgba(212,175,55,0.5)', textTransform:'uppercase', letterSpacing:'0.14em', margin:0, whiteSpace:'nowrap' }}>Built By</p>
                <div style={{ height:1, flex:1, background:'rgba(212,175,55,0.12)' }} />
              </div>

              {/* Developer credit */}
              <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 12px', background:'rgba(212,175,55,0.06)', border:'1px solid rgba(212,175,55,0.15)', borderRadius:12, marginBottom:10 }}>
                <div style={{ width:38, height:38, borderRadius:'50%', background:'linear-gradient(135deg,#d4af37,#b8860b)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:800, color:'#0a0c14', flexShrink:0, fontFamily:'Syne,sans-serif' }}>A</div>
                <div>
                  <p style={{ fontSize:8, fontWeight:700, color:'rgba(212,175,55,0.55)', textTransform:'uppercase', letterSpacing:'0.12em', margin:'0 0 2px' }}>Concept · Design · Development</p>
                  <p style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:14, color:'#d4af37', margin:'0 0 1px' }}>Aswin C R</p>
                  <p style={{ fontSize:9, color:'rgba(255,255,255,0.4)', margin:0 }}>Founder · Full Stack Developer · UI/UX Designer</p>
                </div>
              </div>

              {/* Copyright */}
              <p style={{ fontSize:8, color:'rgba(255,255,255,0.18)', textAlign:'center', lineHeight:1.7, margin:0 }}>
                © 2026 ACR MAX. All rights reserved.<br/>
                Unauthorized reproduction or distribution strictly prohibited.<br/>
                All IP rights belong to <span style={{ color:'rgba(212,175,55,0.4)', fontWeight:700 }}>Aswin C R</span>.
              </p>
            </div>
          </div>

          {/* Mobile app preview */}
          <div className="mob-prev" style={{ marginTop:10, borderRadius:10, overflow:'hidden', border:'1px solid rgba(212,175,55,0.1)', opacity:0.55 }}>
            <img src="/main.jpg" alt="ACR MAX" style={{ width:'100%', display:'block', objectFit:'cover', height:70, objectPosition:'top' }} />
          </div>
        </div>
      </div>

      {showDisclaimer && <DisclaimerModal onClose={()=>setShowDisclaimer(false)} />}
    </div>
    </>
  )
}