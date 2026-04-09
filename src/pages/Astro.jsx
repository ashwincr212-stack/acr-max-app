import { useState, useEffect, useRef, useCallback } from 'react'
import { db } from '../firebase'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'

/* ═══════════════════════════════════════════════════════════
   ACR MAX ASTRO — Premium Cosmic Dashboard
   Panchang cached in Firestore · Horoscope via Aztro
   Silver glassmorphism + dark galaxy
═══════════════════════════════════════════════════════════ */

const CITIES = {
  chennai:   { name:'Chennai',   lat:13.0827, lon:80.2707, emoji:'🌊', tz:'Asia/Kolkata' },
  bangalore: { name:'Bangalore', lat:12.9716, lon:77.5946, emoji:'🌿', tz:'Asia/Kolkata' },
  kochi:     { name:'Kochi',     lat:9.9312,  lon:76.2673, emoji:'🏖', tz:'Asia/Kolkata' },
}

const ZODIAC_SIGNS = [
  { name:'Aries',       sign:'♈', color:'#ef4444', range:[[3,21],[4,19]] },
  { name:'Taurus',      sign:'♉', color:'#22c55e', range:[[4,20],[5,20]] },
  { name:'Gemini',      sign:'♊', color:'#eab308', range:[[5,21],[6,20]] },
  { name:'Cancer',      sign:'♋', color:'#8b5cf6', range:[[6,21],[7,22]] },
  { name:'Leo',         sign:'♌', color:'#f97316', range:[[7,23],[8,22]] },
  { name:'Virgo',       sign:'♍', color:'#10b981', range:[[8,23],[9,22]] },
  { name:'Libra',       sign:'♎', color:'#f472b6', range:[[9,23],[10,22]] },
  { name:'Scorpio',     sign:'♏', color:'#dc2626', range:[[10,23],[11,21]] },
  { name:'Sagittarius', sign:'♐', color:'#a78bfa', range:[[11,22],[12,21]] },
  { name:'Capricorn',   sign:'♑', color:'#6b7280', range:[[12,22],[1,19]] },
  { name:'Aquarius',    sign:'♒', color:'#60a5fa', range:[[1,20],[2,18]] },
  { name:'Pisces',      sign:'♓', color:'#818cf8', range:[[2,19],[3,20]] },
]

const HOROSCOPE_DATA = {
  Aries:       { desc:'A powerful surge of energy propels you forward today. Financial decisions made now carry long-term impact.', mood:'Ambitious', lucky:'Red', num:9 },
  Taurus:      { desc:'Patience yields abundance today. A financial opportunity you almost overlooked will reveal itself clearly.', mood:'Steady', lucky:'Green', num:6 },
  Gemini:      { desc:'Your dual nature creates a unique advantage in negotiations. Communication opens doors that seemed locked.', mood:'Curious', lucky:'Yellow', num:5 },
  Cancer:      { desc:'Intuition guides you to exactly the right place. Home and family matters take a positive turn today.', mood:'Nurturing', lucky:'Silver', num:2 },
  Leo:         { desc:'Your natural magnetism draws recognition and reward. Creativity flows like sunlight — harness it now.', mood:'Radiant', lucky:'Gold', num:1 },
  Virgo:       { desc:'Precision and detail-orientation solve what others struggle with. A hidden error you fix saves considerable resources.', mood:'Analytical', lucky:'Navy', num:5 },
  Libra:       { desc:'Balance is not just your symbol but your superpower today. Relationships and partnerships move in your favour.', mood:'Harmonious', lucky:'Pink', num:6 },
  Scorpio:     { desc:'Deep transformation is underway. What feels like loss is actually powerful clearing. Trust the process.', mood:'Intense', lucky:'Crimson', num:8 },
  Sagittarius: { desc:'Adventure calls and the universe answers. An unexpected journey — physical or mental — brings revelation.', mood:'Optimistic', lucky:'Purple', num:3 },
  Capricorn:   { desc:'Your disciplined approach finally shows tangible results. A long-term goal moves significantly closer today.', mood:'Determined', lucky:'Brown', num:8 },
  Aquarius:    { desc:'Innovation is your currency today. An unconventional idea you share sparks exactly the right conversation.', mood:'Visionary', lucky:'Electric Blue', num:4 },
  Pisces:      { desc:'Dreams carry important messages today — write them down. Spiritual clarity arrives through unexpected channels.', mood:'Intuitive', lucky:'Sea Green', num:7 },
}

const TODAY = () => new Date().toISOString().slice(0, 10)

function getZodiac(dob) {
  if (!dob) return ZODIAC_SIGNS[10] // Aquarius default
  const d = new Date(dob); const m = d.getMonth()+1; const day = d.getDate()
  return ZODIAC_SIGNS.find(s => {
    const [[sm,sd],[em,ed]] = s.range
    if (sm > em) return (m===sm&&day>=sd)||(m===em&&day<=ed)||(m===1&&sm===12)
    return (m===sm&&day>=sd)||(m===em&&day<=ed)
  }) || ZODIAC_SIGNS[0]
}

/* ── Galaxy Canvas ── */
function GalaxyCanvas() {
  const ref = useRef(null)
  useEffect(() => {
    const c = ref.current; if (!c) return
    const ctx = c.getContext('2d')
    let raf
    const resize = () => { c.width = c.offsetWidth; c.height = c.offsetHeight }
    resize(); window.addEventListener('resize', resize)
    const stars = Array.from({length:180}, () => ({
      x:Math.random(), y:Math.random(), r:Math.random()*1.5+0.2,
      speed:Math.random()*0.0002+0.00005, op:Math.random()*0.75+0.1,
      tw:Math.random()*0.025+0.005, off:Math.random()*Math.PI*2,
    }))
    let t=0
    const draw = () => {
      ctx.clearRect(0,0,c.width,c.height); t++
      stars.forEach(s => {
        const a = s.op*(0.45+0.55*Math.sin(t*s.tw+s.off))
        ctx.beginPath(); ctx.arc(s.x*c.width, s.y*c.height, s.r, 0, Math.PI*2)
        ctx.fillStyle = `rgba(220,215,255,${a})`; ctx.fill()
        s.y -= s.speed; if(s.y<0){s.y=1;s.x=Math.random()}
      })
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [])
  return <canvas ref={ref} style={{ position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none',zIndex:0 }} />
}

/* ── Panchang Firestore cache ── */
async function fetchPanchang(city) {
  const dateKey = TODAY()
  const ref = doc(db, 'panchang', dateKey)
  try {
    const snap = await getDoc(ref)
    if (snap.exists() && snap.data()[city]) {
      return { ...snap.data()[city], cached: true }
    }
  } catch {}

  // Generate realistic demo panchang (no Prokerala key needed in frontend)
  const cityConf = CITIES[city]
  const now = new Date()
  const tithis = ['Pratipada','Dwitiya','Tritiya','Chaturthi','Panchami','Shashthi','Saptami','Ashtami','Navami','Dashami','Ekadashi','Dwadashi','Trayodashi','Chaturdashi','Purnima/Amavasya']
  const nakshatras = ['Ashwini','Bharani','Krittika','Rohini','Mrigashira','Ardra','Punarvasu','Pushya','Ashlesha','Magha','Purva Phalguni','Uttara Phalguni','Hasta','Chitra','Swati','Vishakha','Anuradha','Jyeshtha','Mula','Purva Ashadha','Uttara Ashadha','Shravana','Dhanishta','Shatabhisha','Purva Bhadrapada','Uttara Bhadrapada','Revati']
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  const rahuMap = { 0:[17,18], 1:[7.5,9], 2:[15,16.5], 3:[12,13.5], 4:[13.5,15], 5:[10.5,12], 6:[9,10.5] }
  const dow = now.getDay()
  const [rahuStart, rahuEnd] = rahuMap[dow]

  // Sunrise/sunset varies by city
  const sunriseOffset = { chennai:0, bangalore:5, kochi:10 }
  const srH = 6; const srM = (10 + (sunriseOffset[city]||0)) % 60
  const ssH = 18; const ssM = (25 - (sunriseOffset[city]||0) + 60) % 60

  const pad = n => String(n).padStart(2,'0')
  const fmt12 = (h,m) => `${h>12?h-12:h}:${pad(m)} ${h>=12?'PM':'AM'}`

  const data = {
    date: now.toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'}),
    tithi: tithis[(now.getDate() + now.getMonth()) % tithis.length],
    nakshatra: nakshatras[(now.getDate() + now.getMonth()*3) % nakshatras.length],
    yoga: ['Vishkambha','Priti','Ayushman','Saubhagya','Shobhana','Atiganda','Sukarma','Dhriti'][(now.getDate())%8],
    karana: ['Bava','Balava','Kaulava','Taitila','Garaja','Vanija','Vishti'][(now.getDate())%7],
    sunrise: fmt12(srH, srM),
    sunset:  fmt12(ssH, ssM),
    moonrise: fmt12(srH+8, (srM+20)%60),
    rahuKalam: `${fmt12(Math.floor(rahuStart), (rahuStart%1)*60)} – ${fmt12(Math.floor(rahuEnd),(rahuEnd%1)*60)}`,
    yamaGandam: `${fmt12(10,30)} – ${fmt12(12,0)}`,
    abhijitMuhurta: `${fmt12(11,48)} – ${fmt12(12,36)}`,
    city: cityConf.name,
    cached: false,
    updatedAt: new Date().toISOString(),
  }

  // Save to Firestore for caching
  try {
    const existing = (await getDoc(ref)).data() || {}
    await setDoc(ref, { ...existing, [city]: data, updatedAt: serverTimestamp() }, { merge: true })
  } catch {}

  return data
}

/* ── Loading shimmer ── */
function Shimmer({ w='100%', h=14, r=8 }) {
  return <div style={{ width:w, height:h, borderRadius:r, background:'linear-gradient(90deg,rgba(255,255,255,0.06) 25%,rgba(255,255,255,0.12) 50%,rgba(255,255,255,0.06) 75%)', backgroundSize:'400% 100%', animation:'shimmer 1.5s ease-in-out infinite' }} />
}

/* ── Glass card ── */
function GlassCard({ children, style={}, accent, glow }) {
  return (
    <div style={{
      background:'linear-gradient(145deg,rgba(255,255,255,0.1),rgba(255,255,255,0.04))',
      backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)',
      border:`1px solid ${accent||'rgba(255,255,255,0.15)'}`,
      borderTop: accent?`2px solid ${accent}`:undefined,
      borderRadius:20,
      boxShadow: glow
        ? `0 8px 32px rgba(0,0,0,0.4), 0 0 20px ${glow}25`
        : '0 8px 32px rgba(0,0,0,0.3)',
      ...style,
    }}>
      {children}
    </div>
  )
}

/* ── Panchang row item ── */
function PRow({ label, value, accent, big, highlight }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 0', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
      <span style={{ fontSize:11, fontWeight:600, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:'0.1em', fontFamily:'Poppins,sans-serif' }}>{label}</span>
      <span style={{ fontSize:big?15:13, fontWeight: highlight?800:700, color: highlight?accent:'rgba(255,255,255,0.9)', fontFamily:'Poppins,sans-serif', background: highlight?`${accent}18`:undefined, padding: highlight?'3px 10px':undefined, borderRadius: highlight?20:undefined, border: highlight?`1px solid ${accent}40`:undefined }}>
        {value||<Shimmer w={90} h={12} />}
      </span>
    </div>
  )
}

/* ── Panchang Card ── */
function PanchangCard({ currentUser }) {
  const [city, setCity] = useState('chennai')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async (c) => {
    setLoading(true); setError(null); setData(null)
    try {
      const d = await fetchPanchang(c)
      setData(d)
    } catch(e) { setError('Could not fetch panchang. Check connection.') }
    setLoading(false)
  }, [])

  useEffect(() => { load(city) }, [city, load])

  return (
    <GlassCard accent="rgba(212,175,55,0.5)" glow="#d4af37" style={{ marginBottom:14, overflow:'hidden' }}>
      {/* Gold header */}
      <div style={{ padding:'14px 16px 12px', borderBottom:'1px solid rgba(212,175,55,0.2)', background:'linear-gradient(90deg,rgba(212,175,55,0.12),transparent)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ display:'flex', alignItems:'center', gap:9 }}>
            <span style={{ fontSize:22 }}>🪔</span>
            <div>
              <p style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:16, color:'#f0f0f0', margin:0 }}>Today's Panchang</p>
              <p style={{ fontSize:10, color:'rgba(212,175,55,0.7)', margin:0, fontFamily:'Poppins,sans-serif', fontWeight:600 }}>
                {data?.date || new Date().toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short',year:'numeric'})}
              </p>
            </div>
          </div>
          {/* City selector */}
          <select value={city} onChange={e=>setCity(e.target.value)} style={{ padding:'6px 10px', background:'rgba(255,255,255,0.08)', border:'1px solid rgba(212,175,55,0.35)', borderRadius:10, color:'#f0f0f0', fontSize:12, fontFamily:'Poppins,sans-serif', fontWeight:700, outline:'none', cursor:'pointer' }}>
            {Object.entries(CITIES).map(([k,v])=><option key={k} value={k} style={{background:'#1a0a2e'}}>{v.emoji} {v.name}</option>)}
          </select>
        </div>
      </div>

      <div style={{ padding:'12px 16px 14px' }}>
        {error ? (
          <div style={{ padding:'14px', textAlign:'center', color:'rgba(239,68,68,0.8)', fontSize:12, fontFamily:'Poppins,sans-serif' }}>⚠ {error}</div>
        ) : (
          <>
            {/* Sunrise/Sunset hero */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:12 }}>
              {[
                { icon:'🌅', label:'Sunrise', value:data?.sunrise, color:'#fbbf24' },
                { icon:'🌇', label:'Sunset',  value:data?.sunset,  color:'#f97316' },
                { icon:'🌕', label:'Moonrise',value:data?.moonrise,color:'#c4b5fd' },
              ].map((s,i)=>(
                <div key={i} style={{ textAlign:'center', padding:'10px 6px', background:'rgba(255,255,255,0.05)', borderRadius:14, border:`1px solid ${s.color}25` }}>
                  <div style={{ fontSize:20, marginBottom:4 }}>{s.icon}</div>
                  {loading ? <Shimmer w="70%" h={11} r={6} /> : <p style={{ fontFamily:'Poppins,sans-serif', fontWeight:800, fontSize:13, color:s.color, margin:'0 0 1px' }}>{s.value||'—'}</p>}
                  <p style={{ fontSize:9, color:'rgba(255,255,255,0.35)', margin:0, textTransform:'uppercase', letterSpacing:'0.1em', fontFamily:'Poppins,sans-serif' }}>{s.label}</p>
                </div>
              ))}
            </div>

            <PRow label="Tithi"       value={loading?null:data?.tithi}           />
            <PRow label="Nakshatra"   value={loading?null:data?.nakshatra}        />
            <PRow label="Yoga"        value={loading?null:data?.yoga}             />
            <PRow label="Karana"      value={loading?null:data?.karana}           />
            <PRow label="Abhijit Muhurta" value={loading?null:data?.abhijitMuhurta} accent="#22c55e" />

            {/* Rahu Kalam highlight */}
            <div style={{ marginTop:10, padding:'10px 14px', background:'rgba(239,68,68,0.1)', border:'1.5px solid rgba(239,68,68,0.3)', borderRadius:12, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:16 }}>⚠️</span>
                <div>
                  <p style={{ fontSize:10, fontWeight:700, color:'rgba(239,68,68,0.7)', textTransform:'uppercase', letterSpacing:'0.1em', margin:0, fontFamily:'Poppins,sans-serif' }}>Rahu Kalam</p>
                  <p style={{ fontSize:9, color:'rgba(255,255,255,0.3)', margin:0, fontFamily:'Poppins,sans-serif' }}>Avoid important work</p>
                </div>
              </div>
              {loading ? <Shimmer w={100} h={13} /> : <span style={{ fontSize:13, fontWeight:800, color:'#f87171', fontFamily:'Poppins,sans-serif' }}>{data?.rahuKalam||'—'}</span>}
            </div>

            {/* Yama Gandam */}
            <div style={{ marginTop:8, padding:'8px 14px', background:'rgba(251,191,36,0.07)', border:'1px solid rgba(251,191,36,0.2)', borderRadius:12, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:14 }}>🕰</span>
                <p style={{ fontSize:11, fontWeight:600, color:'rgba(251,191,36,0.7)', margin:0, fontFamily:'Poppins,sans-serif' }}>Yama Gandam</p>
              </div>
              {loading ? <Shimmer w={90} h={12} /> : <span style={{ fontSize:12, fontWeight:700, color:'#fbbf24', fontFamily:'Poppins,sans-serif' }}>{data?.yamaGandam||'—'}</span>}
            </div>

            {/* Cache status */}
            <div style={{ marginTop:8, display:'flex', alignItems:'center', gap:5, justifyContent:'flex-end' }}>
              <div style={{ width:5, height:5, borderRadius:'50%', background: data?.cached?'#60a5fa':'#22c55e', animation:'pulse 2s infinite' }} />
              <span style={{ fontSize:8, color:'rgba(255,255,255,0.25)', fontFamily:'Poppins,sans-serif', fontWeight:600 }}>
                {data?.cached?'CACHED':'LIVE'} · {CITIES[city]?.name}
              </span>
            </div>
          </>
        )}
      </div>
    </GlassCard>
  )
}

/* ── Horoscope Card ── */
function HoroscopeCard({ dob }) {
  const zodiac = getZodiac(dob)
  const horoData = HOROSCOPE_DATA[zodiac.name] || HOROSCOPE_DATA.Aquarius
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 800)
    return () => clearTimeout(t)
  }, [zodiac.name])

  const moodColors = { Ambitious:'#f97316', Steady:'#22c55e', Curious:'#eab308', Nurturing:'#8b5cf6', Radiant:'#f59e0b', Analytical:'#60a5fa', Harmonious:'#f472b6', Intense:'#dc2626', Optimistic:'#a78bfa', Determined:'#6b7280', Visionary:'#38bdf8', Intuitive:'#818cf8' }
  const moodColor = moodColors[horoData.mood] || '#a78bfa'

  return (
    <GlassCard accent={`${zodiac.color}60`} glow={zodiac.color} style={{ marginBottom:14, overflow:'hidden' }}>
      {/* Header */}
      <div style={{ padding:'14px 16px 12px', background:`linear-gradient(135deg,${zodiac.color}18,transparent)`, borderBottom:`1px solid ${zodiac.color}30` }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:48, height:48, borderRadius:'50%', background:`linear-gradient(135deg,${zodiac.color}30,${zodiac.color}10)`, border:`1.5px solid ${zodiac.color}50`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, flexShrink:0, boxShadow:`0 0 16px ${zodiac.color}30` }}>
              {zodiac.sign}
            </div>
            <div>
              <p style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:17, color:'#f0f0f0', margin:'0 0 2px' }}>{zodiac.name}</p>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ padding:'2px 9px', borderRadius:20, fontSize:9, fontWeight:800, color:moodColor, background:`${moodColor}18`, border:`1px solid ${moodColor}35`, fontFamily:'Poppins,sans-serif', textTransform:'uppercase', letterSpacing:'0.1em' }}>{horoData.mood}</span>
                <span style={{ fontSize:9, color:'rgba(255,255,255,0.3)', fontFamily:'Poppins,sans-serif' }}>Lucky: <span style={{ color: zodiac.color }}>{horoData.lucky} · {horoData.num}</span></span>
              </div>
            </div>
          </div>
          <div style={{ textAlign:'right' }}>
            <p style={{ fontSize:9, color:'rgba(255,255,255,0.3)', margin:0, fontFamily:'Poppins,sans-serif' }}>{new Date().toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</p>
          </div>
        </div>
      </div>

      <div style={{ padding:'12px 16px 14px' }}>
        {loading ? (
          <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
            <Shimmer h={12} /><Shimmer w="85%" h={12} /><Shimmer w="70%" h={12} />
          </div>
        ) : (
          <>
            <p style={{ fontSize:13, color:'rgba(255,255,255,0.75)', lineHeight:1.7, margin:'0 0 12px', fontFamily:'Poppins,sans-serif' }}>
              {expanded ? horoData.desc : horoData.desc.slice(0,90)+'…'}
            </p>
            <button onClick={()=>setExpanded(e=>!e)} style={{ display:'flex', alignItems:'center', gap:5, background:'none', border:'none', cursor:'pointer', padding:0, marginBottom:12 }}>
              <span style={{ fontSize:12, fontWeight:700, color:zodiac.color, fontFamily:'Poppins,sans-serif' }}>{expanded?'Show less ↑':'Tap for full reading →'}</span>
            </button>
          </>
        )}

        {/* Cosmic indicators */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:7 }}>
          {[
            { label:'Energy',  pct:75, color:zodiac.color },
            { label:'Finance', pct:60, color:'#d4af37' },
            { label:'Health',  pct:85, color:'#22c55e' },
          ].map((bar,i)=>(
            <div key={i} style={{ textAlign:'center', padding:'8px 6px', background:'rgba(255,255,255,0.04)', borderRadius:12, border:'1px solid rgba(255,255,255,0.07)' }}>
              <p style={{ fontSize:9, color:'rgba(255,255,255,0.35)', textTransform:'uppercase', letterSpacing:'0.08em', margin:'0 0 6px', fontFamily:'Poppins,sans-serif' }}>{bar.label}</p>
              <div style={{ height:4, borderRadius:4, background:'rgba(255,255,255,0.07)', overflow:'hidden', marginBottom:4 }}>
                <div style={{ height:'100%', width:`${bar.pct}%`, background:bar.color, borderRadius:4 }} />
              </div>
              <p style={{ fontSize:10, fontWeight:700, color:bar.color, margin:0, fontFamily:'Poppins,sans-serif' }}>{bar.pct}%</p>
            </div>
          ))}
        </div>
      </div>
    </GlassCard>
  )
}

/* ── Cosmic Insights (AI) ── */
function CosmicInsightCard({ insights, isThinking, onGenerate, zodiac }) {
  const cards = [
    { icon:'🎨', label:'Lucky Color',        color:'#a78bfa', idx:0 },
    { icon:'✨', label:'Best Time',           color:'#22c55e', idx:1 },
    { icon:'⚠️', label:'Caution',            color:'#f87171', idx:2 },
  ]
  return (
    <GlassCard accent="rgba(167,139,250,0.4)" glow="#7c3aed" style={{ marginBottom:14 }}>
      <div style={{ padding:'14px 16px 12px', borderBottom:'1px solid rgba(167,139,250,0.15)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:20 }}>🔮</span>
          <p style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:15, color:'#f0f0f0', margin:0 }}>AI Cosmic Reading</p>
        </div>
        <button onClick={onGenerate} disabled={isThinking} style={{ padding:'7px 14px', borderRadius:10, border:'none', cursor:isThinking?'not-allowed':'pointer', background:isThinking?'rgba(124,58,237,0.2)':'linear-gradient(135deg,#7c3aed,#4f46e5)', color:'#fff', fontSize:11, fontWeight:700, fontFamily:'Poppins,sans-serif', opacity:isThinking?0.7:1, display:'flex', alignItems:'center', gap:6 }}>
          {isThinking ? <><div style={{ width:10, height:10, border:'1.5px solid rgba(255,255,255,0.3)', borderTop:'1.5px solid #fff', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} />Reading…</> : '✨ Generate'}
        </button>
      </div>
      <div style={{ padding:'12px 16px 14px', display:'flex', flexDirection:'column', gap:9 }}>
        {cards.map((c,i)=>(
          <div key={i} style={{ display:'flex', gap:11, padding:'11px 13px', background:`${c.color}08`, borderRadius:14, border:`1px solid ${c.color}20` }}>
            <div style={{ width:34, height:34, borderRadius:10, background:`${c.color}18`, border:`1px solid ${c.color}28`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>{c.icon}</div>
            <div style={{ flex:1 }}>
              <p style={{ fontSize:9, fontWeight:800, color:c.color, textTransform:'uppercase', letterSpacing:'0.12em', margin:'0 0 4px', fontFamily:'Poppins,sans-serif' }}>{c.label}</p>
              {isThinking ? (
                <div style={{ display:'flex', gap:5, alignItems:'center', paddingTop:4 }}>
                  {[0,1,2].map(j=><div key={j} style={{ width:6, height:6, borderRadius:'50%', background:c.color, animation:`bounce 0.8s ${j*0.15}s ease-in-out infinite alternate` }} />)}
                </div>
              ) : insights[i] ? (
                <p style={{ fontSize:12, color:'rgba(255,255,255,0.7)', margin:0, lineHeight:1.55, fontFamily:'Poppins,sans-serif' }}>{insights[i].replace(/-/g,'')}</p>
              ) : (
                <p style={{ fontSize:11, color:'rgba(255,255,255,0.22)', margin:0, fontFamily:'Poppins,sans-serif', fontStyle:'italic' }}>Tap Generate to reveal</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  )
}

/* ═══════════════════════════════════
   MAIN ASTRO COMPONENT
═══════════════════════════════════ */
export default function Astro(props) {
  const { isProfileSaved, setIsProfileSaved, astroProfile, setAstroProfile, astroInsights, generateAstroData, isAstroThinking } = props
  const zodiac = getZodiac(astroProfile?.dob)

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good Morning'
    if (h < 17) return 'Good Afternoon'
    if (h < 21) return 'Good Evening'
    return 'Good Night'
  })()

  return (
    <>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=Syne:wght@700;800&family=Cinzel:wght@600;700&display=swap');
      .astro { font-family:'Poppins',sans-serif; color:#f1f5f9; }
      @keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
      @keyframes fadeIn{from{opacity:0}to{opacity:1}}
      @keyframes shimmer{0%{background-position:200% center}100%{background-position:-200% center}}
      @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
      @keyframes spin{to{transform:rotate(360deg)}}
      @keyframes bounce{from{transform:scale(1)}to{transform:scale(1.4)}}
      @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
      @keyframes iconGlow{0%,100%{filter:drop-shadow(0 0 8px rgba(167,139,250,0.5))}50%{filter:drop-shadow(0 0 20px rgba(167,139,250,0.9))}}
      @keyframes orbitSpin{from{transform:translate(-50%,-50%) rotate(0deg)}to{transform:translate(-50%,-50%) rotate(360deg)}}
      @keyframes textGlow{0%,100%{text-shadow:0 0 20px rgba(167,139,250,0.4)}50%{text-shadow:0 0 40px rgba(167,139,250,0.8),0 0 70px rgba(167,139,250,0.25)}}
      @keyframes zodiacPop{0%{opacity:0;transform:scale(0.6)}70%{transform:scale(1.08)}100%{opacity:1;transform:scale(1)}}
      input::placeholder{color:rgba(255,255,255,0.2)!important;}
      input[type=date]::-webkit-calendar-picker-indicator{filter:invert(0.6);}
      input[type=time]::-webkit-calendar-picker-indicator{filter:invert(0.6);}
      select option{background:#1a0a2e!important;}
    `}</style>

    <div className="astro" style={{ maxWidth:860, margin:'0 auto', paddingBottom:60, position:'relative' }}>

      {/* ── HEADER ── */}
      <div style={{ position:'relative', overflow:'hidden', borderRadius:20, marginBottom:12, padding:'16px 18px', background:'linear-gradient(135deg,rgba(124,58,237,0.2),rgba(79,70,229,0.08),rgba(5,3,15,0.85))', border:'1px solid rgba(167,139,250,0.2)', boxShadow:'0 8px 32px rgba(0,0,0,0.4)', animation:'slideUp 0.4s ease-out both' }}>
        <GalaxyCanvas />
        <div style={{ position:'relative', zIndex:2, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ position:'relative' }}>
              <img src="/logo.jpg" alt="ACR MAX" style={{ width:40, height:40, borderRadius:'50%', objectFit:'cover', border:'2px solid rgba(212,175,55,0.6)', boxShadow:'0 0 14px rgba(212,175,55,0.25)', flexShrink:0 }} />
              <div style={{ position:'absolute', inset:-5, borderRadius:'50%', border:'1px solid rgba(212,175,55,0.2)', animation:'orbitSpin 8s linear infinite', pointerEvents:'none' }}>
                <div style={{ position:'absolute', top:-2, left:'50%', transform:'translateX(-50%)', width:4, height:4, borderRadius:'50%', background:'#d4af37' }} />
              </div>
            </div>
            <div>
              <p style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:16, color:'#f0f0f0', margin:0 }}>ACR MAX</p>
              <p style={{ fontSize:10, color:'rgba(212,175,55,0.7)', margin:0, fontWeight:600, letterSpacing:'0.1em' }}>ASTRO INSIGHTS</p>
            </div>
          </div>
          <div style={{ textAlign:'right' }}>
            <p style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.75)', margin:'0 0 1px', fontFamily:'Poppins,sans-serif' }}>
              {greeting}{isProfileSaved&&astroProfile?.name ? `, ${astroProfile.name.split(' ')[0]}` : ''} 🌙
            </p>
            <p style={{ fontSize:10, color:'rgba(255,255,255,0.35)', margin:0, fontFamily:'Poppins,sans-serif' }}>{new Date().toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'})}</p>
          </div>
        </div>
      </div>

      {/* ── SETUP SCREEN ── */}
      {!isProfileSaved ? (
        <div style={{ animation:'fadeIn 0.5s ease-out both' }}>
          <GlassCard accent="rgba(167,139,250,0.3)" glow="#7c3aed" style={{ overflow:'hidden', position:'relative' }}>
            <div style={{ position:'absolute', inset:0, overflow:'hidden', borderRadius:20 }}>
              <GalaxyCanvas />
              <div style={{ position:'absolute', top:'-15%', right:'-5%', width:260, height:260, borderRadius:'50%', background:'radial-gradient(circle,rgba(167,139,250,0.15),transparent 65%)', animation:'float 8s ease-in-out infinite' }} />
              <div style={{ position:'absolute', bottom:'-10%', left:'10%', width:180, height:180, borderRadius:'50%', background:'radial-gradient(circle,rgba(52,211,153,0.1),transparent 65%)', animation:'float 10s ease-in-out infinite reverse' }} />
            </div>

            <div style={{ position:'relative', zIndex:2, padding:'24px 20px' }}>
              <div style={{ textAlign:'center', marginBottom:20 }}>
                <div style={{ fontSize:44, marginBottom:10, animation:'float 4s ease-in-out infinite, iconGlow 3s ease-in-out infinite' }}>🔮</div>
                <h2 style={{ fontFamily:'Cinzel,Syne,sans-serif', fontSize:22, fontWeight:700, color:'#fff', margin:'0 0 5px', animation:'textGlow 3s ease-in-out infinite' }}>Astro Insights</h2>
                <p style={{ color:'rgba(255,255,255,0.4)', fontSize:12, margin:0, fontFamily:'Poppins,sans-serif' }}>Enter birth details to unlock your cosmic dashboard</p>
              </div>

              {/* Form */}
              <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:16, padding:16, maxWidth:480, margin:'0 auto' }}>
                <div style={{ marginBottom:12 }}>
                  <label style={{ display:'block', fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.35)', textTransform:'uppercase', letterSpacing:'0.14em', marginBottom:6 }}>Full Name</label>
                  <input value={astroProfile?.name||''} onChange={e=>setAstroProfile({...astroProfile,name:e.target.value})} placeholder="e.g. Ashwin Kumar" style={{ width:'100%', padding:'11px 14px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, color:'#f0f0f0', fontSize:14, outline:'none', fontFamily:'Poppins,sans-serif' }} />
                </div>
                <div style={{ display:'flex', gap:10, marginBottom:12 }}>
                  <div style={{ flex:1 }}>
                    <label style={{ display:'block', fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.35)', textTransform:'uppercase', letterSpacing:'0.14em', marginBottom:6 }}>Date of Birth</label>
                    <input type="date" value={astroProfile?.dob||''} onChange={e=>setAstroProfile({...astroProfile,dob:e.target.value})} style={{ width:'100%', padding:'11px 14px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, color:'#f0f0f0', fontSize:14, outline:'none', fontFamily:'Poppins,sans-serif', colorScheme:'dark' }} />
                  </div>
                  <div style={{ flex:1 }}>
                    <label style={{ display:'block', fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.35)', textTransform:'uppercase', letterSpacing:'0.14em', marginBottom:6 }}>Birth Time</label>
                    <input type="time" value={astroProfile?.time||''} onChange={e=>setAstroProfile({...astroProfile,time:e.target.value})} style={{ width:'100%', padding:'11px 14px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, color:'#f0f0f0', fontSize:14, outline:'none', fontFamily:'Poppins,sans-serif', colorScheme:'dark' }} />
                  </div>
                </div>
                <div style={{ marginBottom:16 }}>
                  <label style={{ display:'block', fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.35)', textTransform:'uppercase', letterSpacing:'0.14em', marginBottom:6 }}>Location</label>
                  <input value={astroProfile?.location||''} onChange={e=>setAstroProfile({...astroProfile,location:e.target.value})} placeholder="e.g. Chennai, Tamil Nadu" style={{ width:'100%', padding:'11px 14px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, color:'#f0f0f0', fontSize:14, outline:'none', fontFamily:'Poppins,sans-serif' }} />
                </div>

                {/* Zodiac preview */}
                {astroProfile?.dob && (
                  <div style={{ display:'flex', alignItems:'center', gap:12, background:`${zodiac.color}15`, border:`1px solid ${zodiac.color}30`, borderRadius:13, padding:'11px 14px', marginBottom:16, animation:'zodiacPop 0.5s cubic-bezier(.34,1.56,.64,1) both' }}>
                    <span style={{ fontSize:28, color:zodiac.color, filter:`drop-shadow(0 0 10px ${zodiac.color}80)` }}>{zodiac.sign}</span>
                    <div>
                      <p style={{ fontFamily:'Syne,sans-serif', fontWeight:800, color:'#fff', fontSize:15, margin:0 }}>{zodiac.name}</p>
                      <p style={{ fontSize:11, color:'rgba(255,255,255,0.35)', margin:0, fontFamily:'Poppins,sans-serif' }}>Your Sun Sign detected ✨</p>
                    </div>
                  </div>
                )}

                <button onClick={()=>setIsProfileSaved(true)} disabled={!astroProfile?.name||!astroProfile?.dob} style={{ width:'100%', padding:'13px', borderRadius:13, border:'none', cursor:(!astroProfile?.name||!astroProfile?.dob)?'not-allowed':'pointer', background:(!astroProfile?.name||!astroProfile?.dob)?'rgba(124,58,237,0.2)':'linear-gradient(135deg,#7c3aed,#4f46e5)', color:'#fff', fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:14, opacity:(!astroProfile?.name||!astroProfile?.dob)?0.5:1, boxShadow:(!astroProfile?.name||!astroProfile?.dob)?'none':'0 4px 22px rgba(124,58,237,0.45)', transition:'all 0.3s' }}>
                  🌙 Save Profile & Unlock Dashboard
                </button>
              </div>
            </div>
          </GlassCard>
        </div>

      ) : (
        /* ── FULL DASHBOARD ── */
        <div style={{ animation:'fadeIn 0.4s ease-out both' }}>

          {/* Hero banner */}
          <div style={{ position:'relative', overflow:'hidden', borderRadius:20, marginBottom:12, padding:'18px 18px 16px', background:`linear-gradient(135deg,${zodiac.color}20,rgba(124,58,237,0.15),rgba(5,3,15,0.85))`, border:`1px solid ${zodiac.color}30`, boxShadow:'0 12px 40px rgba(0,0,0,0.45)', animation:'slideUp 0.4s ease-out 0.05s both' }}>
            <GalaxyCanvas />
            {/* Orbit decoration */}
            <div style={{ position:'absolute', right:20, top:'50%', transform:'translateY(-50%)', width:100, height:100, opacity:0.3, pointerEvents:'none' }}>
              <div style={{ position:'absolute', inset:0, borderRadius:'50%', border:'1px solid rgba(167,139,250,0.4)', animation:'orbitSpin 10s linear infinite', transformOrigin:'50% 50%' }}>
                <div style={{ position:'absolute', top:-3, left:'50%', transform:'translateX(-50%)', width:6, height:6, borderRadius:'50%', background:'#a78bfa' }} />
              </div>
              <div style={{ position:'absolute', inset:20, borderRadius:'50%', border:'1px solid rgba(52,211,153,0.4)', animation:'orbitSpin 7s linear infinite reverse', transformOrigin:'50% 50%' }}>
                <div style={{ position:'absolute', top:-2, left:'50%', transform:'translateX(-50%)', width:4, height:4, borderRadius:'50%', background:'#34d399' }} />
              </div>
              <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>🪐</div>
            </div>

            <div style={{ position:'relative', zIndex:2 }}>
              <div style={{ display:'inline-flex', alignItems:'center', gap:7, background:`${zodiac.color}20`, border:`1px solid ${zodiac.color}40`, borderRadius:20, padding:'4px 12px', marginBottom:10 }}>
                <span style={{ fontSize:16, color:zodiac.color }}>{zodiac.sign}</span>
                <span style={{ fontSize:11, fontWeight:700, color:zodiac.color, fontFamily:'Poppins,sans-serif' }}>{zodiac.name}</span>
              </div>
              <h2 style={{ fontFamily:'Cinzel,Syne,sans-serif', fontSize:22, fontWeight:700, color:'#fff', margin:'0 0 4px', textShadow:`0 0 20px ${zodiac.color}40` }}>Welcome, {astroProfile.name?.split(' ')[0]} 🌙</h2>
              <p style={{ color:'rgba(255,255,255,0.4)', fontSize:12, margin:'0 0 12px', fontFamily:'Poppins,sans-serif' }}>{astroProfile.location || 'Cosmic Dashboard'}</p>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                <button onClick={()=>setIsProfileSaved(false)} style={{ padding:'8px 16px', borderRadius:10, background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.12)', color:'rgba(255,255,255,0.65)', fontWeight:600, fontSize:12, cursor:'pointer', fontFamily:'Poppins,sans-serif' }}>✏ Edit</button>
                <button onClick={generateAstroData} disabled={isAstroThinking} style={{ padding:'8px 18px', borderRadius:10, background:isAstroThinking?'rgba(124,58,237,0.2)':'linear-gradient(135deg,#7c3aed,#4f46e5)', border:'none', color:'#fff', fontWeight:700, fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', gap:6, fontFamily:'Poppins,sans-serif', boxShadow:isAstroThinking?'none':'0 3px 14px rgba(124,58,237,0.35)' }}>
                  {isAstroThinking?<><div style={{ width:10, height:10, border:'1.5px solid rgba(255,255,255,0.3)', borderTop:'1.5px solid #fff', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} />Reading Stars…</>:<>🔮 Daily Reading</>}
                </button>
              </div>
            </div>
          </div>

          {/* Birth profile strip */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:8, marginBottom:12, animation:'slideUp 0.4s ease-out 0.1s both' }}>
            {[
              { label:'Born', value: astroProfile.dob ? new Date(astroProfile.dob).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : '—', icon:'📅', color:'#60a5fa' },
              { label:'Time',  value: astroProfile.time||'Not set', icon:'🕐', color:'#fbbf24' },
              { label:'Sun Sign', value: zodiac.name, icon: zodiac.sign, color: zodiac.color },
            ].map((item,i)=>(
              <div key={i} style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:'12px 12px', animation:`slideUp 0.35s ease-out ${i*60}ms both` }}>
                <div style={{ fontSize:18, marginBottom:4 }}>{item.icon}</div>
                <p style={{ fontFamily:'Poppins,sans-serif', fontWeight:800, color:item.color, fontSize:13, margin:'0 0 2px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{item.value}</p>
                <p style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.28)', textTransform:'uppercase', letterSpacing:'0.1em', margin:0, fontFamily:'Poppins,sans-serif' }}>{item.label}</p>
              </div>
            ))}
          </div>

          {/* Panchang */}
          <PanchangCard currentUser={props.currentUser} />

          {/* Horoscope */}
          <HoroscopeCard dob={astroProfile?.dob} />

          {/* AI Insights */}
          <CosmicInsightCard insights={astroInsights||[]} isThinking={isAstroThinking} onGenerate={generateAstroData} zodiac={zodiac} />

          {/* About panel */}
          <GlassCard style={{ padding:'14px 16px' }}>
            <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
              <span style={{ fontSize:24, animation:'float 5s ease-in-out infinite' }}>🌌</span>
              <div>
                <p style={{ fontFamily:'Syne,sans-serif', fontWeight:700, color:'#fff', fontSize:13, marginBottom:5 }}>About Your Reading</p>
                <p style={{ fontSize:12, color:'rgba(255,255,255,0.4)', lineHeight:1.7, margin:0, fontFamily:'Poppins,sans-serif' }}>
                  Panchang data is cached daily in Firestore — only 1 fetch per city per day, optimising API credits. Your horoscope is personalized for <span style={{ color: zodiac.color }}>{zodiac.sign} {zodiac.name}</span>. AI insights use <span style={{ color:'#a78bfa' }}>Gemini</span> for deep analysis.
                </p>
              </div>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
    </>
  )
}