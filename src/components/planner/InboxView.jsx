import { useState } from 'react';
import { fmt } from '../../utils/plannerUtils';

const today = new Date();

export default function InboxView({ items, categories, onSchedule, onDelete }) {
  const [schedulingId, setSchedulingId] = useState(null);
  const [schedDate, setSchedDate] = useState(fmt(today));
  const [schedTime, setSchedTime] = useState('');
  const [schedPriority, setSchedPriority] = useState('none');
  const [schedCategory, setSchedCategory] = useState(categories[0]?.id || 'work');

  const formatRelative = (iso) => {
    const d = new Date(iso);
    const diff = Math.floor((today - d) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    return `${diff} days ago`;
  };

  const handleSchedule = (itemId) => {
    onSchedule(itemId, { date: schedDate, time: schedTime, priority: schedPriority, category: schedCategory });
    setSchedulingId(null);
  };

  return (
    <div className="view-scroll">
      {items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📥</div>
          <div className="empty-state-title">Inbox is clear</div>
          <div className="empty-state-sub">Tap + to capture a quick thought</div>
        </div>
      ) : (
        <div className="inbox-list">
          <div className="inbox-header-note">
            <span className="inbox-count-badge">{items.length}</span>
            <span className="inbox-header-text">items to schedule</span>
          </div>

          {items.map(item => (
            <div key={item.id} className="inbox-item-card">
              <div className="inbox-item-main">
                <div className="inbox-item-icon">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6.5" stroke="#A8A7A2" strokeWidth="1.2"/>
                    <path d="M5 8h6M8 5v6" stroke="#A8A7A2" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                </div>
                <div className="inbox-item-text">
                  <span className="inbox-item-title">{item.title}</span>
                  {item.notes && <span className="inbox-item-notes">{item.notes}</span>}
                  <span className="inbox-item-age">{formatRelative(item.createdAt)}</span>
                </div>
                <div className="inbox-item-actions">
                  {schedulingId !== item.id && (
                    <button
                      className="inbox-btn-schedule"
                      onClick={() => setSchedulingId(item.id)}
                    >
                      Schedule
                    </button>
                  )}
                  <button
                    className="inbox-btn-delete"
                    onClick={() => onDelete(item.id)}
                    aria-label="Delete"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M3 3.5h8M5.5 3.5V3a1 1 0 012 0v.5M6 6v4M8 6v4M3.5 3.5l.5 7.5a.5.5 0 00.5.5h5a.5.5 0 00.5-.5l.5-7.5" stroke="#A8A7A2" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              </div>

              {schedulingId === item.id && (
                <div className="inbox-schedule-panel">
                  <div className="inbox-schedule-row">
                    <div className="inbox-schedule-field">
                      <label>Date</label>
                      <input type="date" value={schedDate} onChange={e => setSchedDate(e.target.value)} />
                    </div>
                    <div className="inbox-schedule-field">
                      <label>Time</label>
                      <input type="time" value={schedTime} onChange={e => setSchedTime(e.target.value)} />
                    </div>
                  </div>
                  <div className="inbox-schedule-row">
                    <div className="inbox-schedule-field">
                      <label>Priority</label>
                      <select value={schedPriority} onChange={e => setSchedPriority(e.target.value)}>
                        <option value="none">None</option>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                    <div className="inbox-schedule-field">
                      <label>Category</label>
                      <select value={schedCategory} onChange={e => setSchedCategory(e.target.value)}>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="inbox-schedule-actions">
                    <button className="inbox-btn-cancel" onClick={() => setSchedulingId(null)}>Cancel</button>
                    <button className="inbox-btn-confirm" onClick={() => handleSchedule(item.id)}>
                      Add to planner →
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <div style={{ height: 100 }} />
    </div>
  );
}