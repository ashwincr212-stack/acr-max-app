import React, { useState, useEffect, useCallback, memo } from "react";
import { db } from "../firebase"; // adjust path to your firebase init
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const LOCATIONS = ["Chennai", "Bangalore", "Kochi"];

const LOCATION_META = {
  Chennai: { emoji: "🏙️", tagline: "Bay of Bengal" },
  Bangalore: { emoji: "🌳", tagline: "Garden City" },
  Kochi: { emoji: "⛵", tagline: "Queen of Arabian Sea" },
};

function getTodayIST() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffset);
  const yyyy = istDate.getUTCFullYear();
  const mm = String(istDate.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(istDate.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  const date = new Date(Date.UTC(+y, +m - 1, +d));
  return date.toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ─── FIRESTORE HELPERS ───────────────────────────────────────────────────────

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
  const docId = `${dateStr}_${location}`;
  const snap = await getDoc(doc(db, "panchang", docId));
  if (snap.exists()) return snap.data();
  return null;
}

// ─── SUB-COMPONENTS ──────────────────────────────────────────────────────────

const TimeRow = memo(({ icon, label, value }) => (
  <div style={styles.timeRow}>
    <span style={styles.timeIcon}>{icon}</span>
    <span style={styles.timeLabel}>{label}</span>
    <span style={styles.timeValue}>{value || "—"}</span>
  </div>
));

const DetailChip = memo(({ label, name, lord, endTime }) => (
  <div style={styles.detailChip}>
    <div style={styles.chipLabel}>{label}</div>
    <div style={styles.chipName}>{name || "—"}</div>
    {lord && <div style={styles.chipSub}>Lord: {lord}</div>}
    {endTime && <div style={styles.chipSub}>Until {endTime}</div>}
  </div>
));

const KalamRow = memo(({ icon, label, value }) => (
  <div style={styles.kalamRow}>
    <span style={styles.kalamIcon}>{icon}</span>
    <div style={styles.kalamText}>
      <span style={styles.kalamLabel}>{label}</span>
      <span style={styles.kalamValue}>{value || "—"}</span>
    </div>
  </div>
));

const SectionCard = memo(({ title, icon, children, delay = 0 }) => (
  <div style={{ ...styles.sectionCard, animationDelay: `${delay}ms` }}>
    <div style={styles.sectionHeader}>
      <span style={styles.sectionIcon}>{icon}</span>
      <span style={styles.sectionTitle}>{title}</span>
    </div>
    {children}
  </div>
));

// ─── SKELETON LOADER ─────────────────────────────────────────────────────────

const SkeletonCard = () => (
  <div style={styles.skeletonCard}>
    <div style={{ ...styles.skeletonLine, width: "40%", height: 14, marginBottom: 16 }} />
    {[1, 2, 3, 4].map((i) => (
      <div key={i} style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        <div style={{ ...styles.skeletonLine, width: 24, height: 24, borderRadius: "50%" }} />
        <div style={{ ...styles.skeletonLine, flex: 1, height: 16 }} />
      </div>
    ))}
  </div>
);

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function AstroPage() {
  const [user, setUser] = useState(null);
  const [location, setLocation] = useState("Chennai");
  const [panchang, setPanchang] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const today = getTodayIST();

  // Auth listener
  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return unsub;
  }, []);

  // Load saved location when user is ready
  useEffect(() => {
    if (!user) return;
    getUserLocation(user.uid).then((saved) => setLocation(saved));
  }, [user]);

  // Fetch panchang whenever location changes
  const loadPanchang = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPanchangFromFirestore(location, today);
      if (data) {
        setPanchang(data);
      } else {
        setError("Panchang data for today is not yet available. Please check back after 2 AM IST.");
        setPanchang(null);
      }
    } catch (e) {
      setError("Unable to load Panchang. Please try again.");
      setPanchang(null);
    } finally {
      setLoading(false);
    }
  }, [location, today]);

  useEffect(() => {
    loadPanchang();
  }, [loadPanchang]);

  // Handle location change
  const handleLocationChange = async (e) => {
    const newLoc = e.target.value;
    setLocation(newLoc);
    if (user) {
      setLocationLoading(true);
      await saveUserLocation(user.uid, newLoc).catch(() => {});
      setLocationLoading(false);
    }
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────

  return (
    <div style={styles.root}>
      {/* Decorative background blobs */}
      <div style={styles.blob1} />
      <div style={styles.blob2} />
      <div style={styles.blob3} />

      <div style={styles.container}>
        {/* ── Header ── */}
        <div style={styles.header}>
          <div style={styles.headerTop}>
            <div>
              <div style={styles.headerEyebrow}>✨ Vedic Calendar</div>
              <h1 style={styles.headerTitle}>Daily Panchang</h1>
              <div style={styles.headerDate}>{formatDateDisplay(today)}</div>
            </div>
            <div style={styles.omSymbol}>ॐ</div>
          </div>
        </div>

        {/* ── Location Selector ── */}
        <div style={styles.locationCard}>
          <div style={styles.locationLeft}>
            <span style={styles.locationEmoji}>
              {LOCATION_META[location].emoji}
            </span>
            <div>
              <div style={styles.locationName}>{location}</div>
              <div style={styles.locationTagline}>
                {LOCATION_META[location].tagline}
              </div>
            </div>
          </div>
          <div style={styles.selectWrapper}>
            {locationLoading && <span style={styles.savingDot} />}
            <select
              value={location}
              onChange={handleLocationChange}
              style={styles.select}
              aria-label="Select location"
            >
              {LOCATIONS.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
            <span style={styles.selectArrow}>⌄</span>
          </div>
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : error ? (
          <div style={styles.errorCard}>
            <div style={styles.errorIcon}>🌙</div>
            <div style={styles.errorTitle}>Data Awaited</div>
            <div style={styles.errorMsg}>{error}</div>
            <button style={styles.retryBtn} onClick={loadPanchang}>
              Retry
            </button>
          </div>
        ) : panchang ? (
          <div style={styles.content}>
            {/* Panchang meta banner */}
            {(panchang.varName || panchang.masaName) && (
              <div style={styles.metaBanner}>
                {panchang.varName && (
                  <span style={styles.metaChip}>{panchang.varName}</span>
                )}
                {panchang.masaName && (
                  <span style={styles.metaChip}>{panchang.masaName} Masa</span>
                )}
                {panchang.paksha && (
                  <span style={styles.metaChip}>{panchang.paksha}</span>
                )}
                {panchang.samvat && (
                  <span style={styles.metaChip}>{panchang.samvat}</span>
                )}
              </div>
            )}

            {/* Section 1: Sun & Moon */}
            <SectionCard title="Sun & Moon" icon="🌅" delay={0}>
              <div style={styles.timeGrid}>
                <TimeRow icon="🌄" label="Sunrise" value={panchang.sunrise} />
                <TimeRow icon="🌇" label="Sunset" value={panchang.sunset} />
                <TimeRow icon="🌕" label="Moonrise" value={panchang.moonrise} />
                <TimeRow icon="🌑" label="Moonset" value={panchang.moonset} />
              </div>
            </SectionCard>

            {/* Section 2: Panchang Details */}
            <SectionCard title="Panchang Details" icon="🧭" delay={80}>
              <div style={styles.detailGrid}>
                <DetailChip
                  label="Tithi"
                  name={panchang.tithi?.name}
                  lord={panchang.tithi?.lord}
                  endTime={panchang.tithi?.endTime}
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

            {/* Section 3: Inauspicious Times */}
            <SectionCard title="Inauspicious Times" icon="⏰" delay={160}>
              <div style={styles.kalamList}>
                <KalamRow
                  icon="🚫"
                  label="Rahu Kalam"
                  value={panchang.rahuKalam}
                />
                <KalamRow
                  icon="⚠️"
                  label="Yamagandam"
                  value={panchang.yamagandam}
                />
                <KalamRow
                  icon="🔶"
                  label="Gulika Kalam"
                  value={panchang.gulikaKalam}
                />
                {panchang.abhijitMuhurta && (
                  <KalamRow
                    icon="✅"
                    label="Abhijit Muhurta"
                    value={panchang.abhijitMuhurta}
                  />
                )}
              </div>
              <div style={styles.kalamNote}>
                Avoid important activities during inauspicious periods
              </div>
            </SectionCard>

            {/* Footer note */}
            <div style={styles.footerNote}>
              Data refreshes daily at 2 AM IST · Source: Vedic Astrology
            </div>
          </div>
        ) : null}
      </div>

      {/* CSS animations injected */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600&family=Nunito:wght@400;500;600;700&display=swap');

        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0%   { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
        @keyframes floatBlob {
          0%, 100% { transform: translateY(0px) scale(1); }
          50%       { transform: translateY(-20px) scale(1.04); }
        }
      `}</style>
    </div>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────

const styles = {
  root: {
    fontFamily: "'Nunito', sans-serif",
    minHeight: "100vh",
    background: "linear-gradient(145deg, #fdf6ec 0%, #fef0fb 50%, #eef4ff 100%)",
    position: "relative",
    overflowX: "hidden",
    paddingBottom: 40,
  },

  // Decorative blobs
  blob1: {
    position: "fixed",
    top: -80,
    right: -80,
    width: 280,
    height: 280,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(255,183,77,0.18) 0%, transparent 70%)",
    animation: "floatBlob 8s ease-in-out infinite",
    pointerEvents: "none",
    zIndex: 0,
  },
  blob2: {
    position: "fixed",
    bottom: 60,
    left: -60,
    width: 220,
    height: 220,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(167,139,250,0.14) 0%, transparent 70%)",
    animation: "floatBlob 11s ease-in-out infinite reverse",
    pointerEvents: "none",
    zIndex: 0,
  },
  blob3: {
    position: "fixed",
    top: "45%",
    right: -40,
    width: 160,
    height: 160,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(251,113,133,0.10) 0%, transparent 70%)",
    animation: "floatBlob 14s ease-in-out infinite",
    pointerEvents: "none",
    zIndex: 0,
  },

  container: {
    maxWidth: 480,
    margin: "0 auto",
    padding: "0 16px",
    position: "relative",
    zIndex: 1,
  },

  // ── Header
  header: {
    paddingTop: 24,
    paddingBottom: 4,
    animation: "fadeSlideUp 0.5s ease both",
  },
  headerTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerEyebrow: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.12em",
    color: "#c2922a",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  headerTitle: {
    fontFamily: "'Cinzel', serif",
    fontSize: 28,
    fontWeight: 600,
    margin: 0,
    background: "linear-gradient(135deg, #b45309, #7c3aed)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
    lineHeight: 1.2,
  },
  headerDate: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
    fontWeight: 500,
  },
  omSymbol: {
    fontFamily: "'Cinzel', serif",
    fontSize: 40,
    background: "linear-gradient(135deg, #f59e0b, #ec4899)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
    opacity: 0.85,
    lineHeight: 1,
    marginTop: 4,
  },

  // ── Location card
  locationCard: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "rgba(255,255,255,0.72)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    border: "1px solid rgba(255,255,255,0.9)",
    borderRadius: 16,
    padding: "12px 16px",
    marginTop: 16,
    marginBottom: 18,
    boxShadow: "0 2px 16px rgba(180,130,30,0.08)",
    animation: "fadeSlideUp 0.5s 0.1s ease both",
  },
  locationLeft: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  locationEmoji: {
    fontSize: 28,
    lineHeight: 1,
  },
  locationName: {
    fontWeight: 700,
    fontSize: 15,
    color: "#1f2937",
  },
  locationTagline: {
    fontSize: 11,
    color: "#9ca3af",
    fontWeight: 500,
  },
  selectWrapper: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  select: {
    appearance: "none",
    WebkitAppearance: "none",
    background: "linear-gradient(135deg, #fef3c7, #fde8ff)",
    border: "1px solid rgba(245,158,11,0.3)",
    borderRadius: 10,
    padding: "7px 28px 7px 12px",
    fontSize: 13,
    fontWeight: 600,
    color: "#92400e",
    cursor: "pointer",
    outline: "none",
    fontFamily: "'Nunito', sans-serif",
  },
  selectArrow: {
    position: "absolute",
    right: 8,
    fontSize: 14,
    color: "#92400e",
    pointerEvents: "none",
    lineHeight: 1,
  },
  savingDot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: "#10b981",
    animation: "pulse 1s infinite",
    display: "inline-block",
  },

  // ── Section card
  sectionCard: {
    background: "rgba(255,255,255,0.78)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    border: "1px solid rgba(255,255,255,0.95)",
    borderRadius: 18,
    padding: "16px 16px 14px",
    marginBottom: 14,
    boxShadow: "0 4px 20px rgba(100,60,180,0.07), 0 1px 4px rgba(0,0,0,0.04)",
    animation: "fadeSlideUp 0.55s ease both",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
    paddingBottom: 10,
    borderBottom: "1px solid rgba(229,213,255,0.5)",
  },
  sectionIcon: {
    fontSize: 18,
    lineHeight: 1,
  },
  sectionTitle: {
    fontFamily: "'Cinzel', serif",
    fontSize: 13,
    fontWeight: 600,
    color: "#4c1d95",
    letterSpacing: "0.04em",
  },

  // ── Sun/Moon grid
  timeGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px 12px",
  },
  timeRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "linear-gradient(135deg, rgba(255,237,213,0.5), rgba(243,232,255,0.4))",
    borderRadius: 10,
    padding: "9px 10px",
  },
  timeIcon: {
    fontSize: 16,
    lineHeight: 1,
  },
  timeLabel: {
    fontSize: 10,
    color: "#78716c",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    flex: 1,
    whiteSpace: "nowrap",
  },
  timeValue: {
    fontSize: 12,
    fontWeight: 700,
    color: "#1c1917",
    whiteSpace: "nowrap",
  },

  // ── Detail chips (Tithi / Nakshatra etc)
  detailGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
  },
  detailChip: {
    background: "linear-gradient(135deg, rgba(237,233,254,0.7), rgba(254,243,199,0.6))",
    borderRadius: 12,
    padding: "10px 12px",
    border: "1px solid rgba(221,214,254,0.5)",
  },
  chipLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: "#7c3aed",
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    marginBottom: 3,
  },
  chipName: {
    fontSize: 14,
    fontWeight: 700,
    color: "#1e1b4b",
    lineHeight: 1.2,
    marginBottom: 2,
  },
  chipSub: {
    fontSize: 10,
    color: "#6b7280",
    fontWeight: 500,
    marginTop: 1,
  },

  // ── Kalam rows
  kalamList: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  kalamRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "linear-gradient(135deg, rgba(254,226,226,0.45), rgba(255,237,213,0.4))",
    borderRadius: 10,
    padding: "9px 12px",
  },
  kalamIcon: {
    fontSize: 15,
    lineHeight: 1,
  },
  kalamText: {
    display: "flex",
    justifyContent: "space-between",
    flex: 1,
    alignItems: "center",
  },
  kalamLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: "#44403c",
  },
  kalamValue: {
    fontSize: 12,
    fontWeight: 700,
    color: "#9a3412",
    fontVariantNumeric: "tabular-nums",
  },
  kalamNote: {
    marginTop: 10,
    fontSize: 10,
    color: "#9ca3af",
    textAlign: "center",
    fontStyle: "italic",
  },

  // ── Meta banner
  metaBanner: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 14,
    animation: "fadeSlideUp 0.45s 0.05s ease both",
  },
  metaChip: {
    fontSize: 11,
    fontWeight: 600,
    background: "linear-gradient(135deg, #fbbf24, #f472b6)",
    color: "#fff",
    borderRadius: 20,
    padding: "3px 10px",
    letterSpacing: "0.03em",
    boxShadow: "0 2px 6px rgba(251,191,36,0.3)",
  },

  // ── Content wrapper
  content: {
    animation: "fadeSlideUp 0.5s 0.15s ease both",
  },

  // ── Skeleton
  skeletonCard: {
    background: "rgba(255,255,255,0.7)",
    borderRadius: 18,
    padding: "16px",
    marginBottom: 14,
    boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
  },
  skeletonLine: {
    borderRadius: 6,
    background:
      "linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)",
    backgroundSize: "800px 100%",
    animation: "shimmer 1.4s infinite linear",
    height: 12,
  },

  // ── Error card
  errorCard: {
    background: "rgba(255,255,255,0.82)",
    borderRadius: 20,
    padding: "32px 24px",
    textAlign: "center",
    boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
    animation: "fadeSlideUp 0.5s ease both",
  },
  errorIcon: {
    fontSize: 44,
    marginBottom: 12,
  },
  errorTitle: {
    fontFamily: "'Cinzel', serif",
    fontSize: 18,
    fontWeight: 600,
    color: "#4c1d95",
    marginBottom: 8,
  },
  errorMsg: {
    fontSize: 13,
    color: "#6b7280",
    lineHeight: 1.6,
    marginBottom: 20,
  },
  retryBtn: {
    background: "linear-gradient(135deg, #f59e0b, #ec4899)",
    color: "#fff",
    border: "none",
    borderRadius: 24,
    padding: "10px 28px",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "'Nunito', sans-serif",
    boxShadow: "0 4px 12px rgba(245,158,11,0.3)",
  },

  // ── Footer note
  footerNote: {
    textAlign: "center",
    fontSize: 10,
    color: "#9ca3af",
    marginTop: 4,
    fontStyle: "italic",
  },
};