// /components/VoiceConfirmModalLedger.jsx
// NEW — Voice confirm modal for ledger entries

import React, { useState } from 'react';

export default function VoiceConfirmModalLedger({ data, onConfirm, onCancel }) {
  const [person, setPerson] = useState(data.person ?? '');
  const [amount, setAmount] = useState(String(data.amount ?? ''));
  const [type, setType] = useState(data.type ?? 'lent');
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');

  const handleConfirm = () => {
    if (!person.trim()) { alert('Please enter a person name.'); return; }
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) { alert('Please enter a valid amount.'); return; }
    onConfirm({
      person: person.trim(),
      amount: parsedAmount,
      type,
      dueDate: dueDate || null,
      note,
    });
  };

  const typeColor = type === 'lent' ? '#27ae60' : '#e74c3c';

  return (
    <div style={overlay}>
      <div style={modal}>
        {/* Header */}
        <div style={header}>
          <span style={iconBadge}>{type === 'lent' ? '🤝' : '💳'}</span>
          <h3 style={title}>{type === 'lent' ? 'Money Given' : 'Money Received'}</h3>
        </div>

        <p style={subtitle}>Voice detected a ledger entry. Confirm or edit:</p>

        {/* Type toggle */}
        <div style={toggleRow}>
          <button
            style={{ ...toggleBtn, ...(type === 'lent' ? toggleActive('#27ae60') : {}) }}
            onClick={() => setType('lent')}
          >
            ↑ I Gave (Lent)
          </button>
          <button
            style={{ ...toggleBtn, ...(type === 'borrowed' ? toggleActive('#e74c3c') : {}) }}
            onClick={() => setType('borrowed')}
          >
            ↓ I Received (Borrowed)
          </button>
        </div>

        {/* Person */}
        <label style={label}>Person</label>
        <input
          type="text"
          value={person}
          onChange={e => setPerson(e.target.value)}
          style={input}
          placeholder="Name"
        />

        {/* Amount */}
        <label style={label}>Amount (₹)</label>
        <input
          type="number"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          style={input}
          placeholder="0"
        />

        {/* Due Date */}
        <label style={label}>Due Date (optional)</label>
        <input
          type="date"
          value={dueDate}
          onChange={e => setDueDate(e.target.value)}
          style={input}
        />

        {/* Note */}
        <label style={label}>Note (optional)</label>
        <input
          type="text"
          value={note}
          onChange={e => setNote(e.target.value)}
          style={input}
          placeholder="e.g. for rent split"
        />

        {/* Summary pill */}
        <div style={{ ...summaryPill, borderColor: typeColor, color: typeColor }}>
          {type === 'lent' ? '↑ You gave' : '↓ You received'} ₹{amount || '—'} {type === 'lent' ? 'to' : 'from'} {person || '—'}
        </div>

        {/* Actions */}
        <div style={actions}>
          <button style={cancelBtn} onClick={onCancel}>Cancel</button>
          <button style={{ ...confirmBtn, background: `linear-gradient(135deg, ${typeColor}, ${typeColor}cc)` }} onClick={handleConfirm}>
            Save ✓
          </button>
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
const title = { margin: 0, fontSize: '20px', fontWeight: '700', color: '#1a1a2e' };
const subtitle = { color: '#666', fontSize: '13px', marginBottom: '14px' };
const label = { display: 'block', fontSize: '12px', fontWeight: '600', color: '#888', marginBottom: '4px', letterSpacing: '0.5px' };

const input = {
  width: '100%', padding: '12px 14px', borderRadius: '12px', border: 'none',
  background: '#f0f0f3',
  boxShadow: 'inset 4px 4px 8px #d1d1d4, inset -4px -4px 8px #ffffff',
  fontSize: '15px', color: '#1a1a2e', marginBottom: '12px',
  boxSizing: 'border-box', outline: 'none',
};

const toggleRow = { display: 'flex', gap: '10px', marginBottom: '14px' };

const toggleBtn = {
  flex: 1, padding: '10px', borderRadius: '12px', border: 'none',
  background: '#f0f0f3',
  boxShadow: '4px 4px 8px #d1d1d4, -4px -4px 8px #ffffff',
  fontSize: '13px', fontWeight: '600', color: '#888', cursor: 'pointer',
};

const toggleActive = (color) => ({
  background: color, color: '#fff',
  boxShadow: `0 4px 12px ${color}55`,
});

const summaryPill = {
  border: '1.5px solid', borderRadius: '12px',
  padding: '10px 14px', fontSize: '14px', fontWeight: '600',
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
  color: '#fff', fontSize: '15px', fontWeight: '700', cursor: 'pointer',
  boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
};