import { useEffect, useMemo, useRef, useState } from 'react'
import { collection, getDocs, getDoc, doc, setDoc, updateDoc, onSnapshot, increment, serverTimestamp, arrayUnion } from 'firebase/firestore'
import { db } from '../firebase'

const FREE_COUNT = 5
const EXTRA_COUNT = 2
const EXTRA_COST = 50
const COOLDOWN_MS = 6 * 60 * 60 * 1000

const STAGES = {
  NORMAL: 'normal',
  FINAL_CHOICE: 'final_choice',
  EXTRA_TWO_ACTIVE: 'extra_two_active',
  COOLDOWN_LOCKED: 'cooldown_locked',
}

const rarityStyles = {
  common: {
    label: 'Everyday Truth',
    bg: 'linear-gradient(145deg,rgba(255,255,255,.97),rgba(248,250,252,.95))',
    text: '#0f172a',
    muted: '#64748b',
    border: 'rgba(203,213,225,.92)',
    glow: 'rgba(148,163,184,.22)',
    chipBg: 'rgba(241,245,249,.94)',
    chipText: '#475569',
    revealBg: 'linear-gradient(145deg,rgba(255,255,255,.88),rgba(248,250,252,.8))',
  },
  rare: {
    label: 'Special Insight',
    bg: 'linear-gradient(135deg,#7c3aed 0%,#9333ea 46%,#4338ca 100%)',
    text: '#ffffff',
    muted: 'rgba(255,255,255,.78)',
    border: 'rgba(221,214,254,.34)',
    glow: 'rgba(139,92,246,.5)',
    chipBg: 'rgba(255,255,255,.16)',
    chipText: '#ffffff',
    revealBg: 'linear-gradient(145deg,rgba(255,255,255,.92),rgba(245,243,255,.82))',
  },
  legendary: {
    label: 'Legendary Insight',
    bg: 'linear-gradient(145deg,#18120a 0%,#3a2508 48%,#9a5a0a 100%)',
    text: '#fff7ed',
    muted: 'rgba(255,237,213,.76)',
    border: 'rgba(253,230,138,.38)',
    glow: 'rgba(245,158,11,.5)',
    chipBg: 'rgba(255,248,220,.14)',
    chipText: '#fef3c7',
    revealBg: 'linear-gradient(145deg,rgba(255,255,255,.94),rgba(255,251,235,.9))',
  },
}

const microCopies = {
  common: [
    '💡 Simple but powerful',
    '👀 Notice this next time',
    '🧠 Subtle but important',
    '📌 Easy to miss, hard to forget',
    '✨ Everyday hidden truth',
  ],
  rare: [
    '🤯 Didn’t expect that?',
    '⚡ Rare insight unlocked',
    '🧠 Your brain just leveled up',
    '🎯 That changes perspective',
    '💥 That hits differently',
  ],
  legendary: [
    '🔥 This changes everything',
    '💎 Elite insight unlocked',
    '🚀 Mind officially blown',
    "🧠 You won't forget this",
    '👑 Top-tier insight',
  ],
}

function shuffleCards(items) {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

function getBalancedCards(items, count = FREE_COUNT) {
  const shuffled = shuffleCards(items)
  const picked = []
  const usedCategories = new Set()

  for (const card of shuffled) {
    if (!usedCategories.has(card.category)) {
      picked.push(card)
      usedCategories.add(card.category)
    }
    if (picked.length === count) break
  }

  if (picked.length < count) {
    for (const card of shuffled) {
      if (!picked.find(item => item.factId === card.factId)) {
        picked.push(card)
      }
      if (picked.length === count) break
    }
  }

  const remaining = shuffled.filter(
    card => !picked.find(item => item.factId === card.factId)
  )

  return [...picked, ...remaining]
}

function getRarityControlledCards(items, count = FREE_COUNT) {
  const commons = shuffleCards(items.filter(card => (card.rarity || 'common') === 'common'))
  const rares = shuffleCards(items.filter(card => card.rarity === 'rare'))
  const legendaries = shuffleCards(items.filter(card => card.rarity === 'legendary'))

  const picked = []

  // Prefer 3 commons first
  for (const card of commons) {
    if (picked.length < 3) picked.push(card)
  }

  // Then up to 2 rares
  for (const card of rares) {
    if (picked.length < count) picked.push(card)
  }

  // Fill remaining with commons if needed
  for (const card of commons) {
    if (!picked.find(item => item.factId === card.factId) && picked.length < count) {
      picked.push(card)
    }
  }

  // Legendary kept out of first batch unless needed
  for (const card of legendaries) {
    if (!picked.find(item => item.factId === card.factId) && picked.length < count) {
      picked.push(card)
    }
  }

  const remaining = shuffleCards(items.filter(
    card => !picked.find(item => item.factId === card.factId)
  ))

  return [...picked, ...remaining]
}



function timestampToMs(value) {
  if (!value) return 0
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (typeof value.seconds === 'number') return value.seconds * 1000
  if (typeof value === 'number') return value
  return 0
}

function formatCountdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const hours = String(Math.floor(total / 3600)).padStart(2, '0')
  const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, '0')
  const seconds = String(total % 60).padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}

function pickMicroCopy(rarity, lastCopy) {
  const key = rarityStyles[rarity] ? rarity : 'common'
  const options = microCopies[key] || microCopies.common
  const pool = options.length > 1 ? options.filter(copy => copy !== lastCopy) : options
  return pool[Math.floor(Math.random() * pool.length)]
}

export default function SurprisesModal({ isOpen, onClose, currentUser, coins = 0 }) {
  const [cards, setCards] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [visibleCount, setVisibleCount] = useState(FREE_COUNT)
  const [revealed, setRevealed] = useState({})
  const [stage, setStage] = useState(STAGES.NORMAL)
  const [loading, setLoading] = useState(false)
  const [revealing, setRevealing] = useState(false)
  const [showMicro, setShowMicro] = useState(false)
  const [microByCard, setMicroByCard] = useState({})
  const [unlocking, setUnlocking] = useState(false)
  const [message, setMessage] = useState('')
  const [showCooldownPanel, setShowCooldownPanel] = useState(false)
  const [walletCoins, setWalletCoins] = useState(Number(coins || 0))
  const [lastSurpriseUsedAt, setLastSurpriseUsedAt] = useState(null)
  const [remainingMs, setRemainingMs] = useState(0)

  const revealTimerRef = useRef(null)
  const microTimerRef = useRef(null)
  const cooldownTimerRef = useRef(null)
  const lastMicroRef = useRef('')
  const lockStartedRef = useRef(false)

  const username = currentUser?.username || localStorage.getItem('acr_username') || ''
  const userId = username
  const currentCard = cards[currentIndex]
  const currentRarity = String(currentCard?.rarity || 'common').toLowerCase()
  const rarity = rarityStyles[currentRarity] ? currentRarity : 'common'
  const theme = rarityStyles[rarity]
  const isLegendary = rarity === 'legendary'
  const unlockedCount = Math.min(visibleCount, cards.length)
  const maxVisibleIndex = Math.max(0, unlockedCount - 1)
  const isCurrentRevealed = currentCard ? !!revealed[currentCard.id] : false
  const isLastVisibleCard = currentIndex === maxVisibleIndex
  const isLocked = remainingMs > 0
  const canRedeemExtra = walletCoins >= EXTRA_COST && visibleCount < cards.length
  const showFinalChoice = stage === STAGES.FINAL_CHOICE && isCurrentRevealed && !showCooldownPanel
  const lowCoins = walletCoins < EXTRA_COST
  const currentMicro = currentCard ? microByCard[currentCard.id] : ''
  const shouldShowLockedView = isLocked && !showCooldownPanel

  const progressText = useMemo(() => {
    if (!cards.length) return '0 of 0'
    return `${currentIndex + 1} of ${unlockedCount}`
  }, [cards.length, currentIndex, unlockedCount])

  useEffect(() => {
    setWalletCoins(Number(coins || 0))
  }, [coins])

  useEffect(() => {
    if (!isOpen || !userId) return undefined

    const ref = doc(db, 'acr_users', userId.toLowerCase())
    const unsub = onSnapshot(ref, snap => {
      const data = snap.exists() ? snap.data() : {}
      setWalletCoins(Number(data.coins ?? coins ?? 0))
      setLastSurpriseUsedAt(data.lastSurpriseUsedAt || null)
    }, () => {})

    return () => unsub()
  }, [coins, isOpen, userId])

  useEffect(() => {
    const tick = () => {
      const usedAt = timestampToMs(lastSurpriseUsedAt)
      setRemainingMs(usedAt ? Math.max(0, COOLDOWN_MS - (Date.now() - usedAt)) : 0)
    }

    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [lastSurpriseUsedAt])

  useEffect(() => {
    if (!isOpen) return undefined

    let cancelled = false
    setCards([])
    setCurrentIndex(0)
    setVisibleCount(FREE_COUNT)
    setRevealed({})
    setStage(STAGES.NORMAL)
    setMessage('')
    setRevealing(false)
    setShowMicro(false)
    setMicroByCard({})
    setShowCooldownPanel(false)
    setUnlocking(false)
    lockStartedRef.current = false
    lastMicroRef.current = ''
    window.clearTimeout(revealTimerRef.current)
    window.clearTimeout(microTimerRef.current)
    window.clearTimeout(cooldownTimerRef.current)

    async function loadCards() {
      setLoading(true)
      try {
        const cardsSnap = await getDocs(collection(db, 'surprise_cards'))
        const allCards = cardsSnap.docs.map(cardDoc => ({ id: cardDoc.id, ...cardDoc.data() }))
        const activeCards = allCards.filter(card => card.isActive !== false)

        const userRef = doc(db, 'acr_users', userId.toLowerCase())
        const userSnap = await getDoc(userRef)
        const seenFacts = userSnap.exists() ? userSnap.data().seenFacts || [] : []

        const unseenCards = activeCards.filter(card => !seenFacts.includes(card.factId))

const balancedCards = getBalancedCards(unseenCards, FREE_COUNT)
const finalCards = getRarityControlledCards(balancedCards, FREE_COUNT)

if (!cancelled) {
  setCards(finalCards)
}
      } catch (error) {
        console.error('Surprise cards fetch failed:', error)
        if (!cancelled) setMessage('Could not load surprise cards right now.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadCards()
    return () => {
      cancelled = true
    }
  }, [isOpen])

  useEffect(() => {
    if (currentIndex > maxVisibleIndex) setCurrentIndex(maxVisibleIndex)
  }, [currentIndex, maxVisibleIndex])

  useEffect(() => {
    setShowMicro(false)
    window.clearTimeout(microTimerRef.current)

    if (currentCard?.id && revealed[currentCard.id]) {
      microTimerRef.current = window.setTimeout(() => setShowMicro(true), 180)
    }

    return () => window.clearTimeout(microTimerRef.current)
  }, [currentCard?.id, revealed])

  useEffect(() => () => {
    window.clearTimeout(revealTimerRef.current)
    window.clearTimeout(microTimerRef.current)
    window.clearTimeout(cooldownTimerRef.current)
  }, [])

  const closeModal = () => {
    window.clearTimeout(revealTimerRef.current)
    window.clearTimeout(microTimerRef.current)
    window.clearTimeout(cooldownTimerRef.current)
    setMessage('')
    setRevealing(false)
    onClose?.()
  }

  const startCooldownSession = async () => {
    if (!userId || lockStartedRef.current) return

    lockStartedRef.current = true
    setStage(STAGES.COOLDOWN_LOCKED)
    setShowCooldownPanel(true)
    setRemainingMs(COOLDOWN_MS)
    setMessage('')

    try {
      await updateDoc(doc(db, 'acr_users', userId.toLowerCase()), { lastSurpriseUsedAt: serverTimestamp() })
    } catch (error) {
      console.error('Surprise cooldown update failed:', error)
      lockStartedRef.current = false
      setShowCooldownPanel(false)
      setStage(STAGES.FINAL_CHOICE)
      setMessage('Could not save cooldown. Please try again.')
    }
  }

  const revealCurrent = () => {
  if (!currentCard?.id || revealing || isCurrentRevealed || isLocked) return

  setMessage('')
  setShowMicro(false)
  setRevealing(true)
  window.clearTimeout(revealTimerRef.current)
  window.clearTimeout(microTimerRef.current)
  window.clearTimeout(cooldownTimerRef.current)

  revealTimerRef.current = window.setTimeout(async () => {
    const copy = microByCard[currentCard.id] || pickMicroCopy(rarity, lastMicroRef.current)
    lastMicroRef.current = copy
    setMicroByCard(prev => ({ ...prev, [currentCard.id]: copy }))
    setRevealed(prev => ({ ...prev, [currentCard.id]: true }))

    await setDoc(
      doc(db, 'acr_users', userId.toLowerCase()),
      {
        seenFacts: arrayUnion(currentCard.factId),
        lastSeenFactAt: serverTimestamp(),
      },
      { merge: true }
    )

    setRevealing(false)
    microTimerRef.current = window.setTimeout(() => setShowMicro(true), 180)

    if (isLastVisibleCard) {
      if (stage === STAGES.EXTRA_TWO_ACTIVE) {
        cooldownTimerRef.current = window.setTimeout(startCooldownSession, 900)
      } else {
        setStage(STAGES.FINAL_CHOICE)
      }
    }
  }, 260)
}

  const moveCard = direction => {
    if (stage === STAGES.FINAL_CHOICE || revealing) return
    setMessage('')
    setShowMicro(false)
    window.clearTimeout(revealTimerRef.current)
    window.clearTimeout(microTimerRef.current)
    setCurrentIndex(index => Math.min(Math.max(index + direction, 0), maxVisibleIndex))
  }

  const redeemExtraCards = async () => {
    if (unlocking || stage !== STAGES.FINAL_CHOICE || isLocked) return

    setMessage('')

    if (!userId) {
      setMessage('Please login to unlock more cards.')
      return
    }

    if (walletCoins < EXTRA_COST) {
      setMessage('Low on coins. Earn coins to proceed.')
      return
    }

    if (visibleCount >= cards.length) {
      await startCooldownSession()
      return
    }

    setUnlocking(true)
    try {
      await updateDoc(doc(db, 'acr_users', userId.toLowerCase()), { coins: increment(-EXTRA_COST) })
      const nextVisible = Math.min(visibleCount + EXTRA_COUNT, cards.length)
      setVisibleCount(nextVisible)
      setStage(STAGES.EXTRA_TWO_ACTIVE)
      setMessage('')
      setCurrentIndex(Math.min(currentIndex + 1, nextVisible - 1))
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
        @keyframes surpriseModalIn{from{opacity:0;transform:translateY(14px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes revealIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes microIn{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes sheen{0%{transform:translateX(-130%) skewX(-18deg)}100%{transform:translateX(180%) skewX(-18deg)}}
        @keyframes burst{0%{opacity:0;transform:scale(.88)}24%{opacity:.78}100%{opacity:0;transform:scale(1.22)}}
        @keyframes flashSweep{0%{opacity:0;transform:translateX(-120%) skewX(-16deg)}22%{opacity:.55}100%{opacity:0;transform:translateX(140%) skewX(-16deg)}}
        @keyframes cardPulse{0%{transform:scale(1)}42%{transform:scale(.992)}100%{transform:scale(1)}}
        @keyframes borderFlow{0%{background-position:0% 50%}100%{background-position:200% 50%}}
        @keyframes legendaryGlow{0%,100%{opacity:.58;box-shadow:inset 0 0 0 1px rgba(254,243,199,.28),0 0 28px rgba(245,158,11,.22)}50%{opacity:.92;box-shadow:inset 0 0 0 1px rgba(254,243,199,.5),0 0 46px rgba(245,158,11,.34)}}
        @keyframes legendaryRevealBurst{0%{opacity:0;transform:scale(.9)}24%{opacity:.86}100%{opacity:0;transform:scale(1.34)}}
        @keyframes legendaryBadgeGleam{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
        .surprise-shell,.surprise-shell *{box-sizing:border-box}
        .surprise-btn{transition:transform .18s ease,box-shadow .22s ease,opacity .18s ease,filter .18s ease}
        .surprise-btn:not(:disabled):active{transform:scale(.96)}
        .surprise-btn:disabled{cursor:not-allowed}
        .surprise-reveal-btn{position:relative;overflow:hidden}
        .surprise-reveal-btn:before{content:"";position:absolute;inset:-40% auto -40% -45%;width:42%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.62),transparent);animation:sheen 2.4s ease-in-out infinite;pointer-events:none}
        .surprise-card{position:relative;overflow:hidden;animation:surpriseModalIn .32s cubic-bezier(.2,.8,.2,1) both}
        .surprise-card.is-legendary{isolation:isolate}
        .surprise-card.is-legendary:before{content:"";position:absolute;inset:1px;border-radius:inherit;background:radial-gradient(circle at 50% 0%,rgba(253,230,138,.22),transparent 42%),linear-gradient(135deg,rgba(254,243,199,.2),transparent 34%,rgba(245,158,11,.16));animation:legendaryGlow 3.2s ease-in-out infinite;pointer-events:none;z-index:0}
        .surprise-card.is-revealing{animation:cardPulse .28s ease-out both}
        .surprise-card.is-revealing:after{content:"";position:absolute;inset:0;background:radial-gradient(circle at 50% 56%,rgba(255,255,255,.42),transparent 48%);animation:burst .42s ease-out both;pointer-events:none}
        .surprise-card.is-legendary.is-revealing:after{background:radial-gradient(circle at 50% 54%,rgba(254,243,199,.68),rgba(245,158,11,.18) 36%,transparent 58%);animation:legendaryRevealBurst .56s ease-out both}
        .surprise-card.is-revealing .surprise-sweep{animation:flashSweep .48s ease-out both}
        .surprise-card.is-legendary.is-revealing .surprise-sweep{background:linear-gradient(90deg,transparent,rgba(254,243,199,.64),transparent);animation:flashSweep .62s ease-out both}
        .surprise-sweep{position:absolute;top:-20%;bottom:-20%;left:0;width:38%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.48),transparent);opacity:0;pointer-events:none}
        .surprise-legendary-badge{background:linear-gradient(135deg,rgba(255,251,235,.96),rgba(251,191,36,.9),rgba(255,251,235,.96));background-size:180% 180%;animation:legendaryBadgeGleam 3.8s ease-in-out infinite}
        .surprise-legendary-callout{animation:microIn .3s ease-out both}
        .surprise-action-panel{animation:revealIn .28s ease-out both}
        .surprise-micro-copy{animation:microIn .28s ease-out both}
        .surprise-cooldown-panel{animation:revealIn .34s ease-out both;position:relative;overflow:hidden}
        .surprise-cooldown-panel:before{content:"";position:absolute;inset:0;background:radial-gradient(circle at top right,rgba(124,58,237,.16),transparent 42%);pointer-events:none}
        @media (max-width:420px){.surprise-modal{max-height:94vh!important;border-radius:24px!important}.surprise-body{padding:10px!important}.surprise-card{padding:14px!important;border-radius:22px!important}.surprise-title{font-size:20px!important}.surprise-reveal-copy{font-size:13px!important;line-height:1.48!important}.surprise-action-grid{grid-template-columns:1fr!important}}
      `}</style>

      <div onClick={closeModal} style={{ position:'fixed', inset:0, zIndex:800, background:'radial-gradient(circle at 50% 8%,rgba(124,58,237,.24),transparent 34%),linear-gradient(135deg,rgba(2,6,23,.82),rgba(15,23,42,.72))', backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)' }} />

      <div className="surprise-shell" style={{ position:'fixed', inset:0, zIndex:801, display:'flex', alignItems:'center', justifyContent:'center', padding:10, pointerEvents:'none' }}>
        <div className="surprise-modal" style={{ width:'100%', maxWidth:430, maxHeight:'92vh', overflow:'hidden', pointerEvents:'all', borderRadius:28, background:'linear-gradient(180deg,rgba(255,255,255,.98),rgba(248,250,252,.95))', boxShadow:'0 34px 110px rgba(0,0,0,.44),0 0 0 1px rgba(255,255,255,.36),inset 0 1px 0 rgba(255,255,255,.82)', animation:'surpriseModalIn .28s cubic-bezier(.2,.8,.2,1) both', position:'relative' }}>
          <div style={{ position:'absolute', inset:'0 0 auto 0', height:3, background:'linear-gradient(90deg,#f59e0b,#7c3aed,#2563eb,#f59e0b)', backgroundSize:'200% 100%', animation:'borderFlow 4s linear infinite' }} />

          <div style={{ padding:'12px 14px 10px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, borderBottom:'1px solid rgba(226,232,240,.74)', background:'linear-gradient(135deg,rgba(255,255,255,.94),rgba(248,250,252,.78))' }}>
            <div style={{ minWidth:0 }}>
              <p style={{ fontFamily:'Poppins,sans-serif', fontWeight:900, fontSize:18, color:'#0f172a', margin:0, letterSpacing:0, lineHeight:1.05 }}>Surprises</p>
              <p style={{ fontFamily:'Poppins,sans-serif', fontSize:11, color:'#64748b', fontWeight:800, margin:'4px 0 0', lineHeight:1.2 }}>{progressText} unlocked</p>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
              <div style={{ padding:'7px 10px', borderRadius:999, background:'linear-gradient(135deg,#fff7ed,#fde68a)', border:'1px solid rgba(245,158,11,.34)', boxShadow:'0 8px 22px rgba(217,119,6,.18),inset 0 1px 0 rgba(255,255,255,.76)', color:'#78350f', fontFamily:'Poppins,sans-serif', fontSize:12, fontWeight:900, whiteSpace:'nowrap' }}>{walletCoins.toLocaleString('en-IN')} coins</div>
              <button className="surprise-btn" onClick={closeModal} style={{ width:34, height:34, borderRadius:10, border:'1px solid rgba(226,232,240,.9)', background:'linear-gradient(145deg,#ffffff,#f1f5f9)', color:'#475569', cursor:'pointer', fontSize:18, fontWeight:900, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 8px 18px rgba(15,23,42,.08)' }}>x</button>
            </div>
          </div>

          <div className="surprise-body" style={{ padding:12, overflowY:'auto', maxHeight:'calc(92vh - 58px)' }}>
            {shouldShowLockedView ? (
              <div style={{ minHeight:260, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', gap:10, padding:18 }}>
                <div style={{ width:58, height:58, borderRadius:18, display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#111827,#374151)', color:'#fff', fontSize:26, boxShadow:'0 16px 40px rgba(15,23,42,.25)' }}>S</div>
                <p style={{ fontFamily:'Poppins,sans-serif', fontSize:17, fontWeight:900, color:'#0f172a', margin:0 }}>Next limit is cooling down</p>
                <p style={{ fontFamily:'Poppins,sans-serif', fontSize:13, fontWeight:900, color:'#7c3aed', margin:0 }}>{formatCountdown(remainingMs)}</p>
              </div>
            ) : loading ? (
              <div style={{ minHeight:260, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12 }}>
                <div style={{ width:42, height:42, border:'3px solid #e5e7eb', borderTop:'3px solid #7c3aed', borderRadius:'50%', animation:'spin .8s linear infinite' }} />
                <p style={{ fontFamily:'Poppins,sans-serif', fontSize:13, color:'#64748b', fontWeight:800, margin:0 }}>Loading surprise cards...</p>
              </div>
            ) : cards.length === 0 ? (
              <div style={{ minHeight:260, display:'flex', alignItems:'center', justifyContent:'center', textAlign:'center', padding:18 }}>
                <p style={{ fontFamily:'Poppins,sans-serif', fontSize:14, color:'#64748b', fontWeight:800, lineHeight:1.55, margin:0 }}>{message || 'No surprise cards are active right now.'}</p>
              </div>
            ) : currentCard ? (
              <>
                <div className={`surprise-card ${isLegendary ? 'is-legendary' : ''} ${revealing ? 'is-revealing' : ''}`} style={{ padding:16, borderRadius:24, background:theme.bg, color:theme.text, border:`1.5px solid ${theme.border}`, boxShadow:`0 22px 60px rgba(15,23,42,.16),0 0 ${isLegendary ? 46 : 36}px ${theme.glow},inset 0 1px 0 rgba(255,255,255,.34)`, backdropFilter:'blur(18px)', WebkitBackdropFilter:'blur(18px)' }}>
                  <div className="surprise-sweep" />
                  {(rarity === 'rare' || rarity === 'legendary') && <div style={{ position:'absolute', inset:-60, background:`radial-gradient(circle at 80% 6%,${theme.glow},transparent 36%),radial-gradient(circle at 8% 92%,rgba(255,255,255,.24),transparent 32%)`, pointerEvents:'none' }} />}

                  <div style={{ position:'relative', zIndex:1, display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, marginBottom:10 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, minWidth:0, flexWrap:'wrap' }}>
                      <span style={{ padding:'6px 10px', borderRadius:999, background:theme.chipBg, border:`1px solid ${theme.border}`, color:theme.chipText, fontFamily:'Poppins,sans-serif', fontSize:10, fontWeight:900, textTransform:'uppercase', whiteSpace:'nowrap' }}>{theme.label}</span>
                      {isLegendary && (
                        <span className="surprise-legendary-badge" style={{ padding:'6px 9px', borderRadius:999, border:'1px solid rgba(253,230,138,.64)', color:'#78350f', fontFamily:'Poppins,sans-serif', fontSize:10, fontWeight:900, lineHeight:1, whiteSpace:'nowrap', boxShadow:'0 8px 22px rgba(245,158,11,.22),inset 0 1px 0 rgba(255,255,255,.72)' }}>👑 Legendary</span>
                      )}
                    </div>
                    <span style={{ color:theme.muted, fontFamily:'Poppins,sans-serif', fontSize:10, fontWeight:900, textTransform:'uppercase', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{currentCard.category || 'Surprise'}</span>
                  </div>

                  <div style={{ position:'relative', zIndex:1, textAlign:'center', display:'flex', flexDirection:'column', gap:10 }}>
                    <p className="surprise-title" style={{ color:theme.text, fontFamily:'Poppins,sans-serif', fontSize:22, fontWeight:900, lineHeight:1.2, margin:'4px 0 0', letterSpacing:0 }}>{currentCard.hook || 'A hidden surprise is waiting.'}</p>

                    {!isCurrentRevealed && (
                      <button className="surprise-btn surprise-reveal-btn" onClick={revealCurrent} disabled={revealing || stage === STAGES.COOLDOWN_LOCKED} style={{ width:'100%', minHeight:48, padding:'13px 14px', borderRadius:16, border:isLegendary ? '1px solid rgba(254,243,199,.64)' : '1px solid rgba(255,255,255,.24)', background:isLegendary ? 'linear-gradient(135deg,#78350f 0%,#d97706 48%,#fbbf24 100%)' : 'linear-gradient(135deg,#111827,#7c3aed 48%,#2563eb)', color:isLegendary ? '#fff7ed' : '#fff', cursor:revealing ? 'wait' : 'pointer', fontFamily:'Poppins,sans-serif', fontSize:14, fontWeight:900, boxShadow:isLegendary ? '0 16px 36px rgba(245,158,11,.36),0 0 0 1px rgba(255,255,255,.12) inset,inset 0 1px 0 rgba(255,255,255,.28)' : '0 15px 34px rgba(124,58,237,.4),inset 0 1px 0 rgba(255,255,255,.24)', opacity:revealing ? .9 : 1 }}>
                        {revealing ? 'Opening...' : 'Tap to reveal'}
                      </button>
                    )}

                    {isCurrentRevealed && (
                      <div style={{ animation:'revealIn .34s ease-out both', display:'flex', flexDirection:'column', gap:10 }}>
                        <div style={{ background:theme.revealBg, border:`1px solid ${theme.border}`, borderRadius:18, padding:'13px 14px', backdropFilter:'blur(14px)', boxShadow:'inset 0 1px 0 rgba(255,255,255,.82),0 12px 30px rgba(15,23,42,.12)', textAlign:'left' }}>
                          <p className="surprise-reveal-copy" style={{ color:'#1f2937', fontFamily:'Poppins,sans-serif', fontSize:14, fontWeight:800, lineHeight:1.55, margin:0 }}>{currentCard.reveal || 'No reveal available.'}</p>
                        </div>

                        {isLegendary && (
                          <div className="surprise-legendary-callout" style={{ alignSelf:'center', padding:'7px 11px', borderRadius:999, background:'linear-gradient(135deg,rgba(255,251,235,.96),rgba(254,243,199,.9))', border:'1px solid rgba(245,158,11,.34)', color:'#92400e', fontFamily:'Poppins,sans-serif', fontSize:11, fontWeight:900, lineHeight:1, boxShadow:'0 10px 24px rgba(245,158,11,.18),inset 0 1px 0 rgba(255,255,255,.86)' }}>👑 Ultra rare pull</div>
                        )}

                        {showMicro && currentMicro && (
                          <p className="surprise-micro-copy" style={{ margin:'-2px 0 0', color:rarity === 'common' ? '#7c3aed' : theme.text, fontFamily:'Poppins,sans-serif', fontSize:12, fontWeight:900, textAlign:'center', lineHeight:1.35, textShadow:rarity === 'common' ? 'none' : '0 2px 10px rgba(0,0,0,.18)' }}>{currentMicro}</p>
                        )}

                        {showFinalChoice && (
                          <div className="surprise-action-panel" style={{ padding:12, borderRadius:18, background:'linear-gradient(135deg,rgba(255,255,255,.98),rgba(250,245,255,.96) 52%,rgba(238,242,255,.94))', border:'1.5px solid rgba(124,58,237,.22)', boxShadow:'0 14px 34px rgba(124,58,237,.14),inset 0 1px 0 rgba(255,255,255,.84)', textAlign:'left' }}>
                            <p style={{ fontFamily:'Poppins,sans-serif', fontSize:13, fontWeight:900, color:'#111827', margin:'0 0 3px' }}>Current limit reached</p>
                            {lowCoins && <p style={{ fontFamily:'Poppins,sans-serif', fontSize:11, fontWeight:800, color:'#dc2626', margin:'0 0 9px', lineHeight:1.35 }}>Low on coins. Earn coins to proceed.</p>}
                            {!lowCoins && <p style={{ fontFamily:'Poppins,sans-serif', fontSize:11, fontWeight:800, color:'#64748b', margin:'0 0 9px', lineHeight:1.35 }}>Wait for the next limit or redeem 2 more cards.</p>}

                            <div className="surprise-action-grid" style={{ display:'grid', gridTemplateColumns:lowCoins ? '1fr' : '1fr 1fr', gap:8 }}>
                              {!lowCoins && (
                                <button className="surprise-btn" onClick={redeemExtraCards} disabled={unlocking || !canRedeemExtra} style={{ minHeight:46, padding:'12px 10px', borderRadius:12, border:'none', background:canRedeemExtra ? 'linear-gradient(135deg,#7c3aed,#2563eb)' : '#e5e7eb', color:canRedeemExtra ? '#fff' : '#94a3b8', cursor:canRedeemExtra ? 'pointer' : 'not-allowed', fontFamily:'Poppins,sans-serif', fontSize:12, fontWeight:900, boxShadow:canRedeemExtra ? '0 10px 26px rgba(124,58,237,.3),inset 0 1px 0 rgba(255,255,255,.22)' : 'none' }}>
                                  {unlocking ? 'Redeeming...' : `Redeem 2 for ${EXTRA_COST}`}
                                </button>
                              )}
                              <button className="surprise-btn" onClick={startCooldownSession} disabled={stage === STAGES.COOLDOWN_LOCKED} style={{ minHeight:46, padding:'12px 10px', borderRadius:12, border:'1.5px solid rgba(148,163,184,.28)', background:'linear-gradient(135deg,#ffffff,#f8fafc)', color:'#334155', cursor:'pointer', fontFamily:'Poppins,sans-serif', fontSize:12, fontWeight:900, boxShadow:'0 8px 18px rgba(15,23,42,.06)' }}>
                                Wait for next limit
                              </button>
                            </div>
                          </div>
                        )}

                        {showCooldownPanel && (
                          <div className="surprise-cooldown-panel" style={{ padding:12, borderRadius:18, background:'linear-gradient(135deg,rgba(255,255,255,.98),rgba(239,246,255,.96) 48%,rgba(250,245,255,.96))', border:'1.5px solid rgba(124,58,237,.22)', boxShadow:'0 14px 34px rgba(37,99,235,.13),inset 0 1px 0 rgba(255,255,255,.84)', textAlign:'center' }}>
                            <div style={{ position:'relative', zIndex:1 }}>
                              <p style={{ fontFamily:'Poppins,sans-serif', fontSize:10, fontWeight:900, color:'#64748b', margin:'0 0 4px', textTransform:'uppercase', letterSpacing:0 }}>Session finished</p>
                              <p style={{ fontFamily:'Poppins,sans-serif', fontSize:13, fontWeight:900, color:'#111827', margin:'0 0 5px' }}>Next limit available in</p>
                              <p style={{ fontFamily:'Poppins,sans-serif', fontSize:22, fontWeight:900, color:'#7c3aed', margin:'0 0 5px', letterSpacing:0 }}>{formatCountdown(remainingMs || COOLDOWN_MS)}</p>
                              <p style={{ fontFamily:'Poppins,sans-serif', fontSize:11, fontWeight:800, color:'#64748b', margin:0, lineHeight:1.35 }}>Come back later for more surprises 🎁</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {stage !== STAGES.FINAL_CHOICE && stage !== STAGES.COOLDOWN_LOCKED && (
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:10 }}>
                    <button className="surprise-btn" onClick={() => moveCard(-1)} disabled={currentIndex === 0 || revealing} style={{ minHeight:44, padding:'11px 12px', borderRadius:12, border:'1.5px solid #e5e7eb', background:currentIndex === 0 ? '#f3f4f6' : '#fff', color:currentIndex === 0 ? '#94a3b8' : '#334155', cursor:currentIndex === 0 ? 'not-allowed' : 'pointer', fontFamily:'Poppins,sans-serif', fontSize:13, fontWeight:900 }}>Prev</button>
                    <button className="surprise-btn" onClick={() => moveCard(1)} disabled={currentIndex >= maxVisibleIndex || revealing} style={{ minHeight:44, padding:'11px 12px', borderRadius:12, border:'none', background:currentIndex >= maxVisibleIndex ? '#e5e7eb' : 'linear-gradient(135deg,#111827,#334155)', color:currentIndex >= maxVisibleIndex ? '#94a3b8' : '#fff', cursor:currentIndex >= maxVisibleIndex ? 'not-allowed' : 'pointer', fontFamily:'Poppins,sans-serif', fontSize:13, fontWeight:900, boxShadow:currentIndex >= maxVisibleIndex ? 'none' : '0 8px 22px rgba(15,23,42,.22)' }}>Next</button>
                  </div>
                )}

                {message && !showFinalChoice && (
                  <p style={{ fontFamily:'Poppins,sans-serif', fontSize:11, fontWeight:800, color:message.includes('failed') || message.includes('Could not') || message.includes('Low') ? '#dc2626' : '#059669', margin:'9px 2px 0', textAlign:'center', lineHeight:1.35 }}>{message}</p>
                )}

                {stage === STAGES.EXTRA_TWO_ACTIVE && (
                  <p style={{ fontFamily:'Poppins,sans-serif', fontSize:10, fontWeight:800, color:'#64748b', margin:'8px 2px 0', textAlign:'center' }}>Extra cards active. Cooldown starts after the second reveal.</p>
                )}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </>
  )
}
