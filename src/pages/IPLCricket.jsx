import { useState, useEffect, useCallback } from 'react'
import { db } from '../firebase'
import { doc, onSnapshot } from 'firebase/firestore'

/* ═══════════════════════════════════════════════════════════════
   ACR MAX — IPL Cricket Module (Sportmonks)
   Real-time Firestore listener · Clean sports UI
   All data flows: Sportmonks API → Cloud Function → Firestore → Frontend
═══════════════════════════════════════════════════════════════ */

/* ── Team configs (full name → display) ── */
const TEAMS = {
  'Mumbai Indians':              { short:'MI',   color:'#004BA0', bg:'#EAF2FF', emoji:'🔵' },
  'Chennai Super Kings':         { short:'CSK',  color:'#D4AF37', bg:'#FFFBEA', emoji:'🟡' },
  'Royal Challengers Bangalore': { short:'RCB',  color:'#C8102E', bg:'#FFF0F0', emoji:'🔴' },
  'Kolkata Knight Riders':       { short:'KKR',  color:'#3A225D', bg:'#F5F0FF', emoji:'🟣' },
  'Sunrisers Hyderabad':         { short:'SRH',  color:'#FF822A', bg:'#FFF4EE', emoji:'🟠' },
  'Delhi Capitals':              { short:'DC',   color:'#004C97', bg:'#EEF8FF', emoji:'🔵' },
  'Punjab Kings':                { short:'PBKS', color:'#ED1B24', bg:'#FFF0F0', emoji:'🔴' },
  'Rajasthan Royals':            { short:'RR',   color:'#EA1A85', bg:'#FFF0F8', emoji:'🩷' },
  'Gujarat Titans':              { short:'GT',   color:'#1C4E8B', bg:'#EEF4FF', emoji:'🔵' },
  'Lucknow Super Giants':        { short:'LSG',  color:'#29A8E0', bg:'#F0F8FF', emoji:'🩵' },
}

function getTeam(name = '') {
  // exact match first
  if (TEAMS[name]) return { name, ...TEAMS[name] }
  // partial match
  const key = Object.keys(TEAMS).find(k =>
    name.toLowerCase().includes(k.split(' ').pop().toLowerCase()) ||
    k.toLowerCase().includes(name.toLowerCase())
  )
  if (key) return { name: key, ...TEAMS[key] }
  return { name, short: name.slice(0,4).toUpperCase(), color:'#6b7280', bg:'#f3f4f6', emoji:'🏏' }
}

/* ── Format time to IST string ── */
function fmtTime(raw) {
  if (!raw) return 'TBD'
  if (/^\d{1,2}:\d{2}/.test(raw)) return raw // already formatted
  try {
    return new Date(raw).toLocaleTimeString('en-IN', {
      hour:'2-digit', minute:'2-digit', hour12:true, timeZone:'Asia/Kolkata'
    })
  } catch { return raw }
}

/* ── Format date to display string ── */
function fmtDate(raw) {
  if (!raw) return ''
  try {
    return new Date(raw).toLocaleDateString('en-IN', {
      day:'numeric', month:'short', timeZone:'Asia/Kolkata'
    })
  } catch { return raw }
}

/* ── Realistic demo data (shown until Firestore has real data) ── */
const DEMO_MATCHES = {
  today: [
    { id:'d1', team1:'Mumbai Indians', team2:'Chennai Super Kings', time:'7:30 PM', venue:'Wankhede Stadium, Mumbai', status:'upcoming', date:new Date().toISOString().slice(0,10) },
  ],
  upcoming: [
    { id:'u1', team1:'Delhi Capitals', team2:'Sunrisers Hyderabad', time:'7:30 PM', venue:'Arun Jaitley Stadium', date:new Date(Date.now()+86400000).toISOString().slice(0,10), dayLabel:'Tomorrow' },
    { id:'u2', team1:'Punjab Kings', team2:'Rajasthan Royals', time:'3:30 PM', venue:'PCA Stadium, Mohali', date:new Date(Date.now()+2*86400000).toISOString().slice(0,10), dayLabel:'In 2 days' },
    { id:'u3', team1:'Gujarat Titans', team2:'Lucknow Super Giants', time:'7:30 PM', venue:'Narendra Modi Stadium', date:new Date(Date.now()+3*86400000).toISOString().slice(0,10), dayLabel:'In 3 days' },
    { id:'u4', team1:'Kolkata Knight Riders', team2:'Royal Challengers Bangalore', time:'3:30 PM', venue:'Eden Gardens, Kolkata', date:new Date(Date.now()+4*86400000).toISOString().slice(0,10), dayLabel:'In 4 days' },
  ],
  results: [
    { id:'r1', team1:'Gujarat Titans', team2:'Rajasthan Royals', result:'GT won by 5 wickets', score1:'188/5 (20)', score2:'189/5 (19.3)', venue:'Narendra Modi Stadium', date:new Date(Date.now()-86400000).toISOString().slice(0,10) },
    { id:'r2', team1:'Delhi Capitals', team2:'Lucknow Super Giants', result:'LSG won by 32 runs', score1:'198/4 (20)', score2:'166/9 (20)', venue:'Arun Jaitley Stadium', date:new Date(Date.now()-2*86400000).toISOString().slice(0,10) },
    { id:'r3', team1:'Mumbai Indians', team2:'Kolkata Knight Riders', result:'MI won by 6 wickets', score1:'172/8 (20)', score2:'173/4 (18.4)', venue:'Wankhede Stadium', date:new Date(Date.now()-3*86400000).toISOString().slice(0,10) },
  ],
  live: [],
}
const DEMO_LEADERBOARD = {
  points: [
    { rank:1,  team:'Royal Challengers Bangalore', p:8, w:6, l:2, nrr:'+1.245', pts:12, form:['W','W','L','W','W'] },
    { rank:2,  team:'Kolkata Knight Riders',        p:8, w:6, l:2, nrr:'+0.821', pts:12, form:['W','L','W','W','W'] },
    { rank:3,  team:'Mumbai Indians',               p:8, w:5, l:3, nrr:'+0.612', pts:10, form:['W','W','W','L','W'] },
    { rank:4,  team:'Sunrisers Hyderabad',          p:8, w:4, l:4, nrr:'+0.344', pts:8,  form:['W','L','W','L','W'] },
    { rank:5,  team:'Delhi Capitals',               p:8, w:4, l:4, nrr:'+0.112', pts:8,  form:['L','W','L','W','W'] },
    { rank:6,  team:'Gujarat Titans',               p:8, w:4, l:4, nrr:'-0.089', pts:8,  form:['W','L','L','W','W'] },
    { rank:7,  team:'Chennai Super Kings',          p:8, w:3, l:5, nrr:'-0.234', pts:6,  form:['L','W','L','L','W'] },
    { rank:8,  team:'Punjab Kings',                 p:8, w:3, l:5, nrr:'-0.445', pts:6,  form:['W','L','L','W','L'] },
    { rank:9,  team:'Rajasthan Royals',             p:8, w:2, l:6, nrr:'-0.677', pts:4,  form:['L','L','W','L','W'] },
    { rank:10, team:'Lucknow Super Giants',         p:8, w:1, l:7, nrr:'-1.689', pts:2,  form:['L','L','L','W','L'] },
  ],
  orange_cap: { name:'Virat Kohli', team:'Royal Challengers Bangalore', runs:487, matches:8, avg:81.2, sr:152.3, hs:112 },
  purple_cap: { name:'Jasprit Bumrah', team:'Mumbai Indians', wickets:16, matches:8, economy:6.4, avg:11.8, best:'4/21' },
}

/* ════════════════════════════════
   UI COMPONENTS
════════════════════════════════ */

function LiveBadge() {
  return (
    <div style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 8px', background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:20 }}>
      <div style={{ width:6, height:6, borderRadius:'50%', background:'#dc2626', animation:'livePulse 1.2s ease-in-out infinite' }} />
      <span style={{ fontSize:9, fontWeight:800, color:'#dc2626', letterSpacing:'0.1em', fontFamily:'Poppins,sans-serif' }}>LIVE</span>
    </div>
  )
}

function FormPills({ form = [] }) {
  return (
    <div style={{ display:'flex', gap:2, marginTop:3 }}>
      {form.slice(-5).map((f, i) => (
        <div key={i} style={{ width:14, height:14, borderRadius:'50%', background:f==='W'?'#16a34a':'#dc2626', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <span style={{ fontSize:6, fontWeight:800, color:'#fff' }}>{f}</span>
        </div>
      ))}
    </div>
  )
}

function TeamBadge({ name, size = 'md', showFull = false }) {
  const t = getTeam(name)
  const sz = size === 'lg' ? 48 : size === 'sm' ? 28 : 36
  const fs = size === 'lg' ? 24 : size === 'sm' ? 14 : 18
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
      <div style={{ width:sz, height:sz, borderRadius:Math.round(sz*0.3), background:t.bg, border:`1.5px solid ${t.color}30`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:fs, boxShadow:`0 2px 8px ${t.color}20`, flexShrink:0 }}>
        {t.emoji}
      </div>
      <p style={{ fontFamily:'Poppins,sans-serif', fontWeight:800, fontSize: size==='lg'?15:size==='sm'?10:12, color:t.color, margin:0, textAlign:'center', lineHeight:1.1 }}>{t.short}</p>
      {showFull && <p style={{ fontSize:9, color:'#9ca3af', margin:0, textAlign:'center', fontFamily:'Poppins,sans-serif' }}>{t.name.split(' ').slice(-1)}</p>}
    </div>
  )
}

/* ── Hero Today Match Card ── */
function HeroMatchCard({ match }) {
  const t1 = getTeam(match.team1)
  const t2 = getTeam(match.team2)
  const isLive = match.status === 'live'
  const isDone = match.status === 'completed'

  return (
    <div style={{ borderRadius:16, overflow:'hidden', background:'#fff', border:'1.5px solid #e5e7eb', boxShadow:'0 4px 16px rgba(0,0,0,0.08)', marginBottom:10 }}>
      <div style={{ height:4, background:`linear-gradient(90deg,${t1.color},${t2.color})` }} />
      <div style={{ padding:'14px 16px' }}>
        {/* Status row */}
        <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:12 }}>
          {isLive && <LiveBadge />}
          {isDone && <span style={{ fontSize:9, fontWeight:700, padding:'2px 9px', background:'#ecfdf5', border:'1px solid #bbf7d0', borderRadius:20, color:'#16a34a', fontFamily:'Poppins,sans-serif' }}>✓ COMPLETED</span>}
          {!isLive && !isDone && <span style={{ fontSize:9, fontWeight:700, padding:'2px 9px', background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:20, color:'#1d4ed8', fontFamily:'Poppins,sans-serif' }}>📅 TODAY</span>}
          <span style={{ marginLeft:'auto', fontSize:11, fontWeight:700, color:'#374151', fontFamily:'Poppins,sans-serif' }}>{fmtTime(match.time)}</span>
        </div>

        {/* Teams */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', alignItems:'center', gap:8, marginBottom:12 }}>
          <div style={{ textAlign:'center' }}>
            <TeamBadge name={match.team1} size="lg" showFull />
            {isDone && match.score1 && <p style={{ fontSize:13, fontWeight:800, color:'#1a1a1a', margin:'6px 0 0', fontFamily:'Poppins,sans-serif' }}>{match.score1}</p>}
          </div>
          <div style={{ textAlign:'center' }}>
            {isLive ? (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                <LiveBadge />
                <span style={{ fontSize:10, fontWeight:700, color:'#6b7280', fontFamily:'Poppins,sans-serif' }}>IN PLAY</span>
              </div>
            ) : (
              <div style={{ width:36, height:36, borderRadius:'50%', background:'linear-gradient(145deg,#f5f5f5,#e8e8e8)', border:'1px solid #e5e7eb', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'2px 2px 5px rgba(0,0,0,0.07)' }}>
                <span style={{ fontSize:10, fontWeight:800, color:'#6b7280', fontFamily:'Poppins,sans-serif' }}>VS</span>
              </div>
            )}
          </div>
          <div style={{ textAlign:'center' }}>
            <TeamBadge name={match.team2} size="lg" showFull />
            {isDone && match.score2 && <p style={{ fontSize:13, fontWeight:800, color:'#1a1a1a', margin:'6px 0 0', fontFamily:'Poppins,sans-serif' }}>{match.score2}</p>}
          </div>
        </div>

        {/* Result */}
        {isDone && match.result && (
          <div style={{ padding:'7px 12px', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:10, textAlign:'center', marginBottom:8 }}>
            <p style={{ fontSize:12, fontWeight:700, color:'#16a34a', margin:0, fontFamily:'Poppins,sans-serif' }}>🏆 {match.result}</p>
          </div>
        )}
        {isLive && match.score1 && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:8, marginBottom:8 }}>
            <div style={{ padding:'6px 10px', background:`${t1.color}08`, border:`1px solid ${t1.color}20`, borderRadius:10, textAlign:'center' }}>
              <p style={{ fontSize:13, fontWeight:800, color:t1.color, margin:0, fontFamily:'Poppins,sans-serif' }}>{match.score1}</p>
            </div>
            <div style={{ display:'flex', alignItems:'center' }}><span style={{ fontSize:10, color:'#9ca3af' }}>v</span></div>
            <div style={{ padding:'6px 10px', background:`${t2.color}08`, border:`1px solid ${t2.color}20`, borderRadius:10, textAlign:'center' }}>
              <p style={{ fontSize:13, fontWeight:800, color:t2.color, margin:0, fontFamily:'Poppins,sans-serif' }}>{match.score2 || '—'}</p>
            </div>
          </div>
        )}
        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
          <span style={{ fontSize:11 }}>📍</span>
          <p style={{ fontSize:10, color:'#9ca3af', margin:0, fontFamily:'Poppins,sans-serif', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{match.venue}</p>
        </div>
      </div>
    </div>
  )
}

/* ── Result card ── */
function ResultCard({ match }) {
  const t1 = getTeam(match.team1)
  const t2 = getTeam(match.team2)
  return (
    <div style={{ borderRadius:14, background:'#fff', border:'1.5px solid #e5e7eb', boxShadow:'0 2px 8px rgba(0,0,0,0.06)', marginBottom:8, overflow:'hidden' }}>
      <div style={{ height:3, background:`linear-gradient(90deg,${t1.color},${t2.color})` }} />
      <div style={{ padding:'11px 14px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
          <span style={{ fontSize:9, fontWeight:700, padding:'2px 8px', background:'#ecfdf5', border:'1px solid #bbf7d0', borderRadius:20, color:'#16a34a', fontFamily:'Poppins,sans-serif' }}>✓ RESULT</span>
          <span style={{ fontSize:10, color:'#9ca3af', fontFamily:'Poppins,sans-serif' }}>{fmtDate(match.date)}</span>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', alignItems:'center', gap:8 }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:3 }}>
              <TeamBadge name={match.team1} size="sm" />
              <div>
                <p style={{ fontFamily:'Poppins,sans-serif', fontWeight:800, fontSize:12, color:t1.color, margin:0 }}>{t1.short}</p>
                {match.score1 && <p style={{ fontSize:11, fontWeight:700, color:'#1a1a1a', margin:0, fontFamily:'Poppins,sans-serif' }}>{match.score1}</p>}
              </div>
            </div>
          </div>
          <span style={{ fontSize:10, fontWeight:700, color:'#9ca3af' }}>v</span>
          <div style={{ textAlign:'right' }}>
            <div style={{ display:'flex', alignItems:'center', gap:7, justifyContent:'flex-end', marginBottom:3 }}>
              <div style={{ textAlign:'right' }}>
                <p style={{ fontFamily:'Poppins,sans-serif', fontWeight:800, fontSize:12, color:t2.color, margin:0 }}>{t2.short}</p>
                {match.score2 && <p style={{ fontSize:11, fontWeight:700, color:'#1a1a1a', margin:0, fontFamily:'Poppins,sans-serif' }}>{match.score2}</p>}
              </div>
              <TeamBadge name={match.team2} size="sm" />
            </div>
          </div>
        </div>
        {match.result && <p style={{ fontSize:11, fontWeight:700, color:'#16a34a', margin:'7px 0 0', fontFamily:'Poppins,sans-serif', borderTop:'1px solid #f1f5f9', paddingTop:6 }}>🏆 {match.result}</p>}
      </div>
    </div>
  )
}

/* ── Upcoming match card (horizontal scroll) ── */
function UpcomingCard({ match }) {
  const t1 = getTeam(match.team1)
  const t2 = getTeam(match.team2)
  return (
    <div style={{ flexShrink:0, width:170, borderRadius:14, background:'#fff', border:'1.5px solid #e5e7eb', boxShadow:'0 2px 8px rgba(0,0,0,0.06)', overflow:'hidden' }}>
      <div style={{ height:3, background:`linear-gradient(90deg,${t1.color},${t2.color})` }} />
      <div style={{ padding:'10px 12px' }}>
        <span style={{ fontSize:9, fontWeight:700, padding:'2px 8px', background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:20, color:'#1d4ed8', fontFamily:'Poppins,sans-serif' }}>
          {match.dayLabel || fmtDate(match.date)}
        </span>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', margin:'9px 0 4px' }}>
          <TeamBadge name={match.team1} size="sm" />
          <div style={{ width:22, height:22, borderRadius:'50%', background:'#f3f4f6', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span style={{ fontSize:8, fontWeight:800, color:'#6b7280', fontFamily:'Poppins,sans-serif' }}>VS</span>
          </div>
          <TeamBadge name={match.team2} size="sm" />
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:6 }}>
          <span style={{ fontSize:10 }}>⏰</span>
          <p style={{ fontSize:10, fontWeight:600, color:'#6b7280', margin:0, fontFamily:'Poppins,sans-serif' }}>{fmtTime(match.time)}</p>
        </div>
        <p style={{ fontSize:9, color:'#9ca3af', margin:'3px 0 0', fontFamily:'Poppins,sans-serif', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>📍 {match.venue?.split(',')[0]}</p>
      </div>
    </div>
  )
}

/* ── Points Table ── */
function PointsTable({ points = [] }) {
  const [showAll, setShowAll] = useState(false)
  const rows = showAll ? points : points.slice(0, 5)

  return (
    <div style={{ borderRadius:16, background:'#fff', border:'1.5px solid #e5e7eb', overflow:'hidden', boxShadow:'0 2px 10px rgba(0,0,0,0.06)' }}>
      {/* Header */}
      <div style={{ display:'grid', gridTemplateColumns:'28px 1fr 26px 26px 26px 48px 30px', gap:3, padding:'8px 12px', background:'#f8fafc', borderBottom:'1px solid #f1f5f9' }}>
        {['#','TEAM','P','W','L','NRR','PTS'].map((h, i) => (
          <p key={i} style={{ fontSize:8, fontWeight:800, color:'#9ca3af', margin:0, textAlign:i>1?'center':'left', textTransform:'uppercase', letterSpacing:'0.07em', fontFamily:'Poppins,sans-serif' }}>{h}</p>
        ))}
      </div>

      {points.length === 0 ? (
        <div style={{ padding:'20px', textAlign:'center' }}>
          <p style={{ fontSize:12, color:'#9ca3af', fontFamily:'Poppins,sans-serif' }}>Points table loading…</p>
        </div>
      ) : rows.map((row, i) => {
        const team = getTeam(row.team)
        const isPlayoff = row.rank <= 4
        return (
          <div key={i} style={{ display:'grid', gridTemplateColumns:'28px 1fr 26px 26px 26px 48px 30px', gap:3, padding:'9px 12px', borderBottom:'1px solid #f9fafb', background:isPlayoff?`${team.color}05`:'#fff', alignItems:'center' }}>
            <div style={{ width:18, height:18, borderRadius:'50%', background:isPlayoff?team.color:'#e5e7eb', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <span style={{ fontSize:8, fontWeight:800, color:isPlayoff?'#fff':'#6b7280', fontFamily:'Poppins,sans-serif' }}>{row.rank}</span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:5, minWidth:0 }}>
              <span style={{ fontSize:13, flexShrink:0 }}>{team.emoji}</span>
              <div style={{ minWidth:0 }}>
                <p style={{ fontFamily:'Poppins,sans-serif', fontWeight:700, fontSize:11, color:'#1a1a1a', margin:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{team.short}</p>
                {row.form?.length > 0 && <FormPills form={row.form} />}
              </div>
            </div>
            {[row.p, row.w, row.l].map((v, j) => (
              <p key={j} style={{ fontFamily:'Poppins,sans-serif', fontSize:11, fontWeight:600, color:'#374151', margin:0, textAlign:'center' }}>{v}</p>
            ))}
            <p style={{ fontFamily:'Poppins,sans-serif', fontSize:10, fontWeight:700, color:parseFloat(row.nrr)>=0?'#16a34a':'#dc2626', margin:0, textAlign:'center' }}>{row.nrr}</p>
            <div style={{ textAlign:'center' }}>
              <span style={{ fontSize:12, fontWeight:800, color:isPlayoff?team.color:'#374151', fontFamily:'Poppins,sans-serif', padding:'1px 6px', background:isPlayoff?`${team.color}12`:'transparent', borderRadius:7 }}>{row.pts}</span>
            </div>
          </div>
        )
      })}

      <div style={{ padding:'8px 12px', background:'#f8fafc', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
          <div style={{ width:7, height:7, borderRadius:'50%', background:'#7c3aed' }} />
          <span style={{ fontSize:9, color:'#6b7280', fontFamily:'Poppins,sans-serif', fontWeight:600 }}>Top 4 → Playoffs</span>
        </div>
        {points.length > 5 && (
          <button onClick={() => setShowAll(s => !s)} style={{ background:'none', border:'none', fontSize:11, fontWeight:700, color:'#7c3aed', cursor:'pointer', fontFamily:'Poppins,sans-serif' }}>
            {showAll ? 'Show less ↑' : `All ${points.length} teams →`}
          </button>
        )}
      </div>
    </div>
  )
}

/* ── Player Cap Card ── */
function CapCard({ data, type }) {
  const isOrange = type === 'orange'
  const accent   = isOrange ? '#ea580c' : '#7c3aed'
  const bg       = isOrange ? '#fff7ed' : '#faf5ff'
  const border   = isOrange ? '#fed7aa' : '#ddd6fe'
  const icon     = isOrange ? '🟠' : '🟣'
  const label    = isOrange ? 'Orange Cap' : 'Purple Cap'
  const team     = getTeam(data?.team || '')

  const stats = isOrange
    ? [{ l:'Runs', v:data?.runs }, { l:'Avg', v:data?.avg }, { l:'SR', v:data?.sr }, { l:'HS', v:data?.hs }]
    : [{ l:'Wkts', v:data?.wickets }, { l:'Econ', v:data?.economy }, { l:'Avg', v:data?.avg }, { l:'Best', v:data?.best }]

  if (!data) return (
    <div style={{ flex:1, borderRadius:14, background:'#f9fafb', border:'1.5px solid #e5e7eb', padding:'16px', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <p style={{ fontSize:11, color:'#9ca3af', fontFamily:'Poppins,sans-serif' }}>Loading…</p>
    </div>
  )

  return (
    <div style={{ flex:1, borderRadius:14, background:'#fff', border:`1.5px solid ${border}`, overflow:'hidden', boxShadow:'0 2px 10px rgba(0,0,0,0.06)' }}>
      <div style={{ height:3, background:`linear-gradient(90deg,${accent},${accent}80)` }} />
      <div style={{ padding:'12px 13px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
          <span style={{ fontSize:16 }}>{icon}</span>
          <div>
            <p style={{ fontSize:9, fontWeight:800, color:accent, textTransform:'uppercase', letterSpacing:'0.12em', margin:0, fontFamily:'Poppins,sans-serif' }}>{label}</p>
            <p style={{ fontSize:8, color:'#9ca3af', margin:0, fontFamily:'Poppins,sans-serif' }}>IPL 2025</p>
          </div>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:10, padding:'8px 10px', background:bg, borderRadius:11, border:`1px solid ${border}` }}>
          <div style={{ width:34, height:34, borderRadius:'50%', background:`linear-gradient(135deg,${accent}30,${accent}10)`, border:`1.5px solid ${accent}30`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>
            {isOrange ? '🏏' : '⚾'}
          </div>
          <div style={{ minWidth:0 }}>
            <p style={{ fontFamily:'Poppins,sans-serif', fontWeight:800, fontSize:12, color:'#1a1a1a', margin:'0 0 1px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{data.name}</p>
            <div style={{ display:'flex', alignItems:'center', gap:4 }}>
              <span style={{ fontSize:11 }}>{team.emoji}</span>
              <p style={{ fontSize:9, fontWeight:700, color:team.color, margin:0, fontFamily:'Poppins,sans-serif' }}>{team.short}</p>
              <span style={{ fontSize:9, color:'#9ca3af', fontFamily:'Poppins,sans-serif' }}>{data.matches}M</span>
            </div>
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:5 }}>
          {stats.map((s, i) => (
            <div key={i} style={{ textAlign:'center', padding:'7px 4px', background:'#f9fafb', borderRadius:9, border:'1px solid #f1f5f9' }}>
              <p style={{ fontFamily:'Poppins,sans-serif', fontWeight:800, fontSize:14, color:i===0?accent:'#1a1a1a', margin:'0 0 1px' }}>{s.v ?? '—'}</p>
              <p style={{ fontSize:8, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.08em', margin:0, fontFamily:'Poppins,sans-serif' }}>{s.l}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Skeleton ── */
function Skeleton({ h = 80, r = 14 }) {
  return <div style={{ height:h, borderRadius:r, background:'linear-gradient(90deg,#f3f4f6 25%,#e5e7eb 50%,#f3f4f6 75%)', backgroundSize:'400% 100%', animation:'shimLoad 1.4s ease-in-out infinite', marginBottom:8 }} />
}

/* ── No data empty state ── */
function Empty({ emoji = '🏏', msg = 'No data', sub = '' }) {
  return (
    <div style={{ textAlign:'center', padding:'28px 20px', background:'#f9fafb', borderRadius:14, border:'1px solid #f1f5f9' }}>
      <p style={{ fontSize:28, marginBottom:8 }}>{emoji}</p>
      <p style={{ fontWeight:700, fontSize:13, color:'#374151', fontFamily:'Poppins,sans-serif', marginBottom:3 }}>{msg}</p>
      {sub && <p style={{ fontSize:11, color:'#9ca3af', fontFamily:'Poppins,sans-serif' }}>{sub}</p>}
    </div>
  )
}

/* ═══════════════════════════════════
   MAIN IPL CRICKET MODULE
═══════════════════════════════════ */
export default function IPLCricket() {
  const [matches, setMatches]         = useState(null)
  const [leaderboard, setLeaderboard] = useState(null)
  const [loading, setLoading]         = useState(true)
  const [isDemo, setIsDemo]           = useState(false)
  const [tab, setTab]                 = useState('today')
  const [lastUpdated, setLastUpdated] = useState(null)
  const [error, setError]             = useState(null)

  /* ── Real-time Firestore listeners ── */
  useEffect(() => {
    setLoading(true)
    let unsubM, unsubL
    let matchesLoaded = false, leaderLoaded = false

    const checkDone = () => {
      if (matchesLoaded && leaderLoaded) setLoading(false)
    }

    // Matches listener
    unsubM = onSnapshot(
      doc(db, 'ipl_data', 'matches'),
      (snap) => {
        if (snap.exists()) {
          const d = snap.data()
          setMatches(d)
          setIsDemo(false)
          setError(null)
          if (d.updatedAt) setLastUpdated(d.updatedAt.toDate?.() || new Date(d.updatedAt))
        } else {
          setMatches(DEMO_MATCHES)
          setIsDemo(true)
        }
        matchesLoaded = true
        checkDone()
      },
      (err) => {
        console.error('[IPL] Matches listener error:', err)
        setMatches(DEMO_MATCHES)
        setIsDemo(true)
        setError('Using demo data')
        matchesLoaded = true
        checkDone()
      }
    )

    // Leaderboard listener
    unsubL = onSnapshot(
      doc(db, 'ipl_data', 'leaderboard'),
      (snap) => {
        setLeaderboard(snap.exists() ? snap.data() : DEMO_LEADERBOARD)
        leaderLoaded = true
        checkDone()
      },
      () => {
        setLeaderboard(DEMO_LEADERBOARD)
        leaderLoaded = true
        checkDone()
      }
    )

    return () => { unsubM?.(); unsubL?.() }
  }, [])

  const today    = matches?.today    || []
  const upcoming = matches?.upcoming || []
  const results  = matches?.results  || []
  const live     = matches?.live     || today.filter(m => m.status === 'live')
  const hasLive  = live.length > 0

  const points     = leaderboard?.points      || []
  const orangeCap  = leaderboard?.orange_cap  || null
  const purpleCap  = leaderboard?.purple_cap  || null

  const TABS = [
    { id:'today',    label:'Today',    icon:'📅', count: today.length },
    { id:'results',  label:'Results',  icon:'📊', count: results.length },
    { id:'upcoming', label:'Upcoming', icon:'🗓', count: upcoming.length },
    { id:'table',    label:'Table',    icon:'📋', count: null },
    { id:'caps',     label:'Caps',     icon:'🏆', count: null },
  ]

  return (
    <div>
      <style>{`
        @keyframes livePulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.35;transform:scale(0.85)} }
        @keyframes shimLoad  { 0%{background-position:200% center} 100%{background-position:-200% center} }
        @keyframes slideUp   { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        .ipl-tab { transition:all 0.18s; }
        .ipl-tab:active { transform:scale(0.94); }
      `}</style>

      {/* ── Header ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:3, height:16, borderRadius:2, background:'linear-gradient(to bottom,#f97316,#f9731650)' }} />
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <p style={{ fontSize:13, fontWeight:800, color:'#1a1a1a', margin:0, fontFamily:'Poppins,sans-serif' }}>🏏 IPL 2025</p>
              {hasLive && <LiveBadge />}
              {isDemo && <span style={{ fontSize:8, fontWeight:700, padding:'2px 6px', background:'#fef9c3', border:'1px solid #fde68a', borderRadius:12, color:'#ca8a04', fontFamily:'Poppins,sans-serif' }}>DEMO</span>}
            </div>
            {lastUpdated && (
              <p style={{ fontSize:9, color:'#9ca3af', margin:0, fontFamily:'Poppins,sans-serif' }}>
                Updated {lastUpdated.toLocaleTimeString('en-IN', {hour:'2-digit',minute:'2-digit'})}
              </p>
            )}
            {isDemo && (
              <p style={{ fontSize:9, color:'#9ca3af', margin:0, fontFamily:'Poppins,sans-serif' }}>
                Live data loads after Cloud Functions run
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display:'flex', gap:5, marginBottom:12, overflowX:'auto', paddingBottom:2, scrollbarWidth:'none' }}>
        {TABS.map(t => (
          <button key={t.id} className="ipl-tab" onClick={() => setTab(t.id)} style={{
            padding:'6px 12px', borderRadius:20, fontWeight:700, fontSize:11, whiteSpace:'nowrap',
            cursor:'pointer', fontFamily:'Poppins,sans-serif', border:'none',
            background: tab===t.id ? '#1e293b' : '#f3f4f6',
            color: tab===t.id ? '#fff' : '#6b7280',
            boxShadow: tab===t.id ? '0 2px 8px rgba(30,41,59,0.2)' : 'none',
            display:'flex', alignItems:'center', gap:4, flexShrink:0,
          }}>
            {t.icon} {t.label}
            {t.count > 0 && (
              <span style={{ fontSize:9, padding:'1px 5px', borderRadius:10, background:tab===t.id?'rgba(255,255,255,0.2)':'#e5e7eb', color:tab===t.id?'#fff':'#6b7280', fontWeight:800 }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div>
          <Skeleton h={200} />
          <Skeleton h={100} />
        </div>
      ) : (
        <div style={{ animation:'slideUp 0.28s ease-out both' }}>

          {/* TODAY */}
          {tab === 'today' && (
            <>
              {today.length === 0
                ? <Empty emoji="🏏" msg="No matches today" sub="Check upcoming tab" />
                : today.map((m, i) => <HeroMatchCard key={m.id || i} match={m} />)
              }
            </>
          )}

          {/* RESULTS */}
          {tab === 'results' && (
            <>
              {results.length === 0
                ? <Empty emoji="📊" msg="No results yet" sub="Completed matches appear here" />
                : results.map((m, i) => <ResultCard key={m.id || i} match={m} />)
              }
            </>
          )}

          {/* UPCOMING */}
          {tab === 'upcoming' && (
            <>
              {upcoming.length === 0
                ? <Empty emoji="🗓" msg="No upcoming matches" sub="Schedule updates daily at 6 AM" />
                : (
                  <div style={{ display:'flex', gap:10, overflowX:'auto', paddingBottom:8, scrollbarWidth:'none' }}>
                    {upcoming.map((m, i) => <UpcomingCard key={m.id || i} match={m} />)}
                  </div>
                )
              }
            </>
          )}

          {/* POINTS TABLE */}
          {tab === 'table' && <PointsTable points={points} />}

          {/* CAPS */}
          {tab === 'caps' && (
            <div style={{ display:'flex', gap:10 }}>
              <CapCard data={orangeCap} type="orange" />
              <CapCard data={purpleCap} type="purple" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}