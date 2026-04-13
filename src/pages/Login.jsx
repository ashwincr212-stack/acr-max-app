import { useState, useEffect, useRef } from 'react'
import { useLanguage } from '../context/LanguageContext'
import {
  loginUser, registerUser, getUserByUsername,
  updatePassword, usernameExists, ensureAdminExists
} from '../firebase'

/* ══════════════════════════════════════════════════════
   ACR MAX — Premium Light Login v2
   Silver glassmorphism · Trust signals · Beta agreement
   All existing logic preserved exactly
══════════════════════════════════════════════════════ */

const HINT_QUESTIONS = [
  "What was the name of your first pet?",
  "What is your mother's maiden name?",
  "What city were you born in?",
  "What was the name of your first school?",
  "What is your favourite childhood movie?",
  "What street did you grow up on?",
  "What was your childhood nickname?",
]

/* ── Soft background particles ── */
function SoftBG() {
  const canvasRef = useRef(null)
  useEffect(()=>{
    const c=canvasRef.current; if(!c) return
    const ctx=c.getContext('2d')
    let raf
    const resize=()=>{c.width=window.innerWidth;c.height=window.innerHeight}
    resize(); window.addEventListener('resize',resize)
    const orbs=Array.from({length:8},()=>({
      x:Math.random()*window.innerWidth,y:Math.random()*window.innerHeight,
      r:Math.random()*180+80,vx:(Math.random()-0.5)*0.3,vy:(Math.random()-0.5)*0.3,
      color:Math.random()>0.5?'200,210,230':'190,200,220',op:Math.random()*0.06+0.02
    }))
    const draw=()=>{
      ctx.clearRect(0,0,c.width,c.height)
      orbs.forEach(o=>{
        const g=ctx.createRadialGradient(o.x,o.y,0,o.x,o.y,o.r)
        g.addColorStop(0,`rgba(${o.color},${o.op})`); g.addColorStop(1,'rgba(255,255,255,0)')
        ctx.beginPath(); ctx.arc(o.x,o.y,o.r,0,Math.PI*2); ctx.fillStyle=g; ctx.fill()
        o.x+=o.vx; o.y+=o.vy
        if(o.x<-o.r)o.x=c.width+o.r; if(o.x>c.width+o.r)o.x=-o.r
        if(o.y<-o.r)o.y=c.height+o.r; if(o.y>c.height+o.r)o.y=-o.r
      })
      raf=requestAnimationFrame(draw)
    }
    draw()
    return()=>{cancelAnimationFrame(raf);window.removeEventListener('resize',resize)}
  },[])
  return <canvas ref={canvasRef} style={{position:'fixed',inset:0,zIndex:0,pointerEvents:'none'}}/>
}

/* ── Terms Modal (Beta License) ── */
function TermsModal({ onClose, onAccept }) {
  const [read,setRead]=useState(false)
  const TERMS=[
    ["Beta Software Notice","ACR MAX is currently in Beta 1.0. Features may be incomplete or change without notice."],
    ["Data Privacy","All data is encrypted and stored on Google Firebase. We never sell or share your personal data."],
    ["Security","Industry-standard AES-256 encryption protects your data. Use a strong password for best protection."],
    ["Intellectual Property","All content, design, and code © 2026 Aswin C R. Unauthorised reproduction strictly prohibited."],
    ["Limitation of Liability","ACR MAX is a personal finance tool. We are not liable for financial decisions based on app data."],
    ["Usage Agreement","By using ACR MAX you agree to these terms, our Privacy Policy, and Cookie Policy."],
    ["Skill-Based Games","The IPL prediction and skill machine features are purely skill-based games. Virtual coins have no monetary value and cannot be exchanged for real money."],
  ]
  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{position:'fixed',inset:0,zIndex:400,background:'rgba(15,30,60,0.5)',backdropFilter:'blur(10px)',display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div style={{width:'100%',maxWidth:480,maxHeight:'88vh',background:'rgba(255,255,255,0.98)',backdropFilter:'blur(20px)',borderRadius:20,border:'1px solid rgba(200,215,240,0.8)',boxShadow:'0 24px 60px rgba(30,60,120,0.15)',display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{padding:'16px 20px 12px',borderBottom:'1px solid rgba(100,140,200,0.1)',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
          <p style={{fontFamily:'Syne,sans-serif',fontWeight:800,color:'#1e3a6e',fontSize:15,margin:0}}>📋 Beta License Agreement</p>
          <button onClick={onClose} style={{background:'none',border:'none',color:'#94a3b8',fontSize:18,cursor:'pointer',lineHeight:1}}>✕</button>
        </div>
        {!read&&<p style={{fontSize:10,color:'#64748b',padding:'6px 20px 0',fontWeight:600,fontFamily:'Poppins,sans-serif'}}>📜 Scroll to the bottom to accept</p>}
        <div onScroll={e=>{const el=e.target;if(el.scrollTop+el.clientHeight>=el.scrollHeight-10)setRead(true)}}
          style={{flex:1,overflowY:'auto',padding:'14px 20px'}}>
          {TERMS.map(([t,d],i)=>(
            <div key={i} style={{marginBottom:16}}>
              <p style={{fontWeight:700,color:'#1e3a6e',fontSize:12,marginBottom:5,fontFamily:'Poppins,sans-serif'}}>{i+1}. {t}</p>
              <p style={{fontSize:12,color:'#64748b',lineHeight:1.7,margin:0,fontFamily:'Poppins,sans-serif'}}>{d}</p>
            </div>
          ))}
        </div>
        <div style={{padding:'12px 20px',borderTop:'1px solid rgba(100,140,200,0.1)',display:'flex',gap:8,flexShrink:0}}>
          <button onClick={onClose} style={{flex:1,padding:'11px',borderRadius:10,border:'1px solid #e2e8f0',background:'#f8fafc',color:'#64748b',fontWeight:700,cursor:'pointer',fontFamily:'Poppins,sans-serif',fontSize:12}}>Close</button>
          <button onClick={()=>{if(read){onAccept();onClose()}}} disabled={!read}
            style={{flex:2,padding:'11px',borderRadius:10,border:'none',fontWeight:800,cursor:read?'pointer':'not-allowed',fontFamily:'Poppins,sans-serif',fontSize:12,transition:'all 0.2s',
              background:read?'linear-gradient(135deg,#1e3a6e,#2563eb)':'#e2e8f0',
              color:read?'#fff':'#94a3b8',
              boxShadow:read?'0 4px 14px rgba(37,99,235,0.3)':'none'}}>
            {read?'✓ I Accept the Terms':'📜 Scroll to read first'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Shared light input style ── */
const iSt=(focused,hasError)=>({
  width:'100%',padding:'12px 14px 12px 40px',
  background:focused?'rgba(37,99,235,0.04)':'rgba(248,250,252,1)',
  border:focused?'1.5px solid rgba(37,99,235,0.5)':hasError?'1.5px solid rgba(239,68,68,0.5)':'1.5px solid rgba(203,213,225,1)',
  borderRadius:12,color:'#1e293b',fontSize:14,
  fontFamily:'Poppins,sans-serif',fontWeight:500,outline:'none',
  transition:'all 0.22s',
  boxShadow:focused?'0 0 0 3px rgba(37,99,235,0.08)':hasError?'0 0 0 3px rgba(239,68,68,0.06)':'none',
})

const Lbl=({t})=><label style={{display:'block',fontSize:10,fontWeight:700,color:'#64748b',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:6,fontFamily:'Poppins,sans-serif'}}>{t}</label>

const FieldWrap=({children,icon})=>(
  <div style={{position:'relative'}}>
    <span style={{position:'absolute',left:13,top:'50%',transform:'translateY(-50%)',fontSize:15,pointerEvents:'none',zIndex:1}}>{icon}</span>
    {children}
  </div>
)

const ErrMsg=({msg})=>msg?<p style={{fontSize:11,color:'#ef4444',margin:'4px 0 0',fontFamily:'Poppins,sans-serif'}}>{msg}</p>:null

/* Primary button */
const PrimaryBtn=({onClick,disabled,loading,children})=>(
  <button onClick={onClick} disabled={disabled}
    style={{width:'100%',padding:'13px',border:'none',borderRadius:13,
      fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:15,cursor:disabled?'not-allowed':'pointer',
      display:'flex',alignItems:'center',justifyContent:'center',gap:8,transition:'all 0.2s',
      background:disabled?'#e2e8f0':'linear-gradient(135deg,#1a1a2e 0%,#16213e 30%,#1e3a6e 60%,#2a4a8e 100%)',
      color:disabled?'#94a3b8':'#fff',
      boxShadow:disabled?'none':'0 6px 20px rgba(30,50,110,0.35),inset 0 1px 0 rgba(255,255,255,0.1)',
      position:'relative',overflow:'hidden'}}>
    {!disabled&&<div style={{position:'absolute',top:0,left:0,right:0,height:'40%',background:'rgba(255,255,255,0.06)',borderRadius:'13px 13px 0 0'}}/>}
    <span style={{position:'relative',zIndex:1,display:'flex',alignItems:'center',gap:8}}>
      {loading?<><div style={{width:16,height:16,border:'2px solid rgba(255,255,255,0.3)',borderTop:'2px solid #fff',borderRadius:'50%',animation:'spin 0.7s linear infinite'}}/>Loading…</>:children}
    </span>
  </button>
)

/* ── LOGO HEADER (shared) ── */
function LogoHeader({subtitle}) {
  const { t } = useLanguage()
  return (
    <div style={{textAlign:'center',marginBottom:22}}>
      <div style={{position:'relative',display:'inline-block',marginBottom:14}}>
        {/* Gold orbit ring — matches original branding */}
        <div style={{position:'absolute',inset:-10,borderRadius:'50%',border:'1px solid rgba(212,175,55,0.4)',animation:'orbitLight 6s linear infinite',pointerEvents:'none'}}>
          <div style={{position:'absolute',top:-4,left:'50%',transform:'translateX(-50%)',width:8,height:8,borderRadius:'50%',background:'linear-gradient(135deg,#d4af37,#f4d03f)',boxShadow:'0 0 10px rgba(212,175,55,0.8)'}}/>
        </div>
        {/* Second orbit ring */}
        <div style={{position:'absolute',inset:-20,borderRadius:'50%',border:'1px solid rgba(212,175,55,0.15)',animation:'orbitLight 10s linear infinite reverse',pointerEvents:'none'}}/>
        <img src="/logo.jpg" alt="ACR MAX"
          style={{width:80,height:80,borderRadius:'50%',objectFit:'cover',
            border:'2.5px solid rgba(212,175,55,0.6)',
            boxShadow:'0 0 0 6px rgba(212,175,55,0.08),0 6px 28px rgba(212,175,55,0.2),0 2px 8px rgba(0,0,0,0.12)',
            display:'block',animation:'float 4s ease-in-out infinite'}}/>
      </div>

      {/* ACR MAX — silver to gold gradient like original */}
      <h1 style={{fontFamily:'Syne,sans-serif',fontWeight:900,fontSize:28,margin:'0 0 4px',letterSpacing:'0.08em',
        background:'linear-gradient(135deg,#8a8a8a 0%,#C0C0C0 20%,#d4af37 45%,#f4d03f 60%,#c9922a 85%,#a87520 100%)',
        WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',
        backgroundClip:'text'}}>ACR MAX</h1>

      {/* Brand slogan */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,marginBottom:8}}>
        <div style={{height:1,width:28,background:'linear-gradient(90deg,transparent,rgba(212,175,55,0.5))'}}/>
        <p style={{fontSize:9,fontWeight:700,color:'rgba(180,140,40,0.8)',letterSpacing:'0.22em',textTransform:'uppercase',margin:0,fontFamily:'Poppins,sans-serif'}}>Maximising Lifes</p>
        <div style={{height:1,width:28,background:'linear-gradient(90deg,rgba(212,175,55,0.5),transparent)'}}/>
      </div>

      {/* Subtitle + Beta badge */}
      <p style={{fontSize:10,color:'#94a3b8',fontFamily:'Poppins,sans-serif',fontWeight:500,margin:'0 0 8px',letterSpacing:'0.06em',textTransform:'uppercase'}}>
        {subtitle||t.smartPlatform||'Smart Performance Platform'}
      </p>
      <div style={{display:'inline-flex',alignItems:'center',gap:5,padding:'3px 14px',
        background:'linear-gradient(135deg,rgba(212,175,55,0.08),rgba(212,175,55,0.04))',
        border:'1px solid rgba(212,175,55,0.3)',borderRadius:20}}>
        <span style={{fontSize:8,fontWeight:700,color:'rgba(180,140,40,0.9)',letterSpacing:'0.15em',fontFamily:'Poppins,sans-serif'}}>BETA 1.0</span>
      </div>
    </div>
  )
}

/* ── LOGIN FORM ── */
function LoginForm({ onLogin, onGoSignup, onGoForgot }) {
  const { t } = useLanguage()
  const [username,setUsername]=useState('')
  const [password,setPassword]=useState('')
  const [showPass,setShowPass]=useState(false)
  const [error,setError]=useState('')
  const [loading,setLoading]=useState(false)
  const [success,setSuccess]=useState(false)
  const [f,setF]=useState(null)

  // UNCHANGED login logic
  const doLogin=async()=>{
    if(!username.trim()||!password.trim()){setError('Please enter your credentials.');return}
    setLoading(true);setError('')
    try{
      const user=await loginUser(username.trim(),password)
      setSuccess(true)
      await new Promise(r=>setTimeout(r,700))
      onLogin(user)
    }catch(e){
      setError(e.message.includes('not found')||e.message.includes('password')?'Invalid username or password.':'Connection error. Check internet.')
      setLoading(false)
    }
  }

  return (
    <div style={{animation:'fadeInUp 0.4s ease-out both'}}>
      <LogoHeader/>
      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        <div>
          <Lbl t="Username"/>
          <FieldWrap icon="👤">
            <input value={username} onChange={e=>{setUsername(e.target.value);setError('')}}
              onFocus={()=>setF('u')} onBlur={()=>setF(null)}
              onKeyDown={e=>e.key==='Enter'&&doLogin()}
              placeholder={t.enterUsername||"Enter username"} autoComplete="username"
              style={iSt(f==='u',!!error)}/>
          </FieldWrap>
        </div>
        <div>
          <Lbl t="Password"/>
          <div style={{position:'relative'}}>
            <span style={{position:'absolute',left:13,top:'50%',transform:'translateY(-50%)',fontSize:15,pointerEvents:'none'}}>🔑</span>
            <input type={showPass?'text':'password'} value={password}
              onChange={e=>{setPassword(e.target.value);setError('')}}
              onFocus={()=>setF('p')} onBlur={()=>setF(null)}
              onKeyDown={e=>e.key==='Enter'&&doLogin()}
              placeholder={t.enterPassword||"Enter password"} autoComplete="current-password"
              style={{...iSt(f==='p',!!error),paddingRight:42}}/>
            <button onClick={()=>setShowPass(s=>!s)} style={{position:'absolute',right:13,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',fontSize:15,color:'#94a3b8',padding:0}}>{showPass?'🙈':'👁'}</button>
          </div>
        </div>
        {error&&<div style={{padding:'9px 13px',background:'rgba(239,68,68,0.06)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:10}}><p style={{fontSize:12,color:'#ef4444',margin:0,fontFamily:'Poppins,sans-serif'}}>{error}</p></div>}
        {success&&<div style={{padding:'9px 13px',background:'rgba(34,197,94,0.06)',border:'1px solid rgba(34,197,94,0.2)',borderRadius:10}}><p style={{fontSize:12,color:'#16a34a',margin:0,fontFamily:'Poppins,sans-serif'}}>✓ Welcome back! Signing in…</p></div>}
        <div style={{display:'flex',justifyContent:'flex-end'}}>
          <button onClick={onGoForgot} style={{background:'none',border:'none',cursor:'pointer',fontSize:11,color:'#2563eb',fontFamily:'Poppins,sans-serif',fontWeight:600,padding:0}}>Forgot password?</button>
        </div>
        <PrimaryBtn onClick={doLogin} disabled={loading||success} loading={loading}>
          {success?'✓ Welcome Back!':t.signIn||'Sign In →'}
        </PrimaryBtn>

        {/* Create Account — right below Sign In */}
        <button onClick={onGoSignup} style={{width:'100%',padding:'12px',borderRadius:13,border:'1.5px solid rgba(212,175,55,0.35)',background:'rgba(212,175,55,0.04)',color:'#8a6a00',fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:14,cursor:'pointer',transition:'all 0.2s',marginTop:0}}
          onMouseEnter={e=>{e.currentTarget.style.background='rgba(212,175,55,0.08)';e.currentTarget.style.borderColor='rgba(212,175,55,0.6)'}}
          onMouseLeave={e=>{e.currentTarget.style.background='rgba(212,175,55,0.04)';e.currentTarget.style.borderColor='rgba(212,175,55,0.35)'}}>
          Create Account →
        </button>

        {/* Trust signals */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,marginTop:4}}>
          {[['🔒',t.encrypted||'Encrypted'],['🛡',t.firebase||'Firebase'],['🔐',t.protected||'Protected']].map(([icon,label],i)=>(
            <div key={i} style={{textAlign:'center',padding:'8px 4px',background:'rgba(248,250,252,0.8)',borderRadius:9,border:'1px solid #e2e8f0'}}>
              <p style={{fontSize:14,margin:'0 0 2px'}}>{icon}</p>
              <p style={{fontSize:8,fontWeight:700,color:'#64748b',margin:0,fontFamily:'Poppins,sans-serif',textTransform:'uppercase',letterSpacing:'0.06em'}}>{label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── SIGNUP FORM ── */
function SignupForm({ onGoLogin, onSignupSuccess }) {
  const { t } = useLanguage()
  const [step,setStep]=useState(1)
  const [form,setForm]=useState({name:'',username:'',email:'',dob:'',password:'',confirm:'',hint_q:HINT_QUESTIONS[0],hint_a:''})
  const [errors,setErrors]=useState({})
  const [loading,setLoading]=useState(false)
  const [success,setSuccess]=useState(false)
  const [f,setF]=useState(null)
  const [agreed,setAgreed]=useState(false)
  const [showTerms,setShowTerms]=useState(false)
  const s=(k,v)=>setForm(p=>({...p,[k]:v}))

  // UNCHANGED validation & submit logic
  const v1=()=>{const e={};if(!form.name.trim())e.name='Required';if(!form.username.trim())e.username='Required';if(!form.email.trim())e.email='Required';setErrors(e);return !Object.keys(e).length}
  const v2=async()=>{const e={};if(form.username.length<3)e.username='Min 3 chars';else if(await usernameExists(form.username.trim()))e.username='Username taken';if(form.password.length<6)e.password='Min 6 chars';if(form.password!==form.confirm)e.confirm='No match';setErrors(e);return !Object.keys(e).length}
  const submit=async()=>{
    if(!form.hint_a.trim()){setErrors({hint_a:'Required'});return}
    if(!agreed){setErrors({agreed:'You must agree to the Beta License Agreement'});return}
    setLoading(true)
    try{
      const u={username:form.username.trim().toLowerCase(),password:form.password,name:form.name.trim(),role:'Member',dob:form.dob,email:form.email.trim(),hint_q:form.hint_q,hint_a:form.hint_a.trim().toLowerCase(),createdAt:new Date().toISOString().slice(0,10)}
      await registerUser(u);setSuccess(true);await new Promise(r=>setTimeout(r,800));onSignupSuccess(u)
    }catch(e){setErrors({hint_a:e.message});setLoading(false)}
  }

  return (
    <div style={{animation:'fadeInUp 0.4s ease-out both'}}>
      {showTerms&&<TermsModal onClose={()=>setShowTerms(false)} onAccept={()=>setAgreed(true)}/>}
      <LogoHeader subtitle="Create Your Account"/>

      {/* Step indicators */}
      <div style={{display:'flex',gap:6,marginBottom:20}}>
        {[1,2,3].map(n=>(
          <div key={n} style={{flex:1,height:3,borderRadius:2,transition:'all 0.3s',
            background:n<step?'#2563eb':n===step?'rgba(37,99,235,0.4)':'#e2e8f0'}}/>
        ))}
      </div>

      {step===1&&(
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div><Lbl t="Full Name"/><FieldWrap icon="👤"><input value={form.name} onChange={e=>s('name',e.target.value)} onFocus={()=>setF('n')} onBlur={()=>setF(null)} placeholder="Your full name" style={iSt(f==='n',!!errors.name)}/></FieldWrap><ErrMsg msg={errors.name}/></div>
          <div><Lbl t="Username"/><FieldWrap icon="@"><input value={form.username} onChange={e=>s('username',e.target.value.toLowerCase())} onFocus={()=>setF('u')} onBlur={()=>setF(null)} placeholder="Pick a username" style={iSt(f==='u',!!errors.username)}/></FieldWrap><ErrMsg msg={errors.username}/></div>
          <div><Lbl t="Email (optional)"/><FieldWrap icon="✉️"><input type="email" value={form.email} onChange={e=>s('email',e.target.value)} onFocus={()=>setF('e')} onBlur={()=>setF(null)} placeholder="your@email.com" style={iSt(f==='e',false)}/></FieldWrap></div>
          <div><Lbl t="Date of Birth (optional)"/><FieldWrap icon="📅"><input type="date" value={form.dob} onChange={e=>s('dob',e.target.value)} style={{...iSt(false,false),paddingLeft:40}}/></FieldWrap></div>
          <PrimaryBtn onClick={async()=>{if(v1())setStep(2)}} disabled={false}>Next →</PrimaryBtn>
        </div>
      )}

      {step===2&&(
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div><Lbl t="Password"/><FieldWrap icon="🔑"><input type="password" value={form.password} onChange={e=>s('password',e.target.value)} onFocus={()=>setF('p')} onBlur={()=>setF(null)} placeholder="Min 6 characters" style={iSt(f==='p',!!errors.password)}/></FieldWrap><ErrMsg msg={errors.password}/></div>
          <div><Lbl t="Confirm Password"/><FieldWrap icon="🔑"><input type="password" value={form.confirm} onChange={e=>s('confirm',e.target.value)} onFocus={()=>setF('c')} onBlur={()=>setF(null)} placeholder="Repeat password" style={iSt(f==='c',!!errors.confirm)}/></FieldWrap><ErrMsg msg={errors.confirm}/></div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>setStep(1)} style={{flex:1,padding:'12px',borderRadius:12,border:'1px solid #e2e8f0',background:'#f8fafc',color:'#64748b',fontWeight:700,cursor:'pointer',fontFamily:'Poppins,sans-serif',fontSize:13}}>← Back</button>
            <button onClick={async()=>{if(await v2())setStep(3)}} style={{flex:2,padding:'12px',borderRadius:12,border:'none',background:'linear-gradient(135deg,#1e3a6e,#2563eb)',color:'#fff',fontWeight:800,cursor:'pointer',fontFamily:'Syne,sans-serif',fontSize:14,boxShadow:'0 4px 14px rgba(37,99,235,0.3)'}}>Next →</button>
          </div>
        </div>
      )}

      {step===3&&(
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div>
            <Lbl t="Security Question"/>
            <select value={form.hint_q} onChange={e=>s('hint_q',e.target.value)}
              style={{...iSt(false,false),paddingLeft:14,paddingRight:14,appearance:'none',cursor:'pointer',background:'#f8fafc',color:'#1e293b'}}>
              {HINT_QUESTIONS.map(q=><option key={q} value={q}>{q}</option>)}
            </select>
          </div>
          <div><Lbl t="Your Answer"/><FieldWrap icon="💬"><input value={form.hint_a} onChange={e=>s('hint_a',e.target.value)} onFocus={()=>setF('h')} onBlur={()=>setF(null)} placeholder="Your answer" style={iSt(f==='h',!!errors.hint_a)}/></FieldWrap><ErrMsg msg={errors.hint_a}/></div>

          {/* Beta License Agreement */}
          <div style={{padding:'12px 14px',background:agreed?'rgba(37,99,235,0.04)':'rgba(248,250,252,1)',borderRadius:12,border:agreed?'1px solid rgba(37,99,235,0.25)':'1px solid #e2e8f0',transition:'all 0.2s'}}>
            <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
              <input type="checkbox" id="betaAgreement" checked={agreed} onChange={e=>setAgreed(e.target.checked)}
                style={{marginTop:2,width:16,height:16,cursor:'pointer',accentColor:'#2563eb',flexShrink:0}}/>
              <label htmlFor="betaAgreement" style={{fontSize:12,color:'#374151',fontFamily:'Poppins,sans-serif',cursor:'pointer',lineHeight:1.5}}>
                I agree to the{' '}
                <button onClick={()=>setShowTerms(true)} style={{background:'none',border:'none',color:'#2563eb',fontWeight:700,cursor:'pointer',fontSize:12,fontFamily:'Poppins,sans-serif',padding:0,textDecoration:'underline'}}>Beta License Agreement</button>
                {' '}and confirm that I am 13+ years old.
              </label>
            </div>
          </div>
          <ErrMsg msg={errors.agreed}/>

          {success&&<div style={{padding:'9px 13px',background:'rgba(34,197,94,0.06)',border:'1px solid rgba(34,197,94,0.2)',borderRadius:10}}><p style={{fontSize:12,color:'#16a34a',margin:0,fontFamily:'Poppins,sans-serif'}}>✓ Account created! Signing in…</p></div>}

          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>setStep(2)} style={{flex:1,padding:'12px',borderRadius:12,border:'1px solid #e2e8f0',background:'#f8fafc',color:'#64748b',fontWeight:700,cursor:'pointer',fontFamily:'Poppins,sans-serif',fontSize:13}}>← Back</button>
            <PrimaryBtn onClick={submit} disabled={loading||success||!agreed} loading={loading}>Create Account ✓</PrimaryBtn>
          </div>
        </div>
      )}

      <p style={{textAlign:'center',fontSize:12,color:'#94a3b8',margin:'14px 0 0',fontFamily:'Poppins,sans-serif'}}>
        Already have an account?{' '}
        <button onClick={onGoLogin} style={{background:'none',border:'none',cursor:'pointer',fontSize:12,color:'#2563eb',fontWeight:700,fontFamily:'Poppins,sans-serif'}}>Sign In</button>
      </p>
    </div>
  )
}

/* ── FORGOT PASSWORD FORM ── */
function ForgotForm({ onGoLogin }) {
  const { t } = useLanguage()
  const [step,setStep]=useState(1)
  const [username,setUsername]=useState('')
  const [hintQ,setHintQ]=useState('')
  const [hintA,setHintA]=useState('')
  const [newPass,setNewPass]=useState('')
  const [error,setError]=useState('')
  const [loading,setLoading]=useState(false)
  const [f,setF]=useState(null)

  // UNCHANGED forgot logic
  const findUser=async()=>{if(!username.trim()){setError('Enter your username');return}setLoading(true);try{const u=await getUserByUsername(username.trim());if(!u){setError('User not found');setLoading(false);return}setHintQ(u.hint_q||'');setStep(2);setError('')}catch{setError('User not found')}setLoading(false)}
  const verifyHint=()=>{if(!hintA.trim()){setError('Enter your answer');return}setStep(3);setError('')}
  const resetPassword=async()=>{if(newPass.length<6){setError('Min 6 characters');return}setLoading(true);try{await updatePassword(username.trim(),newPass);setStep(4);setError('')}catch{setError('Reset failed')}setLoading(false)}

  return (
    <div style={{animation:'fadeInUp 0.4s ease-out both'}}>
      <LogoHeader subtitle="Reset Password"/>
      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        {step===1&&(<>
          <div><Lbl t="Username"/><FieldWrap icon="👤"><input value={username} onChange={e=>{setUsername(e.target.value);setError('')}} onFocus={()=>setF('u')} onBlur={()=>setF(null)} onKeyDown={e=>e.key==='Enter'&&findUser()} placeholder="Your username" style={iSt(f==='u',!!error)}/></FieldWrap></div>
          {error&&<ErrMsg msg={error}/>}
          <PrimaryBtn onClick={findUser} disabled={loading} loading={loading}>Find Account →</PrimaryBtn>
        </>)}
        {step===2&&(<>
          <div style={{padding:'12px 14px',background:'rgba(37,99,235,0.04)',border:'1px solid rgba(37,99,235,0.15)',borderRadius:12}}><p style={{fontSize:12,color:'#1e3a6e',margin:0,fontFamily:'Poppins,sans-serif',fontWeight:600}}>🔐 {hintQ}</p></div>
          <div><Lbl t="Your Answer"/><FieldWrap icon="💬"><input value={hintA} onChange={e=>{setHintA(e.target.value);setError('')}} onFocus={()=>setF('a')} onBlur={()=>setF(null)} onKeyDown={e=>e.key==='Enter'&&verifyHint()} placeholder="Your answer" style={iSt(f==='a',!!error)}/></FieldWrap></div>
          {error&&<ErrMsg msg={error}/>}
          <PrimaryBtn onClick={verifyHint} disabled={false}>Verify →</PrimaryBtn>
        </>)}
        {step===3&&(<>
          <div><Lbl t="New Password"/><FieldWrap icon="🔑"><input type="password" value={newPass} onChange={e=>{setNewPass(e.target.value);setError('')}} onFocus={()=>setF('p')} onBlur={()=>setF(null)} onKeyDown={e=>e.key==='Enter'&&resetPassword()} placeholder="Min 6 characters" style={iSt(f==='p',!!error)}/></FieldWrap></div>
          {error&&<ErrMsg msg={error}/>}
          <PrimaryBtn onClick={resetPassword} disabled={loading} loading={loading}>Reset Password →</PrimaryBtn>
        </>)}
        {step===4&&(
          <div style={{textAlign:'center',padding:'20px 0'}}>
            <p style={{fontSize:36,marginBottom:10}}>✅</p>
            <p style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:18,color:'#16a34a',margin:'0 0 6px'}}>Password Reset!</p>
            <p style={{fontSize:12,color:'#64748b',fontFamily:'Poppins,sans-serif',margin:'0 0 20px'}}>Your password has been updated successfully.</p>
            <button onClick={onGoLogin} style={{padding:'12px 28px',borderRadius:12,border:'none',background:'linear-gradient(135deg,#1e3a6e,#2563eb)',color:'#fff',fontWeight:800,cursor:'pointer',fontFamily:'Syne,sans-serif',fontSize:14,boxShadow:'0 4px 14px rgba(37,99,235,0.3)'}}>Sign In Now →</button>
          </div>
        )}
        {step<4&&<p style={{textAlign:'center',margin:0}}><button onClick={onGoLogin} style={{background:'none',border:'none',cursor:'pointer',fontSize:11,color:'#94a3b8',fontFamily:'Poppins,sans-serif'}}>← Back to Sign In</button></p>}
      </div>
    </div>
  )
}

/* ══ MAIN EXPORT ══ */
export default function Login({ onLogin }) {
  const [view,setView]=useState('login')

  useEffect(()=>{ ensureAdminExists().catch(()=>{}) },[])

  const handleLogin=(user)=>onLogin(user)
  const handleSignup=(user)=>onLogin(user)

  return (
    <>
    <style>{`
      @keyframes fadeInUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
      @keyframes orbitLight { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      @keyframes spin { to{transform:rotate(360deg)} }
      @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
    `}</style>

    {/* Light silver-white premium background */}
    <div style={{minHeight:'100vh',background:'linear-gradient(160deg,#f8f9fc 0%,#eef2f8 35%,#f5f5f5 60%,#eff2f8 100%)',position:'relative',display:'flex',alignItems:'center',justifyContent:'center',padding:'20px 16px'}}>
      <SoftBG/>

      {/* Card */}
      <div style={{width:'100%',maxWidth:400,position:'relative',zIndex:10}}>
        <div style={{background:'rgba(255,255,255,0.92)',backdropFilter:'blur(24px)',WebkitBackdropFilter:'blur(24px)',borderRadius:24,border:'1px solid rgba(212,175,55,0.18)',boxShadow:'0 8px 40px rgba(0,0,0,0.08),0 2px 8px rgba(212,175,55,0.08),inset 0 1px 0 rgba(255,255,255,0.9)',padding:'28px 26px',position:'relative',overflow:'hidden'}}>
          {/* Gold accent top stripe */}
          <div style={{position:'absolute',top:0,left:24,right:24,height:2,borderRadius:'0 0 2px 2px',background:'linear-gradient(90deg,transparent,rgba(212,175,55,0.4),rgba(212,175,55,0.7),rgba(212,175,55,0.4),transparent)'}}/>
          {/* Tab switcher removed — navigation via links only */}


          {view==='login' &&<LoginForm  onLogin={handleLogin} onGoSignup={()=>setView('signup')} onGoForgot={()=>setView('forgot')}/>}
          {view==='signup'&&<SignupForm onGoLogin={()=>setView('login')} onSignupSuccess={handleSignup}/>}
          {view==='forgot'&&<ForgotForm onGoLogin={()=>setView('login')}/>}
        </div>

        {/* Bottom note */}
        <p style={{textAlign:'center',fontSize:10,color:'#94a3b8',marginTop:16,fontFamily:'Poppins,sans-serif',lineHeight:1.6}}>
          🔒 End-to-end encrypted · 🛡 Google Firebase · © 2026 Aswin C R
        </p>
      </div>
    </div>
    </>
  )
}