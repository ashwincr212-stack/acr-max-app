import { useState, useEffect, useCallback } from 'react'
import { db } from '../firebase'
import {
  doc, onSnapshot, getDoc, setDoc, updateDoc,
  collection, addDoc, serverTimestamp, increment
} from 'firebase/firestore'

/* ══════════════════════════════════════════════════════════
   ACR MAX — IPL 2025 PREMIUM MODULE v3
   Cricbuzz-level UI · Real predictions · Coins · Live data
══════════════════════════════════════════════════════════ */

const C = {
  bg:'#F0F2F5', card:'#FFFFFF', blue:'#1A56DB', blue2:'#EEF2FF',
  orange:'#F05A28', orange2:'#FFF3EE', red:'#E02424', red2:'#FEF2F2',
  green:'#057A55', green2:'#F0FFF4', gold:'#F59E0B', gold2:'#FFFBEB',
  purple:'#7E3AF2', purple2:'#F5F3FF',
  g1:'#111827', g2:'#374151', g3:'#6B7280', g4:'#E5E7EB', g5:'#F9FAFB',
}

const TEAMS = {
  'Mumbai Indians':              { s:'MI',   c:'#004BA0', bg:'#DBEAFE', g:'linear-gradient(135deg,#004BA0,#0066CC)', logo:'https://scores.iplt20.com/ipl/teamlogos/MI.png' },
  'Chennai Super Kings':         { s:'CSK',  c:'#F0A500', bg:'#FEF3C7', g:'linear-gradient(135deg,#F0A500,#FFB800)', logo:'https://scores.iplt20.com/ipl/teamlogos/CSK.png' },
  'Royal Challengers Bangalore': { s:'RCB',  c:'#CC0000', bg:'#FEE2E2', g:'linear-gradient(135deg,#CC0000,#FF1A1A)', logo:'https://scores.iplt20.com/ipl/teamlogos/RCB.png' },
  'Kolkata Knight Riders':       { s:'KKR',  c:'#3D1A78', bg:'#EDE9FE', g:'linear-gradient(135deg,#3D1A78,#5B21B6)', logo:'https://scores.iplt20.com/ipl/teamlogos/KKR.png' },
  'Sunrisers Hyderabad':         { s:'SRH',  c:'#F4682A', bg:'#FFEDD5', g:'linear-gradient(135deg,#F4682A,#FF8C42)', logo:'https://scores.iplt20.com/ipl/teamlogos/SRH.png' },
  'Delhi Capitals':              { s:'DC',   c:'#0052CC', bg:'#DBEAFE', g:'linear-gradient(135deg,#0052CC,#1A6BE0)', logo:'https://scores.iplt20.com/ipl/teamlogos/DC.png' },
  'Punjab Kings':                { s:'PBKS', c:'#CC0000', bg:'#FEE2E2', g:'linear-gradient(135deg,#CC0000,#E82020)', logo:'https://scores.iplt20.com/ipl/teamlogos/PBKS.png' },
  'Rajasthan Royals':            { s:'RR',   c:'#C0166E', bg:'#FCE7F3', g:'linear-gradient(135deg,#C0166E,#E01880)', logo:'https://scores.iplt20.com/ipl/teamlogos/RR.png' },
  'Gujarat Titans':              { s:'GT',   c:'#1B4FBE', bg:'#DBEAFE', g:'linear-gradient(135deg,#1B4FBE,#2460D8)', logo:'https://scores.iplt20.com/ipl/teamlogos/GT.png' },
  'Lucknow Super Giants':        { s:'LSG',  c:'#0284C7', bg:'#E0F2FE', g:'linear-gradient(135deg,#0284C7,#0EA5E9)', logo:'https://scores.iplt20.com/ipl/teamlogos/LSG.png' },
}

const getTeam = (n='') => {
  if (TEAMS[n]) return { name:n, ...TEAMS[n] }
  const k = Object.keys(TEAMS).find(k => n.toLowerCase().includes(k.split(' ').pop().toLowerCase()) || k.toLowerCase().includes(n.toLowerCase()))
  return k ? { name:k, ...TEAMS[k] } : { name:n, s:n.slice(0,4).toUpperCase(), c:C.blue, bg:C.blue2, e:'🏏' }
}

const fmtTime = r => {
  if (!r) return 'TBD'
  if (/\d{1,2}:\d{2}\s*(am|pm)/i.test(r)) return r
  try { return new Date(r).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true,timeZone:'Asia/Kolkata'}) } catch { return r }
}
const fmtDate = r => { try { return new Date(r).toLocaleDateString('en-IN',{day:'numeric',month:'short',timeZone:'Asia/Kolkata'}) } catch { return r || '' } }

/* ── Countdown ── */
function useCountdown(date, time) {
  const [v,setV] = useState('')
  useEffect(()=>{
    const parse = () => {
      if (!date) return ''
      const t = time?.replace(/(\d{1,2}):(\d{2})\s*(am|pm)/i,(_,h,m,ap)=>{
        let hh=parseInt(h); if(ap.toLowerCase()==='pm'&&hh!==12)hh+=12; if(ap.toLowerCase()==='am'&&hh===12)hh=0
        return `${String(hh).padStart(2,'0')}:${m}:00`
      })||'12:00:00'
      const diff = new Date(`${date}T${t}+05:30`) - Date.now()
      if(diff<=0) return ''
      const h=Math.floor(diff/3600000), m=Math.floor((diff%3600000)/60000), s=Math.floor((diff%60000)/1000)
      if(h>24) return `${Math.floor(h/24)}d ${h%24}h`
      if(h>0)  return `${h}h ${String(m).padStart(2,'0')}m`
      return `${m}m ${String(s).padStart(2,'0')}s`
    }
    setV(parse()); const t=setInterval(()=>setV(parse()),1000); return ()=>clearInterval(t)
  },[date,time])
  return v
}

/* ═══ WALLET ═══ */
async function loadWallet(userId) {
  if (!userId) return {coins:500,streak:0,predictions:0,wins:0}
  try {
    const ref = doc(db,'ipl_wallets',userId)
    const snap = await getDoc(ref)
    if (snap.exists()) return snap.data()
    const init = {coins:500,streak:0,predictions:0,wins:0,lastLogin:null,createdAt:serverTimestamp()}
    await setDoc(ref, init)
    return init
  } catch { return {coins:500,streak:0,predictions:0,wins:0} }
}

async function claimDaily(userId) {
  if (!userId) return null
  try {
    const ref = doc(db,'ipl_wallets',userId)
    const snap = await getDoc(ref); const d = snap.exists()?snap.data():{}
    const today = new Date().toISOString().slice(0,10)
    if (d.lastLogin===today) return null
    const yest = new Date(Date.now()-86400000).toISOString().slice(0,10)
    const str = d.lastLogin===yest?(d.streak||0)+1:1
    const bonus = str>=7?30:str>=3?20:10
    await setDoc(ref,{coins:(d.coins||500)+bonus,streak:str,lastLogin:today},{merge:true})
    return {coins:bonus,streak:str}
  } catch { return null }
}

async function predict(userId, matchId, winner, wager) {
  if (!userId) return {error:'Login required'}
  try {
    const ref = doc(db,'ipl_wallets',userId)
    const snap = await getDoc(ref)
    const bal = snap.exists()?snap.data().coins:500
    if (bal < wager) return {error:'Not enough coins'}
    await updateDoc(ref,{coins:increment(-wager),predictions:increment(1)})
    await addDoc(collection(db,'ipl_predictions'),{
      userId,matchId,predictedWinner:winner,coinsWagered:wager,
      status:'pending',createdAt:serverTimestamp()
    })
    return {ok:true}
  } catch(e) { return {error:e.message} }
}

/* ═══ UI COMPONENTS ═══ */

const LiveDot = ({sm}) => (
  <span style={{display:'inline-flex',alignItems:'center',gap:3,padding:sm?'2px 6px':'3px 9px',background:'#FEF2F2',border:'1px solid #FCA5A5',borderRadius:20}}>
    <span style={{width:sm?5:6,height:sm?5:6,borderRadius:'50%',background:C.red,display:'block',animation:'pulse 1s ease-in-out infinite'}}/>
    <span style={{fontSize:sm?8:9,fontWeight:800,color:C.red,letterSpacing:'0.08em',fontFamily:'Poppins,sans-serif'}}>LIVE</span>
  </span>
)

const Chip = ({c,label,bg,border}) => (
  <span style={{fontSize:9,fontWeight:700,padding:'2px 9px',background:bg,border:`1px solid ${border}`,borderRadius:20,color:c,fontFamily:'Poppins,sans-serif'}}>{label}</span>
)

const Skel = ({h=60,r=12}) => (
  <div style={{height:h,borderRadius:r,background:`linear-gradient(90deg,#F3F4F6 25%,#E5E7EB 50%,#F3F4F6 75%)`,backgroundSize:'400% 100%',animation:'shimmer 1.4s ease-in-out infinite',marginBottom:10}}/>
)

function TeamBadge({name,size=44,showName=true}) {
  const t = getTeam(name)
  const [imgErr, setImgErr] = useState(false)
  const fs = size > 50 ? size*0.32 : size > 36 ? size*0.35 : size*0.38
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
      <div style={{
        width:size, height:size, borderRadius:size*0.28,
        background: imgErr ? (t.g || `linear-gradient(135deg,${t.c},${t.c}CC)`) : '#fff',
        border:`2px solid ${t.c}25`,
        display:'flex', alignItems:'center', justifyContent:'center',
        flexShrink:0, overflow:'hidden',
        boxShadow:`0 4px 16px ${t.c}35, 0 1px 0 rgba(255,255,255,0.3) inset`,
      }}>
        {!imgErr && t.logo ? (
          <img src={t.logo} alt={t.s}
            onError={()=>setImgErr(true)}
            style={{width:'88%',height:'88%',objectFit:'contain',display:'block'}}/>
        ) : (
          <>
            <div style={{position:'absolute',top:0,left:0,right:0,height:'50%',background:'rgba(255,255,255,0.15)',borderRadius:`${size*0.28}px ${size*0.28}px 0 0`}}/>
            <span style={{fontFamily:'Poppins,sans-serif',fontWeight:900,fontSize:t.s.length>3?fs*0.85:fs,color:'#fff',letterSpacing:'-0.02em',textShadow:'0 1px 3px rgba(0,0,0,0.3)',position:'relative',zIndex:1,lineHeight:1}}>{t.s}</span>
          </>
        )}
      </div>
      {showName && <span style={{fontFamily:'Poppins,sans-serif',fontWeight:800,fontSize:Math.max(9,size*0.22),color:t.c,textAlign:'center',letterSpacing:'-0.01em'}}>{t.s}</span>}
    </div>
  )
}

function Form({f=[]}) {
  return (
    <div style={{display:'flex',gap:2,marginTop:2}}>
      {f.slice(-5).map((x,i)=>(
        <div key={i} style={{width:13,height:13,borderRadius:'50%',background:x==='W'?C.green:x==='L'?C.red:'#D1D5DB',display:'flex',alignItems:'center',justifyContent:'center'}}>
          <span style={{fontSize:6,fontWeight:900,color:'#fff'}}>{x}</span>
        </div>
      ))}
    </div>
  )
}

/* ── Predict Panel ── */
function PredictPanel({match, userId, wallet, onDone}) {
  const [picked,setPicked] = useState(null)
  const [wager,setWager]   = useState(20)
  const [busy,setBusy]     = useState(false)
  const [done,setDone]     = useState(null)
  const [err,setErr]       = useState('')
  const t1=getTeam(match.team1), t2=getTeam(match.team2)
  const potential = Math.round(wager*1.8)

  if (done) return (
    <div style={{padding:'14px 16px',background:C.green2,borderRadius:14,border:`1px solid ${C.green}30`,display:'flex',alignItems:'center',gap:10,animation:'fadeIn 0.3s ease'}}>
      <span style={{fontSize:24}}>✅</span>
      <div>
        <p style={{fontFamily:'Poppins,sans-serif',fontWeight:800,fontSize:13,color:C.green,margin:0}}>Prediction locked! 🎯</p>
        <p style={{fontSize:11,color:C.g3,margin:0,fontFamily:'Poppins,sans-serif'}}>{done} · Win {potential} 💰 if correct</p>
      </div>
    </div>
  )

  return (
    <div style={{padding:'16px',background:C.blue2,borderRadius:16,border:`1.5px solid ${C.blue}25`,marginTop:10}}>
      <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:14}}>
        <span style={{fontSize:18}}>🎯</span>
        <p style={{fontFamily:'Poppins,sans-serif',fontWeight:800,fontSize:14,color:C.g1,margin:0}}>Pick the winner</p>
        <span style={{marginLeft:'auto',padding:'3px 10px',background:C.gold2,border:`1px solid ${C.gold}40`,borderRadius:20,fontSize:10,fontWeight:800,color:C.gold,fontFamily:'Poppins,sans-serif'}}>Win up to {potential} 💰</span>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
        {[match.team1, match.team2].map(team=>{
          const t=getTeam(team), sel=picked===team
          return (
            <button key={team} onClick={()=>{setPicked(team);setErr('')}} style={{padding:'16px 10px',borderRadius:14,border:sel?`2.5px solid ${t.c}`:`1.5px solid ${C.g4}`,background:sel?`${t.c}12`:'#fff',cursor:'pointer',transition:'all 0.2s',display:'flex',flexDirection:'column',alignItems:'center',gap:8,boxShadow:sel?`0 4px 16px ${t.c}25`:'0 1px 4px rgba(0,0,0,0.06)'}}>
              <TeamBadge name={team} size={48} showName={false}/>
              <div style={{textAlign:'center'}}>
                <p style={{fontFamily:'Poppins,sans-serif',fontWeight:800,fontSize:14,color:sel?t.c:C.g2,margin:0}}>{t.s}</p>
                <p style={{fontSize:10,color:C.g3,margin:'2px 0 0',fontFamily:'Poppins,sans-serif'}}>{team.split(' ').slice(-1)}</p>
              </div>
              {sel && <div style={{width:24,height:4,borderRadius:2,background:t.c}}/>}
            </button>
          )
        })}
      </div>

      <p style={{fontFamily:'Poppins,sans-serif',fontSize:10,fontWeight:700,color:C.g3,textTransform:'uppercase',letterSpacing:'0.1em',margin:'0 0 8px'}}>Coins to wager</p>
      <div style={{display:'flex',gap:6,marginBottom:14}}>
        {[10,20,50,100].map(a=>(
          <button key={a} onClick={()=>setWager(a)} style={{flex:1,padding:'9px 4px',borderRadius:10,border:wager===a?`2px solid ${C.blue}`:`1px solid ${C.g4}`,background:wager===a?C.blue:'#fff',fontFamily:'Poppins,sans-serif',fontWeight:700,fontSize:13,color:wager===a?'#fff':C.g2,cursor:'pointer',transition:'all 0.15s'}}>
            {a}
          </button>
        ))}
      </div>

      {err && <p style={{fontSize:11,color:C.red,margin:'0 0 8px',fontFamily:'Poppins,sans-serif'}}>⚠ {err}</p>}

      <button disabled={!picked||busy} onClick={async()=>{
        if(!picked) return
        setBusy(true)
        const r = await predict(userId, match.id, picked, wager)
        setBusy(false)
        if(r.ok){setDone(picked);onDone?.(wager)}
        else setErr(r.error)
      }} style={{width:'100%',padding:'14px',borderRadius:13,border:'none',background:picked?`linear-gradient(135deg,${C.blue},#1A3DAB)`:'#E5E7EB',color:picked?'#fff':'#9CA3AF',fontFamily:'Poppins,sans-serif',fontWeight:800,fontSize:14,cursor:picked?'pointer':'not-allowed',transition:'all 0.2s',boxShadow:picked?`0 6px 20px ${C.blue}40`:'none',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
        {busy?<><div style={{width:16,height:16,border:'2px solid rgba(255,255,255,0.3)',borderTop:'2px solid #fff',borderRadius:'50%',animation:'spin 0.7s linear infinite'}}/>Placing…</>:`🎯 ${picked?`${getTeam(picked).s} wins · Wager ${wager} 💰`:'Select a team first'}`}
      </button>
    </div>
  )
}

/* ── Hero Match Card ── */
function HeroCard({match, userId, wallet, onPredicted, onClick}) {
  const t1=getTeam(match.team1), t2=getTeam(match.team2)
  const isLive=match.status==='live', isDone=match.status==='completed', isUp=!isLive&&!isDone
  const [showPredict,setShowPredict] = useState(false)
  const cd = useCountdown(match.date, match.time)
  const hasPredicted = false // TODO: check from Firestore

  return (
    <div style={{borderRadius:20,overflow:'hidden',background:'#fff',boxShadow:'0 8px 32px rgba(17,24,39,0.12)',marginBottom:14,border:`1px solid ${C.g4}`}}>
      {/* Premium gradient header */}
      <div style={{background:`linear-gradient(135deg,${t1.c}18 0%,#ffffff 40%,${t2.c}18 100%)`,padding:'14px 16px 0',borderBottom:`3px solid transparent`,backgroundClip:'padding-box',position:'relative'}}>
        <div style={{position:'absolute',bottom:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${t1.c},${t1.c}80 45%,${t2.c}80 55%,${t2.c})`}}/>

      <div style={{paddingBottom:0}}>
        {/* Status + time row */}
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:16}}>
          {isLive && <LiveDot/>}
          {isDone && <Chip c={C.green} label="✓ RESULT" bg={C.green2} border={`${C.green}30`}/>}
          {isUp && cd && (
            <div style={{display:'inline-flex',alignItems:'center',gap:5,padding:'4px 10px',background:'#FFF7ED',border:`1px solid ${C.orange}30`,borderRadius:20}}>
              <span style={{fontSize:11}}>⏱</span>
              <span style={{fontSize:11,fontWeight:800,color:C.orange,fontFamily:'Poppins,sans-serif'}}>{cd}</span>
            </div>
          )}
          {isUp && !cd && <Chip c={C.blue} label="📅 UPCOMING" bg={C.blue2} border={`${C.blue}25`}/>}
          <span style={{marginLeft:'auto',fontSize:12,fontWeight:700,color:C.g2,fontFamily:'Poppins,sans-serif'}}>{fmtTime(match.time)}</span>
        </div>

        {/* Teams */}
        <div style={{display:'grid',gridTemplateColumns:'1fr auto 1fr',alignItems:'center',gap:12,marginBottom:14}} onClick={()=>onClick?.(match)}>
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6,cursor:'pointer'}}>
            <TeamBadge name={match.team1} size={56}/>
            {isDone&&match.score1&&<p style={{fontFamily:'Poppins,sans-serif',fontWeight:900,fontSize:16,color:C.g1,margin:0,textAlign:'center'}}>{match.score1}</p>}
          </div>
          <div style={{textAlign:'center'}}>
            {isLive?<LiveDot/>:isDone?<div style={{padding:'5px 10px',background:C.g5,borderRadius:8}}><span style={{fontSize:10,fontWeight:800,color:C.g3,fontFamily:'Poppins,sans-serif'}}>FINAL</span></div>:<div style={{width:40,height:40,borderRadius:'50%',background:C.g5,border:`1.5px solid ${C.g4}`,display:'flex',alignItems:'center',justifyContent:'center'}}><span style={{fontSize:12,fontWeight:800,color:C.g3,fontFamily:'Poppins,sans-serif'}}>VS</span></div>}
          </div>
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6,cursor:'pointer'}}>
            <TeamBadge name={match.team2} size={56}/>
            {isDone&&match.score2&&<p style={{fontFamily:'Poppins,sans-serif',fontWeight:900,fontSize:16,color:C.g1,margin:0,textAlign:'center'}}>{match.score2}</p>}
          </div>
        </div>

        {/* Result */}
        {isDone&&match.result&&(
          <div style={{padding:'10px 14px',background:C.green2,border:`1px solid ${C.green}25`,borderRadius:12,textAlign:'center',marginBottom:12}}>
            <p style={{fontSize:13,fontWeight:700,color:C.green,margin:0,fontFamily:'Poppins,sans-serif'}}>🏆 {match.result}</p>
          </div>
        )}

        {/* Live scores */}
        {isLive&&(match.score1||match.score2)&&(
          <div style={{display:'grid',gridTemplateColumns:'1fr auto 1fr',gap:8,marginBottom:12}}>
            <div style={{padding:'10px',background:`${t1.c}08`,border:`1px solid ${t1.c}20`,borderRadius:12,textAlign:'center'}}>
              <p style={{fontFamily:'Poppins,sans-serif',fontWeight:900,fontSize:16,color:t1.c,margin:0}}>{match.score1||'—'}</p>
            </div>
            <div style={{display:'flex',alignItems:'center'}}><span style={{color:C.g4,fontSize:14}}>v</span></div>
            <div style={{padding:'10px',background:`${t2.c}08`,border:`1px solid ${t2.c}20`,borderRadius:12,textAlign:'center'}}>
              <p style={{fontFamily:'Poppins,sans-serif',fontWeight:900,fontSize:16,color:t2.c,margin:0}}>{match.score2||'—'}</p>
            </div>
          </div>
        )}

        {/* Venue + Predict */}
        <div style={{padding:'10px 0 14px',borderTop:`1px solid ${C.g4}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{display:'flex',alignItems:'center',gap:5,flex:1,minWidth:0}}>
            <span style={{fontSize:12}}>📍</span>
            <p style={{fontSize:10,color:C.g3,margin:0,fontFamily:'Poppins,sans-serif',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{match.venue?.split(',')[0]||'TBD'}</p>
          </div>
          {isUp&&userId&&(
            <button onClick={e=>{e.stopPropagation();setShowPredict(s=>!s)}} style={{flexShrink:0,marginLeft:10,padding:'7px 14px',borderRadius:20,border:'none',background:showPredict?`linear-gradient(135deg,${C.blue},#1A3DAB)`:`linear-gradient(135deg,#FF6B00,#E05000)`,color:'#fff',fontFamily:'Poppins,sans-serif',fontWeight:800,fontSize:12,cursor:'pointer',boxShadow:`0 4px 16px ${showPredict?C.blue:C.orange}50`,transition:'all 0.2s',display:'flex',alignItems:'center',gap:5,letterSpacing:'0.01em'}}>
              🎯 {showPredict?'Close':'Predict 💰'}
            </button>
          )}
        </div>
      </div>

      {showPredict&&isUp&&(
        <div style={{padding:'0 16px 16px'}}>
          <PredictPanel match={match} userId={userId} wallet={wallet} onDone={coins=>{onPredicted?.(coins);setShowPredict(false)}}/>
        </div>
      )}
      </div>{/* close gradient header */}
    </div>
  )
}

/* ── Result Card ── */
function ResultCard({match, onClick}) {
  const t1=getTeam(match.team1), t2=getTeam(match.team2)
  return (
    <div onClick={()=>onClick?.(match)} style={{borderRadius:16,background:'#fff',border:`1px solid ${C.g4}`,boxShadow:'0 4px 16px rgba(17,24,39,0.09)',marginBottom:10,overflow:'hidden',cursor:'pointer',transition:'all 0.2s'}}
      onMouseEnter={e=>e.currentTarget.style.boxShadow='0 6px 24px rgba(17,24,39,0.13)'}
      onMouseLeave={e=>e.currentTarget.style.boxShadow='0 2px 12px rgba(17,24,39,0.07)'}>
      <div style={{height:4,background:`linear-gradient(90deg,${t1.c},${t2.c})`}}/>
      <div style={{padding:'12px 14px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
          <Chip c={C.green} label="✓ RESULT" bg={C.green2} border={`${C.green}30`}/>
          <span style={{fontSize:10,color:C.g3,fontFamily:'Poppins,sans-serif'}}>{fmtDate(match.date)}</span>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr auto 1fr',alignItems:'center',gap:10}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <TeamBadge name={match.team1} size={36} showName={false}/>
            <div>
              <p style={{fontFamily:'Poppins,sans-serif',fontWeight:800,fontSize:13,color:t1.c,margin:0}}>{t1.s}</p>
              {match.score1&&<p style={{fontSize:12,fontWeight:700,color:C.g1,margin:0,fontFamily:'Poppins,sans-serif'}}>{match.score1}</p>}
            </div>
          </div>
          <span style={{color:C.g4,fontWeight:700}}>v</span>
          <div style={{display:'flex',alignItems:'center',gap:8,justifyContent:'flex-end'}}>
            <div style={{textAlign:'right'}}>
              <p style={{fontFamily:'Poppins,sans-serif',fontWeight:800,fontSize:13,color:t2.c,margin:0}}>{t2.s}</p>
              {match.score2&&<p style={{fontSize:12,fontWeight:700,color:C.g1,margin:0,fontFamily:'Poppins,sans-serif'}}>{match.score2}</p>}
            </div>
            <TeamBadge name={match.team2} size={36} showName={false}/>
          </div>
        </div>
        {match.result&&<p style={{fontSize:11,fontWeight:700,color:C.green,margin:'9px 0 0',fontFamily:'Poppins,sans-serif',paddingTop:8,borderTop:`1px solid ${C.g4}`}}>🏆 {match.result}</p>}
      </div>
    </div>
  )
}

/* ── Upcoming Card ── */
function UpCard({match}) {
  const t1=getTeam(match.team1), t2=getTeam(match.team2)
  const cd = useCountdown(match.date, match.time)
  return (
    <div style={{flexShrink:0,width:185,borderRadius:18,background:'#fff',border:`1px solid ${C.g4}`,boxShadow:'0 4px 18px rgba(17,24,39,0.1)',overflow:'hidden',transition:'transform 0.2s'}} onMouseEnter={e=>e.currentTarget.style.transform='translateY(-3px)'} onMouseLeave={e=>e.currentTarget.style.transform='translateY(0)'}>
      <div style={{height:4,background:`linear-gradient(90deg,${t1.c},${t2.c})`}}/>
      <div style={{padding:'12px 13px'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
          <span style={{fontSize:9,fontWeight:700,padding:'3px 9px',background:C.blue2,border:`1px solid ${C.blue}20`,borderRadius:20,color:C.blue,fontFamily:'Poppins,sans-serif'}}>{match.dayLabel||fmtDate(match.date)}</span>
          {cd&&<span style={{fontSize:9,fontWeight:700,color:C.orange,fontFamily:'Poppins,sans-serif'}}>⏱{cd}</span>}
        </div>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
          <TeamBadge name={match.team1} size={40}/>
          <div style={{width:28,height:28,borderRadius:'50%',background:C.g5,border:`1px solid ${C.g4}`,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <span style={{fontSize:9,fontWeight:800,color:C.g3,fontFamily:'Poppins,sans-serif'}}>VS</span>
          </div>
          <TeamBadge name={match.team2} size={40}/>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:4,marginBottom:3}}>
          <span style={{fontSize:11}}>⏰</span>
          <p style={{fontSize:10,fontWeight:700,color:C.g2,margin:0,fontFamily:'Poppins,sans-serif'}}>{fmtTime(match.time)}</p>
        </div>
        <p style={{fontSize:9,color:C.g3,margin:0,fontFamily:'Poppins,sans-serif',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>📍 {match.venue?.split(',')[0]||'TBD'}</p>
      </div>
    </div>
  )
}

/* ── Points Table ── */
function Table({points=[]}) {
  const [all,setAll]=useState(false)
  const rows = all?points:points.slice(0,6)
  if (!points.length) return <div style={{padding:'24px',textAlign:'center',background:'#fff',borderRadius:16,border:`1px solid ${C.g4}`}}><p style={{fontSize:12,color:C.g3,fontFamily:'Poppins,sans-serif'}}>Standings loading…</p></div>
  return (
    <div style={{borderRadius:18,background:'#fff',border:`1px solid ${C.g4}`,overflow:'hidden',boxShadow:'0 2px 12px rgba(17,24,39,0.07)'}}>
      {/* Header */}
      <div style={{display:'grid',gridTemplateColumns:'28px 1fr 26px 26px 26px 50px 30px',gap:4,padding:'10px 14px',background:C.g5,borderBottom:`1px solid ${C.g4}`}}>
        {['#','TEAM','P','W','L','NRR','PTS'].map((h,i)=>(
          <p key={i} style={{fontSize:8,fontWeight:800,color:C.g3,margin:0,textAlign:i>1?'center':'left',textTransform:'uppercase',letterSpacing:'0.07em',fontFamily:'Poppins,sans-serif'}}>{h}</p>
        ))}
      </div>
      {rows.map((row,i)=>{
        const t=getTeam(row.team), top4=row.rank<=4
        return (
          <div key={i} style={{display:'grid',gridTemplateColumns:'28px 1fr 26px 26px 26px 50px 30px',gap:4,padding:'10px 14px',borderBottom:`1px solid ${C.g4}`,background:top4?`${t.c}05`:'#fff',alignItems:'center'}}>
            <div style={{width:20,height:20,borderRadius:'50%',background:top4?t.c:C.g4,display:'flex',alignItems:'center',justifyContent:'center'}}>
              <span style={{fontSize:9,fontWeight:800,color:top4?'#fff':C.g3,fontFamily:'Poppins,sans-serif'}}>{row.rank}</span>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:6,minWidth:0}}>
              <span style={{fontSize:15,flexShrink:0}}>{t.e}</span>
              <div style={{minWidth:0}}>
                <p style={{fontFamily:'Poppins,sans-serif',fontWeight:700,fontSize:12,color:C.g1,margin:0,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{t.s}</p>
                {row.form?.length>0&&<Form f={row.form}/>}
              </div>
            </div>
            {[row.p,row.w,row.l].map((v,j)=>(
              <p key={j} style={{fontFamily:'Poppins,sans-serif',fontSize:12,fontWeight:600,color:C.g2,margin:0,textAlign:'center'}}>{v}</p>
            ))}
            <p style={{fontFamily:'Poppins,sans-serif',fontSize:10,fontWeight:700,color:parseFloat(row.nrr)>=0?C.green:C.red,margin:0,textAlign:'center'}}>{row.nrr}</p>
            <div style={{textAlign:'center'}}>
              <span style={{fontSize:13,fontWeight:900,color:top4?t.c:C.g1,fontFamily:'Poppins,sans-serif',padding:'2px 6px',background:top4?`${t.c}12`:'transparent',borderRadius:7}}>{row.pts}</span>
            </div>
          </div>
        )
      })}
      <div style={{padding:'10px 14px',background:C.g5,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div style={{display:'flex',alignItems:'center',gap:5}}>
          <div style={{width:8,height:8,borderRadius:'50%',background:C.blue}}/>
          <span style={{fontSize:9,color:C.g3,fontFamily:'Poppins,sans-serif',fontWeight:600}}>Top 4 → Playoffs</span>
        </div>
        {points.length>6&&<button onClick={()=>setAll(s=>!s)} style={{background:'none',border:'none',fontSize:11,fontWeight:700,color:C.blue,cursor:'pointer',fontFamily:'Poppins,sans-serif'}}>{all?'Less ↑':`All ${points.length} →`}</button>}
      </div>
    </div>
  )
}

/* ── Cap Card (single player) ── */
function CapCard({data, type, rank}) {
  const isO = type==='orange'
  const acc = isO?C.orange:C.purple, bg2=isO?C.orange2:C.purple2
  const t = getTeam(data?.team||'')
  const stats = isO
    ?[{l:'Runs',v:data?.runs},{l:'Avg',v:data?.avg},{l:'S/R',v:data?.sr},{l:'HS',v:data?.hs}]
    :[{l:'Wkts',v:data?.wickets},{l:'Econ',v:data?.economy},{l:'Avg',v:data?.avg},{l:'Best',v:data?.best}]

  return (
    <div style={{borderRadius:18,background:'#fff',border:`1.5px solid ${acc}25`,overflow:'hidden',boxShadow:`0 4px 20px ${acc}15`}}>
      {/* Color header */}
      <div style={{background:`linear-gradient(135deg,${acc},${acc}CC)`,padding:'14px 16px'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <span style={{fontSize:20}}>{isO?'🟠':'🟣'}</span>
            <div>
              <p style={{fontFamily:'Poppins,sans-serif',fontWeight:800,fontSize:14,color:'#fff',margin:0}}>{isO?'Orange Cap':'Purple Cap'}</p>
              <p style={{fontSize:10,color:'rgba(255,255,255,0.75)',margin:0,fontFamily:'Poppins,sans-serif'}}>IPL 2026 Leader</p>
            </div>
          </div>
          {rank&&<span style={{fontSize:11,fontWeight:800,color:'rgba(255,255,255,0.8)',fontFamily:'Poppins,sans-serif'}}>#{rank}</span>}
        </div>
      </div>

      <div style={{padding:'14px 16px'}}>
        {/* Player info */}
        {data ? (
          <>
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:14,padding:'12px',background:bg2,borderRadius:12,border:`1px solid ${acc}20`}}>
              <div style={{width:48,height:48,borderRadius:'50%',background:`linear-gradient(135deg,${acc}30,${acc}10)`,border:`2px solid ${acc}40`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>{isO?'🏏':'⚾'}</div>
              <div style={{minWidth:0}}>
                <p style={{fontFamily:'Poppins,sans-serif',fontWeight:800,fontSize:15,color:C.g1,margin:'0 0 3px',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{data.name}</p>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <span style={{fontSize:14}}>{t.e}</span>
                  <p style={{fontSize:11,fontWeight:700,color:t.c,margin:0,fontFamily:'Poppins,sans-serif'}}>{t.s}</p>
                  {data.matches&&<span style={{fontSize:10,color:C.g3,fontFamily:'Poppins,sans-serif'}}>{data.matches} matches</span>}
                </div>
              </div>
            </div>
            {/* Stats */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8}}>
              {stats.map((s,i)=>(
                <div key={i} style={{textAlign:'center',padding:'12px 8px',background:i===0?`${acc}08`:C.g5,borderRadius:12,border:`1px solid ${i===0?`${acc}20`:C.g4}`}}>
                  <p style={{fontFamily:'Poppins,sans-serif',fontWeight:900,fontSize:i===0?22:16,color:i===0?acc:C.g1,margin:'0 0 2px'}}>{s.v??'—'}</p>
                  <p style={{fontSize:9,fontWeight:700,color:C.g3,textTransform:'uppercase',letterSpacing:'0.08em',margin:0,fontFamily:'Poppins,sans-serif'}}>{s.l}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div style={{padding:'20px',textAlign:'center'}}>
            <p style={{fontSize:11,color:C.g3,fontFamily:'Poppins,sans-serif',margin:0}}>Data syncing from Sportmonks…</p>
            <p style={{fontSize:10,color:C.g3,fontFamily:'Poppins,sans-serif',margin:'4px 0 0'}}>Will update after 4 AM IST daily</p>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Match Detail ── */
function Detail({match, onClose}) {
  const t1=getTeam(match.team1), t2=getTeam(match.team2)
  const isLive=match.status==='live', isDone=match.status==='completed'
  return (
    <div style={{position:'fixed',inset:0,zIndex:900,background:C.bg,overflowY:'auto',animation:'slideUp2 0.32s cubic-bezier(.34,1.1,.64,1)'}}>
      {/* Sticky header */}
      <div style={{position:'sticky',top:0,zIndex:10,background:'#fff',borderBottom:`1px solid ${C.g4}`,padding:'14px 16px',display:'flex',alignItems:'center',gap:12,boxShadow:'0 2px 12px rgba(17,24,39,0.08)'}}>
        <button onClick={onClose} style={{width:36,height:36,borderRadius:11,background:C.g5,border:`1px solid ${C.g4}`,cursor:'pointer',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>←</button>
        <div style={{flex:1,display:'flex',alignItems:'center',gap:9}}>
          <TeamBadge name={match.team1} size={26} showName={false}/>
          <p style={{fontFamily:'Poppins,sans-serif',fontWeight:800,fontSize:14,color:C.g1,margin:0}}>{t1.s} vs {t2.s}</p>
          <TeamBadge name={match.team2} size={26} showName={false}/>
        </div>
        {isLive&&<LiveDot sm/>}
      </div>

      <div style={{padding:'16px 16px 80px'}}>
        {/* Score hero */}
        <div style={{borderRadius:20,overflow:'hidden',background:'#fff',border:`1px solid ${C.g4}`,marginBottom:14,boxShadow:'0 4px 20px rgba(17,24,39,0.08)'}}>
          <div style={{height:5,background:`linear-gradient(90deg,${t1.c} 0%,${t1.c} 48%,${t2.c} 52%,${t2.c} 100%)`}}/>
          <div style={{padding:'20px 16px'}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr auto 1fr',alignItems:'center',gap:12,marginBottom:16}}>
              <div style={{textAlign:'center'}}>
                <TeamBadge name={match.team1} size={60} showName={false}/>
                <p style={{fontFamily:'Poppins,sans-serif',fontWeight:800,fontSize:15,color:t1.c,margin:'8px 0 4px'}}>{t1.s}</p>
                {match.score1&&<p style={{fontFamily:'Poppins,sans-serif',fontWeight:900,fontSize:22,color:C.g1,margin:0}}>{match.score1}</p>}
              </div>
              <div style={{textAlign:'center',padding:'0 8px'}}>
                {isLive?<LiveDot/>:isDone?<span style={{fontSize:11,fontWeight:800,color:C.g3,fontFamily:'Poppins,sans-serif'}}>FINAL</span>:<span style={{fontSize:16,fontWeight:800,color:C.g3,fontFamily:'Poppins,sans-serif'}}>VS</span>}
              </div>
              <div style={{textAlign:'center'}}>
                <TeamBadge name={match.team2} size={60} showName={false}/>
                <p style={{fontFamily:'Poppins,sans-serif',fontWeight:800,fontSize:15,color:t2.c,margin:'8px 0 4px'}}>{t2.s}</p>
                {match.score2&&<p style={{fontFamily:'Poppins,sans-serif',fontWeight:900,fontSize:22,color:C.g1,margin:0}}>{match.score2}</p>}
              </div>
            </div>
            {match.result&&(
              <div style={{padding:'10px 14px',background:C.green2,borderRadius:12,textAlign:'center',border:`1px solid ${C.green}25`}}>
                <p style={{fontSize:13,fontWeight:700,color:C.green,margin:0,fontFamily:'Poppins,sans-serif'}}>🏆 {match.result}</p>
              </div>
            )}
          </div>
        </div>

        {/* Info rows */}
        <div style={{borderRadius:16,background:'#fff',border:`1px solid ${C.g4}`,overflow:'hidden',marginBottom:14}}>
          {[{i:'📅',l:'Date',v:fmtDate(match.date)},{i:'⏰',l:'Time',v:fmtTime(match.time)},{i:'📍',l:'Venue',v:match.venue||'TBD'},{i:'🏟',l:'Status',v:(match.status||'').charAt(0).toUpperCase()+(match.status||'').slice(1)}].map((r,i,a)=>(
            <div key={i} style={{display:'flex',alignItems:'flex-start',gap:12,padding:'13px 14px',borderBottom:i<a.length-1?`1px solid ${C.g4}`:'none'}}>
              <span style={{fontSize:16,width:24,textAlign:'center',flexShrink:0}}>{r.i}</span>
              <p style={{fontSize:11,color:C.g3,fontFamily:'Poppins,sans-serif',fontWeight:600,margin:0,width:56,flexShrink:0}}>{r.l}</p>
              <p style={{fontSize:12,color:C.g1,fontFamily:'Poppins,sans-serif',fontWeight:700,margin:0,flex:1}}>{r.v}</p>
            </div>
          ))}
        </div>

        <div style={{padding:'20px',background:'#fff',borderRadius:16,border:`1px solid ${C.g4}`,textAlign:'center'}}>
          <p style={{fontSize:28,marginBottom:8}}>📊</p>
          <p style={{fontFamily:'Poppins,sans-serif',fontWeight:700,fontSize:13,color:C.g2,margin:'0 0 4px'}}>Full Scorecard</p>
          <p style={{fontSize:11,color:C.g3,fontFamily:'Poppins,sans-serif',margin:0}}>Ball-by-ball data via Sportmonks scorecard endpoint</p>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════ */
export default function IPLCricket({currentUser}) {
  const userId = currentUser?.username || null

  const [matches,setMatches]       = useState(null)
  const [leader,setLeader]         = useState(null)
  const [loading,setLoading]       = useState(true)
  const [error,setError]           = useState(null)
  const [tab,setTab]               = useState('today')
  const [detail,setDetail]         = useState(null)
  const [lastUp,setLastUp]         = useState(null)
  const [wallet,setWallet]         = useState(null)
  const [dailyDone,setDailyDone]   = useState(false)
  const [rewardPop,setRewardPop]   = useState(null)

  /* Firestore listeners */
  useEffect(()=>{
    let mL=false, lL=false
    const check=()=>{ if(mL&&lL) setLoading(false) }

    const uM=onSnapshot(doc(db,'ipl_data','matches'),(s)=>{
      if(s.exists()){const d=s.data();setMatches(d);setError(null);if(d.updatedAt)setLastUp(d.updatedAt.toDate?.()??new Date(d.updatedAt))}
      else{setMatches(null);setError('No match data — cloud function has not run yet')}
      mL=true;check()
    },(e)=>{setMatches(null);setError(`${e.code}: Check Firestore rules`);mL=true;check()})

    const uL=onSnapshot(doc(db,'ipl_data','leaderboard'),(s)=>{
      setLeader(s.exists()?s.data():null);lL=true;check()
    },()=>{setLeader(null);lL=true;check()})

    return ()=>{uM();uL()}
  },[])

  /* Wallet */
  useEffect(()=>{
    if(!userId) return
    loadWallet(userId).then(setWallet)
    const unsub=onSnapshot(doc(db,'ipl_wallets',userId),s=>{if(s.exists())setWallet(s.data())},()=>{})
    return ()=>unsub()
  },[userId])

  /* Daily reward */
  useEffect(()=>{
    if(!userId||dailyDone) return
    setDailyDone(true)
    claimDaily(userId).then(r=>{ if(r) setRewardPop(r) })
  },[userId,dailyDone])

  const today    = matches?.today    || []
  const upcoming = matches?.upcoming || []
  const results  = matches?.results  || []
  const hasLive  = today.some(m=>m.status==='live')
  const points   = leader?.points    || []
  const orangeCap= leader?.orange_cap|| null
  const purpleCap= leader?.purple_cap|| null

  const TABS=[
    {id:'today',   icon:'📅', label:'Today',    n:today.length},
    {id:'results', icon:'📊', label:'Results',  n:results.length},
    {id:'upcoming',icon:'🗓', label:'Upcoming', n:upcoming.length},
    {id:'table',   icon:'📋', label:'Table',    n:null},
    {id:'caps',    icon:'🏆', label:'Caps',     n:null},
  ]

  return (
    <div>
      <style>{`
        @keyframes pulse    { 0%,100%{opacity:1;transform:scale(1)}  50%{opacity:0.3;transform:scale(0.75)} }
        @keyframes shimmer  { 0%{background-position:200% center}    100%{background-position:-200% center} }
        @keyframes fadeIn   { from{opacity:0} to{opacity:1} }
        @keyframes slideUp  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideUp2 { from{opacity:0;transform:translateY(60px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin     { to{transform:rotate(360deg)} }
        @keyframes popIn    { 0%{opacity:0;transform:scale(0.85)} 70%{transform:scale(1.03)} 100%{opacity:1;transform:scale(1)} }
        .ipl-t { transition:all 0.18s; } .ipl-t:active{transform:scale(0.94);}
      `}</style>

      {/* Detail view */}
      {detail && <Detail match={detail} onClose={()=>setDetail(null)}/>}

      {/* Daily reward popup */}
      {rewardPop && (
        <div style={{position:'fixed',inset:0,zIndex:950,background:'rgba(17,24,39,0.55)',display:'flex',alignItems:'center',justifyContent:'center',padding:20,backdropFilter:'blur(6px)'}} onClick={()=>setRewardPop(null)}>
          <div style={{width:'100%',maxWidth:310,background:'#fff',borderRadius:24,padding:'28px 22px',textAlign:'center',boxShadow:'0 24px 60px rgba(17,24,39,0.22)',animation:'popIn 0.4s cubic-bezier(.34,1.56,.64,1)'}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:52,marginBottom:10}}>🎁</div>
            <p style={{fontFamily:'Poppins,sans-serif',fontWeight:900,fontSize:20,color:C.g1,margin:'0 0 4px'}}>Daily Reward!</p>
            <p style={{fontSize:13,color:C.g2,margin:'0 0 18px',fontFamily:'Poppins,sans-serif'}}>🔥 Day {rewardPop.streak} streak</p>
            <div style={{padding:'16px',background:C.gold2,borderRadius:14,border:`1.5px solid ${C.gold}30`,marginBottom:18}}>
              <p style={{fontFamily:'Poppins,sans-serif',fontWeight:900,fontSize:36,color:C.gold,margin:0}}>+{rewardPop.coins} 💰</p>
            </div>
            <button onClick={()=>setRewardPop(null)} style={{width:'100%',padding:'13px',borderRadius:14,border:'none',background:`linear-gradient(135deg,${C.blue},#1A3DAB)`,color:'#fff',fontFamily:'Poppins,sans-serif',fontWeight:800,fontSize:14,cursor:'pointer',boxShadow:`0 4px 16px ${C.blue}40`}}>
              Let's predict! 🏏
            </button>
          </div>
        </div>
      )}

      {/* ── IPL Premium Header ── */}
      <div style={{borderRadius:20,overflow:'hidden',marginBottom:14,boxShadow:'0 8px 32px rgba(0,30,100,0.28)'}}>
        <div style={{background:'linear-gradient(135deg,#002A7F 0%,#0A1F6E 45%,#001563 100%)',padding:'14px 16px',position:'relative',overflow:'hidden'}}>
          {/* Decorative circles like IPL brand */}
          <div style={{position:'absolute',top:-40,right:-30,width:160,height:160,borderRadius:'50%',border:'1.5px solid rgba(255,255,255,0.07)',pointerEvents:'none'}}/>
          <div style={{position:'absolute',top:-15,right:20,width:90,height:90,borderRadius:'50%',border:'1.5px solid rgba(255,255,255,0.06)',pointerEvents:'none'}}/>
          <div style={{position:'absolute',bottom:-30,left:-15,width:110,height:110,borderRadius:'50%',border:'1.5px solid rgba(255,255,255,0.05)',pointerEvents:'none'}}/>
          {/* Top multicolor stripe like IPL */}
          <div style={{position:'absolute',top:0,left:0,right:0,height:3,background:'linear-gradient(90deg,#FF6B35 0%,#FFD700 33%,#00C9A7 66%,#6C5CE7 100%)'}}/>

          <div style={{position:'relative',zIndex:2,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              {/* IPL Logo */}
              <div style={{width:44,height:44,borderRadius:12,overflow:'hidden',background:'rgba(255,255,255,0.1)',border:'1.5px solid rgba(255,255,255,0.18)',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
                <img src="/ipl_logo.jpeg" alt="IPL"
                  onError={e=>{e.target.style.display='none';e.target.parentNode.innerHTML='<span style="font-size:24px">🏏</span>'}}
                  style={{width:'100%',height:'100%',objectFit:'cover'}}/>
              </div>
              <div>
                <div style={{display:'flex',alignItems:'center',gap:7}}>
                  <p style={{fontFamily:'Syne,sans-serif',fontWeight:900,fontSize:17,color:'#fff',margin:0,letterSpacing:'0.03em'}}>TATA IPL 2026</p>
                  {hasLive && <LiveDot sm/>}
                </div>
                <p style={{fontSize:9,color:'rgba(255,255,255,0.5)',margin:0,fontFamily:'Poppins,sans-serif',letterSpacing:'0.08em',textTransform:'uppercase'}}>Indian Premier League</p>
              </div>
            </div>
            {/* Coin balance */}
            <div style={{display:'flex',alignItems:'center',gap:6,padding:'7px 14px',background:'rgba(255,215,0,0.12)',border:'1.5px solid rgba(255,215,0,0.3)',borderRadius:24}}>
              <span style={{fontSize:16}}>💰</span>
              <p style={{fontFamily:'Poppins,sans-serif',fontWeight:900,fontSize:15,color:'#FFD700',margin:0}}>
                {wallet ? (wallet.coins??500).toLocaleString() : '500'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:6,marginBottom:14,overflowX:'auto',paddingBottom:2,scrollbarWidth:'none'}}>
        {TABS.map(t=>(
          <button key={t.id} className="ipl-t" onClick={()=>setTab(t.id)} style={{
            padding:'8px 14px',borderRadius:22,fontWeight:700,fontSize:11,whiteSpace:'nowrap',cursor:'pointer',
            border:'none',flexShrink:0,fontFamily:'Poppins,sans-serif',display:'flex',alignItems:'center',gap:5,
            background:tab===t.id?C.blue:'#fff',color:tab===t.id?'#fff':C.g2,
            boxShadow:tab===t.id?`0 4px 16px ${C.blue}40`:'0 1px 4px rgba(17,24,39,0.08)',
          }}>
            {t.icon} {t.label}
            {t.n>0&&<span style={{fontSize:9,padding:'1px 6px',borderRadius:10,background:tab===t.id?'rgba(255,255,255,0.25)':'#F3F4F6',color:tab===t.id?'#fff':C.g3,fontWeight:800}}>{t.n}</span>}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div><Skel h={230} r={20}/><Skel h={120}/><Skel h={90}/></div>
      ) : error&&!matches ? (
        <div style={{textAlign:'center',padding:'32px 20px',background:'#fff',borderRadius:16,border:`1.5px solid ${C.red}20`}}>
          <p style={{fontSize:32,marginBottom:10}}>📡</p>
          <p style={{fontWeight:800,fontSize:14,color:C.red,fontFamily:'Poppins,sans-serif',margin:'0 0 6px'}}>No Data</p>
          <p style={{fontSize:12,color:C.g3,fontFamily:'Poppins,sans-serif',lineHeight:1.6}}>{error}</p>
        </div>
      ) : (
        <div style={{animation:'slideUp 0.28s ease-out both'}}>

          {tab==='today' && (
            today.length===0
              ? <div style={{textAlign:'center',padding:'40px 20px',background:'#fff',borderRadius:18,border:`1px solid ${C.g4}`,boxShadow:'0 2px 10px rgba(17,24,39,0.06)'}}>
                  <p style={{fontSize:40,marginBottom:12}}>🏏</p>
                  <p style={{fontWeight:800,fontSize:15,color:C.g2,fontFamily:'Poppins,sans-serif',margin:'0 0 5px'}}>No matches today</p>
                  <p style={{fontSize:12,color:C.g3,fontFamily:'Poppins,sans-serif'}}>Check the Upcoming tab</p>
                </div>
              : today.map((m,i)=><HeroCard key={m.id||i} match={m} userId={userId} wallet={wallet} onPredicted={c=>setWallet(w=>({...w,coins:(w?.coins||100)-c}))} onClick={setDetail}/>)
          )}

          {tab==='results' && (
            results.length===0
              ? <div style={{textAlign:'center',padding:'28px',background:'#fff',borderRadius:16,border:`1px solid ${C.g4}`}}><p style={{fontSize:12,color:C.g3,fontFamily:'Poppins,sans-serif'}}>No results yet</p></div>
              : results.map((m,i)=><ResultCard key={m.id||i} match={m} onClick={setDetail}/>)
          )}

          {tab==='upcoming' && (
            upcoming.length===0
              ? <div style={{textAlign:'center',padding:'28px',background:'#fff',borderRadius:16,border:`1px solid ${C.g4}`}}><p style={{fontSize:12,color:C.g3,fontFamily:'Poppins,sans-serif'}}>No upcoming matches scheduled</p></div>
              : (
                <>
                  {/* Horizontal scroll */}
                  <div style={{display:'flex',gap:10,overflowX:'auto',paddingBottom:12,scrollbarWidth:'none',marginBottom:14}}>
                    {upcoming.map((m,i)=><UpCard key={m.id||i} match={m}/>)}
                  </div>
                  {/* Also show predict on upcoming */}
                  {userId && upcoming.slice(0,3).map((m,i)=><HeroCard key={`up${m.id||i}`} match={m} userId={userId} wallet={wallet} onPredicted={c=>setWallet(w=>w?{...w,coins:Math.max(0,(w.coins||500)-c)}:w)} onClick={setDetail}/>)}
                </>
              )
          )}

          {tab==='table' && <Table points={points}/>}

          {tab==='caps' && (
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <CapCard data={orangeCap} type="orange"/>
              <CapCard data={purpleCap} type="purple"/>
              {!orangeCap && !purpleCap && (
                <div style={{padding:'20px',background:'#fff',borderRadius:16,border:`1px solid ${C.g4}`,textAlign:'center'}}>
                  <p style={{fontSize:12,color:C.g3,fontFamily:'Poppins,sans-serif',margin:0}}>Cap stats refresh daily at 4 AM IST via Sportmonks API</p>
                </div>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  )
}