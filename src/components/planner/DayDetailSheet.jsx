import { useEffect } from 'react';
import { fmt } from '../../utils/plannerUtils';

const PRIORITY_COLORS = { urgent: '#E24B4A', high: '#D85A30', medium: '#BA7517', low: '#3B6D11', none: 'transparent' };

export default function DayDetailSheet({ date, tasks, categories, onToggle, onClose, onAddTask }) {
  const dateLabel = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const todayStr = fmt(new Date());
  const isToday = fmt(date) === todayStr;

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const getCat = (id) => categories.find(c => c.id === id);

  const formatTime = (time) => {
    if (!time) return 'All day';
    const [h, m] = time.split(':').map(Number);
    const suffix = h >= 12 ? 'PM' : 'AM';
    const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${hour}:${String(m).padStart(2,'0')} ${suffix}`;
  };

  const sortedTasks = [...tasks].sort((a, b) => {
    if (!a.time && !b.time) return 0;
    if (!a.time) return 1;
    if (!b.time) return -1;
    return a.time.localeCompare(b.time);
  });

  return (
    <div className="sheet-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet sheet--day-detail">
        <div className="sheet-handle" />
        <div className="sheet-header-row">
          <div>
            <div className="day-detail-title">{dateLabel}</div>
            {isToday && <span className="today-badge-small" style={{ marginTop: 4, display: 'inline-block' }}>Today</span>}
          </div>
          <button className="sheet-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="day-detail-task-count">{tasks.length} task{tasks.length !== 1 ? 's' : ''}</div>

        <div className="day-detail-list">
          {sortedTasks.length === 0 ? (
            <div className="day-detail-empty">No tasks on this day</div>
          ) : sortedTasks.map(task => {
            const cat = getCat(task.category);
            return (
              <div key={task.id} className={`day-detail-item${task.completed ? ' done' : ''}`}>
                <button
                  className={`agenda-check${task.completed ? ' checked' : ''}`}
                  onClick={() => onToggle(task.id)}
                >
                  {task.completed && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5l2.5 2.5L8 3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>
                <span className="agenda-cat-dot" style={{ background: cat?.color || '#ccc' }} />
                <div className="day-detail-item-body">
                  <span className={`day-detail-item-title${task.completed ? ' done' : ''}`}>{task.title}</span>
                  <div className="agenda-meta">
                    <span>{formatTime(task.time)}</span>
                    {cat && <span>· {cat.name}</span>}
                    {task.priority !== 'none' && (
                      <span style={{ color: PRIORITY_COLORS[task.priority] }}>· {task.priority}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="sheet-actions" style={{ marginTop: 16 }}>
          <button className="sheet-btn-inbox" onClick={onClose}>Close</button>
          <button className="sheet-btn-schedule" onClick={onAddTask}>+ Add task</button>
        </div>
      </div>
    </div>
  );
}