// /components/VoiceConfirmModalPlanner.jsx
// NEW — Voice confirm modal for planner tasks

import React, { useState } from 'react';

export default function VoiceConfirmModalPlanner({ data, onConfirm, onCancel }) {
  const [title, setTitle] = useState(data.title ?? '');
  const [date, setDate] = useState(data.date || new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState(data.time ?? '');
  const [reminder, setReminder] = useState(true);
  const [note, setNote] = useState('');

  const handleConfirm = () => {
    if (!title.trim()) { alert('Please enter a task title.'); return; }
    if (!date) { alert('Please select a date.'); return; }
    onConfirm({
      title: title.trim(),
      date,
      time: time || null,
      reminder,
      note,
    });
  };

  const displayDate = date
    ? new Date(date + 'T00:00:00').toLocaleDateString('en-IN', {
        weekday: 'short', day: 'numeric', month: 'short',
      })
    : '—';

  return (
    <div style={overlay}>
      <div style={modal}>
        {/* Header */}
        <div style={header}>
          <span style={iconBadge}>📅</span>
          <h3 style={title_style}>Add Task?</h3>
        </div>

        <p style={subtitle}>Voice detected a planned task. Confirm or edit:</p>

        {/* Title */}
        <label style={label}>Task / Event</label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          style={input}
          placeholder="e.g. Gym, Meeting, Doctor"
        />

        {/* Date */}
        <label style={label}>Date</label>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          style={input}
        />

        {/* Time */}
        <label style={label}>Time (optional)</label>
        <input
          type="time"
          value={time}
          onChange={e => setTime(e.target.value)}
          style={input}
        />

        {/* Reminder toggle */}
        <div style={reminderRow}>
          <span style={reminderLabel}>🔔 Set Reminder</span>
          <button
            style={{ ...toggle, background: reminder ? '#667eea' : '#d1d1d4' }}
            onClick={() => setReminder(r => !r)}
          >
            <span style={{ ...toggleKnob, transform: reminder ? 'translateX(20px)' : 'translateX(2px)' }} />
          </button>
        </div>

        {/* Note */}
        <label style={label}>Note (optional)</label>
        <input
          type="text"
          value={note}
          onChange={e => setNote(e.target.value)}
          style={input}
          placeholder="e.g. bring ID card"
        />

        {/* Summary */}
        <div style={summaryPill}>
          📅 {title || '—'} — {displayDate} {time ? `at ${time}` : '(all day)'}
        </div>

        {/* Actions */}
        <div style={actions}>
          <button style={cancelBtn} onClick={onCancel}>Cancel</button>
          <button style={confirmBtn} onClick={handleConfirm}>Add Task ✓</button>
        </div>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const overlay = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.4)',
  display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
  zIndex: 99999, backdropFilter: 'blur(4px)',
};

const modal = {
  background: '#f0f0f3', borderRadius: '24px 24px 0 0',
  padding: '24px 20px 36px', width: '100%', maxWidth: '480px',
  boxShadow: '0 -8px 32px rgba(0,0,0,0.15)',
};

const header = { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' };
const iconBadge = { fontSize: '28px' };
const title_style = { margin: 0, fontSize: '20px', fontWeight: '700', color: '#1a1a2e' };
const subtitle = { color: '#666', fontSize: '13px', marginBottom: '14px' };
const label = { display: 'block', fontSize: '12px', fontWeight: '600', color: '#888', marginBottom: '4px', letterSpacing: '0.5px' };

const input = {
  width: '100%', padding: '12px 14px', borderRadius: '12px', border: 'none',
  background: '#f0f0f3',
  boxShadow: 'inset 4px 4px 8px #d1d1d4, inset -4px -4px 8px #ffffff',
  fontSize: '15px', color: '#1a1a2e', marginBottom: '12px',
  boxSizing: 'border-box', outline: 'none',
};

const reminderRow = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  marginBottom: '14px', padding: '0 2px',
};

const reminderLabel = { fontSize: '14px', fontWeight: '600', color: '#555' };

const toggle = {
  width: '44px', height: '26px', borderRadius: '13px', border: 'none',
  position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
  padding: 0,
};

const toggleKnob = {
  position: 'absolute', top: '3px',
  width: '20px', height: '20px', borderRadius: '50%',
  background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
  transition: 'transform 0.2s',
};

const summaryPill = {
  background: 'linear-gradient(135deg, #667eea22, #764ba222)',
  border: '1.5px solid #667eea44',
  borderRadius: '12px', padding: '10px 14px',
  fontSize: '13px', fontWeight: '600', color: '#4a4a8a',
  textAlign: 'center', marginBottom: '16px',
};

const actions = { display: 'flex', gap: '12px' };

const cancelBtn = {
  flex: 1, padding: '14px', borderRadius: '14px', border: 'none',
  background: '#f0f0f3',
  boxShadow: '4px 4px 8px #d1d1d4, -4px -4px 8px #ffffff',
  color: '#666', fontSize: '15px', fontWeight: '600', cursor: 'pointer',
};

const confirmBtn = {
  flex: 2, padding: '14px', borderRadius: '14px', border: 'none',
  background: 'linear-gradient(135deg, #667eea, #764ba2)',
  color: '#fff', fontSize: '15px', fontWeight: '700', cursor: 'pointer',
  boxShadow: '0 4px 15px rgba(102,126,234,0.4)',
};
