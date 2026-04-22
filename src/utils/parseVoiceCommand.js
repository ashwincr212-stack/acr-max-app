const EXPENSE_CATEGORY_PATTERNS = [
  { category: 'Electricity Bill', patterns: ['electricity bill', 'current bill', 'eb bill', 'light bill', 'electricity', 'current bill payment', 'eb payment', 'eb'] },
  { category: 'Water Bill', patterns: ['water bill', 'water payment', 'water'] },
  { category: 'Mobile Recharge', patterns: ['mobile recharge', 'phone recharge', 're charge', 'recharge', 'top up'] },
  { category: 'Hotel Food', patterns: ['hotel food', 'outside food', 'restaurant food', 'restaurant', 'hotel', 'outside eating'] },
  { category: 'Groceries', patterns: ['groceries', 'grocery', 'grosary', 'shop items', 'ration', 'provisions'] },
  { category: 'Petrol', patterns: ['petrol', 'petro', 'petral', 'fuel', 'diesel'] },
  { category: 'Smoke', patterns: ['smoke', 'smoking', 'cigarette', 'cigratte', 'cigarettes'] },
  { category: 'Liquor', patterns: ['liquor', 'likkar', 'alcohol', 'beer', 'drink', 'drinks'] },
  { category: 'Food', patterns: ['food', 'khana', 'meal', 'breakfast', 'lunch', 'dinner', 'snack'] },
  { category: 'CSD', patterns: ['csd'] },
  { category: 'Other', patterns: ['other', 'misc', 'miscellaneous'] },
]

const FILLER_WORDS = new Set([
  'please', 'okay', 'ok', 'da', 'dei', 'chetta', 'macha', 'bro', 'anna', 'bhai', 'yaar',
  'arey', 'arre', 'accha', 'achha', 'suno', 'ah', 'uh', 'um',
])

const LEDGER_GIVE_WORDS = ['gave', 'give', 'given', 'lend', 'lent', 'diya', 'de diya', 'paid', 'pay']
const LEDGER_RECEIVE_WORDS = ['received', 'receive', 'recieve', 'got', 'mila', 'liya']
const LEDGER_BORROW_WORDS = ['borrowed', 'borrow', 'took']
const PLANNER_ACTION_WORDS = ['meeting', 'appointment', 'call', 'pay', 'remind', 'buy', 'medicine', 'visit', 'pickup', 'drop', 'task', 'school']

const PERSON_STOP_WORDS = new Set([
  'i', 'me', 'my', 'to', 'from', 'for', 'on', 'at', 'the', 'a', 'an', 'ko', 'se', 'ka', 'ki',
  'gave', 'give', 'given', 'lent', 'lend', 'received', 'receive', 'got', 'borrowed', 'borrow',
  'collect', 'owes', 'owe', 'money', 'rupees', 'rupee', 'please', 'tomorrow', 'today', 'tonight',
])

const NUMBER_WORDS = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
  thousand: 1000,
}

const RELATIVE_DATE_WORDS = {
  today: 0,
  aaj: 0,
  tomorrow: 1,
  tomoro: 1,
  tmrw: 1,
  kal: 1,
}

const WEEKDAY_MAP = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
}

const DAY_PARTS = {
  morning: '09:00',
  subah: '09:00',
  afternoon: '15:00',
  dopahar: '15:00',
  evening: '18:00',
  shaam: '18:00',
  night: '20:00',
  raat: '20:00',
  tonight: '20:00',
}

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

function formatDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getNextWeekday(day) {
  const now = new Date()
  const result = new Date(now)
  const delta = (day - now.getDay() + 7) % 7 || 7
  result.setDate(now.getDate() + delta)
  return result
}

function normalizeSpeechText(rawText = '') {
  let text = rawText.toLowerCase().trim()

  const phraseReplacements = [
    ['p.m', 'pm'],
    ['a.m', 'am'],
    ['tomoro', 'tomorrow'],
    ['tmrw', 'tomorrow'],
    ['aaj raat', 'tonight'],
    ['re charge', 'recharge'],
    ['phone recharge', 'mobile recharge'],
    ['shop items', 'groceries'],
    ['light bill', 'electricity bill'],
    ['current bill', 'electricity bill'],
    ['eb bill', 'electricity bill'],
    ['eb payment', 'electricity bill'],
    ['outside food', 'hotel food'],
    ['restaurant food', 'hotel food'],
    ['petro', 'petrol'],
    ['petral', 'petrol'],
    ['grosary', 'groceries'],
    ['cigratte', 'cigarette'],
    ['likkar', 'liquor'],
    ['de diya', 'diya'],
    ['got from', 'received from'],
    ['receive kiya', 'received'],
  ]

  phraseReplacements.forEach(([from, to]) => {
    text = text.replace(new RegExp(`\\b${escapeRegExp(from)}\\b`, 'g'), to)
  })

  text = text.replace(/[.,!?;:()[\]-]+/g, ' ')
  text = text.replace(/\s+/g, ' ').trim()

  const words = text
    .split(' ')
    .filter(Boolean)
    .filter(word => !FILLER_WORDS.has(word))

  return words.join(' ')
}

function findCategory(text) {
  for (const entry of EXPENSE_CATEGORY_PATTERNS) {
    if (entry.patterns.some(pattern => text.includes(pattern))) return entry.category
  }
  return null
}

function parseNumberWords(tokens) {
  let total = 0
  let current = 0
  let found = false

  for (const token of tokens) {
    if (!(token in NUMBER_WORDS)) break
    found = true
    const value = NUMBER_WORDS[token]

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

  return found ? total + current : null
}

function extractAmount(text) {
  const digitMatch = text.match(/\b\d+(?:\.\d+)?\b/)
  if (digitMatch) return Number(digitMatch[0])

  const tokens = text.split(' ')
  let best = null

  for (let index = 0; index < tokens.length; index += 1) {
    const value = parseNumberWords(tokens.slice(index, index + 6))
    if (value !== null) {
      best = value
      if (value > 0) break
    }
  }

  return best
}

function hasFutureContext(text) {
  return Boolean(
    text.includes('tomorrow') ||
    text.includes('tonight') ||
    text.includes('morning') ||
    text.includes('subah') ||
    text.includes('evening') ||
    text.includes('shaam') ||
    text.includes('night') ||
    text.includes('raat') ||
    text.includes('remind') ||
    text.includes('call') ||
    text.includes('meeting')
  )
}

function extractDate(text) {
  const now = new Date()

  for (const [word, offset] of Object.entries(RELATIVE_DATE_WORDS)) {
    if (text.includes(word)) {
      const date = new Date(now)
      const safeOffset = word === 'kal' && !hasFutureContext(text) ? 1 : offset
      date.setDate(date.getDate() + safeOffset)
      return formatDate(date)
    }
  }

  for (const [weekday, dayIndex] of Object.entries(WEEKDAY_MAP)) {
    if (text.includes(weekday)) return formatDate(getNextWeekday(dayIndex))
  }

  return ''
}

function normalizeHour(hour, meridiem, text) {
  let normalized = Number(hour)
  if (meridiem === 'pm' && normalized < 12) normalized += 12
  if (meridiem === 'am' && normalized === 12) normalized = 0
  if (!meridiem && text.includes('tonight') && normalized < 12) normalized += 12
  if (!meridiem && (text.includes('evening') || text.includes('shaam') || text.includes('night') || text.includes('raat')) && normalized < 12) normalized += 12
  return normalized
}

function extractTime(text) {
  const explicit = text.match(/\b(?:at\s+)?(\d{1,2})(?:\s+|:)?(\d{2})?\s*(am|pm)?\b/)
  if (explicit) {
    const hour = normalizeHour(explicit[1], explicit[3]?.toLowerCase(), text)
    const minute = Number(explicit[2] || 0)
    if (hour <= 23 && minute <= 59) {
      return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    }
  }

  for (const [word, fallback] of Object.entries(DAY_PARTS)) {
    if (text.includes(word)) return fallback
  }

  return ''
}

function cleanupPlannerTitle(text) {
  let title = text
    .replace(/\b(remind me to|remind me|please remind|schedule|set|note|add|enter|put)\b/g, ' ')
    .replace(/\b(today|tomorrow|tonight|aaj|kal|morning|subah|afternoon|dopahar|evening|shaam|night|raat)\b/g, ' ')
    .replace(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/g, ' ')
    .replace(/\bat\s+\d{1,2}(?:\s+|:)?\d{0,2}\s*(am|pm)?\b/g, ' ')
    .replace(/\b\d{1,2}(?:\s+|:)?\d{0,2}\s*(am|pm)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  title = title
    .replace(/\bkarna\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  return title ? titleCase(title) : 'Task'
}

function extractPersonCandidate(fragment) {
  const words = fragment
    .split(' ')
    .filter(Boolean)
    .filter(word => !PERSON_STOP_WORDS.has(word))
    .filter(word => !NUMBER_WORDS[word] && !/^\d+$/.test(word))

  return words.length ? titleCase(words[0]) : ''
}

function extractLedger(text) {
  let match = text.match(/\b(?:i\s+)?(?:gave|give|given|lend|lent|diya)\s+([a-z]+)\s+(\d+(?:\.\d+)?)\b/)
  if (match) return { person: titleCase(match[1]), amount: Number(match[2]), type: 'lent' }

  match = text.match(/\b([a-z]+)\s+ko\s+(\d+(?:\.\d+)?)\s+diya\b/)
  if (match) return { person: titleCase(match[1]), amount: Number(match[2]), type: 'lent' }

  match = text.match(/\b(?:received\s+from|received|got)\s+([a-z]+)\s+(\d+(?:\.\d+)?)\b/)
  if (match) return { person: titleCase(match[1]), amount: Number(match[2]), type: 'borrowed' }

  match = text.match(/\b(?:got|received)\s+(\d+(?:\.\d+)?)\s+from\s+([a-z]+)\b/)
  if (match) return { person: titleCase(match[2]), amount: Number(match[1]), type: 'borrowed' }

  match = text.match(/\b([a-z]+)\s+gave\s+me\s+(\d+(?:\.\d+)?)\b/)
  if (match) return { person: titleCase(match[1]), amount: Number(match[2]), type: 'borrowed' }

  match = text.match(/\b([a-z]+)\s+owes\s+me\s+(\d+(?:\.\d+)?)\b/)
  if (match) return { person: titleCase(match[1]), amount: Number(match[2]), type: 'lent' }

  match = text.match(/\b(?:i\s+)?borrowed\s+(\d+(?:\.\d+)?)\s+from\s+([a-z]+)\b/)
  if (match) return { person: titleCase(match[2]), amount: Number(match[1]), type: 'borrowed' }

  match = text.match(/\bborrowed\s+from\s+([a-z]+)\s+(\d+(?:\.\d+)?)\b/)
  if (match) return { person: titleCase(match[1]), amount: Number(match[2]), type: 'borrowed' }

  match = text.match(/\b([a-z]+)\s+se\s+(\d+(?:\.\d+)?)\s+liya\b/)
  if (match) return { person: titleCase(match[1]), amount: Number(match[2]), type: 'borrowed' }

  match = text.match(/\bcollect\s+(\d+(?:\.\d+)?)\s+from\s+([a-z]+)\b/)
  if (match) return { person: titleCase(match[2]), amount: Number(match[1]), type: 'lent' }

  const amount = extractAmount(text)
  if (!amount) return null

  if (LEDGER_GIVE_WORDS.some(word => text.includes(word)) || text.includes('owes me') || text.includes('collect')) {
    const person = extractPersonCandidate(text)
    return person ? { person, amount, type: 'lent' } : null
  }

  if (LEDGER_RECEIVE_WORDS.some(word => text.includes(word)) || LEDGER_BORROW_WORDS.some(word => text.includes(word))) {
    const person = extractPersonCandidate(text)
    return person ? { person, amount, type: 'borrowed' } : null
  }

  return null
}

function detectIntent(text) {
  const amount = extractAmount(text)
  const category = findCategory(text)
  const hasPlannerAction = PLANNER_ACTION_WORDS.some(word => text.includes(word))
  const hasDateCue = Boolean(extractDate(text))
  const hasTimeCue = Boolean(extractTime(text))
  const hasLedgerCue = (
    LEDGER_GIVE_WORDS.some(word => text.includes(word)) ||
    LEDGER_RECEIVE_WORDS.some(word => text.includes(word)) ||
    LEDGER_BORROW_WORDS.some(word => text.includes(word)) ||
    text.includes('owes me') ||
    text.includes('collect')
  )

  if (hasLedgerCue && amount) return 'ledger'
  if ((hasPlannerAction && (hasDateCue || hasTimeCue)) || (hasPlannerAction && !amount)) return 'planner'
  if (text.includes('pay') && (hasDateCue || hasTimeCue)) return 'planner'
  if ((text.includes('buy') || text.includes('call') || text.includes('meeting')) && (hasDateCue || hasTimeCue)) return 'planner'
  if (amount && category) return 'expense'
  if (amount && !hasPlannerAction && !hasLedgerCue) return 'expense'
  if (hasPlannerAction || hasDateCue || hasTimeCue) return 'planner'
  return null
}

function parseExpense(text) {
  const amount = extractAmount(text)
  const category = findCategory(text) || 'Other'
  const note = text
    .replace(/\b(add|spent|expense|on|for|rupees|rupee)\b/g, ' ')
    .replace(new RegExp(`\\b${escapeRegExp(category.toLowerCase())}\\b`, 'g'), ' ')
    .replace(/\b\d+\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return {
    type: 'expense',
    data: {
      category,
      amount,
      note: note ? titleCase(note) : '',
    },
    error: amount ? null : 'No amount detected. Try: "food 200"',
  }
}

function parsePlanner(text) {
  const date = extractDate(text)
  const time = extractTime(text)
  const title = cleanupPlannerTitle(text)

  return {
    type: 'planner',
    data: {
      title,
      date,
      time,
    },
    error: null,
  }
}

export function parseVoiceCommand(rawText) {
  if (!rawText?.trim()) {
    return { type: null, data: {}, error: 'No speech detected. Please try again.' }
  }

  const normalizedText = normalizeSpeechText(rawText)
  const intent = detectIntent(normalizedText)

  if (intent === 'ledger') {
    const ledger = extractLedger(normalizedText)
    if (!ledger?.person || !ledger?.amount) {
      return {
        type: 'ledger',
        data: {
          person: ledger?.person || '',
          amount: ledger?.amount || extractAmount(normalizedText) || '',
          type: ledger?.type || 'lent',
        },
        error: 'Try: "gave Ravi 500" or "received from Mani 300"',
      }
    }

    return { type: 'ledger', data: ledger, error: null }
  }

  if (intent === 'planner') {
    return parsePlanner(normalizedText)
  }

  if (intent === 'expense') {
    return parseExpense(normalizedText)
  }

  const fallbackAmount = extractAmount(normalizedText)
  const fallbackCategory = findCategory(normalizedText)

  if (fallbackAmount || fallbackCategory) {
    return parseExpense(normalizedText)
  }

  return {
    type: null,
    data: {},
    error: 'Try: "food 200", "gave Ravi 500", or "meeting tomorrow at 5 pm"',
  }
}

export {
  normalizeSpeechText,
  extractAmount,
  detectIntent,
  extractLedger,
  extractDate,
  extractTime,
  cleanupPlannerTitle,
}
