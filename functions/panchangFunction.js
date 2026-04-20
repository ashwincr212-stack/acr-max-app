"use strict";

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onRequest } = require("firebase-functions/v2/https");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const axios = require("axios");

const VEDIC_API_KEY = defineSecret("VEDIC_ASTRO_API_KEY");
const ADMIN_SECRET = defineSecret("ADMIN_SECRET_KEY");

if (!getApps().length) {
  initializeApp();
}
const db = getFirestore();

const VEDIC_PANCHANG_API_BASE =
  "https://api.vedicastroapi.com/v3-json/panchang/panchang";

const VEDIC_FESTIVALS_API_BASE =
  "https://api.vedicastroapi.com/v3-json/panchang/festivals";

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

const LANGUAGES = {
  en: "English",
  hi: "Hindi",
  ta: "Tamil",
  ml: "Malayalam",
};

function getTodayIST() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset);
  const yyyy = ist.getUTCFullYear();
  const mm = String(ist.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(ist.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function safe(value) {
  if (value === undefined || value === null || value === "") return null;
  return String(value);
}

function num(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function buildApiDate(dateStr) {
  const [yyyy, mm, dd] = dateStr.split("-");
  return `${dd}/${mm}/${yyyy}`;
}

function getRequestParams(locationName, dateStr, lang, apiKey) {
  const { latitude, longitude, timezone } = LOCATIONS[locationName];
  return {
    api_key: apiKey,
    lat: Number(latitude),
    lon: Number(longitude),
    tz: Number(timezone),
    date: buildApiDate(dateStr),
    lang,
  };
}

async function fetchFromAPI(url, params, label) {
  logger.info(`[Astro] API fetch → ${label}`, params);

  let response;
  try {
    response = await axios.get(url, {
      params,
      timeout: 20000,
    });
  } catch (axiosErr) {
    const apiErrBody = axiosErr.response?.data;
    logger.error(
      `[Astro] axios error → ${label}:`,
      axiosErr.message,
      apiErrBody ? JSON.stringify(apiErrBody) : "(no response body)"
    );
    throw new Error(
      `HTTP error for ${label}: ${axiosErr.message}` +
        (apiErrBody ? ` | API body: ${JSON.stringify(apiErrBody)}` : "")
    );
  }

  const body = response.data;

  if (!body || body.status !== 200) {
    throw new Error(
      `API returned unexpected status for ${label}: ${JSON.stringify(body)}`
    );
  }

  return body.response;
}

async function fetchPanchangFromAPI(locationName, dateStr, lang, apiKey) {
  const params = getRequestParams(locationName, dateStr, lang, apiKey);
  return fetchFromAPI(
    VEDIC_PANCHANG_API_BASE,
    params,
    `Panchang | ${locationName} | ${dateStr} | ${lang}`
  );
}

async function fetchFestivalsFromAPI(locationName, dateStr, lang, apiKey) {
  const params = getRequestParams(locationName, dateStr, lang, apiKey);
  return fetchFromAPI(
    VEDIC_FESTIVALS_API_BASE,
    params,
    `Festivals | ${locationName} | ${dateStr} | ${lang}`
  );
}

function normalizeFestivalList(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => ({
      festival_name: safe(item?.festival_name),
      significance: safe(item?.significance),
      type: safe(item?.type),
    }))
    .filter((item) => item.festival_name);
}

function normalizeYogaList(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => ({
      yoga_name: safe(item?.yoga_name),
      significance: safe(item?.significance),
      day: safe(item?.day),
      type: safe(item?.type),
    }))
    .filter((item) => item.yoga_name);
}

function buildNormalizedPanchang(raw) {
  const adv = raw?.advanced_details || {};
  const masa = adv?.masa || {};
  const years = adv?.years || {};
  const tithi = raw?.tithi || {};
  const nakshatra = raw?.nakshatra || {};
  const yoga = raw?.yoga || {};
  const karana = raw?.karana || {};
  const abhijit = adv?.abhijit_muhurta || {};

  const abhijitStart = safe(abhijit?.start);
  const abhijitEnd = safe(abhijit?.end);

  return {
    sunrise: safe(adv?.sun_rise),
    sunset: safe(adv?.sun_set),
    moonrise: safe(adv?.moon_rise),
    moonset: safe(adv?.moon_set),

    rahuKalam: safe(raw?.rahukaal),
    yamagandam: safe(raw?.yamakanta),
    gulikaKalam: safe(raw?.gulika),
    abhijitMuhurta:
      abhijitStart && abhijitEnd
        ? `${abhijitStart} - ${abhijitEnd}`
        : abhijitStart || abhijitEnd || null,

    tithi: {
      name: safe(tithi?.name),
      number: num(tithi?.number),
      type: safe(tithi?.type),
      lord: safe(tithi?.lord),
      deity: safe(tithi?.deity || tithi?.diety),
      startTime: safe(tithi?.start),
      endTime: safe(tithi?.end),
      next: safe(tithi?.next_tithi),
      meaning: safe(tithi?.meaning),
      special: safe(tithi?.special),
      summary: safe(tithi?.summary),
    },

    nakshatra: {
      name: safe(nakshatra?.name),
      number: num(nakshatra?.number),
      pada: num(nakshatra?.pada),
      lord: safe(nakshatra?.lord),
      deity: safe(nakshatra?.deity || nakshatra?.diety),
      startTime: safe(nakshatra?.start),
      endTime: safe(nakshatra?.end),
      next: safe(nakshatra?.next_nakshatra),
      meaning: safe(nakshatra?.meaning),
      special: safe(nakshatra?.special),
      summary: safe(nakshatra?.summary),
      auspiciousDisha: Array.isArray(nakshatra?.auspicious_disha)
        ? nakshatra.auspicious_disha.map(String)
        : [],
    },

    yoga: {
      name: safe(yoga?.name),
      number: num(yoga?.number),
      lord: safe(yoga?.lord),
      startTime: safe(yoga?.start),
      endTime: safe(yoga?.end),
      next: safe(yoga?.next_yoga),
      meaning: safe(yoga?.meaning),
      special: safe(yoga?.special),
      summary: safe(yoga?.summary),
    },

    karana: {
      name: safe(karana?.name),
      number: num(karana?.number),
      type: safe(karana?.type),
      lord: safe(karana?.lord),
      deity: safe(karana?.deity || karana?.diety),
      startTime: safe(karana?.start),
      endTime: safe(karana?.end),
      next: safe(karana?.next_karana),
      meaning: safe(karana?.meaning),
      special: safe(karana?.special),
      summary: safe(karana?.summary),
    },

    varName: safe(adv?.vaara || raw?.day?.name || raw?.var_name),
    masaName: safe(masa?.amanta_name || raw?.masa_name),
    paksha: safe(masa?.paksha || raw?.paksha),
    samvat: safe(years?.vikram_samvaat_name || raw?.samvat_name),

    ayana: safe(masa?.ayana),
    ritu: safe(masa?.ritu),
    tamilMonth: safe(masa?.tamil_month),
    tamilDay: num(masa?.tamil_day),
    moonPhase: safe(masa?.moon_phase),

    rasi: safe(raw?.rasi?.name),

    ayanamsa: {
      name: safe(raw?.ayanamsa?.name),
      number: num(raw?.ayanamsa?.number),
    },

    sunPosition: {
      zodiac: safe(raw?.sun_position?.zodiac),
      nakshatra: safe(raw?.sun_position?.nakshatra),
      rasiNo: num(raw?.sun_position?.rasi_no),
      nakshatraNo: num(raw?.sun_position?.nakshatra_no),
      sunDegreeAtRise: num(raw?.sun_position?.sun_degree_at_rise),
    },

    moonPosition: {
      moonDegree: num(raw?.moon_position?.moon_degree),
    },

    nextFullMoon: safe(adv?.next_full_moon),
    nextNewMoon: safe(adv?.next_new_moon),
    dishaShool: safe(adv?.disha_shool),
    moonYoginiNivas: safe(adv?.moon_yogini_nivas),
    vaara: safe(adv?.vaara),

    masaDetails: {
      amantaNumber: num(masa?.amanta_number),
      amantaDate: num(masa?.amanta_date),
      amantaName: safe(masa?.amanta_name),
      alternateAmantaName: safe(masa?.alternate_amanta_name),
      amantaStart: safe(masa?.amanta_start),
      amantaEnd: safe(masa?.amanta_end),
      adhikMaasa:
        typeof masa?.adhik_maasa === "boolean" ? masa.adhik_maasa : null,
      ayana: safe(masa?.ayana),
      realAyana: safe(masa?.real_ayana),
      tamilMonthNum: num(masa?.tamil_month_num),
      tamilMonth: safe(masa?.tamil_month),
      tamilDay: num(masa?.tamil_day),
      purnimantaDate: num(masa?.purnimanta_date),
      purnimantaNumber: num(masa?.purnimanta_number),
      purnimantaName: safe(masa?.purnimanta_name),
      alternatePurnimantaName: safe(masa?.alternate_purnimanta_name),
      purnimantaStart: safe(masa?.purnimanta_start),
      purnimantaEnd: safe(masa?.purnimanta_end),
      moonPhase: safe(masa?.moon_phase),
      paksha: safe(masa?.paksha),
      ritu: safe(masa?.ritu),
      rituTamil: safe(masa?.ritu_tamil),
    },

    years: {
      kali: num(years?.kali),
      saka: num(years?.saka),
      vikramSamvaat: num(years?.vikram_samvaat),
      kaliSamvaatNumber: num(years?.kali_samvaat_number),
      kaliSamvaatName: safe(years?.kali_samvaat_name),
      vikramSamvaatNumber: num(years?.vikram_samvaat_number),
      vikramSamvaatName: safe(years?.vikram_samvaat_name),
      sakaSamvaatNumber: num(years?.saka_samvaat_number),
      sakaSamvaatName: safe(years?.saka_samvaat_name),
    },

    ahargana: num(adv?.ahargana),
    sourceDate: safe(raw?.date),
  };
}

function buildMergedDocument({
  locationName,
  dateStr,
  lang,
  rawPanchang,
  rawFestivals,
  normalized,
}) {
  const docId = `${dateStr}_${locationName}_${lang}`;

  return {
    docId,
    date: dateStr,
    location: locationName,
    lang,
    languageLabel: LANGUAGES[lang] || lang,

    normalized,

    festivals: normalizeFestivalList(rawFestivals?.festival_list),
    yogas: normalizeYogaList(rawFestivals?.yogas),

    rawPanchang,
    rawFestivals,

    fetchedAt: Timestamp.now(),
    source: "vedicastroapi",
  };
}

async function storeAstroData(data) {
  const docRef = db.collection("panchang").doc(data.docId);
  await docRef.set(data, { merge: true });
  logger.info(`[Astro] Stored → ${data.docId}`);
}

async function logError(date, location, lang, errorMessage) {
  try {
    await db.collection("panchang_errors").add({
      date,
      location,
      lang,
      error: errorMessage,
      timestamp: Timestamp.now(),
    });
  } catch (logErr) {
    logger.warn("[Astro] Failed to write error log:", logErr.message);
  }
}

async function processLocationLanguages(
  locationName,
  dateStr,
  targetLangs,
  apiKey,
  { skipExisting = false } = {}
) {
  const results = [];
  const langsToProcess = [];

  for (const lang of targetLangs) {
    const docId = `${dateStr}_${locationName}_${lang}`;

    if (skipExisting) {
      const existing = await db.collection("panchang").doc(docId).get();
      if (existing.exists) {
        logger.info(`[Astro] Already exists, skipping → ${docId}`);
        results.push({
          success: true,
          location: locationName,
          lang,
          docId,
          skipped: true,
        });
        continue;
      }
    }

    langsToProcess.push(lang);
  }

  if (!langsToProcess.length) return results;

  let rawEnglishPanchang;
  let normalized;

  try {
    rawEnglishPanchang = await fetchPanchangFromAPI(
      locationName,
      dateStr,
      "en",
      apiKey
    );
    normalized = buildNormalizedPanchang(rawEnglishPanchang);
  } catch (err) {
    const msg = err.message || String(err);
    logger.error(
      `[Astro] English normalization fetch failed → ${locationName} | ${dateStr}:`,
      msg
    );

    for (const lang of langsToProcess) {
      await logError(dateStr, locationName, lang, msg);
      results.push({
        success: false,
        location: locationName,
        lang,
        docId: `${dateStr}_${locationName}_${lang}`,
        error: msg,
      });
    }

    return results;
  }

  for (const lang of langsToProcess) {
    try {
      const rawPanchangPromise =
        lang === "en"
          ? Promise.resolve(rawEnglishPanchang)
          : fetchPanchangFromAPI(locationName, dateStr, lang, apiKey);

      const [rawPanchang, rawFestivals] = await Promise.all([
        rawPanchangPromise,
        fetchFestivalsFromAPI(locationName, dateStr, lang, apiKey),
      ]);

      const merged = buildMergedDocument({
        locationName,
        dateStr,
        lang,
        rawPanchang,
        rawFestivals,
        normalized,
      });

      await storeAstroData(merged);
      results.push({
        success: true,
        location: locationName,
        lang,
        docId: merged.docId,
      });
    } catch (err) {
      const msg = err.message || String(err);
      logger.error(
        `[Astro] Failed → ${locationName} | ${dateStr} | ${lang}:`,
        msg
      );
      await logError(dateStr, locationName, lang, msg);
      results.push({
        success: false,
        location: locationName,
        lang,
        docId: `${dateStr}_${locationName}_${lang}`,
        error: msg,
      });
    }
  }

  return results;
}

exports.fetchDailyPanchang = onSchedule(
  {
    schedule: "30 20 * * *",
    timeZone: "UTC",
    retryCount: 3,
    memory: "512MiB",
    timeoutSeconds: 300,
    secrets: [VEDIC_API_KEY],
  },
  async (_event) => {
    const dateStr = getTodayIST();
    const apiKey = VEDIC_API_KEY.value();

    logger.info(`[Astro] CRON started → date: ${dateStr}`);

    const summary = {
      date: dateStr,
      success: [],
      failed: [],
    };

    for (const locationName of Object.keys(LOCATIONS)) {
      const locationResults = await processLocationLanguages(
        locationName,
        dateStr,
        Object.keys(LANGUAGES),
        apiKey,
        { skipExisting: true }
      );

      for (const result of locationResults) {
        if (result.success) {
          summary.success.push({
            location: result.location,
            lang: result.lang,
            skipped: result.skipped || false,
          });
        } else {
          summary.failed.push({
            location: result.location,
            lang: result.lang,
            error: result.error,
          });
        }
      }
    }

    await db.collection("panchang_fetch_log").add({
      ...summary,
      timestamp: Timestamp.now(),
    });

    logger.info("[Astro] CRON complete →", summary);
  }
);

exports.manualFetchPanchang = onRequest(
  {
    memory: "512MiB",
    timeoutSeconds: 180,
    secrets: [VEDIC_API_KEY, ADMIN_SECRET],
  },
  async (req, res) => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed. Use POST." });
    }

    const adminKey = req.headers["x-admin-key"];
    if (!adminKey || adminKey !== ADMIN_SECRET.value()) {
      logger.warn("[Astro] Unauthorized manual trigger attempt");
      return res.status(401).json({ error: "Unauthorized." });
    }

    const { date, location, lang } = req.body || {};
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

    if (lang && !LANGUAGES[lang]) {
      return res.status(400).json({
        error: `Unknown lang: "${lang}". Valid values: ${Object.keys(LANGUAGES).join(", ")}.`,
      });
    }

    const targetLocations = location ? [location] : Object.keys(LOCATIONS);
    const targetLangs = lang ? [lang] : Object.keys(LANGUAGES);
    const apiKey = VEDIC_API_KEY.value();

    logger.info(
      `[Astro] Manual trigger → date: ${dateStr} | locations: ${targetLocations.join(", ")} | langs: ${targetLangs.join(", ")}`
    );

    const results = [];

    for (const locationName of targetLocations) {
      const locationResults = await processLocationLanguages(
        locationName,
        dateStr,
        targetLangs,
        apiKey
      );

      for (const result of locationResults) {
        results.push({
          location: result.location,
          lang: result.lang,
          docId: result.docId,
          ...(result.success
            ? { status: "success", skipped: result.skipped || false }
            : { status: "failed", error: result.error }),
        });
      }
    }

    const allSuccess = results.every((r) => r.status === "success");
    return res.status(allSuccess ? 200 : 207).json({ date: dateStr, results });
  }
);
