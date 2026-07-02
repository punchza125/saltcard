import { useState, useEffect } from 'react'
import type { StockStore, StockProduct, StockEntry, StockUnit, DayReport, EntryKind } from '../types'
import type { InventoryRow } from '../utils/parser'

const STORAGE_KEY = 'saltcard_stock'

function load(): StockStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      // migrate old entries missing kind
      if (parsed.entries) {
        parsed.entries = parsed.entries.map((e: StockEntry) => ({ kind: 'in', ...e }))
      }
      // migrate old products missing qtyIncoming
      if (parsed.products) {
        parsed.products = parsed.products.map((p: StockProduct) => ({ qtyIncoming: 0, category: '', ...p }))
      }
      return { syncedDates: [], taxRate: 15, ...parsed }
    }
  } catch {}
  return { products: [], entries: [], syncedDates: [], taxRate: 15 }
}

function save(s: StockStore) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}

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

export function useStockStore() {
  const [stock, setStock] = useState<StockStore>(load)

  function replaceAll(s: StockStore) {
    const migrated: StockStore = {
      ...s,
      syncedDates: s.syncedDates ?? [],
      entries:  (s.entries  ?? []).map(e => ({ ...e, kind: (e.kind ?? 'in') as EntryKind })),
      products: (s.products ?? []).map(p => ({ qtyIncoming: 0, category: '', ...p })),
    }
    setStock(migrated)
  }

  useEffect(() => { save(stock) }, [stock])

  function addProduct(
    name: string, unit: StockUnit, packsPerBox: number,
    qty: number, yellowAt: number, redAt: number, goodsKeyword: string, category: string
  ) {
    const product: StockProduct = {
      id: crypto.randomUUID(),
      name, unit, packsPerBox, qty, qtyIncoming: 0, yellowAt, redAt, goodsKeyword, category,
    }
    setStock(s => ({
      ...s,
      products: [...s.products, product],
      // ใช้หมวดนี้อีกครั้ง = ปลดซ่อน
      hiddenCategories: (s.hiddenCategories ?? []).filter(c => c !== category),
    }))
    return product.id
  }

  function updateProduct(id: string, patch: Partial<Omit<StockProduct, 'id'>>) {
    setStock(s => ({
      ...s,
      products: s.products.map(p => p.id === id ? { ...p, ...patch } : p),
      hiddenCategories: patch.category
        ? (s.hiddenCategories ?? []).filter(c => c !== patch.category)
        : s.hiddenCategories,
    }))
  }

  function removeProduct(id: string) {
    setStock(s => ({
      ...s,
      products: s.products.filter(p => p.id !== id),
      entries:  s.entries.filter(e => e.productId !== id),
    }))
  }

  // kind:
  //   'incoming' → บวก qtyIncoming เท่านั้น (ยังไม่ได้ของ)
  //   'received' → บวก qty, ลด qtyIncoming (ถ้ามี deductIncoming=true)
  //   'in'/'out'/'auto' → บวก/ลบ qty ตรงๆ
  function logEntry(
    productId: string,
    delta: number,
    note: string,
    kind: EntryKind,
    date?: string,
    deductIncoming?: boolean,
  ) {
    const entry: StockEntry = {
      id: crypto.randomUUID(),
      productId,
      date: date ?? new Date().toISOString().slice(0, 10),
      delta,
      note,
      kind,
    }
    setStock(s => ({
      ...s,
      products: s.products.map(p => {
        if (p.id !== productId) return p
        if (kind === 'incoming') {
          return { ...p, qtyIncoming: Math.max(0, p.qtyIncoming + delta) }
        }
        if (kind === 'received') {
          const deduct = deductIncoming ? Math.min(p.qtyIncoming, delta) : 0
          return { ...p, qty: p.qty + delta, qtyIncoming: Math.max(0, p.qtyIncoming - deduct) }
        }
        return { ...p, qty: p.qty + delta }
      }),
      entries: [...s.entries, entry],
    }))
  }

  // set of "productId::date" that already have an auto entry
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
    // per-product: ignore syncedDates global, only skip dates that already have an auto entry for THIS product
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

  function applySync(items: SyncPreviewItem[], newDates: string[]) {
    setStock(s => {
      let products = [...s.products]
      const entries = [...s.entries]
      for (const item of items) {
        products = products.map(p =>
          p.id === item.productId ? { ...p, qty: p.qty + item.packDelta } : p
        )
        entries.push({
          id: crypto.randomUUID(), productId: item.productId,
          date: item.date, delta: item.packDelta,
          note: `📊 ${item.goodsName} ×${item.soldQty}`, kind: 'auto',
        })
      }
      return { products, entries, syncedDates: [...s.syncedDates, ...newDates] }
    })
  }

  function applySyncProduct(items: SyncPreviewItem[]) {
    setStock(s => {
      let products = [...s.products]
      const entries = [...s.entries]
      for (const item of items) {
        products = products.map(p =>
          p.id === item.productId ? { ...p, qty: p.qty + item.packDelta } : p
        )
        entries.push({
          id: crypto.randomUUID(), productId: item.productId,
          date: item.date, delta: item.packDelta,
          note: `📊 ${item.goodsName} ×${item.soldQty}`, kind: 'auto',
        })
      }
      return { ...s, products, entries }
    })
  }

  function getPendingDates(reports: DayReport[]): string[] {
    return reports.map(r => r.date).filter(d => !stock.syncedDates.includes(d))
  }

  function resetSyncedDates() {
    setStock(s => ({ ...s, syncedDates: [] }))
  }

  function autoCategorize() {
    setStock(s => ({
      ...s,
      products: s.products.map(p => {
        if (p.category) return p
        const n = p.name.toLowerCase()
        let category = 'อื่นๆ'
        if (n.includes('one piece') || /\bop-?\d/.test(n)) category = 'One Piece'
        else if (n.includes('dragon ball') || /\bdb-?\d/.test(n)) category = 'Dragon Ball'
        else if (n.includes('naruto')) category = 'Naruto'
        else if (n.includes('pokemon') || n.includes('pokémon') || n.includes('ptcg') || /\bsv-?\d/.test(n)) category = 'Pokémon'
        return { ...p, category }
      }),
    }))
  }

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

  function applyInventorySnapshot(items: InventorySnapshotItem[], date: string) {
    setStock(s => {
      let products = [...s.products]
      const entries = [...s.entries]
      for (const item of items) {
        const delta = item.newQty - item.currentQty
        products = products.map(p =>
          p.id === item.productId ? { ...p, qty: item.newQty } : p
        )
        entries.push({
          id: crypto.randomUUID(), productId: item.productId,
          date, delta, note: `📦 Inventory Snapshot (${item.goodsName})`, kind: 'in',
        })
      }
      return { ...s, products, entries }
    })
  }

  function getStatus(product: StockProduct): 'empty' | 'red' | 'yellow' | 'green' {
    if (product.qty <= 0)              return 'empty'
    if (product.qty <= product.redAt)  return 'red'
    if (product.qty <= product.yellowAt) return 'yellow'
    return 'green'
  }

  function getEntries(productId: string): StockEntry[] {
    return stock.entries.filter(e => e.productId === productId).reverse()
  }

  function setTaxRate(rate: number) {
    setStock(s => ({ ...s, taxRate: rate }))
  }

  // ลบหมวดหมู่: ย้ายสินค้าในหมวดไป 'อื่นๆ' และซ่อนชื่อหมวดถาวร (ซิงค์ผ่าน Sheet)
  function removeCategory(name: string) {
    setStock(s => ({
      ...s,
      products: s.products.map(p => p.category === name ? { ...p, category: 'อื่นๆ' } : p),
      hiddenCategories: Array.from(new Set([...(s.hiddenCategories ?? []), name])),
    }))
  }

  return {
    stock,
    addProduct, updateProduct, removeProduct, removeCategory, logEntry,
    previewSync, applySync, previewSyncProduct, applySyncProduct,
    getPendingDates, resetSyncedDates,
    previewInventorySnapshot, applyInventorySnapshot,
    getStatus, getEntries,
    replaceAll, setTaxRate,
  }
}
