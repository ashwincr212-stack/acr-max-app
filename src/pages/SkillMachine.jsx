import { useState, useEffect, useRef, useCallback } from 'react'
import { useLanguage } from '../context/LanguageContext'
import { db } from '../firebase'
import { doc, getDoc, setDoc, updateDoc, increment, arrayUnion, serverTimestamp } from 'firebase/firestore'

/* ══════════════════════════════════════════════════════
   ACR MAX — Skill Machine v2
   Infinite puzzle engine · No repeat · Difficulty scaling
   Coins are virtual tokens with no monetary value
══════════════════════════════════════════════════════ */

const MAX_ATTEMPTS  = 3
const COOLDOWN_MS   = 3 * 60 * 60 * 1000
const MILESTONE_AT  = 4
const ATTEMPT_REWARDS = [10, 30, 50]
const TIMER_SECONDS = [12, 9, 7]   // time per attempt level

/* ══ INFINITE PUZZLE ENGINE ══ */

/* Quick Math — parametric generation */
function genMath(level) {
  const ops   = level === 0 ? ['+'] : level === 1 ? ['+','-','×'] : ['+','-','×','÷']
  const op    = ops[Math.floor(Math.random()*ops.length)]
  const range = level === 0 ? 12 : level === 1 ? 25 : 50
  let a,b,ans
  if (op==='+')  { a=Math.floor(Math.random()*range)+1; b=Math.floor(Math.random()*range)+1; ans=a+b }
  else if(op==='-'){ a=Math.floor(Math.random()*range)+range/2|0; b=Math.floor(Math.random()*(a-1))+1; ans=a-b }
  else if(op==='×'){ a=Math.floor(Math.random()*9)+2; b=Math.floor(Math.random()*9)+2; ans=a*b }
  else { b=Math.floor(Math.random()*8)+2; ans=Math.floor(Math.random()*9)+2; a=b*ans }
  const wrongs=new Set()
  while(wrongs.size<3){const w=ans+Math.floor(Math.random()*(range/2))-(range/4); if(w!==ans&&w>0)wrongs.add(w)}
  return { type:'math', q:`${a} ${op} ${b} = ?`, ans, opts:[...wrongs,ans].sort(()=>Math.random()-0.5), id:`m${a}${op}${b}` }
}

/* Number Series — find next number */
function genSeries(level) {
  const patterns = level===0
    ? [ ()=>{ const s=Math.floor(Math.random()*5)+1,d=Math.floor(Math.random()*4)+1; const seq=[s,s+d,s+2*d,s+3*d]; return{seq,ans:s+4*d,rule:'+ '+d} },
        ()=>{ const s=Math.floor(Math.random()*3)+2,m=2; const seq=[s,s*m,s*m*m,s*m*m*m]; return{seq,ans:seq[3]*m,rule:'× '+m} } ]
    : level===1
    ? [ ()=>{ const s=Math.floor(Math.random()*10)+2,d=Math.floor(Math.random()*8)+2; const seq=[s,s+d,s+2*d,s+3*d]; return{seq,ans:s+4*d,rule:'+ '+d} },
        ()=>{ const s=Math.floor(Math.random()*4)+2,m=Math.floor(Math.random()*2)+2; const seq=[s,s*m,s*m**2,s*m**3]; return{seq,ans:s*m**4,rule:'× '+m} },
        ()=>{ let a=1,b=1,seq=[a,b]; for(let i=0;i<3;i++){const n=a+b;seq.push(n);a=b;b=n;} return{seq:seq.slice(0,4),ans:a+b,rule:'Fibonacci'} } ]
    : [ ()=>{ const s=Math.floor(Math.random()*3)+2,e=Math.floor(Math.random()*2)+2; const seq=[s,s**e,s**(e+1),s**(e+2)]; return{seq,ans:s**(e+3),rule:`^`} },
        ()=>{ const p=x=>x*x; const n=Math.floor(Math.random()*3)+2; const seq=[p(n),p(n+1),p(n+2),p(n+3)]; return{seq,ans:p(n+4),rule:'n²'} } ]
  const pick = patterns[Math.floor(Math.random()*patterns.length)]()
  const ans  = pick.ans
  const w    = new Set()
  while(w.size<3){const d=Math.floor(Math.random()*15)+1;if(d!==ans&&d>0)w.add(ans+(Math.random()>0.5?d:-d))}
  return { type:'series', q:`${pick.seq.join(' → ')} → ?`, ans, opts:[...w,ans].sort(()=>Math.random()-0.5), id:`s${pick.seq.join('')}` }
}

/* Logical Reasoning — word puzzles */
const LOGIC_Q = [
  { q:"If all cats are animals and some animals are wild, are all cats wild?",                    opts:["Yes","No","Cannot determine","Maybe"],         ans:"Cannot determine", id:'l1' },
  { q:"A bat and ball cost ₹110. The bat costs ₹100 more than the ball. How much is the ball?", opts:["₹10","₹5","₹15","₹20"],                       ans:"₹5",              id:'l2' },
  { q:"5 machines make 5 parts in 5 minutes. How long for 100 machines to make 100 parts?",     opts:["100 min","5 min","10 min","50 min"],            ans:"5 min",           id:'l3' },
  { q:"A doctor's son's father is not a doctor. How?",                                          opts:["Son is a girl","Doctor is a woman","Adopted","Stepson"], ans:"Doctor is a woman",id:'l4' },
  { q:"If you overtake the person in 2nd place, what place are you in?",                        opts:["1st","2nd","3rd","4th"],                        ans:"2nd",             id:'l5' },
  { q:"Which is heavier: a kg of gold or a kg of feathers?",                                   opts:["Gold","Feathers","Same","Gold is denser"],      ans:"Same",            id:'l6' },
  { q:"A rooster lays an egg on a rooftop. Which way does it roll?",                           opts:["Left","Right","It doesn't","Downhill"],         ans:"It doesn't",      id:'l7' },
  { q:"How many months have 28 days?",                                                          opts:["1","2","4","12"],                               ans:"12",              id:'l8' },
  { q:"If PENCIL = 7, PAPER = 5, then NOTEBOOK = ?",                                          opts:["8","9","7","6"],                                ans:"8",               id:'l9' },
  { q:"Two fathers and two sons go fishing. They catch 3 fish, one each. How?",               opts:["Magic","Grandfather, father, son","Story","4 people"], ans:"Grandfather, father, son",id:'l10' },
  { q:"I have cities but no houses. Mountains but no trees. Water but no fish. What am I?",   opts:["Dream","Map","Painting","Desert"],              ans:"Map",             id:'l11' },
  { q:"What gets wetter as it dries?",                                                         opts:["Rain","Towel","Sun","Sand"],                    ans:"Towel",           id:'l12' },
  { q:"A number doubled then halved returns to original. The number is?",                      opts:["Any","Zero only","Even only","Odd only"],       ans:"Any",             id:'l13' },
]

/* Odd One Out — more variety */
const ODD_SETS = [
  { items:['🍎','🍊','🍋','🥕'], ans:3, hint:'Not a fruit' },
  { items:['🐕','🐈','🐟','🦁'], ans:2, hint:'Not a land animal' },
  { items:['A','E','I','B'],     ans:3, hint:'Not a vowel' },
  { items:['2','4','7','8'],     ans:2, hint:'Not even' },
  { items:['Mars','Venus','Moon','Jupiter'], ans:2, hint:'Not a planet' },
  { items:['Cricket','Chess','Football','Carom'], ans:2, hint:'Played on field' },
  { items:['Rose','Lotus','Tulip','Mango'], ans:3, hint:'Not a flower' },
  { items:['Python','Cobra','Mamba','Parrot'], ans:3, hint:'Not a snake' },
  { items:['KG','GRAM','LITRE','TON'], ans:2, hint:'Not a weight unit' },
  { items:['RED','BLUE','ROUND','GREEN'], ans:2, hint:'Not a color' },
  { items:['Sun','Moon','Star','Cloud'], ans:3, hint:'Not in space' },
  { items:['3','9','7','27'], ans:2, hint:'Not a power of 3' },
]

/* Tap Order — generate fresh sequences */
function genOrder(level) {
  const count = level===0 ? 3 : level===1 ? 4 : 5
  const nums  = Array.from({length:count},(_,i)=>i+1).sort(()=>Math.random()-0.5)
  return { type:'order', nums, ans:[...Array(count)].map((_,i)=>i+1), count, id:`o${nums.join('')}` }
}

/* Pattern Memory — bigger grid at higher levels */
function genPattern(level) {
  const size  = level===0 ? 4 : level===1 ? 6 : 9
  const count = level===0 ? 2 : level===1 ? 3 : 4
  const cells = Array.from({length:size},(_,i)=>i)
  const highlighted = [...cells].sort(()=>Math.random()-0.5).slice(0,count)
  return { type:'pattern', size, highlighted, count, id:`p${highlighted.sort().join('')}` }
}

/* Visual Reasoning — "which comes next" style */
const VISUAL_Q = [
  { q:"🔴🔵🔴🔵🔴 → next?",    opts:['🔴','🔵','🟢','🟡'], ans:'🔵', id:'v1' },
  { q:"1 🌟 → 2 🌟🌟 → 3 → ?", opts:['🌟🌟🌟','🌟🌟','🌟🌟🌟🌟','🌟'], ans:'🌟🌟🌟', id:'v2' },
  { q:"⬆️➡️⬇️⬅️⬆️ → next?",   opts:['➡️','⬆️','⬇️','⬅️'], ans:'➡️', id:'v3' },
  { q:"🟦🟦🟥 🟦🟦🟥 → next 3?", opts:['🟦🟦🟥','🟥🟦🟦','🟦🟥🟦','🟥🟥🟦'], ans:'🟦🟦🟥', id:'v4' },
]

const ALL_TYPES = ['math','series','logic','odd','order','pattern','visual']
let lastType = ''

function genPuzzle(level, seenIds=[]) {
  // Rotate types, avoid repeat
  let types = ALL_TYPES.filter(t=>t!==lastType)
  const type = types[Math.floor(Math.random()*types.length)]
  lastType = type

  // Try up to 8 times to get unseen puzzle
  for (let attempt=0; attempt<8; attempt++) {
    let puzzle
    if (type==='math')    puzzle = genMath(level)
    else if(type==='series') puzzle = genSeries(level)
    else if(type==='logic')  { const q=LOGIC_Q[Math.floor(Math.random()*LOGIC_Q.length)]; puzzle={...q,type:'logic'} }
    else if(type==='odd')    { const s=ODD_SETS[Math.floor(Math.random()*ODD_SETS.length)]; puzzle={...s,type:'odd',id:`d${s.items.join('')}`} }
    else if(type==='order')  puzzle = genOrder(level)
    else if(type==='pattern')puzzle = genPattern(level)
    else { const v=VISUAL_Q[Math.floor(Math.random()*VISUAL_Q.length)]; puzzle={...v,type:'visual'} }

    if (!seenIds.includes(puzzle.id)) return puzzle
  }
  // Fallback: always return math (always fresh due to random params)
  return genMath(level)
}

/* ══ UTILITY ══ */
const clean = obj => Object.fromEntries(Object.entries(obj).filter(([,v])=>v!==undefined&&v!==null))

/* ══ PUZZLE COMPONENTS ══ */

function ChoicePuzzle({ puzzle, onAnswer, disabled }) {
  const [sel,setSel] = useState(null)
  const opts = puzzle.opts || [puzzle.ans]
  const ans  = puzzle.ans
  const done = sel !== null

  const pick = (o) => {
    if (disabled||done) return
    setSel(o)
    setTimeout(()=>onAnswer(o===ans), 320)
  }

  return (
    <div>
      <p style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:22,color:'#fff',textAlign:'center',margin:'0 0 24px',lineHeight:1.3,letterSpacing:'-0.01em'}}>{puzzle.q}</p>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        {opts.map((o,i)=>{
          const isRight = done && o===ans
          const isWrong = done && o===sel && sel!==ans
          return (
            <button key={i} onClick={()=>pick(o)} disabled={disabled||done}
              style={{padding:'14px 10px',borderRadius:14,cursor:done?'default':'pointer',transition:'all 0.2s',
                fontFamily:'Poppins,sans-serif',fontWeight:700,fontSize:15,textAlign:'center',
                border:isRight?'2px solid #34D399':isWrong?'2px solid #F87171':'1px solid rgba(255,255,255,0.12)',
                background:isRight?'rgba(52,211,153,0.15)':isWrong?'rgba(248,113,113,0.15)':sel===o?'rgba(99,102,241,0.2)':'rgba(255,255,255,0.06)',
                color:isRight?'#34D399':isWrong?'#F87171':'#fff',
                boxShadow:isRight?'0 0 16px rgba(52,211,153,0.3)':isWrong?'0 0 8px rgba(248,113,113,0.2)':'none',
                transform:!done&&!disabled?undefined:'none'}}>
              {o}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function OddPuzzle({ puzzle, onAnswer, disabled }) {
  const [sel,setSel] = useState(null)
  const done = sel!==null
  return (
    <div>
      <p style={{fontSize:11,color:'rgba(255,255,255,0.45)',textAlign:'center',margin:'0 0 16px',letterSpacing:'0.08em',textTransform:'uppercase',fontFamily:'Poppins,sans-serif'}}>{puzzle.hint}</p>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,maxWidth:260,margin:'0 auto'}}>
        {puzzle.items.map((item,i)=>{
          const isRight=done&&i===puzzle.ans
          const isWrong=done&&sel===i&&i!==puzzle.ans
          return (
            <button key={i} onClick={()=>{if(done||disabled)return;setSel(i);setTimeout(()=>onAnswer(i===puzzle.ans),300)}}
              style={{padding:'18px',borderRadius:14,fontSize:28,cursor:done?'default':'pointer',transition:'all 0.2s',
                border:isRight?'2px solid #34D399':isWrong?'2px solid #F87171':'1px solid rgba(255,255,255,0.1)',
                background:isRight?'rgba(52,211,153,0.12)':isWrong?'rgba(248,113,113,0.12)':'rgba(255,255,255,0.06)'}}>
              {item}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function OrderPuzzle({ puzzle, onAnswer, disabled }) {
  const [tapped,setTapped] = useState([])
  const done = tapped.length===puzzle.count
  return (
    <div>
      <p style={{fontSize:11,color:'rgba(255,255,255,0.45)',textAlign:'center',margin:'0 0 10px',letterSpacing:'0.06em',textTransform:'uppercase',fontFamily:'Poppins,sans-serif'}}>Tap 1 → {puzzle.count} in order</p>
      <div style={{display:'flex',gap:6,justifyContent:'center',marginBottom:20,minHeight:30}}>
        {tapped.map((n,i)=><span key={i} style={{width:26,height:26,borderRadius:8,background:'#3B82F6',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:800,color:'#fff',fontFamily:'Poppins,sans-serif'}}>{n}</span>)}
        {Array.from({length:puzzle.count-tapped.length}).map((_,i)=><span key={i} style={{width:26,height:26,borderRadius:8,background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.1)',display:'inline-flex'}}/>)}
      </div>
      <div style={{display:'flex',gap:10,flexWrap:'wrap',justifyContent:'center'}}>
        {puzzle.nums.map((n,i)=>{
          const used=tapped.includes(n)
          return (
            <button key={i} disabled={used||done||disabled} onClick={()=>{
              const next=[...tapped,n]; setTapped(next)
              if(next.length===puzzle.count)setTimeout(()=>onAnswer(next.every((v,j)=>v===puzzle.ans[j])),300)
            }} style={{width:54,height:54,borderRadius:14,fontFamily:'Poppins,sans-serif',fontWeight:900,fontSize:22,
              border:used?'1px solid rgba(59,130,246,0.3)':'1px solid rgba(255,255,255,0.15)',
              background:used?'rgba(59,130,246,0.15)':'rgba(255,255,255,0.07)',
              color:used?'rgba(59,130,246,0.4)':'#fff',cursor:used||done?'not-allowed':'pointer',transition:'all 0.15s'}}>{n}</button>
          )
        })}
      </div>
    </div>
  )
}

function PatternPuzzle({ puzzle, onAnswer, disabled }) {
  const [phase,setPhase]=useState('show')
  const [tapped,setTapped]=useState([])
  const cols=puzzle.size<=4?2:3
  useEffect(()=>{const t=setTimeout(()=>setPhase('input'),1800);return()=>clearTimeout(t)},[])
  return (
    <div>
      <p style={{fontSize:11,color:'rgba(255,255,255,0.45)',textAlign:'center',margin:'0 0 14px',letterSpacing:'0.06em',textTransform:'uppercase',fontFamily:'Poppins,sans-serif'}}>
        {phase==='show'?`Memorise ${puzzle.count} cells…`:`Tap the ${puzzle.count} highlighted cells`}
      </p>
      <div style={{display:'grid',gridTemplateColumns:`repeat(${cols},1fr)`,gap:8,maxWidth:220,margin:'0 auto'}}>
        {Array.from({length:puzzle.size}).map((_,i)=>{
          const isHL=puzzle.highlighted.includes(i), isTapped=tapped.includes(i)
          return (
            <button key={i} onClick={()=>{
              if(phase!=='input'||tapped.includes(i)||disabled)return
              const next=[...tapped,i]; setTapped(next)
              if(next.length===puzzle.count){
                setTimeout(()=>onAnswer(puzzle.highlighted.every(h=>next.includes(h))),300)
              }
            }} style={{aspectRatio:'1',borderRadius:12,transition:'all 0.2s',cursor:phase==='input'?'pointer':'not-allowed',
              background:phase==='show'&&isHL?'linear-gradient(135deg,#3B82F6,#8B5CF6)':isTapped?'rgba(59,130,246,0.4)':'rgba(255,255,255,0.06)',
              border:'1px solid rgba(255,255,255,0.08)',
              boxShadow:phase==='show'&&isHL?'0 0 18px rgba(59,130,246,0.6)':'none'}}/>
          )
        })}
      </div>
    </div>
  )
}

/* ══ TIMER BAR ══ */
function TimerBar({ seconds, onExpire, running }) {
  const [left,setLeft] = useState(seconds)
  useEffect(()=>{
    setLeft(seconds)
    if(!running) return
    const t=setInterval(()=>setLeft(s=>{if(s<=1){clearInterval(t);onExpire();return 0}return s-1}),1000)
    return()=>clearInterval(t)
  },[seconds,running])
  const pct=(left/seconds)*100
  return (
    <div style={{marginBottom:20}}>
      <div style={{height:4,borderRadius:2,background:'rgba(255,255,255,0.08)',overflow:'hidden'}}>
        <div style={{height:'100%',borderRadius:2,transition:'width 1s linear',
          width:`${pct}%`,background:pct>50?'#3B82F6':pct>25?'#F59E0B':'#EF4444'}}/>
      </div>
      <div style={{display:'flex',justifyContent:'space-between',marginTop:5}}>
        <span style={{fontSize:9,color:'rgba(255,255,255,0.3)',fontFamily:'Poppins,sans-serif',letterSpacing:'0.06em',textTransform:'uppercase'}}>Time remaining</span>
        <span style={{fontSize:11,fontWeight:800,color:pct>25?'rgba(255,255,255,0.6)':'#EF4444',fontFamily:'monospace'}}>{left}s</span>
      </div>
    </div>
  )
}

/* ══ FEEDBACK OVERLAY ══ */
function FeedbackFlash({ correct, coins, onDone }) {
  useEffect(()=>{const t=setTimeout(onDone,correct?1100:800);return()=>clearTimeout(t)},[])
  return (
    <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
      background:correct?'rgba(52,211,153,0.1)':'rgba(248,113,113,0.08)',borderRadius:20,zIndex:10,
      animation:'smFeed 0.25s ease'}}>
      <div style={{fontSize:50,animation:'smPop 0.4s cubic-bezier(.34,1.56,.64,1)'}}>{correct?'✅':'❌'}</div>
      {correct&&<p style={{fontFamily:'Syne,sans-serif',fontWeight:900,fontSize:26,color:'#34D399',margin:'8px 0 0',animation:'smCoin 0.7s ease-out'}}>+{coins} 💰</p>}
      {!correct&&<p style={{fontFamily:'Poppins,sans-serif',fontWeight:700,fontSize:13,color:'rgba(255,255,255,0.35)',margin:'8px 0 0',animation:'smShake 0.4s ease'}}>Try the next one!</p>}
    </div>
  )
}

/* ══ MILESTONE ══ */
function MilestoneCelebration({ onDone }) {
  useEffect(()=>{const t=setTimeout(onDone,3200);return()=>clearTimeout(t)},[])
  return (
    <div style={{position:'fixed',inset:0,zIndex:1000,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:'rgba(15,23,42,0.96)',backdropFilter:'blur(20px)'}}>
      <div style={{textAlign:'center',animation:'smPop 0.6s cubic-bezier(.34,1.56,.64,1)'}}>
        <div style={{fontSize:64,marginBottom:16}}>🏆</div>
        <p style={{fontFamily:'Syne,sans-serif',fontWeight:900,fontSize:30,color:'#fff',margin:'0 0 8px',letterSpacing:'-0.02em'}}>ACR MAX Unlocked!</p>
        <p style={{fontSize:14,color:'rgba(255,255,255,0.4)',margin:'0 0 28px',fontFamily:'Poppins,sans-serif'}}>Milestone achieved · {MILESTONE_AT} correct answers</p>
        <div style={{padding:'16px 40px',background:'linear-gradient(135deg,#F59E0B,#D97706)',borderRadius:40,boxShadow:'0 0 60px rgba(245,158,11,0.5)',display:'inline-block'}}>
          <p style={{fontFamily:'Syne,sans-serif',fontWeight:900,fontSize:36,color:'#fff',margin:0}}>+200 💰</p>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════
   MAIN MODAL
══════════════════════════════════════════ */
export function SkillMachineModal({ userId, isOpen, onClose, onReward }) {
  const { t } = useLanguage()
  const [phase,setPhase]         = useState('idle')
  const [attemptNum,setAttemptNum]= useState(0)
  const [puzzle,setPuzzle]       = useState(null)
  const [feedback,setFeedback]   = useState(null)
  const [totalCoins,setTotalCoins]= useState(0)
  const [successCount,setSuccessCount]=useState(0)
  const [seenIds,setSeenIds]     = useState([])
  const [cdStr,setCdStr]         = useState('')
  const [locked,setLocked]       = useState(false)
  const [lastUsed,setLastUsed]   = useState(null)
  const [loading,setLoading]     = useState(true)
  const [showMilestone,setShowMilestone]=useState(false)
  const [bestScore,setBestScore] = useState(0)
  const [timerRunning,setTimerRunning]=useState(false)
  const timerRef = useRef(null)

  const diffLevel = Math.min(2, Math.floor(successCount/3))

  const load = useCallback(async()=>{
    if(!userId) return
    setLoading(true)
    try {
      const snap = await getDoc(doc(db,'ipl_wallets',userId))
      const d    = snap.exists()?snap.data():{}
      const sm   = d.skillMachine||{}
      const used = sm.attemptsUsed||0
      const last = sm.lastUsed?.toDate?.()|| null
      const scs  = sm.successCount||0
      const seen = sm.seenPuzzleIds||[]
      const best = sm.bestScore||0
      setSuccessCount(scs); setSeenIds(seen); setBestScore(best)
      if(last&&(Date.now()-last.getTime())>=COOLDOWN_MS){
        setAttemptNum(0);setLocked(false);setLastUsed(null)
      } else {
        setAttemptNum(used);setLastUsed(last);setLocked(used>=MAX_ATTEMPTS)
        if(used>=MAX_ATTEMPTS&&last) startTimer(last)
      }
    } catch(e){console.error('SM load:',e)}
    setLoading(false)
  },[userId])

  useEffect(()=>{if(isOpen&&userId){setPhase('idle');setTotalCoins(0);load()}},[isOpen,userId])

  const startTimer=(last)=>{
    clearInterval(timerRef.current)
    const tick=()=>{
      const rem=Math.max(0,COOLDOWN_MS-(Date.now()-last.getTime()))
      if(rem===0){setLocked(false);setAttemptNum(0);clearInterval(timerRef.current);load();return}
      const h=Math.floor(rem/3600000),m=Math.floor((rem%3600000)/60000),s=Math.floor((rem%60000)/1000)
      setCdStr(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`)
    }
    tick();timerRef.current=setInterval(tick,1000)
  }
  useEffect(()=>()=>clearInterval(timerRef.current),[])

  const startAttempt=()=>{
    if(locked||attemptNum>=MAX_ATTEMPTS) return
    const p=genPuzzle(diffLevel,seenIds)
    setPuzzle(p);setFeedback(null);setTimerRunning(true);setPhase('playing')
  }

  const handleAnswer=async(correct)=>{
    setTimerRunning(false);setPhase('feedback')
    const coins = correct ? ATTEMPT_REWARDS[attemptNum] : 0
    const newAttempt = attemptNum+1
    const now=new Date()
    setFeedback({correct,coins})

    try {
      const ref=doc(db,'ipl_wallets',userId)
      const snap=await getDoc(ref); const d=snap.exists()?snap.data():{}
      const sm=d.skillMachine||{}
      const newSC = correct?(sm.successCount||0)+1:(sm.successCount||0)
      const milestone = correct && newSC>0 && newSC%MILESTONE_AT===0
      const newBest = Math.max(sm.bestScore||0, totalCoins+(correct?coins:0)+(milestone?200:0))
      const updates=clean({
        'skillMachine.attemptsUsed': newAttempt,
        'skillMachine.successCount': newSC,
        'skillMachine.lastUsed':     serverTimestamp(),
        'skillMachine.bestScore':    newBest,
      })
      // Mark puzzle as seen
      if(puzzle?.id) updates['skillMachine.seenPuzzleIds']=arrayUnion(puzzle.id)
      const newCoins=(d.coins||500)+(correct?coins:0)+(milestone?200:0)
      updates.coins=newCoins
      await setDoc(ref,updates,{merge:true})
      setAttemptNum(newAttempt);setSuccessCount(newSC);setBestScore(newBest)
      if(puzzle?.id) setSeenIds(s=>[...s,puzzle.id])
      if(correct){setTotalCoins(t=>t+coins);onReward?.({coins})}
      if(milestone){setTimeout(()=>setShowMilestone(true),1300);if(correct)onReward?.({coins:200,milestone:true})}
      if(newAttempt>=MAX_ATTEMPTS){setLocked(true);setLastUsed(now);startTimer(now)}
    } catch(e){console.error('SM save:',e)}
  }

  const afterFeedback=()=>{ setPhase(attemptNum>=MAX_ATTEMPTS?'done':'idle') }
  const onTimeExpire=()=>{ handleAnswer(false) }

  if(!isOpen) return null
  const attemptsLeft=Math.max(0,MAX_ATTEMPTS-attemptNum)
  const progressToMilestone=successCount%MILESTONE_AT
  const levelLabel=['Easy','Medium','Hard'][diffLevel]
  const levelColor=['#34D399','#F59E0B','#EF4444'][diffLevel]

  return (
    <>
    <style>{`
      @keyframes smFeed  {from{opacity:0}to{opacity:1}}
      @keyframes smPop   {0%{transform:scale(0.5)}70%{transform:scale(1.12)}100%{transform:scale(1)}}
      @keyframes smCoin  {0%{opacity:0;transform:translateY(8px)}100%{opacity:1;transform:translateY(0)}}
      @keyframes smShake {0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
      @keyframes smGlow  {0%,100%{box-shadow:0 0 20px rgba(99,102,241,0.3)}50%{box-shadow:0 0 40px rgba(99,102,241,0.7)}}
    `}</style>

    {showMilestone&&<MilestoneCelebration onDone={()=>{setShowMilestone(false);onReward?.({coins:200,milestone:true})}}/>}
    <div onClick={onClose} style={{position:'fixed',inset:0,zIndex:820,background:'rgba(0,0,0,0.85)',backdropFilter:'blur(12px)'}}/>
    <div style={{position:'fixed',inset:0,zIndex:821,display:'flex',flexDirection:'column',
      background:'linear-gradient(180deg,#06090f 0%,#0d1117 60%,#0a0e1a 100%)'}}>

      {/* Top bar */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 18px',flexShrink:0,borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
        <div>
          <p style={{fontFamily:'Syne,sans-serif',fontWeight:900,fontSize:18,color:'#fff',margin:0}}>⚡ Skill Machine</p>
          <div style={{display:'flex',alignItems:'center',gap:8,marginTop:2}}>
            <span style={{fontSize:9,color:'rgba(255,255,255,0.3)',fontFamily:'Poppins,sans-serif',textTransform:'uppercase',letterSpacing:'0.08em'}}>
              {locked?`Locked · ${cdStr}`:`Attempt ${attemptNum+1}/${MAX_ATTEMPTS}`}
            </span>
            {!locked&&<span style={{fontSize:9,fontWeight:700,padding:'1px 7px',background:`${levelColor}18`,border:`1px solid ${levelColor}40`,borderRadius:20,color:levelColor,fontFamily:'Poppins,sans-serif'}}>{levelLabel}</span>}
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          {totalCoins>0&&<div style={{padding:'4px 11px',background:'rgba(245,158,11,0.12)',border:'1px solid rgba(245,158,11,0.25)',borderRadius:20}}><p style={{fontFamily:'Poppins,sans-serif',fontWeight:800,fontSize:13,color:'#F59E0B',margin:0}}>+{totalCoins} 💰</p></div>}
          <button onClick={onClose} style={{width:32,height:32,borderRadius:9,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.09)',color:'rgba(255,255,255,0.4)',fontSize:16,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
        </div>
      </div>

      {/* Attempt progress */}
      <div style={{display:'flex',gap:6,padding:'12px 18px 0',flexShrink:0}}>
        {Array.from({length:MAX_ATTEMPTS}).map((_,i)=>(
          <div key={i} style={{height:4,flex:1,borderRadius:2,transition:'all 0.3s',
            background:i<attemptNum?'#3B82F6':i===attemptNum&&phase!=='idle'?'rgba(59,130,246,0.4)':'rgba(255,255,255,0.08)'}}/>
        ))}
      </div>

      {/* Main content */}
      <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'16px 20px 20px',overflow:'hidden'}}>

        {loading?(
          <p style={{color:'rgba(255,255,255,0.3)',fontFamily:'Poppins,sans-serif',fontSize:13}}>Loading…</p>
        ):locked?(
          <div style={{textAlign:'center'}}>
            <p style={{fontSize:52,marginBottom:14}}>🔒</p>
            <p style={{fontFamily:'Syne,sans-serif',fontWeight:900,fontSize:20,color:'#fff',margin:'0 0 6px'}}>All attempts used</p>
            <p style={{fontSize:12,color:'rgba(255,255,255,0.35)',margin:'0 0 24px',fontFamily:'Poppins,sans-serif'}}>Resets automatically after 3 hours</p>
            <div style={{padding:'14px 28px',background:'rgba(255,255,255,0.03)',borderRadius:16,border:'1px solid rgba(255,255,255,0.07)',display:'inline-block',marginBottom:20}}>
              <p style={{fontFamily:'monospace',fontWeight:900,fontSize:28,color:'#60A5FA',margin:0}}>⏳ {cdStr}</p>
            </div>
            {bestScore>0&&<div style={{padding:'10px 20px',background:'rgba(245,158,11,0.08)',border:'1px solid rgba(245,158,11,0.2)',borderRadius:12,display:'inline-block'}}>
              <p style={{fontSize:12,color:'#F59E0B',fontFamily:'Poppins,sans-serif',margin:0,fontWeight:700}}>🏆 Best session: +{bestScore} coins</p>
            </div>}
          </div>
        ):phase==='idle'?(
          <div style={{width:'100%',maxWidth:340,textAlign:'center'}}>
            {/* Stats row */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:24}}>
              {[{l:'Best',v:`+${bestScore}💰`,c:'#F59E0B'},{l:'Streak',v:`${progressToMilestone}/${MILESTONE_AT}`,c:'#3B82F6'},{l:'Level',v:levelLabel,c:levelColor}].map((s,i)=>(
                <div key={i} style={{padding:'10px 4px',background:'rgba(255,255,255,0.03)',borderRadius:12,border:'1px solid rgba(255,255,255,0.07)'}}>
                  <p style={{fontFamily:'Poppins,sans-serif',fontWeight:800,fontSize:14,color:s.c,margin:'0 0 2px'}}>{s.v}</p>
                  <p style={{fontSize:8,color:'rgba(255,255,255,0.3)',margin:0,fontFamily:'Poppins,sans-serif',textTransform:'uppercase',letterSpacing:'0.08em'}}>{s.l}</p>
                </div>
              ))}
            </div>

            {/* Milestone */}
            {progressToMilestone>0&&(
              <div style={{marginBottom:20,padding:'10px 14px',background:'rgba(255,255,255,0.02)',borderRadius:12,border:'1px solid rgba(255,255,255,0.06)'}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                  <p style={{fontSize:10,color:'rgba(255,255,255,0.3)',fontFamily:'Poppins,sans-serif',margin:0,textTransform:'uppercase',letterSpacing:'0.06em'}}>ACR MAX Progress</p>
                  <p style={{fontSize:10,fontWeight:800,color:'#F59E0B',fontFamily:'Poppins,sans-serif',margin:0}}>{progressToMilestone}/{MILESTONE_AT}{progressToMilestone===MILESTONE_AT-1?' · 1 more!':''}</p>
                </div>
                <div style={{height:3,borderRadius:2,background:'rgba(255,255,255,0.07)',overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${(progressToMilestone/MILESTONE_AT)*100}%`,borderRadius:2,background:'linear-gradient(90deg,#3B82F6,#F59E0B)',transition:'width 0.6s ease'}}/>
                </div>
              </div>
            )}

            <p style={{fontFamily:'Syne,sans-serif',fontWeight:900,fontSize:20,color:'#fff',margin:'0 0 6px'}}>
              {attemptNum===0?t.dailyChallenge || '🔥 Daily Challenge':attemptNum===1?t.round2 || '⚡ Round 2':t.finalRound || '🏆 Final Round'}
            </p>
            <p style={{fontSize:12,color:'rgba(255,255,255,0.35)',margin:'0 0 4px',fontFamily:'Poppins,sans-serif'}}>
              Win <span style={{fontWeight:800,color:'#F59E0B'}}>{ATTEMPT_REWARDS[attemptNum]} coins</span> · {TIMER_SECONDS[attemptNum]}s timer
            </p>
            <p style={{fontSize:11,color:'rgba(255,255,255,0.2)',margin:'0 0 28px',fontFamily:'Poppins,sans-serif'}}>{attemptsLeft} attempt{attemptsLeft!==1?'s':''} remaining</p>

            <button onClick={startAttempt} style={{width:'100%',padding:'15px',borderRadius:16,border:'none',
              background:'linear-gradient(135deg,#3B82F6,#8B5CF6)',color:'#fff',
              fontFamily:'Poppins,sans-serif',fontWeight:900,fontSize:15,cursor:'pointer',
              boxShadow:'0 8px 32px rgba(99,102,241,0.4)',animation:'smGlow 2s ease-in-out infinite'}}>
              ⚡ Start Puzzle
            </button>
          </div>
        ):phase==='playing'&&puzzle?(
          <div style={{width:'100%',maxWidth:360,position:'relative'}}>
            <TimerBar seconds={TIMER_SECONDS[attemptNum]} onExpire={onTimeExpire} running={timerRunning}/>
            <div style={{padding:'24px 20px',background:'rgba(255,255,255,0.025)',borderRadius:20,border:'1px solid rgba(255,255,255,0.07)'}}>
              {(puzzle.type==='math'||puzzle.type==='series'||puzzle.type==='logic'||puzzle.type==='visual')&&<ChoicePuzzle puzzle={puzzle} onAnswer={handleAnswer} disabled={phase!=='playing'}/>}
              {puzzle.type==='odd'    && <OddPuzzle     puzzle={puzzle} onAnswer={handleAnswer} disabled={phase!=='playing'}/>}
              {puzzle.type==='order'  && <OrderPuzzle   puzzle={puzzle} onAnswer={handleAnswer} disabled={phase!=='playing'}/>}
              {puzzle.type==='pattern'&& <PatternPuzzle puzzle={puzzle} onAnswer={handleAnswer} disabled={phase!=='playing'}/>}
            </div>
          </div>
        ):phase==='feedback'&&feedback?(
          <div style={{width:'100%',maxWidth:360,position:'relative',minHeight:240}}>
            <div style={{padding:'24px 20px',background:'rgba(255,255,255,0.025)',borderRadius:20,border:'1px solid rgba(255,255,255,0.07)'}}>
              {(puzzle?.type==='math'||puzzle?.type==='series'||puzzle?.type==='logic'||puzzle?.type==='visual')&&<ChoicePuzzle puzzle={puzzle} onAnswer={()=>{}} disabled/>}
              {puzzle?.type==='odd'    &&<OddPuzzle     puzzle={puzzle} onAnswer={()=>{}} disabled/>}
              {puzzle?.type==='order'  &&<OrderPuzzle   puzzle={puzzle} onAnswer={()=>{}} disabled/>}
              {puzzle?.type==='pattern'&&<PatternPuzzle puzzle={puzzle} onAnswer={()=>{}} disabled/>}
            </div>
            <FeedbackFlash correct={feedback.correct} coins={feedback.coins} onDone={afterFeedback}/>
          </div>
        ):phase==='done'?(
          <div style={{textAlign:'center'}}>
            <p style={{fontSize:52,marginBottom:12}}>🎯</p>
            <p style={{fontFamily:'Syne,sans-serif',fontWeight:900,fontSize:22,color:'#fff',margin:'0 0 6px'}}>Session Complete!</p>
            <p style={{fontSize:13,color:'rgba(255,255,255,0.4)',margin:'0 0 22px',fontFamily:'Poppins,sans-serif'}}>{totalCoins>0?`You earned ${totalCoins} coins!`:'Better luck next session!'}</p>
            {totalCoins>0&&<div style={{padding:'14px 30px',background:'rgba(245,158,11,0.1)',border:'1px solid rgba(245,158,11,0.25)',borderRadius:14,marginBottom:20,display:'inline-block'}}><p style={{fontFamily:'Syne,sans-serif',fontWeight:900,fontSize:28,color:'#F59E0B',margin:0}}>+{totalCoins} 💰</p></div>}
            <br/>
            <button onClick={onClose} style={{padding:'12px 32px',borderRadius:14,border:'none',background:'rgba(255,255,255,0.07)',color:'rgba(255,255,255,0.6)',fontFamily:'Poppins,sans-serif',fontWeight:700,fontSize:14,cursor:'pointer'}}>Done</button>
          </div>
        ):null}
      </div>

      <p style={{fontSize:8,color:'rgba(255,255,255,0.1)',textAlign:'center',padding:'0 20px 16px',fontFamily:'Poppins,sans-serif',flexShrink:0}}>
        Skill-based game · Coins are virtual tokens with no monetary value
      </p>
    </div>
    </>
  )
}

/* ══ HOME CARD ══ */
export function SkillMachineCard({ userId, onClick }) {
  const [attemptsLeft,setAttemptsLeft]=useState(MAX_ATTEMPTS)
  const [locked,setLocked]=useState(false)
  const [cdStr,setCdStr]=useState('')
  const [bestScore,setBestScore]=useState(0)
  const timerRef=useRef(null)

  useEffect(()=>{
    if(!userId) return
    const load=async()=>{
      try{
        const snap=await getDoc(doc(db,'ipl_wallets',userId))
        const sm=snap.exists()?(snap.data().skillMachine||{}):{};
        const used=sm.attemptsUsed||0,last=sm.lastUsed?.toDate?.()||null
        setBestScore(sm.bestScore||0)
        if(last&&(Date.now()-last.getTime())>=COOLDOWN_MS){setAttemptsLeft(MAX_ATTEMPTS);setLocked(false)}
        else{setAttemptsLeft(Math.max(0,MAX_ATTEMPTS-used));setLocked(used>=MAX_ATTEMPTS);if(used>=MAX_ATTEMPTS&&last)startTimer(last)}
      }catch{setAttemptsLeft(MAX_ATTEMPTS)}
    }
    load()
    return()=>clearInterval(timerRef.current)
  },[userId])

  const startTimer=(last)=>{
    clearInterval(timerRef.current)
    const tick=()=>{
      const rem=Math.max(0,COOLDOWN_MS-(Date.now()-last.getTime()))
      if(rem===0){setLocked(false);setAttemptsLeft(MAX_ATTEMPTS);clearInterval(timerRef.current);return}
      const h=Math.floor(rem/3600000),m=Math.floor((rem%3600000)/60000)
      setCdStr(`${h}h ${String(m).padStart(2,'0')}m`)
    }
    tick();timerRef.current=setInterval(tick,30000)
  }

  return (
    <button onClick={onClick} style={{width:'100%',border:'none',padding:0,background:'none',cursor:'pointer',textAlign:'left'}}>
      <div style={{padding:'10px 12px',height:'100%',
        background:'linear-gradient(135deg,rgba(6,9,15,0.97),rgba(13,17,23,0.99))',
        borderRadius:14,border:'1px solid rgba(99,102,241,0.28)',
        boxShadow:'0 3px 16px rgba(99,102,241,0.15),inset 0 1px 0 rgba(255,255,255,0.05)',
        position:'relative',overflow:'hidden',transition:'transform 0.2s'}}
        onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'}
        onMouseLeave={e=>e.currentTarget.style.transform='translateY(0)'}>
        <div style={{display:'flex',alignItems:'center',gap:9}}>
          <div style={{width:36,height:36,borderRadius:10,background:'linear-gradient(135deg,#3B82F6,#8B5CF6)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0,boxShadow:'0 3px 10px rgba(99,102,241,0.4)'}}>⚡</div>
          <div style={{flex:1,minWidth:0}}>
            <p style={{fontFamily:'Poppins,sans-serif',fontWeight:800,fontSize:12,color:'#fff',margin:'0 0 1px',whiteSpace:'nowrap'}}>Skill Machine</p>
            <p style={{fontSize:9,color:'rgba(255,255,255,0.35)',margin:0,fontFamily:'Poppins,sans-serif',whiteSpace:'nowrap'}}>
              {locked?`🔒 ${cdStr}`:bestScore>0?`Best: +${bestScore}💰`:'Solve & earn coins'}
            </p>
          </div>
          <div style={{display:'flex',gap:3,flexShrink:0}}>
            {Array.from({length:MAX_ATTEMPTS}).map((_,i)=>(
              <div key={i} style={{width:7,height:7,borderRadius:2,transition:'all 0.3s',
                background:i<attemptsLeft?'#3B82F6':'rgba(255,255,255,0.08)',
                boxShadow:i<attemptsLeft?'0 0 4px rgba(59,130,246,0.6)':'none'}}/>
            ))}
          </div>
        </div>
      </div>
    </button>
  )
}