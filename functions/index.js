/**
 * ACR MAX — IPL Cricket Cloud Functions (Sportmonks)
 * FIXED: refreshIPL now actually fetches real data immediately
 * 
 * Deploy:
 *   firebase functions:secrets:set SPORTMONKS_API_TOKEN
 *   firebase deploy --only functions
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onRequest }  = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const axios = require("axios");

initializeApp();
const db = getFirestore();

/* ── Config ── */
const BASE_URL      = "https://cricket.sportmonks.com/api/v2.0";
const IPL_SEASON_ID = 1795; // Indian Premier League — confirmed from API tester
const IPL_LEAGUE_ID = 1;    // Indian Premier League league ID
const SPORTMONKS_TOKEN = defineSecret("SPORTMONKS_API_TOKEN");
// API_TOKEN resolved at runtime inside each function via SPORTMONKS_TOKEN.value()

// api instance created per-request so token is resolved at runtime
function makeApi() {
  return axios.create({
    baseURL: BASE_URL,
    timeout: 15000,
    params:  { api_token: SPORTMONKS_TOKEN.value() },
  });
}

/* ── Team name normalizer ── */
const TEAM_MAP = {
  "Mumbai Indians":              "Mumbai Indians",
  "Chennai Super Kings":         "Chennai Super Kings",
  "Royal Challengers Bengaluru": "Royal Challengers Bangalore",
  "Royal Challengers Bangalore": "Royal Challengers Bangalore",
  "Kolkata Knight Riders":       "Kolkata Knight Riders",
  "Rajasthan Royals":            "Rajasthan Royals",
  "Delhi Capitals":              "Delhi Capitals",
  "Lucknow Super Giants":        "Lucknow Super Giants",
  "Gujarat Titans":              "Gujarat Titans",
  "Punjab Kings":                "Punjab Kings",
  "Sunrisers Hyderabad":         "Sunrisers Hyderabad",
};
function normalizeTeamName(raw = "") {
  return TEAM_MAP[raw] || raw || "TBD";
}

/* ── Format UTC → IST time string ── */
function formatIST(utcString) {
  if (!utcString) return "TBD";
  try {
    return new Date(utcString).toLocaleTimeString("en-IN", {
      hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata",
    });
  } catch { return "TBD"; }
}

/* ── Day label for upcoming matches ── */
function dayLabel(utcString) {
  try {
    const diff = Math.round((new Date(utcString) - new Date()) / 86400000);
    if (diff === 0)  return "Today";
    if (diff === 1)  return "Tomorrow";
    if (diff > 1)    return `In ${diff} days`;
    return new Date(utcString).toLocaleDateString("en-IN", { day:"numeric", month:"short", timeZone:"Asia/Kolkata" });
  } catch { return ""; }
}

/* ── Normalize Sportmonks fixture → our schema ── */
function normalizeMatch(m) {
  const status     = (m.status || "").toLowerCase();
  const isLive     = status === "live" || status === "ld" || status === "in progress";
  const isFinished = status === "finished" || status === "completed" || status === "result";

  const runs = m.runs || [];
  const score = (teamId) => {
    const inn = runs.filter(r => r.team_id === teamId);
    if (!inn.length) return null;
    return `${inn[0].score || 0}/${inn[0].wickets || 0} (${inn[0].overs || 0})`;
  };

  return {
    id:     String(m.id),
    team1:  normalizeTeamName(m.localteam?.name),
    team2:  normalizeTeamName(m.visitorteam?.name),
    time:   formatIST(m.starting_at),
    venue:  m.venue?.name || "TBD",
    date:   m.starting_at ? m.starting_at.slice(0, 10) : "",
    status: isLive ? "live" : isFinished ? "completed" : "upcoming",
    score1: score(m.localteam_id)   || null,
    score2: score(m.visitorteam_id) || null,
    result: isFinished ? (m.note || null) : null,
  };
}

/* ═══════════════════════════════════════════════════════════
   CORE LOGIC — standalone async functions
   Called by BOTH scheduled functions AND the HTTP trigger
═══════════════════════════════════════════════════════════ */

async function runFetchMatches() {
  console.log("[IPL] runFetchMatches — fetching from Sportmonks");
  if (!SPORTMONKS_TOKEN.value()) throw new Error("SPORTMONKS_API_TOKEN not set");

  const api = makeApi();
  const res = await api.get("/fixtures", {
    params: {
      "filter[season_id]": IPL_SEASON_ID,
      include: "localteam,visitorteam,venue,runs",
      per_page: 100,
    },
  });

  const all = res.data?.data || [];
  console.log(`[IPL] ${all.length} fixtures received`);

  const todayIST = new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
  const today = [], upcoming = [], results = [];

  all.forEach(m => {
    const norm = normalizeMatch(m);
    if (norm.status === "completed") {
      results.push(norm);
    } else if (norm.date === todayIST || norm.status === "live") {
      today.push(norm);
    } else if (norm.date > todayIST) {
      upcoming.push({ ...norm, dayLabel: dayLabel(m.starting_at) });
    }
  });

  today.sort((a, b)    => a.time.localeCompare(b.time));
  upcoming.sort((a, b) => a.date.localeCompare(b.date));
  results.sort((a, b)  => b.date.localeCompare(a.date));

  await db.collection("ipl_data").doc("matches").set({
    today,
    upcoming: upcoming.slice(0, 10),
    results:  results.slice(0, 20),
    live:     today.filter(m => m.status === "live"),
    updatedAt: FieldValue.serverTimestamp(),
  });

  const summary = { today: today.length, upcoming: upcoming.length, results: results.length };
  console.log("[IPL] Matches saved:", summary);
  return summary;
}

async function runFetchLeaderboard() {
  console.log("[IPL] runFetchLeaderboard — fetching from Sportmonks");
  if (!SPORTMONKS_TOKEN.value()) throw new Error("SPORTMONKS_API_TOKEN not set");

  const api = makeApi();
  let points = [], orange_cap = null, purple_cap = null;

  /* ── Points Table — try multiple endpoint patterns ── */
  const standingsEndpoints = [
    `/seasons/${IPL_SEASON_ID}?include=standings`,
    `/standings?filter[season_id]=${IPL_SEASON_ID}&include=team`,
    `/standings/season/${IPL_SEASON_ID}?include=team`,
  ];

  for (const endpoint of standingsEndpoints) {
    try {
      console.log("[IPL] trying standings:", endpoint);
      const r = await api.get(endpoint);
      // Handle both nested and flat responses
      const raw = r.data?.data?.standings
        || r.data?.data?.[0]?.standings
        || r.data?.data
        || [];
      if (!Array.isArray(raw) || raw.length === 0) continue;
      console.log("[IPL] standings found:", raw.length, "teams");

      points = raw.map((t, i) => {
        const nrr = t.nrrvalue ?? t.net_run_rate ?? t.nrr ?? 0;
        return {
          rank: i + 1,
          team: normalizeTeamName(t.team?.name || t.team_name || t.name || ""),
          p:    t.total_played || t.played || t.matches || 0,
          w:    t.won  || t.wins  || 0,
          l:    t.lost || t.losses || 0,
          nrr:  nrr > 0 ? `+${Number(nrr).toFixed(3)}` : Number(nrr).toFixed(3),
          pts:  t.points || t.pts || 0,
          form: Array.isArray(t.recent_form)
            ? t.recent_form.slice(-5)
            : typeof t.recent_form === "string" && t.recent_form
            ? t.recent_form.split(",").slice(-5).filter(Boolean)
            : [],
        };
      });
      break; // success — stop trying endpoints
    } catch (e) {
      console.warn("[IPL] standings endpoint failed:", endpoint, e.message);
    }
  }

  /* ── Orange Cap — top run scorer ── */
  const batEndpoints = [
    { url: "/batting", params: { "filter[season_id]": IPL_SEASON_ID, include: "batsman,team", sort: "-score_total", per_page: 1 } },
    { url: "/statistics/seasons/players", params: { "filter[season_id]": IPL_SEASON_ID, "filter[type]": "batting", include: "player,team", sort: "-runs", per_page: 1 } },
    { url: `/seasons/${IPL_SEASON_ID}/players`, params: { include: "battingStats", sort: "-battingStats.runs", per_page: 1 } },
  ];

  for (const ep of batEndpoints) {
    try {
      const r = await api.get(ep.url, { params: ep.params });
      const d = r.data?.data?.[0];
      if (!d) continue;
      console.log("[IPL] orange cap raw keys:", Object.keys(d));
      orange_cap = {
        name:    d.batsman?.fullname || d.player?.fullname || d.batsman?.name || d.player?.name || d.name || "—",
        team:    normalizeTeamName(d.team?.name || ""),
        runs:    d.score_total || d.runs || d.run_total || 0,
        matches: d.matches || d.innings || 0,
        avg:     d.average     ? Number(d.average).toFixed(1)     : "—",
        sr:      d.strike_rate ? Number(d.strike_rate).toFixed(1) : "—",
        hs:      d.highest_inning_score || d.highest || "—",
      };
      break;
    } catch (e) { console.warn("[IPL] bat endpoint failed:", ep.url, e.message); }
  }

  /* ── Purple Cap — top wicket taker ── */
  const bowlEndpoints = [
    { url: "/bowling", params: { "filter[season_id]": IPL_SEASON_ID, include: "bowler,team", sort: "-wickets", per_page: 1 } },
    { url: "/statistics/seasons/players", params: { "filter[season_id]": IPL_SEASON_ID, "filter[type]": "bowling", include: "player,team", sort: "-wickets", per_page: 1 } },
  ];

  for (const ep of bowlEndpoints) {
    try {
      const r = await api.get(ep.url, { params: ep.params });
      const d = r.data?.data?.[0];
      if (!d) continue;
      console.log("[IPL] purple cap raw keys:", Object.keys(d));
      purple_cap = {
        name:    d.bowler?.fullname || d.player?.fullname || d.bowler?.name || d.player?.name || "—",
        team:    normalizeTeamName(d.team?.name || ""),
        wickets: d.wickets || 0,
        matches: d.matches || d.innings || 0,
        economy: d.econ    ? Number(d.econ).toFixed(2)    : d.economy ? Number(d.economy).toFixed(2) : "—",
        avg:     d.average ? Number(d.average).toFixed(1) : "—",
        best:    d.best_bowling_figures || d.best || "—",
      };
      break;
    } catch (e) { console.warn("[IPL] bowl endpoint failed:", ep.url, e.message); }
  }

  await db.collection("ipl_data").doc("leaderboard").set({
    points, orange_cap, purple_cap,
    updatedAt: FieldValue.serverTimestamp(),
  });

  const summary = { teams: points.length, orange: orange_cap?.name || "—", purple: purple_cap?.name || "—" };
  console.log("[IPL] Leaderboard saved:", summary);
  return summary;
}

async function runUpdateLive() {
  console.log("[IPL] runUpdateLive — fetching live scores");
  if (!SPORTMONKS_TOKEN.value()) throw new Error("SPORTMONKS_API_TOKEN not set");

  const api = makeApi();
  const res = await api.get("/livescores", {
    params: { "filter[league_id]": IPL_LEAGUE_ID, include: "localteam,visitorteam,venue,runs" },
  });

  const liveMatches = (res.data?.data || []).map(m => normalizeMatch(m));
  if (!liveMatches.length) { console.log("[IPL] No live matches"); return { live: 0 }; }

  const docRef = db.collection("ipl_data").doc("matches");
  const snap   = await docRef.get();
  const existing = snap.exists ? snap.data() : {};

  const updatedToday = (existing.today || []).map(t => {
    const live = liveMatches.find(l => l.id === t.id);
    return live ? { ...t, ...live, status: "live" } : t;
  });

  liveMatches.forEach(live => {
    if (!updatedToday.find(t => t.id === live.id)) updatedToday.push(live);
  });

  await docRef.set({ ...existing, today: updatedToday, live: liveMatches, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  console.log(`[IPL] ${liveMatches.length} live match(es) updated`);
  return { live: liveMatches.length };
}

/* ═══════════════════════════════════════════════════════════
   SCHEDULED FUNCTIONS — call core logic
═══════════════════════════════════════════════════════════ */

// 6:00 AM IST = 00:30 UTC
exports.fetchIPLMatches = onSchedule(
  { schedule: "30 0 * * *", timeZone: "UTC", region: "asia-south1", secrets: [SPORTMONKS_TOKEN] },
  async () => {
    try { await runFetchMatches(); }
    catch (err) { console.error("[IPL] fetchIPLMatches error:", err.response?.data || err.message); }
  }
);

// Every 20 min, 2 PM–midnight IST = 08:30–18:30 UTC
exports.updateLiveScores = onSchedule(
  { schedule: "*/20 8-18 * * *", timeZone: "UTC", region: "asia-south1", secrets: [SPORTMONKS_TOKEN] },
  async () => {
    try { await runUpdateLive(); }
    catch (err) { console.error("[IPL] updateLiveScores error:", err.response?.data || err.message); }
  }
);

// 4:00 AM IST = 22:30 UTC
exports.fetchIPLLeaderboard = onSchedule(
  { schedule: "30 22 * * *", timeZone: "UTC", region: "asia-south1", secrets: [SPORTMONKS_TOKEN] },
  async () => {
    try { await runFetchLeaderboard(); }
    catch (err) { console.error("[IPL] fetchIPLLeaderboard error:", err.response?.data || err.message); }
  }
);

/* ═══════════════════════════════════════════════════════════
   HTTP: Manual refresh — ACTUALLY fetches real data now
   GET /refreshIPL?type=matches|leaderboard|live|all
═══════════════════════════════════════════════════════════ */
exports.refreshIPL = onRequest(
  { cors: true, region: "asia-south1", timeoutSeconds: 120, secrets: [SPORTMONKS_TOKEN] },
  async (req, res) => {
    const type = (req.query.type || "all").toLowerCase();
    console.log(`[IPL] Manual refresh: type=${type}`);

    if (!SPORTMONKS_TOKEN.value()) {
      return res.status(500).json({ ok: false, error: "SPORTMONKS_API_TOKEN not configured" });
    }

    const results = {};

    if (type === "all" || type === "matches") {
      try { results.matches = await runFetchMatches(); }
      catch (e) { console.error("[IPL] matches:", e.message); results.matches = { error: e.message }; }
    }

    if (type === "all" || type === "leaderboard") {
      try { results.leaderboard = await runFetchLeaderboard(); }
      catch (e) { console.error("[IPL] leaderboard:", e.message); results.leaderboard = { error: e.message }; }
    }

    if (type === "live") {
      try { results.live = await runUpdateLive(); }
      catch (e) { console.error("[IPL] live:", e.message); results.live = { error: e.message }; }
    }

    const hasError = Object.values(results).some(r => r?.error);
    res.status(hasError ? 207 : 200).json({
      ok: !hasError,
      type, results,
      time: new Date().toISOString(),
    });
  }
);