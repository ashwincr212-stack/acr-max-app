import { useState, useMemo } from 'react';
import TaskCard from './TaskCard';
import { fmt, getWeekDays, getLoadLevel } from '../../utils/plannerUtils';

export default function WeekView({ tasks, categories, onToggle, onDelete, selectedDate, setSelectedDate, onDayPress }) {
  const [weekOffset, setWeekOffset] = useState(0);

  const weekDays = useMemo(() => getWeekDays(new Date(), weekOffset), [weekOffset]);

  const todayStr = fmt(new Date());
  const selectedStr = fmt(selectedDate);

  const getCat = (id) => categories.find(c => c.id === id);

  const getTasksForDay = (dateStr) =>
    tasks.filter(t => t.date === dateStr && !t.isInbox).sort((a, b) => {
      if (!a.time && !b.time) return 0;
      if (!a.time) return 1;
      if (!b.time) return -1;
      return a.time.localeCompare(b.time);
    });

  const weekStart = weekDays[0];
  const weekEnd = weekDays[6];
  const weekLabel = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  const selectedDayTasks = getTasksForDay(selectedStr);

  return (
    <div className="view-scroll">
      {/* Week navigation */}
      <div className="week-nav-bar">
        <button className="week-nav-arrow" onClick={() => setWeekOffset(w => w - 1)} aria-label="Previous week">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M11 13L7 9l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <span className="week-nav-label">{weekLabel}</span>
        <button className="week-nav-arrow" onClick={() => setWeekOffset(w => w + 1)} aria-label="Next week">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M7 5l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* 7-day strip */}
      <div className="week-strip">
        {weekDays.map((day) => {
          const ds = fmt(day);
          const dayTasks = getTasksForDay(ds);
          const load = getLoadLevel(dayTasks);
          const isToday = ds === todayStr;
          const isSelected = ds === selectedStr;
          const overloaded = load === 'high';

          return (
            <button
              key={ds}
              className={`week-day-col${isSelected ? ' selected' : ''}${isToday ? ' today' : ''}`}
              onClick={() => { setSelectedDate(day); }}
            >
              <span className="week-day-name">{day.toLocaleDateString('en-US', { weekday: 'narrow' })}</span>
              <span className={`week-day-num${isToday ? ' today-num' : ''}`}>{day.getDate()}</span>
              <div className="week-load-bar">
                <div
                  className="week-load-fill"
                  style={{
                    height: load === 'high' ? '100%' : load === 'medium' ? '66%' : load === 'low' ? '33%' : '0%',
                    background: overloaded ? '#E24B4A' : isToday ? '#1A6BFF' : '#A8A7A2'
                  }}
                />
              </div>
              {overloaded && <span className="week-overload-dot" />}
            </button>
          );
        })}
      </div>

      {/* Selected day detail */}
      <div className="week-detail">
        <div className="week-detail-header">
          <span className="week-detail-title">
            {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </span>
          {selectedStr === todayStr && <span className="today-badge-small">Today</span>}
          <span className="week-detail-count">{selectedDayTasks.length} task{selectedDayTasks.length !== 1 ? 's' : ''}</span>
        </div>

        {selectedDayTasks.length === 0 ? (
          <div className="week-empty">
            <span>No tasks scheduled</span>
            <span className="week-empty-sub">Tap + to add</span>
          </div>
        ) : (
          selectedDayTasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              category={getCat(task.category)}
              onToggle={onToggle}
              onDelete={() => {}}
              onReschedule={() => {}}
            />
          ))
        )}
      </div>

      <div style={{ height: 100 }} />
    </div>
  );
}