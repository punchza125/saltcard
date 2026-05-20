import { useState, useEffect, useCallback } from 'react'
import type { DayReport, DashboardStore } from '../types'

const STORAGE_KEY = 'saltcard_reports_v1'

function loadStore(): DashboardStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { reports: [] }
}

function saveStore(store: DashboardStore) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {}
}

export function useStore() {
  const [store, setStore] = useState<DashboardStore>(loadStore)

  useEffect(() => {
    saveStore(store)
  }, [store])

  const addReport = useCallback((report: DayReport) => {
    setStore(prev => {
      // replace if same date already exists
      const filtered = prev.reports.filter(r => r.date !== report.date)
      const next = { reports: [...filtered, report].sort((a, b) => a.date.localeCompare(b.date)) }
      return next
    })
  }, [])

  const removeReport = useCallback((date: string) => {
    setStore(prev => ({ reports: prev.reports.filter(r => r.date !== date) }))
  }, [])

  const clearAll = useCallback(() => {
    setStore({ reports: [] })
  }, [])

  return { store, addReport, removeReport, clearAll }
}
