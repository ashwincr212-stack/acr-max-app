// /components/VoiceConfirmModalExpense.jsx
// Reuses your existing neumorphic modal pattern

import React, { useState } from 'react';

const CATEGORIES = [
  'Food',
  'Petrol',
  'Smoke',
  'Liquor',
  'Electricity Bill',
  'Water Bill',
  'Mobile Recharge',
  'Groceries',
  'Vegetables',
  'Snacks',
  'CSD',
  'Hotel Food',
  'Other',
];

export default function VoiceConfirmModalExpense({ data, onConfirm, onCancel }) {
  const [amount, setAmount] = useState(String(data.amount ?? ''));
  const [category, setCategory] = useState(data.category ?? 'Other');
  const [note, setNote] = useState(data.note ?? '');
  
  const handleConfirm = () => {
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      alert('Please enter a valid amount.');
      return;
    }
    onConfirm({ amount: parsedAmount, category, note });
  };

  return (
    <div style={overlay}>
      <div style={modal}>
        {/* Header */}
        <div style={header}>
          <span style={iconBadge}>💸</span>
          <h3 style={title}>Add Expense?</h3>
        </div>

        <p style={subtitle}>Voice detected an expense. Confirm or edit:</p>

        {/* Amount */}
        <label style={label}>Amount (₹)</label>
        <input
          type="number"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          style={input}
          placeholder="0"
        />

        {/* Category */}
        <label style={label}>Category</label>
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          style={input}
        >
          {CATEGORIES.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        {/* Note */}
        <label style={label}>Note (optional)</label>
        <input
          type="text"
          value={note}
          onChange={e => setNote(e.target.value)}
          style={input}
          placeholder="e.g. lunch at office"
        />

        {/* Actions */}
        <div style={actions}>
          <button style={cancelBtn} onClick={onCancel}>Cancel</button>
          <button style={confirmBtn} onClick={handleConfirm}>Add ✓</button>
        </div>
      </div>
    </div>
  );
}

// ── Shared styles (neumorphic) ────────────────────────────────────────────────
const overlay = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.4)',
  display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
  zIndex: 99999,
  backdropFilter: 'blur(4px)',
};

const modal = {
  background: '#f0f0f3',
  borderRadius: '24px 24px 0 0',
  padding: '24px 20px 36px',
  width: '100%',
  maxWidth: '480px',
  boxShadow: '0 -8px 32px rgba(0,0,0,0.15)',
};

const header = {
  display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px',
};

const iconBadge = { fontSize: '28px' };

const title = {
  margin: 0, fontSize: '20px', fontWeight: '700', color: '#1a1a2e',
};

const subtitle = {
  color: '#666', fontSize: '13px', marginBottom: '16px',
};

const label = {
  display: 'block', fontSize: '12px', fontWeight: '600',
  color: '#888', marginBottom: '4px', letterSpacing: '0.5px',
};

const input = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: '12px',
  border: 'none',
  background: '#f0f0f3',
  boxShadow: 'inset 4px 4px 8px #d1d1d4, inset -4px -4px 8px #ffffff',
  fontSize: '15px',
  color: '#1a1a2e',
  marginBottom: '14px',
  boxSizing: 'border-box',
  outline: 'none',
};

const actions = {
  display: 'flex', gap: '12px', marginTop: '8px',
};

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
