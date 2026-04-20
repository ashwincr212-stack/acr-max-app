import { useState, useMemo } from 'react';
import { fmt } from '../../utils/plannerUtils';

export default function MonthView({ tasks, categories, onDayPress }) {
  const [monthOffset, setMonthOffset] = useState(0);

  const today = new Date();
  const displayMonth = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const year = displayMonth.getFullYear();
  const month = displayMonth.getMonth();

  const monthLabel = displayMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const todayStr = fmt(today);

  const tasksByDate = useMemo(() => {
    const map = {};
    tasks.filter(t => !t.isInbox && t.date).forEach(t => {
      if (!map[t.date]) map[t.date] = [];
      map[t.date].push(t);
    });
    return map;
  }, [tasks]);

  const currentMonthTaskCount = useMemo(() => {
    return tasks.filter(t => {
      if (!t.date || t.isInbox) return false;
      const d = new Date(t.date + 'T00:00:00');
      return d.getFullYear() === year && d.getMonth() === month;
    }).length;
  }, [tasks, year, month]);

  const getCat = (id) => categories.find(c => c.id === id);

  // Build cells: prev month spillover + current month + next month spillover
  const cells = [];
  for (let i = 0; i < firstDay; i++) {
    cells.push({ day: daysInPrevMonth - firstDay + 1 + i, currentMonth: false, date: null });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    cells.push({ day: d, currentMonth: true, date });
  }
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    cells.push({ day: d, currentMonth: false, date: null });
  }

  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="view-scroll">
      {/* Month nav */}
      <div className="month-nav-bar">
        <button className="week-nav-arrow" onClick={() => setMonthOffset(o => o - 1)} aria-label="Previous month">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M11 13L7 9l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <span className="month-nav-label">{monthLabel}</span>
        <button className="week-nav-arrow" onClick={() => setMonthOffset(o => o + 1)} aria-label="Next month">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M7 5l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Day of week headers */}
      <div className="month-dow-row">
        {DOW.map(d => (
          <div key={d} className="month-dow-label">{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div className="month-grid">
        {cells.map((cell, idx) => {
          if (!cell.currentMonth || !cell.date) {
            return (
              <div key={idx} className="month-cell month-cell--other">
                <span className="month-cell-num">{cell.day}</span>
              </div>
            );
          }

          const ds = fmt(cell.date);
          const dayTasks = tasksByDate[ds] || [];
          const isToday = ds === todayStr;
          const completedCount = dayTasks.filter(t => t.completed).length;
          const overloaded = dayTasks.filter(t => !t.completed).length >= 4;

          return (
            <button
              key={idx}
              className={`month-cell${isToday ? ' month-cell--today' : ''}${overloaded ? ' month-cell--overload' : ''}`}
              onClick={() => onDayPress(cell.date)}
            >
              <span className={`month-cell-num${isToday ? ' month-cell-num--today' : ''}`}>{cell.day}</span>
              {dayTasks.slice(0, 2).map(task => {
                const cat = getCat(task.category);
                return (
                  <span
                    key={task.id}
                    className={`month-event-chip${task.completed ? ' completed' : ''}`}
                    style={{ background: cat ? cat.color + '18' : '#f0f0f0', color: cat ? cat.color : '#666', borderLeft: `2px solid ${cat ? cat.color : '#ccc'}` }}
                  >
                    {task.title.length > 10 ? task.title.slice(0, 10) + '…' : task.title}
                  </span>
                );
              })}
              {dayTasks.length > 2 && (
                <span className="month-more">+{dayTasks.length - 2}</span>
              )}
              {dayTasks.length > 0 && completedCount > 0 && completedCount === dayTasks.length && (
                <span className="month-all-done">✓</span>
              )}
            </button>
          );
        })}
      </div>

      {currentMonthTaskCount === 0 && (
        <div className="empty-state empty-state--compact month-empty-state">
          <div className="empty-state-icon">Month</div>
          <div className="empty-state-title">Nothing scheduled this month</div>
          <div className="empty-state-sub">Tap + to add your first plan</div>
        </div>
      )}

      <div style={{ height: 100 }} />
    </div>
  );
}
