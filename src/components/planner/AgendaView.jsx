import { useMemo } from 'react';
import { fmt } from '../../utils/plannerUtils';

const PRIORITY_COLORS = { urgent: '#E24B4A', high: '#D85A30', medium: '#BA7517', low: '#3B6D11', none: 'transparent' };

export default function AgendaView({ tasks, categories, onToggle, onDelete }) {
  const today = new Date();
  const todayStr = fmt(today);

  const grouped = useMemo(() => {
    const scheduledTasks = tasks
      .filter(t => !t.isInbox && t.date)
      .sort((a, b) => {
        const dc = a.date.localeCompare(b.date);
        if (dc !== 0) return dc;
        if (!a.time && !b.time) return 0;
        if (!a.time) return 1;
        if (!b.time) return -1;
        return a.time.localeCompare(b.time);
      });

    const groups = [];
    let currentDate = null;

    scheduledTasks.forEach(task => {
      if (task.date !== currentDate) {
        currentDate = task.date;
        groups.push({ date: task.date, tasks: [] });
      }
      groups[groups.length - 1].tasks.push(task);
    });

    return groups;
  }, [tasks]);

  const getCat = (id) => categories.find(c => c.id === id);

  const formatDateHeader = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    const isToday = dateStr === todayStr;
    const isTomorrow = dateStr === fmt(new Date(today.getTime() + 86400000));
    const isYesterday = dateStr === fmt(new Date(today.getTime() - 86400000));
    const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
    const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return { weekday, date, isToday, isTomorrow, isYesterday };
  };

  const formatTime = (time) => {
    if (!time) return 'All day';
    const [h, m] = time.split(':').map(Number);
    const suffix = h >= 12 ? 'PM' : 'AM';
    const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${hour}:${String(m).padStart(2,'0')} ${suffix}`;
  };

  if (grouped.length === 0) {
    return (
      <div className="view-scroll">
        <div className="empty-state">
          <div className="empty-state-icon">Agenda</div>
          <div className="empty-state-title">No tasks yet</div>
          <div className="empty-state-sub">Tap + to schedule something</div>
        </div>
      </div>
    );
  }

  return (
    <div className="view-scroll">
      <div className="agenda-list">
        {grouped.map(group => {
          const { weekday, date, isToday, isTomorrow, isYesterday } = formatDateHeader(group.date);
          const isPast = group.date < todayStr;

          return (
            <div key={group.date} className="agenda-group">
              <div className={`agenda-date-header${isPast && !isToday ? ' past' : ''}`}>
                <div className="agenda-date-left">
                  <span className="agenda-weekday">{isToday ? 'TODAY' : isTomorrow ? 'TOMORROW' : isYesterday ? 'YESTERDAY' : weekday.toUpperCase()}</span>
                  <span className="agenda-date-num">{date}</span>
                </div>
                {isToday && <span className="today-badge-small">Today</span>}
              </div>

              {group.tasks.map(task => {
                const cat = getCat(task.category);
                return (
                  <div key={task.id} className={`agenda-item${task.completed ? ' agenda-item--done' : ''}`}>
                    <span className="agenda-time">{formatTime(task.time)}</span>
                    <span className="agenda-cat-dot" style={{ background: cat?.color || '#ccc' }} />
                    <div className="agenda-body">
                      <span className={`agenda-title${task.completed ? ' done' : ''}`}>{task.title}</span>
                      <div className="agenda-meta">
                        {cat && <span>{cat.name}</span>}
                        {task.duration && <span>· {task.duration < 60 ? `${task.duration}m` : `${task.duration/60}h`}</span>}
                        {task.priority !== 'none' && (
                          <span style={{ color: PRIORITY_COLORS[task.priority] }}>· {task.priority}</span>
                        )}
                      </div>
                    </div>
                    <button
                      className={`agenda-check${task.completed ? ' checked' : ''}`}
                      onClick={() => onToggle(task.id)}
                      aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
                    >
                      {task.completed && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5l2.5 2.5L8 3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <div style={{ height: 100 }} />
    </div>
  );
}
