import { useCallback, useState } from 'react'
import type { PurchaseOrder } from '../types'

const URL_KEY = 'saltcard_orders_sheets_url'
const ENV_URL = import.meta.env.VITE_ORDERS_URL as string | undefined

export function useOrdersSheets() {
  // env var takes priority over localStorage (deployed = everyone shares same sheet)
  const [url, setUrlState] = useState(
    () => ENV_URL ?? localStorage.getItem(URL_KEY) ?? ''
  )
  const isEnvConfigured = !!ENV_URL
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [syncError, setSyncError] = useState(false)

  function saveUrl(u: string) {
    if (isEnvConfigured) return  // env var takes over, can't override
    setUrlState(u)
    localStorage.setItem(URL_KEY, u)
  }

  async function testUrl(u: string): Promise<boolean> {
    try {
      const res = await fetch(`${u}?action=dates`)
      const json = await res.json()
      return json.ok === true
    } catch { return false }
  }

  const push = useCallback(async (orders: PurchaseOrder[]): Promise<boolean> => {
    const u = ENV_URL ?? localStorage.getItem(URL_KEY)
    if (!u) return false
    setSyncing(true); setSyncError(false)
    try {
      await fetch(`${u}?action=save`, { method: 'POST', body: JSON.stringify(orders) })
      setLastSync(new Date().toLocaleTimeString('th-TH'))
      return true
    } catch {
      setSyncError(true)
      return false
    } finally { setSyncing(false) }
  }, [])

  const fetch_ = useCallback(async (): Promise<PurchaseOrder[] | null> => {
    const u = ENV_URL ?? localStorage.getItem(URL_KEY)
    if (!u) return null
    setSyncing(true); setSyncError(false)
    try {
      const res  = await fetch(`${u}?action=fetch`)
      const json = await res.json()
      if (!json.ok || !json.orders) return null
      setLastSync(new Date().toLocaleTimeString('th-TH'))
      return json.orders as PurchaseOrder[]
    } catch {
      setSyncError(true)
      return null
    } finally { setSyncing(false) }
  }, [])

  return { url, saveUrl, testUrl, push, fetch: fetch_, syncing, lastSync, syncError, isEnvConfigured }
}
