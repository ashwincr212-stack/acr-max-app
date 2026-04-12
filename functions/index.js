/**
 * ACR MAX — IPL Cricket Cloud Functions (Sportmonks)
 * v2: Full match intelligence — batsmen, bowler, toss, last over, partnership
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onRequest }  = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const axios = require("axios");

initializeApp();
const db = getFirestore();

const BASE_URL         = "https://cricket.sportmonks.com/api/v2.0";
const IPL_SEASON_ID    = 1795;
const IPL_LEAGUE_ID    = 1;
const SPORTMONKS_TOKEN = defineSecret("SPORTMONKS_API_TOKEN");

function makeApi() {
  return axios.create({
    baseURL: BASE_URL,
    timeout: 20000,
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

function formatIST(utcString) {
  if (!utcString) return "TBD";
  try {
    return new Date(utcString).toLocaleTimeString("en-IN", {
      hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata",
    });
  } catch { return "TBD"; }
}

function dayLabel(utcString) {
  try {
    const diff = Math.round((new Date(utcString) - new Date()) / 86400000);
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    if (diff > 1)   return `In ${diff} days`;
    return new Date(utcString).toLocaleDateString("en-IN", { day:"numeric", month:"short", timeZone:"Asia/Kolkata" });
  } catch { return ""; }
}

/* ══════════════════════════════════════════════════════
   NORMALIZE MATCH — full intelligence extraction
   Pulls: scores, toss, batting/bowling teams, batsmen,
   current bowler, last over, partnership, CRR, RRR, MOTM
══════════════════════════════════════════════════════ */
function normalizeMatch(m) {
  const status     = (m.status || "").toLowerCase();
  const isLive     = ["live","ld","in progress","1st innings","2nd innings","int"].includes(status);
  const isFinished = ["finished","completed","result"].includes(status);

  /* ── Scores: score1 = localteam, score2 = visitorteam ── */
  const runs = m.runs || [];
  const score = (teamId) => {
    // Find the LATEST innings for this team (last entry wins)
    const inn = runs.filter(r => r.team_id === teamId);
    if (!inn.length) return null;
    const latest = inn[inn.length - 1];
    return `${latest.score || 0}/${latest.wickets || 0} (${latest.overs || 0})`;
  };

  /* ── Batting/bowling team: who is currently batting? ──
     Sportmonks: the team whose runs entry has score > other = currently batting
     More reliable: use ball-in-play or active innings flag              */
  let battingTeam = null, bowlingTeam = null;
  if (isLive && runs.length) {
    // The CURRENT innings is the one with the highest run count or last in array
    // Sportmonks puts current innings last in runs array
    const currentInn = runs[runs.length - 1];
    if (currentInn) {
      const isBattingLocal = currentInn.team_id === m.localteam_id;
      battingTeam = isBattingLocal
        ? normalizeTeamName(m.localteam?.name)
        : normalizeTeamName(m.visitorteam?.name);
      bowlingTeam = isBattingLocal
        ? normalizeTeamName(m.visitorteam?.name)
        : normalizeTeamName(m.localteam?.name);
    }
  }

  /* ── Scores shown correctly per team ──
     score1 always = localteam (team1), score2 always = visitorteam (team2)
     The live score for batting team = current innings                    */
  // For live: get BOTH innings scores
  const localScore   = score(m.localteam_id);
  const visitorScore = score(m.visitorteam_id);

  /* ── Toss ── */
  let toss = null;
  if (m.toss_won_team_id) {
    const tossWinner = m.toss_won_team_id === m.localteam_id
      ? normalizeTeamName(m.localteam?.name)
      : normalizeTeamName(m.visitorteam?.name);
    toss = `${tossWinner} won toss · elected to ${m.elected || "bat"}`;
  }

  /* ── Batsmen: handle all known Sportmonks v2 response structures ── */
  let batsmen = [];
  // Sportmonks v2 may return batting as:
  // 1. m.batting[] — direct array
  // 2. m.scorecard[].batting[] — nested in scorecard
  // 3. m.scoreboards.batting[] — in scoreboards
  let battingArr = [];
  if (Array.isArray(m.batting) && m.batting.length) {
    battingArr = m.batting;
  } else if (Array.isArray(m.scorecard)) {
    m.scorecard.forEach(sc => {
      if (Array.isArray(sc.batting)) battingArr = battingArr.concat(sc.batting);
    });
  } else if (m.scoreboards && Array.isArray(m.scoreboards.batting)) {
    battingArr = m.scoreboards.batting;
  }

  if (battingArr.length) {
    // Try active_batting first, else take not-dismissed batsmen by score
    let active = battingArr.filter(b => b.active_batting === true || b.active === true);
    if (!active.length) {
      active = battingArr
        .filter(b => {
          const dismissed = b.result?.is_wicket || b.fowScore !== undefined;
          return !dismissed;
        })
        .sort((a,b) => ((b.score||b.runs||0) - (a.score||a.runs||0)))
        .slice(0, 2);
    }
    batsmen = active.slice(0, 2).map(b => {
      // Player name: many possible paths in Sportmonks v2
      const name = b.player?.fullname
                || b.player?.name
                || b.fullname
                || b.name
                || b.batsman?.fullname
                || b.batsman?.name
                || "—";
      const runs  = b.score  ?? b.runs  ?? 0;
      const balls = b.ball   ?? b.balls ?? 0;
      const sr    = b.rate         ? Number(b.rate).toFixed(1)
                  : b.strike_rate  ? Number(b.strike_rate).toFixed(1)
                  : balls > 0      ? Number(runs/balls*100).toFixed(1)
                  : "—";
      return { name, runs, balls, sr, onStrike: b.active_batting === true || b.active === true };
    });
  }

  /* ── Current Bowler: handle all known Sportmonks v2 structures ── */
  let bowler = null;
  let bowlingArr = [];
  if (Array.isArray(m.bowling) && m.bowling.length) {
    bowlingArr = m.bowling;
  } else if (Array.isArray(m.scorecard)) {
    m.scorecard.forEach(sc => {
      if (Array.isArray(sc.bowling)) bowlingArr = bowlingArr.concat(sc.bowling);
    });
  } else if (m.scoreboards && Array.isArray(m.scoreboards.bowling)) {
    bowlingArr = m.scoreboards.bowling;
  }

  if (bowlingArr.length) {
    const active = bowlingArr.find(b => b.active_bowling === true || b.active === true)
                || bowlingArr[bowlingArr.length - 1];
    if (active) {
      const overs   = active.overs   ?? 0;
      const bRuns   = active.runs_conceded ?? active.runs ?? 0;
      const wickets = active.wickets ?? 0;
      const econ    = active.rate    ? Number(active.rate).toFixed(2)
                    : active.economy ? Number(active.economy).toFixed(2)
                    : overs > 0      ? Number(bRuns/overs).toFixed(2)
                    : "—";
      bowler = {
        name: active.player?.fullname
           || active.player?.name
           || active.fullname
           || active.name
           || active.bowler?.fullname
           || active.bowler?.name
           || "—",
        overs, runs: bRuns, wickets, econ,
      };
    }
  }

  /* ── Last over ── */
  let lastOver = [];
  if (Array.isArray(m.last_over_deliveries)) {
    lastOver = m.last_over_deliveries.slice(0, 6).map(d => {
      if (d.is_wicket)              return "W";
      if (d.six)                    return "6";
      if (d.four)                   return "4";
      if (d.is_wide || d.is_no_ball)return "·";
      return String(d.runs ?? 0);
    });
  }

  /* ── Partnership ── */
  let partnership = null;
  if (m.current_partnership) {
    partnership = {
      runs:  m.current_partnership.runs  ?? 0,
      balls: m.current_partnership.balls ?? 0,
    };
  }

  /* ── Run rates ── */
  const crr = m.current_run_rate  ? Number(m.current_run_rate).toFixed(2)  : null;
  const rrr = m.required_run_rate ? Number(m.required_run_rate).toFixed(2) : null;

  /* ── Man of the Match — multiple paths ── */
  const motmObj = m.man_of_match || m.manofmatch || m.manOfMatch || null;
  const motm    = motmObj?.fullname || motmObj?.name
               || (typeof motmObj === "string" ? motmObj : null)
               || null;

  /* ── Build output — Firestore safe (no undefined) ── */
  const out = {
    id:     String(m.id),
    team1:  normalizeTeamName(m.localteam?.name),
    team2:  normalizeTeamName(m.visitorteam?.name),
    time:   formatIST(m.starting_at),
    venue:  m.venue?.name || "TBD",
    date:   m.starting_at ? m.starting_at.slice(0, 10) : "",
    status: isLive ? "live" : isFinished ? "completed" : "upcoming",
    score1: localScore   || null,   // always localteam
    score2: visitorScore || null,   // always visitorteam
    result: isFinished ? (m.note || null) : null,
  };

  if (toss)            out.toss        = toss;
  if (battingTeam)     out.batting     = battingTeam;
  if (bowlingTeam)     out.bowling     = bowlingTeam;
  if (batsmen.length)  out.batsmen     = batsmen;
  if (bowler)          out.bowler      = bowler;
  if (lastOver.length) out.lastOver    = lastOver;
  if (partnership)     out.partnership = partnership;
  if (crr)             out.crr         = crr;
  if (rrr)             out.rrr         = rrr;
  if (motm)            out.motm        = motm;

  return out;
}

/* ══════════════════════════════════════════════════════
   CORE FUNCTIONS
══════════════════════════════════════════════════════ */

async function runFetchMatches() {
  console.log("[IPL] runFetchMatches — fetching from Sportmonks");
  if (!SPORTMONKS_TOKEN.value()) throw new Error("SPORTMONKS_API_TOKEN not set");

  const api = makeApi();
  const res = await api.get("/fixtures", {
    params: {
      "filter[season_id]": IPL_SEASON_ID,
      // Full includes for all match intelligence
      include: "localteam,visitorteam,venue,runs",
      per_page: 100,
    },
  });

  const all = res.data?.data || [];
  console.log(`[IPL] ${all.length} fixtures received`);
  // Debug: log keys of first fixture to understand response structure
  if (all.length > 0) {
    const f = all[0];
    console.log("[IPL] Fixture keys:", Object.keys(f).join(", "));
    // Log batting structure for first fixture that has batting data
    const withBatting = all.find(m => m.batting && m.batting.length > 0);
    if (withBatting && withBatting.batting?.[0]) {
      const b = withBatting.batting[0];
      console.log("[IPL] Batting entry keys:", Object.keys(b).join(", "));
      console.log("[IPL] Batting player field:", JSON.stringify(b.player || b.fullname || b.name || "NONE"));
      console.log("[IPL] Batting score/ball:", b.score, b.ball, b.rate);
    }
    const withBowling = all.find(m => m.bowling && m.bowling.length > 0);
    if (withBowling && withBowling.bowling?.[0]) {
      const bw = withBowling.bowling[0];
      console.log("[IPL] Bowling entry keys:", Object.keys(bw).join(", "));
      console.log("[IPL] Bowling player:", JSON.stringify(bw.player || bw.fullname || "NONE"));
    }
    // Log man_of_match for a finished fixture
    const finished = all.find(m => m.status === "Finished" || m.status === "finished");
    if (finished) {
      console.log("[IPL] Finished fixture man_of_match:", JSON.stringify(finished.man_of_match || "NONE"));
      console.log("[IPL] Finished fixture note:", finished.note);
    }
  }

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

  // Enrich today's matches with full batting/bowling/toss details (per-fixture call)
  for (let i = 0; i < today.length; i++) {
    try {
      const detail = await api.get(`/fixtures/${today[i].id}`, {
        params: { include: "batting,bowling,runs,localteam,visitorteam,venue,man_of_match" }
      });
      const dm = detail.data?.data;
      if (dm) {
        // RAW DEBUG — log first batting entry to see exact field structure
        if (dm.batting && dm.batting.length > 0) {
          console.log(`[IPL] RAW batting[0] keys: ${Object.keys(dm.batting[0]).join(", ")}`);
          console.log(`[IPL] RAW batting[0]: ${JSON.stringify(dm.batting[0]).slice(0, 400)}`);
        } else {
          console.log(`[IPL] No batting array for fixture ${dm.id}, keys: ${Object.keys(dm).join(", ")}`);
        }
        if (dm.bowling && dm.bowling.length > 0) {
          console.log(`[IPL] RAW bowling[0] keys: ${Object.keys(dm.bowling[0]).join(", ")}`);
          console.log(`[IPL] RAW bowling[0]: ${JSON.stringify(dm.bowling[0]).slice(0, 300)}`);
        }
        if (dm.man_of_match) {
          console.log(`[IPL] RAW man_of_match: ${JSON.stringify(dm.man_of_match)}`);
        }
        const enriched = normalizeMatch(dm);
        today[i] = { ...today[i], ...enriched };
        console.log(`[IPL] Enriched ${today[i].id}: batsmen=${today[i].batsmen?.length||0}, bowler=${today[i].bowler?.name||"none"}, motm=${today[i].motm||"none"}`);
      }
    } catch(e) { console.warn(`[IPL] Could not enrich fixture ${today[i].id}:`, e.message); }
  }
  // Enrich recent results with MOTM
  for (let i = 0; i < Math.min(results.length, 5); i++) {
    try {
      const detail = await api.get(`/fixtures/${results[i].id}`, {
        params: { include: "runs,localteam,visitorteam,venue,man_of_match" }
      });
      const dm = detail.data?.data;
      if (dm) {
        const motmObj = dm.man_of_match || dm.manofmatch;
        if (motmObj) results[i].motm = motmObj.fullname || motmObj.name || null;
        if (dm.toss_won_team_id) {
          const tossWinner = dm.toss_won_team_id === dm.localteam_id
            ? normalizeTeamName(dm.localteam?.name)
            : normalizeTeamName(dm.visitorteam?.name);
          results[i].toss = `${tossWinner} won toss · elected to ${dm.elected || "bat"}`;
        }
      }
    } catch(e) { console.warn(`[IPL] Could not enrich result ${results[i].id}:`, e.message); }
  }

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

async function runUpdateLive() {
  console.log("[IPL] runUpdateLive — fetching live scores");
  if (!SPORTMONKS_TOKEN.value()) throw new Error("SPORTMONKS_API_TOKEN not set");

  const api = makeApi();
  const res = await api.get("/livescores", {
    params: {
      "filter[league_id]": IPL_LEAGUE_ID,
      // Full includes for live intelligence
      include: "localteam,visitorteam,venue,runs",
    },
  });

  const liveMatches = (res.data?.data || []).map(m => normalizeMatch(m));
  if (!liveMatches.length) { console.log("[IPL] No live matches"); return { live: 0 }; }

  const docRef   = db.collection("ipl_data").doc("matches");
  const snap     = await docRef.get();
  const existing = snap.exists ? snap.data() : {};

  const updatedToday = (existing.today || []).map(t => {
    const live = liveMatches.find(l => l.id === t.id);
    return live ? { ...t, ...live, status: "live" } : t;
  });

  liveMatches.forEach(live => {
    if (!updatedToday.find(t => t.id === live.id)) updatedToday.push(live);
  });

  await docRef.set(
    { ...existing, today: updatedToday, live: liveMatches, updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
  console.log(`[IPL] ${liveMatches.length} live match(es) updated`);
  return { live: liveMatches.length };
}

async function runFetchLeaderboard() {
  console.log("[IPL] runFetchLeaderboard — fetching from Sportmonks");
  if (!SPORTMONKS_TOKEN.value()) throw new Error("SPORTMONKS_API_TOKEN not set");

  const api = makeApi();
  let points = [], orange_cap = null, purple_cap = null;

  /* ── Points Table ── */
  const standingsEndpoints = [
    `/seasons/${IPL_SEASON_ID}?include=standings`,
    `/standings?filter[season_id]=${IPL_SEASON_ID}&include=team`,
    `/standings/season/${IPL_SEASON_ID}?include=team`,
  ];
  for (const endpoint of standingsEndpoints) {
    try {
      const r   = await api.get(endpoint);
      const raw = r.data?.data?.standings || r.data?.data?.[0]?.standings || r.data?.data || [];
      if (!Array.isArray(raw) || !raw.length) continue;
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
          form: Array.isArray(t.recent_form) ? t.recent_form.slice(-5)
              : typeof t.recent_form === "string" && t.recent_form
              ? t.recent_form.split(",").slice(-5).filter(Boolean) : [],
        };
      });
      break;
    } catch (e) { console.warn("[IPL] standings failed:", endpoint, e.message); }
  }

  /* ── Orange Cap — top run scorer this season ── */
  try {
    const batRes = await api.get("/fixtures", {
      params: {
        "filter[season_id]": IPL_SEASON_ID,
        include: "runs,localteam,visitorteam",
        per_page: 50,
      }
    });
    // Get list of finished fixture IDs, then fetch top few for batting details
    const fixtures = (batRes.data?.data || []).filter(f => f.status === "Finished" || f.status === "finished").slice(0, 10);
    const playerRuns = {};
    const playerTeam = {};
    for (const fixture of fixtures) {
      try {
        const fd = await api.get(`/fixtures/${fixture.id}`, { params: { include: "batting,localteam,visitorteam" } });
        (fd.data?.data?.batting || []).forEach(b => {
          const pid = b.player_id;
          const name = b.player?.fullname || b.player?.name || b.fullname;
          if (!pid || !name) return;
          if (!playerRuns[pid]) playerRuns[pid] = { name, runs:0, innings:0, hs:0 };
          playerRuns[pid].runs    += (b.score || 0);
          playerRuns[pid].innings += 1;
          playerRuns[pid].hs       = Math.max(playerRuns[pid].hs, b.score || 0);
          const teamId = b.team_id;
          if (teamId === fixture.localteam_id)   playerTeam[pid] = normalizeTeamName(fixture.localteam?.name);
          if (teamId === fixture.visitorteam_id) playerTeam[pid] = normalizeTeamName(fixture.visitorteam?.name);
        });
      } catch(e) { /* skip fixture */ }
    }
    const sorted = Object.entries(playerRuns).sort((a,b) => b[1].runs - a[1].runs);
    if (sorted.length) {
      const [pid, stats] = sorted[0];
      orange_cap = {
        name:    stats.name,
        team:    playerTeam[pid] || "—",
        runs:    stats.runs,
        matches: stats.innings,
        avg:     stats.innings ? Number(stats.runs / stats.innings).toFixed(1) : "—",
        sr:      "—",
        hs:      String(stats.hs),
      };
      console.log("[IPL] Orange cap:", orange_cap.name, orange_cap.runs, "runs");
    }
  } catch (e) { console.warn("[IPL] Orange cap error:", e.message); }

  /* ── Purple Cap — top wicket taker ── */
  try {
    const bowlRes = await api.get("/fixtures", {
      params: {
        "filter[season_id]": IPL_SEASON_ID,
        include: "runs,localteam,visitorteam",
        per_page: 50,
      }
    });
    const fixtures2 = (bowlRes.data?.data || []).filter(f => f.status === "Finished" || f.status === "finished").slice(0, 10);
    const playerWkts = {};
    const playerTeam2 = {};
    for (const fixture of fixtures2) {
      try {
        const fd = await api.get(`/fixtures/${fixture.id}`, { params: { include: "bowling,localteam,visitorteam" } });
        (fd.data?.data?.bowling || []).forEach(b => {
          const pid = b.player_id;
          const name = b.player?.fullname || b.player?.name || b.fullname;
          if (!pid || !name) return;
          if (!playerWkts[pid]) playerWkts[pid] = { name, wickets:0, innings:0, runs:0 };
          playerWkts[pid].wickets += (b.wickets || 0);
          playerWkts[pid].innings += 1;
          playerWkts[pid].runs    += (b.runs_conceded || b.runs || 0);
          const teamId = b.team_id;
          if (teamId === fixture.localteam_id)   playerTeam2[pid] = normalizeTeamName(fixture.localteam?.name);
          if (teamId === fixture.visitorteam_id) playerTeam2[pid] = normalizeTeamName(fixture.visitorteam?.name);
        });
      } catch(e) { /* skip */ }
    }
    const sorted2 = Object.entries(playerWkts).sort((a,b) => b[1].wickets - a[1].wickets);
    if (sorted2.length) {
      const [pid, stats] = sorted2[0];
      const econ = stats.innings ? Number(stats.runs / stats.innings).toFixed(2) : "—";
      purple_cap = {
        name:    stats.name,
        team:    playerTeam2[pid] || "—",
        wickets: stats.wickets,
        matches: stats.innings,
        economy: econ,
        avg:     stats.wickets ? Number(stats.runs / stats.wickets).toFixed(1) : "—",
        best:    "—",
      };
      console.log("[IPL] Purple cap:", purple_cap.name, purple_cap.wickets, "wickets");
    }
  } catch (e) { console.warn("[IPL] Purple cap error:", e.message); }

  await db.collection("ipl_data").doc("leaderboard").set({
    points, orange_cap, purple_cap,
    updatedAt: FieldValue.serverTimestamp(),
  });

  console.log(`[IPL] Leaderboard: ${points.length} teams, orange: ${orange_cap?.name}, purple: ${purple_cap?.name}`);
  return { teams: points.length, orange: orange_cap?.name || "—", purple: purple_cap?.name || "—" };
}

/* ══════════════════════════════════════════════════════
   SCHEDULED FUNCTIONS
══════════════════════════════════════════════════════ */

exports.fetchIPLMatches = onSchedule(
  { schedule: "30 0 * * *", timeZone: "UTC", region: "asia-south1", secrets: [SPORTMONKS_TOKEN] },
  async () => {
    try { await runFetchMatches(); }
    catch (err) { console.error("[IPL] fetchIPLMatches error:", err.response?.data || err.message); }
  }
);

exports.updateLiveScores = onSchedule(
  { schedule: "*/20 8-18 * * *", timeZone: "UTC", region: "asia-south1", secrets: [SPORTMONKS_TOKEN] },
  async () => {
    try { await runUpdateLive(); }
    catch (err) { console.error("[IPL] updateLiveScores error:", err.response?.data || err.message); }
  }
);

exports.fetchIPLLeaderboard = onSchedule(
  { schedule: "30 22 * * *", timeZone: "UTC", region: "asia-south1", secrets: [SPORTMONKS_TOKEN] },
  async () => {
    try { await runFetchLeaderboard(); }
    catch (err) { console.error("[IPL] fetchIPLLeaderboard error:", err.response?.data || err.message); }
  }
);

/* ══════════════════════════════════════════════════════
   HTTP: Manual refresh trigger
══════════════════════════════════════════════════════ */
exports.refreshIPL = onRequest(
  { cors: true, region: "asia-south1", timeoutSeconds: 120, secrets: [SPORTMONKS_TOKEN] },
  async (req, res) => {
    const type = (req.query.type || "all").toLowerCase();
    if (!SPORTMONKS_TOKEN.value()) return res.status(500).json({ ok:false, error:"Token not configured" });

    const results = {};
    if (type === "all" || type === "matches")     { try { results.matches     = await runFetchMatches();     } catch(e) { results.matches     = { error: e.message }; } }
    if (type === "all" || type === "leaderboard") { try { results.leaderboard = await runFetchLeaderboard(); } catch(e) { results.leaderboard = { error: e.message }; } }
    if (type === "live")                          { try { results.live        = await runUpdateLive();       } catch(e) { results.live        = { error: e.message }; } }

    const hasError = Object.values(results).some(r => r?.error);
    res.status(hasError ? 207 : 200).json({ ok: !hasError, type, results, time: new Date().toISOString() });
  }
);