export const fmt = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const addDays = (date, n) => {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
};

export const getWeekDays = (baseDate, weekOffset = 0) => {
  const d = new Date(baseDate);
  const day = d.getDay();
  d.setDate(d.getDate() - day + weekOffset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const nd = new Date(d);
    nd.setDate(d.getDate() + i);
    return nd;
  });
};

export const getLoadLevel = (tasks) => {
  const active = tasks.filter(t => !t.completed);
  const totalMinutes = active.reduce((sum, t) => sum + (t.duration || 0), 0);
  if (totalMinutes >= 240) return 'high';
  if (totalMinutes >= 120) return 'medium';
  if (totalMinutes > 0) return 'low';
  return 'none';
};

// Simple NLP parser — extracts date/time hints from natural language
export const parseNLP = (input) => {
  const lower = input.toLowerCase();
  const today = new Date();
  const result = { date: null, time: null, hint: '' };

  // Date parsing
  if (/\btoday\b/.test(lower)) {
    result.date = fmt(today);
    result.hint = `Scheduled for today, ${today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  } else if (/\btomorrow\b/.test(lower)) {
    const tom = addDays(today, 1);
    result.date = fmt(tom);
    result.hint = `Scheduled for tomorrow, ${tom.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`;
  } else if (/\bnext week\b/.test(lower)) {
    const nw = addDays(today, 7);
    result.date = fmt(nw);
    result.hint = `Scheduled for next week`;
  } else if (/\bmonday\b/.test(lower)) {
    result.date = fmt(getNextWeekday(today, 1));
    result.hint = `Scheduled for Monday`;
  } else if (/\btuesday\b/.test(lower)) {
    result.date = fmt(getNextWeekday(today, 2));
    result.hint = `Scheduled for Tuesday`;
  } else if (/\bwednesday\b/.test(lower)) {
    result.date = fmt(getNextWeekday(today, 3));
    result.hint = `Scheduled for Wednesday`;
  } else if (/\bthursday\b/.test(lower)) {
    result.date = fmt(getNextWeekday(today, 4));
    result.hint = `Scheduled for Thursday`;
  } else if (/\bfriday\b/.test(lower)) {
    result.date = fmt(getNextWeekday(today, 5));
    result.hint = `Scheduled for Friday`;
  } else if (/\bsaturday\b/.test(lower)) {
    result.date = fmt(getNextWeekday(today, 6));
    result.hint = `Scheduled for Saturday`;
  } else if (/\bsunday\b/.test(lower)) {
    result.date = fmt(getNextWeekday(today, 0));
    result.hint = `Scheduled for Sunday`;
  }

  // Check for "on the Nth" pattern (e.g. "on the 28th")
  const nthMatch = lower.match(/on the (\d+)(?:st|nd|rd|th)?/);
  if (nthMatch) {
    const dayNum = parseInt(nthMatch[1]);
    const target = new Date(today.getFullYear(), today.getMonth(), dayNum);
    if (target < today) target.setMonth(target.getMonth() + 1);
    result.date = fmt(target);
    result.hint = `Scheduled for ${target.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`;
  }

  // Time parsing — e.g. "at 4pm", "at 10:30am"
  const timeMatch = lower.match(/at (\d{1,2})(?::(\d{2}))?\s*(am|pm)/);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1]);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    const ampm = timeMatch[3];
    if (ampm === 'pm' && hours < 12) hours += 12;
    if (ampm === 'am' && hours === 12) hours = 0;
    result.time = `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}`;
    const suffix = hours >= 12 ? 'PM' : 'AM';
    const disp = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    const timeHint = `${disp}:${String(minutes).padStart(2,'0')} ${suffix}`;
    result.hint = result.hint ? `${result.hint} at ${timeHint}` : `Time set to ${timeHint}`;
  }

  return result;
};

function getNextWeekday(from, targetDay) {
  const d = new Date(from);
  const current = d.getDay();
  let diff = targetDay - current;
  if (diff <= 0) diff += 7;
  d.setDate(d.getDate() + diff);
  return d;
}

export const groupTasksByDate = (tasks) => {
  const groups = {};
  tasks.forEach(t => {
    if (!t.date) return;
    if (!groups[t.date]) groups[t.date] = [];
    groups[t.date].push(t);
  });
  return groups;
};

export const formatDuration = (minutes) => {
  if (!minutes) return '';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

export const formatTimeStr = (timeStr) => {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${hour}:${String(m).padStart(2,'0')} ${suffix}`;
};