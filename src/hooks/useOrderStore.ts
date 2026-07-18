import { useSyncExternalStore } from 'react'
import {
  collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc,
  runTransaction, increment,
} from 'firebase/firestore'
import type { PurchaseOrder, OrderStatus, OrderItem, StockProduct } from '../types'
import { getDb, ensureAuth, COL } from '../lib/firebase'

// ── Shared store จาก Firestore listener ──────────────────────
let _orders: PurchaseOrder[] = []
const _listeners = new Set<() => void>()
function notify() { _listeners.forEach(fn => fn()) }

let _started = false
function startListener() {
  if (_started) return
  const db = getDb()
  if (!db) return
  _started = true
  ensureAuth().then(() => {
    onSnapshot(collection(db, COL.orders), snap => {
      _orders = snap.docs
        .map(d => ({ id: d.id, ...d.data() }) as PurchaseOrder)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      notify()
    })
  })
}

const db = () => {
  const d = getDb()
  if (!d) throw new Error('Firebase ยังไม่ได้ตั้งค่า')
  return d
}
const orderRef   = (id: string) => doc(db(), COL.orders, id)
const productRef = (id: string) => doc(db(), COL.products, id)
const entryRef   = (id: string) => doc(db(), COL.entries, id)

/** Firestore ไม่รับ undefined → ตัดทิ้งก่อนเขียน */
function clean<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T
}

/** แปลงจำนวนที่สั่ง (Box/Pack) → จำนวน pack ตาม packsPerBox ของสินค้า */
export function itemPacks(it: OrderItem, p: StockProduct): number {
  return it.unit === 'Box' && p.packsPerBox > 0 ? it.qty * p.packsPerBox : it.qty
}

export function useOrderStore() {
  startListener()
  const orders = useSyncExternalStore(
    cb => { _listeners.add(cb); return () => _listeners.delete(cb) },
    () => _orders,
  )

  function addOrder(o: Omit<PurchaseOrder, 'id' | 'createdAt' | 'status'>) {
    const order: PurchaseOrder = {
      ...o,
      id: `ord_${Date.now()}`,
      createdAt: new Date().toISOString().slice(0, 10),
      status: 'ordered',
    }
    const { id, ...data } = order
    setDoc(orderRef(id), clean(data))
    return order
  }

  function updateOrder(id: string, patch: Partial<PurchaseOrder>) {
    const { id: _drop, ...data } = patch as PurchaseOrder
    updateDoc(orderRef(id), clean(data) as Record<string, unknown>)
  }

  function setTracking(id: string, carrier: PurchaseOrder['carrier'], trackingNumber: string) {
    updateDoc(orderRef(id), clean({ carrier, trackingNumber, status: 'in_transit' }) as Record<string, unknown>)
  }

  function markReceived(id: string) {
    updateDoc(orderRef(id), {
      status: 'received',
      receivedAt: new Date().toISOString().slice(0, 10),
    })
  }

  function deleteOrder(id: string) {
    deleteDoc(orderRef(id))
  }

  /**
   * ยืนยันรับสินค้า — ออเดอร์ + สต็อกอัปเดตใน transaction เดียว
   * สำเร็จทั้งหมดหรือไม่เกิดอะไรเลย → ไม่มีทางที่ออเดอร์เป็น "รับแล้ว" แต่สต็อกไม่ขึ้น
   */
  async function receiveOrder(order: PurchaseOrder, products: StockProduct[]) {
    const today = new Date().toISOString().slice(0, 10)
    const targets = order.items
      .map(it => {
        const p = it.productId ? products.find(pp => pp.id === it.productId) : undefined
        return p ? { it, p, packs: itemPacks(it, p) } : null
      })
      .filter((x): x is { it: OrderItem; p: StockProduct; packs: number } => !!x)

    await runTransaction(db(), async tx => {
      // อ่านสินค้าทุกตัวก่อน (Firestore บังคับ read ทั้งหมดก่อน write)
      const snaps = await Promise.all(targets.map(t => tx.get(productRef(t.p.id))))

      tx.update(orderRef(order.id), { status: 'received', receivedAt: today })

      targets.forEach((t, i) => {
        const cur = snaps[i].data() as StockProduct | undefined
        if (!cur) return
        const deduct = Math.min(cur.qtyIncoming ?? 0, t.packs)
        tx.update(productRef(t.p.id), {
          qty: (cur.qty ?? 0) + t.packs,
          qtyIncoming: Math.max(0, (cur.qtyIncoming ?? 0) - deduct),
        })
        tx.set(entryRef(crypto.randomUUID()), {
          productId: t.p.id, date: today, delta: t.packs,
          note: `รับสินค้า ${t.it.qty} ${t.it.unit}`, kind: 'received',
        })
      })
    })
  }

  /** สร้างออเดอร์ + บวกยอด "กำลังมา" ในครั้งเดียว */
  async function createOrderWithStock(
    data: Omit<PurchaseOrder, 'id' | 'createdAt' | 'status'>,
    products: StockProduct[],
  ) {
    const order: PurchaseOrder = {
      ...data, id: `ord_${Date.now()}`,
      createdAt: new Date().toISOString().slice(0, 10), status: 'ordered',
    }
    const { id, ...orderData } = order
    const targets = data.items
      .map(it => {
        const p = it.productId ? products.find(pp => pp.id === it.productId) : undefined
        return p ? { it, p, packs: itemPacks(it, p) } : null
      })
      .filter((x): x is { it: OrderItem; p: StockProduct; packs: number } => !!x)

    await runTransaction(db(), async tx => {
      const snaps = await Promise.all(targets.map(t => tx.get(productRef(t.p.id))))
      tx.set(orderRef(id), clean(orderData))
      targets.forEach((t, i) => {
        const cur = snaps[i].data() as StockProduct | undefined
        if (!cur) return
        tx.update(productRef(t.p.id), {
          qtyIncoming: Math.max(0, (cur.qtyIncoming ?? 0) + t.packs),
        })
        tx.set(entryRef(crypto.randomUUID()), {
          productId: t.p.id, date: order.createdAt, delta: t.packs,
          note: `สั่งซื้อ ${t.it.qty} ${t.it.unit}`, kind: 'incoming',
        })
      })
    })
    return order
  }

  /** ลบออเดอร์ที่ยังไม่รับ + คืนยอด "กำลังมา" ในครั้งเดียว */
  async function deleteOrderWithStock(order: PurchaseOrder, products: StockProduct[]) {
    if (order.status === 'received') { deleteDoc(orderRef(order.id)); return }
    const targets = order.items
      .map(it => {
        const p = it.productId ? products.find(pp => pp.id === it.productId) : undefined
        return p ? { it, p, packs: itemPacks(it, p) } : null
      })
      .filter((x): x is { it: OrderItem; p: StockProduct; packs: number } => !!x)

    await runTransaction(db(), async tx => {
      const snaps = await Promise.all(targets.map(t => tx.get(productRef(t.p.id))))
      tx.delete(orderRef(order.id))
      targets.forEach((t, i) => {
        const cur = snaps[i].data() as StockProduct | undefined
        if (!cur) return
        tx.update(productRef(t.p.id), {
          qtyIncoming: Math.max(0, (cur.qtyIncoming ?? 0) - t.packs),
        })
        tx.set(entryRef(crypto.randomUUID()), {
          productId: t.p.id, date: new Date().toISOString().slice(0, 10), delta: -t.packs,
          note: 'ยกเลิกรายการสั่งซื้อ', kind: 'incoming',
        })
      })
    })
  }

  /** เดิมใช้ตอนดึงจาก Sheet มาทับ — บน Firestore ไม่ต้องแล้ว (listener จัดการเอง) */
  function replaceAll(_fresh: PurchaseOrder[]) { /* no-op */ }

  const byStatus = (status: OrderStatus) => orders.filter(o => o.status === status)

  return {
    orders, addOrder, updateOrder, setTracking, markReceived, deleteOrder,
    receiveOrder, createOrderWithStock, deleteOrderWithStock,
    replaceAll, byStatus,
  }
}
