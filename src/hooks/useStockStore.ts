import { useSyncExternalStore } from 'react'
import {
  collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc,
  writeBatch, increment, runTransaction, query, where, getDocs,
} from 'firebase/firestore'
import type { StockStore, StockProduct, StockEntry, StockUnit, DayReport, EntryKind } from '../types'
import type { InventoryRow } from '../utils/parser'
import { getDb, ensureAuth, COL, META_STOCK_DOC } from '../lib/firebase'

export interface SyncPreviewItem {
  productId: string
  productName: string
  date: string
  goodsName: string
  soldQty: number
  packDelta: number
  isBox: boolean
}

export interface InventorySnapshotItem {
  productId: string
  productName: string
  goodsName: string
  currentQty: number
  newQty: number
}

// ── Shared store: ประกอบจาก Firestore listener (ทุก component เห็นค่าเดียวกัน) ──
// Firestore มี local cache + offline queue ในตัว → เขียนแล้วเห็นผลทันที (optimistic)
// และถ้าเน็ตหลุดจะ queue ไว้ส่งเองเมื่อกลับมา
const EMPTY: StockStore = { products: [], entries: [], syncedDates: [], taxRate: 15 }
let _stock: StockStore = EMPTY
const _listeners = new Set<() => void>()
function notify() { _listeners.forEach(fn => fn()) }
function patch(p: Partial<StockStore>) { _stock = { ..._stock, ...p }; notify() }

let _started = false
function startListeners() {
  if (_started) return
  const db = getDb()
  if (!db) return
  _started = true
  ensureAuth().then(() => {
    onSnapshot(collection(db, COL.products), snap => {
      patch({ products: snap.docs.map(d => ({ id: d.id, ...d.data() }) as StockProduct) })
    })
    onSnapshot(collection(db, COL.entries), snap => {
      patch({ entries: snap.docs.map(d => ({ id: d.id, ...d.data() }) as StockEntry) })
    })
    onSnapshot(doc(db, COL.meta, META_STOCK_DOC), snap => {
      const m = snap.data() ?? {}
      patch({
        taxRate:          m.taxRate ?? 15,
        syncedDates:      m.syncedDates ?? [],
        hiddenCategories: m.hiddenCategories ?? [],
        categoryAliases:  m.categoryAliases ?? {},
      })
    })
  })
}

const db = () => {
  const d = getDb()
  if (!d) throw new Error('Firebase ยังไม่ได้ตั้งค่า')
  return d
}
const metaRef    = () => doc(db(), COL.meta, META_STOCK_DOC)
const productRef = (id: string) => doc(db(), COL.products, id)
const entryRef   = (id: string) => doc(db(), COL.entries, id)

/** Firestore ไม่รับ undefined → ตัดทิ้งก่อนเขียน */
function clean<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T
}

function newEntry(e: Omit<StockEntry, 'id'>): StockEntry {
  return { id: crypto.randomUUID(), ...e }
}

export function useStockStore() {
  startListeners()
  const stock = useSyncExternalStore(
    cb => { _listeners.add(cb); return () => _listeners.delete(cb) },
    () => _stock,
  )

  // ── products ────────────────────────────────────────────────
  function addProduct(
    name: string, unit: StockUnit, packsPerBox: number,
    qty: number, yellowAt: number, redAt: number, goodsKeyword: string, category: string
  ) {
    const id = crypto.randomUUID()
    const product: Omit<StockProduct, 'id'> = {
      name, unit, packsPerBox, qty, qtyIncoming: 0, yellowAt, redAt, goodsKeyword, category,
    }
    setDoc(productRef(id), clean(product))
    // ใช้หมวดนี้อีกครั้ง = ปลดซ่อน
    unhideCategory(category)
    return id
  }

  function updateProduct(id: string, patchData: Partial<Omit<StockProduct, 'id'>>) {
    updateDoc(productRef(id), clean(patchData) as Record<string, unknown>)
    if (patchData.category) unhideCategory(patchData.category)
  }

  async function removeProduct(id: string) {
    const b = writeBatch(db())
    b.delete(productRef(id))
    const es = await getDocs(query(collection(db(), COL.entries), where('productId', '==', id)))
    es.docs.forEach(d => b.delete(d.ref))
    await b.commit()
  }

  // ── meta / categories ───────────────────────────────────────
  function setTaxRate(rate: number) {
    setDoc(metaRef(), { taxRate: rate }, { merge: true })
  }

  function unhideCategory(name: string) {
    const hidden = (_stock.hiddenCategories ?? []).filter(c => c !== name)
    if (hidden.length !== (_stock.hiddenCategories ?? []).length) {
      setDoc(metaRef(), { hiddenCategories: hidden }, { merge: true })
    }
  }

  /** ลบหมวด: ย้ายสินค้าไป 'อื่นๆ' แล้วซ่อนชื่อหมวด */
  async function removeCategory(name: string) {
    const b = writeBatch(db())
    _stock.products.filter(p => p.category === name)
      .forEach(p => b.update(productRef(p.id), { category: 'อื่นๆ' }))
    b.set(metaRef(), {
      hiddenCategories: Array.from(new Set([...(_stock.hiddenCategories ?? []), name])),
    }, { merge: true })
    await b.commit()
  }

  /** รวม/ย้ายหมวด from → to + จำ alias ไว้ remap ยอดขายในกราฟ (ยุบ chain ให้ด้วย) */
  async function mergeCategory(from: string, to: string) {
    if (from === to) return
    const aliases: Record<string, string> = { ...(_stock.categoryAliases ?? {}) }
    aliases[from] = to
    for (const k of Object.keys(aliases)) if (aliases[k] === from) aliases[k] = to
    if (aliases[to] === to) delete aliases[to]

    const b = writeBatch(db())
    _stock.products.filter(p => p.category === from)
      .forEach(p => b.update(productRef(p.id), { category: to }))
    b.set(metaRef(), {
      hiddenCategories: Array.from(new Set([...(_stock.hiddenCategories ?? []).filter(c => c !== to), from])),
      categoryAliases: aliases,
    }, { merge: true })
    await b.commit()
  }

  // ── stock movement ──────────────────────────────────────────
  //   'incoming' → บวก qtyIncoming เท่านั้น (ยังไม่ได้ของ)
  //   'received' → บวก qty, ลด qtyIncoming (ถ้า deductIncoming)
  //   'in'/'out'/'auto'/'adjust' → บวก/ลบ qty ตรงๆ
  async function logEntry(
    productId: string, delta: number, note: string, kind: EntryKind,
    date?: string, deductIncoming?: boolean,
  ) {
    const entry = newEntry({
      productId, date: date ?? new Date().toISOString().slice(0, 10), delta, note, kind,
    })
    const { id, ...entryData } = entry

    // 'received'+deduct และ 'incoming' ต้องอ่านค่าเดิมมาคำนวณ (min/clamp ไม่ให้ติดลบ)
    // → ใช้ transaction ให้ atomic กันสองเครื่องเขียนทับกัน
    if (kind === 'incoming' || (kind === 'received' && deductIncoming)) {
      await runTransaction(db(), async tx => {
        const snap = await tx.get(productRef(productId))
        const cur = snap.data() as StockProduct | undefined
        if (!cur) return
        if (kind === 'incoming') {
          tx.update(productRef(productId), {
            qtyIncoming: Math.max(0, (cur.qtyIncoming ?? 0) + delta),
          })
        } else {
          const deduct = Math.min(cur.qtyIncoming ?? 0, delta)
          tx.update(productRef(productId), {
            qty: (cur.qty ?? 0) + delta,
            qtyIncoming: Math.max(0, (cur.qtyIncoming ?? 0) - deduct),
          })
        }
        tx.set(entryRef(id), entryData)
      })
      return
    }

    // ที่เหลือบวก/ลบตรงๆ → increment() ของ Firestore atomic อยู่แล้ว ไม่ต้องอ่านก่อน
    const b = writeBatch(db())
    b.update(productRef(productId), { qty: increment(delta) })
    b.set(entryRef(id), entryData)
    await b.commit()
  }

  // ── sales sync (อ่านอย่างเดียว — คำนวณจาก state ปัจจุบัน) ────────
  function autoSyncedSet(): Set<string> {
    return new Set(
      stock.entries.filter(e => e.kind === 'auto').map(e => `${e.productId}::${e.date}`)
    )
  }

  function buildSyncItems(reports: DayReport[], filterProductId?: string): SyncPreviewItem[] {
    const pendingReports = reports.filter(r => !stock.syncedDates.includes(r.date))
    const alreadySynced = autoSyncedSet()
    const items: SyncPreviewItem[] = []
    for (const report of pendingReports) {
      for (const goods of report.goods) {
        const lowerName = goods.goodsName.toLowerCase()
        const isBox = lowerName.includes('(box)') || lowerName.endsWith(' box')
        for (const product of stock.products) {
          if (filterProductId && product.id !== filterProductId) continue
          if (!product.goodsKeyword) continue
          if (!lowerName.includes(product.goodsKeyword.toLowerCase())) continue
          if (alreadySynced.has(`${product.id}::${report.date}`)) continue
          const packDelta = isBox && product.packsPerBox > 0
            ? -(goods.salesVolume * product.packsPerBox)
            : -goods.salesVolume
          items.push({
            productId: product.id, productName: product.name,
            date: report.date, goodsName: goods.goodsName,
            soldQty: goods.salesVolume, packDelta, isBox,
          })
        }
      }
    }
    return items
  }

  function previewSync(reports: DayReport[]): SyncPreviewItem[] {
    return buildSyncItems(reports)
  }

  function previewSyncProduct(reports: DayReport[], productId: string): SyncPreviewItem[] {
    const productAutoSynced = new Set(
      stock.entries.filter(e => e.kind === 'auto' && e.productId === productId).map(e => e.date)
    )
    const items: SyncPreviewItem[] = []
    for (const report of reports) {
      if (productAutoSynced.has(report.date)) continue
      for (const goods of report.goods) {
        const lowerName = goods.goodsName.toLowerCase()
        const isBox = lowerName.includes('(box)') || lowerName.endsWith(' box')
        const product = stock.products.find(p => p.id === productId)
        if (!product?.goodsKeyword) continue
        if (!lowerName.includes(product.goodsKeyword.toLowerCase())) continue
        const packDelta = isBox && product.packsPerBox > 0
          ? -(goods.salesVolume * product.packsPerBox)
          : -goods.salesVolume
        items.push({
          productId: product.id, productName: product.name,
          date: report.date, goodsName: goods.goodsName,
          soldQty: goods.salesVolume, packDelta, isBox,
        })
      }
    }
    return items
  }

  /** หัก stock ตามยอดขาย — batch เดียว atomic ต่อการกด 1 ครั้ง */
  async function applySyncItems(items: SyncPreviewItem[], newDates?: string[]) {
    if (items.length === 0 && !newDates?.length) return
    const b = writeBatch(db())
    for (const item of items) {
      b.update(productRef(item.productId), { qty: increment(item.packDelta) })
      const e = newEntry({
        productId: item.productId, date: item.date, delta: item.packDelta,
        note: `📊 ${item.goodsName} ×${item.soldQty}`, kind: 'auto',
      })
      const { id, ...data } = e
      b.set(entryRef(id), data)
    }
    if (newDates?.length) {
      b.set(metaRef(), {
        syncedDates: Array.from(new Set([...(_stock.syncedDates ?? []), ...newDates])),
      }, { merge: true })
    }
    await b.commit()
  }

  const applySync = (items: SyncPreviewItem[], newDates: string[]) => applySyncItems(items, newDates)
  const applySyncProduct = (items: SyncPreviewItem[]) => applySyncItems(items)

  function getPendingDates(reports: DayReport[]): string[] {
    return reports.map(r => r.date).filter(d => !stock.syncedDates.includes(d))
  }

  function resetSyncedDates() {
    setDoc(metaRef(), { syncedDates: [] }, { merge: true })
  }

  // ── inventory snapshot ──────────────────────────────────────
  function previewInventorySnapshot(rows: InventoryRow[]): InventorySnapshotItem[] {
    const items: InventorySnapshotItem[] = []
    for (const row of rows) {
      const lowerName = row.goodsName.toLowerCase()
      for (const product of stock.products) {
        if (!product.goodsKeyword) continue
        if (!lowerName.includes(product.goodsKeyword.toLowerCase())) continue
        items.push({
          productId: product.id, productName: product.name,
          goodsName: row.goodsName, currentQty: product.qty, newQty: row.totalInventory,
        })
      }
    }
    return items
  }

  async function applyInventorySnapshot(items: InventorySnapshotItem[], date: string) {
    if (items.length === 0) return
    const b = writeBatch(db())
    for (const item of items) {
      b.update(productRef(item.productId), { qty: item.newQty })
      const e = newEntry({
        productId: item.productId, date, delta: item.newQty - item.currentQty,
        note: `📦 Inventory Snapshot (${item.goodsName})`, kind: 'in',
      })
      const { id, ...data } = e
      b.set(entryRef(id), data)
    }
    await b.commit()
  }

  // ── read helpers ────────────────────────────────────────────
  function getStatus(product: StockProduct): 'empty' | 'red' | 'yellow' | 'green' {
    if (product.qty <= 0) return 'empty'
    if (product.qty <= product.redAt) return 'red'
    if (product.qty <= product.yellowAt) return 'yellow'
    return 'green'
  }

  function getEntries(productId: string): StockEntry[] {
    return stock.entries
      .filter(e => e.productId === productId)
      .sort((a, b) => b.date.localeCompare(a.date))
  }

  /** เดิมใช้ตอนดึงจาก Sheet มาทับ — บน Firestore ไม่ต้องแล้ว (real-time listener จัดการเอง) */
  function replaceAll(_s: StockStore) { /* no-op */ }

  return {
    stock,
    addProduct, updateProduct, removeProduct, removeCategory, mergeCategory, logEntry,
    previewSync, applySync, previewSyncProduct, applySyncProduct,
    getPendingDates, resetSyncedDates,
    previewInventorySnapshot, applyInventorySnapshot,
    getStatus, getEntries,
    replaceAll, setTaxRate,
  }
}
