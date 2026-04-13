/* ACR MAX — Fact Engine
   Handles: fact selection, non-repetition, queue, daily limit */

const MAX_FACTS_PER_DAY = 15
const QUEUE_SIZE        = 3
export { MAX_FACTS_PER_DAY }

export const TODAY_STR = () => new Date().toISOString().slice(0, 10)

/* Build Unsplash URL with stable sig from fact id */
export const getFactImageUrl = (fact) => {
  const kw = [fact.category, ...(fact.keywords || [])].slice(0, 4).join(',')
  return `https://source.unsplash.com/800x600/?${encodeURIComponent(kw)}&sig=${fact.id}`
}

/* Fallback image pool by category */
const FALLBACK = {
  india:'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=600&q=80',
  science:'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=600&q=80',
  space:'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=600&q=80',
  ocean:'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=80',
  forest:'https://images.unsplash.com/photo-1448375240586-882707db888b?w=600&q=80',
  mars:'https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=600&q=80',
  moon:'https://images.unsplash.com/photo-1505506874110-6a7a69069a08?w=600&q=80',
  sun:'https://images.unsplash.com/photo-1490730141103-6cac27aaab94?w=600&q=80',
  food:'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=600&q=80',
  fruits:'https://images.unsplash.com/photo-1563746924237-f4471a2cee73?w=600&q=80',
  history:'https://images.unsplash.com/photo-1474540412665-1cdae210ae6b?w=600&q=80',
  default:'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80',
}
export const getFallbackImage = (cat) => FALLBACK[cat] || FALLBACK.default

/* Seeded shuffle — deterministic per user+date */
function seededShuffle(arr, seed) {
  const a = [...arr]
  let s = seed
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    const j = Math.abs(s) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/* Build today's fact queue for user */
export function buildFactQueue(allFacts, seenFacts, userId) {
  const today  = TODAY_STR()
  const seed   = today.replace(/-/g,'').split('').reduce((a,c)=>a+c.charCodeAt(0),0)
               + userId.split('').reduce((a,c)=>a+c.charCodeAt(0),0)

  const seenSet   = new Set(seenFacts)
  let available   = allFacts.filter(f => !seenSet.has(f.id))

  // If pool running low — include seen facts to pad
  if (available.length < MAX_FACTS_PER_DAY) {
    available = [...allFacts]
  }

  return seededShuffle(available, seed).slice(0, MAX_FACTS_PER_DAY)
}

/* Check daily limit */
export function checkDailyLimit(factsUsage) {
  const today = TODAY_STR()
  if (!factsUsage || factsUsage.date !== today) {
    return { count: 0, exhausted: false, isNewDay: true }
  }
  return {
    count:     factsUsage.count || 0,
    exhausted: (factsUsage.count || 0) >= MAX_FACTS_PER_DAY,
    isNewDay:  false,
  }
}

/* Preload next image for smooth UX */
export function preloadImage(url) {
  if (!url) return
  const img = new Image()
  img.src = url
}