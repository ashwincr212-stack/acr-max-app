import { useState, useEffect, useMemo, useRef } from 'react'
import SurprisesModal from './SurprisesModal'
import SkillMachineModal from './SkillMachine'
import { db } from '../firebase'
import { collection, query, orderBy, onSnapshot, doc, updateDoc, increment } from 'firebase/firestore'
import { fetchAstroDoc, getTodayIST } from './astroHelpers'

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
  }
}

function DashboardCard({ title, icon, accent, bg, primary, lines, onClick, animated, primaryPrefix = '' }) {
  const [pressed, setPressed] = useState(false)

  return (
    <button
      onClick={onClick}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      className="home-dashboard-card"
      style={{
        background: `linear-gradient(145deg, #ffffff 0%, ${bg} 100%)`,
        border: `1px solid ${accent}22`,
        boxShadow: pressed
          ? 'inset 2px 2px 7px rgba(15,23,42,0.08), inset -1px -1px 4px rgba(255,255,255,0.85)'
          : '0 12px 28px rgba(15,23,42,0.08), 0 1px 0 rgba(255,255,255,0.9) inset',
        transform: pressed ? 'scale(0.98)' : 'translateY(0)',
      }}
    >
      <div className="home-card-top">
        <div className="home-card-icon" style={{ background: `${accent}14`, color: accent }}>
          {icon}
        </div>
        <div className="home-card-chev" style={{ color: accent }}>›</div>
      </div>
      <div className="home-card-title">{title}</div>
      <div className="home-card-primary" style={{ color: accent }}>
        {animated ? <CountUp value={primary} prefix={primaryPrefix} /> : primary}
      </div>
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
  })

  const username = currentUser?.username?.toLowerCase?.() || ''
  const displayName = currentUser?.name || currentUser?.username || 'User'

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
      const location = localStorage.getItem('acr_astro_location') || 'Chennai'
      const lang = localStorage.getItem('acr_astro_lang') || 'en'
      const result = await fetchAstroDoc(location, lang, getTodayIST())
      if (ignore) return
      const summary = extractAstroSummary(result?.data || null)
      setAstroSnapshot({
        location,
        title: summary.title,
        window: summary.window,
        festival: summary.festival,
      })
    }

    loadAstro()
    return () => { ignore = true }
  }, [])

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

    return {
      expenses: {
        value: todaySpend,
        lines: [
          `${todayLogs.length} entr${todayLogs.length === 1 ? 'y' : 'ies'} today`,
          `Top: ${topTodayCategory}`,
          todayLogs.length ? expenseTrend : 'No entries today',
        ],
      },
      ledger: {
        value: totalReceivable,
        lines: [
          'To receive',
          overdueCount ? `${overdueCount} overdue` : 'No overdue items',
          dueTodayCount ? `${dueTodayCount} due today` : 'Nothing due today',
        ],
      },
      planner: {
        value: `${pendingToday} pending`,
        lines: [
          `${doneToday} done today`,
          `Next: ${nextTask?.title || 'No next task'}`,
          streak ? `${streak}-day streak` : 'No streak yet',
        ],
      },
      astro: {
        value: astroSnapshot.title,
        lines: [
          astroSnapshot.window,
          astroSnapshot.location,
          astroSnapshot.festival,
        ],
      },
    }
  }, [logs, ledgerEntries, plannerTasks, astroSnapshot])

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
          padding:8px 10px 26px;
          background:
            radial-gradient(circle at 10% -10%, rgba(124,58,237,0.12), transparent 26%),
            radial-gradient(circle at 100% 0%, rgba(14,165,233,0.10), transparent 24%),
            linear-gradient(180deg,#FCFDFE 0%,#F4F7FB 42%,#EEF3F8 100%);
          color:#0f172a;
        }
        .home-shell { display:flex; flex-direction:column; gap:12px; }
        .home-header {
          display:flex; align-items:center; justify-content:space-between; gap:10px;
          padding:8px 2px 2px;
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
          display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px;
        }
        .home-dashboard-card {
          width:100%; border-radius:22px; padding:12px 12px 13px; border:none; text-align:left;
          transition:transform 0.16s ease, box-shadow 0.16s ease; cursor:pointer;
        }
        .home-card-top { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
        .home-card-icon {
          width:34px; height:34px; border-radius:12px; display:flex; align-items:center; justify-content:center;
          font-size:17px; font-weight:800;
        }
        .home-card-chev { font-size:21px; font-weight:700; line-height:1; opacity:0.75; }
        .home-card-title { font-size:11px; font-weight:800; color:#475569; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:4px; }
        .home-card-primary {
          font-size:22px; font-weight:800; line-height:1.05; margin-bottom:8px;
        }
        .home-card-lines { display:flex; flex-direction:column; gap:4px; }
        .home-card-lines p {
          margin:0; font-size:10.5px; line-height:1.3; color:#64748b; font-weight:650;
        }
        .home-feature-row {
          display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px;
        }
        .home-feature-card {
          width:100%; border:none; cursor:pointer; text-align:left;
          border-radius:20px; padding:12px 12px; color:#fff;
          background:linear-gradient(145deg,#0f172a,#14233f 58%,#1e3a5f 100%);
          box-shadow:0 18px 34px rgba(15,23,42,0.22), inset 0 1px 0 rgba(255,255,255,0.06);
          display:flex; align-items:center; gap:10px; min-height:86px;
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
          border-radius:22px; padding:12px;
          box-shadow:0 12px 28px rgba(15,23,42,0.07), inset 0 1px 0 rgba(255,255,255,0.92);
        }
        .home-section-head {
          display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:10px;
        }
        .home-section-head p {
          margin:0; font-size:11px; font-weight:800; color:#475569; text-transform:uppercase; letter-spacing:0.08em;
        }
        .home-quick-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:9px; }
        .home-quick-card {
          border:none; cursor:pointer; text-align:left; border-radius:18px; padding:11px;
          background:#fff; box-shadow:0 10px 24px rgba(15,23,42,0.06), inset 0 1px 0 rgba(255,255,255,0.92);
          transition:transform 0.16s ease, box-shadow 0.16s ease;
        }
        .home-quick-top { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:10px; }
        .home-quick-icon {
          width:34px; height:34px; border-radius:12px; display:flex; align-items:center; justify-content:center;
          font-size:17px; font-weight:800;
        }
        .home-quick-title { margin:0; font-size:13px; font-weight:800; color:#0f172a; }
        .home-quick-sub { margin:3px 0 0; font-size:10.5px; font-weight:650; color:#64748b; }
        @media (max-width: 640px) {
          .home-premium-root { padding:8px 8px 22px; }
          .home-card-primary { font-size:20px; }
          .home-feature-card { min-height:80px; padding:11px; }
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
              onClick={() => navigate('ledger')}
            />
            <DashboardCard
              title="Planner"
              icon="🗓️"
              accent="#7C3AED"
              bg="#F7F4FF"
              primary={dashboardSnapshot.planner.value}
              lines={dashboardSnapshot.planner.lines}
              onClick={() => navigate('planner')}
            />
            <DashboardCard
              title="Astro"
              icon="✦"
              accent="#2563EB"
              bg="#F2F7FF"
              primary={dashboardSnapshot.astro.value}
              lines={dashboardSnapshot.astro.lines}
              onClick={() => navigate('astro')}
            />
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
