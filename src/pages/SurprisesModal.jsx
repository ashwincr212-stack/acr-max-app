import { useEffect, useMemo, useRef, useState } from 'react'
import { collection, getDocs, doc, updateDoc, onSnapshot, increment, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'

const FREE_COUNT = 5
const UNLOCK_TWO_COST = 30
const UNLOCK_FIVE_COST = 50
const COOLDOWN_MS = 6 * 60 * 60 * 1000

const POST_REVEAL_STAGES = {
  NONE: 'none',
  CHOOSE_MORE_OR_EXIT: 'choose_more_or_exit',
  CHOOSE_COIN_PACK: 'choose_coin_pack',
  CHOOSE_FIVE_PACK_OR_EXIT: 'choose_five_pack_or_exit',
  LOW_COINS_EXIT_ONLY: 'low_coins_exit_only',
  COOLDOWN_COMPLETE: 'cooldown_complete',
}

const rarityStyles = {
  common: {
    label: 'Everyday Truth',
    card: 'bg-white text-slate-900 border border-slate-200 shadow-xl',
    bg: 'linear-gradient(145deg,rgba(255,255,255,0.96),rgba(248,250,252,0.94))',
    text: '#0f172a',
    muted: '#64748b',
    border: 'rgba(203,213,225,0.95)',
    glow: 'rgba(148,163,184,0.24)',
    chipBg: 'rgba(241,245,249,0.9)',
    chipText: '#475569',
  },
  rare: {
    label: '🎁 Special Insight',
    card: 'bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 text-white shadow-2xl shadow-violet-500/30',
    bg: 'linear-gradient(135deg,#7c3aed 0%,#9333ea 46%,#4338ca 100%)',
    text: '#ffffff',
    muted: 'rgba(255,255,255,0.76)',
    border: 'rgba(221,214,254,0.32)',
    glow: 'rgba(139,92,246,0.5)',
    chipBg: 'rgba(255,255,255,0.16)',
    chipText: '#ffffff',
  },
  legendary: {
    label: '🔥 Legendary Insight',
    card: 'bg-gradient-to-br from-yellow-300 via-amber-400 to-orange-500 text-slate-900 shadow-2xl shadow-yellow-400/40',
    bg: 'linear-gradient(135deg,#fde047 0%,#f59e0b 48%,#f97316 100%)',
    text: '#111827',
    muted: 'rgba(17,24,39,0.72)',
    border: 'rgba(120,53,15,0.22)',
    glow: 'rgba(251,191,36,0.58)',
    chipBg: 'rgba(255,255,255,0.34)',
    chipText: '#78350f',
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
  const [revealing, setRevealing] = useState(false)
  const [showMicro, setShowMicro] = useState(false)
  const [postRevealStage, setPostRevealStage] = useState(POST_REVEAL_STAGES.NONE)
  const [showCooldownState, setShowCooldownState] = useState(true)
  const [hasUsedTwoCardPack, setHasUsedTwoCardPack] = useState(false)
  const [hasUsedFiveCardPack, setHasUsedFiveCardPack] = useState(false)
  const [microByCard, setMicroByCard] = useState({})
  const [coinBurst, setCoinBurst] = useState(null)
  const [loading, setLoading] = useState(false)
  const [unlocking, setUnlocking] = useState(false)
  const [message, setMessage] = useState('')
  const [walletCoins, setWalletCoins] = useState(Number(coins || 0))
  const [lastSurpriseUsedAt, setLastSurpriseUsedAt] = useState(null)
  const [remainingMs, setRemainingMs] = useState(0)

  const lastMicroRef = useRef('')
  const microTimerRef = useRef(null)
  const revealTimerRef = useRef(null)
  const burstTimerRef = useRef(null)
  const finalCooldownTimerRef = useRef(null)
  const lockStartedRef = useRef(false)

  const username = currentUser?.username || localStorage.getItem('acr_username') || ''
  const userId = username.toLowerCase()
  const currentCard = cards[currentIndex]
  const currentRarity = String(currentCard?.rarity || 'common').toLowerCase()
  const rarity = rarityStyles[currentRarity] ? currentRarity : 'common'
  const theme = rarityStyles[rarity]
  const unlockedCount = Math.min(visibleCount, cards.length)
  const maxVisibleIndex = Math.max(0, unlockedCount - 1)
  const isLocked = remainingMs > 0
  const shouldShowLockedState = isLocked && showCooldownState
  const isCurrentRevealed = currentCard ? !!revealed[currentCard.id] : false
  const isLastVisibleCard = currentIndex === maxVisibleIndex
  const hasMoreCardsInDatabase = visibleCount < cards.length
  const remainingCards = Math.max(0, cards.length - visibleCount)
  const canAffordTwoPack = walletCoins >= UNLOCK_TWO_COST
  const canAffordFivePack = walletCoins >= UNLOCK_FIVE_COST
  const canBuyTwoPack = !hasUsedTwoCardPack && remainingCards >= 2 && canAffordTwoPack
  const canBuyFivePack = !hasUsedFiveCardPack && remainingCards >= 5 && canAffordFivePack
  const canUnlockMore = !isLocked && hasMoreCardsInDatabase
  const currentMicro = currentCard ? microByCard[currentCard.id] : ''
  const showPostRevealActions = postRevealStage !== POST_REVEAL_STAGES.NONE
  const lowCoinMessage = walletCoins <= 0
    ? 'No coins available. Earn coins to unlock more surprises.'
    : 'Low on coins. Earn coins to proceed.'
  const displayPostRevealStage = (() => {
    if (postRevealStage === POST_REVEAL_STAGES.CHOOSE_COIN_PACK && !canBuyTwoPack && !canBuyFivePack) {
      return POST_REVEAL_STAGES.LOW_COINS_EXIT_ONLY
    }
    if (postRevealStage === POST_REVEAL_STAGES.CHOOSE_FIVE_PACK_OR_EXIT && !canBuyFivePack) {
      return POST_REVEAL_STAGES.LOW_COINS_EXIT_ONLY
    }
    return postRevealStage
  })()

  const progressText = useMemo(() => {
    if (!cards.length) return '0 of 0 unlocked'
    return `${currentIndex + 1} of ${unlockedCount} unlocked`
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

    async function loadCards() {
      setLoading(true)
      setMessage('')
      setCurrentIndex(0)
      setVisibleCount(FREE_COUNT)
      setRevealed({})
      setRevealing(false)
      setShowMicro(false)
      setPostRevealStage(POST_REVEAL_STAGES.NONE)
      setShowCooldownState(true)
      setHasUsedTwoCardPack(false)
      setHasUsedFiveCardPack(false)
      setMicroByCard({})
      setCoinBurst(null)
      lockStartedRef.current = false
      window.clearTimeout(finalCooldownTimerRef.current)

      try {
        const cardsSnap = await getDocs(collection(db, 'surprise_cards'))
        const allCards = cardsSnap.docs.map(cardDoc => ({ id: cardDoc.id, ...cardDoc.data() }))
        const activeCards = allCards.filter(card => card.isActive !== false)
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

  useEffect(() => {
    setRevealing(false)
    setShowMicro(false)
    window.clearTimeout(microTimerRef.current)
    if (currentCard && revealed[currentCard.id]) {
      microTimerRef.current = window.setTimeout(() => setShowMicro(true), 120)
    }
    return () => window.clearTimeout(microTimerRef.current)
  }, [currentCard?.id, revealed])

  useEffect(() => () => {
    window.clearTimeout(microTimerRef.current)
    window.clearTimeout(revealTimerRef.current)
    window.clearTimeout(burstTimerRef.current)
    window.clearTimeout(finalCooldownTimerRef.current)
  }, [])

  const startCooldown = async () => {
    if (!userId || lockStartedRef.current) return
    lockStartedRef.current = true
    setRemainingMs(COOLDOWN_MS)
    try {
      await updateDoc(doc(db, 'acr_users', userId.toLowerCase()), { lastSurpriseUsedAt: serverTimestamp() })
    } catch (error) {
      console.error('Surprise cooldown update failed:', error)
      lockStartedRef.current = false
      setMessage('Could not save cooldown. Please try again.')
    }
  }

  const queueFinalCooldown = () => {
    window.clearTimeout(finalCooldownTimerRef.current)
    setShowCooldownState(false)
    setPostRevealStage(POST_REVEAL_STAGES.COOLDOWN_COMPLETE)
    finalCooldownTimerRef.current = window.setTimeout(() => {
      setShowCooldownState(true)
      startCooldown()
    }, 4200)
  }

  const getNextPostRevealStage = () => {
    if (!hasMoreCardsInDatabase || hasUsedFiveCardPack) return POST_REVEAL_STAGES.COOLDOWN_COMPLETE
    if (hasUsedTwoCardPack) {
      return canBuyFivePack ? POST_REVEAL_STAGES.CHOOSE_FIVE_PACK_OR_EXIT : POST_REVEAL_STAGES.LOW_COINS_EXIT_ONLY
    }
    if (!canBuyTwoPack && !canBuyFivePack) return POST_REVEAL_STAGES.LOW_COINS_EXIT_ONLY
    return POST_REVEAL_STAGES.CHOOSE_MORE_OR_EXIT
  }

  const revealCurrent = () => {
    if (!currentCard?.id || revealing || isCurrentRevealed || shouldShowLockedState) return

    setMessage('')
    setShowMicro(false)
    setPostRevealStage(POST_REVEAL_STAGES.NONE)
    setRevealing(true)
    window.clearTimeout(revealTimerRef.current)
    window.clearTimeout(microTimerRef.current)
    window.clearTimeout(finalCooldownTimerRef.current)

    revealTimerRef.current = window.setTimeout(() => {
      const copy = microByCard[currentCard.id] || pickMicroCopy(rarity, lastMicroRef.current)
      lastMicroRef.current = copy
      setMicroByCard(prev => ({ ...prev, [currentCard.id]: copy }))
      setRevealed(prev => {
        return { ...prev, [currentCard.id]: true }
      })
      setRevealing(false)
      if (isLastVisibleCard) {
        const nextStage = getNextPostRevealStage()
        setPostRevealStage(nextStage)
        if (nextStage === POST_REVEAL_STAGES.COOLDOWN_COMPLETE) {
          queueFinalCooldown()
        }
      }
      microTimerRef.current = window.setTimeout(() => {
        setShowMicro(true)
      }, 180)
    }, 250)
  }

  const moveCard = direction => {
    setMessage('')
    setCoinBurst(null)
    setRevealing(false)
    setShowMicro(false)
    setPostRevealStage(POST_REVEAL_STAGES.NONE)
    window.clearTimeout(revealTimerRef.current)
    window.clearTimeout(microTimerRef.current)
    setCurrentIndex(index => Math.min(Math.max(index + direction, 0), maxVisibleIndex))
  }

  const chooseExitAndWait = () => {
    setMessage('')
    queueFinalCooldown()
  }

  const unlockMore = async (cost, count, packType) => {
    if (unlocking || !canUnlockMore || shouldShowLockedState) return

    setMessage('')
    setCoinBurst(null)

    if (!userId) {
      setMessage('Please login to unlock more cards')
      return
    }

    if (walletCoins < cost) {
      setMessage(walletCoins <= 0 ? 'No coins available. Earn coins to unlock more surprises.' : 'Low on coins. Earn coins to proceed.')
      return
    }

    if (cards.length - visibleCount < count) {
      setMessage('Not enough cards left')
      return
    }

    setUnlocking(true)
    try {
      await updateDoc(doc(db, 'acr_users', userId.toLowerCase()), { coins: increment(-cost) })
      const nextVisible = Math.min(visibleCount + count, cards.length)
      setVisibleCount(nextVisible)
      setPostRevealStage(POST_REVEAL_STAGES.NONE)
      setShowMicro(false)
      window.clearTimeout(finalCooldownTimerRef.current)
      setShowCooldownState(true)
      if (packType === 'two') setHasUsedTwoCardPack(true)
      if (packType === 'five') setHasUsedFiveCardPack(true)
      setCurrentIndex(Math.min(currentIndex + 1, nextVisible - 1))
      setCoinBurst(`-${cost} coins`)
      setMessage(`Unlocked ${nextVisible - visibleCount} more card${nextVisible - visibleCount === 1 ? '' : 's'}`)
      window.clearTimeout(burstTimerRef.current)
      burstTimerRef.current = window.setTimeout(() => setCoinBurst(null), 1200)
    } catch (error) {
      console.error('Unlock failed:', error)
      setMessage('Unlock failed. Please try again.')
    } finally {
      setUnlocking(false)
    }
  }

  const handleClose = () => {
    setMessage('')
    setCoinBurst(null)
    setRevealing(false)
    setShowMicro(false)
    setPostRevealStage(POST_REVEAL_STAGES.NONE)
    window.clearTimeout(finalCooldownTimerRef.current)
    onClose?.()
  }

  if (!isOpen) return null

  return (
    <>
      <style>{`
        @keyframes surpriseModalIn{from{opacity:0;transform:translateY(18px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes surpriseCardIn{from{opacity:0;transform:translateY(18px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes revealIn{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes microIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes rareGlow{0%,100%{opacity:.5;transform:scale(1) rotate(0)}50%{opacity:.95;transform:scale(1.06) rotate(1deg)}}
        @keyframes rewardShake{0%,100%{transform:translateX(0) scale(1)}18%{transform:translateX(-4px) scale(1.012)}42%{transform:translateX(4px) scale(1.018)}70%{transform:translateX(-2px) scale(1.01)}}
        @keyframes floatCoins{0%{opacity:0;transform:translateY(12px) scale(.92)}18%{opacity:1}100%{opacity:0;transform:translateY(-46px) scale(1.04)}}
        @keyframes cardBreath{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}
        @keyframes sheen{0%{transform:translateX(-130%) skewX(-18deg)}100%{transform:translateX(180%) skewX(-18deg)}}
        @keyframes sparklePop{0%{opacity:0;transform:translateY(8px) scale(.75)}25%{opacity:.95}100%{opacity:0;transform:translateY(-28px) scale(1.18)}}
        @keyframes borderFlow{0%{background-position:0% 50%}100%{background-position:200% 50%}}
        .surprise-btn{transition:transform .2s ease, box-shadow .25s ease, opacity .2s ease, background .25s ease;}
        .surprise-btn:not(:disabled):hover{transform:translateY(-1px) scale(1.02);}
        .surprise-btn:not(:disabled):active{transform:scale(.96);}
        .surprise-premium-card{transition:transform .45s ease, box-shadow .45s ease, opacity .35s ease;}
        .surprise-premium-card:hover{transform:translateY(-3px) scale(1.01);}
        .surprise-shake{animation:rewardShake .28s ease-out both;}
        .surprise-breath{animation:surpriseCardIn .48s cubic-bezier(.2,.8,.2,1) both, cardBreath 4.8s ease-in-out .7s infinite;}
        .surprise-reveal-btn{position:relative;overflow:hidden;}
        .surprise-reveal-btn:before{content:"";position:absolute;inset:-35% auto -35% -45%;width:42%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.62),transparent);animation:sheen 2.6s ease-in-out infinite;pointer-events:none;}
        .surprise-action-panel{position:relative;overflow:hidden;}
        .surprise-action-panel:before{content:"";position:absolute;inset:0;background:radial-gradient(circle at top right,rgba(124,58,237,.15),transparent 40%);pointer-events:none;}
        .surprise-sparkle{position:absolute;width:7px;height:7px;border-radius:999px;background:rgba(255,255,255,.9);box-shadow:0 0 16px rgba(255,255,255,.85);animation:sparklePop .9s ease-out both;pointer-events:none;}
      `}</style>

      <div onClick={handleClose} style={{ position:'fixed', inset:0, zIndex:800, background:'radial-gradient(circle at 50% 12%,rgba(124,58,237,.26),transparent 34%),linear-gradient(135deg,rgba(2,6,23,.82),rgba(15,23,42,.72))', backdropFilter:'blur(18px)', WebkitBackdropFilter:'blur(18px)' }} />

      <div style={{ position:'fixed', inset:0, zIndex:801, display:'flex', alignItems:'center', justifyContent:'center', padding:14, pointerEvents:'none' }}>
        <div style={{ width:'100%', maxWidth:472, height:'min(760px,92vh)', borderRadius:32, overflow:'hidden', pointerEvents:'all', display:'flex', flexDirection:'column', background:'linear-gradient(180deg,rgba(255,255,255,.98),rgba(248,250,252,.94))', boxShadow:'0 38px 120px rgba(0,0,0,.46),0 0 0 1px rgba(255,255,255,.32),inset 0 1px 0 rgba(255,255,255,.78)', animation:'surpriseModalIn .34s cubic-bezier(.2,.8,.2,1) both', position:'relative' }}>
          <div style={{ position:'absolute', inset:'0 0 auto 0', height:3, background:'linear-gradient(90deg,#f59e0b,#7c3aed,#2563eb,#f59e0b)', backgroundSize:'200% 100%', animation:'borderFlow 4s linear infinite' }} />
          <div style={{ padding:'18px 18px 15px', borderBottom:'1px solid rgba(226,232,240,.78)', background:'linear-gradient(135deg,rgba(255,255,255,.92),rgba(248,250,252,.76))', backdropFilter:'blur(20px)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexShrink:0 }}>
            <div style={{ minWidth:0 }}>
              <p style={{ fontFamily:'Poppins,sans-serif', fontWeight:900, fontSize:19, color:'#0f172a', margin:0, letterSpacing:0 }}>Surprises</p>
              <p style={{ fontFamily:'Poppins,sans-serif', fontSize:11, color:'#64748b', fontWeight:700, margin:'3px 0 0' }}>One tap. One hidden insight.</p>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ padding:'8px 12px', borderRadius:999, background:'linear-gradient(135deg,#fff7ed,#fde68a)', border:'1px solid rgba(245,158,11,.32)', boxShadow:'0 10px 28px rgba(217,119,6,.2),inset 0 1px 0 rgba(255,255,255,.75)', color:'#78350f', fontFamily:'Poppins,sans-serif', fontSize:12, fontWeight:900, whiteSpace:'nowrap' }}>💰 {walletCoins.toLocaleString('en-IN')}</div>
              <button className="surprise-btn" onClick={handleClose} style={{ width:36, height:36, borderRadius:12, border:'1px solid rgba(226,232,240,.9)', background:'linear-gradient(145deg,#ffffff,#f1f5f9)', color:'#475569', cursor:'pointer', fontSize:18, fontWeight:900, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 8px 18px rgba(15,23,42,.08)' }}>×</button>
            </div>
          </div>

          <div style={{ flex:1, overflowY:'auto', padding:16, display:'flex', flexDirection:'column', position:'relative' }}>
            {coinBurst && <div style={{ position:'absolute', top:20, right:22, zIndex:20, padding:'7px 12px', borderRadius:999, background:'#111827', color:'#fbbf24', fontFamily:'Poppins,sans-serif', fontSize:12, fontWeight:900, boxShadow:'0 12px 30px rgba(0,0,0,.28)', animation:'floatCoins 1.2s ease-out both', pointerEvents:'none' }}>{coinBurst}</div>}

            {shouldShowLockedState ? (
              <div style={{ flex:1, minHeight:430, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', gap:14, padding:24 }}>
                <div style={{ width:82, height:82, borderRadius:24, display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#111827,#374151)', color:'#fff', fontSize:36, boxShadow:'0 18px 48px rgba(15,23,42,.28)' }}>🎁</div>
                <div>
                  <p style={{ fontFamily:'Poppins,sans-serif', fontSize:18, fontWeight:900, color:'#0f172a', margin:'0 0 6px' }}>Come back later for more surprises 🎁</p>
                  <p style={{ fontFamily:'Poppins,sans-serif', fontSize:13, fontWeight:800, color:'#7c3aed', margin:0 }}>Next surprise in {formatCountdown(remainingMs)}</p>
                </div>
              </div>
            ) : loading ? (
              <div style={{ flex:1, minHeight:430, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:14 }}>
                <div style={{ width:48, height:48, border:'3px solid #e5e7eb', borderTop:'3px solid #7c3aed', borderRadius:'50%', animation:'spin .8s linear infinite' }} />
                <p style={{ fontFamily:'Poppins,sans-serif', fontSize:13, color:'#64748b', fontWeight:800, margin:0 }}>Loading surprise cards...</p>
              </div>
            ) : cards.length === 0 ? (
              <div style={{ flex:1, minHeight:430, display:'flex', alignItems:'center', justifyContent:'center', textAlign:'center', padding:24 }}>
                <p style={{ fontFamily:'Poppins,sans-serif', fontSize:14, color:'#64748b', fontWeight:800, lineHeight:1.6, margin:0 }}>{message || 'No surprise cards are active right now.'}</p>
              </div>
            ) : currentCard ? (
              <>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10, gap:10 }}>
                  <p style={{ fontFamily:'Poppins,sans-serif', fontSize:11, fontWeight:900, color:'#64748b', margin:0 }}>{progressText}</p>
                  <p style={{ fontFamily:'Poppins,sans-serif', fontSize:11, fontWeight:900, color:'#94a3b8', margin:0 }}>{cards.length} total</p>
                </div>

                <div key={currentCard.id} className={`surprise-premium-card ${!isCurrentRevealed ? 'surprise-breath' : ''} ${revealing ? 'surprise-shake' : ''}`} style={{ flex:'0 0 auto', minHeight:isCurrentRevealed ? 330 : 300, display:'flex', flexDirection:'column', justifyContent:'flex-start', padding:22, borderRadius:28, background:theme.bg, color:theme.text, border:`1.5px solid ${theme.border}`, boxShadow:`0 28px 78px rgba(15,23,42,.18),0 0 48px ${theme.glow},inset 0 1px 0 rgba(255,255,255,.28)`, backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', position:'relative', overflow:'hidden' }}>
                  {(rarity === 'rare' || rarity === 'legendary') && <div style={{ position:'absolute', inset:-80, background:`radial-gradient(circle at 80% 10%,${theme.glow},transparent 38%),radial-gradient(circle at 10% 90%,rgba(255,255,255,.28),transparent 34%)`, animation:'rareGlow 3s ease-in-out infinite', pointerEvents:'none' }} />}
                  <div style={{ position:'absolute', inset:0, background:'linear-gradient(135deg,rgba(255,255,255,.18),transparent 38%,rgba(255,255,255,.08))', pointerEvents:'none' }} />

                  <div style={{ position:'relative', zIndex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, marginBottom:18 }}>
                      <span style={{ padding:'8px 13px', borderRadius:999, background:theme.chipBg, border:`1px solid ${theme.border}`, color:theme.chipText, fontFamily:'Poppins,sans-serif', fontSize:10, fontWeight:900, textTransform:'uppercase', boxShadow:`0 6px 22px ${theme.glow}` }}>{theme.label}</span>
                      <span style={{ color:theme.muted, fontFamily:'Poppins,sans-serif', fontSize:11, fontWeight:900, textTransform:'uppercase' }}>{currentCard.category || 'Surprise'}</span>
                    </div>
                    <p style={{ color:theme.text, fontFamily:'Poppins,sans-serif', fontSize:24, fontWeight:900, lineHeight:1.24, margin:'0 0 8px', letterSpacing:0 }}>{currentCard.hook || 'A hidden surprise is waiting.'}</p>
                    <p style={{ color:theme.muted, fontFamily:'Poppins,sans-serif', fontSize:12, fontWeight:800, margin:0 }}>{isCurrentRevealed ? 'Unlocked' : 'Hold the suspense for one tap'}</p>
                  </div>

                  <div style={{ position:'relative', zIndex:1, marginTop:isCurrentRevealed ? 18 : 20 }}>
                    {isCurrentRevealed ? (
                      <div style={{ animation:'revealIn .38s ease-out both' }}>
                        <div style={{ background:'linear-gradient(145deg,rgba(255,255,255,.86),rgba(248,250,252,.72))', border:`1px solid ${theme.border}`, borderRadius:20, padding:17, backdropFilter:'blur(16px)', boxShadow:'inset 0 1px 0 rgba(255,255,255,.82),0 14px 38px rgba(15,23,42,.14)' }}>
                          <p style={{ fontSize:20, margin:'0 0 8px' }}>✨</p>
                          <p style={{ color:'#1f2937', fontFamily:'Poppins,sans-serif', fontSize:14, fontWeight:800, lineHeight:1.7, margin:0 }}>{currentCard.reveal || 'No reveal available.'}</p>
                        </div>
                        {showMicro && currentMicro && <p style={{ margin:'12px 0 0', color:rarity === 'common' ? '#7c3aed' : '#fff', fontFamily:'Poppins,sans-serif', fontSize:12, fontWeight:900, textAlign:'center', animation:'microIn .28s ease-out both', textShadow:rarity === 'common' ? 'none' : '0 2px 10px rgba(0,0,0,.22)' }}>{currentMicro}</p>}
                      </div>
                    ) : (
                      <div style={{ position:'relative' }}>
                        {revealing && (
                          <>
                            <span className="surprise-sparkle" style={{ top:-6, left:'18%' }} />
                            <span className="surprise-sparkle" style={{ top:8, right:'16%', animationDelay:'.08s' }} />
                            <span className="surprise-sparkle" style={{ bottom:-4, left:'48%', animationDelay:'.14s' }} />
                          </>
                        )}
                        <button className="surprise-btn surprise-reveal-btn" onClick={revealCurrent} disabled={revealing} style={{ width:'100%', padding:'15px 16px', borderRadius:18, border:'1px solid rgba(255,255,255,.22)', background:'linear-gradient(135deg,#111827,#7c3aed 48%,#2563eb)', color:'#fff', cursor:revealing ? 'wait' : 'pointer', fontFamily:'Poppins,sans-serif', fontSize:14, fontWeight:900, boxShadow:'0 16px 38px rgba(124,58,237,.42),inset 0 1px 0 rgba(255,255,255,.22)', opacity:revealing ? .88 : 1 }}>{revealing ? 'Opening...' : '✨ Tap to reveal'}</button>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginTop:14 }}>
                  <button className="surprise-btn" onClick={() => moveCard(-1)} disabled={currentIndex === 0} style={{ padding:'12px 14px', borderRadius:14, border:'1.5px solid #e5e7eb', background:currentIndex === 0 ? '#f3f4f6' : '#fff', color:currentIndex === 0 ? '#94a3b8' : '#334155', cursor:currentIndex === 0 ? 'not-allowed' : 'pointer', fontFamily:'Poppins,sans-serif', fontSize:13, fontWeight:900 }}>Prev</button>
                  <button className="surprise-btn" onClick={() => moveCard(1)} disabled={currentIndex >= maxVisibleIndex} style={{ padding:'12px 14px', borderRadius:14, border:'none', background:currentIndex >= maxVisibleIndex ? '#e5e7eb' : 'linear-gradient(135deg,#111827,#334155)', color:currentIndex >= maxVisibleIndex ? '#94a3b8' : '#fff', cursor:currentIndex >= maxVisibleIndex ? 'not-allowed' : 'pointer', fontFamily:'Poppins,sans-serif', fontSize:13, fontWeight:900, boxShadow:currentIndex >= maxVisibleIndex ? 'none' : '0 8px 22px rgba(15,23,42,.22)' }}>Next</button>
                </div>

                {(showPostRevealActions || message) && (
                  <div className="surprise-action-panel" style={{ marginTop:12, padding:15, borderRadius:22, background:'linear-gradient(135deg,#ffffff,#faf5ff 52%,#eef2ff)', border:'1.5px solid rgba(124,58,237,.22)', boxShadow:'0 14px 38px rgba(124,58,237,.14),inset 0 1px 0 rgba(255,255,255,.82)', animation:'revealIn .34s ease-out both' }}>
                    {displayPostRevealStage === POST_REVEAL_STAGES.CHOOSE_MORE_OR_EXIT && (
                      <>
                        <div style={{ marginBottom:12, position:'relative', zIndex:1 }}>
                          <p style={{ fontFamily:'Poppins,sans-serif', fontSize:14, fontWeight:900, color:'#111827', margin:'0 0 4px' }}>Want more surprises?</p>
                          <p style={{ fontFamily:'Poppins,sans-serif', fontSize:11, fontWeight:700, color:'#64748b', margin:0, lineHeight:1.55 }}>Use coins to continue, or exit and wait for the next limit.</p>
                        </div>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:9, position:'relative', zIndex:1 }}>
                          <button className="surprise-btn" onClick={() => setPostRevealStage(POST_REVEAL_STAGES.CHOOSE_COIN_PACK)} disabled={!hasMoreCardsInDatabase} style={{ padding:'14px 12px', borderRadius:14, border:'1px solid rgba(255,255,255,.22)', background:hasMoreCardsInDatabase ? 'linear-gradient(135deg,#7c3aed,#2563eb)' : '#e5e7eb', color:hasMoreCardsInDatabase ? '#fff' : '#94a3b8', cursor:hasMoreCardsInDatabase ? 'pointer' : 'not-allowed', fontFamily:'Poppins,sans-serif', fontSize:12, fontWeight:900, boxShadow:hasMoreCardsInDatabase ? '0 10px 28px rgba(124,58,237,.3),inset 0 1px 0 rgba(255,255,255,.22)' : 'none' }}>Use coins for more cards</button>
                          <button className="surprise-btn" onClick={chooseExitAndWait} style={{ padding:'13px 12px', borderRadius:14, border:'1.5px solid rgba(148,163,184,.28)', background:'linear-gradient(135deg,#ffffff,#f8fafc)', color:'#334155', cursor:'pointer', fontFamily:'Poppins,sans-serif', fontSize:12, fontWeight:900, boxShadow:'0 8px 18px rgba(15,23,42,.06)' }}>Exit and wait for next limit</button>
                        </div>
                      </>
                    )}

                    {displayPostRevealStage === POST_REVEAL_STAGES.CHOOSE_COIN_PACK && (
                      <>
                        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10, marginBottom:12, position:'relative', zIndex:1 }}>
                          <div>
                            <p style={{ fontFamily:'Poppins,sans-serif', fontSize:14, fontWeight:900, color:'#111827', margin:'0 0 4px' }}>Choose your unlock pack</p>
                            <p style={{ fontFamily:'Poppins,sans-serif', fontSize:11, fontWeight:700, color:'#64748b', margin:0, lineHeight:1.55 }}>Redeem coins to continue your surprise streak.</p>
                          </div>
                          <p style={{ fontFamily:'Poppins,sans-serif', fontSize:10, fontWeight:800, color:'#7c3aed', margin:0, whiteSpace:'nowrap' }}>{Math.max(0, cards.length - visibleCount)} left</p>
                        </div>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, position:'relative', zIndex:1 }}>
                          <button className="surprise-btn" onClick={() => unlockMore(UNLOCK_TWO_COST, 2, 'two')} disabled={unlocking || !canBuyTwoPack} style={{ padding:'13px 10px', borderRadius:14, border:'1.5px solid #ddd6fe', background:unlocking || !canBuyTwoPack ? 'linear-gradient(135deg,#f8fafc,#eef2f7)' : '#fff', color:unlocking || !canBuyTwoPack ? '#94a3b8' : '#6d28d9', cursor:unlocking || !canBuyTwoPack ? 'not-allowed' : 'pointer', fontFamily:'Poppins,sans-serif', fontSize:12, fontWeight:900, boxShadow:canBuyTwoPack ? '0 8px 18px rgba(124,58,237,.12)' : 'none' }}>Unlock 2 cards • 30</button>
                          <button className="surprise-btn" onClick={() => unlockMore(UNLOCK_FIVE_COST, 5, 'five')} disabled={unlocking || !canBuyFivePack} style={{ padding:'13px 10px', borderRadius:14, border:'none', background:unlocking || !canBuyFivePack ? '#e5e7eb' : 'linear-gradient(135deg,#7c3aed,#2563eb)', color:unlocking || !canBuyFivePack ? '#94a3b8' : '#fff', cursor:unlocking || !canBuyFivePack ? 'not-allowed' : 'pointer', fontFamily:'Poppins,sans-serif', fontSize:12, fontWeight:900, boxShadow:unlocking || !canBuyFivePack ? 'none' : '0 10px 28px rgba(124,58,237,.3)' }}>Unlock 5 cards • 50</button>
                        </div>
                        {!canBuyFivePack && walletCoins >= UNLOCK_TWO_COST && <p style={{ position:'relative', zIndex:1, fontFamily:'Poppins,sans-serif', fontSize:10, fontWeight:800, color:'#7c3aed', margin:'9px 0 0', textAlign:'center' }}>5-card pack needs 50 coins.</p>}
                      </>
                    )}

                    {displayPostRevealStage === POST_REVEAL_STAGES.CHOOSE_FIVE_PACK_OR_EXIT && (
                      <>
                        <div style={{ marginBottom:12, position:'relative', zIndex:1 }}>
                          <p style={{ fontFamily:'Poppins,sans-serif', fontSize:14, fontWeight:900, color:'#111827', margin:'0 0 4px' }}>Want even more?</p>
                          <p style={{ fontFamily:'Poppins,sans-serif', fontSize:11, fontWeight:700, color:'#64748b', margin:0, lineHeight:1.55 }}>Unlock 5 more cards or exit and wait for the next limit.</p>
                        </div>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:9, position:'relative', zIndex:1 }}>
                          <button className="surprise-btn" onClick={() => unlockMore(UNLOCK_FIVE_COST, 5, 'five')} disabled={unlocking || !canBuyFivePack} style={{ padding:'14px 12px', borderRadius:14, border:'none', background:unlocking || !canBuyFivePack ? '#e5e7eb' : 'linear-gradient(135deg,#7c3aed,#2563eb)', color:unlocking || !canBuyFivePack ? '#94a3b8' : '#fff', cursor:unlocking || !canBuyFivePack ? 'not-allowed' : 'pointer', fontFamily:'Poppins,sans-serif', fontSize:12, fontWeight:900, boxShadow:unlocking || !canBuyFivePack ? 'none' : '0 10px 28px rgba(124,58,237,.3)' }}>Unlock 5 cards • 50</button>
                          <button className="surprise-btn" onClick={chooseExitAndWait} style={{ padding:'13px 12px', borderRadius:14, border:'1.5px solid rgba(148,163,184,.28)', background:'linear-gradient(135deg,#ffffff,#f8fafc)', color:'#334155', cursor:'pointer', fontFamily:'Poppins,sans-serif', fontSize:12, fontWeight:900, boxShadow:'0 8px 18px rgba(15,23,42,.06)' }}>Exit and wait for next limit</button>
                        </div>
                      </>
                    )}

                    {displayPostRevealStage === POST_REVEAL_STAGES.LOW_COINS_EXIT_ONLY && (
                      <>
                        <div style={{ padding:'12px', borderRadius:18, background:'linear-gradient(135deg,#fff7ed,#ffffff)', border:'1px solid rgba(245,158,11,.28)', marginBottom:12, position:'relative', zIndex:1 }}>
                          <p style={{ fontFamily:'Poppins,sans-serif', fontSize:14, fontWeight:900, color:'#92400e', margin:'0 0 4px' }}>{walletCoins <= 0 ? 'No coins available' : 'Low on coins'}</p>
                          <p style={{ fontFamily:'Poppins,sans-serif', fontSize:11, fontWeight:700, color:'#64748b', margin:0, lineHeight:1.55 }}>{lowCoinMessage}</p>
                        </div>
                        <button className="surprise-btn" onClick={chooseExitAndWait} style={{ width:'100%', padding:'14px 12px', borderRadius:14, border:'none', background:'linear-gradient(135deg,#111827,#334155)', color:'#fff', cursor:'pointer', fontFamily:'Poppins,sans-serif', fontSize:12, fontWeight:900, boxShadow:'0 10px 26px rgba(15,23,42,.24)', position:'relative', zIndex:1 }}>Exit and wait for next limit</button>
                      </>
                    )}

                    {displayPostRevealStage === POST_REVEAL_STAGES.COOLDOWN_COMPLETE && (
                      <>
                        <p style={{ fontFamily:'Poppins,sans-serif', fontSize:14, fontWeight:900, color:'#111827', margin:'0 0 4px', position:'relative', zIndex:1 }}>You've reached the current surprise limit.</p>
                        <p style={{ fontFamily:'Poppins,sans-serif', fontSize:11, fontWeight:700, color:'#64748b', margin:0, lineHeight:1.55, position:'relative', zIndex:1 }}>Come back later for fresh surprises 🎁</p>
                      </>
                    )}

                    {!message && (
                      (displayPostRevealStage === POST_REVEAL_STAGES.CHOOSE_COIN_PACK && ((remainingCards >= 2 && walletCoins < UNLOCK_TWO_COST) || (remainingCards >= 5 && walletCoins < UNLOCK_FIVE_COST))) ||
                      (displayPostRevealStage === POST_REVEAL_STAGES.CHOOSE_FIVE_PACK_OR_EXIT && remainingCards >= 5 && walletCoins < UNLOCK_FIVE_COST)
                    ) && (
                      <p style={{ fontFamily:'Poppins,sans-serif', fontSize:11, fontWeight:800, color:'#dc2626', margin:'10px 0 0', textAlign:'center', position:'relative', zIndex:1 }}>Low on coins. Earn coins to proceed.</p>
                    )}
                    {message && <p style={{ fontFamily:'Poppins,sans-serif', fontSize:11, fontWeight:800, color:message.includes('Low on') || message.includes('No coins') || message.includes('failed') || message.includes('Could not') ? '#dc2626' : '#059669', margin:'10px 0 0', textAlign:'center', position:'relative', zIndex:1 }}>{message}</p>}
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </>
  )
}
