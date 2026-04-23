// src/pages/Ledger.jsx  (full replacement)
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { db } from '../firebase'
import { doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore'
import { exportAllLedger, exportPersonLedger, exportPendingLedger, shareNativeLedgerPdf } from '../utils/ledgerPdf'

/* ══════════════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════════════ */
const fmt      = (n) => `₹${Math.abs(Number(n)).toLocaleString('en-IN')}`
const TODAY    = ()  => new Date().toISOString().slice(0, 10)
const fmtDate  = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day:'numeric', month:'short' }) : '—'
const fmtDateL = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' }) : '—'
const DAYS_LEFT = (due) => {
  if (!due) return null
  return Math.ceil((new Date(due) - new Date()) / 86400000)
}
const normName = (n) => n.trim().toLowerCase()
const capName  = (n) => n.trim().replace(/\b\w/g, c => c.toUpperCase())

const COLORS = ['#f87171','#fb923c','#fbbf24','#34d399','#60a5fa','#a78bfa','#f472b6','#e879f9']
const CATEGORIES = ['Friend','Family','Relative','Tenant','Colleague','Business','Other']
const REASON_TAGS = ['Rent','Emergency','Travel','Food','Recharge','Shopping','Medical','Family','Business','School','Salary Advance','Loan Return','Other']

const colorForName = (name) => {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return COLORS[Math.abs(h) % COLORS.length]
}

/* ══════════════════════════════════════════════════════════════════════
   GROUP ENTRIES → PERSON ACCOUNTS
══════════════════════════════════════════════════════════════════════ */
function buildPersonAccounts(entries) {
  const map = new Map()   // normName → account

  entries.forEach(entry => {
    const key = normName(entry.person)
    if (!map.has(key)) {
      map.set(key, {
        key,
        name: capName(entry.person),
        color: entry.color || colorForName(entry.person),
        phone: '',
        entries: [],
      })
    }
    const acc = map.get(key)
    // keep latest phone
    if (entry.phone) acc.phone = entry.phone
    // keep color from most recent entry
    if (entry.color) acc.color = entry.color
    acc.entries.push(entry)
  })

  // compute derived fields per account
  const accounts = []
  map.forEach(acc => {
    const active    = acc.entries.filter(e => !e.settled)
    const lentAmt   = active.filter(e => e.type==='lent').reduce((s,e)=>s+e.amount, 0)
    const borAmt    = active.filter(e => e.type==='borrowed').reduce((s,e)=>s+e.amount, 0)
    const net       = lentAmt - borAmt
    const settledAmt= acc.entries.filter(e=>e.settled).reduce((s,e)=>s+e.amount, 0)

    // nearest due date
    const dueDates = active.filter(e=>e.dueDate).map(e=>({ d: DAYS_LEFT(e.dueDate), date: e.dueDate }))
    dueDates.sort((a,b)=>a.d-b.d)
    const nearestDue = dueDates[0] || null

    const latestDate = acc.entries.reduce((latest, e) => {
      const d = e.createdAt || e.date
      return d > latest ? d : latest
    }, '')

    accounts.push({
      ...acc,
      lentAmt, borAmt, net, settledAmt,
      nearestDue,
      latestDate,
      totalEntries: acc.entries.length,
      activeEntries: active.length,
      isFullySettled: active.length === 0 && acc.entries.length > 0,
      hasOverdue: active.some(e=>e.dueDate&&DAYS_LEFT(e.dueDate)<0),
      hasDueToday: active.some(e=>e.dueDate&&DAYS_LEFT(e.dueDate)===0),
    })
  })

  return accounts
}

/* ══════════════════════════════════════════════════════════════════════
   FIRESTORE HOOK  (unchanged data model)
══════════════════════════════════════════════════════════════════════ */
function useLedger(username) {
  const [entries, setEntries]   = useState([])
  const [loaded,  setLoaded]    = useState(false)
  const saveTimer = useRef(null)

  useEffect(() => {
    if (!username) return
    const ref  = doc(db, 'acr_ledger', username.toLowerCase())
    const unsub = onSnapshot(ref, (snap) => {
      setEntries(snap.exists() ? (snap.data().entries || []) : [])
      setLoaded(true)
    }, (e) => console.error('Ledger sync:', e.message))
    return () => { unsub(); clearTimeout(saveTimer.current) }
  }, [username])

  const save = useCallback((newEntries) => {
    if (!loaded) return
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      try {
        await setDoc(doc(db, 'acr_ledger', username.toLowerCase()), {
          entries: newEntries, updatedAt: serverTimestamp(),
        })
      } catch (e) { console.error('Ledger save:', e.message) }
    }, 500)
  }, [loaded, username])

  const setAndSave = useCallback((fn) => {
    setEntries(prev => {
      const next = typeof fn === 'function' ? fn(prev) : fn
      save(next)
      return next
    })
  }, [save])

  return { entries, setEntries: setAndSave, loaded }
}

/* ══════════════════════════════════════════════════════════════════════
   SHARED UI ATOMS
══════════════════════════════════════════════════════════════════════ */
function Avatar({ name, color, size = 40 }) {
  const initials = name.trim().split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2)
  return (
    <div style={{
      width:size, height:size, borderRadius:'50%', background:color, flexShrink:0,
      display:'flex', alignItems:'center', justifyContent:'center',
      fontWeight:800, fontSize:size*0.34, color:'#fff',
      boxShadow:'3px 3px 8px rgba(0,0,0,0.15),-1px -1px 4px rgba(255,255,255,0.6)',
    }}>{initials}</div>
  )
}

function DueBadge({ daysLeft, settled }) {
  if (settled) return <span style={badge('#dcfce7','#16a34a','#bbf7d0')}>✓ SETTLED</span>
  if (daysLeft === null) return null
  if (daysLeft < 0)  return <span style={{...badge('#fee2e2','#dc2626','#fca5a5'), animation:'ldgPulse 2s infinite'}}>⚠ OVERDUE {Math.abs(daysLeft)}d</span>
  if (daysLeft === 0) return <span style={{...badge('#fef9c3','#ca8a04','#fde68a'), animation:'ldgPulse 1.5s infinite'}}>🔔 DUE TODAY</span>
  if (daysLeft <= 3)  return <span style={badge('#fef9c3','#ca8a04','#fde68a')}>⏰ {daysLeft}d left</span>
  return <span style={badge('#dbeafe','#1d4ed8','#bfdbfe')}>📅 {daysLeft}d left</span>
}
const badge = (bg,col,br) => ({ padding:'2px 7px', borderRadius:14, fontSize:9, fontWeight:800, background:bg, color:col, border:`1px solid ${br}`, whiteSpace:'nowrap', lineHeight:1.15 })

/* ══════════════════════════════════════════════════════════════════════
   PERSON ACCOUNT CARD  (main list)
══════════════════════════════════════════════════════════════════════ */
function PersonCard({ account, onClick }) {
  const isReceivable = account.net > 0
  const isPayable    = account.net < 0
  const accent = account.isFullySettled ? '#16a34a' : isReceivable ? '#16a34a' : isPayable ? '#dc2626' : '#6b7280'
  const isUrgent = account.hasOverdue || account.hasDueToday

  const nearestDaysLeft = account.nearestDue ? account.nearestDue.d : null
  const cardAlert =
    account.isFullySettled ? { label:'✓ Clear', bg:'#dcfce7', color:'#16a34a', border:'#bbf7d0' } :
    account.hasOverdue ? { label:'Overdue', bg:'#fee2e2', color:'#dc2626', border:'#fca5a5' } :
    account.hasDueToday ? { label:'Due today', bg:'#fef9c3', color:'#ca8a04', border:'#fde68a' } :
    nearestDaysLeft !== null && nearestDaysLeft > 0 && nearestDaysLeft <= 7 ? { label:`${nearestDaysLeft}d left`, bg:'#fffbeb', color:'#b45309', border:'#fde68a' } :
    null

  return (
    <div onClick={onClick} style={{
      width:'100%',
      boxSizing:'border-box',
      borderRadius:12,
      background:'linear-gradient(135deg,#f8f8f8 0%,#e2e2e2 40%,#f0f0f0 100%)',
      boxShadow: isUrgent
        ? '4px 4px 10px rgba(220,38,38,0.12),-2px -2px 6px rgba(255,255,255,0.92)'
        : '4px 4px 10px rgba(0,0,0,0.08),-2px -2px 6px rgba(255,255,255,0.92)',
      border:`1px solid ${isUrgent?'rgba(252,165,165,0.6)':'rgba(255,255,255,0.8)'}`,
      borderLeft:`3px solid ${accent}`,
      marginBottom:6, cursor:'pointer',
      animation:'ldgSlideIn 0.3s ease-out both',
      transition:'transform 0.15s, box-shadow 0.15s',
    }}
      onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow='6px 6px 14px rgba(0,0,0,0.11),-2px -2px 6px rgba(255,255,255,0.92)'}}
      onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow=isUrgent?'4px 4px 10px rgba(220,38,38,0.12),-2px -2px 6px rgba(255,255,255,0.92)':'4px 4px 10px rgba(0,0,0,0.08),-2px -2px 6px rgba(255,255,255,0.92)'}}
    >
      <div style={{ minHeight:50, padding:'7px 9px', display:'flex', alignItems:'center', gap:8, width:'100%', boxSizing:'border-box' }}>
        <Avatar name={account.name} color={account.color} size={34} />
        <div style={{ flex:'1 1 auto', minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:5, flexWrap:'nowrap', marginBottom:1, minWidth:0 }}>
            <span style={{ fontFamily:'Poppins,sans-serif', fontWeight:800, color:'#1a1a1a', fontSize:12.5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', minWidth:0 }}>{account.name}</span>
            {cardAlert && (
              <span style={{
                padding:'1px 5px', borderRadius:10, fontSize:8, fontWeight:800, lineHeight:1.15,
                background:cardAlert.bg, color:cardAlert.color, border:`1px solid ${cardAlert.border}`,
                whiteSpace:'nowrap', flexShrink:0,
              }}>{cardAlert.label}</span>
            )}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:5, flexWrap:'wrap' }}>
            <span style={{ fontSize:9.5, color:'#6b7280', fontFamily:'Poppins,sans-serif' }}>
              {account.totalEntries} entr{account.totalEntries===1?'y':'ies'}
            </span>
            <span style={{ fontSize:9.5, color:'#d1d5db' }}>·</span>
            <span style={{ fontSize:9.5, color:'#6b7280', fontFamily:'Poppins,sans-serif' }}>
              {fmtDate(account.latestDate)}
            </span>
          </div>
        </div>
        <div style={{ textAlign:'right', flex:'0 0 auto', minWidth:74 }}>
          {account.isFullySettled ? (
            <p style={{ fontFamily:'Poppins,sans-serif', fontWeight:800, fontSize:12.5, color:'#16a34a', margin:0 }}>All Clear</p>
          ) : account.net !== 0 ? (
            <>
              <p style={{ fontFamily:'Poppins,sans-serif', fontWeight:800, fontSize:13, color:'#b8860b', margin:0, lineHeight:1.1 }}>{fmt(Math.abs(account.net))}</p>
              <p style={{ fontSize:8.5, color: isReceivable?'#16a34a':'#dc2626', margin:'1px 0 0', fontWeight:800, fontFamily:'Poppins,sans-serif', lineHeight:1.1 }}>
                {isReceivable ? '↑ you receive' : '↓ you pay'}
              </p>
            </>
          ) : (
            <p style={{ fontFamily:'Poppins,sans-serif', fontWeight:700, fontSize:12, color:'#6b7280', margin:0 }}>Even</p>
          )}
          <p style={{ fontSize:9, color:'#9ca3af', margin:'1px 0 0', fontFamily:'Poppins,sans-serif' }}>›</p>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   TRANSACTION ROW  (inside person detail)
══════════════════════════════════════════════════════════════════════ */
function TxRow({ entry, onSettle, onDelete, onEdit }) {
  const [open, setOpen] = useState(false)
  const isLent  = entry.type === 'lent'
  const accent  = isLent ? '#16a34a' : '#dc2626'
  const daysLeft = DAYS_LEFT(entry.dueDate)

  return (
    <div style={{
      borderRadius:12,
      background:'linear-gradient(135deg,#f8f8f8,#ebebeb)',
      boxShadow:'4px 4px 10px rgba(0,0,0,0.08),-2px -2px 6px rgba(255,255,255,0.9)',
      border:`1px solid rgba(255,255,255,0.8)`,
      borderLeft:`3px solid ${entry.settled?'#16a34a':accent}`,
      marginBottom:7,
      opacity:entry.settled?0.72:1,
    }}>
      <div style={{ padding:'8px 10px', display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}
        onClick={()=>setOpen(o=>!o)}>
        <div style={{ width:30, height:30, borderRadius:9, background:isLent?'#dcfce7':'#fee2e2', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0 }}>
          {isLent?'↑':'↓'}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:5, flexWrap:'wrap', marginBottom:1 }}>
            <span style={{ fontSize:11, fontWeight:800, color:accent, fontFamily:'Poppins,sans-serif' }}>{isLent?'Lent':'Borrowed'}</span>
            {entry.category && <span style={{ fontSize:9, color:'#9ca3af', fontFamily:'Poppins,sans-serif' }}>{entry.category}</span>}
            <DueBadge daysLeft={entry.settled?null:daysLeft} settled={entry.settled} />
          </div>
          <p style={{ fontSize:10, color:'#6b7280', margin:0, fontFamily:'Poppins,sans-serif', lineHeight:1.25 }}>
            {fmtDate(entry.date)}
            {entry.note ? ` · ${entry.note}` : ''}
          </p>
        </div>
        <div style={{ textAlign:'right', flexShrink:0 }}>
          <p style={{ fontFamily:'Poppins,sans-serif', fontWeight:800, fontSize:13, color:'#b8860b', margin:0 }}>{fmt(entry.amount)}</p>
          <p style={{ fontSize:9, color:'#9ca3af', margin:'1px 0 0' }}>{open?'▲':'▼'}</p>
        </div>
      </div>
      {open && (
        <div style={{ padding:'8px 10px 10px', borderTop:'1px solid rgba(0,0,0,0.05)' }}>
          {entry.dueDate && (
            <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:6, fontSize:10, color:'#6b7280', fontFamily:'Poppins,sans-serif' }}>
              <span>📅</span> Due: <strong style={{ color:'#1a1a1a' }}>{fmtDateL(entry.dueDate)}</strong>
            </div>
          )}
          <div style={{ display:'flex', gap:8 }}>
            {!entry.settled && (
              <button onClick={()=>onSettle(entry.id)} style={actionBtn('#dcfce7','#16a34a','#bbf7d0')}>✓ Settled</button>
            )}
            <button onClick={()=>onEdit(entry)} style={actionBtn('#f0f0f3','#475569','#e2e8f0')}>✏ Edit</button>
            <button onClick={()=>onDelete(entry.id)} style={actionBtn('#fee2e2','#dc2626','#fca5a5')}>🗑</button>
          </div>
        </div>
      )}
    </div>
  )
}
const actionBtn = (bg,col,br) => ({
  flex:1, padding:'7px 9px', borderRadius:9, border:`1px solid ${br}`,
  background:bg, color:col, fontSize:11, fontWeight:800,
  fontFamily:'Poppins,sans-serif', cursor:'pointer',
  boxShadow:'2px 2px 5px rgba(0,0,0,0.07),-1px -1px 3px rgba(255,255,255,0.9)',
})

/* ══════════════════════════════════════════════════════════════════════
   PERSON DETAIL DRAWER
══════════════════════════════════════════════════════════════════════ */
function PersonDetail({ account, allEntries, onClose, onSave, onSettle, onDelete, onEdit, onExport }) {
  const [addOpen, setAddOpen]   = useState(false)
  const [editEntry, setEditEntry] = useState(null)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [settleAll, setSettleAll] = useState(false)

  const entries = allEntries.filter(e => normName(e.person) === account.key)
  const sorted  = [...entries].sort((a,b) => new Date(b.createdAt||b.date) - new Date(a.createdAt||a.date))

  const lentTotal   = entries.filter(e=>e.type==='lent'&&!e.settled).reduce((s,e)=>s+e.amount,0)
  const borTotal    = entries.filter(e=>e.type==='borrowed'&&!e.settled).reduce((s,e)=>s+e.amount,0)
  const settledAmt  = entries.filter(e=>e.settled).reduce((s,e)=>s+e.amount,0)
  const net         = lentTotal - borTotal

  const pendingEntries = entries.filter(e=>!e.settled)
  const waMsg = `Hi ${account.name}, this is a gentle reminder about ₹${fmt(Math.abs(net))} pending between us. Please let me know when you're able to settle. Thank you! 🙏`

  const handleSettleAll = () => {
    pendingEntries.forEach(e => onSettle(e.id))
    setSettleAll(false)
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:400, background:'rgba(0,0,0,0.45)', backdropFilter:'blur(8px)', display:'flex', alignItems:'flex-end', justifyContent:'center', animation:'fadeIn 0.2s ease-out' }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{
        width:'100%', maxWidth:520,
        background:'linear-gradient(160deg,#f8f8f8,#ebebeb)',
        borderRadius:'18px 18px 0 0', padding:'0 0 24px',
        maxHeight:'94vh', display:'flex', flexDirection:'column',
        boxShadow:'0 -8px 40px rgba(0,0,0,0.18)',
        animation:'ldgSlideUpModal 0.35s cubic-bezier(.34,1.1,.64,1) both',
      }}>
        {/* Handle */}
        <div style={{ width:36, height:4, borderRadius:2, background:'#d1d5db', margin:'8px auto 0', flexShrink:0 }} />

        {/* Header */}
        <div style={{ padding:'11px 14px 10px', flexShrink:0, borderBottom:'1px solid rgba(0,0,0,0.06)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:9 }}>
            <Avatar name={account.name} color={account.color} size={40} />
            <div style={{ flex:1 }}>
              <h3 style={{ fontFamily:'Poppins,sans-serif', fontWeight:800, fontSize:16, margin:'0 0 2px', color:'#1a1a1a' }}>{account.name}</h3>
              <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
                {account.phone && (
                  <>
                    <a href={`tel:${account.phone}`} style={{ fontSize:11, color:'#1d4ed8', fontWeight:600, textDecoration:'none', fontFamily:'Poppins,sans-serif' }}>{account.phone}</a>
                    <a href={`https://wa.me/91${account.phone.replace(/\D/g,'')}?text=${encodeURIComponent(waMsg)}`} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize:9, fontWeight:800, padding:'2px 8px', borderRadius:9, background:'#dcfce7', color:'#16a34a', border:'1px solid #bbf7d0', textDecoration:'none', fontFamily:'Poppins,sans-serif' }}>
                      💬 WhatsApp
                    </a>
                  </>
                )}
                {account.isFullySettled && <span style={badge('#dcfce7','#16a34a','#bbf7d0')}>✓ ALL CLEAR</span>}
              </div>
            </div>
            <button onClick={onClose} style={{ width:28, height:28, borderRadius:8, border:'1px solid #e2e8f0', background:'linear-gradient(145deg,#f5f5f5,#e0e0e0)', boxShadow:'2px 2px 5px rgba(0,0,0,0.08)', color:'#6b7280', fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
          </div>

          {/* Summary chips */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
            {[
              { label:'Will Receive', value:fmt(lentTotal), color:'#16a34a' },
              { label:'Will Pay',     value:fmt(borTotal),  color:'#dc2626' },
              { label: net>=0?'Net Receivable':'Net Payable', value:(net>=0?'+':'-')+fmt(Math.abs(net)), color:net>=0?'#16a34a':'#dc2626' },
            ].map((s,i) => (
              <div key={i} style={{ padding:'7px 6px', background:'linear-gradient(145deg,#f5f5f5,#e0e0e0)', borderRadius:10, textAlign:'center', boxShadow:'2px 2px 6px rgba(0,0,0,0.08),-1px -1px 4px rgba(255,255,255,0.9)' }}>
                <p style={{ fontSize:8, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.06em', margin:'0 0 3px', fontFamily:'Poppins,sans-serif', fontWeight:800 }}>{s.label}</p>
                <p style={{ fontFamily:'Poppins,sans-serif', fontWeight:800, fontSize:12, color:'#b8860b', margin:0 }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Settled summary if any */}
          {settledAmt > 0 && (
            <p style={{ fontSize:10, color:'#9ca3af', fontFamily:'Poppins,sans-serif', margin:'6px 0 0', textAlign:'center' }}>
              ✓ {fmt(settledAmt)} settled across {entries.filter(e=>e.settled).length} entries
            </p>
          )}
        </div>

        {/* Action bar */}
        <div style={{ display:'flex', gap:7, padding:'9px 14px', flexShrink:0, borderBottom:'1px solid rgba(0,0,0,0.06)', background:'linear-gradient(145deg,#f0f0f0,#e8e8e8)' }}>
          <button onClick={() => { setEditEntry(null); setAddOpen(true) }} style={{ flex:2, ...quickBtn('#7c3aed','#fff') }}>＋ Add Entry</button>
          {pendingEntries.length > 1 && (
            <button onClick={() => setSettleAll(true)} style={{ flex:2, ...quickBtn('#16a34a','#fff') }}>✓ Settle All</button>
          )}
          <div style={{ position:'relative', flex:1, zIndex:4600, overflow:'visible' }}>
            <button onClick={() => setShowExportMenu(m=>!m)} style={{ width:'100%', ...quickBtn('#475569','#fff') }}>↓ PDF</button>
            {showExportMenu && (
              <div style={{ position:'absolute', bottom:'calc(100% + 6px)', right:0, background:'#fff', border:'1px solid #e2e8f0', borderRadius:10, boxShadow:'0 14px 34px rgba(15,23,42,0.2)', overflow:'visible', zIndex:4700, minWidth:160 }}>
                {[
                  ['This account', () => onExport('person', account.name)],
                  ['All pending',  () => onExport('pending')],
                  ['Full ledger',  () => onExport('all')],
                ].map(([label, fn]) => (
                  <button key={label} onClick={() => { fn(); setShowExportMenu(false) }}
                    style={{ display:'block', width:'100%', padding:'9px 13px', background:'none', border:'none', textAlign:'left', fontSize:12, fontFamily:'Poppins,sans-serif', fontWeight:700, color:'#1a1a1a', cursor:'pointer' }}>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Transaction list */}
        <div style={{ overflowY:'auto', flex:1, padding:'10px 14px' }}>
          <p style={{ fontSize:10, fontWeight:800, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.08em', margin:'0 0 8px', fontFamily:'Poppins,sans-serif' }}>
            Transaction History · {entries.length} entr{entries.length===1?'y':'ies'}
          </p>
          {sorted.length === 0 ? (
            <p style={{ textAlign:'center', color:'#9ca3af', fontSize:12, padding:'18px 0', fontFamily:'Poppins,sans-serif' }}>No transactions yet.</p>
          ) : (
            sorted.map(entry => (
              <TxRow key={entry.id} entry={entry}
                onSettle={onSettle}
                onDelete={onDelete}
                onEdit={(e) => { setEditEntry(e); setAddOpen(true) }}
              />
            ))
          )}
        </div>
      </div>

      {/* Settle-all confirm */}
      {settleAll && (
        <div style={{ position:'fixed', inset:0, zIndex:500, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:'#fff', borderRadius:20, padding:24, maxWidth:320, width:'100%', boxShadow:'0 8px 32px rgba(0,0,0,0.2)' }}>
            <p style={{ fontFamily:'Poppins,sans-serif', fontWeight:700, fontSize:15, color:'#1a1a1a', margin:'0 0 8px' }}>Settle all with {account.name}?</p>
            <p style={{ fontFamily:'Poppins,sans-serif', fontSize:13, color:'#6b7280', margin:'0 0 20px' }}>This will mark {pendingEntries.length} pending transactions as settled.</p>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setSettleAll(false)} style={{ flex:1, ...quickBtn('#e2e8f0','#475569') }}>Cancel</button>
              <button onClick={handleSettleAll} style={{ flex:1, ...quickBtn('#16a34a','#fff') }}>✓ Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit modal */}
      {addOpen && (
        <EntryModal
          editing={editEntry ? editEntry : { person: account.name, color: account.color, phone: account.phone }}
          prefillPerson={!editEntry}
          onSave={(entry) => { onSave(entry); setAddOpen(false); setEditEntry(null) }}
          onClose={() => { setAddOpen(false); setEditEntry(null) }}
        />
      )}
    </div>
  )
}

const quickBtn = (bg, col) => ({
  padding:'8px 10px', borderRadius:9, border:'none', cursor:'pointer',
  background:bg, color:col, fontSize:11, fontWeight:800,
  fontFamily:'Poppins,sans-serif',
  boxShadow:'3px 3px 7px rgba(0,0,0,0.1),-1px -1px 3px rgba(255,255,255,0.7)',
})

/* ══════════════════════════════════════════════════════════════════════
   ALERTS POPUP
══════════════════════════════════════════════════════════════════════ */
function AlertsPopup({ entries, onOpenPerson, onSettle, onClose }) {
  const groupByPerson = (items) => {
    const map = new Map()
    items.forEach(entry => {
      const key = normName(entry.person)
      if (!map.has(key)) {
        map.set(key, {
          key,
          name: capName(entry.person),
          phone: entry.phone || '',
          color: entry.color || colorForName(entry.person),
          items: [],
          lent: 0,
          borrowed: 0,
          minDays: DAYS_LEFT(entry.dueDate),
        })
      }
      const group = map.get(key)
      group.items.push(entry)
      if (!group.phone && entry.phone) group.phone = entry.phone
      if (entry.color) group.color = entry.color
      if (entry.type === 'lent') group.lent += Number(entry.amount || 0)
      else group.borrowed += Number(entry.amount || 0)
      const days = DAYS_LEFT(entry.dueDate)
      if (days !== null && (group.minDays === null || days < group.minDays)) group.minDays = days
    })

    return [...map.values()].sort((a,b) => (a.minDays ?? 999) - (b.minDays ?? 999))
  }

  const groups = useMemo(() => {
    const active = entries.filter(e => !e.settled && e.dueDate)
    const overdue   = active.filter(e => DAYS_LEFT(e.dueDate) < 0).sort((a,b)=>DAYS_LEFT(a.dueDate)-DAYS_LEFT(b.dueDate))
    const today     = active.filter(e => DAYS_LEFT(e.dueDate) === 0)
    const tomorrow  = active.filter(e => DAYS_LEFT(e.dueDate) === 1)
    const thisWeek  = active.filter(e => { const d=DAYS_LEFT(e.dueDate); return d>1&&d<=7 }).sort((a,b)=>DAYS_LEFT(a.dueDate)-DAYS_LEFT(b.dueDate))
    return {
      overdue: groupByPerson(overdue),
      today: groupByPerson(today),
      tomorrow: groupByPerson(tomorrow),
      thisWeek: groupByPerson(thisWeek),
    }
  }, [entries])

  const total = groups.overdue.length + groups.today.length + groups.tomorrow.length + groups.thisWeek.length

  const AlertRow = ({ group }) => {
    const net = group.lent - group.borrowed
    const isReceivable = net >= 0
    const amount = Math.abs(net || group.lent || group.borrowed)
    const d = group.minDays
    const status = d < 0 ? `Overdue ${Math.abs(d)}d` : d === 0 ? 'Due today' : d === 1 ? 'Due tomorrow' : `${d}d left`
    const direction = net === 0 ? 'mixed dues' : isReceivable ? 'owes you' : 'you owe'
    const waMsg = `Hi ${group.name}, just a reminder — ${fmt(amount)} is ${d < 0 ? 'overdue' : 'due'} between us. Please let me know. 🙏`
    return (
      <div style={{ padding:'8px 10px', background:'linear-gradient(145deg,#f8f8f8,#ebebeb)', borderRadius:10, marginBottom:6, boxShadow:'2px 2px 6px rgba(0,0,0,0.06),-1px -1px 4px rgba(255,255,255,0.9)', borderLeft:`3px solid ${isReceivable?'#16a34a':'#dc2626'}` }}>
        <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:5 }}>
          <Avatar name={group.name} color={group.color} size={26} />
          <div style={{ flex:1 }}>
            <span style={{ fontFamily:'Poppins,sans-serif', fontWeight:800, fontSize:12, color:'#1a1a1a' }}>{group.name}</span>
            <span style={{ fontSize:10, color:'#6b7280', marginLeft:5, fontFamily:'Poppins,sans-serif' }}>{direction}</span>
            {group.items.length > 1 && <span style={{ marginLeft:5, ...badge('#f1f5f9','#475569','#e2e8f0') }}>{group.items.length} items</span>}
          </div>
          <div style={{ textAlign:'right' }}>
            <p style={{ fontFamily:'Poppins,sans-serif', fontWeight:800, fontSize:13, color:'#b8860b', margin:0 }}>{fmt(amount)}</p>
            <p style={{ fontFamily:'Poppins,sans-serif', fontWeight:800, fontSize:9, color:d<0?'#dc2626':'#ca8a04', margin:'1px 0 0' }}>{status}</p>
          </div>
        </div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          <button onClick={()=>{ onOpenPerson(group.key); onClose() }} style={{ fontSize:10, fontWeight:800, padding:'4px 8px', borderRadius:8, border:'1px solid #e2e8f0', background:'#f0f0f3', color:'#475569', cursor:'pointer', fontFamily:'Poppins,sans-serif' }}>Open Account</button>
          {group.phone && (
            <a href={`https://wa.me/91${group.phone.replace(/\D/g,'')}?text=${encodeURIComponent(waMsg)}`} target="_blank" rel="noopener noreferrer"
              style={{ fontSize:10, fontWeight:800, padding:'4px 8px', borderRadius:8, border:'1px solid #bbf7d0', background:'#dcfce7', color:'#16a34a', textDecoration:'none', fontFamily:'Poppins,sans-serif' }}>
              💬 Remind
            </a>
          )}
          <button onClick={()=>group.items.forEach(entry => onSettle(entry.id))} style={{ fontSize:10, fontWeight:800, padding:'4px 8px', borderRadius:8, border:'1px solid #fca5a5', background:'#fee2e2', color:'#dc2626', cursor:'pointer', fontFamily:'Poppins,sans-serif' }}>✓ Settle</button>
        </div>
      </div>
    )
  }

  const Section = ({ title, items, accent }) => {
    if (!items.length) return null
    return (
      <div style={{ marginBottom:11 }}>
        <p style={{ fontSize:10, fontWeight:800, color:accent, textTransform:'uppercase', letterSpacing:'0.08em', margin:'0 0 6px', fontFamily:'Poppins,sans-serif' }}>{title} · {items.length}</p>
        {items.map(group => <AlertRow key={group.key} group={group} />)}
      </div>
    )
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:350, background:'rgba(0,0,0,0.4)', backdropFilter:'blur(6px)', display:'flex', alignItems:'flex-end', justifyContent:'center', animation:'fadeIn 0.2s ease-out' }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{
        width:'100%', maxWidth:520,
        background:'linear-gradient(160deg,#f8f8f8,#ebebeb)',
        borderRadius:'18px 18px 0 0', maxHeight:'90vh', display:'flex', flexDirection:'column',
        boxShadow:'0 -8px 40px rgba(0,0,0,0.15)',
        animation:'ldgSlideUpModal 0.3s cubic-bezier(.34,1.1,.64,1) both',
      }}>
        <div style={{ padding:'11px 14px 9px', flexShrink:0, borderBottom:'1px solid rgba(0,0,0,0.06)' }}>
          <div style={{ width:36, height:4, borderRadius:2, background:'#d1d5db', margin:'0 auto 10px' }} />
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <h3 style={{ fontFamily:'Poppins,sans-serif', fontWeight:800, fontSize:15, margin:0, color:'#1a1a1a' }}>🔔 Due Alerts</h3>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              {total > 0 && <span style={{ ...badge('#fee2e2','#dc2626','#fca5a5') }}>{total} pending</span>}
              <button onClick={onClose} style={{ width:28, height:28, borderRadius:8, border:'1px solid #e2e8f0', background:'linear-gradient(145deg,#f5f5f5,#e0e0e0)', color:'#6b7280', fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
            </div>
          </div>
        </div>

        <div style={{ overflowY:'auto', flex:1, padding:'10px 14px' }}>
          {total === 0 ? (
            <div style={{ textAlign:'center', padding:'40px 0', color:'#9ca3af' }}>
              <div style={{ fontSize:40, marginBottom:10 }}>🎉</div>
              <p style={{ fontFamily:'Poppins,sans-serif', fontWeight:700, fontSize:14, color:'#374151', margin:0 }}>No due alerts!</p>
              <p style={{ fontFamily:'Poppins,sans-serif', fontSize:12, color:'#9ca3af', marginTop:4 }}>All entries are on track or have no due date.</p>
            </div>
          ) : (
            <>
              <Section title="Overdue"    items={groups.overdue}   accent="#dc2626" />
              <Section title="Due Today"  items={groups.today}     accent="#ca8a04" />
              <Section title="Tomorrow"   items={groups.tomorrow}  accent="#ca8a04" />
              <Section title="This Week"  items={groups.thisWeek}  accent="#1d4ed8" />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   ADD / EDIT MODAL
══════════════════════════════════════════════════════════════════════ */
function EntryModal({ editing, prefillPerson, onSave, onClose }) {
  const [form, setForm] = useState(() => ({
    type: 'lent', person: '', amount: '', category: 'Friend',
    date: TODAY(), dueDate: '', note: '', phone: '',
    color: COLORS[Math.floor(Math.random()*COLORS.length)],
    ...editing,
    amount: editing?.amount != null ? String(editing.amount) : '',
  }))
  const set = (k,v) => setForm(f=>({...f,[k]:v}))
  const [error, setError] = useState('')

  const handleSave = () => {
    if (!form.person.trim())          { setError('Name is required'); return }
    if (!form.amount||Number(form.amount)<=0) { setError('Valid amount required'); return }
    onSave({
      ...form, amount:Number(form.amount),
      id: form.id || Date.now(),
      settled: form.settled || false,
      createdAt: form.createdAt || new Date().toISOString(),
    })
  }

  const inputSt = {
    width:'100%', padding:'10px 12px',
    background:'linear-gradient(145deg,#e8e8e8,#ffffff)',
    boxShadow:'inset 3px 3px 7px rgba(0,0,0,0.1),inset -2px -2px 5px rgba(255,255,255,0.9)',
    border:'1px solid #e2e8f0', borderRadius:10, color:'#1a1a1a',
    fontSize:13, outline:'none', fontFamily:'Poppins,sans-serif', fontWeight:600,
    boxSizing:'border-box',
  }
  const Lbl = ({t}) => (
    <label style={{ display:'block', fontSize:9, fontWeight:800, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:5, fontFamily:'Poppins,sans-serif' }}>{t}</label>
  )

  return (
    <div style={{ position:'fixed', inset:0, zIndex:500, background:'rgba(0,0,0,0.45)', backdropFilter:'blur(8px)', display:'flex', alignItems:'flex-end', justifyContent:'center', animation:'fadeIn 0.2s ease-out' }}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{
        width:'100%', maxWidth:500,
        background:'linear-gradient(160deg,#f8f8f8,#ebebeb)',
        borderRadius:'18px 18px 0 0', padding:'14px 14px 24px',
        maxHeight:'94vh', overflowY:'auto',
        boxShadow:'0 -8px 40px rgba(0,0,0,0.15)',
        animation:'ldgSlideUpModal 0.35s cubic-bezier(.34,1.1,.64,1) both',
      }}>
        <div style={{ width:36, height:4, borderRadius:2, background:'#d1d5db', margin:'-2px auto 11px' }} />

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <p style={{ fontFamily:'Poppins,sans-serif', fontWeight:800, color:'#1a1a1a', fontSize:15, margin:0 }}>
            {editing?.id ? '✏ Edit Entry' : '＋ New Entry'}
          </p>
          <button onClick={onClose} style={{ width:28, height:28, borderRadius:8, border:'1px solid #e2e8f0', background:'linear-gradient(145deg,#f5f5f5,#e0e0e0)', color:'#6b7280', fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
        </div>

        {/* Type */}
        <div style={{ display:'flex', gap:6, marginBottom:11, background:'linear-gradient(145deg,#e0e0e0,#f5f5f5)', borderRadius:12, padding:3, boxShadow:'inset 2px 2px 5px rgba(0,0,0,0.1)' }}>
          {[['lent','↑ I Lent','#16a34a','#dcfce7','#bbf7d0'],['borrowed','↓ I Borrowed','#dc2626','#fee2e2','#fca5a5']].map(([t,label,col,bg,br])=>(
            <button key={t} onClick={()=>set('type',t)} style={{
              flex:1, padding:'9px', borderRadius:10,
              border: form.type===t?`1.5px solid ${br}`:'1.5px solid transparent',
              cursor:'pointer', fontFamily:'Poppins,sans-serif', fontWeight:800, fontSize:12,
              background: form.type===t?`linear-gradient(135deg,${bg},#fff)`:'transparent',
              color: form.type===t?col:'#9ca3af',
              boxShadow: form.type===t?'2px 2px 6px rgba(0,0,0,0.1)':'none',
            }}>{label}</button>
          ))}
        </div>

        {/* Person — readonly if prefillPerson */}
        <div style={{ marginBottom:10 }}>
          <Lbl t="Person Name" />
          <input value={form.person} onChange={e=>set('person',e.target.value)}
            placeholder="e.g. Rahul" style={inputSt} readOnly={!!prefillPerson} />
        </div>

        <div style={{ display:'flex', gap:8, marginBottom:10 }}>
          <div style={{ flex:1 }}><Lbl t="Amount (₹)" /><input type="number" value={form.amount} onChange={e=>set('amount',e.target.value)} placeholder="0" style={inputSt} /></div>
          <div style={{ flex:1 }}><Lbl t="Category" /><select value={form.category} onChange={e=>set('category',e.target.value)} style={{ ...inputSt, cursor:'pointer' }}>{CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
        </div>

        {/* Reason tags */}
        <div style={{ marginBottom:10 }}>
          <Lbl t="Reason" />
          <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:7 }}>
            {REASON_TAGS.map(tag=>(
              <button key={tag} onClick={()=>set('note',tag)} style={{
                padding:'4px 9px', borderRadius:16, fontSize:10, fontWeight:700, cursor:'pointer',
                fontFamily:'Poppins,sans-serif',
                border: form.note===tag?'1.5px solid #7c3aed':'1px solid #e2e8f0',
                background: form.note===tag?'#ede9fe':'#f5f5f5',
                color: form.note===tag?'#7c3aed':'#6b7280',
              }}>{tag}</button>
            ))}
          </div>
          <input value={form.note} onChange={e=>set('note',e.target.value)} placeholder="or type custom reason…" style={inputSt} />
        </div>

        <div style={{ marginBottom:10 }}>
          <Lbl t="Phone (WhatsApp)" />
          <input type="tel" value={form.phone} onChange={e=>set('phone',e.target.value)} placeholder="9876543210 (optional)" style={inputSt} />
        </div>

        <div style={{ display:'flex', gap:8, marginBottom:10 }}>
          <div style={{ flex:1 }}><Lbl t="Date" /><input type="date" value={form.date} onChange={e=>set('date',e.target.value)} style={{ ...inputSt, colorScheme:'light' }} /></div>
          <div style={{ flex:1 }}><Lbl t="Due Date" /><input type="date" value={form.dueDate} onChange={e=>set('dueDate',e.target.value)} style={{ ...inputSt, colorScheme:'light' }} /></div>
        </div>

        <div style={{ marginBottom:12 }}>
          <Lbl t="Avatar Color" />
          <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>
            {COLORS.map(c=>(
              <button key={c} onClick={()=>set('color',c)} style={{ width:24, height:24, borderRadius:'50%', background:c, cursor:'pointer', border:form.color===c?'3px solid #1a1a1a':'2px solid rgba(255,255,255,0.8)', boxShadow:'2px 2px 5px rgba(0,0,0,0.1)', transform:form.color===c?'scale(1.14)':'scale(1)', transition:'all 0.15s' }} />
            ))}
          </div>
        </div>

        {error && <p style={{ color:'#dc2626', fontSize:11, marginBottom:10, fontWeight:700, fontFamily:'Poppins,sans-serif' }}>⚠ {error}</p>}

        <button onClick={handleSave} style={{
          width:'100%', padding:'12px', borderRadius:12, border:'none', cursor:'pointer',
          background: form.type==='lent'?'linear-gradient(135deg,#16a34a,#22c55e)':'linear-gradient(135deg,#dc2626,#ef4444)',
          color:'#fff', fontFamily:'Poppins,sans-serif', fontWeight:800, fontSize:14,
          boxShadow: form.type==='lent'?'4px 4px 14px rgba(22,163,74,0.3)':'4px 4px 14px rgba(220,38,38,0.3)',
        }}>
          {editing?.id ? '💾 Save Changes' : (form.type==='lent'?'↑ Record Lent':'↓ Record Borrowed')}
        </button>
      </div>
    </div>
  )
}

function NativePdfActions({ file, onClose }) {
  const [busy, setBusy] = useState(null)

  const runAction = async () => {
    try {
      setBusy('share')
      await shareNativeLedgerPdf(file)
    } catch (error) {
      alert('Could not open share options.')
      console.error('Ledger PDF share action failed:', error)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:7000, background:'rgba(0,0,0,0.42)',
      backdropFilter:'blur(7px)', display:'flex', alignItems:'flex-end', justifyContent:'center',
      animation:'fadeIn 0.18s ease-out',
    }} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{
        width:'100%', maxWidth:430, margin:'0 10px 12px',
        background:'linear-gradient(160deg,#ffffff,#eceff3)', border:'1px solid rgba(255,255,255,0.9)',
        borderRadius:18, boxShadow:'0 18px 48px rgba(15,23,42,0.28)', padding:'14px',
        fontFamily:'Poppins,sans-serif',
      }}>
        <p style={{ margin:'0 0 4px', fontSize:13, fontWeight:800, color:'#111827' }}>PDF ready</p>
        <p style={{ margin:'0 0 12px', fontSize:11, lineHeight:1.35, color:'#64748b', fontWeight:600 }}>
          Your ledger PDF is ready. You can share or save it from the options below.
        </p>
        <button onClick={runAction} disabled={busy!==null} style={{
          width:'100%', padding:'11px 10px', borderRadius:12, border:'none', cursor:busy?'wait':'pointer',
          background:'linear-gradient(135deg,#7c3aed,#4f46e5)', color:'#fff',
          fontFamily:'Poppins,sans-serif', fontWeight:800, fontSize:12,
          boxShadow:'4px 4px 12px rgba(79,70,229,0.25)',
        }}>{busy==='share'?'Sharing...':'Share PDF'}</button>
        <button onClick={onClose} disabled={busy!==null} style={{
          width:'100%', marginTop:8, padding:'10px', borderRadius:12, border:'none',
          background:'transparent', color:'#64748b', fontFamily:'Poppins,sans-serif',
          fontWeight:800, fontSize:12, cursor:busy?'wait':'pointer',
        }}>Cancel</button>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   MAIN LEDGER PAGE
══════════════════════════════════════════════════════════════════════ */
export default function Ledger({ currentUser }) {
  const { entries, setEntries, loaded } = useLedger(currentUser?.username)

  const [showModal,    setShowModal]    = useState(false)
  const [editing,      setEditing]      = useState(null)
  const [filter,       setFilter]       = useState('all')
  const [search,       setSearch]       = useState('')
  const [sortBy,       setSortBy]       = useState('date')
  const [showAlerts,   setShowAlerts]   = useState(false)
  const [showTopPdf,   setShowTopPdf]   = useState(false)
  const [nativePdf,    setNativePdf]    = useState(null)
  const [activePerson, setActivePerson] = useState(null)   // normName key

  /* ── aggregate data ── */
  const allAccounts = useMemo(() => buildPersonAccounts(entries), [entries])

  const totalLent     = useMemo(()=>entries.filter(e=>e.type==='lent'&&!e.settled).reduce((s,e)=>s+e.amount,0),[entries])
  const totalBorrowed = useMemo(()=>entries.filter(e=>e.type==='borrowed'&&!e.settled).reduce((s,e)=>s+e.amount,0),[entries])
  const netBalance    = totalLent - totalBorrowed
  const overdueCount  = useMemo(()=>entries.filter(e=>!e.settled&&e.dueDate&&DAYS_LEFT(e.dueDate)<0).length,[entries])
  const dueTodayCount = useMemo(()=>entries.filter(e=>!e.settled&&e.dueDate&&DAYS_LEFT(e.dueDate)===0).length,[entries])
  const dueSoonCount  = useMemo(()=>entries.filter(e=>!e.settled&&e.dueDate&&DAYS_LEFT(e.dueDate)>0&&DAYS_LEFT(e.dueDate)<=7).length,[entries])
  const alertCount    = overdueCount + dueTodayCount

  /* ── filtered account list ── */
  const visibleAccounts = useMemo(()=>{
    let list = [...allAccounts]

    if (filter==='lent')      list = list.filter(a=>a.lentAmt>0)
    else if (filter==='borrowed') list = list.filter(a=>a.borAmt>0)
    else if (filter==='overdue')  list = list.filter(a=>a.hasOverdue)
    else if (filter==='settled')  list = list.filter(a=>a.isFullySettled)
    else                          list = list.filter(a=>!a.isFullySettled)

    if (search) list = list.filter(a=>a.name.toLowerCase().includes(search.toLowerCase()))

    if (sortBy==='amount') list.sort((a,b)=>Math.abs(b.net)-Math.abs(a.net))
    else if (sortBy==='due') list.sort((a,b)=>{
      if(!a.nearestDue)return 1; if(!b.nearestDue)return -1
      return a.nearestDue.d - b.nearestDue.d
    })
    else if (sortBy==='az') list.sort((a,b)=>a.name.localeCompare(b.name))
    else list.sort((a,b)=>new Date(b.latestDate)-new Date(a.latestDate))

    return list
  }, [allAccounts, filter, search, sortBy])

  /* ── active person account object ── */
  const activeAccount = activePerson ? allAccounts.find(a=>a.key===activePerson) : null

  /* ── entry operations ── */
  const handleSave   = (entry) => setEntries(prev => {
    const idx = prev.findIndex(e=>e.id===entry.id)
    if (idx>=0) { const n=[...prev]; n[idx]=entry; return n }
    return [entry, ...prev]
  })
  const handleSettle = (id) => setEntries(prev=>prev.map(e=>e.id===id?{...e,settled:true,settledAt:new Date().toISOString()}:e))
  const handleDelete = (id) => setEntries(prev=>prev.filter(e=>e.id!==id))

  /* ── PDF export ── */
  const handleExport = async (mode, personName) => {
    try {
      let result
      if (mode==='person')  result = await exportPersonLedger(personName, entries)
      else if (mode==='pending') result = await exportPendingLedger(entries)
      else                  result = await exportAllLedger(entries)

      if (result?.platform === 'native') setNativePdf(result)
    } catch (e) {
      alert('PDF export failed. Please try again or check app permissions.')
      console.error('Ledger PDF export failed:', e)
    }
  }

  const FILTERS = [
    { id:'all',       label:'📋 Active',    count:allAccounts.filter(a=>!a.isFullySettled).length },
    { id:'lent',      label:'↑ Receivable', count:allAccounts.filter(a=>a.lentAmt>0).length },
    { id:'borrowed',  label:'↓ Payable',    count:allAccounts.filter(a=>a.borAmt>0).length },
    { id:'overdue',   label:'⚠ Overdue',    count:allAccounts.filter(a=>a.hasOverdue).length },
    { id:'settled',   label:'✓ Settled',    count:allAccounts.filter(a=>a.isFullySettled).length },
  ]

  return (
    <>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=Syne:wght@700;800&display=swap');
      .ldg-root { font-family:'Poppins',sans-serif; color:#1a1a1a; }
      @keyframes fadeIn           { from{opacity:0} to{opacity:1} }
      @keyframes ldgSlideIn       { from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:translateX(0)} }
      @keyframes ldgSlideUpModal  { from{transform:translateY(100%)} to{transform:translateY(0)} }
      @keyframes ldgPulse         { 0%,100%{opacity:1} 50%{opacity:0.45} }
      @keyframes ldgFloat         { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
      @keyframes ldgSlideUp       { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
      input::placeholder  { color:#9ca3af !important; }
      select option       { background:#ffffff !important; color:#1a1a1a !important; }
      ::-webkit-scrollbar { width:3px; }
      ::-webkit-scrollbar-thumb { background:#d1d5db; border-radius:3px; }
      .ldg-sticky-panel {
        position:sticky;
        top:0;
        z-index:5200;
        background:linear-gradient(180deg,#f8f8f8 0%,#f3f4f6 72%,rgba(243,244,246,0.96) 100%);
        padding:0 0 7px;
        box-shadow:0 10px 18px rgba(15,23,42,0.05);
      }
      .ldg-list-scroll {
        flex:1 1 auto;
        min-height:0;
        overflow-y:auto;
        overflow-x:hidden;
        padding:7px 2px 18px;
        scroll-behavior:smooth;
      }
      .ldg-mobile-pdf { display:none !important; }
      @media(max-width:640px){
        .ldg-desk-add{display:none!important;}
        .ldg-mobile-pdf{display:flex!important;}
        .ldg-root{padding-left:2px!important;padding-right:2px!important;}
        .ldg-sticky-panel{padding-bottom:6px;}
        .ldg-list-scroll{padding-top:6px;padding-bottom:14px;}
      }
    `}</style>

    <div className="ldg-root" style={{ maxWidth:1180, margin:'0 auto', padding:'0 4px', width:'100%', height:'calc(100dvh - 128px)', minHeight:420, boxSizing:'border-box', overflow:'hidden', display:'flex', flexDirection:'column' }}>

      {/* ── FLOATING ADD ── */}
      <div style={{
  position:'fixed',
  bottom:155,
  right:18,
  zIndex:300,
  display:'flex',
  flexDirection:'column',
  gap:10,
}}>
        <button onClick={()=>{setEditing(null);setShowModal(true)}} style={{
          width:50, height:50, borderRadius:'50%', border:'1px solid rgba(255,255,255,0.8)',
          background:'linear-gradient(135deg,#7c3aed,#4f46e5)', color:'#fff', fontSize:22, cursor:'pointer',
          boxShadow:'4px 4px 14px rgba(124,58,237,0.35),-2px -2px 6px rgba(255,255,255,0.4)',
          display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.2s',
        }}>＋</button>
      </div>

      <div className="ldg-sticky-panel">
      {/* ── HEADER ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, marginBottom:12, animation:'ldgSlideUp 0.4s ease-out both', position:'relative', zIndex:1200, overflow:'visible' }}>
        <div style={{ display:'flex', alignItems:'center', gap:9, minWidth:0, flex:1 }}>
          <img src="/logo.jpg" alt="ACR MAX" style={{ width:36, height:36, borderRadius:'50%', objectFit:'cover', border:'1.5px solid #e2e8f0', boxShadow:'2px 2px 6px rgba(0,0,0,0.1)', flexShrink:0 }} />
          <div style={{ minWidth:0 }}>
            <h2 style={{ fontFamily:'Poppins,sans-serif', fontSize:18, fontWeight:800, margin:'0 0 1px', color:'#1a1a1a', lineHeight:1.15 }}>🤝 Smart Ledger</h2>
            <p style={{ fontSize:10, color:'#6b7280', margin:0, fontFamily:'Poppins,sans-serif', lineHeight:1.2 }}>ACR MAX · Lent · Borrowed · Reminders</p>
          </div>
        </div>
        <div style={{ display:'flex', gap:7, alignItems:'center', flexShrink:0, overflow:'visible' }}>
          {/* Alerts bell */}
          <button onClick={()=>setShowAlerts(true)} style={{
            position:'relative', width:36, height:36, borderRadius:10,
            background:'linear-gradient(145deg,#f5f5f5,#e0e0e0)',
            border:'1px solid #e2e8f0',
            boxShadow:'3px 3px 7px rgba(0,0,0,0.09),-2px -2px 5px rgba(255,255,255,0.9)',
            display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:16,
          }}>
            🔔
            {alertCount > 0 && (
              <span style={{ position:'absolute', top:-4, right:-4, background:'#dc2626', color:'#fff', fontSize:9, fontWeight:800, borderRadius:'50%', width:16, height:16, display:'flex', alignItems:'center', justifyContent:'center', border:'2px solid #f8f8f8', animation:'ldgPulse 2s infinite' }}>{alertCount}</span>
            )}
          </button>
          <div style={{ position:'relative', zIndex:5600, overflow:'visible' }}>
            <button onClick={()=>setShowTopPdf(v=>!v)} className="ldg-mobile-pdf" style={{
              width:36, height:36, borderRadius:10, cursor:'pointer', border:'1px solid #e2e8f0',
              background:'linear-gradient(145deg,#f5f5f5,#e0e0e0)',
              boxShadow:'3px 3px 7px rgba(0,0,0,0.08),-2px -2px 5px rgba(255,255,255,0.9)',
              color:'#475569', fontFamily:'Poppins,sans-serif', fontWeight:800, fontSize:12,
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>PDF</button>
            <button onClick={()=>setShowTopPdf(v=>!v)} className="ldg-desk-add" style={{
              padding:'8px 12px', borderRadius:10, cursor:'pointer', border:'1px solid #e2e8f0',
              background:'linear-gradient(145deg,#f5f5f5,#e0e0e0)',
              boxShadow:'3px 3px 7px rgba(0,0,0,0.08),-2px -2px 5px rgba(255,255,255,0.9)',
              color:'#475569', fontFamily:'Poppins,sans-serif', fontWeight:800, fontSize:11,
            }}>↓ PDF</button>
            {showTopPdf && (
              <div style={{
                position:'absolute', top:'calc(100% + 7px)', right:0, background:'#fff',
                border:'1px solid #e2e8f0', borderRadius:11,
                boxShadow:'0 16px 38px rgba(15,23,42,0.22)', overflow:'visible',
                zIndex:6000, minWidth:154, isolation:'isolate',
              }}>
                <button onClick={()=>{handleExport('all');setShowTopPdf(false)}} style={{ display:'block', width:'100%', padding:'10px 13px', background:'none', border:'none', textAlign:'left', fontSize:12, fontFamily:'Poppins,sans-serif', fontWeight:800, color:'#1a1a1a', cursor:'pointer' }}>Full ledger</button>
                <button onClick={()=>{handleExport('pending');setShowTopPdf(false)}} style={{ display:'block', width:'100%', padding:'10px 13px', background:'none', border:'none', textAlign:'left', fontSize:12, fontFamily:'Poppins,sans-serif', fontWeight:800, color:'#1a1a1a', cursor:'pointer', borderTop:'1px solid #f1f5f9' }}>Pending</button>
              </div>
            )}
          </div>
          <button onClick={()=>{setEditing(null);setShowModal(true)}} className="ldg-desk-add" style={{
            padding:'9px 14px', borderRadius:10, cursor:'pointer', border:'none',
            background:'linear-gradient(135deg,#7c3aed,#4f46e5)',
            boxShadow:'4px 4px 12px rgba(124,58,237,0.25)',
            color:'#fff', fontFamily:'Poppins,sans-serif', fontWeight:800, fontSize:12,
          }}>＋ New Entry</button>
        </div>
      </div>

      {/* ── BALANCE STRIP ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:7, marginBottom:12, animation:'ldgSlideUp 0.4s ease-out 0.05s both' }}>
        {[
          { label:'Will Receive', value:fmt(totalLent),   color:'#16a34a', accent:'#bbf7d0' },
          { label:'Will Pay',     value:fmt(totalBorrowed),color:'#dc2626', accent:'#fca5a5' },
          { label:'Net Balance',  value:(netBalance>=0?'+':'')+fmt(Math.abs(netBalance)), color:netBalance>=0?'#16a34a':'#dc2626', accent:netBalance>=0?'#bbf7d0':'#fca5a5' },
        ].map((s,i)=>(
          <div key={i} style={{
            padding:'10px 8px 11px',
            background:'linear-gradient(145deg,#f8f8f8,#d8d8d8)',
            border:`1.25px solid rgba(255,255,255,0.95)`,
            borderTop:`3px solid ${s.accent}`,
            borderRadius:13, textAlign:'center',
            boxShadow:'4px 4px 11px rgba(0,0,0,0.1),-2px -2px 7px rgba(255,255,255,0.98)',
          }}>
            <p style={{ fontSize:8.5, fontWeight:800, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.08em', margin:'0 0 3px', fontFamily:'Poppins,sans-serif' }}>{s.label}</p>
            <p style={{ fontFamily:'Poppins,sans-serif', fontWeight:800, fontSize:19, lineHeight:1.05, color:'#b8860b', margin:0 }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── ALERT BANNERS ── */}
      {(overdueCount>0||dueTodayCount>0) && (
        <div onClick={()=>setShowAlerts(true)} style={{ width:'100%', boxSizing:'border-box', borderRadius:11, padding:'7px 10px', marginBottom:8, background:'linear-gradient(145deg,#fff1f2,#fee2e2)', border:'1px solid #fca5a5', boxShadow:'2px 2px 6px rgba(220,38,38,0.09)', cursor:'pointer', animation:'ldgSlideUp 0.4s ease-out 0.1s both' }}>
          {overdueCount>0 && <div style={{ display:'flex', alignItems:'center', gap:6 }}><span style={{ fontSize:12 }}>🚨</span><p style={{ fontSize:11, color:'#dc2626', fontWeight:800, margin:0, fontFamily:'Poppins,sans-serif' }}>{overdueCount} overdue payment{overdueCount>1?'s':''} — tap to view</p></div>}
          {dueTodayCount>0 && <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:overdueCount?3:0 }}><span style={{ fontSize:12 }}>🔔</span><p style={{ fontSize:11, color:'#ca8a04', fontWeight:800, margin:0, fontFamily:'Poppins,sans-serif' }}>{dueTodayCount} due today — tap to view</p></div>}
        </div>
      )}
      {dueSoonCount>0 && (
        <div style={{ width:'100%', boxSizing:'border-box', borderRadius:11, padding:'6px 10px', marginBottom:8, background:'linear-gradient(145deg,#fffbeb,#fef9c3)', border:'1px solid #fde68a', boxShadow:'2px 2px 6px rgba(0,0,0,0.05)', display:'flex', alignItems:'center', gap:6, animation:'ldgSlideUp 0.4s ease-out 0.15s both' }}>
          <span style={{ fontSize:12 }}>⏰</span>
          <p style={{ fontSize:11, color:'#ca8a04', fontWeight:700, margin:0, fontFamily:'Poppins,sans-serif' }}>{dueSoonCount} due within 7 days</p>
        </div>
      )}

      {/* ── FILTER TABS ── */}
      <div style={{ display:'flex', gap:6, marginBottom:9, overflowX:'auto', paddingBottom:3, scrollbarWidth:'none', animation:'ldgSlideUp 0.4s ease-out 0.2s both' }}>
        {FILTERS.map(f=>(
          <button key={f.id} onClick={()=>setFilter(f.id)} style={{
            padding:'6px 10px', borderRadius:16, fontWeight:800, fontSize:11,
            whiteSpace:'nowrap', cursor:'pointer', fontFamily:'Poppins,sans-serif',
            border: filter===f.id?'1.5px solid #7c3aed':'1.5px solid #e2e8f0',
            background: filter===f.id?'linear-gradient(145deg,#ede9fe,#ddd6fe)':'linear-gradient(145deg,#ffffff,#ebebeb)',
            color: filter===f.id?'#7c3aed':'#475569',
            boxShadow: filter===f.id?'3px 3px 8px rgba(124,58,237,0.2),-2px -2px 5px rgba(255,255,255,0.8)':'3px 3px 7px rgba(0,0,0,0.07),-2px -2px 5px rgba(255,255,255,0.9)',
            display:'flex', alignItems:'center', gap:4,
          }}>
            {f.label}
            {f.count>0 && <span style={{ background:filter===f.id?'rgba(124,58,237,0.15)':'#e2e8f0', color:filter===f.id?'#7c3aed':'#475569', borderRadius:9, padding:'0 5px', fontSize:9, fontWeight:800 }}>{f.count}</span>}
          </button>
        ))}
      </div>

      {/* ── SEARCH + SORT ── */}
      <div style={{ display:'flex', gap:7, marginBottom:11, width:'100%', animation:'ldgSlideUp 0.4s ease-out 0.25s both' }}>
        <div style={{ position:'relative', flex:1 }}>
          <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', fontSize:12, color:'#9ca3af', pointerEvents:'none' }}>🔍</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search person…"
            style={{ width:'100%', padding:'9px 12px 9px 31px', background:'linear-gradient(145deg,#e8e8e8,#ffffff)', boxShadow:'inset 2px 2px 6px rgba(0,0,0,0.08),inset -2px -2px 5px rgba(255,255,255,0.9)', border:'1px solid #e2e8f0', borderRadius:10, color:'#1a1a1a', fontSize:12, outline:'none', fontFamily:'Poppins,sans-serif', boxSizing:'border-box' }} />
        </div>
        <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{ width:104, flexShrink:0, padding:'9px 8px', background:'linear-gradient(145deg,#f5f5f5,#e8e8e8)', boxShadow:'2px 2px 7px rgba(0,0,0,0.07),-2px -2px 5px rgba(255,255,255,0.9)', border:'1px solid #e2e8f0', borderRadius:10, color:'#1a1a1a', fontSize:12, outline:'none', cursor:'pointer', fontFamily:'Poppins,sans-serif', fontWeight:700 }}>
          <option value="date">Latest</option>
          <option value="amount">Highest</option>
          <option value="due">Due Soon</option>
          <option value="az">A–Z</option>
        </select>
      </div>
      </div>

      {/* ── PERSON ACCOUNTS LIST ── */}
      <div className="ldg-list-scroll">
      {!loaded ? (
        <div style={{ textAlign:'center', padding:'48px 20px', color:'#9ca3af' }}>
          <div style={{ fontSize:40, marginBottom:12, animation:'ldgFloat 3s ease-in-out infinite' }}>🤝</div>
          <p style={{ fontWeight:600, fontSize:14, fontFamily:'Poppins,sans-serif' }}>Loading your ledger…</p>
        </div>
      ) : visibleAccounts.length===0 ? (
        <div style={{ textAlign:'center', padding:'52px 20px', color:'#9ca3af', animation:'ldgSlideUp 0.4s ease-out both' }}>
          <div style={{ fontSize:52, marginBottom:14, animation:'ldgFloat 4s ease-in-out infinite' }}>🤝</div>
          <p style={{ fontWeight:700, fontSize:16, marginBottom:6, color:'#374151', fontFamily:'Poppins,sans-serif' }}>
            {filter==='settled'?'No settled accounts yet':filter==='overdue'?'No overdue entries! 🎉':'No accounts yet'}
          </p>
          <p style={{ fontSize:13, color:'#9ca3af', marginBottom:20, fontFamily:'Poppins,sans-serif' }}>
            {filter==='all'?'Tap ＋ to add your first ledger entry':'Try a different filter'}
          </p>
          {filter==='all' && (
            <button onClick={()=>{setEditing(null);setShowModal(true)}} style={{ padding:'12px 24px', borderRadius:14, cursor:'pointer', fontFamily:'Poppins,sans-serif', fontWeight:700, fontSize:14, color:'#fff', background:'linear-gradient(135deg,#7c3aed,#4f46e5)', border:'none', boxShadow:'4px 4px 12px rgba(124,58,237,0.3)' }}>＋ Add First Entry</button>
          )}
        </div>
      ) : (
        <div style={{ width:'100%' }}>
          {visibleAccounts.map((account,i) => (
            <div key={account.key} style={{ animationDelay:`${i*35}ms`, width:'100%' }}>
              <PersonCard account={account} onClick={()=>setActivePerson(account.key)} />
            </div>
          ))}
          <p style={{ textAlign:'center', fontSize:11, color:'#9ca3af', marginTop:14, fontWeight:500, fontFamily:'Poppins,sans-serif' }}>
            {visibleAccounts.length} account{visibleAccounts.length===1?'':'s'} · {entries.filter(e=>!e.settled).length} active entries
          </p>
        </div>
      )}
      </div>

      {/* ── MODALS ── */}
      {showModal && (
        <EntryModal editing={editing} onSave={(e)=>{handleSave(e);setShowModal(false);setEditing(null)}} onClose={()=>{setShowModal(false);setEditing(null)}} />
      )}

      {showAlerts && (
        <AlertsPopup
          entries={entries}
          onClose={()=>setShowAlerts(false)}
          onOpenPerson={(key)=>{ setActivePerson(key); setShowAlerts(false) }}
          onSettle={handleSettle}
        />
      )}

      {activeAccount && (
        <PersonDetail
          account={activeAccount}
          allEntries={entries}
          onClose={()=>setActivePerson(null)}
          onSave={handleSave}
          onSettle={handleSettle}
          onDelete={handleDelete}
          onEdit={()=>{}}
          onExport={handleExport}
        />
      )}

      {nativePdf && (
        <NativePdfActions file={nativePdf} onClose={()=>setNativePdf(null)} />
      )}

    </div>
    </>
  )
}
