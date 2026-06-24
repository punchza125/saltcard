import { useSyncExternalStore, useCallback } from 'react'
import type { PurchaseOrder, OrderStatus } from '../types'

const STORAGE_KEY = 'saltcard_orders_v1'

function load(): PurchaseOrder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function save(orders: PurchaseOrder[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(orders)) } catch {}
}

// ── Module-level shared store ─────────────────────────────────
let _orders: PurchaseOrder[] = load()
const _listeners = new Set<() => void>()

function notify() { _listeners.forEach(fn => fn()) }

function setOrders(next: PurchaseOrder[] | ((prev: PurchaseOrder[]) => PurchaseOrder[])) {
  _orders = typeof next === 'function' ? next(_orders) : next
  save(_orders)
  notify()
}

// ─────────────────────────────────────────────────────────────

export function useOrderStore() {
  const orders = useSyncExternalStore(
    (cb) => { _listeners.add(cb); return () => _listeners.delete(cb) },
    () => _orders,
  )

  const addOrder = useCallback((o: Omit<PurchaseOrder, 'id' | 'createdAt' | 'status'>) => {
    const order: PurchaseOrder = {
      ...o,
      id: `ord_${Date.now()}`,
      createdAt: new Date().toISOString().slice(0, 10),
      status: 'ordered',
    }
    setOrders(prev => [order, ...prev])
    return order
  }, [])

  const updateOrder = useCallback((id: string, patch: Partial<PurchaseOrder>) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, ...patch } : o))
  }, [])

  const setTracking = useCallback((id: string, carrier: PurchaseOrder['carrier'], trackingNumber: string) => {
    setOrders(prev => prev.map(o =>
      o.id === id ? { ...o, carrier, trackingNumber, status: 'in_transit' } : o
    ))
  }, [])

  const markReceived = useCallback((id: string) => {
    setOrders(prev => prev.map(o =>
      o.id === id ? { ...o, status: 'received', receivedAt: new Date().toISOString().slice(0, 10) } : o
    ))
  }, [])

  const deleteOrder = useCallback((id: string) => {
    setOrders(prev => prev.filter(o => o.id !== id))
  }, [])

  const replaceAll = useCallback((fresh: PurchaseOrder[]) => {
    setOrders(fresh)
  }, [])

  const byStatus = (status: OrderStatus) => orders.filter(o => o.status === status)

  return { orders, addOrder, updateOrder, setTracking, markReceived, deleteOrder, replaceAll, byStatus }
}
