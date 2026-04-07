import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend, AreaChart, Area
} from 'recharts'
import { useState, useMemo, useEffect, useRef } from 'react'

const fmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`

const BUDGET_DEFAULTS = {
  Food: 2000, Petrol: 1500, Smoke: 500, Liquor: 1000,
  'Electricity Bill': 2000, 'Water Bill': 500, 'Mobile Recharge': 300,
  Groceries: 3000, CSD: 1000, 'Hotel Food': 1500, Other: 1000
}

/* ── Particle burst ─────────────────────────────────────────────────────────── */
function ParticleBurst({ trigger }) {
  const [particles, setParticles] = useState([])
  useEffect(() => {
    if (!trigger) return
    const p = Array.from({ length: 16 }, (_, i) => ({
      id: Date.now() + i,
      angle: (360 / 16) * i,
      color: ['#a78bfa','#34d399','#f472b6','#fbbf24','#60a5fa'][i % 5],
      size: 5 + Math.random() * 5,
      dist: 50 + Math.random() * 50,
    }))
    setParticles(p)
    setTimeout(() => setParticles([]), 900)
  }, [trigger])

  if (!particles.length) return null
  return (
    <div style={{ pointerEvents:'none', position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', zIndex:50 }}>
      {particles.map(p => (
        <div key={p.id} style={{
          position:'absolute', width:p.size, height:p.size, borderRadius:'50%',
          background:p.color, boxShadow:`0 0 8px ${p.color}`,
          transform:`rotate(${p.angle}deg) translateY(-${p.dist}px)`,
          animation:'particleFly 0.8s ease-out forwards',
        }} />
      ))}
    </div>
  )
}

/* ── Animated counter ───────────────────────────────────────────────────────── */
function AnimatedNumber({ value }) {
  const [display, setDisplay] = useState(0)
  const raf = useRef(null)
  useEffect(() => {
    const start = display; const end = Number(value)
    if (start === end) return
    const dur = 700; const t0 = performance.now()
    const step = (now) => {
      const p = Math.min((now - t0) / dur, 1)
      const e = 1 - Math.pow(1 - p, 3)
      setDisplay(Math.round(start + (end - start) * e))
      if (p < 1) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf.current)
  }, [value])
  return <span>₹{display.toLocaleString('en-IN')}</span>
}

/* ── Stat card ──────────────────────────────────────────────────────────────── */
function GlassCard({ label, value, sub, accent, icon, delay = 0 }) {
  return (
    <div className="exp-stat-card" style={{
      position:'relative', overflow:'hidden', borderRadius:20, padding:'18px 20px',
      background:'linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))',
      border:`1px solid rgba(255,255,255,0.09)`,
      borderTop:`2px solid ${accent}`,
      boxShadow:'0 8px 32px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,255,255,0.08)',
      animation:`slideUp 0.5s ease-out ${delay}ms both`,
    }}>
      <div style={{ position:'absolute', top:-20, right:-20, width:80, height:80, borderRadius:'50%', background:accent, opacity:0.12, filter:'blur(22px)', pointerEvents:'none' }} />
      <div style={{ position:'relative', zIndex:1 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
          <p className="stat-label" style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:'rgba(255,255,255,0.35)', margin:0 }}>{label}</p>
          <span className="stat-icon" style={{ fontSize:18 }}>{icon}</span>
        </div>
        <p className="stat-value" style={{ fontSize:22, fontWeight:800, color:'#fff', margin:'0 0 4px', fontFamily:'Syne,sans-serif' }}>{value}</p>
        {sub && <p className="stat-sub" style={{ fontSize:11, color:'rgba(255,255,255,0.3)', margin:0 }}>{sub}</p>}
      </div>
    </div>
  )
}

/* ── Budget bar ─────────────────────────────────────────────────────────────── */
function BudgetBar({ spent, budget, color }) {
  const pct = Math.min((spent / budget) * 100, 100)
  const over = spent > budget
  return (
    <div style={{ marginBottom:4 }}>
      <div style={{ height:6, borderRadius:6, background:'rgba(255,255,255,0.07)', overflow:'hidden' }}>
        <div style={{
          height:'100%', borderRadius:6, width:`${pct}%`,
          background: over ? 'linear-gradient(90deg,#ef4444,#f87171)' : `linear-gradient(90deg,${color},${color}bb)`,
          boxShadow:`0 0 10px ${over ? '#ef444450' : color+'50'}`,
          transition:'width 1s ease-out',
          position:'relative', overflow:'hidden',
        }}>
          <div style={{
            position:'absolute', inset:0,
            background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)',
            animation:'shimmerBar 1.8s infinite',
          }} />
        </div>
      </div>
      {over && <p style={{ fontSize:11, color:'#f87171', fontWeight:600, marginTop:3 }}>⚠ Over by {fmt(spent - budget)}</p>}
    </div>
  )
}

/* ── Dark tooltip ───────────────────────────────────────────────────────────── */
const DarkTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'rgba(10,8,30,0.97)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:12, padding:'10px 14px', boxShadow:'0 8px 32px rgba(0,0,0,0.6)' }}>
      <p style={{ color:'rgba(255,255,255,0.4)', fontSize:11, marginBottom:4 }}>{label}</p>
      <p style={{ color:'#fff', fontWeight:800, fontSize:15, fontFamily:'Syne,sans-serif' }}>{fmt(payload[0].value)}</p>
    </div>
  )
}

const TABS = [
  { id:'daily', label:'📝 Logs' },
  { id:'summary', label:'📊 Analytics' },
  { id:'budget', label:'🎯 Budgets' },
  { id:'trends', label:'📈 Trends' },
  { id:'ai', label:'🤖 AI Brain' },
  { id:'export', label:'⬇ Export' },
]

/* ─────────────────────────────────────────────────────────────────────────── */
export default function Expense(props) {
  const {
    logs, customAmount, setCustomAmount, customCategory, setCustomCategory,
    categories, addExpense, addExpenseWithMeta, deleteExpense, filteredLogs,
    searchTerm, setSearchTerm, filterCategory, setFilterCategory, overallTotal,
    expenseTab, setExpenseTab, summaryData, aiInsights, generateAIAdvice,
    isThinking, handleVoiceInput, isListening, triggerCamera, handleImageCapture, fileInputRef,
  } = props

  const [budgets, setBudgets] = useState(BUDGET_DEFAULTS)
  const [editingBudget, setEditingBudget] = useState(null)
  const [budgetInput, setBudgetInput] = useState('')
  const [noteInput, setNoteInput] = useState('')
  const [selectedTags, setSelectedTags] = useState([])
  const [tagInput, setTagInput] = useState('')
  const [sortBy, setSortBy] = useState('time')
  const [burstTrigger, setBurstTrigger] = useState(0)
  const [justAdded, setJustAdded] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [showMobileForm, setShowMobileForm] = useState(false)

  const categoryTotals = useMemo(() =>
    logs.reduce((acc, l) => { acc[l.category] = (acc[l.category] || 0) + l.amount; return acc }, {}), [logs])

  const topCategory = useMemo(() => {
    const e = Object.entries(categoryTotals)
    return e.length ? e.sort((a, b) => b[1] - a[1])[0][0] : '—'
  }, [categoryTotals])

  const avgTransaction = logs.length ? Math.round(overallTotal / logs.length) : 0

  const alerts = useMemo(() =>
    Object.entries(categoryTotals)
      .filter(([c, t]) => budgets[c] && t > budgets[c])
      .map(([cat, total]) => ({ cat, over: total - budgets[cat] })),
    [categoryTotals, budgets])

  const trendData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({ hour: `${i}h`, amount: 0 }))
    logs.forEach(l => { const h = parseInt(l.time?.split(':')[0] || '0'); if (!isNaN(h)) hours[h].amount += l.amount })
    return hours.filter((_, i) => i >= 6 && i <= 22)
  }, [logs])

  const allTags = useMemo(() => {
    const t = new Set(); logs.forEach(l => (l.tags || []).forEach(x => t.add(x))); return [...t]
  }, [logs])

  const sortedLogs = useMemo(() => {
    const b = [...filteredLogs]
    if (sortBy === 'amount') return b.sort((a, b) => b.amount - a.amount)
    if (sortBy === 'category') return b.sort((a, b) => a.category.localeCompare(b.category))
    return b
  }, [filteredLogs, sortBy])

  const handleAdd = () => {
    if (!customAmount || customAmount <= 0) return
    addExpenseWithMeta ? addExpenseWithMeta(noteInput, selectedTags) : addExpense()
    setBurstTrigger(t => t + 1)
    setJustAdded(true)
    setNoteInput(''); setSelectedTags([])
    setTimeout(() => setJustAdded(false), 900)
  }

  const handleDelete = (id) => {
    setDeletingId(id)
    setTimeout(() => { deleteExpense(id); setDeletingId(null) }, 350)
  }

  const exportCSV = () => {
    const rows = [['ID','Category','Amount','Time','Note','Tags']]
    logs.forEach(l => rows.push([l.id, l.category, l.amount, l.time, l.note || '', (l.tags || []).join(';')]))
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' }))
    a.download = `expenses_${new Date().toISOString().slice(0, 10)}.csv`; a.click()
  }
  const exportJSON = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' }))
    a.download = `expenses_${new Date().toISOString().slice(0, 10)}.json`; a.click()
  }
  const exportText = () => {
    let t = `ACR MAX Report\n${new Date().toLocaleDateString('en-IN')}\nTotal: ${fmt(overallTotal)}\n\n`
    logs.forEach(l => { t += `[${l.time}] ${l.category}: ${fmt(l.amount)}${l.note ? ' — ' + l.note : ''}\n` })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([t], { type: 'text/plain' }))
    a.download = `expenses_${new Date().toISOString().slice(0, 10)}.txt`; a.click()
  }

  const saveBudget = (cat) => {
    const v = parseFloat(budgetInput)
    if (!isNaN(v) && v > 0) setBudgets(p => ({ ...p, [cat]: v }))
    setEditingBudget(null); setBudgetInput('')
  }

  /* shared style objects */
  const inputSt = {
    width: '100%', padding: '12px 14px',
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 14, fontWeight: 600, color: '#fff',
    fontSize: 14, outline: 'none', fontFamily: 'DM Sans,sans-serif',
  }
  const selectSt = {
    padding: '11px 14px',
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 14, fontWeight: 700, color: '#fff',
    fontSize: 13, outline: 'none', cursor: 'pointer',
    fontFamily: 'DM Sans,sans-serif',
  }
  const panelSt = {
    background: 'linear-gradient(135deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))',
    border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: 20,
    padding: 24,
    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
  }

  /* ── RENDER ─────────────────────────────────────────────────────────────── */
  return (
    <>
    <style>{`
      @media(max-width:640px){
        .exp-stat-grid{grid-template-columns:repeat(2,1fr)!important;gap:6px!important;}
        .exp-stat-card{padding:12px 14px!important;border-radius:14px!important;}
        .exp-stat-card .stat-label{font-size:9px!important;}
        .exp-stat-card .stat-value{font-size:16px!important;}
        .exp-stat-card .stat-sub{font-size:10px!important;}
        .exp-stat-card .stat-icon{font-size:14px!important;}
        .exp-tabs{gap:5px!important;}
        .exp-tabs button{padding:6px 9px!important;font-size:10px!important;border-radius:10px!important;}
        .exp-add-form{display:none!important;}
        .exp-fab{display:flex!important;}
        .exp-header h2{font-size:22px!important;}
        .exp-header p{font-size:11px!important;}
      }
      @media(min-width:641px){.exp-fab{display:none!important;}}
    `}</style>

    {/* MOBILE FLOATING ADD BUTTON */}
    <div className="exp-fab" style={{ display:'none', position:'fixed', bottom:90, right:18, zIndex:200, flexDirection:'column', alignItems:'flex-end', gap:10 }}>
      {showMobileForm && (
        <div style={{ background:'linear-gradient(135deg,rgba(15,10,40,0.98),rgba(8,5,24,0.98))', border:'1px solid rgba(167,139,250,0.45)', borderRadius:22, padding:18, width:'calc(100vw - 40px)', maxWidth:340, boxShadow:'0 20px 60px rgba(0,0,0,0.6)', animation:'slideUp 0.3s ease-out both' }}>
          {/* Header */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <p style={{ fontFamily:'Syne,sans-serif', fontWeight:800, color:'#fff', fontSize:15, margin:0 }}>➕ Add Expense</p>
            <button onClick={()=>setShowMobileForm(false)} style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:8, color:'rgba(255,255,255,0.5)', fontSize:16, cursor:'pointer', width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
          </div>

          {/* Category */}
          <div style={{ marginBottom:10 }}>
            <label style={{ display:'block', fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.3)', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.1em' }}>Category</label>
            <select value={customCategory} onChange={e=>setCustomCategory(e.target.value)} style={{ width:'100%', padding:'10px 12px', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:10, color:'#fff', fontSize:13, outline:'none', fontFamily:'DM Sans,sans-serif' }}>
              {categories.map(c => <option key={c} value={c} style={{ background:'#1a1535' }}>{c}</option>)}
            </select>
          </div>

          {/* Amount */}
          <div style={{ marginBottom:10 }}>
            <label style={{ display:'block', fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.3)', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.1em' }}>Amount (₹)</label>
            <input type="number" value={customAmount} onChange={e=>setCustomAmount(e.target.value)} onKeyDown={e=>e.key==='Enter'&&(handleAdd(),setShowMobileForm(false))} placeholder="0.00" autoFocus
              style={{ width:'100%', padding:'10px 12px', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:10, color:'#fff', fontSize:15, fontWeight:700, outline:'none', fontFamily:'DM Sans,sans-serif' }} />
          </div>

          {/* Note */}
          <div style={{ marginBottom:12 }}>
            <label style={{ display:'block', fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.3)', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.1em' }}>Note (optional)</label>
            <input type="text" value={noteInput} onChange={e=>setNoteInput(e.target.value)} placeholder="e.g. lunch"
              style={{ width:'100%', padding:'9px 12px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, color:'#fff', fontSize:13, outline:'none', fontFamily:'DM Sans,sans-serif' }} />
          </div>

          {/* Voice + Camera + Add row */}
          <div style={{ display:'flex', gap:8 }}>
            {/* Camera */}
            <button onClick={()=>{triggerCamera();}} title="Scan Receipt"
              style={{ padding:'11px 14px', borderRadius:12, fontSize:18, background:'rgba(52,211,153,0.12)', border:'1px solid rgba(52,211,153,0.25)', cursor:'pointer' }}>📷</button>
            <input type="file" accept="image/*" capture="environment" ref={fileInputRef} style={{ display:'none' }} onChange={handleImageCapture} />

            {/* Voice */}
            <button onClick={handleVoiceInput} disabled={isListening}
              style={{ padding:'11px 14px', borderRadius:12, fontSize:18, position:'relative', cursor:'pointer',
                background: isListening?'rgba(167,139,250,0.28)':'rgba(167,139,250,0.12)',
                border:`1px solid ${isListening?'rgba(167,139,250,0.7)':'rgba(167,139,250,0.25)'}`,
                animation: isListening?'glowPulse2 1s infinite':'none' }}>
              🎤
              {isListening && <span style={{ position:'absolute', top:-3, right:-3, width:8, height:8, borderRadius:'50%', background:'#a78bfa' }} />}
            </button>

            {/* Add */}
            <button onClick={()=>{ handleAdd(); if(customAmount>0) setShowMobileForm(false) }}
              style={{ flex:1, padding:'11px', borderRadius:12, border:'none',
                background:justAdded?'linear-gradient(135deg,#34d399,#059669)':'linear-gradient(135deg,#7c3aed,#4f46e5)',
                color:'#fff', fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:14, cursor:'pointer',
                boxShadow:justAdded?'0 4px 20px rgba(52,211,153,0.4)':'0 4px 20px rgba(124,58,237,0.4)',
                transition:'all 0.3s' }}>
              {justAdded ? '✓ Added!' : '+ Add'}
            </button>
          </div>
        </div>
      )}
      <button onClick={()=>setShowMobileForm(s=>!s)}
        style={{ width:58, height:58, borderRadius:'50%', border:'none', background:'linear-gradient(135deg,#7c3aed,#4f46e5)', color:'#fff', fontSize:26, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 6px 24px rgba(124,58,237,0.55)', transition:'all 0.25s', transform:showMobileForm?'rotate(45deg)':'rotate(0deg)' }}>
        +
      </button>
    </div>

    <div style={{ maxWidth: 900, margin: '0 auto', paddingBottom: 100, color: '#f1f5f9', fontFamily: 'DM Sans,sans-serif', position: 'relative' }}>

      {/* floating blobs */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        {[
          { top: '5%', left: '60%', size: 400, color: 'rgba(99,102,241,0.12)', dur: '9s' },
          { top: '50%', left: '-8%', size: 300, color: 'rgba(52,211,153,0.08)', dur: '12s' },
          { top: '30%', right: '-5%', size: 260, color: 'rgba(244,114,182,0.07)', dur: '10s' },
        ].map((b, i) => (
          <div key={i} style={{
            position: 'absolute', borderRadius: '50%',
            top: b.top, left: b.left, right: b.right,
            width: b.size, height: b.size,
            background: `radial-gradient(circle,${b.color},transparent 70%)`,
            animation: `floatY ${b.dur} ease-in-out infinite`,
            animationDelay: `${i * 2}s`,
          }} />
        ))}
      </div>

      {/* ── HEADER ── */}
      <div style={{ position: 'relative', zIndex: 10, marginBottom: 16, animation: 'slideUp 0.5s ease-out both' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/logo.jpg" alt="ACR MAX" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid rgba(167,139,250,0.4)' }} />
            <div>
              <h2 style={{ fontFamily: 'Syne,sans-serif', fontSize: 20, fontWeight: 800, margin: 0, lineHeight: 1, background: 'linear-gradient(135deg,#fff 20%,#a78bfa 60%,#34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>💰 Expenses</h2>
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, margin: 0, fontWeight: 500 }}>{new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
            </div>
          </div>
          {alerts.length > 0 && (
            <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#fca5a5', padding: '5px 10px', borderRadius: 10, fontSize: 11, fontWeight: 700, animation: 'glowPulse2 2s infinite', flexShrink: 0 }}>🚨 {alerts.length}</div>
          )}
        </div>
      </div>

      {/* ── STAT CARDS ── */}
      <div className='exp-stat-grid' style={{ position: 'relative', zIndex: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(155px,1fr))', gap: 12, marginBottom: 24 }}>
        <GlassCard label="Total Spent"   value={<AnimatedNumber value={overallTotal} />}  sub={`${logs.length} entries`} accent="#a78bfa" icon="💸" delay={0} />
        <GlassCard label="Avg / Entry"   value={<AnimatedNumber value={avgTransaction} />} sub="per transaction"         accent="#34d399" icon="📐" delay={60} />
        <GlassCard label="Top Category"  value={topCategory}                               sub={categoryTotals[topCategory] ? fmt(categoryTotals[topCategory]) : 'No data'} accent="#f472b6" icon="🏆" delay={120} />
        <GlassCard label="Budget Status" value={alerts.length === 0 ? '✅ Safe' : `⚠ ${alerts.length} Over`} sub="vs your goals" accent={alerts.length ? '#ef4444' : '#34d399'} icon="🎯" delay={180} />
      </div>

      {/* ── TABS ── */}
      <div className='exp-tabs' style={{ position: 'relative', zIndex: 10, display: 'flex', gap: 8, marginBottom: 24, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
        {TABS.map((t, i) => (
          <button key={t.id} onClick={() => setExpenseTab(t.id)}
            className={`btn-hover ${expenseTab === t.id ? 'tab-active' : ''}`}
            style={{
              padding: '10px 18px', borderRadius: 12, fontWeight: 700, fontSize: 13,
              whiteSpace: 'nowrap', cursor: 'pointer', transition: 'all 0.2s',
              background: expenseTab === t.id ? 'linear-gradient(135deg,#7c3aed,#4f46e5)' : 'rgba(255,255,255,0.06)',
              border: expenseTab === t.id ? '1px solid rgba(167,139,250,0.5)' : '1px solid rgba(255,255,255,0.09)',
              color: expenseTab === t.id ? '#fff' : 'rgba(255,255,255,0.45)',
              boxShadow: expenseTab === t.id ? '0 4px 20px rgba(124,58,237,0.45)' : 'none',
              fontFamily: 'DM Sans,sans-serif',
              animation: `slideUp 0.4s ease-out ${i * 50}ms both`,
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ════════════ DAILY LOGS ════════════ */}
      {expenseTab === 'daily' && (
        <div style={{ position: 'relative', zIndex: 10 }}>

          {alerts.length > 0 && (
            <div style={{ background: 'rgba(239,68,68,0.09)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 16, padding: '14px 18px', marginBottom: 16 }}>
              {alerts.map(a => <p key={a.cat} style={{ color: '#fca5a5', fontSize: 13, fontWeight: 600, margin: '2px 0' }}>🚨 <b>{a.cat}</b> over budget by <b>{fmt(a.over)}</b></p>)}
            </div>
          )}

          {/* ADD FORM */}
          <div className='exp-add-form' style={{ ...panelSt, position: 'relative', borderTop: '2px solid rgba(167,139,250,0.4)', marginBottom: 16, animation: 'slideUp 0.45s ease-out 0.1s both' }}>
            <ParticleBurst trigger={burstTrigger} />

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
              <div style={{ flex: '1 1 130px' }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Category</label>
                <select value={customCategory} onChange={e => setCustomCategory(e.target.value)} style={inputSt}>
                  {categories.map(c => <option key={c} value={c} style={{ background: '#1a1535' }}>{c}</option>)}
                </select>
              </div>
              <div style={{ flex: '1 1 110px' }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Amount</label>
                <input type="number" value={customAmount} onChange={e => setCustomAmount(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()} style={inputSt} placeholder="₹ 0.00" />
              </div>
              <div style={{ flex: '1 1 130px' }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Note</label>
                <input type="text" value={noteInput} onChange={e => setNoteInput(e.target.value)} style={inputSt} placeholder="optional note…" />
              </div>
            </div>

            {/* Tags */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              {['urgent', 'recurring', 'work', 'personal', 'weekend'].map(tag => (
                <button key={tag} onClick={() => setSelectedTags(p => p.includes(tag) ? p.filter(t => t !== tag) : [...p, tag])}
                  style={{
                    padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
                    background: selectedTags.includes(tag) ? 'rgba(167,139,250,0.22)' : 'rgba(255,255,255,0.05)',
                    border: selectedTags.includes(tag) ? '1px solid rgba(167,139,250,0.6)' : '1px solid rgba(255,255,255,0.1)',
                    color: selectedTags.includes(tag) ? '#c4b5fd' : 'rgba(255,255,255,0.35)',
                    fontFamily: 'DM Sans,sans-serif',
                  }}>#{tag}</button>
              ))}
              <input type="text" value={tagInput} onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && tagInput.trim()) { setSelectedTags(p => [...p, tagInput.trim().toLowerCase()]); setTagInput('') } }}
                placeholder="+ custom"
                style={{ width: 90, padding: '5px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: 'transparent', border: '1px dashed rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.4)', outline: 'none', fontFamily: 'DM Sans,sans-serif' }} />
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={triggerCamera} title="Scan Receipt" style={{ padding: '12px 15px', borderRadius: 14, fontSize: 20, background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)', cursor: 'pointer', transition: 'all 0.2s' }}>📷</button>
              <input type="file" accept="image/*" capture="environment" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImageCapture} />

              <button onClick={handleVoiceInput} disabled={isListening} style={{
                padding: '12px 15px', borderRadius: 14, fontSize: 20, position: 'relative', cursor: 'pointer', transition: 'all 0.2s',
                background: isListening ? 'rgba(167,139,250,0.28)' : 'rgba(167,139,250,0.12)',
                border: `1px solid ${isListening ? 'rgba(167,139,250,0.7)' : 'rgba(167,139,250,0.25)'}`,
                animation: isListening ? 'glowPulse2 1s infinite' : 'none',
              }}>
                🎤
                {isListening && <span style={{ position: 'absolute', top: -3, right: -3, width: 9, height: 9, borderRadius: '50%', background: '#a78bfa', animation: 'addSuccess 1s infinite' }} />}
              </button>

              <button onClick={handleAdd} style={{
                flex: 1, padding: '12px', borderRadius: 14, border: 'none', cursor: 'pointer',
                fontSize: 15, fontWeight: 800, fontFamily: 'Syne,sans-serif',
                color: '#fff',
                background: justAdded ? 'linear-gradient(135deg,#34d399,#059669)' : 'linear-gradient(135deg,#7c3aed,#4f46e5)',
                boxShadow: justAdded ? '0 4px 24px rgba(52,211,153,0.55)' : '0 4px 24px rgba(124,58,237,0.5)',
                transition: 'background 0.4s,box-shadow 0.3s',
                animation: justAdded ? 'popIn 0.4s ease-out' : 'none',
              }}>
                {justAdded ? '✓ Added!' : '+ Add Expense'}
              </button>
            </div>
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 160 }}>
              <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'rgba(255,255,255,0.25)', pointerEvents: 'none' }}>🔍</span>
              <input type="text" placeholder="Search…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                style={{ ...inputSt, paddingLeft: 36 }} />
            </div>
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={selectSt}>
              <option value="All" style={{ background: '#1a1535' }}>All Categories</option>
              {categories.map(c => <option key={c} value={c} style={{ background: '#1a1535' }}>{c}</option>)}
            </select>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={selectSt}>
              <option value="time" style={{ background: '#1a1535' }}>Latest</option>
              <option value="amount" style={{ background: '#1a1535' }}>Highest</option>
              <option value="category" style={{ background: '#1a1535' }}>A–Z</option>
            </select>
          </div>

          {allTags.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {allTags.map(t => (
                <button key={t} onClick={() => setSelectedTags(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t])}
                  style={{
                    padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
                    background: selectedTags.includes(t) ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.04)',
                    border: selectedTags.includes(t) ? '1px solid rgba(167,139,250,0.4)' : '1px solid rgba(255,255,255,0.08)',
                    color: selectedTags.includes(t) ? '#c4b5fd' : 'rgba(255,255,255,0.28)',
                    fontFamily: 'DM Sans,sans-serif',
                  }}>#{t}</button>
              ))}
            </div>
          )}

          {/* Expense list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sortedLogs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '64px 20px', color: 'rgba(255,255,255,0.18)', animation: 'slideUp 0.4s ease-out both' }}>
                <div style={{ fontSize: 52, marginBottom: 12, animation: 'floatY 4s ease-in-out infinite' }}>💸</div>
                <p style={{ fontWeight: 700, fontSize: 15 }}>{logs.length === 0 ? 'No expenses yet' : 'No results found'}</p>
                <p style={{ fontSize: 12, marginTop: 4, color: 'rgba(255,255,255,0.15)' }}>{logs.length === 0 ? 'Add your first expense above!' : 'Try a different filter'}</p>
              </div>
            ) : sortedLogs.map((log, i) => (
              <div key={log.id}
                className={`card-lift ${deletingId === log.id ? 'log-exit' : 'log-enter'} ${i === 0 && justAdded ? 'just-added-anim' : ''}`}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 14px',
                  background: 'linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))',
                  borderRadius: 14,
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderLeft: `3px solid ${log.color}`,
                  animationDelay: `${i * 35}ms`,
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: `${log.color}20`, border: `1px solid ${log.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 16 }}>{log.category === 'Food' ? '🍽' : log.category === 'Petrol' ? '⛽' : log.category === 'Smoke' ? '🚬' : log.category === 'Liquor' ? '🍺' : log.category === 'Groceries' ? '🛒' : log.category === 'Mobile Recharge' ? '📱' : log.category === 'Hotel Food' ? '🏨' : log.category === 'Electricity Bill' ? '⚡' : log.category === 'Water Bill' ? '💧' : '💸'}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: 13, color: '#fff', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.category}{log.note ? ` · ${log.note}` : ''}</p>
                    <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', margin: '1px 0 0' }}>
                      {log.time} · {new Date(log.id).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      {(log.tags||[]).slice(0,1).map(t => <span key={t} style={{ marginLeft: 4, color: '#c4b5fd' }}>#{t}</span>)}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <span style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 14, color: log.color }}>{fmt(log.amount)}</span>
                  <button onClick={() => handleDelete(log.id)}
                    style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.2)', fontSize: 14, cursor: 'pointer', borderRadius: 6, padding: '3px 5px', transition: 'all 0.2s' }}
                    onMouseEnter={e => { e.target.style.color = '#f87171'; e.target.style.background = 'rgba(239,68,68,0.12)' }}
                    onMouseLeave={e => { e.target.style.color = 'rgba(255,255,255,0.2)'; e.target.style.background = 'transparent' }}>🗑</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ════════════ ANALYTICS ════════════ */}
      {expenseTab === 'summary' && (
        <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 20 }}>
            {['bar', 'pie'].map((type, ci) => (
              <div key={type} style={{ ...panelSt, animation: `slideUp 0.4s ease-out ${ci * 100}ms both` }}>
                <p style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, color: '#fff', marginBottom: 16, fontSize: 15 }}>
                  {type === 'bar' ? 'Spend by Category' : 'Distribution'}
                </p>
                {summaryData.length === 0
                  ? <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.12)', fontSize: 48 }}>📊</div>
                  : type === 'bar' ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={summaryData} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.35)', fontWeight: 700, fontSize: 11 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }} />
                        <Tooltip content={<DarkTooltip />} />
                        <Bar dataKey="total" radius={[8, 8, 0, 0]}>
                          {summaryData.map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie data={summaryData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="total" nameKey="name" paddingAngle={3}>
                          {summaryData.map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Pie>
                        <Tooltip content={<DarkTooltip />} />
                        <Legend iconType="circle" iconSize={8} formatter={v => <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{v}</span>} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
              </div>
            ))}
          </div>

          <div style={{ ...panelSt, animation: 'slideUp 0.4s ease-out 0.2s both' }}>
            <p style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, color: '#fff', marginBottom: 18, fontSize: 15 }}>Category Breakdown</p>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'separate', borderSpacing: '0 3px' }}>
              <thead>
                <tr style={{ color: 'rgba(255,255,255,0.28)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {['Category', 'Spent', 'Budget', 'Entries', '% Total'].map(h => (
                    <th key={h} style={{ textAlign: h === 'Category' ? 'left' : 'right', paddingBottom: 14, fontWeight: 700 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summaryData.map((row, i) => {
                  const count = logs.filter(l => l.category === row.name).length
                  const pct = overallTotal ? ((row.total / overallTotal) * 100).toFixed(1) : 0
                  const over = budgets[row.name] && row.total > budgets[row.name]
                  return (
                    <tr key={i} style={{ animation: `slideIn 0.35s ease-out ${i * 40}ms both` }}>
                      <td style={{ padding: '10px 8px', fontWeight: 700, color: '#fff', background: 'rgba(255,255,255,0.03)', borderRadius: '8px 0 0 8px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: row.color, boxShadow: `0 0 6px ${row.color}`, display: 'inline-block' }} />
                          {row.name}
                        </span>
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 800, color: over ? '#f87171' : '#fff', background: 'rgba(255,255,255,0.03)' }}>{fmt(row.total)}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.03)' }}>{budgets[row.name] ? fmt(budgets[row.name]) : '—'}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.03)' }}>{count}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', background: 'rgba(255,255,255,0.03)', borderRadius: '0 8px 8px 0' }}>
                        <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: 'rgba(167,139,250,0.12)', color: '#c4b5fd' }}>{pct}%</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td style={{ paddingTop: 16, fontWeight: 800, color: '#fff', fontFamily: 'Syne,sans-serif' }}>Total</td>
                  <td style={{ paddingTop: 16, textAlign: 'right', fontWeight: 800, fontSize: 16, color: '#a78bfa', fontFamily: 'Syne,sans-serif' }}>{fmt(overallTotal)}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ════════════ BUDGETS ════════════ */}
      {expenseTab === 'budget' && (
        <div style={{ position: 'relative', zIndex: 10 }}>
          <div style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 16, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, animation: 'slideUp 0.4s ease-out both' }}>
            <span style={{ fontSize: 22 }}>🎯</span>
            <div>
              <p style={{ fontWeight: 700, color: '#c4b5fd', fontSize: 13, margin: 0 }}>Budget Goals</p>
              <p style={{ color: 'rgba(196,181,253,0.5)', fontSize: 12, marginTop: 2 }}>Tap any category to set your daily limit.</p>
            </div>
          </div>
          <div style={{ ...panelSt, animation: 'slideUp 0.4s ease-out 0.1s both' }}>
            {categories.map((cat, i) => {
              const spent = categoryTotals[cat] || 0
              const budget = budgets[cat] || 0
              const color = summaryData.find(s => s.name === cat)?.color || '#7c3aed'
              return (
                <div key={cat} style={{ animation: `slideIn 0.35s ease-out ${i * 40}ms both` }}>
                  {editingBudget === cat ? (
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ flex: 1, fontWeight: 700, color: '#fff', fontSize: 14 }}>{cat}</span>
                      <input type="number" value={budgetInput} onChange={e => setBudgetInput(e.target.value)} autoFocus onKeyDown={e => e.key === 'Enter' && saveBudget(cat)}
                        style={{ width: 130, padding: '8px 12px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(167,139,250,0.4)', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, outline: 'none', fontFamily: 'DM Sans,sans-serif' }} placeholder="₹ budget" />
                      <button onClick={() => saveBudget(cat)} style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', border: 'none', color: '#fff', padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans,sans-serif' }}>Save</button>
                      <button onClick={() => setEditingBudget(null)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 16 }}>✕</button>
                    </div>
                  ) : (
                    <div onClick={() => { setEditingBudget(cat); setBudgetInput(budget || '') }}
                      style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, cursor: 'pointer' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.75)' }}>{cat}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.35)' }}>{budget ? `${fmt(spent)} / ${fmt(budget)}` : '✏ Tap to set'}</span>
                    </div>
                  )}
                  {budget > 0
                    ? <BudgetBar spent={spent} budget={budget} color={color} />
                    : <div style={{ height: 5, background: 'rgba(255,255,255,0.05)', borderRadius: 5, marginBottom: 18 }} />
                  }
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ════════════ TRENDS ════════════ */}
      {expenseTab === 'trends' && (
        <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ ...panelSt, animation: 'slideUp 0.4s ease-out both' }}>
            <p style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, color: '#fff', marginBottom: 4, fontSize: 15 }}>Hourly Spend Today</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)', marginBottom: 20 }}>How your money flowed through the day</p>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={trendData} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
                <defs>
                  <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} />
                <Tooltip content={<DarkTooltip />} />
                <Area type="monotone" dataKey="amount" stroke="#a78bfa" strokeWidth={2.5} fill="url(#ag)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div style={{ ...panelSt, animation: 'slideUp 0.4s ease-out 0.1s both' }}>
            <p style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, color: '#fff', marginBottom: 20, fontSize: 15 }}>Category Comparison</p>
            {summaryData.length === 0
              ? <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.12)', fontSize: 48 }}>📊</div>
              : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={summaryData} layout="vertical" margin={{ top: 4, right: 60, left: 70, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.04)" />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.65)', fontWeight: 700, fontSize: 12 }} width={70} />
                    <Tooltip content={<DarkTooltip />} />
                    <Bar dataKey="total" radius={[0, 8, 8, 0]}>
                      {summaryData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
          </div>
        </div>
      )}

      {/* ════════════ AI BRAIN ════════════ */}
      {expenseTab === 'ai' && (
        <div style={{
          position: 'relative', zIndex: 10,
          background: 'linear-gradient(135deg,rgba(99,102,241,0.11),rgba(167,139,250,0.07),rgba(52,211,153,0.05))',
          border: '1px solid rgba(167,139,250,0.2)', borderRadius: 24, padding: 32,
          animation: 'slideUp 0.4s ease-out both',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
            <div>
              <h3 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 28, margin: 0, background: 'linear-gradient(135deg,#a78bfa,#34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>ACR MAX Brain</h3>
              <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, marginTop: 5 }}>Powered by Gemini AI</p>
            </div>
            <button onClick={generateAIAdvice} disabled={isThinking} style={{
              padding: '11px 22px', borderRadius: 14, fontWeight: 800, fontFamily: 'Syne,sans-serif', fontSize: 14,
              background: isThinking ? 'rgba(167,139,250,0.15)' : 'linear-gradient(135deg,#7c3aed,#4f46e5)',
              border: '1px solid rgba(167,139,250,0.25)',
              color: isThinking ? 'rgba(255,255,255,0.35)' : '#fff',
              cursor: isThinking ? 'not-allowed' : 'pointer',
              boxShadow: isThinking ? 'none' : '0 4px 22px rgba(124,58,237,0.45)',
              transition: 'all 0.3s',
            }}>
              {isThinking ? '🧠 Analyzing…' : '✨ Generate'}
            </button>
          </div>
          {aiInsights.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 0' }}>
              <div style={{ fontSize: 52, marginBottom: 14, animation: 'floatY 4s ease-in-out infinite' }}>🧠</div>
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 15, fontWeight: 500 }}>Generate your personalized financial projection</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16 }}>
              {[{ icon: '📊', title: 'Observation', color: '#60a5fa' }, { icon: '⚠️', title: 'Projection', color: '#fbbf24' }, { icon: '💡', title: 'Action', color: '#34d399' }].map((card, i) => aiInsights[i] && (
                <div key={i} style={{
                  background: `linear-gradient(135deg,${card.color}12,rgba(255,255,255,0.03))`,
                  border: `1px solid ${card.color}25`,
                  borderTop: `2px solid ${card.color}`,
                  borderRadius: 18, padding: 20,
                  animation: `popIn 0.5s cubic-bezier(.34,1.56,.64,1) ${i * 100}ms both`,
                }}>
                  <div style={{ fontSize: 22, marginBottom: 10 }}>{card.icon}</div>
                  <p style={{ fontWeight: 800, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: card.color, marginBottom: 8 }}>{card.title}</p>
                  <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 1.65, margin: 0 }}>{aiInsights[i].replace(/-/g, '')}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════════════ EXPORT ════════════ */}
      {expenseTab === 'export' && (
        <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ ...panelSt, animation: 'slideUp 0.4s ease-out both' }}>
            <p style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, color: '#fff', fontSize: 18, marginBottom: 4 }}>Export Data</p>
            <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: 13, marginBottom: 22 }}>Download all {logs.length} entries.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14 }}>
              {[
                { label: 'CSV', desc: 'Excel / Google Sheets', icon: '📊', action: exportCSV, color: '#34d399' },
                { label: 'JSON', desc: 'Raw data for devs', icon: '🔧', action: exportJSON, color: '#60a5fa' },
                { label: 'Text', desc: 'Plain readable report', icon: '📄', action: exportText, color: '#fbbf24' },
              ].map((item, i) => (
                <button key={item.label} onClick={item.action} disabled={logs.length === 0}
                  style={{
                    padding: '22px 18px', borderRadius: 18, textAlign: 'left', cursor: logs.length === 0 ? 'not-allowed' : 'pointer',
                    background: `linear-gradient(135deg,${item.color}12,rgba(255,255,255,0.03))`,
                    border: `1px solid ${item.color}28`,
                    opacity: logs.length === 0 ? 0.4 : 1,
                    transition: 'all 0.25s',
                    fontFamily: 'DM Sans,sans-serif',
                    animation: `slideUp 0.4s ease-out ${i * 80}ms both`,
                  }}
                  onMouseEnter={e => { if (logs.length) e.currentTarget.style.transform = 'translateY(-4px)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}>
                  <div style={{ fontSize: 28, marginBottom: 12 }}>{item.icon}</div>
                  <p style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 15, color: item.color, marginBottom: 4 }}>Export {item.label}</p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)', margin: 0 }}>{item.desc}</p>
                </button>
              ))}
            </div>
          </div>
          {logs.length > 0 && (
            <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 20, fontFamily: 'monospace', fontSize: 12, color: 'rgba(255,255,255,0.38)', animation: 'slideUp 0.4s ease-out 0.25s both' }}>
              <p style={{ color: '#a78bfa', fontWeight: 700, marginBottom: 12, fontSize: 13 }}>📋 Report Preview</p>
              <p>Date: {new Date().toLocaleDateString('en-IN')}</p>
              <p>Total Entries: {logs.length}</p>
              <p style={{ color: '#34d399' }}>Total Spend: {fmt(overallTotal)}</p>
              <p>Top Category: {topCategory}</p>
              <p>Avg per Entry: {fmt(avgTransaction)}</p>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', margin: '12px 0' }} />
              {summaryData.slice(0, 5).map(r => (
                <div key={r.name} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#fff', fontWeight: 700 }}>{r.name}</span>
                  <span>{fmt(r.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>

    </>
  )
}