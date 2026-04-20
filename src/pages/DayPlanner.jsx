import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import {
  Plus,
  Sparkles,
  Zap,
  Check,
  Clock,
  Flame,
  Waves,
  Focus,
  ChevronRight,
  X,
  AlertCircle,
  ArrowRight,
  Coffee,
  Briefcase,
  Book,
  Heart,
  Moon,
} from "lucide-react";

/* ============================================================
   ADAPTIVE DAY SCHEDULER
   A living timeline that thinks. Built around the idea that
   your day is a fluid, not a list.
   ============================================================ */

/* ---------- Design Tokens ---------- */
const CATEGORIES = {
  deep: { label: "Deep Work", color: "#C9A227", glow: "rgba(201,162,39,0.35)", icon: Focus },
  meeting: { label: "Meeting", color: "#E45B5B", glow: "rgba(228,91,91,0.35)", icon: Briefcase },
  break: { label: "Break", color: "#6FA88F", glow: "rgba(111,168,143,0.35)", icon: Coffee },
  personal: { label: "Personal", color: "#9B7BC7", glow: "rgba(155,123,199,0.35)", icon: Heart },
  learn: { label: "Learning", color: "#5D94C9", glow: "rgba(93,148,201,0.35)", icon: Book },
  rest: { label: "Rest", color: "#8B8B9A", glow: "rgba(139,139,154,0.35)", icon: Moon },
};

const PRIORITIES = {
  1: { label: "Flexible", weight: 1 },
  2: { label: "Normal", weight: 2 },
  3: { label: "Important", weight: 3 },
  4: { label: "Critical", weight: 4 },
};

/* ---------- Time helpers (minutes since midnight) ---------- */
const toMin = (h, m = 0) => h * 60 + m;
const fmt = (min) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${period}`;
};
const fmtShort = (min) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  const period = h >= 12 ? "p" : "a";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${period}` : `${h12}:${m.toString().padStart(2, "0")}${period}`;
};

/* ---------- Seed tasks (demo day) ---------- */
const seedTasks = () => {
  // Use a fixed "today" for demo purposes; "now" will be simulated.
  return [
    { id: "t1", title: "Morning pages", category: "personal", start: 420, duration: 20, priority: 2, status: "done" },
    { id: "t2", title: "Ship the onboarding flow", category: "deep", start: 540, duration: 120, priority: 4, status: "active" },
    { id: "t3", title: "Standup with design", category: "meeting", start: 690, duration: 30, priority: 3, status: "upcoming" },
    { id: "t4", title: "Lunch & walk", category: "break", start: 750, duration: 45, priority: 2, status: "upcoming" },
    { id: "t5", title: "Review PR #482", category: "deep", start: 810, duration: 60, priority: 3, status: "upcoming" },
    { id: "t6", title: "Read: Designing for attention", category: "learn", start: 900, duration: 40, priority: 1, status: "upcoming" },
    { id: "t7", title: "Gym", category: "personal", start: 1020, duration: 60, priority: 2, status: "upcoming" },
    { id: "t8", title: "Wind down", category: "rest", start: 1320, duration: 30, priority: 1, status: "upcoming" },
  ];
};

/* ============================================================
   SCHEDULING ENGINE
   ============================================================ */

/** Find free gaps in the day between dayStart and dayEnd. */
function findGaps(tasks, dayStart = 360, dayEnd = 1380) {
  const sorted = [...tasks].filter(t => t.status !== "done").sort((a, b) => a.start - b.start);
  const gaps = [];
  let cursor = dayStart;
  for (const t of sorted) {
    if (t.start > cursor) gaps.push({ start: cursor, end: t.start, duration: t.start - cursor });
    cursor = Math.max(cursor, t.start + t.duration);
  }
  if (cursor < dayEnd) gaps.push({ start: cursor, end: dayEnd, duration: dayEnd - cursor });
  return gaps;
}

/** Score a gap for a task. Preference: earliest fitting gap that isn't
 *  too early (before 9am) unless the task is rest/personal. */
function scoreGap(gap, task, now) {
  if (gap.duration < task.duration) return -Infinity;
  if (gap.end < now + 15) return -Infinity; // gap is in the past
  const effectiveStart = Math.max(gap.start, now + 5);
  if (gap.end - effectiveStart < task.duration) return -Infinity;

  let score = 1000 - (effectiveStart - now); // earlier = better
  // Deep work prefers mornings (9–12)
  if (task.category === "deep" && effectiveStart >= 540 && effectiveStart <= 720) score += 300;
  // Meetings prefer mid-day
  if (task.category === "meeting" && effectiveStart >= 600 && effectiveStart <= 960) score += 150;
  // Rest prefers evenings
  if (task.category === "rest" && effectiveStart >= 1200) score += 400;
  return score;
}

/** Auto-schedule a new task into the best available slot. */
function autoSchedule(task, tasks, now) {
  const gaps = findGaps(tasks);
  let best = null;
  let bestScore = -Infinity;
  for (const gap of gaps) {
    const s = scoreGap(gap, task, now);
    if (s > bestScore) {
      bestScore = s;
      best = gap;
    }
  }
  if (!best) return null;
  return { start: Math.max(best.start, now + 5), reason: reasonFor(best, task, now) };
}

function reasonFor(gap, task, now) {
  const startsAt = Math.max(gap.start, now + 5);
  if (task.category === "deep" && startsAt >= 540 && startsAt <= 720)
    return `Placed in your morning focus window — your best deep work hours.`;
  if (gap.duration > task.duration * 1.5)
    return `Found a clean ${Math.round(gap.duration)}min gap at ${fmt(startsAt)}.`;
  return `Tightest fit at ${fmt(startsAt)} — no rescheduling needed.`;
}

/** When a task runs over or slips, push dependents forward. */
function cascadeShift(tasks, changedId, newEnd) {
  const sorted = [...tasks].sort((a, b) => a.start - b.start);
  const idx = sorted.findIndex(t => t.id === changedId);
  if (idx === -1) return tasks;
  let cursor = newEnd;
  const updated = sorted.map((t, i) => {
    if (i <= idx) return t;
    if (t.status === "done") return t;
    if (t.start < cursor) {
      // Shift forward, but protect critical tasks that have hard anchors
      if (t.priority === 4) return t; // locked
      return { ...t, start: cursor, shifted: true };
    }
    cursor = Math.max(cursor, t.start + t.duration);
    return t;
  });
  // second pass: update cursor after shifts
  let c2 = newEnd;
  return updated.map((t, i) => {
    if (i <= idx || t.status === "done") return t;
    const start = Math.max(t.start, c2);
    c2 = start + t.duration;
    return start !== t.start ? { ...t, start, shifted: true } : t;
  });
}

/* ============================================================
   LIVE CLOCK HOOK (simulated, 1 demo-minute every 200ms)
   ============================================================ */
function useLiveClock(initial = 600, speed = 300) {
  const [now, setNow] = useState(initial);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setNow(n => (n + 1) % 1440), speed);
    return () => clearInterval(id);
  }, [paused, speed]);
  return { now, setNow, paused, setPaused };
}

/* ============================================================
   COMPONENT: App
   ============================================================ */
export default function AdaptiveScheduler() {
  const [tasks, setTasks] = useState(seedTasks);
  const { now, setNow, paused, setPaused } = useLiveClock(600, 250);
  const [selected, setSelected] = useState(null);
  const [composing, setComposing] = useState(false);
  const [insight, setInsight] = useState(null);
  const [focusMode, setFocusMode] = useState(false);

  /* derive task states from the clock */
  const liveTasks = useMemo(() => {
    return tasks.map(t => {
      if (t.status === "done") return t;
      const end = t.start + t.duration;
      if (now >= t.start && now < end) return { ...t, status: "active" };
      if (now >= end && t.status !== "done") return { ...t, status: "missed" };
      return { ...t, status: "upcoming" };
    });
  }, [tasks, now]);

  const active = liveTasks.find(t => t.status === "active");
  const upcoming = liveTasks.filter(t => t.status === "upcoming").sort((a, b) => a.start - b.start);
  const missed = liveTasks.filter(t => t.status === "missed" && !t.rescheduled);

  /* auto-insight: when a task is missed, surface a reschedule suggestion */
  useEffect(() => {
    if (missed.length > 0 && !insight) {
      const m = missed[0];
      setInsight({
        type: "missed",
        taskId: m.id,
        title: m.title,
        message: `"${m.title}" slipped. I can reschedule it into your next open slot.`,
      });
    }
  }, [missed.length, insight]);

  const completeTask = (id) => {
    setTasks(prev => {
      const t = prev.find(x => x.id === id);
      if (!t) return prev;
      const newEnd = now;
      const completed = { ...t, status: "done", actualEnd: newEnd };
      const others = prev.filter(x => x.id !== id);
      // If completed early, compress the day
      if (newEnd < t.start + t.duration) {
        const cascaded = cascadeShift([completed, ...others], id, newEnd);
        flashInsight(`Finished ${Math.round((t.start + t.duration - newEnd))}min early — your day just opened up.`, "win");
        return cascaded;
      }
      return [completed, ...others];
    });
  };

  const flashInsight = (message, type = "info") => {
    setInsight({ type, message });
    setTimeout(() => setInsight(null), 4500);
  };

  const rescheduleMissed = (id) => {
    setTasks(prev => {
      const t = prev.find(x => x.id === id);
      if (!t) return prev;
      const placement = autoSchedule(t, prev.filter(x => x.id !== id), now);
      if (!placement) {
        flashInsight(`No room today — pushing "${t.title}" to tomorrow.`, "warn");
        return prev.map(x => x.id === id ? { ...x, status: "deferred", rescheduled: true } : x);
      }
      flashInsight(`Rescheduled "${t.title}" to ${fmt(placement.start)}.`, "win");
      return prev.map(x => x.id === id ? { ...x, start: placement.start, status: "upcoming", rescheduled: true, shifted: true } : x);
    });
    setInsight(null);
  };

  const addTask = (draft) => {
    const placement = autoSchedule(draft, tasks, now);
    if (!placement) {
      flashInsight(`No free slots — deferred to tomorrow.`, "warn");
      return;
    }
    const newTask = { ...draft, id: `t${Date.now()}`, start: placement.start, status: "upcoming", justAdded: true };
    setTasks(prev => [...prev, newTask]);
    flashInsight(placement.reason, "win");
    setComposing(false);
    setTimeout(() => {
      setTasks(prev => prev.map(t => t.id === newTask.id ? { ...t, justAdded: false } : t));
    }, 2000);
  };

  return (
    <div className="app-root">
      <GlobalStyles />

      <AmbientBackground now={now} />

      <div className="shell">
        <Header
          now={now}
          paused={paused}
          setPaused={setPaused}
          focusMode={focusMode}
          setFocusMode={setFocusMode}
        />

        <ActiveCard active={active} now={now} onComplete={completeTask} onTap={() => active && setSelected(active)} />

        <Timeline
          tasks={liveTasks}
          now={now}
          onSelect={setSelected}
          onComplete={completeTask}
          focusMode={focusMode}
        />

        <UpNext tasks={upcoming.slice(0, 3)} now={now} />

        <div className="bottom-spacer" />
      </div>

      {/* Floating FAB */}
      <motion.button
        className="fab"
        onClick={() => setComposing(true)}
        whileTap={{ scale: 0.92 }}
        whileHover={{ scale: 1.05 }}
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 22, delay: 0.4 }}
      >
        <Plus size={22} strokeWidth={2.5} />
      </motion.button>

      {/* Insight toast */}
      <AnimatePresence>
        {insight && <InsightToast insight={insight} onReschedule={rescheduleMissed} onDismiss={() => setInsight(null)} />}
      </AnimatePresence>

      {/* Add task modal */}
      <AnimatePresence>
        {composing && <ComposeSheet onClose={() => setComposing(false)} onAdd={addTask} tasks={tasks} now={now} />}
      </AnimatePresence>

      {/* Task detail */}
      <AnimatePresence>
        {selected && <DetailSheet task={selected} onClose={() => setSelected(null)} onComplete={completeTask} onReschedule={rescheduleMissed} />}
      </AnimatePresence>
    </div>
  );
}

/* ============================================================
   AMBIENT BACKGROUND — shifts with time of day
   ============================================================ */
function AmbientBackground({ now }) {
  // Map time of day to a soft light hue: warm morning, clean midday, gentle evening.
  const t = now / 1440;
  const hue1 = 248 + Math.sin(t * Math.PI * 2) * 12;
  const hue2 = 38 + Math.cos(t * Math.PI * 2) * 10;
  return (
    <>
      <div
        className="ambient-base"
        style={{
          background: `
            radial-gradient(ellipse 90% 52% at 18% -10%, hsla(${hue1}, 86%, 88%, 0.72) 0%, transparent 58%),
            radial-gradient(ellipse 75% 48% at 96% 4%, hsla(${hue2}, 92%, 86%, 0.46) 0%, transparent 60%),
            linear-gradient(180deg, #fbfcff 0%, #f6f8fc 46%, #eef3fb 100%)
          `,
        }}
      />
      <div className="grain" />
    </>
  );
}

/* ============================================================
   HEADER
   ============================================================ */
function Header({ now, paused, setPaused, focusMode, setFocusMode }) {
  const greeting = now < 720 ? "Good morning" : now < 1020 ? "Good afternoon" : "Good evening";
  const dateStr = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <header className="hdr">
      <div className="hdr-top">
        <div>
          <div className="hdr-date">{dateStr}</div>
          <h1 className="hdr-greeting">
            {greeting}<span className="hdr-dot">.</span>
          </h1>
        </div>
        <motion.button
          className={`focus-toggle ${focusMode ? "on" : ""}`}
          onClick={() => setFocusMode(f => !f)}
          whileTap={{ scale: 0.94 }}
        >
          <Focus size={14} />
          <span>Focus</span>
        </motion.button>
      </div>

      <div className="hdr-meta">
        <button className="time-pill" onClick={() => setPaused(p => !p)}>
          <span className={`pulse ${paused ? "paused" : ""}`} />
          <span className="time-str">{fmt(now)}</span>
          <span className="time-hint">{paused ? "paused" : "live"}</span>
        </button>
      </div>
    </header>
  );
}

/* ============================================================
   ACTIVE CARD — the "right now" hero
   ============================================================ */
function ActiveCard({ active, now, onComplete, onTap }) {
  if (!active) {
    return (
      <motion.div
        className="active-card empty"
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Waves size={18} className="ac-empty-icon" />
        <div>
          <div className="ac-empty-title">Open moment</div>
          <div className="ac-empty-sub">Nothing scheduled — time is yours.</div>
        </div>
      </motion.div>
    );
  }

  const cat = CATEGORIES[active.category];
  const Icon = cat.icon;
  const elapsed = now - active.start;
  const progress = Math.min(1, Math.max(0, elapsed / active.duration));
  const remaining = Math.max(0, active.duration - elapsed);
  const urgent = remaining < 10;

  return (
    <motion.div
      layout
      className="active-card"
      style={{
        "--cat": cat.color,
        "--glow": cat.glow,
      }}
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 220, damping: 24 }}
      onClick={onTap}
    >
      <div className="ac-glow" />
      <div className="ac-header">
        <div className="ac-icon-wrap">
          <Icon size={14} strokeWidth={2.25} />
        </div>
        <span className="ac-label">Now · {cat.label}</span>
        <span className={`ac-remaining ${urgent ? "urgent" : ""}`}>
          {remaining < 1 ? "wrapping up" : `${Math.ceil(remaining)}m left`}
        </span>
      </div>

      <h2 className="ac-title">{active.title}</h2>

      <div className="ac-progress-wrap">
        <motion.div
          className="ac-progress"
          initial={{ width: 0 }}
          animate={{ width: `${progress * 100}%` }}
          transition={{ type: "spring", stiffness: 60, damping: 20 }}
        />
        <div className="ac-progress-dots">
          <span>{fmt(active.start)}</span>
          <span>{fmt(active.start + active.duration)}</span>
        </div>
      </div>

      <motion.button
        className="ac-complete"
        whileTap={{ scale: 0.95 }}
        onClick={(e) => { e.stopPropagation(); onComplete(active.id); }}
      >
        <Check size={14} strokeWidth={2.5} />
        <span>Mark done</span>
      </motion.button>
    </motion.div>
  );
}

/* ============================================================
   TIMELINE — the scrollable living day
   ============================================================ */
function Timeline({ tasks, now, onSelect, onComplete, focusMode }) {
  const dayStart = 360; // 6am
  const dayEnd = 1380;  // 11pm
  const minuteHeight = 1.4; // px per minute
  const totalHeight = (dayEnd - dayStart) * minuteHeight;

  // Build hour markers
  const hours = [];
  for (let h = Math.ceil(dayStart / 60); h <= Math.floor(dayEnd / 60); h++) {
    hours.push(h * 60);
  }

  const nowY = (now - dayStart) * minuteHeight;
  const visibleNow = now >= dayStart && now <= dayEnd;

  // Group deep-work tasks for focus mode
  const sortedTasks = [...tasks].sort((a, b) => a.start - b.start);

  return (
    <div className="timeline-card">
      <div className="tl-header">
        <span className="tl-title">Today's flow</span>
        <span className="tl-meta">{tasks.filter(t => t.status === "done").length} / {tasks.length} complete</span>
      </div>

      <div className="timeline" style={{ height: totalHeight }}>
        {/* Hour grid */}
        {hours.map(h => (
          <div
            key={h}
            className="tl-hour"
            style={{ top: (h - dayStart) * minuteHeight }}
          >
            <span className="tl-hour-label">{fmtShort(h)}</span>
            <div className="tl-hour-line" />
          </div>
        ))}

        {/* Focus mode overlay — shades non-deep blocks */}
        {focusMode && (
          <motion.div
            className="tl-focus-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
        )}

        {/* Task blocks */}
        <LayoutGroup>
          <AnimatePresence>
            {sortedTasks.map(task => (
              <TaskBlock
                key={task.id}
                task={task}
                dayStart={dayStart}
                minuteHeight={minuteHeight}
                onSelect={onSelect}
                onComplete={onComplete}
                now={now}
                dimmed={focusMode && task.category !== "deep" && task.status !== "done"}
              />
            ))}
          </AnimatePresence>
        </LayoutGroup>

        {/* NOW line */}
        {visibleNow && (
          <motion.div
            className="now-line"
            layout
            animate={{ top: nowY }}
            transition={{ type: "spring", stiffness: 120, damping: 22 }}
          >
            <div className="now-dot" />
            <div className="now-bar" />
            <span className="now-label">now</span>
          </motion.div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   TASK BLOCK
   ============================================================ */
function TaskBlock({ task, dayStart, minuteHeight, onSelect, onComplete, now, dimmed }) {
  const cat = CATEGORIES[task.category];
  const Icon = cat.icon;
  const top = (task.start - dayStart) * minuteHeight;
  const height = Math.max(38, task.duration * minuteHeight - 4);

  const isDone = task.status === "done";
  const isActive = task.status === "active";
  const isMissed = task.status === "missed";

  const elapsed = isActive ? now - task.start : 0;
  const progress = isActive ? Math.min(1, elapsed / task.duration) : isDone ? 1 : 0;

  return (
    <motion.div
      layout="position"
      layoutId={task.id}
      initial={task.justAdded ? { opacity: 0, scale: 0.8, x: -20 } : false}
      animate={{
        opacity: dimmed ? 0.34 : isDone ? 0.72 : 1,
        scale: 1,
        x: 0,
      }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      className={`task-block ${task.status} ${task.shifted ? "shifted" : ""} ${task.justAdded ? "just-added" : ""}`}
      style={{
        top,
        height,
        "--cat": cat.color,
        "--glow": cat.glow,
      }}
      onClick={() => onSelect(task)}
      whileHover={{ x: 2 }}
    >
      {/* Vertical category bar */}
      <div className="tb-bar" />

      {/* Active progress fill */}
      {isActive && (
        <motion.div
          className="tb-progress-fill"
          initial={{ height: 0 }}
          animate={{ height: `${progress * 100}%` }}
          transition={{ type: "spring", stiffness: 40, damping: 18 }}
        />
      )}

      <div className="tb-body">
        <div className="tb-top">
          <div className="tb-icon"><Icon size={11} strokeWidth={2.2} /></div>
          <span className="tb-time">{fmtShort(task.start)}</span>
          {task.shifted && (
            <motion.span className="tb-shifted" initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}>
              <ArrowRight size={8} /> shifted
            </motion.span>
          )}
          {isMissed && <span className="tb-missed">slipped</span>}
          {task.priority === 4 && <Flame size={10} className="tb-flame" />}
        </div>
        <div className={`tb-title ${isDone ? "done" : ""}`}>{task.title}</div>
        {height > 60 && (
          <div className="tb-meta">
            <Clock size={9} strokeWidth={2} />
            <span>{task.duration}m</span>
          </div>
        )}
      </div>

      {/* Swipe-to-complete affordance (simulated via tap on checkmark for web) */}
      {(isActive || task.status === "upcoming") && height > 44 && (
        <motion.button
          className="tb-check"
          whileTap={{ scale: 0.88 }}
          onClick={(e) => { e.stopPropagation(); onComplete(task.id); }}
        >
          <Check size={12} strokeWidth={2.5} />
        </motion.button>
      )}

      {isDone && (
        <div className="tb-check done"><Check size={12} strokeWidth={2.5} /></div>
      )}
    </motion.div>
  );
}

/* ============================================================
   UP NEXT strip
   ============================================================ */
function UpNext({ tasks, now }) {
  if (tasks.length === 0) return null;
  return (
    <div className="upnext">
      <div className="upnext-hdr">
        <Sparkles size={12} />
        <span>Up next</span>
      </div>
      <div className="upnext-items">
        {tasks.map((t, i) => {
          const cat = CATEGORIES[t.category];
          const until = t.start - now;
          return (
            <motion.div
              key={t.id}
              className="upnext-item"
              style={{ "--cat": cat.color }}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06, type: "spring", stiffness: 200, damping: 22 }}
            >
              <div className="upnext-time">
                <div className="upnext-start">{fmtShort(t.start)}</div>
                <div className="upnext-in">in {until}m</div>
              </div>
              <div className="upnext-body">
                <div className="upnext-title">{t.title}</div>
                <div className="upnext-cat">{cat.label} · {t.duration}m</div>
              </div>
              <ChevronRight size={14} className="upnext-chev" />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   INSIGHT TOAST — the AI "voice"
   ============================================================ */
function InsightToast({ insight, onReschedule, onDismiss }) {
  const icon = insight.type === "missed" ? AlertCircle : insight.type === "win" ? Sparkles : insight.type === "warn" ? AlertCircle : Zap;
  const Icon = icon;

  return (
    <motion.div
      className={`insight ${insight.type}`}
      initial={{ y: 80, opacity: 0, scale: 0.95 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: 80, opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 240, damping: 24 }}
    >
      <div className="insight-icon"><Icon size={14} strokeWidth={2.25} /></div>
      <div className="insight-body">
        <div className="insight-msg">{insight.message}</div>
      </div>
      {insight.type === "missed" && insight.taskId && (
        <button className="insight-action" onClick={() => onReschedule(insight.taskId)}>
          Reschedule
        </button>
      )}
      <button className="insight-close" onClick={onDismiss}><X size={12} /></button>
    </motion.div>
  );
}

/* ============================================================
   COMPOSE SHEET — add task modal
   ============================================================ */
function ComposeSheet({ onClose, onAdd, tasks, now }) {
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(45);
  const [category, setCategory] = useState("deep");
  const [priority, setPriority] = useState(2);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Preview where the task would land
  const preview = useMemo(() => {
    if (!title.trim()) return null;
    return autoSchedule({ title, duration, category, priority }, tasks, now);
  }, [title, duration, category, priority, tasks, now]);

  const submit = () => {
    if (!title.trim()) return;
    onAdd({ title: title.trim(), duration, category, priority });
  };

  return (
    <>
      <motion.div
        className="sheet-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="sheet"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 34 }}
      >
        <div className="sheet-handle" />
        <div className="sheet-header">
          <div className="sheet-title">New task</div>
          <button className="sheet-close" onClick={onClose}><X size={16} /></button>
        </div>

        <input
          ref={inputRef}
          className="compose-input"
          placeholder="What needs doing?"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submit()}
        />

        <div className="compose-row">
          <div className="compose-label">Category</div>
          <div className="chip-row">
            {Object.entries(CATEGORIES).map(([key, cat]) => {
              const Icon = cat.icon;
              return (
                <motion.button
                  key={key}
                  className={`chip ${category === key ? "active" : ""}`}
                  style={{ "--cat": cat.color }}
                  onClick={() => setCategory(key)}
                  whileTap={{ scale: 0.94 }}
                >
                  <Icon size={11} />
                  <span>{cat.label}</span>
                </motion.button>
              );
            })}
          </div>
        </div>

        <div className="compose-row">
          <div className="compose-label">Duration</div>
          <div className="chip-row">
            {[15, 30, 45, 60, 90, 120].map(d => (
              <motion.button
                key={d}
                className={`chip duration ${duration === d ? "active" : ""}`}
                onClick={() => setDuration(d)}
                whileTap={{ scale: 0.94 }}
              >
                {d < 60 ? `${d}m` : `${d / 60}h${d % 60 ? ` ${d % 60}m` : ""}`}
              </motion.button>
            ))}
          </div>
        </div>

        <div className="compose-row">
          <div className="compose-label">Priority</div>
          <div className="chip-row">
            {Object.entries(PRIORITIES).map(([k, p]) => (
              <motion.button
                key={k}
                className={`chip ${priority === Number(k) ? "active" : ""}`}
                onClick={() => setPriority(Number(k))}
                whileTap={{ scale: 0.94 }}
              >
                {p.label}
              </motion.button>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {preview && (
            <motion.div
              key="preview"
              className="preview"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
            >
              <Sparkles size={12} />
              <span>{preview.reason}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          className="submit-btn"
          onClick={submit}
          whileTap={{ scale: 0.97 }}
          disabled={!title.trim()}
        >
          <Zap size={14} strokeWidth={2.5} />
          <span>Schedule intelligently</span>
        </motion.button>
      </motion.div>
    </>
  );
}

/* ============================================================
   DETAIL SHEET
   ============================================================ */
function DetailSheet({ task, onClose, onComplete, onReschedule }) {
  const cat = CATEGORIES[task.category];
  const Icon = cat.icon;
  return (
    <>
      <motion.div
        className="sheet-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="sheet"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 34 }}
        style={{ "--cat": cat.color }}
      >
        <div className="sheet-handle" />
        <div className="detail-cat">
          <div className="detail-cat-icon"><Icon size={12} /></div>
          <span>{cat.label}</span>
          {task.priority >= 3 && <span className="detail-prio"><Flame size={10} /> {PRIORITIES[task.priority].label}</span>}
        </div>
        <h2 className="detail-title">{task.title}</h2>

        <div className="detail-meta">
          <div className="detail-meta-item">
            <div className="detail-meta-label">Starts</div>
            <div className="detail-meta-val">{fmt(task.start)}</div>
          </div>
          <div className="detail-meta-div" />
          <div className="detail-meta-item">
            <div className="detail-meta-label">Ends</div>
            <div className="detail-meta-val">{fmt(task.start + task.duration)}</div>
          </div>
          <div className="detail-meta-div" />
          <div className="detail-meta-item">
            <div className="detail-meta-label">Length</div>
            <div className="detail-meta-val">{task.duration}m</div>
          </div>
        </div>

        <div className="detail-actions">
          {task.status !== "done" && (
            <motion.button
              className="detail-btn primary"
              onClick={() => { onComplete(task.id); onClose(); }}
              whileTap={{ scale: 0.96 }}
            >
              <Check size={14} strokeWidth={2.5} />
              <span>Complete now</span>
            </motion.button>
          )}
          {task.status === "missed" && (
            <motion.button
              className="detail-btn"
              onClick={() => { onReschedule(task.id); onClose(); }}
              whileTap={{ scale: 0.96 }}
            >
              <Zap size={14} strokeWidth={2.5} />
              <span>Find new slot</span>
            </motion.button>
          )}
        </div>
      </motion.div>
    </>
  );
}

/* ============================================================
   GLOBAL STYLES
   ============================================================ */
function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600;700&display=swap');

      :root {
        --bg: #f6f8fc;
        --panel: rgba(255, 255, 255, 0.82);
        --panel-solid: #ffffff;
        --border: rgba(100, 116, 139, 0.18);
        --border-strong: rgba(71, 85, 105, 0.26);
        --text: #101827;
        --text-dim: #475569;
        --text-faint: #718096;
        --accent: #7c3aed;
        --accent-soft: rgba(124, 58, 237, 0.1);
        --danger: #dc2626;
        --shadow-soft: 0 18px 48px rgba(15, 23, 42, 0.1);
        --shadow-card: 0 10px 28px rgba(15, 23, 42, 0.08), 0 1px 0 rgba(255,255,255,0.9) inset;
      }

      * { box-sizing: border-box; margin: 0; padding: 0; }

      html, body, #root {
        background: var(--bg);
        color: var(--text);
        font-family: 'Geist', -apple-system, BlinkMacSystemFont, sans-serif;
        font-feature-settings: 'ss01', 'ss02', 'cv11';
        -webkit-font-smoothing: antialiased;
        min-height: 100vh;
      }

      .app-root {
        min-height: 100vh;
        width: 100%;
        position: relative;
        overflow-x: hidden;
        background: var(--bg);
      }

      .ambient-base {
        position: fixed;
        inset: 0;
        z-index: 0;
        transition: background 2s ease;
      }

      .grain {
        position: fixed;
        inset: 0;
        z-index: 1;
        pointer-events: none;
        opacity: 0.045;
        background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
        mix-blend-mode: multiply;
      }

      .shell {
        position: relative;
        z-index: 2;
        max-width: 440px;
        margin: 0 auto;
        padding: 24px 18px 120px;
      }

      .bottom-spacer { height: 60px; }

      /* ---------- Header ---------- */
      .hdr { margin-bottom: 22px; color: var(--text); }
      .hdr-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
      .hdr-date {
        font-size: 11px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #64748b;
        margin-bottom: 6px;
        font-weight: 500;
      }
      .hdr-greeting {
        font-family: 'Instrument Serif', serif;
        font-weight: 400;
        font-size: 38px;
        line-height: 1;
        letter-spacing: -0.02em;
        font-style: italic;
        color: var(--text);
      }
      .hdr-dot { color: var(--accent); font-style: normal; }

      .focus-toggle {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 8px 12px;
        background: rgba(255,255,255,0.82);
        border: 1px solid var(--border);
        border-radius: 100px;
        color: #334155;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.25s ease;
        box-shadow: 0 8px 20px rgba(15, 23, 42, 0.06), 0 1px 0 rgba(255,255,255,0.9) inset;
      }
      .focus-toggle.on {
        background: rgba(124, 58, 237, 0.1);
        border-color: rgba(124, 58, 237, 0.34);
        color: var(--accent);
      }

      .hdr-meta { margin-top: 14px; }
      .time-pill {
        display: inline-flex; align-items: center; gap: 8px;
        padding: 6px 12px 6px 10px;
        background: rgba(255,255,255,0.84);
        border: 1px solid var(--border);
        border-radius: 100px;
        font-size: 11px;
        cursor: pointer;
        font-family: 'Geist', monospace;
        color: var(--text);
        box-shadow: 0 8px 22px rgba(15, 23, 42, 0.06), 0 1px 0 rgba(255,255,255,0.9) inset;
      }
      .pulse {
        width: 6px; height: 6px;
        border-radius: 50%;
        background: #4ADE80;
        box-shadow: 0 0 10px #4ADE80;
        animation: pulse 2s ease-in-out infinite;
      }
      .pulse.paused { background: #9CA3AF; box-shadow: none; animation: none; }
      @keyframes pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.4; transform: scale(0.85); }
      }
      .time-str { color: var(--text); font-variant-numeric: tabular-nums; letter-spacing: 0.02em; }
      .time-hint { color: #64748b; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; }

      /* ---------- Active Card ---------- */
      .active-card {
        position: relative;
        background: linear-gradient(145deg, rgba(255,255,255,0.94), rgba(248,250,252,0.86));
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid var(--border);
        border-radius: 22px;
        padding: 18px;
        margin-bottom: 18px;
        overflow: hidden;
        cursor: pointer;
        color: var(--text);
        box-shadow: var(--shadow-card);
        transition: border-color 0.3s, box-shadow 0.3s;
      }
      .active-card:hover { border-color: var(--border-strong); box-shadow: var(--shadow-soft); }
      .active-card.empty {
        display: flex; align-items: center; gap: 14px;
        padding: 20px 18px;
      }
      .ac-empty-icon { color: var(--accent); }
      .ac-empty-title { font-size: 14px; font-weight: 500; }
      .ac-empty-sub { font-size: 12px; color: var(--text-dim); margin-top: 2px; }

      .ac-glow {
        position: absolute;
        top: -40%; right: -20%;
        width: 70%; height: 140%;
        background: radial-gradient(ellipse, var(--glow) 0%, transparent 64%);
        pointer-events: none;
        animation: breathe 4s ease-in-out infinite;
        opacity: 0.42;
      }
      @keyframes breathe {
        0%, 100% { opacity: 0.32; transform: scale(1); }
        50% { opacity: 0.5; transform: scale(1.08); }
      }
      .ac-header { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; position: relative; z-index: 1; }
      .ac-icon-wrap {
        width: 22px; height: 22px;
        display: flex; align-items: center; justify-content: center;
        background: var(--cat);
        color: #fff;
        border-radius: 7px;
      }
      .ac-label {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--text-dim);
        font-weight: 600;
      }
      .ac-remaining {
        margin-left: auto;
        font-size: 11px;
        color: var(--text-dim);
        font-variant-numeric: tabular-nums;
      }
      .ac-remaining.urgent { color: var(--danger); font-weight: 700; }

      .ac-title {
        font-family: 'Instrument Serif', serif;
        font-size: 26px;
        font-weight: 400;
        line-height: 1.1;
        letter-spacing: -0.015em;
        margin-bottom: 18px;
        position: relative; z-index: 1;
        color: var(--text);
      }

      .ac-progress-wrap {
        position: relative;
        height: 4px;
        background: #e7ecf4;
        border-radius: 100px;
        margin-bottom: 16px;
        overflow: hidden;
      }
      .ac-progress {
        height: 100%;
        background: linear-gradient(90deg, var(--cat), color-mix(in srgb, var(--cat) 70%, white));
        border-radius: 100px;
        box-shadow: 0 0 12px var(--glow);
      }
      .ac-progress-dots {
        display: flex; justify-content: space-between;
        margin-top: 6px;
        font-size: 10px;
        color: #64748b;
        font-variant-numeric: tabular-nums;
      }

      .ac-complete {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 9px 14px;
        background: #fff;
        border: 1px solid var(--border-strong);
        border-radius: 100px;
        color: var(--text);
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        box-shadow: 0 8px 20px rgba(15, 23, 42, 0.06);
        transition: background 0.2s, border-color 0.2s;
      }
      .ac-complete:hover { background: #f8fafc; border-color: rgba(124, 58, 237, 0.32); }

      /* ---------- Timeline ---------- */
      .timeline-card {
        background: rgba(255,255,255,0.78);
        backdrop-filter: blur(16px);
        border: 1px solid var(--border);
        border-radius: 22px;
        padding: 16px 12px 20px 12px;
        margin-bottom: 18px;
        box-shadow: var(--shadow-card);
      }
      .tl-header {
        display: flex; justify-content: space-between; align-items: center;
        padding: 4px 8px 14px 8px;
      }
      .tl-title {
        font-size: 11px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--text-dim);
        font-weight: 600;
      }
      .tl-meta { font-size: 11px; color: #64748b; font-variant-numeric: tabular-nums; font-weight: 600; }

      .timeline {
        position: relative;
        padding-left: 48px;
        padding-right: 8px;
      }

      .tl-hour {
        position: absolute;
        left: 0;
        right: 0;
        display: flex;
        align-items: center;
        pointer-events: none;
      }
      .tl-hour-label {
        width: 42px;
        font-size: 10px;
        color: #64748b;
        font-variant-numeric: tabular-nums;
        letter-spacing: 0.02em;
      }
      .tl-hour-line {
        flex: 1;
        height: 1px;
        background: linear-gradient(90deg, rgba(100,116,139,0.18) 0%, rgba(148,163,184,0.1) 80%, transparent 100%);
      }

      .tl-focus-overlay {
        position: absolute;
        inset: 0;
        background: rgba(255,255,255,0.62);
        box-shadow: inset 0 0 0 1px rgba(124,58,237,0.08);
        pointer-events: none;
        border-radius: 12px;
      }

      .task-block {
        position: absolute;
        left: 48px;
        right: 8px;
        background: linear-gradient(135deg, #ffffff, #f8fafc);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 8px 10px 8px 16px;
        cursor: pointer;
        overflow: hidden;
        display: flex;
        align-items: flex-start;
        box-shadow: 0 7px 18px rgba(15, 23, 42, 0.07);
        transition: border-color 0.25s, background 0.25s, box-shadow 0.25s;
      }
      .task-block:hover { border-color: var(--border-strong); box-shadow: 0 10px 24px rgba(15, 23, 42, 0.1); }
      .task-block.active {
        border-color: var(--cat);
        background: linear-gradient(135deg, color-mix(in srgb, var(--cat) 9%, #ffffff), #ffffff);
        box-shadow: 0 0 0 1px color-mix(in srgb, var(--cat) 72%, transparent), 0 12px 30px color-mix(in srgb, var(--cat) 18%, rgba(15,23,42,0.08));
      }
      .task-block.missed {
        border-color: rgba(220, 38, 38, 0.24);
        background: linear-gradient(135deg, #fff1f2, #ffffff);
      }
      .task-block.done {
        background: linear-gradient(135deg, #f8fafc, #f1f5f9);
        border-color: rgba(148, 163, 184, 0.22);
      }
      .task-block.just-added {
        animation: glow-in 1.8s ease-out;
      }
      @keyframes glow-in {
        0% { box-shadow: 0 0 0 3px var(--glow), 0 8px 40px var(--glow); }
        100% { box-shadow: 0 0 0 0 transparent; }
      }
      .task-block.shifted { border-style: dashed; }

      .tb-bar {
        position: absolute;
        left: 0; top: 0; bottom: 0;
        width: 3px;
        background: var(--cat);
        box-shadow: 0 0 10px color-mix(in srgb, var(--cat) 28%, transparent);
      }
      .tb-progress-fill {
        position: absolute;
        left: 0; top: 0;
        width: 100%;
        background: linear-gradient(180deg, transparent, color-mix(in srgb, var(--cat) 15%, transparent));
        opacity: 0.55;
        pointer-events: none;
      }

      .tb-body { flex: 1; min-width: 0; position: relative; z-index: 1; }
      .tb-top {
        display: flex; align-items: center; gap: 6px;
        margin-bottom: 2px;
        font-size: 10px;
        color: var(--text-dim);
      }
      .tb-icon {
        width: 14px; height: 14px;
        display: flex; align-items: center; justify-content: center;
        background: var(--cat);
        color: #fff;
        border-radius: 4px;
      }
      .tb-time {
        font-variant-numeric: tabular-nums;
        color: var(--text-dim);
        font-weight: 500;
      }
      .tb-shifted {
        display: inline-flex; align-items: center; gap: 2px;
        padding: 1px 5px;
        background: rgba(124, 58, 237, 0.09);
        color: var(--accent);
        border: 1px solid rgba(124, 58, 237, 0.18);
        border-radius: 4px;
        font-size: 9px;
        font-weight: 500;
      }
      .tb-missed {
        padding: 1px 5px;
        background: rgba(220, 38, 38, 0.09);
        color: var(--danger);
        border: 1px solid rgba(220, 38, 38, 0.16);
        border-radius: 4px;
        font-size: 9px;
        font-weight: 500;
      }
      .tb-flame { color: #F59E0B; }
      .tb-title {
        font-size: 13px;
        font-weight: 500;
        line-height: 1.25;
        color: var(--text);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .tb-title.done { text-decoration: line-through; text-decoration-color: #94a3b8; color: #64748b; }
      .tb-meta {
        display: flex; align-items: center; gap: 4px;
        margin-top: 4px;
        font-size: 10px;
        color: #64748b;
      }

      .tb-check {
        width: 20px; height: 20px;
        border-radius: 50%;
        background: #ffffff;
        border: 1px solid var(--border-strong);
        color: transparent;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer;
        transition: all 0.2s;
        flex-shrink: 0;
        margin-left: 8px;
      }
      .tb-check:hover { color: var(--text); background: #f8fafc; border-color: var(--cat); }
      .tb-check.done {
        background: var(--cat);
        border-color: var(--cat);
        color: #fff;
      }

      /* ---------- NOW line ---------- */
      .now-line {
        position: absolute;
        left: 0; right: 0;
        display: flex;
        align-items: center;
        pointer-events: none;
        z-index: 5;
        transform: translateY(-1px);
      }
      .now-dot {
        width: 8px; height: 8px;
        border-radius: 50%;
        background: var(--accent);
        box-shadow: 0 0 12px rgba(124, 58, 237, 0.38), 0 0 0 3px rgba(124, 58, 237, 0.12);
        margin-left: 40px;
        animation: now-pulse 2s ease-in-out infinite;
      }
      @keyframes now-pulse {
        0%, 100% { box-shadow: 0 0 12px rgba(124, 58, 237, 0.38), 0 0 0 3px rgba(124, 58, 237, 0.12); }
        50% { box-shadow: 0 0 18px rgba(124, 58, 237, 0.54), 0 0 0 6px rgba(124, 58, 237, 0.12); }
      }
      .now-bar {
        flex: 1;
        height: 1.5px;
        background: linear-gradient(90deg, rgba(124, 58, 237, 0.72) 0%, rgba(124, 58, 237, 0.2) 65%, transparent 100%);
        margin-left: 4px;
      }
      .now-label {
        position: absolute;
        left: 6px;
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--text);
        font-weight: 600;
        background: #ffffff;
        padding: 1px 4px;
        border-radius: 3px;
        box-shadow: 0 0 0 1px rgba(124, 58, 237, 0.12);
      }

      /* ---------- Up Next ---------- */
      .upnext { margin-top: 4px; }
      .upnext-hdr {
        display: flex; align-items: center; gap: 6px;
        padding: 0 4px 10px 4px;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--text-dim);
        font-weight: 600;
      }
      .upnext-items { display: flex; flex-direction: column; gap: 6px; }
      .upnext-item {
        display: flex; align-items: center; gap: 14px;
        padding: 12px 14px;
        background: rgba(255,255,255,0.84);
        border: 1px solid var(--border);
        border-radius: 14px;
        cursor: pointer;
        box-shadow: 0 8px 22px rgba(15, 23, 42, 0.06);
        transition: background 0.2s, border-color 0.2s, box-shadow 0.2s;
      }
      .upnext-item:hover { background: #ffffff; border-color: var(--border-strong); box-shadow: 0 12px 28px rgba(15, 23, 42, 0.09); }
      .upnext-time {
        position: relative;
        padding-right: 14px;
      }
      .upnext-time::after {
        content: '';
        position: absolute;
        right: 0; top: 3px; bottom: 3px;
        width: 2px;
        background: var(--cat);
        border-radius: 2px;
      }
      .upnext-start {
        font-size: 13px;
        font-weight: 600;
        color: var(--text);
        font-variant-numeric: tabular-nums;
      }
      .upnext-in { font-size: 10px; color: #64748b; margin-top: 1px; font-weight: 600; }
      .upnext-body { flex: 1; min-width: 0; }
      .upnext-title {
        font-size: 13px;
        font-weight: 500;
        color: var(--text);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .upnext-cat { font-size: 11px; color: #64748b; margin-top: 2px; }
      .upnext-chev { color: #94a3b8; }

      /* ---------- FAB ---------- */
      .fab {
        position: fixed;
        bottom: 28px;
        left: 50%;
        transform: translateX(-50%);
        width: 54px;
        height: 54px;
        border-radius: 50%;
        background: linear-gradient(135deg, #8b5cf6, #6d28d9);
        color: #fff;
        border: none;
        cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        box-shadow:
          0 1px 0 rgba(255,255,255,0.32) inset,
          0 16px 34px rgba(109, 40, 217, 0.28),
          0 0 0 1px rgba(109, 40, 217, 0.18);
        z-index: 50;
      }

      /* ---------- Insight toast ---------- */
      .insight {
        position: fixed;
        left: 50%;
        transform: translateX(-50%);
        bottom: 100px;
        max-width: 400px;
        width: calc(100% - 40px);
        display: flex; align-items: center; gap: 10px;
        padding: 12px 14px;
        background: rgba(255, 255, 255, 0.94);
        backdrop-filter: blur(24px);
        border: 1px solid var(--border-strong);
        border-radius: 14px;
        box-shadow: 0 20px 46px rgba(15, 23, 42, 0.16);
        z-index: 60;
      }
      .insight.win { border-color: rgba(5, 150, 105, 0.28); background: linear-gradient(135deg, #ffffff, #f0fdf4); }
      .insight.missed, .insight.warn { border-color: rgba(220, 38, 38, 0.26); background: linear-gradient(135deg, #ffffff, #fff1f2); }
      .insight-icon {
        width: 26px; height: 26px;
        display: flex; align-items: center; justify-content: center;
        background: var(--accent-soft);
        color: var(--accent);
        border-radius: 8px;
        flex-shrink: 0;
      }
      .insight.win .insight-icon { background: rgba(5, 150, 105, 0.12); color: #047857; }
      .insight.missed .insight-icon, .insight.warn .insight-icon { background: rgba(220, 38, 38, 0.1); color: var(--danger); }
      .insight-body { flex: 1; min-width: 0; }
      .insight-msg { font-size: 12.5px; line-height: 1.35; color: var(--text); }
      .insight-action {
        padding: 6px 10px;
        background: linear-gradient(135deg, #8b5cf6, #6d28d9);
        color: #fff;
        border: none;
        border-radius: 8px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        font-family: inherit;
      }
      .insight-close {
        width: 24px; height: 24px;
        display: flex; align-items: center; justify-content: center;
        background: transparent;
        border: none;
        color: #64748b;
        cursor: pointer;
        border-radius: 6px;
      }
      .insight-close:hover { background: rgba(15,23,42,0.05); color: var(--text); }

      /* ---------- Sheet (modal) ---------- */
      .sheet-backdrop {
        position: fixed; inset: 0;
        background: rgba(15, 23, 42, 0.34);
        backdrop-filter: blur(8px);
        z-index: 100;
      }
      .sheet {
        position: fixed;
        bottom: 0; left: 50%;
        transform: translateX(-50%);
        max-width: 440px;
        width: 100%;
        background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
        border-top: 1px solid var(--border-strong);
        border-radius: 24px 24px 0 0;
        padding: 12px 20px 28px;
        z-index: 101;
        max-height: 85vh;
        overflow-y: auto;
        box-shadow: 0 -20px 48px rgba(15, 23, 42, 0.18);
        color: var(--text);
      }
      .sheet-handle {
        width: 36px; height: 4px;
        background: #cbd5e1;
        border-radius: 100px;
        margin: 0 auto 16px;
      }
      .sheet-header {
        display: flex; justify-content: space-between; align-items: center;
        margin-bottom: 16px;
      }
      .sheet-title {
        font-family: 'Instrument Serif', serif;
        font-size: 24px;
        font-style: italic;
        letter-spacing: -0.01em;
      }
      .sheet-close {
        width: 30px; height: 30px;
        background: #ffffff;
        border: 1px solid var(--border);
        border-radius: 50%;
        color: var(--text-dim);
        cursor: pointer;
        display: flex; align-items: center; justify-content: center;
      }

      .compose-input {
        width: 100%;
        background: transparent;
        border: none;
        outline: none;
        font-family: 'Instrument Serif', serif;
        font-size: 28px;
        color: var(--text);
        padding: 10px 0 16px;
        border-bottom: 1px solid var(--border);
        margin-bottom: 20px;
        font-style: italic;
      }
      .compose-input::placeholder { color: #94a3b8; }

      .compose-row { margin-bottom: 18px; }
      .compose-label {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--text-dim);
        margin-bottom: 8px;
        font-weight: 600;
      }
      .chip-row {
        display: flex; flex-wrap: wrap; gap: 6px;
      }
      .chip {
        display: inline-flex; align-items: center; gap: 5px;
        padding: 7px 11px;
        background: #ffffff;
        border: 1px solid var(--border);
        border-radius: 100px;
        color: var(--text-dim);
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        font-family: inherit;
        box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04);
      }
      .chip:hover { background: #f8fafc; color: var(--text); border-color: var(--border-strong); }
      .chip.active {
        background: color-mix(in srgb, var(--cat, var(--text)) 12%, #ffffff);
        border-color: var(--cat, var(--text));
        color: var(--cat, var(--text));
        box-shadow: 0 8px 18px color-mix(in srgb, var(--cat, #7c3aed) 14%, transparent);
      }
      .chip.duration.active {
        background: rgba(124, 58, 237, 0.1);
        border-color: rgba(124, 58, 237, 0.36);
        color: var(--accent);
      }

      .preview {
        display: flex; align-items: center; gap: 8px;
        padding: 12px 14px;
        background: rgba(124, 58, 237, 0.08);
        border: 1px solid rgba(124, 58, 237, 0.22);
        border-radius: 12px;
        margin-bottom: 16px;
        font-size: 12.5px;
        color: var(--accent);
        line-height: 1.35;
      }

      .submit-btn {
        width: 100%;
        display: inline-flex; align-items: center; justify-content: center; gap: 8px;
        padding: 14px;
        background: linear-gradient(135deg, #8b5cf6, #6d28d9);
        border: none;
        border-radius: 14px;
        color: #fff;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        font-family: inherit;
        box-shadow: 0 1px 0 rgba(255,255,255,0.28) inset, 0 12px 28px rgba(109, 40, 217, 0.24);
      }
      .submit-btn:disabled { opacity: 0.4; cursor: not-allowed; }

      /* ---------- Detail sheet ---------- */
      .detail-cat {
        display: inline-flex; align-items: center; gap: 6px;
        font-size: 11px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--text-dim);
        margin-bottom: 10px;
        font-weight: 600;
      }
      .detail-cat-icon {
        width: 18px; height: 18px;
        display: flex; align-items: center; justify-content: center;
        background: var(--cat);
        color: #fff;
        border-radius: 5px;
      }
      .detail-prio {
        display: inline-flex; align-items: center; gap: 3px;
        margin-left: 6px;
        padding: 2px 7px;
        background: rgba(217, 119, 6, 0.12);
        color: #b45309;
        border-radius: 100px;
        font-size: 10px;
      }
      .detail-title {
        font-family: 'Instrument Serif', serif;
        font-size: 32px;
        font-weight: 400;
        font-style: italic;
        letter-spacing: -0.015em;
        line-height: 1.1;
        margin-bottom: 24px;
      }
      .detail-meta {
        display: flex; align-items: center;
        padding: 14px 16px;
        background: #ffffff;
        border: 1px solid var(--border);
        border-radius: 14px;
        margin-bottom: 20px;
        box-shadow: 0 8px 18px rgba(15, 23, 42, 0.05);
      }
      .detail-meta-item { flex: 1; }
      .detail-meta-label {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: #64748b;
        margin-bottom: 4px;
        font-weight: 600;
      }
      .detail-meta-val {
        font-size: 14px;
        font-weight: 500;
        font-variant-numeric: tabular-nums;
      }
      .detail-meta-div { width: 1px; height: 30px; background: var(--border); }
      .detail-actions { display: flex; gap: 8px; }
      .detail-btn {
        flex: 1;
        display: inline-flex; align-items: center; justify-content: center; gap: 6px;
        padding: 13px;
        background: #ffffff;
        border: 1px solid var(--border-strong);
        border-radius: 12px;
        color: var(--text);
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        font-family: inherit;
      }
      .detail-btn.primary {
        background: linear-gradient(135deg, #8b5cf6, #6d28d9);
        color: #fff;
        border-color: transparent;
        box-shadow: 0 12px 28px rgba(109, 40, 217, 0.22);
      }

      @media (max-width: 380px) {
        .hdr-greeting { font-size: 32px; }
        .ac-title { font-size: 22px; }
      }
    `}</style>
  );
}
