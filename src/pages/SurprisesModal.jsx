import { useEffect, useState } from 'react'
import { db } from '../firebase'
import { collection, doc, getDocs, increment, updateDoc } from 'firebase/firestore'

const FREE_COUNT = 5
const UNLOCK_ONE_COST = 20
const UNLOCK_TWO_COST = 30

function getRarityTheme(rarity = '') {
  const key = String(rarity || '').toLowerCase()
  if (key === 'legendary') {
    return {
      name: 'Legendary',
      color: '#d97706',
      glow: 'rgba(217,119,6,0.38)',
      border: 'rgba(251,191,36,0.55)',
      bg: 'linear-gradient(145deg,rgba(255,251,235,0.98),rgba(254,243,199,0.92),rgba(255,255,255,0.88))',
      button: 'linear-gradient(135deg,#d97706,#f59e0b)',
    }
  }
  if (key === 'epic' || key === 'rare') {
    return {
      name: key === 'epic' ? 'Epic' : 'Rare',
      color: '#7c3aed',
      glow: 'rgba(124,58,237,0.34)',
      border: 'rgba(167,139,250,0.55)',
      bg: 'linear-gradient(145deg,rgba(250,245,255,0.98),rgba(237,233,254,0.94),rgba(255,255,255,0.9))',
      button: 'linear-gradient(135deg,#7c3aed,#2563eb)',
    }
  }
  if (key === 'uncommon') {
    return {
      name: 'Uncommon',
      color: '#059669',
      glow: 'rgba(5,150,105,0.3)',
      border: 'rgba(110,231,183,0.55)',
      bg: 'linear-gradient(145deg,rgba(240,253,244,0.98),rgba(209,250,229,0.9),rgba(255,255,255,0.9))',
      button: 'linear-gradient(135deg,#059669,#0ea5e9)',
    }
  }
  return {
    name: 'Common',
    color: '#64748b',
    glow: 'rgba(100,116,139,0.26)',
    border: 'rgba(203,213,225,0.8)',
    bg: 'linear-gradient(145deg,rgba(255,255,255,0.98),rgba(241,245,249,0.95),rgba(255,255,255,0.9))',
    button: 'linear-gradient(135deg,#7c3aed,#2563eb)',
  }
}

function shuffleCards(items) {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

export default function SurprisesModal({ isOpen, onClose, currentUser, coins = 0 }) {
  const [cards, setCards] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [visibleCount, setVisibleCount] = useState(FREE_COUNT)
  const [revealed, setRevealed] = useState({})
  const [revealing, setRevealing] = useState(false)
  const [coinBurst, setCoinBurst] = useState(null)
  const [loading, setLoading] = useState(false)
  const [unlocking, setUnlocking] = useState(false)
  const [message, setMessage] = useState('')

  const username = currentUser?.username || localStorage.getItem('acr_username') || ''
  const userId = username.toLowerCase()
  const currentCard = cards[currentIndex]
  const maxVisibleIndex = Math.max(0, Math.min(visibleCount, cards.length) - 1)
  const canUnlockMore = visibleCount < cards.length
  const theme = getRarityTheme(currentCard?.rarity)
  const isCurrentRevealed = currentCard ? !!revealed[currentCard.id] : false

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false

    async function loadCards() {
      setLoading(true)
      setMessage('')
      setCurrentIndex(0)
      setVisibleCount(FREE_COUNT)
      setRevealed({})
      setRevealing(false)
      setCoinBurst(null)

      try {
        const cardsSnap = await getDocs(collection(db, 'surprise_cards'))
        const allCards = cardsSnap.docs.map(cardDoc => ({ id: cardDoc.id, ...cardDoc.data() }))
        const activeCards = allCards.filter(card => card.isActive)
        if (!cancelled) setCards(shuffleCards(activeCards))
      } catch (error) {
        console.error('Surprise cards fetch failed:', error)
        if (!cancelled) {
          setCards([])
          setMessage('Could not load surprise cards right now.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadCards()
    return () => { cancelled = true }
  }, [isOpen])

  useEffect(() => {
    if (currentIndex > maxVisibleIndex) setCurrentIndex(maxVisibleIndex)
  }, [currentIndex, maxVisibleIndex])

  const handleClose = () => {
    setMessage('')
    setCoinBurst(null)
    setRevealing(false)
    onClose?.()
  }

  const revealCurrent = () => {
    if (!currentCard?.id || revealing || isCurrentRevealed) return

    setRevealing(true)
    setTimeout(() => {
      setRevealed(prev => ({ ...prev, [currentCard.id]: true }))
      setRevealing(false)
    }, 200)
  }

  const goNext = () => {
    setMessage('')
    setCoinBurst(null)
    setRevealing(false)
    setCurrentIndex(index => Math.min(index + 1, maxVisibleIndex))
  }

  const goPrev = () => {
    setMessage('')
    setCoinBurst(null)
    setRevealing(false)
    setCurrentIndex(index => Math.max(index - 1, 0))
  }

  const unlockMore = async (cost, count) => {
    if (unlocking || !canUnlockMore) return

    setMessage('')
    setCoinBurst(null)

    if (!userId) {
      setMessage('Please login to unlock more cards')
      return
    }

    if (coins < cost) {
      alert('Not enough coins')
      setMessage('Not enough coins')
      return
    }

    setUnlocking(true)

    try {
      await updateDoc(doc(db, 'acr_users', userId.toLowerCase()), { coins: increment(-cost) })
      setVisibleCount(prev => Math.min(prev + count, cards.length))
      setCoinBurst(`-${cost} coins`)
      setMessage(`Unlocked ${count} more card${count > 1 ? 's' : ''}`)
      setTimeout(() => setCoinBurst(null), 1200)
    } catch (error) {
      console.error('Unlock failed:', error)
      setMessage('Unlock failed. Please try again.')
    } finally {
      setUnlocking(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      <style>{`
        @keyframes modalIn{from{opacity:0;transform:scale(0.94)}to{opacity:1;transform:scale(1)}}
        @keyframes cardIn{from{opacity:0;transform:translateY(22px) scale(0.95)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes revealIn{from{opacity:0;transform:translateY(12px) scale(0.98)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulseGlow{0%,100%{box-shadow:0 0 18px rgba(124,58,237,0.32)}50%{box-shadow:0 0 34px rgba(37,99,235,0.48)}}
        @keyframes rewardShake{0%,100%{transform:translateX(0)}20%{transform:translateX(-3px)}40%{transform:translateX(3px)}60%{transform:translateX(-2px)}80%{transform:translateX(2px)}}
        @keyframes floatCoins{0%{opacity:0;transform:translate(-50%,10px) scale(0.92)}20%{opacity:1}100%{opacity:0;transform:translate(-50%,-42px) scale(1.04)}}
        .surprise-premium-card{transition:transform 0.5s ease, box-shadow 0.5s ease;}
        .surprise-premium-card:hover{transform:scale(1.05) rotate(1deg);}
        .surprise-btn{transition:transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;}
        .surprise-btn:not(:disabled):hover{transform:scale(1.04);}
        .surprise-btn:not(:disabled):active{transform:scale(0.96);}
        .reveal-pulse{animation:pulseGlow 1.6s ease-in-out infinite;}
        .reveal-shake{animation:rewardShake 0.22s ease-out;}
      `}</style>

      <div
        onClick={handleClose}
        style={{
          position:'fixed',
          inset:0,
          zIndex:800,
          background:'rgba(0,0,0,0.7)',
          backdropFilter:'blur(12px)',
          WebkitBackdropFilter:'blur(12px)',
        }}
      />

      <div style={{
        position:'fixed',
        inset:0,
        zIndex:801,
        display:'flex',
        alignItems:'center',
        justifyContent:'center',
        padding:16,
        pointerEvents:'none',
      }}>
        <div style={{
          width:'100%',
          maxWidth:450,
          height:'min(740px,90vh)',
          background:'linear-gradient(180deg,#ffffff,#f8fafc)',
          borderRadius:30,
          overflow:'hidden',
          animation:'modalIn 0.32s ease-out both',
          pointerEvents:'all',
          display:'flex',
          flexDirection:'column',
          boxShadow:'0 34px 96px rgba(0,0,0,0.36),0 0 0 1px rgba(255,255,255,0.16)',
        }}>
          <div style={{
            padding:'16px 18px 14px',
            background:'rgba(255,255,255,0.92)',
            borderBottom:'1px solid #e5e7eb',
            backdropFilter:'blur(14px)',
            display:'flex',
            alignItems:'center',
            justifyContent:'space-between',
            gap:12,
            flexShrink:0,
          }}>
            <div style={{ minWidth:0 }}>
              <p style={{ fontFamily:'Poppins,sans-serif', fontWeight:900, fontSize:17, color:'#111827', margin:0 }}>
                Surprise Cards
              </p>
              <div style={{
                display:'inline-flex',
                alignItems:'center',
                gap:6,
                marginTop:6,
                padding:'6px 12px',
                borderRadius:999,
                background:'linear-gradient(135deg,#fef3c7,#fff7ed)',
                border:'1px solid #fde68a',
                boxShadow:'0 5px 18px rgba(217,119,6,0.18)',
                color:'#b45309',
                fontFamily:'Poppins,sans-serif',
                fontSize:12,
                fontWeight:900,
              }}>
                🔥 {coins.toLocaleString('en-IN')} coins available
              </div>
            </div>
            <button onClick={handleClose} style={{
              width:34,
              height:34,
              borderRadius:10,
              border:'1px solid #e5e7eb',
              background:'#f3f4f6',
              color:'#6b7280',
              cursor:'pointer',
              fontSize:18,
              fontWeight:900,
              display:'flex',
              alignItems:'center',
              justifyContent:'center',
              flexShrink:0,
            }}>
              ×
            </button>
          </div>

          <div style={{ flex:1, overflowY:'auto', padding:18, display:'flex', flexDirection:'column', position:'relative' }}>
            {coinBurst && (
              <div style={{
                position:'absolute',
                top:22,
                left:'50%',
                zIndex:20,
                padding:'6px 12px',
                borderRadius:999,
                background:'#111827',
                color:'#fbbf24',
                fontFamily:'Poppins,sans-serif',
                fontSize:12,
                fontWeight:900,
                boxShadow:'0 8px 24px rgba(0,0,0,0.28)',
                animation:'floatCoins 1.2s ease-out both',
                pointerEvents:'none',
              }}>
                {coinBurst}
              </div>
            )}

            {loading ? (
              <div style={{ flex:1, minHeight:380, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:14 }}>
                <div style={{ width:48, height:48, border:'3px solid #e5e7eb', borderTop:'3px solid #7c3aed', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
                <p style={{ fontFamily:'Poppins,sans-serif', fontSize:13, color:'#6b7280', fontWeight:800, margin:0 }}>
                  Loading surprise cards...
                </p>
              </div>
            ) : !loading && cards.length === 0 ? (
              <div style={{ flex:1, minHeight:380, display:'flex', alignItems:'center', justifyContent:'center', textAlign:'center', padding:24 }}>
                <p style={{ fontFamily:'Poppins,sans-serif', fontSize:14, color:'#6b7280', fontWeight:800, lineHeight:1.6, margin:0 }}>
                  No surprise cards are active right now.
                </p>
              </div>
            ) : currentCard ? (
              <>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                  <p style={{ fontFamily:'Poppins,sans-serif', fontSize:11, fontWeight:800, color:'#6b7280', margin:0 }}>
                    Card {currentIndex + 1} of {Math.min(visibleCount, cards.length)} unlocked
                  </p>
                  <p style={{ fontFamily:'Poppins,sans-serif', fontSize:11, fontWeight:800, color:'#9ca3af', margin:0 }}>
                    {cards.length} total
                  </p>
                </div>

                <div
                  key={currentCard.id}
                  className="surprise-premium-card"
                  style={{
                    flex:'1 1 auto',
                    minHeight:380,
                    display:'flex',
                    flexDirection:'column',
                    justifyContent:'space-between',
                    background:theme.bg,
                    border:`1.5px solid ${theme.border}`,
                    borderRadius:28,
                    padding:24,
                    backdropFilter:'blur(18px)',
                    WebkitBackdropFilter:'blur(18px)',
                    boxShadow:`0 24px 68px rgba(0,0,0,0.14),0 0 38px ${theme.glow}`,
                    animation:'cardIn 0.5s ease-out both',
                    position:'relative',
                    overflow:'hidden',
                  }}
                >
                  <div style={{ position:'absolute', inset:0, background:`radial-gradient(circle at top right,${theme.glow},transparent 42%)`, pointerEvents:'none' }} />
                  <div style={{ position:'relative', zIndex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, marginBottom:18 }}>
                      <span style={{
                        padding:'7px 13px',
                        borderRadius:999,
                        background:`${theme.color}16`,
                        border:`1px solid ${theme.color}40`,
                        color:theme.color,
                        fontFamily:'Poppins,sans-serif',
                        fontSize:10,
                        fontWeight:900,
                        letterSpacing:'0.1em',
                        textTransform:'uppercase',
                        boxShadow:`0 4px 16px ${theme.glow}`,
                      }}>
                        {currentCard.rarity || theme.name}
                      </span>
                      <span style={{
                        color:theme.color,
                        fontFamily:'Poppins,sans-serif',
                        fontSize:11,
                        fontWeight:900,
                        textTransform:'uppercase',
                        letterSpacing:'0.1em',
                      }}>
                        {currentCard.category || 'Surprise'}
                      </span>
                    </div>

                    <p style={{
                      color:'#111827',
                      fontFamily:'Poppins,sans-serif',
                      fontSize:23,
                      fontWeight:900,
                      lineHeight:1.27,
                      margin:'0 0 20px',
                    }}>
                      {currentCard.hook || 'Surprise card'}
                    </p>
                  </div>

                  <div style={{ position:'relative', zIndex:1 }}>
                    {isCurrentRevealed ? (
                      <div style={{
                        background:'rgba(255,255,255,0.72)',
                        border:`1px solid ${theme.border}`,
                        borderRadius:20,
                        padding:16,
                        backdropFilter:'blur(14px)',
                        animation:'revealIn 0.38s ease-out both',
                        boxShadow:'inset 0 1px 0 rgba(255,255,255,0.7)',
                      }}>
                        <p style={{ fontSize:20, margin:'0 0 8px' }}>✨</p>
                        <p style={{
                          color:'#374151',
                          fontFamily:'Poppins,sans-serif',
                          fontSize:14,
                          fontWeight:750,
                          lineHeight:1.72,
                          margin:0,
                        }}>
                          {currentCard.reveal || 'No reveal available.'}
                        </p>
                      </div>
                    ) : (
                      <button
                        className={`surprise-btn reveal-pulse ${revealing ? 'reveal-shake' : ''}`}
                        onClick={revealCurrent}
                        disabled={revealing}
                        style={{
                          width:'100%',
                          padding:'15px 16px',
                          borderRadius:18,
                          border:'none',
                          background:theme.button,
                          color:'#fff',
                          cursor:revealing ? 'wait' : 'pointer',
                          fontFamily:'Poppins,sans-serif',
                          fontSize:14,
                          fontWeight:900,
                          boxShadow:`0 10px 28px ${theme.glow}`,
                          opacity:revealing ? 0.86 : 1,
                        }}
                      >
                        {revealing ? 'Opening...' : 'Tap to reveal'}
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginTop:14 }}>
                  <button
                    className="surprise-btn"
                    onClick={goPrev}
                    disabled={currentIndex === 0}
                    style={{
                      padding:'12px 14px',
                      borderRadius:14,
                      border:'1.5px solid #e5e7eb',
                      background:currentIndex === 0 ? '#f3f4f6' : '#fff',
                      color:currentIndex === 0 ? '#9ca3af' : '#374151',
                      cursor:currentIndex === 0 ? 'not-allowed' : 'pointer',
                      fontFamily:'Poppins,sans-serif',
                      fontSize:13,
                      fontWeight:900,
                    }}
                  >
                    Prev
                  </button>
                  <button
                    className="surprise-btn"
                    onClick={goNext}
                    disabled={currentIndex >= maxVisibleIndex}
                    style={{
                      padding:'12px 14px',
                      borderRadius:14,
                      border:'none',
                      background:currentIndex >= maxVisibleIndex ? '#e5e7eb' : 'linear-gradient(135deg,#111827,#374151)',
                      color:currentIndex >= maxVisibleIndex ? '#9ca3af' : '#fff',
                      cursor:currentIndex >= maxVisibleIndex ? 'not-allowed' : 'pointer',
                      fontFamily:'Poppins,sans-serif',
                      fontSize:13,
                      fontWeight:900,
                      boxShadow:currentIndex >= maxVisibleIndex ? 'none' : '0 6px 18px rgba(17,24,39,0.22)',
                    }}
                  >
                    Next
                  </button>
                </div>

                <div style={{
                  marginTop:14,
                  padding:14,
                  borderRadius:20,
                  background:'linear-gradient(145deg,#ffffff,#f1f5f9)',
                  border:'1.5px solid #e5e7eb',
                  boxShadow:'3px 3px 12px rgba(0,0,0,0.06)',
                }}>
                  <p style={{ fontFamily:'Poppins,sans-serif', fontSize:12, fontWeight:900, color:'#374151', margin:'0 0 10px' }}>
                    Unlock more cards
                  </p>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                    <button
                      className="surprise-btn"
                      onClick={() => unlockMore(UNLOCK_ONE_COST, 1)}
                      disabled={unlocking || coins < UNLOCK_ONE_COST || !canUnlockMore}
                      style={{
                        padding:'12px 10px',
                        borderRadius:14,
                        border:'1.5px solid #ddd6fe',
                        background:unlocking || coins < UNLOCK_ONE_COST || !canUnlockMore ? '#f3f4f6' : '#fff',
                        color:unlocking || coins < UNLOCK_ONE_COST || !canUnlockMore ? '#9ca3af' : '#6d28d9',
                        cursor:unlocking || coins < UNLOCK_ONE_COST || !canUnlockMore ? 'not-allowed' : 'pointer',
                        fontFamily:'Poppins,sans-serif',
                        fontSize:12,
                        fontWeight:900,
                      }}
                    >
                      Unlock 1 card · 20
                    </button>
                    <button
                      className="surprise-btn"
                      onClick={() => unlockMore(UNLOCK_TWO_COST, 2)}
                      disabled={unlocking || coins < UNLOCK_TWO_COST || !canUnlockMore}
                      style={{
                        padding:'12px 10px',
                        borderRadius:14,
                        border:'none',
                        background:unlocking || coins < UNLOCK_TWO_COST || !canUnlockMore ? '#e5e7eb' : 'linear-gradient(135deg,#7c3aed,#2563eb)',
                        color:unlocking || coins < UNLOCK_TWO_COST || !canUnlockMore ? '#9ca3af' : '#fff',
                        cursor:unlocking || coins < UNLOCK_TWO_COST || !canUnlockMore ? 'not-allowed' : 'pointer',
                        fontFamily:'Poppins,sans-serif',
                        fontSize:12,
                        fontWeight:900,
                        boxShadow:unlocking || coins < UNLOCK_TWO_COST || !canUnlockMore ? 'none' : '0 6px 20px rgba(124,58,237,0.3)',
                      }}
                    >
                      Unlock 2 cards · 30
                    </button>
                  </div>

                  {message && (
                    <p style={{
                      fontFamily:'Poppins,sans-serif',
                      fontSize:11,
                      fontWeight:800,
                      color:message.includes('Not enough') || message.includes('failed') ? '#dc2626' : '#059669',
                      margin:'10px 0 0',
                      textAlign:'center',
                    }}>
                      {message}
                    </p>
                  )}

                  {!canUnlockMore && (
                    <p style={{ fontFamily:'Poppins,sans-serif', fontSize:11, fontWeight:800, color:'#059669', margin:'10px 0 0', textAlign:'center' }}>
                      All surprise cards unlocked.
                    </p>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </>
  )
}
