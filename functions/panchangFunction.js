/**
 * panchangFunction.js
 * Daily Panchang fetcher using Vedic Astro API
 * Firebase Functions v2 — defineSecret + axios
 */

"use strict";

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onRequest } = require("firebase-functions/v2/https");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const axios = require("axios");

// ── Secrets (NEVER use process.env) ─────────────────────────────────────────
const VEDIC_API_KEY = defineSecret("VEDIC_ASTRO_API_KEY");
const ADMIN_SECRET = defineSecret("ADMIN_SECRET_KEY");

// ── Firebase Admin init (safe: skip if already initialized by index.js) ──────
if (!getApps().length) {
  initializeApp();
}
const db = getFirestore();

// ── Constants ────────────────────────────────────────────────────────────────
const VEDIC_API_BASE =
  "https://api.vedicastroapi.com/v3-json/panchang/panchang";

const LOCATIONS = {
  Chennai: {
    latitude: 13.0827,
    longitude: 80.2707,
    timezone: 5.5,
  },
  Bangalore: {
    latitude: 12.9716,
    longitude: 77.5946,
    timezone: 5.5,
  },
  Kochi: {
    latitude: 9.9312,
    longitude: 76.2673,
    timezone: 5.5,
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns today's date string in IST as YYYY-MM-DD
 */
function getTodayIST() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset);
  const yyyy = ist.getUTCFullYear();
  const mm = String(ist.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(ist.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Safely extracts a string value — returns null instead of undefined.
 * Prevents "undefined" values from reaching Firestore.
 */
function safe(value) {
  if (value === undefined || value === null || value === "") return null;
  return String(value);
}

// ── Core Functions ───────────────────────────────────────────────────────────

/**
 * Fetches raw Panchang data from Vedic Astro API for a given location + date.
 *
 * @param {string} locationName  - Key from LOCATIONS (e.g. "Chennai")
 * @param {string} dateStr       - Date in YYYY-MM-DD format
 * @param {string} apiKey        - Live value from VEDIC_API_KEY.value()
 * @returns {Object}             - Raw API response.response object
 */
async function fetchPanchangFromAPI(locationName, dateStr, apiKey) {
  const { latitude, longitude, timezone } = LOCATIONS[locationName];
  const [yyyy, mm, dd] = dateStr.split("-");

  // API expects date as DD/MM/YYYY
  const apiDate = `${dd}/${mm}/${yyyy}`;

  const params = {
  api_key: apiKey,
  lat: Number(latitude),
  lon: Number(longitude),
  tz: Number(timezone),
  date: apiDate,
};

  logger.info(`[Panchang] Fetching API → ${locationName} | ${dateStr}`, {
    latitude,
    longitude,
    apiDate,
  });

  let response;
  try {
    response = await axios.get(VEDIC_API_BASE, {
      params,
      timeout: 15000,
    });
  } catch (axiosErr) {
    // Log full API error body when available (e.g. 4xx/5xx from VedicAstroAPI)
    const apiErrBody = axiosErr.response?.data;
    logger.error(
      `[Panchang] axios error for ${locationName}:`,
      axiosErr.message,
      apiErrBody ? JSON.stringify(apiErrBody) : "(no response body)"
    );
    throw new Error(
      `HTTP error for ${locationName}: ${axiosErr.message}` +
        (apiErrBody ? ` | API body: ${JSON.stringify(apiErrBody)}` : "")
    );
  }

  const body = response.data;

  if (!body || body.status !== 200) {
    throw new Error(
      `API returned unexpected status for ${locationName}: ${JSON.stringify(body)}`
    );
  }

  return body.response;
}

/**
 * Parses the raw API response into our clean Firestore schema.
 * All fields guaranteed to be string | null — no undefined values.
 *
 * @param {Object} raw           - response.response from API
 * @param {string} locationName  - e.g. "Chennai"
 * @param {string} dateStr       - YYYY-MM-DD
 * @returns {Object}             - Firestore-ready document
 */
function parseAPIResponse(raw, locationName, dateStr) {
  // VedicAstroAPI /panchang/panchang response shape:
  //   raw.advanced_details.sun_rise / sun_set / moon_rise / moon_set
  //   raw.tithi        → object (not array)  → .name
  //   raw.nakshatra    → object               → .name
  //   raw.yoga         → object               → .name
  //   raw.karana       → object               → .name
  //   raw.rahukaal     → string time range
  //   raw.gulika       → string time range
  //   raw.yamakanta    → string time range

  const adv = raw?.advanced_details || {};
  const tithi = raw?.tithi || {};
  const nakshatra = raw?.nakshatra || {};
  const yoga = raw?.yoga || {};
  const karana = raw?.karana || {};

  return {
    // ── Document keys
    docId: `${dateStr}_${locationName}`,
    date: dateStr,
    location: locationName,

    // ── Sun & Moon (from advanced_details)
    sunrise: safe(adv.sun_rise),
    sunset: safe(adv.sun_set),
    moonrise: safe(adv.moon_rise),
    moonset: safe(adv.moon_set),

    // ── Tithi
    tithi: {
      name: safe(tithi.name),
      lord: safe(tithi.lord),
      endTime: safe(tithi.end),
      special: safe(tithi.special),
      summary: safe(tithi.summary),
    },

    // ── Nakshatra
    nakshatra: {
      name: safe(nakshatra.name),
      lord: safe(nakshatra.lord),
      endTime: safe(nakshatra.end),
    },

    // ── Yoga
    yoga: {
      name: safe(yoga.name),
      lord: safe(yoga.lord),
      endTime: safe(yoga.end),
    },

    // ── Karana
    karana: {
      name: safe(karana.name),
      lord: safe(karana.lord),
      endTime: safe(karana.end),
    },

    // ── Inauspicious Times (exact field names from confirmed API response)
    rahuKalam: safe(raw.rahukaal),
    yamagandam: safe(raw.yamakanta),
    gulikaKalam: safe(raw.gulika),
    abhijitMuhurta: (() => {
      const a = adv?.abhijit_muhurta;
      const start = safe(a?.start);
      const end = safe(a?.end);
      if (!start && !end) return null;
      if (!end) return start;
      if (!start) return end;
      return `${start} - ${end}`;
    })(),

    // ── Calendar Context
    varName: safe(raw.var_name),
    masaName: safe(raw.masa_name),
    paksha: safe(raw.paksha),
    samvat: safe(raw.samvat_name),

    // ── Metadata
    fetchedAt: Timestamp.now(),
    source: "vedicastroapi",
  };
}

/**
 * Stores a parsed Panchang document in Firestore.
 * Uses merge: true for safe upsert — never overwrites unrelated fields.
 *
 * @param {Object} data - Parsed document from parseAPIResponse()
 */
async function storePanchang(data) {
  const docRef = db.collection("panchang").doc(data.docId);
  await docRef.set(data, { merge: true });
  logger.info(`[Panchang] Stored → ${data.docId}`);
}

/**
 * Logs a fetch error to Firestore for monitoring/alerting.
 *
 * @param {string} date
 * @param {string} location
 * @param {string} errorMessage
 */
async function logError(date, location, errorMessage) {
  try {
    await db.collection("panchang_errors").add({
      date,
      location,
      error: errorMessage,
      timestamp: Timestamp.now(),
    });
  } catch (logErr) {
    // Swallow — never let error logging crash the main function
    logger.warn("[Panchang] Failed to write error log:", logErr.message);
  }
}

/**
 * Orchestrates fetch → parse → store for one location.
 * Returns a result object — never throws.
 *
 * @param {string} locationName
 * @param {string} dateStr
 * @param {string} apiKey
 * @returns {{ success: boolean, error?: string }}
 */
async function processLocation(locationName, dateStr, apiKey) {
  try {
    const raw = await fetchPanchangFromAPI(locationName, dateStr, apiKey);
    const parsed = parseAPIResponse(raw, locationName, dateStr);
    await storePanchang(parsed);
    return { success: true };
  } catch (err) {
    const msg = err.message || String(err);
    logger.error(`[Panchang] Failed → ${locationName} | ${dateStr}:`, msg);
    await logError(dateStr, locationName, msg);
    return { success: false, error: msg };
  }
}

// ── Exported Cloud Functions ─────────────────────────────────────────────────

/**
 * fetchDailyPanchang
 *
 * CRON job — runs daily at 2:00 AM IST (20:30 UTC)
 * Fetches Panchang for Chennai, Bangalore, Kochi and stores in Firestore.
 * Skips any location where today's document already exists.
 */
exports.fetchDailyPanchang = onSchedule(
  {
    schedule: "30 20 * * *",
    timeZone: "UTC",
    retryCount: 3,
    memory: "256MiB",
    timeoutSeconds: 120,
    secrets: [VEDIC_API_KEY],
  },
  async (_event) => {
    const dateStr = getTodayIST();
    const apiKey = VEDIC_API_KEY.value();

    logger.info(`[Panchang] CRON started → date: ${dateStr}`);

    const summary = { date: dateStr, success: [], failed: [] };

    for (const locationName of Object.keys(LOCATIONS)) {
      // Idempotency check — skip if data already exists for today
      const docId = `${dateStr}_${locationName}`;
      const existing = await db.collection("panchang").doc(docId).get();

      if (existing.exists) {
        logger.info(`[Panchang] Already exists, skipping → ${docId}`);
        summary.success.push(locationName);
        continue;
      }

      const result = await processLocation(locationName, dateStr, apiKey);

      if (result.success) {
        summary.success.push(locationName);
      } else {
        summary.failed.push({ location: locationName, error: result.error });
      }
    }

    // Write run summary for monitoring dashboard
    await db.collection("panchang_fetch_log").add({
      ...summary,
      timestamp: Timestamp.now(),
    });

    logger.info("[Panchang] CRON complete →", summary);
  }
);

/**
 * manualFetchPanchang
 *
 * HTTP POST — admin-only manual trigger for backfilling or testing.
 *
 * Headers:
 *   x-admin-key: <ADMIN_SECRET value>
 *
 * Body (all optional):
 *   { "date": "YYYY-MM-DD", "location": "Chennai" }
 *
 * - Omit date     → uses today (IST)
 * - Omit location → processes all 3 cities
 * - Always re-fetches (ignores existing docs)
 *
 * Response 200: all succeeded
 * Response 207: partial success
 */
exports.manualFetchPanchang = onRequest(
  {
    memory: "256MiB",
    timeoutSeconds: 60,
    secrets: [VEDIC_API_KEY, ADMIN_SECRET],
  },
  async (req, res) => {
    // ── Method guard
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed. Use POST." });
    }

    // ── Admin auth check
    const adminKey = req.headers["x-admin-key"];
    if (!adminKey || adminKey !== ADMIN_SECRET.value()) {
      logger.warn("[Panchang] Unauthorized manual trigger attempt");
      return res.status(401).json({ error: "Unauthorized." });
    }

    // ── Parse + validate inputs
    const { date, location } = req.body || {};
    const dateStr = date || getTodayIST();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return res
        .status(400)
        .json({ error: "Invalid date format. Expected YYYY-MM-DD." });
    }

    if (location && !LOCATIONS[location]) {
      return res.status(400).json({
        error: `Unknown location: "${location}". Valid values: ${Object.keys(LOCATIONS).join(", ")}.`,
      });
    }

    const targets = location ? [location] : Object.keys(LOCATIONS);
    const apiKey = VEDIC_API_KEY.value();

    logger.info(
      `[Panchang] Manual trigger → date: ${dateStr} | locations: ${targets.join(", ")}`
    );

    const results = [];

    for (const locationName of targets) {
      const result = await processLocation(locationName, dateStr, apiKey);
      results.push({
        location: locationName,
        docId: `${dateStr}_${locationName}`,
        ...(result.success
          ? { status: "success" }
          : { status: "failed", error: result.error }),
      });
    }

    const allSuccess = results.every((r) => r.status === "success");

    return res.status(allSuccess ? 200 : 207).json({ date: dateStr, results });
  }
);