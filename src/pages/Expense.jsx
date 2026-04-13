import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend, AreaChart, Area
} from 'recharts'
import { useLanguage } from '../context/LanguageContext'
import { useState, useMemo, useEffect, useRef } from 'react'

const fmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`

const BUDGET_DEFAULTS = {
  Food:2000, Petrol:1500, Smoke:500, Liquor:1000,
  'Electricity Bill':2000, 'Water Bill':500, 'Mobile Recharge':300,
  Groceries:3000, CSD:1000, 'Hotel Food':1500, Other:1000
}

const CAT_ICONS = {
  Food:'🍽',Petrol:'⛽',Smoke:'🚬',Liquor:'🍺',Groceries:'🛒',
  'Mobile Recharge':'📱','Electricity Bill':'⚡','Water Bill':'💧',
  'Hotel Food':'🏨',CSD:'🏪',Other:'💸'
}
const CAT_COLORS = {
  Food:'#f59e0b',Petrol:'#3b82f6',Smoke:'#6b7280',Liquor:'#a78bfa',
  Groceries:'#10b981','Mobile Recharge':'#0891b2','Electricity Bill':'#d97706',
  'Water Bill':'#06b6d4','Hotel Food':'#f43f5e',CSD:'#7c3aed',Other:'#64748b'
}

const TABS = [
  { id:'daily',   label:'📝 Logs' },
  { id:'summary', label:'📊 Analytics' },
  { id:'budget',  label:'🎯 Budgets' },
  { id:'trends',  label:'📈 Trends' },
  { id:'ai',      label:'🤖 AI Brain' },
  { id:'export',  label:'⬇ Export' },
]

/* ── Animated counter ── */
function CountUp({ value, prefix='₹', duration=900 }) {
  const [d, setD] = useState(0)
  const raf = useRef(null)
  useEffect(() => {
    const end = Number(value); const t0 = performance.now()
    const step = (now) => {
      const p = Math.min((now-t0)/duration, 1)
      const e = 1 - Math.pow(1-p, 3)
      setD(Math.round(end*e))
      if (p<1) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf.current)
  }, [value])
  return <span>{prefix}{d.toLocaleString('en-IN')}</span>
}

/* ── Neumorphic card ── */
function NeuCard({ children, style={}, accent, pressed }) {
  return (
    <div style={{
      background:'linear-gradient(135deg,#fafafa 0%,#e4e4e4 50%,#f0f0f0 100%)',
      borderRadius:20, border: accent?`1px solid ${accent}20`:'1px solid rgba(255,255,255,0.9)',
      boxShadow: pressed
        ? 'inset 2px 2px 6px rgba(0,0,0,0.1),inset -1px -1px 4px rgba(255,255,255,0.8)'
        : '5px 5px 14px rgba(0,0,0,0.08),-3px -3px 8px rgba(255,255,255,0.9),inset 0 1px 0 rgba(255,255,255,0.8)',
      padding:18, marginBottom:14, transition:'box-shadow 0.15s', ...style
    }}>{children}</div>
  )
}

/* ── Section header ── */
function SectionHdr({ title, accent='#7c3aed', right }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <div style={{ width:3, height:16, borderRadius:2, background:`linear-gradient(to bottom,${accent},${accent}50)` }} />
        <p style={{ fontSize:12, fontWeight:700, color:'#374151', textTransform:'uppercase', letterSpacing:'0.12em', margin:0, fontFamily:'Poppins,sans-serif' }}>{title}</p>
      </div>
      {right}
    </div>
  )
}

/* ── Progress bar ── */
function NeuBar({ pct, color, height=8 }) {
  const [w, setW] = useState(0)
  useEffect(() => { const tId=setTimeout(()=>setW(pct),250); return ()=>clearTimeout(tId) }, [pct])
  return (
    <div style={{ height, borderRadius:height, background:'linear-gradient(145deg,#e0e0e0,#f5f5f5)', boxShadow:'inset 2px 2px 4px rgba(0,0,0,0.1),inset -1px -1px 2px rgba(255,255,255,0.8)', overflow:'hidden' }}>
      <div style={{ height:'100%', width:`${w}%`, borderRadius:height, background:`linear-gradient(90deg,${color},${color}cc)`, transition:'width 1.1s cubic-bezier(.34,1.1,.64,1)', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.4),transparent)', animation:'shimBar 2s infinite' }} />
      </div>
    </div>
  )
}

/* ── Smart summary card ── */
function SummaryCard({ overallTotal, logs, alerts, topCategory, categoryTotals, avgTransaction }) {
  const msDay=86400000; const now=new Date()
  const todayTotal = logs.filter(l=>{const d=new Date(l.id);return d.getDate()===now.getDate()&&d.getMonth()===now.getMonth()}).reduce((s,l)=>s+l.amount,0)
  const thisWeek = logs.filter(l=>(now-new Date(l.id))<7*msDay).reduce((s,l)=>s+l.amount,0)
  const lastWeek = logs.filter(l=>{const d=now-new Date(l.id);return d>=7*msDay&&d<14*msDay}).reduce((s,l)=>s+l.amount,0)
  const weekChange = lastWeek>0?Math.round(((thisWeek-lastWeek)/lastWeek)*100):null

  const totalBudget = Object.values(BUDGET_DEFAULTS).reduce((s,v)=>s+v,0)
  const budgetPct = totalBudget>0?Math.min(Math.round((overallTotal/totalBudget)*100),100):0

  const contextMsg = alerts.length>0 ? `⚠️ ${alerts.length} categor${alerts.length>1?'ies':'y'} over budget`
    : weekChange>10 ? '📈 High spending week — review budget'
    : weekChange!==null&&weekChange<-10 ? '📉 Great! Spending reduced this week'
    : logs.length===0 ? '🌱 Start logging to see insights'
    : '✅ Spending looks on track'

  return (
    <div style={{ borderRadius:22, padding:'20px', marginBottom:14, background:'linear-gradient(135deg,#f8f8f8 0%,#e0e0e0 40%,#f2f2f2 100%)', border:'1.5px solid rgba(255,255,255,0.95)', boxShadow:'7px 7px 18px rgba(0,0,0,0.1),-4px -4px 12px rgba(255,255,255,0.98),inset 0 1px 0 rgba(255,255,255,0.95)', backgroundImage:'linear-gradient(135deg,rgba(255,255,255,0.6) 0%,transparent 45%,rgba(0,0,0,0.02) 100%)', position:'relative', overflow:'hidden', animation:'slideUp 0.4s ease-out 0.05s both' }}>
      {/* Decorative silver orb */}
      <div style={{ position:'absolute', top:-30, right:-30, width:120, height:120, borderRadius:'50%', background:'radial-gradient(circle,rgba(255,255,255,0.7),transparent 65%)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', bottom:-20, left:-10, width:80, height:80, borderRadius:'50%', background:'radial-gradient(circle,rgba(220,220,220,0.5),transparent 65%)', pointerEvents:'none' }} />

      {/* Top row */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
        <div>
          <p style={{ fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.14em', margin:'0 0 4px', fontFamily:'Poppins,sans-serif' }}>Total Spent</p>
          <p style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:30, color:'#b8860b', margin:0, lineHeight:1 }}><CountUp value={overallTotal} /></p>
          <p style={{ fontSize:11, color:'#6b7280', margin:'5px 0 0', fontFamily:'Poppins,sans-serif' }}>{logs.length} entries total</p>
        </div>
        <div style={{ textAlign:'right' }}>
          <p style={{ fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.1em', margin:'0 0 4px', fontFamily:'Poppins,sans-serif' }}>{t.today||'Today'}</p>
          <p style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:22, color: todayTotal>0?'#d97706':'#16a34a', margin:0 }}>{fmt(todayTotal)}</p>
        </div>
      </div>

      {/* Budget progress */}
      <div style={{ marginBottom:12 }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:7 }}>
          <span style={{ fontSize:10, fontWeight:700, color:'#6b7280', fontFamily:'Poppins,sans-serif' }}>Monthly Budget Used</span>
          <span style={{ fontSize:11, fontWeight:800, color: budgetPct>80?'#dc2626':'#16a34a', fontFamily:'Poppins,sans-serif' }}>{budgetPct}%</span>
        </div>
        <div style={{ height:8, borderRadius:8, background:'linear-gradient(145deg,#d8d8d8,#efefef)', boxShadow:'inset 2px 2px 4px rgba(0,0,0,0.1),inset -1px -1px 3px rgba(255,255,255,0.9)', overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${budgetPct}%`, borderRadius:8, background: budgetPct>80?'linear-gradient(90deg,#dc2626,#ef4444)':'linear-gradient(90deg,#16a34a,#22c55e)', transition:'width 1.2s ease-out', boxShadow:'1px 0 6px rgba(0,0,0,0.1)' }} />
        </div>
      </div>

      {/* Context message + top cat */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        <span style={{ padding:'5px 13px', borderRadius:20, fontSize:11, fontWeight:700, background:'linear-gradient(145deg,#f0f0f0,#e4e4e4)', border:'1px solid #d1d5db', color:'#374151', fontFamily:'Poppins,sans-serif', boxShadow:'2px 2px 5px rgba(0,0,0,0.07),-1px -1px 3px rgba(255,255,255,0.9)' }}>{contextMsg}</span>
        {topCategory!=='—' && (
          <span style={{ padding:'5px 13px', borderRadius:20, fontSize:11, fontWeight:700, background:'linear-gradient(145deg,#faf5ff,#f3e8ff)', border:'1px solid #ddd6fe', color:'#7c3aed', fontFamily:'Poppins,sans-serif', boxShadow:'2px 2px 5px rgba(0,0,0,0.06),-1px -1px 3px rgba(255,255,255,0.9)' }}>
            {CAT_ICONS[topCategory]||'💸'} Most: {topCategory}
          </span>
        )}
      </div>
    </div>
  )
}

/* ── Habit tracker ── */
function HabitTracker({ logs }) {
  const today = new Date()
  const last7 = Array.from({length:7},(_,i)=>{
    const d = new Date(today); d.setDate(d.getDate()-6+i)
    const dayLogs = logs.filter(l=>{ const ld=new Date(l.id); return ld.getDate()===d.getDate()&&ld.getMonth()===d.getMonth() })
    return { day:d.toLocaleDateString('en-IN',{weekday:'short'}), hasLog:dayLogs.length>0, total:dayLogs.reduce((s,l)=>s+l.amount,0), isToday:i===6 }
  })
  const streak = last7.filter(d=>d.hasLog).length
  const loggedToday = last7[6].hasLog

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:20 }}>🔥</span>
          <div>
            <p style={{ fontSize:13, fontWeight:700, color:'#1a1a1a', margin:0, fontFamily:'Poppins,sans-serif' }}>{streak} Day Logging Streak</p>
            <p style={{ fontSize:10, color:'#6b7280', margin:0, fontFamily:'Poppins,sans-serif' }}>{loggedToday?'✅ Logged today — great!':'❌ Not logged today yet'}</p>
          </div>
        </div>
        <div style={{ padding:'4px 12px', borderRadius:20, background: loggedToday?'#dcfce7':'#fff1f2', border:`1px solid ${loggedToday?'#bbf7d0':'#fecdd3'}`, fontSize:11, fontWeight:700, color: loggedToday?'#16a34a':'#dc2626', fontFamily:'Poppins,sans-serif' }}>
          {loggedToday?'✓ Done':'Pending'}
        </div>
      </div>

      {/* 7-day dots */}
      <div style={{ display:'flex', gap:6, justifyContent:'space-between' }}>
        {last7.map((d,i) => (
          <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, flex:1 }}>
            <div style={{ width:'100%', height:36, borderRadius:10, background: d.hasLog?`linear-gradient(145deg,${d.isToday?'#d97706':'#7c3aed'},${d.isToday?'#f59e0b':'#6d28d9'})`:'linear-gradient(145deg,#e8e8e8,#f5f5f5)', border: d.hasLog?`1.5px solid ${d.isToday?'#fde68a':'#ddd6fe'}`:'1.5px solid #e2e8f0', boxShadow: d.hasLog?`2px 2px 6px rgba(0,0,0,0.1),-1px -1px 3px rgba(255,255,255,0.8)`:'inset 1px 1px 3px rgba(0,0,0,0.06)', display:'flex', alignItems:'center', justifyContent:'center', fontSize: d.hasLog?14:12 }}>
              {d.hasLog ? (d.isToday?'🔥':'✓') : '·'}
            </div>
            <span style={{ fontSize:8, fontWeight:700, color: d.hasLog?'#374151':'#9ca3af', fontFamily:'Poppins,sans-serif' }}>{d.day.slice(0,2)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Smart alert card ── */
function SmartAlertCard({ alert, onView }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', background:'linear-gradient(145deg,#fff1f2,#fff)', borderRadius:14, border:'1.5px solid #fca5a5', boxShadow:'3px 3px 8px rgba(220,38,38,0.07),-2px -2px 5px rgba(255,255,255,0.9)', marginBottom:9 }}>
      <div style={{ width:38, height:38, borderRadius:11, background:'#fee2e2', border:'1px solid #fca5a5', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
        {CAT_ICONS[alert.cat]||'⚠️'}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ fontSize:13, fontWeight:700, color:'#1a1a1a', margin:'0 0 2px', fontFamily:'Poppins,sans-serif' }}>{alert.cat} over budget</p>
        <p style={{ fontSize:11, color:'#dc2626', margin:0, fontWeight:600, fontFamily:'Poppins,sans-serif' }}>₹{alert.over.toLocaleString('en-IN')} over limit — reduce by {Math.ceil(alert.over/1000)*1000 > alert.over ? Math.ceil(alert.over/500)*500 : alert.over}</p>
      </div>
      <button onClick={onView} style={{ padding:'5px 12px', borderRadius:10, background:'linear-gradient(145deg,#f5f5f5,#e8e8e8)', border:'1px solid #e2e8f0', boxShadow:'2px 2px 5px rgba(0,0,0,0.07),-1px -1px 3px rgba(255,255,255,0.9)', fontSize:11, fontWeight:700, color:'#374151', cursor:'pointer', fontFamily:'Poppins,sans-serif', whiteSpace:'nowrap' }}>View →</button>
    </div>
  )
}

/* ── Quick add button ── */
function QuickAddBtn({ icon, label, color, bg, border, onClick }) {
  const [pressed, setPressed] = useState(false)
  return (
    <button onMouseDown={()=>setPressed(true)} onMouseUp={()=>setPressed(false)} onTouchStart={()=>setPressed(true)} onTouchEnd={()=>setPressed(false)} onClick={onClick}
      style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:5, padding:'12px 8px', borderRadius:14, background:`linear-gradient(145deg,${bg},#fff)`, border:`1.5px solid ${border}`, cursor:'pointer', transition:'all 0.15s', boxShadow: pressed?`inset 2px 2px 5px rgba(0,0,0,0.1),inset -1px -1px 3px rgba(255,255,255,0.8)`:`3px 3px 8px rgba(0,0,0,0.07),-2px -2px 5px rgba(255,255,255,0.9)`, transform: pressed?'scale(0.95)':'scale(1)' }}>
      <span style={{ fontSize:22 }}>{icon}</span>
      <span style={{ fontSize:10, fontWeight:700, color:color, fontFamily:'Poppins,sans-serif' }}>{label}</span>
    </button>
  )
}

/* ── AI Insight card ── */
function AIInsightCard({ icon, text, sub, color, bg, border, delay=0 }) {
  return (
    <div style={{ display:'flex', gap:10, padding:'12px 14px', background:`linear-gradient(145deg,${bg},#fff)`, borderRadius:14, border:`1.5px solid ${border}`, boxShadow:'3px 3px 8px rgba(0,0,0,0.06),-2px -2px 5px rgba(255,255,255,0.9)', animation:`slideIn 0.4s ease-out ${delay}ms both` }}>
      <div style={{ width:34, height:34, borderRadius:10, background:`${color}15`, border:`1px solid ${color}25`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>{icon}</div>
      <div>
        <p style={{ fontSize:12, fontWeight:700, color:'#1a1a1a', margin:'0 0 2px', fontFamily:'Poppins,sans-serif', lineHeight:1.4 }}>{text}</p>
        {sub && <p style={{ fontSize:10, color:'#6b7280', margin:0, fontFamily:'Poppins,sans-serif' }}>{sub}</p>}
      </div>
    </div>
  )
}

/* ── Gamification badge ── */
function Badge({ icon, label, sub, unlocked, color }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:5, padding:'12px 6px', background: unlocked?`linear-gradient(145deg,${color}10,#fff)`:'linear-gradient(145deg,#f5f5f5,#e8e8e8)', borderRadius:14, border: unlocked?`1.5px solid ${color}30`:'1.5px solid #e5e7eb', boxShadow: unlocked?`3px 3px 8px rgba(0,0,0,0.07),-2px -2px 5px rgba(255,255,255,0.9)`:'2px 2px 5px rgba(0,0,0,0.04)', opacity: unlocked?1:0.45, position:'relative', overflow:'hidden' }}>
      {unlocked && <div style={{ position:'absolute', top:0, right:0, width:8, height:8, borderRadius:'0 14px 0 8px', background:color }} />}
      <span style={{ fontSize:22, filter: unlocked?'none':'grayscale(1)' }}>{icon}</span>
      <p style={{ fontSize:9, fontWeight:700, color: unlocked?'#1a1a1a':'#9ca3af', margin:0, textAlign:'center', fontFamily:'Poppins,sans-serif', lineHeight:1.3 }}>{label}</p>
      <p style={{ fontSize:8, color: unlocked?color:'#9ca3af', margin:0, fontFamily:'Poppins,sans-serif' }}>{sub}</p>
    </div>
  )
}

/* ── Tooltip ── */
const LightTooltip = ({ active, payload, label }) => {
  if (!active||!payload?.length) return null
  return (
    <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:10, padding:'8px 13px', boxShadow:'3px 3px 10px rgba(0,0,0,0.1)' }}>
      <p style={{ color:'#6b7280', fontSize:11, marginBottom:3, fontFamily:'Poppins,sans-serif' }}>{label}</p>
      <p style={{ color:'#1a1a1a', fontWeight:800, fontSize:14, fontFamily:'Poppins,sans-serif' }}>{fmt(payload[0].value)}</p>
    </div>
  )
}

/* ── Budget bar ── */
function BudgetBar({ spent, budget, color }) {
  const pct = Math.min((spent/budget)*100, 100)
  const over = spent>budget
  return (
    <div style={{ marginBottom:4 }}>
      <div style={{ height:7, borderRadius:7, background:'linear-gradient(145deg,#e0e0e0,#f5f5f5)', boxShadow:'inset 2px 2px 4px rgba(0,0,0,0.09),inset -1px -1px 2px rgba(255,255,255,0.8)', overflow:'hidden' }}>
        <div style={{ height:'100%', borderRadius:7, width:`${pct}%`, background: over?'linear-gradient(90deg,#ef4444,#f87171)':`linear-gradient(90deg,${color},${color}bb)`, transition:'width 1s ease-out' }} />
      </div>
      {over && <p style={{ fontSize:10, color:'#dc2626', fontWeight:600, marginTop:3, fontFamily:'Poppins,sans-serif' }}>⚠ Over by {fmt(spent-budget)}</p>}
    </div>
  )
}

/* ════════════════════════════════════════
   MAIN EXPORT
════════════════════════════════════════ */
export default function Expense(props) {
  const { t } = useLanguage()
  const {
    logs, customAmount, setCustomAmount, customCategory, setCustomCategory,
    categories, addExpense, addExpenseWithMeta, deleteExpense, filteredLogs,
    searchTerm, setSearchTerm, filterCategory, setFilterCategory, overallTotal,
    expenseTab, setExpenseTab, summaryData, aiInsights, generateAIAdvice,
    isThinking, handleVoiceInput, isListening, triggerCamera, handleImageCapture, fileInputRef,
  } = props

  const [budgets, setBudgets]         = useState(BUDGET_DEFAULTS)
  const [editingBudget, setEditingBudget] = useState(null)
  const [budgetInput, setBudgetInput] = useState('')
  const [noteInput, setNoteInput]     = useState('')
  const [sortBy, setSortBy]           = useState('time')
  const [justAdded, setJustAdded]     = useState(false)
  const [deletingId, setDeletingId]   = useState(null)
  const [showMobileForm, setShowMobileForm] = useState(false)

  const categoryTotals = useMemo(() => logs.reduce((acc,l) => { acc[l.category]=(acc[l.category]||0)+l.amount; return acc }, {}), [logs])
  const topCategory    = useMemo(() => { const e=Object.entries(categoryTotals); return e.length?e.sort((a,b)=>b[1]-a[1])[0][0]:'—' }, [categoryTotals])
  const avgTransaction = logs.length?Math.round(overallTotal/logs.length):0

  const alerts = useMemo(() => Object.entries(categoryTotals).filter(([c,v])=>budgets[c]&&v>budgets[c]).map(([cat,total])=>({cat,over:total-budgets[cat]})), [categoryTotals, budgets])

  const trendData = useMemo(() => {
    const hours = Array.from({length:24},(_,i)=>({hour:`${i}h`,amount:0}))
    logs.forEach(l=>{const h=parseInt(l.time?.split(':')[0]||'0');if(!isNaN(h))hours[h].amount+=l.amount})
    return hours.filter((_,i)=>i>=6&&i<=22)
  }, [logs])

  const sortedLogs = useMemo(() => {
    const b=[...filteredLogs]
    if (sortBy==='amount') return b.sort((a,b)=>b.amount-a.amount)
    if (sortBy==='category') return b.sort((a,b)=>a.category.localeCompare(b.category))
    return b
  }, [filteredLogs, sortBy])

  // Week stats for AI insights
  const now = new Date(); const msDay=86400000
  const thisWeekTotal = useMemo(()=>logs.filter(l=>(now-new Date(l.id))<7*msDay).reduce((s,l)=>s+l.amount,0),[logs])
  const weekendTotal  = useMemo(()=>logs.filter(l=>{const d=new Date(l.id).getDay();return d===0||d===6}).reduce((s,l)=>s+l.amount,0),[logs])
  const weekdayTotal  = useMemo(()=>logs.filter(l=>{const d=new Date(l.id).getDay();return d>0&&d<6}).reduce((s,l)=>s+l.amount,0),[logs])
  const weekdayAvg    = weekdayTotal/5||0; const weekendAvg=weekendTotal/2||0

  const handleAdd = (cat=null) => {
    const amt = cat ? null : (customAmount>0?customAmount:null)
    if (cat) { setCustomCategory(cat) }
    if (!customAmount||customAmount<=0) return
    addExpenseWithMeta?addExpenseWithMeta(noteInput,[]):addExpense()
    setJustAdded(true); setNoteInput('')
    setTimeout(()=>setJustAdded(false), 900)
  }
  const quickAdd = (cat) => { setCustomCategory(cat); setShowMobileForm(true) }

  const handleDelete = (id) => { setDeletingId(id); setTimeout(()=>{deleteExpense(id);setDeletingId(null)},350) }
  const saveBudget = (cat) => { const v=parseFloat(budgetInput); if(!isNaN(v)&&v>0) setBudgets(p=>({...p,[cat]:v})); setEditingBudget(null); setBudgetInput('') }

  const exportCSV = () => {
    const rows=[['ID','Category','Amount','Time','Note']]
    logs.forEach(l=>rows.push([l.id,l.category,l.amount,l.time,l.note||'']))
    const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([rows.map(r=>r.join(',')).join('\n')],{type:'text/csv'})); a.download=`expenses_${new Date().toISOString().slice(0,10)}.csv`; a.click()
  }
  const exportJSON = () => { const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([JSON.stringify(logs,null,2)],{type:'application/json'})); a.download=`expenses_${new Date().toISOString().slice(0,10)}.json`; a.click() }
  const exportText = () => { let txt=`ACR MAX Report\n${new Date().toLocaleDateString('en-IN')}\nTotal: ${fmt(overallTotal)}\n\n`; logs.forEach(l=>{txt+=`[${l.time}] ${l.category}: ${fmt(l.amount)}${l.note?' — '+l.note:''}\n`}); const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([txt],{type:'text/plain'})); a.download=`expenses_${new Date().toISOString().slice(0,10)}.txt`; a.click() }

  const neu = { background:'linear-gradient(145deg,#f8fafc,#e8ecf0)', border:'1.5px solid #e2e8f0', borderRadius:16, padding:'12px 14px', boxShadow:'3px 3px 8px rgba(0,0,0,0.07),-2px -2px 5px rgba(255,255,255,0.9)' }
  const inputSt = { width:'100%', padding:'12px 14px', background:'linear-gradient(145deg,#e8e8e8,#ffffff)', boxShadow:'inset 3px 3px 6px rgba(0,0,0,0.09),inset -2px -2px 4px rgba(255,255,255,0.9)', border:'1.5px solid #e2e8f0', borderRadius:13, fontWeight:600, color:'#1a1a1a', fontSize:14, outline:'none', fontFamily:'Poppins,sans-serif', transition:'box-shadow 0.2s' }
  const selectSt = { padding:'11px 14px', background:'linear-gradient(145deg,#f5f5f5,#e8e8e8)', boxShadow:'3px 3px 7px rgba(0,0,0,0.07),-2px -2px 4px rgba(255,255,255,0.9)', border:'1.5px solid #e2e8f0', borderRadius:13, fontWeight:700, color:'#1a1a1a', fontSize:13, outline:'none', cursor:'pointer', fontFamily:'Poppins,sans-serif' }

  return (
    <>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=Syne:wght@700;800&display=swap');
      .exp-root *{font-family:'Poppins',sans-serif!important;}
      .exp-root .syne{font-family:'Syne',sans-serif!important;}
      @keyframes slideUp {from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
      @keyframes slideIn {from{opacity:0;transform:translateX(-12px)}to{opacity:1;transform:translateX(0)}}
      @keyframes fadeIn  {from{opacity:0}to{opacity:1}}
      @keyframes popIn   {0%{opacity:0;transform:scale(0.8)}70%{transform:scale(1.04)}100%{opacity:1;transform:scale(1)}}
      @keyframes shimBar {0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}
      @keyframes spinLoad{to{transform:rotate(360deg)}}
      @keyframes floatY  {0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
      @media(max-width:640px){
        .exp-add-form{display:none!important;}
        .exp-fab{display:flex!important;}
        .exp-tabs button{padding:9px 13px!important;font-size:11px!important;}
      }
      @media(min-width:641px){.exp-fab{display:none!important;}}
      select option{background:#ffffff!important;color:#1a1a1a!important;}
      input::placeholder{color:#9ca3af!important;}
    `}</style>

    {/* ── MOBILE FAB ── */}
    <div className="exp-fab" style={{ display:'none', position:'fixed', bottom:90, right:18, zIndex:200, flexDirection:'column', alignItems:'flex-end', gap:10 }}>
      {showMobileForm && (
        <div style={{ background:'linear-gradient(145deg,#ffffff,#f5f5f5)', border:'1px solid #e2e8f0', borderRadius:22, padding:18, width:'calc(100vw - 40px)', maxWidth:340, boxShadow:'6px 6px 20px rgba(0,0,0,0.12),-4px -4px 12px rgba(255,255,255,0.9)', animation:'slideUp 0.3s ease-out both' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <p style={{ fontFamily:'Syne,sans-serif', fontWeight:800, color:'#1a1a1a', fontSize:15, margin:0 }}>+ Add Expense</p>
            <button onClick={()=>setShowMobileForm(false)} style={{ background:'linear-gradient(145deg,#f5f5f5,#e8e8e8)', border:'1px solid #e2e8f0', borderRadius:8, color:'#6b7280', fontSize:15, cursor:'pointer', width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'2px 2px 4px rgba(0,0,0,0.08),-1px -1px 3px rgba(255,255,255,0.9)' }}>✕</button>
          </div>
          <div style={{ marginBottom:10 }}>
            <label style={{ display:'block', fontSize:9, fontWeight:700, color:'#9ca3af', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.1em' }}>{t.category||'Category'}</label>
            <select value={customCategory} onChange={e=>setCustomCategory(e.target.value)} style={{ width:'100%', ...selectSt, padding:'10px 12px' }}>
              {categories.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ marginBottom:10 }}>
            <label style={{ display:'block', fontSize:9, fontWeight:700, color:'#9ca3af', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.1em' }}>{t.amount||'Amount'} (₹)</label>
            <input type="number" value={customAmount} onChange={e=>setCustomAmount(e.target.value)} onKeyDown={e=>e.key==='Enter'&&(handleAdd(),setShowMobileForm(false))} placeholder="0.00" autoFocus style={{ width:'100%', ...inputSt, fontSize:16, fontWeight:700 }} />
          </div>
          <div style={{ marginBottom:12 }}>
            <label style={{ display:'block', fontSize:9, fontWeight:700, color:'#9ca3af', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.1em' }}>{t.note||'Note'} (optional)</label>
            <input type="text" value={noteInput} onChange={e=>setNoteInput(e.target.value)} placeholder="e.g. lunch" style={{ width:'100%', ...inputSt, fontSize:13 }} />
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={()=>{triggerCamera()}} style={{ padding:'11px 14px', borderRadius:12, fontSize:17, background:'linear-gradient(145deg,#ecfdf5,#d1fae5)', border:'1.5px solid #a7f3d0', cursor:'pointer', boxShadow:'2px 2px 5px rgba(0,0,0,0.07),-1px -1px 3px rgba(255,255,255,0.9)' }}>📷</button>
            <input type="file" accept="image/*" capture="environment" ref={fileInputRef} style={{ display:'none' }} onChange={handleImageCapture} />
            <button onClick={handleVoiceInput} disabled={isListening} style={{ padding:'11px 14px', borderRadius:12, fontSize:17, background: isListening?'linear-gradient(145deg,#ede9fe,#ddd6fe)':'linear-gradient(145deg,#faf5ff,#ede9fe)', border:`1.5px solid ${isListening?'#7c3aed':'#ddd6fe'}`, cursor:'pointer', boxShadow:'2px 2px 5px rgba(0,0,0,0.07),-1px -1px 3px rgba(255,255,255,0.9)', position:'relative' }}>
              🎤{isListening&&<span style={{ position:'absolute', top:-3, right:-3, width:8, height:8, borderRadius:'50%', background:'#7c3aed' }} />}
            </button>
            <button onClick={()=>{handleAdd();if(customAmount>0)setShowMobileForm(false)}} style={{ flex:1, padding:'11px', borderRadius:12, border:'none', background: justAdded?'linear-gradient(135deg,#16a34a,#22c55e)':'linear-gradient(135deg,#7c3aed,#4f46e5)', color:'#fff', fontFamily:'Poppins,sans-serif', fontWeight:700, fontSize:14, cursor:'pointer', boxShadow:'3px 3px 10px rgba(124,58,237,0.25),-1px -1px 3px rgba(255,255,255,0.5)' }}>
              {justAdded?'✓ Added!':'+ Add'}
            </button>
          </div>
        </div>
      )}
      <button onClick={()=>setShowMobileForm(s=>!s)} style={{ width:56, height:56, borderRadius:'50%', border:'1px solid rgba(255,255,255,0.8)', background:'linear-gradient(135deg,#7c3aed,#4f46e5)', color:'#fff', fontSize:24, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'4px 4px 14px rgba(124,58,237,0.3),-2px -2px 6px rgba(255,255,255,0.7)', transition:'all 0.2s', transform:showMobileForm?'rotate(45deg)':'rotate(0)' }}>+</button>
    </div>

    <div className="exp-root" style={{ maxWidth:900, margin:'0 auto', paddingBottom:100, color:'#1a1a1a', position:'relative', background:'transparent' }}>

      {/* ── HEADER ── */}
      <div style={{ marginBottom:16, animation:'slideUp 0.4s ease-out both' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <img src="/logo.jpg" alt="" style={{ width:42, height:42, borderRadius:'50%', objectFit:'cover', border:'2px solid #e2e8f0', boxShadow:'3px 3px 8px rgba(0,0,0,0.1),-2px -2px 5px rgba(255,255,255,0.9)', flexShrink:0 }} />
            <div>
              <h2 className="syne" style={{ fontFamily:'Syne,sans-serif', fontSize:20, fontWeight:800, margin:'0 0 1px', color:'#1a1a1a' }}>💰 Expenses</h2>
              <p style={{ fontSize:11, color:'#6b7280', margin:0, fontWeight:500 }}>{new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}</p>
            </div>
          </div>
          {alerts.length>0 && (
            <div style={{ background:'linear-gradient(145deg,#fff1f2,#fee2e2)', border:'1.5px solid #fca5a5', color:'#dc2626', padding:'6px 12px', borderRadius:10, fontSize:12, fontWeight:700, display:'flex', alignItems:'center', gap:5, boxShadow:'2px 2px 6px rgba(220,38,38,0.1),-1px -1px 3px rgba(255,255,255,0.9)' }}>
              🚨 {alerts.length} Alert{alerts.length>1?'s':''}
            </div>
          )}
        </div>
      </div>

      {/* ── DYNAMIC SUMMARY CARD ── */}
      <SummaryCard overallTotal={overallTotal} logs={logs} alerts={alerts} topCategory={topCategory} categoryTotals={categoryTotals} avgTransaction={avgTransaction} />

      {/* ── TABS ── */}
      <div className="exp-tabs" style={{ display:'flex', gap:7, marginBottom:16, overflowX:'auto', paddingBottom:4, scrollbarWidth:'none' }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={()=>setExpenseTab(tab.id)} style={{
            padding:'10px 18px', borderRadius:12, fontWeight:700, fontSize:12, whiteSpace:'nowrap', cursor:'pointer', transition:'all 0.2s', fontFamily:'Poppins,sans-serif',
            background: expenseTab===tab.id?'linear-gradient(145deg,#f0f0f0,#e4e4e4)':'linear-gradient(145deg,#ffffff,#f5f5f5)',
            border: expenseTab===tab.id?'1.5px solid #d1d5db':'1.5px solid #e8e8e8',
            color: expenseTab===tab.id?'#1a1a1a':'#6b7280',
            borderBottom: expenseTab===tab.id?'2.5px solid #7c3aed':undefined,
            boxShadow: expenseTab===tab.id?'inset 2px 2px 5px rgba(0,0,0,0.08),inset -1px -1px 3px rgba(255,255,255,0.8)':'3px 3px 7px rgba(0,0,0,0.07),-2px -2px 5px rgba(255,255,255,0.9)',
          }}>{tab.label}</button>
        ))}
      </div>

      {/* ════════ LOGS TAB ════════ */}
      {expenseTab==='daily' && (
        <div>
          {/* Habit tracker */}
          <NeuCard style={{ marginBottom:14 }} accent="#d97706">
            <SectionHdr title="Daily Streak" accent="#d97706" />
            <HabitTracker logs={logs} />
          </NeuCard>

          {/* Quick add shortcuts */}
          <NeuCard style={{ marginBottom:14 }} accent="#7c3aed">
            <SectionHdr title="Quick Add" accent="#7c3aed" />
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:14 }}>
              {[
                {icon:'🍽',label:'Food',      color:'#d97706',bg:'#fffbeb',border:'#fde68a',cat:'Food'},
                {icon:'⚡',label:'Bills',     color:'#d97706',bg:'#fef9c3',border:'#fde68a',cat:'Electricity Bill'},
                {icon:'🛒',label:'Groceries', color:'#16a34a',bg:'#f0fdf4',border:'#bbf7d0',cat:'Groceries'},
                {icon:'⛽',label:'Petrol',    color:'#1d4ed8',bg:'#eff6ff',border:'#bfdbfe',cat:'Petrol'},
                {icon:'📱',label:'Recharge',  color:'#0891b2',bg:'#f0f9ff',border:'#bae6fd',cat:'Mobile Recharge'},
                {icon:'🍺',label:'Liquor',    color:'#7c3aed',bg:'#faf5ff',border:'#ddd6fe',cat:'Liquor'},
                {icon:'🏪',label:'CSD',       color:'#6d28d9',bg:'#faf5ff',border:'#ddd6fe',cat:'CSD'},
                {icon:'💸',label:'Other',     color:'#475569',bg:'#f8fafc',border:'#e2e8f0',cat:'Other'},
              ].map((q,i)=>(
                <QuickAddBtn key={i} {...q} onClick={()=>quickAdd(q.cat)} />
              ))}
            </div>
            <p style={{ fontSize:10, color:'#9ca3af', textAlign:'center', margin:0, fontWeight:500 }}>Tap to pre-select category, then set amount</p>
          </NeuCard>

          {/* Smart alerts */}
          {alerts.length>0 && (
            <NeuCard style={{ marginBottom:14 }} accent="#dc2626">
              <SectionHdr title="Budget Alerts" accent="#dc2626" />
              {alerts.map(a=><SmartAlertCard key={a.cat} alert={a} onView={()=>setExpenseTab('budget')} />)}
            </NeuCard>
          )}

          {/* AI Insights */}
          {logs.length>=3 && (
            <NeuCard style={{ marginBottom:14 }} accent="#7c3aed">
              <SectionHdr title="AI Insights" accent="#7c3aed" />
              <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
                {topCategory!=='—' && <AIInsightCard icon="💡" text={`You spend most on ${topCategory}`} sub={`${overallTotal>0?Math.round((categoryTotals[topCategory]/overallTotal)*100):0}% of total — ${fmt(categoryTotals[topCategory])}`} color="#7c3aed" bg="#faf5ff" border="#ddd6fe" delay={0} />}
                {weekendAvg>weekdayAvg*1.3 && <AIInsightCard icon="📅" text="You spend more on weekends" sub={`Weekend avg: ${fmt(weekendAvg)} vs Weekday avg: ${fmt(weekdayAvg)}`} color="#d97706" bg="#fffbeb" border="#fde68a" delay={60} />}
                {avgTransaction>0 && <AIInsightCard icon="📊" text={`Average spend ₹${avgTransaction.toLocaleString('en-IN')} per entry`} sub={avgTransaction>1000?'High avg — try splitting large expenses into categories':'Healthy transaction size'} color="#0891b2" bg="#f0f9ff" border="#bae6fd" delay={120} />}
                {alerts.length>0 && <AIInsightCard icon="🎯" text={`${alerts.length} budget limit${alerts.length>1?'s':''} exceeded this period`} sub="Review budgets in the Budgets tab to set realistic limits" color="#dc2626" bg="#fff1f2" border="#fecdd3" delay={180} />}
              </div>
            </NeuCard>
          )}

          {/* Badges */}
          <NeuCard style={{ marginBottom:14 }}>
            <SectionHdr title="Achievements" accent="#d97706" />
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
              <Badge icon="🌱" label="First Log"    sub="Logged 1+"  unlocked={logs.length>=1}   color="#16a34a" />
              <Badge icon="🔥" label="3-Day Habit"  sub="3 days"     unlocked={logs.length>=3}   color="#d97706" />
              <Badge icon="⚡" label="Power User"   sub="10+ entries" unlocked={logs.length>=10}  color="#7c3aed" />
              <Badge icon="🏆" label="Super Saver"  sub="20+ entries" unlocked={logs.length>=20}  color="#0891b2" />
            </div>
          </NeuCard>

          {/* Desktop add form */}
          <div className="exp-add-form" style={{ ...neu, borderTop:'3px solid #7c3aed', marginBottom:14, animation:'slideUp 0.45s ease-out 0.1s both' }}>
            <SectionHdr title="Add Expense" accent="#7c3aed" />
            <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:12 }}>
              <div style={{ flex:'1 1 130px' }}>
                <label style={{ display:'block', fontSize:9, fontWeight:700, color:'#9ca3af', marginBottom:7, textTransform:'uppercase', letterSpacing:'0.1em' }}>{t.category||'Category'}</label>
                <select value={customCategory} onChange={e=>setCustomCategory(e.target.value)} style={selectSt}>{categories.map(c=><option key={c} value={c}>{c}</option>)}</select>
              </div>
              <div style={{ flex:'1 1 110px' }}>
                <label style={{ display:'block', fontSize:9, fontWeight:700, color:'#9ca3af', marginBottom:7, textTransform:'uppercase', letterSpacing:'0.1em' }}>Amount</label>
                <input type="number" value={customAmount} onChange={e=>setCustomAmount(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleAdd()} style={inputSt} placeholder="₹ 0.00" />
              </div>
              <div style={{ flex:'1 1 130px' }}>
                <label style={{ display:'block', fontSize:9, fontWeight:700, color:'#9ca3af', marginBottom:7, textTransform:'uppercase', letterSpacing:'0.1em' }}>Note</label>
                <input type="text" value={noteInput} onChange={e=>setNoteInput(e.target.value)} style={inputSt} placeholder="optional…" />
              </div>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={triggerCamera} style={{ padding:'11px 15px', borderRadius:13, fontSize:18, background:'linear-gradient(145deg,#ecfdf5,#d1fae5)', border:'1.5px solid #a7f3d0', cursor:'pointer', boxShadow:'2px 2px 5px rgba(0,0,0,0.07),-1px -1px 3px rgba(255,255,255,0.9)' }}>📷</button>
              <input type="file" accept="image/*" capture="environment" ref={fileInputRef} style={{ display:'none' }} onChange={handleImageCapture} />
              <button onClick={handleVoiceInput} disabled={isListening} style={{ padding:'11px 15px', borderRadius:13, fontSize:18, background: isListening?'linear-gradient(145deg,#ede9fe,#ddd6fe)':'linear-gradient(145deg,#faf5ff,#ede9fe)', border:`1.5px solid ${isListening?'#7c3aed':'#ddd6fe'}`, cursor:'pointer', boxShadow:'2px 2px 5px rgba(0,0,0,0.07),-1px -1px 3px rgba(255,255,255,0.9)' }}>🎤</button>
              <button onClick={handleAdd} style={{ flex:1, padding:'12px', borderRadius:13, border:'none', cursor:'pointer', fontWeight:700, fontSize:14, color:'#fff', background: justAdded?'linear-gradient(135deg,#16a34a,#22c55e)':'linear-gradient(135deg,#7c3aed,#4f46e5)', boxShadow:'3px 3px 10px rgba(124,58,237,0.25)', transition:'all 0.25s' }}>
                {justAdded?'✓ Added!':t.addExpense||'+ Add Expense'}
              </button>
            </div>
          </div>

          {/* Filters */}
          <div style={{ display:'flex', gap:10, marginBottom:12, flexWrap:'wrap' }}>
            <div style={{ position:'relative', flex:1, minWidth:160 }}>
              <span style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', fontSize:13, color:'#9ca3af', pointerEvents:'none' }}>🔍</span>
              <input type="text" placeholder="Search…" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} style={{ ...inputSt, paddingLeft:36, fontSize:13 }} />
            </div>
            <select value={filterCategory} onChange={e=>setFilterCategory(e.target.value)} style={selectSt}>
              <option value="All">All Categories</option>
              {categories.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
            <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={selectSt}>
              <option value="time">Latest</option>
              <option value="amount">Highest</option>
              <option value="category">A–Z</option>
            </select>
          </div>

          {/* Timeline activity feed */}
          {sortedLogs.length>0 && (
            <NeuCard>
              <SectionHdr title="Activity Timeline" accent="#7c3aed" />
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {sortedLogs.length===0 ? (
                  <div style={{ textAlign:'center', padding:'40px 0', color:'#9ca3af' }}>
                    <div style={{ fontSize:48, marginBottom:12, animation:'floatY 4s ease-in-out infinite' }}>💸</div>
                    <p style={{ fontWeight:700, fontSize:14, color:'#374151' }}>{t.noExpenses||t.noExpenses||'No expenses yet'}</p>
                    <p style={{ fontSize:12, marginTop:4, color:'#9ca3af' }}>Add your first expense above!</p>
                  </div>
                ) : sortedLogs.map((log,i) => (
                  <div key={log.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 13px', background: i%2===0?'linear-gradient(145deg,#f8f8f8,#f0f0f0)':'linear-gradient(145deg,#ffffff,#f5f5f5)', borderRadius:13, border:'1px solid #f1f1f1', boxShadow:'2px 2px 5px rgba(0,0,0,0.05),-1px -1px 3px rgba(255,255,255,0.9)', animation:`slideIn 0.3s ease-out ${i*35}ms both`, opacity:deletingId===log.id?0:1, transition:'opacity 0.3s' }}>
                    {/* Timeline dot */}
                    <div style={{ width:6, height:6, borderRadius:'50%', background:CAT_COLORS[log.category]||'#7c3aed', flexShrink:0, boxShadow:`0 0 0 3px ${(CAT_COLORS[log.category]||'#7c3aed')}20` }} />
                    {/* Icon */}
                    <div style={{ width:34, height:34, borderRadius:10, background:`${CAT_COLORS[log.category]||'#7c3aed'}15`, border:`1px solid ${CAT_COLORS[log.category]||'#7c3aed'}25`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>
                      {CAT_ICONS[log.category]||'💸'}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontWeight:700, fontSize:13, color:'#1a1a1a', margin:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                        {log.category}{log.note?` · ${log.note}`:''}
                      </p>
                      <p style={{ fontSize:10, color:'#9ca3af', margin:'2px 0 0' }}>
                        {log.time} · {new Date(log.id).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}
                      </p>
                    </div>
                    <p style={{ fontWeight:800, fontSize:14, color:'#b8860b', margin:0, flexShrink:0 }}>{fmt(log.amount)}</p>
                    <button onClick={()=>handleDelete(log.id)} style={{ background:'transparent', border:'none', color:'#d1d5db', fontSize:14, cursor:'pointer', borderRadius:6, padding:'4px 5px', transition:'all 0.2s' }} onMouseEnter={e=>{e.target.style.color='#dc2626';e.target.style.background='#fee2e2'}} onMouseLeave={e=>{e.target.style.color='#d1d5db';e.target.style.background='transparent'}}>🗑</button>
                  </div>
                ))}
              </div>
            </NeuCard>
          )}
        </div>
      )}

      {/* ════════ ANALYTICS ════════ */}
      {expenseTab==='summary' && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:14 }}>
            {['bar','pie'].map((type,ci)=>(
              <NeuCard key={type} style={{ animation:`slideUp 0.4s ease-out ${ci*100}ms both` }}>
                <SectionHdr title={type==='bar'?'Spend by Category':'Distribution'} accent="#7c3aed" />
                {summaryData.length===0
                  ? <div style={{ height:220, display:'flex', alignItems:'center', justifyContent:'center', color:'#9ca3af', fontSize:40 }}>📊</div>
                  : type==='bar'?(
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={summaryData} margin={{top:4,right:4,left:0,bottom:4}}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill:'#9ca3af',fontFamily:'Poppins',fontSize:11}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill:'#9ca3af',fontFamily:'Poppins',fontSize:11}} />
                        <Tooltip content={<LightTooltip />} />
                        <Bar dataKey="total" radius={[8,8,0,0]}>{summaryData.map((e,i)=><Cell key={i} fill={e.color} />)}</Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ):(
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={summaryData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} dataKey="total" paddingAngle={3}>
                          {summaryData.map((e,i)=><Cell key={i} fill={e.color} />)}
                        </Pie>
                        <Tooltip content={<LightTooltip />} />
                        <Legend iconType="circle" iconSize={8} formatter={v=><span style={{color:'#6b7280',fontSize:11,fontFamily:'Poppins'}}>{v}</span>} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
              </NeuCard>
            ))}
          </div>
          <NeuCard>
            <SectionHdr title="Category Breakdown" accent="#7c3aed" right={<span style={{ fontSize:12, color:'#9ca3af', fontWeight:600 }}>{summaryData?.length||0} categories</span>} />
            <table style={{ width:'100%', fontSize:13, borderCollapse:'separate', borderSpacing:'0 4px' }}>
              <thead><tr style={{ color:'#9ca3af', fontSize:10, textTransform:'uppercase', letterSpacing:'0.08em' }}>
                {['Category','Spent','Budget','Entries','% Total'].map(h=><th key={h} style={{ textAlign:h==='Category'?'left':'right', paddingBottom:12, fontWeight:700, fontFamily:'Poppins,sans-serif' }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {summaryData.map((row,i)=>{
                  const count=logs.filter(l=>l.category===row.name).length
                  const pct=overallTotal?((row.total/overallTotal)*100).toFixed(1):0
                  const over=budgets[row.name]&&row.total>budgets[row.name]
                  return (
                    <tr key={i} style={{ animation:`slideIn 0.35s ease-out ${i*40}ms both` }}>
                      <td style={{ padding:'10px 8px', fontWeight:700, color:'#1a1a1a', background:'linear-gradient(145deg,#f8f8f8,#f0f0f0)', borderRadius:'8px 0 0 8px', borderLeft:`3px solid ${row.color}` }}>
                        <span style={{ display:'flex', alignItems:'center', gap:8 }}><span style={{ fontSize:16 }}>{CAT_ICONS[row.name]||'💸'}</span>{row.name}</span>
                      </td>
                      <td style={{ padding:'10px 8px', textAlign:'right', fontWeight:800, color:over?'#dc2626':'#b8860b', background:'linear-gradient(145deg,#f8f8f8,#f0f0f0)' }}>{fmt(row.total)}</td>
                      <td style={{ padding:'10px 8px', textAlign:'right', color:'#6b7280', background:'linear-gradient(145deg,#f8f8f8,#f0f0f0)' }}>{budgets[row.name]?fmt(budgets[row.name]):'—'}</td>
                      <td style={{ padding:'10px 8px', textAlign:'right', color:'#6b7280', background:'linear-gradient(145deg,#f8f8f8,#f0f0f0)' }}>{count}</td>
                      <td style={{ padding:'10px 8px', textAlign:'right', background:'linear-gradient(145deg,#f8f8f8,#f0f0f0)', borderRadius:'0 8px 8px 0' }}>
                        <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700, background:`${row.color}15`, color:row.color }}>{pct}%</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot><tr>
                <td style={{ paddingTop:14, fontWeight:800, color:'#1a1a1a', fontFamily:'Syne,sans-serif' }}>{t.total||'Total'}</td>
                <td style={{ paddingTop:14, textAlign:'right', fontWeight:800, fontSize:15, color:'#b8860b', fontFamily:'Syne,sans-serif' }}>{fmt(overallTotal)}</td>
                <td colSpan={3} />
              </tr></tfoot>
            </table>
          </NeuCard>
        </div>
      )}

      {/* ════════ BUDGETS ════════ */}
      {expenseTab==='budget' && (
        <div>
          <div style={{ padding:'13px 16px', background:'linear-gradient(145deg,#faf5ff,#f3e8ff)', border:'1.5px solid #ddd6fe', borderRadius:14, marginBottom:14, display:'flex', gap:10, boxShadow:'3px 3px 8px rgba(124,58,237,0.07),-2px -2px 5px rgba(255,255,255,0.9)' }}>
            <span style={{ fontSize:20 }}>🎯</span>
            <div>
              <p style={{ fontWeight:700, color:'#7c3aed', fontSize:13, margin:0, fontFamily:'Poppins,sans-serif' }}>Budget Goals</p>
              <p style={{ color:'#9ca3af', fontSize:11, marginTop:2, fontFamily:'Poppins,sans-serif' }}>Tap any category to set your monthly limit.</p>
            </div>
          </div>
          <NeuCard>
            {categories.map((cat,i) => {
              const spent=categoryTotals[cat]||0; const budget=budgets[cat]||0
              const color=summaryData.find(s=>s.name===cat)?.color||'#7c3aed'
              return (
                <div key={cat} style={{ marginBottom:16, animation:`slideIn 0.35s ease-out ${i*40}ms both` }}>
                  {editingBudget===cat ? (
                    <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:8 }}>
                      <span style={{ flex:1, fontWeight:700, color:'#1a1a1a', fontSize:13, fontFamily:'Poppins,sans-serif' }}>{CAT_ICONS[cat]||'💸'} {cat}</span>
                      <input type="number" value={budgetInput} onChange={e=>setBudgetInput(e.target.value)} autoFocus onKeyDown={e=>e.key==='Enter'&&saveBudget(cat)} style={{ width:120, padding:'8px 12px', background:'linear-gradient(145deg,#e8e8e8,#fff)', boxShadow:'inset 2px 2px 4px rgba(0,0,0,0.09)', border:'1.5px solid #e2e8f0', borderRadius:10, color:'#1a1a1a', fontSize:13, fontWeight:700, outline:'none', fontFamily:'Poppins,sans-serif' }} placeholder="₹ budget" />
                      <button onClick={()=>saveBudget(cat)} style={{ background:'linear-gradient(135deg,#7c3aed,#4f46e5)', border:'none', color:'#fff', padding:'8px 14px', borderRadius:10, fontSize:12, fontWeight:700, cursor:'pointer', boxShadow:'2px 2px 6px rgba(124,58,237,0.25)', fontFamily:'Poppins,sans-serif' }}>{t.add||'Save'}</button>
                      <button onClick={()=>setEditingBudget(null)} style={{ background:'none', border:'none', color:'#9ca3af', cursor:'pointer', fontSize:16 }}>✕</button>
                    </div>
                  ) : (
                    <div onClick={()=>{setEditingBudget(cat);setBudgetInput(budget||'')}} style={{ display:'flex', justifyContent:'space-between', marginBottom:7, cursor:'pointer' }}>
                      <span style={{ fontSize:13, fontWeight:700, color:'#1a1a1a', fontFamily:'Poppins,sans-serif' }}>{CAT_ICONS[cat]||'💸'} {cat}</span>
                      <span style={{ fontSize:11, fontWeight:700, color:'#6b7280', fontFamily:'Poppins,sans-serif' }}>{budget?`${fmt(spent)} / ${fmt(budget)}`:'✏ Tap to set'}</span>
                    </div>
                  )}
                  {budget>0 ? <BudgetBar spent={spent} budget={budget} color={color} /> : <div style={{ height:7, background:'linear-gradient(145deg,#e0e0e0,#f5f5f5)', borderRadius:7, boxShadow:'inset 1px 1px 3px rgba(0,0,0,0.08)', marginBottom:4 }} />}
                </div>
              )
            })}
          </NeuCard>
        </div>
      )}

      {/* ════════ TRENDS ════════ */}
      {expenseTab==='trends' && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <NeuCard>
            <SectionHdr title="Hourly Spend Today" accent="#7c3aed" />
            <p style={{ fontSize:11, color:'#9ca3af', marginBottom:16, fontFamily:'Poppins,sans-serif' }}>How your money flowed through the day</p>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={trendData} margin={{top:4,right:4,left:0,bottom:4}}>
                <defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#7c3aed" stopOpacity={0.2}/><stop offset="95%" stopColor="#7c3aed" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{fill:'#9ca3af',fontSize:11,fontFamily:'Poppins'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill:'#9ca3af',fontSize:11,fontFamily:'Poppins'}} />
                <Tooltip content={<LightTooltip />} />
                <Area type="monotone" dataKey="amount" stroke="#7c3aed" strokeWidth={2.5} fill="url(#ag)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </NeuCard>
          <NeuCard>
            <SectionHdr title="Category Comparison" accent="#7c3aed" />
            {summaryData.length===0
              ? <div style={{ height:220, display:'flex', alignItems:'center', justifyContent:'center', color:'#9ca3af', fontSize:40 }}>📊</div>
              : <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={summaryData} layout="vertical" margin={{top:4,right:60,left:70,bottom:4}}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{fill:'#9ca3af',fontSize:11,fontFamily:'Poppins'}} />
                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{fill:'#374151',fontWeight:700,fontSize:12,fontFamily:'Poppins'}} width={70} />
                    <Tooltip content={<LightTooltip />} />
                    <Bar dataKey="total" radius={[0,8,8,0]}>{summaryData.map((e,i)=><Cell key={i} fill={e.color} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>}
          </NeuCard>
        </div>
      )}

      {/* ════════ AI BRAIN ════════ */}
      {expenseTab==='ai' && (
        <NeuCard>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:22 }}>
            <div>
              <h3 className="syne" style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:22, margin:0, color:'#1a1a1a' }}>🧠 ACR MAX Brain</h3>
              <p style={{ color:'#9ca3af', fontSize:11, marginTop:4, fontFamily:'Poppins,sans-serif' }}>Powered by Gemini AI</p>
            </div>
            <button onClick={generateAIAdvice} disabled={isThinking} style={{ padding:'10px 20px', borderRadius:13, fontWeight:700, fontFamily:'Poppins,sans-serif', fontSize:13, background: isThinking?'linear-gradient(145deg,#f5f5f5,#e8e8e8)':'linear-gradient(135deg,#7c3aed,#4f46e5)', border: isThinking?'1.5px solid #e2e8f0':'none', color: isThinking?'#9ca3af':'#fff', cursor: isThinking?'not-allowed':'pointer', boxShadow: isThinking?'3px 3px 7px rgba(0,0,0,0.07),-2px -2px 5px rgba(255,255,255,0.9)':'3px 3px 10px rgba(124,58,237,0.25)', transition:'all 0.2s' }}>
              {isThinking?<><div style={{ width:14, height:14, border:'2px solid #d1d5db', borderTop:'2px solid #7c3aed', borderRadius:'50%', animation:'spinLoad 0.7s linear infinite', display:'inline-block', marginRight:7 }} />Analyzing…</>:'✨ Generate Insights'}
            </button>
          </div>
          {aiInsights.length===0 ? (
            <div style={{ textAlign:'center', padding:'32px 0' }}>
              <div style={{ fontSize:48, marginBottom:12, animation:'floatY 4s ease-in-out infinite' }}>🧠</div>
              <p style={{ color:'#9ca3af', fontSize:14, fontWeight:600, fontFamily:'Poppins,sans-serif' }}>Generate your personalized financial analysis</p>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:12 }}>
              {[{icon:'📊',title:'Observation',color:'#1d4ed8',bg:'#eff6ff',border:'#bfdbfe'},{icon:'⚠️',title:'Projection',color:'#d97706',bg:'#fffbeb',border:'#fde68a'},{icon:'💡',title:'Action',color:'#16a34a',bg:'#f0fdf4',border:'#bbf7d0'}].map((card,i)=>aiInsights[i]&&(
                <div key={i} style={{ padding:'18px', borderRadius:16, background:`linear-gradient(145deg,${card.bg},#fff)`, border:`1.5px solid ${card.border}`, borderTop:`3px solid ${card.color}`, boxShadow:'3px 3px 8px rgba(0,0,0,0.06),-2px -2px 5px rgba(255,255,255,0.9)', animation:`popIn 0.5s cubic-bezier(.34,1.56,.64,1) ${i*100}ms both` }}>
                  <div style={{ fontSize:20, marginBottom:10 }}>{card.icon}</div>
                  <p style={{ fontWeight:800, fontSize:10, textTransform:'uppercase', letterSpacing:'0.1em', color:card.color, marginBottom:8, fontFamily:'Poppins,sans-serif' }}>{card.title}</p>
                  <p style={{ color:'#374151', fontSize:13, lineHeight:1.65, margin:0, fontFamily:'Poppins,sans-serif' }}>{aiInsights[i].replace(/-/g,'')}</p>
                </div>
              ))}
            </div>
          )}
        </NeuCard>
      )}

      {/* ════════ EXPORT ════════ */}
      {expenseTab==='export' && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <NeuCard>
            <SectionHdr title="Export Data" accent="#7c3aed" />
            <p style={{ color:'#9ca3af', fontSize:12, marginBottom:18, fontFamily:'Poppins,sans-serif' }}>Download all {logs.length} entries in your preferred format.</p>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:12 }}>
              {[{label:'CSV',desc:'Excel & Sheets',icon:'📊',action:exportCSV,color:'#16a34a',bg:'#f0fdf4',border:'#bbf7d0'},{label:'JSON',desc:'Raw data',icon:'🔧',action:exportJSON,color:'#1d4ed8',bg:'#eff6ff',border:'#bfdbfe'},{label:'Text',desc:'Readable report',icon:'📄',action:exportText,color:'#d97706',bg:'#fffbeb',border:'#fde68a'}].map((item,i)=>(
                <button key={item.label} onClick={item.action} disabled={logs.length===0}
                  style={{ padding:'20px 16px', borderRadius:16, textAlign:'left', cursor:logs.length===0?'not-allowed':'pointer', background:`linear-gradient(145deg,${item.bg},#fff)`, border:`1.5px solid ${item.border}`, opacity:logs.length===0?0.4:1, transition:'all 0.2s', boxShadow:'3px 3px 8px rgba(0,0,0,0.06),-2px -2px 5px rgba(255,255,255,0.9)' }}
                  onMouseEnter={e=>{if(logs.length)e.currentTarget.style.transform='translateY(-3px)'}}
                  onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)'}}>
                  <div style={{ fontSize:26, marginBottom:10 }}>{item.icon}</div>
                  <p className="syne" style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:14, color:item.color, marginBottom:3 }}>Export {item.label}</p>
                  <p style={{ fontSize:11, color:'#9ca3af', margin:0, fontFamily:'Poppins,sans-serif' }}>{item.desc}</p>
                </button>
              ))}
            </div>
          </NeuCard>
          {logs.length>0 && (
            <NeuCard>
              <SectionHdr title="Report Preview" accent="#7c3aed" />
              <div style={{ fontFamily:'monospace', fontSize:12, color:'#374151' }}>
                <p style={{ marginBottom:4 }}>Date: {new Date().toLocaleDateString('en-IN')}</p>
                <p style={{ marginBottom:4 }}>Total Entries: {logs.length}</p>
                <p style={{ color:'#16a34a', marginBottom:4, fontWeight:700 }}>Total Spend: {fmt(overallTotal)}</p>
                <p style={{ marginBottom:8 }}>Avg per Entry: {fmt(avgTransaction)}</p>
                <div style={{ borderTop:'1px solid #e5e7eb', paddingTop:8 }}>
                  {summaryData.slice(0,5).map(r=>(
                    <div key={r.name} style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                      <span style={{ fontWeight:700, color:'#374151' }}>{CAT_ICONS[r.name]||'💸'} {r.name}</span>
                      <span style={{ color:r.color, fontWeight:700 }}>{fmt(r.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </NeuCard>
          )}
        </div>
      )}

    </div>
    </>
  )
}