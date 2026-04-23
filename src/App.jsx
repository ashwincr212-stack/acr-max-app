import Planner from './pages/Planner'
import GlobalMic from './components/voice/GlobalMic'
import Home from './pages/Home'
import Expense from './pages/Expense'
import AstroRouter from './pages/AstroRouter'
import Space from './pages/Space'
import Cricket from './pages/Cricket'
import Profile from './pages/Profile'
import News from './pages/News'
import Ledger from './pages/Ledger'
import Login from './pages/Login'
import Coins from './pages/coins'
import { useState, useEffect, useRef, useCallback } from 'react'
import { saveUserLogs, subscribeUserLogs, db } from './firebase'
import { collection, doc, onSnapshot, orderBy, query, setDoc } from 'firebase/firestore'
import { GoogleGenerativeAI } from '@google/generative-ai'

const getUserDocId = (username) => username?.toLowerCase?.() || ''

const normalizeLogCreatedAt = (value) => {
  if (typeof value === 'number') return value
  if (value?.toMillis) return value.toMillis()
  if (typeof value?.seconds === 'number') return value.seconds * 1000
  return 0
}

const normalizeCoinLogDoc = (docSnap) => {
  const data = docSnap.data() || {}
  return {
    id: docSnap.id,
    amount: Number(data.amount || 0),
    source: data.source || 'unknown',
    createdAt: normalizeLogCreatedAt(data.createdAt),
  }
}


/* ── Animated Center Button — alternates logo ↔ ⚡ ACR MAX ─────────────────── */
function AnimatedCenterBtn({ onNavigateHome }) {
  const [showLogo, setShowLogo] = useState(true)
  const [animating, setAnimating] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setAnimating(true)
      setTimeout(() => {
        setShowLogo(prev => !prev)
        setAnimating(false)
      }, 300)
    }, 2800)
    return () => clearInterval(interval)
  }, [])

  return (
    <>
      <style>{`
        @keyframes goldOrbit  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes thunderIn  { 0%{opacity:0;transform:scale(0.4) rotate(-15deg)} 60%{opacity:1;transform:scale(1.12) rotate(3deg)} 100%{opacity:1;transform:scale(1) rotate(0deg)} }
        @keyframes logoIn     { 0%{opacity:0;transform:scale(0.5)} 70%{transform:scale(1.1)} 100%{opacity:1;transform:scale(1)} }
        @keyframes exitUp     { to{opacity:0;transform:scale(0.5) translateY(-10px)} }
        @keyframes goldRing   { 0%,100%{box-shadow:0 0 16px rgba(212,175,55,0.5),0 0 32px rgba(212,175,55,0.2)} 50%{box-shadow:0 0 28px rgba(212,175,55,0.9),0 0 56px rgba(212,175,55,0.35)} }
        @keyframes outerGlow  { 0%,100%{opacity:0.5;transform:scale(1)} 50%{opacity:1;transform:scale(1.1)} }
      `}</style>
      <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: -36, zIndex: 60 }}>
        {/* outer glow ring */}
        <div style={{ position: 'absolute', inset: -8, borderRadius: '50%', background: 'radial-gradient(circle,rgba(212,175,55,0.45),transparent 70%)', animation: 'outerGlow 2.5s ease-in-out infinite', pointerEvents: 'none' }} />
        {/* orbit ring */}
        <div style={{ position: 'absolute', inset: -6, borderRadius: '50%', border: '1px solid rgba(212,175,55,0.4)', animation: 'goldOrbit 6s linear infinite', pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: -3, left: '50%', transform: 'translateX(-50%)', width: 6, height: 6, borderRadius: '50%', background: '#d4af37', boxShadow: '0 0 8px #d4af37' }} />
        </div>
        {/* main button */}
        <button onClick={onNavigateHome}
          style={{
            width: 72, height: 72, borderRadius: '50%', border: '2px solid rgba(212,175,55,0.6)',
            overflow: 'hidden', position: 'relative', cursor: 'pointer',
            background: '#0a0c14',
            animation: 'goldRing 2.8s ease-in-out infinite',
            transition: 'transform 0.15s',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          onMouseDown={e => e.currentTarget.style.transform = 'scale(0.94)'}
          onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          {/* logo face */}
          <div style={{
            position: 'absolute', inset: 0,
            animation: animating ? 'exitUp 0.3s ease-out forwards' : (showLogo ? 'logoIn 0.4s cubic-bezier(.34,1.56,.64,1) both' : 'none'),
            display: showLogo ? 'block' : 'none',
          }}>
            <img src="/logo.jpg" alt="ACR MAX" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
          </div>
          {/* text face */}
          <div style={{
            position: 'absolute', inset: 0, display: !showLogo ? 'flex' : 'none',
            flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            animation: animating ? 'exitUp 0.3s ease-out forwards' : (!showLogo ? 'thunderIn 0.4s cubic-bezier(.34,1.56,.64,1) both' : 'none'),
            background: 'linear-gradient(135deg,#0a0c14,#1a1200)',
          }}>
            <span style={{ fontSize: 22, filter: 'drop-shadow(0 0 8px #fbbf24)', lineHeight: 1 }}>⚡</span>
            <span style={{
              fontSize: 7, fontWeight: 800, letterSpacing: '0.14em',
              fontFamily: 'Cinzel,Syne,sans-serif',
              background: 'linear-gradient(135deg,#c0c0c0,#d4af37,#f4d03f)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              lineHeight: 1.2, textAlign: 'center',
            }}>ACR MAX</span>
          </div>
        </button>
      </div>
    </>
  )
}

function App() {
  // ── AUTH GATE ─────────────────────────────────────────────────────────────
  const [currentUser, setCurrentUser] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    const saved = sessionStorage.getItem('acr_session')
    if (saved) {
      try { setCurrentUser(JSON.parse(saved)) } catch {}
    }
    setAuthChecked(true)
  }, [])

  const handleLogin = (user) => {
    sessionStorage.setItem('acr_session', JSON.stringify(user))
    setCurrentUser(user)
  }

  const handleLogout = () => {
    setCurrentUser(null)
    sessionStorage.removeItem('acr_session')
  }

  if (!authChecked) return null
  if (!currentUser) return <Login onLogin={handleLogin} />

  return <AppShell currentUser={currentUser} onLogout={handleLogout} />
}

// ── Main App (only shown after login) ─────────────────────────────────────────
function AppShell({ currentUser, onLogout }) {
  const [activeTab, setActiveTab] = useState('home')
  const [prevTab, setPrevTab] = useState(null)
  const [coins, setCoins] = useState(0)
  const [coinLogs, setCoinLogs] = useState([])
  const [expenseTab, setExpenseTab] = useState('daily')
  const [cricketTab, setCricketTab] = useState('today')
  const mainContentRef = useRef(null)

  useEffect(() => {
    if (!currentUser?.username) return

    const ref = doc(db, 'acr_users', getUserDocId(currentUser.username))

    const unsubscribe = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data()
        console.log('FIRESTORE COINS:', data.coins)
        setCoins(data.coins || 0)
      } else {
        setCoins(0)
      }
    })

    return () => unsubscribe()
  }, [currentUser.username])

  useEffect(() => {
    if (!currentUser?.username) {
      setCoinLogs([])
      return undefined
    }

    const logsQuery = query(
      collection(db, 'acr_users', getUserDocId(currentUser.username), 'coinLogs'),
      orderBy('createdAt', 'desc')
    )

    const unsubscribe = onSnapshot(logsQuery, (snap) => {
      setCoinLogs(snap.docs.map(normalizeCoinLogDoc))
    }, () => {
      setCoinLogs([])
    })

    return () => unsubscribe()
  }, [currentUser.username])

  const addCoinLog = useCallback(async ({ amount, source, createdAt = Date.now() }) => {
    const userId = getUserDocId(currentUser?.username)
    const logAmount = Number(amount || 0)
    if (!userId || logAmount <= 0 || !source) return

    const logRef = doc(collection(db, 'acr_users', userId, 'coinLogs'))
    const log = {
      id: logRef.id,
      amount: logAmount,
      source,
      createdAt: normalizeLogCreatedAt(createdAt) || Date.now(),
    }

    setCoinLogs(prev => [log, ...prev.filter(item => item.id !== log.id)])

    try {
      await setDoc(logRef, {
        amount: log.amount,
        source: log.source,
        createdAt: log.createdAt,
      })
    } catch (error) {
      console.error('Failed to save coin log:', error)
    }
  }, [currentUser?.username])

  useEffect(() => {
    console.log('GLOBAL COINS:', coins)
  }, [coins])

  // Scroll to top on every tab change
  useEffect(() => {
    if (mainContentRef.current) {
      mainContentRef.current.scrollTop = 0
    }
    window.scrollTo(0, 0)
  }, [activeTab])

  const [logs, setLogs] = useState([])
  const [logsLoaded, setLogsLoaded] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const saveTimer = useRef(null)
  const skipSave = useRef(false)

  // ── STEP 1: Clear old localStorage data on login (migrate to Firestore) ──
  useEffect(() => {
    // Remove all old localStorage expense keys for this user
    const keysToRemove = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('acr_logs')) keysToRemove.push(key)
    }
    keysToRemove.forEach(k => localStorage.removeItem(k))
  }, [currentUser.username])

  // ── STEP 2: Subscribe to Firestore real-time updates ──
  useEffect(() => {
    skipSave.current = true
    setLogsLoaded(false)
    
    const unsubscribe = subscribeUserLogs(currentUser.username, (cloudLogs) => {
      skipSave.current = true
      setLogs(cloudLogs)
      setLogsLoaded(true)
    })
    
    return () => {
      unsubscribe()
      clearTimeout(saveTimer.current)
    }
  }, [currentUser.username])

  // ── STEP 3: Save to Firestore when user makes changes ──
  useEffect(() => {
    if (!logsLoaded) return
    if (skipSave.current) {
      skipSave.current = false
      return
    }
    clearTimeout(saveTimer.current)
    setIsSyncing(true)
    saveTimer.current = setTimeout(async () => {
      await saveUserLogs(currentUser.username, logs)
      setIsSyncing(false)
    }, 500)
  }, [logs, logsLoaded])

  const [searchTerm, setSearchTerm] = useState('')
  const [filterCategory, setFilterCategory] = useState('All')
  const [customCategory, setCustomCategory] = useState('Food')
  const [customAmount, setCustomAmount] = useState('')
  const [aiInsights, setAiInsights] = useState([])
  const [isThinking, setIsThinking] = useState(false)

  const [trackSmoking, setTrackSmoking] = useState(true)
  useEffect(() => {
    const saved = localStorage.getItem("acr_smoke_tracker")
    if (saved) setTrackSmoking(JSON.parse(saved))
  }, [])
  useEffect(() => {
    localStorage.setItem("acr_smoke_tracker", JSON.stringify(trackSmoking))
  }, [trackSmoking])

  const [streak, setStreak] = useState(0)
  const [lastSmokeDate, setLastSmokeDate] = useState(null)
  const [moneySaved, setMoneySaved] = useState(0)
  const [motivation, setMotivation] = useState("")

  const fileInputRef = useRef(null)

  const triggerCamera = () => fileInputRef.current.click()
  const handleImageCapture = (e) => {
    const file = e.target.files[0]
    if (file) alert(`Captured: ${file.name}. (Ready to be sent to AI for receipt scanning)`)
  }

  const [astroProfile, setAstroProfile] = useState({ name: currentUser?.name || 'User', dob: '', time: '', location: 'Bengaluru, India' })
  const [isProfileSaved, setIsProfileSaved] = useState(false)
  const [astroInsights, setAstroInsights] = useState([])
  const [isAstroThinking, setIsAstroThinking] = useState(false)

  const [nasaData, setNasaData] = useState(null)
  const [issData, setIssData] = useState({ lat: 0, lng: 0, vel: 0 })
  const [issLocation, setIssLocation] = useState('Locating...')

  const [cricketMatches, setCricketMatches] = useState([])
  const [isCricketLive, setIsCricketLive] = useState(false)

  const categories = ['Food', 'Petrol', 'Smoke', 'Liquor', 'Electricity Bill', 'Water Bill', 'Mobile Recharge', 'Groceries', 'Vegetables', 'Snacks', 'CSD', 'Hotel Food', 'Other']
  const overallTotal = logs.reduce((sum, l) => sum + l.amount, 0)

  const getCategoryColor = (category) => {
    const map = {
      'Smoke': '#EF4444', 'Liquor': '#8B5CF6',
      'Food': '#10B981', 'Groceries': '#10B981', 'Vegetables': '#22c55e', 'Snacks': '#f97316', 'Hotel Food': '#10B981',
      'Petrol': '#F59E0B', 'Water Bill': '#3B82F6',
      'Electricity Bill': '#EAB308', 'CSD': '#14B8A6',
    }
    return map[category] || '#6B7280'
  }

  const addExpense = (override = null) => {
    const amount = override?.amount ?? customAmount
    const category = override?.category ?? customCategory
    const note = override?.note ?? ''
    const tags = override?.tags ?? []
    if (!amount || amount <= 0) return
    const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const newLog = { id: Date.now(), category, amount: parseFloat(amount), time: currentTime, color: getCategoryColor(category), note, tags }
    setLogs([newLog, ...logs])
    setCustomAmount('')
  }

  const addExpenseWithMeta = (note = '', tags = [], override = null) => addExpense({
    amount: override?.amount ?? customAmount,
    category: override?.category ?? customCategory,
    note: override?.note ?? note.trim(),
    tags: override?.tags ?? tags,
  })

  const addLedgerEntry = useCallback(async (data) => {
    const userId = getUserDocId(currentUser?.username)
    if (!userId || !data?.person || !data?.amount) return

    const entryId = Date.now()
    const createdAt = new Date().toISOString()
    const palette = ['#f87171', '#fb923c', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#f472b6', '#e879f9']
    const entry = {
      id: entryId,
      type: data.type === 'lent' ? 'lent' : 'borrowed',
      person: data.person.trim(),
      amount: Number(data.amount),
      category: data.category || 'Other',
      date: data.date || createdAt.slice(0, 10),
      dueDate: data.dueDate || '',
      note: data.note || '',
      phone: data.phone || '',
      color: data.color || palette[entryId % palette.length],
      settled: false,
      createdAt,
    }

    const ledgerRef = doc(db, 'acr_ledger', userId)

    try {
      const entries = await new Promise((resolve) => {
        const unsubscribe = onSnapshot(ledgerRef, (snap) => {
          unsubscribe()
          resolve(snap.exists() ? (snap.data().entries || []) : [])
        }, () => {
          unsubscribe()
          resolve([])
        })
      })

      await setDoc(ledgerRef, {
        entries: [entry, ...entries],
        updatedAt: Date.now(),
      })
    } catch (error) {
      console.error('Failed to save voice ledger entry:', error)
    }
  }, [currentUser?.username])

  const addPlannerTask = useCallback(async (data) => {
    const userId = getUserDocId(currentUser?.username)
    if (!userId || !data?.title) return

    const taskRef = doc(collection(db, 'acr_users', userId, 'plannerTasks'))
    const createdAt = new Date().toISOString()
    const task = {
      id: taskRef.id,
      title: data.title.trim(),
      date: data.date || createdAt.slice(0, 10),
      time: data.time || '',
      duration: Number(data.duration || 30),
      priority: data.priority || 'none',
      category: data.category || 'personal',
      completed: false,
      completedAt: null,
      isInbox: false,
      notes: data.note || data.notes || '',
      remindAt: '',
      subtasks: [],
      createdAt,
      updatedAt: createdAt,
    }

    try {
      await setDoc(taskRef, task)
    } catch (error) {
      console.error('Failed to save voice planner task:', error)
    }
  }, [currentUser?.username])

  const deleteExpense = (id) => setLogs(logs.filter(log => log.id !== id))

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.category.toLowerCase().includes(searchTerm.toLowerCase()) || log.amount.toString().includes(searchTerm)
    const matchesFilter = filterCategory === 'All' || log.category === filterCategory
    return matchesSearch && matchesFilter
  })

  const categoryTotals = logs.reduce((acc, log) => {
    if (!acc[log.category]) acc[log.category] = { name: log.category, total: 0, color: log.color }
    acc[log.category].total += log.amount
    return acc
  }, {})
  const summaryData = Object.values(categoryTotals).sort((a, b) => b.total - a.total)

  useEffect(() => {
    if (!trackSmoking) return
    const smokeLogs = logs.filter(log => log.category === "Smoke")
    const today = new Date()
    if (smokeLogs.length === 0) {
      const first = logs.length ? new Date(logs[logs.length - 1].id) : today
      const diff = Math.floor((today - first) / (1000 * 60 * 60 * 24))
      setStreak(diff); setLastSmokeDate(null); setMoneySaved(diff * 20)
    } else {
      const last = new Date(smokeLogs[0].id)
      setLastSmokeDate(last)
      const diff = Math.max(0, Math.floor((today - last) / (1000 * 60 * 60 * 24)))
      setStreak(diff); setMoneySaved(diff * 20)
    }
    if (streak === 0) setMotivation("Start fresh today 💪")
    else if (streak < 3) setMotivation("Good start 🔥")
    else if (streak < 7) setMotivation("Stay strong 💯")
    else if (streak < 30) setMotivation("Discipline building 🚀")
    else setMotivation("Beast mode 🏆")
  }, [logs, trackSmoking, streak])

  const generateAIAdvice = async () => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY
    if (!apiKey) { setAiInsights(["⚠️ API Key is missing!"]); return }
    if (logs.length === 0) { setAiInsights(["I need data first!"]); return }
    setIsThinking(true); setAiInsights([])
    try {
      const genAI = new GoogleGenerativeAI(apiKey)
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })
      const prompt = `You are a financial advisor for the ACR MAX app. Analyze this data: ${JSON.stringify(logs)}. Total today: ₹${overallTotal}. Give me EXACTLY 3 short sentences. Sentence 1: Observation. Sentence 2: Projection. Sentence 3: Action. Separate each using exactly this symbol: |||. Do not use bullets or new lines.`
      const result = await model.generateContent(prompt)
      const rawText = result.response.text()
      setAiInsights(rawText.split('|||').map(t => t.trim()).filter(t => t.length > 0))
    } catch (error) { setAiInsights(["❌ Error: " + error.message]) }
    setIsThinking(false)
  }

  const generateAstroData = async () => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY
    if (!apiKey) { setAstroInsights(["⚠️ API Key is missing!"]); return }
    setIsAstroThinking(true); setAstroInsights([])
    try {
      const genAI = new GoogleGenerativeAI(apiKey)
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })
      const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      const prompt = `You are an elite Vedic Astrologer for the ACR MAX app. The user's name is ${astroProfile.name}. They were born on ${astroProfile.dob} at ${astroProfile.time}. They are currently in ${astroProfile.location}. Today's date is ${today}. Calculate their daily astrology and give me EXACTLY 3 short, punchy parts. Part 1: Today's Lucky Color and a 1-sentence reason why. Part 2: Today's Best Time (Subha Muhurtham) for their specific location. Part 3: Today's Caution Times (Exact Rahu Kalam & Yama Gandam timings) for their specific location. Separate each part using exactly this symbol: |||. Do not use bullet points or markdown stars.`
      const result = await model.generateContent(prompt)
      const rawText = result.response.text()
      setAstroInsights(rawText.split('|||').map(t => t.trim()).filter(t => t.length > 0))
    } catch (error) { setAstroInsights(["❌ Error: " + error.message]) }
    setIsAstroThinking(false)
  }

  const fetchNasaData = async () => {
    try {
      const res = await fetch('https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY')
      const data = await res.json()
      if (data.url) { setNasaData(data) } else {
        setNasaData({ title: "NASA Feed Paused (Rate Limited)", explanation: "You've hit NASA's public API limit! The live feed will reset shortly.", url: "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?q=80&w=2048&auto=format&fit=crop", media_type: "image" })
      }
    } catch (error) { console.error("NASA API Error:", error) }
  }

  const fetchIssData = async () => {
    try {
      const res = await fetch('https://api.wheretheiss.at/v1/satellites/25544')
      const data = await res.json()
      const lat = data.latitude; const lng = data.longitude
      setIssData({ lat, lng, vel: data.velocity })
      try {
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`)
        const geoData = await geoRes.json()
        if (geoData.error) { setIssLocation("Over the Ocean 🌊") } else {
          const country = geoData.address?.country || ''
          const state = geoData.address?.state || geoData.address?.region || ''
          setIssLocation(state ? `${state}, ${country}` : country)
        }
      } catch { setIssLocation("Over the Ocean 🌊") }
    } catch (error) { console.error("ISS API Error:", error) }
  }

  const fetchCricketData = async () => {
    const apiKey = import.meta.env.VITE_CRIC_API_KEY
    if (!apiKey) {
      setIsCricketLive(false)
      setCricketMatches([
        { id: '1', type: 'today', team1: 'RCB', team2: 'CSK', score1: '198/4', overs1: '20.0', score2: '162/6', overs2: '17.2', status: 'CSK need 37 runs in 16 balls', venue: 'M. Chinnaswamy Stadium, Bengaluru', isLive: true },
        { id: '2', type: 'results', team1: 'MI', team2: 'KKR', score1: '175/8', overs1: '20.0', score2: '176/4', overs2: '19.1', status: 'KKR won by 6 wickets', venue: 'Wankhede Stadium, Mumbai', isLive: false },
        { id: '3', type: 'upcoming', team1: 'SRH', team2: 'RR', score1: '', overs1: '', score2: '', overs2: '', status: 'Tomorrow, 7:30 PM IST', venue: 'Rajiv Gandhi Stadium', isLive: false },
        { id: '4', type: 'upcoming', team1: 'GT', team2: 'DC', score1: '', overs1: '', score2: '', overs2: '', status: 'Friday, 7:30 PM IST', venue: 'Narendra Modi Stadium', isLive: false }
      ])
      return
    }
    try {
      const res = await fetch(`https://api.cricapi.com/v1/currentMatches?apikey=${apiKey}&offset=0`)
      const data = await res.json()
      if (data.data) {
        setIsCricketLive(true)
        const iplMatches = data.data.filter(m => {
          const matchName = (m.name || '').toLowerCase()
          const seriesName = (m.seriesInfo?.name || m.series?.name || '').toLowerCase()
          return matchName.includes('ipl') || matchName.includes('indian premier') || seriesName.includes('ipl') || seriesName.includes('indian premier')
        })
        const formatted = iplMatches.map(m => ({
          id: m.id, type: m.matchStarted ? (m.matchEnded ? 'results' : 'today') : 'upcoming',
          team1: m.teamInfo?.[0]?.shortname || m.teams?.[0] || 'TBA',
          team2: m.teamInfo?.[1]?.shortname || m.teams?.[1] || 'TBA',
          score1: m.score?.[0] ? `${m.score[0].r}/${m.score[0].w}` : '',
          overs1: m.score?.[0]?.o || '',
          score2: m.score?.[1] ? `${m.score[1].r}/${m.score[1].w}` : '',
          overs2: m.score?.[1]?.o || '',
          status: m.status, venue: m.venue,
          isLive: m.matchStarted && !m.matchEnded
        }))
        setCricketMatches(formatted)
      }
    } catch (e) { console.error("Cricket API Error:", e) }
  }

  useEffect(() => {
    let issInterval, cricInterval
    if (activeTab === 'space') {
      if (!nasaData) fetchNasaData()
      fetchIssData()
      issInterval = setInterval(fetchIssData, 5000)
    }
    if (activeTab === 'cricket') {
      fetchCricketData()
      cricInterval = setInterval(fetchCricketData, 60000)
    }
    return () => { clearInterval(issInterval); clearInterval(cricInterval) }
  }, [activeTab])

  const renderPlaceholder = (icon, title, description) => (
    <div className="text-center mt-32 text-gray-500">
      <div className="text-8xl mb-6 placeholder-icon">{icon}</div>
      <h2 className="font-bold text-4xl mb-4" style={{ color: 'rgba(255,255,255,0.7)' }}>{title}</h2>
      <p className="text-xl max-w-lg mx-auto" style={{ color: 'rgba(255,255,255,0.3)' }}>{description}</p>
    </div>
  )

  const renderContent = () => {
    switch (activeTab) {
      
      
      case 'home':
        return <Home setActiveTab={setActiveTab} setPrevTab={setPrevTab} activeTab={activeTab} logs={logs} overallTotal={overallTotal} currentUser={currentUser} onLogout={onLogout} coins={coins} addCoinLog={addCoinLog} />
      case 'expense':
        return (
          <Expense
            logs={logs} customAmount={customAmount} setCustomAmount={setCustomAmount}
            customCategory={customCategory} setCustomCategory={setCustomCategory}
            categories={categories} addExpense={addExpense} addExpenseWithMeta={addExpenseWithMeta}
            deleteExpense={deleteExpense} filteredLogs={filteredLogs}
            searchTerm={searchTerm} setSearchTerm={setSearchTerm}
            filterCategory={filterCategory} setFilterCategory={setFilterCategory}
            overallTotal={overallTotal} expenseTab={expenseTab} setExpenseTab={setExpenseTab}
            summaryData={summaryData} aiInsights={aiInsights} generateAIAdvice={generateAIAdvice}
            isThinking={isThinking}
            triggerCamera={triggerCamera} handleImageCapture={handleImageCapture} fileInputRef={fileInputRef}
          />
        )
      case 'astro':
  return (
    <AstroRouter
      onBack={() => {
        setPrevTab(activeTab)
        setActiveTab('home')
      }}
    />
  )
      case 'planner':
        return <Planner currentUser={currentUser} />
        case 'space':
        return <Space issData={issData} issLocation={issLocation} nasaData={nasaData} />
      case 'cricket':
        return <Cricket />
      case 'market':
        return <News />
      case 'ledger':
        return <Ledger currentUser={currentUser} />
      case 'coins':
        return <Coins coins={coins} coinLogs={coinLogs} setActiveTab={setActiveTab} />
      case 'chat':
        return renderPlaceholder('🤖', 'AI Quick Chats', 'Your personal assistant connecting your app data.')
      case 'profile':
        return <Profile logs={logs} setLogs={setLogs} overallTotal={overallTotal} summaryData={summaryData} currentUser={currentUser} onLogout={onLogout} />
      default:
        return <Home setActiveTab={setActiveTab} setPrevTab={setPrevTab} activeTab={activeTab} logs={logs} overallTotal={overallTotal} currentUser={currentUser} onLogout={onLogout} coins={coins} addCoinLog={addCoinLog} />
    }
  }

  const navItems = [
    { id: 'home',    label: '🏠 Home' },
    { id: 'expense', label: '💰 Expense Tracker' },
    { id: 'astro',   label: '✨ Astro Insights' },
    { id: 'cricket', label: '🏏 Cricket World' },
    { id: 'market',  label: '📰 News Flash' },
    { id: 'ledger',  label: '🤝 Smart Ledger' },
    { id: 'chat',    label: '🤖 AI Quick Chats' },
    { id: 'space',   label: '🚀 Space World' },
    { id: 'profile', label: '👤 Profile' },
    { id: 'planner', label: '🗓️ Planner' },
  ]

  return (
    <div className="flex h-screen app-shell font-sans">

      {/* DESKTOP SIDEBAR */}
      <div className="hidden md:flex w-72 sidebar p-6 flex-col z-10" style={{ flexShrink: 0 }}>

        {/* Logo + brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <img src="/logo.jpg" alt="ACR MAX" style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(212,175,55,0.45)', boxShadow: '0 0 12px rgba(212,175,55,0.25)', flexShrink: 0 }} />
          <div>
            <p style={{ fontFamily: 'Cinzel,Syne,sans-serif', fontSize: 15, fontWeight: 700, margin: 0, background: 'linear-gradient(135deg,#c0c0c0,#d4af37)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '0.1em' }}>ACR MAX</p>
            <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(212,175,55,0.5)', margin: 0, letterSpacing: '0.18em' }}>BETA 1.0</p>
          </div>
        </div>

        {/* User badge */}
        <div style={{ background: 'rgba(212,175,55,0.07)', border: '1px solid rgba(212,175,55,0.16)', borderRadius: 12, padding: '9px 12px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#d4af37,#b8860b)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#0a0c14', fontFamily: 'Syne,sans-serif', flexShrink: 0 }}>
            {currentUser.name.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentUser.name}</p>
            <p style={{ fontSize: 10, color: 'rgba(212,175,55,0.55)', margin: 0, fontWeight: 600 }}>{currentUser.role}</p>
          </div>
        </div>

        <nav className="flex flex-col gap-2" style={{ flex: 1 }}>
          {navItems.map(item => (
            <button key={item.id}
              className={`sidebar-btn w-full text-left px-5 py-4 text-lg transition-all ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => { setPrevTab(activeTab); setActiveTab(item.id) }}>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Sign out */}
        <button onClick={onLogout}
          style={{ marginTop: 8, width: '100%', padding: '10px 14px', borderRadius: 12, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)', color: '#f87171', fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'DM Sans,sans-serif', textAlign: 'left' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.14)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.07)'}>
          🚪 Sign Out
        </button>
      </div>

      {/* MAIN CONTENT */}
      <div ref={mainContentRef} className="flex-1 overflow-y-auto px-4 md:px-10 py-6 pb-28 main-content" style={{ maxWidth: '100%' }}>
        {/* Sync status indicator */}
        {isSyncing && (
          <div style={{ position: 'fixed', top: 12, right: 16, zIndex: 999, background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.35)', borderRadius: 20, padding: '5px 14px', display: 'flex', alignItems: 'center', gap: 6, backdropFilter: 'blur(8px)' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', animation: 'glowPulse 1s infinite' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#34d399' }}>Syncing…</span>
          </div>
        )}
        <div className="transition-all duration-500 ease-in-out max-w-5xl mx-auto">
          {renderContent()}
        </div>
      </div>

      {/* MOBILE BOTTOM NAV */}
      <div className="fixed bottom-0 left-0 w-full z-50">
        <div className="mobile-nav px-1 py-2 flex justify-between items-center">
          <button onClick={() => setActiveTab('home')} className={`mobile-nav-btn flex flex-col items-center text-xs ${activeTab === 'home' ? 'active' : ''}`} style={{flex:1}}>🏠<span style={{fontSize:9}}>Home</span></button>
          <button onClick={() => setActiveTab('expense')} className={`mobile-nav-btn flex flex-col items-center text-xs ${activeTab === 'expense' ? 'active' : ''}`} style={{flex:1}}>💳<span style={{fontSize:9}}>Expenses</span></button>
          <div style={{flex:'0 0 64px'}} />
          <button onClick={() => setActiveTab('ledger')} className={`mobile-nav-btn flex flex-col items-center text-xs ${activeTab === 'ledger' ? 'active' : ''}`} style={{flex:1}}>🤝<span style={{fontSize:9}}>Ledger</span></button>
          <button onClick={onLogout} className="mobile-nav-btn flex flex-col items-center text-xs" style={{flex:1,color:'#f87171'}}>🚪<span style={{fontSize:9}}>Logout</span></button>
        </div>

        {/* ANIMATED CENTER BUTTON */}
        <AnimatedCenterBtn onNavigateHome={() => { setPrevTab(activeTab); setActiveTab('home') }} />
      </div>
      <GlobalMic
        onExpenseAdded={(data) => addExpense(data)}
        onLedgerAdded={addLedgerEntry}
        onPlannerAdded={addPlannerTask}
      />
    </div>
  )
}

export default App
