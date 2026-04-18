import { useState, useEffect, useRef } from 'react'
import { db } from '../firebase'
import { doc, getDoc } from 'firebase/firestore'

const TODAY    = () => new Date().toISOString().slice(0,10)

function formatDataTime(value) {
  if (!value) return ''
  const raw = typeof value.toDate === 'function' ? value.toDate() : value
  const date = raw instanceof Date ? raw : new Date(raw)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})
}

function Stars({ count=80 }) {
  const ref = useRef(null)
  useEffect(() => {
    const c = ref.current; if(!c) return
    const ctx = c.getContext('2d')
    let raf, t = 0
    const resize = () => { c.width = c.offsetWidth; c.height = c.offsetHeight }
    resize(); window.addEventListener('resize', resize)
    const stars = Array.from({length:count}, () => ({
      x:Math.random(), y:Math.random(), r:Math.random()*1.4+0.2,
      speed:Math.random()*0.00015+0.00004, twinkle:Math.random()*0.02+0.004,
      offset:Math.random()*Math.PI*2, op:Math.random()*0.7+0.2
    }))
    const draw = () => {
      t++; ctx.clearRect(0,0,c.width,c.height)
      stars.forEach(s => {
        const tw = 0.4 + 0.6*Math.sin(t*s.twinkle+s.offset)
        ctx.beginPath(); ctx.arc(s.x*c.width, s.y*c.height, s.r, 0, Math.PI*2)
        ctx.fillStyle = `rgba(255,255,255,${s.op*tw})`; ctx.fill()
        s.y -= s.speed; if(s.y<0){s.y=1;s.x=Math.random()}
      })
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize',resize) }
  },[count])
  return <canvas ref={ref} style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none'}}/>
}

function Meteors() {
  const ref = useRef(null)
  useEffect(() => {
    const c = ref.current; if(!c) return
    const ctx = c.getContext('2d'); let raf
    const resize = () => { c.width=c.offsetWidth; c.height=c.offsetHeight }
    resize(); window.addEventListener('resize', resize)
    const meteors = []
    const draw = () => {
      ctx.clearRect(0,0,c.width,c.height)
      if(meteors.length<2 && Math.random()<0.004) meteors.push({
        x:Math.random()*c.width*0.6, y:Math.random()*c.height*0.3,
        len:80+Math.random()*120, speed:9+Math.random()*8,
        op:1, angle:Math.PI/4+(Math.random()-0.5)*0.3
      })
      for(let i=meteors.length-1;i>=0;i--){
        const m=meteors[i]
        const g=ctx.createLinearGradient(m.x,m.y,m.x-Math.cos(m.angle)*m.len,m.y-Math.sin(m.angle)*m.len)
        g.addColorStop(0,`rgba(200,210,255,${m.op})`)
        g.addColorStop(1,'rgba(200,210,255,0)')
        ctx.beginPath(); ctx.moveTo(m.x,m.y)
        ctx.lineTo(m.x-Math.cos(m.angle)*m.len, m.y-Math.sin(m.angle)*m.len)
        ctx.strokeStyle=g; ctx.lineWidth=1.5; ctx.stroke()
        m.x+=Math.cos(m.angle)*m.speed; m.y+=Math.sin(m.angle)*m.speed; m.op-=0.012
        if(m.op<=0||m.x>c.width||m.y>c.height) meteors.splice(i,1)
      }
      raf=requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize',resize) }
  },[])
  return <canvas ref={ref} style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none',zIndex:1}}/>
}

function Skel({ h=16, w='100%', r=8, mb=0 }) {
  return <div style={{height:h,width:w,borderRadius:r,marginBottom:mb,background:'linear-gradient(90deg,rgba(255,255,255,0.06) 25%,rgba(255,255,255,0.13) 50%,rgba(255,255,255,0.06) 75%)',backgroundSize:'400% 100%',animation:'spaceSkel 1.5s ease-in-out infinite'}}/>
}

function Glass({ children, style={}, glow=null }) {
  return (
    <div className="space-glass-card" style={{
      background:'linear-gradient(145deg,rgba(255,255,255,0.12),rgba(255,255,255,0.04))',
      backdropFilter:'blur(16px)', border:'1px solid rgba(255,255,255,0.12)',
      borderRadius:16, boxShadow:`0 4px 18px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)${glow?`, 0 0 46px ${glow}16`:''}`,
      transition:'transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease',
      ...style
    }}>
      {children}
    </div>
  )
}

function ISSIcon({ size=28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect x="13" y="7" width="6" height="18" rx="2" fill="#c4b5fd"/>
      <rect x="2" y="13" width="28" height="6" rx="2" fill="#a78bfa"/>
      <rect x="0" y="11" width="8" height="10" rx="2" fill="#7c3aed" opacity="0.85"/>
      <rect x="24" y="11" width="8" height="10" rx="2" fill="#7c3aed" opacity="0.85"/>
      <circle cx="16" cy="16" r="3" fill="#34d399"/>
      <rect x="12" y="2" width="2" height="5" rx="1" fill="#60a5fa"/>
      <rect x="18" y="2" width="2" height="5" rx="1" fill="#60a5fa"/>
      <rect x="12" y="25" width="2" height="5" rx="1" fill="#60a5fa"/>
      <rect x="18" y="25" width="2" height="5" rx="1" fill="#60a5fa"/>
    </svg>
  )
}

function ISSTracker({ issData, issLocation }) {
  const [mapLoaded, setMapLoaded] = useState(false)
  const lat = parseFloat(issData?.lat || 0)
  const lng = parseFloat(issData?.lng || 0)
  const vel = parseFloat(issData?.vel || 27600)
  const hasData = lat!==0||lng!==0

  const minLng=lng-18, maxLng=lng+18, minLat=lat-18, maxLat=lat+18
  const mapUrl=`https://www.openstreetmap.org/export/embed.html?bbox=${minLng},${minLat},${maxLng},${maxLat}&layer=mapnik&marker=${lat},${lng}`

  const stats = [
    { label:'Latitude',   val:`${lat.toFixed(3)}°`, icon:'↕', color:'#60a5fa' },
    { label:'Longitude',  val:`${lng.toFixed(3)}°`, icon:'↔', color:'#a78bfa' },
    { label:'Speed',      val:`${(vel/1000).toFixed(1)} km/s`, icon:'⚡', color:'#34d399' },
    { label:'Altitude',   val:'~408 km', icon:'🌐', color:'#f472b6' },
    { label:'Orbit/day',  val:'15.5',   icon:'🔄', color:'#fbbf24' },
    { label:'Crew',       val:'7',      icon:'👨‍🚀', color:'#22d3ee' },
  ]

  return (
    <div style={{animation:'spaceUp 0.5s ease-out 0.1s both',marginTop:8,display:'flex',flexDirection:'column',gap:12}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12,padding:'0 2px'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{padding:8,background:'rgba(99,102,241,0.15)',borderRadius:14,border:'1px solid rgba(99,102,241,0.3)'}}>
            <ISSIcon size={22}/>
          </div>
          <div>
            <p style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:16,color:'#ffffff',margin:0,letterSpacing:'0.3px'}}>ISS Live Tracker</p>
            <p style={{fontSize:11,color:'rgba(255,255,255,0.92)',margin:0}}>International Space Station</p>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:6,background:'rgba(52,211,153,0.1)',border:'1px solid rgba(52,211,153,0.3)',borderRadius:20,padding:'5px 12px'}}>
          <div style={{width:6,height:6,borderRadius:'50%',background:'#34d399',boxShadow:'0 0 8px #34d399',animation:'spaceBlink 1.2s infinite'}}/>
          <span style={{fontSize:10,fontWeight:800,color:'#34d399',letterSpacing:'0.1em'}}>LIVE</span>
        </div>
      </div>

      <Glass glow="#6366f1" style={{overflow:'hidden'}}>
        <div style={{padding:'12px 18px',background:'linear-gradient(135deg,rgba(99,102,241,0.2),rgba(139,92,246,0.1))',borderBottom:'1px solid rgba(99,102,241,0.15)',display:'flex',alignItems:'center',gap:12}}>
          <div style={{position:'relative',flexShrink:0}}>
            <div style={{width:36,height:36,borderRadius:'50%',background:'rgba(99,102,241,0.2)',border:'1.5px solid rgba(99,102,241,0.5)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>📍</div>
            <div style={{position:'absolute',inset:-5,borderRadius:'50%',border:'1.5px solid rgba(99,102,241,0.3)',animation:'spaceRadar 2.5s ease-out infinite'}}/>
          </div>
          <div style={{flex:1}}>
            <p style={{fontSize:9,fontWeight:700,color:'rgba(255,255,255,0.92)',textTransform:'uppercase',letterSpacing:'0.12em',margin:'0 0 2px'}}>Currently over</p>
            <p style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:15,color:'#ffffff',margin:0,letterSpacing:'0.2px'}}>{issLocation||'Locating…'}</p>
          </div>
          <div style={{textAlign:'right',flexShrink:0}}>
            <p style={{fontSize:9,color:'rgba(255,255,255,0.85)',textTransform:'uppercase',letterSpacing:'0.08em',margin:'0 0 2px'}}>UTC Time</p>
            <p style={{fontFamily:'Share Tech Mono,monospace',fontSize:12,color:'#a78bfa',margin:0}}>{new Date().toUTCString().slice(17,25)}</p>
          </div>
        </div>

        <div style={{position:'relative',height:220,background:'#030712',overflow:'hidden'}}>
          {hasData ? (
            <>
              <iframe width="100%" height="100%"
                style={{border:0,display:'block',opacity:mapLoaded?1:0,transition:'opacity 0.6s',
                  filter:'invert(1) hue-rotate(180deg) saturate(1.4) brightness(0.8)'}}
                src={mapUrl} title="ISS Map" onLoad={()=>setMapLoaded(true)}/>
              <div style={{position:'absolute',left:0,right:0,height:2,background:'linear-gradient(90deg,transparent,rgba(52,211,153,0.5),transparent)',animation:'spaceScan 3s linear infinite',pointerEvents:'none'}}/>
              <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',pointerEvents:'none',zIndex:5}}>
                <div style={{position:'relative',width:64,height:64,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <div style={{position:'absolute',inset:0,borderRadius:'50%',border:'2px solid rgba(52,211,153,0.7)',animation:'spaceRadar 2s ease-out infinite'}}/>
                  <div style={{position:'absolute',inset:10,borderRadius:'50%',border:'1px solid rgba(52,211,153,0.4)',animation:'spaceRadar 2s ease-out 0.5s infinite'}}/>
                  <ISSIcon size={30}/>
                </div>
              </div>
              <div style={{position:'absolute',bottom:12,left:12,background:'rgba(0,0,0,0.85)',backdropFilter:'blur(8px)',border:'1px solid rgba(52,211,153,0.35)',borderRadius:10,padding:'7px 12px',fontFamily:'Share Tech Mono,monospace',fontSize:11,color:'#34d399',pointerEvents:'none'}}>
                {lat.toFixed(4)}° N &nbsp;·&nbsp; {lng.toFixed(4)}° E
              </div>
              {!mapLoaded&&(
                <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:12,background:'#030712'}}>
                  <div style={{fontSize:36,animation:'spaceFloat 3s ease-in-out infinite'}}>🛰️</div>
                  <p style={{color:'rgba(255,255,255,0.85)',fontSize:12,fontWeight:700}}>Loading map…</p>
                </div>
              )}
            </>
          ) : (
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',gap:12}}>
              <div style={{fontSize:40,animation:'spaceFloat 3s ease-in-out infinite'}}>🛰️</div>
              <p style={{color:'rgba(255,255,255,0.92)',fontWeight:700,fontSize:13}}>Initializing GPS…</p>
            </div>
          )}
        </div>

        <div style={{padding:'10px 10px 10px'}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,marginBottom:10}}>
            {stats.map((s,i)=>(
              <div key={i} style={{textAlign:'center',padding:'8px 6px',background:'rgba(255,255,255,0.04)',borderRadius:16,border:`1px solid ${s.color}18`,animation:`spaceUp 0.4s ease-out ${i*60}ms both`}}>
                <div style={{fontSize:16,marginBottom:4,filter:`drop-shadow(0 0 6px ${s.color}50)`}}>{s.icon}</div>
                <p style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:11,color:s.color,margin:'0 0 1px',lineHeight:1}}>{s.val}</p>
                <p style={{fontSize:8,color:'rgba(255,255,255,0.9)',margin:0,textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:600}}>{s.label}</p>
              </div>
            ))}
          </div>
          <div style={{background:'rgba(255,255,255,0.03)',borderRadius:12,padding:'10px 14px',border:'1px solid rgba(255,255,255,0.06)'}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
              <span style={{fontSize:10,color:'rgba(255,255,255,0.92)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em'}}>Orbital velocity</span>
              <span style={{fontSize:11,fontWeight:800,color:'#34d399'}}>{vel.toFixed(0)} km/h</span>
            </div>
            <div style={{height:5,borderRadius:5,background:'rgba(255,255,255,0.06)',overflow:'hidden'}}>
              <div style={{height:'100%',width:`${Math.min((vel/30000)*100,100)}%`,background:'linear-gradient(90deg,#7c3aed,#a78bfa,#34d399)',borderRadius:5,boxShadow:'0 0 12px rgba(167,139,250,0.5)',transition:'width 1s ease-out',position:'relative',overflow:'hidden'}}>
                <div style={{position:'absolute',inset:0,background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)',animation:'spaceShim 1.8s infinite'}}/>
              </div>
            </div>
          </div>
        </div>
      </Glass>

      <div style={{marginTop:12,padding:'14px 16px',background:'rgba(99,102,241,0.06)',border:'1px solid rgba(99,102,241,0.14)',borderRadius:16,display:'flex',gap:12,alignItems:'flex-start'}}>
        <span style={{fontSize:22,flexShrink:0,animation:'spaceFloat 5s ease-in-out infinite'}}>🛸</span>
        <p style={{fontSize:12,color:'rgba(255,255,255,0.92)',lineHeight:1.7,margin:0}}>
          ISS travels at <span style={{color:'#34d399',fontWeight:700}}>~27,600 km/h</span>, completing an orbit every <span style={{color:'#60a5fa',fontWeight:700}}>92 minutes</span> at <span style={{color:'#f472b6',fontWeight:700}}>408 km</span> altitude. Location updates every <span style={{color:'#fbbf24',fontWeight:700}}>5 seconds</span>.
        </p>
      </div>
    </div>
  )
}

function APODSection({ data, loading, onImageSelect }) {
  const [expanded, setExpanded] = useState(false)
  const apod = data?.apod
  if (loading || !apod?.image) return null
  const isVideo = apod.media_type === "video"
  const words = apod?.explanation?.split(' ')||[]
  const preview = words.slice(0,50).join(' ')+(words.length>50?'…':'')
  return (
    <Glass style={{overflow:'hidden'}}>
      <div style={{position:'relative',overflow:'hidden',borderRadius:'16px 16px 0 0'}}>
        {isVideo ? (
          <iframe src={apod.image} title={apod.title || 'Astronomy Picture of the Day'} allowFullScreen style={{width:'100%',height:240,border:0,borderRadius:12,display:'block'}}/>
        ) : (
          <img src={apod.image} alt={apod.title || 'Astronomy Picture of the Day'} loading="lazy" referrerPolicy="no-referrer"
            onClick={() => onImageSelect({
              src: apod.image,
              title: apod.title,
              description: apod.explanation
            })}
            onError={(e) => {
              console.log("Image failed:", apod.image)
              e.target.style.display = "none"
            }}
            style={{width:'100%',height:240,objectFit:'cover',borderRadius:12,display:'block',transition:'transform 0.5s',cursor:'zoom-in'}}
            onMouseEnter={e=>e.target.style.transform='scale(1.04)'}
            onMouseLeave={e=>e.target.style.transform='scale(1)'}/>
        )}
        <div style={{position:'absolute',inset:0,background:'linear-gradient(to top,rgba(5,8,20,0.95) 0%,transparent 45%)',pointerEvents:'none'}}/>
        <div style={{position:'absolute',top:14,right:14,background:'rgba(0,0,0,0.7)',backdropFilter:'blur(10px)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:20,padding:'5px 12px'}}>
          <span style={{fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.9)'}}>🚀 NASA APOD</span>
        </div>
        <div style={{position:'absolute',bottom:16,left:18,right:18}}>
          <h3 style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:14,color:'#ffffff',margin:0,textShadow:'0 2px 16px rgba(0,0,0,0.9)',letterSpacing:'0.3px'}}>{apod?.title || 'Astronomy Picture of the Day'}</h3>
          <p style={{fontSize:11,color:'rgba(255,255,255,0.9)',margin:'4px 0 0'}}>{new Date(apod?.date||TODAY()).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}</p>
        </div>
      </div>
      <div style={{padding:'18px 18px 16px'}}>
        <p style={{fontSize:11,color:'rgba(255,255,255,0.9)',lineHeight:1.75,margin:'0 0 8px'}}>
          {expanded?apod.explanation:preview}
        </p>
        {words.length>50&&(
          <button onClick={()=>setExpanded(e=>!e)} style={{background:'none',border:'none',color:'#a78bfa',fontWeight:700,fontSize:13,cursor:'pointer',padding:0}}>
            {expanded?'▲ Show less':'▼ Read more'}
          </button>
        )}
      </div>
    </Glass>
  )
}

function AsteroidsSection({ asteroids }) {
  if(!asteroids) return <div style={{display:'flex',flexDirection:'column',gap:8}}>{[0,1,2,3].map(i=><Skel key={i} h={70} r={14}/>)}</div>
  if(!asteroids.length) return <p style={{color:'rgba(255,255,255,0.85)',textAlign:'center',padding:'24px 0'}}>No close approaches today. 🪐</p>
  return (
    <div style={{display:'flex',flexDirection:'column',gap:10}}>
      {asteroids.map((a,i)=>(
        <div key={a?.id || i} className="space-item-card" style={{
          padding:'12px 16px', borderRadius:16, border:`1px solid ${a?.hazardous?'rgba(239,68,68,0.35)':'rgba(255,255,255,0.08)'}`,
          background:a?.hazardous?'rgba(239,68,68,0.06)':'rgba(255,255,255,0.03)',
          display:'flex', alignItems:'center', justifyContent:'space-between', gap:10,
          animation:`spaceUp 0.35s ease-out ${i*50}ms both`,
          transition:'transform 0.22s ease,border-color 0.22s ease,background 0.22s ease'
        }}>
          <div style={{display:'flex',alignItems:'center',gap:10,flex:1,minWidth:0}}>
            <span style={{fontSize:22,flexShrink:0}}>{a?.hazardous?'☄️':'🪨'}</span>
            <div style={{minWidth:0}}>
              <p style={{fontSize:13,fontWeight:700,color:a?.hazardous?'#fca5a5':'#f0f0f0',margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a?.name || 'Near-Earth Object'}</p>
              <p style={{fontSize:10,color:'rgba(255,255,255,0.92)',margin:0}}>{a?.sizeMin || 0}–{a?.sizeMax || 0}m · {parseFloat(a?.velocity || 0).toLocaleString()} km/h</p>
            </div>
          </div>
          <div style={{textAlign:'right',flexShrink:0}}>
            {a?.hazardous&&<div style={{padding:'3px 10px',background:'rgba(239,68,68,0.2)',border:'1px solid rgba(239,68,68,0.4)',borderRadius:20,marginBottom:4}}>
              <span style={{fontSize:9,fontWeight:800,color:'#f87171',letterSpacing:'0.1em'}}>HAZARDOUS</span>
            </div>}
            <p style={{fontSize:10,color:'rgba(255,255,255,0.9)',margin:0}}>{parseFloat(a?.distance || 0).toLocaleString()} km</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function EarthSection({ images, onImageSelect }) {
  if(!images) return <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10}}>{[0,1,2,3].map(i=><Skel key={i} h={140} r={16}/>)}</div>
  if(!images.length) return <p style={{color:'rgba(255,255,255,0.85)',textAlign:'center',padding:'24px 0'}}>Earth images loading…</p>
  return (
    <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10}}>
      {images.map((img,i)=>(
        <div key={img?.id || i} className="space-item-card" style={{borderRadius:16,overflow:'hidden',border:'1px solid rgba(59,130,246,0.2)',animation:`spaceUp 0.4s ease-out ${i*60}ms both`,transition:'transform 0.22s ease,border-color 0.22s ease,background 0.22s ease'}}>
          {(img?.image || img?.url) ? <img src={img?.image || img?.url} alt="Earth" loading="lazy"
            onClick={() => onImageSelect({
              src: img?.image || img?.url,
              title: "Earth",
              description: img?.caption
            })}
            style={{width:'100%',height:100,objectFit:'cover',display:'block',cursor:'zoom-in'}}
            onError={e=>{e.target.style.display='none'}}/> : <div style={{width:'100%',height:100,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(255,255,255,0.04)',fontSize:26}}>🌍</div>}
          <div style={{padding:'8px 10px',background:'rgba(59,130,246,0.05)'}}>
            <p style={{fontSize:10,color:'rgba(255,255,255,0.85)',margin:0}}>{img?.date?.slice(0,10) || ''}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function SunSection({ data, loading, onImageSelect }) {
  const images = data?.sun || []

  if (loading) return <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10}}>{[0,1,2,3].map(i=><Skel key={i} h={140} r={16}/>)}</div>
  if (!images.length) return <p style={{color:'rgba(255,255,255,0.85)',textAlign:'center',padding:'24px 0'}}>Sun view loading...</p>

  return (
    <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10}}>
      {images.map((item,i)=>(
        <div key={i} className="space-item-card" style={{borderRadius:16,overflow:'hidden',border:'1px solid rgba(251,191,36,0.24)',background:'rgba(251,191,36,0.06)',animation:`spaceUp 0.4s ease-out ${i*60}ms both`,transition:'transform 0.22s ease,border-color 0.22s ease,background 0.22s ease'}}>
          {item?.image ? <img src={item.image} alt={item?.title || 'Sun View'} loading="lazy" referrerPolicy="no-referrer"
            onClick={() => onImageSelect({
              src: item.image,
              title: item.title,
            })}
            style={{width:'100%',height:110,objectFit:'cover',display:'block',cursor:'zoom-in'}}
            onError={e=>{e.target.style.display='none'}}/> : <div style={{width:'100%',height:110,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(255,255,255,0.04)',fontSize:28}}>☀️</div>}
          <div style={{padding:'8px 10px',background:'rgba(251,191,36,0.06)'}}>
            <p style={{fontSize:10,color:'rgba(255,255,255,0.9)',margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item?.title || 'Sun View'}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

const NASA_TABS = [
  { id:'apod',      icon:'🌌', label:'Today in Space' },
  { id:'sun',       icon:'☀️', label:'Sun View' },
  { id:'asteroids', icon:'☄️',  label:'Asteroids' },
  { id:'earth',     icon:'🌍', label:'Earth View' },
]

const NASA_SECTION_TITLES = {
  apod: 'Astronomy Picture of the Day',
  sun: 'Sun View',
  asteroids: 'Near-Earth Asteroids',
  earth: 'Earth View',
}

function NASAHub() {
  const [activeTab, setActiveTab] = useState('apod')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedImage, setSelectedImage] = useState(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        setLoading(true)
        setError(null)

        const today = TODAY()
        const snap = await getDoc(doc(db, 'space_nasa', today))

        if (cancelled) return

        if (snap.exists()) {
          setData(snap.data())
        } else {
          console.warn(`[NASA] No Firestore data found for ${today}`)
          setData({})
        }
      } catch (e) {
        console.warn('[NASA] Firestore read failed:', e?.message || e)
        if (!cancelled) setError('Could not load NASA data')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <>
    <div style={{animation:'spaceUp 0.5s ease-out 0.2s both',marginTop:10,display:'flex',flexDirection:'column',gap:12}}>
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'0 2px'}}>
        <div style={{padding:8,background:'rgba(251,191,36,0.12)',borderRadius:14,border:'1px solid rgba(251,191,36,0.25)'}}>
          <span style={{fontSize:20}}>🚀</span>
        </div>
        <div>
          <p style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:16,color:'#ffffff',margin:0,letterSpacing:'0.3px'}}>NASA Space Hub</p>
          <p style={{fontSize:11,color:'rgba(255,255,255,0.92)',margin:0}}>Live data · Firestore-cached</p>
        </div>
        {data?.fromCache&&<div style={{marginLeft:'auto',padding:'4px 10px',background:'rgba(99,102,241,0.12)',border:'1px solid rgba(99,102,241,0.25)',borderRadius:20}}>
          <span style={{fontSize:9,fontWeight:700,color:'#818cf8',letterSpacing:'0.1em'}}>CACHED</span>
        </div>}
      </div>

      <div style={{display:'flex',gap:6,overflowX:'auto',scrollbarWidth:'none',paddingBottom:2}}>
        {NASA_TABS.map(tab=>(
          <button key={tab.id} onClick={()=>setActiveTab(tab.id)}
            style={{
              flexShrink:0, padding:'6px 10px', borderRadius:20, border:'none', cursor:'pointer',
              fontFamily:'Poppins,sans-serif', fontWeight:700, fontSize:10, whiteSpace:'nowrap',
              background:activeTab===tab.id?'linear-gradient(135deg,#4f46e5,#7c3aed)':'rgba(255,255,255,0.08)',
              color:activeTab===tab.id?'#fff':'rgba(255,255,255,0.85)',
              boxShadow:activeTab===tab.id?'0 0 12px rgba(99,102,241,0.6), 0 6px 18px rgba(79,70,229,0.32)':'none',
              transition:'all 0.2s',
            }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {error&&<div style={{textAlign:'center',padding:'24px',color:'rgba(239,68,68,0.7)',fontSize:13}}>⚠ {error}</div>}
      {!error&&(
        <div style={{animation:'spaceFade 0.3s ease-out'}}>
          <p style={{fontFamily:'Syne,sans-serif',fontSize:13,fontWeight:800,color:'#ffffff',margin:'0 2px 10px',letterSpacing:'0.3px'}}>{NASA_SECTION_TITLES[activeTab]}</p>
          {activeTab==='apod'&&<APODSection data={data} loading={loading} onImageSelect={setSelectedImage}/>}
          {activeTab==='sun'&&<SunSection data={data} loading={loading} onImageSelect={setSelectedImage}/>}
          {activeTab==='asteroids'&&<AsteroidsSection asteroids={loading?null:(data?.asteroids || [])}/>}
          {activeTab==='earth'&&<EarthSection images={loading?null:(data?.earth || [])} onImageSelect={setSelectedImage}/>}
        </div>
      )}

      {data?.updatedAt&&(
        <p style={{fontSize:10,color:'rgba(255,255,255,0.85)',textAlign:'center',marginTop:14,fontFamily:'Poppins,sans-serif'}}>
          Data fetched {formatDataTime(data?.updatedAt)} · Cached daily in Firestore
        </p>
      )}
    </div>
    {selectedImage && (
      <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.9)',zIndex:50,display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'center',padding:16}}>
        <img src={selectedImage.src} alt={selectedImage.title || 'Space image'} style={{maxHeight:'70vh',maxWidth:'100%',borderRadius:12,marginBottom:16,objectFit:'contain',boxShadow:'0 20px 70px rgba(0,0,0,0.55)'}}/>
        <h2 style={{color:'#ffffff',fontSize:18,fontWeight:800,margin:'0 0 8px',textAlign:'center',fontFamily:'Syne,sans-serif',letterSpacing:'0.3px'}}>{selectedImage.title}</h2>
        <p style={{color:'rgba(229,231,235,0.9)',fontSize:13,maxWidth:420,textAlign:'center',lineHeight:1.65,margin:0}}>{selectedImage.description}</p>
        <button
          onClick={() => setSelectedImage(null)}
          style={{marginTop:16,padding:'9px 18px',background:'#ffffff',color:'#000000',border:'none',borderRadius:999,fontWeight:800,cursor:'pointer'}}
        >
          Close
        </button>
      </div>
    )}
    </>
  )
}

export default function Space({ issData, issLocation, nasaData }) {
  const [view, setView] = useState('hub')
  const [orbitDeg, setOrbitDeg] = useState(0)

  useEffect(()=>{
    const interval = setInterval(()=>setOrbitDeg(d=>(d+0.1)%360), 50)
    return()=>clearInterval(interval)
  },[])

  return (
    <>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Poppins:wght@400;500;600;700;800&family=Share+Tech+Mono&display=swap');
      @keyframes spaceUp    {from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
      @keyframes spaceFade  {from{opacity:0}to{opacity:1}}
      @keyframes spaceFloat {0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
      @keyframes spaceBlink {0%,100%{opacity:1}50%{opacity:0.3}}
      @keyframes spaceRadar {0%{transform:scale(0.6);opacity:1}100%{transform:scale(2.4);opacity:0}}
      @keyframes spaceScan  {0%{top:0}100%{top:100%}}
      @keyframes spaceShim  {0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}
      @keyframes spaceSkel  {0%{background-position:200% center}100%{background-position:-200% center}}
      @keyframes spaceOrbit {from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
      @media (hover:hover) {
        .space-glass-card:hover { transform:scale(1.02); border-color:rgba(255,255,255,0.18) !important; }
        .space-item-card:hover { transform:scale(1.02); border-color:rgba(255,255,255,0.2) !important; background:rgba(255,255,255,0.07) !important; }
      }
    `}</style>

    <div style={{fontFamily:'Poppins,sans-serif',color:'#f1f5f9',maxWidth:480,margin:'0 auto',padding:'0 10px 24px',position:'relative',background:'linear-gradient(to bottom,rgba(10,10,25,0.9),rgba(5,5,15,1))'}}>

      <div style={{position:'relative',overflow:'hidden',borderRadius:18,marginBottom:16,padding:'14px 14px 12px',background:'linear-gradient(135deg,rgba(8,5,24,0.98),rgba(12,18,50,0.95))',border:'1px solid rgba(99,102,241,0.25)',borderBottom:'1px solid rgba(255,255,255,0.08)',boxShadow:'0 10px 34px rgba(0,0,0,0.42)',animation:'spaceUp 0.4s ease-out both'}}>
        <Stars count={20}/>
        <Meteors/>
        <div style={{position:'relative',zIndex:2,display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
          <div style={{position:'relative',width:44,height:44,flexShrink:0}}>
            <div style={{position:'absolute',inset:0,borderRadius:'50%',border:'1px dashed rgba(99,102,241,0.4)',transform:`rotate(${orbitDeg}deg)`}}>
              <div style={{position:'absolute',top:-5,left:'50%',transform:'translateX(-50%)',filter:'drop-shadow(0 0 8px #a78bfa)'}}><ISSIcon size={18}/></div>
            </div>
            <div style={{position:'absolute',inset:9,borderRadius:'50%',background:'radial-gradient(circle,#1e3a8a,#0d1b4b)',border:'1.5px solid rgba(99,102,241,0.5)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,boxShadow:'0 0 20px rgba(99,102,241,0.3)'}}>🌍</div>
          </div>
          <div>
            <p style={{fontSize:10,fontWeight:800,color:'rgba(167,139,250,0.95)',letterSpacing:'0.12em',textTransform:'uppercase',margin:'0 0 2px'}}>ACR MAX</p>
            <h2 style={{fontFamily:'Syne,sans-serif',fontSize:16,fontWeight:800,letterSpacing:'0.3px',margin:'0 0 2px',color:'#ffffff'}}>Explore Space 🚀</h2>
            <p style={{fontSize:9,color:'rgba(255,255,255,0.85)',margin:0}}>Live ISS · NASA APIs · Firestore-cached</p>
          </div>
          <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:6,background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:20,padding:'3px 8px'}}>
            <div style={{width:6,height:6,borderRadius:'50%',background:'#ef4444',boxShadow:'0 0 6px #ef4444',animation:'spaceBlink 1s infinite'}}/>
            <span style={{fontSize:10,fontWeight:800,color:'#fca5a5',letterSpacing:'0.1em'}}>LIVE</span>
          </div>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:14}}>
        {[
          { id:'iss', icon:'🛰️', title:'ISS Tracker', sub:'Live location · 5s updates', color:'#6366f1', glow:'rgba(99,102,241,0.3)' },
          { id:'hub', icon:'🚀', title:'NASA Hub',    sub:'APOD · Sun · Asteroids · Earth', color:'#f59e0b', glow:'rgba(245,158,11,0.3)' },
        ].map(f=>(
          <button key={f.id} onClick={()=>setView(f.id)}
            style={{
              padding:'10px 10px', borderRadius:16, border:`2px solid ${view===f.id?f.color+'80':'rgba(255,255,255,0.08)'}`,
              background:view===f.id?`linear-gradient(135deg,${f.color}28,${f.color}10)`:'rgba(255,255,255,0.07)',
              boxShadow:view===f.id?`0 0 0 1px ${f.color}28, 0 10px 28px ${f.glow}`:'0 6px 18px rgba(0,0,0,0.18)',
              cursor:'pointer', textAlign:'left', transition:'all 0.25s',
              transform:view===f.id?'scale(1.02)':'scale(1)',
            }}
            onMouseEnter={e=>{if(view!==f.id)e.currentTarget.style.background='rgba(255,255,255,0.1)'}}
            onMouseLeave={e=>{if(view!==f.id)e.currentTarget.style.background='rgba(255,255,255,0.07)'}}>
            <span style={{fontSize:20,display:'block',marginBottom:5,filter:view===f.id?`drop-shadow(0 0 12px ${f.color}90)`:'none'}}>{f.icon}</span>
            <p style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:12,color:view===f.id?'#ffffff':'rgba(255,255,255,0.9)',margin:'0 0 2px',letterSpacing:'0.2px'}}>{f.title}</p>
            <p style={{fontSize:9,color:'rgba(255,255,255,0.9)',margin:0,lineHeight:1.4,fontWeight:600}}>{f.sub}</p>
          </button>
        ))}
      </div>

      {view==='iss'&&<ISSTracker issData={issData} issLocation={issLocation}/>}
      {view==='hub'&&<NASAHub/>}

    </div>
    </>
  )
}



