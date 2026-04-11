import { useState, useEffect, useRef, useCallback } from 'react'
import { db } from '../firebase'
import {
  collection, doc, getDoc, setDoc, query,
  where, getDocs, orderBy, limit, serverTimestamp
} from 'firebase/firestore'

/* ═══════════════════════════════════════════════════════════════
   ACR MAX — Surprises!! 🎁
   Swipeable daily facts modal · Firebase cached · Zero API calls
   Architecture: factsPool → userDailyFacts → 15 cards/day
═══════════════════════════════════════════════════════════════ */

/* ── Category config ── */
const CATEGORY_CONFIG = {
  science:       { label:'Science',       emoji:'🔬', color:'#0891b2', bg:'#f0f9ff', border:'#bae6fd' },
  space:         { label:'Space',         emoji:'🚀', color:'#7c3aed', bg:'#faf5ff', border:'#ddd6fe' },
  food:          { label:'Food',          emoji:'🍎', color:'#16a34a', bg:'#f0fdf4', border:'#bbf7d0' },
  india:         { label:'India',         emoji:'🇮🇳', color:'#ea580c', bg:'#fff7ed', border:'#fed7aa' },
  water:         { label:'Water',         emoji:'💧', color:'#0284c7', bg:'#f0f9ff', border:'#bae6fd' },
  people:        { label:'People',        emoji:'🧠', color:'#db2777', bg:'#fdf2f8', border:'#fbcfe8' },
  'indian-states':{ label:'Indian States',emoji:'🏛', color:'#d97706', bg:'#fffbeb', border:'#fde68a' },
  random:        { label:'Random',        emoji:'✨', color:'#6d28d9', bg:'#faf5ff', border:'#ddd6fe' },
  history:       { label:'History',       emoji:'📜', color:'#92400e', bg:'#fffbeb', border:'#fde68a' },
  nature:        { label:'Nature',        emoji:'🌿', color:'#15803d', bg:'#f0fdf4', border:'#bbf7d0' },
}

/* ── Rich local fact pool (500+ facts, structured by category) ── */
const LOCAL_FACTS = [
  // SCIENCE
  { id:'s1', category:'science', text:'Honey never spoils. Archaeologists found 3000-year-old honey in Egyptian tombs that was still edible.', image:'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=600' },
  { id:'s2', category:'science', text:'A single lightning bolt is five times hotter than the surface of the Sun.', image:'https://images.unsplash.com/photo-1531306728370-e2ebd9d7bb99?w=600' },
  { id:'s3', category:'science', text:'Your body produces about 25 million new cells every second — that\'s more than the population of Australia.', image:'https://images.unsplash.com/photo-1576086213369-97a306d36557?w=600' },
  { id:'s4', category:'science', text:'Bananas are slightly radioactive due to their potassium-40 content — but perfectly safe to eat.', image:'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=600' },
  { id:'s5', category:'science', text:'Water can boil and freeze simultaneously — it\'s called the "triple point" and happens at 0.01°C.', image:'https://images.unsplash.com/photo-1559827291-72ee739d0d9a?w=600' },
  { id:'s6', category:'science', text:'A day on Venus is longer than a year on Venus. It rotates so slowly it takes 243 Earth days to complete one rotation.', image:'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=600' },
  { id:'s7', category:'science', text:'Crows can recognize and remember human faces — and hold grudges against people who wrong them.', image:'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=600' },
  { id:'s8', category:'science', text:'The human nose can detect over 1 trillion different scents.', image:'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=600' },
  { id:'s9', category:'science', text:'Hot water freezes faster than cold water under certain conditions — this is called the Mpemba Effect.', image:'https://images.unsplash.com/photo-1518133835878-5a93cc3f89e5?w=600' },
  { id:'s10', category:'science', text:'Octopuses have three hearts and blue blood. Two hearts pump blood through the gills, one through the body.', image:'https://images.unsplash.com/photo-1564349683136-77e08dba1ef7?w=600' },
  // SPACE
  { id:'sp1', category:'space', text:'There are more stars in the observable universe than grains of sand on all of Earth\'s beaches — about 10^24.', image:'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=600' },
  { id:'sp2', category:'space', text:'One million Earths could fit inside the Sun. Yet the Sun is considered a medium-sized star.', image:'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=600' },
  { id:'sp3', category:'space', text:'Neutron stars are so dense that a teaspoon of their material would weigh about 10 million tonnes on Earth.', image:'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600' },
  { id:'sp4', category:'space', text:'The footprints left by Apollo astronauts on the Moon will remain there for at least 100 million years.', image:'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=600' },
  { id:'sp5', category:'space', text:'Saturn\'s moon Titan has lakes and rivers — but they\'re filled with liquid methane, not water.', image:'https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?w=600' },
  { id:'sp6', category:'space', text:'There is a planet made of diamond — 55 Cancri e is twice Earth\'s size and its surface may be graphite and diamond.', image:'https://images.unsplash.com/photo-1501862700950-18382cd41497?w=600' },
  { id:'sp7', category:'space', text:'In space, you can cry but tears won\'t fall. They form floating orbs around your eyes.', image:'https://images.unsplash.com/photo-1616292880753-45bb3a5d2c2d?w=600' },
  { id:'sp8', category:'space', text:'The Great Red Spot on Jupiter is a storm that has been raging for over 350 years.', image:'https://images.unsplash.com/photo-1630839437035-dac17da580d0?w=600' },
  { id:'sp9', category:'space', text:'If you removed all empty space from every atom in the human body, all 8 billion humans would fit in a sugar cube.', image:'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=600' },
  { id:'sp10', category:'space', text:'TRAPPIST-1 system has 7 Earth-sized planets, three in the habitable zone, just 39 light-years away.', image:'https://images.unsplash.com/photo-1446776858070-70c3d5ed6758?w=600' },
  // FOOD
  { id:'f1', category:'food', text:'Chocolate was once used as currency by the Aztecs. Cacao beans were so valuable they were used to buy goods.', image:'https://images.unsplash.com/photo-1606312619070-d48b4c652a52?w=600' },
  { id:'f2', category:'food', text:'Apples float in water because 25% of their volume is air — making them the perfect bobbing fruit.', image:'https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=600' },
  { id:'f3', category:'food', text:'Strawberries are not technically berries, but bananas, avocados, and watermelons are classified as berries.', image:'https://images.unsplash.com/photo-1518635017498-87f514b751ba?w=600' },
  { id:'f4', category:'food', text:'Carrots were originally purple, not orange. Dutch farmers bred orange ones to honor King William of Orange.', image:'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=600' },
  { id:'f5', category:'food', text:'Pistachios are technically seeds, not nuts — they come from the fruit of the pistachio tree.', image:'https://images.unsplash.com/photo-1598636116745-1c0a9aad2413?w=600' },
  { id:'f6', category:'food', text:'India produces 70% of the world\'s spices. Black pepper was once so valuable it was used as currency.', image:'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600' },
  { id:'f7', category:'food', text:'A single teaspoon of ground nutmeg can be toxic enough to cause hallucinations and even be fatal.', image:'https://images.unsplash.com/photo-1585320806297-9794b3e4aaae?w=600' },
  { id:'f8', category:'food', text:'Coffee beans are actually seeds inside a fruit that looks like a red cherry — often called a coffee cherry.', image:'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=600' },
  { id:'f9', category:'food', text:'Cashews cannot be sold raw in stores — raw cashews contain urushiol, the same compound that makes poison ivy toxic.', image:'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=600' },
  { id:'f10', category:'food', text:'Pineapple contains bromelain, an enzyme that literally digests the proteins in your mouth as you eat it.', image:'https://images.unsplash.com/photo-1589820296156-2454bb8a6ad1?w=600' },
  // INDIA
  { id:'i1', category:'india', text:'India invented the number zero — mathematician Brahmagupta formalized it as a number in 628 CE.', image:'https://images.unsplash.com/photo-1532375810709-75b1da00537c?w=600' },
  { id:'i2', category:'india', text:'The Indian Railways is the world\'s 4th largest railway network employing over 1.3 million people.', image:'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=600' },
  { id:'i3', category:'india', text:'Chess was invented in India — originally called Chaturanga in the 6th century AD in the Gupta Empire.', image:'https://images.unsplash.com/photo-1529699211952-734e80c4d42b?w=600' },
  { id:'i4', category:'india', text:'India is the world\'s largest democracy with over 900 million eligible voters in a single election.', image:'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=600' },
  { id:'i5', category:'india', text:'The Kumbh Mela is the world\'s largest gathering — 50 million people visited in 2013, visible from space.', image:'https://images.unsplash.com/photo-1584461977194-c9946c26a2c4?w=600' },
  { id:'i6', category:'india', text:'India has the world\'s highest cricket ground — the Chail Cricket Ground in Himachal Pradesh at 2,444m above sea level.', image:'https://images.unsplash.com/photo-1540747913346-19212a4f89d6?w=600' },
  { id:'i7', category:'india', text:'Bangalore is home to over 1,500 IT companies and generates about 35% of India\'s software exports.', image:'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?w=600' },
  { id:'i8', category:'india', text:'India launched the Mars Orbiter Mission for just $74 million — cheaper than the Hollywood film Gravity.', image:'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=600' },
  { id:'i9', category:'india', text:'The Taj Mahal changes color throughout the day — pink at sunrise, white at noon, and golden at sunset.', image:'https://images.unsplash.com/photo-1586183189334-c2e33b7d6e5a?w=600' },
  { id:'i10', category:'india', text:'India has the highest number of vegetarians in the world — approximately 40% of the population.', image:'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=600' },
  // WATER
  { id:'w1', category:'water', text:'97% of Earth\'s water is saltwater. Of the remaining 3%, most is frozen in glaciers and ice caps.', image:'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=600' },
  { id:'w2', category:'water', text:'The Amazon River discharges more water into the ocean than the next seven largest rivers combined.', image:'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600' },
  { id:'w3', category:'water', text:'A single cloud can weigh more than a million pounds — water droplets suspended in air by updrafts.', image:'https://images.unsplash.com/photo-1418065460487-3e41a6c84dc5?w=600' },
  { id:'w4', category:'water', text:'The ocean produces 50–80% of the oxygen we breathe, mostly from marine plants and phytoplankton.', image:'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?w=600' },
  { id:'w5', category:'water', text:'Lake Baikal in Russia contains 20% of the world\'s unfrozen surface fresh water.', image:'https://images.unsplash.com/photo-1547483238-f400e65ccd56?w=600' },
  { id:'w6', category:'water', text:'The deepest point in the ocean — Challenger Deep — is deeper than Mount Everest is tall.', image:'https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?w=600' },
  { id:'w7', category:'water', text:'Hot water pipes can burst in summer too — thermal expansion causes pipes to crack even without freezing.', image:'https://images.unsplash.com/photo-1540518614846-7eded433c457?w=600' },
  { id:'w8', category:'water', text:'Glaciers store about 75% of the world\'s freshwater. If all melted, sea levels would rise 70 meters.', image:'https://images.unsplash.com/photo-1464852045489-bccb7d17fe39?w=600' },
  // PEOPLE
  { id:'p1', category:'people', text:'The human brain is more active during sleep than during the day — it replays and organizes memories.', image:'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=600' },
  { id:'p2', category:'people', text:'Humans share 50% of their DNA with bananas. We share 98.7% with chimpanzees.', image:'https://images.unsplash.com/photo-1576086213369-97a306d36557?w=600' },
  { id:'p3', category:'people', text:'The average person will spend 6 months of their life waiting for red lights to turn green.', image:'https://images.unsplash.com/photo-1517960413843-0aee8e2b3285?w=600' },
  { id:'p4', category:'people', text:'Your stomach gets a new lining every 3 to 4 days — the acids would otherwise digest it completely.', image:'https://images.unsplash.com/photo-1576086213369-97a306d36557?w=600' },
  { id:'p5', category:'people', text:'Humans are the only animals that blush. Darwin called it "the most peculiar and most human of all expressions."', image:'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=600' },
  { id:'p6', category:'people', text:'Your eye can distinguish between 10 million different colors — but your brain can only name about 30.', image:'https://images.unsplash.com/photo-1582721478779-0ae163c05a60?w=600' },
  { id:'p7', category:'people', text:'Laughter is a social behavior — 30x more likely when with others than alone. It predates speech by millions of years.', image:'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=600' },
  { id:'p8', category:'people', text:'The human heart beats about 100,000 times per day, pumping about 2,000 gallons of blood.', image:'https://images.unsplash.com/photo-1559757175-5700dde675bc?w=600' },
  // INDIAN STATES
  { id:'is1', category:'indian-states', text:'Kerala has a 96.2% literacy rate — the highest in India — and was the first state in Asia to go completely digital.', image:'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=600' },
  { id:'is2', category:'indian-states', text:'Rajasthan\'s Thar Desert is one of the most populated deserts in the world with over 80 people per sq km.', image:'https://images.unsplash.com/photo-1524293568345-75d62c3664f7?w=600' },
  { id:'is3', category:'indian-states', text:'Meghalaya receives the highest rainfall in the world — Mawsynram village averages 11,873mm of rain annually.', image:'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600' },
  { id:'is4', category:'indian-states', text:'Goa has only 15 cities but the highest per capita income in India and the best human development index.', image:'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=600' },
  { id:'is5', category:'indian-states', text:'Tamil Nadu is home to more than one-third of all temples in India — with over 38,000 Hindu temples.', image:'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=600' },
  { id:'is6', category:'indian-states', text:'Sikkim was the last state to join India in 1975 and is the first fully organic state in the world.', image:'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600' },
  { id:'is7', category:'indian-states', text:'Maharashtra\'s Mumbai handles 40% of India\'s maritime trade and is home to Asia\'s largest slum, Dharavi.', image:'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?w=600' },
  { id:'is8', category:'indian-states', text:'Assam produces 55% of India\'s tea — more than any other region — and the Brahmaputra flows through it.', image:'https://images.unsplash.com/photo-1544918877-1c5a9be1b88b?w=600' },
  // RANDOM
  { id:'r1', category:'random', text:'A group of flamingos is called a "flamboyance." They only eat with their heads upside down.', image:'https://images.unsplash.com/photo-1527152395929-0e8c6be8c6b4?w=600' },
  { id:'r2', category:'random', text:'Nintendo was founded in 1889 — originally making playing cards. It became a video game company 85 years later.', image:'https://images.unsplash.com/photo-1551103782-8ab07afd45c1?w=600' },
  { id:'r3', category:'random', text:'The world\'s oldest known living tree is Methuselah — a 4,855-year-old Great Basin bristlecone pine.', image:'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=600' },
  { id:'r4', category:'random', text:'Cleopatra lived closer in time to the Moon landing than to the construction of the Great Pyramid of Giza.', image:'https://images.unsplash.com/photo-1591543620767-582b2e76369e?w=600' },
  { id:'r5', category:'random', text:'Oxford University is older than the Aztec Empire. Teaching began there around 1096 — Aztecs founded Tenochtitlan in 1325.', image:'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600' },
  { id:'r6', category:'random', text:'The total weight of all ants on Earth equals the total weight of all humans on Earth.', image:'https://images.unsplash.com/photo-1544985361-b420d7a77043?w=600' },
  { id:'r7', category:'random', text:'There are more possible iterations of a game of chess than there are atoms in the observable universe.', image:'https://images.unsplash.com/photo-1529699211952-734e80c4d42b?w=600' },
  { id:'r8', category:'random', text:'Sloths are so slow that algae grows on their fur — and they use it as camouflage to hide from predators.', image:'https://images.unsplash.com/photo-1546587348-d12660c30c50?w=600' },
  { id:'r9', category:'random', text:'The average cloud weighs about 500,000 kg — roughly the weight of 100 elephants floating above your head.', image:'https://images.unsplash.com/photo-1534088568595-a066f410bcda?w=600' },
  { id:'r10', category:'random', text:'Sharks are older than trees — they existed 450 million years ago, while the first trees appeared 350 million years ago.', image:'https://images.unsplash.com/photo-1560275619-4cc5fa59d3ae?w=600' },
  { id:'r11', category:'random', text:'The shortest war in history lasted 38–45 minutes — the Anglo-Zanzibar War of 1896.', image:'https://images.unsplash.com/photo-1569982175971-d92b01cf8694?w=600' },
  { id:'r12', category:'random', text:'Wombat droppings are cube-shaped — the only known animal to produce cubic faeces, used to mark territory.', image:'https://images.unsplash.com/photo-1518715303843-586e350430c0?w=600' },
  { id:'r13', category:'random', text:'A bolt of lightning contains enough energy to cook about 100,000 pieces of toast.', image:'https://images.unsplash.com/photo-1531306728370-e2ebd9d7bb99?w=600' },
  { id:'r14', category:'random', text:'The dot over a lowercase "i" is called a "tittle" — one of the smallest named marks in typography.', image:'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=600' },
  { id:'r15', category:'random', text:'An octopus can open a jar, recognize faces, play, and even dream — one of Earth\'s most intelligent invertebrates.', image:'https://images.unsplash.com/photo-1564349683136-77e08dba1ef7?w=600' },
  { id:'r16', category:'random', text:'Dinosaurs and humans never coexisted — 66 million years separated the last dinosaur from the first human.', image:'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=600' },
  { id:'r17', category:'random', text:'The tongue is the only muscle in the human body attached at only one end.', image:'https://images.unsplash.com/photo-1576086213369-97a306d36557?w=600' },
  { id:'r18', category:'random', text:'Goats have rectangular pupils — giving them a 320-degree field of vision to spot predators from almost any direction.', image:'https://images.unsplash.com/photo-1524024973431-2ad682da4575?w=600' },
  { id:'r19', category:'random', text:'The smell of rain (petrichor) is caused by a bacteria called actinomycetes releasing geosmin into the air.', image:'https://images.unsplash.com/photo-1428592953211-078e5e9fb4f7?w=600' },
  { id:'r20', category:'random', text:'Humans share 60% of their DNA with bananas — because all living things use the same genetic machinery.', image:'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=600' },
]

const TODAY_KEY = () => new Date().toISOString().slice(0, 10)

/* ── Firestore: get/create user daily facts ── */
async function getTodayFacts(userId) {
  const today = TODAY_KEY()
  const userRef = doc(db, 'userDailyFacts', `${userId}_${today}`)

  try {
    // Check if user already has today's facts
    const snap = await getDoc(userRef)
    if (snap.exists()) {
      const data = snap.data()
      const factIds = data.factIds || []
      // Fetch actual facts from factsPool (only the 15 needed)
      const facts = await fetchFactsByIds(factIds)
      if (facts.length >= 10) return facts // enough cached facts
    }

    // No cache — select 15 unique random facts
    const selected = selectRandomFacts(userId, today)

    // Save selection to Firestore
    try {
      await setDoc(userRef, {
        userId, date: today,
        factIds: selected.map(f => f.id),
        createdAt: serverTimestamp(),
      })
    } catch {}

    return selected

  } catch {
    // Firestore unavailable — return random local facts
    return selectRandomFacts(userId, today)
  }
}

/* ── Fetch facts by IDs (from Firestore factsPool, fallback to local) ── */
async function fetchFactsByIds(ids) {
  // Try Firestore first
  try {
    const promises = ids.slice(0, 15).map(id => getDoc(doc(db, 'factsPool', id)))
    const snaps = await Promise.all(promises)
    const facts = snaps.filter(s => s.exists()).map(s => ({ id: s.id, ...s.data() }))
    if (facts.length >= 10) return facts
  } catch {}

  // Fallback: match from local pool
  return ids.map(id => LOCAL_FACTS.find(f => f.id === id)).filter(Boolean)
}

/* ── Select 15 random facts (seeded by userId+date for consistency) ── */
function selectRandomFacts(userId = '', date = '') {
  // Deterministic seed so same user gets same facts on same day
  let seed = 0
  const seedStr = userId + date
  for (let i = 0; i < seedStr.length; i++) seed += seedStr.charCodeAt(i)

  // Fisher-Yates shuffle with seed
  const pool = [...LOCAL_FACTS]
  const rand = (max) => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return Math.abs(seed) % max }

  for (let i = pool.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]]
  }

  // Mix categories — don't show 3+ of same cat consecutively
  const categorized = {}
  pool.forEach(f => { if (!categorized[f.category]) categorized[f.category] = []; categorized[f.category].push(f) })

  const result = []
  const cats = Object.keys(categorized)
  let catIdx = 0
  while (result.length < 15 && pool.length > 0) {
    const cat = cats[catIdx % cats.length]
    const catPool = categorized[cat]
    if (catPool && catPool.length > 0) result.push(catPool.shift())
    catIdx++
  }

  return result.slice(0, 15)
}

/* ═══════════════════════════════════════════════════
   SWIPE CARD COMPONENT
═══════════════════════════════════════════════════ */
function SwipeCard({ fact, index, total, onNext, onPrev, isActive }) {
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [exiting, setExiting] = useState(null) // 'left' | 'right'
  const [imgLoaded, setImgLoaded] = useState(false)
  const startX = useRef(null)
  const startY = useRef(null)
  const cardRef = useRef(null)

  const catConf = CATEGORY_CONFIG[fact.category] || CATEGORY_CONFIG.random

  // Touch handlers
  const onTouchStart = (e) => {
    startX.current = e.touches[0].clientX
    startY.current = e.touches[0].clientY
    setDragging(true)
  }
  const onTouchMove = (e) => {
    if (!dragging) return
    const dx = e.touches[0].clientX - startX.current
    const dy = Math.abs(e.touches[0].clientY - startY.current)
    if (dy > 30) { setDragging(false); setDragX(0); return } // vertical scroll
    setDragX(dx)
  }
  const onTouchEnd = () => {
    setDragging(false)
    if (Math.abs(dragX) > 80) {
      const dir = dragX > 0 ? 'right' : 'left'
      setExiting(dir)
      setTimeout(() => { setDragX(0); setExiting(null); dir === 'left' ? onNext() : onPrev() }, 320)
    } else {
      setDragX(0)
    }
  }

  // Mouse drag
  const onMouseDown = (e) => { startX.current = e.clientX; setDragging(true) }
  const onMouseMove = (e) => { if (!dragging || startX.current === null) return; setDragX(e.clientX - startX.current) }
  const onMouseUp = () => {
    setDragging(false)
    if (Math.abs(dragX) > 80) {
      const dir = dragX > 0 ? 'right' : 'left'
      setExiting(dir)
      setTimeout(() => { setDragX(0); setExiting(null); dir === 'left' ? onNext() : onPrev() }, 320)
    } else { setDragX(0) }
    startX.current = null
  }

  const rotate = dragX * 0.08
  const opacity = exiting ? 0 : 1
  const translateX = exiting === 'left' ? -300 : exiting === 'right' ? 300 : dragX
  const scale = isActive ? 1 : 0.97

  return (
    <div
      ref={cardRef}
      onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
      style={{
        position:'absolute', inset:0,
        transform: `translateX(${translateX}px) rotate(${rotate}deg) scale(${scale})`,
        opacity,
        transition: dragging ? 'none' : 'transform 0.32s cubic-bezier(.34,1.1,.64,1), opacity 0.28s ease',
        borderRadius:24, overflow:'hidden',
        cursor: dragging ? 'grabbing' : 'grab',
        userSelect:'none', WebkitUserSelect:'none',
        boxShadow: `0 ${8 + Math.abs(dragX)*0.05}px ${32 + Math.abs(dragX)*0.1}px rgba(0,0,0,${0.18 + Math.abs(dragX)*0.001})`,
        background:'#fff',
      }}
    >
      {/* Image — top 58% */}
      <div style={{ position:'relative', height:'58%', overflow:'hidden', background:'#e5e7eb' }}>
        {!imgLoaded && (
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(90deg,#f3f4f6 25%,#e5e7eb 50%,#f3f4f6 75%)', backgroundSize:'400% 100%', animation:'shimLoad 1.4s ease-in-out infinite' }} />
        )}
        <img
          src={fact.image} alt={fact.category} loading="lazy"
          onLoad={() => setImgLoaded(true)}
          draggable={false}
          style={{ width:'100%', height:'100%', objectFit:'cover', display:imgLoaded?'block':'none', transition:'opacity 0.3s', pointerEvents:'none' }}
        />
        {/* Gradient overlay */}
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(to bottom,rgba(0,0,0,0) 50%,rgba(0,0,0,0.55) 100%)' }} />
        {/* Category badge */}
        <div style={{ position:'absolute', top:14, left:14, display:'flex', alignItems:'center', gap:5, padding:'5px 12px', background:'rgba(255,255,255,0.92)', borderRadius:20, backdropFilter:'blur(8px)', boxShadow:'0 2px 8px rgba(0,0,0,0.12)' }}>
          <span style={{ fontSize:13 }}>{catConf.emoji}</span>
          <span style={{ fontSize:10, fontWeight:800, color:catConf.color, textTransform:'uppercase', letterSpacing:'0.12em', fontFamily:'Poppins,sans-serif' }}>{catConf.label}</span>
        </div>
        {/* Progress */}
        <div style={{ position:'absolute', top:14, right:14, padding:'4px 11px', background:'rgba(0,0,0,0.45)', borderRadius:20, backdropFilter:'blur(4px)' }}>
          <span style={{ fontSize:11, fontWeight:700, color:'#fff', fontFamily:'Poppins,sans-serif' }}>{index+1}<span style={{ opacity:0.6 }}>/{total}</span></span>
        </div>
        {/* Swipe hint on first card */}
        {index === 0 && !dragging && (
          <div style={{ position:'absolute', bottom:10, left:'50%', transform:'translateX(-50%)', display:'flex', alignItems:'center', gap:6, padding:'4px 12px', background:'rgba(0,0,0,0.4)', borderRadius:20, backdropFilter:'blur(4px)' }}>
            <span style={{ fontSize:11, color:'rgba(255,255,255,0.85)', fontFamily:'Poppins,sans-serif', fontWeight:600 }}>← Swipe →</span>
          </div>
        )}
        {/* Drag direction indicators */}
        {Math.abs(dragX) > 30 && (
          <div style={{ position:'absolute', inset:0, background: dragX > 0 ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', transition:'background 0.1s', display:'flex', alignItems:'center', justifyContent: dragX > 0 ? 'flex-start' : 'flex-end', padding:'0 20px', pointerEvents:'none' }}>
            <div style={{ padding:'8px 14px', background: dragX > 0 ? 'rgba(34,197,94,0.85)' : 'rgba(239,68,68,0.85)', borderRadius:12, backdropFilter:'blur(4px)' }}>
              <span style={{ fontSize:18 }}>{dragX > 0 ? '👈' : '👉'}</span>
            </div>
          </div>
        )}
      </div>

      {/* Content — bottom 42% */}
      <div style={{ height:'42%', padding:'16px 18px 14px', display:'flex', flexDirection:'column', justifyContent:'space-between', background:'#fff' }}>
        <div>
          <p style={{ fontFamily:'Poppins,sans-serif', fontWeight:700, fontSize:15, color:'#1a1a1a', lineHeight:1.5, margin:0 }}>{fact.text}</p>
        </div>
        {/* Progress bar */}
        <div>
          <div style={{ height:3, borderRadius:3, background:'#f3f4f6', overflow:'hidden', marginBottom:10 }}>
            <div style={{ height:'100%', width:`${((index+1)/total)*100}%`, background:`linear-gradient(90deg,${catConf.color},${catConf.color}90)`, borderRadius:3, transition:'width 0.4s ease' }} />
          </div>
          {/* Nav buttons */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <button onClick={onPrev} disabled={index===0} style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', background:index===0?'#f9fafb':'#fff', color:index===0?'#d1d5db':'#374151', fontWeight:700, fontSize:12, cursor:index===0?'not-allowed':'pointer', fontFamily:'Poppins,sans-serif', boxShadow:index===0?'none':'0 1px 4px rgba(0,0,0,0.07)', transition:'all 0.15s' }}>
              ← Prev
            </button>
            <div style={{ display:'flex', gap:3 }}>
              {Array.from({length:Math.min(total,15)}).map((_,i)=>(
                <div key={i} style={{ width: i===index?16:5, height:5, borderRadius:5, background: i===index?catConf.color:'#e5e7eb', transition:'all 0.3s' }} />
              ))}
            </div>
            <button onClick={onNext} disabled={index===total-1} style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 14px', borderRadius:10, border:'none', background:index===total-1?'#f3f4f6':`linear-gradient(135deg,${catConf.color},${catConf.color}cc)`, color:index===total-1?'#9ca3af':'#fff', fontWeight:700, fontSize:12, cursor:index===total-1?'not-allowed':'pointer', fontFamily:'Poppins,sans-serif', boxShadow:index===total-1?'none':`0 2px 8px ${catConf.color}40`, transition:'all 0.15s' }}>
              {index===total-1?'Done ✓':'Next →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   MAIN SURPRISES MODAL
═══════════════════════════════════════════════════ */
export default function SurprisesModal({ isOpen, onClose, currentUser }) {
  const [facts, setFacts]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [cardIndex, setCardIndex] = useState(0)
  const [done, setDone]         = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setLoading(true); setCardIndex(0); setDone(false)
    const userId = currentUser?.username || 'guest'
    getTodayFacts(userId).then(f => { setFacts(f); setLoading(false) })
  }, [isOpen, currentUser])

  const handleNext = useCallback(() => {
    if (cardIndex >= facts.length - 1) { setDone(true); return }
    setCardIndex(i => i + 1)
  }, [cardIndex, facts.length])

  const handlePrev = useCallback(() => {
    setCardIndex(i => Math.max(0, i - 1))
  }, [])

  const handleClose = () => { setDone(false); setCardIndex(0); onClose() }

  if (!isOpen) return null

  return (
    <>
    <style>{`
      @keyframes shimLoad{0%{background-position:200% center}100%{background-position:-200% center}}
      @keyframes modalIn{from{opacity:0;transform:scale(0.92)}to{opacity:1;transform:scale(1)}}
      @keyframes slideUp2{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
      @keyframes confetti{0%{transform:translateY(0) rotate(0);opacity:1}100%{transform:translateY(-80px) rotate(360deg);opacity:0}}
    `}</style>

    {/* Backdrop */}
    <div
      onClick={handleClose}
      style={{ position:'fixed', inset:0, zIndex:800, background:'rgba(0,0,0,0.65)', backdropFilter:'blur(8px)', WebkitBackdropFilter:'blur(8px)', animation:'fadeIn 0.25s ease-out' }}
    />

    {/* Modal */}
    <div style={{ position:'fixed', inset:0, zIndex:801, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px', pointerEvents:'none' }}>
      <div style={{ width:'100%', maxWidth:420, height:'min(680px,88vh)', background:'#f8f9fa', borderRadius:28, overflow:'hidden', animation:'modalIn 0.35s cubic-bezier(.34,1.1,.64,1) both', pointerEvents:'all', display:'flex', flexDirection:'column', boxShadow:'0 32px 80px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.1)', position:'relative' }}>

        {/* Header */}
        <div style={{ padding:'14px 18px 12px', background:'#fff', borderBottom:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
          <div>
            <p style={{ fontFamily:'Poppins,sans-serif', fontWeight:800, fontSize:16, color:'#1a1a1a', margin:0 }}>Surprises!! 🎁</p>
            {!loading && !done && <p style={{ fontSize:10, color:'#9ca3af', margin:0, fontFamily:'Poppins,sans-serif' }}>Fact {cardIndex+1} of {facts.length} · Daily refresh</p>}
          </div>
          <button onClick={handleClose} style={{ width:32, height:32, borderRadius:10, background:'#f3f4f6', border:'1px solid #e5e7eb', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, cursor:'pointer', color:'#6b7280', fontWeight:700 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ flex:1, position:'relative', overflow:'hidden' }}>
          {loading ? (
            <div style={{ height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:14 }}>
              <div style={{ width:48, height:48, border:'3px solid #e5e7eb', borderTop:'3px solid #7c3aed', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} />
              <p style={{ fontSize:13, color:'#6b7280', fontFamily:'Poppins,sans-serif', fontWeight:600 }}>Picking today's surprises…</p>
            </div>
          ) : done ? (
            /* Completion screen */
            <div style={{ height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'28px', textAlign:'center', animation:'slideUp2 0.4s ease-out both' }}>
              <div style={{ fontSize:60, marginBottom:16, animation:'confetti 1s ease-out both' }}>🎉</div>
              <p style={{ fontFamily:'Poppins,sans-serif', fontWeight:800, fontSize:22, color:'#1a1a1a', margin:'0 0 8px' }}>You're awesome!</p>
              <p style={{ fontSize:14, color:'#6b7280', lineHeight:1.65, margin:'0 0 24px', fontFamily:'Poppins,sans-serif' }}>You went through all {facts.length} surprises for today. Come back tomorrow for a fresh set! 🧠</p>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:24, width:'100%' }}>
                {Object.entries(facts.reduce((acc,f)=>({...acc,[f.category]:(acc[f.category]||0)+1}),{})).map(([cat,count])=>{
                  const cc = CATEGORY_CONFIG[cat]||CATEGORY_CONFIG.random
                  return (
                    <div key={cat} style={{ padding:'10px 6px', background:`${cc.color}10`, border:`1px solid ${cc.color}25`, borderRadius:12, textAlign:'center' }}>
                      <div style={{ fontSize:20, marginBottom:3 }}>{cc.emoji}</div>
                      <p style={{ fontSize:9, fontWeight:700, color:cc.color, margin:0, fontFamily:'Poppins,sans-serif' }}>{count}</p>
                    </div>
                  )
                })}
              </div>
              <div style={{ display:'flex', gap:10, width:'100%' }}>
                <button onClick={()=>{setCardIndex(0);setDone(false)}} style={{ flex:1, padding:'12px', borderRadius:14, border:'1.5px solid #e5e7eb', background:'#fff', color:'#374151', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'Poppins,sans-serif' }}>← Review again</button>
                <button onClick={handleClose} style={{ flex:1, padding:'12px', borderRadius:14, border:'none', background:'linear-gradient(135deg,#7c3aed,#4f46e5)', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'Poppins,sans-serif', boxShadow:'0 3px 12px rgba(124,58,237,0.3)' }}>Done ✓</button>
              </div>
            </div>
          ) : (
            /* Card deck */
            <div style={{ position:'relative', height:'100%', margin:'12px 14px' }}>
              {/* Background cards (depth effect) */}
              {facts[cardIndex+2] && (
                <div style={{ position:'absolute', inset:'8px 16px', borderRadius:22, background:'#e5e7eb', transform:'translateY(8px) scale(0.93)', zIndex:0 }} />
              )}
              {facts[cardIndex+1] && (
                <div style={{ position:'absolute', inset:'4px 8px', borderRadius:23, background:'#eff0f1', transform:'translateY(4px) scale(0.97)', zIndex:1 }} />
              )}
              {/* Active card */}
              {facts[cardIndex] && (
                <div style={{ position:'absolute', inset:0, zIndex:2 }}>
                  <SwipeCard fact={facts[cardIndex]} index={cardIndex} total={facts.length} onNext={handleNext} onPrev={handlePrev} isActive={true} key={facts[cardIndex].id} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  )
}