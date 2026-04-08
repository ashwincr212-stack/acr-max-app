import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { db } from '../firebase'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'

/* ═══════════════════════════════════════════════════════
   ACR MAX NEWS FLASH — Interactive Personalized Feed
   Firestore shared cache · Newsdata.io · AI Summaries
═══════════════════════════════════════════════════════ */

const CACHE_TTL_MS = 30 * 60 * 1000

const TABS = [
  { id:'for-you', label:'⭐ For You',  category:null,        country:null,  q:null,       personal:true },
  { id:'world',   label:'🌍 World',   category:null,        country:null,  q:null },
  { id:'india',   label:'🇮🇳 India',   category:null,        country:'in',  q:null },
  { id:'ipl',     label:'🏏 IPL',      category:'sports',    country:'in',  q:'IPL 2025' },
  { id:'sports',  label:'🏆 Sports',  category:'sports',    country:null,  q:null },
  { id:'tech',    label:'💻 Tech',    category:'technology',country:null,  q:null },
  { id:'biz',     label:'💼 Business',category:'business',  country:null,  q:null },
]

const REACTIONS = [
  { key:'like', emoji:'👍', label:'Like' },
  { key:'wow',  emoji:'😮', label:'Wow' },
  { key:'angry',emoji:'😠', label:'Angry' },
  { key:'sad',  emoji:'😢', label:'Sad' },
]

const TIME_AGO = (iso) => {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const normalizeArticle = (a) => ({
  title:       a.title        || 'No title',
  description: a.description  || a.content || '',
  image:       a.image_url    || null,
  url:         a.link         || '#',
  publishedAt: a.pubDate      || new Date().toISOString(),
  source:      { name: a.source_name || a.source_id || 'News' },
})

// AI-style 10-second summary generator
const generate10SecSummary = (article) => {
  const desc = article.description || article.title
  const words = desc.split(' ')
  if (words.length <= 20) return desc
  return words.slice(0, 22).join(' ') + '...'
}

/* ── Firestore cache ── */
async function readCache(tabId) {
  try {
    const snap = await getDoc(doc(db, 'acr_news_cache', tabId))
    if (!snap.exists()) return null
    const data = snap.data()
    if (Date.now() - (data.fetchedAt?.toMillis?.() || 0) > CACHE_TTL_MS) return null
    return data.articles || null
  } catch { return null }
}
async function writeCache(tabId, articles) {
  try { await setDoc(doc(db, 'acr_news_cache', tabId), { articles, fetchedAt: serverTimestamp() }) } catch {}
}
async function fetchFromAPI(tab) {
  const key = import.meta.env.VITE_NEWSDATA_API_KEY || ''
  if (!key) throw new Error('NO_KEY')
  let url = `https://newsdata.io/api/1/latest?apikey=${key}&language=en&size=10`
  if (tab.q)        url += `&q=${encodeURIComponent(tab.q)}`
  if (tab.category) url += `&category=${tab.category}`
  if (tab.country)  url += `&country=${tab.country}`
  const res = await fetch(url)
  if (res.status === 422 || res.status === 401) throw new Error('API_KEY_INVALID')
  if (res.status === 429) throw new Error('RATE_LIMIT')
  if (!res.ok) throw new Error(`API_ERROR_${res.status}`)
  const data = await res.json()
  if (!data.results?.length) throw new Error('NO_ARTICLES')
  return data.results.map(normalizeArticle)
}

function generateDemo(tabId) {
  const base = {
    world: [
      { title:'G7 Nations Reach Historic Climate Agreement', description:'World leaders commit to net-zero emissions by 2040 in a landmark deal that reshapes global energy policy.', image:'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800', url:'#', publishedAt:new Date(Date.now()-3600000).toISOString(), source:{name:'Reuters'} },
      { title:'Global Markets Rally on Fed Rate Decision', description:'Stock markets worldwide surge after the Federal Reserve signals a pause in interest rate hikes.', image:'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800', url:'#', publishedAt:new Date(Date.now()-7200000).toISOString(), source:{name:'Bloomberg'} },
      { title:'UN Security Council Passes New Resolution', description:'Unanimous vote on peacekeeping operations marks rare moment of global unity.', image:'https://images.unsplash.com/photo-1569025591987-e5ee4f8e9b54?w=800', url:'#', publishedAt:new Date(Date.now()-10800000).toISOString(), source:{name:'AP News'} },
      { title:'Space Tourism Reaches New Milestone', description:'1000th civilian completes orbital flight as commercial space race intensifies.', image:'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=800', url:'#', publishedAt:new Date(Date.now()-14400000).toISOString(), source:{name:'SpaceNews'} },
    ],
    india: [
      { title:'India GDP Growth Beats Expectations at 8.4%', description:"India's economy continues to outperform global peers driven by manufacturing and services boom.", image:'https://images.unsplash.com/photo-1532375810709-75b1da00537c?w=800', url:'#', publishedAt:new Date(Date.now()-3600000).toISOString(), source:{name:'Economic Times'} },
      { title:'ISRO Announces Chandrayaan-4 Timeline', description:'New moon mission targets 2026 launch window confirmed.', image:'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=800', url:'#', publishedAt:new Date(Date.now()-7200000).toISOString(), source:{name:'NDTV'} },
      { title:'Digital India Reaches 800M Users', description:"India's digital payments ecosystem crosses historic milestone.", image:'https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=800', url:'#', publishedAt:new Date(Date.now()-10800000).toISOString(), source:{name:'Times of India'} },
    ],
    ipl: [
      { title:'IPL 2025: MI vs CSK — Match Preview', description:'The blockbuster rivalry returns tonight at Wankhede. Both teams locked at 3 wins each.', image:'https://images.unsplash.com/photo-1540747913346-19212a4f89d6?w=800', url:'#', publishedAt:new Date(Date.now()-1800000).toISOString(), source:{name:'Cricbuzz'} },
      { title:'Virat Kohli Smashes 50th IPL Half Century', description:'RCB posts 198/4 against PBKS in an electrifying chase at Chinnaswamy.', image:'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=800', url:'#', publishedAt:new Date(Date.now()-3600000).toISOString(), source:{name:'ESPNcricinfo'} },
      { title:'IPL 2025 Points Table: KKR Lead with 5 Wins', description:'Kolkata Knight Riders top the standings as playoffs race heats up.', image:'https://images.unsplash.com/photo-1540747913346-19212a4f89d6?w=800', url:'#', publishedAt:new Date(Date.now()-5400000).toISOString(), source:{name:'NDTV Sports'} },
    ],
    sports: [
      { title:'IPL 2025 Records Highest Viewership Ever', description:'Indian Premier League breaks all records with 650 million viewers across platforms.', image:'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=800', url:'#', publishedAt:new Date(Date.now()-3600000).toISOString(), source:{name:'ESPN'} },
      { title:'India wins T20 World Cup Final', description:'Historic victory secures India third T20 World Cup title in dramatic super over.', image:'https://images.unsplash.com/photo-1540747913346-19212a4f89d6?w=800', url:'#', publishedAt:new Date(Date.now()-7200000).toISOString(), source:{name:'Cricinfo'} },
    ],
    tech: [
      { title:'OpenAI Releases GPT-5 with New Reasoning', description:'Latest AI model demonstrates unprecedented reasoning abilities across all domains.', image:'https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=800', url:'#', publishedAt:new Date(Date.now()-3600000).toISOString(), source:{name:'TechCrunch'} },
      { title:'Apple Vision Pro 2 Launch Confirmed for 2026', description:'Next-gen spatial computing headset with improved battery and lighter design.', image:'https://images.unsplash.com/photo-1617802690992-15d93263d3a9?w=800', url:'#', publishedAt:new Date(Date.now()-7200000).toISOString(), source:{name:'The Verge'} },
    ],
    biz: [
      { title:'Sensex Crosses 85,000 Points Milestone', description:"India's benchmark index hits all-time high driven by foreign institutional investments.", image:'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800', url:'#', publishedAt:new Date(Date.now()-3600000).toISOString(), source:{name:'Moneycontrol'} },
      { title:'Reliance Jio Launches 6G Pilot Network', description:'India becomes third country to test 6G connectivity in select metros.', image:'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800', url:'#', publishedAt:new Date(Date.now()-7200000).toISOString(), source:{name:'Livemint'} },
    ],
  }
  const all = Object.values(base).flat()
  if (tabId === 'for-you') return all.sort(() => Math.random()-0.5).slice(0,8)
  return base[tabId] || base.world
}

/* ═══════════════════════════════════════════════════════
   UI COMPONENTS
═══════════════════════════════════════════════════════ */

/* ── Skeleton ── */
function CardSkeleton({ big = false }) {
  return (
    <div style={{ borderRadius:16, overflow:'hidden', background:'linear-gradient(145deg,#f5f5f5,#e8e8e8)', border:'1px solid #e2e8f0', marginBottom:12, boxShadow:'2px 2px 8px rgba(0,0,0,0.06)' }}>
      <div style={{ height:big?200:110, background:'linear-gradient(90deg,#eeeeee 25%,#f5f5f5 50%,#eeeeee 75%)', backgroundSize:'400% 100%', animation:'skeletonShimmer 1.4s ease-in-out infinite' }} />
      <div style={{ padding:14 }}>
        <div style={{ height:12, borderRadius:6, background:'#e8e8e8', marginBottom:8, width:'80%' }} />
        <div style={{ height:10, borderRadius:6, background:'#f0f0f0', width:'55%' }} />
      </div>
    </div>
  )
}

/* ── Reaction Bar ── */
function ReactionBar({ articleId, reactions, onReact }) {
  return (
    <div style={{ display:'flex', gap:6, marginTop:10 }}>
      {REACTIONS.map(r => (
        <button key={r.key} onClick={e=>{e.stopPropagation();onReact(articleId,r.key)}} style={{
          display:'flex', alignItems:'center', gap:4, padding:'4px 10px', borderRadius:20,
          background: reactions?.[r.key] > 0 ? 'linear-gradient(145deg,#f0f0f0,#e2e2e2)' : 'transparent',
          border: reactions?.[r.key] > 0 ? '1.5px solid #d1d5db' : '1.5px solid #e5e7eb',
          cursor:'pointer', transition:'all 0.15s', fontFamily:'Poppins,sans-serif',
          boxShadow: reactions?.[r.key]>0 ? '2px 2px 5px rgba(0,0,0,0.08),-1px -1px 3px rgba(255,255,255,0.8)' : 'none',
        }}>
          <span style={{ fontSize:14 }}>{r.emoji}</span>
          {reactions?.[r.key] > 0 && <span style={{ fontSize:10, fontWeight:700, color:'#374151' }}>{reactions[r.key]}</span>}
        </button>
      ))}
    </div>
  )
}

/* ── Hero Card — large image with gradient overlay ── */
function HeroCard({ article, onRead, reactions, onReact }) {
  const [imgOk, setImgOk] = useState(true)
  const id = article.url + article.title

  return (
    <div onClick={() => onRead(article)} style={{ position:'relative', borderRadius:20, overflow:'hidden', cursor:'pointer', marginBottom:14, height:260, background:'#f0f0f0', boxShadow:'4px 4px 16px rgba(0,0,0,0.1),-2px -2px 8px rgba(255,255,255,0.8)', transition:'transform 0.2s' }}
      onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'}
      onMouseLeave={e=>e.currentTarget.style.transform='translateY(0)'}>
      {article.image && imgOk
        ? <img src={article.image} alt="" onError={()=>setImgOk(false)} style={{ width:'100%', height:'100%', objectFit:'cover', position:'absolute', inset:0 }} />
        : <div style={{ position:'absolute', inset:0, background:'linear-gradient(135deg,#ddd6fe,#c7d2fe)' }} />}
      <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(0,0,0,0.88) 0%,rgba(0,0,0,0.2) 55%,transparent 100%)' }} />

      {/* Badges */}
      <div style={{ position:'absolute', top:12, left:12, display:'flex', gap:6 }}>
        <span style={{ background:'#ef4444', color:'#fff', fontSize:9, fontWeight:800, padding:'3px 9px', borderRadius:6, letterSpacing:'0.06em' }}>TOP STORY</span>
        <span style={{ background:'rgba(0,0,0,0.5)', color:'rgba(255,255,255,0.9)', fontSize:9, fontWeight:600, padding:'3px 9px', borderRadius:6, backdropFilter:'blur(4px)' }}>{article.source?.name}</span>
      </div>
      <span style={{ position:'absolute', top:12, right:12, fontSize:10, color:'rgba(255,255,255,0.7)', fontWeight:600, background:'rgba(0,0,0,0.35)', padding:'2px 8px', borderRadius:10, backdropFilter:'blur(4px)' }}>{TIME_AGO(article.publishedAt)}</span>

      {/* Content */}
      <div style={{ position:'absolute', bottom:0, left:0, right:0, padding:'18px 16px 14px' }}>
        <h3 style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:16, color:'#fff', margin:'0 0 6px', lineHeight:1.35 }}>{article.title}</h3>
        <p style={{ fontSize:11, color:'rgba(255,255,255,0.65)', margin:'0 0 10px', lineHeight:1.55, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{article.description}</p>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ display:'flex', gap:6 }}>
            {REACTIONS.slice(0,3).map(r => (
              <button key={r.key} onClick={e=>{e.stopPropagation();onReact(id,r.key)}} style={{ fontSize:16, background:'rgba(255,255,255,0.15)', border:'none', borderRadius:'50%', width:30, height:30, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }}>{r.emoji}</button>
            ))}
          </div>
          <span style={{ fontSize:11, color:'rgba(255,255,255,0.6)', fontWeight:600, fontFamily:'Poppins,sans-serif' }}>Read full →</span>
        </div>
      </div>
    </div>
  )
}

/* ── Standard Card ── */
function NewsCard({ article, onRead, reactions, onReact, index }) {
  const [imgOk, setImgOk] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const id = article.url + article.title

  return (
    <div style={{ borderRadius:16, overflow:'hidden', background:'linear-gradient(145deg,#ffffff,#f5f5f5)', border:'1px solid #e5e7eb', marginBottom:10, boxShadow:'3px 3px 10px rgba(0,0,0,0.07),-2px -2px 6px rgba(255,255,255,0.9)', animation:`slideUp 0.35s ease-out ${index*50}ms both`, transition:'transform 0.2s' }}
      onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'}
      onMouseLeave={e=>e.currentTarget.style.transform='translateY(0)'}>

      {/* Image + content row */}
      <div style={{ display:'flex', gap:0, cursor:'pointer' }} onClick={() => onRead(article)}>
        {article.image && imgOk && (
          <div style={{ width:100, flexShrink:0, overflow:'hidden' }}>
            <img src={article.image} alt="" onError={()=>setImgOk(false)} style={{ width:'100%', height:'100%', objectFit:'cover', minHeight:90 }} />
          </div>
        )}
        <div style={{ flex:1, padding:'12px 14px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
            <span style={{ fontSize:9, fontWeight:700, color:'#7c3aed', textTransform:'uppercase', letterSpacing:'0.08em', fontFamily:'Poppins,sans-serif' }}>{article.source?.name}</span>
            <span style={{ fontSize:9, color:'#9ca3af', fontFamily:'Poppins,sans-serif' }}>{TIME_AGO(article.publishedAt)}</span>
          </div>
          <p style={{ fontFamily:'Poppins,sans-serif', fontWeight:700, fontSize:13, color:'#1a1a1a', margin:0, lineHeight:1.45, display:'-webkit-box', WebkitLineClamp: expanded?100:3, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{article.title}</p>
        </div>
      </div>

      {/* Expandable summary + actions */}
      <div style={{ padding:'0 14px 12px' }}>
        {/* 10-sec summary toggle */}
        <button onClick={() => setExpanded(e=>!e)} style={{ display:'flex', alignItems:'center', gap:5, background:'none', border:'none', cursor:'pointer', padding:'6px 0', fontFamily:'Poppins,sans-serif' }}>
          <span style={{ fontSize:12 }}>⚡</span>
          <span style={{ fontSize:11, fontWeight:600, color:'#7c3aed' }}>{expanded ? 'Hide summary' : '10-sec summary'}</span>
          <span style={{ fontSize:10, color:'#9ca3af', marginLeft:2 }}>{expanded ? '▲' : '▼'}</span>
        </button>
        {expanded && (
          <div style={{ padding:'10px 12px', background:'linear-gradient(145deg,#faf5ff,#f3e8ff)', borderRadius:12, border:'1px solid #ddd6fe', marginBottom:8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
              <span style={{ fontSize:12 }}>🤖</span>
              <span style={{ fontSize:9, fontWeight:700, color:'#7c3aed', textTransform:'uppercase', letterSpacing:'0.1em', fontFamily:'Poppins,sans-serif' }}>AI Summary</span>
            </div>
            <p style={{ fontSize:12, color:'#374151', lineHeight:1.65, margin:0, fontFamily:'Poppins,sans-serif' }}>{generate10SecSummary(article)}</p>
            <button onClick={()=>onRead(article)} style={{ marginTop:8, fontSize:11, fontWeight:700, color:'#7c3aed', background:'none', border:'none', cursor:'pointer', fontFamily:'Poppins,sans-serif', padding:0 }}>Read full article →</button>
          </div>
        )}
        <ReactionBar articleId={id} reactions={reactions?.[id]} onReact={onReact} />
      </div>
    </div>
  )
}

/* ── Compact text-only card ── */
function CompactCard({ article, onRead, index }) {
  return (
    <div onClick={() => onRead(article)} style={{ display:'flex', gap:12, padding:'11px 0', borderBottom:'1px solid #f1f5f9', cursor:'pointer', transition:'opacity 0.15s' }}
      onMouseEnter={e=>e.currentTarget.style.opacity='0.75'}
      onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ fontFamily:'Poppins,sans-serif', fontWeight:700, fontSize:13, color:'#1a1a1a', margin:'0 0 4px', lineHeight:1.4, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{article.title}</p>
        <span style={{ fontSize:10, color:'#9ca3af', fontWeight:600, fontFamily:'Poppins,sans-serif' }}>{article.source?.name} · {TIME_AGO(article.publishedAt)}</span>
      </div>
      {article.image && <img src={article.image} alt="" onError={e=>e.target.style.display='none'} style={{ width:60, height:52, objectFit:'cover', borderRadius:10, flexShrink:0, boxShadow:'2px 2px 6px rgba(0,0,0,0.1)' }} />}
    </div>
  )
}

/* ── Trending strip card ── */
function TrendingCard({ article, rank, onRead }) {
  return (
    <div onClick={() => onRead(article)} style={{ flexShrink:0, width:160, borderRadius:14, overflow:'hidden', cursor:'pointer', background:'linear-gradient(145deg,#fff,#f5f5f5)', border:'1px solid #e5e7eb', boxShadow:'3px 3px 8px rgba(0,0,0,0.07),-2px -2px 5px rgba(255,255,255,0.9)', transition:'transform 0.2s' }}
      onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'}
      onMouseLeave={e=>e.currentTarget.style.transform='translateY(0)'}>
      {article.image
        ? <div style={{ height:85, overflow:'hidden', position:'relative' }}>
            <img src={article.image} alt="" onError={e=>e.target.parentNode.style.background='linear-gradient(135deg,#ddd6fe,#c7d2fe)'} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
            <div style={{ position:'absolute', top:6, left:6, width:22, height:22, borderRadius:'50%', background:'#1e293b', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800, color:'#fff', fontFamily:'Poppins,sans-serif' }}>{rank}</div>
          </div>
        : <div style={{ height:85, background:'linear-gradient(135deg,#ddd6fe,#c7d2fe)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span style={{ fontSize:10, fontWeight:800, color:'#7c3aed', fontFamily:'Poppins,sans-serif' }}>#{rank}</span>
          </div>}
      <div style={{ padding:'8px 10px 10px' }}>
        <p style={{ fontFamily:'Poppins,sans-serif', fontWeight:700, fontSize:11, color:'#1a1a1a', margin:'0 0 3px', lineHeight:1.4, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{article.title}</p>
        <span style={{ fontSize:9, color:'#9ca3af', fontFamily:'Poppins,sans-serif' }}>{article.source?.name}</span>
      </div>
    </div>
  )
}

/* ── Swipe/Story Mode ── */
function SwipeMode({ articles, onClose, onReact, reactions }) {
  const [idx, setIdx] = useState(0)
  const [imgOk, setImgOk] = useState(true)
  const article = articles[idx]
  if (!article) return null
  const id = article.url + article.title

  return (
    <div style={{ position:'fixed', inset:0, zIndex:500, background:'#000', display:'flex', flexDirection:'column', animation:'fadeIn 0.25s ease-out' }}>
      {/* Progress bars */}
      <div style={{ display:'flex', gap:3, padding:'12px 12px 8px', position:'absolute', top:0, left:0, right:0, zIndex:10 }}>
        {articles.slice(0,8).map((_,i) => (
          <div key={i} style={{ flex:1, height:3, borderRadius:2, background: i < idx ? '#fff' : i === idx ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)' }} />
        ))}
      </div>

      {/* Image */}
      {article.image && imgOk
        ? <img src={article.image} alt="" onError={()=>setImgOk(false)} style={{ width:'100%', height:'100%', objectFit:'cover', position:'absolute', inset:0 }} />
        : <div style={{ position:'absolute', inset:0, background:'linear-gradient(135deg,#1e1b4b,#312e81)' }} />}
      <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(0,0,0,0.95) 0%,rgba(0,0,0,0.4) 45%,rgba(0,0,0,0.2) 100%)' }} />

      {/* Close */}
      <button onClick={onClose} style={{ position:'absolute', top:48, right:14, zIndex:20, background:'rgba(0,0,0,0.5)', border:'none', color:'#fff', fontSize:20, cursor:'pointer', width:36, height:36, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(8px)' }}>✕</button>

      {/* Content */}
      <div style={{ position:'absolute', bottom:0, left:0, right:0, padding:'24px 20px 32px', zIndex:10 }}>
        <div style={{ display:'flex', gap:7, marginBottom:12 }}>
          <span style={{ background:'rgba(239,68,68,0.85)', color:'#fff', fontSize:9, fontWeight:800, padding:'3px 10px', borderRadius:6 }}>LIVE</span>
          <span style={{ background:'rgba(255,255,255,0.2)', color:'rgba(255,255,255,0.9)', fontSize:9, fontWeight:600, padding:'3px 10px', borderRadius:6, backdropFilter:'blur(4px)' }}>{article.source?.name}</span>
          <span style={{ marginLeft:'auto', fontSize:10, color:'rgba(255,255,255,0.6)', fontWeight:600 }}>{idx+1}/{Math.min(articles.length,8)}</span>
        </div>
        <h2 style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:20, color:'#fff', margin:'0 0 10px', lineHeight:1.35 }}>{article.title}</h2>

        {/* AI Summary */}
        <div style={{ padding:'10px 14px', background:'rgba(124,58,237,0.25)', borderRadius:12, border:'1px solid rgba(124,58,237,0.4)', backdropFilter:'blur(8px)', marginBottom:14 }}>
          <p style={{ fontSize:9, fontWeight:800, color:'#c4b5fd', textTransform:'uppercase', letterSpacing:'0.1em', margin:'0 0 5px', fontFamily:'Poppins,sans-serif' }}>⚡ 10-sec AI summary</p>
          <p style={{ fontSize:13, color:'rgba(255,255,255,0.85)', margin:0, lineHeight:1.6, fontFamily:'Poppins,sans-serif' }}>{generate10SecSummary(article)}</p>
        </div>

        {/* Reactions + nav */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', gap:8 }}>
            {REACTIONS.map(r => (
              <button key={r.key} onClick={()=>onReact(id,r.key)} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, background:'rgba(255,255,255,0.12)', border:'none', borderRadius:12, padding:'6px 12px', cursor:'pointer', backdropFilter:'blur(8px)' }}>
                <span style={{ fontSize:18 }}>{r.emoji}</span>
                <span style={{ fontSize:9, color:'rgba(255,255,255,0.7)', fontWeight:700, fontFamily:'Poppins,sans-serif' }}>{reactions?.[id]?.[r.key] || 0}</span>
              </button>
            ))}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={()=>{setIdx(i=>Math.max(0,i-1));setImgOk(true)}} disabled={idx===0} style={{ width:42, height:42, borderRadius:'50%', border:'none', background:'rgba(255,255,255,0.15)', color:'#fff', fontSize:18, cursor:'pointer', backdropFilter:'blur(8px)', opacity:idx===0?0.4:1 }}>‹</button>
            <button onClick={()=>{if(idx<Math.min(articles.length,8)-1){setIdx(i=>i+1);setImgOk(true)}else onClose()}} style={{ width:42, height:42, borderRadius:'50%', border:'none', background:'rgba(255,255,255,0.15)', color:'#fff', fontSize:18, cursor:'pointer', backdropFilter:'blur(8px)' }}>{idx<Math.min(articles.length,8)-1?'›':'✓'}</button>
          </div>
        </div>
      </div>

      {/* Tap zones */}
      <div style={{ position:'absolute', left:0, top:'15%', width:'40%', height:'65%', zIndex:5 }} onClick={()=>{setIdx(i=>Math.max(0,i-1));setImgOk(true)}} />
      <div style={{ position:'absolute', right:0, top:'15%', width:'40%', height:'65%', zIndex:5 }} onClick={()=>{if(idx<Math.min(articles.length,8)-1){setIdx(i=>i+1);setImgOk(true)}else onClose()}} />
    </div>
  )
}

/* ── Article Reader (full in-app) ── */
function ArticleReader({ article, onClose }) {
  const [view, setView] = useState('summary')
  const [iframeLoaded, setIframeLoaded] = useState(false)
  const [iframeError, setIframeError] = useState(false)

  return (
    <div style={{ position:'fixed', inset:0, zIndex:500, background:'#f8fafc', display:'flex', flexDirection:'column', animation:'slideUpModal 0.3s cubic-bezier(.34,1.1,.64,1) both' }}>
      <style>{`@keyframes slideUpModal{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', background:'#fff', borderBottom:'1px solid #f1f5f9', boxShadow:'0 2px 8px rgba(0,0,0,0.06)', flexShrink:0 }}>
        <button onClick={onClose} style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(145deg,#f5f5f5,#e8e8e8)', border:'1px solid #e2e8f0', boxShadow:'2px 2px 5px rgba(0,0,0,0.08),-1px -1px 3px rgba(255,255,255,0.9)', color:'#374151', fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>←</button>
        <div style={{ flex:1, minWidth:0 }}>
          <p style={{ fontFamily:'Poppins,sans-serif', fontWeight:700, fontSize:13, color:'#1a1a1a', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{article.source?.name}</p>
          <p style={{ fontSize:10, color:'#9ca3af', margin:0, fontFamily:'Poppins,sans-serif' }}>{TIME_AGO(article.publishedAt)} · {view==='web'?'Full article':'Summary'}</p>
        </div>
        <div style={{ display:'flex', gap:4, background:'linear-gradient(145deg,#f0f0f0,#e8e8e8)', borderRadius:10, padding:3, boxShadow:'inset 2px 2px 4px rgba(0,0,0,0.08),inset -1px -1px 3px rgba(255,255,255,0.8)' }}>
          {['summary','web'].map(v => (
            <button key={v} onClick={()=>setView(v)} style={{ padding:'5px 12px', borderRadius:8, border:'none', cursor:'pointer', fontSize:10, fontWeight:700, fontFamily:'Poppins,sans-serif', transition:'all 0.2s', background: view===v ? '#1e293b' : 'transparent', color: view===v ? '#fff' : '#6b7280', boxShadow: view===v ? '2px 2px 6px rgba(0,0,0,0.15)' : 'none' }}>
              {v==='summary' ? '📋 Summary' : '🌐 Full'}
            </button>
          ))}
        </div>
      </div>

      {view === 'summary' && (
        <div style={{ flex:1, overflowY:'auto' }}>
          {article.image && <div style={{ width:'100%', maxHeight:220, overflow:'hidden' }}><img src={article.image} alt="" style={{ width:'100%', objectFit:'cover', display:'block' }} onError={e=>e.target.parentNode.style.display='none'} /></div>}
          <div style={{ padding:'20px 18px 60px' }}>
            <div style={{ display:'flex', gap:8, marginBottom:14 }}>
              <span style={{ padding:'3px 10px', borderRadius:20, background:'#faf5ff', border:'1px solid #ddd6fe', fontSize:10, fontWeight:700, color:'#7c3aed', fontFamily:'Poppins,sans-serif' }}>{article.source?.name}</span>
              <span style={{ fontSize:10, color:'#9ca3af', alignSelf:'center', fontFamily:'Poppins,sans-serif' }}>{article.publishedAt?new Date(article.publishedAt).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'}):''}</span>
            </div>
            <h2 style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:20, color:'#1a1a1a', margin:'0 0 12px', lineHeight:1.35 }}>{article.title}</h2>

            {/* AI Summary box */}
            <div style={{ padding:'14px 16px', background:'linear-gradient(145deg,#faf5ff,#f3e8ff)', borderRadius:16, border:'1px solid #ddd6fe', marginBottom:16, boxShadow:'3px 3px 8px rgba(124,58,237,0.08),-2px -2px 5px rgba(255,255,255,0.9)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:8 }}>
                <span style={{ fontSize:16 }}>⚡</span>
                <span style={{ fontSize:10, fontWeight:800, color:'#7c3aed', textTransform:'uppercase', letterSpacing:'0.1em', fontFamily:'Poppins,sans-serif' }}>10-Second AI Summary</span>
              </div>
              <p style={{ fontSize:14, color:'#374151', lineHeight:1.75, margin:0, fontFamily:'Poppins,sans-serif' }}>{generate10SecSummary(article)}</p>
            </div>

            {article.description && article.description !== article.title && (
              <p style={{ fontSize:14, color:'#4b5563', lineHeight:1.8, margin:'0 0 20px', fontFamily:'Poppins,sans-serif' }}>{article.description}</p>
            )}
            <button onClick={()=>setView('web')} style={{ width:'100%', padding:'14px', borderRadius:14, border:'none', background:'linear-gradient(135deg,#7c3aed,#4f46e5)', color:'#fff', fontFamily:'Poppins,sans-serif', fontWeight:700, fontSize:14, cursor:'pointer', boxShadow:'4px 4px 14px rgba(124,58,237,0.3)', marginBottom:10 }}>🌐 Read Full Article</button>
            <button onClick={onClose} style={{ width:'100%', padding:'12px', borderRadius:14, border:'1.5px solid #e2e8f0', background:'linear-gradient(145deg,#f5f5f5,#e8e8e8)', color:'#6b7280', fontFamily:'Poppins,sans-serif', fontWeight:700, fontSize:13, cursor:'pointer', boxShadow:'3px 3px 8px rgba(0,0,0,0.07),-2px -2px 5px rgba(255,255,255,0.9)' }}>← Back to News</button>
          </div>
        </div>
      )}

      {view === 'web' && (
        <div style={{ flex:1, position:'relative', background:'#fff' }}>
          {!iframeLoaded && !iframeError && (
            <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, background:'#f8fafc', zIndex:2 }}>
              <div style={{ width:36, height:36, border:'3px solid #e5e7eb', borderTop:'3px solid #7c3aed', borderRadius:'50%', animation:'spinLoad 0.7s linear infinite' }} />
              <p style={{ fontSize:13, color:'#6b7280', fontFamily:'Poppins,sans-serif' }}>Loading {article.source?.name}…</p>
            </div>
          )}
          {iframeError ? (
            <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'24px', gap:14, background:'#f8fafc' }}>
              <div style={{ fontSize:40 }}>🔒</div>
              <h3 style={{ fontFamily:'Syne,sans-serif', fontWeight:800, color:'#1a1a1a', fontSize:16, margin:0, textAlign:'center' }}>{article.source?.name} blocks in-app reading</h3>
              <p style={{ fontSize:13, color:'#6b7280', textAlign:'center', lineHeight:1.6, fontFamily:'Poppins,sans-serif' }}>Open in your browser to read the full article.</p>
              <a href={article.url} target="_blank" rel="noopener noreferrer" style={{ padding:'12px 28px', borderRadius:14, background:'linear-gradient(135deg,#7c3aed,#4f46e5)', color:'#fff', fontFamily:'Poppins,sans-serif', fontWeight:700, fontSize:14, textDecoration:'none', boxShadow:'4px 4px 14px rgba(124,58,237,0.3)' }}>Open in Browser ↗</a>
              <button onClick={()=>setView('summary')} style={{ background:'none', border:'none', color:'#6b7280', fontSize:13, cursor:'pointer', fontFamily:'Poppins,sans-serif' }}>← Back to Summary</button>
            </div>
          ) : (
            <iframe key={article.url} src={article.url} title={article.title} style={{ width:'100%', height:'100%', border:'none' }} onLoad={()=>setIframeLoaded(true)} onError={()=>{setIframeError(true);setIframeLoaded(true)}} sandbox="allow-scripts allow-same-origin allow-popups allow-forms" />
          )}
        </div>
      )}
      {view==='web' && iframeLoaded && !iframeError && (
        <div style={{ display:'flex', gap:8, padding:'10px 14px', background:'#fff', borderTop:'1px solid #f1f5f9', flexShrink:0, boxShadow:'0 -2px 8px rgba(0,0,0,0.05)' }}>
          <button onClick={onClose} style={{ flex:1, padding:'10px', borderRadius:12, background:'linear-gradient(145deg,#f5f5f5,#e8e8e8)', border:'1.5px solid #e2e8f0', color:'#374151', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'Poppins,sans-serif' }}>← Back</button>
          <a href={article.url} target="_blank" rel="noopener noreferrer" style={{ flex:1, padding:'10px', borderRadius:12, background:'linear-gradient(145deg,#faf5ff,#f3e8ff)', border:'1.5px solid #ddd6fe', color:'#7c3aed', fontWeight:700, fontSize:13, textDecoration:'none', textAlign:'center', fontFamily:'Poppins,sans-serif' }}>Open ↗</a>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   MAIN NEWS COMPONENT
═══════════════════════════════════════════════════════ */
export default function News() {
  const [activeTab, setActiveTab]       = useState('for-you')
  const [newsData, setNewsData]         = useState({})
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState(null)
  const [lastUpdated, setLastUpdated]   = useState(null)
  const [cacheStatus, setCacheStatus]   = useState('')
  const [readerArticle, setReaderArticle] = useState(null)
  const [swipeMode, setSwipeMode]       = useState(false)
  const [reactions, setReactions]       = useState({})
  const [breakingBanner, setBreakingBanner] = useState(true)
  const abortRef = useRef(null)

  const fetchTab = useCallback(async (tabId, force = false) => {
    const inMem = newsData[tabId]
    if (!force && inMem && (Date.now()-inMem.fetchedAt < CACHE_TTL_MS)) { setCacheStatus('fresh'); return }
    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()
    setLoading(true); setError(null)
    try {
      const realTabId = tabId === 'for-you' ? 'world' : tabId
      const cached = await readCache(realTabId)
      if (!force && cached) {
        const articles = tabId === 'for-you' ? cached.sort(()=>Math.random()-0.5).slice(0,8) : cached
        setNewsData(prev => ({...prev, [tabId]:{articles, fetchedAt:Date.now()}}))
        setLastUpdated(new Date()); setCacheStatus('cached')
        setLoading(false); return
      }
      const key = import.meta.env.VITE_NEWSDATA_API_KEY || ''
      if (!key) {
        setNewsData(prev=>({...prev,[tabId]:{articles:generateDemo(tabId),fetchedAt:Date.now()}}))
        setLastUpdated(new Date()); setCacheStatus('demo')
        setLoading(false); return
      }
      const tab = TABS.find(t=>t.id===tabId) || TABS[1]
      const articles = await fetchFromAPI(tab)
      await writeCache(realTabId, articles)
      setNewsData(prev=>({...prev,[tabId]:{articles,fetchedAt:Date.now()}}))
      setLastUpdated(new Date()); setCacheStatus('live')
    } catch(err) {
      if (err.name==='AbortError') return
      setError(err.message==='NO_KEY'?'Add VITE_NEWSDATA_API_KEY to .env':err.message==='RATE_LIMIT'?'Rate limit hit — cached news shown':null)
      setNewsData(prev=>({...prev,[tabId]:{articles:generateDemo(tabId),fetchedAt:Date.now()-CACHE_TTL_MS+60000}}))
      setLastUpdated(new Date()); setCacheStatus('demo')
    }
    setLoading(false)
  }, [newsData])

  useEffect(() => { fetchTab(activeTab) }, [activeTab])
  useEffect(() => {
    const t = setTimeout(()=>{ TABS.forEach(tab=>{if(tab.id!==activeTab)fetchTab(tab.id)}) }, 6000)
    return ()=>clearTimeout(t)
  }, [])

  const handleReact = (articleId, reaction) => {
    setReactions(prev => ({
      ...prev,
      [articleId]: { ...(prev[articleId]||{}), [reaction]: ((prev[articleId]?.[reaction]||0) + 1) }
    }))
  }

  const handleRead = (article) => {
    if (article.url && article.url !== '#') setReaderArticle(article)
  }

  const current  = newsData[activeTab]
  const articles = current?.articles || []
  const hero     = articles[0]
  const trending = articles.slice(0,5)
  const grid     = articles.slice(1,4)
  const rest     = articles.slice(4)
  const tickerText = articles.map(a=>a.title).join('   ·   ') || 'Loading latest news…'

  return (
    <>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=Syne:wght@700;800&display=swap');
      .news-root{font-family:'Poppins',sans-serif;color:#1a1a1a;}
      @keyframes fadeIn {from{opacity:0}to{opacity:1}}
      @keyframes slideUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
      @keyframes spinLoad{to{transform:rotate(360deg)}}
      @keyframes skeletonShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
      @keyframes tickerMove{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
      @keyframes livePulse{0%,100%{opacity:1}50%{opacity:0.3}}
      ::-webkit-scrollbar{width:3px;height:3px;}
      ::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:3px;}
    `}</style>

    <div className="news-root" style={{ maxWidth:900, margin:'0 auto', paddingBottom:80, background:'transparent' }}>

      {/* ── HEADER ── */}
      <div style={{ marginBottom:14, animation:'slideUp 0.4s ease-out both' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <img src="/logo.jpg" alt="ACR MAX" style={{ width:36, height:36, borderRadius:'50%', objectFit:'cover', border:'2px solid #e2e8f0', boxShadow:'2px 2px 8px rgba(0,0,0,0.1),-1px -1px 4px rgba(255,255,255,0.9)' }} />
            <div>
              <h2 style={{ fontFamily:'Syne,sans-serif', fontSize:20, fontWeight:800, margin:0, color:'#1a1a1a' }}>📰 News Flash</h2>
              <p style={{ fontSize:10, color:'#9ca3af', margin:0, fontFamily:'Poppins,sans-serif' }}>ACR MAX · {lastUpdated?`Updated ${TIME_AGO(lastUpdated.toISOString())}`:'Loading…'}</p>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:7 }}>
            {/* Swipe mode button */}
            <button onClick={()=>setSwipeMode(true)} disabled={!articles.length} style={{ padding:'6px 12px', borderRadius:10, background:'linear-gradient(135deg,#7c3aed,#4f46e5)', border:'none', color:'#fff', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'Poppins,sans-serif', display:'flex', alignItems:'center', gap:5, boxShadow:'3px 3px 8px rgba(124,58,237,0.3)', opacity:articles.length?1:0.5 }}>
              ▶ Stories
            </button>
            {/* Cache badge */}
            <div style={{ display:'flex', alignItems:'center', gap:4, padding:'4px 9px', borderRadius:20, background: cacheStatus==='live'?'#f0fdf4':cacheStatus==='cached'?'#eff6ff':'#fffbeb', border:`1px solid ${cacheStatus==='live'?'#bbf7d0':cacheStatus==='cached'?'#bfdbfe':'#fde68a'}` }}>
              <div style={{ width:5, height:5, borderRadius:'50%', background:cacheStatus==='live'?'#16a34a':cacheStatus==='cached'?'#1d4ed8':'#d97706', animation:'livePulse 1.5s infinite' }} />
              <span style={{ fontSize:8, fontWeight:800, color:cacheStatus==='live'?'#16a34a':cacheStatus==='cached'?'#1d4ed8':'#d97706', letterSpacing:'0.06em', fontFamily:'Poppins,sans-serif' }}>
                {cacheStatus==='live'?'LIVE':cacheStatus==='cached'?'CACHED':'DEMO'}
              </span>
            </div>
            <button onClick={()=>fetchTab(activeTab,true)} disabled={loading} style={{ padding:'6px 12px', borderRadius:10, background:'linear-gradient(145deg,#f5f5f5,#e8e8e8)', border:'1px solid #e2e8f0', color:'#374151', fontSize:11, fontWeight:700, cursor:loading?'not-allowed':'pointer', fontFamily:'Poppins,sans-serif', boxShadow:'2px 2px 6px rgba(0,0,0,0.07),-1px -1px 3px rgba(255,255,255,0.9)', opacity:loading?0.6:1 }}>
              {loading?'⏳':'🔄'}
            </button>
          </div>
        </div>

        {/* Breaking news ticker */}
        {breakingBanner && articles.length > 0 && (
          <div style={{ background:'linear-gradient(145deg,#fff1f2,#fff5f5)', border:'1.5px solid #fca5a5', borderRadius:10, padding:'7px 12px', display:'flex', alignItems:'center', gap:8, overflow:'hidden', position:'relative', boxShadow:'2px 2px 6px rgba(220,38,38,0.08),-1px -1px 3px rgba(255,255,255,0.9)' }}>
            <span style={{ fontSize:8, fontWeight:800, color:'#dc2626', background:'#fee2e2', padding:'2px 8px', borderRadius:5, letterSpacing:'0.1em', flexShrink:0, fontFamily:'Poppins,sans-serif' }}>LIVE</span>
            <div style={{ overflow:'hidden', flex:1 }}>
              <div style={{ display:'inline-block', animation:'tickerMove 30s linear infinite', whiteSpace:'nowrap' }}>
                <span style={{ fontSize:11, color:'#374151', fontWeight:500, marginRight:40, fontFamily:'Poppins,sans-serif' }}>{tickerText}</span>
                <span style={{ fontSize:11, color:'#374151', fontWeight:500, marginRight:40, fontFamily:'Poppins,sans-serif' }}>{tickerText}</span>
              </div>
            </div>
            <button onClick={()=>setBreakingBanner(false)} style={{ background:'none', border:'none', color:'#9ca3af', cursor:'pointer', fontSize:13, flexShrink:0, padding:0 }}>✕</button>
          </div>
        )}
      </div>

      {/* ── TAB BAR ── */}
      <div style={{ display:'flex', gap:7, marginBottom:14, overflowX:'auto', paddingBottom:4, scrollbarWidth:'none' }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={()=>setActiveTab(tab.id)} style={{
            padding:'8px 14px', borderRadius:20, fontWeight:700, fontSize:11,
            whiteSpace:'nowrap', cursor:'pointer', fontFamily:'Poppins,sans-serif', transition:'all 0.2s',
            background: activeTab===tab.id ? '#1e293b' : 'linear-gradient(145deg,#fff,#f5f5f5)',
            border: activeTab===tab.id ? '1.5px solid #1e293b' : '1.5px solid #e5e7eb',
            color: activeTab===tab.id ? '#fff' : '#475569',
            boxShadow: activeTab===tab.id ? '3px 3px 8px rgba(30,41,59,0.25),-2px -2px 5px rgba(255,255,255,0.5)' : '2px 2px 6px rgba(0,0,0,0.06),-1px -1px 3px rgba(255,255,255,0.9)',
            display:'flex', alignItems:'center', gap:5,
          }}>
            {tab.label}
            {newsData[tab.id] && tab.id!==activeTab && <span style={{ width:5, height:5, borderRadius:'50%', background:'#7c3aed', display:'inline-block' }} />}
          </button>
        ))}
      </div>

      {/* ── ERROR ── */}
      {error && (
        <div style={{ background:'linear-gradient(145deg,#fffbeb,#fef3c7)', border:'1.5px solid #fde68a', borderRadius:12, padding:'10px 14px', marginBottom:12, display:'flex', alignItems:'center', gap:8, boxShadow:'2px 2px 6px rgba(0,0,0,0.06)' }}>
          <span>⚠</span><p style={{ fontSize:12, color:'#92400e', fontWeight:600, margin:0, fontFamily:'Poppins,sans-serif' }}>{error}</p>
          <button onClick={()=>setError(null)} style={{ marginLeft:'auto', background:'none', border:'none', color:'#9ca3af', cursor:'pointer', fontSize:13 }}>✕</button>
        </div>
      )}

      {/* ── CONTENT ── */}
      {loading && !current ? (
        <div>
          <CardSkeleton big />
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10, marginBottom:14 }}>
            {[1,2,3,4].map(i=><CardSkeleton key={i} />)}
          </div>
        </div>
      ) : (
        <div style={{ animation:'fadeIn 0.3s ease-out both' }}>

          {/* Hero */}
          {hero && <HeroCard article={hero} onRead={handleRead} reactions={reactions} onReact={handleReact} />}

          {/* Trending horizontal scroll */}
          {trending.length > 1 && (
            <div style={{ marginBottom:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <div style={{ width:3, height:14, borderRadius:2, background:'linear-gradient(to bottom,#ef4444,#ef444480)' }} />
                  <p style={{ fontSize:11, fontWeight:700, color:'#374151', textTransform:'uppercase', letterSpacing:'0.12em', margin:0, fontFamily:'Poppins,sans-serif' }}>🔥 Trending</p>
                </div>
                <button onClick={()=>setSwipeMode(true)} style={{ fontSize:11, fontWeight:700, color:'#7c3aed', background:'none', border:'none', cursor:'pointer', fontFamily:'Poppins,sans-serif' }}>▶ Stories mode →</button>
              </div>
              <div style={{ display:'flex', gap:10, overflowX:'auto', paddingBottom:6, scrollbarWidth:'none' }}>
                {trending.map((a,i) => <TrendingCard key={i} article={a} rank={i+1} onRead={handleRead} />)}
              </div>
            </div>
          )}

          {/* Standard grid cards */}
          {grid.length > 0 && (
            <div style={{ marginBottom:14 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
                <div style={{ width:3, height:14, borderRadius:2, background:`linear-gradient(to bottom,#7c3aed,#7c3aed80)` }} />
                <p style={{ fontSize:11, fontWeight:700, color:'#374151', textTransform:'uppercase', letterSpacing:'0.12em', margin:0, fontFamily:'Poppins,sans-serif' }}>Latest Stories</p>
              </div>
              {grid.map((a,i) => <NewsCard key={i} article={a} onRead={handleRead} reactions={reactions} onReact={handleReact} index={i} />)}
            </div>
          )}

          {/* More stories compact */}
          {rest.length > 0 && (
            <div style={{ background:'linear-gradient(145deg,#fff,#f8f8f8)', borderRadius:16, padding:'14px 16px', border:'1.5px solid #e5e7eb', boxShadow:'3px 3px 10px rgba(0,0,0,0.06),-2px -2px 6px rgba(255,255,255,0.9)', marginBottom:14 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
                <div style={{ width:3, height:14, borderRadius:2, background:'linear-gradient(to bottom,#0891b2,#0891b280)' }} />
                <p style={{ fontSize:11, fontWeight:700, color:'#374151', textTransform:'uppercase', letterSpacing:'0.12em', margin:0, fontFamily:'Poppins,sans-serif' }}>More Stories</p>
              </div>
              {rest.map((a,i) => <CompactCard key={i} article={a} onRead={handleRead} index={i} />)}
            </div>
          )}

          {articles.length > 0 && (
            <p style={{ textAlign:'center', fontSize:10, color:'#9ca3af', margin:'8px 0 0', fontFamily:'Poppins,sans-serif' }}>
              Newsdata.io · Shared cache · {articles.length} stories{lastUpdated?` · ${lastUpdated.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}` : ''}
            </p>
          )}
        </div>
      )}

      {/* Modals */}
      {swipeMode && articles.length > 0 && <SwipeMode articles={articles} onClose={()=>setSwipeMode(false)} onReact={handleReact} reactions={reactions} />}
      {readerArticle && <ArticleReader article={readerArticle} onClose={()=>setReaderArticle(null)} />}
    </div>
    </>
  )
}