import React, { useCallback, useState } from 'react'
import { startVoiceInput, speakFeedback } from '../../utils/voiceEngine'
import { parseVoiceCommand } from '../../utils/parseVoiceCommand'
import VoiceConfirmModalExpense from './VoiceConfirmModalExpense'
import VoiceConfirmModalLedger from './VoiceConfirmModalLedger'
import VoiceConfirmModalPlanner from './VoiceConfirmModalPlanner'

const STATE = {
  IDLE: 'idle',
  LISTENING: 'listening',
  PROCESSING: 'processing',
  ERROR: 'error',
}

export default function GlobalMic({ onExpenseAdded, onLedgerAdded, onPlannerAdded }) {
  const [micState, setMicState] = useState(STATE.IDLE)
  const [errorMsg, setErrorMsg] = useState('')
  const [expenseData, setExpenseData] = useState(null)
  const [ledgerData, setLedgerData] = useState(null)
  const [plannerData, setPlannerData] = useState(null)

  const handleMicPress = useCallback(async () => {
    if (micState !== STATE.IDLE) return

    setMicState(STATE.LISTENING)
    setErrorMsg('')

    try {
      const rawText = await startVoiceInput()

      if (!rawText) {
        setMicState(STATE.ERROR)
        setErrorMsg('No speech detected. Please try again.')
        setTimeout(() => setMicState(STATE.IDLE), 2500)
        return
      }

      setMicState(STATE.PROCESSING)
      const result = parseVoiceCommand(rawText)

      if (result.error || !result.type || !['expense', 'ledger', 'planner'].includes(result.type)) {
        setMicState(STATE.ERROR)
        setErrorMsg(result.error ?? "Couldn't understand. Try again.")
        speakFeedback("Sorry, I couldn't understand that.")
        setTimeout(() => setMicState(STATE.IDLE), 3000)
        return
      }

      setMicState(STATE.IDLE)

      if (result.type === 'expense') {
        setExpenseData({ ...result.data, rawText })
        return
      }

      if (result.type === 'ledger') {
        setLedgerData({ ...result.data, rawText })
        return
      }

      setPlannerData({ ...result.data, rawText })
    } catch (error) {
      const msg = error?.message || ''
      if (msg.includes('aborted') || msg.includes('no-speech')) {
        setMicState(STATE.IDLE)
        return
      }

      setMicState(STATE.ERROR)
      setErrorMsg(error?.message || 'Voice input failed. Please try again.')
      setTimeout(() => setMicState(STATE.IDLE), 3000)
    }
  }, [micState])

  const handleExpenseConfirm = useCallback((data) => {
    setExpenseData(null)
    onExpenseAdded?.(data)
    speakFeedback(`Added rupees ${data.amount} to ${data.category}`)
  }, [onExpenseAdded])

  const handleLedgerConfirm = useCallback((data) => {
    setLedgerData(null)
    onLedgerAdded?.(data)
    const action = data.type === 'lent' ? 'given to' : 'received from'
    speakFeedback(`Recorded rupees ${data.amount} ${action} ${data.person}`)
  }, [onLedgerAdded])

  const handlePlannerConfirm = useCallback((data) => {
    setPlannerData(null)
    onPlannerAdded?.(data)
    const timeStr = data.time ? ` at ${data.time}` : ''
    speakFeedback(`Task ${data.title} added${timeStr}`)
  }, [onPlannerAdded])

  const isListening = micState === STATE.LISTENING
  const isProcessing = micState === STATE.PROCESSING
  const isError = micState === STATE.ERROR

  return (
    <>
      <div style={styles.wrapper}>
        {isError && errorMsg && <div style={styles.toast}>{errorMsg}</div>}

        <button
          onClick={handleMicPress}
          disabled={micState !== STATE.IDLE}
          style={{
            ...styles.micButton,
            ...(isListening ? styles.micListening : {}),
            ...(isProcessing ? styles.micProcessing : {}),
            ...(isError ? styles.micError : {}),
          }}
          aria-label="Voice input"
        >
          {isProcessing ? <ProcessingIcon /> : isListening ? <ListeningIcon /> : <MicIcon />}
        </button>
      </div>

      {expenseData && (
        <VoiceConfirmModalExpense
          data={expenseData}
          onConfirm={handleExpenseConfirm}
          onCancel={() => setExpenseData(null)}
        />
      )}

      {ledgerData && (
        <VoiceConfirmModalLedger
          data={ledgerData}
          onConfirm={handleLedgerConfirm}
          onCancel={() => setLedgerData(null)}
        />
      )}

      {plannerData && (
        <VoiceConfirmModalPlanner
          data={plannerData}
          onConfirm={handlePlannerConfirm}
          onCancel={() => setPlannerData(null)}
        />
      )}
    </>
  )
}

function MicIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  )
}

function ListeningIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <rect x="2" y="8" width="3" height="8" rx="1" />
      <rect x="7" y="5" width="3" height="14" rx="1" />
      <rect x="12" y="3" width="3" height="18" rx="1" />
      <rect x="17" y="6" width="3" height="12" rx="1" />
    </svg>
  )
}

function ProcessingIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" strokeDasharray="40" strokeDashoffset="15">
        <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite" />
      </circle>
    </svg>
  )
}

const styles = {
  wrapper: {
    position: 'fixed',
    bottom: '92px',
    right: '10px',
    zIndex: 1200,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '10px',
    pointerEvents: 'none',
  },
  toast: {
    background: 'rgba(30,30,30,0.9)',
    color: '#fff',
    fontSize: '13px',
    padding: '8px 14px',
    borderRadius: '12px',
    maxWidth: '220px',
    textAlign: 'center',
    pointerEvents: 'none',
    boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
  },
  micButton: {
    width: '52px',
    height: '52px',
    borderRadius: '50%',
    border: 'none',
    background: 'linear-gradient(145deg, #e6e6e6, #ffffff)',
    boxShadow: '6px 6px 12px #b8b8b8, -6px -6px 12px #ffffff',
    color: '#555',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    pointerEvents: 'auto',
    outline: 'none',
  },
  micListening: {
    background: 'linear-gradient(145deg, #ff6b6b, #ff4757)',
    boxShadow: '0 0 0 8px rgba(255,71,87,0.25), 6px 6px 12px rgba(255,71,87,0.3)',
    color: '#fff',
    animation: 'pulse 1s infinite',
  },
  micProcessing: {
    background: 'linear-gradient(145deg, #ffa502, #ff7f50)',
    color: '#fff',
    boxShadow: '6px 6px 12px rgba(255,127,80,0.3)',
  },
  micError: {
    background: 'linear-gradient(145deg, #c0392b, #e74c3c)',
    color: '#fff',
    boxShadow: '6px 6px 12px rgba(231,76,60,0.3)',
  },
}
