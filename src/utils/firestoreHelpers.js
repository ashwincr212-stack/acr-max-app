/* ACR MAX — Firestore Helpers for Surprises + Language */
import { db } from '../firebase'
import { doc, getDoc, setDoc, arrayUnion, serverTimestamp } from 'firebase/firestore'

const TODAY_STR = () => new Date().toISOString().slice(0, 10)

/* ── Get user daily facts data ── */
export async function getUserFactsData(userId) {
  try {
    const snap = await getDoc(doc(db, 'userDailyFacts', userId))
    return snap.exists() ? snap.data() : {}
  } catch { return {} }
}

/* ── Mark fact as seen + increment daily count ── */
export async function recordFactSeen(userId, factId, currentCount) {
  try {
    await setDoc(doc(db, 'userDailyFacts', userId), {
      seenFacts:   arrayUnion(factId),
      factsUsage:  { date: TODAY_STR(), count: currentCount + 1 },
      updatedAt:   serverTimestamp(),
    }, { merge: true })
  } catch(e) { console.error('recordFactSeen:', e) }
}

/* ── Save scratch reward to Firestore ── */
export async function saveScratchReward(userId, reward) {
  try {
    await setDoc(doc(db, 'userDailyFacts', userId), {
      scratchReward:  reward,
      scratchClaimed: false,
    }, { merge: true })
  } catch(e) { console.error('saveScratchReward:', e) }
}

/* ── Claim scratch reward — atomic coin add ── */
export async function claimScratchReward(userId, reward) {
  try {
    const walletRef = doc(db, 'ipl_wallets', userId)
    const snap      = await getDoc(walletRef)
    const current   = snap.exists() ? (snap.data().coins || 500) : 500
    await setDoc(walletRef, { coins: current + reward }, { merge: true })
    await setDoc(doc(db, 'userDailyFacts', userId), { scratchClaimed: true }, { merge: true })
    return current + reward
  } catch(e) { console.error('claimScratchReward:', e); return null }
}

/* ── Save/restore session queue ── */
export async function saveSession(userId, queue, currentFactId) {
  try {
    await setDoc(doc(db, 'userDailyFacts', userId), {
      lastSession: { queue: queue.map(f=>f.id), currentFactId, savedAt: TODAY_STR() }
    }, { merge: true })
  } catch {}
}

/* ── Save user language preference ── */
export async function saveLanguage(userId, lang) {
  try {
    await setDoc(doc(db, 'acr_users', userId), { language: lang }, { merge: true })
  } catch(e) { console.error('saveLanguage:', e) }
}

/* ── Get user language ── */
export async function getUserLanguage(userId) {
  try {
    const snap = await getDoc(doc(db, 'acr_users', userId))
    return snap.exists() ? (snap.data().language || 'en') : 'en'
  } catch { return 'en' }
}