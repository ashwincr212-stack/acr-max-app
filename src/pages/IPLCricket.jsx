import { memo, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { db } from '../firebase'
import {
  doc, onSnapshot, getDoc, setDoc,
  collection, getDocs, query, where, orderBy, limit,
  serverTimestamp, increment, runTransaction
} from 'firebase/firestore'

/* ══════════════════════════════════════════════════════
   ACR MAX — IPL 2025 Premium v4
   ✓ Real predictions (1 per match, locked after start)
   ✓ Prediction status shown below match card
   ✓ Global + Weekly leaderboard
   ✓ User accuracy stats
   ✓ Disclaimer · Compact UI · No wasted space
   This is a SKILL-BASED game. Coins = virtual only.
══════════════════════════════════════════════════════ */

/* ── Colors ── */
const C = {
  bg:'#F0F2F5', card:'#FFFFFF',
  blue:'#1A56DB', blue2:'#EEF2FF',
  orange:'#F05A28', orange2:'#FFF3EE',
  red:'#E02424', red2:'#FEF2F2',
  green:'#057A55', green2:'#ECFDF5',
  gold:'#F59E0B', gold2:'#FFFBEB',
  purple:'#7E3AF2', purple2:'#F5F3FF',
  g1:'#111827', g2:'#374151', g3:'#6B7280', g4:'#E5E7EB', g5:'#F9FAFB',
}

/* ── Teams ── */
const TEAMS = {
  'Mumbai Indians':              {s:'MI',  c:'#004BA0',bg:'#DBEAFE',g:'linear-gradient(135deg,#004BA0,#0066CC)',logo:'https://scores.iplt20.com/ipl/teamlogos/MI.png'},
  'Chennai Super Kings':         {s:'CSK', c:'#E9A623',bg:'#FEF3C7',g:'linear-gradient(135deg,#E9A623,#FFB800)',logo:'https://scores.iplt20.com/ipl/teamlogos/CSK.png'},
  'Royal Challengers Bangalore': {s:'RCB', c:'#B91C1C',bg:'#FEE2E2',g:'linear-gradient(135deg,#B91C1C,#DC2626)',logo:'https://scores.iplt20.com/ipl/teamlogos/RCB.png'},
  'Kolkata Knight Riders':       {s:'KKR', c:'#5B21B6',bg:'#EDE9FE',g:'linear-gradient(135deg,#5B21B6,#7C3AED)',logo:'https://scores.iplt20.com/ipl/teamlogos/KKR.png'},
  'Sunrisers Hyderabad':         {s:'SRH', c:'#EA580C',bg:'#FFEDD5',g:'linear-gradient(135deg,#EA580C,#F97316)',logo:'https://scores.iplt20.com/ipl/teamlogos/SRH.png'},
  'Delhi Capitals':              {s:'DC',  c:'#1D4ED8',bg:'#DBEAFE',g:'linear-gradient(135deg,#1D4ED8,#3B82F6)',logo:'https://scores.iplt20.com/ipl/teamlogos/DC.png'},
  'Punjab Kings':                {s:'PBKS',c:'#DC2626',bg:'#FEE2E2',g:'linear-gradient(135deg,#DC2626,#EF4444)',logo:'https://scores.iplt20.com/ipl/teamlogos/PBKS.png'},
  'Rajasthan Royals':            {s:'RR',  c:'#BE185D',bg:'#FCE7F3',g:'linear-gradient(135deg,#BE185D,#EC4899)',logo:'https://scores.iplt20.com/ipl/teamlogos/RR.png'},
  'Gujarat Titans':              {s:'GT',  c:'#1E40AF',bg:'#DBEAFE',g:'linear-gradient(135deg,#1E40AF,#2563EB)',logo:'https://scores.iplt20.com/ipl/teamlogos/GT.png'},
  'Lucknow Super Giants':        {s:'LSG', c:'#0369A1',bg:'#E0F2FE',g:'linear-gradient(135deg,#0369A1,#0284C7)',logo:'https://scores.iplt20.com/ipl/teamlogos/LSG.png'},
}

const getTeam = (n='') => {
  if (TEAMS[n]) return {name:n,...TEAMS[n]}
  const k = Object.keys(TEAMS).find(k=>n.toLowerCase().includes(k.split(' ').pop().toLowerCase())||k.toLowerCase().includes(n.toLowerCase()))
  return k?{name:k,...TEAMS[k]}:{name:n,s:n.slice(0,4).toUpperCase(),c:C.blue,bg:C.blue2,g:`linear-gradient(135deg,${C.blue},#3B82F6)`,logo:null}
}

const fmtTime = r => {
  if (!r) return 'TBD'
  if (/\d{1,2}:\d{2}\s*(am|pm)/i.test(r)) return r
  try{return new Date(r).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true,timeZone:'Asia/Kolkata'})}catch{return r}
}
const fmtDate = r => {try{return new Date(r).toLocaleDateString('en-IN',{day:'numeric',month:'short',timeZone:'Asia/Kolkata'})}catch{return r||''}}
const fmtDateTime = r => {
  try{return new Date(r).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',hour12:true,timeZone:'Asia/Kolkata'})}catch{return ''}
}

/* ── Check if match has started ── */
function matchHasStarted(match) {
  if (!match.date || !match.time) return false
  try {
    const t = match.time.replace(/(\d{1,2}):(\d{2})\s*(am|pm)/i,(_,h,m,ap)=>{
      let hh=parseInt(h); if(ap.toLowerCase()==='pm'&&hh!==12)hh+=12; if(ap.toLowerCase()==='am'&&hh===12)hh=0
      return `${String(hh).padStart(2,'0')}:${m}:00`
    })
    return Date.now() >= new Date(`${match.date}T${t}+05:30`).getTime()
  } catch { return match.status === 'live' || match.status === 'completed' }
}

/* ── Countdown hook ── */
function useCountdown(date, time) {
  const [v,setV] = useState('')
  useEffect(()=>{
    const parse=()=>{
      if(!date) return ''
      const tStr = (time||'').replace(/(\d{1,2}):(\d{2})\s*(am|pm)/i,(_,h,m,ap)=>{
        let hh=parseInt(h); if(ap.toLowerCase()==='pm'&&hh!==12)hh+=12; if(ap.toLowerCase()==='am'&&hh===12)hh=0
        return `${String(hh).padStart(2,'0')}:${m}:00`
      })||'12:00:00'
      const diff=new Date(`${date}T${tStr}+05:30`)-Date.now()
      if(diff<=0) return ''
      const h=Math.floor(diff/3600000),m=Math.floor((diff%3600000)/60000),s=Math.floor((diff%60000)/1000)
      if(h>24) return `${Math.floor(h/24)}d ${h%24}h`
      if(h>0)  return `${h}h ${String(m).padStart(2,'0')}m`
      return `${m}m ${String(s).padStart(2,'0')}s`
    }
    const update = () => {
      const next = parse()
      setV(prev => prev === next ? prev : next)
    }
    update(); const t=setInterval(update,1000); return ()=>clearInterval(t)
  },[date,time])
  return v
}

/* ═══ WALLET + PREDICTION LOGIC ═══ */

const userDocId = (userId='') => String(userId || '').trim().toLowerCase()

async function loadWallet(userId) {
  if (!userId) return {streak:0,predictions:0,wins:0,losses:0,accuracy:0,boosters:{}}
  try {
    const ref=doc(db,'ipl_wallets',userDocId(userId))
    const snap=await getDoc(ref)
    if (snap.exists()) return snap.data()
    const init={streak:0,predictions:0,wins:0,losses:0,accuracy:0,lastLogin:null,boosters:{},createdAt:serverTimestamp()}
    await setDoc(ref,init); return init
  } catch { return {streak:0,predictions:0,wins:0,losses:0,accuracy:0,boosters:{}} }
}

async function claimDaily(userId) {
  if (!userId) return null
  try {
    const id = userDocId(userId)
    const ref=doc(db,'ipl_wallets',id)
    const snap=await getDoc(ref); const d=snap.exists()?snap.data():{}
    const today=new Date().toISOString().slice(0,10)
    if (d.lastLogin===today) return null
    const yest=new Date(Date.now()-86400000).toISOString().slice(0,10)
    const str=d.lastLogin===yest?(d.streak||0)+1:1
    const bonus=str>=7?50:str>=3?25:10
    await setDoc(ref,{streak:str,lastLogin:today},{merge:true})
    await setDoc(doc(db,'acr_users',id),{coins:increment(bonus)},{merge:true})
    return {coins:bonus,streak:str}
  } catch { return null }
}

/* ── Check existing prediction for a match ── */
async function getUserPrediction(userId, matchId) {
  if (!userId || !matchId) return null
  try {
    const q = query(
      collection(db,'ipl_predictions'),
      where('userId','==',userId),
      where('matchId','==',matchId)
    )
    const snap = await getDocs(q)
    if (snap.empty) return null
    return {id:snap.docs[0].id, ...snap.docs[0].data()}
  } catch { return null }
}

/* ── Place prediction (atomic, validates balance) ── */
/* Strip undefined values before any Firestore write */
function cleanForFirestore(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([,v]) => v !== undefined && v !== null)
  )
}

async function placePrediction(userId, matchId, winner, wager, hasFreeBooster) {
  // ── Validate required fields ──
  if (!userId)  return {error:'Login required'}
  if (!matchId) return {error:'Invalid match'}
  if (!winner)  return {error:'Select a team first'}
  if (typeof wager !== 'number' || wager < 0) return {error:'Invalid wager'}

  try {
    const id = userDocId(userId)
    // Check for existing prediction
    const existing = await getUserPrediction(id, matchId)
    if (existing) return {error:'Already predicted this match'}

    const effectiveWager = hasFreeBooster ? 0 : wager
    const userRef = doc(db,'acr_users',id)
    const walletRef = doc(db,'ipl_wallets',id)
    const predRef = doc(db,'ipl_predictions',`${id}_${String(matchId)}`)

    // Build prediction doc — strip ALL undefined/null before saving
    const predDoc = cleanForFirestore({
      userId:          id,
      matchId:         String(matchId),
      predictedWinner: String(winner),
      coinsWagered:    Number(effectiveWager),
      status:          'pending',
      createdAt:       serverTimestamp()
    })
    // Only add freeEntry if it's actually true
    if (hasFreeBooster === true) predDoc.freeEntry = true

    await runTransaction(db, async (tx) => {
      const predSnap = await tx.get(predRef)
      if (predSnap.exists()) throw new Error('Already predicted this match')
      const userSnap = await tx.get(userRef)
      const bal = Number(userSnap.exists() ? userSnap.data().coins || 0 : 0)
      if (effectiveWager > 0 && bal < effectiveWager) throw new Error('Not enough coins')

      tx.set(walletRef, { predictions: increment(1) }, { merge: true })
      tx.set(userRef, {
        coins: increment(-effectiveWager),
        predictions: increment(1),
        iplStats: {
          predictions: increment(1)
        }
      }, { merge: true })
      tx.set(predRef, predDoc)
    })
    return {ok:true, coinsDeducted: effectiveWager}
  } catch(e) { return {error:e.message} }
}

/* ── Load leaderboard ── */
async function loadLeaderboard(type='global') {
  try {
    const q = query(collection(db,'acr_users'), orderBy('coins','desc'), limit(20))
    const snap = await getDocs(q)
    return snap.docs.map((d,i)=>{
      const data = d.data()
      return {
        rank:i+1,
        userId:d.id,
        coins:data.coins || 0,
        predictions:data.predictions || data.iplStats?.predictions || 0,
        wins:data.wins || data.iplStats?.wins || 0,
        losses:data.losses || data.iplStats?.losses || 0,
      }
    })
  } catch { return [] }
}

/* ═══ UI COMPONENTS ═══ */

const LiveDot = ({sm}) => (
  <span style={{display:'inline-flex',alignItems:'center',gap:3,padding:sm?'2px 6px':'3px 9px',background:'#FEF2F2',border:'1px solid #FCA5A5',borderRadius:20}}>
    <span style={{width:sm?5:6,height:sm?5:6,borderRadius:'50%',background:C.red,display:'block',animation:'livepulse 1s ease-in-out infinite'}}/>
    <span style={{fontSize:sm?8:9,fontWeight:800,color:C.red,letterSpacing:'0.08em',fontFamily:'Poppins,sans-serif'}}>LIVE</span>
  </span>
)

const Chip=({c,label,bg,border})=>(
  <span style={{fontSize:9,fontWeight:700,padding:'2px 8px',background:bg,border:`1px solid ${border}`,borderRadius:20,color:c,fontFamily:'Poppins,sans-serif',whiteSpace:'nowrap'}}>{label}</span>
)

const Skel=({h=60,r=12})=>(
  <div style={{height:h,borderRadius:r,background:'linear-gradient(90deg,#F3F4F6 25%,#E5E7EB 50%,#F3F4F6 75%)',backgroundSize:'400% 100%',animation:'shimmer 1.4s ease-in-out infinite',marginBottom:10}}/>
)

const matchKey = (match, fallback='') => match?.id || `${match?.date || 'date'}-${match?.team1 || 'team1'}-${match?.team2 || 'team2'}-${fallback}`
const sameData = (a, b) => {
  if (a === b) return true
  try { return JSON.stringify(a) === JSON.stringify(b) } catch { return false }
}

const MatchCountdownStatus = memo(function MatchCountdownStatus({ date, time, started }) {
  const cd = useCountdown(date, time)
  if (cd) {
    return (
      <div style={{display:'inline-flex',alignItems:'center',gap:4,padding:'3px 9px',background:'#FFF7ED',border:`1px solid ${C.orange}30`,borderRadius:20}}>
        <span style={{fontSize:10}}>⏱</span>
        <span style={{fontSize:10,fontWeight:800,color:C.orange,fontFamily:'Poppins,sans-serif'}}>{cd}</span>
      </div>
    )
  }
  return started
    ? <Chip c={C.g3} label="⏸ CLOSED" bg={C.g5} border={C.g4}/>
    : <Chip c={C.blue} label="📅 UPCOMING" bg={C.blue2} border={`${C.blue}25`}/>
})

const CountdownText = memo(function CountdownText({ date, time }) {
  const cd = useCountdown(date, time)
  if (!cd) return null
  return <span style={{fontSize:10,fontWeight:700,color:C.orange,fontFamily:'Poppins,sans-serif'}}>⏱ {cd}</span>
})

const TeamLogo = memo(function TeamLogo({name,size=44,showName=true}) {
  const t=getTeam(name)
  const [err,setErr]=useState(false)
  useEffect(()=>setErr(false),[name])
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
      <div style={{width:size,height:size,borderRadius:size*0.24,overflow:'hidden',border:`2px solid ${t.c}20`,background:err?t.g:'#fff',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:`0 3px 12px ${t.c}30`,flexShrink:0}}>
        {!err&&t.logo?(
          <img src={t.logo} alt={t.s} onError={()=>setErr(true)} style={{width:'88%',height:'88%',objectFit:'contain'}}/>
        ):(
          <span style={{fontFamily:'Poppins,sans-serif',fontWeight:900,fontSize:size*0.3,color:'#fff',letterSpacing:'-0.02em'}}>{t.s}</span>
        )}
      </div>
      {showName&&<span style={{fontFamily:'Poppins,sans-serif',fontWeight:800,fontSize:Math.max(9,size*0.22),color:t.c}}>{t.s}</span>}
    </div>
  )
})

function Form({f=[]}) {
  return <div style={{display:'flex',gap:2,marginTop:2}}>
    {f.slice(-5).map((x,i)=>(
      <div key={i} style={{width:12,height:12,borderRadius:'50%',background:x==='W'?C.green:x==='L'?C.red:'#D1D5DB',display:'flex',alignItems:'center',justifyContent:'center'}}>
        <span style={{fontSize:6,fontWeight:900,color:'#fff'}}>{x}</span>
      </div>
    ))}
  </div>
}

/* ── Prediction Panel ── */
function PredictPanel({match, userId, wallet, onDone}) {
  const [picked,setPicked]   = useState(null)
  const [wager,setWager]     = useState(20)
  const [busy,setBusy]       = useState(false)
  const [done,setDone]       = useState(null)
  const [err,setErr]         = useState('')
  const hasFree  = wallet?.boosters?.free
  const has2x    = wallet?.boosters?.['2x']
  const effectiveWager = hasFree ? 0 : wager
  const potential = Math.round(effectiveWager * (has2x ? 3.6 : 1.8)) || Math.round(wager * (has2x ? 3.6 : 1.8))
  const t1=getTeam(match.team1), t2=getTeam(match.team2)

  if (done) return (
    <div style={{padding:'12px 14px',background:C.green2,borderRadius:12,border:`1px solid ${C.green}30`,display:'flex',alignItems:'center',gap:10,animation:'fadein 0.3s ease'}}>
      <span style={{fontSize:20}}>🔒</span>
      <div>
        <p style={{fontFamily:'Poppins,sans-serif',fontWeight:800,fontSize:13,color:C.green,margin:0}}>Prediction Locked!</p>
        <p style={{fontSize:11,color:C.g3,margin:0,fontFamily:'Poppins,sans-serif'}}>{done} · {effectiveWager===0?'Free entry 🎫':`${effectiveWager} coins wagered`} · Pending result</p>
      </div>
    </div>
  )

  return (
    <div style={{padding:'14px',background:'#FAFBFF',borderRadius:14,border:`1px solid ${C.blue}20`,marginTop:10}}>
      {/* Boosters active */}
      {(hasFree||has2x) && (
        <div style={{display:'flex',gap:6,marginBottom:10}}>
          {hasFree&&<div style={{padding:'3px 10px',background:'#E0F2FE',border:'1px solid #38BDF8',borderRadius:20,fontSize:10,fontWeight:700,color:'#0369A1',fontFamily:'Poppins,sans-serif'}}>🎫 Free Entry Active!</div>}
          {has2x&&<div style={{padding:'3px 10px',background:'#FEF3C7',border:'1px solid #FCD34D',borderRadius:20,fontSize:10,fontWeight:700,color:'#92400E',fontFamily:'Poppins,sans-serif'}}>⚡ 2× Booster Active!</div>}
        </div>
      )}
      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:12}}>
        <span style={{fontSize:16}}>🎯</span>
        <p style={{fontFamily:'Poppins,sans-serif',fontWeight:800,fontSize:13,color:C.g1,margin:0}}>Pick the winner</p>
        <span style={{marginLeft:'auto',padding:'2px 9px',background:C.gold2,border:`1px solid ${C.gold}40`,borderRadius:20,fontSize:10,fontWeight:800,color:C.gold,fontFamily:'Poppins,sans-serif'}}>
          Win {potential} 💰{has2x?' (2×)':''}
        </span>
      </div>

      {/* Team buttons */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
        {[match.team1,match.team2].map(team=>{
          const t=getTeam(team),sel=picked===team
          return (
            <button key={team} onClick={()=>{setPicked(team);setErr('')}} style={{padding:'12px 8px',borderRadius:12,border:sel?`2.5px solid ${t.c}`:`1.5px solid ${C.g4}`,background:sel?`${t.c}10`:'#fff',cursor:'pointer',transition:'all 0.18s',display:'flex',flexDirection:'column',alignItems:'center',gap:7,boxShadow:sel?`0 4px 14px ${t.c}22`:'0 1px 3px rgba(0,0,0,0.05)'}}>
              <TeamLogo name={team} size={44} showName={false}/>
              <p style={{fontFamily:'Poppins,sans-serif',fontWeight:800,fontSize:13,color:sel?t.c:C.g2,margin:0}}>{t.s}</p>
              {sel&&<div style={{width:20,height:3,borderRadius:2,background:t.c}}/>}
            </button>
          )
        })}
      </div>

      {/* Wager */}
      {!hasFree && (
        <>
          <p style={{fontFamily:'Poppins,sans-serif',fontSize:10,fontWeight:700,color:C.g3,textTransform:'uppercase',letterSpacing:'0.1em',margin:'0 0 7px'}}>Coins to wager</p>
          <div style={{display:'flex',gap:5,marginBottom:12}}>
            {[10,20,50,100].map(a=>(
              <button key={a} onClick={()=>setWager(a)} style={{flex:1,padding:'8px 3px',borderRadius:9,border:wager===a?`2px solid ${C.blue}`:`1px solid ${C.g4}`,background:wager===a?C.blue:'#fff',fontFamily:'Poppins,sans-serif',fontWeight:700,fontSize:12,color:wager===a?'#fff':C.g2,cursor:'pointer',transition:'all 0.14s'}}>{a}</button>
            ))}
          </div>
        </>
      )}

      {err&&<p style={{fontSize:11,color:C.red,margin:'0 0 8px',fontFamily:'Poppins,sans-serif'}}>⚠ {err}</p>}

      <button disabled={!picked||busy} onClick={async()=>{
        if(!picked) return; setBusy(true)
        const r=await placePrediction(userId,match.id,picked,wager,hasFree)
        setBusy(false)
        if(r.ok){setDone(picked);onDone?.(r.coinsDeducted)}
        else setErr(r.error)
      }} style={{width:'100%',padding:'13px',borderRadius:12,border:'none',background:picked?`linear-gradient(135deg,${C.blue},#1A3DAB)`:'#E5E7EB',color:picked?'#fff':'#9CA3AF',fontFamily:'Poppins,sans-serif',fontWeight:800,fontSize:13,cursor:picked?'pointer':'not-allowed',transition:'all 0.2s',boxShadow:picked?`0 6px 20px ${C.blue}40`:'none',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
        {busy?<><div style={{width:14,height:14,border:'2px solid rgba(255,255,255,0.3)',borderTop:'2px solid #fff',borderRadius:'50%',animation:'spin 0.7s linear infinite'}}/>Placing…</>:
          hasFree?`🎫 ${picked?`Predict ${getTeam(picked).s} (Free!)`:'Select a team first'}`:
          `🎯 ${picked?`${getTeam(picked).s} wins · ${wager} 💰`:'Select a team first'}`}
      </button>

      <p style={{fontSize:9,color:C.g3,textAlign:'center',margin:'8px 0 0',fontFamily:'Poppins,sans-serif'}}>
        Skill-based game · Coins are virtual · No monetary value
      </p>
    </div>
  )
}

/* ── Prediction Status Badge (shown after predicting) ── */
const PredictionStatus = memo(function PredictionStatus({prediction}) {
  const team = getTeam(prediction.predictedWinner)
  const statusConfig = {
    pending: {bg:'#FFF7ED',border:'#FED7AA',color:'#92400E',icon:'⏳',label:'Pending Result'},
    won:     {bg:C.green2,border:`${C.green}40`,color:C.green,icon:'🏆',label:'Correct! Coins Earned'},
    lost:    {bg:'#FEF2F2',border:'#FECACA',color:C.red,icon:'❌',label:'Incorrect'},
  }
  const s = statusConfig[prediction.status] || statusConfig.pending

  return (
    <div style={{margin:'0 0 12px',padding:'11px 14px',background:s.bg,borderRadius:14,border:`1.5px solid ${s.border}`}}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:7}}>
        <div style={{width:28,height:28,borderRadius:8,background:`${team.c}15`,border:`1px solid ${team.c}30`,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
          {team.logo?<img src={team.logo} style={{width:'88%',height:'88%',objectFit:'contain'}}/>:<span style={{fontSize:11,fontWeight:900,color:team.c}}>{team.s}</span>}
        </div>
        <div style={{flex:1}}>
          <p style={{fontFamily:'Poppins,sans-serif',fontWeight:800,fontSize:12,color:C.g1,margin:0}}>
            🔒 Your Prediction: <span style={{color:team.c}}>{team.s}</span>
          </p>
          <p style={{fontSize:10,color:C.g3,margin:0,fontFamily:'Poppins,sans-serif'}}>
            {prediction.freeEntry===true?'Free entry':(prediction.coinsWagered||0)===0?'Free':`${prediction.coinsWagered||0} coins wagered`}
            {prediction.createdAt?.seconds ? ` · ${fmtDateTime(new Date(prediction.createdAt.seconds*1000))}` : ''}
          </p>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{display:'inline-flex',alignItems:'center',gap:4,padding:'3px 8px',background:'rgba(255,255,255,0.7)',borderRadius:20,border:`1px solid ${s.border}`}}>
            <span style={{fontSize:11}}>{s.icon}</span>
            <span style={{fontSize:9,fontWeight:800,color:s.color,fontFamily:'Poppins,sans-serif'}}>{s.label}</span>
          </div>
          {prediction.status==='won'&&prediction.coinsWon&&(
            <p style={{fontSize:11,fontWeight:800,color:C.green,margin:'2px 0 0',fontFamily:'Poppins,sans-serif'}}>+{prediction.coinsWon} 💰</p>
          )}
        </div>
      </div>
    </div>
  )
})

/* ── Hero Match Card ── */
const HeroCard = memo(function HeroCard({match, userId, wallet, onPredicted, onPredictionReward, onClick}) {
  const t1=getTeam(match.team1), t2=getTeam(match.team2)
  const isLive=match.status==='live', isDone=match.status==='completed'
  const started = matchHasStarted(match)
  const canPredict = !started && userId && !isLive && !isDone
  const [showPredict,setShowPredict]   = useState(false)
  const [myPrediction,setMyPrediction] = useState(null)
  const [predLoading,setPredLoading]   = useState(false)
  const [expanded,setExpanded]         = useState(false)
  const openMatch = useCallback(()=>onClick?.(match), [match, onClick])

  // Load user's prediction for this match
  useEffect(()=>{
    if (!userId || !match.id) return
    setPredLoading(true)
    getUserPrediction(userId, match.id).then(p=>{
      setMyPrediction(p)
      if (p?.status === 'won' && p.coinsWon > 0) onPredictionReward?.(p)
      setPredLoading(false)
    })
  },[userId, match.id, onPredictionReward])

  const handlePredicted = useCallback((coinsDeducted) => {
    setShowPredict(false)
    onPredicted?.(coinsDeducted)
    // Reload prediction
    if (userId && match.id) getUserPrediction(userId, match.id).then(p => {
      setMyPrediction(p)
      if (p?.status === 'won' && p.coinsWon > 0) onPredictionReward?.(p)
    })
  }, [match.id, onPredicted, onPredictionReward, userId])

  return (
    <div style={{borderRadius:18,overflow:'hidden',background:'#fff',boxShadow:'0 6px 24px rgba(17,24,39,0.1)',marginBottom:12,border:`1px solid ${C.g4}`}}>
      {/* Team color gradient header */}
      <div style={{background:`linear-gradient(135deg,${t1.c}15,#fff 45%,${t2.c}15)`,padding:'12px 14px 0',position:'relative'}}>
        <div style={{position:'absolute',bottom:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${t1.c},${t1.c}80 45%,${t2.c}80 55%,${t2.c})`}}/>

        {/* Status + time */}
        <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:14,paddingBottom:12}}>
          {isLive&&<LiveDot/>}
          {isDone&&<Chip c={C.green} label="✓ RESULT" bg={C.green2} border={`${C.green}30`}/>}
          {!isLive&&!isDone&&<MatchCountdownStatus date={match.date} time={match.time} started={started}/>}
          <span style={{marginLeft:'auto',fontSize:11,fontWeight:700,color:C.g2,fontFamily:'Poppins,sans-serif'}}>{fmtTime(match.time)}</span>
        </div>
      </div>

      <div style={{padding:'14px'}}>
        {/* Teams */}
        <div style={{display:'grid',gridTemplateColumns:'1fr auto 1fr',alignItems:'center',gap:10,marginBottom:12}} onClick={openMatch}>
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6,cursor:'pointer'}}>
            <TeamLogo name={match.team1} size={54}/>
            {/* Score shown here ONLY for completed matches — live scores shown in strip below */}
            {isDone&&match.score1&&<p style={{fontFamily:'Poppins,sans-serif',fontWeight:900,fontSize:15,color:C.g1,margin:0,textAlign:'center'}}>{match.score1}</p>}
          </div>
          <div style={{textAlign:'center'}}>
            {isDone?<div style={{padding:'4px 9px',background:C.g5,borderRadius:8}}><span style={{fontSize:9,fontWeight:800,color:C.g3,fontFamily:'Poppins,sans-serif'}}>FINAL</span></div>:
             isLive?<LiveDot/>:
             <div style={{width:38,height:38,borderRadius:'50%',background:C.g5,border:`1.5px solid ${C.g4}`,display:'flex',alignItems:'center',justifyContent:'center'}}>
               <span style={{fontSize:11,fontWeight:800,color:C.g3,fontFamily:'Poppins,sans-serif'}}>VS</span>
             </div>}
          </div>
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6,cursor:'pointer'}}>
            <TeamLogo name={match.team2} size={54}/>
            {isDone&&match.score2&&<p style={{fontFamily:'Poppins,sans-serif',fontWeight:900,fontSize:15,color:C.g1,margin:0,textAlign:'center'}}>{match.score2}</p>}
          </div>
        </div>

        {/* Result */}
        {isDone&&match.result&&(
          <div style={{padding:'8px 12px',background:C.green2,border:`1px solid ${C.green}25`,borderRadius:11,textAlign:'center',marginBottom:10}}>
            <p style={{fontSize:12,fontWeight:700,color:C.green,margin:0,fontFamily:'Poppins,sans-serif'}}>🏆 {match.result}</p>
          </div>
        )}

        {/* Venue */}
        <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:myPrediction||canPredict?10:0}}>
          <span style={{fontSize:11}}>📍</span>
          <p style={{fontSize:10,color:C.g3,margin:0,fontFamily:'Poppins,sans-serif',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{match.venue?.split(',')[0]||'TBD'}</p>
        </div>

        {/* ── PREDICTION STATUS (if already predicted) ── */}
        {myPrediction && !predLoading && (
          <PredictionStatus prediction={myPrediction}/>
        )}

        {/* ── PREDICT BUTTON (only if can predict and no existing prediction) ── */}
        {canPredict && !myPrediction && !predLoading && (
          <>
            <button onClick={e=>{e.stopPropagation();setShowPredict(s=>!s)}} style={{width:'100%',padding:'10px',borderRadius:11,border:'none',background:showPredict?C.blue:`linear-gradient(135deg,#FF6B00,#E05000)`,color:'#fff',fontFamily:'Poppins,sans-serif',fontWeight:800,fontSize:12,cursor:'pointer',boxShadow:`0 4px 14px ${showPredict?C.blue:C.orange}45`,transition:'all 0.2s',display:'flex',alignItems:'center',justifyContent:'center',gap:7}}>
              🎯 {showPredict?'Close Prediction':'Predict & Win Coins'} {!showPredict&&<span style={{fontSize:10,opacity:0.8}}>💰</span>}
            </button>
            {showPredict&&<PredictPanel match={match} userId={userId} wallet={wallet} onDone={handlePredicted}/>}
          </>
        )}

        {/* Prediction closed */}
        {started && !myPrediction && !isLive && !isDone && (
          <div style={{padding:'8px 12px',background:C.g5,border:`1px solid ${C.g4}`,borderRadius:10,textAlign:'center'}}>
            <p style={{fontSize:11,color:C.g3,margin:0,fontFamily:'Poppins,sans-serif'}}>⏸ Predictions closed · Match in progress</p>
          </div>
        )}

        {/* ── View Details toggle ── */}
        <button onClick={()=>setExpanded(e=>!e)}
          style={{width:'100%',marginTop:10,padding:'7px',borderRadius:10,border:`1px solid ${C.g4}`,
            background:'transparent',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:5,
            fontFamily:'Poppins,sans-serif',fontWeight:700,fontSize:11,color:C.g3,transition:'all 0.18s'}}
          onMouseEnter={e=>{e.currentTarget.style.background=C.g5;e.currentTarget.style.color=C.g2}}
          onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color=C.g3}}>
          <span style={{transition:'transform 0.25s',transform:expanded?'rotate(180deg)':'rotate(0deg)',display:'inline-block'}}>▼</span>
          {expanded ? 'Hide Details' : 'View Details'}
        </button>

        {/* ── Expandable Details Section ── */}
        <div style={{
          overflow:'hidden',
          maxHeight: expanded ? 600 : 0,
          opacity:   expanded ? 1 : 0,
          transition:'max-height 0.3s ease, opacity 0.25s ease',
          marginTop: expanded ? 10 : 0,
        }}>
          <div style={{borderTop:`1px solid ${C.g4}`,paddingTop:10,display:'flex',flexDirection:'column',gap:7}}>

            {/* Match Info */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
              {[
                {icon:'📍', label:'Venue',  value: match?.venue?.split(',')[0] || 'TBD'},
                {icon:'🏆', label:'Status', value: (match?.status||'upcoming').charAt(0).toUpperCase()+(match?.status||'upcoming').slice(1)},
                {icon:'📅', label:'Date',   value: fmtDate(match?.date)},
                {icon:'⏰', label:'Time',   value: fmtTime(match?.time)},
              ].map((row,i)=>(
                <div key={i} style={{padding:'7px 9px',background:C.g5,borderRadius:9,border:`1px solid ${C.g4}`}}>
                  <p style={{fontSize:8,fontWeight:700,color:C.g3,textTransform:'uppercase',letterSpacing:'0.06em',margin:'0 0 2px',fontFamily:'Poppins,sans-serif'}}>{row.icon} {row.label}</p>
                  <p style={{fontSize:11,fontWeight:700,color:C.g1,margin:0,fontFamily:'Poppins,sans-serif',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{row.value}</p>
                </div>
              ))}
            </div>

            {/* Toss */}
            {match?.toss && (
              <div style={{padding:'7px 10px',background:`${C.gold}08`,border:`1px solid ${C.gold}20`,borderRadius:9,display:'flex',alignItems:'center',gap:7}}>
                <span style={{fontSize:14}}>🪙</span>
                <div>
                  <p style={{fontSize:8,fontWeight:700,color:C.gold,textTransform:'uppercase',letterSpacing:'0.06em',margin:'0 0 1px',fontFamily:'Poppins,sans-serif'}}>Toss</p>
                  <p style={{fontSize:11,fontWeight:700,color:C.g1,margin:0,fontFamily:'Poppins,sans-serif'}}>{match.toss}</p>
                </div>
              </div>
            )}

            {/* Batting/Bowling teams */}
            {(match?.batting || match?.bowling) && (
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                {match?.batting && (
                  <div style={{padding:'7px 9px',background:`${C.green}06`,border:`1px solid ${C.green}18`,borderRadius:9}}>
                    <p style={{fontSize:8,fontWeight:700,color:C.green,textTransform:'uppercase',letterSpacing:'0.06em',margin:'0 0 2px',fontFamily:'Poppins,sans-serif'}}>🏏 Batting</p>
                    <p style={{fontSize:11,fontWeight:700,color:C.g1,margin:0,fontFamily:'Poppins,sans-serif'}}>{match.batting}</p>
                  </div>
                )}
                {match?.bowling && (
                  <div style={{padding:'7px 9px',background:`${C.blue}06`,border:`1px solid ${C.blue}18`,borderRadius:9}}>
                    <p style={{fontSize:8,fontWeight:700,color:C.blue,textTransform:'uppercase',letterSpacing:'0.06em',margin:'0 0 2px',fontFamily:'Poppins,sans-serif'}}>🎯 Bowling</p>
                    <p style={{fontSize:11,fontWeight:700,color:C.g1,margin:0,fontFamily:'Poppins,sans-serif'}}>{match.bowling}</p>
                  </div>
                )}
              </div>
            )}

            {/* Live score with CRR/RRR */}
            {isLive && (match?.score1 || match?.score2) && (
              <div style={{display:'grid',gridTemplateColumns:'1fr auto 1fr',gap:6}}>
                <div style={{padding:'8px 10px',background:`${t1.c}06`,border:`1px solid ${t1.c}15`,borderRadius:10,textAlign:'center'}}>
                  <p style={{fontFamily:'Poppins,sans-serif',fontWeight:900,fontSize:15,color:t1.c,margin:'0 0 2px'}}>{match?.score1||'—'}</p>
                  {match?.crr && <p style={{fontSize:9,color:C.g3,margin:0,fontFamily:'Poppins,sans-serif'}}>CRR {match.crr}</p>}
                </div>
                <div style={{display:'flex',alignItems:'center'}}><span style={{fontSize:11,color:C.g4,fontWeight:700}}>v</span></div>
                <div style={{padding:'8px 10px',background:`${t2.c}06`,border:`1px solid ${t2.c}15`,borderRadius:10,textAlign:'center'}}>
                  <p style={{fontFamily:'Poppins,sans-serif',fontWeight:900,fontSize:15,color:t2.c,margin:'0 0 2px'}}>{match?.score2||'—'}</p>
                  {match?.rrr && <p style={{fontSize:9,color:C.g3,margin:0,fontFamily:'Poppins,sans-serif'}}>RRR {match.rrr}</p>}
                </div>
              </div>
            )}

            {/* Batsmen at crease */}
            {match?.batsmen?.length > 0 && (
              <div style={{padding:'8px 10px',background:C.g5,border:`1px solid ${C.g4}`,borderRadius:10}}>
                <p style={{fontSize:8,fontWeight:700,color:C.g3,textTransform:'uppercase',letterSpacing:'0.07em',margin:'0 0 7px',fontFamily:'Poppins,sans-serif'}}>🏏 At Crease</p>
                {match.batsmen.map((b,i)=>(
                  <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:i<match.batsmen.length-1?5:0}}>
                    <p style={{fontSize:11,fontWeight:b?.onStrike?800:600,color:b?.onStrike?C.g1:C.g2,margin:0,fontFamily:'Poppins,sans-serif'}}>
                      {b?.onStrike?'★ ':''}{b?.name||'—'}
                    </p>
                    <p style={{fontSize:11,fontWeight:700,color:C.g1,margin:0,fontFamily:'Poppins,sans-serif'}}>
                      {b?.runs??'—'}<span style={{fontSize:9,color:C.g3,fontWeight:400}}> ({b?.balls??0})</span>
                      <span style={{fontSize:9,color:C.g3,marginLeft:4}}>SR {b?.sr||'—'}</span>
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Current bowler */}
            {match?.bowler && (
              <div style={{padding:'8px 10px',background:C.g5,border:`1px solid ${C.g4}`,borderRadius:10}}>
                <p style={{fontSize:8,fontWeight:700,color:C.g3,textTransform:'uppercase',letterSpacing:'0.07em',margin:'0 0 5px',fontFamily:'Poppins,sans-serif'}}>🎯 Current Bowler</p>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <p style={{fontSize:11,fontWeight:700,color:C.g1,margin:0,fontFamily:'Poppins,sans-serif'}}>{match.bowler?.name||'—'}</p>
                  <p style={{fontSize:10,color:C.g2,margin:0,fontFamily:'Poppins,sans-serif'}}>
                    {match.bowler?.overs||0}-{match.bowler?.runs||0}-{match.bowler?.wickets||0}
                    <span style={{color:C.g3}}> · Econ {match.bowler?.econ||'—'}</span>
                  </p>
                </div>
              </div>
            )}

            {/* Partnership */}
            {match?.partnership && (
              <div style={{display:'flex',alignItems:'center',gap:7,padding:'7px 10px',background:C.g5,border:`1px solid ${C.g4}`,borderRadius:9}}>
                <span style={{fontSize:14}}>🤝</span>
                <p style={{fontSize:11,color:C.g2,margin:0,fontFamily:'Poppins,sans-serif'}}>
                  Partnership: <span style={{fontWeight:800,color:C.g1}}>{match.partnership?.runs||0} runs</span>
                  <span style={{color:C.g3}}> ({match.partnership?.balls||0} balls)</span>
                </p>
              </div>
            )}

            {/* Last over */}
            {match?.lastOver?.length > 0 && (
              <div style={{display:'flex',alignItems:'center',gap:7,flexWrap:'wrap'}}>
                <p style={{fontSize:9,color:C.g3,fontFamily:'Poppins,sans-serif',fontWeight:700,flexShrink:0,margin:0}}>Last over:</p>
                <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                  {match.lastOver.map((ball,i)=>{
                    const isW=ball==='W', is4=ball==='4', is6=ball==='6'
                    return (
                      <div key={i} style={{width:24,height:24,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',
                        fontSize:9,fontWeight:800,fontFamily:'Poppins,sans-serif',
                        background:isW?C.red:is6?C.green:is4?C.blue:C.g5,
                        color:isW||is6||is4?'#fff':C.g2,
                        border:`1px solid ${isW?`${C.red}40`:is6?`${C.green}40`:is4?`${C.blue}40`:C.g4}`}}>
                        {ball}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Man of the Match */}
            {match?.motm && (
              <div style={{padding:'7px 10px',background:'linear-gradient(135deg,#fffbeb,#fef3c7)',border:`1px solid ${C.gold}30`,borderRadius:9,display:'flex',alignItems:'center',gap:7}}>
                <span style={{fontSize:16}}>🏅</span>
                <div>
                  <p style={{fontSize:8,fontWeight:700,color:C.gold,textTransform:'uppercase',letterSpacing:'0.06em',margin:'0 0 1px',fontFamily:'Poppins,sans-serif'}}>Man of the Match</p>
                  <p style={{fontSize:11,fontWeight:700,color:C.g1,margin:0,fontFamily:'Poppins,sans-serif'}}>{match.motm}</p>
                </div>
              </div>
            )}

            {/* Result margin */}
            {isDone && match?.result && (
              <div style={{padding:'8px 12px',background:C.green2,border:`1px solid ${C.green}25`,borderRadius:10,textAlign:'center'}}>
                <p style={{fontSize:12,fontWeight:700,color:C.green,margin:0,fontFamily:'Poppins,sans-serif'}}>🏆 {match.result}</p>
              </div>
            )}

            {/* No extra data fallback */}
            {!match?.toss && !match?.batting && !match?.bowler && !match?.batsmen?.length && !match?.lastOver?.length && (
              <p style={{fontSize:11,color:C.g3,textAlign:'center',fontFamily:'Poppins,sans-serif',margin:'4px 0'}}>
                Detailed stats unavailable — data updates during live match
              </p>
            )}
          </div>
        </div>

      </div>
    </div>
  )
})

/* ── Result Card ── */
const ResultCard = memo(function ResultCard({match, userId, onPredictionReward, onClick}) {
  const t1=getTeam(match.team1),t2=getTeam(match.team2)
  const [myPred,setMyPred]=useState(null)
  const openMatch = useCallback(()=>onClick?.(match), [match, onClick])
  useEffect(()=>{ if(userId&&match.id) getUserPrediction(userId,match.id).then(p => {
    setMyPred(p)
    if (p?.status === 'won' && p.coinsWon > 0) onPredictionReward?.(p)
  }) },[userId,match.id,onPredictionReward])

  return (
    <div onClick={openMatch} style={{borderRadius:14,background:'#fff',border:`1px solid ${C.g4}`,boxShadow:'0 2px 10px rgba(17,24,39,0.07)',marginBottom:8,overflow:'hidden',cursor:'pointer'}}>
      <div style={{height:3,background:`linear-gradient(90deg,${t1.c},${t2.c})`}}/>
      <div style={{padding:'10px 13px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
          <Chip c={C.green} label="✓ RESULT" bg={C.green2} border={`${C.green}30`}/>
          <div style={{display:'flex',alignItems:'center',gap:7}}>
            {myPred&&(
              <Chip
                c={myPred.status==='won'?C.green:myPred.status==='lost'?C.red:C.g3}
                label={myPred.status==='won'?`🏆 Won!`:myPred.status==='lost'?'❌ Lost':'⏳ Pending'}
                bg={myPred.status==='won'?C.green2:myPred.status==='lost'?C.red2:C.g5}
                border={myPred.status==='won'?`${C.green}30`:myPred.status==='lost'?`${C.red}30`:C.g4}
              />
            )}
            <span style={{fontSize:10,color:C.g3,fontFamily:'Poppins,sans-serif'}}>{fmtDate(match.date)}</span>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr auto 1fr',alignItems:'center',gap:8}}>
          <div style={{display:'flex',alignItems:'center',gap:7}}>
            <TeamLogo name={match.team1} size={32} showName={false}/>
            <div>
              <p style={{fontFamily:'Poppins,sans-serif',fontWeight:800,fontSize:12,color:t1.c,margin:0}}>{t1.s}</p>
              {match.score1&&<p style={{fontSize:11,fontWeight:700,color:C.g1,margin:0,fontFamily:'Poppins,sans-serif'}}>{match.score1}</p>}
            </div>
          </div>
          <span style={{color:C.g4}}>v</span>
          <div style={{display:'flex',alignItems:'center',gap:7,justifyContent:'flex-end'}}>
            <div style={{textAlign:'right'}}>
              <p style={{fontFamily:'Poppins,sans-serif',fontWeight:800,fontSize:12,color:t2.c,margin:0}}>{t2.s}</p>
              {match.score2&&<p style={{fontSize:11,fontWeight:700,color:C.g1,margin:0,fontFamily:'Poppins,sans-serif'}}>{match.score2}</p>}
            </div>
            <TeamLogo name={match.team2} size={32} showName={false}/>
          </div>
        </div>
        {match.result&&<p style={{fontSize:11,fontWeight:700,color:C.green,margin:'7px 0 0',fontFamily:'Poppins,sans-serif',paddingTop:6,borderTop:`1px solid ${C.g4}`}}>🏆 {match.result}</p>}
      </div>
    </div>
  )
})

/* ── Upcoming Card ── */
const UpCard = memo(function UpCard({match,userId,wallet,onPredicted,onPredictionReward}) {
  const t1=getTeam(match.team1),t2=getTeam(match.team2)
  const [myPred,setMyPred]=useState(null)
  const [showP,setShowP]=useState(false)
  const canPredict=!matchHasStarted(match)&&userId
  const handleDone = useCallback((c)=>{
    onPredicted?.(c)
    getUserPrediction(userId,match.id).then(setMyPred)
    setShowP(false)
  }, [match.id, onPredicted, userId])

  useEffect(()=>{ if(userId&&match.id) getUserPrediction(userId,match.id).then(p => {
    setMyPred(p)
    if (p?.status === 'won' && p.coinsWon > 0) onPredictionReward?.(p)
  }) },[userId,match.id,onPredictionReward])

  return (
    <div style={{borderRadius:16,background:'#fff',border:`1px solid ${C.g4}`,boxShadow:'0 2px 10px rgba(17,24,39,0.07)',marginBottom:10,overflow:'hidden'}}>
      <div style={{height:3,background:`linear-gradient(90deg,${t1.c},${t2.c})`}}/>
      <div style={{padding:'12px 13px'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
          <div style={{display:'flex',alignItems:'center',gap:7}}>
            <Chip c={C.blue} label={match.dayLabel||fmtDate(match.date)} bg={C.blue2} border={`${C.blue}20`}/>
            <CountdownText date={match.date} time={match.time}/>
          </div>
          <span style={{fontSize:11,fontWeight:700,color:C.g2,fontFamily:'Poppins,sans-serif'}}>{fmtTime(match.time)}</span>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr auto 1fr',alignItems:'center',gap:10,marginBottom:10}}>
          <TeamLogo name={match.team1} size={44}/>
          <div style={{width:28,height:28,borderRadius:'50%',background:C.g5,border:`1px solid ${C.g4}`,display:'flex',alignItems:'center',justifyContent:'center'}}><span style={{fontSize:9,fontWeight:800,color:C.g3,fontFamily:'Poppins,sans-serif'}}>VS</span></div>
          <TeamLogo name={match.team2} size={44}/>
        </div>
        <p style={{fontSize:9,color:C.g3,margin:'0 0 9px',fontFamily:'Poppins,sans-serif',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>📍 {match.venue?.split(',')[0]||'TBD'}</p>

        {myPred ? (
          <PredictionStatus prediction={myPred}/>
        ) : canPredict ? (
          <>
            <button onClick={()=>setShowP(s=>!s)} style={{width:'100%',padding:'9px',borderRadius:10,border:'none',background:showP?C.blue:`linear-gradient(135deg,${C.orange},#E05000)`,color:'#fff',fontFamily:'Poppins,sans-serif',fontWeight:700,fontSize:11,cursor:'pointer',boxShadow:`0 3px 12px ${showP?C.blue:C.orange}40`,transition:'all 0.2s'}}>
              {showP?'✕ Close':'🎯 Predict & Win 💰'}
            </button>
            {showP&&<div style={{marginTop:10}}><PredictPanel match={match} userId={userId} wallet={wallet} onDone={handleDone}/></div>}
          </>
        ) : null}
      </div>
    </div>
  )
})

/* ── Points Table ── */
const Table = memo(function Table({points=[]}) {
  const [all,setAll]=useState(false)
  const rows=useMemo(()=>all?points:points.slice(0,6),[all,points])
  if(!points.length) return <div style={{padding:'20px',textAlign:'center',background:'#fff',borderRadius:14,border:`1px solid ${C.g4}`}}><p style={{fontSize:12,color:C.g3,fontFamily:'Poppins,sans-serif'}}>Standings loading…</p></div>
  return (
    <div style={{borderRadius:16,background:'#fff',border:`1px solid ${C.g4}`,overflow:'hidden',boxShadow:'0 2px 10px rgba(17,24,39,0.07)'}}>
      <div style={{display:'grid',gridTemplateColumns:'26px 1fr 26px 26px 26px 46px 28px',gap:3,padding:'9px 12px',background:C.g5,borderBottom:`1px solid ${C.g4}`}}>
        {['#','TEAM','P','W','L','NRR','PTS'].map((h,i)=><p key={i} style={{fontSize:8,fontWeight:800,color:C.g3,margin:0,textAlign:i>1?'center':'left',textTransform:'uppercase',letterSpacing:'0.06em',fontFamily:'Poppins,sans-serif'}}>{h}</p>)}
      </div>
      {rows.map((row,i)=>{
        const t=getTeam(row.team),top4=row.rank<=4
        return (
          <div key={row.team || i} style={{display:'grid',gridTemplateColumns:'26px 1fr 26px 26px 26px 46px 28px',gap:3,padding:'9px 12px',borderBottom:`1px solid ${C.g4}`,background:top4?`${t.c}04`:'#fff',alignItems:'center'}}>
            <div style={{width:18,height:18,borderRadius:'50%',background:top4?t.c:C.g4,display:'flex',alignItems:'center',justifyContent:'center'}}><span style={{fontSize:8,fontWeight:800,color:top4?'#fff':C.g3,fontFamily:'Poppins,sans-serif'}}>{row.rank}</span></div>
            <div style={{display:'flex',alignItems:'center',gap:5,minWidth:0}}>
              <div style={{width:20,height:20,borderRadius:5,overflow:'hidden',background:t.bg,flexShrink:0}}>
                <TeamLogo name={row.team} size={20} showName={false}/>
              </div>
              <div style={{minWidth:0}}>
                <p style={{fontFamily:'Poppins,sans-serif',fontWeight:700,fontSize:11,color:C.g1,margin:0,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{t.s}</p>
                {row.form?.length>0&&<Form f={row.form}/>}
              </div>
            </div>
            {[row.p,row.w,row.l].map((v,j)=><p key={j} style={{fontFamily:'Poppins,sans-serif',fontSize:11,fontWeight:600,color:C.g2,margin:0,textAlign:'center'}}>{v}</p>)}
            <p style={{fontFamily:'Poppins,sans-serif',fontSize:10,fontWeight:700,color:parseFloat(row.nrr)>=0?C.green:C.red,margin:0,textAlign:'center'}}>{row.nrr}</p>
            <div style={{textAlign:'center'}}><span style={{fontSize:12,fontWeight:900,color:top4?t.c:C.g1,fontFamily:'Poppins,sans-serif',padding:'1px 5px',background:top4?`${t.c}10`:'transparent',borderRadius:6}}>{row.pts}</span></div>
          </div>
        )
      })}
      <div style={{padding:'9px 12px',background:C.g5,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div style={{display:'flex',alignItems:'center',gap:5}}><div style={{width:7,height:7,borderRadius:'50%',background:C.blue}}/><span style={{fontSize:9,color:C.g3,fontFamily:'Poppins,sans-serif',fontWeight:600}}>Top 4 → Playoffs</span></div>
        {points.length>6&&<button onClick={()=>setAll(s=>!s)} style={{background:'none',border:'none',fontSize:10,fontWeight:700,color:C.blue,cursor:'pointer',fontFamily:'Poppins,sans-serif'}}>{all?'Less ↑':`All ${points.length} →`}</button>}
      </div>
    </div>
  )
})

/* ── Cap Card ── */
const CapCard = memo(function CapCard({data,type}) {
  const isO=type==='orange',acc=isO?C.orange:C.purple,bg2=isO?C.orange2:C.purple2
  const t=getTeam(data?.team||'')
  const stats=useMemo(()=>isO?[{l:'Runs',v:data?.runs},{l:'Avg',v:data?.avg},{l:'S/R',v:data?.sr},{l:'HS',v:data?.hs}]:[{l:'Wkts',v:data?.wickets},{l:'Econ',v:data?.economy},{l:'Avg',v:data?.avg},{l:'Best',v:data?.best}],[data,isO])
  return (
    <div style={{borderRadius:16,background:'#fff',border:`1.5px solid ${acc}25`,overflow:'hidden',boxShadow:`0 4px 18px ${acc}15`,marginBottom:10}}>
      <div style={{background:`linear-gradient(135deg,${acc},${acc}CC)`,padding:'12px 14px'}}>
        <p style={{fontFamily:'Poppins,sans-serif',fontWeight:800,fontSize:14,color:'#fff',margin:0}}>{isO?'🟠 Orange Cap':'🟣 Purple Cap'}</p>
        <p style={{fontSize:9,color:'rgba(255,255,255,0.7)',margin:0,fontFamily:'Poppins,sans-serif'}}>IPL 2025 Leader</p>
      </div>
      {data?(
        <div style={{padding:'12px 14px'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12,padding:'10px',background:bg2,borderRadius:11,border:`1px solid ${acc}20`}}>
            <TeamLogo name={data.team||''} size={40} showName={false}/>
            <div style={{minWidth:0}}>
              <p style={{fontFamily:'Poppins,sans-serif',fontWeight:800,fontSize:14,color:C.g1,margin:'0 0 2px',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{data.name}</p>
              <p style={{fontSize:10,fontWeight:700,color:t.c,margin:0,fontFamily:'Poppins,sans-serif'}}>{t.s} · {data.matches}M</p>
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6}}>
            {stats.map((s,i)=>(
              <div key={i} style={{textAlign:'center',padding:'9px 4px',background:i===0?`${acc}08`:C.g5,borderRadius:10,border:`1px solid ${i===0?`${acc}20`:C.g4}`}}>
                <p style={{fontFamily:'Poppins,sans-serif',fontWeight:900,fontSize:i===0?18:13,color:i===0?acc:C.g1,margin:'0 0 1px'}}>{s.v??'—'}</p>
                <p style={{fontSize:8,fontWeight:700,color:C.g3,textTransform:'uppercase',letterSpacing:'0.07em',margin:0,fontFamily:'Poppins,sans-serif'}}>{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      ):(
        <div style={{padding:'16px',textAlign:'center'}}><p style={{fontSize:11,color:C.g3,fontFamily:'Poppins,sans-serif'}}>Updates daily at 4 AM via Sportmonks</p></div>
      )}
    </div>
  )
})

/* ── Leaderboard ── */
const Leaderboard = memo(function Leaderboard({userId}) {
  const [data,setData]=useState([])
  const [loading,setLoading]=useState(true)
  const [tab,setTab]=useState('global')
  useEffect(()=>{ loadLeaderboard(tab).then(d=>{setData(prev => sameData(prev, d) ? prev : d);setLoading(false)}) },[tab])

  return (
    <div>
      <div style={{display:'flex',gap:6,marginBottom:12}}>
        {['global','weekly'].map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:'8px',borderRadius:10,border:'none',background:tab===t?C.blue:'#fff',color:tab===t?'#fff':C.g2,fontFamily:'Poppins,sans-serif',fontWeight:700,fontSize:11,cursor:'pointer',boxShadow:tab===t?`0 3px 12px ${C.blue}35`:`0 1px 3px rgba(0,0,0,0.07)`,transition:'all 0.15s'}}>
            {t==='global'?'🌍 Global':'📅 This Week'}
          </button>
        ))}
      </div>
      {loading?<><Skel h={50}/><Skel h={50}/><Skel h={50}/></>:(
        <div style={{borderRadius:14,background:'#fff',border:`1px solid ${C.g4}`,overflow:'hidden',boxShadow:'0 2px 10px rgba(17,24,39,0.07)'}}>
          {data.length===0?(
            <div style={{padding:'20px',textAlign:'center'}}><p style={{fontSize:12,color:C.g3,fontFamily:'Poppins,sans-serif'}}>No data yet — make predictions to appear!</p></div>
          ):data.map((row,i)=>{
            const isMe=row.userId===userId
            const medals=['🥇','🥈','🥉']
            return (
              <div key={row.userId || i} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 13px',borderBottom:i<data.length-1?`1px solid ${C.g4}`:'none',background:isMe?C.blue2:'#fff'}}>
                <span style={{fontSize:i<3?16:13,width:22,textAlign:'center',flexShrink:0}}>{i<3?medals[i]:i+1}</span>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{fontFamily:'Poppins,sans-serif',fontWeight:700,fontSize:12,color:isMe?C.blue:C.g1,margin:0,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                    {row.userId} {isMe&&<span style={{fontSize:10,color:C.blue}}>(You)</span>}
                  </p>
                  <p style={{fontSize:10,color:C.g3,margin:0,fontFamily:'Poppins,sans-serif'}}>{row.predictions||0} predictions · {row.wins||0} wins</p>
                </div>
                <div style={{textAlign:'right',flexShrink:0}}>
                  <p style={{fontFamily:'Poppins,sans-serif',fontWeight:800,fontSize:13,color:C.gold,margin:0}}>{(row.coins||0).toLocaleString()} 💰</p>
                  <p style={{fontSize:9,color:C.g3,margin:0,fontFamily:'Poppins,sans-serif'}}>{row.predictions>0?Math.round(((row.wins||0)/row.predictions)*100):0}% accuracy</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
})

/* ── User Stats Strip ── */
const StatsStrip = memo(function StatsStrip({wallet, coins=0}) {
  const acc = wallet?.predictions>0 ? Math.round(((wallet.wins||0)/wallet.predictions)*100) : 0
  const stats=useMemo(()=>[
    {icon:'🎯',label:'Predictions',value:wallet?.predictions||0,color:C.blue},
    {icon:'🏆',label:'Wins',value:wallet?.wins||0,color:C.green},
    {icon:'📊',label:'Accuracy',value:`${acc}%`,color:C.purple},
    {icon:'🔥',label:'Streak',value:`${wallet?.streak||0}d`,color:C.orange},
    {icon:'💰',label:'Coins',value:Number(coins || 0).toLocaleString(),color:C.gold},
  ],[acc, coins, wallet?.predictions, wallet?.streak, wallet?.wins])
  if (!wallet) return null
  return (
    <div style={{borderRadius:12,background:'#fff',border:`1px solid ${C.g4}`,padding:'10px 12px',marginBottom:12,boxShadow:'0 2px 8px rgba(17,24,39,0.06)'}}>
      <p style={{fontSize:9,fontWeight:800,color:C.g3,textTransform:'uppercase',letterSpacing:'0.1em',margin:'0 0 8px',fontFamily:'Poppins,sans-serif'}}>Your Stats</p>
      <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:6}}>
        {stats.map((s,i)=>(
          <div key={i} style={{textAlign:'center'}}>
            <p style={{fontSize:13,margin:'0 0 1px'}}>{s.icon}</p>
            <p style={{fontFamily:'Poppins,sans-serif',fontWeight:800,fontSize:12,color:s.color,margin:'0 0 1px',lineHeight:1}}>{s.value}</p>
            <p style={{fontSize:7,color:C.g3,margin:0,fontFamily:'Poppins,sans-serif',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em'}}>{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
})

/* ── Match Detail ── */
function Detail({match,onClose}) {
  const t1=getTeam(match.team1),t2=getTeam(match.team2)
  const isLive=match.status==='live',isDone=match.status==='completed'
  return (
    <div style={{position:'fixed',inset:0,zIndex:900,background:C.bg,overflowY:'auto',animation:'slideup2 0.3s ease-out'}}>
      <div style={{position:'sticky',top:0,zIndex:10,background:'#fff',borderBottom:`1px solid ${C.g4}`,padding:'12px 14px',display:'flex',alignItems:'center',gap:10,boxShadow:'0 2px 10px rgba(17,24,39,0.08)'}}>
        <button onClick={onClose} style={{width:34,height:34,borderRadius:10,background:C.g5,border:`1px solid ${C.g4}`,cursor:'pointer',fontSize:17,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>←</button>
        <div style={{flex:1,display:'flex',alignItems:'center',gap:8}}>
          <TeamLogo name={match.team1} size={24} showName={false}/>
          <p style={{fontFamily:'Poppins,sans-serif',fontWeight:800,fontSize:14,color:C.g1,margin:0}}>{t1.s} vs {t2.s}</p>
          <TeamLogo name={match.team2} size={24} showName={false}/>
        </div>
        {isLive&&<LiveDot sm/>}
      </div>
      <div style={{padding:'14px 14px 80px'}}>
        <div style={{borderRadius:18,overflow:'hidden',background:'#fff',border:`1px solid ${C.g4}`,marginBottom:12,boxShadow:'0 4px 18px rgba(17,24,39,0.08)'}}>
          <div style={{height:4,background:`linear-gradient(90deg,${t1.c} 0%,${t1.c} 48%,${t2.c} 52%,${t2.c} 100%)`}}/>
          <div style={{padding:'18px 14px'}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr auto 1fr',alignItems:'center',gap:10,marginBottom:14}}>
              <div style={{textAlign:'center'}}>
                <TeamLogo name={match.team1} size={56} showName={false}/>
                <p style={{fontFamily:'Poppins,sans-serif',fontWeight:800,fontSize:14,color:t1.c,margin:'8px 0 3px'}}>{t1.s}</p>
                {match.score1&&<p style={{fontFamily:'Poppins,sans-serif',fontWeight:900,fontSize:18,color:C.g1,margin:0}}>{match.score1}</p>}
              </div>
              <div style={{textAlign:'center'}}>
                {isLive?<LiveDot/>:isDone?<span style={{fontSize:10,fontWeight:800,color:C.g3,fontFamily:'Poppins,sans-serif'}}>FINAL</span>:<span style={{fontSize:14,fontWeight:800,color:C.g3}}>VS</span>}
              </div>
              <div style={{textAlign:'center'}}>
                <TeamLogo name={match.team2} size={56} showName={false}/>
                <p style={{fontFamily:'Poppins,sans-serif',fontWeight:800,fontSize:14,color:t2.c,margin:'8px 0 3px'}}>{t2.s}</p>
                {match.score2&&<p style={{fontFamily:'Poppins,sans-serif',fontWeight:900,fontSize:18,color:C.g1,margin:0}}>{match.score2}</p>}
              </div>
            </div>
            {match.result&&<div style={{padding:'9px 12px',background:C.green2,borderRadius:11,textAlign:'center',border:`1px solid ${C.green}25`}}><p style={{fontSize:12,fontWeight:700,color:C.green,margin:0,fontFamily:'Poppins,sans-serif'}}>🏆 {match.result}</p></div>}
          </div>
        </div>
        {[
          {i:'📅',l:'Date',   v:fmtDate(match.date)},
          {i:'⏰',l:'Time',   v:fmtTime(match.time)},
          {i:'📍',l:'Venue',  v:match.venue||'TBD'},
          ...(match.toss ? [{i:'🪙',l:'Toss',v:match.toss}] : []),
          ...(match.motm ? [{i:'🏅',l:'MOTM', v:match.motm}] : []),
        ].map((r,i,a)=>(
          <div key={i} style={{display:'flex',alignItems:'flex-start',gap:10,padding:'10px 13px',background:'#fff',borderRadius:i===0?'12px 12px 0 0':i===a.length-1?'0 0 12px 12px':'0',borderBottom:i<a.length-1?`1px solid ${C.g4}`:'none',border:`1px solid ${C.g4}`,marginTop:i===0?0:-1}}>
            <span style={{fontSize:15,width:22,textAlign:'center',flexShrink:0}}>{r.i}</span>
            <p style={{fontSize:10,color:C.g3,fontFamily:'Poppins,sans-serif',fontWeight:600,margin:0,width:52,flexShrink:0}}>{r.l}</p>
            <p style={{fontSize:11,color:C.g1,fontFamily:'Poppins,sans-serif',fontWeight:700,margin:0,flex:1,wordBreak:'break-word'}}>{r.v}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ══════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════ */
export default function IPLCricket({currentUser, coins = 0, onPredictionReward}) {
  const userId = currentUser?.username ? userDocId(currentUser.username) : null

  const [matches,setMatches]     = useState(null)
  const [leader,setLeader]       = useState(null)
  const [loading,setLoading]     = useState(true)
  const [error,setError]         = useState(null)
  const [tab,setTab]             = useState('today')
  const [detail,setDetail]       = useState(null)
  const [wallet,setWallet]       = useState(null)
  const [dailyDone,setDailyDone] = useState(false)
  const [rewardPop,setRewardPop] = useState(null)
  const loggedRewardsRef = useRef(new Set())

  useEffect(()=>{
    let mL=false,lL=false
    const check=()=>{ if(mL&&lL) setLoading(false) }
    const uM=onSnapshot(doc(db,'ipl_data','matches'),(s)=>{
      if(s.exists()){
        const next = s.data()
        setMatches(prev => sameData(prev, next) ? prev : next)
        setError(null)
      }
      else{setMatches(prev => prev === null ? prev : null);setError('No match data yet')}
      mL=true;check()
    },(e)=>{setMatches(prev => prev === null ? prev : null);setError(`${e.code}: Check Firestore rules`);mL=true;check()})
    const uL=onSnapshot(doc(db,'ipl_data','leaderboard'),(s)=>{
      const next = s.exists()?s.data():null
      setLeader(prev => sameData(prev, next) ? prev : next)
      lL=true;check()
    },()=>{setLeader(prev => prev === null ? prev : null);lL=true;check()})
    return ()=>{uM();uL()}
  },[])

  useEffect(()=>{
    if(!userId) return
    loadWallet(userId).then(next => setWallet(prev => sameData(prev, next) ? prev : next))
    const unsub=onSnapshot(doc(db,'ipl_wallets',userId),s=>{if(s.exists()){const next=s.data();setWallet(prev => sameData(prev, next) ? prev : next)}},()=>{})
    return ()=>unsub()
  },[userId])

  useEffect(()=>{
    if(!userId||dailyDone) return
    setDailyDone(true)
    claimDaily(userId).then(r=>{ if(r) setRewardPop(r) })
  },[userId,dailyDone])

  const today    = useMemo(()=>matches?.today    || [], [matches?.today])
  const upcoming = useMemo(()=>matches?.upcoming || [], [matches?.upcoming])
  const results  = useMemo(()=>matches?.results  || [], [matches?.results])
  const hasLive  = useMemo(()=>today.some(m=>m.status==='live'), [today])
  const points   = useMemo(()=>leader?.points    || [], [leader?.points])
  const orangeCap= useMemo(()=>leader?.orange_cap|| null, [leader?.orange_cap])
  const purpleCap= useMemo(()=>leader?.purple_cap|| null, [leader?.purple_cap])
  const handlePredicted = useCallback(() => {
    setWallet(w=>w?{...w,predictions:(w.predictions||0)+1}:w)
  }, [])
  const handlePredictionReward = useCallback((prediction) => {
    if (!prediction?.id || !prediction?.coinsWon || loggedRewardsRef.current.has(prediction.id)) return
    loggedRewardsRef.current.add(prediction.id)
    onPredictionReward?.({
      coins: Number(prediction.coinsWon || 0),
      predictionId: prediction.id
    })
  }, [onPredictionReward])
  const closeDetail = useCallback(()=>setDetail(null), [])
  const closeRewardPop = useCallback(()=>setRewardPop(null), [])

  const TABS=useMemo(()=>[
    {id:'today',   icon:'📅',label:'Today',   n:today.length},
    {id:'results', icon:'📊',label:'Results', n:results.length},
    {id:'upcoming',icon:'🗓',label:'Upcoming',n:upcoming.length},
    {id:'table',   icon:'📋',label:'Table',   n:null},
    {id:'caps',    icon:'🏆',label:'Caps',    n:null},
    {id:'leaders', icon:'🏅',label:'Leaders', n:null},
  ], [results.length, today.length, upcoming.length])

  return (
    <div>
      <style>{`
        @keyframes livepulse {0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.3;transform:scale(0.75)}}
        @keyframes shimmer   {0%{background-position:200% center} 100%{background-position:-200% center}}
        @keyframes fadein    {from{opacity:0} to{opacity:1}}
        @keyframes slideup2  {from{opacity:0;transform:translateY(50px)} to{opacity:1;transform:translateY(0)}}
        @keyframes spin      {to{transform:rotate(360deg)}}
        @keyframes popIn     {0%{opacity:0;transform:scale(0.85)} 70%{transform:scale(1.04)} 100%{opacity:1;transform:scale(1)}}
        .iplt{transition:all 0.16s;} .iplt:active{transform:scale(0.93);}
      `}</style>

      {detail&&<Detail match={detail} onClose={closeDetail}/>}

      {/* Daily reward popup */}
      {rewardPop&&(
        <div style={{position:'fixed',inset:0,zIndex:950,background:'rgba(17,24,39,0.6)',display:'flex',alignItems:'center',justifyContent:'center',padding:20,backdropFilter:'blur(6px)'}} onClick={closeRewardPop}>
          <div style={{width:'100%',maxWidth:300,background:'#fff',borderRadius:22,padding:'24px 20px',textAlign:'center',boxShadow:'0 24px 60px rgba(17,24,39,0.2)',animation:'popIn 0.4s cubic-bezier(.34,1.56,.64,1)'}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:48,marginBottom:8}}>🎁</div>
            <p style={{fontFamily:'Poppins,sans-serif',fontWeight:900,fontSize:18,color:C.g1,margin:'0 0 3px'}}>Daily Reward!</p>
            <p style={{fontSize:12,color:C.g2,margin:'0 0 14px',fontFamily:'Poppins,sans-serif'}}>🔥 Day {rewardPop.streak} streak</p>
            <div style={{padding:'13px',background:C.gold2,borderRadius:12,border:`1.5px solid ${C.gold}30`,marginBottom:16}}>
              <p style={{fontFamily:'Poppins,sans-serif',fontWeight:900,fontSize:30,color:C.gold,margin:0}}>+{rewardPop.coins} 💰</p>
            </div>
            <button onClick={closeRewardPop} style={{width:'100%',padding:'12px',borderRadius:12,border:'none',background:`linear-gradient(135deg,${C.blue},#1A3DAB)`,color:'#fff',fontFamily:'Poppins,sans-serif',fontWeight:800,fontSize:13,cursor:'pointer'}}>Let's predict! 🏏</button>
          </div>
        </div>
      )}

      {/* ── IPL Header ── */}
      <div style={{borderRadius:18,overflow:'hidden',marginBottom:12,boxShadow:'0 6px 24px rgba(0,30,100,0.25)'}}>
        <div style={{background:'linear-gradient(135deg,#002A7F,#0A1F6E 50%,#001563)',padding:'12px 14px',position:'relative',overflow:'hidden'}}>
          <div style={{position:'absolute',top:0,left:0,right:0,height:3,background:'linear-gradient(90deg,#FF6B35,#FFD700,#00C9A7,#6C5CE7)'}}/>
          <div style={{position:'absolute',top:-30,right:-20,width:120,height:120,borderRadius:'50%',border:'1px solid rgba(255,255,255,0.06)',pointerEvents:'none'}}/>
          <div style={{position:'relative',zIndex:2,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div style={{display:'flex',alignItems:'center',gap:9}}>
              <div style={{width:40,height:40,borderRadius:11,overflow:'hidden',background:'rgba(255,255,255,0.1)',border:'1.5px solid rgba(255,255,255,0.18)',flexShrink:0}}>
                <img src="/ipl_logo.jpeg" alt="IPL" onError={e=>{e.target.style.display='none'}} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
              </div>
              <div>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <p style={{fontFamily:'Syne,sans-serif',fontWeight:900,fontSize:16,color:'#fff',margin:0}}>TATA IPL 2025</p>
                  {hasLive&&<LiveDot sm/>}
                </div>
                <p style={{fontSize:9,color:'rgba(255,255,255,0.45)',margin:0,fontFamily:'Poppins,sans-serif',letterSpacing:'0.08em',textTransform:'uppercase'}}>Indian Premier League</p>
              </div>
            </div>
            {userId&&(
              <div style={{display:'flex',alignItems:'center',gap:5,padding:'6px 12px',background:'rgba(255,215,0,0.12)',border:'1.5px solid rgba(255,215,0,0.28)',borderRadius:22}}>
                <span style={{fontSize:14}}>💰</span>
                <p style={{fontFamily:'Poppins,sans-serif',fontWeight:900,fontSize:14,color:'#FFD700',margin:0}}>{Number(coins || 0).toLocaleString()}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* User stats */}
      {userId&&wallet&&<StatsStrip wallet={wallet} coins={coins}/>}

      {/* Tabs */}
      <div style={{display:'flex',gap:5,marginBottom:12,overflowX:'auto',paddingBottom:2,scrollbarWidth:'none'}}>
        {TABS.map(t=>(
          <button key={t.id} className="iplt" onClick={()=>setTab(t.id)} style={{padding:'7px 12px',borderRadius:20,fontWeight:700,fontSize:10,whiteSpace:'nowrap',cursor:'pointer',border:'none',flexShrink:0,fontFamily:'Poppins,sans-serif',display:'flex',alignItems:'center',gap:4,background:tab===t.id?C.blue:'#fff',color:tab===t.id?'#fff':C.g2,boxShadow:tab===t.id?`0 3px 14px ${C.blue}40`:'0 1px 4px rgba(17,24,39,0.08)'}}>
            {t.icon} {t.label}
            {t.n>0&&<span style={{fontSize:8,padding:'1px 5px',borderRadius:10,background:tab===t.id?'rgba(255,255,255,0.25)':'#F3F4F6',color:tab===t.id?'#fff':C.g3,fontWeight:800}}>{t.n}</span>}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading?(<div><Skel h={220} r={18}/><Skel h={110}/><Skel h={90}/></div>):
       error&&!matches?(<div style={{textAlign:'center',padding:'28px 18px',background:'#fff',borderRadius:14,border:`1.5px solid ${C.red}20`}}><p style={{fontSize:28,marginBottom:8}}>📡</p><p style={{fontWeight:800,fontSize:13,color:C.red,fontFamily:'Poppins,sans-serif',margin:'0 0 5px'}}>No Data</p><p style={{fontSize:11,color:C.g3,fontFamily:'Poppins,sans-serif'}}>{error}</p></div>):(

        <div>
          {tab==='today'&&(today.length===0?<div style={{textAlign:'center',padding:'36px 18px',background:'#fff',borderRadius:16,border:`1px solid ${C.g4}`}}><p style={{fontSize:36,marginBottom:10}}>🏏</p><p style={{fontWeight:800,fontSize:14,color:C.g2,fontFamily:'Poppins,sans-serif',margin:'0 0 4px'}}>No matches today</p><p style={{fontSize:11,color:C.g3,fontFamily:'Poppins,sans-serif'}}>Check the Upcoming tab</p></div>:today.map((m,i)=><HeroCard key={matchKey(m,i)} match={m} userId={userId} wallet={wallet} onPredicted={handlePredicted} onPredictionReward={handlePredictionReward} onClick={setDetail}/>))}

          {tab==='results'&&(results.length===0?<div style={{textAlign:'center',padding:'24px',background:'#fff',borderRadius:14,border:`1px solid ${C.g4}`}}><p style={{fontSize:11,color:C.g3,fontFamily:'Poppins,sans-serif'}}>No results yet</p></div>:results.map((m,i)=><ResultCard key={matchKey(m,i)} match={m} userId={userId} onPredictionReward={handlePredictionReward} onClick={setDetail}/>))}

          {tab==='upcoming'&&(upcoming.length===0?<div style={{textAlign:'center',padding:'24px',background:'#fff',borderRadius:14,border:`1px solid ${C.g4}`}}><p style={{fontSize:11,color:C.g3,fontFamily:'Poppins,sans-serif'}}>No upcoming matches</p></div>:upcoming.map((m,i)=><UpCard key={matchKey(m,i)} match={m} userId={userId} wallet={wallet} onPredicted={handlePredicted} onPredictionReward={handlePredictionReward}/>))}

          {tab==='table'&&<Table points={points}/>}

          {tab==='caps'&&<><CapCard data={orangeCap} type="orange"/><CapCard data={purpleCap} type="purple"/></>}

          {tab==='leaders'&&<Leaderboard userId={userId}/>}
        </div>
      )}

      {/* Legal disclaimer */}
      <div style={{marginTop:16,padding:'10px 13px',background:'#F8FAFC',borderRadius:11,border:`1px solid ${C.g4}`}}>
        <p style={{fontSize:9,color:C.g3,textAlign:'center',margin:0,fontFamily:'Poppins,sans-serif',lineHeight:1.65}}>
          ⚖️ This is a skill-based prediction game. Coins are virtual tokens with no monetary value. No real money involved.
        </p>
      </div>
    </div>
  )
}
