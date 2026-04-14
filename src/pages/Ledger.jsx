import { useState, useEffect, useMemo, useRef } from 'react'
import { db } from '../firebase'
import { doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore'

const fmt = (n) => `₹${Math.abs(Number(n)).toLocaleString('en-IN')}`
const TODAY = () => new Date().toISOString().slice(0, 10)
const DAYS_LEFT = (due) => {
  if (!due) return null
  return Math.ceil((new Date(due) - new Date()) / 86400000)
}

/* ── Firestore sync ── */
function useLedger(username) {
  const [entries, setEntries] = useState([])
  const [loaded, setLoaded] = useState(false)
  const skipSave = useRef(false)
  const saveTimer = useRef(null)

  useEffect(() => {
    if (!username) return
    skipSave.current = true
    const ref = doc(db, 'acr_ledger', username.toLowerCase())
    const unsub = onSnapshot(ref, (snap) => {
      skipSave.current = true
      setEntries(snap.exists() ? (snap.data().entries || []) : [])
      setLoaded(true)
    }, (e) => console.error('Ledger sync:', e.message))
    return () => { unsub(); clearTimeout(saveTimer.current) }
  }, [username])

  const save = (newEntries) => {
    if (!loaded) return
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      try {
        await setDoc(doc(db, 'acr_ledger', username.toLowerCase()), {
          entries: newEntries, updatedAt: serverTimestamp(),
        })
      } catch (e) { console.error('Ledger save:', e.message) }
    }, 500)
  }

  const setAndSave = (fn) => {
    setEntries(prev => {
      const next = typeof fn === 'function' ? fn(prev) : fn
      skipSave.current = false
      save(next)
      return next
    })
  }

  return { entries, setEntries: setAndSave, loaded }
}

/* ── Neumorphic Avatar ── */
function Avatar({ name, color, size = 40 }) {
  const initials = name.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Poppins,sans-serif', fontWeight: 700,
      fontSize: size * 0.34, color: '#fff', flexShrink: 0,
      boxShadow: `3px 3px 8px rgba(0,0,0,0.15), -1px -1px 4px rgba(255,255,255,0.6)`,
    }}>
      {initials}
    </div>
  )
}

/* ── Status Badge — light mode ── */
function StatusBadge({ entry }) {
  if (entry.settled) return (
    <span style={{ padding:'3px 10px', borderRadius:20, fontSize:10, fontWeight:700, background:'#dcfce7', color:'#16a34a', border:'1px solid #bbf7d0' }}>✓ SETTLED</span>
  )
  const d = DAYS_LEFT(entry.dueDate)
  if (d === null) return null
  if (d < 0)  return <span style={{ padding:'3px 10px', borderRadius:20, fontSize:10, fontWeight:700, background:'#fee2e2', color:'#dc2626', border:'1px solid #fca5a5', animation:'ledgerPulse 2s infinite' }}>⚠ OVERDUE {Math.abs(d)}d</span>
  if (d === 0) return <span style={{ padding:'3px 10px', borderRadius:20, fontSize:10, fontWeight:700, background:'#fef9c3', color:'#ca8a04', border:'1px solid #fde68a', animation:'ledgerPulse 1.5s infinite' }}>🔔 DUE TODAY</span>
  if (d <= 3)  return <span style={{ padding:'3px 10px', borderRadius:20, fontSize:10, fontWeight:700, background:'#fef9c3', color:'#ca8a04', border:'1px solid #fde68a' }}>⏰ {d}d left</span>
  return <span style={{ padding:'3px 10px', borderRadius:20, fontSize:10, fontWeight:700, background:'#dbeafe', color:'#1d4ed8', border:'1px solid #bfdbfe' }}>📅 {d}d left</span>
}

/* ── Entry Card — neumorphic silver ── */
function EntryCard({ entry, onSettle, onDelete, onEdit }) {
  const [expanded, setExpanded] = useState(false)
  const isLent   = entry.type === 'lent'
  const accent   = isLent ? '#16a34a' : '#dc2626'
  const accentBg = isLent ? '#dcfce7' : '#fee2e2'
  const daysLeft = DAYS_LEFT(entry.dueDate)
  const isUrgent = !entry.settled && daysLeft !== null && daysLeft <= 1

  return (
    <div style={{
      borderRadius: 18,
      background: 'linear-gradient(135deg, #f8f8f8 0%, #e2e2e2 40%, #f0f0f0 100%)',
      boxShadow: isUrgent
        ? '6px 6px 14px rgba(220,38,38,0.15), -3px -3px 8px rgba(255,255,255,0.9), inset 0 1px 0 rgba(255,255,255,0.7)'
        : '6px 6px 14px rgba(0,0,0,0.1), -3px -3px 8px rgba(255,255,255,0.9), inset 0 1px 0 rgba(255,255,255,0.7)',
      border: `1px solid ${isUrgent ? '#fca5a5' : 'rgba(255,255,255,0.8)'}`,
      borderLeft: `4px solid ${entry.settled ? '#16a34a' : accent}`,
      marginBottom: 12,
      animation: 'ledgerSlideIn 0.35s ease-out both',
      opacity: entry.settled ? 0.75 : 1,
      transition: 'all 0.3s',
      overflow: 'hidden',
    }}>
      {/* Main row */}
      <div style={{ padding: '13px 15px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
        onClick={() => setExpanded(e => !e)}>
        <Avatar name={entry.person} color={entry.color} size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 3 }}>
            <span style={{ fontFamily: 'Poppins,sans-serif', fontWeight: 800, color: '#1a1a1a', fontSize: 14 }}>{entry.person}</span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 10, background: accentBg, color: accent, border: `1px solid ${isLent ? '#bbf7d0' : '#fca5a5'}` }}>
              {isLent ? '↑ LENT' : '↓ BORROWED'}
            </span>
            <StatusBadge entry={entry} />
          </div>
          <p style={{ fontSize: 11, color: '#6b7280', margin: 0, fontFamily: 'Poppins,sans-serif' }}>
            {entry.category} · {new Date(entry.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            {entry.note && ` · "${entry.note}"`}
          </p>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <p style={{ fontFamily: 'Poppins,sans-serif', fontWeight: 800, fontSize: 16, color: entry.settled ? '#16a34a' : '#b8860b', margin: 0 }}>{fmt(entry.amount)}</p>
          <p style={{ fontSize: 10, color: '#9ca3af', margin: '2px 0 0', fontFamily: 'Poppins,sans-serif' }}>{expanded ? '▲ less' : '▼ more'}</p>
        </div>
      </div>

      {/* Expanded actions */}
      {expanded && (
        <div style={{ padding: '12px 15px 14px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
          {entry.dueDate && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '9px 12px', background: 'linear-gradient(145deg,#ffffff,#f0f0f0)', borderRadius: 12, boxShadow: 'inset 2px 2px 5px rgba(0,0,0,0.07), inset -1px -1px 3px rgba(255,255,255,0.9)' }}>
              <span style={{ fontSize: 14 }}>📅</span>
              <span style={{ fontSize: 12, color: '#6b7280', fontFamily: 'Poppins,sans-serif' }}>Due date:</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#1a1a1a', fontFamily: 'Poppins,sans-serif' }}>{new Date(entry.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
          )}
          {entry.phone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '9px 12px', background: 'linear-gradient(145deg,#ffffff,#f0f0f0)', borderRadius: 12, boxShadow: 'inset 2px 2px 5px rgba(0,0,0,0.07), inset -1px -1px 3px rgba(255,255,255,0.9)' }}>
              <span style={{ fontSize: 14 }}>📱</span>
              <a href={`tel:${entry.phone}`} style={{ fontSize: 12, color: '#1d4ed8', fontWeight: 600, textDecoration: 'none', fontFamily: 'Poppins,sans-serif' }}>{entry.phone}</a>
              <a href={`https://wa.me/91${entry.phone.replace(/\D/g, '')}?text=Hi ${entry.person}, just a reminder about ₹${entry.amount} ${isLent ? 'you owe me' : 'I owe you'}.`}
                target="_blank" rel="noopener noreferrer"
                style={{ marginLeft: 'auto', padding: '5px 12px', borderRadius: 10, background: '#dcfce7', border: '1px solid #bbf7d0', color: '#16a34a', fontSize: 11, fontWeight: 700, textDecoration: 'none', fontFamily: 'Poppins,sans-serif' }}>
                💬 WhatsApp
              </a>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            {!entry.settled && (
              <button onClick={() => onSettle(entry.id)} style={{
                flex: 1, padding: '10px', borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'Poppins,sans-serif', fontWeight: 700, fontSize: 13, color: '#16a34a',
                background: 'linear-gradient(145deg,#f0fdf4,#dcfce7)',
                boxShadow: '3px 3px 8px rgba(0,0,0,0.09), -2px -2px 5px rgba(255,255,255,0.9)',
                border: '1px solid #bbf7d0',
              }}>✓ Mark Settled</button>
            )}
            <button onClick={() => onEdit(entry)} style={{
              padding: '10px 14px', borderRadius: 12, cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'Poppins,sans-serif', color: '#475569',
              background: 'linear-gradient(145deg,#f5f5f5,#e8e8e8)',
              boxShadow: '3px 3px 8px rgba(0,0,0,0.09), -2px -2px 5px rgba(255,255,255,0.9)',
              border: '1px solid #e2e8f0',
            }}>✏</button>
            <button onClick={() => onDelete(entry.id)} style={{
              padding: '10px 14px', borderRadius: 12, cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'Poppins,sans-serif', color: '#dc2626',
              background: 'linear-gradient(145deg,#fff1f2,#fee2e2)',
              boxShadow: '3px 3px 8px rgba(0,0,0,0.09), -2px -2px 5px rgba(255,255,255,0.9)',
              border: '1px solid #fca5a5',
            }}>🗑</button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Add / Edit Modal — light neumorphic ── */
const COLORS = ['#f87171','#fb923c','#fbbf24','#34d399','#60a5fa','#a78bfa','#f472b6','#e879f9']
const CATEGORIES = ['Friend','Family','Relative','Tenant','Colleague','Business','Other']

function EntryModal({ editing, onSave, onClose }) {
  const [form, setForm] = useState(editing || {
    type: 'lent', person: '', amount: '', category: 'Friend',
    date: TODAY(), dueDate: '', note: '', phone: '',
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const [error, setError] = useState('')

  const handleSave = () => {
    if (!form.person.trim()) { setError('Name is required'); return }
    if (!form.amount || Number(form.amount) <= 0) { setError('Valid amount required'); return }
    onSave({ ...form, amount: Number(form.amount), id: form.id || Date.now(), settled: form.settled || false, createdAt: form.createdAt || new Date().toISOString() })
    onClose()
  }

  const inputSt = {
    width: '100%', padding: '12px 14px',
    background: 'linear-gradient(145deg,#e8e8e8,#ffffff)',
    boxShadow: 'inset 3px 3px 7px rgba(0,0,0,0.1), inset -2px -2px 5px rgba(255,255,255,0.9)',
    border: '1px solid #e2e8f0', borderRadius: 12,
    color: '#1a1a1a', fontSize: 14, outline: 'none',
    fontFamily: 'Poppins,sans-serif', fontWeight: 500,
    transition: 'box-shadow 0.2s',
  }
  const Lbl = ({ t }) => (
    <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 7, fontFamily: 'Poppins,sans-serif' }}>{t}</label>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', animation: 'fadeIn 0.2s ease-out' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        width: '100%', maxWidth: 500,
        background: 'linear-gradient(160deg,#f8f8f8,#ebebeb)',
        border: '1px solid rgba(255,255,255,0.9)',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.15)',
        borderRadius: '24px 24px 0 0', padding: '24px 20px 36px',
        maxHeight: '92vh', overflowY: 'auto',
        animation: 'slideUpModal 0.35s cubic-bezier(.34,1.1,.64,1) both',
      }}>
        {/* Handle */}
        <div style={{ width: 40, height: 4, borderRadius: 2, background: '#d1d5db', margin: '-8px auto 18px', boxShadow: 'inset 1px 1px 2px rgba(0,0,0,0.1)' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <p style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, color: '#1a1a1a', fontSize: 18, margin: 0 }}>
            {editing ? '✏ Edit Entry' : '＋ New Entry'}
          </p>
          <button onClick={onClose} style={{
            background: 'linear-gradient(145deg,#f5f5f5,#e0e0e0)',
            border: '1px solid #e2e8f0', borderRadius: 8,
            boxShadow: '2px 2px 6px rgba(0,0,0,0.1), -1px -1px 3px rgba(255,255,255,0.9)',
            color: '#6b7280', fontSize: 16, cursor: 'pointer',
            width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>

        {/* Type toggle */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 18, background: 'linear-gradient(145deg,#e0e0e0,#f5f5f5)', borderRadius: 14, padding: 4, boxShadow: 'inset 2px 2px 5px rgba(0,0,0,0.1), inset -1px -1px 3px rgba(255,255,255,0.8)' }}>
          {[['lent','↑ I Lent Money','#16a34a','#dcfce7','#bbf7d0'], ['borrowed','↓ I Borrowed','#dc2626','#fee2e2','#fca5a5']].map(([t, label, col, bg, br]) => (
            <button key={t} onClick={() => set('type', t)} style={{
              flex: 1, padding: '11px', borderRadius: 11, border: form.type === t ? `1.5px solid ${br}` : '1.5px solid transparent',
              cursor: 'pointer', fontFamily: 'Poppins,sans-serif', fontWeight: 700, fontSize: 13,
              transition: 'all 0.2s',
              background: form.type === t ? `linear-gradient(135deg,${bg},#fff)` : 'transparent',
              color: form.type === t ? col : '#9ca3af',
              boxShadow: form.type === t ? '2px 2px 6px rgba(0,0,0,0.1), -1px -1px 3px rgba(255,255,255,0.9)' : 'none',
            }}>{label}</button>
          ))}
        </div>

        <div style={{ marginBottom: 14 }}><Lbl t="Person Name" /><input value={form.person} onChange={e => set('person', e.target.value)} placeholder="e.g. Rahul Kumar" style={inputSt} /></div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1 }}><Lbl t="Amount (₹)" /><input type="number" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0" style={inputSt} /></div>
          <div style={{ flex: 1 }}><Lbl t="Category" /><select value={form.category} onChange={e => set('category', e.target.value)} style={{ ...inputSt, cursor: 'pointer' }}>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <Lbl t="Phone (WhatsApp reminder)" />
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#9ca3af', pointerEvents: 'none' }}>📱</span>
            <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="9876543210 (optional)" style={{ ...inputSt, paddingLeft: 38 }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1 }}><Lbl t="Date" /><input type="date" value={form.date} onChange={e => set('date', e.target.value)} style={{ ...inputSt, colorScheme: 'light' }} /></div>
          <div style={{ flex: 1 }}><Lbl t="Due Date (optional)" /><input type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} style={{ ...inputSt, colorScheme: 'light' }} /></div>
        </div>

        <div style={{ marginBottom: 18 }}><Lbl t="Note (optional)" /><input value={form.note} onChange={e => set('note', e.target.value)} placeholder="e.g. for rent, emergency, trip..." style={inputSt} /></div>

        <div style={{ marginBottom: 20 }}>
          <Lbl t="Avatar Color" />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {COLORS.map(c => (
              <button key={c} onClick={() => set('color', c)} style={{ width: 30, height: 30, borderRadius: '50%', background: c, cursor: 'pointer', transition: 'all 0.2s', border: form.color === c ? '3px solid #1a1a1a' : '2px solid rgba(255,255,255,0.8)', boxShadow: form.color === c ? `3px 3px 8px rgba(0,0,0,0.2), -1px -1px 3px rgba(255,255,255,0.8)` : '2px 2px 5px rgba(0,0,0,0.1)', transform: form.color === c ? 'scale(1.2)' : 'scale(1)' }} />
            ))}
          </div>
        </div>

        {error && <p style={{ color: '#dc2626', fontSize: 12, marginBottom: 12, fontWeight: 600, fontFamily: 'Poppins,sans-serif' }}>⚠ {error}</p>}

        <button onClick={handleSave} style={{
          width: '100%', padding: '14px', borderRadius: 14, border: 'none', cursor: 'pointer',
          background: form.type === 'lent' ? 'linear-gradient(135deg,#16a34a,#22c55e)' : 'linear-gradient(135deg,#dc2626,#ef4444)',
          color: '#fff', fontFamily: 'Poppins,sans-serif', fontWeight: 800, fontSize: 15,
          boxShadow: form.type === 'lent' ? '4px 4px 14px rgba(22,163,74,0.3),-2px -2px 6px rgba(255,255,255,0.7)' : '4px 4px 14px rgba(220,38,38,0.3),-2px -2px 6px rgba(255,255,255,0.7)',
          transition: 'all 0.2s',
        }}>
          {editing ? '💾 Save Changes' : (form.type === 'lent' ? '↑ Record Lent Amount' : '↓ Record Borrowed Amount')}
        </button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════
   MAIN LEDGER
═══════════════════════════════════════════ */
export default function Ledger({ currentUser }) {
  const { entries, setEntries, loaded } = useLedger(currentUser?.username)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing]     = useState(null)
  const [filter, setFilter]       = useState('all')
  const [search, setSearch]       = useState('')
  const [sortBy, setSortBy]       = useState('date')

  const totalLent     = useMemo(() => entries.filter(e => e.type==='lent'&&!e.settled).reduce((s,e)=>s+e.amount,0),[entries])
  const totalBorrowed = useMemo(() => entries.filter(e => e.type==='borrowed'&&!e.settled).reduce((s,e)=>s+e.amount,0),[entries])
  const overdue  = useMemo(() => entries.filter(e => !e.settled&&e.dueDate&&DAYS_LEFT(e.dueDate)<0),[entries])
  const dueToday = useMemo(() => entries.filter(e => !e.settled&&e.dueDate&&DAYS_LEFT(e.dueDate)===0),[entries])
  const dueSoon  = useMemo(() => entries.filter(e => !e.settled&&e.dueDate&&DAYS_LEFT(e.dueDate)>0&&DAYS_LEFT(e.dueDate)<=7),[entries])
  const netBalance = totalLent - totalBorrowed

  const visible = useMemo(() => {
    let list = [...entries]
    if (filter==='lent')     list = list.filter(e=>e.type==='lent'&&!e.settled)
    else if (filter==='borrowed') list = list.filter(e=>e.type==='borrowed'&&!e.settled)
    else if (filter==='overdue')  list = list.filter(e=>!e.settled&&e.dueDate&&DAYS_LEFT(e.dueDate)<0)
    else if (filter==='settled')  list = list.filter(e=>e.settled)
    else list = list.filter(e=>!e.settled)
    if (search) list = list.filter(e=>e.person.toLowerCase().includes(search.toLowerCase())||(e.note||'').toLowerCase().includes(search.toLowerCase()))
    if (sortBy==='amount') list.sort((a,b)=>b.amount-a.amount)
    else if (sortBy==='due') list.sort((a,b)=>{if(!a.dueDate)return 1;if(!b.dueDate)return -1;return new Date(a.dueDate)-new Date(b.dueDate)})
    else list.sort((a,b)=>new Date(b.createdAt||b.date)-new Date(a.createdAt||a.date))
    return list
  }, [entries, filter, search, sortBy])

  const handleSave   = (entry) => { setEntries(prev=>{ const idx=prev.findIndex(e=>e.id===entry.id); if(idx>=0){const n=[...prev];n[idx]=entry;return n} return [entry,...prev] }) }
  const handleSettle = (id)    => { setEntries(prev=>prev.map(e=>e.id===id?{...e,settled:true,settledAt:new Date().toISOString()}:e)) }
  const handleDelete = (id)    => { setEntries(prev=>prev.filter(e=>e.id!==id)) }
  const handleEdit   = (entry) => { setEditing(entry); setShowModal(true) }

  const FILTERS = [
    { id:'all',      label:'📋 Active',   count:entries.filter(e=>!e.settled).length },
    { id:'lent',     label:'↑ Lent',      count:entries.filter(e=>e.type==='lent'&&!e.settled).length },
    { id:'borrowed', label:'↓ Borrowed',  count:entries.filter(e=>e.type==='borrowed'&&!e.settled).length },
    { id:'overdue',  label:'⚠ Overdue',   count:overdue.length },
    { id:'settled',  label:'✓ Settled',   count:entries.filter(e=>e.settled).length },
  ]

  return (
    <>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=Syne:wght@700;800&display=swap');
      .ledger-root { font-family:'Poppins',sans-serif; color:#1a1a1a; }
      @keyframes fadeIn       { from{opacity:0} to{opacity:1} }
      @keyframes slideUp      { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
      @keyframes ledgerSlideIn{ from{opacity:0;transform:translateX(-10px)} to{opacity:1;transform:translateX(0)} }
      @keyframes slideUpModal { from{transform:translateY(100%)} to{transform:translateY(0)} }
      @keyframes ledgerPulse  { 0%,100%{opacity:1} 50%{opacity:0.5} }
      @keyframes floatY       { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
      .ledger-filter-btn { transition:all 0.2s; }
      .ledger-filter-btn:hover { transform:translateY(-1px); }
      input::placeholder { color:#9ca3af !important; }
      select option { background:#ffffff !important; color:#1a1a1a !important; }
      ::-webkit-scrollbar { width:3px; }
      ::-webkit-scrollbar-thumb { background:#d1d5db; border-radius:3px; }
      @media(max-width:640px){ .ledger-desk-add{display:none!important;} }
    `}</style>

    <div className="ledger-root" style={{ maxWidth:1040, margin:'0 auto', padding:'0 8px 100px', background:'transparent', width:'100%' }}>

      {/* ── FLOATING ADD BUTTON ── */}
      <div style={{ position:'fixed', bottom:90, right:18, zIndex:300 }}>
        <button onClick={() => { setEditing(null); setShowModal(true) }} style={{
          width:56, height:56, borderRadius:'50%', border:'1px solid rgba(255,255,255,0.8)',
          background:'linear-gradient(135deg,#7c3aed,#4f46e5)',
          color:'#fff', fontSize:26, cursor:'pointer',
          boxShadow:'4px 4px 14px rgba(124,58,237,0.35), -2px -2px 6px rgba(255,255,255,0.4)',
          display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.2s',
        }}
          onMouseEnter={e=>e.currentTarget.style.transform='scale(1.08)'}
          onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
          ＋
        </button>
      </div>

      {/* ── HEADER ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, animation:'slideUp 0.4s ease-out both' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <img src="/logo.jpg" alt="ACR MAX" style={{ width:42, height:42, borderRadius:'50%', objectFit:'cover', border:'2px solid #e2e8f0', boxShadow:'3px 3px 8px rgba(0,0,0,0.1), -2px -2px 5px rgba(255,255,255,0.9)', flexShrink:0 }} />
          <div>
            <h2 style={{ fontFamily:'Syne,sans-serif', fontSize:20, fontWeight:800, margin:'0 0 2px', color:'#1a1a1a' }}>🤝 Smart Ledger</h2>
            <p style={{ fontSize:11, color:'#6b7280', margin:0, fontFamily:'Poppins,sans-serif' }}>ACR MAX · Lent · Borrowed · Reminders</p>
          </div>
        </div>
        <button onClick={() => { setEditing(null); setShowModal(true) }} className="ledger-desk-add" style={{
          padding:'10px 20px', borderRadius:12, cursor:'pointer',
          background:'linear-gradient(135deg,#7c3aed,#4f46e5)',
          border:'none',
          boxShadow:'4px 4px 12px rgba(124,58,237,0.25),-2px -2px 6px rgba(255,255,255,0.7)',
          color:'#fff', fontFamily:'Poppins,sans-serif', fontWeight:700, fontSize:13,
        }}>＋ New Entry</button>
      </div>

      {/* ── BALANCE STRIP — neumorphic cards ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20, animation:'slideUp 0.4s ease-out 0.05s both' }}>
        {[
          { label:'Will Receive', value:fmt(totalLent),   color:'#16a34a', accent:'#bbf7d0' },
          { label:'Will Pay',     value:fmt(totalBorrowed),color:'#dc2626', accent:'#fca5a5' },
          { label:'Net Balance',  value:(netBalance>=0?'+':'')+fmt(Math.abs(netBalance)), color:netBalance>=0?'#16a34a':'#dc2626', accent: netBalance>=0?'#bbf7d0':'#fca5a5' },
        ].map((s,i) => (
          <div key={i} style={{
            padding:'14px 10px',
            background:'linear-gradient(145deg,#f8f8f8,#d8d8d8)',
            border:'1.5px solid rgba(255,255,255,0.95)',
            borderTop:`3px solid ${s.accent}`,
            borderRadius:16, textAlign:'center',
            boxShadow:'5px 5px 14px rgba(0,0,0,0.1),-3px -3px 8px rgba(255,255,255,0.98),inset 0 1px 0 rgba(255,255,255,0.95)',
            backgroundImage:'linear-gradient(135deg,rgba(255,255,255,0.5) 0%,transparent 50%,rgba(0,0,0,0.03) 100%)',
          }}>
            <p style={{ fontSize:9, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.1em', margin:'0 0 6px', fontFamily:'Poppins,sans-serif' }}>{s.label}</p>
            <p style={{ fontFamily:'Poppins,sans-serif', fontWeight:800, fontSize:16, color:'#b8860b', margin:0 }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── ALERTS ── */}
      {(overdue.length > 0 || dueToday.length > 0) && (
        <div style={{ borderRadius:14, padding:'12px 16px', marginBottom:16, background:'linear-gradient(145deg,#fff1f2,#fee2e2)', border:'1.5px solid #fca5a5', boxShadow:'3px 3px 8px rgba(220,38,38,0.1), -2px -2px 5px rgba(255,255,255,0.9)', animation:'slideUp 0.4s ease-out 0.1s both' }}>
          {overdue.length > 0 && (
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:dueToday.length?6:0 }}>
              <span style={{ fontSize:15 }}>🚨</span>
              <p style={{ fontSize:13, color:'#dc2626', fontWeight:700, margin:0, fontFamily:'Poppins,sans-serif' }}>{overdue.length} payment{overdue.length>1?'s':''} overdue — {overdue.map(e=>e.person).join(', ')}</p>
            </div>
          )}
          {dueToday.length > 0 && (
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:15 }}>🔔</span>
              <p style={{ fontSize:13, color:'#ca8a04', fontWeight:700, margin:0, fontFamily:'Poppins,sans-serif' }}>Due today — {dueToday.map(e=>e.person).join(', ')}</p>
            </div>
          )}
        </div>
      )}

      {dueSoon.length > 0 && (
        <div style={{ borderRadius:14, padding:'10px 14px', marginBottom:16, background:'linear-gradient(145deg,#fffbeb,#fef9c3)', border:'1.5px solid #fde68a', boxShadow:'3px 3px 8px rgba(0,0,0,0.07), -2px -2px 5px rgba(255,255,255,0.9)', display:'flex', alignItems:'center', gap:8, animation:'slideUp 0.4s ease-out 0.15s both' }}>
          <span style={{ fontSize:15 }}>⏰</span>
          <p style={{ fontSize:12, color:'#ca8a04', fontWeight:600, margin:0, fontFamily:'Poppins,sans-serif' }}>{dueSoon.length} due within 7 days — {dueSoon.map(e=>`${e.person} (${DAYS_LEFT(e.dueDate)}d)`).join(', ')}</p>
        </div>
      )}

      {/* ── FILTER TABS ── */}
      <div style={{ display:'flex', gap:8, marginBottom:18, overflowX:'auto', paddingBottom:4, scrollbarWidth:'none', animation:'slideUp 0.4s ease-out 0.2s both' }}>
        {FILTERS.map(f => (
          <button key={f.id} className="ledger-filter-btn" onClick={() => setFilter(f.id)} style={{
            padding:'9px 15px', borderRadius:20, fontWeight:700, fontSize:12,
            whiteSpace:'nowrap', cursor:'pointer', fontFamily:'Poppins,sans-serif',
            border: filter===f.id ? '1.5px solid #7c3aed' : '1.5px solid #e2e8f0',
            background: filter===f.id ? 'linear-gradient(145deg,#ede9fe,#ddd6fe)' : 'linear-gradient(145deg,#ffffff,#ebebeb)',
            color: filter===f.id ? '#fff' : '#475569',
            boxShadow: filter===f.id ? '3px 3px 8px rgba(124,58,237,0.25), -2px -2px 5px rgba(255,255,255,0.8)' : '3px 3px 7px rgba(0,0,0,0.08), -2px -2px 5px rgba(255,255,255,0.9)',
            display:'flex', alignItems:'center', gap:6,
          }}>
            {f.label}
            {f.count > 0 && (
              <span style={{ background: filter===f.id?'rgba(255,255,255,0.25)':'#e2e8f0', color: filter===f.id?'#fff':'#475569', borderRadius:10, padding:'1px 7px', fontSize:10, fontWeight:700 }}>{f.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── SEARCH + SORT ── */}
      <div style={{ display:'flex', gap:12, marginBottom:20, animation:'slideUp 0.4s ease-out 0.25s both' }}>
        <div style={{ position:'relative', flex:1 }}>
          <span style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', fontSize:13, color:'#9ca3af', pointerEvents:'none' }}>🔍</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search person or note…"
            style={{ width:'100%', padding:'11px 14px 11px 38px', background:'linear-gradient(145deg,#e8e8e8,#ffffff)', boxShadow:'inset 3px 3px 7px rgba(0,0,0,0.09), inset -2px -2px 5px rgba(255,255,255,0.9)', border:'1px solid #e2e8f0', borderRadius:12, color:'#1a1a1a', fontSize:13, outline:'none', fontFamily:'Poppins,sans-serif' }} />
        </div>
        <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{ padding:'11px 14px', background:'linear-gradient(145deg,#f5f5f5,#e8e8e8)', boxShadow:'3px 3px 8px rgba(0,0,0,0.08), -2px -2px 5px rgba(255,255,255,0.9)', border:'1px solid #e2e8f0', borderRadius:12, color:'#1a1a1a', fontSize:13, outline:'none', cursor:'pointer', fontFamily:'Poppins,sans-serif', fontWeight:600 }}>
          <option value="date">Latest</option>
          <option value="amount">Highest</option>
          <option value="due">Due Date</option>
        </select>
      </div>

      {/* ── ENTRIES ── */}
      {!loaded ? (
        <div style={{ textAlign:'center', padding:'48px 20px', color:'#9ca3af' }}>
          <div style={{ fontSize:40, marginBottom:12, animation:'floatY 3s ease-in-out infinite' }}>🤝</div>
          <p style={{ fontWeight:600, fontSize:14, fontFamily:'Poppins,sans-serif' }}>Loading your ledger…</p>
        </div>
      ) : visible.length === 0 ? (
        <div style={{ textAlign:'center', padding:'52px 20px', color:'#9ca3af', animation:'slideUp 0.4s ease-out both' }}>
          <div style={{ fontSize:52, marginBottom:14, animation:'floatY 4s ease-in-out infinite' }}>🤝</div>
          <p style={{ fontWeight:700, fontSize:16, marginBottom:6, color:'#374151', fontFamily:'Poppins,sans-serif' }}>
            {filter==='settled'?'No settled entries yet':filter==='overdue'?'No overdue entries! 🎉':'No entries yet'}
          </p>
          <p style={{ fontSize:13, color:'#9ca3af', marginBottom:20, fontFamily:'Poppins,sans-serif' }}>
            {filter==='all'?'Tap "＋ New Entry" to start tracking':'Try a different filter'}
          </p>
          {filter==='all' && (
            <button onClick={()=>{setEditing(null);setShowModal(true)}} style={{
              padding:'12px 24px', borderRadius:14, cursor:'pointer', fontFamily:'Poppins,sans-serif', fontWeight:700, fontSize:14, color:'#fff',
              background:'linear-gradient(135deg,#7c3aed,#4f46e5)', border:'none',
              boxShadow:'4px 4px 12px rgba(124,58,237,0.3)',
            }}>＋ Add First Entry</button>
          )}
        </div>
      ) : (
        <div style={{ paddingTop: 2 }}>
          {visible.map((entry,i) => (
            <div key={entry.id} style={{ animationDelay:`${i*40}ms` }}>
              <EntryCard entry={entry} onSettle={handleSettle} onDelete={handleDelete} onEdit={handleEdit} />
            </div>
          ))}
          <p style={{ textAlign:'center', fontSize:11, color:'#9ca3af', marginTop:16, fontWeight:500, fontFamily:'Poppins,sans-serif' }}>
            {visible.length} entr{visible.length===1?'y':'ies'} · Synced across all devices
          </p>
        </div>
      )}

      {showModal && (
        <EntryModal editing={editing} onSave={handleSave} onClose={()=>{setShowModal(false);setEditing(null)}} />
      )}
    </div>
    </>
  )
}
