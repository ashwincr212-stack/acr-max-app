import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useEffect, useMemo, useRef, useState } from 'react'

const BUDGET_DEFAULTS = {
  Food: 2000,
  Petrol: 1500,
  Smoke: 500,
  Liquor: 1000,
  'Electricity Bill': 2000,
  'Water Bill': 500,
  'Mobile Recharge': 300,
  Groceries: 3000,
  Vegetables: 1200,
  Snacks: 800,
  CSD: 1000,
  'Hotel Food': 1500,
  Other: 1000,
}

const CAT_ICONS = {
  Food: '🍽',
  Petrol: '⛽',
  Smoke: '🚬',
  Liquor: '🍺',
  Groceries: '🛒',
  Vegetables: '🥬',
  Snacks: '🍪',
  'Mobile Recharge': '📱',
  'Electricity Bill': '⚡',
  'Water Bill': '💧',
  'Hotel Food': '🏨',
  CSD: '🏪',
  Other: '💸',
}

const CAT_COLORS = {
  Food: '#f59e0b',
  Petrol: '#2563eb',
  Smoke: '#64748b',
  Liquor: '#8b5cf6',
  Groceries: '#16a34a',
  Vegetables: '#22c55e',
  Snacks: '#f97316',
  'Mobile Recharge': '#0891b2',
  'Electricity Bill': '#d97706',
  'Water Bill': '#06b6d4',
  'Hotel Food': '#ef4444',
  CSD: '#7c3aed',
  Other: '#64748b',
}

const TABS = [
  { id: 'daily', label: '📝 Logs' },
  { id: 'overview', label: '👀 Overview' },
  { id: 'summary', label: '📊 Analytics' },
  { id: 'budget', label: '🎯 Budgets' },
  { id: 'trends', label: '📈 Trends' },
  { id: 'ai', label: '🧠 AI Brain' },
]

const DAY_MS = 86400000
const SMALL_SPEND_THRESHOLD = 100

const fmt = (n) => `₹${Math.round(Number(n || 0)).toLocaleString('en-IN')}`
const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

const toMillis = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? 0 : parsed
  }
  if (typeof value?.toMillis === 'function') return value.toMillis()
  if (typeof value?.seconds === 'number') return value.seconds * 1000
  return 0
}

const getStartOfDay = (value = new Date()) => {
  const date = value instanceof Date ? new Date(value) : new Date(toMillis(value) || Date.now())
  date.setHours(0, 0, 0, 0)
  return date
}

const isSameDay = (a, b) => getStartOfDay(a).getTime() === getStartOfDay(b).getTime()

const normalizeText = (value = '') =>
  String(value).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

const shortCategory = (name = '') =>
  name
    .replace('Electricity Bill', 'Power')
    .replace('Water Bill', 'Water')
    .replace('Mobile Recharge', 'Recharge')
    .replace('Hotel Food', 'Hotel')
    .replace('Vegetables', 'Veg')

const normalizeLog = (log = {}) => {
  const amount = Number(log.amount || 0)
  const millis =
    toMillis(log.createdAt) ||
    toMillis(log.timestamp) ||
    toMillis(log.date) ||
    toMillis(log.id) ||
    Date.now()
  const date = new Date(millis)
  return {
    ...log,
    amount,
    category: log.category || 'Other',
    note: log.note || log.title || log.description || '',
    color: log.color || CAT_COLORS[log.category] || CAT_COLORS.Other,
    paymentMode: log.paymentMode || '',
    millis,
    date,
    timeLabel:
      log.time ||
      date.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      }),
  }
}

const groupByCategory = (logs) =>
  logs.reduce((acc, log) => {
    const key = log.category || 'Other'
    if (!acc[key]) {
      acc[key] = {
        name: key,
        total: 0,
        entries: 0,
        color: CAT_COLORS[key] || log.color || CAT_COLORS.Other,
      }
    }
    acc[key].total += Number(log.amount || 0)
    acc[key].entries += 1
    return acc
  }, {})

const getTopCategories = (logs, limit = 6) => {
  const rows = Object.values(groupByCategory(logs)).sort((a, b) => b.total - a.total)
  if (rows.length <= limit) return rows
  const head = rows.slice(0, limit)
  const tail = rows.slice(limit)
  return [
    ...head,
    {
      name: 'Other',
      total: tail.reduce((sum, row) => sum + row.total, 0),
      entries: tail.reduce((sum, row) => sum + row.entries, 0),
      color: '#94a3b8',
    },
  ]
}

const getMonthStats = (logs, budgets) => {
  const now = new Date()
  const currentMonthLogs = logs.filter(
    (log) => log.date.getMonth() === now.getMonth() && log.date.getFullYear() === now.getFullYear()
  )
  const today = getStartOfDay(now)
  const yesterday = new Date(today.getTime() - DAY_MS)
  const categoryTotals = groupByCategory(currentMonthLogs)
  const totalSpent = currentMonthLogs.reduce((sum, log) => sum + log.amount, 0)
  const todaySpent = currentMonthLogs
    .filter((log) => isSameDay(log.date, today))
    .reduce((sum, log) => sum + log.amount, 0)
  const yesterdaySpent = currentMonthLogs
    .filter((log) => isSameDay(log.date, yesterday))
    .reduce((sum, log) => sum + log.amount, 0)
  const totalEntries = currentMonthLogs.length
  const topCategoryRow = Object.values(categoryTotals).sort((a, b) => b.total - a.total)[0] || null
  const monthlyBudget = Object.values(budgets || {}).reduce((sum, value) => sum + Number(value || 0), 0)
  const monthlyBudgetUsed = monthlyBudget > 0 ? (totalSpent / monthlyBudget) * 100 : 0
  const overBudgetCategories = Object.values(categoryTotals)
    .filter((row) => budgets?.[row.name] && row.total > budgets[row.name])
    .map((row) => ({
      ...row,
      budget: budgets[row.name],
      overBy: row.total - budgets[row.name],
    }))
    .sort((a, b) => b.overBy - a.overBy)

  return {
    now,
    currentMonthLogs,
    categoryTotals,
    totalSpent,
    totalEntries,
    todaySpent,
    yesterdaySpent,
    topCategoryRow,
    monthlyBudget,
    monthlyBudgetUsed,
    overBudgetCategories,
  }
}

const calculateProjection = ({ totalSpent, monthlyBudget, now, totalEntries }) => {
  const dayOfMonth = now.getDate()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const averageDailySpend = dayOfMonth > 0 ? totalSpent / dayOfMonth : 0
  const projectedSpend = averageDailySpend * daysInMonth
  const projectedDelta = projectedSpend - monthlyBudget
  const confidence =
    totalEntries < 4 || dayOfMonth < 5 ? 'Low' : dayOfMonth < 15 ? 'Medium' : 'High'
  return { dayOfMonth, daysInMonth, averageDailySpend, projectedSpend, projectedDelta, confidence }
}

const calculateBurnRate = ({ averageDailySpend, monthlyBudget, daysInMonth }) => {
  const idealDailyBudget = daysInMonth > 0 ? monthlyBudget / daysInMonth : 0
  const burnRate = idealDailyBudget > 0 ? averageDailySpend / idealDailyBudget : 0
  const message =
    burnRate > 1.15
      ? 'At this speed, budget may end early.'
      : burnRate < 0.9
        ? 'You are spending slower than planned.'
        : 'You are moving close to the planned pace.'
  return { idealDailyBudget, burnRate, message }
}

const calculateSafeSpend = ({ monthlyBudget, totalSpent, todaySpent, now }) => {
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const hasBudget = monthlyBudget > 0
  const baseDailyLimit = hasBudget && daysInMonth > 0 ? monthlyBudget / daysInMonth : 0
  const budgetBalance = hasBudget ? monthlyBudget - totalSpent : 0
  const daysLeftIncludingToday = Math.max(daysInMonth - now.getDate() + 1, 1)
  const canSpendDaily =
    hasBudget && budgetBalance > 0 ? budgetBalance / daysLeftIncludingToday : 0
  const todayDifference = canSpendDaily - todaySpent
  const safeSpendToday = canSpendDaily
  return {
    hasBudget,
    daysInMonth,
    baseDailyLimit,
    budgetBalance,
    daysLeftIncludingToday,
    canSpendDaily,
    dailySpendableAmount: canSpendDaily,
    todayDifference,
    remainingBudget: budgetBalance,
    remainingDays: daysLeftIncludingToday,
    safeSpendToday,
    message: hasBudget ? `${fmt(canSpendDaily)}/day` : 'Set budget',
    sub: hasBudget ? 'To stay in budget.' : 'Add budget to track daily spending.',
  }
}

const categoryGroupName = (category = '') => {
  const needs = ['Electricity Bill', 'Water Bill', 'Rent', 'Groceries', 'Vegetables', 'Petrol', 'Bills']
  const lifestyle = ['Food', 'Snacks', 'Liquor', 'Smoke', 'Entertainment', 'Hotel Food']
  const travel = ['Petrol', 'Transport', 'Cab', 'Train', 'Bus']
  if (needs.includes(category)) return 'Needs'
  if (lifestyle.includes(category)) return 'Lifestyle'
  if (travel.includes(category)) return 'Travel'
  return 'Other'
}

const AUTO_BUDGET_STYLE_WEIGHTS = {
  Safe: { Needs: 1.08, Lifestyle: 0.9, Travel: 0.98, Other: 0.96 },
  Balanced: { Needs: 1, Lifestyle: 1, Travel: 1, Other: 1 },
  Strict: { Needs: 1.14, Lifestyle: 0.72, Travel: 0.9, Other: 0.82 },
}

const AUTO_BUDGET_DEFAULT_SPLIT = {
  Food: 11,
  Petrol: 10,
  Smoke: 3,
  Liquor: 4,
  'Electricity Bill': 12,
  'Water Bill': 4,
  'Mobile Recharge': 3,
  Groceries: 20,
  Vegetables: 9,
  Snacks: 5,
  CSD: 6,
  'Hotel Food': 7,
  Other: 6,
}

const getAutoBudgetBaseWeights = (categories = [], logs = []) => {
  const totals = {}
  let totalSpent = 0
  logs.forEach((log) => {
    const category = log.category || 'Other'
    const amount = Number(log.amount || 0)
    if (!categories.includes(category) || amount <= 0) return
    totals[category] = (totals[category] || 0) + amount
    totalSpent += amount
  })

  const categoriesWithHistory = Object.keys(totals).filter((key) => totals[key] > 0)
  const hasHistory = categoriesWithHistory.length >= Math.min(3, Math.max(categories.length - 1, 1)) || totalSpent >= 1000

  if (hasHistory && totalSpent > 0) {
    return {
      hasHistory: true,
      weights: categories.reduce((acc, category) => {
        acc[category] = (totals[category] || 0) / totalSpent
        return acc
      }, {}),
    }
  }

  const defaultTotal = categories.reduce((sum, category) => sum + (AUTO_BUDGET_DEFAULT_SPLIT[category] || 4), 0) || 1
  return {
    hasHistory: false,
    weights: categories.reduce((acc, category) => {
      acc[category] = (AUTO_BUDGET_DEFAULT_SPLIT[category] || 4) / defaultTotal
      return acc
    }, {}),
  }
}

const buildAutoBudgetPlan = ({ totalBudget, categories = [], logs = [], style = 'Balanced' }) => {
  const budget = Math.max(0, Math.round(Number(totalBudget || 0)))
  const { weights: baseWeights, hasHistory } = getAutoBudgetBaseWeights(categories, logs)
  const styleWeights = AUTO_BUDGET_STYLE_WEIGHTS[style] || AUTO_BUDGET_STYLE_WEIGHTS.Balanced

  const adjustedWeights = categories.reduce((acc, category) => {
    const group = categoryGroupName(category)
    const baseWeight = baseWeights[category] || 0
    const multiplier = styleWeights[group] || 1
    acc[category] = Math.max(baseWeight * multiplier, 0.0001)
    return acc
  }, {})

  const totalWeight = Object.values(adjustedWeights).reduce((sum, value) => sum + value, 0) || 1
  const rawAllocations = categories.map((category) => {
    const raw = (budget * adjustedWeights[category]) / totalWeight
    return {
      category,
      raw,
      amount: Math.floor(raw),
      fraction: raw - Math.floor(raw),
    }
  })

  let remainder = budget - rawAllocations.reduce((sum, item) => sum + item.amount, 0)
  rawAllocations
    .sort((a, b) => b.fraction - a.fraction)
    .forEach((item) => {
      if (remainder <= 0) return
      item.amount += 1
      remainder -= 1
    })

  const byCategory = rawAllocations.reduce((acc, item) => {
    acc[item.category] = item.amount
    return acc
  }, {})

  return {
    byCategory,
    rows: categories
      .map((category) => ({
        category,
        amount: byCategory[category] || 0,
        pct: budget > 0 ? ((byCategory[category] || 0) / budget) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount),
    total: budget,
    hasHistory,
  }
}

const detectMoneyLeaks = (logs) => {
  const buckets = {}
  logs.forEach((log) => {
    if (log.amount > SMALL_SPEND_THRESHOLD) return
    const noteKey = normalizeText(log.note)
    const key = noteKey ? `${log.category}::${noteKey}` : `${log.category}::category`
    if (!buckets[key]) {
      buckets[key] = {
        label: noteKey ? `${log.note} (${log.category})` : `${log.category} repeated`,
        total: 0,
        count: 0,
        category: log.category,
      }
    }
    buckets[key].total += log.amount
    buckets[key].count += 1
  })

  const leaks = Object.values(buckets)
    .filter((item) => item.count >= 3)
    .sort((a, b) => b.total - a.total)
    .slice(0, 3)

  return {
    leaks,
    totalLeakAmount: leaks.reduce((sum, item) => sum + item.total, 0),
  }
}

const calculateHealthScore = ({
  monthlyBudgetUsed,
  overBudgetCount,
  todaySpent,
  safeSpendToday,
  projectedDelta,
  topRisks,
}) => {
  let score = 100
  if (monthlyBudgetUsed > 80) score -= 10
  if (monthlyBudgetUsed > 100) score -= 22
  score -= overBudgetCount * 8
  if (todaySpent > safeSpendToday && safeSpendToday > 0) score -= 12
  if (projectedDelta > 0) score -= clamp(projectedDelta / 300, 5, 22)
  score = clamp(Math.round(score), 0, 100)
  const status =
    score >= 85 ? 'Excellent' : score >= 70 ? 'Good' : score >= 55 ? 'Watchful' : score >= 35 ? 'Risky' : 'Critical'
  const reason =
    score >= 85
      ? 'Stable month with spending close to plan.'
      : topRisks.length
        ? `${status} month — ${topRisks.slice(0, 2).join(' and ')} are pushing the budget.`
        : 'Monitor daily spending to stay inside budget.'
  return { score, status, reason }
}

const getCoachOutput = ({
  health,
  overBudgetCategories,
  safeSpend,
  projection,
  burnRate,
  groupedInsights,
  topCategoryRow,
}) => {
  const risks = []
  if (overBudgetCategories[0]) {
    risks.push(
      `${overBudgetCategories[0].name} is ${Math.round(
        (overBudgetCategories[0].total / overBudgetCategories[0].budget) * 100
      )}% of budget.`
    )
  }
  if (projection.projectedDelta > 0) risks.push(`Projected overspend of ${fmt(projection.projectedDelta)} by month-end.`)
  if (burnRate.burnRate > 1.1) risks.push(`Burn rate is running at ${burnRate.burnRate.toFixed(1)}x.`)
  if (groupedInsights.lifestylePct > 35) risks.push(`Lifestyle spending is ${groupedInsights.lifestylePct.toFixed(0)}% of total.`)

  const dailyCut = projection.projectedDelta > 0 ? Math.ceil(projection.projectedDelta / safeSpend.remainingDays) : 0
  const topSuggestion = overBudgetCategories[0]
    ? `Try setting ${overBudgetCategories[0].name} daily cap to ${fmt((overBudgetCategories[0].budget || 0) / Math.max(projection.daysInMonth, 1))}.`
    : topCategoryRow
      ? `Keep ${topCategoryRow.name} under close watch for the next few days.`
      : 'Add more entries to unlock sharper coaching.'

  return {
    diagnosis:
      health.score >= 70
        ? 'Your budget is mostly under control.'
        : health.score >= 40
          ? 'Your budget is under pressure.'
          : 'Your spending pattern needs recovery mode.',
    risks: risks.slice(0, 3),
    recoveryPlan:
      projection.projectedDelta > 0
        ? `Cut about ${fmt(dailyCut)}/day for the rest of the month to recover.`
        : 'Keep the current pace and avoid sudden spikes in discretionary spend.',
    suggestedDailyCut: dailyCut,
    categorySuggestion: topSuggestion,
    motivation:
      health.score >= 70
        ? 'Small disciplined days now will create a strong month-end finish.'
        : 'Every tight day from here gives you back control.',
  }
}

const getDailyComparison = (todayLogs, yesterdayLogs) => {
  if (!todayLogs.length || !yesterdayLogs.length) return null
  const todayTotal = todayLogs.reduce((sum, log) => sum + log.amount, 0)
  const yesterdayTotal = yesterdayLogs.reduce((sum, log) => sum + log.amount, 0)
  const diff = todayTotal - yesterdayTotal
  const todayCats = groupByCategory(todayLogs)
  const yesterdayCats = groupByCategory(yesterdayLogs)
  const categories = [...new Set([...Object.keys(todayCats), ...Object.keys(yesterdayCats)])]
  let biggestIncrease = null
  categories.forEach((category) => {
    const delta = (todayCats[category]?.total || 0) - (yesterdayCats[category]?.total || 0)
    if (delta > 0 && (!biggestIncrease || delta > biggestIncrease.delta)) {
      biggestIncrease = { category, delta }
    }
  })
  return { todayTotal, yesterdayTotal, diff, biggestIncrease }
}

const getHealthIssues = ({ monthStats, safeSpend, projection, burnRate, leakData }) => {
  const issues = []
  if (monthStats.monthlyBudgetUsed > 100) issues.push(`Budget is already at ${Math.round(monthStats.monthlyBudgetUsed)}% this month.`)
  else if (monthStats.monthlyBudgetUsed > 80) issues.push(`Budget usage is already at ${Math.round(monthStats.monthlyBudgetUsed)}%.`)
  if (monthStats.overBudgetCategories[0]) issues.push(`${monthStats.overBudgetCategories[0].name} is over by ${fmt(monthStats.overBudgetCategories[0].overBy)}.`)
  if (monthStats.todaySpent > Math.max(safeSpend.safeSpendToday, 0) && safeSpend.remainingBudget >= 0) {
    issues.push(`Today's spend is ahead of the safe pace.`)
  }
  if (projection.projectedDelta > 0) issues.push(`Month-end projection is ${fmt(projection.projectedDelta)} above plan.`)
  if (burnRate.burnRate > 1.1) issues.push(`Burn rate is ${burnRate.burnRate.toFixed(1)}x.`)
  if (leakData.totalLeakAmount > 0) issues.push(`${fmt(leakData.totalLeakAmount)} is tied up in small repeat spends.`)
  return issues.slice(0, 3)
}

const getDailyChallenge = ({ monthStats, safeSpend, dailyComparison, groupedInsights, projection }) => {
  const riskyCategory = monthStats.overBudgetCategories[0]?.name || monthStats.topCategoryRow?.name || 'Food'
  const safeCap = Math.max(Math.round(Math.max(safeSpend.safeSpendToday, 120)), 120)
  const categoryDailyCap = Math.max(
    60,
    Math.round((monthStats.overBudgetCategories[0]?.budget || monthStats.monthlyBudget || 0) / Math.max(projection.daysInMonth, 1))
  )
  const templates = [
    {
      id: 'safe-spend',
      title: 'Spend under the safe line',
      target: `Keep total spend under ${fmt(safeCap)} today.`,
      reason: 'This keeps month-end pressure from building further.',
      weight: 6,
    },
    {
      id: 'food-cap',
      title: 'Food control day',
      target: `Keep Food under ${fmt(Math.max(categoryDailyCap, 180))} today.`,
      reason: 'Food is one of the fastest categories to drift upward.',
      weight: riskyCategory === 'Food' ? 10 : 5,
    },
    {
      id: 'smoke-zero',
      title: 'No Smoke spend today',
      target: 'Avoid any Smoke entries for the rest of today.',
      reason: 'One clean day improves both budget and discipline.',
      weight: monthStats.categoryTotals.Smoke ? 9 : 3,
    },
    {
      id: 'snacks-cap',
      title: 'Snack leak block',
      target: `Keep Snacks under ${fmt(Math.max(Math.round(safeCap * 0.35), 60))} today.`,
      reason: 'Small repeat spends are quietly draining the month.',
      weight: monthStats.categoryTotals.Snacks ? 8 : 4,
    },
    {
      id: 'record-all',
      title: 'Zero missing entries',
      target: 'Record every expense before night.',
      reason: 'Complete logs unlock better alerts and better decisions.',
      weight: 5,
    },
    {
      id: 'lifestyle-cut',
      title: 'Lifestyle cutback',
      target: 'Keep lifestyle spending lighter than needs today.',
      reason: 'Lifestyle is currently taking a larger share of your money.',
      weight: groupedInsights.lifestylePct > groupedInsights.needsPct ? 9 : 4,
    },
    {
      id: 'beat-yesterday',
      title: 'Beat yesterday',
      target: dailyComparison ? `Finish below yesterday's ${fmt(dailyComparison.yesterdayTotal)}.` : `Finish below ${fmt(safeCap)} today.`,
      reason: 'A lower-spend day helps reset momentum.',
      weight: dailyComparison ? 8 : 3,
    },
    {
      id: 'petrol-plan',
      title: 'Planned travel only',
      target: `Keep Petrol within ${fmt(Math.max(categoryDailyCap, 120))} today.`,
      reason: 'Travel spend stays healthier when it is planned, not reactive.',
      weight: monthStats.categoryTotals.Petrol ? 7 : 3,
    },
    {
      id: 'risky-category',
      title: `${riskyCategory} reset`,
      target: `Avoid impulse ${riskyCategory} spend today.`,
      reason: `${riskyCategory} is the category asking for the most attention right now.`,
      weight: monthStats.overBudgetCategories.length ? 10 : 4,
    },
  ]

  const seed =
    monthStats.now.getFullYear() * 10000 +
    (monthStats.now.getMonth() + 1) * 100 +
    monthStats.now.getDate()
  const totalWeight = templates.reduce((sum, item) => sum + item.weight, 0)
  let weightedSeed = seed % Math.max(totalWeight, 1)
  let selected = templates[0]
  for (const item of templates) {
    weightedSeed -= item.weight
    if (weightedSeed < 0) {
      selected = item
      break
    }
  }

  try {
    const todayKey = monthStats.now.toISOString().slice(0, 10)
    const stored = JSON.parse(localStorage.getItem('acr_expense_last_challenge') || 'null')
    if (stored && stored.date !== todayKey && stored.id === selected.id) {
      const index = templates.findIndex((item) => item.id === selected.id)
      selected = templates[(index + 1) % templates.length]
    }
    localStorage.setItem('acr_expense_last_challenge', JSON.stringify({ id: selected.id, date: todayKey }))
  } catch {}

  return {
    ...selected,
    reward: 'Reward ready: +20 ACR coins',
  }
}

function CountUp({ value, prefix = '₹', duration = 900 }) {
  const [display, setDisplay] = useState(0)
  const rafRef = useRef(null)
  useEffect(() => {
    const target = Number(value || 0)
    const start = performance.now()
    const tick = (time) => {
      const progress = Math.min((time - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(target * eased))
      if (progress < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [value, duration])
  return (
    <span>
      <span style={{ fontSize: '0.75em', opacity: 0.85, fontWeight: 600, marginRight: '2px', textShadow: '0 0 6px rgba(255,255,255,0.4)' }}>{prefix}</span>
      {display.toLocaleString('en-IN')}
    </span>
  )
}

function GlassCard({ children, style = {}, accent = '#dbeafe', className = '' }) {
  return (
    <div
      className={className}
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 16,
        padding: 10,
        border: '1px solid rgba(255,255,255,0.92)',
        background:
          'linear-gradient(145deg, rgba(255,255,255,0.95), rgba(244,247,251,0.88) 45%, rgba(235,240,245,0.92))',
        boxShadow:
          '0 6px 14px rgba(15,23,42,0.05), inset 0 1px 0 rgba(255,255,255,0.94), inset 0 -1px 0 rgba(148,163,184,0.06)',
        backdropFilter: 'blur(18px)',
        ...style,
      }}
    >
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at top right, ${accent}, transparent 34%)`, pointerEvents: 'none' }} />
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  )
}

function SectionHdr({ title, subtitle, right, accent = '#7c3aed' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ width: 7, height: 7, borderRadius: 999, background: accent, boxShadow: `0 0 0 5px ${accent}18` }} />
          <p style={{ margin: 0, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569' }}>{title}</p>
        </div>
        {subtitle ? <p style={{ margin: '4px 0 0', fontSize: 10, color: '#64748b', lineHeight: 1.35 }}>{subtitle}</p> : null}
      </div>
      {right}
    </div>
  )
}

function ProgressLine({ pct, tone, height = 9 }) {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const timer = window.setTimeout(() => setWidth(clamp(pct, 0, 100)), 100)
    return () => window.clearTimeout(timer)
  }, [pct])
  return (
    <div style={{ height, borderRadius: 999, background: 'rgba(226,232,240,0.88)', overflow: 'hidden' }}>
      <div
        style={{
          width: `${width}%`,
          height: '100%',
          borderRadius: 999,
          background: tone,
          transition: 'width 0.9s cubic-bezier(.34,1.2,.64,1)',
        }}
      />
    </div>
  )
}

function TooltipCard({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '9px 11px', boxShadow: '0 12px 22px rgba(15,23,42,0.12)' }}>
      <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>{label}</p>
      <p style={{ margin: '3px 0 0', fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{fmt(payload[0].value)}</p>
    </div>
  )
}

function TinyStat({ label, value, tone = '#2563eb', sub, style = {}, labelColor = '#64748b' }) {
  return (
    <div style={{ padding: '7px 8px', borderRadius: 12, background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(226,232,240,0.92)', ...style }}>
      <p style={{ margin: 0, fontSize: 9, color: labelColor, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</p>
      <p style={{ margin: '3px 0 0', fontSize: 13.5, fontWeight: 800, color: tone, lineHeight: 1.08 }}>{value}</p>
      {sub ? <p style={{ margin: '3px 0 0', fontSize: 9.5, color: labelColor, lineHeight: 1.3 }}>{sub}</p> : null}
    </div>
  )
}

function MiniOverviewCard({ label, value, sub, tone = '#2563eb' }) {
  return (
    <div style={{ minHeight: 68, padding: '8px 9px', borderRadius: 12, background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(226,232,240,0.92)' }}>
      <p style={{ margin: 0, fontSize: 9, color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</p>
      <p className="syne" style={{ margin: '5px 0 0', fontSize: 15.5, fontWeight: 800, lineHeight: 1, color: tone }}>{value}</p>
      <p style={{ margin: '4px 0 0', fontSize: 9.5, color: '#64748b', lineHeight: 1.28 }}>{sub}</p>
    </div>
  )
}

function getCoachSeverity(signalOrStatus) {
  const raw = typeof signalOrStatus === 'string'
    ? signalOrStatus
    : `${signalOrStatus?.status || ''} ${signalOrStatus?.helper || ''}`
  const value = raw.toLowerCase()

  if (['risky', 'no more spends', 'leak detected', 'over limit'].some((item) => value.includes(item))) return 'risk'
  if (['careful', 'go light', 'stop extras', 'rising', 'control category', 'cut category', 'control ', 'cut '].some((item) => value.includes(item))) return 'watch'
  if (['set budget', 'add entries', 'need data'].some((item) => value.includes(item))) return 'neutral'
  if (['relaxed', 'balanced', 'spend freely', 'no leak', 'all fine', 'cooling', 'stable', 'good pace'].some((item) => value.includes(item))) return 'safe'

  return 'neutral'
}

function CoachSignalCard({ emoji, title, status, helper, tone = '#2563eb', bg = 'rgba(255,255,255,0.62)', border = 'rgba(226,232,240,0.92)' }) {
  const severity = getCoachSeverity({ status, helper })
  const palettes = {
    safe: {
      shell: 'linear-gradient(160deg, rgba(255,255,255,0.96), rgba(240,253,244,0.92))',
      border: 'rgba(34,197,94,0.28)',
      shadow: '0 14px 30px rgba(22,163,74,0.12), 0 3px 10px rgba(15,23,42,0.06)',
      glow: '0 0 0 1px rgba(34,197,94,0.08), inset 0 1px 0 rgba(255,255,255,0.78)',
      badgeBg: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.98), rgba(220,252,231,0.92) 58%, rgba(134,239,172,0.58) 100%)',
      chipBg: 'rgba(22,163,74,0.10)',
      chipBorder: 'rgba(34,197,94,0.18)',
    },
    watch: {
      shell: 'linear-gradient(160deg, rgba(255,255,255,0.96), rgba(255,251,235,0.94))',
      border: 'rgba(245,158,11,0.28)',
      shadow: '0 14px 30px rgba(217,119,6,0.12), 0 3px 10px rgba(15,23,42,0.06)',
      glow: '0 0 0 1px rgba(245,158,11,0.07), inset 0 1px 0 rgba(255,255,255,0.78)',
      badgeBg: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.98), rgba(254,243,199,0.94) 58%, rgba(252,211,77,0.56) 100%)',
      chipBg: 'rgba(217,119,6,0.10)',
      chipBorder: 'rgba(245,158,11,0.18)',
    },
    risk: {
      shell: 'linear-gradient(160deg, rgba(255,255,255,0.97), rgba(254,242,242,0.95))',
      border: 'rgba(239,68,68,0.30)',
      shadow: '0 14px 30px rgba(220,38,38,0.13), 0 3px 10px rgba(15,23,42,0.06)',
      glow: '0 0 0 1px rgba(239,68,68,0.09), inset 0 1px 0 rgba(255,255,255,0.78)',
      badgeBg: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.99), rgba(254,226,226,0.94) 58%, rgba(252,165,165,0.58) 100%)',
      chipBg: 'rgba(220,38,38,0.10)',
      chipBorder: 'rgba(239,68,68,0.18)',
    },
    neutral: {
      shell: 'linear-gradient(160deg, rgba(255,255,255,0.96), rgba(239,246,255,0.93))',
      border: 'rgba(99,102,241,0.24)',
      shadow: '0 14px 30px rgba(79,70,229,0.11), 0 3px 10px rgba(15,23,42,0.06)',
      glow: '0 0 0 1px rgba(99,102,241,0.07), inset 0 1px 0 rgba(255,255,255,0.78)',
      badgeBg: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.99), rgba(224,231,255,0.94) 58%, rgba(147,197,253,0.54) 100%)',
      chipBg: 'rgba(79,70,229,0.10)',
      chipBorder: 'rgba(99,102,241,0.18)',
    },
  }
  const palette = palettes[severity]

  return (
    <div
      className={`coach-card coach-card-${severity}`}
      style={{
        minHeight: 70,
        maxHeight: 76,
        padding: '9px 10px',
        borderRadius: 16,
        position: 'relative',
        overflow: 'hidden',
        background: palette.shell,
        border: `1px solid ${palette.border}`,
        boxShadow: `${palette.shadow}, ${palette.glow}`,
      }}
    >
      <div className="coach-card-sheen" />
      <div style={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: '32px minmax(0,1fr)', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 15,
            lineHeight: 1,
            background: palette.badgeBg,
            boxShadow: `0 6px 12px ${tone}18, inset 0 1px 1px rgba(255,255,255,0.9)`,
            border: `1px solid ${tone}24`,
            flexShrink: 0,
          }}
        >
          {emoji}
        </span>
        <div style={{ minWidth: 0, display: 'grid', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, minWidth: 0 }}>
            <span style={{ minWidth: 0, fontSize: 10, color: '#64748b', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
            <span
              style={{
                padding: '2px 6px',
                fontSize: 8.5,
                fontWeight: 800,
                letterSpacing: '0.03em',
                borderRadius: 999,
                color: tone,
                background: palette.chipBg,
                border: `1px solid ${palette.chipBorder}`,
                whiteSpace: 'nowrap',
                backdropFilter: 'blur(8px)',
                flexShrink: 0,
              }}
            >
              {helper}
            </span>
          </div>
          <strong
            className="syne"
            style={{
              display: 'block',
              fontSize: 16,
              lineHeight: 1.05,
              color: tone,
              fontWeight: 900,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {status}
          </strong>
        </div>
      </div>
    </div>
  )
}

function HealthRing({ score, onClick, budgetPct = 0, ringBurst = false }) {
  // Color based on budget usage percent (not health score)
  const pct = clamp(budgetPct, 0, 100)
  const riskColor = pct < 60 ? '#22c55e' : pct < 85 ? '#facc15' : '#ef4444'
  const riskGlow  = pct < 60 ? 'rgba(34,197,94,0.55)'  : pct < 85 ? 'rgba(250,204,21,0.50)' : 'rgba(239,68,68,0.55)'
  const riskGlowSoft = pct < 60 ? 'rgba(34,197,94,0.18)' : pct < 85 ? 'rgba(250,204,21,0.16)' : 'rgba(239,68,68,0.18)'

  // SVG arc math
  const SIZE = 80
  const STROKE = 7
  const R = (SIZE - STROKE) / 2
  const CIRC = 2 * Math.PI * R
  const filled = CIRC * (pct / 100)
  const gap = CIRC - filled

  const orbPulse = ringBurst ? 'pcOrbBurst 0.75s ease-out forwards' : 'pcOrbPulse 2.8s ease-in-out infinite'
  const ringFlash = ringBurst ? 'pcRingFlash 0.75s ease-out forwards' : undefined

  return (
    <button
      onClick={onClick}
      aria-label="Open expense health details"
      style={{
        position: 'relative',
        width: SIZE,
        height: SIZE,
        borderRadius: '50%',
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        padding: 0,
        flexShrink: 0,
      }}
    >
      {/* ── OUTER BUDGET ORBIT RING (SVG) ── */}
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={{
          position: 'absolute',
          inset: 0,
          transform: 'rotate(-90deg)',
          animation: ringFlash ? ringFlash : 'pcRingRotate 18s linear infinite',
          transition: 'filter 0.6s ease',
          filter: ringBurst ? `drop-shadow(0 0 7px ${riskColor})` : `drop-shadow(0 0 3px ${riskColor}88)`,
        }}
      >
        <defs>
          <linearGradient id="pcOrbitGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={riskColor} stopOpacity="1" />
            <stop offset="60%" stopColor={riskColor} stopOpacity="0.75" />
            <stop offset="100%" stopColor={pct < 60 ? '#06b6d4' : pct < 85 ? '#fb923c' : '#f43f5e'} stopOpacity="0.5" />
          </linearGradient>
        </defs>
        {/* Track */}
        <circle
          cx={SIZE / 2} cy={SIZE / 2} r={R}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={STROKE}
        />
        {/* Filled arc */}
        <circle
          cx={SIZE / 2} cy={SIZE / 2} r={R}
          fill="none"
          stroke="url(#pcOrbitGrad)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${gap}`}
          strokeDashoffset={0}
          style={{ transition: 'stroke-dasharray 0.9s cubic-bezier(.34,1.2,.64,1)' }}
        />
        {/* Leading dot glow */}
        {pct > 2 && (
          <circle
            cx={SIZE / 2 + R * Math.cos((filled / CIRC) * 2 * Math.PI - Math.PI / 2)}
            cy={SIZE / 2 + R * Math.sin((filled / CIRC) * 2 * Math.PI - Math.PI / 2)}
            r={STROKE / 2 + 0.5}
            fill={riskColor}
            style={{ filter: `blur(1px)` }}
          />
        )}
      </svg>

      {/* ── MIDDLE HALO GLOW ── */}
      <div style={{
        position: 'absolute',
        inset: STROKE + 4,
        borderRadius: '50%',
        background: riskGlowSoft,
        filter: 'blur(8px)',
        transition: 'background 0.6s ease',
        pointerEvents: 'none',
      }} />

      {/* ── INNER PULSE ORB ── */}
      <div style={{
        position: 'absolute',
        inset: STROKE + 8,
        borderRadius: '50%',
        background: `radial-gradient(circle at 38% 32%,
          rgba(180,230,255,0.92) 0%,
          rgba(80,160,255,0.80) 22%,
          rgba(30,80,200,0.88) 52%,
          rgba(10,20,80,0.96) 80%,
          rgba(2,6,30,1) 100%)`,
        boxShadow: `0 0 18px 4px ${riskGlow}, 0 0 6px 2px ${riskColor}55, inset 0 2px 6px rgba(255,255,255,0.18)`,
        animation: orbPulse,
        transition: 'box-shadow 0.6s ease',
        overflow: 'hidden',
        pointerEvents: 'none',
      }}>
        {/* Glass highlight */}
        <div style={{
          position: 'absolute',
          top: '8%',
          left: '14%',
          width: '52%',
          height: '36%',
          borderRadius: '50%',
          background: 'linear-gradient(160deg, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0.06) 60%, transparent 100%)',
          filter: 'blur(1.5px)',
        }} />
        {/* Depth wave */}
        <div style={{
          position: 'absolute',
          bottom: '10%',
          left: '-10%',
          right: '-10%',
          height: '40%',
          borderRadius: '50%',
          background: 'radial-gradient(ellipse at 50% 80%, rgba(100,200,255,0.18) 0%, transparent 70%)',
        }} />
      </div>
    </button>
  )
}

function BottomSheet({ title, subtitle, onClose, children, accent = 'rgba(59,130,246,0.15)' }) {
  return (
      <div
        onClick={(e) => e.target === e.currentTarget && onClose()}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 5000,
          background: 'rgba(15,23,42,0.34)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '10px 10px',
        }}
      >
      <GlassCard style={{ width: '92vw', maxWidth: 520, maxHeight: '75vh', overflowY: 'auto', borderRadius: 22, padding: 11 }} accent={accent}>
        <div style={{ width: 44, height: 5, borderRadius: 999, background: '#cbd5e1', margin: '0 auto 12px' }} />
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
          <div>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#0f172a' }}>{title}</p>
            {subtitle ? <p style={{ margin: '4px 0 0', fontSize: 11, color: '#64748b' }}>{subtitle}</p> : null}
          </div>
          <button onClick={onClose} style={actionBtn('#64748b', '#f8fafc')}>Close</button>
        </div>
        {children}
      </GlassCard>
    </div>
  )
}

function ExpenseAlertsSheet({ alerts, onClose, onViewBudgets }) {
  return (
    <BottomSheet title="Expense alerts" subtitle={alerts.length ? `${alerts.length} warnings and nudges` : 'All clear for now'} onClose={onClose} accent="rgba(239,68,68,0.16)">
      <div style={{ display: 'grid', gap: 10, maxHeight: '62vh', overflowY: 'auto', paddingRight: 2 }}>
        {alerts.length ? alerts.map((alert, index) => (
          <div
            key={`${alert.title}-${index}`}
            style={{
              padding: '12px 12px',
              borderRadius: 18,
              background: alert.severity === 'high' ? '#fff1f2' : alert.severity === 'medium' ? '#fff7ed' : '#eff6ff',
              border: `1px solid ${alert.severity === 'high' ? '#fecdd3' : alert.severity === 'medium' ? '#fed7aa' : '#bfdbfe'}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 13, background: 'rgba(255,255,255,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>
                {alert.icon}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ margin: 0, fontSize: 12.5, fontWeight: 800, color: '#0f172a' }}>{alert.title}</p>
                <p style={{ margin: '4px 0 0', fontSize: 11, color: '#475569', lineHeight: 1.45 }}>{alert.text}</p>
              </div>
            </div>
          </div>
        )) : <div style={{ padding: '18px 12px', borderRadius: 18, background: '#f8fafc', textAlign: 'center', color: '#64748b', fontSize: 12, fontWeight: 700 }}>Spending is within your current budget limits.</div>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
        <button onClick={onViewBudgets} style={actionBtn('#7c3aed', '#faf5ff')}>Open budgets</button>
      </div>
    </BottomSheet>
  )
}

function AutoBudgetSheet({
  amount,
  setAmount,
  style,
  setStyle,
  previewRows,
  hasHistory,
  isEditing,
  setIsEditing,
  draftBudgets,
  setDraftBudgets,
  onApply,
  onClose,
}) {
  return (
    <BottomSheet title="Auto Budget" subtitle={hasHistory ? 'Using your spending history for the split.' : 'Using a default split for now.'} onClose={onClose} accent="rgba(124,58,237,0.18)">
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'grid', gap: 6 }}>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Monthly Budget Amount</p>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="5000"
            autoFocus
            style={inputStyle}
          />
        </div>

        <div style={{ display: 'grid', gap: 6 }}>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Style</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
            {['Safe', 'Balanced', 'Strict'].map((option) => {
              const active = style === option
              return (
                <button
                  key={option}
                  onClick={() => setStyle(option)}
                  style={{
                    padding: '9px 8px',
                    borderRadius: 13,
                    border: `1px solid ${active ? '#7c3aed44' : '#dbe2ea'}`,
                    background: active ? 'linear-gradient(145deg,#faf5ff,#ffffff)' : 'rgba(255,255,255,0.9)',
                    color: active ? '#6d28d9' : '#475569',
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: active ? '0 0 0 3px rgba(124,58,237,0.08)' : 'none',
                  }}
                >
                  {option}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ padding: '10px 10px', borderRadius: 16, background: 'rgba(255,255,255,0.62)', border: '1px solid rgba(226,232,240,0.92)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
            <p style={{ margin: 0, fontSize: 10.5, fontWeight: 800, color: '#0f172a' }}>Suggested category split</p>
            <span style={chipStyle(hasHistory ? '#ecfdf5' : '#eff6ff', hasHistory ? '#16a34a' : '#2563eb')}>
              {hasHistory ? 'History based' : 'Default split'}
            </span>
          </div>
          <div style={{ display: 'grid', gap: 7, maxHeight: '40vh', overflowY: 'auto', paddingRight: 2 }}>
            {previewRows.map((row) => (
              <div key={row.category} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', alignItems: 'center', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {(CAT_ICONS[row.category] || '💸') + ' ' + row.category}
                    </p>
                    <p style={{ margin: 0, fontSize: 9.5, fontWeight: 800, color: '#64748b' }}>{Math.round(row.pct)}%</p>
                  </div>
                  <ProgressLine pct={row.pct} tone={`linear-gradient(90deg,${CAT_COLORS[row.category] || CAT_COLORS.Other},${(CAT_COLORS[row.category] || CAT_COLORS.Other)}cc)`} height={7} />
                </div>
                {isEditing ? (
                  <input
                    type="number"
                    value={draftBudgets[row.category] ?? ''}
                    onChange={(e) =>
                      setDraftBudgets((prev) => ({
                        ...prev,
                        [row.category]: Math.max(0, Number(e.target.value || 0)),
                      }))
                    }
                    style={{ ...inputStyle, width: 88, padding: '8px 8px', fontSize: 10.5 }}
                  />
                ) : (
                  <strong className="syne" style={{ fontSize: 14, color: '#0f172a' }}>{fmt(row.amount)}</strong>
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <button onClick={onClose} style={actionBtn('#64748b', '#f8fafc')}>Cancel</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setIsEditing(true)} style={actionBtn('#2563eb', '#eff6ff')}>Edit</button>
            <button onClick={onApply} style={{ ...actionBtn('#fff', '#7c3aed'), border: 'none', boxShadow: '0 10px 18px rgba(124,58,237,0.22)' }}>Apply</button>
          </div>
        </div>
      </div>
    </BottomSheet>
  )
}

function BudgetRow({ row, editingBudget, budgetInput, setBudgetInput, setEditingBudget, saveBudget, onAdjust, onReduceDaily, onIgnore }) {
  const over = row.budget > 0 && row.spent > row.budget
  const pct = row.budget > 0 ? clamp((row.spent / row.budget) * 100, 0, 100) : 0
  const overBy = Math.max(row.spent - row.budget, 0)
  return (
    <div style={{ padding: '9px 9px', borderRadius: 15, background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(226,232,240,0.92)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 11.5, fontWeight: 800, color: '#0f172a' }}>{(CAT_ICONS[row.name] || '💸') + ' ' + row.name}</p>
          <p style={{ margin: '2px 0 0', fontSize: 9.5, color: '#64748b' }}>{fmt(row.spent)} / {row.budget ? fmt(row.budget) : 'Set budget'}</p>
        </div>
        <span style={{ padding: '4px 7px', borderRadius: 999, background: over ? '#fef2f2' : '#eff6ff', color: over ? '#dc2626' : '#2563eb', fontSize: 9.5, fontWeight: 800 }}>{row.budget ? `${Math.round(pct)}%` : 'No limit'}</span>
      </div>

      {editingBudget === row.name ? (
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <input
            type="number"
            value={budgetInput}
            onChange={(e) => setBudgetInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveBudget(row.name)}
            autoFocus
            placeholder="₹ budget"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button onClick={() => saveBudget(row.name)} style={actionBtn('#2563eb', '#eff6ff')}>Save</button>
          <button onClick={() => setEditingBudget(null)} style={actionBtn('#64748b', '#f8fafc')}>Close</button>
        </div>
      ) : null}

      <ProgressLine pct={pct} tone={over ? 'linear-gradient(90deg,#ef4444,#fb7185)' : `linear-gradient(90deg,${row.color},${row.color}cc)`} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 6 }}>
        <p style={{ margin: 0, fontSize: 9.5, color: over ? '#dc2626' : '#64748b', fontWeight: 700 }}>
          {over ? `Over by ${fmt(overBy)}` : row.budget ? `${fmt(Math.max(row.budget - row.spent, 0))} left` : 'Tap adjust to set limit'}
        </p>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button onClick={() => onAdjust(row)} style={miniActionBtn('#2563eb', '#eff6ff')}>Adjust</button>
          <button onClick={() => onReduceDaily(row)} style={miniActionBtn('#d97706', '#fff7ed')}>Reduce daily</button>
          <button onClick={() => onIgnore(row)} style={miniActionBtn('#64748b', '#f8fafc')}>Ignore</button>
        </div>
      </div>
    </div>
  )
}

export default function Expense(props) {
  const {
    logs,
    customAmount,
    setCustomAmount,
    customCategory,
    setCustomCategory,
    categories,
    addExpense,
    addExpenseWithMeta,
    deleteExpense,
    filteredLogs,
    searchTerm,
    setSearchTerm,
    filterCategory,
    setFilterCategory,
    overallTotal,
    expenseTab,
    setExpenseTab,
    aiInsights,
    generateAIAdvice,
    isThinking,
    triggerCamera,
    handleImageCapture,
    fileInputRef,
  } = props

  const [budgets, setBudgets] = useState(BUDGET_DEFAULTS)
  const [editingBudget, setEditingBudget] = useState(null)
  const [budgetInput, setBudgetInput] = useState('')
  const [noteInput, setNoteInput] = useState('')
  const [sortBy, setSortBy] = useState('time')
  const [justAdded, setJustAdded] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [showMobileForm, setShowMobileForm] = useState(false)
  const [showAlertsSheet, setShowAlertsSheet] = useState(false)
  const [showHealthSheet, setShowHealthSheet] = useState(false)
  const [showChallengeSheet, setShowChallengeSheet] = useState(false)
  const [showAutoBudgetSheet, setShowAutoBudgetSheet] = useState(false)
  const [autoBudgetAmount, setAutoBudgetAmount] = useState('')
  const [autoBudgetStyle, setAutoBudgetStyle] = useState('Balanced')
  const [autoBudgetEditing, setAutoBudgetEditing] = useState(false)
  const [autoBudgetDrafts, setAutoBudgetDrafts] = useState({})
  const [showBudgetToast, setShowBudgetToast] = useState(false)
  const [ringBurst, setRingBurst] = useState(false)
  const prevLogCountRef = useRef(null)

  const normalizedLogs = useMemo(() => logs.map(normalizeLog).sort((a, b) => b.millis - a.millis), [logs])
  const normalizedFilteredLogs = useMemo(() => filteredLogs.map(normalizeLog).sort((a, b) => b.millis - a.millis), [filteredLogs])
  const autoBudgetPlan = useMemo(
    () =>
      buildAutoBudgetPlan({
        totalBudget: autoBudgetAmount,
        categories,
        logs: normalizedLogs,
        style: autoBudgetStyle,
      }),
    [autoBudgetAmount, autoBudgetStyle, categories, normalizedLogs]
  )
  const autoBudgetDraftTotal = useMemo(
    () => Object.values(autoBudgetDrafts || {}).reduce((sum, value) => sum + Number(value || 0), 0),
    [autoBudgetDrafts]
  )
  const autoBudgetPreviewRows = useMemo(
    () =>
      autoBudgetPlan.rows.map((row) => ({
        ...row,
        amount: autoBudgetEditing ? Number(autoBudgetDrafts[row.category] ?? row.amount) : row.amount,
        pct:
          autoBudgetEditing && autoBudgetDraftTotal > 0
            ? (Number(autoBudgetDrafts[row.category] ?? row.amount) / autoBudgetDraftTotal) * 100
            : row.pct,
      })),
    [autoBudgetDraftTotal, autoBudgetDrafts, autoBudgetEditing, autoBudgetPlan.rows]
  )

  const monthStats = useMemo(() => getMonthStats(normalizedLogs, budgets), [normalizedLogs, budgets])
  const projection = useMemo(
    () =>
      calculateProjection({
        totalSpent: monthStats.totalSpent,
        monthlyBudget: monthStats.monthlyBudget,
        now: monthStats.now,
        totalEntries: monthStats.totalEntries,
      }),
    [monthStats]
  )
  const burnRate = useMemo(
    () =>
      calculateBurnRate({
        averageDailySpend: projection.averageDailySpend,
        monthlyBudget: monthStats.monthlyBudget,
        daysInMonth: projection.daysInMonth,
      }),
    [projection, monthStats.monthlyBudget]
  )
  const safeSpend = useMemo(
    () =>
      calculateSafeSpend({
        monthlyBudget: monthStats.monthlyBudget,
        totalSpent: monthStats.totalSpent,
        todaySpent: monthStats.todaySpent,
        now: monthStats.now,
      }),
    [monthStats]
  )
  const todaySpendStatus = useMemo(() => {
    if (!safeSpend.hasBudget) {
      return {
        value: 'Set budget',
        sub: 'Add budget to track daily spending.',
        tone: '#64748b',
      }
    }
    if (safeSpend.budgetBalance <= 0) {
      return {
        value: `${fmt(Math.abs(safeSpend.todayDifference))} over today`,
        sub: "Budget exhausted. Today's revised limit is ₹0/day.",
        tone: '#dc2626',
      }
    }
    if (monthStats.todaySpent <= safeSpend.canSpendDaily) {
      return {
        value: `${fmt(safeSpend.todayDifference)} left today`,
        sub:
          monthStats.todaySpent > safeSpend.canSpendDaily * 0.8
            ? 'Close to the revised daily limit.'
            : 'Under revised daily limit.',
        tone: monthStats.todaySpent > safeSpend.canSpendDaily * 0.8 ? '#d97706' : '#16a34a',
      }
    }
    return {
      value: `${fmt(Math.abs(safeSpend.todayDifference))} over today`,
      sub: 'Daily limit crossed.',
      tone: '#dc2626',
    }
  }, [monthStats.todaySpent, safeSpend])
  const summaryTodayStatusCard = useMemo(() => {
    if (!safeSpend.hasBudget) {
      return {
        value: 'Set budget',
        sub: 'Add budget to track daily spending.',
        tone: '#64748b',
      }
    }

    const remainingToday = Math.abs(safeSpend.todayDifference)
    if (monthStats.todaySpent <= safeSpend.canSpendDaily) {
      return {
        value: `${fmt(remainingToday)} left`,
        sub: 'Under daily limit',
        tone: '#16a34a',
      }
    }

    return {
      value: `${fmt(remainingToday)} left`,
      sub: 'Over daily limit',
      tone: '#dc2626',
    }
  }, [monthStats.todaySpent, safeSpend])
  const todayYesterdayMetric = useMemo(() => {
    const todaySpent = Number(monthStats.todaySpent || 0)
    const yesterdaySpent = Number(monthStats.yesterdaySpent || 0)

    if (yesterdaySpent > 0) {
      const percentChange = ((todaySpent - yesterdaySpent) / yesterdaySpent) * 100
      const roundedChange = Math.round(Math.abs(percentChange))
      if (todaySpent > yesterdaySpent) {
        return {
          value: `${fmt(todaySpent)} / ${fmt(yesterdaySpent)}`,
          chip: `▲ ${roundedChange}%`,
          chipBg: '#fee2e2',
          chipColor: '#dc2626',
          chipBorder: '#fca5a5',
        }
      }
      if (todaySpent < yesterdaySpent) {
        return {
          value: `${fmt(todaySpent)} / ${fmt(yesterdaySpent)}`,
          chip: `▼ ${roundedChange}%`,
          chipBg: '#dcfce7',
          chipColor: '#16a34a',
          chipBorder: '#86efac',
        }
      }
      return {
        value: `${fmt(todaySpent)} / ${fmt(yesterdaySpent)}`,
        chip: 'Same',
        chipBg: '#e2e8f0',
        chipColor: '#64748b',
        chipBorder: '#cbd5e1',
      }
    }

    if (todaySpent > 0) {
      return {
        value: `${fmt(todaySpent)} / ${fmt(yesterdaySpent)}`,
        chip: 'New',
        chipBg: '#fef3c7',
        chipColor: '#d97706',
        chipBorder: '#fcd34d',
      }
    }

    return {
      value: `${fmt(todaySpent)} / ${fmt(yesterdaySpent)}`,
      chip: 'No spend',
      chipBg: '#e2e8f0',
      chipColor: '#64748b',
      chipBorder: '#cbd5e1',
    }
  }, [monthStats.todaySpent, monthStats.yesterdaySpent])

  const todayLogs = useMemo(
    () => monthStats.currentMonthLogs.filter((log) => isSameDay(log.date, monthStats.now)),
    [monthStats]
  )
  const yesterdayLogs = useMemo(
    () => monthStats.currentMonthLogs.filter((log) => isSameDay(log.date, new Date(getStartOfDay(monthStats.now).getTime() - DAY_MS))),
    [monthStats]
  )
  const dailyComparison = useMemo(() => getDailyComparison(todayLogs, yesterdayLogs), [todayLogs, yesterdayLogs])
  const leakData = useMemo(() => detectMoneyLeaks(monthStats.currentMonthLogs), [monthStats.currentMonthLogs])
  const groupedInsights = useMemo(() => {
    const groups = { Needs: 0, Lifestyle: 0, Travel: 0, Other: 0 }
    monthStats.currentMonthLogs.forEach((log) => {
      groups[categoryGroupName(log.category)] += log.amount
    })
    const total = monthStats.totalSpent || 1
    return {
      groups,
      needsPct: (groups.Needs / total) * 100,
      lifestylePct: (groups.Lifestyle / total) * 100,
      travelPct: (groups.Travel / total) * 100,
    }
  }, [monthStats])
  const health = useMemo(
    () =>
      calculateHealthScore({
        monthlyBudgetUsed: monthStats.monthlyBudgetUsed,
        overBudgetCount: monthStats.overBudgetCategories.length,
        todaySpent: monthStats.todaySpent,
        safeSpendToday: Math.max(safeSpend.safeSpendToday, 0),
        projectedDelta: projection.projectedDelta,
        topRisks: monthStats.overBudgetCategories.map((row) => row.name),
      }),
    [monthStats, safeSpend, projection]
  )
  const coach = useMemo(
    () =>
      getCoachOutput({
        health,
        overBudgetCategories: monthStats.overBudgetCategories,
        safeSpend,
        projection,
        burnRate,
        groupedInsights,
        topCategoryRow: monthStats.topCategoryRow,
      }),
    [health, monthStats, safeSpend, projection, burnRate, groupedInsights]
  )
  const healthIssues = useMemo(
    () => getHealthIssues({ monthStats, safeSpend, projection, burnRate, leakData }),
    [monthStats, safeSpend, projection, burnRate, leakData]
  )
  const dailyChallenge = useMemo(
    () => getDailyChallenge({ monthStats, safeSpend, dailyComparison, groupedInsights, projection }),
    [monthStats, safeSpend, dailyComparison, groupedInsights, projection]
  )

  const currentMonthSummary = useMemo(
    () => Object.values(monthStats.categoryTotals).sort((a, b) => b.total - a.total),
    [monthStats.categoryTotals]
  )
  const analyticsRows = useMemo(
    () =>
      currentMonthSummary.map((row) => ({
        ...row,
        budget: budgets[row.name] || 0,
        pct: monthStats.totalSpent ? (row.total / monthStats.totalSpent) * 100 : 0,
      })),
    [currentMonthSummary, budgets, monthStats.totalSpent]
  )
  const chartData = useMemo(() => getTopCategories(monthStats.currentMonthLogs, 6), [monthStats.currentMonthLogs])
  const trendData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, index) => ({
      hour: `${String(index).padStart(2, '0')}:00`,
      amount: 0,
    }))
    todayLogs.forEach((log) => {
      hours[log.date.getHours()].amount += log.amount
    })
    return hours.filter((_, index) => index >= 6 && index <= 23)
  }, [todayLogs])

  const sortedLogs = useMemo(() => {
    const base = [...normalizedFilteredLogs]
    if (sortBy === 'amount') return base.sort((a, b) => b.amount - a.amount)
    if (sortBy === 'category') return base.sort((a, b) => a.category.localeCompare(b.category))
    return base.sort((a, b) => b.millis - a.millis)
  }, [normalizedFilteredLogs, sortBy])

  const logGroups = useMemo(() => {
    const today = []
    const yesterday = []
    const earlier = []
    sortedLogs.forEach((log) => {
      if (isSameDay(log.date, monthStats.now)) today.push(log)
      else if (isSameDay(log.date, new Date(getStartOfDay(monthStats.now).getTime() - DAY_MS))) yesterday.push(log)
      else earlier.push(log)
    })
    return [
      { title: 'Today', items: today },
      { title: 'Yesterday', items: yesterday },
      { title: 'Earlier', items: earlier },
    ].filter((group) => group.items.length)
  }, [sortedLogs, monthStats.now])

  const monthlyStory = useMemo(() => {
    const bestControlled = analyticsRows
      .filter((row) => row.budget > 0)
      .sort((a, b) => a.total / a.budget - b.total / b.budget)[0]
    const risky = monthStats.overBudgetCategories[0] || [...analyticsRows].sort((a, b) => b.total - a.total)[0]
    const nextMonthTarget =
      monthStats.monthlyBudget > 0
        ? Math.max(monthStats.monthlyBudget - Math.max(projection.projectedDelta, 0) * 0.5, monthStats.monthlyBudget * 0.88)
        : 0
    return {
      biggestCategory: monthStats.topCategoryRow?.name || 'None yet',
      bestControlled: bestControlled?.name || 'No budget data',
      risky: risky?.name || 'No risk yet',
      crossed: monthStats.overBudgetCategories.length,
      nextMonthTarget,
    }
  }, [analyticsRows, monthStats, projection.projectedDelta])

  const smartAlerts = useMemo(() => {
    const items = []
    monthStats.overBudgetCategories.slice(0, 2).forEach((row) => {
      items.push({
        icon: CAT_ICONS[row.name] || '🚨',
        title: `${row.name} over budget`,
        text: `${fmt(row.overBy)} above the current limit. Consider a tighter daily cap.`,
        severity: 'high',
      })
    })
    if (safeSpend.hasBudget && monthStats.todaySpent > safeSpend.canSpendDaily) {
      items.push({
        icon: '!',
        title: 'Daily limit crossed',
        text: `You spent ${fmt(Math.abs(safeSpend.todayDifference))} over today's revised limit.`,
        severity: 'medium',
      })
    }
    if (burnRate.burnRate > 1.1) {
      items.push({
        icon: '🔥',
        title: 'Burn rate warning',
        text: `You are spending at ${burnRate.burnRate.toFixed(1)}x of the ideal daily pace.`,
        severity: 'high',
      })
    }
    if (projection.projectedDelta > 0) {
      items.push({
        icon: '🔮',
        title: 'Projection warning',
        text: `Expected spend is ${fmt(projection.projectedSpend)}, likely over by ${fmt(projection.projectedDelta)}.`,
        severity: 'high',
      })
    }
    if (leakData.totalLeakAmount > 0) {
      items.push({
        icon: '🕳️',
        title: 'Money leak detected',
        text: `${fmt(leakData.totalLeakAmount)} found in repeated small spends this month.`,
        severity: 'medium',
      })
    }
    items.push({
      icon: '⚡',
      title: 'Challenge reminder',
      text: dailyChallenge.target,
      severity: 'low',
    })
    items.push({
      icon: '💡',
      title: 'Smart suggestion',
      text: coach.categorySuggestion,
      severity: 'low',
    })
    return items
  }, [monthStats, safeSpend, burnRate, projection, leakData, coach.categorySuggestion, dailyChallenge.target])

  const coachSignals = useMemo(() => {
    const monthlyBudget = Number(monthStats.monthlyBudget || 0)
    const monthlyTotalSpent = Number(monthStats.totalSpent || 0)
    const todaySpent = Number(monthStats.todaySpent || 0)
    const yesterdaySpent = Number(monthStats.yesterdaySpent || 0)
    const dailySpendableAmount = Number(safeSpend.dailySpendableAmount || 0)
    const currentMonthEntries = monthStats.currentMonthLogs || []
    const categoryTotals = monthStats.categoryTotals || {}
    const topCategory = monthStats.topCategoryRow || null
    const daysInMonth = Number(safeSpend.daysInMonth || projection.daysInMonth || 0)
    const currentDay = Number(monthStats.now?.getDate?.() || 0)
    const hasBudget = monthlyBudget > 0 && daysInMonth > 0
    const budgetUsedPercent = hasBudget ? (monthlyTotalSpent / monthlyBudget) * 100 : 0
    const daysPassedPercent = daysInMonth > 0 ? (currentDay / daysInMonth) * 100 : 0
    const paceGap = budgetUsedPercent - daysPassedPercent
    const todayDiff = hasBudget ? dailySpendableAmount - todaySpent : 0
    const topCategoryShare = monthlyTotalSpent > 0 && topCategory ? (Number(topCategory.total || 0) / monthlyTotalSpent) * 100 : 0
    const lowTicketLimit = hasBudget ? Math.max(200, dailySpendableAmount * 0.25) : 200
    const lowTicketEntries = currentMonthEntries.filter((log) => Number(log.amount || 0) <= lowTicketLimit)
    const lowTicketByCategory = lowTicketEntries.reduce((acc, log) => {
      const key = log.category || 'Other'
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})
    const leakRow = Object.entries(lowTicketByCategory)
      .filter(([, count]) => count >= 3)
      .sort((a, b) => b[1] - a[1])[0] || null
    const leakCategory = leakRow?.[0] || ''

    const dailyTotals = currentMonthEntries.reduce((acc, log) => {
      const key = getStartOfDay(log.date).toISOString().slice(0, 10)
      acc[key] = (acc[key] || 0) + Number(log.amount || 0)
      return acc
    }, {})
    const dailySeries = Object.entries(dailyTotals)
      .map(([date, total]) => ({ date, total }))
      .sort((a, b) => a.date.localeCompare(b.date))
    const last3 = dailySeries.slice(-3)
    const previous3 = dailySeries.slice(-6, -3)
    const avg = (rows) => rows.length ? rows.reduce((sum, row) => sum + row.total, 0) / rows.length : 0
    const last3Avg = avg(last3)
    const previous3Avg = avg(previous3)

    let moneyMode = 'Relaxed'
    if (hasBudget) {
      if (todaySpent > dailySpendableAmount || paceGap > 10) moneyMode = 'Risky'
      else if (paceGap > 3) moneyMode = 'Careful'
      else if (paceGap >= -3) moneyMode = 'Balanced'
    }

    let todayMove = 'Set budget'
    if (hasBudget) {
      if (todayDiff < 0) todayMove = 'No more spends'
      else if (todaySpent > dailySpendableAmount * 0.8) todayMove = 'Stop extras'
      else if (todaySpent > dailySpendableAmount * 0.5) todayMove = 'Go light'
      else todayMove = 'Spend freely'
    }

    let trend = 'Stable'
    if (previous3.length >= 3 && last3.length >= 3) {
      if (last3Avg > previous3Avg * 1.08) trend = 'Rising'
      else if (last3Avg < previous3Avg * 0.92) trend = 'Cooling'
    } else if (todaySpent > 0 || yesterdaySpent > 0) {
      if (todaySpent > yesterdaySpent * 1.08) trend = 'Rising'
      else if (todaySpent < yesterdaySpent * 0.92) trend = 'Cooling'
    }

    let bestSaveMove = 'Avoid extras'
    if (hasBudget && todaySpent > dailySpendableAmount) bestSaveMove = 'No more spends'
    else if (leakCategory) bestSaveMove = `Cut ${leakCategory}`
    else if (topCategory && topCategoryShare > 40) bestSaveMove = `Cut ${topCategory.name}`
    else if (trend === 'Rising') bestSaveMove = 'Go light'
    else if (moneyMode === 'Relaxed' || moneyMode === 'Balanced') bestSaveMove = 'Good pace'

    const moneyTone = moneyMode === 'Risky' ? '#dc2626' : moneyMode === 'Careful' ? '#d97706' : moneyMode === 'Balanced' ? '#2563eb' : '#16a34a'
    const todayTone = todayMove === 'No more spends' ? '#dc2626' : todayMove === 'Stop extras' ? '#d97706' : todayMove === 'Go light' ? '#2563eb' : todayMove === 'Spend freely' ? '#16a34a' : '#64748b'
    const leakTone = leakCategory ? '#d97706' : '#16a34a'
    const topTone = topCategory && topCategoryShare > 40 ? '#dc2626' : topCategory ? '#16a34a' : '#64748b'
    const trendTone = trend === 'Rising' ? '#dc2626' : trend === 'Cooling' ? '#16a34a' : '#2563eb'
    const moveTone = bestSaveMove === 'No more spends' ? '#dc2626' : bestSaveMove.startsWith('Cut ') ? '#d97706' : bestSaveMove === 'Go light' ? '#2563eb' : bestSaveMove === 'Good pace' ? '#16a34a' : '#64748b'

    return [
      { key: 'money-mode', emoji: '🧭', title: 'Mode', status: moneyMode, helper: smartAlerts.length ? 'Live alerts' : 'Pace check', tone: moneyTone, bg: `${moneyTone}12`, border: `${moneyTone}2e` },
      { key: 'today-move', emoji: '📆', title: 'Today', status: todayMove, helper: hasBudget ? 'Today only' : 'Need budget', tone: todayTone, bg: `${todayTone}12`, border: `${todayTone}2e` },
      { key: 'leak-watch', emoji: '🕳️', title: 'Leak', status: leakCategory ? `${leakCategory} leak` : 'No leak', helper: leakCategory ? 'Small repeats' : 'No repeats', tone: leakTone, bg: `${leakTone}12`, border: `${leakTone}2e` },
      { key: 'top-control', emoji: '🎯', title: 'Control', status: !currentMonthEntries.length ? 'Add entries' : topCategory && topCategoryShare > 40 ? `Control ${topCategory.name}` : 'All fine', helper: topCategory ? 'Top share' : 'No spend data', tone: topTone, bg: `${topTone}12`, border: `${topTone}2e` },
      { key: 'trend', emoji: '📈', title: 'Trend', status: trend, helper: previous3.length >= 3 ? '3-day avg' : 'Daily compare', tone: trendTone, bg: `${trendTone}12`, border: `${trendTone}2e` },
      { key: 'best-save', emoji: '⚡', title: 'Save', status: bestSaveMove, helper: hasBudget ? 'Next action' : 'Start budget', tone: moveTone, bg: `${moveTone}12`, border: `${moveTone}2e` },
    ]
  }, [monthStats, safeSpend, projection.daysInMonth, smartAlerts.length])

  const handleAdd = () => {
    if (!customAmount || Number(customAmount) <= 0) return
    if (addExpenseWithMeta) addExpenseWithMeta(noteInput, [])
    else addExpense()
    setJustAdded(true)
    setNoteInput('')
    window.setTimeout(() => setJustAdded(false), 900)
  }

  const handleDelete = (id) => {
    setDeletingId(id)
    window.setTimeout(() => {
      deleteExpense(id)
      setDeletingId(null)
    }, 260)
  }

  const saveBudget = (category) => {
    const value = parseFloat(budgetInput)
    if (!Number.isNaN(value) && value > 0) setBudgets((prev) => ({ ...prev, [category]: value }))
    setEditingBudget(null)
    setBudgetInput('')
  }

  const openBudgetAdjust = (row) => {
    setEditingBudget(row.name)
    setBudgetInput(String(row.budget || ''))
  }

  const reduceDaily = (row) => {
    const remaining = Math.max(projection.daysInMonth - projection.dayOfMonth + 1, 1)
    const overshoot = Math.max(row.spent - row.budget, 0)
    const dailyCut = overshoot > 0 ? overshoot / remaining : row.spent / Math.max(projection.dayOfMonth, 1)
    window.alert(`${row.name}: try reducing about ${fmt(dailyCut)}/day for the rest of this month.`)
  }

  const ignoreBudget = (row) => {
    window.alert(`${row.name} kept as-is. This is a UI placeholder and does not change your budget.`)
  }

  const openAutoBudget = () => {
    const startingTotal = monthStats.monthlyBudget || Object.values(budgets || {}).reduce((sum, value) => sum + Number(value || 0), 0)
    setAutoBudgetAmount(startingTotal > 0 ? String(Math.round(startingTotal)) : '')
    setAutoBudgetStyle('Balanced')
    setAutoBudgetEditing(false)
    setAutoBudgetDrafts({})
    setShowAutoBudgetSheet(true)
  }

  const applyAutoBudget = () => {
    const totalBudget = Math.max(0, Math.round(Number(autoBudgetAmount || 0)))
    if (!totalBudget) return

    const nextBudgets = autoBudgetEditing
      ? categories.reduce((acc, category) => {
          acc[category] = Math.max(0, Number(autoBudgetDrafts[category] ?? autoBudgetPlan.byCategory[category] ?? 0))
          return acc
        }, {})
      : categories.reduce((acc, category) => {
          acc[category] = Number(autoBudgetPlan.byCategory[category] || 0)
          return acc
        }, {})

    setBudgets((prev) => ({ ...prev, ...nextBudgets }))
    setShowAutoBudgetSheet(false)
    setAutoBudgetEditing(false)
    setAutoBudgetDrafts({})
    setShowBudgetToast(true)
  }

  useEffect(() => {
    if (!showAutoBudgetSheet || autoBudgetEditing) return
    setAutoBudgetDrafts(autoBudgetPlan.byCategory)
  }, [autoBudgetPlan.byCategory, autoBudgetEditing, showAutoBudgetSheet])

  useEffect(() => {
    if (!showBudgetToast) return undefined
    const timer = window.setTimeout(() => setShowBudgetToast(false), 1800)
    return () => window.clearTimeout(timer)
  }, [showBudgetToast])

  // ── Ring burst: fires when a new expense is added (skip first mount) ──
  useEffect(() => {
    const currentCount = logs.length
    if (prevLogCountRef.current === null) {
      prevLogCountRef.current = currentCount
      return
    }
    if (currentCount !== prevLogCountRef.current) {
      prevLogCountRef.current = currentCount
      setRingBurst(true)
      const t = window.setTimeout(() => setRingBurst(false), 900)
      return () => window.clearTimeout(t)
    }
  }, [logs.length])

  const exportCSV = () => {
    const rows = [['ID', 'Category', 'Amount', 'Time', 'Note']]
    logs.forEach((log) => rows.push([log.id, log.category, log.amount, log.time || '', log.note || '']))
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([rows.map((row) => row.join(',')).join('\n')], { type: 'text/csv' }))
    link.download = `expenses_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
  }

  const exportJSON = () => {
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' }))
    link.download = `expenses_${new Date().toISOString().slice(0, 10)}.json`
    link.click()
  }

  const exportText = () => {
    let text = `ACR MAX Report\n${new Date().toLocaleDateString('en-IN')}\nTotal: ${fmt(overallTotal)}\n\n`
    logs.forEach((log) => {
      text += `[${log.time || ''}] ${log.category}: ${fmt(log.amount)}${log.note ? ` - ${log.note}` : ''}\n`
    })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
    link.download = `expenses_${new Date().toISOString().slice(0, 10)}.txt`
    link.click()
  }

  const monthLabel = monthStats.now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  const budgetTone =
    monthStats.monthlyBudgetUsed > 100
      ? 'linear-gradient(90deg,#ef4444,#fb7185)'
      : monthStats.monthlyBudgetUsed > 80
        ? 'linear-gradient(90deg,#f59e0b,#f97316)'
        : 'linear-gradient(90deg,#16a34a,#22c55e)'
  const canSpendDailyTone = !safeSpend.hasBudget
    ? '#64748b'
    : safeSpend.budgetBalance <= 0 || monthStats.todaySpent > safeSpend.canSpendDaily
      ? '#dc2626'
      : monthStats.todaySpent > safeSpend.canSpendDaily * 0.8
        ? '#d97706'
        : '#16a34a'

  // ─── TOP ROW micro cards: bright metallic ────────────────────────────────
  const summaryTopMetalCardStyle = {
    position: 'relative',
    overflow: 'hidden',
    background: 'linear-gradient(135deg, rgba(255,255,255,0.92), rgba(210,220,235,0.75), rgba(255,255,255,0.55))',
    border: '1px solid rgba(255,255,255,0.35)',
    boxShadow: '0 6px 14px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.95)',
    backdropFilter: 'blur(12px)',
  }
  // ─── BOTTOM ROW: Today Status → green tint ───────────────────────────────
  const summaryStatusCardStyle = {
    position: 'relative',
    overflow: 'hidden',
    background: 'linear-gradient(135deg, rgba(240,255,248,0.95), rgba(200,240,218,0.78), rgba(240,255,248,0.60))',
    border: '1px solid rgba(80,200,120,0.30)',
    boxShadow: '0 6px 14px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.95)',
    backdropFilter: 'blur(12px)',
  }
  // ─── BOTTOM ROW: Can Spend Daily → cyan/blue tint ────────────────────────
  const summaryDailyCardStyle = {
    position: 'relative',
    overflow: 'hidden',
    background: 'linear-gradient(135deg, rgba(235,248,255,0.95), rgba(190,225,245,0.78), rgba(235,248,255,0.60))',
    border: '1px solid rgba(56,189,248,0.30)',
    boxShadow: '0 6px 14px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.95)',
    backdropFilter: 'blur(12px)',
  }
  // ─── BOTTOM ROW: Today/Yesterday → violet tint ───────────────────────────
  const summaryCompareCardStyle = {
    position: 'relative',
    overflow: 'hidden',
    background: 'linear-gradient(135deg, rgba(245,240,255,0.95), rgba(210,195,245,0.78), rgba(245,240,255,0.60))',
    border: '1px solid rgba(139,92,246,0.30)',
    boxShadow: '0 6px 14px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.95)',
    backdropFilter: 'blur(12px)',
  }

  const timelineFilterStyle = {
    ...inputStyle,
    minWidth: 0,
    height: 36,
    padding: '8px 9px',
    borderRadius: 11,
    border: '1px solid rgba(255,255,255,0.72)',
    background: 'rgba(255,255,255,0.78)',
    boxShadow: '0 10px 24px rgba(30,55,90,0.10), inset 0 1px 0 rgba(255,255,255,0.98)',
    backdropFilter: 'blur(12px)',
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
        .exp-root * { font-family: 'Poppins', sans-serif; box-sizing: border-box; }
        .exp-root .syne { font-family: 'Poppins', sans-serif; }
        .exp-tabs::-webkit-scrollbar, .hide-scrollbar::-webkit-scrollbar { display: none; }
        .expense-page-root {
          width: 100%;
          box-sizing: border-box;
        }
        .expense-full-bleed {
          width: 100%;
          box-sizing: border-box;
        }
        @keyframes pcOrbPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        @keyframes pcOrbBurst {
          0% { transform: scale(1); opacity: 1; }
          30% { transform: scale(1.12); opacity: 0.92; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes pcRingRotate {
          from { transform: rotate(-90deg); }
          to { transform: rotate(270deg); }
        }
        @keyframes pcRingFlash {
          0% { filter: drop-shadow(0 0 3px currentColor); }
          40% { filter: drop-shadow(0 0 12px currentColor) drop-shadow(0 0 22px currentColor); }
          100% { filter: drop-shadow(0 0 3px currentColor); }
        }
        @keyframes expPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(248,113,113,0.18); }
          50% { box-shadow: 0 0 0 8px rgba(248,113,113,0.08); }
        }
        @keyframes expPulseSoft {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.03); }
        }
        @keyframes expPulseDanger {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 6px rgba(220,38,38,0.12), 0 10px 22px rgba(15,23,42,0.08); }
          50% { transform: scale(1.05); box-shadow: 0 0 0 9px rgba(220,38,38,0.15), 0 10px 22px rgba(15,23,42,0.08); }
        }
        @keyframes expRingAura {
          0%, 100% { box-shadow: 0 0 0 0 rgba(96,165,250,0.10), 0 10px 24px rgba(2,8,23,0.20); }
          50% { box-shadow: 0 0 0 5px rgba(96,165,250,0.08), 0 14px 30px rgba(2,8,23,0.24); }
        }
        @keyframes coachShellGlow {
          0%, 100% { box-shadow: 0 0 0 1px rgba(124,58,237,0.10), 0 22px 42px rgba(124,58,237,0.08), inset 0 1px 0 rgba(255,255,255,0.72); }
          50% { box-shadow: 0 0 0 1px rgba(124,58,237,0.16), 0 24px 48px rgba(124,58,237,0.10), inset 0 1px 0 rgba(255,255,255,0.8); }
        }
        @keyframes coachShimmer {
          0% { transform: translateX(-130%); opacity: 0; }
          15% { opacity: 0.24; }
          55% { opacity: 0.14; }
          100% { transform: translateX(150%); opacity: 0; }
        }
        @keyframes coachScanLine {
          0%, 100% { transform: translateY(0); opacity: 0.18; }
          50% { transform: translateY(104px); opacity: 0.30; }
        }
        @keyframes coachDotFloat {
          0%, 100% { transform: translate3d(0,0,0); opacity: 0.16; }
          50% { transform: translate3d(0,-6px,0); opacity: 0.30; }
        }
        @keyframes coachDotPulse {
          0%, 100% { transform: scale(1); opacity: 0.82; box-shadow: 0 0 0 0 rgba(124,58,237,0.18); }
          50% { transform: scale(1.08); opacity: 1; box-shadow: 0 0 0 5px rgba(124,58,237,0.08); }
        }
        @keyframes coachCardRiskPulse {
          0%, 100% { box-shadow: 0 14px 30px rgba(220,38,38,0.13), 0 3px 10px rgba(15,23,42,0.06), 0 0 0 0 rgba(239,68,68,0.00); }
          50% { box-shadow: 0 16px 34px rgba(220,38,38,0.16), 0 3px 10px rgba(15,23,42,0.06), 0 0 0 5px rgba(239,68,68,0.06); }
        }
        @keyframes coachCardSafeGlow {
          0%, 100% { box-shadow: 0 14px 30px rgba(22,163,74,0.12), 0 3px 10px rgba(15,23,42,0.06), 0 0 0 0 rgba(34,197,94,0.00); }
          50% { box-shadow: 0 16px 34px rgba(22,163,74,0.14), 0 3px 10px rgba(15,23,42,0.06), 0 0 0 5px rgba(34,197,94,0.05); }
        }
        .coach-shell {
          position: relative;
          overflow: hidden;
          border-radius: 28px;
          background:
            linear-gradient(155deg, rgba(255,255,255,0.96) 0%, rgba(249,250,255,0.92) 54%, rgba(245,243,255,0.92) 100%);
          border: 1px solid rgba(255,255,255,0.72);
          animation: coachShellGlow 4.8s ease-in-out infinite;
        }
        .coach-shell::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(100deg, transparent 0%, rgba(255,255,255,0.44) 46%, transparent 64%);
          animation: coachShimmer 5.6s linear infinite;
          pointer-events: none;
        }
        .coach-shell::after {
          content: '';
          position: absolute;
          left: 14px;
          right: 14px;
          top: 62px;
          height: 1px;
          background: linear-gradient(90deg, transparent 0%, rgba(124,58,237,0.10) 12%, rgba(124,58,237,0.34) 48%, rgba(59,130,246,0.18) 78%, transparent 100%);
          filter: blur(0.2px);
          animation: coachScanLine 6s ease-in-out infinite;
          pointer-events: none;
        }
        .coach-particles {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }
        .coach-particle {
          position: absolute;
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: radial-gradient(circle, rgba(124,58,237,0.22) 0%, rgba(124,58,237,0.08) 48%, rgba(255,255,255,0) 72%);
          animation: coachDotFloat 5.8s ease-in-out infinite;
        }
        .coach-pill {
          animation: coachDotPulse 2.6s ease-in-out infinite;
        }
        .coach-card {
          transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
          will-change: transform;
        }
        .coach-card:hover, .coach-card:active {
          transform: translateY(-2px);
        }
        .coach-card-safe {
          animation: coachCardSafeGlow 4.8s ease-in-out infinite;
        }
        .coach-card-risk {
          animation: coachCardRiskPulse 4.2s ease-in-out infinite;
        }
        .coach-card-sheen {
          position: absolute;
          inset: -30% auto auto -60%;
          width: 78%;
          height: 120%;
          background: linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.24) 48%, transparent 100%);
          transform: rotate(14deg);
          animation: coachShimmer 7s linear infinite;
          pointer-events: none;
        }
        @media (max-width: 640px) {
          .expense-page-root {
            width: calc(100% + 16px) !important;
            max-width: none !important;
            margin-left: -8px !important;
            margin-right: -8px !important;
            padding-left: 3px !important;
            padding-right: 3px !important;
            overflow-x: hidden;
          }
          .expense-full-bleed {
            width: 100% !important;
            max-width: none !important;
            margin-left: 0 !important;
            margin-right: 0 !important;
          }
          .exp-grid-overview { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .exp-grid-2 { grid-template-columns: 1fr !important; }
          .exp-grid-3 { grid-template-columns: 1fr !important; }
          .exp-mobile-breakdown { display: flex !important; }
          .exp-analytics-table { display: none !important; }
          .exp-filter-row { grid-template-columns: minmax(0,1fr) 82px 74px !important; }
          .coach-shell { border-radius: 20px; }
        }
        @media (min-width: 641px) {
          .exp-mobile-breakdown { display: none !important; }
        }
      `}</style>

      <div style={{ position: 'fixed', right: 12, bottom: 144, zIndex: 1200, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
        {showMobileForm ? (
          <GlassCard style={{ width: 'min(92vw, 360px)', padding: 14, borderRadius: 26 }} accent="rgba(124,58,237,0.18)">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <p className="syne" style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Add expense</p>
              <button onClick={() => setShowMobileForm(false)} style={actionBtn('#64748b', '#f8fafc')}>Close</button>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              <select value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} style={inputStyle}>
                {categories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              <input type="number" value={customAmount} onChange={(e) => setCustomAmount(e.target.value)} placeholder="Amount" style={inputStyle} />
              <input type="text" value={noteInput} onChange={(e) => setNoteInput(e.target.value)} placeholder="Note (optional)" style={inputStyle} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={triggerCamera} style={actionBtn('#16a34a', '#ecfdf5')}>📷</button>
                <input type="file" accept="image/*" capture="environment" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImageCapture} />
                <button
                  onClick={() => {
                    handleAdd()
                    if (Number(customAmount) > 0) setShowMobileForm(false)
                  }}
                  style={{ ...actionBtn('#fff', justAdded ? '#16a34a' : '#7c3aed'), flex: 1, border: 'none' }}
                >
                  {justAdded ? 'Added' : '+ Add'}
                </button>
              </div>
            </div>
          </GlassCard>
        ) : null}
        <button
          onClick={() => setShowMobileForm((value) => !value)}
          style={{
            width: 50,
            height: 50,
            borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.9)',
            background: 'linear-gradient(135deg,#0f172a,#334155 45%,#7c3aed)',
            color: '#fff',
            fontSize: 26,
            cursor: 'pointer',
            boxShadow: '0 8px 18px rgba(15,23,42,0.18)',
          }}
        >
          {showMobileForm ? '×' : '+'}
        </button>
      </div>

      {showAlertsSheet ? (
        <ExpenseAlertsSheet
          alerts={smartAlerts}
          onClose={() => setShowAlertsSheet(false)}
          onViewBudgets={() => {
            setShowAlertsSheet(false)
            setExpenseTab('budget')
          }}
        />
      ) : null}

      {showHealthSheet ? (
        <BottomSheet title="Expense health" subtitle={`${health.score}/100 • ${health.status}`} onClose={() => setShowHealthSheet(false)} accent="rgba(22,163,74,0.16)">
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ padding: '12px 12px', borderRadius: 18, background: 'rgba(255,255,255,0.62)', border: '1px solid rgba(226,232,240,0.92)' }}>
              <p style={{ margin: 0, fontSize: 12, color: '#475569', lineHeight: 1.5 }}>{health.reason}</p>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {healthIssues.length ? healthIssues.map((issue) => (
                <div key={issue} style={{ padding: '11px 12px', borderRadius: 18, background: '#fff7ed', border: '1px solid #fed7aa', color: '#7c2d12', fontSize: 11.5, lineHeight: 1.45 }}>
                  {issue}
                </div>
              )) : <div style={{ padding: '11px 12px', borderRadius: 18, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', fontSize: 11.5 }}>No major pressure signs right now.</div>}
            </div>
            <div style={{ padding: '12px 12px', borderRadius: 18, background: '#f8fafc', border: '1px solid #dbe2ea' }}>
              <p style={{ margin: 0, fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569' }}>Improvement actions</p>
              <div style={{ display: 'grid', gap: 6, marginTop: 7 }}>
                <p style={{ margin: 0, fontSize: 11.5, color: '#475569' }}>1. Stay under {safeSpend.remainingBudget >= 0 ? fmt(Math.max(safeSpend.safeSpendToday, 0)) : `${fmt(Math.abs(safeSpend.safeSpendToday))}/day`} from now.</p>
                <p style={{ margin: 0, fontSize: 11.5, color: '#475569' }}>2. Review {monthStats.overBudgetCategories[0]?.name || monthStats.topCategoryRow?.name || 'top spending'} before the next spend.</p>
                <p style={{ margin: 0, fontSize: 11.5, color: '#475569' }}>3. Cut low-value repeat spends first to recover faster.</p>
              </div>
            </div>
            <div style={{ padding: '12px 12px', borderRadius: 18, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
              <p style={{ margin: 0, fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#1d4ed8' }}>How to improve</p>
              <p style={{ margin: '6px 0 0', fontSize: 11.5, color: '#1e3a8a', lineHeight: 1.5 }}>{coach.recoveryPlan} {coach.categorySuggestion}</p>
              {coach.suggestedDailyCut ? <p style={{ margin: '8px 0 0', fontSize: 11.5, fontWeight: 800, color: '#1d4ed8' }}>Suggested daily cut: {fmt(coach.suggestedDailyCut)}</p> : null}
            </div>
          </div>
        </BottomSheet>
      ) : null}

      {showChallengeSheet ? (
        <BottomSheet title="Today's money challenge" subtitle={monthStats.now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })} onClose={() => setShowChallengeSheet(false)} accent="rgba(245,158,11,0.16)">
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ padding: '13px 13px', borderRadius: 18, background: '#fff7ed', border: '1px solid #fed7aa' }}>
              <p className="syne" style={{ margin: 0, fontSize: 21, color: '#9a3412' }}>{dailyChallenge.title}</p>
              <p style={{ margin: '7px 0 0', fontSize: 12, color: '#7c2d12', lineHeight: 1.45 }}>{dailyChallenge.target}</p>
            </div>
            <div style={{ padding: '12px 12px', borderRadius: 18, background: 'rgba(255,255,255,0.62)', border: '1px solid rgba(226,232,240,0.92)' }}>
              <p style={{ margin: 0, fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b' }}>Why today</p>
              <p style={{ margin: '6px 0 0', fontSize: 11.5, color: '#475569', lineHeight: 1.5 }}>{dailyChallenge.reason}</p>
              <p style={{ margin: '8px 0 0', fontSize: 11.5, fontWeight: 800, color: '#d97706' }}>{dailyChallenge.reward}</p>
            </div>
          </div>
        </BottomSheet>
      ) : null}

      {showAutoBudgetSheet ? (
        <AutoBudgetSheet
          amount={autoBudgetAmount}
          setAmount={setAutoBudgetAmount}
          style={autoBudgetStyle}
          setStyle={setAutoBudgetStyle}
          previewRows={autoBudgetPreviewRows}
          hasHistory={autoBudgetPlan.hasHistory}
          isEditing={autoBudgetEditing}
          setIsEditing={setAutoBudgetEditing}
          draftBudgets={autoBudgetDrafts}
          setDraftBudgets={setAutoBudgetDrafts}
          onApply={applyAutoBudget}
          onClose={() => {
            setShowAutoBudgetSheet(false)
            setAutoBudgetEditing(false)
            setAutoBudgetDrafts({})
          }}
        />
      ) : null}

      <div className="exp-root expense-page-root" style={{ width: '100%', maxWidth: 'none', margin: 0, padding: '0 1px', paddingBottom: 214, color: '#0f172a' }}>
        {showBudgetToast ? (
          <div style={{ position: 'fixed', left: '50%', bottom: 102, transform: 'translateX(-50%)', zIndex: 6200, padding: '10px 14px', borderRadius: 999, background: 'rgba(15,23,42,0.92)', color: '#fff', fontSize: 11.5, fontWeight: 800, boxShadow: '0 12px 24px rgba(15,23,42,0.2)' }}>
            Budget updated ⚡
          </div>
        ) : null}
        <div style={{ display: 'grid', gap: 6 }}>
          <GlassCard className="expense-full-bleed" style={{ padding: 8 }} accent="rgba(245,158,11,0.18)">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <img src="/logo.jpg" alt="ACR Max" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', boxShadow: '0 8px 16px rgba(15,23,42,0.14)' }} />
                <div style={{ minWidth: 0 }}>
                  <h2 className="syne" style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a', lineHeight: 1.05 }}>Expenses</h2>
                  <p style={{ margin: '2px 0 0', fontSize: 10.5, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {monthStats.now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  onClick={() => setShowChallengeSheet(true)}
                  style={{
                    minWidth: 32,
                    height: 30,
                    borderRadius: 10,
                    padding: '0 8px',
                    border: '1px solid #fde68a',
                    background: 'linear-gradient(145deg,#fffbeb,#ffffff)',
                    color: '#d97706',
                    fontWeight: 800,
                    fontSize: 11.5,
                    cursor: 'pointer',
                    boxShadow: '0 0 0 3px rgba(245,158,11,0.05)',
                  }}
                >
                  ⚡
                </button>
                <button
                  onClick={() => setShowAlertsSheet(true)}
                  style={{
                    minWidth: 32,
                    height: 30,
                    borderRadius: 10,
                    padding: '0 8px',
                    border: `1px solid ${smartAlerts.length ? '#fecdd3' : '#dbe2ea'}`,
                    background: smartAlerts.length ? 'linear-gradient(145deg,#fff1f2,#ffffff)' : 'linear-gradient(145deg,#ffffff,#f8fafc)',
                    color: smartAlerts.length ? '#dc2626' : '#475569',
                    fontWeight: 800,
                    fontSize: 11,
                    cursor: 'pointer',
                    boxShadow: smartAlerts.length ? '0 0 0 3px rgba(248,113,113,0.08)' : '0 6px 12px rgba(15,23,42,0.04)',
                    animation: smartAlerts.length ? 'expPulse 2.2s ease-in-out infinite' : 'none',
                  }}
                >
                  {smartAlerts.length ? `🚨${smartAlerts.length}` : '🚨'}
                </button>
              </div>
            </div>
          </GlassCard>

          {/* ─── MAIN SUMMARY CARD: TRUE NEBULA with layered absolute overlays ── */}
          <div
            className="expense-full-bleed"
            style={{
              position: 'relative',
              overflow: 'hidden',
              borderRadius: 16,
              padding: 8,
              border: '1px solid rgba(96,130,200,0.28)',
              background: 'linear-gradient(145deg, #010812 0%, #050f26 28%, #080d22 55%, #030a1a 80%, #020710 100%)',
              boxShadow:
                '0 22px 44px rgba(1,6,18,0.60), 0 8px 18px rgba(2,8,23,0.38), inset 0 1px 0 rgba(255,255,255,0.20), inset 0 -20px 50px rgba(0,0,0,0.35)',
            }}
          >
            {/* A) BLUE NEBULA */}
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(circle at 25% 65%, rgba(70,130,255,0.35), transparent 45%)',
              filter: 'blur(60px)',
              zIndex: 0,
              pointerEvents: 'none',
            }} />
            {/* B) VIOLET NEBULA */}
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(circle at 80% 20%, rgba(140,90,255,0.30), transparent 40%)',
              filter: 'blur(50px)',
              zIndex: 0,
              pointerEvents: 'none',
            }} />
            {/* C) CYAN GLOW behind amount */}
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(circle at 40% 35%, rgba(80,200,255,0.25), transparent 35%)',
              filter: 'blur(40px)',
              zIndex: 0,
              pointerEvents: 'none',
            }} />
            {/* D) STAR DUST */}
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'repeating-radial-gradient(circle at center, rgba(255,255,255,0.18) 0 1px, transparent 1px 20px)',
              opacity: 0.10,
              zIndex: 0,
              pointerEvents: 'none',
            }} />
            {/* Top edge chrome shine streak */}
            <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(148,196,255,0.45) 38%, rgba(200,230,255,0.55) 52%, rgba(148,196,255,0.45) 66%, transparent)', borderRadius: 999, zIndex: 1, pointerEvents: 'none' }} />

            {/* ALL REAL CONTENT at zIndex 1+ */}
            <div style={{ position: 'relative', zIndex: 1, display: 'grid', gap: 6 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'start' }}>
                <div>
                  <p style={{ margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(226,232,240,0.82)' }}>Monthly total spent</p>
                  <p className="syne" style={{ margin: '3px 0 0', fontSize: 23, lineHeight: 1, fontWeight: 800, color: '#f8fbff', textShadow: '0 0 6px rgba(255,255,255,0.4), 0 4px 18px rgba(59,130,246,0.18), 0 3px 12px rgba(15,23,42,0.3)' }}>
                    <CountUp value={monthStats.totalSpent} />
                  </p>

                  {/* top row micro cards: Today / Top / Entries */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 5, marginTop: 11 }}>
                    {[
                      { label: 'Today', value: fmt(monthStats.todaySpent), tone: '#b45309' },
                      { label: 'Top', value: shortCategory(monthStats.topCategoryRow?.name || '--'), tone: monthStats.topCategoryRow?.color || '#2563eb' },
                      { label: 'Entries', value: String(monthStats.totalEntries), tone: '#334155' },
                    ].map((item) => (
                      <div key={item.label} style={{ ...summaryTopMetalCardStyle, padding: '7px 8px', borderRadius: 11 }}>
                        {/* diagonal chrome shine overlay */}
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(118deg, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.10) 44%, transparent 68%)', pointerEvents: 'none', borderRadius: 'inherit' }} />
                        <p style={{ margin: 0, fontSize: 9, color: '#475569', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', position: 'relative', zIndex: 1 }}>{item.label}</p>
                        <p style={{ margin: '3px 0 0', fontSize: 13.5, fontWeight: 800, color: item.tone, lineHeight: 1.08, position: 'relative', zIndex: 1 }}>{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <HealthRing
                    score={health.score}
                    budgetPct={monthStats.monthlyBudgetUsed}
                    ringBurst={ringBurst}
                    onClick={() => setShowHealthSheet(true)}
                  />
                  <span style={{ padding: '3px 7px', borderRadius: 999, background: health.score >= 70 ? '#dcfce7' : health.score >= 40 ? '#ffedd5' : '#fee2e2', color: health.score >= 70 ? '#166534' : health.score >= 40 ? '#c2410c' : '#b91c1c', fontSize: 9.5, fontWeight: 800 }}>
                    {health.status}
                  </span>
                  <span style={{ padding: '3px 7px', borderRadius: 999, border: '1px solid rgba(191,219,254,0.24)', background: 'linear-gradient(145deg, rgba(255,255,255,0.14), rgba(96,165,250,0.10))', color: 'rgba(226,232,240,0.86)', fontSize: 8.5, fontWeight: 800, letterSpacing: '0.03em', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)' }}>Tap for tips</span>
                </div>
              </div>

              {/* bottom row micro cards: Today Status / Can Spend Daily / Today vs Yesterday */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 5, marginTop: 5 }}>
                {/* Today Status — green tint */}
                <div style={{ ...summaryStatusCardStyle, padding: '6px 8px', borderRadius: 11, minWidth: 0 }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(118deg, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.10) 44%, transparent 68%)', pointerEvents: 'none', borderRadius: 'inherit' }} />
                  <p style={{ margin: 0, fontSize: 8.5, color: '#475569', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em', lineHeight: 1.1, position: 'relative', zIndex: 1 }}>Today Status</p>
                  <p style={{ margin: '4px 0 0', fontSize: 12.5, fontWeight: 800, color: summaryTodayStatusCard.tone, lineHeight: 1.08, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', position: 'relative', zIndex: 1 }}>
                    {summaryTodayStatusCard.value}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 8, color: '#475569', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', position: 'relative', zIndex: 1 }}>
                    {summaryTodayStatusCard.sub}
                  </p>
                </div>

                {/* Can Spend Daily — cyan/blue tint */}
                <div style={{ ...summaryDailyCardStyle, padding: '6px 8px', borderRadius: 11, minWidth: 0 }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(118deg, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.10) 44%, transparent 68%)', pointerEvents: 'none', borderRadius: 'inherit' }} />
                  <p style={{ margin: 0, fontSize: 8.5, color: '#475569', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em', lineHeight: 1.1, position: 'relative', zIndex: 1 }}>Can Spend Daily</p>
                  <p style={{ margin: '4px 0 0', fontSize: 12.5, fontWeight: 800, color: canSpendDailyTone, lineHeight: 1.08, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', position: 'relative', zIndex: 1 }}>
                    {safeSpend.hasBudget ? `${fmt(safeSpend.canSpendDaily)}/day` : 'Set budget'}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 8, color: '#475569', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', position: 'relative', zIndex: 1 }}>
                    {safeSpend.hasBudget ? 'To stay in budget' : 'Add budget first'}
                  </p>
                </div>

                {/* Today / Yesterday — violet tint */}
                <div style={{ ...summaryCompareCardStyle, padding: '6px 8px', borderRadius: 11, minWidth: 0 }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(118deg, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.10) 44%, transparent 68%)', pointerEvents: 'none', borderRadius: 'inherit' }} />
                  <p style={{ margin: 0, fontSize: 8.5, color: '#475569', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.02em', lineHeight: 1.1, position: 'relative', zIndex: 1 }}>Today / Yesterday</p>
                  <p style={{ margin: '4px 0 0', fontSize: 12.5, fontWeight: 800, color: '#334155', lineHeight: 1.08, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', position: 'relative', zIndex: 1 }}>
                    {todayYesterdayMetric.value}
                  </p>
                  <span style={{ display: 'inline-flex', alignSelf: 'flex-start', marginTop: 3, padding: '1px 6px', borderRadius: 999, background: todayYesterdayMetric.chipBg, color: todayYesterdayMetric.chipColor, border: `1px solid ${todayYesterdayMetric.chipBorder}`, fontSize: 8, fontWeight: 800, lineHeight: 1.2, whiteSpace: 'nowrap', position: 'relative', zIndex: 1 }}>
                    {todayYesterdayMetric.chip}
                  </span>
                </div>
              </div>

              {/* budget progress bar */}
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(226,232,240,0.82)' }}>Budget used</span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: monthStats.monthlyBudgetUsed > 100 ? '#dc2626' : monthStats.monthlyBudgetUsed > 80 ? '#d97706' : '#16a34a' }}>
                    {Math.round(monthStats.monthlyBudgetUsed)}%
                  </span>
                </div>
                <ProgressLine pct={monthStats.monthlyBudgetUsed} tone={budgetTone} />
              </div>

              {/* BUDGET CHIPS — visible glass style with tints + icons */}
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6 }}>
                {/* Balance chip */}
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '5px 10px',
                  borderRadius: 999,
                  background: !safeSpend.hasBudget
                    ? 'rgba(255,255,255,0.18)'
                    : safeSpend.budgetBalance >= 0
                      ? 'rgba(80,200,120,0.20)'
                      : 'rgba(239,68,68,0.20)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.35)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.10)',
                  fontSize: 9.5,
                  fontWeight: 800,
                  color: !safeSpend.hasBudget
                    ? 'rgba(226,232,240,0.92)'
                    : safeSpend.budgetBalance >= 0
                      ? '#86efac'
                      : '#fca5a5',
                }}>
                  💰 {safeSpend.hasBudget ? `${fmt(safeSpend.budgetBalance)} balance` : 'Set budget'}
                </span>

                {/* Budget chip */}
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '5px 10px',
                  borderRadius: 999,
                  background: 'rgba(59,130,246,0.20)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.35)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.10)',
                  fontSize: 9.5,
                  fontWeight: 800,
                  color: '#93c5fd',
                }}>
                  🎯 {fmt(monthStats.monthlyBudget || 0)} budget
                </span>

                {/* Over budget chip */}
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '5px 10px',
                  borderRadius: 999,
                  background: Math.max(monthStats.totalSpent - monthStats.monthlyBudget, 0) === 0
                    ? 'rgba(80,200,120,0.20)'
                    : 'rgba(239,68,68,0.20)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.35)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.10)',
                  fontSize: 9.5,
                  fontWeight: 800,
                  color: Math.max(monthStats.totalSpent - monthStats.monthlyBudget, 0) === 0
                    ? '#86efac'
                    : '#fca5a5',
                }}>
                  {Math.max(monthStats.totalSpent - monthStats.monthlyBudget, 0) === 0 ? '✅' : '⚠️'} {fmt(Math.max(monthStats.totalSpent - monthStats.monthlyBudget, 0))} over budget
                </span>
              </div>
            </div>
          </div>

          <GlassCard className="expense-full-bleed" style={{ padding: 6 }} accent="rgba(124,58,237,0.16)">
            <div className="exp-tabs hide-scrollbar" style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 1, scrollbarWidth: 'none' }}>
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setExpenseTab(tab.id)}
                  style={{
                    padding: '6px 9px',
                    borderRadius: 999,
                    border: `1px solid ${expenseTab === tab.id ? '#c4b5fd' : '#e2e8f0'}`,
                    background: expenseTab === tab.id ? 'linear-gradient(145deg,#faf5ff,#f3e8ff)' : 'linear-gradient(145deg,#ffffff,#f8fafc)',
                    color: expenseTab === tab.id ? '#6d28d9' : '#475569',
                    fontWeight: 800,
                    fontSize: 10.5,
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    boxShadow: expenseTab === tab.id ? '0 4px 10px rgba(124,58,237,0.1)' : '0 3px 8px rgba(15,23,42,0.03)',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </GlassCard>

          {expenseTab === 'daily' ? (
            <div
              className="expense-full-bleed"
              style={{
                position: 'relative',
                overflow: 'hidden',
                borderRadius: 16,
                padding: 9,
                background: 'linear-gradient(145deg, rgba(255,255,255,0.88), rgba(225,235,248,0.72))',
                border: '1px solid rgba(255,255,255,0.72)',
                boxShadow: '0 10px 24px rgba(30,55,90,0.10), inset 0 1px 0 rgba(255,255,255,0.98)',
                backdropFilter: 'blur(18px)',
              }}
            >
              <SectionHdr
                title="Expense Timeline"
                accent="#475569"
                right={<span style={{ fontSize: 10.5, color: '#64748b', fontWeight: 700 }}>{sortedLogs.length} entries</span>}
              />

              <div className="exp-filter-row" style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.8fr 0.8fr', gap: 6, marginBottom: 8 }}>
                <input type="text" placeholder="Search" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={timelineFilterStyle} />
                <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} style={{ ...timelineFilterStyle, padding: '8px 7px', fontSize: 10.5 }}>
                  <option value="All">All categories</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ ...timelineFilterStyle, padding: '8px 7px', fontSize: 10.5 }}>
                  <option value="time">Latest</option>
                  <option value="amount">Highest</option>
                  <option value="category">A-Z</option>
                </select>
              </div>

              {todayLogs.length ? (
                <div style={{ marginBottom: 8, padding: '6px 8px', borderRadius: 11, background: 'linear-gradient(145deg, rgba(239,246,255,0.94), rgba(255,255,255,0.92))', border: '1px solid rgba(191,219,254,0.82)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.96), 0 6px 14px rgba(37,99,235,0.05)' }}>
                  <p style={{ margin: 0, fontSize: 10.5, fontWeight: 800, color: '#1d4ed8' }}>
                    Today {fmt(monthStats.todaySpent)} · {todayLogs.length} entries · Top {shortCategory(getTopCategories(todayLogs, 1)[0]?.name || '—')}
                  </p>
                </div>
              ) : null}

              {logGroups.length ? (
                <div style={{ display: 'grid', gap: 9, paddingBottom: 78 }}>
                  {logGroups.map((group) => (
                    <div key={group.title}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 999, background: group.title === 'Today' ? '#3b82f6' : group.title === 'Yesterday' ? '#64748b' : '#94a3b8', boxShadow: group.title === 'Today' ? '0 0 0 4px rgba(59,130,246,0.10)' : group.title === 'Yesterday' ? '0 0 0 4px rgba(100,116,139,0.08)' : '0 0 0 4px rgba(148,163,184,0.08)' }} />
                        <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: group.title === 'Today' ? '#1d4ed8' : group.title === 'Yesterday' ? '#475569' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{group.title}</p>
                      </div>
                      <div style={{ display: 'grid', gap: 5 }}>
                        {group.items.map((log) => (
                          <div
                            key={log.id}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'auto 1fr auto auto',
                              gap: 7,
                              alignItems: 'center',
                              padding: '7px 8px',
                              borderRadius: 11,
                              background: 'rgba(255,255,255,0.78)',
                              border: 'none',
                              boxShadow: '0 10px 24px rgba(30,55,90,0.10)',
                              opacity: deletingId === log.id ? 0.45 : 1,
                              transition: 'opacity 0.2s ease',
                              backdropFilter: 'blur(10px)',
                            }}
                          >
                            <div style={{ width: 28, height: 28, borderRadius: 10, background: `${CAT_COLORS[log.category] || '#64748b'}18`, color: CAT_COLORS[log.category] || '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
                              {CAT_ICONS[log.category] || '💸'}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {log.category}{log.note ? ` • ${log.note}` : ''}
                              </p>
                              <p style={{ margin: '1px 0 0', fontSize: 9, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {log.timeLabel} • {log.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}{log.paymentMode ? ` • ${log.paymentMode}` : ''}
                              </p>
                            </div>
                            <p style={{ margin: 0, fontSize: 12.5, fontWeight: 800, color: '#b45309', whiteSpace: 'nowrap' }}>{fmt(log.amount)}</p>
                            <button onClick={() => handleDelete(log.id)} style={{ ...miniActionBtn('#dc2626', '#fff1f2'), padding: '5px 7px' }}>Del</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>No expense logs match this filter yet.</p>
              )}
            </div>
          ) : null}

          {expenseTab === 'overview' ? (
            <div style={{ display: 'grid', gap: 10 }}>
              <div className="exp-grid-overview" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                <div style={{ display: 'grid', gap: 8 }}><MiniOverviewCard label="Revised Daily Limit" value={safeSpend.hasBudget ? `${fmt(safeSpend.canSpendDaily)}/day` : 'Set budget'} sub={safeSpend.hasBudget ? `To stay in budget. Base ${fmt(safeSpend.baseDailyLimit)}/day.` : 'Add budget to track daily spending.'} tone={canSpendDailyTone} /><MiniOverviewCard label="Today's Spend Status" value={todaySpendStatus.value} sub={todaySpendStatus.sub} tone={todaySpendStatus.tone} /></div>
                <div style={{ display: 'grid', gap: 8 }}>
                  <MiniOverviewCard label="Burn Rate" value={`${burnRate.burnRate.toFixed(1)}x`} sub={burnRate.burnRate > 1.1 ? 'Spending too fast.' : burnRate.burnRate < 0.9 ? 'Below plan pace.' : 'Close to plan.'} tone={burnRate.burnRate > 1.1 ? '#dc2626' : burnRate.burnRate < 0.9 ? '#16a34a' : '#d97706'} />
                  <MiniOverviewCard label="Today vs Yesterday" value={dailyComparison ? `${dailyComparison.diff <= 0 ? 'Down' : 'Up'} ${fmt(Math.abs(dailyComparison.diff))}` : '--'} sub={dailyComparison ? dailyComparison.diff <= 0 ? 'Lower than yesterday.' : 'Higher than yesterday.' : 'Need more entries.'} tone={dailyComparison ? dailyComparison.diff <= 0 ? '#16a34a' : '#dc2626' : '#64748b'} />
                </div></div>

              <GlassCard style={{ padding: 11 }} accent="rgba(59,130,246,0.15)">
                <SectionHdr title="Money Leak Detector" accent="#2563eb" subtitle={leakData.totalLeakAmount ? `${fmt(leakData.totalLeakAmount)} found in repeat spends.` : 'No repeated low-ticket leak found yet.'} />
                <div style={{ display: 'grid', gap: 8 }}>
                  {leakData.leaks.length ? leakData.leaks.map((item) => (
                    <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '8px 9px', borderRadius: 14, background: 'rgba(255,255,255,0.62)', border: '1px solid rgba(226,232,240,0.92)' }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</p>
                        <p style={{ margin: '4px 0 0', fontSize: 10.5, color: '#64748b' }}>{item.count} small spends</p>
                      </div>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: '#2563eb', whiteSpace: 'nowrap' }}>{fmt(item.total)}</p>
                    </div>
                  )) : <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Add a few more entries to unlock leak detection.</p>}
                </div>
              </GlassCard>

              <div className="exp-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <GlassCard style={{ padding: 11 }} accent="rgba(14,165,233,0.15)">
                  <SectionHdr title="Category Mix" accent="#0891b2" subtitle="Compact spend share by group." />
                  <div style={{ display: 'grid', gap: 8 }}>
                    {[
                      ['Needs', groupedInsights.needsPct, '#2563eb'],
                      ['Lifestyle', groupedInsights.lifestylePct, '#d97706'],
                      ['Travel', groupedInsights.travelPct, '#7c3aed'],
                    ].map(([label, pct, color]) => (
                      <div key={label}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 10.5, color: '#475569', fontWeight: 700 }}>{label}</span>
                          <span style={{ fontSize: 10.5, color, fontWeight: 800 }}>{Number(pct).toFixed(0)}%</span>
                        </div>
                        <ProgressLine pct={pct} tone={`linear-gradient(90deg,${color},${color}cc)`} height={8} />
                      </div>
                    ))}
                  </div>
                </GlassCard>

                <GlassCard style={{ padding: 11 }} accent="rgba(124,58,237,0.15)">
                  <SectionHdr title={`${monthLabel} Story`} accent="#7c3aed" subtitle="Compact monthly recap." />
                  <div style={{ display: 'grid', gap: 8 }}>
                    <TinyStat label="Biggest" value={monthlyStory.biggestCategory} tone={monthStats.topCategoryRow?.color || '#0f172a'} />
                    <TinyStat label="Best controlled" value={monthlyStory.bestControlled} tone="#16a34a" />
                    <TinyStat label="Riskiest" value={monthlyStory.risky} tone="#dc2626" />
                    <TinyStat label="Next target" value={monthlyStory.nextMonthTarget ? fmt(monthlyStory.nextMonthTarget) : 'Set budgets'} tone="#2563eb" />
                  </div>
                </GlassCard>
              </div>

              <GlassCard style={{ padding: 11 }} accent="rgba(245,158,11,0.15)">
                <SectionHdr title="Daily Challenge" accent="#d97706" right={<button onClick={() => setShowChallengeSheet(true)} style={miniActionBtn('#d97706', '#fff7ed')}>Open</button>} />
                <p className="syne" style={{ margin: 0, fontSize: 17, color: '#9a3412' }}>{dailyChallenge.title}</p>
                <p style={{ margin: '6px 0 0', fontSize: 12, color: '#7c2d12', lineHeight: 1.45 }}>{dailyChallenge.target}</p>
                <p style={{ margin: '6px 0 0', fontSize: 10.5, color: '#64748b' }}>{dailyChallenge.reward}</p>
              </GlassCard>
            </div>
          ) : null}

          {expenseTab === 'summary' ? (
            <div style={{ display: 'grid', gap: 10 }}>
              <div className="exp-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <GlassCard style={{ padding: 11 }} accent="rgba(124,58,237,0.15)">
                  <SectionHdr title="Top Categories" accent="#7c3aed" subtitle="Top 6 categories plus Other for cleaner mobile reading." />
                  {chartData.length ? (
                    <ResponsiveContainer width="100%" height={176}>
                      <BarChart data={chartData} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={shortCategory} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                        <Tooltip content={<TooltipCard />} />
                        <Bar dataKey="total" radius={[10, 10, 0, 0]}>
                          {chartData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Add expenses to unlock analytics.</p>}
                </GlassCard>

                <GlassCard style={{ padding: 11 }} accent="rgba(16,185,129,0.14)">
                  <SectionHdr title="Distribution" accent="#16a34a" />
                  {chartData.length ? (
                    <div style={{ position: 'relative', width: '100%', height: 188 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                          <Pie data={chartData} dataKey="total" nameKey="name" cx="50%" cy="44%" innerRadius={34} outerRadius={54} paddingAngle={3}>
                            {chartData.map((entry) => (
                              <Cell key={entry.name} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip content={<TooltipCard />} />
                          <Legend verticalAlign="bottom" align="center" iconType="circle" iconSize={6} formatter={(value) => <span style={{ color: '#475569', fontSize: 9.5 }}>{shortCategory(value)}</span>} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div style={{ position: 'absolute', left: '50%', top: '34%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                        <p style={{ margin: 0, fontSize: 9.5, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total</p>
                        <p className="syne" style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap' }}>{fmt(monthStats.totalSpent)}</p>
                      </div>
                    </div>
                  ) : <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>No chart data yet.</p>}
                </GlassCard>
              </div>

              <GlassCard style={{ padding: 11 }} accent="rgba(226,232,240,0.84)">
                <SectionHdr title="Category Breakdown" accent="#475569" right={<span style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>{analyticsRows.length} categories</span>} />
                <div className="exp-analytics-table" style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px' }}>
                    <thead>
                      <tr style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        <th style={thStyle('left')}>Category</th>
                        <th style={thStyle('right')}>Spent</th>
                        <th style={thStyle('right')}>Budget</th>
                        <th style={thStyle('right')}>Entries</th>
                        <th style={thStyle('right')}>Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analyticsRows.map((row) => (
                        <tr key={row.name}>
                          <td style={tdStyle('left', row.color)}>{(CAT_ICONS[row.name] || '💸') + ' ' + row.name}</td>
                          <td style={tdStyle('right')}>{fmt(row.total)}</td>
                          <td style={tdStyle('right')}>{row.budget ? fmt(row.budget) : '—'}</td>
                          <td style={tdStyle('right')}>{row.entries}</td>
                          <td style={tdStyle('right')}>
                            <span style={chipStyle(`${row.color}18`, row.color)}>{row.pct.toFixed(1)}%</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="exp-mobile-breakdown" style={{ display: 'none', flexDirection: 'column', gap: 8 }}>
                  {analyticsRows.map((row) => (
                    <div key={row.name} style={{ padding: '8px 9px', borderRadius: 14, background: 'rgba(255,255,255,0.62)', border: '1px solid rgba(226,232,240,0.92)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 800, color: '#0f172a' }}>{(CAT_ICONS[row.name] || '💸') + ' ' + row.name}</p>
                        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 800, color: row.color }}>{fmt(row.total)}</p>
                      </div>
                      <p style={{ margin: '5px 0 0', fontSize: 10.5, color: '#64748b' }}>{row.entries} entries • {row.budget ? `${fmt(row.budget)} budget` : 'No budget'} • {row.pct.toFixed(1)}%</p>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </div>
          ) : null}

          {expenseTab === 'budget' ? (
            <GlassCard style={{ padding: 11 }} accent="rgba(124,58,237,0.16)">
              <SectionHdr title="Budget Goals" accent="#7c3aed" subtitle="Compact monthly rows with quick actions." />
              <div style={{ marginBottom: 10 }}>
                <button
                  onClick={openAutoBudget}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: '11px 12px',
                    borderRadius: 15,
                    border: '1px solid rgba(124,58,237,0.22)',
                    background: 'linear-gradient(145deg,#faf5ff,#ffffff 54%,#f5f3ff)',
                    color: '#6d28d9',
                    fontSize: 12,
                    fontWeight: 900,
                    cursor: 'pointer',
                    boxShadow: '0 10px 20px rgba(124,58,237,0.08), inset 0 1px 0 rgba(255,255,255,0.96)',
                  }}
                >
                  <span style={{ fontSize: 14 }}>⚡</span>
                  Auto Budget
                </button>
              </div>
              <div style={{ display: 'grid', gap: 10 }}>
                {categories.map((category) => {
                  const summaryRow = currentMonthSummary.find((row) => row.name === category)
                  const row = {
                    name: category,
                    spent: summaryRow?.total || 0,
                    entries: summaryRow?.entries || 0,
                    color: summaryRow?.color || CAT_COLORS[category] || CAT_COLORS.Other,
                    budget: budgets[category] || 0,
                  }
                  return (
                    <BudgetRow
                      key={category}
                      row={row}
                      editingBudget={editingBudget}
                      budgetInput={budgetInput}
                      setBudgetInput={setBudgetInput}
                      setEditingBudget={setEditingBudget}
                      saveBudget={saveBudget}
                      onAdjust={openBudgetAdjust}
                      onReduceDaily={reduceDaily}
                      onIgnore={ignoreBudget}
                    />
                  )
                })}
              </div>
            </GlassCard>
          ) : null}

          {expenseTab === 'trends' ? (
            <div style={{ display: 'grid', gap: 10 }}>
              <div className="exp-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <GlassCard style={{ padding: 11 }} accent="rgba(124,58,237,0.16)">
                  <SectionHdr title="Hourly Spend Today" accent="#7c3aed" subtitle="Cleaned for mobile with today-only pacing." />
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={trendData} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                      <defs>
                        <linearGradient id="expArea" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                      <Tooltip content={<TooltipCard />} />
                      <Area type="monotone" dataKey="amount" stroke="#7c3aed" strokeWidth={3} fill="url(#expArea)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </GlassCard>

                <GlassCard style={{ padding: 11 }} accent="rgba(245,158,11,0.15)">
                  <SectionHdr title="Category Comparison" accent="#d97706" subtitle="Top mobile-friendly category labels only." />
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 18, left: 30, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                      <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#334155', fontSize: 11, fontWeight: 700 }} width={72} tickFormatter={shortCategory} />
                      <Tooltip content={<TooltipCard />} />
                      <Bar dataKey="total" radius={[0, 10, 10, 0]}>
                        {chartData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </GlassCard>
              </div>
            </div>
          ) : null}

          {expenseTab === 'ai' ? (
            <div style={{ display: 'grid', gap: 8 }}>
              <GlassCard className="coach-shell" style={{ padding: 8 }} accent="rgba(124,58,237,0.24)">
                <div className="coach-particles">
                  {[
                    { left: '7%', top: '18%', delay: '0s' },
                    { left: '22%', top: '78%', delay: '1.2s' },
                    { left: '48%', top: '26%', delay: '2s' },
                    { left: '73%', top: '68%', delay: '0.6s' },
                    { left: '88%', top: '20%', delay: '1.8s' },
                  ].map((particle, index) => (
                    <span
                      key={index}
                      className="coach-particle"
                      style={{ left: particle.left, top: particle.top, animationDelay: particle.delay }}
                    />
                  ))}
                </div>
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 900, color: '#0f172a', letterSpacing: '0.02em' }}>🧠 AI BUDGET COACH</p>
                      <p style={{ margin: '2px 0 0', fontSize: 10, color: '#64748b', fontWeight: 600 }}>Live money signals</p>
                    </div>
                    <div
                      className="coach-pill"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '4px 8px',
                        borderRadius: 999,
                        background: 'linear-gradient(135deg, rgba(124,58,237,0.13), rgba(59,130,246,0.10))',
                        border: '1px solid rgba(124,58,237,0.18)',
                        boxShadow: '0 6px 14px rgba(124,58,237,0.08)',
                        flexShrink: 0,
                      }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#7c3aed', boxShadow: '0 0 0 3px rgba(124,58,237,0.12)' }} />
                      <span style={{ fontSize: 8.5, fontWeight: 900, color: '#6d28d9', letterSpacing: '0.1em' }}>SMART</span>
                    </div>
                  </div>
                </div>
                <div style={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6 }}>
                  {coachSignals.map((signal) => (
                    <CoachSignalCard
                      key={signal.key}
                      emoji={signal.emoji}
                      title={signal.title}
                      status={signal.status}
                      helper={signal.helper}
                      tone={signal.tone}
                      bg={signal.bg}
                      border={signal.border}
                    />
                  ))}
                </div>
              </GlassCard>

              <GlassCard style={{ padding: 11 }} accent="rgba(59,130,246,0.16)">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                  <SectionHdr title="External AI Insights" accent="#2563eb" subtitle="Your existing Gemini-powered analysis remains available." />
                  <button onClick={generateAIAdvice} disabled={isThinking} style={{ ...actionBtn(isThinking ? '#64748b' : '#fff', isThinking ? '#f8fafc' : '#2563eb'), border: 'none' }}>
                    {isThinking ? 'Analyzing...' : 'Refresh'}
                  </button>
                </div>
                {aiInsights.length ? (
                  <div className="exp-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                    {[
                      ['Observation', '📊', '#eff6ff', '#1d4ed8'],
                      ['Projection', '⚠️', '#fff7ed', '#d97706'],
                      ['Action', '💡', '#f0fdf4', '#16a34a'],
                    ].map(([title, icon, bg, color], index) =>
                      aiInsights[index] ? (
                        <div key={title} style={{ padding: '10px 10px', borderRadius: 16, background: bg, border: `1px solid ${color}22` }}>
                          <p style={{ margin: 0, fontSize: 18 }}>{icon}</p>
                          <p style={{ margin: '8px 0 0', fontSize: 10.5, color, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{title}</p>
                          <p style={{ margin: '6px 0 0', fontSize: 11.5, color: '#475569', lineHeight: 1.5 }}>{aiInsights[index].replace(/-/g, '')}</p>
                        </div>
                      ) : null
                    )}
                  </div>
                ) : <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Generate your personalized financial analysis.</p>}
              </GlassCard>
            </div>
          ) : null}
        </div>
      </div>
    </>
  )
}

const inputStyle = {
  width: '100%',
  padding: '9px 10px',
  borderRadius: 12,
  border: '1px solid #dbe2ea',
  background: 'rgba(255,255,255,0.92)',
  color: '#0f172a',
  outline: 'none',
  fontSize: 11.5,
  fontWeight: 700,
}

const actionBtn = (color, bg) => ({
  padding: '8px 10px',
  borderRadius: 11,
  border: `1px solid ${color}22`,
  background: bg,
  color,
  fontWeight: 800,
  cursor: 'pointer',
})

const miniActionBtn = (color, bg) => ({
  padding: '5px 7px',
  borderRadius: 999,
  border: `1px solid ${color}22`,
  background: bg,
  color,
  fontSize: 9.5,
  fontWeight: 800,
  cursor: 'pointer',
})

const chipStyle = (bg, color) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 8px',
  borderRadius: 999,
  background: bg,
  color,
  fontSize: 9.5,
  fontWeight: 800,
})

const thStyle = (align) => ({
  textAlign: align,
  padding: '0 8px 6px',
  fontWeight: 800,
})

const tdStyle = (align, color) => ({
  textAlign: align,
  padding: '8px 7px',
  background: 'rgba(255,255,255,0.62)',
  borderTop: '1px solid rgba(226,232,240,0.88)',
  borderBottom: '1px solid rgba(226,232,240,0.88)',
  color: color || '#475569',
  fontWeight: align === 'left' ? 800 : 700,
})