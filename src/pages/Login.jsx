import { useState, useEffect } from 'react'
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

/* ── Silver Milky Galaxy Canvas ── */
function GalaxyField() {
  return null
}

/* ── Disclaimer Modal ── */
function DisclaimerModal({ onClose, onAgree }) {
  const [hasAccepted, setHasAccepted] = useState(false)

  useEffect(() => {
    setHasAccepted(false)
  }, [])

  return (
    <div style={{ position:'fixed', inset:0, zIndex:300, background:'rgba(0,0,0,0.88)', backdropFilter:'blur(14px)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width:'100%', maxWidth:480, maxHeight:'88vh', background:'linear-gradient(135deg,rgba(10,16,44,0.98),rgba(4,8,22,0.98))', border:'1px solid rgba(212,175,55,0.28)', borderRadius:20, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ padding:'14px 18px 10px', borderBottom:'1px solid rgba(255,255,255,0.05)', flexShrink:0, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <p style={{ fontFamily:'Syne,sans-serif', fontWeight:800, color:'#d4af37', fontSize:14, margin:0 }}>📋 Beta Disclaimer & Legal Notice</p>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#9ca3af', fontSize:18, cursor:'pointer' }}>✕</button>
        </div>
        <div style={{ flex:1, maxHeight:'60vh', overflowY:'auto', padding:'12px 18px' }}>
          {[["Beta Software Notice","ACR MAX is currently in Beta 1.0. Features may be incomplete or unstable."],["Data Privacy","All data is encrypted and stored on Google Firebase. We do not sell or share your personal data."],["Security","Industry-standard AES-256 encryption. We are not responsible for unauthorised access due to weak passwords."],["Intellectual Property","All content, design, and code © 2026 Aswin C R. Unauthorised reproduction strictly prohibited."],["Limitation of Liability","ACR MAX is a personal finance tool. We are not liable for financial decisions made based on app data."],["Usage Agreement","By using ACR MAX you agree to these terms and our Privacy Policy."]].map(([t,d],i)=>(
            <div key={i} style={{ marginBottom:14 }}>
              <p style={{ fontWeight:700, color:'#d4af37', fontSize:11, marginBottom:4 }}>{i+1}. {t}</p>
              <p style={{ fontSize:11, color:'#d1d5db', lineHeight:1.65, margin:0 }}>{d}</p>
            </div>
          ))}
        </div>
        <label style={{ display:'flex', alignItems:'center', gap:8, padding:'0 18px 12px', fontFamily:'Poppins,sans-serif', cursor:'pointer' }}>
          <input
            type="checkbox"
            checked={hasAccepted}
            onChange={(e) => setHasAccepted(e.target.checked)}
            style={{ accentColor:'#d4af37', cursor:'pointer' }}
          />
          <span style={{ fontSize:12, color:'#d1d5db', lineHeight:1.5 }}>
            I have read and agree to the Beta Disclaimer & Legal Notice
          </span>
        </label>
        <div style={{ padding:'10px 18px', borderTop:'1px solid rgba(255,255,255,0.05)', flexShrink:0, display:'flex', gap:8 }}>
          <button onClick={onClose} style={{ flex:1, padding:'10px', borderRadius:10, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', color:'#d1d5db', fontWeight:700, cursor:'pointer', fontFamily:'Poppins,sans-serif', fontSize:12 }}>Close</button>
          <button onClick={onAgree} disabled={!hasAccepted} className={hasAccepted?'login-btn':''} style={{ flex:2, padding:'10px', borderRadius:10, border:'none', background:hasAccepted?undefined:'rgba(212,175,55,0.1)', color:hasAccepted?'#0a0c14':'rgba(212,175,55,0.3)', opacity:hasAccepted?1:0.5, cursor:hasAccepted?'pointer':'not-allowed', fontFamily:'Syne,sans-serif', fontSize:12, transform:hasAccepted?'scale(1)':'none' }}>Agree</button>
        </div>
      </div>
    </div>
  )
}

/* ── Shared input style ── */
const iSt = (f, e) => ({
  width:'100%', padding:'11px 14px',
  background: '#ffffff',
  border: f ? '1.5px solid rgba(212,175,55,0.7)' : e ? '1.5px solid rgba(239,68,68,0.5)' : '1.5px solid #d1d5db',
  borderRadius:12, color:'#1f2937', fontSize:14,
  fontFamily:'Poppins,sans-serif', fontWeight:500, outline:'none',
  transition:'all 0.25s', boxShadow: f ? '0 0 0 3px rgba(212,175,55,0.08)' : 'none',
})
const Lbl = ({ t }) => <label style={{ display:'block', fontSize:9, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.14em', marginBottom:5 }}>{t}</label>

/* ── LOGIN FORM ── */
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
    <div style={{ animation:'fadeInUp 0.4s ease-out both' }}>
      {/* Compact logo header */}
      <div style={{ textAlign:'center', marginBottom:18 }}>
        <div style={{ position:'relative', display:'inline-block', marginBottom:10 }}>
          {/* Gold orbit ring */}
          <div style={{ position:'absolute', inset:-8, borderRadius:'50%', border:'1px solid rgba(212,175,55,0.35)', animation:'orbitSilver 6s linear infinite', pointerEvents:'none' }}>
            <div style={{ position:'absolute', top:-3, left:'50%', transform:'translateX(-50%)', width:6, height:6, borderRadius:'50%', background:'#d4af37' }} />
          </div>
          <img src="/logo.jpg" alt="ACR MAX" style={{ width:80, height:80, borderRadius:'50%', objectFit:'cover', border:'2.5px solid rgba(212,175,55,0.6)', boxShadow:'0 0 0 6px rgba(212,175,55,0.08),0 8px 32px rgba(0,0,0,0.5)', display:'block', animation:'logoFloat 4s ease-in-out infinite' }} />
        </div>
        <h1 style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:26, letterSpacing:'0.07em', margin:'0 0 3px', background:'linear-gradient(135deg,#e8e8e8 10%,#d4af37 40%,#f4d03f 60%,#c9922a 90%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>ACR MAX</h1>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginBottom:8 }}>
          <div style={{ height:1, width:24, background:'linear-gradient(90deg,transparent,rgba(212,175,55,0.45))' }} />
          <p style={{ fontSize:9, fontWeight:700, color:'rgba(212,175,55,0.7)', letterSpacing:'0.22em', textTransform:'uppercase', margin:0 }}>Maximizing Lifes</p>
          <div style={{ height:1, width:24, background:'linear-gradient(90deg,rgba(212,175,55,0.45),transparent)' }} />
        </div>
        <div style={{ display:'inline-flex', alignItems:'center', gap:5, background:'rgba(212,175,55,0.08)', border:'1px solid rgba(212,175,55,0.28)', borderRadius:20, padding:'3px 12px' }}>
          <div style={{ width:5, height:5, borderRadius:'50%', background:'#d4af37' }} />
          <span style={{ fontSize:8, fontWeight:800, color:'rgba(212,175,55,0.85)', letterSpacing:'0.15em' }}>BETA 1.0</span>
        </div>
      </div>

      <p style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:16, color:'#111827', marginBottom:2 }}>Welcome back</p>
      <p style={{ fontSize:11, color:'#6b7280', marginBottom:16 }}>Sign in with your authorized credentials</p>

      <div style={{ marginBottom:10 }}>
        <Lbl t="Username" />
        <div style={{ position:'relative' }}>
          <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', fontSize:13, color: f==='u'?'#d4af37':'#9ca3af', transition:'color 0.25s' }}>👤</span>
          <input value={username} onChange={e=>{setUsername(e.target.value);setError('')}} onFocus={()=>setF('u')} onBlur={()=>setF(null)} onKeyDown={e=>e.key==='Enter'&&doLogin()} placeholder="Enter username" autoComplete="username" style={{...iSt(f==='u',error),paddingLeft:38}} />
        </div>
      </div>

      <div style={{ marginBottom:14 }}>
        <Lbl t="Password" />
        <div style={{ position:'relative' }}>
          <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', fontSize:13, color: f==='p'?'#d4af37':'#9ca3af', transition:'color 0.25s' }}>🔒</span>
          <input type={showPass?'text':'password'} value={password} onChange={e=>{setPassword(e.target.value);setError('')}} onFocus={()=>setF('p')} onBlur={()=>setF(null)} onKeyDown={e=>e.key==='Enter'&&doLogin()} placeholder="Enter password" autoComplete="current-password" style={{...iSt(f==='p',error),paddingLeft:38,paddingRight:42}} />
          <button onClick={()=>setShowPass(s=>!s)} style={{ position:'absolute', right:11, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:14, color:'#6b7280' }}>{showPass?'🙈':'👁'}</button>
        </div>
        <div style={{ textAlign:'right', marginTop:4 }}>
          <button onClick={onGoForgot} style={{ background:'none', border:'none', cursor:'pointer', fontSize:11, color:'rgba(212,175,55,0.75)', fontFamily:'Poppins,sans-serif', fontWeight:600 }}>Forgot password?</button>
        </div>
      </div>

      {error && <div style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.28)', borderRadius:10, padding:'8px 12px', marginBottom:10, display:'flex', alignItems:'center', gap:7, animation:'errorShake 0.4s ease-out' }}><span>⚠️</span><p style={{ fontSize:11, color:'#fca5a5', fontWeight:600, margin:0 }}>{error}</p></div>}
      {success && <div style={{ background:'rgba(52,211,153,0.09)', border:'1px solid rgba(52,211,153,0.28)', borderRadius:10, padding:'8px 12px', marginBottom:10, display:'flex', alignItems:'center', gap:7 }}><span>✅</span><p style={{ fontSize:11, color:'#047857', fontWeight:600, margin:0 }}>Access granted! Loading…</p></div>}

      <button onClick={doLogin} disabled={loading||success} className="login-btn" style={{ width:'100%', padding:'13px', border:'none', borderRadius:13, fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:15, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginBottom:12 }}>
        {loading ? <><div style={{ width:15, height:15, border:'2px solid rgba(0,0,0,0.2)', borderTop:'2px solid #0a0c14', borderRadius:'50%', animation:'spinLoad 0.7s linear infinite' }} />Authenticating…</> : success ? '✓ Access Granted' : '🔐 Sign In to ACR MAX'}
      </button>
      <div style={{ textAlign:'center' }}>
        <span style={{ fontSize:12, color:'#6b7280' }}>New here? </span>
        <button onClick={onGoSignup} style={{ background:'none', border:'none', cursor:'pointer', fontSize:12, color:'#d4af37', fontWeight:700, fontFamily:'Poppins,sans-serif', textDecoration:'underline' }}>Create Account</button>
      </div>
    </div>
  )
}

/* ── SIGNUP FORM ── */
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

  const v1 = () => { const e={}; if(!form.name.trim())e.name='Required'; if(!form.dob)e.dob='Required'; else if((new Date()-new Date(form.dob))/(365.25*24*3600*1000)<10)e.dob='Must be 10+'; if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))e.email='Valid email required'; setErrors(e); return !Object.keys(e).length }
  const v2 = async () => { const e={}; if(form.username.length<3)e.username='Min 3 chars'; else if(await usernameExists(form.username.trim()))e.username='Username taken'; if(form.password.length<6)e.password='Min 6 chars'; if(form.password!==form.confirm)e.confirm='No match'; setErrors(e); return !Object.keys(e).length }
  const next = async () => { if(step===1&&v1())setStep(2); else if(step===2){setLoading(true);const ok=await v2();setLoading(false);if(ok)setStep(3)} }
  const submit = async () => { if(!form.hint_a.trim()){setErrors({hint_a:'Required'});return} setLoading(true); try{const u={username:form.username.trim().toLowerCase(),password:form.password,name:form.name.trim(),role:'Member',dob:form.dob,email:form.email.trim(),hint_q:form.hint_q,hint_a:form.hint_a.trim().toLowerCase(),createdAt:new Date().toISOString().slice(0,10)};await registerUser(u);setSuccess(true);await new Promise(r=>setTimeout(r,800));onSignupSuccess(u)}catch(e){setErrors({hint_a:e.message});setLoading(false)} }
  const steps = ['Personal','Credentials','Security']

  return (
    <div style={{ animation:'fadeInUp 0.4s ease-out both' }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
        <img src="/logo.jpg" alt="" style={{ width:42, height:42, borderRadius:'50%', border:'2px solid rgba(212,175,55,0.5)', flexShrink:0 }} />
        <div>
          <h1 style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:17, margin:'0 0 1px', background:'linear-gradient(135deg,#e0e0e0,#d4af37)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>ACR MAX</h1>
          <p style={{ fontSize:10, fontWeight:700, color:'#6b7280', margin:0 }}>Create Account · Step {step}/3</p>
        </div>
      </div>

      {/* Step indicators */}
      <div style={{ display:'flex', gap:3, marginBottom:16 }}>
        {steps.map((st,i)=>(
          <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
            <div style={{ width:22, height:22, borderRadius:'50%', background:i+1<=step?'linear-gradient(135deg,#d4af37,#f4d03f)':'#e5e7eb', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:800, color:i+1<=step?'#0a0c14':'#6b7280', transition:'all 0.3s' }}>{i+1<step?'✓':i+1}</div>
            <p style={{ fontSize:7, color:i+1<=step?'#b45309':'#9ca3af', margin:0, fontWeight:700, letterSpacing:'0.07em', textTransform:'uppercase' }}>{st}</p>
          </div>
        ))}
      </div>

      {step===1&&(<div style={{animation:'fadeInUp 0.3s ease-out both'}}>
        <div style={{marginBottom:9}}><Lbl t="Full Name"/><input value={form.name} onChange={e=>s('name',e.target.value)} placeholder="e.g. Rahul Kumar" style={iSt(false,errors.name)}/>{errors.name&&<p style={{fontSize:9,color:'#f87171',marginTop:2}}>{errors.name}</p>}</div>
        <div style={{marginBottom:9}}><Lbl t="Date of Birth"/><input type="date" value={form.dob} onChange={e=>s('dob',e.target.value)} style={{...iSt(false,errors.dob),colorScheme:'dark'}}/>{errors.dob&&<p style={{fontSize:9,color:'#f87171',marginTop:2}}>{errors.dob}</p>}</div>
        <div style={{marginBottom:14}}><Lbl t="Email ID"/><input type="email" value={form.email} onChange={e=>s('email',e.target.value)} placeholder="you@example.com" style={iSt(false,errors.email)}/>{errors.email&&<p style={{fontSize:9,color:'#f87171',marginTop:2}}>{errors.email}</p>}</div>
        <button onClick={next} className="login-btn" style={{width:'100%',padding:'12px',border:'none',borderRadius:12,fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:13,cursor:'pointer'}}>Continue →</button>
      </div>)}

      {step===2&&(<div style={{animation:'fadeInUp 0.3s ease-out both'}}>
        <div style={{marginBottom:9}}><Lbl t="Username"/><input value={form.username} onChange={e=>s('username',e.target.value)} placeholder="Unique (min 3 chars)" style={iSt(false,errors.username)}/>{errors.username&&<p style={{fontSize:9,color:'#f87171',marginTop:2}}>{errors.username}</p>}</div>
        <div style={{marginBottom:9}}><Lbl t="Password"/><div style={{position:'relative'}}><input type={showP?'text':'password'} value={form.password} onChange={e=>s('password',e.target.value)} placeholder="Min 6 characters" style={{...iSt(false,errors.password),paddingRight:38}}/><button onClick={()=>setShowP(x=>!x)} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',fontSize:13,color:'#6b7280'}}>{showP?'🙈':'👁'}</button></div>{errors.password&&<p style={{fontSize:9,color:'#f87171',marginTop:2}}>{errors.password}</p>}{form.password&&<div style={{display:'flex',gap:3,marginTop:4}}>{[1,2,3,4].map(i=><div key={i} style={{flex:1,height:3,borderRadius:3,background:form.password.length>=i*3?(form.password.length>=10?'#34d399':form.password.length>=7?'#fbbf24':'#f87171'):'#e5e7eb',transition:'background 0.3s'}}/>)}</div>}</div>
        <div style={{marginBottom:14}}><Lbl t="Confirm Password"/><div style={{position:'relative'}}><input type={showC?'text':'password'} value={form.confirm} onChange={e=>s('confirm',e.target.value)} placeholder="Re-enter" style={{...iSt(false,errors.confirm),paddingRight:38}}/><button onClick={()=>setShowC(x=>!x)} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',fontSize:13,color:'#6b7280'}}>{showC?'🙈':'👁'}</button></div>{errors.confirm&&<p style={{fontSize:9,color:'#f87171',marginTop:2}}>{errors.confirm}</p>}</div>
        <div style={{display:'flex',gap:8}}><button onClick={()=>setStep(1)} style={{flex:1,padding:'11px',borderRadius:12,background:'#ffffff',border:'1px solid #d1d5db',color:'#4b5563',fontWeight:700,cursor:'pointer',fontSize:12,fontFamily:'Poppins,sans-serif'}}>← Back</button><button onClick={next} disabled={loading} className="login-btn" style={{flex:2,padding:'11px',border:'none',borderRadius:12,fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:13,cursor:'pointer'}}>{loading?'Checking…':'Continue →'}</button></div>
      </div>)}

      {step===3&&(<div style={{animation:'fadeInUp 0.3s ease-out both'}}>
        <div style={{marginBottom:9}}><Lbl t="Security Question"/><select value={form.hint_q} onChange={e=>s('hint_q',e.target.value)} style={{...iSt(false,false),cursor:'pointer'}}>{HINT_QUESTIONS.map(q=><option key={q} value={q} style={{background:'#0d0b2e'}}>{q}</option>)}</select></div>
        <div style={{marginBottom:9}}><Lbl t="Your Answer"/><input value={form.hint_a} onChange={e=>s('hint_a',e.target.value)} placeholder="Keep it memorable" style={iSt(false,errors.hint_a)}/>{errors.hint_a&&<p style={{fontSize:9,color:'#f87171',marginTop:2}}>{errors.hint_a}</p>}</div>
        <div style={{marginBottom:14,padding:'10px 12px',background:'rgba(212,175,55,0.07)',border:'1px solid rgba(212,175,55,0.2)',borderRadius:10}}>
          <label style={{display:'flex',alignItems:'flex-start',gap:9,cursor:'pointer'}}>
            <input type="checkbox" checked={agreedBeta} onChange={e=>setAgreedBeta(e.target.checked)} style={{marginTop:2,width:14,height:14,cursor:'pointer',accentColor:'#d4af37'}}/>
            <span style={{fontSize:10,color:'#6b7280',lineHeight:1.55,fontFamily:'Poppins,sans-serif'}}>I agree to the <strong style={{color:'#d4af37'}}>Beta Terms & Disclaimer</strong>. ACR MAX is beta software. Data may be reset.</span>
          </label>
        </div>
        {success&&<div style={{background:'rgba(52,211,153,0.09)',border:'1px solid rgba(52,211,153,0.25)',borderRadius:10,padding:'8px 12px',marginBottom:10,display:'flex',alignItems:'center',gap:7}}><span>✅</span><p style={{fontSize:11,color:'#047857',fontWeight:600,margin:0}}>Account created! Signing in…</p></div>}
        <div style={{display:'flex',gap:8}}><button onClick={()=>setStep(2)} style={{flex:1,padding:'11px',borderRadius:12,background:'#ffffff',border:'1px solid #d1d5db',color:'#4b5563',fontWeight:700,cursor:'pointer',fontSize:12,fontFamily:'Poppins,sans-serif'}}>← Back</button><button onClick={submit} disabled={loading||!agreedBeta} className={agreedBeta?'login-btn':''} style={{flex:2,padding:'11px',border:'none',borderRadius:12,fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:13,cursor:agreedBeta?'pointer':'not-allowed',background:agreedBeta?undefined:'rgba(212,175,55,0.1)',color:agreedBeta?'#0a0c14':'rgba(212,175,55,0.3)'}}>{loading?'Creating…':'✓ Create Account'}</button></div>
      </div>)}
      <div style={{textAlign:'center',marginTop:12}}><button onClick={onGoLogin} style={{background:'none',border:'none',cursor:'pointer',fontSize:11,color:'#6b7280',fontFamily:'Poppins,sans-serif'}}>← Back to Sign In</button></div>
    </div>
  )
}

/* ── FORGOT PASSWORD ── */
function ForgotForm({ onGoLogin }) {
  const [step, setStep] = useState(1)
  const [username, setUsername] = useState('')
  const [hint, setHint] = useState('')
  const [answer, setAnswer] = useState('')
  const [newPass, setNewPass] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [f, setF] = useState(null)

  const lookupUser = async () => { if(!username.trim()){setError('Enter username');return} setLoading(true); try{const u=await getUserByUsername(username.trim());setHint(u.hint_q);setStep(2);setError('')}catch{setError('Username not found')} setLoading(false) }
  const verifyAnswer = async () => { if(!answer.trim()){setError('Enter your answer');return} setLoading(true); try{const u=await getUserByUsername(username.trim());if(u.hint_a!==answer.trim().toLowerCase()){setError('Incorrect answer');setLoading(false);return}setStep(3);setError('')}catch{setError('Error')} setLoading(false) }
  const resetPassword = async () => { if(newPass.length<6){setError('Min 6 characters');return} setLoading(true); try{await updatePassword(username.trim(),newPass);setStep(4);setError('')}catch{setError('Reset failed')} setLoading(false) }

  return (
    <div style={{animation:'fadeInUp 0.4s ease-out both'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
        <img src="/logo.jpg" alt="" style={{width:36,height:36,borderRadius:'50%',border:'2px solid rgba(212,175,55,0.4)',flexShrink:0}}/>
        <div><h1 style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:15,margin:0,color:'#111827'}}>Account Recovery</h1><p style={{fontSize:9,color:'#6b7280',margin:0}}>Restore access to ACR MAX</p></div>
      </div>
      {step===1&&(<>
        <Lbl t="Username"/><input value={username} onChange={e=>{setUsername(e.target.value);setError('')}} onFocus={()=>setF('u')} onBlur={()=>setF(null)} placeholder="Your username" style={{...iSt(f==='u',error),marginBottom:10}}/>
        {error&&<p style={{fontSize:10,color:'#f87171',marginBottom:8}}>{error}</p>}
        <button onClick={lookupUser} disabled={loading} className="login-btn" style={{width:'100%',padding:'12px',border:'none',borderRadius:12,fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:13,cursor:'pointer',marginBottom:10}}>{loading?'Looking up…':'Find Account →'}</button>
      </>)}
      {step===2&&(<>
        <div style={{background:'rgba(212,175,55,0.07)',border:'1px solid rgba(212,175,55,0.2)',borderRadius:10,padding:'10px 13px',marginBottom:12}}><p style={{fontSize:10,color:'#b45309',fontWeight:600,margin:'0 0 3px'}}>Security Question</p><p style={{fontSize:12,color:'#374151',margin:0,lineHeight:1.5}}>{hint}</p></div>
        <Lbl t="Your Answer"/><input value={answer} onChange={e=>{setAnswer(e.target.value);setError('')}} placeholder="Enter answer" style={{...iSt(false,error),marginBottom:10}}/>
        {error&&<p style={{fontSize:10,color:'#f87171',marginBottom:8}}>{error}</p>}
        <button onClick={verifyAnswer} disabled={loading} className="login-btn" style={{width:'100%',padding:'12px',border:'none',borderRadius:12,fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:13,cursor:'pointer'}}>{loading?'Verifying…':'Verify →'}</button>
      </>)}
      {step===3&&(<>
        <Lbl t="New Password"/><input type="password" value={newPass} onChange={e=>{setNewPass(e.target.value);setError('')}} placeholder="Min 6 characters" style={{...iSt(false,error),marginBottom:10}}/>
        {error&&<p style={{fontSize:10,color:'#f87171',marginBottom:8}}>{error}</p>}
        <button onClick={resetPassword} disabled={loading} className="login-btn" style={{width:'100%',padding:'12px',border:'none',borderRadius:12,fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:13,cursor:'pointer'}}>{loading?'Resetting…':'Reset Password ✓'}</button>
      </>)}
      {step===4&&(<div style={{textAlign:'center',padding:'12px 0'}}><div style={{fontSize:40,marginBottom:10}}>✅</div><p style={{fontFamily:'Syne,sans-serif',fontWeight:800,color:'#34d399',fontSize:14,margin:'0 0 5px'}}>Password Reset!</p><p style={{fontSize:11,color:'#6b7280',margin:0}}>You can now sign in.</p></div>)}
      <div style={{textAlign:'center',marginTop:12}}><button onClick={onGoLogin} style={{background:'none',border:'none',cursor:'pointer',fontSize:11,color:'#6b7280',fontFamily:'Poppins,sans-serif'}}>← Back to Sign In</button></div>
    </div>
  )
}

/* ═══════════════════════════════════
   MAIN LOGIN
═══════════════════════════════════ */
export default function Login({ onLogin }) {
  const [view, setView] = useState('login')
  const [showDisclaimer, setShowDisclaimer] = useState(false)
  const [pendingCreateAction, setPendingCreateAction] = useState(false)

  useEffect(() => { ensureAdminExists() }, [])

  const handleLogin = (user) => onLogin(user)
  const handleSignup = (user) => onLogin(user)
  const openCreateDisclaimer = () => {
    setPendingCreateAction(true)
    setShowDisclaimer(true)
  }
  const closeDisclaimer = () => {
    setShowDisclaimer(false)
    setPendingCreateAction(false)
  }
  const handleDisclaimerAgree = () => {
    setShowDisclaimer(false)
    if (pendingCreateAction) setView('signup')
    setPendingCreateAction(false)
  }

  return (
    <>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=Syne:wght@700;800&family=Cinzel:wght@600;700&display=swap');
      *{box-sizing:border-box;margin:0;padding:0;}
      html,body{height:100%;margin:0;padding:0;background:linear-gradient(180deg,#F8FAFC 0%,#EEF2F7 100%)!important;overflow:hidden;}
      #root{min-height:100vh;background:transparent!important;}
      @keyframes fadeInUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
      @keyframes scaleIn{from{opacity:0;transform:scale(0.93)}to{opacity:1;transform:scale(1)}}
      @keyframes logoFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
      @keyframes orbitSilver{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
      @keyframes spinLoad{to{transform:rotate(360deg)}}
      @keyframes errorShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
      input::placeholder{color:#9ca3af!important;}
      select option{background:#ffffff!important;color:#1f2937!important;}
      .login-btn{background:linear-gradient(135deg,#c9a227,#e8c230)!important;transition:all 0.2s;border:none;color:#0a0c14!important;font-weight:800;}
      .login-btn:hover:not(:disabled){filter:brightness(1.08);}
      .login-btn:active:not(:disabled){transform:scale(0.97);}
      .login-btn:disabled{opacity:0.5;cursor:not-allowed;}
      ::-webkit-scrollbar{width:3px;}
      ::-webkit-scrollbar-thumb{background:rgba(212,175,55,0.3);border-radius:3px;}
    `}</style>

    {/* Galaxy background */}
    <GalaxyField />

    {/* Soft background glow */}
    <div style={{ position:'fixed', inset:0, zIndex:1, pointerEvents:'none',
      background:'radial-gradient(ellipse 120% 40% at 60% 50%, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0) 70%)',
    }} />

    {/* Main wrapper — scrollable for signup */}
    <div style={{ position:'fixed', inset:0, zIndex:10, overflowY:'auto', display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'8px 12px 20px' }}>
      <div style={{ width:'100%', maxWidth:400, animation:'scaleIn 0.5s cubic-bezier(.34,1.1,.64,1) both', marginTop:'max(8px, env(safe-area-inset-top))' }}>

        {/* Glass card */}
        <div style={{ background:'linear-gradient(135deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))', backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)', borderRadius:22, border:'1px solid rgba(212,175,55,0.18)', boxShadow:'0 24px 60px rgba(0,0,0,0.55),inset 0 1px 0 rgba(255,255,255,0.08)', overflow:'hidden' }}>

          {/* Gold accent top bar */}
          <div style={{ height:2, background:'linear-gradient(90deg,transparent,#d4af37,#f4d03f,#d4af37,transparent)' }} />

          <div style={{ padding: view==='signup'?'16px 20px 12px':'20px 22px 16px' }}>
            {view==='login'  && <LoginForm  onLogin={handleLogin} onGoSignup={openCreateDisclaimer} onGoForgot={()=>setView('forgot')} />}
            {view==='signup' && <SignupForm  onGoLogin={()=>setView('login')} onSignupSuccess={handleSignup} />}
            {view==='forgot' && <ForgotForm  onGoLogin={()=>setView('login')} />}

            <div style={{ textAlign:'center', marginTop:10 }}>
              <button onClick={()=>setShowDisclaimer(true)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:10, color:'#6b7280', fontWeight:600, textDecoration:'underline', fontFamily:'Poppins,sans-serif' }}>📋 Beta Disclaimer & Legal Notice</button>
            </div>
          </div>

          {/* Security badges — compact */}
          <div style={{ padding:'10px 16px 14px', borderTop:'1px solid rgba(209,213,219,0.7)', background:'rgba(255,255,255,0.55)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, marginBottom:9 }}>
              <div style={{ height:1, flex:1, background:'rgba(212,175,55,0.12)' }} />
              <p style={{ fontSize:8, fontWeight:800, color:'#b45309', textTransform:'uppercase', letterSpacing:'0.14em', margin:0, whiteSpace:'nowrap' }}>🔐 Security</p>
              <div style={{ height:1, flex:1, background:'rgba(212,175,55,0.12)' }} />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:5, marginBottom:8 }}>
              {[
                {icon:'🔒',label:'SSL/TLS',sub:'256-bit'},
                {icon:'🛡️',label:'AES-256',sub:'Military'},
                {icon:'🔥',label:'Firebase',sub:'Google'},
                {icon:'☁️',label:'Cloud',sub:'Real-time'},
                {icon:'🚫',label:'Zero Ads',sub:'No Data'},
                {icon:'👁️',label:'Privacy',sub:'No Track'},
              ].map((b,i)=>(
                <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, padding:'7px 3px', background:'rgba(255,255,255,0.8)', border:'1px solid #e5e7eb', borderRadius:9 }}>
                  <span style={{ fontSize:15 }}>{b.icon}</span>
                  <p style={{ fontSize:8, fontWeight:700, color:'#374151', margin:0, textAlign:'center' }}>{b.label}</p>
                  <p style={{ fontSize:6, color:'#9ca3af', margin:0 }}>{b.sub}</p>
                </div>
              ))}
            </div>

            {/* Developer compact */}
            <div style={{ display:'flex', alignItems:'center', gap:9, padding:'8px 10px', background:'rgba(212,175,55,0.05)', border:'1px solid rgba(212,175,55,0.13)', borderRadius:10 }}>
              <div style={{ width:30, height:30, borderRadius:'50%', background:'linear-gradient(135deg,#d4af37,#b8860b)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color:'#fff', flexShrink:0, fontFamily:'Syne,sans-serif' }}>A</div>
              <div>
                <p style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:12, color:'#d4af37', margin:0 }}>Aswin C R</p>
                <p style={{ fontSize:8, color:'#6b7280', margin:0 }}>Founder · Full Stack Developer · UI/UX Designer</p>
              </div>
              <p style={{ fontSize:8, color:'#9ca3af', margin:'0 0 0 auto', fontFamily:'Poppins,sans-serif', whiteSpace:'nowrap' }}>© 2026</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    {showDisclaimer && <DisclaimerModal onClose={closeDisclaimer} onAgree={handleDisclaimerAgree} />}
    </>
  )
}
