import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { db } from '../firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import TRANSLATIONS from '../utils/translations'

const LanguageContext = createContext({
  language: 'en',
  setLanguage: () => {},
  t: TRANSLATIONS.en,
})

export function LanguageProvider({ children, userId }) {
  const [language, setLangState] = useState('en')

  useEffect(() => {
    if (!userId) return
    getDoc(doc(db, 'acr_users', userId))
      .then(snap => { if (snap.exists() && snap.data().language) setLangState(snap.data().language) })
      .catch(() => {})
  }, [userId])

  const setLanguage = useCallback(async (lang) => {
    setLangState(lang)
    if (userId) {
      try { await setDoc(doc(db, 'acr_users', userId), { language: lang }, { merge: true }) }
      catch {}
    }
  }, [userId])

  const t = TRANSLATIONS[language] || TRANSLATIONS.en

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}

export default LanguageContext