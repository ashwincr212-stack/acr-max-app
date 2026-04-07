import { initializeApp } from 'firebase/app'
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore'

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)

/* ── USER AUTH ─────────────────────────────────────────────────────────────── */
export async function registerUser(userData) {
  const ref = doc(db, 'acr_users', userData.username.toLowerCase())
  const existing = await getDoc(ref)
  if (existing.exists()) throw new Error('Username already taken')
  await setDoc(ref, {
    ...userData,
    username: userData.username.toLowerCase(),
    createdAt: serverTimestamp(),
  })
  return userData
}

export async function loginUser(username, password) {
  const ref = doc(db, 'acr_users', username.toLowerCase())
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('User not found')
  const user = snap.data()
  if (user.password !== password) throw new Error('Invalid password')
  return user
}

export async function usernameExists(username) {
  const ref = doc(db, 'acr_users', username.toLowerCase())
  const snap = await getDoc(ref)
  return snap.exists()
}

export async function getUserByUsername(username) {
  const ref = doc(db, 'acr_users', username.toLowerCase())
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return snap.data()
}

export async function updatePassword(username, newPassword) {
  const ref = doc(db, 'acr_users', username.toLowerCase())
  await setDoc(ref, { password: newPassword }, { merge: true })
}

export async function ensureAdminExists() {
  try {
    const ref = doc(db, 'acr_users', 'aswin')
    const snap = await getDoc(ref)
    if (!snap.exists()) {
      await setDoc(ref, {
        username: 'aswin',
        password: 'acr2026',
        name: 'Aswin CR',
        role: 'Admin',
        dob: '',
        email: 'aswin@acrmax.in',
        hint_q: 'What city were you born in?',
        hint_a: 'bengaluru',
        createdAt: serverTimestamp(),
      })
    }
  } catch (e) {
    console.log('Admin setup:', e.message)
  }
}

/* ── EXPENSE SYNC ──────────────────────────────────────────────────────────── */

// Clean log objects so Firestore can store them (no undefined values)
function sanitizeLogs(logs) {
  return logs.map(log => ({
    id:       log.id       || Date.now(),
    category: log.category || 'Other',
    amount:   Number(log.amount) || 0,
    time:     log.time     || '',
    color:    log.color    || '#6B7280',
    note:     log.note     || '',
    tags:     Array.isArray(log.tags) ? log.tags : [],
  }))
}

// Save all expenses to Firestore
export async function saveUserLogs(username, logs) {
  try {
    const ref = doc(db, 'acr_expenses', username.toLowerCase())
    await setDoc(ref, {
      logs: sanitizeLogs(logs),
      updatedAt: serverTimestamp(),
    })
    console.log('[Sync] Saved', logs.length, 'logs to Firestore')
  } catch (e) {
    console.error('[Sync] Save error:', e.message)
  }
}

// One-time load of expenses from Firestore
export async function loadUserLogs(username) {
  try {
    const ref = doc(db, 'acr_expenses', username.toLowerCase())
    const snap = await getDoc(ref)
    if (snap.exists()) return snap.data().logs || []
    return []
  } catch (e) {
    console.error('[Sync] Load error:', e.message)
    return []
  }
}

// Real-time listener — fires every time data changes on ANY device
export function subscribeUserLogs(username, callback) {
  const ref = doc(db, 'acr_expenses', username.toLowerCase())
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        const logs = snap.data().logs || []
        console.log('[Sync] Received', logs.length, 'logs from Firestore')
        callback(logs)
      } else {
        callback([])
      }
    },
    (error) => {
      console.error('[Sync] Listener error:', error.message)
    }
  )
}