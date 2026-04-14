/**
 * Astro.jsx — Premium Daily Panchang UI
 * Firebase Firestore integration preserved.
 * Features: time-aware kalam detection, expandable cards,
 * day progress bar, sticky header, glassmorphism, micro-animations.
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  memo,
  useRef,
} from "react";
import { db } from "../firebase"; // adjust path to your firebase init
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const LOCATIONS = ["Chennai", "Bangalore", "Kochi"];
const IST_OFFSET_MS = 5.5 * 3600000;

const LOCATION_META = {
  Chennai:   { emoji: "🏙️", tagline: "Bay of Bengal" },
  Bangalore: { emoji: "🌳", tagline: "Garden City" },
  Kochi:     { emoji: "⛵", tagline: "Queen of Arabian Sea" },
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function getTodayIST() {
  const now = new Date();
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const yyyy = ist.getUTCFullYear();
  const mm   = String(ist.getUTCMonth() + 1).padStart(2, "0");
  const dd   = String(ist.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getISTDateParts(referenceDate = new Date()) {
  const ist = new Date(referenceDate.getTime() + IST_OFFSET_MS);
  return {
    year: ist.getUTCFullYear(),
    month: ist.getUTCMonth(),
    day: ist.getUTCDate(),
  };
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return new Date(Date.UTC(+y, +m - 1, +d)).toLocaleDateString("en-IN", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

/**
 * Converts strings like "06:14 AM", "Tue Apr 14 2026 06:14:00 AM",
 * or ISO timestamps into a clean "6:14 AM" format.
 * Returns the original string if it can't be parsed.
 */
function formatTime(raw) {
  if (!raw) return "—";
  // Already clean short format: "6:14 AM" or "06:14 AM"
  if (/^\d{1,2}:\d{2}\s?[APap][Mm]$/.test(raw.trim())) {
    // Normalise to remove leading zero on hours
    const [time, meridiem] = raw.trim().split(/\s+/);
    const [h, min] = time.split(":");
    return `${parseInt(h, 10)}:${min} ${meridiem.toUpperCase()}`;
  }
  // Try full Date parse (handles long strings from API)
  const d = new Date(raw);
  if (!isNaN(d)) {
    return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
  }
  return raw;
}

/**
 * Parses a time string like "7:30 AM" or "07:30 AM" into minutes-since-midnight.
 * Returns null if unparseable.
 */
function parseTimeToMinutes(timeStr) {
  if (!timeStr) return null;
  // Handle "6:14 AM", "06:14 AM", "6:14AM", etc.
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*([APap][Mm])/);
  if (!match) return null;
  let h = parseInt(match[1], 10);
  const min = parseInt(match[2], 10);
  const mer = match[3].toUpperCase();
  if (mer === "AM" && h === 12) h = 0;
  if (mer === "PM" && h !== 12) h += 12;
  return h * 60 + min;
}

function parseTimeOnISTDate(timeStr, referenceDate = new Date()) {
  const normalizedTime = formatTime(timeStr);
  const minutes = parseTimeToMinutes(normalizedTime);
  if (minutes === null) return null;

  const { year, month, day } = getISTDateParts(referenceDate);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  return new Date(Date.UTC(year, month, day, hours, mins) - IST_OFFSET_MS);
}

/**
 * Parses a range string into { start, end } as minutes-since-midnight.
 * Handles separators: " - ", " – ", " to " (API variants).
 */
function parseTimeRange(rangeStr, referenceDate = new Date()) {
  if (!rangeStr) return null;
  // Support "07:30 AM to 09:00 AM" and "07:30 AM - 09:00 AM"
  const parts = rangeStr.split(/\s+to\s+|\s*[-–]\s*/i);
  if (parts.length < 2) return null;
  const start = parseTimeToMinutes(parts[0].trim());
  const end   = parseTimeToMinutes(parts[1].trim());
  if (start === null || end === null) return null;
  return { start, end };
}

/**
 * Returns current IST time as { totalMinutes, date: Date }.
 * date is a real Date object set to today in IST — used for countdown math.
 */
function nowIST() {
  const nowMs = Date.now() + IST_OFFSET_MS;          // shift to IST
  const ist   = new Date(nowMs);
  const totalMinutes = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  const totalSeconds = totalMinutes * 60 + ist.getUTCSeconds();
  return { totalMinutes, totalSeconds, ist, now: new Date() };
}

/** Returns current IST minutes-since-midnight (kept for compat). */
function nowISTMinutes() {
  return nowIST().totalMinutes;
}

function parseTimeRangeDate(rangeStr, referenceDate = new Date()) {
  if (!rangeStr) return null;

  const normalizedRange = String(rangeStr)
    .replace(/[â€“â€”–—]/g, "-")
    .replace(/\s+to\s+/gi, "-")
    .trim();

  const parts = normalizedRange.split(/\s*-\s*/).map((part) => part.trim()).filter(Boolean);
  if (parts.length !== 2) return null;

  const [startLabel, endLabel] = parts;
  const start = parseTimeOnISTDate(startLabel, referenceDate);
  const end = parseTimeOnISTDate(endLabel, referenceDate);

  if (!start || !end) return null;

  return { start, end, startLabel, endLabel };
}

/**
 * Check if current time falls inside a time range string.
 */
function isNowInRange(rangeStr) {
  const range = parseTimeRangeDate(rangeStr);
  if (!range) return false;
  const now = new Date();
  return now >= range.start && now <= range.end;
}

// ─── KALAM PERIOD CONFIG ──────────────────────────────────────────────────────
// Single source of truth: label, firestore key, severity type
const KALAM_PERIODS = [
  { key: "rahuKalam",   label: "Rahu Kalam",   type: "bad"     },
  { key: "yamagandam",  label: "Yamagandam",   type: "bad"     },
  { key: "gulikaKalam", label: "Gulika Kalam", type: "neutral" },
];

/**
 * Detects the currently active inauspicious period.
 * Returns { key, label, type } or null.
 */
function detectActivePeriod(panchang) {
  if (!panchang) return null;
  for (const period of KALAM_PERIODS) {
    if (isNowInRange(panchang[period.key])) return period;
  }
  return null;
}

/**
 * Formats a seconds-remaining count into "Xh Ym" or "Ym" string.
 */
function formatCountdown(totalSeconds) {
  if (totalSeconds <= 0) return "soon";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/**
 * Finds the next upcoming kalam period (starts after now).
 * Returns { label, type, timeLeft: string } or null.
 */
function findNextPeriod(panchang) {
  if (!panchang) return null;
  const { now } = nowIST();
  let nearest = null;

  for (const period of KALAM_PERIODS) {
    const range = parseTimeRangeDate(panchang[period.key]);
    if (!range) continue;
    // Only consider periods that haven't started yet
    if (range.start > now) {
      const secsUntil = Math.floor((range.start.getTime() - now.getTime()) / 1000);
      if (!nearest || secsUntil < nearest.secsUntil) {
        nearest = { ...period, secsUntil, timeLeft: formatCountdown(secsUntil) };
      }
    }
  }
  return nearest;
}

function hasParsedKalamPeriods(panchang) {
  if (!panchang) return false;
  return KALAM_PERIODS.some((period) => !!parseTimeRangeDate(panchang[period.key]));
}

// ─── FIRESTORE HELPERS ────────────────────────────────────────────────────────

async function getUserLocation(uid) {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (snap.exists()) return snap.data().panchangLocation || "Chennai";
  } catch (_) {}
  return "Chennai";
}

async function saveUserLocation(uid, location) {
  await setDoc(doc(db, "users", uid), { panchangLocation: location }, { merge: true });
}

async function fetchPanchangFromFirestore(location, dateStr) {
  const snap = await getDoc(doc(db, "panchang", `${dateStr}_${location}`));
  return snap.exists() ? snap.data() : null;
}

// ─── DAY PROGRESS HOOK ────────────────────────────────────────────────────────

function useDayProgress(sunriseStr, sunsetStr) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const sunriseMin = parseTimeToMinutes(formatTime(sunriseStr));
    const sunsetMin  = parseTimeToMinutes(formatTime(sunsetStr));
    if (sunriseMin === null || sunsetMin === null) return;

    const calc = () => {
      const now = nowISTMinutes();
      const total = sunsetMin - sunriseMin;
      if (total <= 0) return;
      const elapsed = Math.min(Math.max(now - sunriseMin, 0), total);
      setProgress(Math.round((elapsed / total) * 100));
    };

    calc();
    const id = setInterval(calc, 60000); // update every minute
    return () => clearInterval(id);
  }, [sunriseStr, sunsetStr]);

  return progress;
}

// ─── REAL-TIME KALAM HOOK ────────────────────────────────────────────────────

/**
 * Recalculates active period and next upcoming event every 30 seconds.
 * Returns { activePeriod, nextEvent } — both update live.
 */
function useKalamStatus(panchang) {
  const [state, setState] = useState(() => ({
    activePeriod: detectActivePeriod(panchang),
    nextEvent:    findNextPeriod(panchang),
  }));

  useEffect(() => {
    const recalc = () => {
      setState({
        activePeriod: detectActivePeriod(panchang),
        nextEvent:    findNextPeriod(panchang),
      });
    };
    recalc(); // run immediately when panchang changes
    const id = setInterval(recalc, 30000); // refresh every 30 seconds
    return () => clearInterval(id);
  }, [panchang]);

  return state;
}

// ─── SMART STATUS HELPER ─────────────────────────────────────────────────────

/**
 * Derives a fully-resolved status object from current period state.
 * Drives all text + colour in KalamStatusBadge.
 *
 * @returns {{ type: "bad"|"neutral"|"good", title, message, extra }} | null
 */
function getSmartStatus(panchang, activePeriod, nextEvent) {
  if (!panchang) return null;

  if (activePeriod) {
    const rawRange = panchang[activePeriod.key] ?? "";
    const parsedRange = parseTimeRangeDate(rawRange);
    // Extract the end-time half of the range string ("X to Y" or "X - Y")
    const endPart = rawRange.split(/\s+to\s+|\s*[-–]\s*/i)[1]?.trim() ?? "";
    return {
      type:    activePeriod.type === "neutral" ? "neutral" : "bad",
      icon:    activePeriod.type === "neutral" ? "🟡" : "🔴",
      title:   "Inauspicious time",
      message: activePeriod.type === "neutral"
        ? `${activePeriod.label} is active. Proceed with caution`
        : `${activePeriod.label} is active. Avoid important actions`,
      extra:   (parsedRange?.endLabel || endPart) ? `Ends at ${formatTime(parsedRange?.endLabel || endPart)}` : "",
    };
  }

  if (nextEvent) {
    return {
      type:    "good",
      icon:    "🟢",
      title:   "Auspicious time",
      message: "Safe period for activities",
      extra:   `Next ${nextEvent.label} in ${nextEvent.timeLeft}`,
    };
  }

  if (hasParsedKalamPeriods(panchang)) {
    return {
      type:    "good",
      icon:    "ðŸŸ¢",
      title:   "Auspicious time",
      message: "No Rahu Kalam, Gulika, or Yamagandam is active now",
      icon:    "Safe",
      extra:   "",
    };
  }

  return {
    type:    "neutral",
    icon:    "🟡",
    title:   "Time status unavailable",
    message: "Panchang times could not be parsed",
    extra:   "",
  };
}

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────

/** Animated glowing status badge — driven by smartStatus */
const KalamStatusBadge = memo(({ smartStatus }) => {
  if (!smartStatus) return null;

  const { type, icon, title, message, extra } = smartStatus;

  // Colour tokens keyed by type
  const COLOR_MAP = {
    bad: {
      bg:     "linear-gradient(135deg, rgba(239,68,68,0.15), rgba(252,165,165,0.10))",
      border: "rgba(239,68,68,0.35)",
      glow:   "rgba(239,68,68,0.22)",
      title:  "#dc2626",
      extra:  "#b91c1c",
      dot:    "#ef4444",
    },
    neutral: {
      bg:     "linear-gradient(135deg, rgba(245,158,11,0.14), rgba(253,230,138,0.10))",
      border: "rgba(245,158,11,0.35)",
      glow:   "rgba(245,158,11,0.18)",
      title:  "#b45309",
      extra:  "#92400e",
      dot:    "#f59e0b",
    },
    good: {
      bg:     "linear-gradient(135deg, rgba(16,185,129,0.15), rgba(110,231,183,0.10))",
      border: "rgba(16,185,129,0.35)",
      glow:   "rgba(16,185,129,0.18)",
      title:  "#059669",
      extra:  "#047857",
      dot:    null,
    },
  };

  const c = COLOR_MAP[type] ?? COLOR_MAP.neutral;
  const isBadActive = type === "bad";

  return (
    <div style={{
      ...S.statusBadge,
      background:  c.bg,
      border:      `1px solid ${c.border}`,
      boxShadow:   isBadActive
        ? `0 0 0 1px ${c.border}, 0 0 18px ${c.glow}`
        : `0 0 14px ${c.glow}`,
      animation:   isBadActive
        ? "statusGlow 2.4s ease-in-out infinite, fadeSlideUp 0.5s 0.05s ease both"
        : "fadeSlideUp 0.5s 0.05s ease both",
    }}>
      {/* Status icon */}
      <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{icon}</span>

      {/* Text block */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...S.statusTitle, color: c.title }}>{title}</div>

        {message ? (
          <div style={S.statusSub}>{message}</div>
        ) : null}

        {extra ? (
          <div style={{ ...S.statusNext }}>
            <span style={S.nextDot}>⏭</span>
            <span style={{ color: c.extra, fontWeight: 700 }}>{extra}</span>
          </div>
        ) : null}
      </div>

      {/* Live pulse dot — only for active bad/neutral periods */}
      {c.dot && (
        <span style={{ ...S.pulseDot, background: c.dot }} />
      )}
    </div>
  );
});

/** Day progress bar */
const DayProgressBar = memo(({ progress, sunriseStr, sunsetStr }) => (
  <div style={S.progressCard}>
    <div style={S.progressHeader}>
      <span style={S.progressLabel}>☀️ Day Progress</span>
      <span style={S.progressPct}>{progress}%</span>
    </div>
    <div style={S.progressTrack}>
      <div style={{ ...S.progressFill, width: `${progress}%` }} />
      <div style={{ ...S.progressDot, left: `calc(${progress}% - 6px)` }} />
    </div>
    <div style={S.progressTimes}>
      <span>{formatTime(sunriseStr)}</span>
      <span>{formatTime(sunsetStr)}</span>
    </div>
  </div>
));

/** Single time row in the Sun & Moon grid */
const TimeRow = memo(({ icon, label, value }) => (
  <div style={S.timeRow}>
    <span style={S.timeIcon}>{icon}</span>
    <div style={S.timeContent}>
      <span style={S.timeLabel}>{label}</span>
      <span style={S.timeValue}>{formatTime(value)}</span>
    </div>
  </div>
));

/** Expandable Panchang detail chip */
const DetailChip = memo(({ label, name, lord, endTime, special, summary }) => {
  const [open, setOpen] = useState(false);
  const hasExtra = !!(special || summary);

  return (
    <div
      style={{
        ...S.detailChip,
        ...(open ? S.detailChipOpen : {}),
      }}
      onClick={() => hasExtra && setOpen((o) => !o)}
    >
      <div style={S.chipLabelRow}>
        <span style={S.chipLabel}>{label}</span>
        {hasExtra && (
          <span style={{ ...S.chipCaret, transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>
            ›
          </span>
        )}
      </div>
      <div style={S.chipName}>{name || "—"}</div>
      {lord    && <div style={S.chipSub}>Lord: {lord}</div>}
      {endTime && <div style={S.chipSub}>Until {endTime}</div>}
      {open && (
        <div style={S.chipExpanded}>
          {special && <div style={S.chipExpandedLine}>✦ {special}</div>}
          {summary && <div style={S.chipExpandedLine}>{summary}</div>}
        </div>
      )}
    </div>
  );
});

/** Kalam row with active highlight */
const KalamRow = memo(({ icon, label, value, isActive }) => (
  <div style={{
    ...S.kalamRow,
    ...(isActive ? S.kalamRowActive : {}),
  }}>
    <span style={S.kalamIcon}>{icon}</span>
    <div style={S.kalamText}>
      <span style={{ ...S.kalamLabel, color: isActive ? "#dc2626" : "#44403c" }}>
        {label}
        {isActive && <span style={S.kalamActivePill}> NOW</span>}
      </span>
      <span style={{ ...S.kalamValue, color: isActive ? "#dc2626" : "#9a3412" }}>
        {formatTime(value?.split?.(" - ")?.[0])} – {formatTime(value?.split?.(" - ")?.[1])}
      </span>
    </div>
  </div>
));

/** Expandable section card with tap feedback */
const SectionCard = memo(({ title, icon, children, delay = 0, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  const [pressed, setPressed] = useState(false);

  return (
    <div style={{
      ...S.sectionCard,
      animationDelay: `${delay}ms`,
      transform: pressed ? "scale(0.985)" : "scale(1)",
      transition: "transform 0.15s ease, box-shadow 0.2s ease",
    }}>
      <button
        style={S.sectionHeaderBtn}
        onClick={() => setOpen((o) => !o)}
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerLeave={() => setPressed(false)}
        aria-expanded={open}
      >
        <div style={S.sectionHeaderLeft}>
          <span style={S.sectionIcon}>{icon}</span>
          <span style={S.sectionTitle}>{title}</span>
        </div>
        <span style={{
          ...S.sectionChevron,
          transform: open ? "rotate(90deg)" : "rotate(0deg)",
        }}>›</span>
      </button>
      {open && (
        <div style={S.sectionBody}>
          {children}
        </div>
      )}
    </div>
  );
});

// ─── SKELETON LOADER ──────────────────────────────────────────────────────────

const SkeletonCard = memo(() => (
  <div style={S.skeletonCard}>
    <div style={{ ...S.skeletonLine, width: "45%", height: 13, marginBottom: 18 }} />
    {[80, 100, 90, 70].map((w, i) => (
      <div key={i} style={{ display: "flex", gap: 10, marginBottom: 11, alignItems: "center" }}>
        <div style={{ ...S.skeletonLine, width: 28, height: 28, borderRadius: "50%", flexShrink: 0 }} />
        <div style={{ ...S.skeletonLine, width: `${w}%`, height: 14 }} />
      </div>
    ))}
  </div>
));

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function AstroPage() {
  const [user, setUser]                   = useState(null);
  const [location, setLocation]           = useState("Chennai");
  const [panchang, setPanchang]           = useState(null);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [headerScrolled, setHeaderScrolled]   = useState(false);
  const today = useMemo(() => getTodayIST(), []);

  // Sticky header on scroll
  useEffect(() => {
    const onScroll = () => setHeaderScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Auth listener
  useEffect(() => {
    const auth = getAuth();
    return onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  // Load saved location
  useEffect(() => {
    if (!user) return;
    getUserLocation(user.uid).then(setLocation);
  }, [user]);

  // Fetch panchang
  const loadPanchang = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPanchangFromFirestore(location, today);
      setPanchang(data || null);
      if (!data) setError("Panchang data for today is not yet available. Check back after 2 AM IST.");
    } catch {
      setError("Unable to load Panchang. Please try again.");
      setPanchang(null);
    } finally {
      setLoading(false);
    }
  }, [location, today]);

  useEffect(() => { loadPanchang(); }, [loadPanchang]);

  // Location change
  const handleLocationChange = useCallback(async (e) => {
    const newLoc = e.target.value;
    setLocation(newLoc);
    if (user) {
      setLocationLoading(true);
      await saveUserLocation(user.uid, newLoc).catch(() => {});
      setLocationLoading(false);
    }
  }, [user]);

  // Derived state — computed once, ticks every 30s inside hook
  const { activePeriod, nextEvent } = useKalamStatus(panchang);
  const dayProgress  = useDayProgress(panchang?.sunrise, panchang?.sunset);
  const smartStatus  = getSmartStatus(panchang, activePeriod, nextEvent);

  // ─── RENDER ───────────────────────────────────────────────────────────────

  return (
    <div style={S.root}>
      {/* ── Background blobs ── */}
      <div style={S.blob1} />
      <div style={S.blob2} />
      <div style={S.blob3} />

      {/* ── Sticky Header ── */}
      <div style={{
        ...S.stickyHeader,
        background: headerScrolled
          ? "rgba(255,251,245,0.88)"
          : "transparent",
        backdropFilter: headerScrolled ? "blur(16px)" : "none",
        WebkitBackdropFilter: headerScrolled ? "blur(16px)" : "none",
        boxShadow: headerScrolled
          ? "0 1px 20px rgba(180,100,30,0.10)"
          : "none",
        borderBottom: headerScrolled
          ? "1px solid rgba(255,255,255,0.7)"
          : "1px solid transparent",
      }}>
        <div style={S.stickyInner}>
          <div style={S.stickyLeft}>
            <span style={S.eyebrow}>✨ Vedic Calendar</span>
            <h1 style={S.stickyTitle}>
              Daily Panchang
              <span style={S.stickyLoc}> · {location}</span>
            </h1>
            <div style={S.stickyDate}>{formatDateDisplay(today)}</div>
          </div>
          <div style={S.omSymbol}>ॐ</div>
        </div>
      </div>

      {/* ── Main scroll content ── */}
      <div style={S.container}>
        {/* Spacer for sticky header */}
        <div style={{ height: 96 }} />

        {/* ── Location Selector ── */}
        <div style={S.locationCard}>
          <div style={S.locationLeft}>
            <span style={S.locationEmoji}>{LOCATION_META[location].emoji}</span>
            <div>
              <div style={S.locationName}>{location}</div>
              <div style={S.locationTagline}>{LOCATION_META[location].tagline}</div>
            </div>
          </div>
          <div style={S.selectWrapper}>
            {locationLoading && <span style={S.savingDot} />}
            <select
              value={location}
              onChange={handleLocationChange}
              style={S.select}
              aria-label="Select location"
            >
              {LOCATIONS.map((loc) => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
            <span style={S.selectArrow}>⌄</span>
          </div>
        </div>

        {/* ── Content ── */}
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : error ? (
          <div style={S.errorCard}>
            <div style={S.errorIcon}>🌙</div>
            <div style={S.errorTitle}>Data Awaited</div>
            <div style={S.errorMsg}>{error}</div>
            <button style={S.retryBtn} onClick={loadPanchang}>↻ Retry</button>
          </div>
        ) : panchang ? (
          <div style={S.content}>

            {/* Meta chips: weekday, masa, paksha */}
            {(panchang.varName || panchang.masaName) && (
              <div style={S.metaBanner}>
                {panchang.varName  && <span style={S.metaChip}>{panchang.varName}</span>}
                {panchang.masaName && <span style={S.metaChip}>{panchang.masaName} Masa</span>}
                {panchang.paksha   && <span style={S.metaChip}>{panchang.paksha}</span>}
                {panchang.samvat   && <span style={S.metaChip}>{panchang.samvat}</span>}
              </div>
            )}

            {/* ── Kalam Status Badge ── */}
            <KalamStatusBadge smartStatus={smartStatus} />

            {/* ── Day Progress Bar ── */}
            {panchang.sunrise && panchang.sunset && (
              <DayProgressBar
                progress={dayProgress}
                sunriseStr={panchang.sunrise}
                sunsetStr={panchang.sunset}
              />
            )}

            {/* ── Section 1: Sun & Moon ── */}
            <SectionCard title="Sun & Moon" icon="🌅" delay={0}>
              <div style={S.timeGrid}>
                <TimeRow icon="🌄" label="Sunrise"  value={panchang.sunrise}  />
                <TimeRow icon="🌇" label="Sunset"   value={panchang.sunset}   />
                <TimeRow icon="🌕" label="Moonrise" value={panchang.moonrise} />
                <TimeRow icon="🌑" label="Moonset"  value={panchang.moonset}  />
              </div>
            </SectionCard>

            {/* ── Section 2: Panchang Details ── */}
            <SectionCard title="Panchang Details" icon="🧭" delay={60}>
              <div style={S.detailGrid}>
                <DetailChip
                  label="Tithi"
                  name={panchang.tithi?.name}
                  lord={panchang.tithi?.lord}
                  endTime={panchang.tithi?.endTime}
                  special={panchang.tithi?.special}
                  summary={panchang.tithi?.summary}
                />
                <DetailChip
                  label="Nakshatra"
                  name={panchang.nakshatra?.name}
                  lord={panchang.nakshatra?.lord}
                  endTime={panchang.nakshatra?.endTime}
                />
                <DetailChip
                  label="Yoga"
                  name={panchang.yoga?.name}
                  lord={panchang.yoga?.lord}
                  endTime={panchang.yoga?.endTime}
                />
                <DetailChip
                  label="Karana"
                  name={panchang.karana?.name}
                  lord={panchang.karana?.lord}
                  endTime={panchang.karana?.endTime}
                />
              </div>
            </SectionCard>

            {/* ── Section 3: Inauspicious Times ── */}
            <SectionCard title="Inauspicious Times" icon="⏰" delay={120}>
              <div style={S.kalamList}>
                <KalamRow
                  icon="🔴" label="Rahu Kalam"
                  value={panchang.rahuKalam}
                  isActive={activePeriod?.key === "rahuKalam"}
                />
                <KalamRow
                  icon="🟠" label="Yamagandam"
                  value={panchang.yamagandam}
                  isActive={activePeriod?.key === "yamagandam"}
                />
                <KalamRow
                  icon="🟡" label="Gulika Kalam"
                  value={panchang.gulikaKalam}
                  isActive={activePeriod?.key === "gulikaKalam"}
                />
                {panchang.abhijitMuhurta && (
                  <KalamRow
                    icon="🟢" label="Abhijit Muhurta"
                    value={panchang.abhijitMuhurta}
                    isActive={false}
                  />
                )}
              </div>
              <div style={S.kalamNote}>
                Avoid important decisions during highlighted periods
              </div>
            </SectionCard>

            {/* Footer */}
            <div style={S.footerNote}>
              Refreshes daily at 2 AM IST · Vedic Astrology
            </div>
          </div>
        ) : null}
      </div>

      {/* ── Injected CSS ── */}
      <style>{CSS}</style>
    </div>
  );
}

// ─── INJECTED CSS ─────────────────────────────────────────────────────────────

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Nunito:wght@400;500;600;700;800&display=swap');

  @keyframes fadeSlideUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0);    }
  }
  @keyframes shimmer {
    0%   { background-position: -600px 0; }
    100% { background-position:  600px 0; }
  }
  @keyframes pulse {
    0%, 100% { opacity: 1;   transform: scale(1);    }
    50%       { opacity: 0.5; transform: scale(0.85); }
  }
  @keyframes floatBlob {
    0%, 100% { transform: translateY(0)   scale(1);    }
    50%       { transform: translateY(-22px) scale(1.04); }
  }
  @keyframes progressGlow {
    0%, 100% { box-shadow: 0 0 6px rgba(251,146,60,0.6); }
    50%       { box-shadow: 0 0 14px rgba(251,146,60,0.9); }
  }
  @keyframes badgePulse {
    0%, 100% { opacity: 1;   transform: scale(1);   }
    50%       { opacity: 0.4; transform: scale(0.7); }
  }
  @keyframes statusGlow {
    0%, 100% { box-shadow: 0 0 0 1px rgba(239,68,68,0.35), 0 0 14px rgba(239,68,68,0.18); }
    50%       { box-shadow: 0 0 0 1px rgba(239,68,68,0.50), 0 0 28px rgba(239,68,68,0.34); }
  }

  * { box-sizing: border-box; }

  .panchang-chip-expanded {
    animation: fadeSlideUp 0.2s ease both;
  }
`;

// ─── STYLES ───────────────────────────────────────────────────────────────────

const S = {

  // ── Root & background
  root: {
    fontFamily: "'Nunito', sans-serif",
    minHeight: "100vh",
    background: "linear-gradient(160deg, #fff8ee 0%, #fdf0fd 45%, #eef3ff 100%)",
    position: "relative",
    overflowX: "hidden",
    paddingBottom: 56,
  },

  blob1: {
    position: "fixed", top: -100, right: -80,
    width: 320, height: 320, borderRadius: "50%",
    background: "radial-gradient(circle, rgba(251,191,36,0.16) 0%, transparent 70%)",
    animation: "floatBlob 9s ease-in-out infinite",
    pointerEvents: "none", zIndex: 0,
  },
  blob2: {
    position: "fixed", bottom: 40, left: -80,
    width: 260, height: 260, borderRadius: "50%",
    background: "radial-gradient(circle, rgba(167,139,250,0.13) 0%, transparent 70%)",
    animation: "floatBlob 12s ease-in-out infinite reverse",
    pointerEvents: "none", zIndex: 0,
  },
  blob3: {
    position: "fixed", top: "40%", right: -50,
    width: 180, height: 180, borderRadius: "50%",
    background: "radial-gradient(circle, rgba(251,113,133,0.09) 0%, transparent 70%)",
    animation: "floatBlob 15s ease-in-out infinite",
    pointerEvents: "none", zIndex: 0,
  },

  // ── Sticky header
  stickyHeader: {
    position: "fixed", top: 0, left: 0, right: 0,
    zIndex: 100,
    transition: "background 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease",
  },
  stickyInner: {
    maxWidth: 480, margin: "0 auto",
    padding: "14px 20px 10px",
    display: "flex", justifyContent: "space-between", alignItems: "flex-start",
  },
  stickyLeft: { display: "flex", flexDirection: "column", gap: 1 },
  eyebrow: {
    fontSize: 10, fontWeight: 700, letterSpacing: "0.13em",
    color: "#b45309", textTransform: "uppercase",
  },
  stickyTitle: {
    fontFamily: "'Cinzel', serif",
    fontSize: 22, fontWeight: 700, margin: 0,
    background: "linear-gradient(135deg, #b45309, #7c3aed)",
    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
    lineHeight: 1.25,
  },
  stickyLoc: {
    fontFamily: "'Nunito', sans-serif",
    fontSize: 14, fontWeight: 600,
    WebkitTextFillColor: "transparent",
    background: "linear-gradient(135deg, #b45309, #7c3aed)",
    WebkitBackgroundClip: "text", backgroundClip: "text",
  },
  stickyDate: {
    fontSize: 11, color: "#78716c", fontWeight: 500, marginTop: 1,
  },
  omSymbol: {
    fontFamily: "'Cinzel', serif", fontSize: 36,
    background: "linear-gradient(135deg, #f59e0b, #ec4899)",
    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
    opacity: 0.9, lineHeight: 1, marginTop: 2,
  },

  // ── Container
  container: {
    maxWidth: 480, margin: "0 auto",
    padding: "0 16px",
    position: "relative", zIndex: 1,
  },

  // ── Location card
  locationCard: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    background: "rgba(255,255,255,0.75)",
    backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
    border: "1px solid rgba(255,255,255,0.95)",
    borderRadius: 18, padding: "12px 16px",
    marginBottom: 16,
    boxShadow: "0 2px 20px rgba(180,130,30,0.07)",
    animation: "fadeSlideUp 0.45s ease both",
  },
  locationLeft: { display: "flex", alignItems: "center", gap: 10 },
  locationEmoji: { fontSize: 26, lineHeight: 1 },
  locationName: { fontWeight: 800, fontSize: 15, color: "#1c1917" },
  locationTagline: { fontSize: 11, color: "#a8a29e", fontWeight: 500 },
  selectWrapper: { position: "relative", display: "flex", alignItems: "center", gap: 6 },
  select: {
    appearance: "none", WebkitAppearance: "none",
    background: "linear-gradient(135deg, #fef3c7, #fce7f3)",
    border: "1px solid rgba(245,158,11,0.28)",
    borderRadius: 12, padding: "7px 30px 7px 13px",
    fontSize: 13, fontWeight: 700, color: "#92400e",
    cursor: "pointer", outline: "none",
    fontFamily: "'Nunito', sans-serif",
  },
  selectArrow: {
    position: "absolute", right: 8, fontSize: 15,
    color: "#92400e", pointerEvents: "none", lineHeight: 1,
  },
  savingDot: {
    width: 7, height: 7, borderRadius: "50%",
    background: "#10b981",
    animation: "pulse 1.2s infinite",
    display: "inline-block",
  },

  // ── Kalam status badge
  statusBadge: {
    display: "flex", alignItems: "center", gap: 10,
    borderRadius: 16, padding: "12px 14px",
    marginBottom: 12,
    animation: "fadeSlideUp 0.5s 0.05s ease both",
    position: "relative", overflow: "hidden",
  },
  statusTitle: {
    fontSize: 13, fontWeight: 800, lineHeight: 1.2,
  },
  statusSub: {
    fontSize: 11, color: "#6b7280", fontWeight: 500, marginTop: 2,
  },
  statusNext: {
    display: "flex", alignItems: "center", gap: 5,
    marginTop: 7, paddingTop: 7,
    borderTop: "1px solid rgba(0,0,0,0.06)",
    fontSize: 11.5, color: "#6b7280", fontWeight: 500,
  },
  nextDot: {
    fontSize: 12, flexShrink: 0,
  },
  pulseDot: {
    position: "absolute", top: 10, right: 12,
    width: 8, height: 8, borderRadius: "50%",
    background: "#ef4444",
    animation: "badgePulse 1.5s ease-in-out infinite",
  },

  // ── Day progress bar
  progressCard: {
    background: "rgba(255,255,255,0.72)",
    backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
    border: "1px solid rgba(255,255,255,0.9)",
    borderRadius: 16, padding: "12px 16px",
    marginBottom: 12,
    boxShadow: "0 2px 16px rgba(0,0,0,0.04)",
    animation: "fadeSlideUp 0.5s 0.08s ease both",
  },
  progressHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    marginBottom: 8,
  },
  progressLabel: { fontSize: 12, fontWeight: 700, color: "#92400e" },
  progressPct: {
    fontSize: 12, fontWeight: 800,
    background: "linear-gradient(135deg, #f59e0b, #f97316)",
    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
  },
  progressTrack: {
    position: "relative", height: 8,
    background: "rgba(245,158,11,0.12)",
    borderRadius: 99, overflow: "visible",
  },
  progressFill: {
    height: "100%", borderRadius: 99,
    background: "linear-gradient(90deg, #fbbf24, #f97316)",
    transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)",
    boxShadow: "0 0 8px rgba(251,146,60,0.5)",
  },
  progressDot: {
    position: "absolute", top: -4,
    width: 16, height: 16, borderRadius: "50%",
    background: "#f97316",
    boxShadow: "0 0 0 3px rgba(249,115,22,0.2)",
    animation: "progressGlow 2s ease-in-out infinite",
    transition: "left 0.8s cubic-bezier(0.4,0,0.2,1)",
  },
  progressTimes: {
    display: "flex", justifyContent: "space-between",
    fontSize: 10, color: "#a8a29e", fontWeight: 600,
    marginTop: 6,
  },

  // ── Section card
  sectionCard: {
    background: "rgba(255,255,255,0.76)",
    backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
    border: "1px solid rgba(255,255,255,0.95)",
    borderRadius: 20,
    marginBottom: 12,
    boxShadow: "0 4px 24px rgba(100,60,180,0.06), 0 1px 4px rgba(0,0,0,0.03)",
    animation: "fadeSlideUp 0.55s ease both",
    overflow: "hidden",
    willChange: "transform",
  },
  sectionHeaderBtn: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    width: "100%", background: "none", border: "none",
    padding: "14px 16px 12px", cursor: "pointer",
    borderBottom: "1px solid rgba(229,213,255,0.4)",
    fontFamily: "'Nunito', sans-serif",
  },
  sectionHeaderLeft: { display: "flex", alignItems: "center", gap: 8 },
  sectionIcon: { fontSize: 18, lineHeight: 1 },
  sectionTitle: {
    fontFamily: "'Cinzel', serif",
    fontSize: 12.5, fontWeight: 600,
    color: "#4c1d95", letterSpacing: "0.05em",
  },
  sectionChevron: {
    fontSize: 20, color: "#7c3aed", fontWeight: 700,
    transition: "transform 0.25s ease",
    lineHeight: 1,
  },
  sectionBody: { padding: "12px 14px 14px" },

  // ── Time grid (Sun & Moon)
  timeGrid: {
    display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8,
  },
  timeRow: {
    display: "flex", alignItems: "center", gap: 9,
    background: "linear-gradient(135deg, rgba(255,237,213,0.6), rgba(243,232,255,0.45))",
    borderRadius: 12, padding: "10px 11px",
  },
  timeIcon: { fontSize: 18, lineHeight: 1, flexShrink: 0 },
  timeContent: { display: "flex", flexDirection: "column", gap: 1 },
  timeLabel: {
    fontSize: 9.5, color: "#78716c", fontWeight: 700,
    textTransform: "uppercase", letterSpacing: "0.07em",
  },
  timeValue: { fontSize: 13, fontWeight: 800, color: "#1c1917" },

  // ── Detail chips (Panchang Details)
  detailGrid: {
    display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8,
  },
  detailChip: {
    background: "linear-gradient(145deg, rgba(237,233,254,0.75), rgba(254,243,199,0.6))",
    borderRadius: 14, padding: "10px 12px",
    border: "1px solid rgba(221,214,254,0.45)",
    cursor: "default",
    transition: "background 0.2s ease",
  },
  detailChipOpen: {
    background: "linear-gradient(145deg, rgba(221,214,254,0.85), rgba(253,230,138,0.65))",
    boxShadow: "0 0 0 2px rgba(124,58,237,0.15)",
  },
  chipLabelRow: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    marginBottom: 3,
  },
  chipLabel: {
    fontSize: 9.5, fontWeight: 800, color: "#7c3aed",
    textTransform: "uppercase", letterSpacing: "0.08em",
  },
  chipCaret: {
    fontSize: 15, color: "#7c3aed", fontWeight: 700,
    transition: "transform 0.2s ease", lineHeight: 1,
  },
  chipName: {
    fontSize: 13.5, fontWeight: 800, color: "#1e1b4b",
    lineHeight: 1.2, marginBottom: 2,
  },
  chipSub: { fontSize: 10, color: "#6b7280", fontWeight: 500, marginTop: 1 },
  chipExpanded: {
    marginTop: 8, paddingTop: 8,
    borderTop: "1px solid rgba(221,214,254,0.5)",
  },
  chipExpandedLine: {
    fontSize: 10.5, color: "#4c1d95", fontWeight: 500,
    lineHeight: 1.5, marginBottom: 3,
  },

  // ── Kalam rows
  kalamList: { display: "flex", flexDirection: "column", gap: 7 },
  kalamRow: {
    display: "flex", alignItems: "center", gap: 10,
    background: "linear-gradient(135deg, rgba(254,226,226,0.4), rgba(255,237,213,0.35))",
    borderRadius: 12, padding: "9px 12px",
    transition: "all 0.25s ease",
  },
  kalamRowActive: {
    background: "linear-gradient(135deg, rgba(239,68,68,0.12), rgba(252,165,165,0.1))",
    border: "1px solid rgba(239,68,68,0.25)",
    boxShadow: "0 0 16px rgba(239,68,68,0.12)",
  },
  kalamIcon: { fontSize: 14, lineHeight: 1, flexShrink: 0 },
  kalamText: { display: "flex", justifyContent: "space-between", flex: 1, alignItems: "center", gap: 6 },
  kalamLabel: { fontSize: 12, fontWeight: 700, transition: "color 0.2s" },
  kalamActivePill: {
    fontSize: 8.5, fontWeight: 900, letterSpacing: "0.07em",
    background: "#ef4444", color: "#fff",
    borderRadius: 6, padding: "1px 5px", marginLeft: 5,
    verticalAlign: "middle",
  },
  kalamValue: {
    fontSize: 11.5, fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
    whiteSpace: "nowrap", transition: "color 0.2s",
  },
  kalamNote: {
    marginTop: 10, fontSize: 10, color: "#a8a29e",
    textAlign: "center", fontStyle: "italic",
  },

  // ── Meta chips
  metaBanner: {
    display: "flex", flexWrap: "wrap", gap: 6,
    marginBottom: 12,
    animation: "fadeSlideUp 0.4s ease both",
  },
  metaChip: {
    fontSize: 10.5, fontWeight: 700,
    background: "linear-gradient(135deg, #fbbf24, #f472b6)",
    color: "#fff", borderRadius: 20, padding: "3px 10px",
    letterSpacing: "0.03em",
    boxShadow: "0 2px 8px rgba(251,191,36,0.28)",
  },

  // ── Content wrapper
  content: { animation: "fadeSlideUp 0.5s 0.1s ease both" },

  // ── Skeleton
  skeletonCard: {
    background: "rgba(255,255,255,0.68)",
    borderRadius: 20, padding: "16px 16px 18px",
    marginBottom: 12, boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
  },
  skeletonLine: {
    borderRadius: 6,
    background: "linear-gradient(90deg, #f3f0ee 25%, #ebe7e3 50%, #f3f0ee 75%)",
    backgroundSize: "800px 100%",
    animation: "shimmer 1.5s infinite linear",
    height: 12,
  },

  // ── Error card
  errorCard: {
    background: "rgba(255,255,255,0.84)",
    borderRadius: 22, padding: "36px 24px",
    textAlign: "center", boxShadow: "0 4px 28px rgba(0,0,0,0.06)",
    animation: "fadeSlideUp 0.5s ease both",
  },
  errorIcon: { fontSize: 48, marginBottom: 12 },
  errorTitle: {
    fontFamily: "'Cinzel', serif",
    fontSize: 18, fontWeight: 600, color: "#4c1d95", marginBottom: 8,
  },
  errorMsg: { fontSize: 13, color: "#6b7280", lineHeight: 1.65, marginBottom: 22 },
  retryBtn: {
    background: "linear-gradient(135deg, #f59e0b, #ec4899)",
    color: "#fff", border: "none", borderRadius: 26,
    padding: "10px 30px", fontSize: 13, fontWeight: 800,
    cursor: "pointer", fontFamily: "'Nunito', sans-serif",
    boxShadow: "0 4px 14px rgba(245,158,11,0.32)",
    transition: "transform 0.15s ease, box-shadow 0.15s ease",
  },

  // ── Footer
  footerNote: {
    textAlign: "center", fontSize: 10, color: "#a8a29e",
    marginTop: 6, fontStyle: "italic",
  },
};
