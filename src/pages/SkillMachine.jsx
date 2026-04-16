import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { db } from '../firebase'
import { doc, getDoc, increment, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'

/* ═══════════════════════════════════════════════════════════════════
   ACR MAX — SKILL MACHINE v3  (PREMIUM GAME ENGINE)
   10 dynamic engines · Adaptive difficulty · Infinite non-repeat
   Firebase: 1 write/session only · Fully offline gameplay
   Coins are virtual tokens with no monetary value
═══════════════════════════════════════════════════════════════════ */

/* ─── CONSTANTS ─── */
const BASE_REWARD    = 10
const SPEED_BONUS    = 5
const STREAK_MULTI   = { 3:1.5, 5:2, 10:3 }
const JACKPOT_AT     = 10
const DAILY_BONUS    = [20, 30, 50]
const WEEKLY_BONUS   = 100
const SESSION_LENGTH = 5   // puzzles per session
const R = () => Math.random()
const RI = (min,max) => Math.floor(R()*(max-min+1))+min
const PICK = arr => arr[RI(0,arr.length-1)]
const SHUFFLE = a => { const b=[...a]; for(let i=b.length-1;i>0;i--){const j=RI(0,i);[b[i],b[j]]=[b[j],b[i]]} return b }

/* ══════════════════════════════════════════════════════════════════
   10 PUZZLE ENGINES — all dynamic, all offline
══════════════════════════════════════════════════════════════════ */

/* 1. QuickMath */
const QuickMathEngine = {
  type:'math', label:'Quick Math', icon:'🔢', color:'#6366f1',
  generate(d) {
    const ops = d<2?['+','-']:d<4?['+','-','×']:['×','÷','+','-']
    const op = PICK(ops), r = d<2?12:d<4?25:50
    let a,b,ans
    if(op==='+'){a=RI(1,r);b=RI(1,r);ans=a+b}
    else if(op==='-'){a=RI(r/2,r);b=RI(1,a-1);ans=a-b}
    else if(op==='×'){a=RI(2,d<4?9:15);b=RI(2,d<4?9:12);ans=a*b}
    else{b=RI(2,9);ans=RI(2,12);a=b*ans}
    const wrong=new Set()
    while(wrong.size<3){const w=ans+RI(-Math.max(5,r/4),Math.max(5,r/4));if(w>0&&w!==ans)wrong.add(w)}
    return { question:`${a} ${op} ${b} = ?`, options:SHUFFLE([...[...wrong],ans]), answer:ans, display:'choice' }
  }
}

/* 2. NumberLogic (series) */
const NumberLogicEngine = {
  type:'series', label:'Number Logic', icon:'🔁', color:'#8b5cf6',
  generate(d) {
    const generators = [
      ()=>{const s=RI(1,10),step=RI(2,8+d*3);const seq=[s,s+step,s+step*2,s+step*3];return{seq,ans:s+step*4}},
      ()=>{const s=RI(1,5),m=RI(2,3+d);const seq=[s,s*m,s*m**2,s*m**3];return{seq,ans:s*m**4}},
      ()=>{let a=RI(1,3),b=RI(2,5),seq=[a,b];for(let i=0;i<3;i++){const n=a+b;seq.push(n);a=b;b=n}return{seq:seq.slice(0,4),ans:b}},
      ()=>{const n=RI(2,4+d),e=2;const seq=[n**e,(n+1)**e,(n+2)**e,(n+3)**e];return{seq,ans:(n+4)**e}},
      ()=>{const s=RI(1,6),d2=RI(1,4);const seq=[s,s+d2,s+d2*3,s+d2*6];return{seq,ans:s+d2*10}},
    ]
    const g = PICK(d<2?generators.slice(0,2):d<4?generators.slice(0,4):generators)()
    const w = new Set()
    const spread = Math.max(5,Math.floor(g.ans*0.4))
    while(w.size<3){const x=g.ans+RI(-spread,spread);if(x>0&&x!==g.ans)w.add(x)}
    return { question:`${g.seq.join(' → ')} → ?`, options:SHUFFLE([...[...w],g.ans]), answer:g.ans, display:'choice' }
  }
}

/* 3. MemoryFlash */
const MemoryFlashEngine = {
  type:'memory', label:'Memory Flash', icon:'🧠', color:'#ec4899',
  generate(d) {
    const len = 3 + Math.min(d,4)
    const nums = Array.from({length:len},()=>RI(1,9+d*5))
    const isYes = Math.random() > 0.5
    let target
    if (isYes) {
      target = PICK(nums)
    } else {
      target = RI(1, 9+d*5)
      while (nums.includes(target)) target = RI(1, 9+d*5)
    }
    return {
      question: nums,
      subtext: `Was ${target} in the sequence?`,
      options: ['Yes ✓','No ✗'],
      answer: nums.includes(target) ? 'Yes ✓' : 'No ✗',
      display: 'memory',
      flashMs: Math.max(400, 1200 - d*150),
      target,
    }
  }
}

/* 4. PatternGrid */
const PatternGridEngine = {
  type:'pattern', label:'Pattern Grid', icon:'⬛', color:'#f59e0b',
  generate(d) {
    const size = d < 3 ? 3 : 4
    const patterns = [
      // Row pattern
      ()=>{
        const on = []
        const row = RI(0,size-1)
        for(let c=0;c<size;c++) on.push([row,c])
        const miss = PICK(on); const visible = on.filter(([r2,c2])=>!(r2===miss[0]&&c2===miss[1]))
        return { cells:visible, missing:miss, grid:size, rule:'row' }
      },
      // Diagonal
      ()=>{
        const on = []; for(let i=0;i<size;i++) on.push([i,i])
        const miss = PICK(on); const visible = on.filter(([r2,c2])=>!(r2===miss[0]&&c2===miss[1]))
        return { cells:visible, missing:miss, grid:size, rule:'diagonal' }
      },
      // L shape
      ()=>{
        const r=RI(0,size-2),c=RI(0,size-2)
        const on=[[r,c],[r+1,c],[r+1,c+1]]
        const miss=PICK(on); const visible=on.filter(([r2,c2])=>!(r2===miss[0]&&c2===miss[1]))
        return{cells:visible,missing:miss,grid:size,rule:'L'}
      },
    ]
    const g = PICK(patterns)()
    return {
      question: g.cells,
      answer: g.missing,
      gridSize: g.grid,
      display: 'grid',
      subtext: 'Tap the missing cell',
      options: null,
    }
  }
}

/* 5. OddOneOut */
const OddOneOutEngine = {
  type:'odd', label:'Odd One Out', icon:'🔍', color:'#10b981',
  generate(d) {
    const categories = [
      { group:['🍎','🍊','🍋','🍇','🍓'], odd:['🏀','⚽','🎾','🏐','🎱'] },
      { group:['🐶','🐱','🐭','🐰','🦊'], odd:['🌹','🌻','🌺','🌼','🌸'] },
      { group:['Car','Bus','Train','Bike','Truck'], odd:['Apple','Mango','Grape','Lemon','Peach'] },
      { group:['Circle','Square','Triangle','Pentagon','Hexagon'], odd:['Red','Blue','Green','Yellow','Purple'] },
      { group:[2,4,6,8,10], odd:[1,3,5,7,9], type:'number', label:'even vs odd' },
      { group:[3,6,9,12,15], odd:[4,7,11,14,17], type:'number', label:'mult3 vs not' },
      { group:['January','March','July','August','October'], odd:['April','June','September','November','February'] },
    ]
    const cat = PICK(categories)
    const numCorrect = d<3?3:2  // items from main group
    const correctItems = SHUFFLE(cat.group).slice(0,numCorrect)
    const oddItem = PICK(cat.odd)
    const options = SHUFFLE([...correctItems, oddItem])
    const rule = numCorrect===3?'Which does not belong?':'Which is different?'
    return {
      question: rule,
      options: options.map(String),
      answer: String(oddItem),
      display: 'choice',
      subtext: '',
    }
  }
}

/* 6. ReactionEngine */
const ReactionEngine = {
  type:'reaction', label:'Reaction', icon:'⚡', color:'#ef4444',
  generate(d) {
    const targets = ['🟢','🔵','🟡']
    const distractors = ['🔴','⚫','🟣']
    const target = PICK(targets)
    const count = 4 + d
    const items = []
    const targetIdx = RI(0,count-1)
    for(let i=0;i<count;i++){
      items.push(i===targetIdx ? target : PICK([...distractors,...targets.filter(t=>t!==target)]))
    }
    return {
      question: `Tap ${target} as fast as you can!`,
      options: items,
      answer: String(targetIdx),
      display: 'reaction',
      target,
    }
  }
}

/* 7. SequenceRecall */
const SequenceRecallEngine = {
  type:'recall', label:'Sequence Recall', icon:'📋', color:'#06b6d4',
  generate(d) {
    const len = 3 + Math.min(d, 4)
    const symbols = ['🔴','🔵','🟡','🟢','🟣','⚫','🟠']
    const seq = Array.from({length:len}, ()=>PICK(symbols))
    const positions = Array.from({length:len},(_,i)=>i)
    const askIdx = PICK(positions.slice(1))
    const correct = seq[askIdx]
    const wrong = new Set()
    while(wrong.size<3){const w=PICK(symbols);if(w!==correct)wrong.add(w)}
    return {
      question: seq,
      subtext: `What was at position ${askIdx+1}?`,
      options: SHUFFLE([...[...wrong],correct]),
      answer: correct,
      display: 'recall',
      flashMs: Math.max(300, 1000-d*80),
      askIdx,
    }
  }
}

/* 8. CompareChoose */
const CompareChooseEngine = {
  type:'compare', label:'Compare & Choose', icon:'⚖️', color:'#a78bfa',
  generate(d) {
    const types = d<2?['bigger','more']:['bigger','more','faster','heavier','longer']
    const type = PICK(types)
    const pairs = {
      bigger: [['🐘 Elephant','🐁 Mouse'],['🏔 Mountain','🌋 Hill'],['🌊 Ocean','🏊 Pool'],['🦁 Lion','🐈 Cat'],['🚀 Rocket','✈ Plane']],
      more:   [['1000','100'],['75%','25%'],['3/4','1/4'],['99','9'],['2²','1²']],
      faster: [['🚄 Bullet Train','🐌 Snail'],['⚡ Lightning','🌧 Rain'],['🐆 Cheetah','🐢 Turtle'],['✈ Plane','🚲 Bike']],
      heavier:[['🏋️ Barbell','🪶 Feather'],['🚗 Car','🛵 Scooter'],['🪨 Rock','🍃 Leaf'],['🐋 Whale','🐟 Fish']],
      longer: [['📏 Ruler','✏️ Pencil'],['🐍 Snake','🐛 Caterpillar'],['🦒 Giraffe','🐑 Sheep'],['🌲 Tree','🌿 Grass']],
    }
    const pair = PICK(pairs[type]||pairs.bigger)
    const correct = pair[0]
    return {
      question: `Which is ${type}?`,
      options: SHUFFLE(pair),
      answer: correct,
      display: 'choice',
    }
  }
}

/* 9. GridTapSequence */
const GridTapSequenceEngine = {
  type:'gridtap', label:'Grid Tap', icon:'🎯', color:'#f97316',
  generate(d) {
    const size = d<3?3:4
    const seqLen = 2+Math.min(d,4)
    const cells = []
    while(cells.length<seqLen){const c=RI(0,size*size-1);if(!cells.includes(c))cells.push(c)}
    return {
      question: cells,
      answer: JSON.stringify(cells),
      display: 'gridtap',
      gridSize: size,
      flashMs: Math.max(400,900-d*60),
      subtext: 'Tap cells in order shown',
      options: null,
    }
  }
}

/* 10. RotateFit */
const RotateFitEngine = {
  type:'rotate', label:'Rotate & Fit', icon:'🔄', color:'#14b8a6',
  generate(d) {
    const shapes = ['▲','■','●','◆','★','⬟','⬡','⬣']
    const colors = ['#ef4444','#3b82f6','#22c55e','#f59e0b','#8b5cf6','#ec4899']
    const count = 3+Math.min(d,3)
    const target = Array.from({length:count},()=>({shape:PICK(shapes),color:PICK(colors)}))
    const rotation = PICK([0,90,180,270])
    const wrong1 = target.map((t,i)=>i===0?{...t,shape:PICK(shapes.filter(s=>s!==t.shape))}:t)
    const wrong2 = SHUFFLE([...target])
    const wrong3 = target.map(t=>({...t,color:PICK(colors.filter(c=>c!==t.color))}))
    const opts = SHUFFLE([target,wrong1,wrong2,wrong3])
    const ansIdx = opts.indexOf(target)
    return {
      question: target,
      options: opts,
      answer: ansIdx,
      display: 'rotate',
      rotation,
      subtext: `Find the original after ${rotation}° rotation`,
    }
  }
}

/* ─── ENGINE REGISTRY ─── */
const ENGINES = [
  QuickMathEngine, NumberLogicEngine, MemoryFlashEngine, PatternGridEngine,
  OddOneOutEngine, ReactionEngine, SequenceRecallEngine, CompareChooseEngine,
  GridTapSequenceEngine, RotateFitEngine,
]

const ENGINE_ROTATION = ['math','series','memory','pattern','odd','reaction','recall','compare','gridtap','rotate']

/* ─── PUZZLE GENERATOR (anti-repeat rotation + onboarding) ─── */
function nextEngine(history) {
  const recent = history.slice(-3).map(h=>h.type)
  const available = ENGINES.filter(e=>!recent.includes(e.type))
  return available.length ? PICK(available) : PICK(ENGINES)
}

function generatePuzzle(difficulty, history=[], puzzleIdx=0) {
  // Onboarding Phase: Force difficulty 1 for the first 5 puzzles to ease players in
  const effectiveDiff = puzzleIdx < 5 ? 1 : Math.round(difficulty)
  const engine = nextEngine(history)
  const puzzle = engine.generate(effectiveDiff)
  return { ...puzzle, engineType:engine.type, engineLabel:engine.label, engineIcon:engine.icon, engineColor:engine.color, id:`${engine.type}_${Date.now()}_${RI(0,9999)}` }
}

/* ─── DIFFICULTY ENGINE (Smoother progression) ─── */
function calcDifficulty(current, accuracy, avgMs, streak) {
  let target = current
  // Adaptive thresholds
  if(accuracy >= 0.8 && avgMs < 3000) target += 1
  else if(accuracy >= 0.6 && avgMs < 4500) target += 0.5
  else if(accuracy < 0.4 || avgMs > 6000) target -= 1
  
  if(streak >= 5) target += 0.5
  if(streak >= 10) target += 1

  // Clamp the change to avoid frustrating sudden jumps (+/- 1 max per adjustment)
  let diff = target - current
  diff = Math.max(-1, Math.min(1, diff))
  
  return Math.max(1, Math.min(9, current + diff))
}

/* ─── TIMER (Relaxed early, smooth mid, fair late) ─── */
function calcTimeLimit(difficulty, avgMs = 5000) {
  let base
  if (difficulty <= 2) base = 9000
  else if (difficulty <= 4) base = 7500
  else if (difficulty <= 6) base = 6000
  else base = 5000
  base += Math.max(-500, Math.min(800, (avgMs - 4000) * 0.15))
  return Math.max(3500, base + 3000)
}

/* ─── REWARD CALCULATOR ─── */
function calcReward(correct, streak, responseMs, timeLimit) {
  if(!correct) return 0
  let coins = BASE_REWARD
  if(responseMs < timeLimit*0.4) coins += SPEED_BONUS + 3
  else if(responseMs < timeLimit*0.6) coins += SPEED_BONUS
  else if(responseMs < timeLimit*0.75) coins += 2
  const mult = Object.entries(STREAK_MULTI).reverse().find(([s])=>streak>=Number(s))
  if(mult) coins = Math.round(coins * Number(mult[1]))
  if(streak>=JACKPOT_AT) coins += 20
  return coins
}

/* ══════════════════════════════════════════════════════════════════
   PUZZLE DISPLAY COMPONENTS
══════════════════════════════════════════════════════════════════ */

/* Choice buttons — used by most engines */
function ChoiceDisplay({ options, answer, onAnswer, disabled, color }) {
  const [selected, setSelected] = useState(null)
  const handleTap = (opt, idx) => {
    if(disabled||selected!==null) return
    setSelected(idx)
    onAnswer(String(opt)===String(answer), String(opt))
  }
  return (
    <div style={{ display:'grid', gridTemplateColumns: options.length===2?'1fr 1fr':'1fr 1fr', gap:10, width:'100%' }}>
      {options.map((opt,i)=>(
        <button key={i} className="sm-pressable" onClick={()=>handleTap(opt,i)} disabled={disabled||selected!==null}
          style={{
            padding:'18px 8px', borderRadius:16, border:'2.5px solid',
            borderColor: selected===null ? `${color}40` : selected===i ? (String(opt)===String(answer)?'#22c55e':'#ef4444') : (String(opt)===String(answer)&&selected!==null?'#22c55e':'rgba(255,255,255,0.08)'),
            background: selected===null ? `${color}10` : selected===i ? (String(opt)===String(answer)?'rgba(34,197,94,0.2)':'rgba(239,68,68,0.2)') : (String(opt)===String(answer)&&selected!==null?'rgba(34,197,94,0.1)':'rgba(255,255,255,0.03)'),
            color:'#fff', fontSize:typeof opt==='number'||String(opt).length<6?22:14,
            fontWeight:700, fontFamily:'Poppins,sans-serif', cursor:'pointer',
            transition:'all 0.18s', minHeight:64, display:'flex', alignItems:'center', justifyContent:'center',
            transform: selected===i ? 'scale(0.97)' : 'scale(1)',
          }}>
          {opt}
        </button>
      ))}
    </div>
  )
}

/* Memory Flash display */
function MemoryDisplay({ puzzle, onAnswer, disabled }) {
  const [phase, setPhase] = useState('showing') // showing → recall
  const [selected, setSelected] = useState(null)
  useEffect(()=>{
    const tid = setTimeout(()=>setPhase('recall'), puzzle.flashMs*(puzzle.question.length+1))
    return()=>clearTimeout(tid)
  },[puzzle.flashMs, puzzle.question.length])
  if(phase==='showing') {
    return (
      <div style={{ textAlign:'center' }}>
        <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap', marginBottom:16 }}>
          {puzzle.question.map((n,i)=>(
            <div key={i} style={{
              width:52, height:52, borderRadius:14, background:'rgba(236,72,153,0.2)',
              border:'2px solid rgba(236,72,153,0.5)', display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:22, fontWeight:800, color:'#f0f0f0', fontFamily:'Syne,sans-serif',
              animation:`smFlash ${puzzle.flashMs/1000}s ease-in-out ${i*(puzzle.flashMs/1000*0.8)}s both`,
            }}>{n}</div>
          ))}
        </div>
        <p style={{ color:'rgba(255,255,255,0.4)', fontSize:13, fontFamily:'Poppins,sans-serif' }}>Memorise the sequence…</p>
      </div>
    )
  }
  return (
    <div>
      <p style={{ color:'#f0f0f0', fontSize:15, fontWeight:700, textAlign:'center', marginBottom:16, fontFamily:'Poppins,sans-serif' }}>{puzzle.subtext}</p>
      <ChoiceDisplay options={puzzle.options} answer={puzzle.answer} onAnswer={onAnswer} disabled={disabled} color="#ec4899" />
    </div>
  )
}

/* Grid display — tap missing cell */
function GridDisplay({ puzzle, onAnswer, disabled }) {
  const [tapped, setTapped] = useState(null)
  const { question:cells, answer, gridSize } = puzzle
  const handleTap = (r,c) => {
    if(disabled||tapped) return
    setTapped([r,c])
    const correct = Array.isArray(answer) && answer[0]===r && answer[1]===c
    onAnswer(correct, [r,c])
  }
  return (
    <div style={{ display:'grid', gridTemplateColumns:`repeat(${gridSize},1fr)`, gap:6, width:'100%', maxWidth:280, margin:'0 auto' }}>
      {Array.from({length:gridSize},(_,r)=>Array.from({length:gridSize},(_,c)=>{
        const isCell = cells.some(([cr,cc])=>cr===r&&cc===c)
        const isTapped = tapped&&tapped[0]===r&&tapped[1]===c
        const isAnswer = Array.isArray(answer)&&answer[0]===r&&answer[1]===c
        return (
          <button key={`${r}-${c}`} className="sm-pressable" onClick={()=>handleTap(r,c)} disabled={disabled||!!tapped}
            style={{
              height:60, borderRadius:12, border:'2px solid',
              borderColor: isTapped?(isAnswer?'#22c55e':'#ef4444'):isCell?'rgba(245,158,11,0.6)':'rgba(255,255,255,0.08)',
              background: isTapped?(isAnswer?'rgba(34,197,94,0.25)':'rgba(239,68,68,0.25)'):isCell?'rgba(245,158,11,0.2)':'rgba(255,255,255,0.04)',
              cursor: isCell?'default':'pointer', transition:'all 0.15s',
            }} />
        )
      })).flat()}
    </div>
  )
}

/* Reaction — tap target fast */
function ReactionDisplay({ puzzle, onAnswer, disabled }) {
  const [tapped, setTapped] = useState(null)
  const { options, answer, target } = puzzle
  return (
    <div style={{ display:'grid', gridTemplateColumns:`repeat(${Math.ceil(Math.sqrt(options.length))},1fr)`, gap:10, width:'100%', maxWidth:280, margin:'0 auto' }}>
      {options.map((item,i)=>(
        <button key={i} className="sm-pressable" onClick={()=>{if(disabled||tapped!==null)return;setTapped(i);onAnswer(String(i)===String(answer),i)}}
          disabled={disabled||tapped!==null}
          style={{
            height:64, borderRadius:16, fontSize:28,
            border:'2px solid',
            borderColor:tapped===i?(String(i)===String(answer)?'#22c55e':'#ef4444'):'rgba(255,255,255,0.1)',
            background:tapped===i?(String(i)===String(answer)?'rgba(34,197,94,0.2)':'rgba(239,68,68,0.2)'):'rgba(255,255,255,0.05)',
            cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.1s',
          }}>{item}</button>
      ))}
    </div>
  )
}

/* Sequence Recall */
function RecallDisplay({ puzzle, onAnswer, disabled }) {
  const [phase, setPhase] = useState('showing')
  const [step, setStep] = useState(0)
  const [currentItem, setCurrentItem] = useState(puzzle.question[0])
  useEffect(()=>{
    if(phase!=='showing') return
    if(step>=puzzle.question.length){setPhase('recall');return}
    setCurrentItem(puzzle.question[step])
    const tid=setTimeout(()=>setStep(s=>s+1), puzzle.flashMs)
    return()=>clearTimeout(tid)
  },[step,phase,puzzle.flashMs,puzzle.question])
  if(phase==='showing') return (
    <div style={{ textAlign:'center' }}>
      <div style={{ fontSize:56, marginBottom:12, animation:'smFlashItem 0.4s ease-in-out' }}>{currentItem}</div>
      <div style={{ display:'flex', gap:6, justifyContent:'center' }}>
        {puzzle.question.map((_,i)=>(
          <div key={i} style={{ width:8, height:8, borderRadius:'50%', background:i<step?'#06b6d4':'rgba(255,255,255,0.2)', transition:'background 0.2s' }}/>
        ))}
      </div>
      <p style={{ color:'rgba(255,255,255,0.35)', fontSize:11, marginTop:10, fontFamily:'Poppins,sans-serif' }}>Remember the sequence…</p>
    </div>
  )
  return (
    <div>
      <p style={{ color:'#f0f0f0', fontSize:14, fontWeight:700, textAlign:'center', marginBottom:16, fontFamily:'Poppins,sans-serif' }}>{puzzle.subtext}</p>
      <ChoiceDisplay options={puzzle.options} answer={puzzle.answer} onAnswer={onAnswer} disabled={disabled} color="#06b6d4"/>
    </div>
  )
}

/* Grid Tap Sequence */
function GridTapDisplay({ puzzle, onAnswer, disabled }) {
  const [phase, setPhase] = useState('showing')
  const [flashIdx, setFlashIdx] = useState(0)
  const [userSeq, setUserSeq] = useState([])
  const { question:seq, gridSize, flashMs } = puzzle
  useEffect(()=>{
    if(phase!=='showing') return
    if(flashIdx>=seq.length){setTimeout(()=>setPhase('recall'),400);return}
    const tid=setTimeout(()=>setFlashIdx(i=>i+1),flashMs+100)
    return()=>clearTimeout(tid)
  },[flashIdx,phase,seq.length,flashMs])
  const handleTap=(idx)=>{
    if(phase!=='recall'||disabled) return
    const ns=[...userSeq,idx]
    setUserSeq(ns)
    if(ns.length===seq.length){
      const correct=JSON.stringify(ns)===JSON.stringify(seq)
      onAnswer(correct,ns)
    }
  }
  return (
    <div>
      {phase==='showing'&&<p style={{textAlign:'center',color:'rgba(255,255,255,0.5)',fontSize:12,marginBottom:10,fontFamily:'Poppins,sans-serif'}}>Watch the sequence…</p>}
      {phase==='recall'&&<p style={{textAlign:'center',color:'#f97316',fontSize:13,fontWeight:700,marginBottom:10,fontFamily:'Poppins,sans-serif'}}>Tap in order! ({userSeq.length}/{seq.length})</p>}
      <div style={{display:'grid',gridTemplateColumns:`repeat(${gridSize},1fr)`,gap:6,maxWidth:260,margin:'0 auto'}}>
        {Array.from({length:gridSize*gridSize},(_,i)=>{
          const isFlashing=phase==='showing'&&flashIdx<seq.length&&seq[flashIdx]===i
          const isInUserSeq=userSeq.includes(i)
          return (
            <button key={i} className="sm-pressable" onClick={()=>handleTap(i)} disabled={phase!=='recall'||disabled}
              style={{
                height:55,borderRadius:12,border:'2px solid',
                borderColor:isFlashing?'#f97316':isInUserSeq?'#22c55e':'rgba(255,255,255,0.1)',
                background:isFlashing?'rgba(249,115,22,0.4)':isInUserSeq?'rgba(34,197,94,0.2)':'rgba(255,255,255,0.04)',
                transition:'all 0.15s',cursor:phase==='recall'?'pointer':'default',
              }}/>
          )
        })}
      </div>
    </div>
  )
}

/* Rotate Fit */
function RotateDisplay({ puzzle, onAnswer, disabled }) {
  const [selected, setSelected] = useState(null)
  const { question:target, options, answer, rotation, subtext } = puzzle
  const ShapeRow = ({items, small}) => (
    <div style={{display:'flex',gap:4,justifyContent:'center',flexWrap:'wrap'}}>
      {items.map((it,i)=>(
        <div key={i} style={{width:small?22:28,height:small?22:28,borderRadius:6,background:it.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:small?10:13}}>
          {it.shape}
        </div>
      ))}
    </div>
  )
  return (
    <div>
      <p style={{textAlign:'center',color:'rgba(255,255,255,0.5)',fontSize:11,marginBottom:6,fontFamily:'Poppins,sans-serif'}}>{subtext}</p>
      <div style={{background:'rgba(20,184,166,0.1)',border:'2px solid rgba(20,184,166,0.4)',borderRadius:14,padding:'10px',marginBottom:12,textAlign:'center'}}>
        <p style={{fontSize:10,color:'rgba(255,255,255,0.4)',margin:'0 0 6px',fontFamily:'Poppins,sans-serif'}}>ORIGINAL</p>
        <ShapeRow items={target}/>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
        {options.map((opt,i)=>(
          <button key={i} className="sm-pressable" onClick={()=>{if(disabled||selected!==null)return;setSelected(i);onAnswer(i===answer,i)}}
            disabled={disabled||selected!==null}
            style={{
              padding:'10px',borderRadius:14,border:'2px solid',
              borderColor:selected===null?'rgba(255,255,255,0.1)':selected===i?(i===answer?'#22c55e':'#ef4444'):(i===answer&&selected!==null?'#22c55e':'rgba(255,255,255,0.06)'),
              background:selected===null?'rgba(255,255,255,0.04)':selected===i?(i===answer?'rgba(34,197,94,0.2)':'rgba(239,68,68,0.2)'):(i===answer&&selected!==null?'rgba(34,197,94,0.1)':'transparent'),
              cursor:'pointer',
            }}>
            <ShapeRow items={opt} small/>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ─── Route puzzle to display ─── */
function PuzzleDisplay({ puzzle, onAnswer, disabled }) {
  const color = puzzle.engineColor || '#6366f1'
  if(puzzle.display==='memory') return <MemoryDisplay puzzle={puzzle} onAnswer={onAnswer} disabled={disabled}/>
  if(puzzle.display==='recall') return <RecallDisplay puzzle={puzzle} onAnswer={onAnswer} disabled={disabled}/>
  if(puzzle.display==='grid')   return <GridDisplay puzzle={puzzle} onAnswer={onAnswer} disabled={disabled}/>
  if(puzzle.display==='reaction') return <ReactionDisplay puzzle={puzzle} onAnswer={onAnswer} disabled={disabled}/>
  if(puzzle.display==='gridtap')  return <GridTapDisplay puzzle={puzzle} onAnswer={onAnswer} disabled={disabled}/>
  if(puzzle.display==='rotate')   return <RotateDisplay puzzle={puzzle} onAnswer={onAnswer} disabled={disabled}/>
  // default: choice
  return <ChoiceDisplay options={puzzle.options} answer={puzzle.answer} onAnswer={onAnswer} disabled={disabled} color={color}/>
}

/* ──────────────── TIMER BAR ──────────────── */
function TimerBar({ durationMs, onExpire, active = true, key:k }) {
  const [pct, setPct] = useState(100)
  const startRef = useRef(Date.now())
  const rafRef = useRef(null)
  useEffect(()=>{
    if(!active) return
    startRef.current = Date.now()
    const tick=()=>{
      const elapsed=Date.now()-startRef.current
      const p=Math.max(0,100-(elapsed/durationMs)*100)
      setPct(p)
      if(p<=0){onExpire();return}
      rafRef.current=requestAnimationFrame(tick)
    }
    rafRef.current=requestAnimationFrame(tick)
    return()=>cancelAnimationFrame(rafRef.current)
  },[durationMs,onExpire,active])
  const barColor = pct>60?'#22c55e':pct>30?'#f59e0b':'#ef4444'
  return (
    <div style={{height:5,background:'rgba(255,255,255,0.08)',borderRadius:4,overflow:'hidden',marginBottom:0,boxShadow:'0 0 12px rgba(99,102,241,0.18)'}}>
      <div style={{height:'100%',width:`${pct}%`,background:barColor,borderRadius:4,transition:'width 0.16s linear, background 0.3s',boxShadow:`0 0 10px ${barColor}80`}}/>
    </div>
  )
}

/* ──────────────── FEEDBACK OVERLAY ──────────────── */
function formatAnswer(answer) {
  if (Array.isArray(answer)) return answer.map(item => typeof item === 'object' ? JSON.stringify(item) : item).join(', ')
  if (answer && typeof answer === 'object') return JSON.stringify(answer)
  return String(answer)
}

function FeedbackOverlay({ correct, coins, streak, nearMiss, extraMsg, correctAnswer, onDone }) {
  const tone = correct ? '#22c55e' : nearMiss ? '#fbbf24' : '#ef4444'
  const bg = correct ? 'rgba(34,197,94,0.18)' : nearMiss ? 'rgba(245,158,11,0.18)' : 'rgba(239,68,68,0.18)'
  const message = correct ? 'Correct! 🔥' : nearMiss ? 'Almost! 🔥' : 'Wrong!'
  return (
    <div style={{
      position:'absolute', inset:0, borderRadius:24, zIndex:10,
      background:bg,
      border:`2px solid ${tone}`,
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      padding:20,
      boxShadow:`0 18px 60px ${tone}30, inset 0 1px 0 rgba(255,255,255,0.1)`,
      animation:'smFeedbackIn 0.28s ease-out both',
    }}>
      <div style={{fontSize:52, marginBottom:4}}>{correct?'✅':nearMiss?'⚠️':'❌'}</div>
      {correct&&<p style={{fontFamily:'Syne,sans-serif',fontWeight:900,fontSize:28,color:'#34D399',margin:0}}>+{coins} 💰</p>}
      {correct&&streak>=3&&<p style={{fontFamily:'Poppins,sans-serif',fontWeight:700,fontSize:14,color:'#fbbf24',margin:'4px 0 0'}}>🔥 x{streak} Streak!</p>}
      {correct&&<p style={{fontFamily:'Syne,sans-serif',fontWeight:900,fontSize:26,color:tone,margin:'0 0 6px',textAlign:'center'}}>{message}</p>}
      {!correct&&<p style={{fontFamily:'Syne,sans-serif',fontWeight:900,fontSize:26,color:tone,margin:'0 0 6px',textAlign:'center'}}>{message}</p>}
      {!correct&&<p style={{fontFamily:'Poppins,sans-serif',fontWeight:800,fontSize:16,color:'#fff',margin:'2px 0 0',textAlign:'center',lineHeight:1.45}}>Wrong! Correct Answer: <span style={{color:tone}}>{correctAnswer}</span></p>}
      <button className="sm-pressable" onClick={onDone} style={{marginTop:20,padding:'12px 22px',borderRadius:14,border:`1.5px solid ${tone}`,background:`linear-gradient(135deg,${tone},${tone}cc)`,color:'#fff',fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:15,cursor:'pointer',boxShadow:`0 8px 26px ${tone}45`,transition:'transform 0.16s ease, box-shadow 0.16s ease'}}>
        Next
      </button>
      {extraMsg&&<p style={{fontFamily:'Poppins,sans-serif',fontWeight:700,fontSize:13,color:'#a5b4fc',margin:'4px 0 0'}}>{extraMsg}</p>}
      {nearMiss&&!correct&&coins>0&&<p style={{fontFamily:'Poppins,sans-serif',fontWeight:700,fontSize:13,color:'#34D399',margin:'4px 0 0'}}>+{coins} 💰 Pity</p>}
    </div>
  )
}

/* ──────────────── SESSION COMPLETE ──────────────── */
function SessionComplete({ coins, streak, accuracy, bestStreak, onClose, onPlayAgain }) {
  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'28px 20px',textAlign:'center'}}>
      <div style={{fontSize:56,marginBottom:12,animation:'smPop 0.6s cubic-bezier(.34,1.56,.64,1) both'}}>🏆</div>
      <p style={{fontFamily:'Syne,sans-serif',fontWeight:900,fontSize:28,color:'#fff',margin:'0 0 4px'}}>Session Complete!</p>
      <p style={{fontFamily:'Poppins,sans-serif',fontSize:13,color:'rgba(255,255,255,0.4)',margin:'0 0 28px'}}>Great brain workout!</p>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,width:'100%',maxWidth:280,marginBottom:28}}>
        {[
          {label:'Coins Earned',value:`+${coins} 💰`,color:'#fbbf24'},
          {label:'Best Streak',value:`🔥 ${bestStreak}`,color:'#f97316'},
          {label:'Accuracy',value:`${Math.round(accuracy*100)}%`,color:'#22c55e'},
          {label:'Puzzles',value:`${SESSION_LENGTH}`,color:'#6366f1'},
        ].map((s,i)=>(
          <div key={i} style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:16,padding:'14px 10px'}}>
            <p style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:20,color:s.color,margin:'0 0 4px'}}>{s.value}</p>
            <p style={{fontSize:10,color:'rgba(255,255,255,0.35)',margin:0,fontFamily:'Poppins,sans-serif',textTransform:'uppercase',letterSpacing:'0.1em'}}>{s.label}</p>
          </div>
        ))}
      </div>
      <button onClick={onPlayAgain} style={{width:'100%',maxWidth:280,padding:'15px',borderRadius:16,border:'none',background:'linear-gradient(135deg,#6366f1,#8b5cf6)',color:'#fff',fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:16,cursor:'pointer',boxShadow:'0 6px 24px rgba(99,102,241,0.45)',marginBottom:10}}>
        ⚡ Play Again
      </button>
      <button onClick={onClose} style={{background:'none',border:'none',color:'rgba(255,255,255,0.3)',fontFamily:'Poppins,sans-serif',fontSize:13,cursor:'pointer',padding:8}}>
        Close
      </button>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   MAIN MODAL — GameEngineRunner
══════════════════════════════════════════════════════════════════ */
export function SkillMachineModal({ userId, isOpen, onClose, onReward, coins: syncedCoins = 0 }) {
  /* ─── Session state ─── */
  const [phase, setPhase]           = useState('loading')   // loading|ready|playing|feedback|done
  const [puzzle, setPuzzle]         = useState(null)
  const [nextPuzzle, setNextPuzzle] = useState(null)        // preloaded
  const [history, setHistory]       = useState([])
  const [feedback, setFeedback]     = useState(null)
  const [puzzleIdx, setPuzzleIdx]   = useState(0)

  /* ─── Stats ─── */
  const [streak, setStreak]         = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [sessionCoins, setSessionCoins] = useState(0)
  const [correct, setCorrect]       = useState(0)
  const [timerKey, setTimerKey]     = useState(0)

  /* ─── Firebase / wallet ─── */
  const [difficulty, setDifficulty] = useState(1)
  const [dailyDone, setDailyDone]   = useState(false)
  const [dailyBonus, setDailyBonus] = useState(0)
  const [loading, setLoading]       = useState(true)

  const responseTimes = useRef([])
  const sessionStartRef = useRef(null)
  const timerRef = useRef(null)
  const answeredRef = useRef(false)
  const continuingRef = useRef(false)
  const totalCoins = Number(syncedCoins || 0)

  const TODAY = () => new Date().toISOString().slice(0,10)

  /* ─── LOAD: check daily bonus, load wallet ─── */
  const loadWallet = useCallback(async()=>{
    if(!userId){setLoading(false);return}
    setLoading(true)
    try {
      const snap = await getDoc(doc(db,'acr_users',userId.toLowerCase()))
      const d = snap.exists()?snap.data():{}
      const sm = d.skillMachine||{}
      const lastDaily = sm.lastDailyReward||''
      const lastWeekly = sm.lastWeeklyReward||''
      const todayStr = TODAY()
      
      // Enforce start difficulty of 1 for a smoother onboarding experience each time
      setDifficulty(1)
      
      // Daily bonus
      if(lastDaily!==todayStr){
        const bonus = PICK(DAILY_BONUS)
        setDailyBonus(bonus)
        setDailyDone(false)
      } else {
        setDailyDone(true)
      }
    } catch(e){console.error('SM load:',e)}
    setLoading(false)
  },[userId])

  useEffect(()=>{
    if(isOpen){
      setPhase('loading'); setHistory([]); setPuzzleIdx(0); setStreak(0)
      setBestStreak(0); setSessionCoins(0); setCorrect(0); responseTimes.current=[]
      answeredRef.current = false; continuingRef.current = false
      setPuzzle(null); setNextPuzzle(null); setFeedback(null)
      loadWallet()
    }
  },[isOpen, loadWallet])

  /* ─── Start session after loading ─── */
  useEffect(()=>{
    if(!loading&&isOpen&&phase==='loading'){
      const p = generatePuzzle(1, [], 0)
      const np = generatePuzzle(1, [p], 1)
      setPuzzle(p); setNextPuzzle(np)
      answeredRef.current = false; continuingRef.current = false
      sessionStartRef.current = Date.now()
      if(!dailyDone&&dailyBonus>0) setPhase('bonus')
      else setPhase('playing')
      setTimerKey(k=>k+1)
    }
  },[loading,isOpen,phase,difficulty,dailyDone,dailyBonus])

  /* ─── CLAIM BONUS ─── */
  const claimBonus = async () => {
    answeredRef.current = false; continuingRef.current = false
    setPhase('playing')
    setSessionCoins(s=>s+dailyBonus)
    if(userId) {
      try {
        const ref=doc(db,'acr_users',userId.toLowerCase())
        await updateDoc(ref,{coins:increment(dailyBonus),'skillMachine.lastDailyReward':TODAY()})
      } catch(e){console.error('bonus write:',e)}
    }
    onReward?.({coins:dailyBonus,bonus:true})
  }

  /* ─── ANSWER HANDLER ─── */
  const handleAnswer = useCallback(async (isCorrect, userAnswer) => {
    if(phase!=='playing'||answeredRef.current) return
    answeredRef.current = true
    continuingRef.current = false
    setPhase('feedback')
    const responseMs = Date.now() - (sessionStartRef.current||Date.now())
    responseTimes.current.push(responseMs)
    sessionStartRef.current = Date.now()

    // Near miss detection (checks if numerical answer is 'close')
    let isNear = false;
    if (!isCorrect && puzzle && puzzle.answer !== undefined && userAnswer !== undefined) {
      const ansNum = Number(puzzle.answer);
      const userNum = Number(userAnswer);
      if (!isNaN(ansNum) && !isNaN(userNum)) {
        // Tightened near-miss logic: difference is 2 or less
        if (Math.abs(ansNum - userNum) <= 2) {
          isNear = true;
        }
      }
    }

    const newStreak = isCorrect ? streak+1 : 0
    const newBestStreak = Math.max(bestStreak, newStreak)
    
    const times = responseTimes.current
    const avgMs = times.length ? times.reduce((a,b)=>a+b,0)/times.length : 4000
    const timeLimit = calcTimeLimit(difficulty, avgMs)
    
    let coins = calcReward(isCorrect, newStreak, responseMs, timeLimit)
    let extraMsg = '';

    // Mystery reward drop (15% chance on correct answer)
    if (isCorrect && Math.random() < 0.15) {
      const rewards = [20, 30, 50]
      const bonus = rewards[Math.floor(Math.random()*rewards.length)]
      coins += bonus
      extraMsg = '🎁 Lucky Reward!'
    }

    // Comeback Bonus
    if (!isCorrect && streak >= 3) {
      coins += 10;
      extraMsg = '🔥 Comeback Bonus!';
    }

    // Pity points for Near Misses
    if (isNear && !isCorrect) {
      coins += 1; 
    }

    const newCorrect = isCorrect ? correct+1 : correct
    const newPuzzleIdx = puzzleIdx+1

    setStreak(newStreak); setBestStreak(newBestStreak)
    if(coins > 0){
      setSessionCoins(s=>s+coins)
      if(userId) {
        try {
          await updateDoc(doc(db,'acr_users',userId.toLowerCase()), { coins: increment(coins) })
        } catch(e) {
          console.error('SM coin write:', e)
        }
      }
    }
    setCorrect(newCorrect); setPuzzleIdx(newPuzzleIdx)
    
    setFeedback({ correct:isCorrect, coins, nearMiss: isNear, extraMsg, correctAnswer: !isCorrect && puzzle ? formatAnswer(puzzle.answer) : null })

    // Adaptive difficulty update
    const acc = newCorrect/newPuzzleIdx
    setDifficulty(d => calcDifficulty(d, acc, avgMs, newStreak))
  },[phase,streak,bestStreak,difficulty,correct,puzzleIdx,puzzle,userId])

  const handleTimeExpire = useCallback(()=>handleAnswer(false, null),[handleAnswer])

  /* ─── NEXT PUZZLE ─── */
  const advanceToNext = useCallback(()=>{
    if(continuingRef.current) return
    continuingRef.current = true
    if(puzzleIdx>=5){
      setPhase('done')
      if(userId){
        const times = responseTimes.current
        const avgMs = times.length?times.reduce((a,b)=>a+b,0)/times.length:4000
        const acc = correct/SESSION_LENGTH
        const ref=doc(db,'acr_users',userId.toLowerCase())
        getDoc(ref).then(snap=>{
          const d=snap.exists()?snap.data():{}
          const sm=d.skillMachine||{}
          setDoc(ref,{
            'skillMachine.gamesPlayed': (sm.gamesPlayed||0)+1,
            'skillMachine.avgAccuracy': ((sm.avgAccuracy||0.5)*0.7 + acc*0.3),
            'skillMachine.avgResponseTime': ((sm.avgResponseTime||4000)*0.7 + avgMs*0.3),
            'skillMachine.bestStreak': Math.max(sm.bestStreak||0, bestStreak),
            'skillMachine.lastPlayed': TODAY(),
            updatedAt: serverTimestamp(),
          },{merge:true}).catch(e=>console.error('SM session write:',e))
        })
      }
      return
    }
    const newHistory = [...history, puzzle]
    const freshPuzzle = generatePuzzle(difficulty, newHistory.slice(-5), puzzleIdx)
    const freshNextPuzzle = generatePuzzle(difficulty, [...newHistory.slice(-4), freshPuzzle], puzzleIdx + 1)
    setFeedback(null)
    answeredRef.current = false; continuingRef.current = false
    setHistory(newHistory)
    setPuzzle(freshPuzzle)
    setNextPuzzle(freshNextPuzzle)
    setPhase('playing')
    setTimerKey(k=>k+1)
    sessionStartRef.current = Date.now()
  },[puzzleIdx,history,puzzle,difficulty,userId,correct,bestStreak])

  /* ─── PLAY AGAIN ─── */
  const playAgain = () => {
    setHistory([]); setPuzzleIdx(0); setStreak(0); setBestStreak(0)
    setSessionCoins(0); setCorrect(0); responseTimes.current=[]
    answeredRef.current = false; continuingRef.current = false
    setDifficulty(1) // Reset difficulty for the new loop
    const p=generatePuzzle(1, [], 0)
    const np=generatePuzzle(1, [p], 1)
    setPuzzle(p); setNextPuzzle(np)
    setFeedback(null); setTimerKey(k=>k+1)
    sessionStartRef.current=Date.now()
    setPhase('playing')
  }

  if(!isOpen) return null

  const times = responseTimes.current
  const currentAvgMs = times.length ? times.reduce((a,b)=>a+b,0)/times.length : 5000
  const timeLimit = calcTimeLimit(difficulty, currentAvgMs)
  const streakMultStr = Object.entries(STREAK_MULTI).reverse().find(([s])=>streak>=Number(s))
  const accuracy = puzzleIdx>0 ? correct/puzzleIdx : 0

  return (
    <>
    <style>{`
      @keyframes smPop   {0%{transform:scale(0.4);opacity:0}70%{transform:scale(1.1)}100%{transform:scale(1);opacity:1}}
      @keyframes smShake {0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}}
      @keyframes smFlash {0%{opacity:0;transform:scale(0.8)}30%{opacity:1;transform:scale(1.05)}70%{opacity:1}100%{opacity:0;transform:scale(0.9)}}
      @keyframes smFlashItem {0%{opacity:0;transform:scale(0.5)}30%{opacity:1;transform:scale(1.1)}70%{opacity:1}100%{opacity:1}}
      @keyframes smSlide {from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
      @keyframes smCoin  {0%{opacity:0;transform:translateY(6px)}100%{opacity:1;transform:translateY(0)}}
      @keyframes smPulse {0%,100%{opacity:1}50%{opacity:0.5}}
      @keyframes smGlow  {0%,100%{box-shadow:0 0 20px rgba(99,102,241,0.3)}50%{box-shadow:0 0 50px rgba(99,102,241,0.7)}}
      @keyframes smStreakPop {0%{transform:scale(1)}50%{transform:scale(1.3)}100%{transform:scale(1)}}
      @keyframes smFeedbackIn {from{opacity:0;transform:scale(0.96)}to{opacity:1;transform:scale(1)}}
      .sm-pressable:active { transform:scale(0.96) !important; }
      .sm-pressable:hover { box-shadow:0 10px 30px rgba(99,102,241,0.32) !important; }
    `}</style>

    {/* Backdrop */}
    <div onClick={onClose} style={{position:'fixed',inset:0,zIndex:820,background:'rgba(0,0,0,0.85)',backdropFilter:'blur(14px)'}}/>

    {/* Full-screen game container */}
    <div style={{
      position:'fixed', inset:0, zIndex:821, display:'flex', flexDirection:'column',
      background:'linear-gradient(180deg,#06090f 0%,#0b0f1a 50%,#080c14 100%)',
    }}>

      {/* ─── TOP BAR ─── */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:20}}>⚡</span>
          <div>
            <p style={{fontFamily:'Syne,sans-serif',fontWeight:900,fontSize:15,color:'#fff',margin:0}}>Skill Machine</p>
            {puzzle&&<p style={{fontSize:10,color:puzzle.engineColor,margin:0,fontFamily:'Poppins,sans-serif',fontWeight:700}}>{puzzle.engineIcon} {puzzle.engineLabel}</p>}
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          {/* Streak */}
          {streak>=3&&(
            <div style={{display:'flex',alignItems:'center',gap:4,background:'rgba(251,191,36,0.15)',border:'1px solid rgba(251,191,36,0.3)',borderRadius:20,padding:'4px 10px',animation:'smStreakPop 0.4s ease-out'}}>
              <span style={{fontSize:14}}>🔥</span>
              <span style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:14,color:'#fbbf24'}}>{streak}</span>
              {streakMultStr&&<span style={{fontSize:10,color:'#fbbf24',fontFamily:'Poppins,sans-serif'}}>x{streakMultStr[1]}</span>}
            </div>
          )}
          {/* Coins */}
          <div style={{display:'flex',alignItems:'center',gap:5,background:'rgba(99,102,241,0.12)',border:'1px solid rgba(99,102,241,0.3)',borderRadius:20,padding:'4px 10px'}}>
            <span style={{fontSize:13}}>💰</span>
            <span style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:14,color:'#a5b4fc'}}>{totalCoins.toLocaleString()}</span>
          </div>
          <button onClick={onClose} style={{width:30,height:30,borderRadius:10,background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.1)',color:'rgba(255,255,255,0.45)',fontSize:16,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700}}>✕</button>
        </div>
      </div>

      {/* ─── PROGRESS BAR ─── */}
      {(phase==='playing'||phase==='feedback')&&(
        <div style={{padding:'0 16px 8px',flexShrink:0}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:5}}>
            <span style={{fontSize:10,color:'rgba(255,255,255,0.3)',fontFamily:'Poppins,sans-serif'}}>{Math.min(puzzleIdx+1,SESSION_LENGTH)}/{SESSION_LENGTH}</span>
            <span style={{fontSize:10,color:'rgba(255,255,255,0.3)',fontFamily:'Poppins,sans-serif'}}>D:{difficulty} · {Math.round(accuracy*100)}%</span>
          </div>
          <div style={{height:3,background:'rgba(255,255,255,0.06)',borderRadius:3,overflow:'hidden',boxShadow:'0 0 12px rgba(99,102,241,0.16)'}}>
            <div style={{height:'100%',width:`${(Math.min(puzzleIdx,SESSION_LENGTH)/SESSION_LENGTH)*100}%`,background:'linear-gradient(90deg,#6366f1,#8b5cf6)',borderRadius:3,transition:'width 0.3s ease',boxShadow:'0 0 12px rgba(139,92,246,0.55)'}}/>
          </div>
        </div>
      )}

      {/* ─── BODY ─── */}
      <div style={{flex:1,display:'flex',flexDirection:'column',overflowY:'auto',padding:'0 16px'}}>

        {/* LOADING */}
        {phase==='loading'&&(
          <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16}}>
            <div style={{width:44,height:44,border:'3px solid rgba(99,102,241,0.2)',borderTop:'3px solid #6366f1',borderRadius:'50%',animation:'smPulse 0.8s linear infinite'}}/>
            <p style={{color:'rgba(255,255,255,0.4)',fontFamily:'Poppins,sans-serif',fontSize:13}}>Loading…</p>
          </div>
        )}

        {/* DAILY BONUS SCREEN */}
        {phase==='bonus'&&(
          <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',textAlign:'center',padding:20}}>
            <div style={{fontSize:62,marginBottom:16,animation:'smPop 0.6s cubic-bezier(.34,1.56,.64,1) both'}}>🎁</div>
            <p style={{fontFamily:'Syne,sans-serif',fontWeight:900,fontSize:26,color:'#fff',margin:'0 0 8px'}}>Daily Bonus!</p>
            <p style={{fontFamily:'Poppins,sans-serif',fontSize:13,color:'rgba(255,255,255,0.4)',margin:'0 0 24px'}}>Your reward for today</p>
            <div style={{background:'linear-gradient(135deg,rgba(99,102,241,0.2),rgba(139,92,246,0.2))',border:'2px solid rgba(99,102,241,0.4)',borderRadius:24,padding:'24px 40px',marginBottom:28,animation:'smGlow 2s ease-in-out infinite'}}>
              <p style={{fontFamily:'Syne,sans-serif',fontWeight:900,fontSize:48,color:'#a5b4fc',margin:0}}>{dailyBonus}</p>
              <p style={{fontFamily:'Poppins,sans-serif',fontSize:14,color:'rgba(255,255,255,0.4)',margin:0}}>coins</p>
            </div>
            <button onClick={claimBonus} style={{width:'100%',maxWidth:260,padding:'15px',borderRadius:16,border:'none',background:'linear-gradient(135deg,#6366f1,#8b5cf6)',color:'#fff',fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:16,cursor:'pointer',boxShadow:'0 6px 24px rgba(99,102,241,0.5)'}}>
              Claim & Play ⚡
            </button>
          </div>
        )}

        {/* PLAYING */}
        {(phase==='playing'||phase==='feedback')&&puzzle&&(
          <div style={{flex:1,display:'flex',flexDirection:'column',animation:'smSlide 0.24s ease-out'}}>

            {/* Timer */}
            <div style={{marginBottom:12}}>
              <TimerBar key={timerKey} durationMs={timeLimit} onExpire={handleTimeExpire} active={phase==='playing'}/>
            </div>

            {/* Puzzle card */}
            <div style={{position:'relative',background:'rgba(255,255,255,0.04)',border:`1.5px solid ${puzzle.engineColor}30`,borderRadius:24,padding:'18px 16px',flex:1,display:'flex',flexDirection:'column',gap:16,boxShadow:`0 18px 45px rgba(0,0,0,0.24), 0 0 22px ${puzzle.engineColor}18`,animation:'smSlide 0.28s ease-out both',transition:'box-shadow 0.25s ease, transform 0.2s ease'}}>
              {/* Feedback overlay */}
              {phase==='feedback'&&feedback&&(
                <FeedbackOverlay 
                  correct={feedback.correct} 
                  coins={feedback.coins} 
                  streak={streak} 
                  nearMiss={feedback.nearMiss}
                  extraMsg={feedback.extraMsg}
                  correctAnswer={feedback.correctAnswer}
                  onDone={advanceToNext}
                />
              )}

              {/* Engine badge */}
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:16}}>{puzzle.engineIcon}</span>
                <span style={{fontSize:10,fontWeight:800,color:puzzle.engineColor,textTransform:'uppercase',letterSpacing:'0.14em',fontFamily:'Poppins,sans-serif'}}>{puzzle.engineLabel}</span>
              </div>

              {/* Question text (for text-based puzzles) */}
              {typeof puzzle.question==='string'&&(
                <div style={{textAlign:'center',padding:'8px 0'}}>
                  <p style={{fontFamily:'Syne,sans-serif',fontWeight:900,fontSize:puzzle.question.length>20?20:26,color:'#f0f0f0',margin:0,lineHeight:1.3}}>
                    {puzzle.question}
                  </p>
                  {puzzle.subtext&&<p style={{fontFamily:'Poppins,sans-serif',fontSize:12,color:'rgba(255,255,255,0.35)',margin:'6px 0 0'}}>{puzzle.subtext}</p>}
                </div>
              )}

              {/* Puzzle display */}
              <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'center'}}>
                <PuzzleDisplay key={puzzle.id} puzzle={puzzle} onAnswer={handleAnswer} disabled={phase!=='playing'}/>
              </div>
            </div>
          </div>
        )}

        {/* SESSION DONE */}
        {phase==='done'&&(
          <SessionComplete
            coins={sessionCoins} streak={streak} accuracy={accuracy}
            bestStreak={bestStreak}
            onClose={onClose} onPlayAgain={playAgain}
          />
        )}
      </div>

      {/* Bottom legal note */}
      <p style={{textAlign:'center',fontSize:8,color:'rgba(255,255,255,0.08)',padding:'6px 16px 10px',fontFamily:'Poppins,sans-serif',flexShrink:0}}>
        Skill-based game · Coins are virtual tokens with no monetary value
      </p>
    </div>
    </>
  )
}

/* ══════════════════════════════════════════════════════════════════
   SKILL MACHINE CARD (Home page widget)
══════════════════════════════════════════════════════════════════ */
export function SkillMachineCard({ onOpen }) {
  return (
    <button onClick={onOpen}
      style={{
        width:'100%', padding:'14px 16px', borderRadius:18, border:'1.5px solid rgba(99,102,241,0.4)',
        background:'linear-gradient(135deg,rgba(99,102,241,0.15),rgba(139,92,246,0.1),rgba(6,9,15,0.9))',
        boxShadow:'4px 4px 12px rgba(99,102,241,0.12),-3px -3px 8px rgba(255,255,255,0.02)',
        cursor:'pointer', textAlign:'left', transition:'all 0.2s', position:'relative', overflow:'hidden',
      }}
      onMouseEnter={e=>e.currentTarget.style.transform='scale(1.02)'}
      onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:24}}>⚡</span>
          <div>
            <p style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:15,color:'#fff',margin:0}}>Skill Machine</p>
            <p style={{fontSize:11,color:'rgba(165,180,252,0.7)',margin:0,fontFamily:'Poppins,sans-serif'}}>10 engines · Infinite puzzles 🧠</p>
          </div>
        </div>
        <div style={{padding:'6px 14px',background:'linear-gradient(135deg,#6366f1,#8b5cf6)',borderRadius:20,boxShadow:'0 4px 14px rgba(99,102,241,0.4)'}}>
          <span style={{fontFamily:'Poppins,sans-serif',fontWeight:700,fontSize:12,color:'#fff'}}>Play →</span>
        </div>
      </div>
    </button>
  )
}
