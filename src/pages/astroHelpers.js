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
export const EMPTY_TIME = "—";
const TIME_RE = /\b(\d{1,2})\s*:\s*(\d{2})(?:\s*:\s*(\d{2}))?\s*([APap])\.?\s*([Mm])\.?\b/;

// ─── DATE ─────────────────────────────────────────────────────────────────────

export function getTodayIST() {
  const ist = new Date(Date.now() + IST_OFFSET_MS);
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth()+1).padStart(2,"0")}-${String(ist.getUTCDate()).padStart(2,"0")}`;
}

function canonicalTimeFromParts(hourRaw, minuteRaw, merRaw) {
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return EMPTY_TIME;
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return EMPTY_TIME;
  return `${hour}:${String(minute).padStart(2, "0")} ${merRaw.toUpperCase()}`;
}

export function cleanTime(raw) {
  if (raw === null || raw === undefined) return EMPTY_TIME;
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase();
  }
  if (typeof raw !== "string" && typeof raw !== "number") return EMPTY_TIME;

  const trimmed = String(raw).trim();
  if (!trimmed) return EMPTY_TIME;

  const direct = trimmed.match(TIME_RE);
  if (direct) {
    return canonicalTimeFromParts(direct[1], direct[2], `${direct[4]}${direct[5]}`);
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase();
  }

  return EMPTY_TIME;
}

export function cleanRange(raw) {
  if (!raw || typeof raw !== "string") return "";
  const norm = raw
    .replace(/ÃƒÂ¢Ã¢â€šÂ¬[\u0093\u0094\u0095]/g, "-")
    .replace(/Ã¢â‚¬"|Ã¢â‚¬"|â€“|â€”|âˆ’/g, "-")
    .replace(/\s+to\s+/gi, " - ")
    .trim();

  const matches = [...norm.matchAll(new RegExp(TIME_RE.source, "gi"))];
  if (matches.length >= 2) {
    const s = canonicalTimeFromParts(matches[0][1], matches[0][2], `${matches[0][4]}${matches[0][5]}`);
    const e = canonicalTimeFromParts(matches[1][1], matches[1][2], `${matches[1][4]}${matches[1][5]}`);
    if (s !== EMPTY_TIME && e !== EMPTY_TIME) return `${s} - ${e}`;
  }

  const parts = norm.split(/\s+-\s+|\s*-\s*|\s+to\s+/i).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return "";
  const s = cleanTime(parts[0]);
  const e = cleanTime(parts[parts.length - 1]);
  if (s === EMPTY_TIME || e === EMPTY_TIME) return "";
  return `${s} - ${e}`;
}

export function normalizePanchangData(raw) {
  if (!raw || typeof raw !== "object") return null;

  const ct = (v) => cleanTime(v);
  const cr = (v) => cleanRange(v);

  const normalizeDetail = (obj) => {
    if (!obj || typeof obj !== "object") return null;
    return {
      name: obj.name || obj.Name || obj.title || "",
      lord: obj.lord || obj.Lord || obj.deity || "",
      endTime: ct(obj.endTime || obj.end_time || obj.EndTime || obj.ends || ""),
      special: obj.special || obj.Special || obj.note || "",
      summary: obj.summary || obj.Summary || obj.desc || "",
    };
  };

  return {
    sunrise: ct(raw.sunrise || raw.Sunrise || ""),
    sunset: ct(raw.sunset || raw.Sunset || ""),
    moonrise: ct(raw.moonrise || raw.Moonrise || ""),
    moonset: ct(raw.moonset || raw.Moonset || ""),
    rahuKalam: cr(raw.rahuKalam || raw.rahu_kalam || raw.rahukalam || ""),
    yamagandam: cr(raw.yamagandam || raw.yama_gandam || raw.Yamagandam || ""),
    gulikaKalam: cr(raw.gulikaKalam || raw.gulika_kalam || raw.gulikakalam || ""),
    abhijitMuhurta: cr(raw.abhijitMuhurta || raw.abhijit_muhurta || raw.abhijit || ""),
    tithi: normalizeDetail(raw.tithi || raw.Tithi),
    nakshatra: normalizeDetail(raw.nakshatra || raw.Nakshatra),
    yoga: normalizeDetail(raw.yoga || raw.Yoga),
    karana: normalizeDetail(raw.karana || raw.Karana),
    varName: raw.varName || raw.var_name || raw.dayName || "",
    masaName: raw.masaName || raw.masa_name || raw.masa || "",
    paksha: raw.paksha || raw.Paksha || "",
    samvat: raw.samvat || raw.Samvat || "",
  };
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
