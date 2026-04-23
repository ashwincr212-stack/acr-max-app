import { useState } from 'react';
import { fmt } from '../../utils/plannerUtils';

const PRIORITY_MAP = {
  urgent: { color: '#E24B4A', label: 'Urgent' },
  high: { color: '#D85A30', label: 'High' },
  medium: { color: '#BA7517', label: 'Medium' },
  low: { color: '#3B6D11', label: 'Low' },
  none: null,
};

const today = new Date();

export default function TaskCard({ task, category, onToggle, onDelete, onReschedule, highlight, overdue, showRescheduleToday }) {
  const [expanded, setExpanded] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const priority = PRIORITY_MAP[task.priority];
  const catColor = category?.color || '#A8A7A2';

  const formatTime = (time) => {
    if (!time) return null;
    const [h, m] = time.split(':').map(Number);
    const suffix = h >= 12 ? 'PM' : 'AM';
    const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${hour}:${String(m).padStart(2,'0')} ${suffix}`;
  };

  const handleRescheduleToday = (e) => {
    e.stopPropagation();
    onReschedule(task.id, fmt(today));
    setShowActions(false);
  };

  const handleRescheduleTomorrow = (e) => {
    e.stopPropagation();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    onReschedule(task.id, fmt(tomorrow));
    setShowActions(false);
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    onDelete(task.id);
  };

  const handleToggle = (e) => {
    e.stopPropagation();
    onToggle(task.id);
  };

  return (
    <div
      className={`task-card${highlight ? ' task-card--highlight' : ''}${task.completed ? ' task-card--done' : ''}${overdue ? ' task-card--overdue' : ''}`}
      style={priority ? { borderLeftColor: priority.color } : {}}
      onClick={() => setExpanded(e => !e)}
    >
      <div className="task-card-main">
        <button
          className={`task-check${task.completed ? ' checked' : ''}`}
          onClick={handleToggle}
          aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
        >
          {task.completed && (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 5l2.5 2.5L8 3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>

        <div className="task-card-body">
          <div className="task-card-title-row">
            <span className={`task-card-title${task.completed ? ' done' : ''}`}>{task.title}</span>
            {overdue && !task.completed && <span className="task-state-badge task-state-badge--overdue">Overdue</span>}
            {task.completed && <span className="task-state-badge task-state-badge--done">Done</span>}
          </div>
          <div className="task-card-meta">
            {category && (
              <span className="task-meta-pill" style={{ color: catColor, background: `${catColor}14`, borderColor: `${catColor}26` }}>
                <span className="task-cat-dot" style={{ background: catColor }} />
                {category.name}
              </span>
            )}
            {task.time && <span className="task-meta-text">· {formatTime(task.time)}</span>}
            {task.duration > 0 && <span className="task-meta-text">· {task.duration < 60 ? `${task.duration}m` : `${task.duration/60}h`}</span>}
            {priority && (
              <span className="task-priority-tag" style={{ background: priority.color + '18', color: priority.color }}>
                {priority.label}
              </span>
            )}
          </div>
        </div>

        <button
          className="task-more-btn"
          onClick={e => { e.stopPropagation(); setShowActions(a => !a); }}
          aria-label="More options"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="4" r="1" fill="#A8A7A2"/>
            <circle cx="8" cy="8" r="1" fill="#A8A7A2"/>
            <circle cx="8" cy="12" r="1" fill="#A8A7A2"/>
          </svg>
        </button>
      </div>

      {/* Expanded notes */}
      {expanded && task.notes && (
        <div className="task-card-notes">{task.notes}</div>
      )}

      {/* Action menu */}
      {showActions && (
        <div className="task-actions" onClick={e => e.stopPropagation()}>
          {(overdue || showRescheduleToday) && (
            <button className="task-action-btn" onClick={handleRescheduleToday}>
              Move to Today
            </button>
          )}
          <button className="task-action-btn" onClick={handleRescheduleTomorrow}>
            Move to Tomorrow
          </button>
          <button className="task-action-btn task-action-btn--delete" onClick={handleDelete}>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
