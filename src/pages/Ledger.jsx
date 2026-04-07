import { useState, useEffect, useMemo, useRef } from 'react'
import { db } from '../firebase'
import { doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore'

/* ─────────────────────────────────────────────────────────────────────────────
   SMART LEDGER — Personal Money Tracker
   Track money lent/borrowed, payment reminders, settlement history
   Cloud synced per user via Firestore
────────────────────────────────────────────────────────────────────────────── */

const fmt = (n) => `₹${Math.abs(Number(n)).toLocaleString('en-IN')}`
const TODAY = () => new Date().toISOString().slice(0, 10)
const DAYS_LEFT = (due) => {
  if (!due) return null
  const diff = Math.ceil((new Date(due) - new Date()) / 86400000)
  return diff
}

/* ── Firestore sync ─────────────────────────────────────────────────────── */
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
          entries: newEntries,
          updatedAt: serverTimestamp(),
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

/* ── Avatar circle ──────────────────────────────────────────────────────── */
function Avatar({ name, color, size = 42 }) {
  const initials = name.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: size * 0.35, color: '#fff', flexShrink: 0, boxShadow: `0 0 12px ${color}60` }}>
      {initials}
    </div>
  )
}

/* ── Status badge ───────────────────────────────────────────────────────── */
function StatusBadge({ entry }) {
  if (entry.settled) return <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 800, background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }}>✓ SETTLED</span>
  const d = DAYS_LEFT(entry.dueDate)
  if (d === null) return null
  if (d < 0) return <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 800, background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', animation: 'ledgerPulse 2s infinite' }}>⚠ OVERDUE {Math.abs(d)}d</span>
  if (d === 0) return <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 800, background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)', animation: 'ledgerPulse 1.5s infinite' }}>🔔 DUE TODAY</span>
  if (d <= 3) return <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 800, background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)' }}>⏰ {d}d left</span>
  return <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 800, background: 'rgba(96,165,250,0.12)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.2)' }}>📅 {d}d left</span>
}

/* ── Entry card ─────────────────────────────────────────────────────────── */
function EntryCard({ entry, onSettle, onDelete, onEdit }) {
  const [expanded, setExpanded] = useState(false)
  const isLent = entry.type === 'lent'
  const accent = isLent ? '#34d399' : '#f87171'
  const daysLeft = DAYS_LEFT(entry.dueDate)
  const isUrgent = !entry.settled && daysLeft !== null && daysLeft <= 1

  return (
    <div style={{
      borderRadius: 18, overflow: 'hidden',
      background: 'linear-gradient(135deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))',
      border: `1px solid ${isUrgent ? 'rgba(239,68,68,0.35)' : 'rgba(255,255,255,0.08)'}`,
      borderLeft: `3px solid ${entry.settled ? '#34d399' : accent}`,
      marginBottom: 10,
      animation: 'ledgerSlideIn 0.35s ease-out both',
      opacity: entry.settled ? 0.7 : 1,
      transition: 'all 0.3s',
    }}>
      {/* Main row */}
      <div style={{ padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
        onClick={() => setExpanded(e => !e)}>
        <Avatar name={entry.person} color={entry.color} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
            <span style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, color: '#fff', fontSize: 13 }}>{entry.person}</span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: isLent ? 'rgba(52,211,153,0.12)' : 'rgba(239,68,68,0.12)', color: isLent ? '#34d399' : '#f87171', border: `1px solid ${isLent ? 'rgba(52,211,153,0.25)' : 'rgba(239,68,68,0.25)'}` }}>
              {isLent ? '↑ LENT' : '↓ BORROWED'}
            </span>
            <StatusBadge entry={entry} />
          </div>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', margin: 0 }}>
            {entry.category} · {new Date(entry.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            {entry.note && ` · "${entry.note}"`}
          </p>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <p style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 15, color: entry.settled ? '#34d399' : accent, margin: 0 }}>{fmt(entry.amount)}</p>
          <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', margin: 0 }}>{expanded ? '▲' : '▼'}</p>
        </div>
      </div>

      {/* Expanded actions */}
      {expanded && (
        <div style={{ padding: '0 16px 14px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12 }}>
          {entry.dueDate && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '8px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 10 }}>
              <span style={{ fontSize: 14 }}>📅</span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Due date:</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{new Date(entry.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
          )}
          {entry.phone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '8px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 10 }}>
              <span style={{ fontSize: 14 }}>📱</span>
              <a href={`tel:${entry.phone}`} style={{ fontSize: 12, color: '#60a5fa', fontWeight: 600, textDecoration: 'none' }}>{entry.phone}</a>
              <a href={`https://wa.me/91${entry.phone.replace(/\D/g, '')}?text=Hi ${entry.person}, just a reminder about ₹${entry.amount} ${isLent ? 'you owe me' : 'I owe you'}.`}
                target="_blank" rel="noopener noreferrer"
                style={{ marginLeft: 'auto', padding: '4px 12px', borderRadius: 10, background: 'rgba(37,211,102,0.15)', border: '1px solid rgba(37,211,102,0.3)', color: '#25D366', fontSize: 11, fontWeight: 700, textDecoration: 'none' }}>
                💬 WhatsApp
              </a>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            {!entry.settled && (
              <button onClick={() => onSettle(entry.id)}
                style={{ flex: 1, padding: '10px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,rgba(52,211,153,0.2),rgba(5,150,105,0.15))', color: '#34d399', fontWeight: 700, fontSize: 13, cursor: 'pointer', border: '1px solid rgba(52,211,153,0.3)', fontFamily: 'DM Sans,sans-serif' }}>
                ✓ Mark Settled
              </button>
            )}
            <button onClick={() => onEdit(entry)}
              style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'DM Sans,sans-serif' }}>
              ✏
            </button>
            <button onClick={() => onDelete(entry.id)}
              style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'DM Sans,sans-serif' }}>
              🗑
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Add / Edit Modal ───────────────────────────────────────────────────── */
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
    onSave({
      ...form,
      amount: Number(form.amount),
      id: form.id || Date.now(),
      settled: form.settled || false,
      createdAt: form.createdAt || new Date().toISOString(),
    })
    onClose()
  }

  const inputSt = {
    width: '100%', padding: '11px 14px',
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 12, color: '#fff', fontSize: 14, outline: 'none',
    fontFamily: 'DM Sans,sans-serif', fontWeight: 500,
    transition: 'border 0.2s',
  }
  const Lbl = ({ t }) => <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>{t}</label>

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0 0 0 0', animation: 'fadeIn 0.2s ease-out' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: '100%', maxWidth: 500, background: 'linear-gradient(135deg,rgba(15,10,40,0.99),rgba(8,5,24,0.99))', border: '1px solid rgba(167,139,250,0.25)', borderRadius: '22px 22px 0 0', padding: '24px 22px 32px', maxHeight: '92vh', overflowY: 'auto', animation: 'slideUpModal 0.35s cubic-bezier(.34,1.1,.64,1) both' }}>

        {/* Handle bar */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)', margin: '-8px auto 18px' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <p style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, color: '#fff', fontSize: 18, margin: 0 }}>
            {editing ? '✏ Edit Entry' : '➕ New Entry'}
          </p>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'rgba(255,255,255,0.45)', fontSize: 18, cursor: 'pointer', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        {/* Type toggle */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 18, background: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 4 }}>
          {[['lent', '↑ I Lent Money', '#34d399'], ['borrowed', '↓ I Borrowed', '#f87171']].map(([t, label, color]) => (
            <button key={t} onClick={() => set('type', t)} style={{ flex: 1, padding: '10px', borderRadius: 11, border: 'none', cursor: 'pointer', fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 13, transition: 'all 0.25s', background: form.type === t ? `linear-gradient(135deg,${color}30,${color}15)` : 'transparent', color: form.type === t ? color : 'rgba(255,255,255,0.35)', boxShadow: form.type === t ? `0 0 0 1px ${color}40` : 'none' }}>
              {label}
            </button>
          ))}
        </div>

        {/* Person name */}
        <div style={{ marginBottom: 14 }}>
          <Lbl t="Person Name" />
          <input value={form.person} onChange={e => set('person', e.target.value)} placeholder="e.g. Rahul Kumar" style={inputSt} onFocus={e => e.target.style.borderColor = 'rgba(167,139,250,0.5)'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
        </div>

        {/* Amount + Category row */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <Lbl t="Amount (₹)" />
            <input type="number" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0" style={inputSt} onFocus={e => e.target.style.borderColor = 'rgba(167,139,250,0.5)'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
          </div>
          <div style={{ flex: 1 }}>
            <Lbl t="Category" />
            <select value={form.category} onChange={e => set('category', e.target.value)} style={{ ...inputSt, cursor: 'pointer' }}>
              {CATEGORIES.map(c => <option key={c} value={c} style={{ background: '#0d0b2e' }}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* Phone */}
        <div style={{ marginBottom: 14 }}>
          <Lbl t="Phone (for WhatsApp reminder)" />
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'rgba(255,255,255,0.25)' }}>📱</span>
            <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="9876543210 (optional)" style={{ ...inputSt, paddingLeft: 38 }} />
          </div>
        </div>

        {/* Date + Due Date */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <Lbl t="Date" />
            <input type="date" value={form.date} onChange={e => set('date', e.target.value)} style={{ ...inputSt, colorScheme: 'dark' }} />
          </div>
          <div style={{ flex: 1 }}>
            <Lbl t="Due Date (optional)" />
            <input type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} style={{ ...inputSt, colorScheme: 'dark' }} />
          </div>
        </div>

        {/* Note */}
        <div style={{ marginBottom: 18 }}>
          <Lbl t="Note (optional)" />
          <input value={form.note} onChange={e => set('note', e.target.value)} placeholder="e.g. for rent, emergency, trip..." style={inputSt} />
        </div>

        {/* Color picker */}
        <div style={{ marginBottom: 20 }}>
          <Lbl t="Avatar Color" />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {COLORS.map(c => (
              <button key={c} onClick={() => set('color', c)} style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: form.color === c ? '3px solid #fff' : '2px solid transparent', cursor: 'pointer', boxShadow: form.color === c ? `0 0 10px ${c}` : 'none', transition: 'all 0.2s', transform: form.color === c ? 'scale(1.2)' : 'scale(1)' }} />
            ))}
          </div>
        </div>

        {error && <p style={{ color: '#f87171', fontSize: 12, marginBottom: 12, fontWeight: 600 }}>⚠ {error}</p>}

        <button onClick={handleSave} style={{ width: '100%', padding: '14px', borderRadius: 14, border: 'none', background: form.type === 'lent' ? 'linear-gradient(135deg,#059669,#34d399)' : 'linear-gradient(135deg,#dc2626,#f87171)', color: '#fff', fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 15, cursor: 'pointer', boxShadow: form.type === 'lent' ? '0 4px 20px rgba(52,211,153,0.4)' : '0 4px 20px rgba(239,68,68,0.4)', transition: 'all 0.3s' }}>
          {editing ? '💾 Save Changes' : (form.type === 'lent' ? '↑ Record Lent Amount' : '↓ Record Borrowed Amount')}
        </button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   MAIN LEDGER COMPONENT
═══════════════════════════════════════════════════════ */
export default function Ledger({ currentUser }) {
  const { entries, setEntries, loaded } = useLedger(currentUser?.username)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [filter, setFilter] = useState('all') // all | lent | borrowed | overdue | settled
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('date') // date | amount | due

  /* ── derived stats ── */
  const totalLent = useMemo(() => entries.filter(e => e.type === 'lent' && !e.settled).reduce((s, e) => s + e.amount, 0), [entries])
  const totalBorrowed = useMemo(() => entries.filter(e => e.type === 'borrowed' && !e.settled).reduce((s, e) => s + e.amount, 0), [entries])
  const overdue = useMemo(() => entries.filter(e => !e.settled && e.dueDate && DAYS_LEFT(e.dueDate) < 0), [entries])
  const dueToday = useMemo(() => entries.filter(e => !e.settled && e.dueDate && DAYS_LEFT(e.dueDate) === 0), [entries])
  const dueSoon = useMemo(() => entries.filter(e => !e.settled && e.dueDate && DAYS_LEFT(e.dueDate) > 0 && DAYS_LEFT(e.dueDate) <= 7), [entries])
  const netBalance = totalLent - totalBorrowed

  /* ── filtered + sorted entries ── */
  const visible = useMemo(() => {
    let list = [...entries]
    if (filter === 'lent') list = list.filter(e => e.type === 'lent' && !e.settled)
    else if (filter === 'borrowed') list = list.filter(e => e.type === 'borrowed' && !e.settled)
    else if (filter === 'overdue') list = list.filter(e => !e.settled && e.dueDate && DAYS_LEFT(e.dueDate) < 0)
    else if (filter === 'settled') list = list.filter(e => e.settled)
    else list = list.filter(e => !e.settled) // 'all' shows active only
    if (search) list = list.filter(e => e.person.toLowerCase().includes(search.toLowerCase()) || (e.note || '').toLowerCase().includes(search.toLowerCase()))
    if (sortBy === 'amount') list.sort((a, b) => b.amount - a.amount)
    else if (sortBy === 'due') list.sort((a, b) => { if (!a.dueDate) return 1; if (!b.dueDate) return -1; return new Date(a.dueDate) - new Date(b.dueDate) })
    else list.sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date))
    return list
  }, [entries, filter, search, sortBy])

  const handleSave = (entry) => {
    setEntries(prev => {
      const idx = prev.findIndex(e => e.id === entry.id)
      if (idx >= 0) { const n = [...prev]; n[idx] = entry; return n }
      return [entry, ...prev]
    })
  }

  const handleSettle = (id) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, settled: true, settledAt: new Date().toISOString() } : e))
  }

  const handleDelete = (id) => {
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  const handleEdit = (entry) => {
    setEditing(entry)
    setShowModal(true)
  }

  const FILTERS = [
    { id: 'all', label: '📋 Active', count: entries.filter(e => !e.settled).length },
    { id: 'lent', label: '↑ Lent', count: entries.filter(e => e.type === 'lent' && !e.settled).length },
    { id: 'borrowed', label: '↓ Borrowed', count: entries.filter(e => e.type === 'borrowed' && !e.settled).length },
    { id: 'overdue', label: '⚠ Overdue', count: overdue.length },
    { id: 'settled', label: '✓ Settled', count: entries.filter(e => e.settled).length },
  ]

  return (
    <>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;700&display=swap');
      .ledger-root { font-family:'DM Sans',sans-serif; color:#f1f5f9; }
      @keyframes fadeIn       { from{opacity:0} to{opacity:1} }
      @keyframes slideUp      { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
      @keyframes ledgerSlideIn{ from{opacity:0;transform:translateX(-12px)} to{opacity:1;transform:translateX(0)} }
      @keyframes slideUpModal { from{transform:translateY(100%)} to{transform:translateY(0)} }
      @keyframes ledgerPulse  { 0%,100%{opacity:1} 50%{opacity:0.5} }
      @keyframes floatY       { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
      @keyframes counterUp    { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
      .ledger-card-hover { transition:transform 0.2s,box-shadow 0.2s; }
      .ledger-card-hover:hover { transform:translateY(-2px); box-shadow:0 12px 32px rgba(0,0,0,0.35)!important; }
      input::placeholder { color:rgba(255,255,255,0.2)!important; }
      @media(max-width:640px){ .ledger-desk-add{display:none!important;} }
      select option { background:#0d0b2e!important; }
      ::-webkit-scrollbar { width:3px; }
      ::-webkit-scrollbar-thumb { background:rgba(167,139,250,0.25); border-radius:3px; }
    `}</style>

    <div className="ledger-root" style={{ maxWidth: 900, margin: '0 auto', paddingBottom: 100 }}>

      {/* ── FLOATING ADD BUTTON ── */}
      <div style={{ position: 'fixed', bottom: 90, right: 18, zIndex: 300 }}>
        <button onClick={() => { setEditing(null); setShowModal(true) }}
          style={{
            width: 56, height: 56, borderRadius: '50%', border: 'none',
            background: 'linear-gradient(135deg,#7c3aed,#4f46e5)',
            color: '#fff', fontSize: 26, cursor: 'pointer',
            boxShadow: '0 6px 24px rgba(124,58,237,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.25s',
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
          ＋
        </button>
      </div>

      {/* ── HEADER — compact ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, animation: 'slideUp 0.4s ease-out both' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/logo.jpg" alt="ACR MAX" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid rgba(167,139,250,0.4)', flexShrink: 0 }} />
          <div>
            <h2 style={{ fontFamily: 'Syne,sans-serif', fontSize: 20, fontWeight: 800, margin: '0 0 1px', background: 'linear-gradient(135deg,#fff 20%,#a78bfa 60%,#34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              🤝 Smart Ledger
            </h2>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', margin: 0 }}>ACR MAX · Lent · Borrowed · Reminders</p>
          </div>
        </div>
        {/* Desktop add button */}
        <button onClick={() => { setEditing(null); setShowModal(true) }}
          className="ledger-desk-add"
          style={{ padding: '9px 18px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 13, cursor: 'pointer', boxShadow: '0 4px 16px rgba(124,58,237,0.4)' }}>
          ＋ New Entry
        </button>
      </div>

      {/* Net balance — compact 3-col */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14, animation: 'slideUp 0.4s ease-out 0.05s both' }}>
        <div style={{ padding: '12px 10px', background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 14, textAlign: 'center' }}>
          <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px' }}>Receive</p>
          <p style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 16, color: '#34d399', margin: 0 }}>{fmt(totalLent)}</p>
        </div>
        <div style={{ padding: '12px 10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 14, textAlign: 'center' }}>
          <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px' }}>Pay</p>
          <p style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 16, color: '#f87171', margin: 0 }}>{fmt(totalBorrowed)}</p>
        </div>
        <div style={{ padding: '12px 10px', background: netBalance >= 0 ? 'rgba(52,211,153,0.06)' : 'rgba(239,68,68,0.06)', border: `1px solid ${netBalance >= 0 ? 'rgba(52,211,153,0.2)' : 'rgba(239,68,68,0.2)'}`, borderRadius: 14, textAlign: 'center' }}>
          <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px' }}>Net</p>
          <p style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 16, color: netBalance >= 0 ? '#34d399' : '#f87171', margin: 0 }}>{netBalance >= 0 ? '+' : ''}{fmt(Math.abs(netBalance))}</p>
        </div>
      </div>

      {/* ── ALERTS ── */}
      {(overdue.length > 0 || dueToday.length > 0) && (
        <div style={{ borderRadius: 16, padding: '14px 16px', marginBottom: 14, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', animation: 'slideUp 0.4s ease-out 0.1s both' }}>
          {overdue.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: dueToday.length ? 6 : 0 }}>
              <span style={{ fontSize: 16 }}>🚨</span>
              <p style={{ fontSize: 13, color: '#fca5a5', fontWeight: 700, margin: 0 }}>
                {overdue.length} payment{overdue.length > 1 ? 's' : ''} overdue — {overdue.map(e => e.person).join(', ')}
              </p>
            </div>
          )}
          {dueToday.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>🔔</span>
              <p style={{ fontSize: 13, color: '#fbbf24', fontWeight: 700, margin: 0 }}>
                Due today — {dueToday.map(e => e.person).join(', ')}
              </p>
            </div>
          )}
        </div>
      )}

      {dueSoon.length > 0 && (
        <div style={{ borderRadius: 16, padding: '12px 16px', marginBottom: 14, background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)', display: 'flex', alignItems: 'center', gap: 8, animation: 'slideUp 0.4s ease-out 0.15s both' }}>
          <span style={{ fontSize: 16 }}>⏰</span>
          <p style={{ fontSize: 13, color: '#fbbf24', fontWeight: 600, margin: 0 }}>
            {dueSoon.length} upcoming due within 7 days — {dueSoon.map(e => `${e.person} (${DAYS_LEFT(e.dueDate)}d)`).join(', ')}
          </p>
        </div>
      )}

      {/* ── FILTER TABS ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none', animation: 'slideUp 0.4s ease-out 0.2s both' }}>
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            style={{ padding: '8px 14px', borderRadius: 20, fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap', cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'DM Sans,sans-serif', border: 'none', background: filter === f.id ? 'linear-gradient(135deg,#7c3aed,#4f46e5)' : 'rgba(255,255,255,0.06)', color: filter === f.id ? '#fff' : 'rgba(255,255,255,0.4)', boxShadow: filter === f.id ? '0 3px 14px rgba(124,58,237,0.4)' : 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
            {f.label}
            {f.count > 0 && <span style={{ background: filter === f.id ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '1px 7px', fontSize: 10 }}>{f.count}</span>}
          </button>
        ))}
      </div>

      {/* ── SEARCH + SORT ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, animation: 'slideUp 0.4s ease-out 0.25s both' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'rgba(255,255,255,0.25)', pointerEvents: 'none' }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search person or note…"
            style={{ width: '100%', padding: '11px 14px 11px 38px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 12, color: '#fff', fontSize: 13, outline: 'none', fontFamily: 'DM Sans,sans-serif' }} />
        </div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
          style={{ padding: '11px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 12, color: '#fff', fontSize: 13, outline: 'none', cursor: 'pointer', fontFamily: 'DM Sans,sans-serif' }}>
          <option value="date" style={{ background: '#0d0b2e' }}>Latest</option>
          <option value="amount" style={{ background: '#0d0b2e' }}>Highest</option>
          <option value="due" style={{ background: '#0d0b2e' }}>Due Date</option>
        </select>
      </div>

      {/* ── ENTRIES LIST ── */}
      {!loaded ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: 'rgba(255,255,255,0.2)' }}>
          <div style={{ fontSize: 40, marginBottom: 12, animation: 'floatY 3s ease-in-out infinite' }}>🤝</div>
          <p style={{ fontWeight: 700, fontSize: 14 }}>Loading your ledger…</p>
        </div>
      ) : visible.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '52px 20px', color: 'rgba(255,255,255,0.18)', animation: 'slideUp 0.4s ease-out both' }}>
          <div style={{ fontSize: 52, marginBottom: 14, animation: 'floatY 4s ease-in-out infinite' }}>🤝</div>
          <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
            {filter === 'settled' ? 'No settled entries yet' : filter === 'overdue' ? 'No overdue entries! 🎉' : 'No entries yet'}
          </p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.12)', marginBottom: 20 }}>
            {filter === 'all' ? 'Tap "+ New Entry" to start tracking' : 'Try a different filter'}
          </p>
          {filter === 'all' && (
            <button onClick={() => { setEditing(null); setShowModal(true) }}
              style={{ padding: '12px 24px', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 20px rgba(124,58,237,0.4)' }}>
              ＋ Add First Entry
            </button>
          )}
        </div>
      ) : (
        <div>
          {visible.map((entry, i) => (
            <div key={entry.id} style={{ animationDelay: `${i * 40}ms` }}>
              <EntryCard entry={entry} onSettle={handleSettle} onDelete={handleDelete} onEdit={handleEdit} />
            </div>
          ))}
          <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.18)', marginTop: 16, fontWeight: 500 }}>
            {visible.length} entr{visible.length === 1 ? 'y' : 'ies'} · Synced across all devices
          </p>
        </div>
      )}

      {showModal && (
        <EntryModal
          editing={editing}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditing(null) }}
        />
      )}
    </div>
    </>
  )
}