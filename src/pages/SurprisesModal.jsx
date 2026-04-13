import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { db } from '../firebase'
import { doc, getDoc, setDoc, arrayUnion, serverTimestamp } from 'firebase/firestore'
import { useLanguage } from '../context/LanguageContext'

/* ═══════════════════════════════════════════════════════════════
   ACR MAX — Surprises!! 🎁  (Multilingual via LanguageContext)
   Coins are virtual tokens with no monetary value
═══════════════════════════════════════════════════════════════ */

const MAX_FACTS  = 15
const REWARDS    = [10, 20, 30, 50]
const TODAY      = () => new Date().toISOString().slice(0, 10)

const CAT = {
  science:'🔬', space:'🚀', food:'🍎', india:'🇮🇳', ocean:'🌊',
  mars:'🪐', universe:'✨', forest:'🌿', history:'📜', moon:'🌙',
  sun:'☀️', 'indian-states':'🏛', 'world-history':'🗺', rivers:'🏞', fruits:'🍓',
}

const IMG_POOL = {
  india:'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=600&q=80',
  science:'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=600&q=80',
  space:'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=600&q=80',
  ocean:'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=80',
  forest:'https://images.unsplash.com/photo-1448375240586-882707db888b?w=600&q=80',
  mars:'https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=600&q=80',
  moon:'https://images.unsplash.com/photo-1505506874110-6a7a69069a08?w=600&q=80',
  sun:'https://images.unsplash.com/photo-1490730141103-6cac27aaab94?w=600&q=80',
  food:'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80',
  fruits:'https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?w=600&q=80',
  history:'https://images.unsplash.com/photo-1461360370896-922624d12aa1?w=600&q=80',
  'world-history':'https://images.unsplash.com/photo-1461360370896-922624d12aa1?w=600&q=80',
  'indian-states':'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=600&q=80',
  rivers:'https://images.unsplash.com/photo-1504701954957-2010ec3bcec1?w=600&q=80',
  universe:'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=600&q=80',
}
const getImg = (fact) => IMG_POOL[fact.category||fact.cat] || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80'

const FACTS_POOL = [
  {id:'in1',category:'india',text:{en:"India has the world's largest postal network — over 155,000 post offices.",ta:"இந்தியாவில் உலகின் மிகப் பெரிய தபால் நெட்வொர்க் — 155,000+ தபால் நிலையங்கள்.",hi:"भारत में दुनिया का सबसे बड़ा डाक नेटवर्क — 1,55,000+ डाकघर।",ml:"ഇന്ത്യയിൽ ലോകത്തിലെ ഏറ്റവും വലിയ തപാൽ ശൃംഖല — 1,55,000+ ഓഫീസുകൾ."}},
  {id:'in2',category:'india',text:{en:"Chess was invented in India during the Gupta Empire around the 6th century AD.",ta:"சதுரங்கம் இந்தியாவில் குப்த பேரரசின் காலத்தில் கண்டுபிடிக்கப்பட்டது.",hi:"शतरंज का आविष्कार भारत में गुप्त साम्राज्य के दौरान हुआ था।",ml:"ഗുപ്ത സാമ്രാജ്യ കാലത്ത് ഇന്ത്യയിൽ ചെസ്സ് കണ്ടുപിടിക്കപ്പെട്ടു."}},
  {id:'in3',category:'india',text:{en:"India invented the number zero — Brahmagupta formalized it around 628 AD.",ta:"இந்தியா பூஜ்ஜியத்தை கண்டுபிடித்தது — பிரம்மகுப்தர் 628 இல் முறைப்படுத்தினார்.",hi:"भारत ने शून्य की खोज की — ब्रह्मगुप्त ने 628 ई. में इसे औपचारिक रूप दिया।",ml:"ഇന്ത്യ പൂജ്യം കണ്ടുപിടിച്ചു — ബ്രഹ്മഗുപ്തൻ 628 AD-ൽ ഔദ്യോഗികമാക്കി."}},
  {id:'in4',category:'india',text:{en:"The Kumbh Mela can be seen from space — 50 million gathered in one day in 2019.",ta:"கும்ப மேளா விண்வெளியிலிருந்து காணலாம் — 2019ல் ஒரே நாளில் 5 கோடி பேர்.",hi:"कुंभ मेला अंतरिक्ष से दिखता है — 2019 में एक दिन 5 करोड़ लोग।",ml:"കുംഭ മേള ബഹിരാകാശത്ത് നിന്ന് കാണാം — 2019-ൽ ഒരു ദിവസം 5 കോടി."}},
  {id:'in5',category:'india',text:{en:"Shampoo was invented in India — from the Hindi 'champo', meaning to massage.",ta:"ஷாம்பூ இந்தியாவில் கண்டுபிடிக்கப்பட்டது — இந்தி சம்போ என்றால் மசாஜ்.",hi:"शैम्पू का आविष्कार भारत में हुआ — हिंदी 'चंपो' से आया।",ml:"ഷാംപൂ ഇന്ത്യയിൽ കണ്ടുപിടിക്കപ്പെട്ടു — ഹിന്ദി ചമ്പോ അർഥം മസ്സാജ്."}},
  {id:'sc1',category:'science',text:{en:"Honey never spoils — 3,000-year-old honey found in Egyptian tombs was still edible.",ta:"தேன் ஒருபோதும் கெடாது — எகிப்திய சமாதிகளில் 3,000 ஆண்டு பழமையான தேன் சாப்பிடக்கூடியதாக இருந்தது.",hi:"शहद कभी खराब नहीं होता — मिस्र की कब्रों में 3,000 साल पुराना शहद मिला।",ml:"തേൻ ഒരിക്കലും കേടാകില്ല — ഈജിപ്ഷ്യൻ ശവകുടീരങ്ങളിൽ 3,000 വർഷം പഴക്കമുള്ള തേൻ ഭക്ഷ്യയോഗ്യം."}},
  {id:'sc2',category:'science',text:{en:"A single lightning bolt is 5x hotter than the Sun's surface — reaching 30,000 Kelvin.",ta:"ஒரு மின்னல் சூரியனை விட 5 மடங்கு வெப்பமானது — 30,000 கெல்வின்.",hi:"बिजली सूरज की सतह से 5 गुना गर्म होती है — 30,000 केल्विन।",ml:"ഒരു മിന്നൽ സൂര്യന്റെ ഉപരിതലത്തേക്കാൾ 5 മടങ്ങ് ചൂടുണ്ട്."}},
  {id:'sc3',category:'science',text:{en:"Octopuses have 3 hearts and blue blood — two hearts pump blood through the gills.",ta:"ஆக்டோபஸ்களுக்கு 3 இதயங்களும் நீல இரத்தமும் உள்ளன.",hi:"ऑक्टोपस के 3 दिल और नीला खून होता है।",ml:"ഒക്ടോപ്പസിന് 3 ഹൃദയങ്ങളും നീല രക്തവുമുണ്ട്."}},
  {id:'sc4',category:'science',text:{en:"Sharks are older than trees — they evolved 450M years ago; trees appeared 360M years ago.",ta:"சுறாக்கள் மரங்களை விட பழமையானவை — 45 கோடி ஆண்டுகள் முன்பு வந்தவை.",hi:"शार्क पेड़ों से पुरानी हैं — 45 करोड़ साल पहले विकसित हुई।",ml:"സ്രാവ് മരങ്ങളേക്കാൾ പഴക്കമുള്ളതാണ് — 45 കോടി വർഷം മുൻപ്."}},
  {id:'sc5',category:'science',text:{en:"The human nose can detect over 1 trillion different scents.",ta:"மனித மூக்கு 1 டிரில்லியனுக்கும் அதிகமான வாசனைகளை கண்டறியலாம்.",hi:"मानव नाक 1 ट्रिलियन से अधिक गंध पहचान सकती है।",ml:"മനുഷ്യ മൂക്കിന് 1 ട്രില്ല്യണിലധികം ഗന്ധങ്ങൾ കണ്ടെത്താൻ കഴിയും."}},
  {id:'sp1',category:'space',text:{en:"One day on Venus is longer than one year on Venus — it rotates every 243 Earth days.",ta:"வீனஸில் ஒரு நாள் ஒரு வருடத்தை விட நீளமானது.",hi:"शुक्र पर एक दिन एक साल से भी लंबा होता है।",ml:"ശുക്രനിൽ ഒരു ദിവസം ഒരു വർഷത്തേക്കാൾ നീളുന്നു."}},
  {id:'sp2',category:'space',text:{en:"Apollo footprints on the Moon will last 100 million years — there's no wind to erase them.",ta:"சந்திரனில் அப்பல்லோ கால்தடங்கள் 10 கோடி ஆண்டுகள் நீடிக்கும்.",hi:"चंद्रमा पर अपोलो के पदचिह्न 10 करोड़ साल तक रहेंगे।",ml:"ചന്ദ്രനിൽ അപ്പോളോ കാൽപ്പാടുകൾ 10 കോടി വർഷം നിലനിൽക്കും."}},
  {id:'sp3',category:'space',text:{en:"Saturn's density is so low it would float on water — the only planet in our solar system that would.",ta:"சனி நீரில் மிதக்கும் — சூரிய குடும்பத்தில் அப்படி செய்யும் ஒரே கிரகம்.",hi:"शनि पानी पर तैरेगा — सौरमंडल का एकमात्र ऐसा ग्रह।",ml:"ശനി വെള്ളത്തിൽ പൊങ്ങും — സൗരയൂഥത്തിൽ ഒരേ ഒരു ഗ്രഹം."}},
  {id:'oc1',category:'ocean',text:{en:"We have mapped only 20% of the ocean floor — more of the Moon is mapped than Earth's seafloor.",ta:"கடல் தளத்தில் 20% மட்டுமே வரைபடம் உள்ளது.",hi:"हमने केवल 20% समुद्र तल का मानचित्र बनाया है।",ml:"നാം കടൽ അടിത്തട്ടിന്റെ 20% മാത്രം ഭൂപടം ഉണ്ടാക്കി."}},
  {id:'oc2',category:'ocean',text:{en:"The ocean produces over 50% of Earth's oxygen — mostly from phytoplankton, not forests.",ta:"கடல் பூமியின் 50%+ ஆக்சிஜனை உற்பத்தி செய்கிறது.",hi:"महासागर पृथ्वी की 50%+ ऑक्सीजन बनाता है।",ml:"കടൽ ഭൂമിയുടെ 50%-ൽ അധികം ഓക്സിജൻ ഉൽപ്പാദിപ്പിക്കുന്നു."}},
  {id:'ma1',category:'mars',text:{en:"A day on Mars is 24 hours, 39 minutes — almost the same as Earth's day.",ta:"செவ்வாயில் ஒரு நாள் 24 மணி 39 நிமிடம்.",hi:"मंगल पर एक दिन 24 घंटे 39 मिनट का होता है।",ml:"ചൊവ്വയിൽ ഒരു ദിവസം 24 മണിക്കൂർ 39 മിനിറ്റ്."}},
  {id:'mo1',category:'moon',text:{en:"The Moon is moving away from Earth at 3.8 cm per year.",ta:"சந்திரன் ஆண்டுக்கு 3.8 செமீ விலகிச் செல்கிறது.",hi:"चंद्रमा हर साल 3.8 सेमी दूर हो रहा है।",ml:"ചന്ദ്രൻ പ്രതിവർഷം 3.8 cm ഭൂമിയിൽ നിന്ന് അകലുന്നു."}},
  {id:'su1',category:'sun',text:{en:"Light from the Sun takes 8 minutes 20 seconds to reach Earth.",ta:"சூரியனிலிருந்து வெளிச்சம் பூமியை 8 நிமிடம் 20 விநாடியில் அடைகிறது.",hi:"सूरज की रोशनी पृथ्वी तक 8 मिनट 20 सेकंड में पहुंचती है।",ml:"സൂര്യനിൽ നിന്ന് പ്രകാശം ഭൂമിയിൽ എത്താൻ 8 മിനിറ്റ് 20 സെക്കൻഡ്."}},
  {id:'fo1',category:'food',text:{en:"Chocolate was once currency — Aztecs used cacao beans to buy goods and pay taxes.",ta:"சாக்லேட் ஒருகாலத்தில் நாணயமாக இருந்தது.",hi:"चॉकलेट कभी मुद्रा था — एज़्टेक इससे सामान खरीदते थे।",ml:"ചോക്ലേറ്റ് ഒരുകാലത്ത് കറൻസിയായിരുന്നു."}},
  {id:'fl1',category:'forest',text:{en:"Trees communicate through underground fungal networks — the 'Wood Wide Web'.",ta:"மரங்கள் நிலத்தடி பூஞ்சை நெட்வொர்க்கில் தொடர்பு கொள்கின்றன.",hi:"पेड़ भूमिगत फफूंद नेटवर्क से संवाद करते हैं।",ml:"മരങ്ങൾ ഭൂഗർഭ ഫംഗൽ ശൃംഖലകൾ വഴി ആശയവിനിമയം നടത്തുന്നു."}},
]

/* ── Firestore helpers ── */
const getUD = async (userId) => {
  try { const s=await getDoc(doc(db,'userDailyFacts',userId)); return s.exists()?s.data():{} } catch { return {} }
}
const recFact = async (userId, factId, count) => {
  try { await setDoc(doc(db,'userDailyFacts',userId),{seenFacts:arrayUnion(factId),factsUsage:{date:TODAY(),count},updatedAt:serverTimestamp()},{merge:true}) } catch {}
}
const saveScratch = async (userId, r) => {
  try { await setDoc(doc(db,'userDailyFacts',userId),{scratchReward:r,scratchClaimed:false},{merge:true}) } catch {}
}
const claimScratch = async (userId, r) => {
  try {
    const ref=doc(db,'ipl_wallets',userId); const s=await getDoc(ref)
    const cur=s.exists()?(s.data().coins||500):500
    await setDoc(ref,{coins:cur+r},{merge:true})
    await setDoc(doc(db,'userDailyFacts',userId),{scratchClaimed:true},{merge:true})
  } catch {}
}

const buildQueue = (seenFacts, userId) => {
  const seen=new Set(seenFacts)
  let pool=FACTS_POOL.filter(f=>!seen.has(f.id))
  if(pool.length<MAX_FACTS) pool=[...FACTS_POOL]
  const seed=(TODAY().replace(/-/g,'')+userId).split('').reduce((a,c)=>a+c.charCodeAt(0),0)
  let s=seed; const arr=[...pool]
  for(let i=arr.length-1;i>0;i--){s=(s*1664525+1013904223)&0xffffffff;const j=Math.abs(s)%(i+1);[arr[i],arr[j]]=[arr[j],arr[i]]}
  return arr.slice(0,MAX_FACTS)
}
const preload = (url) => { try { new Image().src=url } catch {} }

/* ═══════════════════════════════════════════
   INLINE SCRATCH CARD
═══════════════════════════════════════════ */
function ScratchCard({ reward, onScratched, scratched }) {
  const { t } = useLanguage()
  const canvasRef=useRef(null), drawing=useRef(false)
  const [pct,setPct]=useState(0)
  const W=300,H=230,THRESH=55

  useEffect(()=>{
    if(scratched) return
    const c=canvasRef.current; if(!c) return
    const ctx=c.getContext('2d')
    const g=ctx.createLinearGradient(0,0,W,H)
    g.addColorStop(0,'#6a6a6a');g.addColorStop(0.18,'#C0C0C0')
    g.addColorStop(0.35,'#d4af37');g.addColorStop(0.5,'#f4d03f')
    g.addColorStop(0.65,'#d4af37');g.addColorStop(0.82,'#C0C0C0');g.addColorStop(1,'#a87520')
    ctx.fillStyle=g;ctx.fillRect(0,0,W,H)
    for(let i=0;i<10;i++){ctx.save();ctx.globalAlpha=0.07;ctx.fillStyle='#fff';ctx.beginPath();const x=(W*i)/10;ctx.moveTo(x,0);ctx.lineTo(x+18,0);ctx.lineTo(x+28,H);ctx.lineTo(x+10,H);ctx.fill();ctx.restore()}
    ctx.globalAlpha=0.25;ctx.fillStyle='#3a2800';ctx.font='bold 12px Poppins,sans-serif';ctx.textAlign='center'
    for(let r=0;r<5;r++)for(let c=0;c<5;c++)ctx.fillText('✦',30+c*58,30+r*44)
    ctx.globalAlpha=0.6;ctx.font='bold 14px Poppins,sans-serif';ctx.fillText('✦ SCRATCH HERE ✦',W/2,H/2+6);ctx.globalAlpha=1
  },[scratched])

  const scratchAt=(cx,cy)=>{
    if(scratched) return
    const c=canvasRef.current; if(!c) return
    const ctx=c.getContext('2d'); const r=c.getBoundingClientRect()
    const x=(cx-r.left)*(c.width/r.width),y=(cy-r.top)*(c.height/r.height)
    ctx.globalCompositeOperation='destination-out';ctx.beginPath();ctx.arc(x,y,30,0,Math.PI*2);ctx.fill()
    const d=ctx.getImageData(0,0,c.width,c.height).data
    let tp=0;for(let i=3;i<d.length;i+=16)if(d[i]<128)tp++
    const p=Math.min(Math.round((tp/(c.width*c.height/4))*100),100);setPct(p)
    if(p>=THRESH&&!scratched)onScratched()
  }

  return (
    <div style={{width:'100%',maxWidth:300,margin:'0 auto',position:'relative'}}>
      <div style={{position:scratched?'relative':'absolute',inset:0,borderRadius:20,overflow:'hidden',
        background:'linear-gradient(135deg,#0d0b1e,#1a1a2e)',display:'flex',flexDirection:'column',
        alignItems:'center',justifyContent:'center',gap:10,height:scratched?230:'auto',
        border:'1px solid rgba(212,175,55,0.3)',boxShadow:'0 0 40px rgba(212,175,55,0.1)'}}>
        <div style={{position:'absolute',inset:0,borderRadius:20,border:'1.5px solid rgba(212,175,55,0.35)'}}/>
        <img src="/logo.jpg" alt="ACR MAX" style={{width:54,height:54,borderRadius:'50%',border:'2px solid rgba(212,175,55,0.55)',boxShadow:'0 0 24px rgba(212,175,55,0.45)',objectFit:'cover'}}/>
        <p style={{fontFamily:'Syne,sans-serif',fontWeight:900,fontSize:22,letterSpacing:'0.1em',margin:'2px 0 0',
          background:'linear-gradient(135deg,#8a8a8a,#C0C0C0,#d4af37,#f4d03f,#c9922a)',
          WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>ACR MAX</p>
        <p style={{fontSize:9,color:'rgba(212,175,55,0.55)',fontFamily:'Poppins,sans-serif',letterSpacing:'0.18em',textTransform:'uppercase',margin:0}}>Maximising Lifes</p>
        <div style={{padding:'10px 28px',marginTop:4,background:'linear-gradient(135deg,rgba(212,175,55,0.14),rgba(212,175,55,0.07))',border:'1px solid rgba(212,175,55,0.4)',borderRadius:14,boxShadow:'0 0 28px rgba(212,175,55,0.2)'}}>
          <p style={{fontFamily:'Syne,sans-serif',fontWeight:900,fontSize:32,color:'#f4d03f',margin:0,textShadow:'0 0 20px rgba(244,208,63,0.7)'}}>{reward} {t.coins||'coins'} 💰</p>
        </div>
        <p style={{fontSize:10,color:'rgba(255,255,255,0.18)',fontFamily:'cursive',margin:'4px 0 0',fontStyle:'italic'}}>— Aswin CR</p>
      </div>
      {!scratched&&(
        <>
          <canvas ref={canvasRef} width={W} height={H}
            style={{position:'relative',zIndex:1,width:'100%',height:H,borderRadius:20,cursor:'crosshair',touchAction:'none',display:'block',boxShadow:'0 8px 32px rgba(0,0,0,0.4)'}}
            onMouseDown={()=>drawing.current=true} onMouseUp={()=>drawing.current=false}
            onMouseMove={e=>{if(drawing.current)scratchAt(e.clientX,e.clientY)}}
            onTouchMove={e=>{e.preventDefault();const t=e.touches[0];scratchAt(t.clientX,t.clientY)}}
            onTouchStart={()=>{}} onTouchEnd={()=>{}}/>
          <p style={{textAlign:'center',fontSize:10,color:'rgba(255,255,255,0.35)',fontFamily:'Poppins,sans-serif',marginTop:8}}>
            {t.scratchReveal||'Scratch to reveal'} · {pct}%
          </p>
        </>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════
   SWIPE CARD
═══════════════════════════════════════════ */
function SwipeCard({ fact, index, total, onSwipe, language }) {
  const { t } = useLanguage()
  const [dragX,setDragX]=useState(0),[dragging,setDragging]=useState(false)
  const [exiting,setExiting]=useState(null),[imgLoaded,setImgLoaded]=useState(false),[imgErr,setImgErr]=useState(false)
  const startX=useRef(null),startY=useRef(null)
  const imgSrc=imgErr?'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80':getImg(fact)

  const fire=(dir)=>{setExiting(dir);setTimeout(()=>{setExiting(null);setDragX(0);onSwipe(dir)},340)}
  const onTS=(e)=>{startX.current=e.touches[0].clientX;startY.current=e.touches[0].clientY;setDragging(true)}
  const onTM=(e)=>{if(!dragging)return;const dx=e.touches[0].clientX-startX.current,dy=Math.abs(e.touches[0].clientY-startY.current);if(dy>40){setDragging(false);setDragX(0);return}setDragX(dx)}
  const onTE=()=>{setDragging(false);Math.abs(dragX)>75?fire(dragX>0?'right':'left'):setDragX(0)}
  const onMD=(e)=>{startX.current=e.clientX;setDragging(true)}
  const onMM=(e)=>{if(!dragging||!startX.current)return;setDragX(e.clientX-startX.current)}
  const onMU=()=>{setDragging(false);Math.abs(dragX)>75?fire(dragX>0?'right':'left'):setDragX(0);startX.current=null}

  const tx=exiting==='left'?-380:exiting==='right'?380:dragX
  const rot=exiting?dragX*0.12:dragX*0.07,op=exiting?0:1

  const factText=useMemo(()=>{
    if(fact.text&&typeof fact.text==='object')return fact.text[language]||fact.text.en||''
    return fact.text||''
  },[fact,language])

  return (
    <div onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE}
      onMouseDown={onMD} onMouseMove={onMM} onMouseUp={onMU} onMouseLeave={onMU}
      style={{position:'absolute',inset:0,borderRadius:24,overflow:'hidden',cursor:dragging?'grabbing':'grab',
        userSelect:'none',WebkitUserSelect:'none',
        transform:`translateX(${tx}px) rotate(${rot}deg)`,opacity:op,
        transition:dragging?'none':'transform 0.32s cubic-bezier(.34,1.1,.64,1), opacity 0.28s ease',
        boxShadow:`0 ${12+Math.abs(dragX)*0.04}px ${36+Math.abs(dragX)*0.08}px rgba(0,0,0,0.25)`}}>
      <div style={{position:'absolute',inset:0,background:'#0d0b1e'}}>
        {!imgLoaded&&<div style={{position:'absolute',inset:0,background:'linear-gradient(90deg,#1a1a2e 25%,#16213e 50%,#1a1a2e 75%)',backgroundSize:'200% 100%',animation:'shimLoad 1.4s ease infinite'}}/>}
        <img src={imgSrc} alt="" loading="lazy" draggable={false}
          onLoad={()=>setImgLoaded(true)} onError={()=>{setImgErr(true);setImgLoaded(true)}}
          style={{width:'100%',height:'100%',objectFit:'cover',opacity:imgLoaded?1:0,transition:'opacity 0.4s',pointerEvents:'none'}}/>
        <div style={{position:'absolute',inset:0,background:'linear-gradient(to bottom,rgba(0,0,0,0.1) 0%,rgba(0,0,0,0.3) 35%,rgba(0,0,0,0.88) 100%)'}}/>
      </div>
      <div style={{position:'absolute',top:16,left:16,right:16,display:'flex',justifyContent:'space-between',zIndex:2}}>
        <div style={{display:'flex',alignItems:'center',gap:6,padding:'5px 12px',background:'rgba(255,255,255,0.16)',borderRadius:20,backdropFilter:'blur(10px)',border:'1px solid rgba(255,255,255,0.22)'}}>
          <span style={{fontSize:13}}>{CAT[fact.category||fact.cat]||'✨'}</span>
          <span style={{fontSize:10,fontWeight:800,color:'#fff',textTransform:'uppercase',letterSpacing:'0.1em',fontFamily:'Poppins,sans-serif'}}>{fact.category||fact.cat}</span>
        </div>
        <div style={{padding:'4px 11px',background:'rgba(0,0,0,0.5)',borderRadius:20}}>
          <span style={{fontSize:11,fontWeight:700,color:'#fff',fontFamily:'Poppins,sans-serif'}}>{index+1}<span style={{opacity:0.5}}>/{total}</span></span>
        </div>
      </div>
      {dragX>40&&<div style={{position:'absolute',top:'50%',left:20,transform:'translateY(-50%)',padding:'8px 16px',background:'rgba(34,197,94,0.85)',borderRadius:12,border:'2px solid #22c55e',zIndex:3,opacity:Math.min((dragX-40)/60,1)}}><span style={{fontSize:14,fontWeight:900,color:'#fff',fontFamily:'Poppins,sans-serif'}}>❤️ {t.like||'LIKE'}</span></div>}
      {dragX<-40&&<div style={{position:'absolute',top:'50%',right:20,transform:'translateY(-50%)',padding:'8px 16px',background:'rgba(239,68,68,0.85)',borderRadius:12,border:'2px solid #ef4444',zIndex:3,opacity:Math.min((-dragX-40)/60,1)}}><span style={{fontSize:14,fontWeight:900,color:'#fff',fontFamily:'Poppins,sans-serif'}}>{t.skip||'SKIP'} ✕</span></div>}
      <div style={{position:'absolute',bottom:0,left:0,right:0,padding:'20px 20px 24px',zIndex:2}}>
        <p style={{fontFamily:'Poppins,sans-serif',fontWeight:700,fontSize:15,color:'#fff',margin:'0 0 14px',lineHeight:1.6,textShadow:'0 1px 6px rgba(0,0,0,0.6)'}}>{factText}</p>
        {index===0&&<p style={{fontSize:11,color:'rgba(255,255,255,0.5)',textAlign:'center',fontFamily:'Poppins,sans-serif',margin:'0 0 10px'}}>{t.swipeHint||'Swipe to continue'}</p>}
        <div style={{display:'flex',gap:14,justifyContent:'center'}}>
          <button onClick={()=>fire('left')} style={{width:48,height:48,borderRadius:'50%',border:'2px solid rgba(239,68,68,0.5)',background:'rgba(239,68,68,0.15)',backdropFilter:'blur(8px)',fontSize:20,cursor:'pointer',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
          <button onClick={()=>fire('right')} style={{width:48,height:48,borderRadius:'50%',border:'2px solid rgba(34,197,94,0.5)',background:'rgba(34,197,94,0.15)',backdropFilter:'blur(8px)',fontSize:20,cursor:'pointer',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center'}}>❤️</button>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════
   MAIN MODAL
═══════════════════════════════════════════ */
export default function SurprisesModal({ isOpen, onClose, currentUser }) {
  const { language, t } = useLanguage()

  const [facts,setFacts]=useState([]),[loading,setLoading]=useState(true)
  const [cardIndex,setCardIndex]=useState(0),[done,setDone]=useState(false)
  const [showScratch,setShowScratch]=useState(false),[scratched,setScratched]=useState(false)
  const [reward,setReward]=useState(0),[dailyDone,setDailyDone]=useState(false)
  const [dailyCount,setDailyCount]=useState(0)
  const userId=currentUser?.username||'guest'

  useEffect(()=>{
    if(!isOpen) return
    setLoading(true);setCardIndex(0);setDone(false);setShowScratch(false);setScratched(false)
    const load=async()=>{
      try{
        const ud=await getUD(userId)
        const today=TODAY(),usage=ud.factsUsage||{}
        const count=usage.date===today?(usage.count||0):0
        if(count>=MAX_FACTS){
          setDailyDone(true);setDailyCount(MAX_FACTS)
          const r=ud.scratchReward||0;if(r){setReward(r);setShowScratch(!ud.scratchClaimed)}
          setScratched(!!ud.scratchClaimed);setLoading(false);return
        }
        setDailyDone(false);setDailyCount(count)
        const queue=buildQueue(ud.seenFacts||[],userId)
        const resumeIdx=Math.min(count,queue.length-1)
        setFacts(queue);setCardIndex(resumeIdx)
        if(queue[resumeIdx])preload(getImg(queue[resumeIdx]))
        if(queue[resumeIdx+1])preload(getImg(queue[resumeIdx+1]))
      }catch{setFacts(FACTS_POOL.slice(0,MAX_FACTS))}
      setLoading(false)
    }
    load()
  },[isOpen,userId])

  const handleSwipe=useCallback(async(dir)=>{
    const newCount=dailyCount+1;setDailyCount(newCount)
    if(facts[cardIndex+2])preload(getImg(facts[cardIndex+2]))
    recFact(userId,facts[cardIndex]?.id||'',newCount)
    if(newCount>=MAX_FACTS||cardIndex>=facts.length-1){
      const r=REWARDS[Math.floor(Math.random()*REWARDS.length)];setReward(r);saveScratch(userId,r)
      setDone(true);setTimeout(()=>setShowScratch(true),700)
    } else { setCardIndex(i=>i+1) }
  },[cardIndex,dailyCount,facts,userId])

  const handleScratched=useCallback(()=>{setScratched(true);claimScratch(userId,reward)},[userId,reward])
  const handleClose=()=>{setDone(false);setCardIndex(0);onClose()}

  if(!isOpen) return null

  return (
    <>
    <style>{`
      @keyframes shimLoad{0%{background-position:200% center}100%{background-position:-200% center}}
      @keyframes modalIn{from{opacity:0;transform:scale(0.9)}to{opacity:1;transform:scale(1)}}
      @keyframes slideUp2{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
      @keyframes coinPop{0%{transform:scale(0.4);opacity:0}60%{transform:scale(1.15)}100%{transform:scale(1);opacity:1}}
    `}</style>
    <div onClick={handleClose} style={{position:'fixed',inset:0,zIndex:800,background:'rgba(0,0,0,0.75)',backdropFilter:'blur(10px)'}}/>
    <div style={{position:'fixed',inset:0,zIndex:801,display:'flex',alignItems:'center',justifyContent:'center',padding:'16px',pointerEvents:'none'}}>
      <div style={{width:'100%',maxWidth:420,height:'min(700px,90vh)',background:'#0a0c14',borderRadius:28,overflow:'hidden',
        animation:'modalIn 0.35s cubic-bezier(.34,1.1,.64,1) both',pointerEvents:'all',display:'flex',flexDirection:'column',
        boxShadow:'0 32px 80px rgba(0,0,0,0.5),0 0 0 1px rgba(212,175,55,0.1)',position:'relative'}}>
        <div style={{padding:'14px 18px 12px',background:'rgba(255,255,255,0.025)',borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
          <div>
            <p style={{fontFamily:'Poppins,sans-serif',fontWeight:800,fontSize:16,color:'#fff',margin:0}}>{t.surprises||'Surprises!! 🎁'}</p>
            {!loading&&!done&&!dailyDone&&<p style={{fontSize:10,color:'rgba(255,255,255,0.3)',margin:0,fontFamily:'Poppins,sans-serif'}}>{t.factOf||'Fact'} {cardIndex+1} / {MAX_FACTS}</p>}
            {(done||dailyDone)&&<p style={{fontSize:10,color:'#F59E0B',margin:0,fontFamily:'Poppins,sans-serif'}}>{t.dailyComplete||'Daily complete'}</p>}
          </div>
          <button onClick={handleClose} style={{width:32,height:32,borderRadius:10,background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.1)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,cursor:'pointer',color:'rgba(255,255,255,0.5)',fontWeight:700}}>✕</button>
        </div>
        {!loading&&!done&&!dailyDone&&(
          <div style={{height:2,background:'rgba(255,255,255,0.05)',flexShrink:0}}>
            <div style={{height:'100%',width:`${(cardIndex/MAX_FACTS)*100}%`,background:'linear-gradient(90deg,#7c3aed,#d4af37)',transition:'width 0.4s ease'}}/>
          </div>
        )}
        <div style={{flex:1,position:'relative',overflow:'hidden'}}>
          {loading?(
            <div style={{height:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:14}}>
              <div style={{width:44,height:44,border:'3px solid rgba(255,255,255,0.08)',borderTop:'3px solid #7c3aed',borderRadius:'50%',animation:'shimLoad 0.7s linear infinite'}}/>
              <p style={{fontSize:13,color:'rgba(255,255,255,0.35)',fontFamily:'Poppins,sans-serif'}}>{t.loadingFacts||'Picking surprises…'}</p>
            </div>
          ):dailyDone&&!showScratch?(
            <div style={{height:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:28,textAlign:'center'}}>
              <p style={{fontSize:52,marginBottom:12}}>🌙</p>
              <p style={{fontFamily:'Syne,sans-serif',fontWeight:900,fontSize:22,color:'#fff',margin:'0 0 8px'}}>{t.seeYouTomorrow||'See you tomorrow!'}</p>
              <p style={{fontSize:13,color:'rgba(255,255,255,0.35)',fontFamily:'Poppins,sans-serif',lineHeight:1.6,margin:'0 0 24px'}}>{t.tomorrowMsg||"Come back tomorrow!"}</p>
              {scratched&&<div style={{padding:'12px 24px',background:'rgba(245,158,11,0.1)',border:'1px solid rgba(245,158,11,0.25)',borderRadius:14}}><p style={{fontSize:13,color:'#F59E0B',fontFamily:'Poppins,sans-serif',margin:0,fontWeight:700}}>🏆 +{reward} {t.coins||'coins'}!</p></div>}
            </div>
          ):showScratch?(
            <div style={{height:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'20px 24px',gap:14,animation:'slideUp2 0.4s ease both'}}>
              <p style={{fontFamily:'Syne,sans-serif',fontWeight:900,fontSize:20,color:'#fff',margin:0,textAlign:'center'}}>{scratched?(t.rewardDone||'Coins Added!'):(t.rewardTitle||'Your Daily Reward!')}</p>
              <p style={{fontSize:12,color:'rgba(255,255,255,0.35)',fontFamily:'Poppins,sans-serif',margin:0,textAlign:'center'}}>{scratched?`+${reward} ${t.rewardAdded||'coins added'}`:(t.scratchReveal||'Scratch to reveal')}</p>
              <ScratchCard reward={reward} onScratched={handleScratched} scratched={scratched}/>
              {scratched&&(
                <>
                  <div style={{textAlign:'center',animation:'coinPop 0.6s cubic-bezier(.34,1.56,.64,1) both'}}>
                    <p style={{fontFamily:'Syne,sans-serif',fontWeight:900,fontSize:36,color:'#F59E0B',margin:'0 0 6px',textShadow:'0 0 30px rgba(245,158,11,0.6)'}}>+{reward} 💰</p>
                    <p style={{fontSize:11,color:'rgba(255,255,255,0.25)',fontFamily:'Poppins,sans-serif',margin:0}}>{t.comeBackTomorrow||'Come back tomorrow!'}</p>
                  </div>
                  <button onClick={handleClose} style={{padding:'12px 36px',borderRadius:14,border:'none',background:'linear-gradient(135deg,#d4af37,#f4d03f)',color:'#1a1a1a',fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:14,cursor:'pointer',boxShadow:'0 6px 24px rgba(212,175,55,0.4)'}}>{t.doneBtn||'Done ✓'}</button>
                </>
              )}
            </div>
          ):!done&&facts.length>0?(
            <div style={{position:'relative',height:'100%',margin:'12px 14px'}}>
              {facts[cardIndex+2]&&<div style={{position:'absolute',inset:'8px 16px',borderRadius:22,background:'rgba(255,255,255,0.04)',transform:'translateY(8px) scale(0.93)',zIndex:0}}/>}
              {facts[cardIndex+1]&&<div style={{position:'absolute',inset:'4px 8px',borderRadius:23,background:'rgba(255,255,255,0.07)',transform:'translateY(4px) scale(0.97)',zIndex:1}}/>}
              {facts[cardIndex]&&(
                <div style={{position:'absolute',inset:0,zIndex:2}}>
                  <SwipeCard key={facts[cardIndex].id} fact={facts[cardIndex]} index={cardIndex}
                    total={MAX_FACTS} onSwipe={handleSwipe} language={language}/>
                </div>
              )}
            </div>
          ):(
            <div style={{height:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:28,textAlign:'center'}}>
              <p style={{fontSize:48,marginBottom:12}}>🎉</p>
              <p style={{fontFamily:'Syne,sans-serif',fontWeight:900,fontSize:20,color:'#fff',margin:'0 0 6px'}}>{t.amazing||'All done!'}</p>
              <p style={{fontSize:13,color:'rgba(255,255,255,0.35)',fontFamily:'Poppins,sans-serif'}}>{t.preparing||'Preparing reward…'}</p>
            </div>
          )}
        </div>
        <p style={{fontSize:8,color:'rgba(255,255,255,0.08)',textAlign:'center',padding:'6px 20px 10px',fontFamily:'Poppins,sans-serif',flexShrink:0}}>{t.legalSkill||'Coins are virtual tokens with no monetary value'}</p>
      </div>
    </div>
    </>
  )
}