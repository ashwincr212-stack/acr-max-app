import { SpeechRecognition } from '@capacitor-community/speech-recognition'
import { Capacitor } from '@capacitor/core'

export function normalizeVoiceText(text = '') {
  return text.toLowerCase().replace(/\s+/g, ' ').trim()
}

export async function startVoiceInput() {
  if (Capacitor.getPlatform() !== 'android') {
    throw new Error('Voice input works only in the Android app.')
  }

  const perm = await SpeechRecognition.checkPermissions()
  if (perm.speechRecognition !== 'granted') {
    const req = await SpeechRecognition.requestPermissions()
    if (req.speechRecognition !== 'granted') {
      throw new Error('Microphone permission is required for voice input.')
    }
  }

  const result = await SpeechRecognition.start({
    language: 'en-US',
    maxResults: 1,
    popup: true,
  })

  const transcript = result?.matches?.[0]?.trim()
  return transcript ? normalizeVoiceText(transcript) : null
}

export function speakFeedback(message) {
  if (!message || typeof window === 'undefined' || !window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const utter = new SpeechSynthesisUtterance(message)
  utter.lang = 'en-IN'
  utter.rate = 1
  utter.pitch = 1
  window.speechSynthesis.speak(utter)
}
