import { useCallback, useEffect, useRef, useState } from 'react'
import { loadSession, parseSession, SAVE_KEY, saveSession } from './storage'
import { newSession } from './session'
import { stampGameplayRevision } from './roundIntent'
import type { Session } from './session'

export function useSession() {
  const [session, setSession] = useState(loadSession)
  const current = useRef(session)
  const [saveFailed, setSaveFailed] = useState(false)
  const storageAvailable = useRef(true)
  const pending = useRef(false)
  const replace = useCallback((next: Session) => {
    current.current = next
    setSession(next)
  }, [])

  const commit = useCallback(async (update: (previous: Session) => Session) => {
    const apply = () => {
      let previous = current.current
      if (storageAvailable.current && navigator.locks) {
        try {
          previous = parseSession(localStorage.getItem(SAVE_KEY)) ?? previous
        } catch {
          storageAvailable.current = false
        }
      }
      const next = stampGameplayRevision(previous, update(previous))
      if (next !== previous) {
        storageAvailable.current = saveSession(next)
        setSaveFailed(!storageAvailable.current)
      }
      replace(next)
      return next !== previous
    }
    return navigator.locks ? navigator.locks.request(SAVE_KEY, apply) : apply()
  }, [replace])

  const action = useCallback(async (update: (previous: Session) => Session) => {
    if (pending.current) return false
    pending.current = true
    try {
      return await commit(update)
    } finally {
      pending.current = false
    }
  }, [commit])

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== SAVE_KEY || !storageAvailable.current) return
      replace(parseSession(event.newValue) ?? newSession())
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [replace])

  return { session, action, commit, saveFailed }
}
