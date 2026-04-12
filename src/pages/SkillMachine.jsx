import { useState, useEffect, useRef, useCallback } from 'react'
import { db } from '../firebase'
import { doc, getDoc, setDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore'

/* ══════════════════════════════════════════════════════
   ACR MAX — Skill Machine
   Puzzle-driven rewards · Pure skill · No randomness
   Coins are virtual tokens with no monetary value
══════════════════════════════════════════════════════ */

const MAX_ATTEMPTS   = 3
const COOLDOWN_MS    = 3 * 60 * 60 * 1000  // 3 hours
const MILESTONE_AT   = 4                    // successes before ACR MAX unlock
const ATTEMPT_REWARDS = [10, 30, 50]         // coins per attempt level

/* ── Safe Firestore write ── */
const clean = obj => Object.fromEntries(Object.entries(obj).filter(([,v])=>v!==undefined&&v!==null))

/* ══ PUZZLE ENGINE ══ */

/* 1. Quick Math */
function genMath(level) {
  const ops = level === 0 ? ['+'] : level === 1 ? ['+','-'] : ['+','-','×']
  const op  = ops[Math.floor(Math.random()*ops.length)]
  let a, b, answer
  if (op==='+')      { a=Math.floor(Math.random()*(level<2?10:20))+1; b=Math.floor(Math.random()*(level<2?10:20))+1; answer=a+b }
  else if (op==='-') { a=Math.floor(Math.random()*20)+10; b=Math.floor(Math.random()*10)+1; answer=a-b }
  else               { a=Math.floor(Math.random()*5)+2;   b=Math.floor(Math.random()*5)+2; answer=a*b }
  const wrongs = new Set()
  while (wrongs.size < 3) { const w=answer+Math.floor(Math.random()*10)-5; if(w!==answer&&w>0) wrongs.add(w) }
  const opts = [...wrongs,answer].sort(()=>Math.random()-0.5)
  return { type:'math', q:`${a} ${op} ${b} = ?`, answer, opts }
}

/* 2. Odd One Out */
const ODD_SETS = [
  { items:['🔴','🔴','🔴','🔵'], odd:3, hint:'Odd color out' },
  { items:['⬛','⬛','⬜','⬛'], odd:2, hint:'Odd one out' },
  { items:['🐕','🐈','🐕','🐕'], odd:1, hint:'Odd animal out' },
  { items:['🍎','🍊','🍋','🍔'], odd:3, hint:'Not a fruit' },
  { items:['⚽','🏀','🏏','🎸'], odd:3, hint:'Not a sport' },
  { items:['2','4','7','8'],    odd:2, hint:'Odd number out' },
  { items:['A','B','C','3'],    odd:3, hint:'Not a letter' },
]
function genOdd(level) {
  const set = ODD_SETS[Math.floor(Math.random()*ODD_SETS.length)]
  return { type:'odd', items: set.items, answer: set.odd, hint: set.hint }
}

/* 3. Tap Order */
function genOrder(level) {
  const count = level === 0 ? 3 : level === 1 ? 4 : 5
  const nums  = Array.from({length:count},(_,i)=>i+1).sort(()=>Math.random()-0.5)
  return { type:'order', nums, answer:[...nums].sort((a,b)=>a-b), count }
}

/* 4. Pattern Memory */
function genPattern(level) {
  const size  = level === 0 ? 4 : level === 1 ? 6 : 9
  const count = level === 0 ? 2 : level === 1 ? 3 : 4
  const cells = Array.from({length:size},(_,i)=>i)
  const highlighted = cells.sort(()=>Math.random()-0.5).slice(0,count)
  return { type:'pattern', size, highlighted, count }
}

const PUZZLE_TYPES = ['math','odd','order','pattern']
let lastPuzzleType = ''

function genPuzzle(level) {
  let types = PUZZLE_TYPES.filter(t=>t!==lastPuzzleType)
  const type = types[Math.floor(Math.random()*types.length)]
  lastPuzzleType = type
  if (type==='math')    return genMath(level)
  if (type==='odd')     return genOdd(level)
  if (type==='order')   return genOrder(level)
  return genPattern(level)
}

/* ══ PUZZLE COMPONENTS ══ */

function MathPuzzle({ puzzle, onAnswer }) {
  return (
    <div style={{textAlign:'center'}}>
      <p style={{fontFamily:'Syne,sans-serif',fontWeight:900,fontSize:40,color:'#fff',margin:'0 0 28px',letterSpacing:'-0.02em'}}>{puzzle.q}</p>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        {puzzle.opts.map((opt,i)=>(
          <button key={i} onClick={()=>onAnswer(opt===puzzle.answer)}
            style={{padding:'16px',borderRadius:14,border:'1px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.06)',
              fontFamily:'Poppins,sans-serif',fontWeight:800,fontSize:20,color:'#fff',cursor:'pointer',
              transition:'all 0.15s',backdropFilter:'blur(8px)'}}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

function OddPuzzle({ puzzle, onAnswer }) {
  return (
    <div style={{textAlign:'center'}}>
      <p style={{fontSize:13,color:'rgba(255,255,255,0.5)',fontFamily:'Poppins,sans-serif',margin:'0 0 18px',letterSpacing:'0.06em',textTransform:'uppercase'}}>{puzzle.hint}</p>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,maxWidth:240,margin:'0 auto'}}>
        {puzzle.items.map((item,i)=>(
          <button key={i} onClick={()=>onAnswer(i===puzzle.answer)}
            style={{padding:'18px',borderRadius:14,border:'1px solid rgba(255,255,255,0.1)',background:'rgba(255,255,255,0.06)',
              fontSize:30,cursor:'pointer',transition:'all 0.15s'}}>
            {item}
          </button>
        ))}
      </div>
    </div>
  )
}

function OrderPuzzle({ puzzle, onAnswer }) {
  const [tapped, setTapped] = useState([])
  const handleTap = (n) => {
    if (tapped.includes(n)) return
    const next = [...tapped, n]
    setTapped(next)
    if (next.length === puzzle.count) {
      const correct = next.every((v,i)=>v===puzzle.answer[i])
      setTimeout(()=>onAnswer(correct), 300)
    }
  }
  return (
    <div style={{textAlign:'center'}}>
      <p style={{fontSize:13,color:'rgba(255,255,255,0.5)',fontFamily:'Poppins,sans-serif',margin:'0 0 8px',textTransform:'uppercase',letterSpacing:'0.06em'}}>Tap in order: 1 → {puzzle.count}</p>
      <div style={{display:'flex',gap:5,justifyContent:'center',marginBottom:20,minHeight:28}}>
        {tapped.map((n,i)=><span key={i} style={{width:24,height:24,borderRadius:8,background:'#3B82F6',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:800,color:'#fff',fontFamily:'Poppins,sans-serif'}}>{n}</span>)}
      </div>
      <div style={{display:'flex',gap:10,flexWrap:'wrap',justifyContent:'center'}}>
        {puzzle.nums.map((n,i)=>{
          const done = tapped.includes(n)
          return (
            <button key={i} onClick={()=>handleTap(n)} disabled={done}
              style={{width:56,height:56,borderRadius:14,border:done?'1px solid rgba(59,130,246,0.4)':'1px solid rgba(255,255,255,0.15)',
                background:done?'rgba(59,130,246,0.2)':'rgba(255,255,255,0.07)',
                fontFamily:'Poppins,sans-serif',fontWeight:900,fontSize:22,color:done?'rgba(59,130,246,0.5)':'#fff',
                cursor:done?'not-allowed':'pointer',transition:'all 0.15s'}}>
              {n}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function PatternPuzzle({ puzzle, onAnswer }) {
  const [phase, setPhase] = useState('show') // show → input
  const [shown, setShown]   = useState(true)
  const [tapped, setTapped] = useState([])
  const cols = puzzle.size <= 4 ? 2 : puzzle.size <= 6 ? 3 : 3

  useEffect(()=>{
    const t = setTimeout(()=>{ setShown(false); setPhase('input') }, 1800)
    return ()=>clearTimeout(t)
  },[])

  const handleTap = (i) => {
    if (phase!=='input'||tapped.includes(i)) return
    const next=[...tapped,i]
    setTapped(next)
    if(next.length===puzzle.count){
      const correct=puzzle.highlighted.every(h=>next.includes(h))&&next.every(n=>puzzle.highlighted.includes(n))
      setTimeout(()=>onAnswer(correct),300)
    }
  }

  return (
    <div style={{textAlign:'center'}}>
      <p style={{fontSize:13,color:'rgba(255,255,255,0.5)',fontFamily:'Poppins,sans-serif',margin:'0 0 14px',textTransform:'uppercase',letterSpacing:'0.06em'}}>
        {phase==='show'?`Remember ${puzzle.count} cells…`:`Tap the ${puzzle.count} highlighted cells`}
      </p>
      <div style={{display:'grid',gridTemplateColumns:`repeat(${cols},1fr)`,gap:8,maxWidth:200,margin:'0 auto'}}>
        {Array.from({length:puzzle.size}).map((_,i)=>{
          const isHL = puzzle.highlighted.includes(i)
          const isTapped = tapped.includes(i)
          return (
            <button key={i} onClick={()=>handleTap(i)}
              style={{aspectRatio:'1',borderRadius:12,border:'1px solid rgba(255,255,255,0.1)',cursor:phase==='input'?'pointer':'not-allowed',transition:'all 0.2s',
                background: phase==='show'&&isHL ? 'linear-gradient(135deg,#3B82F6,#8B5CF6)' :
                             isTapped ? 'rgba(59,130,246,0.5)' : 'rgba(255,255,255,0.06)',
                boxShadow: phase==='show'&&isHL ? '0 0 16px rgba(59,130,246,0.6)' : 'none' }}/>
          )
        })}
      </div>
    </div>
  )
}

/* ══ FEEDBACK OVERLAY ══ */
function FeedbackFlash({ correct, coins, onDone }) {
  useEffect(()=>{ const t=setTimeout(onDone, correct?1200:900); return()=>clearTimeout(t) },[])
  return (
    <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
      background: correct?'rgba(5,122,85,0.15)':'rgba(224,36,36,0.1)',
      borderRadius:20,animation:'feedFlash 0.3s ease',zIndex:10}}>
      <div style={{fontSize:52,marginBottom:8,animation:'feedPop 0.4s cubic-bezier(.34,1.56,.64,1)'}}>
        {correct?'✅':'❌'}
      </div>
      {correct && <p style={{fontFamily:'Poppins,sans-serif',fontWeight:900,fontSize:24,color:'#34D399',margin:0,animation:'coinsUp 0.8s ease-out'}}>+{coins} 💰</p>}
      {!correct && <p style={{fontFamily:'Poppins,sans-serif',fontWeight:700,fontSize:14,color:'rgba(255,255,255,0.4)',margin:0}}>Try next one!</p>}
    </div>
  )
}

/* ══ MILESTONE CELEBRATION ══ */
function MilestoneCelebration({ onDone }) {
  useEffect(()=>{ const t=setTimeout(onDone,3200); return()=>clearTimeout(t) },[])
  return (
    <div style={{position:'fixed',inset:0,zIndex:1000,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
      background:'rgba(15,23,42,0.95)',backdropFilter:'blur(16px)',animation:'celebIn 0.5s ease'}}>
      <div style={{textAlign:'center'}}>
        <div style={{fontSize:60,marginBottom:16,animation:'celebPop 0.6s cubic-bezier(.34,1.56,.64,1)'}}>🏆</div>
        <p style={{fontFamily:'Syne,sans-serif',fontWeight:900,fontSize:28,color:'#fff',margin:'0 0 8px',letterSpacing:'-0.02em'}}>ACR MAX Unlocked!</p>
        <p style={{fontSize:14,color:'rgba(255,255,255,0.5)',margin:'0 0 24px',fontFamily:'Poppins,sans-serif'}}>Milestone achieved</p>
        <div style={{padding:'14px 32px',background:'linear-gradient(135deg,#F59E0B,#D97706)',borderRadius:40,
          boxShadow:'0 0 48px rgba(245,158,11,0.5)',display:'inline-block'}}>
          <p style={{fontFamily:'Syne,sans-serif',fontWeight:900,fontSize:32,color:'#fff',margin:0}}>+200 💰</p>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════
   MAIN SKILL MACHINE MODAL
══════════════════════════════════════════ */
export function SkillMachineModal({ userId, isOpen, onClose, onReward }) {
  const [phase, setPhase]           = useState('idle')   // idle|playing|feedback|done|locked
  const [attemptNum, setAttemptNum] = useState(0)        // 0,1,2
  const [puzzle, setPuzzle]         = useState(null)
  const [feedback, setFeedback]     = useState(null)     // {correct,coins}
  const [totalCoins, setTotalCoins] = useState(0)
  const [successCount, setSuccessCount] = useState(0)    // towards milestone
  const [cdStr, setCdStr]           = useState('')
  const [locked, setLocked]         = useState(false)
  const [lastUsed, setLastUsed]     = useState(null)
  const [loading, setLoading]       = useState(true)
  const [showMilestone, setShowMilestone] = useState(false)
  const timerRef = useRef(null)

  /* ── Load state ── */
  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const snap = await getDoc(doc(db,'ipl_wallets',userId))
      const d    = snap.exists() ? snap.data() : {}
      const sm   = d.skillMachine || {}
      const used = sm.attemptsUsed || 0
      const last = sm.lastUsed?.toDate?.() || null
      const successes = sm.successCount || 0
      setSuccessCount(successes)

      if (last && (Date.now()-last.getTime()) >= COOLDOWN_MS) {
        // Reset after cooldown
        setAttemptNum(0); setLocked(false); setLastUsed(null)
      } else {
        setAttemptNum(used)
        setLastUsed(last)
        setLocked(used >= MAX_ATTEMPTS)
        if (used >= MAX_ATTEMPTS && last) startTimer(last)
      }
    } catch(e) { console.error('SM load:',e) }
    setLoading(false)
  },[userId])

  useEffect(()=>{ if(isOpen&&userId) { setPhase('idle'); setTotalCoins(0); load() } },[isOpen,userId])

  const startTimer = (last) => {
    clearInterval(timerRef.current)
    const tick = () => {
      const rem = Math.max(0, COOLDOWN_MS-(Date.now()-last.getTime()))
      if (rem===0){setLocked(false);setAttemptNum(0);clearInterval(timerRef.current);load();return}
      const h=Math.floor(rem/3600000),m=Math.floor((rem%3600000)/60000),s=Math.floor((rem%60000)/1000)
      setCdStr(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`)
    }
    tick(); timerRef.current=setInterval(tick,1000)
    return ()=>clearInterval(timerRef.current)
  }

  useEffect(()=>()=>clearInterval(timerRef.current),[])

  /* ── Start attempt ── */
  const startAttempt = () => {
    if (locked||attemptNum>=MAX_ATTEMPTS) return
    setPuzzle(genPuzzle(attemptNum))
    setFeedback(null)
    setPhase('playing')
  }

  /* ── Handle answer ── */
  const handleAnswer = async (correct) => {
    setPhase('feedback')
    const coins   = correct ? ATTEMPT_REWARDS[attemptNum] : 0
    const newAttempt = attemptNum + 1
    const now    = new Date()
    setFeedback({correct, coins})

    // Update Firestore
    try {
      const ref = doc(db,'ipl_wallets',userId)
      const snap = await getDoc(ref)
      const d    = snap.exists() ? snap.data() : {}
      const sm   = d.skillMachine || {}
      const newSuccessCount = correct ? (sm.successCount||0)+1 : (sm.successCount||0)
      const milestone = newSuccessCount > 0 && newSuccessCount % MILESTONE_AT === 0

      const updates = clean({
        'skillMachine.attemptsUsed': newAttempt,
        'skillMachine.successCount': newSuccessCount,
        'skillMachine.lastUsed':     serverTimestamp(),
      })
      if (correct) updates.coins = (d.coins||500) + coins + (milestone ? 200 : 0)
      await setDoc(ref, updates, {merge:true})

      setAttemptNum(newAttempt)
      setSuccessCount(newSuccessCount)
      if (correct) {
        setTotalCoins(t=>t+coins)
        onReward?.({coins})
        if (milestone) { setTimeout(()=>setShowMilestone(true), 1400) }
      }

      if (newAttempt >= MAX_ATTEMPTS) {
        setLocked(true); setLastUsed(now); startTimer(now)
      }
    } catch(e) { console.error('SM save:',e) }
  }

  const afterFeedback = () => {
    const next = attemptNum
    if (next >= MAX_ATTEMPTS) { setPhase('done') }
    else { setPhase('idle') }
  }

  if (!isOpen) return null

  const attemptsLeft = Math.max(0, MAX_ATTEMPTS - attemptNum)
  const progressToMilestone = successCount % MILESTONE_AT

  return (
    <>
    <style>{`
      @keyframes feedFlash { 0%{opacity:0} 100%{opacity:1} }
      @keyframes feedPop   { 0%{transform:scale(0.5)} 70%{transform:scale(1.15)} 100%{transform:scale(1)} }
      @keyframes coinsUp   { 0%{opacity:0;transform:translateY(10px)} 100%{opacity:1;transform:translateY(0)} }
      @keyframes celebIn   { 0%{opacity:0} 100%{opacity:1} }
      @keyframes celebPop  { 0%{transform:scale(0.3)} 70%{transform:scale(1.1)} 100%{transform:scale(1)} }
      @keyframes smglow    { 0%,100%{box-shadow:0 0 20px rgba(99,102,241,0.3)} 50%{box-shadow:0 0 40px rgba(99,102,241,0.7)} }
      @keyframes shake     { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-6px)} 75%{transform:translateX(6px)} }
      .sm-opt:hover { background:rgba(255,255,255,0.12)!important; transform:scale(1.03); }
      .sm-opt:active { transform:scale(0.97); }
    `}</style>

    {showMilestone && <MilestoneCelebration onDone={()=>{ setShowMilestone(false); onReward?.({coins:200,milestone:true}) }} />}

    {/* Backdrop */}
    <div onClick={onClose} style={{position:'fixed',inset:0,zIndex:820,background:'rgba(0,0,0,0.8)',backdropFilter:'blur(12px)'}}/>

    {/* Full screen modal */}
    <div style={{position:'fixed',inset:0,zIndex:821,display:'flex',flexDirection:'column',
      background:'linear-gradient(180deg,#06090f 0%,#0d1117 50%,#0a0e1a 100%)',overflow:'hidden'}}>

      {/* Top bar */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 18px',flexShrink:0}}>
        <div>
          <p style={{fontFamily:'Syne,sans-serif',fontWeight:900,fontSize:18,color:'#fff',margin:0,letterSpacing:'-0.01em'}}>⚡ Skill Machine</p>
          <p style={{fontSize:10,color:'rgba(255,255,255,0.35)',margin:0,fontFamily:'Poppins,sans-serif',textTransform:'uppercase',letterSpacing:'0.08em'}}>
            {locked ? `Locked · Resets in ${cdStr}` : `Attempt ${attemptNum+1} of ${MAX_ATTEMPTS}`}
          </p>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          {totalCoins > 0 && (
            <div style={{padding:'5px 12px',background:'rgba(245,158,11,0.15)',border:'1px solid rgba(245,158,11,0.3)',borderRadius:20}}>
              <p style={{fontFamily:'Poppins,sans-serif',fontWeight:800,fontSize:13,color:'#F59E0B',margin:0}}>+{totalCoins} 💰</p>
            </div>
          )}
          <button onClick={onClose} style={{width:34,height:34,borderRadius:10,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',color:'rgba(255,255,255,0.5)',fontSize:17,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
        </div>
      </div>

      {/* Attempt dots */}
      <div style={{display:'flex',gap:7,justifyContent:'center',padding:'0 0 20px',flexShrink:0}}>
        {Array.from({length:MAX_ATTEMPTS}).map((_,i)=>(
          <div key={i} style={{height:4,flex:1,maxWidth:60,borderRadius:2,transition:'all 0.3s',
            background: i < attemptNum ? '#3B82F6' : i === attemptNum && phase!=='idle' ? 'rgba(59,130,246,0.5)' : 'rgba(255,255,255,0.1)'}}/>
        ))}
      </div>

      {/* Main area */}
      <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'0 20px 20px',position:'relative'}}>

        {/* Glow ring */}
        <div style={{position:'absolute',width:280,height:280,borderRadius:'50%',
          border:'1px solid rgba(99,102,241,0.15)',
          boxShadow:'0 0 60px rgba(99,102,241,0.08)',
          pointerEvents:'none'}}/>

        {loading ? (
          <p style={{color:'rgba(255,255,255,0.4)',fontFamily:'Poppins,sans-serif'}}>Loading…</p>
        ) : locked ? (
          <div style={{textAlign:'center'}}>
            <p style={{fontSize:48,marginBottom:16}}>🔒</p>
            <p style={{fontFamily:'Syne,sans-serif',fontWeight:900,fontSize:20,color:'#fff',margin:'0 0 8px'}}>Skill Machine Locked</p>
            <p style={{fontSize:13,color:'rgba(255,255,255,0.4)',margin:'0 0 24px',fontFamily:'Poppins,sans-serif'}}>Come back after the cooldown</p>
            <div style={{padding:'16px 32px',background:'rgba(255,255,255,0.04)',borderRadius:16,border:'1px solid rgba(255,255,255,0.08)',display:'inline-block'}}>
              <p style={{fontFamily:'monospace',fontWeight:900,fontSize:28,color:'#60A5FA',margin:0,letterSpacing:'0.04em'}}>⏳ {cdStr}</p>
            </div>
            <p style={{fontSize:10,color:'rgba(255,255,255,0.2)',margin:'12px 0 0',fontFamily:'Poppins,sans-serif'}}>Resets in 3 hours</p>
          </div>
        ) : phase === 'idle' ? (
          <div style={{textAlign:'center',width:'100%',maxWidth:320}}>
            {/* Milestone progress */}
            <div style={{marginBottom:28,padding:'12px 16px',background:'rgba(255,255,255,0.03)',borderRadius:14,border:'1px solid rgba(255,255,255,0.07)'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                <p style={{fontSize:10,color:'rgba(255,255,255,0.35)',fontFamily:'Poppins,sans-serif',textTransform:'uppercase',letterSpacing:'0.08em',margin:0}}>ACR MAX Progress</p>
                <p style={{fontSize:10,fontWeight:700,color:'#F59E0B',fontFamily:'Poppins,sans-serif',margin:0}}>
                  {progressToMilestone}/{MILESTONE_AT}
                  {progressToMilestone===MILESTONE_AT-1?' · 1 more to unlock!':''}
                </p>
              </div>
              <div style={{height:4,borderRadius:2,background:'rgba(255,255,255,0.08)',overflow:'hidden'}}>
                <div style={{height:'100%',width:`${(progressToMilestone/MILESTONE_AT)*100}%`,borderRadius:2,
                  background:'linear-gradient(90deg,#3B82F6,#8B5CF6)',transition:'width 0.6s ease'}}/>
              </div>
              {progressToMilestone===MILESTONE_AT-1 && (
                <p style={{fontSize:10,color:'#F59E0B',margin:'6px 0 0',fontFamily:'Poppins,sans-serif',fontWeight:700}}>🔥 One correct answer unlocks +200 coins!</p>
              )}
            </div>

            <p style={{fontFamily:'Syne,sans-serif',fontWeight:900,fontSize:22,color:'#fff',margin:'0 0 8px'}}>
              {attemptNum===0?'Solve to unlock your reward':attemptNum===1?'Round 2 · Harder!':'Final Round · Max reward!'}
            </p>
            <p style={{fontSize:13,color:'rgba(255,255,255,0.4)',margin:'0 0 6px',fontFamily:'Poppins,sans-serif'}}>
              Win up to <span style={{fontWeight:800,color:'#F59E0B'}}>{ATTEMPT_REWARDS[attemptNum]} coins</span> this round
            </p>
            <p style={{fontSize:11,color:'rgba(255,255,255,0.25)',margin:'0 0 32px',fontFamily:'Poppins,sans-serif'}}>{attemptsLeft} attempt{attemptsLeft!==1?'s':''} remaining</p>

            <button onClick={startAttempt}
              style={{width:'100%',padding:'16px',borderRadius:16,border:'none',
                background:'linear-gradient(135deg,#3B82F6,#8B5CF6)',color:'#fff',
                fontFamily:'Poppins,sans-serif',fontWeight:900,fontSize:16,cursor:'pointer',
                boxShadow:'0 8px 32px rgba(99,102,241,0.4)',animation:'smglow 2s ease-in-out infinite'}}>
              ⚡ Start Puzzle
            </button>
          </div>
        ) : phase === 'playing' && puzzle ? (
          <div style={{width:'100%',maxWidth:340,position:'relative'}}>
            <div style={{padding:'28px 20px',background:'rgba(255,255,255,0.03)',borderRadius:20,border:'1px solid rgba(255,255,255,0.08)'}}>
              {puzzle.type==='math'    && <MathPuzzle    puzzle={puzzle} onAnswer={handleAnswer}/>}
              {puzzle.type==='odd'     && <OddPuzzle     puzzle={puzzle} onAnswer={handleAnswer}/>}
              {puzzle.type==='order'   && <OrderPuzzle   puzzle={puzzle} onAnswer={handleAnswer}/>}
              {puzzle.type==='pattern' && <PatternPuzzle puzzle={puzzle} onAnswer={handleAnswer}/>}
            </div>
          </div>
        ) : phase === 'feedback' && feedback ? (
          <div style={{width:'100%',maxWidth:340,position:'relative',minHeight:280}}>
            <div style={{padding:'28px 20px',background:'rgba(255,255,255,0.03)',borderRadius:20,border:'1px solid rgba(255,255,255,0.08)'}}>
              {puzzle?.type==='math'    && <MathPuzzle    puzzle={puzzle} onAnswer={()=>{}}/>}
              {puzzle?.type==='odd'     && <OddPuzzle     puzzle={puzzle} onAnswer={()=>{}}/>}
              {puzzle?.type==='order'   && <OrderPuzzle   puzzle={puzzle} onAnswer={()=>{}}/>}
              {puzzle?.type==='pattern' && <PatternPuzzle puzzle={puzzle} onAnswer={()=>{}}/>}
            </div>
            <FeedbackFlash correct={feedback.correct} coins={feedback.coins} onDone={afterFeedback}/>
          </div>
        ) : phase === 'done' ? (
          <div style={{textAlign:'center'}}>
            <p style={{fontSize:48,marginBottom:12}}>🎯</p>
            <p style={{fontFamily:'Syne,sans-serif',fontWeight:900,fontSize:22,color:'#fff',margin:'0 0 8px'}}>Session Complete!</p>
            <p style={{fontSize:13,color:'rgba(255,255,255,0.5)',margin:'0 0 24px',fontFamily:'Poppins,sans-serif'}}>
              {totalCoins > 0 ? `You earned ${totalCoins} coins!` : 'Better luck next session!'}
            </p>
            {totalCoins > 0 && (
              <div style={{padding:'14px 28px',background:'linear-gradient(135deg,rgba(245,158,11,0.15),rgba(245,158,11,0.08))',border:'1px solid rgba(245,158,11,0.3)',borderRadius:14,marginBottom:24,display:'inline-block'}}>
                <p style={{fontFamily:'Syne,sans-serif',fontWeight:900,fontSize:28,color:'#F59E0B',margin:0}}>+{totalCoins} 💰</p>
              </div>
            )}
            <button onClick={onClose} style={{padding:'13px 36px',borderRadius:14,border:'none',background:'rgba(255,255,255,0.08)',color:'rgba(255,255,255,0.7)',fontFamily:'Poppins,sans-serif',fontWeight:700,fontSize:14,cursor:'pointer'}}>Done</button>
          </div>
        ) : null}
      </div>

      {/* Legal footer */}
      <p style={{fontSize:8,color:'rgba(255,255,255,0.12)',textAlign:'center',padding:'0 20px 20px',fontFamily:'Poppins,sans-serif',flexShrink:0}}>
        Skill-based game · Coins are virtual tokens with no monetary value
      </p>
    </div>
    </>
  )
}

/* ══ SKILL MACHINE CARD (Home widget) ══ */
export function SkillMachineCard({ userId, onClick }) {
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_ATTEMPTS)
  const [locked, setLocked]   = useState(false)
  const [cdStr, setCdStr]     = useState('')
  const timerRef = useRef(null)

  useEffect(()=>{
    if (!userId) return
    const load = async () => {
      try {
        const snap = await getDoc(doc(db,'ipl_wallets',userId))
        const sm   = snap.exists() ? (snap.data().skillMachine||{}) : {}
        const used = sm.attemptsUsed || 0
        const last = sm.lastUsed?.toDate?.() || null
        if (last && (Date.now()-last.getTime()) >= COOLDOWN_MS) {
          setAttemptsLeft(MAX_ATTEMPTS); setLocked(false)
        } else {
          setAttemptsLeft(Math.max(0,MAX_ATTEMPTS-used)); setLocked(used>=MAX_ATTEMPTS)
          if (used>=MAX_ATTEMPTS && last) startTimer(last)
        }
      } catch { setAttemptsLeft(MAX_ATTEMPTS) }
    }
    load()
    return ()=>clearInterval(timerRef.current)
  },[userId])

  const startTimer = (last) => {
    clearInterval(timerRef.current)
    const tick = () => {
      const rem=Math.max(0,COOLDOWN_MS-(Date.now()-last.getTime()))
      if(rem===0){setLocked(false);setAttemptsLeft(MAX_ATTEMPTS);clearInterval(timerRef.current);return}
      const h=Math.floor(rem/3600000),m=Math.floor((rem%3600000)/60000)
      setCdStr(`${h}h ${String(m).padStart(2,'0')}m`)
    }
    tick(); timerRef.current=setInterval(tick,30000)
  }

  return (
    <button onClick={onClick} style={{width:'100%',border:'none',padding:0,background:'none',cursor:'pointer',textAlign:'left'}}>
      <div style={{padding:'10px 12px',height:'100%',
        background:'linear-gradient(135deg,rgba(6,9,15,0.97),rgba(13,17,23,0.99))',
        borderRadius:14,
        border:'1px solid rgba(99,102,241,0.28)',
        boxShadow:'0 3px 16px rgba(99,102,241,0.15),inset 0 1px 0 rgba(255,255,255,0.05)',
        position:'relative',overflow:'hidden',transition:'transform 0.2s'}}
        onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'}
        onMouseLeave={e=>e.currentTarget.style.transform='translateY(0)'}>

        <div style={{display:'flex',alignItems:'center',gap:9}}>
          <div style={{width:36,height:36,borderRadius:10,
            background:'linear-gradient(135deg,#3B82F6,#8B5CF6)',
            display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0,
            boxShadow:'0 3px 10px rgba(99,102,241,0.4)'}}>⚡</div>
          <div style={{flex:1,minWidth:0}}>
            <p style={{fontFamily:'Poppins,sans-serif',fontWeight:800,fontSize:12,color:'#fff',margin:'0 0 1px',whiteSpace:'nowrap'}}>Skill Machine</p>
            <p style={{fontSize:9,color:'rgba(255,255,255,0.4)',margin:0,fontFamily:'Poppins,sans-serif',whiteSpace:'nowrap'}}>
              {locked?`🔒 ${cdStr}`:'Solve & earn coins'}
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