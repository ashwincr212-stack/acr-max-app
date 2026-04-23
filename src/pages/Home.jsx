import { useState, useEffect, useMemo, useRef } from 'react'
import SurprisesModal from './SurprisesModal'
import SkillMachineModal from './SkillMachine'
import { db } from '../firebase'
import { collection, query, orderBy, onSnapshot, doc, updateDoc, increment } from 'firebase/firestore'
import { fetchAstroDoc, getTodayIST, LOCATIONS, LOCATION_META } from './astroHelpers'

function useGreeting() {
  const h = new Date().getHours()
  if (h < 5) return { text: 'Good Night', emoji: '🌙' }
  if (h < 12) return { text: 'Good Morning', emoji: '🌤️' }
  if (h < 17) return { text: 'Good Afternoon', emoji: '☀️' }
  if (h < 21) return { text: 'Good Evening', emoji: '🌆' }
  return { text: 'Good Night', emoji: '🌙' }
}

function CountUp({ value, prefix = '₹', duration = 850 }) {
  const [disp, setDisp] = useState(0)
  const raf = useRef(null)

  useEffect(() => {
    const end = Number(value) || 0
    const t0 = performance.now()
    const step = (now) => {
      const p = Math.min((now - t0) / duration, 1)
      const e = 1 - Math.pow(1 - p, 3)
      setDisp(Math.round(end * e))
      if (p < 1) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf.current)
  }, [value, duration])

  return <span>{prefix}{disp.toLocaleString('en-IN')}</span>
}

const SURPRISE_COOLDOWN_MS = 6 * 60 * 60 * 1000

function surpriseTimestampToMs(value) {
  if (!value) return 0
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (typeof value.seconds === 'number') return value.seconds * 1000
  if (typeof value === 'number') return value
  return 0
}

function formatSurpriseCountdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const hours = String(Math.floor(total / 3600)).padStart(2, '0')
  const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, '0')
  return `${hours}:${minutes}`
}

function formatCurrency(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

function getDayKey(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString().slice(0, 10)
}

function pctText(current, base, suffix) {
  if (!base) return `No ${suffix} comparison`
  const pct = Math.round(((current - base) / base) * 100)
  return `${pct >= 0 ? '+' : ''}${pct}% vs ${suffix}`
}

function normalizeTimeValue(value) {
  if (!value) return ''
  if (typeof value !== 'string') return ''
  const match = value.match(/(\d{1,2}):(\d{2})/)
  if (!match) return ''
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (Number.isNaN(hour) || Number.isNaN(minute)) return ''
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function formatShortTime(value) {
  const normalized = normalizeTimeValue(value)
  if (!normalized) return '—'
  const [hourText, minuteText] = normalized.split(':')
  const hour = Number(hourText)
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minuteText} ${suffix}`
}

function toMinutes(value) {
  const normalized = normalizeTimeValue(value)
  if (!normalized) return null
  const [hour, minute] = normalized.split(':').map(Number)
  return hour * 60 + minute
}

function extractAstroSummary(data) {
  const rawFestivals = data?.rawFestivals || {}
  const festivalList = [
    ...(Array.isArray(rawFestivals?.festival_list) ? rawFestivals.festival_list : []),
    ...(Array.isArray(rawFestivals?.festivals) ? rawFestivals.festivals : []),
    ...(Array.isArray(data?.festivals) ? data.festivals : []),
  ]
  const firstFestival = festivalList.find(Boolean)
  const festivalName =
    firstFestival?.festival_name ||
    firstFestival?.name ||
    firstFestival?.title ||
    'No festival today'

  const goodWindow =
    data?.abhijitMuhurta ||
    data?.abhijit_muhurta ||
    data?.abhijit ||
    data?.brahma_muhurta ||
    data?.brahmaMuhurta ||
    data?.dur_muhurta ||
    ''

  const summaryTitle = goodWindow ? 'Good Window' : 'Daily Panchang'

  return {
    title: summaryTitle,
    window: goodWindow || 'No key window today',
    festival: festivalName,
    sunrise: data?.sunrise || data?.sun_rise || data?.sunRise || '',
    sunset: data?.sunset || data?.sun_set || data?.sunSet || '',
  }
}

function MiniTrend({ accent, points = [] }) {
  const safePoints = points.length ? points : [25, 45, 35, 60]
  const path = safePoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${index * 18} ${34 - point * 0.34}`).join(' ')
  return (
    <div className="home-mini-visual home-mini-visual--spark">
      <svg viewBox="0 0 54 34" className="home-mini-spark-svg">
        <path d={path} fill="none" stroke={accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

function MiniDots({ accent, values = [] }) {
  const safeValues = values.length ? values : [1, 0, 0]
  return (
    <div className="home-mini-visual home-mini-visual--dots">
      {safeValues.map((value, index) => (
        <span
          key={index}
          className="home-status-dot"
          style={{
            background: value ? accent : `${accent}20`,
            opacity: value ? 1 : 0.55,
            transform: value ? 'scale(1)' : 'scale(0.82)',
          }}
        />
      ))}
    </div>
  )
}

function MiniProgress({ accent, pct = 0 }) {
  return (
    <div className="home-mini-visual home-mini-visual--progress">
      <div className="home-mini-progress-track">
        <div className="home-mini-progress-fill" style={{ width: `${Math.max(8, pct)}%`, background: accent }} />
      </div>
    </div>
  )
}

function AstroCard({ snapshot, onOpen, onLocationChange }) {
  const [pressed, setPressed] = useState(false)
  const meta = LOCATION_META[snapshot.location] || LOCATION_META.Chennai || { emoji: '✦', tagline: 'Panchang' }

  return (
    <button
      onClick={onOpen}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      className="home-dashboard-card home-dashboard-card--astro home-astro-card"
      style={{
        background: CARD_TONES.astro.surface,
        border: `1px solid ${CARD_TONES.astro.border}`,
        boxShadow: pressed
          ? 'inset 2px 2px 7px rgba(15,23,42,0.08), inset -1px -1px 4px rgba(255,255,255,0.85)'
          : CARD_TONES.astro.shadow,
        transform: pressed ? 'scale(0.98)' : 'translateY(0)',
      }}
    >
      <span className="home-card-glow" style={{ background: CARD_TONES.astro.glow }} />
      <span className="home-card-haze" style={{ background: CARD_TONES.astro.haze }} />
      <span className="home-card-gloss" style={{ background: CARD_TONES.astro.gloss }} />
      <span className="home-card-stars" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>

      <div className="home-card-top">
        <div className="home-card-icon home-astro-card-icon" style={{ background: CARD_TONES.astro.iconBg, color: '#4F46E5' }}>
          ✦
        </div>
        <div className="home-astro-card-top-right">
          <span className="home-astro-live-pill">Live</span>
          <div className="home-card-chev" style={{ color: '#4F46E5' }}>›</div>
        </div>
      </div>

      <div className="home-astro-card-heading">
        <div>
          <div className="home-card-title">Astro</div>
          <div className="home-astro-primary">{snapshot.value || 'Daily Panchang'}</div>
        </div>
        <div className="home-astro-meta-badge">
          <span>{meta.emoji}</span>
          <small>{meta.tagline}</small>
        </div>
      </div>

      <div className="home-astro-card-window">{snapshot.window || 'No key window today'}</div>

      <div className="home-astro-card-inline">
        <div className="home-astro-card-chip">
          <span>Festival</span>
          <strong>{snapshot.festival || 'No festival today'}</strong>
        </div>
        <div className="home-astro-card-chip">
          <span>Daylight</span>
          <strong>{Math.round(snapshot.dayPct || 0)}%</strong>
        </div>
      </div>

      <div className="home-astro-card-footer" onClick={(event) => event.stopPropagation()}>
        <label className="home-astro-location-wrap">
          <span className="home-astro-location-label">Location</span>
          <select
            className="home-astro-location-select"
            value={snapshot.location}
            onChange={(event) => onLocationChange(event.target.value)}
          >
            {LOCATIONS.map((location) => (
              <option key={location} value={location}>{location}</option>
            ))}
          </select>
        </label>
      </div>
    </button>
  )
}

const CARD_TONES = {
  expenses: {
    surface: 'linear-gradient(155deg, rgba(255,255,255,0.98) 0%, rgba(255,249,240,0.98) 42%, rgba(255,239,213,0.96) 100%)',
    border: 'rgba(217,119,6,0.18)',
    shadow: '0 14px 32px rgba(217,119,6,0.12), 0 1px 0 rgba(255,255,255,0.94) inset',
    glow: 'radial-gradient(circle at 18% 18%, rgba(251,191,36,0.26), transparent 48%)',
    haze: 'radial-gradient(circle at 86% 22%, rgba(251,146,60,0.16), transparent 34%)',
    gloss: 'linear-gradient(180deg, rgba(255,255,255,0.72), rgba(255,255,255,0))',
    iconBg: 'linear-gradient(145deg, rgba(255,247,219,0.98), rgba(255,233,193,0.92))',
  },
  ledger: {
    surface: 'linear-gradient(155deg, rgba(255,255,255,0.98) 0%, rgba(240,253,248,0.98) 48%, rgba(222,247,239,0.96) 100%)',
    border: 'rgba(5,150,105,0.18)',
    shadow: '0 14px 32px rgba(5,150,105,0.11), 0 1px 0 rgba(255,255,255,0.94) inset',
    glow: 'radial-gradient(circle at 16% 20%, rgba(52,211,153,0.2), transparent 50%)',
    haze: 'radial-gradient(circle at 88% 22%, rgba(45,212,191,0.14), transparent 34%)',
    gloss: 'linear-gradient(180deg, rgba(255,255,255,0.72), rgba(255,255,255,0))',
    iconBg: 'linear-gradient(145deg, rgba(232,255,247,0.98), rgba(209,250,229,0.92))',
  },
  planner: {
    surface: 'linear-gradient(155deg, rgba(255,255,255,0.98) 0%, rgba(248,245,255,0.98) 48%, rgba(239,233,255,0.97) 100%)',
    border: 'rgba(124,58,237,0.16)',
    shadow: '0 14px 32px rgba(124,58,237,0.1), 0 1px 0 rgba(255,255,255,0.94) inset',
    glow: 'radial-gradient(circle at 18% 18%, rgba(167,139,250,0.22), transparent 48%)',
    haze: 'radial-gradient(circle at 86% 24%, rgba(196,181,253,0.2), transparent 34%)',
    gloss: 'linear-gradient(180deg, rgba(255,255,255,0.74), rgba(255,255,255,0))',
    iconBg: 'linear-gradient(145deg, rgba(247,243,255,0.98), rgba(237,233,254,0.94))',
  },
  astro: {
    surface: 'linear-gradient(155deg, rgba(255,255,255,0.99) 0%, rgba(250,251,255,0.98) 48%, rgba(242,245,255,0.96) 100%)',
    border: 'rgba(99,102,241,0.14)',
    shadow: '0 14px 32px rgba(99,102,241,0.09), 0 1px 0 rgba(255,255,255,0.96) inset',
    glow: 'radial-gradient(circle at 18% 18%, rgba(191,219,254,0.24), transparent 50%)',
    haze: 'radial-gradient(circle at 86% 20%, rgba(221,214,254,0.2), transparent 34%)',
    gloss: 'linear-gradient(180deg, rgba(255,255,255,0.78), rgba(255,255,255,0))',
    iconBg: 'linear-gradient(145deg, rgba(255,255,255,0.98), rgba(237,242,255,0.94))',
  },
}

function DashboardCard({ title, icon, accent, bg, primary, lines, onClick, animated, primaryPrefix = '', microVisual, tone = 'expenses' }) {
  const [pressed, setPressed] = useState(false)
  const toneConfig = CARD_TONES[tone] || CARD_TONES.expenses

  return (
    <button
      onClick={onClick}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      className={`home-dashboard-card home-dashboard-card--${tone}`}
      style={{
        background: toneConfig.surface || `linear-gradient(145deg, #ffffff 0%, ${bg} 100%)`,
        border: `1px solid ${toneConfig.border || `${accent}22`}`,
        boxShadow: pressed
          ? 'inset 2px 2px 7px rgba(15,23,42,0.08), inset -1px -1px 4px rgba(255,255,255,0.85)'
          : toneConfig.shadow || '0 12px 28px rgba(15,23,42,0.08), 0 1px 0 rgba(255,255,255,0.9) inset',
        transform: pressed ? 'scale(0.98)' : 'translateY(0)',
      }}
    >
      <span className="home-card-glow" style={{ background: toneConfig.glow }} />
      <span className="home-card-haze" style={{ background: toneConfig.haze }} />
      <span className="home-card-gloss" style={{ background: toneConfig.gloss }} />
      {tone === 'astro' && (
        <span className="home-card-stars" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      )}
      <div className="home-card-top">
        <div className="home-card-icon" style={{ background: toneConfig.iconBg || `${accent}14`, color: accent }}>
          {icon}
        </div>
        <div className="home-card-chev" style={{ color: accent }}>›</div>
      </div>
      <div className="home-card-title">{title}</div>
      <div className="home-card-primary" style={{ color: accent }}>
        {animated ? <CountUp value={primary} prefix={primaryPrefix} /> : primary}
      </div>
      {microVisual}
      <div className="home-card-lines">
        {lines.map((line, index) => (
          <p key={index}>{line}</p>
        ))}
      </div>
    </button>
  )
}

function FeatureCard({ title, subtitle, pill, icon, onClick }) {
  return (
    <button className="home-feature-card" onClick={onClick}>
      <div className="home-feature-icon">{icon}</div>
      <div className="home-feature-copy">
        <p>{title}</p>
        <span>{subtitle}</span>
      </div>
      <div className="home-feature-pill">{pill}</div>
    </button>
  )
}

export default function Home({
  setActiveTab,
  setPrevTab,
  activeTab,
  logs = [],
  overallTotal = 0,
  currentUser,
  coins = 0,
  addCoinLog,
}) {
  const greeting = useGreeting()
  const [time, setTime] = useState(new Date())
  const [surprisesOpen, setSurprisesOpen] = useState(false)
  const [skillOpen, setSkillOpen] = useState(false)
  const [surpriseUsedAt, setSurpriseUsedAt] = useState(null)
  const [surpriseRemainingMs, setSurpriseRemainingMs] = useState(0)
  const [ledgerEntries, setLedgerEntries] = useState([])
  const [plannerTasks, setPlannerTasks] = useState([])
  const [astroSnapshot, setAstroSnapshot] = useState({
    location: localStorage.getItem('acr_astro_location') || 'Chennai',
    title: 'Daily Panchang',
    window: 'No key window today',
    festival: 'No festival today',
    sunrise: '',
    sunset: '',
  })

  const username = currentUser?.username?.toLowerCase?.() || ''
  const displayName = currentUser?.name || currentUser?.username || 'User'
  const astroLang = localStorage.getItem('acr_astro_lang') || 'en'

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!username) {
      setSurpriseUsedAt(null)
      return undefined
    }

    const ref = doc(db, 'acr_users', username)
    return onSnapshot(ref, (snap) => {
      const data = snap.exists() ? snap.data() : {}
      setSurpriseUsedAt(data.lastSurpriseUsedAt || null)
    }, () => {})
  }, [username])

  useEffect(() => {
    const tick = () => {
      const usedAt = surpriseTimestampToMs(surpriseUsedAt)
      setSurpriseRemainingMs(usedAt ? Math.max(0, SURPRISE_COOLDOWN_MS - (Date.now() - usedAt)) : 0)
    }
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [surpriseUsedAt])

  useEffect(() => {
    if (!username) {
      setLedgerEntries([])
      return undefined
    }

    const ref = doc(db, 'acr_ledger', username)
    return onSnapshot(ref, (snap) => {
      const data = snap.exists() ? snap.data() : {}
      setLedgerEntries(data.entries || [])
    }, () => setLedgerEntries([]))
  }, [username])

  useEffect(() => {
    if (!username) {
      setPlannerTasks([])
      return undefined
    }

    const plannerQuery = query(
      collection(db, 'acr_users', username, 'plannerTasks'),
      orderBy('createdAt', 'asc')
    )
    return onSnapshot(plannerQuery, (snap) => {
      setPlannerTasks(snap.docs.map((docSnap) => docSnap.data() || {}))
    }, () => setPlannerTasks([]))
  }, [username])

  useEffect(() => {
    let ignore = false

    const loadAstro = async () => {
      const result = await fetchAstroDoc(astroSnapshot.location, astroLang, getTodayIST())
      if (ignore) return
      const summary = extractAstroSummary(result?.data || null)
      setAstroSnapshot({
        location: astroSnapshot.location,
        title: summary.title,
        window: summary.window,
        festival: summary.festival,
        sunrise: summary.sunrise,
        sunset: summary.sunset,
      })
    }

    loadAstro()
    return () => { ignore = true }
  }, [astroSnapshot.location, astroLang])

  const navigate = (tab) => {
    setPrevTab(activeTab)
    setActiveTab(tab)
  }

  const surpriseLocked = surpriseRemainingMs > 0

  const dashboardSnapshot = useMemo(() => {
    const now = new Date()
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)

    const todayLogs = logs.filter((log) => sameDay(new Date(log.id), now))
    const yesterdayLogs = logs.filter((log) => sameDay(new Date(log.id), yesterday))
    const todaySpend = todayLogs.reduce((sum, log) => sum + Number(log.amount || 0), 0)
    const yesterdaySpend = yesterdayLogs.reduce((sum, log) => sum + Number(log.amount || 0), 0)
    const todayCategoryTotals = todayLogs.reduce((acc, log) => {
      acc[log.category] = (acc[log.category] || 0) + Number(log.amount || 0)
      return acc
    }, {})
    const topTodayCategory = Object.entries(todayCategoryTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || 'None'

    const dayTotals = logs.reduce((acc, log) => {
      const key = getDayKey(new Date(log.id))
      acc[key] = (acc[key] || 0) + Number(log.amount || 0)
      return acc
    }, {})
    const todayKey = getDayKey(now)
    const otherDays = Object.entries(dayTotals).filter(([key]) => key !== todayKey).map(([, total]) => total)
    const avgDaily = otherDays.length ? otherDays.reduce((sum, total) => sum + total, 0) / otherDays.length : 0
    const expenseTrend = yesterdaySpend > 0
      ? pctText(todaySpend, yesterdaySpend, 'yesterday')
      : avgDaily > 0
        ? pctText(todaySpend, avgDaily, 'avg')
        : 'No comparison yet'
    const expenseTrendBars = [
      Math.min(100, Math.max(14, avgDaily ? (todaySpend / Math.max(avgDaily, 1)) * 42 : todaySpend ? 32 : 16)),
      Math.min(100, Math.max(12, yesterdaySpend ? (yesterdaySpend / Math.max(todaySpend || yesterdaySpend, 1)) * 38 : 18)),
      Math.min(100, Math.max(18, todayLogs.length * 12)),
    ]

    const activeLedger = ledgerEntries.filter((entry) => !entry.settled)
    const totalReceivable = activeLedger
      .filter((entry) => entry.type === 'lent')
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0)
    const overdueCount = activeLedger.filter((entry) => entry.dueDate && entry.dueDate < todayKey).length
    const dueTodayCount = activeLedger.filter((entry) => entry.dueDate === todayKey).length

    const plannedTasks = plannerTasks.filter((task) => !task.isInbox)
    const todayPlannerTasks = plannedTasks.filter((task) => task.date === todayKey)
    const pendingToday = todayPlannerTasks.filter((task) => !task.completed).length
    const doneToday = todayPlannerTasks.filter((task) => task.completed).length
    const nextTask = plannedTasks
      .filter((task) => !task.completed && task.date)
      .sort((a, b) => {
        const ad = `${a.date || ''} ${a.time || '99:99'}`
        const bd = `${b.date || ''} ${b.time || '99:99'}`
        return ad.localeCompare(bd)
      })
      .find((task) => task.date > todayKey || (task.date === todayKey && (!task.time || task.time >= `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`)))

    const taskDays = new Set(plannedTasks.filter((task) => task.date).map((task) => task.date))
    let streak = 0
    for (let i = 0; i < 30; i++) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const key = getDayKey(d)
      if (taskDays.has(key)) streak += 1
      else break
    }

    const completedPlannerCount = plannedTasks.filter((task) => task.completed).length
    const plannerPct = plannedTasks.length ? Math.round((completedPlannerCount / plannedTasks.length) * 100) : 0

    const sunriseMinutes = toMinutes(astroSnapshot.sunrise)
    const sunsetMinutes = toMinutes(astroSnapshot.sunset)
    const nowMinutes = now.getHours() * 60 + now.getMinutes()
    let astroDayPct = 0
    if (sunriseMinutes !== null && sunsetMinutes !== null && sunsetMinutes > sunriseMinutes) {
      astroDayPct = Math.max(0, Math.min(100, ((nowMinutes - sunriseMinutes) / (sunsetMinutes - sunriseMinutes)) * 100))
    }

    return {
      expenses: {
        value: todaySpend,
        lines: [
          `${todayLogs.length} entr${todayLogs.length === 1 ? 'y' : 'ies'} today`,
          `Top: ${topTodayCategory}`,
          todayLogs.length ? expenseTrend : 'No entries today',
        ],
        trendBars: expenseTrendBars,
      },
      ledger: {
        value: totalReceivable,
        lines: [
          'To receive',
          overdueCount ? `${overdueCount} overdue` : 'No overdue items',
          dueTodayCount ? `${dueTodayCount} due today` : 'Nothing due today',
        ],
        dots: [totalReceivable > 0 ? 1 : 0, overdueCount > 0 ? 1 : 0, dueTodayCount > 0 ? 1 : 0],
      },
      planner: {
        value: `${pendingToday} pending`,
        lines: [
          `${doneToday} done today`,
          `Next: ${nextTask?.title || 'No next task'}`,
          streak ? `${streak}-day streak` : 'No streak yet',
        ],
        pct: plannerPct,
      },
      astro: {
        value: astroSnapshot.title,
        window: astroSnapshot.window,
        festival: astroSnapshot.festival,
        location: astroSnapshot.location,
        lines: [
          astroSnapshot.window,
          astroSnapshot.location,
          astroSnapshot.festival,
        ],
        sunrise: formatShortTime(astroSnapshot.sunrise),
        sunset: formatShortTime(astroSnapshot.sunset),
        dayPct: astroDayPct,
      },
    }
  }, [logs, ledgerEntries, plannerTasks, astroSnapshot])

  const handleAstroLocationChange = (location) => {
    localStorage.setItem('acr_astro_location', location)
    setAstroSnapshot((prev) => ({
      ...prev,
      location,
    }))
  }

  const quickActions = [
    { id: 'market', icon: '📰', label: 'News', sub: 'Briefing', accent: '#2563EB', bg: '#EEF4FF' },
    { id: 'chat', icon: '🤖', label: 'AI Chat', sub: 'Ask anything', accent: '#0F766E', bg: '#ECFEFF' },
    { id: 'cricket', icon: '🏏', label: 'IPL', sub: 'Predictions', accent: '#7C3AED', bg: '#F5F3FF' },
    { id: 'profile', icon: '👤', label: 'Profile', sub: 'Account', accent: '#EA580C', bg: '#FFF7ED' },
  ]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=Syne:wght@700;800&display=swap');
        .home-premium-root * { font-family:'Poppins',sans-serif; box-sizing:border-box; }
        .home-premium-root .home-syne { font-family:'Syne',sans-serif; }
        .home-premium-root {
          min-height:100vh;
          width:100%;
          max-width:760px;
          margin:0 auto;
          padding:8px 12px 22px;
          background:
            radial-gradient(circle at 10% -10%, rgba(124,58,237,0.12), transparent 26%),
            radial-gradient(circle at 100% 0%, rgba(14,165,233,0.10), transparent 24%),
            linear-gradient(180deg,#FCFDFE 0%,#F4F7FB 42%,#EEF3F8 100%);
          color:#0f172a;
        }
        .home-shell { display:flex; flex-direction:column; gap:10px; }
        .home-header {
          display:flex; align-items:center; justify-content:space-between; gap:10px;
          padding:6px 0 0;
        }
        .home-brand {
          display:flex; align-items:center; gap:10px; min-width:0; flex:1 1 auto;
        }
        .home-brand img {
          width:38px; height:38px; border-radius:14px; object-fit:cover;
          border:1px solid rgba(124,58,237,0.18);
          box-shadow:0 10px 20px rgba(124,58,237,0.12);
          flex-shrink:0;
        }
        .home-brand-title { font-size:15px; font-weight:800; color:#0f172a; margin:0; line-height:1.05; }
        .home-brand-sub { font-size:10px; color:#64748b; margin:2px 0 0; font-weight:600; }
        .home-header-right { display:flex; align-items:center; gap:8px; flex-shrink:0; }
        .home-time {
          font-size:11px; font-weight:700; color:#64748b; text-align:right; line-height:1.2;
        }
        .home-coin-pill {
          border:none; cursor:pointer; border-radius:999px; padding:8px 12px;
          background:linear-gradient(135deg,#FFF7CC,#FDE68A);
          color:#92400e; font-size:12px; font-weight:800;
          box-shadow:0 10px 22px rgba(217,119,6,0.12), inset 0 1px 0 rgba(255,255,255,0.8);
        }
        .home-dashboard-grid {
          display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px;
        }
        .home-dashboard-card {
          position:relative; overflow:hidden;
          width:100%; border-radius:20px; padding:10px 10px 10px; border:none; text-align:left;
          transition:transform 0.16s ease, box-shadow 0.16s ease, filter 0.16s ease; cursor:pointer;
          min-height:152px;
        }
        .home-dashboard-card:hover { filter:saturate(1.04); }
        .home-dashboard-card > * { position:relative; z-index:1; }
        .home-card-glow, .home-card-haze, .home-card-gloss {
          position:absolute; pointer-events:none; z-index:0;
        }
        .home-card-glow {
          width:88px; height:88px; left:-16px; top:-14px; border-radius:999px; filter:blur(2px);
        }
        .home-card-haze {
          width:84px; height:84px; right:-18px; top:-10px; border-radius:999px; filter:blur(1px);
        }
        .home-card-gloss {
          left:8px; right:8px; top:0; height:44px; border-radius:18px 18px 28px 28px; opacity:0.82;
        }
        .home-card-stars {
          position:absolute; inset:0; pointer-events:none; z-index:0;
        }
        .home-card-stars i {
          position:absolute; width:4px; height:4px; border-radius:999px;
          background:rgba(255,255,255,0.95); box-shadow:0 0 10px rgba(191,219,254,0.9);
        }
        .home-card-stars i:nth-child(1) { top:16px; right:46px; }
        .home-card-stars i:nth-child(2) { top:34px; right:22px; width:3px; height:3px; opacity:0.75; }
        .home-card-stars i:nth-child(3) { top:54px; right:58px; width:2px; height:2px; opacity:0.7; }
        .home-astro-card {
          min-height:152px;
        }
        .home-astro-card::after {
          content:''; position:absolute; inset:auto 14px 14px auto; width:62px; height:62px; border-radius:999px;
          background:radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0) 70%);
          opacity:0.8; pointer-events:none; z-index:0;
        }
        .home-card-top { display:flex; align-items:center; justify-content:space-between; margin-bottom:7px; }
        .home-card-icon {
          width:30px; height:30px; border-radius:10px; display:flex; align-items:center; justify-content:center;
          font-size:15px; font-weight:800; box-shadow:inset 0 1px 0 rgba(255,255,255,0.88), 0 10px 20px rgba(255,255,255,0.24);
        }
        .home-astro-card-icon {
          box-shadow:inset 0 1px 0 rgba(255,255,255,0.94), 0 8px 18px rgba(99,102,241,0.10);
        }
        .home-astro-card-top-right {
          display:flex; align-items:center; gap:6px;
        }
        .home-astro-live-pill {
          padding:4px 7px; border-radius:999px; font-size:9px; font-weight:800; letter-spacing:0.06em; text-transform:uppercase;
          color:#4F46E5; background:rgba(255,255,255,0.68); border:1px solid rgba(99,102,241,0.12);
          box-shadow:inset 0 1px 0 rgba(255,255,255,0.92);
        }
        .home-astro-card-heading {
          display:flex; align-items:flex-start; justify-content:space-between; gap:8px; margin-bottom:5px;
        }
        .home-astro-primary {
          font-size:18px; line-height:1.05; font-weight:800; color:#312E81;
        }
        .home-astro-meta-badge {
          flex-shrink:0; display:flex; flex-direction:column; align-items:center; gap:2px;
          min-width:54px; padding:6px 7px; border-radius:14px;
          background:rgba(255,255,255,0.62); border:1px solid rgba(99,102,241,0.12);
          box-shadow:inset 0 1px 0 rgba(255,255,255,0.94);
        }
        .home-astro-meta-badge span { font-size:13px; line-height:1; }
        .home-astro-meta-badge small {
          font-size:8.5px; line-height:1.15; color:#6366F1; font-weight:800; text-align:center;
        }
        .home-astro-card-window {
          margin:0 0 6px; font-size:10.5px; line-height:1.3; font-weight:700; color:#475569;
          display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;
        }
        .home-astro-card-inline {
          display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:6px; margin-bottom:7px;
        }
        .home-astro-card-chip {
          display:flex; flex-direction:column; gap:2px; padding:6px 7px; border-radius:12px;
          background:rgba(255,255,255,0.58); border:1px solid rgba(99,102,241,0.10);
        }
        .home-astro-card-chip span {
          font-size:8.5px; font-weight:800; text-transform:uppercase; letter-spacing:0.05em; color:#818CF8;
        }
        .home-astro-card-chip strong {
          font-size:10px; line-height:1.2; color:#334155; font-weight:750;
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        }
        .home-astro-card-footer {
          display:flex; align-items:center; justify-content:flex-start;
        }
        .home-astro-location-wrap {
          display:flex; align-items:center; gap:6px; min-width:0;
          padding:5px 7px; border-radius:12px; background:rgba(255,255,255,0.62);
          border:1px solid rgba(99,102,241,0.12); box-shadow:inset 0 1px 0 rgba(255,255,255,0.94);
        }
        .home-astro-location-label {
          font-size:8.5px; font-weight:800; text-transform:uppercase; letter-spacing:0.06em; color:#818CF8;
        }
        .home-astro-location-select {
          border:none; background:transparent; color:#312E81; font-size:10px; font-weight:800; outline:none;
          max-width:90px; appearance:none; cursor:pointer;
        }
        .home-astro-location-select option { color:#0f172a; }
        .home-card-chev { font-size:18px; font-weight:700; line-height:1; opacity:0.75; }
        .home-card-title { font-size:10px; font-weight:800; color:#475569; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:3px; }
        .home-card-primary {
          font-size:19px; font-weight:800; line-height:1.02; margin-bottom:5px;
        }
        .home-card-lines { display:flex; flex-direction:column; gap:3px; }
        .home-card-lines p {
          margin:0; font-size:10px; line-height:1.24; color:#64748b; font-weight:650;
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        }
        .home-mini-visual {
          margin-bottom:6px;
        }
        .home-mini-visual--spark {
          height:26px; display:flex; align-items:center;
        }
        .home-mini-spark-svg {
          width:56px; height:26px; overflow:visible;
          filter: drop-shadow(0 3px 8px rgba(15,23,42,0.08));
        }
        .home-mini-visual--dots {
          display:flex; align-items:center; gap:5px; min-height:18px;
        }
        .home-status-dot {
          width:8px; height:8px; border-radius:999px; transition:all 0.18s ease;
          box-shadow:0 0 0 3px rgba(255,255,255,0.75);
        }
        .home-mini-visual--progress {
          min-height:18px; display:flex; align-items:center;
        }
        .home-mini-progress-track {
          width:64px; height:6px; border-radius:999px; background:rgba(148,163,184,0.18); overflow:hidden;
        }
        .home-mini-progress-fill {
          height:100%; border-radius:999px; transition:width 0.4s ease;
        }
        .home-astro-strip {
          position:relative; overflow:hidden;
          display:flex; align-items:center; gap:10px; padding:8px 10px;
          border-radius:18px;
          background:
            radial-gradient(circle at 88% 24%, rgba(196,181,253,0.12), transparent 26%),
            linear-gradient(145deg,rgba(255,255,255,0.9),rgba(242,247,255,0.96));
          border:1px solid rgba(99,102,241,0.1);
          box-shadow:0 10px 24px rgba(99,102,241,0.06), inset 0 1px 0 rgba(255,255,255,0.92);
        }
        .home-astro-strip::before {
          content:''; position:absolute; left:-10px; top:-14px; width:72px; height:72px; border-radius:999px;
          background:radial-gradient(circle, rgba(191,219,254,0.22), rgba(191,219,254,0) 70%);
          pointer-events:none;
        }
        .home-astro-strip-icon {
          width:30px; height:30px; border-radius:10px; flex-shrink:0;
          display:flex; align-items:center; justify-content:center;
          background:linear-gradient(145deg,#FFFFFF,#EEF2FF); color:#4F46E5; font-size:15px;
          box-shadow:0 8px 18px rgba(99,102,241,0.12);
        }
        .home-astro-strip-copy {
          min-width:0; flex:1 1 auto; display:flex; flex-direction:column; gap:2px;
        }
        .home-astro-strip-copy p {
          margin:0; font-size:10px; color:#64748b; font-weight:700;
        }
        .home-astro-strip-copy .home-astro-strip-title {
          font-size:10px; color:#6366F1; text-transform:uppercase; letter-spacing:0.08em; font-weight:800;
        }
        .home-astro-strip-copy .home-astro-strip-times {
          font-size:11px; color:#0f172a; font-weight:800;
        }
        .home-astro-strip-progress {
          width:100%; height:5px; border-radius:999px; background:rgba(99,102,241,0.12); overflow:hidden; margin-top:2px;
        }
        .home-astro-strip-progress > span {
          display:block; height:100%; border-radius:999px; background:linear-gradient(90deg,#A78BFA,#60A5FA);
        }
        .home-feature-row {
          display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px;
        }
        .home-feature-card {
          width:100%; border:none; cursor:pointer; text-align:left;
          border-radius:18px; padding:11px 11px; color:#fff;
          background:linear-gradient(145deg,#0f172a,#14233f 58%,#1e3a5f 100%);
          box-shadow:0 18px 34px rgba(15,23,42,0.22), inset 0 1px 0 rgba(255,255,255,0.06);
          display:flex; align-items:center; gap:10px; min-height:80px;
          transition:transform 0.16s ease, box-shadow 0.16s ease;
        }
        .home-feature-card:active, .home-quick-card:active { transform:scale(0.98); }
        .home-feature-icon {
          width:38px; height:38px; border-radius:14px; flex-shrink:0;
          display:flex; align-items:center; justify-content:center; font-size:18px;
          background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.10);
        }
        .home-feature-copy { min-width:0; flex:1 1 auto; }
        .home-feature-copy p { margin:0; font-size:14px; font-weight:800; color:#fff; }
        .home-feature-copy span { display:block; margin-top:2px; font-size:10.5px; color:rgba(226,232,240,0.78); font-weight:600; }
        .home-feature-pill {
          flex-shrink:0; padding:6px 10px; border-radius:999px;
          background:linear-gradient(135deg,#6366F1,#8B5CF6); color:#fff; font-size:10px; font-weight:800;
          box-shadow:0 8px 18px rgba(99,102,241,0.26);
        }
        .home-section {
          background:linear-gradient(145deg,rgba(255,255,255,0.88),rgba(244,247,251,0.9));
          border:1px solid rgba(148,163,184,0.16);
          border-radius:20px; padding:11px;
          box-shadow:0 12px 28px rgba(15,23,42,0.07), inset 0 1px 0 rgba(255,255,255,0.92);
        }
        .home-section-head {
          display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px;
        }
        .home-section-head p {
          margin:0; font-size:11px; font-weight:800; color:#475569; text-transform:uppercase; letter-spacing:0.08em;
        }
        .home-quick-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
        .home-quick-card {
          border:none; cursor:pointer; text-align:left; border-radius:16px; padding:10px;
          background:#fff; box-shadow:0 10px 24px rgba(15,23,42,0.06), inset 0 1px 0 rgba(255,255,255,0.92);
          transition:transform 0.16s ease, box-shadow 0.16s ease;
        }
        .home-quick-top { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px; }
        .home-quick-icon {
          width:34px; height:34px; border-radius:12px; display:flex; align-items:center; justify-content:center;
          font-size:17px; font-weight:800;
        }
        .home-quick-title { margin:0; font-size:13px; font-weight:800; color:#0f172a; }
        .home-quick-sub { margin:3px 0 0; font-size:10.5px; font-weight:650; color:#64748b; }
        @media (max-width: 640px) {
          .home-premium-root { padding:8px 10px 20px; }
          .home-card-primary { font-size:18px; }
          .home-dashboard-card { min-height:146px; }
          .home-astro-primary { font-size:17px; }
          .home-astro-location-select { max-width:82px; }
          .home-feature-card { min-height:76px; padding:10px; }
          .home-shell { gap:9px; }
        }
      `}</style>

      <div className="home-premium-root">
        <div className="home-shell">
          <div className="home-header">
            <div className="home-brand">
              <img src="/logo.jpg" alt="ACR MAX" />
              <div style={{ minWidth: 0 }}>
                <p className="home-brand-title home-syne">ACR MAX</p>
                <p className="home-brand-sub">{greeting.emoji} {greeting.text}, {displayName}</p>
              </div>
            </div>

            <div className="home-header-right">
              <div className="home-time">
                <div>{time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
                <div>{time.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
              </div>
              <button className="home-coin-pill" onClick={() => navigate('coins')}>
                🪙 {Number(coins || 0).toLocaleString('en-IN')}
              </button>
            </div>
          </div>

          <div className="home-dashboard-grid">
            <DashboardCard
              title="Expenses"
              icon="₹"
              accent="#D97706"
              bg="#FFF8EE"
              primary={dashboardSnapshot.expenses.value}
              primaryPrefix="₹"
              animated
              lines={dashboardSnapshot.expenses.lines}
              microVisual={<MiniTrend accent="#D97706" points={dashboardSnapshot.expenses.trendBars} />}
              tone="expenses"
              onClick={() => navigate('expense')}
            />
            <DashboardCard
              title="Ledger"
              icon="🤝"
              accent="#059669"
              bg="#F2FBF7"
              primary={dashboardSnapshot.ledger.value}
              primaryPrefix="₹"
              animated
              lines={dashboardSnapshot.ledger.lines}
              microVisual={<MiniDots accent="#059669" values={dashboardSnapshot.ledger.dots} />}
              tone="ledger"
              onClick={() => navigate('ledger')}
            />
            <DashboardCard
              title="Planner"
              icon="🗓️"
              accent="#7C3AED"
              bg="#F7F4FF"
              primary={dashboardSnapshot.planner.value}
              lines={dashboardSnapshot.planner.lines}
              microVisual={<MiniProgress accent="#7C3AED" pct={dashboardSnapshot.planner.pct} />}
              tone="planner"
              onClick={() => navigate('planner')}
            />
            <AstroCard
              snapshot={dashboardSnapshot.astro}
              onOpen={() => navigate('astro')}
              onLocationChange={handleAstroLocationChange}
            />
{/*
            <DashboardCard
              title="Astro"
              icon="✦"
              accent="#2563EB"
              bg="#F2F7FF"
              primary={dashboardSnapshot.astro.value}
              lines={dashboardSnapshot.astro.lines}
              microVisual={<MiniProgress accent="#2563EB" pct={dashboardSnapshot.astro.dayPct} />}
              tone="astro"
              onClick={() => navigate('astro')}
            />
*/}
          </div>

          <div className="home-astro-strip">
            <div className="home-astro-strip-icon">✦</div>
            <div className="home-astro-strip-copy">
              <p className="home-astro-strip-title">Sun Cycle · {dashboardSnapshot.astro.location}</p>
              <p className="home-astro-strip-times">{dashboardSnapshot.astro.sunrise} sunrise · {dashboardSnapshot.astro.sunset} sunset</p>
              <div className="home-astro-strip-progress">
                <span style={{ width: `${Math.max(4, dashboardSnapshot.astro.dayPct)}%` }} />
              </div>
            </div>
          </div>

          <div className="home-feature-row">
            <FeatureCard
              title="Skill"
              subtitle="Puzzles, streaks and coin rewards"
              pill="Play"
              icon="⚡"
              onClick={() => setSkillOpen(true)}
            />
            <FeatureCard
              title="Surprises"
              subtitle={surpriseLocked ? `Next in ${formatSurpriseCountdown(surpriseRemainingMs)}` : 'Fresh cards available'}
              pill={surpriseLocked ? 'Locked' : 'Open'}
              icon="🎁"
              onClick={() => setSurprisesOpen(true)}
            />
          </div>

          <div className="home-section">
            <div className="home-section-head">
              <p>Quick Actions</p>
              <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700 }}>Open fast</span>
            </div>

            <div className="home-quick-grid">
              {quickActions.map((action) => (
                <button
                  key={action.id}
                  className="home-quick-card"
                  onClick={() => navigate(action.id)}
                >
                  <div className="home-quick-top">
                    <div className="home-quick-icon" style={{ color: action.accent, background: action.bg }}>
                      {action.icon}
                    </div>
                    <span style={{ color: action.accent, fontSize: 18, fontWeight: 700 }}>›</span>
                  </div>
                  <p className="home-quick-title">{action.label}</p>
                  <p className="home-quick-sub">{action.sub}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        <SkillMachineModal
          userId={currentUser?.username}
          isOpen={skillOpen}
          onClose={() => setSkillOpen(false)}
          coins={coins}
          onReward={async (reward) => {
            if (reward?.coins > 0) {
              addCoinLog?.({
                amount: reward.coins,
                source: 'skill',
                createdAt: Date.now(),
              })
              if (username) {
                try {
                  await updateDoc(doc(db, 'acr_users', username), {
                    coins: increment(reward.coins),
                  })
                } catch {}
              }
            }
          }}
        />

        <SurprisesModal
          isOpen={surprisesOpen}
          onClose={() => setSurprisesOpen(false)}
          currentUser={currentUser}
          coins={coins}
        />
      </div>
    </>
  )
}
