// astroHelpers.js
// Shared data layer for all Astro pages.
// Doc ID: panchang/{date}_{location}_{lang}
// e.g. 2026-04-20_Chennai_en

import { db } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

export const LOCATIONS = ["Chennai", "Bangalore", "Kochi"];

export const LANGUAGES = [
  { code: "en", label: "English"  },
  { code: "hi", label: "हिंदी"    },
  { code: "ta", label: "தமிழ்"   },
  { code: "ml", label: "മലയാളം" },
];

export const LOCATION_META = {
  Chennai:   { emoji: "🌊", tagline: "Bay of Bengal" },
  Bangalore: { emoji: "🌿", tagline: "Garden City"   },
  Kochi:     { emoji: "⛵", tagline: "Arabian Sea"   },
};

const IST_OFFSET_MS = 5.5 * 3600000;

// ─── DATE ─────────────────────────────────────────────────────────────────────

export function getTodayIST() {
  const ist = new Date(Date.now() + IST_OFFSET_MS);
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth()+1).padStart(2,"0")}-${String(ist.getUTCDate()).padStart(2,"0")}`;
}

// ─── FIRESTORE ────────────────────────────────────────────────────────────────

export async function fetchAstroDoc(location, lang, date = null) {
  const targetDate = date || getTodayIST();
  const docId = `${targetDate}_${location}_${lang}`;
  try {
    const snap = await getDoc(doc(db, "panchang", docId));
    if (snap.exists()) return { success: true, data: snap.data(), docId };
    return { success: false, data: null, docId, error: "Document not found" };
  } catch (err) {
    console.error("[fetchAstroDoc]", err);
    return { success: false, data: null, docId, error: err.message };
  }
}

export async function getUserAstroPrefs(uid) {
  if (!uid) return { panchangLocation: "Chennai", panchangLanguage: "en" };
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (snap.exists()) {
      const d = snap.data();
      return {
        panchangLocation: d.panchangLocation || "Chennai",
        panchangLanguage: d.panchangLanguage || "en",
      };
    }
  } catch (err) { console.error("[getUserAstroPrefs]", err); }
  return { panchangLocation: "Chennai", panchangLanguage: "en" };
}

export async function saveUserAstroPrefs(uid, updates) {
  if (!uid) return;
  try {
    await setDoc(doc(db, "users", uid), updates, { merge: true });
  } catch (err) { console.error("[saveUserAstroPrefs]", err); }
}