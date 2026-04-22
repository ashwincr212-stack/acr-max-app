import { VOICE_LEXICON } from './voiceLexicon'

const WEEKDAY_INDEX = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
}

const WEEKDAY_ALIASES = {
  sunday: ['sunday'],
  monday: ['monday'],
  tuesday: ['tuesday'],
  wednesday: ['wednesday'],
  thursday: ['thursday'],
  friday: ['friday'],
  saturday: ['saturday'],
}

const PERSON_STOP_WORDS = new Set([
  ...VOICE_LEXICON.fillerWords,
  ...VOICE_LEXICON.weakNoiseWords,
  'i', 'me', 'my', 'money', 'paisa', 'rupee', 'rupees', 'from', 'on', 'at', 'in',
  'gave', 'give', 'given', 'lend', 'lent', 'loaned', 'received', 'receive', 'got',
  'collect', 'collected', 'borrowed', 'borrow', 'took', 'owes', 'must', 'should',
  'has', 'ko', 'ku', 'kitte', 'se', 'from', 'diya', 'liya', 'vangi', 'vanginen',
  'koduthu', 'koduthen', 'kuduthu', 'karna', 'cheyyanam', 'pannanum',
  'today', 'tomorrow', 'morning', 'afternoon', 'evening', 'night',
])

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function titleCase(value = '') {
  return value
    .split(' ')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function hasAny(text, values) {
  return values.some(value => text.includes(value))
}

function replaceWholePhrase(text, from, to) {
  return text.replace(new RegExp(`\\b${escapeRegExp(from)}\\b`, 'g'), to)
}

function formatDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getNextWeekday(dayIndex) {
  const now = new Date()
  const value = new Date(now)
  const delta = (dayIndex - now.getDay() + 7) % 7 || 7
  value.setDate(now.getDate() + delta)
  return value
}

export function normalizeIndianVariants(text) {
  let value = text

  Object.entries(VOICE_LEXICON.localMixedVariants).forEach(([canonical, variants]) => {
    variants.forEach((variant) => {
      value = replaceWholePhrase(value, variant, canonical)
    })
  })

  const directReplacements = [
    ['p.m', 'pm'],
    ['a.m', 'am'],
    ['top up', 'topup'],
    ['re charge', 'recharge'],
    ['got from', 'received from'],
    ['collect from', 'collected from'],
    ['took from', 'borrowed from'],
    ['taken from', 'borrowed from'],
    ['mobile topup', 'mobile recharge'],
    ['restaurant food', 'hotel food'],
    ['food expense', 'food'],
    ['meal expense', 'food'],
    ['fuel expense', 'petrol'],
    ['hotel expense', 'hotel food'],
    ['smoke expense', 'smoke'],
    ['current', 'current bill'],
  ]

  directReplacements.forEach(([from, to]) => {
    value = replaceWholePhrase(value, from, to)
  })

  return value
}

export function normalizeSpeechText(rawText = '') {
  let text = rawText.toLowerCase().trim()
  text = normalizeIndianVariants(text)
  text = text.replace(/[.,!?;:()[\]{}-]+/g, ' ')
  text = text.replace(/\s+/g, ' ').trim()

  const words = []
  for (const word of text.split(' ').filter(Boolean)) {
    if (VOICE_LEXICON.fillerWords.includes(word)) continue
    if (words[words.length - 1] === word) continue
    words.push(word)
  }

  return words.join(' ')
}

export function normalizeNumberWords(text) {
  return text
    .replace(/\b(\d{1,2})\s+baje\b/g, '$1')
    .replace(/\btop up\b/g, 'topup')
}

function getCategoryAliases() {
  return Object.entries(VOICE_LEXICON.expenseCategories)
}

export function normalizeCategory(text) {
  for (const [category, aliases] of getCategoryAliases()) {
    if (aliases.some(alias => text.includes(alias))) return category
  }
  return null
}

function parseSimpleNumber(tokens) {
  let total = 0
  let current = 0
  let matched = 0

  for (const token of tokens) {
    if (!(token in VOICE_LEXICON.numberWords)) break
    matched += 1
    const value = VOICE_LEXICON.numberWords[token]

    if (value === 100) {
      current = (current || 1) * 100
      continue
    }

    if (value === 1000) {
      total += (current || 1) * 1000
      current = 0
      continue
    }

    current += value
  }

  return matched ? { value: total + current, matched } : null
}

function parseColloquialNumber(tokens) {
  const first = tokens[0]
  const second = tokens[1]
  if (!(first in VOICE_LEXICON.numberWords) || !(second in VOICE_LEXICON.numberWords)) return null

  const firstValue = VOICE_LEXICON.numberWords[first]
  const secondValue = VOICE_LEXICON.numberWords[second]
  if (firstValue < 1 || firstValue > 9) return null
  if (secondValue < 10 || secondValue > 99) return null

  return { value: firstValue * 100 + secondValue, matched: 2 }
}

export function extractAmount(text) {
  const digitMatch = text.match(/\b\d+(?:\.\d+)?\b/)
  if (digitMatch) return Number(digitMatch[0])

  const tokens = text.split(' ').filter(Boolean)
  for (let index = 0; index < tokens.length; index += 1) {
    const segment = tokens.slice(index, index + 6)
    const parsed = parseSimpleNumber(segment) || parseColloquialNumber(segment)
    if (parsed?.value) return parsed.value
  }

  return null
}

function getLedgerSignals(text) {
  return {
    given: hasAny(text, VOICE_LEXICON.ledgerDirections.given),
    received: hasAny(text, VOICE_LEXICON.ledgerDirections.received),
    borrowed: hasAny(text, VOICE_LEXICON.ledgerDirections.borrowed),
    owesMe: hasAny(text, VOICE_LEXICON.ledgerDirections.owesMe),
  }
}

function hasPlannerTimeCue(text) {
  return Object.values(VOICE_LEXICON.plannerTimeWords).some(values => hasAny(text, values))
}

function hasPlannerDateCue(text) {
  return Object.values(VOICE_LEXICON.plannerDateWords).some(values => hasAny(text, values))
    || Object.values(WEEKDAY_ALIASES).some(values => hasAny(text, values))
}

export function detectIntent(text) {
  const amount = extractAmount(text)
  const category = normalizeCategory(text)
  const ledgerSignals = getLedgerSignals(text)
  const hasLedgerCue = Object.values(ledgerSignals).some(Boolean) || text.includes(' ko ') || text.includes(' se ')
  const hasTaskVerb = hasAny(text, VOICE_LEXICON.taskVerbs)
  const hasPlannerCue = hasTaskVerb || hasPlannerDateCue(text) || hasPlannerTimeCue(text) || hasAny(text, VOICE_LEXICON.plannerJoiners)

  if (hasLedgerCue && amount) return 'ledger'
  if ((text.includes('pay') || text.includes('call') || text.includes('buy') || text.includes('meeting') || text.includes('appointment')) && (hasPlannerDateCue(text) || hasPlannerTimeCue(text))) {
    return 'planner'
  }
  if (hasTaskVerb && !amount) return 'planner'
  if (hasPlannerCue && !amount) return 'planner'
  if (amount && category && !hasTaskVerb) return 'expense'
  if (amount && category && !hasPlannerDateCue(text) && !hasPlannerTimeCue(text)) return 'expense'
  if (hasPlannerCue) return 'planner'
  if (amount) return 'expense'
  return null
}

export function normalizePersonName(text = '') {
  const cleaned = text
    .split(' ')
    .filter(Boolean)
    .filter(word => !PERSON_STOP_WORDS.has(word))
    .filter(word => !(word in VOICE_LEXICON.numberWords))
    .filter(word => !/^\d+$/.test(word))
    .slice(0, 2)
    .join(' ')

  return titleCase(cleaned)
}

function extractLedgerPerson(text, amount) {
  const patterns = [
    /\b(?:gave|give|given|lend|lent|loaned)\s+([a-z]+)\s+\d+/,
    /\b(?:gave|give|given|lend|lent|loaned)\s+to\s+([a-z]+)\s+\d+/,
    /\b([a-z]+)\s+ko\s+\d+\s+diya\b/,
    /\breceived from\s+([a-z]+)\s+\d+/,
    /\b(?:got|collected|collect)\s+\d+\s+from\s+([a-z]+)\b/,
    /\b([a-z]+)\s+gave me\s+\d+/,
    /\b([a-z]+)\s+mujhe\s+\d+\s+diya\b/,
    /\b([a-z]+)\s+owes me\s+\d+/,
    /\bborrowed\s+\d+\s+from\s+([a-z]+)\b/,
    /\bborrowed from\s+([a-z]+)\s+\d+/,
    /\b([a-z]+)\s+se\s+\d+\s+liya\b/,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) return normalizePersonName(match[1])
  }

  return normalizePersonName(text.replace(String(amount || ''), ' '))
}

export function parseLedger(text) {
  const amount = extractAmount(text)
  const person = extractLedgerPerson(text, amount)
  const signals = getLedgerSignals(text)

  let type = 'lent'
  if (signals.received || signals.borrowed) type = 'borrowed'
  if (signals.owesMe || signals.given) type = 'lent'

  return {
    type: 'ledger',
    data: {
      person,
      amount,
      type,
    },
    error: person && amount ? null : 'Try: "gave Ravi 500" or "received from Mani 300"',
  }
}

function buildExpenseNote(text, category, amount) {
  let value = text
  value = value.replace(new RegExp(`\\b${escapeRegExp(String(amount || ''))}\\b`, 'g'), ' ')
  ;(VOICE_LEXICON.expenseCategories[category] || []).forEach((alias) => {
    value = value.replace(new RegExp(`\\b${escapeRegExp(alias)}\\b`, 'g'), ' ')
  })
  value = value.replace(/\b(spent|expense|amount|on|for)\b/g, ' ')
  value = value.replace(/\s+/g, ' ').trim()
  return value ? titleCase(value) : ''
}

export function parseExpense(text) {
  const amount = extractAmount(text)
  const category = normalizeCategory(text) || 'Other'

  return {
    type: 'expense',
    data: {
      category,
      amount,
      note: buildExpenseNote(text, category, amount),
    },
    error: amount ? null : 'No amount detected. Try: "food 200"',
  }
}

function detectPlannerDayPart(text) {
  for (const [part, aliases] of Object.entries(VOICE_LEXICON.plannerTimeWords)) {
    if (hasAny(text, aliases)) return part
  }
  return ''
}

function extractDate(text) {
  const now = new Date()
  if (hasAny(text, VOICE_LEXICON.plannerDateWords.tomorrow)) {
    const value = new Date(now)
    value.setDate(now.getDate() + 1)
    return formatDate(value)
  }
  if (hasAny(text, VOICE_LEXICON.plannerDateWords.today)) {
    return formatDate(now)
  }

  for (const [weekday, aliases] of Object.entries(WEEKDAY_ALIASES)) {
    if (hasAny(text, aliases)) return formatDate(getNextWeekday(WEEKDAY_INDEX[weekday]))
  }

  return ''
}

function extractTime(text) {
  const match = text.match(/\b(?:at\s+)?(\d{1,2})(?:[: ](\d{2}))?\s*(am|pm)?\b/)
  if (match) {
    let hour = Number(match[1])
    const minute = Number(match[2] || 0)
    const meridiem = match[3]?.toLowerCase() || ''
    const dayPart = detectPlannerDayPart(text)

    if (meridiem === 'pm' && hour < 12) hour += 12
    if (meridiem === 'am' && hour === 12) hour = 0
    if (!meridiem && (dayPart === 'evening' || dayPart === 'night') && hour < 12) hour += 12

    if (hour <= 23 && minute <= 59) {
      return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    }
  }

  const dayPart = detectPlannerDayPart(text)
  if (dayPart === 'morning') return '09:00'
  if (dayPart === 'afternoon') return '15:00'
  if (dayPart === 'evening') return '18:00'
  if (dayPart === 'night') return '20:00'
  return ''
}

export function cleanupPlannerTitle(text) {
  let value = text

  const removablePhrases = [
    ...VOICE_LEXICON.plannerDateWords.today,
    ...VOICE_LEXICON.plannerDateWords.tomorrow,
    ...Object.values(VOICE_LEXICON.plannerTimeWords).flat(),
    ...Object.values(WEEKDAY_ALIASES).flat(),
    'remind me to',
    'remind me',
  ]

  removablePhrases.forEach((phrase) => {
    value = replaceWholePhrase(value, phrase, ' ')
  })

  value = value.replace(/\b(?:at\s+)?\d{1,2}(?:[: ]\d{2})?\s*(am|pm)?\b/g, ' ')
  VOICE_LEXICON.plannerJoiners.forEach((joiner) => {
    value = replaceWholePhrase(value, joiner, ' ')
  })
  value = value.replace(/\bko\b/g, ' ')
  value = value.replace(/\s+/g, ' ').trim()

  return value ? titleCase(value) : 'Task'
}

export function parsePlanner(text) {
  return {
    type: 'planner',
    data: {
      title: cleanupPlannerTitle(text),
      date: extractDate(text),
      time: extractTime(text),
    },
    error: null,
  }
}

export function parseVoiceCommand(rawText) {
  if (!rawText?.trim()) {
    return { type: null, data: {}, error: 'No speech detected. Please try again.' }
  }

  const normalizedText = normalizeNumberWords(normalizeSpeechText(rawText))
  const intent = detectIntent(normalizedText)

  if (intent === 'ledger') return parseLedger(normalizedText)
  if (intent === 'planner') return parsePlanner(normalizedText)
  if (intent === 'expense') return parseExpense(normalizedText)

  const fallbackAmount = extractAmount(normalizedText)
  const fallbackCategory = normalizeCategory(normalizedText)

  if (fallbackAmount || fallbackCategory) return parseExpense(normalizedText)

  return {
    type: null,
    data: {},
    error: 'Try: "food 200", "gave Ravi 500", or "meeting tomorrow at 5 pm"',
  }
}
