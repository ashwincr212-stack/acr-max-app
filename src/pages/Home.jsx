import { useState, useEffect, useMemo, useRef } from 'react'
import SurprisesModal from './SurprisesModal'
import SkillMachineModal from './SkillMachine'
import { db } from '../firebase'
import { collection, query, orderBy, onSnapshot, doc, updateDoc, increment } from 'firebase/firestore'
import { fetchAstroDoc, getTodayIST, LOCATIONS, LOCATION_META, normalizePanchangData } from './astroHelpers'

/* ---------------- helpers ---------------- */

function useGreeting() {
  const h = new Date().getHours()
  if (h < 5) return { text: 'Good Night', emoji: '🌙' }
  if (h < 12) return { text: 'Good Morning', emoji: '☀️' }
  if (h < 17) return { text: 'Good Afternoon', emoji: '☀️' }
  if (h < 21) return { text: 'Good Evening', emoji: '🌆' }
  return { text: 'Good Night', emoji: '🌙' }
}

function CountUp({ value, prefix = '₹', duration = 700 }) {
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
  const trimmed = value.trim()
  // Capture hour, minute, and optional AM/PM in one shot
  const match = trimmed.match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?/)
  if (!match) return ''
  let hour = Number(match[1])
  const minute = Number(match[2])
  const meridiem = (match[3] || '').toUpperCase()
  if (Number.isNaN(hour) || Number.isNaN(minute)) return ''
  if (meridiem === 'AM' && hour === 12) hour = 0
  else if (meridiem === 'PM' && hour < 12) hour += 12
  if (hour > 23 || minute > 59) return ''
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function formatPanchangTime(value, field = '', fallback = '--') {
  if (value == null || value === '') return fallback
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase()
  }
  if (value && typeof value === 'object' && typeof value.toDate === 'function') {
    const dateValue = value.toDate()
    if (dateValue instanceof Date && !Number.isNaN(dateValue.getTime())) {
      return dateValue.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase()
    }
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const dateValue = new Date(value)
    if (!Number.isNaN(dateValue.getTime())) {
      return dateValue.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase()
    }
  }
  if (typeof value !== 'string') return fallback

  const trimmed = value.trim()
  if (!trimmed) return fallback

  const meridiemMatch = trimmed.match(/(^|\s)(\d{1,2}):(\d{2})\s*(AM|PM)\b/i)
  if (meridiemMatch) {
    const hour = Number(meridiemMatch[2])
    const minute = Number(meridiemMatch[3])
    const meridiem = meridiemMatch[4].toUpperCase()
    if (!Number.isNaN(hour) && !Number.isNaN(minute) && hour >= 1 && hour <= 12 && minute >= 0 && minute <= 59) {
      return `${hour}:${String(minute).padStart(2, '0')} ${meridiem}`
    }
  }

  const isDateLikeString =
    /[TzZ]|GMT|UTC|[A-Za-z]{3,}\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}/i.test(trimmed)
  if (isDateLikeString) {
    const parsed = new Date(trimmed)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase()
    }
  }

  const normalized = normalizeTimeValue(trimmed)
  if (!normalized) return fallback
  const [hourText, minuteText] = normalized.split(':')
  const hour = Number(hourText)
  if (Number.isNaN(hour)) return fallback
  let suffix = hour >= 12 ? 'PM' : 'AM'
  const hadMeridiem = /\b(AM|PM)\b/i.test(trimmed)
  if (!hadMeridiem && hour >= 1 && hour <= 12) {
    if (field === 'sunrise') suffix = 'AM'
    else if (field === 'sunset') suffix = 'PM'
    else if (field === 'moonrise') suffix = 'PM'
    else if (field === 'moonset') suffix = 'AM'
  }
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minuteText} ${suffix}`
}

function formatShortTime(value) {
  // Accept Date / Firestore Timestamp / number directly
  let str = value
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase()
  }
  if (value && typeof value === 'object' && typeof value.toDate === 'function') {
    const d = value.toDate()
    if (d instanceof Date && !Number.isNaN(d.getTime())) {
      return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase()
    }
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const d = new Date(value)
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase()
    }
  }
  if (typeof value !== 'string') return '—'
  const normalized = normalizeTimeValue(str)
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

function readPath(obj, path) {
  return path.split('.').reduce((acc, part) => (acc && acc[part] != null ? acc[part] : undefined), obj)
}

function firstFilled(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return ''
}

function compactText(value, fallback = 'Not available') {
  const safe = String(value || '').trim()
  return safe || fallback
}

function getAstroValue(obj, possibleKeys = []) {
  for (const key of possibleKeys) {
    if (!key) continue
    const value = key.includes('.') ? readPath(obj, key) : obj?.[key]
    if (value == null) continue
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'object') return value
  }
  return ''
}

function normalizeAstroTime(value) {
  if (!value) return ''
  if (typeof value?.toDate === 'function') {
    const date = value.toDate()
    if (date instanceof Date && !Number.isNaN(date.getTime())) {
      return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
    }
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) {
      return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
    }
  }
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (!trimmed) return ''
  const match = trimmed.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i)
  if (!match) return ''
  let hour = Number(match[1])
  const minute = Number(match[2] || '0')
  const meridiem = (match[3] || '').toUpperCase()
  if (Number.isNaN(hour) || Number.isNaN(minute) || minute > 59) return ''
  if (meridiem === 'AM' && hour === 12) hour = 0
  else if (meridiem === 'PM' && hour < 12) hour += 12
  if (hour > 23) return ''
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function parseAstroTimeRange(value) {
  if (!value) return null
  if (typeof value === 'object' && !Array.isArray(value)) {
    const startValue = getAstroValue(value, ['start', 'from', 'begin', 'open'])
    const endValue = getAstroValue(value, ['end', 'to', 'close'])
    const start = normalizeAstroTime(startValue)
    const end = normalizeAstroTime(endValue)
    if (!start || !end) return null
    return { start, end }
  }
  const text = String(value).trim()
  if (!text) return null
  const parts = text.split(/\s*(?:-|–|—|to)\s*/i).filter(Boolean)
  if (parts.length < 2) return null
  const start = normalizeAstroTime(parts[0])
  const end = normalizeAstroTime(parts[1])
  if (!start || !end) return null
  return { start, end }
}

function isNowWithinRange(range, now) {
  if (!range?.start || !range?.end) return false
  const start = toMinutes(range.start)
  const end = toMinutes(range.end)
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  if (start == null || end == null) return false
  if (end < start) return nowMinutes >= start || nowMinutes <= end
  return nowMinutes >= start && nowMinutes <= end
}

function getAstroRangeStatus(range, nowMinutes, nowSeconds) {
  const startMin = toMinutes(range?.start)
  const endMin = toMinutes(range?.end)
  if (startMin == null || endMin == null) return null
  const inside = endMin >= startMin
    ? nowMinutes >= startMin && nowMinutes < endMin
    : nowMinutes >= startMin || nowMinutes < endMin
  const startSecs = startMin * 60
  const endSecs = endMin * 60
  const remainSecs = endMin >= startMin
    ? Math.max(0, endSecs - nowSeconds)
    : nowSeconds < endSecs ? Math.max(0, endSecs - nowSeconds) : Math.max(0, (endMin + 1440) * 60 - nowSeconds)
  const secsUntil = startSecs > nowSeconds ? startSecs - nowSeconds : null
  return { inside, remainSecs, secsUntil }
}

function joinAstroLabels(labels = []) {
  return labels.filter(Boolean).join(' + ')
}

/* All 4 kalam periods in priority order for status display */
const KALAM_DEFS = [
  {
    key: 'rahuKalam',
    label: 'Rahu Kalam',
    type: 'caution',
    remark: 'Caution period. Avoid new important starts.',
    chipColor: '#EF4444',
    glowColor: 'rgba(239,68,68,0.22)',
    textColor: '#FCA5A5',
  },
  {
    key: 'yamagandham',
    label: 'Yamagandham',
    type: 'caution',
    remark: 'Caution period. Avoid new important starts.',
    chipColor: '#EF4444',
    glowColor: 'rgba(239,68,68,0.22)',
    textColor: '#FCA5A5',
  },
  {
    key: 'gulikaKalam',
    label: 'Gulika Kalam',
    type: 'neutral',
    remark: 'Mixed period. Continue routine work.',
    chipColor: '#D97706',
    glowColor: 'rgba(217,119,6,0.18)',
    textColor: '#FCD34D',
  },
  {
    key: 'abhijitMuhurta',
    label: 'Abhijit Muhurta',
    type: 'good',
    remark: 'Auspicious time for important decisions.',
    chipColor: '#10B981',
    glowColor: 'rgba(16,185,129,0.18)',
    textColor: '#6EE7B7',
  },
]

/* Compute active or next upcoming period + live timer info.
 * Does NOT calculate periods — only reads already-fetched range strings. */
function computeAstroPeriodStatus(astroData, now) {
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const nowSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()
  let hasAnyPeriodData = false

  // Check if now is inside any period (active)
  for (const def of KALAM_DEFS) {
    const raw = astroData?.[def.key]
    if (!raw) continue
    const range = parseAstroTimeRange(raw)
    if (!range) continue
    hasAnyPeriodData = true
    const startMin = toMinutes(range.start)
    const endMin = toMinutes(range.end)
    if (startMin == null || endMin == null) continue
    const inside = endMin >= startMin
      ? nowMinutes >= startMin && nowMinutes < endMin
      : nowMinutes >= startMin || nowMinutes < endMin
    if (inside) {
      const endSecs = endMin * 60
      const remainSecs = endMin >= startMin
        ? Math.max(0, endSecs - nowSeconds)
        : nowSeconds < endSecs ? Math.max(0, endSecs - nowSeconds) : Math.max(0, (endMin + 1440) * 60 - nowSeconds)
      return {
        mode: def.type,
        label: def.label,
        remark: def.remark,
        chipColor: def.chipColor,
        glowColor: def.glowColor,
        textColor: def.textColor,
        timeRange: `${formatShortTime(range.start)} - ${formatShortTime(range.end)}`,
        timerLabel: 'Ends in',
        timerSecs: remainSecs,
        hasData: true,
        isActive: true,
      }
    }
  }

  // Find next upcoming period
  let nextDef = null
  let nextStartSecs = Infinity
  let nextRange = null
  for (const def of KALAM_DEFS) {
    const raw = astroData?.[def.key]
    if (!raw) continue
    const range = parseAstroTimeRange(raw)
    if (!range) continue
    hasAnyPeriodData = true
    const startMin = toMinutes(range.start)
    if (startMin == null) continue
    const startSecs = startMin * 60
    const secsUntil = startSecs > nowSeconds ? startSecs - nowSeconds : null
    if (secsUntil !== null && secsUntil < nextStartSecs) {
      nextStartSecs = secsUntil
      nextDef = def
      nextRange = range
    }
  }

  if (nextDef && nextRange) {
    return {
      mode: nextDef.type,
      label: nextDef.label,
      remark: nextDef.remark,
      chipColor: nextDef.chipColor,
      glowColor: nextDef.glowColor,
      textColor: nextDef.textColor,
      timeRange: `${formatShortTime(nextRange.start)} - ${formatShortTime(nextRange.end)}`,
      timerLabel: 'Starts in',
      timerSecs: nextStartSecs,
      hasData: true,
      isActive: false,
    }
  }

  if (hasAnyPeriodData) {
    return {
      mode: 'neutral',
      label: 'No active Kaalam / Muhurtam now',
      remark: 'All key periods completed today.',
      chipColor: '#64748B',
      glowColor: 'rgba(100,116,139,0.12)',
      textColor: '#94A3B8',
      timeRange: '',
      timerLabel: '',
      timerSecs: 0,
      hasData: true,
      isActive: false,
    }
  }

  // No period data at all
  return {
    mode: 'neutral',
    label: 'No period data',
    remark: 'Period timing unavailable.',
    chipColor: '#64748B',
    glowColor: 'rgba(100,116,139,0.12)',
    textColor: '#94A3B8',
    timeRange: '',
    timerLabel: '',
    timerSecs: 0,
    hasData: false,
    isActive: false,
  }
}

function computeAstroPeriodStatusWithOverlap(astroData, now) {
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const nowSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()
  let hasAnyPeriodData = false
  const activePeriods = []
  let nextPeriod = null

  for (const def of KALAM_DEFS) {
    const raw = astroData?.[def.key]
    if (!raw) continue
    const range = parseAstroTimeRange(raw)
    if (!range) continue
    hasAnyPeriodData = true
    const timing = getAstroRangeStatus(range, nowMinutes, nowSeconds)
    if (!timing) continue
    const entry = {
      ...def,
      timeRange: `${formatShortTime(range.start)} - ${formatShortTime(range.end)}`,
      timerSecs: timing.remainSecs,
      secsUntil: timing.secsUntil,
    }
    if (timing.inside) {
      activePeriods.push(entry)
    } else if (timing.secsUntil != null && (!nextPeriod || timing.secsUntil < nextPeriod.secsUntil)) {
      nextPeriod = entry
    }
  }

  if (activePeriods.length === 1) {
    const active = activePeriods[0]
    return {
      mode: active.type,
      label: active.label,
      remark: active.remark,
      chipColor: active.chipColor,
      glowColor: active.glowColor,
      textColor: active.textColor,
      timeRange: active.timeRange,
      timerLabel: 'Ends in',
      timerSecs: active.timerSecs,
      hasData: true,
      isActive: true,
      activePeriods,
    }
  }

  if (activePeriods.length > 1) {
    const cautionPeriods = activePeriods.filter((period) => period.type !== 'good')
    const hardWarningPeriods = activePeriods.filter((period) => period.type === 'caution')
    const primary = hardWarningPeriods[0] || cautionPeriods[0] || activePeriods[0]
    const earliestEnding = activePeriods.reduce((min, period) => (
      period.timerSecs < min.timerSecs ? period : min
    ), activePeriods[0])
    const activeLabels = activePeriods.map((period) => period.label)
    const warningLabels = cautionPeriods.map((period) => period.label)
    const hasAbhijit = activePeriods.some((period) => period.key === 'abhijitMuhurta')
    return {
      mode: hardWarningPeriods.length ? 'caution' : cautionPeriods.length ? 'neutral' : 'good',
      label: 'Mixed Period',
      remark: hasAbhijit && warningLabels.length
        ? `${warningLabels.join(' + ')} active — avoid major new starts. Abhijit also running.`
        : `${joinAstroLabels(activeLabels)} are active together right now.`,
      chipColor: primary.chipColor,
      glowColor: primary.glowColor,
      textColor: primary.textColor,
      timeRange: joinAstroLabels(activeLabels),
      timerLabel: 'Overlap ends in',
      timerSecs: earliestEnding.timerSecs,
      hasData: true,
      isActive: true,
      activePeriods,
    }
  }

  if (nextPeriod) {
    return {
      mode: nextPeriod.type,
      label: nextPeriod.label,
      remark: nextPeriod.remark,
      chipColor: nextPeriod.chipColor,
      glowColor: nextPeriod.glowColor,
      textColor: nextPeriod.textColor,
      timeRange: nextPeriod.timeRange,
      timerLabel: 'Starts in',
      timerSecs: nextPeriod.secsUntil,
      hasData: true,
      isActive: false,
    }
  }

  if (hasAnyPeriodData) {
    return {
      mode: 'neutral',
      label: 'No active Kaalam / Muhurtam now',
      remark: 'All key periods completed today.',
      chipColor: '#64748B',
      glowColor: 'rgba(100,116,139,0.12)',
      textColor: '#94A3B8',
      timeRange: '',
      timerLabel: '',
      timerSecs: 0,
      hasData: true,
      isActive: false,
    }
  }

  return {
    mode: 'neutral',
    label: 'No period data',
    remark: 'Period timing unavailable.',
    chipColor: '#64748B',
    glowColor: 'rgba(100,116,139,0.12)',
    textColor: '#94A3B8',
    timeRange: '',
    timerLabel: '',
    timerSecs: 0,
    hasData: false,
    isActive: false,
  }
}

function fmtCountdown(secs) {
  if (!secs || secs <= 0) return ''
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

/* Home-only payload resolver. fetchAstroDoc may return:
 *   { data: <docData> }       — wrapped (Home assumed this)
 *   <docData> directly         — same shape Astro.jsx's fetchPanchang returns
 *   { data: { normalized } }   — pre-normalized shape
 *   { data: { panchang } }     — nested under .panchang or .raw
 * Try each shape in order and pick the first that has any astro-shaped key. */
function getAstroPayload(result) {
  if (!result || typeof result !== 'object') return {}
  const candidates = [
    result?.data,
    result?.data?.panchang,
    result?.data?.raw,
    result?.data?.response,
    result?.data?.normalized,
    result?.normalized,
    result?.panchang,
    result?.raw,
    result?.response,
    result,
  ]
  const looksLikeAstro = (o) =>
    o && typeof o === 'object' && (
      'sunrise' in o || 'Sunrise' in o || 'sun_rise' in o ||
      'sunset' in o || 'Sunset' in o || 'sun_set' in o ||
      'tithi' in o || 'Tithi' in o ||
      'nakshatra' in o || 'Nakshatra' in o ||
      'rahuKalam' in o || 'rahu_kalam' in o || 'rahukalam' in o ||
      'yamagandam' in o || 'yama_gandam' in o || 'yamagandham' in o ||
      'rawFestivals' in o || 'festivals' in o || 'festival_list' in o ||
      'sun' in o || 'timings' in o
    )
  const merged = {}
  for (const c of candidates) {
    if (!c || typeof c !== 'object') continue
    if (!looksLikeAstro(c) && !Object.keys(c).length) continue
    Object.assign(merged, c)
  }
  return Object.keys(merged).length ? merged : {}
}

/* Pull a time-ish value out of a node — supports plain strings, Firestore timestamps,
 * Date objects, numbers, and objects with a .time / .value field. */
function pickTimeLike(node, keys) {
  for (const key of keys) {
    if (!key) continue
    const v = key.includes('.') ? readPath(node, key) : node?.[key]
    if (v == null) continue
    if (typeof v === 'string' && v.trim()) return v.trim()
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (v instanceof Date) return v
    if (typeof v?.toDate === 'function') return v
    if (typeof v === 'object') {
      // Some APIs wrap as { time: "06:02 AM" } or { value: ... }
      if (typeof v.time === 'string' && v.time.trim()) return v.time.trim()
      if (typeof v.value === 'string' && v.value.trim()) return v.value.trim()
      if (typeof v.name === 'string' && v.name.trim()) return v.name.trim()
    }
  }
  return ''
}

/* Read sunrise / sunset across many possible shapes. */
function readSunrise(payload) {
  return pickTimeLike(payload, [
    'normalized.sunrise', 'response.sunrise', 'panchang.sunrise',
    'timings.sunrise', 'timings.sun_rise', 'sun.rise',
    'sunrise', 'Sunrise', 'sunRise', 'sun_rise', 'sunrise_time', 'sun_rise_time',
  ])
}
function readSunset(payload) {
  return pickTimeLike(payload, [
    'normalized.sunset', 'response.sunset', 'panchang.sunset',
    'timings.sunset', 'timings.sun_set', 'sun.set',
    'sunset', 'Sunset', 'sunSet', 'sun_set', 'sunset_time', 'sun_set_time',
  ])
}

function readMoonrise(payload) {
  return pickTimeLike(payload, [
    'normalized.moonrise', 'response.moonrise', 'panchang.moonrise',
    'timings.moonrise', 'timings.moon_rise',
    'moonrise', 'Moonrise', 'moon_rise', 'moonRise', 'moonrise_time', 'moon_rise_time',
  ])
}

function readMoonset(payload) {
  return pickTimeLike(payload, [
    'normalized.moonset', 'response.moonset', 'panchang.moonset',
    'timings.moonset', 'timings.moon_set',
    'moonset', 'Moonset', 'moon_set', 'moonSet', 'moonset_time', 'moon_set_time',
  ])
}

/* Read a kalam range — may be a single canonical string ("6:00 AM - 7:30 AM"),
 * an object with start/end, or split top-level fields like rahu_kalam_start / rahu_kalam_end. */
function readKalamRange(payload, keyVariants, splitPrefixes = []) {
  for (const key of keyVariants) {
    if (!key) continue
    const v = key.includes('.') ? readPath(payload, key) : payload?.[key]
    if (v == null) continue
    if (typeof v === 'string' && v.trim()) return v.trim()
    if (typeof v === 'object' && !Array.isArray(v)) {
      const s = v.start || v.from || v.begin || v.startTime || v.start_time || v.starts_at
      const e = v.end || v.to || v.close || v.endTime || v.end_time || v.ends_at
      if (s && e) return `${s} - ${e}`
      // Some shapes nest the range as a string under .range or .time
      if (typeof v.range === 'string' && v.range.trim()) return v.range.trim()
      if (typeof v.time === 'string' && v.time.trim()) return v.time.trim()
    }
  }
  // split-field fallback (rahu_kalam_start + rahu_kalam_end)
  for (const prefix of splitPrefixes) {
    const s = payload?.[`${prefix}_start`] || payload?.[`${prefix}Start`] || payload?.[`${prefix}_from`]
    const e = payload?.[`${prefix}_end`]   || payload?.[`${prefix}End`]   || payload?.[`${prefix}_to`]
    if (s && e) return `${String(s).trim()} - ${String(e).trim()}`
  }
  return ''
}

/* extract panchang detail with start/end labels for tile display */
function extractPanchangDetail(rawDetail) {
  if (rawDetail == null) return { name: '', range: '' }
  if (typeof rawDetail === 'string') return { name: rawDetail.trim(), range: '' }
  if (Array.isArray(rawDetail)) {
    // Some APIs return an array of phases for the day; pick the first
    return extractPanchangDetail(rawDetail[0])
  }
  if (typeof rawDetail !== 'object') return { name: String(rawDetail), range: '' }

  // Unwrap one nesting layer if needed (e.g. { normalized: {...} } or { details: {...} })
  if (rawDetail.normalized && typeof rawDetail.normalized === 'object') {
    const inner = extractPanchangDetail(rawDetail.normalized)
    if (inner.name || inner.range) return inner
  }
  if (rawDetail.details && typeof rawDetail.details === 'object') {
    const inner = extractPanchangDetail(rawDetail.details)
    if (inner.name || inner.range) return inner
  }

  const name =
    rawDetail.name || rawDetail.Name || rawDetail.title ||
    rawDetail.label || rawDetail.Label ||
    rawDetail.tithi_name || rawDetail.tithiName ||
    rawDetail.nakshatra_name || rawDetail.nakshatraName ||
    rawDetail.yoga_name || rawDetail.yogaName ||
    rawDetail.karana_name || rawDetail.karanaName ||
    rawDetail.summary || rawDetail.Summary ||
    rawDetail.value || ''

  const startStr =
    rawDetail.start || rawDetail.Start || rawDetail.start_time || rawDetail.startTime ||
    rawDetail.from || rawDetail.begin || rawDetail.beginTime || rawDetail.starts_at || ''
  const endStr =
    rawDetail.endTime || rawDetail.end_time || rawDetail.EndTime ||
    rawDetail.end || rawDetail.End || rawDetail.ends ||
    rawDetail.to || rawDetail.until || rawDetail.ends_at || ''

  const fmtTime = (v) => {
    if (v == null) return ''
    if (v instanceof Date && !Number.isNaN(v.getTime())) {
      return v.toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
    }
    if (typeof v?.toDate === 'function') {
      const d = v.toDate()
      if (d instanceof Date && !Number.isNaN(d.getTime())) {
        return d.toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
      }
    }
    if (typeof v === 'number' && Number.isFinite(v)) {
      const d = new Date(v)
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
      }
    }
    return String(v).trim()
  }

  const startFmt = fmtTime(startStr)
  const endFmt = fmtTime(endStr)

  let range = ''
  if (startFmt && endFmt) {
    range = `${startFmt}\nto ${endFmt}`
  } else if (endFmt) {
    range = `until ${endFmt}`
  } else if (startFmt) {
    range = startFmt
  }

  return { name: String(name || '').trim(), range }
}

function extractAstroSummary(rawResult) {
  // Resolve the actual payload object regardless of how fetchAstroDoc wraps it
  const data = getAstroPayload(rawResult)
  const normalized = normalizePanchangData(data)

  // ── Festival: try every possible shape exhaustively ──
  const festivalSources = [
    data?.rawFestivals,
    data?.festivalsData,
    data?.normalized?.rawFestivals,
    data?.response?.rawFestivals,
    data?.panchang?.rawFestivals,
  ]
  let festivalList = []
  for (const src of festivalSources) {
    if (!src) continue
    if (Array.isArray(src?.festival_list)) festivalList = festivalList.concat(src.festival_list)
    if (Array.isArray(src?.festivals))     festivalList = festivalList.concat(src.festivals)
    if (Array.isArray(src?.festival))      festivalList = festivalList.concat(src.festival)
  }
  // Also try top-level arrays
  if (Array.isArray(data?.festivals))     festivalList = festivalList.concat(data.festivals)
  if (Array.isArray(data?.festival_list)) festivalList = festivalList.concat(data.festival_list)
  if (Array.isArray(data?.festival))      festivalList = festivalList.concat(data.festival)
  if (Array.isArray(data?.normalized?.festivals)) festivalList = festivalList.concat(data.normalized.festivals)
  if (Array.isArray(data?.response?.festivals))   festivalList = festivalList.concat(data.response.festivals)
  if (Array.isArray(data?.panchang?.festivals))   festivalList = festivalList.concat(data.panchang.festivals)
  if (Array.isArray(data?.panchang?.festival_list)) festivalList = festivalList.concat(data.panchang.festival_list)

  // Extract name from each item
  const pickFestivalName = (item) => {
    if (!item) return ''
    if (typeof item === 'string') return item.trim()
    return (
      item.festival_name || item.festivalName ||
      item.name || item.title || item.festival ||
      item.summary || item.description || ''
    ).toString().trim()
  }

  const validFestivals = festivalList.map(pickFestivalName).filter(Boolean)

  // Also check scalar fields
  const scalarFestival =
    (typeof data?.festival === 'string' ? data.festival.trim() : '') ||
    (typeof data?.festival?.name === 'string' ? data.festival.name.trim() : '') ||
    (typeof data?.festivalName === 'string' ? data.festivalName.trim() : '') ||
    (typeof data?.normalized?.festival === 'string' ? data.normalized.festival.trim() : '') ||
    (typeof data?.panchang?.festival === 'string' ? data.panchang.festival.trim() : '') ||
    ''

  if (scalarFestival && !validFestivals.includes(scalarFestival)) {
    validFestivals.unshift(scalarFestival)
  }

  let festivalDisplay = 'No festival today'
  if (validFestivals.length === 1) {
    festivalDisplay = validFestivals[0]
  } else if (validFestivals.length > 1) {
    festivalDisplay = `${validFestivals[0]}  +${validFestivals.length - 1} more`
  }

  const goodWindow =
    (typeof data?.abhijitMuhurta === 'string' && data.abhijitMuhurta) ||
    (typeof data?.abhijit_muhurta === 'string' && data.abhijit_muhurta) ||
    (typeof data?.abhijit === 'string' && data.abhijit) ||
    (typeof data?.brahma_muhurta === 'string' && data.brahma_muhurta) ||
    (typeof data?.brahmaMuhurta === 'string' && data.brahmaMuhurta) ||
    (typeof data?.dur_muhurta === 'string' && data.dur_muhurta) ||
    (data?.abhijitMuhurta?.start && data?.abhijitMuhurta?.end
      ? `${data.abhijitMuhurta.start} - ${data.abhijitMuhurta.end}` : '') ||
    ''

  const tithiDetail = extractPanchangDetail(data?.tithi || data?.Tithi)
  const nakDetail = extractPanchangDetail(data?.nakshatra || data?.Nakshatra)
  const yogaDetail = extractPanchangDetail(data?.yoga || data?.Yoga)
  const karanaDetail = extractPanchangDetail(data?.karana || data?.Karana)

  return {
    title: 'Daily Panchang',
    window: goodWindow || '',
    festival: festivalDisplay,
    sunrise: normalized?.sunrise && normalized.sunrise !== '—' ? normalized.sunrise : '',
    sunset: normalized?.sunset && normalized.sunset !== '—' ? normalized.sunset : '',
    moonrise: normalized?.moonrise && normalized.moonrise !== '—' ? normalized.moonrise : '',
    moonset: normalized?.moonset && normalized.moonset !== '—' ? normalized.moonset : '',
    rahuKalam: readKalamRange(
      data,
      ['rahuKalam', 'rahu_kalam', 'rahukalam', 'rahukaalam', 'rahuKaal', 'rahu_kal', 'rahu kalam', 'RahuKalam', 'normalized.rahuKalam', 'response.rahuKalam'],
      ['rahu_kalam', 'rahuKalam', 'rahu']
    ),
    yamagandham: readKalamRange(
      data,
      ['yamagandham', 'yamagandam', 'yama_gandam', 'yamaGandam', 'yama gandam', 'Yamagandam', 'YamaGandam', 'normalized.yamagandam', 'response.yamagandam'],
      ['yama_gandam', 'yamagandam', 'yamagandham', 'yamaGandam', 'yama']
    ),
    gulikaKalam: readKalamRange(
      data,
      ['gulikaKalam', 'gulika_kalam', 'gulikakalam', 'gulikaKaal', 'gulika kalam', 'GulikaKalam', 'gulika', 'gulikai', 'normalized.gulikaKalam', 'response.gulikaKalam'],
      ['gulika_kalam', 'gulikaKalam', 'gulika']
    ),
    abhijitMuhurta: readKalamRange(
      data,
      ['abhijitMuhurta', 'abhijit_muhurta', 'abhijit', 'abhijitMuhurat', 'abhijit_muhurat', 'normalized.abhijitMuhurta', 'response.abhijitMuhurta'],
      ['abhijit_muhurta', 'abhijitMuhurta', 'abhijit']
    ),
    // Only name — no range — for tile display
    tithiName: tithiDetail.name || firstFilled(readPath(data, 'tithi.name'), readPath(data, 'normalized.tithi.name'), data?.tithi_name, data?.tithiName, typeof data?.tithi === 'string' ? data.tithi : ''),
    nakshatraName: nakDetail.name || firstFilled(readPath(data, 'nakshatra.name'), readPath(data, 'normalized.nakshatra.name'), data?.nakshatra_name, data?.nakshatraName, typeof data?.nakshatra === 'string' ? data.nakshatra : ''),
    yogaName: yogaDetail.name || firstFilled(readPath(data, 'yoga.name'), readPath(data, 'normalized.yoga.name'), data?.yoga_name, data?.yogaName, typeof data?.yoga === 'string' ? data.yoga : ''),
    karanaName: karanaDetail.name || firstFilled(readPath(data, 'karana.name'), readPath(data, 'normalized.karana.name'), data?.karana_name, data?.karanaName, typeof data?.karana === 'string' ? data.karana : ''),
  }
}

/* ---------------- micro visuals ---------------- */

function MiniTrend({ accent, points = [] }) {
  const safePoints = points.length ? points : [25, 45, 35, 60]
  const path = safePoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${index * 18} ${34 - point * 0.34}`).join(' ')
  return (
    <div className="acr-mini">
      <svg viewBox="0 0 54 34" width="44" height="14">
        <path d={path} fill="none" stroke={accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

function MiniDots({ accent, values = [] }) {
  const safeValues = values.length ? values : [1, 0, 0]
  return (
    <div className="acr-mini acr-mini-dots">
      {safeValues.map((v, i) => (
        <span key={i} style={{
          background: v ? accent : `${accent}30`,
          opacity: v ? 1 : 0.55,
          transform: v ? 'scale(1)' : 'scale(0.85)',
        }} />
      ))}
    </div>
  )
}

/* ---------------- Top summary cards ---------------- */

function SummaryCard({ tone, icon, iconBg, iconColor, title, primary, primaryColor, subline, microVisual, onClick, animated, primaryPrefix = '' }) {
  return (
    <button onClick={onClick} className={`acr-sum acr-sum-${tone}`}>
      <div className="acr-sum-top">
        <div className="acr-sum-icon" style={{ background: iconBg, color: iconColor }}>{icon}</div>
        <span className="acr-sum-title">{title}</span>
        <span className="acr-sum-chev" style={{ color: iconColor }}>›</span>
      </div>
      <div className="acr-sum-primary" style={{ color: primaryColor }}>
        {animated ? <CountUp value={primary} prefix={primaryPrefix} /> : primary}
      </div>
      <div className="acr-sum-bottom">
        <p className="acr-sum-subline">{subline}</p>
        {microVisual}
      </div>
    </button>
  )
}

function AiInsightsCard({ bullets = [], onClick }) {
  return (
    <button onClick={onClick} className="acr-sum acr-sum-ai">
      <div className="acr-sum-top">
        <div className="acr-sum-icon acr-ai-icon">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 5v2M12 17v2M5 12h2M17 12h2M7.5 7.5l1.4 1.4M15.1 15.1l1.4 1.4M7.5 16.5l1.4-1.4M15.1 8.9l1.4-1.4" strokeLinecap="round" />
          </svg>
        </div>
        <span className="acr-sum-title">AI INSIGHTS</span>
        <span className="acr-sum-chev" style={{ color: '#0284C7' }}>›</span>
      </div>
      <div className="acr-ai-bullets">
        {bullets.slice(0, 3).map((b, i) => (
          <div key={i} className="acr-ai-bullet">
            <span className="acr-ai-dot" style={{ background: b.color }} />
            <span>{b.text}</span>
          </div>
        ))}
      </div>
    </button>
  )
}

/* ---------------- Live countdown (re-renders every second) ---------------- */
function LiveTimer({ secs, label, textColor }) {
  const [s, setS] = useState(secs)
  useEffect(() => {
    setS(secs)
    const id = setInterval(() => setS((v) => Math.max(0, v - 1)), 1000)
    return () => clearInterval(id)
  }, [secs])
  if (!label || s <= 0) return null
  return (
    <span className="acr-astro-timer" style={{ color: textColor }}>
      {label} {fmtCountdown(s)}
    </span>
  )
}

function getCelestialRows(snapshot = {}) {
  return [
    { type: 'sun', subtype: 'rise', label: 'Sunrise', val: snapshot.sunrise || '--' },
    { type: 'sun', subtype: 'set', label: 'Sunset', val: snapshot.sunset || '--' },
    { type: 'moon', subtype: 'rise', label: 'Moonrise', val: snapshot.moonrise || '--' },
    { type: 'moon', subtype: 'set', label: 'Moonset', val: snapshot.moonset || '--' },
  ]
}

function CelestialStrip({ snapshot }) {
  const rows = getCelestialRows(snapshot)

  return (
    <div className="acr-celestial-strip" aria-label="Celestial timings">
      {rows.map((row) => (
        <div key={row.label} className="acr-celestial-seg">
          <span className={`acr-cel-icon acr-cel-${row.type}-${row.subtype} acr-celestial-icon`} aria-hidden="true" />
          <div className="acr-celestial-copy">
            <span className="acr-celestial-label">{row.label}</span>
            <strong className="acr-celestial-value">{row.val}</strong>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ---------------- Premium Astro card ---------------- */
function PremiumAstroCard({ snapshot, onOpen, onLocationChange }) {
  const meta = LOCATION_META[snapshot.location] || { emoji: '🌿', tagline: 'Garden City' }
  const ps = snapshot.periodStatus || {}
  const mode = ps.mode || 'neutral'

  const tiles = [
    { label: 'TITHI',     name: snapshot.tithiName     || '—' },
    { label: 'NAKSHATRA', name: snapshot.nakshatraName  || '—' },
    { label: 'YOGA',      name: snapshot.yogaName       || '—' },
    { label: 'KARANA',    name: snapshot.karanaName     || '—' },
  ]

  const hasFestival = snapshot.festival && snapshot.festival !== 'No festival today'

  return (
    <button
      className={`acr-astro acr-astro-${mode}`}
      onClick={onOpen}
      style={{ '--period-glow': ps.glowColor || 'rgba(99,102,241,0.14)' }}
    >
      {/* star field */}
      <div className="acr-astro-stars" aria-hidden="true">
        <i /><i /><i /><i /><i /><i /><i /><i />
      </div>
      <span className="acr-astro-orb1" aria-hidden="true" />
      <span className="acr-astro-orb2" aria-hidden="true" />

      {/* header */}
      <div className="acr-astro-head">
        <div className="acr-astro-head-left">
          <div className="acr-astro-badge" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="#C7D2FE">
              <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
            </svg>
          </div>
          <div>
            <div className="acr-astro-title-row">
              <span className="acr-astro-main-title">Panchang</span>
              <span className="acr-astro-live-badge">LIVE</span>
            </div>
            <div className="acr-astro-city-sub">{meta.emoji} {meta.tagline}, {snapshot.location}</div>
          </div>
        </div>
        <div className="acr-astro-loc" onClick={(e) => e.stopPropagation()}>
          <select value={snapshot.location} onChange={(e) => onLocationChange(e.target.value)}>
            {LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <span className="acr-astro-loc-arrow">▾</span>
        </div>
      </div>

      {/* festival banner — always shown */}
      <div className={`acr-astro-festival-row${hasFestival ? '' : ' acr-astro-festival-row-dim'}`}>
        <span className="acr-astro-festival-gem" aria-hidden="true">✦</span>
        <span className="acr-astro-festival-name">{hasFestival ? snapshot.festival : 'No festival today'}</span>
      </div>

      {/* mandala + period */}
      <div className="acr-astro-main">
        <div className="acr-astro-mandala-wrap" aria-hidden="true">
          <svg viewBox="0 0 120 120" className="acr-astro-mandala">
            <defs>
              <radialGradient id="mG2" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#FDE68A" />
                <stop offset="55%" stopColor="#F59E0B" />
                <stop offset="100%" stopColor="#92400E" />
              </radialGradient>
              <radialGradient id="mGlow2" cx="50%" cy="50%" r="60%">
                <stop offset="0%" stopColor="rgba(251,191,36,0.42)" />
                <stop offset="100%" stopColor="rgba(251,191,36,0)" />
              </radialGradient>
            </defs>
            <circle cx="60" cy="60" r="56" fill="url(#mGlow2)" />
            {Array.from({ length: 16 }).map((_, i) => {
              const a = (i * 22.5 * Math.PI) / 180
              return <line key={i} x1={60 + Math.cos(a) * 38} y1={60 + Math.sin(a) * 38} x2={60 + Math.cos(a) * 51} y2={60 + Math.sin(a) * 51} stroke="#F59E0B" strokeWidth="1.3" strokeLinecap="round" opacity="0.75" />
            })}
            <circle cx="60" cy="60" r="34" fill="none" stroke="#F59E0B" strokeWidth="1.2" opacity="0.58" />
            <g transform="rotate(45 60 60)"><rect x="34" y="34" width="52" height="52" fill="none" stroke="#FBBF24" strokeWidth="1.3" /></g>
            <rect x="36" y="36" width="48" height="48" fill="none" stroke="#FBBF24" strokeWidth="1.1" opacity="0.76" />
            <polygon points="60,38 78,68 42,68" fill="none" stroke="#F59E0B" strokeWidth="1.2" />
            <polygon points="60,82 42,52 78,52" fill="none" stroke="#F59E0B" strokeWidth="1.2" />
            {Array.from({ length: 8 }).map((_, i) => {
              const a = (i * 45 * Math.PI) / 180
              return <ellipse key={i} cx={60 + Math.cos(a) * 47} cy={60 + Math.sin(a) * 47} rx="3.5" ry="1.8" transform={`rotate(${i * 45} ${60 + Math.cos(a) * 47} ${60 + Math.sin(a) * 47})`} fill="#F59E0B" opacity="0.32" />
            })}
            <circle cx="60" cy="60" r="11" fill="url(#mG2)" />
            <circle cx="60" cy="60" r="4.5" fill="#FEF3C7" />
          </svg>
        </div>

        <div className="acr-astro-period-panel">
          <span
            className="acr-astro-period-chip"
            style={{ background: `${ps.chipColor || '#64748B'}1E`, color: ps.chipColor || '#94A3B8', border: `1px solid ${ps.chipColor || '#64748B'}48` }}
          >
            <span className={`acr-period-dot${ps.isActive ? ' acr-period-dot-pulse' : ''}`}
              style={{ background: ps.chipColor || '#64748B' }} />
            {ps.label || 'No period data'}
          </span>
          {ps.timeRange && (
            <div className="acr-astro-period-range" style={{ color: ps.textColor || '#94A3B8' }}>
              {ps.timeRange}
            </div>
          )}
          {ps.hasData && ps.timerSecs > 0 && (
            <LiveTimer secs={ps.timerSecs} label={ps.timerLabel} textColor={ps.textColor} />
          )}
          <div className="acr-astro-period-remark">{ps.remark || 'Period timing unavailable.'}</div>
        </div>
      </div>

      {/* sun/moon — CSS icons */}

      {/* panchang tiles — name only */}
      <div className="acr-astro-tiles">
        {tiles.map((t) => (
          <div key={t.label} className="acr-astro-tile">
            <span className="acr-astro-tile-label">{t.label}</span>
            <strong className="acr-astro-tile-name">{t.name}</strong>
          </div>
        ))}
      </div>
    </button>
  )
}

/* ---------------- Skill / Surprises feature row ---------------- */

function FeatureCard({ title, subtitle, pill, icon, onClick, accent }) {
  return (
    <button className="acr-feature" onClick={onClick}>
      <div className="acr-feature-icon" style={{ color: accent }}>{icon}</div>
      <div className="acr-feature-copy">
        <p>{title}</p>
        <span>{subtitle}</span>
      </div>
      <div className="acr-feature-pill">{pill}</div>
    </button>
  )
}

/* ================================================================ */
/* MAIN HOME COMPONENT                                                */
/* ================================================================ */

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
    location: localStorage.getItem('acr_astro_location') || 'Bangalore',
    title: 'Daily Panchang',
    window: '',
    festival: '',
    sunrise: '',
    sunset: '',
    moonrise: '',
    moonset: '',
    rahuKalam: '',
    yamagandham: '',
    gulikaKalam: '',
    abhijitMuhurta: '',
    tithiName: '',
    nakshatraName: '',
    yogaName: '',
    karanaName: '',
  })

  const username = currentUser?.username?.toLowerCase?.() || ''
  const displayName = currentUser?.name || currentUser?.username || 'User'
  const astroLang = localStorage.getItem('acr_astro_lang') || 'en'

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!username) { setSurpriseUsedAt(null); return undefined }
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
    if (!username) { setLedgerEntries([]); return undefined }
    const ref = doc(db, 'acr_ledger', username)
    return onSnapshot(ref, (snap) => {
      const data = snap.exists() ? snap.data() : {}
      setLedgerEntries(data.entries || [])
    }, () => setLedgerEntries([]))
  }, [username])

  useEffect(() => {
    if (!username) { setPlannerTasks([]); return undefined }
    const plannerQuery = query(
      collection(db, 'acr_users', username, 'plannerTasks'),
      orderBy('createdAt', 'asc')
    )
    return onSnapshot(plannerQuery, (snap) => {
      setPlannerTasks(snap.docs.map((d) => d.data() || {}))
    }, () => setPlannerTasks([]))
  }, [username])

  useEffect(() => {
    let ignore = false
    const loadAstro = async () => {
      const result = await fetchAstroDoc(astroSnapshot.location, astroLang, getTodayIST())
      if (ignore) return
      // extractAstroSummary now resolves the payload internally — pass result as-is
      const summary = extractAstroSummary(result)
      setAstroSnapshot({
        location: astroSnapshot.location,
        title: summary.title,
        window: summary.window,
        festival: summary.festival,
        sunrise: summary.sunrise,
        sunset: summary.sunset,
        moonrise: summary.moonrise,
        moonset: summary.moonset,
        rahuKalam: summary.rahuKalam,
        yamagandham: summary.yamagandham,
        gulikaKalam: summary.gulikaKalam,
        abhijitMuhurta: summary.abhijitMuhurta,
        tithiName: summary.tithiName,
        nakshatraName: summary.nakshatraName,
        yogaName: summary.yogaName,
        karanaName: summary.karanaName,
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
    const now = time instanceof Date ? time : new Date()
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
      ? pctText(todaySpend, yesterdaySpend, 'yest')
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

    const sunriseMinutes = toMinutes(astroSnapshot.sunrise)
    const sunsetMinutes = toMinutes(astroSnapshot.sunset)
    const nowMinutes = now.getHours() * 60 + now.getMinutes()
    const fullDayPct = Math.max(0, Math.min(100, (nowMinutes / (24 * 60)) * 100))
    let astroDayPct = 0
    if (sunriseMinutes !== null && sunsetMinutes !== null && sunsetMinutes > sunriseMinutes) {
      astroDayPct = Math.max(0, Math.min(100, ((nowMinutes - sunriseMinutes) / (sunsetMinutes - sunriseMinutes)) * 100))
    }
    const astroStatus = computeAstroPeriodStatusWithOverlap(astroSnapshot, now)

    // AI insights bullets
    const spendBullet = !todayLogs.length
      ? { text: 'Spend stable', color: '#10B981' }
      : avgDaily && todaySpend > avgDaily
        ? { text: 'Spend above avg', color: '#F59E0B' }
        : { text: 'Spend stable', color: '#10B981' }

    const dueBullet = overdueCount
      ? { text: `${overdueCount} overdue`, color: '#EF4444' }
      : dueTodayCount
        ? { text: `${dueTodayCount} due today`, color: '#0EA5E9' }
        : { text: 'Ledger clear', color: '#0EA5E9' }

    const focusBullet = nextTask?.time
      ? { text: `Focus ${formatShortTime(nextTask.time)}`, color: '#A855F7' }
      : { text: 'Best focus: 10–12 AM', color: '#A855F7' }

    return {
      expenses: {
        value: todaySpend,
        subline: `${todayLogs.length} entries today  ·  Top: ${topTodayCategory}`,
        trendBars: expenseTrendBars,
        trendText: todayLogs.length ? expenseTrend : '',
      },
      ledger: {
        value: totalReceivable,
        subline: overdueCount
          ? `To receive  ·  ${overdueCount} overdue`
          : dueTodayCount
            ? `To receive  ·  ${dueTodayCount} due today`
            : 'To receive  ·  clear',
        dots: [totalReceivable > 0 ? 1 : 0, overdueCount > 0 ? 1 : 0, dueTodayCount > 0 ? 1 : 0],
      },
      planner: {
        value: `${pendingToday} pending`,
        subline: `${doneToday} done today  ·  Next: ${nextTask?.title || 'None'}`,
      },
      insights: {
        bullets: [spendBullet, dueBullet, focusBullet],
      },
      astro: {
        location: astroSnapshot.location,
        window: astroSnapshot.window,
        festival: astroSnapshot.festival,
        sunrise: astroSnapshot.sunrise,
        sunset: astroSnapshot.sunset,
        moonrise: astroSnapshot.moonrise,
        moonset: astroSnapshot.moonset,
        rahuKalam: astroSnapshot.rahuKalam,
        yamagandham: astroSnapshot.yamagandham,
        gulikaKalam: astroSnapshot.gulikaKalam,
        abhijitMuhurta: astroSnapshot.abhijitMuhurta,
        tithiName: astroSnapshot.tithiName,
        nakshatraName: astroSnapshot.nakshatraName,
        yogaName: astroSnapshot.yogaName,
        karanaName: astroSnapshot.karanaName,
        periodStatus: astroStatus,
        fullDayPct,
        dayPct: astroDayPct,
      },
    }
  }, [logs, ledgerEntries, plannerTasks, astroSnapshot, time])

  const handleAstroLocationChange = (location) => {
    localStorage.setItem('acr_astro_location', location)
    setAstroSnapshot((prev) => ({ ...prev, location }))
  }

  const quickActions = [
    { id: 'market', icon: '📰', label: 'News', sub: 'Briefing', accent: '#2563EB', bg: '#EEF4FF' },
    { id: 'chat', icon: '🤖', label: 'AI Chat', sub: 'Ask anything', accent: '#0F766E', bg: '#ECFEFF' },
    { id: 'cricket', icon: '🏏', label: 'IPL', sub: 'Updates & Stats', accent: '#7C3AED', bg: '#F5F3FF' },
    { id: 'planner', icon: '🔔', label: 'Reminders', sub: 'Set & track', accent: '#EA580C', bg: '#FFF7ED' },
  ]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
        .acr-root *, .acr-root *::before, .acr-root *::after { box-sizing:border-box; font-family:'Poppins', sans-serif; }
        .acr-root {
          min-height:100vh; width:100%;
          padding:6px 5px 82px;
          background:linear-gradient(180deg,#F8FAFC 0%,#F1F4F8 100%);
          color:#0F172A;
        }
        .acr-shell { display:flex; flex-direction:column; gap:6px; }

        /* ----- Header ----- */
        .acr-header { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:2px 0 4px; }
        .acr-brand { display:flex; align-items:center; gap:9px; min-width:0; }
        .acr-brand-logo { width:38px; height:38px; border-radius:11px; flex-shrink:0; object-fit:cover; box-shadow:0 6px 14px rgba(15,23,42,0.16); }
        .acr-brand-logo-fallback {
          width:38px; height:38px; border-radius:11px; flex-shrink:0;
          background:linear-gradient(135deg,#0F172A,#1E293B);
          display:flex; align-items:center; justify-content:center;
          color:#FBBF24; font-size:18px; font-weight:800;
          box-shadow:0 6px 14px rgba(15,23,42,0.16);
        }
        .acr-brand-title { font-size:17px; font-weight:800; color:#0F172A; margin:0; line-height:1.05; letter-spacing:0.01em; }
        .acr-brand-sub { font-size:10.5px; color:#64748B; margin:1px 0 0; font-weight:600; }
        .acr-header-right { display:flex; align-items:center; gap:7px; flex-shrink:0; }
        .acr-time { font-size:11.5px; font-weight:700; color:#475569; text-align:right; line-height:1.2; }
        .acr-time div:first-child { font-size:12.5px; color:#0F172A; }
        .acr-coin {
          border:none; cursor:pointer; border-radius:999px; padding:6px 11px;
          background:linear-gradient(135deg,#FEF3C7,#FCD34D);
          color:#92400E; font-size:12.5px; font-weight:800;
          box-shadow:0 5px 12px rgba(217,119,6,0.18);
          display:flex; align-items:center; gap:4px;
        }

        .acr-celestial-strip {
          display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px;
          margin:2px 0 10px;
          padding:8px;
          border-radius:18px;
          background:
            radial-gradient(circle at 18% 0%, rgba(245,158,11,0.18) 0%, transparent 34%),
            radial-gradient(circle at 82% 100%, rgba(56,189,248,0.14) 0%, transparent 38%),
            linear-gradient(135deg,#030712 0%,#08111F 38%,#0A1730 72%,#030712 100%);
          border:1px solid rgba(251,191,36,0.26);
          box-shadow:
            0 14px 28px rgba(2,6,23,0.34),
            inset 0 1px 0 rgba(255,255,255,0.05),
            0 0 0 1px rgba(245,158,11,0.08),
            0 0 22px rgba(245,158,11,0.08);
        }
        .acr-celestial-seg {
          display:flex; align-items:center; gap:8px; min-width:0;
          padding:8px 10px;
          border-radius:14px;
          background:linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03));
          border:1px solid rgba(255,255,255,0.08);
          box-shadow:inset 0 1px 0 rgba(255,255,255,0.04);
        }
        .acr-celestial-icon {
          width:22px; height:22px;
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.08),
            0 0 14px rgba(251,191,36,0.12);
        }
        .acr-celestial-copy { display:flex; flex-direction:column; min-width:0; }
        .acr-celestial-label {
          font-size:8px; line-height:1; font-weight:800; letter-spacing:0.16em;
          text-transform:uppercase; color:#94A3B8; white-space:nowrap;
        }
        .acr-celestial-value {
          margin-top:4px;
          font-size:12px; line-height:1.05; font-weight:800; color:#F8FAFC; white-space:nowrap;
        }

        /* ----- Summary cards (2x2) ----- */
        .acr-sum-grid { display:grid; grid-template-columns:1fr 1fr; gap:6px; }
        .acr-sum {
          position:relative; border:none; cursor:pointer; text-align:left;
          border-radius:16px; padding:10px 11px 10px;
          min-height:90px;
          display:flex; flex-direction:column; gap:3px;
          transition:transform 0.14s ease;
        }
        .acr-sum:active { transform:scale(0.975); }
        .acr-sum-expenses { background:linear-gradient(155deg,#FFFAF0,#FFF1DC); border:1px solid rgba(217,119,6,0.15); }
        .acr-sum-ledger   { background:linear-gradient(155deg,#F3FCF7,#DCF5E8); border:1px solid rgba(5,150,105,0.15); }
        .acr-sum-planner  { background:linear-gradient(155deg,#F8F5FF,#EFE9FF); border:1px solid rgba(124,58,237,0.15); }
        .acr-sum-ai       { background:linear-gradient(155deg,#F2F8FF,#E2EFFE); border:1px solid rgba(2,132,199,0.15); }

        .acr-sum-top { display:flex; align-items:center; gap:7px; }
        .acr-sum-icon {
          width:24px; height:24px; border-radius:8px;
          display:flex; align-items:center; justify-content:center;
          font-size:12px; font-weight:800;
          box-shadow:inset 0 1px 0 rgba(255,255,255,0.85);
          flex-shrink:0;
        }
        .acr-ai-icon { background:#3B82F6; color:#fff; box-shadow:0 3px 8px rgba(59,130,246,0.3); }
        .acr-sum-title {
          flex:1; font-size:9.5px; font-weight:800; letter-spacing:0.1em; color:#475569; text-transform:uppercase;
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        }
        .acr-sum-chev { font-size:17px; font-weight:700; line-height:1; opacity:0.6; }
        .acr-sum-primary { font-size:21px; font-weight:800; line-height:1.05; margin-top:1px; }
        .acr-sum-bottom { margin-top:auto; display:flex; align-items:center; justify-content:space-between; gap:5px; }
        .acr-sum-subline {
          margin:0; font-size:9px; line-height:1.25; color:#64748B; font-weight:600;
          flex:1; min-width:0;
          display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;
        }
        .acr-mini { display:flex; align-items:center; flex-shrink:0; }
        .acr-mini-dots { gap:3px; }
        .acr-mini-dots span { width:6px; height:6px; border-radius:999px; box-shadow:0 0 0 1.5px rgba(255,255,255,0.7); }
        .acr-ai-bullets { display:flex; flex-direction:column; gap:3px; margin-top:2px; }
        .acr-ai-bullet {
          display:flex; align-items:center; gap:6px;
          font-size:10.5px; font-weight:600; color:#1E293B; line-height:1.2;
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        }
        .acr-ai-dot { width:7px; height:7px; border-radius:999px; flex-shrink:0; box-shadow:0 0 0 1.5px rgba(255,255,255,0.7); }

        /* ----- Astro card ----- */
        .acr-astro {
          position:relative; overflow:hidden; width:100%; border:none; cursor:pointer; text-align:left;
          border-radius:20px; padding:12px 12px 11px; color:#fff;
          background:
            radial-gradient(ellipse at 20% 0%, rgba(120,80,255,0.28) 0%, transparent 55%),
            radial-gradient(ellipse at 85% 90%, rgba(56,189,248,0.18) 0%, transparent 45%),
            radial-gradient(ellipse at 50% 50%, rgba(30,41,90,0.6) 0%, transparent 80%),
            linear-gradient(168deg,#07101F 0%,#0D1A30 40%,#091526 70%,#060E1C 100%);
          box-shadow:0 18px 40px rgba(4,9,30,0.55), inset 0 1px 0 rgba(255,255,255,0.04), 0 0 0 1px rgba(99,102,241,0.2);
          transition:transform 0.14s ease;
        }
        .acr-astro:active { transform:scale(0.99); }
        .acr-astro-caution {
          background:
            radial-gradient(ellipse at 20% 0%, rgba(200,40,40,0.24) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 90%, rgba(120,20,20,0.18) 0%, transparent 45%),
            linear-gradient(168deg,#12060A 0%,#1A0A0D 40%,#120608 100%);
          box-shadow:0 18px 40px rgba(30,0,0,0.55), inset 0 1px 0 rgba(255,120,120,0.05), 0 0 0 1px rgba(248,113,113,0.32);
        }
        .acr-astro-good {
          background:
            radial-gradient(ellipse at 20% 0%, rgba(10,120,80,0.26) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 90%, rgba(20,80,50,0.18) 0%, transparent 45%),
            linear-gradient(168deg,#060F0A 0%,#091610 40%,#060F09 100%);
          box-shadow:0 18px 40px rgba(0,20,10,0.55), inset 0 1px 0 rgba(100,255,180,0.05), 0 0 0 1px rgba(52,211,153,0.28);
        }
        .acr-astro-neutral {
          box-shadow:0 18px 40px rgba(4,9,30,0.55), inset 0 1px 0 rgba(255,255,255,0.04), 0 0 0 1px rgba(99,102,241,0.2);
        }

        /* nebula orbs */
        .acr-astro-orb1, .acr-astro-orb2 {
          position:absolute; border-radius:50%; pointer-events:none; z-index:0;
          animation:acrOrbPulse 8s ease-in-out infinite;
        }
        .acr-astro-orb1 {
          width:120px; height:120px; left:-30px; top:-30px;
          background:radial-gradient(circle, rgba(139,92,246,0.22) 0%, transparent 70%);
        }
        .acr-astro-orb2 {
          width:90px; height:90px; right:-20px; bottom:20px;
          background:radial-gradient(circle, rgba(56,189,248,0.16) 0%, transparent 70%);
          animation-delay:3s;
        }
        @keyframes acrOrbPulse { 0%,100%{opacity:0.6;transform:scale(1)} 50%{opacity:1;transform:scale(1.08)} }

        /* star field — 8 stars */
        .acr-astro-stars { position:absolute; inset:0; pointer-events:none; z-index:0; }
        .acr-astro-stars i {
          position:absolute; border-radius:50%;
          background:#fff;
          box-shadow:0 0 6px 1px rgba(200,220,255,0.7);
        }
        .acr-astro-stars i:nth-child(1) { width:2.5px;height:2.5px; top:14%; right:28%; animation:acrStar 4.6s ease-in-out infinite; }
        .acr-astro-stars i:nth-child(2) { width:2px;height:2px; top:40%; right:8%; animation:acrStar 5.2s ease-in-out infinite 0.6s; }
        .acr-astro-stars i:nth-child(3) { width:1.5px;height:1.5px; top:68%; left:42%; animation:acrStar 4.8s ease-in-out infinite 1.1s; }
        .acr-astro-stars i:nth-child(4) { width:2.5px;height:2.5px; bottom:22%; left:12%; animation:acrStar 5.4s ease-in-out infinite 1.6s; }
        .acr-astro-stars i:nth-child(5) { width:2px;height:2px; bottom:38%; right:20%; animation:acrStar 4.2s ease-in-out infinite 0.8s; }
        .acr-astro-stars i:nth-child(6) { width:1.5px;height:1.5px; top:55%; left:60%; animation:acrStar 5s ease-in-out infinite 1.4s; }
        .acr-astro-stars i:nth-child(7) { width:2px;height:2px; top:25%; left:30%; animation:acrStar 4.4s ease-in-out infinite 2s; }
        .acr-astro-stars i:nth-child(8) { width:1.5px;height:1.5px; bottom:15%; right:40%; animation:acrStar 5.8s ease-in-out infinite 0.4s; }
        @keyframes acrStar { 0%,100%{opacity:0.25;transform:scale(1)} 50%{opacity:0.95;transform:scale(1.3)} }
        .acr-astro > * { position:relative; z-index:1; }

        /* header */
        .acr-astro-head { display:flex; align-items:flex-start; justify-content:space-between; gap:8px; margin-bottom:7px; }
        .acr-astro-head-left { display:flex; align-items:flex-start; gap:8px; min-width:0; flex:1; }
        .acr-astro-badge {
          width:26px; height:26px; border-radius:8px; flex-shrink:0;
          background:rgba(165,180,252,0.12); border:1px solid rgba(165,180,252,0.25);
          display:flex; align-items:center; justify-content:center; margin-top:1px;
        }
        .acr-astro-title-row { display:flex; align-items:center; gap:7px; }
        .acr-astro-main-title { font-size:17px; font-weight:800; color:#F8FAFC; letter-spacing:0.01em; }
        .acr-astro-live-badge {
          padding:2px 7px; border-radius:999px; font-size:8.5px; font-weight:800; letter-spacing:0.1em;
          background:linear-gradient(135deg,#6366F1,#8B5CF6); color:#fff;
          box-shadow:0 3px 8px rgba(99,102,241,0.35);
          animation:acrLive 2.8s ease-in-out infinite;
        }
        @keyframes acrLive { 0%,100%{opacity:1} 50%{opacity:0.72} }
        .acr-astro-city-sub { font-size:10.5px; color:#93C5FD; font-weight:600; margin-top:2px; opacity:0.88; }

        .acr-astro-loc {
          display:flex; align-items:center; gap:3px; flex-shrink:0;
          padding:5px 8px; border-radius:999px;
          background:rgba(255,255,255,0.08); border:1px solid rgba(165,180,252,0.2);
        }
        .acr-astro-loc select {
          border:none; background:transparent; color:#F8FAFC; font-size:11px; font-weight:700;
          outline:none; cursor:pointer; appearance:none; max-width:90px;
        }
        .acr-astro-loc-arrow { font-size:10px; color:#A5B4FC; pointer-events:none; }

        /* festival banner */
        .acr-astro-festival-row {
          display:flex; align-items:center; gap:6px;
          padding:5px 8px; border-radius:8px; margin-bottom:8px;
          background:rgba(251,191,36,0.08); border:1px solid rgba(251,191,36,0.18);
        }
        .acr-astro-festival-row-dim {
          background:rgba(255,255,255,0.04); border-color:rgba(255,255,255,0.08);
        }
        .acr-astro-festival-gem { font-size:11px; color:#FDE68A; flex-shrink:0; line-height:1; }
        .acr-astro-festival-row-dim .acr-astro-festival-gem { color:#475569; }
        .acr-astro-festival-name {
          font-size:11px; font-weight:700; color:#FDE68A; line-height:1.2;
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        }
        .acr-astro-festival-row-dim .acr-astro-festival-name { color:#475569; font-weight:500; }

        /* mandala + period grid */
        .acr-astro-main { display:grid; grid-template-columns:82px minmax(0,1fr); gap:10px; margin-bottom:6px; }
        .acr-astro-mandala-wrap {
          width:82px; height:82px; display:flex; align-items:center; justify-content:center;
          filter:drop-shadow(0 2px 12px rgba(245,158,11,0.42)) drop-shadow(0 0 6px rgba(251,191,36,0.22));
        }
        .acr-astro-mandala { width:100%; height:100%; animation:acrMandalaSpin 75s linear infinite; }
        @keyframes acrMandalaSpin { to{ transform:rotate(360deg); } }

        /* period panel */
        .acr-astro-period-panel { display:flex; flex-direction:column; gap:5px; justify-content:center; min-width:0; }
        .acr-astro-period-chip {
          display:inline-flex; align-items:center; gap:6px;
          padding:4px 10px; border-radius:999px; font-size:10.5px; font-weight:800; letter-spacing:0.03em;
          white-space:nowrap; align-self:flex-start;
        }
        .acr-period-dot {
          width:6px; height:6px; border-radius:50%; flex-shrink:0;
        }
        .acr-period-dot-pulse {
          animation:acrDotPulse 1.4s ease-in-out infinite;
        }
        @keyframes acrDotPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.55;transform:scale(0.75)} }
        .acr-astro-period-range {
          font-size:12px; font-weight:700; letter-spacing:0.01em; padding-left:2px;
        }
        .acr-astro-timer {
          font-size:11px; font-weight:800; font-variant-numeric:tabular-nums;
          background:rgba(255,255,255,0.07); border-radius:6px; padding:2px 7px;
          display:inline-block; align-self:flex-start;
        }
        .acr-astro-period-remark {
          font-size:9.5px; line-height:1.45; color:rgba(203,213,225,0.68); font-weight:500; padding-left:2px;
        }

        /* sun / moon chips — CSS-only icons */
        /* CSS celestial icons */
        .acr-cel-icon {
          width:18px; height:18px; border-radius:50%; flex-shrink:0; position:relative; display:block;
        }
        /* sun rise — warm orange disc with rays */
        .acr-cel-sun-rise {
          background:radial-gradient(circle at 50% 50%, #FDE68A 0%, #F59E0B 60%, rgba(245,158,11,0) 100%);
          box-shadow:0 0 6px 2px rgba(251,191,36,0.55), 0 0 12px rgba(251,191,36,0.25);
        }
        /* sun set — deeper amber */
        .acr-cel-sun-set {
          background:radial-gradient(circle at 50% 50%, #FCD34D 0%, #D97706 60%, rgba(217,119,6,0) 100%);
          box-shadow:0 0 5px 2px rgba(217,119,6,0.5), 0 0 10px rgba(217,119,6,0.2);
        }
        /* moon rise — cool silver disc */
        .acr-cel-moon-rise {
          background:radial-gradient(circle at 40% 38%, #F8FAFC 0%, #CBD5E1 45%, rgba(148,163,184,0) 100%);
          box-shadow:0 0 5px 2px rgba(203,213,225,0.45), 0 0 10px rgba(148,163,184,0.2);
        }
        /* moon set — dimmer silver */
        .acr-cel-moon-set {
          background:radial-gradient(circle at 40% 38%, #E2E8F0 0%, #94A3B8 55%, rgba(100,116,139,0) 100%);
          box-shadow:0 0 4px 1px rgba(148,163,184,0.38);
          opacity:0.72;
        }

        /* panchang tiles — name only */
        .acr-astro-tiles { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:5px; }
        .acr-astro-tile {
          padding:7px 7px 8px; border-radius:11px;
          background:rgba(8,16,36,0.55); border:1px solid rgba(99,102,241,0.18);
          min-width:0; display:flex; flex-direction:column; gap:3px;
          backdrop-filter:blur(2px);
        }
        .acr-astro-tile-label {
          display:block; font-size:7.5px; font-weight:800; letter-spacing:0.08em;
          text-transform:uppercase; color:#818CF8; line-height:1;
        }
        .acr-astro-tile-name {
          display:block; font-size:12px; line-height:1.25; color:#F8FAFC; font-weight:800;
          word-break:break-word; hyphens:auto;
        }
        /* ----- Skill / Surprises ----- */
        .acr-feature-row { display:grid; grid-template-columns:1fr 1fr; gap:6px; }
        .acr-feature {
          width:100%; border:none; cursor:pointer; text-align:left;
          border-radius:14px; padding:10px 11px; color:#fff;
          background:linear-gradient(155deg,#0F172A,#1E293B);
          box-shadow:0 12px 24px rgba(15,23,42,0.22), inset 0 1px 0 rgba(255,255,255,0.05);
          display:flex; align-items:center; gap:9px; min-height:56px;
          transition:transform 0.14s ease;
        }
        .acr-feature:active { transform:scale(0.975); }
        .acr-feature-icon {
          width:32px; height:32px; border-radius:10px; flex-shrink:0;
          display:flex; align-items:center; justify-content:center; font-size:17px;
          background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.08);
        }
        .acr-feature-copy { min-width:0; flex:1; }
        .acr-feature-copy p { margin:0; font-size:13.5px; font-weight:800; color:#fff; line-height:1.1; }
        .acr-feature-copy span { display:block; margin-top:2px; font-size:9.5px; color:rgba(226,232,240,0.68); font-weight:600; line-height:1.2; }
        .acr-feature-pill {
          flex-shrink:0; padding:5px 11px; border-radius:999px;
          background:linear-gradient(135deg,#7C3AED,#A855F7); color:#fff; font-size:11px; font-weight:800;
          box-shadow:0 5px 12px rgba(124,58,237,0.28);
        }

        /* ----- Quick Actions ----- */
        .acr-section {
          background:#fff; border:1px solid rgba(148,163,184,0.15);
          border-radius:14px; padding:10px 11px;
          box-shadow:0 6px 14px rgba(15,23,42,0.05);
        }
        .acr-section-head { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:9px; }
        .acr-section-head p { margin:0; font-size:10.5px; font-weight:800; color:#475569; text-transform:uppercase; letter-spacing:0.1em; }
        .acr-section-head span { font-size:11px; color:#3B82F6; font-weight:700; }
        .acr-quick-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:7px; }
        .acr-quick {
          border:1px solid rgba(148,163,184,0.13); cursor:pointer; text-align:left;
          border-radius:11px; padding:8px 9px; background:#FAFBFC;
          display:flex; flex-direction:column; gap:3px; transition:transform 0.13s ease;
        }
        .acr-quick:active { transform:scale(0.97); }
        .acr-quick-top { display:flex; align-items:center; justify-content:space-between; gap:5px; margin-bottom:1px; }
        .acr-quick-icon { width:28px; height:28px; border-radius:9px; display:flex; align-items:center; justify-content:center; font-size:13px; }
        .acr-quick-title { margin:0; font-size:11.5px; font-weight:800; color:#0F172A; line-height:1.1; }
        .acr-quick-sub { margin:0; font-size:9.5px; font-weight:600; color:#64748B; line-height:1.15; }

        @media (max-width: 360px) {
          .acr-root { padding:5px 4px 80px; }
          .acr-celestial-strip { grid-template-columns:1fr 1fr; gap:6px; padding:7px; }
          .acr-celestial-seg { padding:8px; }
          .acr-celestial-value { font-size:11px; }
          .acr-astro-main { grid-template-columns:78px minmax(0,1fr); }
          .acr-astro-mandala-wrap { width:78px; height:78px; }
          .acr-astro-tiles { grid-template-columns:repeat(2,1fr); }
          .acr-quick-grid { grid-template-columns:1fr 1fr; }
          .acr-sum-primary { font-size:19px; }
        }
      `}</style>

      <div className="acr-root">
        <div className="acr-shell">
          {/* ----- Header ----- */}
          <div className="acr-header">
            <div className="acr-brand">
              <img
                src="/logo.jpg"
                alt="ACR MAX"
                className="acr-brand-logo"
                onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex' }}
              />
              <div className="acr-brand-logo-fallback" style={{ display:'none' }}>M</div>
              <div style={{ minWidth:0 }}>
                <p className="acr-brand-title">ACR MAX</p>
                <p className="acr-brand-sub">{greeting.emoji} {greeting.text}, {displayName}</p>
              </div>
            </div>

            <div className="acr-header-right">
              <div className="acr-time">
                <div>{time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }).toLowerCase()}</div>
                <div>{time.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
              </div>
              <button className="acr-coin" onClick={() => navigate('coins')}>
                🪙 {Number(coins || 0).toLocaleString('en-IN')}
              </button>
            </div>
          </div>

          <CelestialStrip snapshot={dashboardSnapshot.astro} />

          {/* ----- 4 summary cards ----- */}
          <div className="acr-sum-grid">
            <SummaryCard
              tone="expenses"
              icon="₹"
              iconBg="linear-gradient(135deg,#FEF3C7,#FCD34D)"
              iconColor="#D97706"
              title="EXPENSES"
              primary={dashboardSnapshot.expenses.value}
              primaryPrefix="₹"
              animated
              primaryColor="#D97706"
              subline={dashboardSnapshot.expenses.subline}
              microVisual={<MiniTrend accent="#D97706" points={dashboardSnapshot.expenses.trendBars} />}
              onClick={() => navigate('expense')}
            />
            <SummaryCard
              tone="ledger"
              icon="🤝"
              iconBg="linear-gradient(135deg,#D1FAE5,#A7F3D0)"
              iconColor="#059669"
              title="LEDGER"
              primary={dashboardSnapshot.ledger.value}
              primaryPrefix="₹"
              animated
              primaryColor="#059669"
              subline={dashboardSnapshot.ledger.subline}
              microVisual={<MiniDots accent="#059669" values={dashboardSnapshot.ledger.dots} />}
              onClick={() => navigate('ledger')}
            />
            <SummaryCard
              tone="planner"
              icon="🗓️"
              iconBg="linear-gradient(135deg,#EDE9FE,#DDD6FE)"
              iconColor="#7C3AED"
              title="PLANNER"
              primary={dashboardSnapshot.planner.value}
              primaryColor="#7C3AED"
              subline={dashboardSnapshot.planner.subline}
              onClick={() => navigate('planner')}
            />
            <AiInsightsCard
              bullets={dashboardSnapshot.insights.bullets}
              onClick={() => navigate('chat')}
            />
          </div>

          {/* ----- Premium Astro card ----- */}
          <PremiumAstroCard
            snapshot={dashboardSnapshot.astro}
            onOpen={() => navigate('astro')}
            onLocationChange={handleAstroLocationChange}
          />

          {/* ----- Skill / Surprises ----- */}
          <div className="acr-feature-row">
            <FeatureCard
              title="Skill"
              subtitle="Puzzles, streaks & coin rewards"
              pill="Play"
              icon="⚡"
              accent="#FBBF24"
              onClick={() => setSkillOpen(true)}
            />
            <FeatureCard
              title="Surprises"
              subtitle={surpriseLocked ? `Next in ${formatSurpriseCountdown(surpriseRemainingMs)}` : 'Fresh cards available'}
              pill={surpriseLocked ? 'Locked' : 'Open'}
              icon="🎁"
              accent="#F472B6"
              onClick={() => setSurprisesOpen(true)}
            />
          </div>

          {/* ----- Quick Actions ----- */}
          <div className="acr-section">
            <div className="acr-section-head">
              <p>Quick Actions</p>
              <span>Open fast</span>
            </div>
            <div className="acr-quick-grid">
              {quickActions.map((action) => (
                <button
                  key={action.id}
                  className="acr-quick"
                  onClick={() => navigate(action.id)}
                >
                  <div className="acr-quick-top">
                    <div className="acr-quick-icon" style={{ color: action.accent, background: action.bg }}>
                      {action.icon}
                    </div>
                    <span style={{ color: action.accent, fontSize: 16, fontWeight: 700 }}>›</span>
                  </div>
                  <p className="acr-quick-title">{action.label}</p>
                  <p className="acr-quick-sub">{action.sub}</p>
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

