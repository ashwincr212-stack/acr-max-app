const CATEGORY_ALIASES = {
  Food: [
    'food', 'eating', 'lunch', 'dinner', 'breakfast', 'snacks', 'snack',
    'tea', 'coffee', 'tiffin', 'meals', 'meal', 'khana', 'khaana', 'saapadu',
    'saapad', 'chaya', 'chai',
  ],
  Petrol: [
    'petrol', 'petro', 'petral', 'fuel', 'diesel', 'bunk',
  ],
  Smoke: [
    'smoke', 'smoking', 'cigarette', 'cigaret', 'cigratte', 'cigarettes', 'beedi', 'bidi',
  ],
  Liquor: [
    'liquor', 'alcohol', 'likkar', 'beer', 'drinks', 'drink', 'sarakku', 'kallu', 'bar expense', 'bar',
  ],
  'Electricity Bill': [
    'electricity bill', 'current bill', 'eb bill', 'eb', 'light bill', 'power bill', 'current charge', 'electricity',
  ],
  'Water Bill': [
    'water bill', 'water charge', 'water payment', 'water',
  ],
  'Mobile Recharge': [
    'mobile recharge', 'phone recharge', 'prepaid recharge', 'top up', 'recharge amount', 'recharge',
  ],
  Groceries: [
    'groceries', 'grocery', 'grosary', 'ration', 'provisions', 'shop items',
    'supermarket', 'vegetables', 'household items',
  ],
  'Hotel Food': [
    'hotel food', 'restaurant', 'outside food', 'eating out', 'parcel food',
    'swiggy', 'zomato', 'takeaway', 'hotel expense', 'hotel meal',
  ],
  CSD: ['csd'],
  Other: ['other', 'misc', 'miscellaneous', 'general', 'random expense', 'random'],
}

const FILLER_WORDS = new Set([
  'please', 'okay', 'ok', 'ah', 'uh', 'um', 'bro', 'bhai', 'yaar', 'anna', 'dei', 'da',
  'macha', 'chetta', 'chechi', 'mwone', 'aliya', 'just', 'actually', 'add', 'enter', 'note',
  'put', 'save',
])

const DIRECTION_WORDS = {
  lent: [
    'gave', 'give', 'given', 'gave to', 'lend', 'lent', 'loaned', 'diya', 'koduthu', 'koduthen', 'kuduthen',
  ],
  received: [
    'received', 'receive', 'recieve', 'received from', 'got', 'collected', 'collect', 'mila', 'gave me',
  ],
  borrowed: [
    'borrowed', 'borrow', 'took', 'liya', 'vangi', 'vangi', 'vanginen', 'borrowed from',
  ],
  owesMe: [
    'owes me', 'has to give me', 'should give me', 'tharanam', 'tharanu',
  ],
}

const PLANNER_KEYWORDS = [
  'call', 'meeting', 'appointment', 'pay', 'buy', 'remind', 'medicine',
  'visit', 'pickup', 'drop', 'task', 'school', 'doctor',
]

const FUTURE_WORDS = [
  'today', 'aaj', 'inniku', 'innu', 'tomorrow', 'kal', 'nalaiku', 'naale',
  'tonight', 'aaj raat', 'inniku night', 'morning', 'subah', 'kaalai', 'ravile',
  'afternoon', 'dopahar', 'uchakku', 'evening', 'shaam', 'maalai', 'vaikunneram',
  'night', 'raat', 'raathri',
]

const WEEKDAY_ALIASES = {
  sunday: ['sunday'],
  monday: ['monday'],
  tuesday: ['tuesday'],
  wednesday: ['wednesday'],
  thursday: ['thursday'],
  friday: ['friday'],
  saturday: ['saturday'],
}

const DAY_PARTS = {
  morning: ['morning', 'subah', 'kaalai', 'ravile'],
  afternoon: ['afternoon', 'dopahar', 'uchakku'],
  evening: ['evening', 'shaam', 'maalai', 'vaikunneram'],
  night: ['night', 'raat', 'raathri', 'tonight'],
}

const DAY_PART_DEFAULT_TIME = {
  morning: '09:00',
  afternoon: '15:00',
  evening: '18:00',
  night: '20:00',
}

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

const PERSON_STOP_WORDS = new Set([
  'i', 'me', 'my', 'to', 'from', 'for', 'on', 'at', 'the', 'a', 'an', 'ko', 'ku', 'se', 'kitte',
  'ninnu', 'inu', 'inuu', 'from', 'money', 'paisa', 'rupees', 'rupee', 'gave', 'give', 'given',
  'received', 'receive', 'got', 'borrowed', 'borrow', 'collect', 'collected', 'has', 'should',
  'owe', 'owes', 'lent', 'lend', 'loaned', 'diya', 'liya', 'koduthu', 'kuduthen', 'vangi',
  'tomorrow', 'today', 'tonight', 'morning', 'evening', 'night', 'subah', 'shaam', 'raat',
])

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function titleCase(value = '') {
  return value
    .split(' ')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function formatDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getNextWeekday(target) {
  const now = new Date()
  const value = new Date(now)
  const delta = (target - now.getDay() + 7) % 7 || 7
  value.setDate(now.getDate() + delta)
  return value
}

function replacePhrase(text, from, to) {
  return text.replace(new RegExp(`\\b${escapeRegExp(from)}\\b`, 'g'), to)
}

function normalizeIndianVariants(text) {
  const replacements = [
    ['p.m', 'pm'],
    ['a.m', 'am'],
    ['tmrw', 'tomorrow'],
    ['tomoro', 'tomorrow'],
    ['aaj raat', 'tonight'],
    ['inniku night', 'tonight'],
    ['nalaiku', 'tomorrow'],
    ['naale', 'tomorrow'],
    ['innu', 'today'],
    ['inniku', 'today'],
    ['re charge', 'recharge'],
    ['phone recharge', 'mobile recharge'],
    ['prepaid recharge', 'mobile recharge'],
    ['top up', 'mobile recharge'],
    ['current bill', 'electricity bill'],
    ['eb bill', 'electricity bill'],
    ['light bill', 'electricity bill'],
    ['power bill', 'electricity bill'],
    ['current charge', 'electricity bill'],
    ['water charge', 'water bill'],
    ['water payment', 'water bill'],
    ['outside food', 'hotel food'],
    ['eating out', 'hotel food'],
    ['parcel food', 'hotel food'],
    ['hotel meal', 'hotel food'],
    ['petro', 'petrol'],
    ['petral', 'petrol'],
    ['fuel expense', 'petrol'],
    ['shop items', 'groceries'],
    ['household items', 'groceries'],
    ['grosary', 'groceries'],
    ['cigaret', 'cigarette'],
    ['cigratte', 'cigarette'],
    ['smoke expense', 'smoke'],
    ['likkar', 'liquor'],
    ['bar expense', 'liquor'],
    ['gave to', 'gave'],
    ['received from', 'received from'],
    ['got from', 'received from'],
    ['gave me', 'gave me'],
    ['has to give me', 'owes me'],
    ['should give me', 'owes me'],
    ['borrowed from', 'borrowed from'],
    ['raviinu', 'ravi ko'],
    ['innu evening', 'today evening'],
    ['kaalai', 'morning'],
    ['ravile', 'morning'],
    ['uchakku', 'afternoon'],
    ['maalai', 'evening'],
    ['vaikunneram', 'evening'],
    ['raathri', 'night'],
    ['doctor appointment', 'doctor appointment'],
  ]

  return replacements.reduce((value, [from, to]) => replacePhrase(value, from, to), text)
}

function normalizeSpeechText(rawText = '') {
  let text = rawText.toLowerCase().trim()
  text = normalizeIndianVariants(text)
  text = text.replace(/[.,!?;:()[\]{}-]+/g, ' ')
  text = text.replace(/\s+/g, ' ').trim()

  const words = []
  for (const word of text.split(' ').filter(Boolean)) {
    if (FILLER_WORDS.has(word)) continue
    if (words[words.length - 1] === word) continue
    words.push(word)
  }

  return words.join(' ')
}

function normalizeNumberWords(text) {
  return text.replace(/\b(\d{1,2})\s+baje\b/g, '$1')
}

function findCategory(text) {
  for (const [category, aliases] of Object.entries(CATEGORY_ALIASES)) {
    if (aliases.some(alias => text.includes(alias))) return category
  }
  return null
}

function parseSimpleNumberTokens(tokens) {
  let total = 0
  let current = 0
  let matched = 0

  for (const token of tokens) {
    if (!(token in NUMBER_WORDS)) break
    matched += 1
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

  return matched ? { value: total + current, matched } : null
}

function parseColloquialNumberTokens(tokens) {
  const first = tokens[0]
  const second = tokens[1]
  if (!(first in NUMBER_WORDS) || !(second in NUMBER_WORDS)) return null

  const firstValue = NUMBER_WORDS[first]
  const secondValue = NUMBER_WORDS[second]
  if (firstValue < 1 || firstValue > 9) return null
  if (secondValue % 10 !== 0 && secondValue > 19) return null

  return { value: firstValue * 100 + secondValue, matched: 2 }
}

function extractAmount(text) {
  const digitMatch = text.match(/\b\d+(?:\.\d+)?\b/)
  if (digitMatch) return Number(digitMatch[0])

  const tokens = normalizeNumberWords(text).split(' ').filter(Boolean)
  let best = null

  for (let index = 0; index < tokens.length; index += 1) {
    const segment = tokens.slice(index, index + 6)
    const simple = parseSimpleNumberTokens(segment)
    const colloquial = parseColloquialNumberTokens(segment)
    const candidate = simple || colloquial
    if (candidate?.value) {
      best = candidate.value
      break
    }
  }

  return best
}

function hasAny(text, phrases) {
  return phrases.some(phrase => text.includes(phrase))
}

function detectIntent(text) {
  const amount = extractAmount(text)
  const category = findCategory(text)
  const hasLedger = (
    hasAny(text, DIRECTION_WORDS.lent) ||
    hasAny(text, DIRECTION_WORDS.received) ||
    hasAny(text, DIRECTION_WORDS.borrowed) ||
    hasAny(text, DIRECTION_WORDS.owesMe) ||
    text.includes(' ko ') ||
    text.includes(' se ')
  )
  const hasPlannerAction = hasAny(text, PLANNER_KEYWORDS)
  const hasFutureCue = hasAny(text, FUTURE_WORDS) || Object.values(WEEKDAY_ALIASES).some(list => hasAny(text, list))

  if (hasLedger && amount) return 'ledger'
  if ((hasPlannerAction && hasFutureCue) || (text.includes('pay') && hasFutureCue) || (text.includes('call') && hasFutureCue)) return 'planner'
  if (hasPlannerAction && !amount) return 'planner'
  if (amount && category && !hasPlannerAction) return 'expense'
  if (amount && category && !hasFutureCue) return 'expense'
  if (hasFutureCue && (hasPlannerAction || !amount)) return 'planner'
  if (amount) return 'expense'
  return null
}

function normalizePersonName(value = '') {
  const cleaned = value
    .split(' ')
    .filter(Boolean)
    .filter(word => !PERSON_STOP_WORDS.has(word))
    .filter(word => !/^\d+$/.test(word))
    .filter(word => !(word in NUMBER_WORDS))
    .slice(0, 2)
    .join(' ')

  return titleCase(cleaned)
}

function extractLedgerPerson(text, amount) {
  const patterns = [
    /\b(?:gave|give|given|lend|lent|loaned)\s+([a-z]+)\s+\d+/,
    /\b([a-z]+)\s+ko\s+\d+\s+diya\b/,
    /\breceived from\s+([a-z]+)\s+\d+/,
    /\b(?:got|collect|collected)\s+\d+\s+from\s+([a-z]+)\b/,
    /\b([a-z]+)\s+gave me\s+\d+/,
    /\b([a-z]+)\s+owes me\s+\d+/,
    /\bborrowed\s+\d+\s+from\s+([a-z]+)\b/,
    /\bborrowed from\s+([a-z]+)\s+\d+/,
    /\b([a-z]+)\s+se\s+\d+\s+liya\b/,
    /\b([a-z]+)\s+mujhe\s+\d+\s+diya\b/,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) return normalizePersonName(match[1])
  }

  const raw = text.replace(String(amount || ''), ' ')
  return normalizePersonName(raw)
}

function parseLedger(text) {
  const amount = extractAmount(text)
  const person = extractLedgerPerson(text, amount)

  let type = ''
  if (hasAny(text, DIRECTION_WORDS.owesMe) || hasAny(text, ['collect']) || hasAny(text, DIRECTION_WORDS.lent) || /\b[a-z]+\s+ko\s+\d+\s+diya\b/.test(text)) {
    type = 'lent'
  } else if (hasAny(text, DIRECTION_WORDS.borrowed) || hasAny(text, DIRECTION_WORDS.received) || /\b[a-z]+\s+se\s+\d+\s+liya\b/.test(text)) {
    type = 'borrowed'
  }

  return {
    type: 'ledger',
    data: {
      person,
      amount,
      type: type || 'lent',
    },
    error: person && amount ? null : 'Try: "gave Ravi 500" or "received from Mani 300"',
  }
}

function normalizeCategory(text) {
  return findCategory(text) || 'Other'
}

function buildExpenseNote(text, category, amount) {
  let note = text
    .replace(/\b(spent|expense|rupees|rupee|amount)\b/g, ' ')
    .replace(new RegExp(`\\b${escapeRegExp(String(amount || ''))}\\b`, 'g'), ' ')

  for (const alias of CATEGORY_ALIASES[category] || []) {
    note = note.replace(new RegExp(`\\b${escapeRegExp(alias)}\\b`, 'g'), ' ')
  }

  note = note.replace(/\s+/g, ' ').trim()
  return note ? titleCase(note) : ''
}

function parseExpense(text) {
  const amount = extractAmount(text)
  const category = normalizeCategory(text)

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

function extractDate(text) {
  const now = new Date()

  if (hasAny(text, ['tomorrow', 'kal'])) {
    const value = new Date(now)
    value.setDate(now.getDate() + 1)
    return formatDate(value)
  }

  if (hasAny(text, ['today', 'aaj'])) return formatDate(now)

  for (const [weekday, aliases] of Object.entries(WEEKDAY_ALIASES)) {
    if (hasAny(text, aliases)) {
      return formatDate(getNextWeekday(['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(weekday)))
    }
  }

  return ''
}

function detectDayPart(text) {
  for (const [part, aliases] of Object.entries(DAY_PARTS)) {
    if (hasAny(text, aliases)) return part
  }
  return ''
}

function extractTime(text) {
  const explicit = text.match(/\b(?:at\s+)?(\d{1,2})(?:[: ](\d{2}))?\s*(am|pm)?\b/)
  if (explicit) {
    let hour = Number(explicit[1])
    const minute = Number(explicit[2] || 0)
    const meridiem = explicit[3]?.toLowerCase() || ''
    const dayPart = detectDayPart(text)

    if (meridiem === 'pm' && hour < 12) hour += 12
    if (meridiem === 'am' && hour === 12) hour = 0
    if (!meridiem && (dayPart === 'evening' || dayPart === 'night') && hour < 12) hour += 12

    if (hour <= 23 && minute <= 59) {
      return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    }
  }

  const dayPart = detectDayPart(text)
  return dayPart ? DAY_PART_DEFAULT_TIME[dayPart] : ''
}

function cleanupPlannerTitle(text) {
  let title = text
    .replace(/\b(remind me to|remind me|remind|task|schedule|today|tomorrow|kal|aaj|morning|subah|evening|shaam|night|raat)\b/g, ' ')
    .replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/g, ' ')
    .replace(/\b(at\s+)?\d{1,2}(?:[: ]\d{2})?\s*(am|pm)?\b/g, ' ')
    .replace(/\bkarna\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  title = title
    .replace(/\bko\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return title ? titleCase(title) : 'Task'
}

function parsePlanner(text) {
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

  const amount = extractAmount(normalizedText)
  const category = normalizeCategory(normalizedText)
  if (amount || category !== 'Other') {
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
  normalizeIndianVariants,
  normalizeNumberWords,
  detectIntent,
  extractAmount,
  parseExpense,
  parseLedger,
  parsePlanner,
  cleanupPlannerTitle,
  normalizeCategory,
  normalizePersonName,
}
