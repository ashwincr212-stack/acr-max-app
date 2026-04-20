import { useState, useEffect, useRef } from 'react';
import { parseNLP, fmt } from '../../utils/plannerUtils';

const PRIORITIES = [
  { id: 'urgent', label: 'Urgent', color: '#E24B4A' },
  { id: 'high', label: 'High', color: '#D85A30' },
  { id: 'medium', label: 'Medium', color: '#BA7517' },
  { id: 'low', label: 'Low', color: '#3B6D11' },
  { id: 'none', label: 'None', color: '#A8A7A2' },
];

const REMIND_OPTIONS = [
  { value: '', label: 'No reminder' },
  { value: '0', label: 'At time' },
  { value: '5', label: '5 min before' },
  { value: '15', label: '15 min before' },
  { value: '30', label: '30 min before' },
  { value: '60', label: '1 hour before' },
  { value: '1440', label: '1 day before' },
];

export default function QuickAddSheet({ categories, onAdd, onClose }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(fmt(new Date()));
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState(30);
  const [priority, setPriority] = useState('none');
  const [category, setCategory] = useState(categories[0]?.id || 'work');
  const [remindAt, setRemindAt] = useState('');
  const [notes, setNotes] = useState('');
  const [nlpHint, setNlpHint] = useState('');
  const [isInbox, setIsInbox] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 150);
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleTitleChange = (val) => {
    setTitle(val);
    const parsed = parseNLP(val);
    if (parsed.hint) setNlpHint(parsed.hint);
    else setNlpHint('');
    if (parsed.date) setDate(parsed.date);
    if (parsed.time) setTime(parsed.time);
  };

  const handleSubmit = (toInbox) => {
    if (!title.trim()) return;
    onAdd({ title: title.trim(), date: toInbox ? '' : date, time: toInbox ? '' : time, duration, priority, category, remindAt, notes, isInbox: toInbox });
  };

  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="sheet-overlay" onClick={handleBackdrop}>
      <div className="sheet">
        <div className="sheet-handle" />
        <div className="sheet-header-row">
          <span className="sheet-title">New Task</span>
          <button className="sheet-close-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <input
          ref={inputRef}
          className="sheet-main-input"
          placeholder='e.g. "Call Raj tomorrow at 4pm"'
          value={title}
          onChange={e => handleTitleChange(e.target.value)}
        />

        {nlpHint && (
          <div className="sheet-nlp-hint">
            <span className="sheet-nlp-icon">✦</span>
            <span>{nlpHint}</span>
          </div>
        )}

        <div className="sheet-field-row">
          <div className="sheet-field-group">
            <label className="sheet-field-label">Date</label>
            <input
              type="date"
              className="sheet-field-input"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </div>
          <div className="sheet-field-group">
            <label className="sheet-field-label">Time</label>
            <input
              type="time"
              className="sheet-field-input"
              value={time}
              onChange={e => setTime(e.target.value)}
            />
          </div>
        </div>

        <div className="sheet-field-row">
          <div className="sheet-field-group">
            <label className="sheet-field-label">Duration (min)</label>
            <select className="sheet-field-input" value={duration} onChange={e => setDuration(Number(e.target.value))}>
              {[10, 15, 20, 30, 45, 60, 90, 120, 180, 240].map(d => (
                <option key={d} value={d}>{d < 60 ? `${d} min` : `${d/60}h`}</option>
              ))}
            </select>
          </div>
          <div className="sheet-field-group">
            <label className="sheet-field-label">Reminder</label>
            <select className="sheet-field-input" value={remindAt} onChange={e => setRemindAt(e.target.value)}>
              {REMIND_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        <div className="sheet-section-label">Priority</div>
        <div className="sheet-priority-row">
          {PRIORITIES.map(p => (
            <button
              key={p.id}
              className={`sheet-priority-pill${priority === p.id ? ' active' : ''}`}
              style={priority === p.id ? { background: p.color, borderColor: p.color, color: '#fff' } : {}}
              onClick={() => setPriority(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="sheet-section-label">Category</div>
        <div className="sheet-category-row">
          {categories.map(cat => (
            <button
              key={cat.id}
              className={`sheet-category-pill${category === cat.id ? ' active' : ''}`}
              style={category === cat.id ? { background: cat.color + '20', borderColor: cat.color, color: cat.color } : {}}
              onClick={() => setCategory(cat.id)}
            >
              <span className="cat-dot-sm" style={{ background: cat.color }} />
              {cat.name}
            </button>
          ))}
        </div>

        <textarea
          className="sheet-notes-input"
          placeholder="Notes (optional)"
          rows={2}
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />

        <div className="sheet-actions">
          <button className="sheet-btn-inbox" onClick={() => handleSubmit(true)}>
            Save to Inbox
          </button>
          <button className="sheet-btn-schedule" onClick={() => handleSubmit(false)} disabled={!title.trim()}>
            Schedule →
          </button>
        </div>
      </div>
    </div>
  );
}