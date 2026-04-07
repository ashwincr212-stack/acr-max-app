import { useState, useEffect, useCallback, useRef } from 'react'
import { db } from '../firebase'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'

const CACHE_TTL_MS = 30 * 60 * 1000  // 30 min shared cache

const TABS = [
  { id: 'world',  label: '🌍 World',    category: null,         country: null,  q: null },
  { id: 'india',  label: '🇮🇳 India',    category: null,         country: 'in',  q: null },
  { id: 'ipl',    label: '🏏 IPL',       category: 'sports',     country: 'in',  q: 'IPL 2025' },
  { id: 'sports', label: '🏆 Sports',   category: 'sports',     country: null,  q: null },
  { id: 'tech',   label: '💻 Tech',     category: 'technology', country: null,  q: null },
  { id: 'biz',    label: '💼 Business', category: 'business',   country: null,  q: null },
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

async function readCache(tabId) {
  try {
    const ref = doc(db, 'acr_news_cache', tabId)
    const snap = await getDoc(ref)
    if (!snap.exists()) return null
    const data = snap.data()
    const age = Date.now() - (data.fetchedAt?.toMillis?.() || 0)
    if (age > CACHE_TTL_MS) return null
    return data.articles || null
  } catch (e) {
    console.error('[News] Cache read:', e.message)
    return null
  }
}

async function writeCache(tabId, articles) {
  try {
    await setDoc(doc(db, 'acr_news_cache', tabId), {
      articles, fetchedAt: serverTimestamp(),
    })
  } catch (e) { console.error('[News] Cache write:', e.message) }
}

async function fetchFromAPI(tab) {
  const key = import.meta.env.VITE_NEWSDATA_API_KEY || ''
  if (!key) throw new Error('NO_KEY')
  // Use 'latest' endpoint for freshest news (free plan gives ~6-24hr old)
  let url = `https://newsdata.io/api/1/latest?apikey=${key}&language=en&size=10`
  if (tab.q)        url += `&q=${encodeURIComponent(tab.q)}`
  if (tab.category) url += `&category=${tab.category}`
  if (tab.country)  url += `&country=${tab.country}`
  const res = await fetch(url)
  if (res.status === 422 || res.status === 401) throw new Error('API_KEY_INVALID')
  if (res.status === 429) throw new Error('RATE_LIMIT')
  if (!res.ok) throw new Error(`API_ERROR_${res.status}`)
  const data = await res.json()
  if (data.status === 'error') throw new Error(data.message || 'API_ERROR')
  if (!data.results?.length) throw new Error('NO_ARTICLES')
  return data.results.map(normalizeArticle)
}

function generateDemo(tabId) {
  const sets = {
    world:  [
      { title: 'G7 Nations Reach Historic Climate Agreement', description: 'World leaders commit to net-zero emissions by 2040.', image: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800', url: '#', publishedAt: new Date(Date.now()-3600000).toISOString(), source: { name: 'Reuters' } },
      { title: 'Global Markets Rally on Fed Decision', description: 'Stock markets surge after Federal Reserve signals rate pause.', image: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800', url: '#', publishedAt: new Date(Date.now()-7200000).toISOString(), source: { name: 'Bloomberg' } },
      { title: 'UN Security Council Passes New Resolution', description: 'Unanimous vote on peacekeeping operations marks rare global unity.', image: 'https://images.unsplash.com/photo-1569025591987-e5ee4f8e9b54?w=800', url: '#', publishedAt: new Date(Date.now()-10800000).toISOString(), source: { name: 'AP News' } },
      { title: 'Space Tourism Reaches New Milestone', description: '1000th civilian completes orbital flight as commercial space race intensifies.', image: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=800', url: '#', publishedAt: new Date(Date.now()-14400000).toISOString(), source: { name: 'SpaceNews' } },
    ],
    india: [
      { title: 'India GDP Growth Beats Expectations at 8.4%', description: "India's economy continues to outperform global peers.", image: 'https://images.unsplash.com/photo-1532375810709-75b1da00537c?w=800', url: '#', publishedAt: new Date(Date.now()-3600000).toISOString(), source: { name: 'Economic Times' } },
      { title: 'ISRO Announces Chandrayaan-4 Timeline', description: 'New moon mission targets 2026 launch window.', image: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=800', url: '#', publishedAt: new Date(Date.now()-7200000).toISOString(), source: { name: 'NDTV' } },
      { title: 'Digital India Reaches 800M Users', description: "India's digital payments ecosystem crosses 800 million active users.", image: 'https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=800', url: '#', publishedAt: new Date(Date.now()-10800000).toISOString(), source: { name: 'Times of India' } },
    ],
    sports: [
      { title: 'IPL 2026 Records Highest Viewership Ever', description: 'Indian Premier League breaks all records with 650 million viewers.', image: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=800', url: '#', publishedAt: new Date(Date.now()-3600000).toISOString(), source: { name: 'ESPN' } },
      { title: 'India wins T20 World Cup Final', description: 'Historic victory secures India third T20 World Cup title.', image: 'https://images.unsplash.com/photo-1540747913346-19212a4f89d6?w=800', url: '#', publishedAt: new Date(Date.now()-7200000).toISOString(), source: { name: 'Cricinfo' } },
    ],
    tech: [
      { title: 'OpenAI Releases GPT-5 with New Reasoning', description: 'Latest AI model demonstrates unprecedented reasoning abilities.', image: 'https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=800', url: '#', publishedAt: new Date(Date.now()-3600000).toISOString(), source: { name: 'TechCrunch' } },
      { title: 'Apple Vision Pro 2 Launch Confirmed', description: 'Next-gen spatial computing headset coming in 2026.', image: 'https://images.unsplash.com/photo-1617802690992-15d93263d3a9?w=800', url: '#', publishedAt: new Date(Date.now()-7200000).toISOString(), source: { name: 'The Verge' } },
    ],
    biz: [
      { title: 'Sensex Crosses 85,000 Points', description: "India's benchmark index hits all-time high driven by FII inflows.", image: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800', url: '#', publishedAt: new Date(Date.now()-3600000).toISOString(), source: { name: 'Moneycontrol' } },
      { title: 'Reliance Jio Launches 6G Pilot', description: 'India becomes third country to test 6G connectivity.', image: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800', url: '#', publishedAt: new Date(Date.now()-7200000).toISOString(), source: { name: 'Livemint' } },
    ],
    ipl: [
      { title: 'IPL 2025: Mumbai Indians vs Chennai Super Kings — Match Preview', description: 'The blockbuster rivalry returns as MI and CSK face off tonight at Wankhede Stadium. Both teams are locked at 3 wins each and every point counts in this crucial encounter.', image: 'https://images.unsplash.com/photo-1540747913346-19212a4f89d6?w=800', url: '#', publishedAt: new Date(Date.now()-1800000).toISOString(), source: { name: 'Cricbuzz' } },
      { title: 'Virat Kohli Smashes 50th IPL Half Century for RCB', description: 'In a stunning display of form, Virat Kohli reached his 50th IPL fifty as RCB posted 198/4 against PBKS in an electrifying chase.', image: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=800', url: '#', publishedAt: new Date(Date.now()-3600000).toISOString(), source: { name: 'ESPNcricinfo' } },
      { title: 'IPL 2025 Points Table: KKR Lead with 5 Wins', description: 'Kolkata Knight Riders top the IPL 2025 standings with five wins from six matches, while Rajasthan Royals trail closely in second.', image: 'https://images.unsplash.com/photo-1540747913346-19212a4f89d6?w=800', url: '#', publishedAt: new Date(Date.now()-5400000).toISOString(), source: { name: 'NDTV Sports' } },
      { title: "Jasprit Bumrah Takes 3-fer as MI Defend 185", description: 'Bumrah was unplayable in the death overs, picking up 3 wickets in the final 4 overs to hand Mumbai Indians a dramatic 12-run victory.', image: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=800', url: '#', publishedAt: new Date(Date.now()-7200000).toISOString(), source: { name: 'Times of India Sports' } },
    ],
  }
  return sets[tabId] || sets.world
}

function CardSkeleton() {
  return (
    <div style={{ borderRadius:16, overflow:'hidden', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', padding:14 }}>
      <div style={{ height:110, borderRadius:10, background:'rgba(255,255,255,0.05)', marginBottom:10, animation:'shimmer 1.5s ease-in-out infinite' }} />
      <div style={{ height:12, borderRadius:5, background:'rgba(255,255,255,0.06)', marginBottom:7, width:'80%' }} />
      <div style={{ height:9, borderRadius:5, background:'rgba(255,255,255,0.04)', width:'50%' }} />
    </div>
  )
}

function HeroCard({ article, onRead }) {
  const [imgOk, setImgOk] = useState(true)
  return (
    <div onClick={() => onRead(article)} style={{ position:'relative', borderRadius:18, overflow:'hidden', cursor:'pointer', marginBottom:12, minHeight:230, background:'#0a0c1e', transition:'transform 0.2s' }}
      onMouseEnter={e=>e.currentTarget.style.transform='scale(1.01)'} onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
      {article.image && imgOk
        ? <img src={article.image} alt="" onError={()=>setImgOk(false)} style={{ width:'100%', height:'100%', objectFit:'cover', position:'absolute', inset:0 }} />
        : <div style={{ position:'absolute', inset:0, background:'linear-gradient(135deg,#1e1b4b,#312e81)' }} />}
      <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(0,0,0,0.92) 0%,rgba(0,0,0,0.3) 55%,transparent 100%)' }} />
      <div style={{ position:'absolute', top:10, left:10, display:'flex', gap:5 }}>
        <span style={{ background:'rgba(239,68,68,0.9)', color:'#fff', fontSize:9, fontWeight:800, padding:'2px 8px', borderRadius:5, letterSpacing:'0.06em' }}>TOP STORY</span>
        <span style={{ background:'rgba(0,0,0,0.6)', color:'rgba(255,255,255,0.7)', fontSize:9, fontWeight:600, padding:'2px 8px', borderRadius:5 }}>{article.source?.name}</span>
      </div>
      <span style={{ position:'absolute', top:10, right:10, fontSize:9, color:'rgba(255,255,255,0.5)', fontWeight:600 }}>{TIME_AGO(article.publishedAt)}</span>
      <div style={{ position:'absolute', bottom:0, left:0, right:0, padding:'16px 16px 14px' }}>
        <h3 style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:15, color:'#fff', margin:'0 0 5px', lineHeight:1.35 }}>{article.title}</h3>
        {article.description && <p style={{ fontSize:11, color:'rgba(255,255,255,0.55)', margin:'0 0 8px', lineHeight:1.5, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{article.description}</p>}
        <span style={{ fontSize:10, color:'rgba(255,255,255,0.4)', fontWeight:600 }}>Tap to read full story →</span>
      </div>
    </div>
  )
}

function NewsCard({ article, onRead, index }) {
  const [imgOk, setImgOk] = useState(true)
  return (
    <div onClick={() => onRead(article)} style={{ borderRadius:14, overflow:'hidden', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', cursor:'pointer', transition:'all 0.2s', animation:`fadeIn 0.35s ease-out ${index*45}ms both` }}
      onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.background='rgba(255,255,255,0.08)'}}
      onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.background='rgba(255,255,255,0.05)'}}>
      {article.image && imgOk
        ? <div style={{ height:95, overflow:'hidden' }}><img src={article.image} alt="" onError={()=>setImgOk(false)} style={{ width:'100%', height:'100%', objectFit:'cover' }} /></div>
        : <div style={{ height:60, background:'linear-gradient(135deg,rgba(99,102,241,0.2),rgba(167,139,250,0.1))' }} />}
      <div style={{ padding:'9px 11px 11px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
          <span style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.35)', textTransform:'uppercase' }}>{article.source?.name}</span>
          <span style={{ fontSize:9, color:'rgba(255,255,255,0.25)' }}>{TIME_AGO(article.publishedAt)}</span>
        </div>
        <p style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:11, color:'#fff', margin:0, lineHeight:1.4, display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{article.title}</p>
      </div>
    </div>
  )
}

function CompactCard({ article, onRead }) {
  return (
    <div onClick={() => onRead(article)} style={{ display:'flex', gap:10, padding:'9px 0', borderBottom:'1px solid rgba(255,255,255,0.05)', cursor:'pointer' }}
      onMouseEnter={e=>e.currentTarget.style.opacity='0.75'} onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:11, color:'#fff', margin:'0 0 3px', lineHeight:1.4, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{article.title}</p>
        <span style={{ fontSize:9, color:'rgba(255,255,255,0.3)', fontWeight:600 }}>{article.source?.name} · {TIME_AGO(article.publishedAt)}</span>
      </div>
      {article.image && <img src={article.image} alt="" onError={e=>e.target.style.display='none'} style={{ width:54, height:46, objectFit:'cover', borderRadius:7, flexShrink:0 }} />}
    </div>
  )
}


/* ── In-App Article Reader with iframe ─────────────────────────────────── */
function ArticleReader({ article, onClose }) {
  const [iframeLoaded, setIframeLoaded] = useState(false)
  const [iframeError, setIframeError] = useState(false)
  const [view, setView] = useState('summary') // 'summary' | 'web'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: '#05070f',
      display: 'flex', flexDirection: 'column',
      animation: 'slideUpReader 0.3s cubic-bezier(.34,1.1,.64,1) both',
    }}>
      <style>{`
        @keyframes slideUpReader { from{transform:translateY(100%);opacity:0} to{transform:translateY(0);opacity:1} }
      `}</style>

      {/* ── Top bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px',
        background: 'rgba(255,255,255,0.04)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        flexShrink: 0,
      }}>
        {/* Back to news */}
        <button onClick={onClose} style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
          color: '#fff', fontSize: 18, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>←</button>

        {/* Source + time */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: 13, color: '#fff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {article.source?.name}
          </p>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', margin: 0 }}>
            {TIME_AGO(article.publishedAt)} · {view === 'web' ? 'Full article' : 'Summary view'}
          </p>
        </div>

        {/* Toggle view */}
        <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 3, flexShrink: 0 }}>
          <button onClick={() => setView('summary')} style={{
            padding: '5px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 700,
            background: view === 'summary' ? 'rgba(239,68,68,0.8)' : 'transparent',
            color: view === 'summary' ? '#fff' : 'rgba(255,255,255,0.4)',
            fontFamily: 'DM Sans,sans-serif', transition: 'all 0.2s',
          }}>📋 Summary</button>
          <button onClick={() => setView('web')} style={{
            padding: '5px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 700,
            background: view === 'web' ? 'rgba(239,68,68,0.8)' : 'transparent',
            color: view === 'web' ? '#fff' : 'rgba(255,255,255,0.4)',
            fontFamily: 'DM Sans,sans-serif', transition: 'all 0.2s',
          }}>🌐 Full Article</button>
        </div>
      </div>

      {/* ── SUMMARY VIEW ── */}
      {view === 'summary' && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {article.image && (
            <div style={{ width: '100%', maxHeight: 200, overflow: 'hidden' }}>
              <img src={article.image} alt="" style={{ width: '100%', objectFit: 'cover', display: 'block' }}
                onError={e => e.target.parentNode.style.display = 'none'} />
            </div>
          )}
          <div style={{ padding: '18px 16px 60px' }}>
            {/* Source + date row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ padding: '3px 10px', borderRadius: 20, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', fontSize: 10, fontWeight: 700, color: '#f87171' }}>
                {article.source?.name}
              </span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
                {article.publishedAt ? new Date(article.publishedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
              </span>
            </div>

            {/* Title */}
            <h2 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 19, color: '#fff', margin: '0 0 14px', lineHeight: 1.35 }}>
              {article.title}
            </h2>

            {/* Description */}
            {article.description ? (
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 1.8, margin: '0 0 24px' }}>
                {article.description}
              </p>
            ) : (
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', margin: '0 0 24px' }}>
                No summary available. Tap "Full Article" to read on the source website.
              </p>
            )}

            {/* Read full article button */}
            <button onClick={() => setView('web')} style={{
              width: '100%', padding: '14px', borderRadius: 14, border: 'none',
              background: 'linear-gradient(135deg,#ef4444,#dc2626)',
              color: '#fff', fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 14,
              cursor: 'pointer', boxShadow: '0 4px 20px rgba(239,68,68,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              marginBottom: 10,
            }}>
              🌐 Read Full Article
            </button>

            <button onClick={onClose} style={{
              width: '100%', padding: '12px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)',
              fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}>
              ← Back to News
            </button>
          </div>
        </div>
      )}

      {/* ── WEB VIEW (iframe) ── */}
      {view === 'web' && (
        <div style={{ flex: 1, position: 'relative', background: '#fff' }}>
          {!iframeLoaded && !iframeError && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#05070f', gap: 14, zIndex: 2 }}>
              <div style={{ width: 40, height: 40, border: '3px solid rgba(239,68,68,0.2)', borderTop: '3px solid #ef4444', borderRadius: '50%', animation: 'spinLoad 0.7s linear infinite' }} />
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: 0 }}>Loading article…</p>
              <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, margin: 0 }}>{article.source?.name}</p>
            </div>
          )}
          {iframeError ? (
            /* Site blocks iframes — show summary + link */
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#05070f', padding: '24px 20px', gap: 16 }}>
              <div style={{ fontSize: 44 }}>🔒</div>
              <h3 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, color: '#fff', fontSize: 17, margin: 0, textAlign: 'center' }}>
                {article.source?.name} blocks in-app reading
              </h3>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center', lineHeight: 1.6, margin: 0 }}>
                This website prevents embedding. You can open it in your browser.
              </p>
              <a href={article.url} target="_blank" rel="noopener noreferrer" style={{
                padding: '13px 28px', borderRadius: 14, background: 'linear-gradient(135deg,#ef4444,#dc2626)',
                color: '#fff', fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 14,
                textDecoration: 'none', boxShadow: '0 4px 20px rgba(239,68,68,0.4)',
              }}>
                Open in Browser ↗
              </a>
              <button onClick={() => setView('summary')} style={{
                background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 13, cursor: 'pointer', fontFamily: 'DM Sans,sans-serif',
              }}>← Back to Summary</button>
            </div>
          ) : (
            <iframe
              key={article.url}
              src={article.url}
              title={article.title}
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
              onLoad={() => setIframeLoaded(true)}
              onError={() => { setIframeError(true); setIframeLoaded(true) }}
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            />
          )}
        </div>
      )}

      {/* Bottom bar when in web view */}
      {view === 'web' && iframeLoaded && !iframeError && (
        <div style={{ display: 'flex', gap: 8, padding: '10px 14px', background: 'rgba(5,7,15,0.95)', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'DM Sans,sans-serif' }}>
            ← Back to News
          </button>
          <a href={article.url} target="_blank" rel="noopener noreferrer" style={{ flex: 1, padding: '10px', borderRadius: 12, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', fontWeight: 700, fontSize: 13, textDecoration: 'none', textAlign: 'center', fontFamily: 'DM Sans,sans-serif' }}>
            Open in Browser ↗
          </a>
        </div>
      )}
    </div>
  )
}

export default function News() {
  const [activeTab, setActiveTab] = useState('world')
  const [newsData, setNewsData]   = useState({})
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [cacheStatus, setCacheStatus] = useState('')
  const abortRef = useRef(null)

  const fetchTab = useCallback(async (tabId, force = false) => {
    const inMem = newsData[tabId]
    if (!force && inMem && (Date.now() - inMem.fetchedAt < CACHE_TTL_MS)) {
      setCacheStatus('fresh'); return
    }
    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()
    setLoading(true); setError(null)

    try {
      // Check Firestore shared cache
      const cached = await readCache(tabId)
      if (!force && cached) {
        console.log('[News] Firestore cache hit:', tabId)
        setNewsData(prev => ({ ...prev, [tabId]: { articles: cached, fetchedAt: Date.now() } }))
        setLastUpdated(new Date()); setCacheStatus('cached')
        setLoading(false); return
      }
      const key = import.meta.env.VITE_NEWSDATA_API_KEY || ''
      console.log('[News] API key present:', !!key, '| length:', key.length)
      if (!key) {
        console.warn('[News] No API key found! Add VITE_NEWSDATA_API_KEY to .env')
        setNewsData(prev => ({ ...prev, [tabId]: { articles: generateDemo(tabId), fetchedAt: Date.now() } }))
        setLastUpdated(new Date()); setCacheStatus('demo')
        setLoading(false); return
      }
      // Fetch fresh from Newsdata.io
      console.log('[News] Fresh API fetch:', tabId)
      const tab = TABS.find(t => t.id === tabId)
      const articles = await fetchFromAPI(tab)
      await writeCache(tabId, articles)  // store in Firestore for all users
      setNewsData(prev => ({ ...prev, [tabId]: { articles, fetchedAt: Date.now() } }))
      setLastUpdated(new Date()); setCacheStatus('live')
    } catch (err) {
      if (err.name === 'AbortError') return
      console.error('[News]', err.message)
      if (err.message === 'NO_KEY') setError('Add VITE_NEWSDATA_API_KEY to .env')
      else if (err.message === 'RATE_LIMIT') setError('Rate limit reached. Showing cached news.')
      else if (err.message === 'API_KEY_INVALID') setError('Invalid API key.')
      else setError('Could not load news.')
      setNewsData(prev => ({ ...prev, [tabId]: { articles: generateDemo(tabId), fetchedAt: Date.now() - CACHE_TTL_MS + 60000 } }))
      setLastUpdated(new Date()); setCacheStatus('demo')
    }
    setLoading(false)
  }, [newsData])

  useEffect(() => { fetchTab(activeTab) }, [activeTab])
  useEffect(() => {
    const t = setTimeout(() => { TABS.forEach(tab => { if (tab.id !== activeTab) fetchTab(tab.id) }) }, 5000)
    return () => clearTimeout(t)
  }, [])

  const [readerArticle, setReaderArticle] = useState(null)
  const handleRead = (article) => {
    if (article.url && article.url !== '#') setReaderArticle(article)
  }

  const current  = newsData[activeTab]
  const articles = current?.articles || []
  const hero     = articles[0]
  const grid     = articles.slice(1, 7)
  const compact  = articles.slice(7)
  const tickerText = articles.map(a => a.title).join(' · ') || 'Loading latest news…'

  return (
    <>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;700&display=swap');
      .news-root{font-family:'DM Sans',sans-serif;color:#f1f5f9;}
      @keyframes fadeIn {from{opacity:0}to{opacity:1}}
      @keyframes slideUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
      @keyframes ticker {0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
      @keyframes shimmer{0%,100%{opacity:0.5}50%{opacity:1}}
      @keyframes liveDot{0%,100%{opacity:1}50%{opacity:0.3}}
      @keyframes spinLoad{to{transform:rotate(360deg)}}
      ::-webkit-scrollbar{width:3px;height:3px;}
      ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.15);border-radius:3px;}
    `}</style>

    <div className="news-root" style={{ maxWidth:900, margin:'0 auto', paddingBottom:80 }}>

      {/* HEADER */}
      <div style={{ marginBottom:12, animation:'slideUp 0.4s ease-out both' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <img src="/logo.jpg" alt="ACR MAX" style={{ width:32, height:32, borderRadius:'50%', objectFit:'cover', border:'1.5px solid rgba(239,68,68,0.4)' }} />
            <div>
              <h2 style={{ fontFamily:'Syne,sans-serif', fontSize:20, fontWeight:800, margin:0, background:'linear-gradient(135deg,#fff 20%,#f87171 60%,#fbbf24)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>📰 News Flash</h2>
              <p style={{ fontSize:10, color:'rgba(255,255,255,0.3)', margin:0 }}>
                ACR MAX · {lastUpdated ? `Updated ${TIME_AGO(lastUpdated.toISOString())}` : 'Loading…'}
                {cacheStatus === 'cached' && ' · from shared cache'}
              </p>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:7 }}>
            <div style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 9px', borderRadius:20, background: cacheStatus === 'live' ? 'rgba(52,211,153,0.12)' : cacheStatus === 'cached' ? 'rgba(96,165,250,0.12)' : 'rgba(251,191,36,0.1)', border:`1px solid ${cacheStatus === 'live' ? 'rgba(52,211,153,0.3)' : cacheStatus === 'cached' ? 'rgba(96,165,250,0.3)' : 'rgba(251,191,36,0.2)'}` }}>
              <div style={{ width:5, height:5, borderRadius:'50%', background: cacheStatus === 'live' ? '#34d399' : cacheStatus === 'cached' ? '#60a5fa' : '#fbbf24', animation:'liveDot 1.5s infinite' }} />
              <span style={{ fontSize:8, fontWeight:800, color: cacheStatus === 'live' ? '#34d399' : cacheStatus === 'cached' ? '#60a5fa' : '#fbbf24', letterSpacing:'0.06em' }}>
                {cacheStatus === 'live' ? 'LIVE' : cacheStatus === 'cached' ? 'CACHED' : 'NO KEY'}
              </span>
            </div>
            <button onClick={() => fetchTab(activeTab, true)} disabled={loading}
              style={{ padding:'5px 11px', borderRadius:9, background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.12)', color:'rgba(255,255,255,0.6)', fontSize:11, fontWeight:700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily:'DM Sans,sans-serif', opacity: loading ? 0.5 : 1 }}>
              {loading ? '⏳' : '🔄'} Refresh
            </button>
          </div>
        </div>

        {/* Ticker */}
        <div style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.18)', borderRadius:9, padding:'5px 10px', overflow:'hidden', display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:8, fontWeight:800, color:'#ef4444', background:'rgba(239,68,68,0.15)', padding:'2px 7px', borderRadius:5, letterSpacing:'0.08em', flexShrink:0 }}>LIVE</span>
          <div style={{ overflow:'hidden', flex:1 }}>
            <div style={{ display:'inline-block', animation:'ticker 35s linear infinite', whiteSpace:'nowrap' }}>
              <span style={{ fontSize:10, color:'rgba(255,255,255,0.45)', marginRight:40 }}>{tickerText}</span>
              <span style={{ fontSize:10, color:'rgba(255,255,255,0.45)', marginRight:40 }}>{tickerText}</span>
            </div>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div style={{ display:'flex', gap:6, marginBottom:12, overflowX:'auto', paddingBottom:2, scrollbarWidth:'none', animation:'slideUp 0.4s ease-out 0.05s both' }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{ padding:'6px 12px', borderRadius:20, fontWeight:700, fontSize:11, whiteSpace:'nowrap', cursor:'pointer', border:'none', fontFamily:'DM Sans,sans-serif', transition:'all 0.2s', background: activeTab === tab.id ? 'linear-gradient(135deg,#ef4444,#dc2626)' : 'rgba(255,255,255,0.07)', color: activeTab === tab.id ? '#fff' : 'rgba(255,255,255,0.45)', boxShadow: activeTab === tab.id ? '0 3px 12px rgba(239,68,68,0.4)' : 'none' }}>
            {tab.label}
            {newsData[tab.id] && tab.id !== activeTab && <span style={{ display:'inline-block', width:4, height:4, borderRadius:'50%', background:'#34d399', marginLeft:4, verticalAlign:'middle' }} />}
          </button>
        ))}
      </div>

      {/* ERROR */}
      {error && (
        <div style={{ background:'rgba(251,191,36,0.08)', border:'1px solid rgba(251,191,36,0.2)', borderRadius:10, padding:'9px 13px', marginBottom:10, display:'flex', alignItems:'center', gap:8 }}>
          <span>⚠</span>
          <p style={{ fontSize:11, color:'#fbbf24', fontWeight:600, margin:0 }}>{error}</p>
          <button onClick={() => setError(null)} style={{ marginLeft:'auto', background:'none', border:'none', color:'rgba(255,255,255,0.3)', cursor:'pointer', fontSize:13 }}>✕</button>
        </div>
      )}

      {/* CONTENT */}
      {loading && !current ? (
        <div>
          <div style={{ height:230, borderRadius:18, background:'rgba(255,255,255,0.04)', marginBottom:12, animation:'shimmer 1.5s ease-in-out infinite' }} />
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:10 }}>
            {Array(6).fill(0).map((_,i) => <CardSkeleton key={i} />)}
          </div>
        </div>
      ) : (
        <div style={{ animation:'fadeIn 0.3s ease-out both' }}>
          {hero && <HeroCard article={hero} onRead={handleRead} />}
          {grid.length > 0 && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:10, marginBottom:14 }}>
              {grid.map((a,i) => <NewsCard key={`${activeTab}-g-${i}`} article={a} onRead={handleRead} index={i} />)}
            </div>
          )}
          {compact.length > 0 && (
            <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:14, padding:'2px 14px', marginBottom:12 }}>
              <p style={{ fontFamily:'Syne,sans-serif', fontWeight:700, color:'rgba(255,255,255,0.35)', fontSize:9, textTransform:'uppercase', letterSpacing:'0.12em', padding:'9px 0 3px' }}>More Stories</p>
              {compact.map((a,i) => <CompactCard key={`${activeTab}-c-${i}`} article={a} onRead={handleRead} />)}
            </div>
          )}
          {articles.length > 0 && (
            <p style={{ textAlign:'center', fontSize:10, color:'rgba(255,255,255,0.18)', margin:'8px 0 0' }}>
              Newsdata.io · Shared cache · {articles.length} stories{lastUpdated ? ` · ${lastUpdated.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}` : ''}
            </p>
          )}
        </div>
      )}
    </div>

      {/* ── IN-APP ARTICLE READER — iframe based ── */}
      {readerArticle && (
        <ArticleReader article={readerArticle} onClose={() => setReaderArticle(null)} />
      )}
    </>
  )
}