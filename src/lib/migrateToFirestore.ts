import { collection, doc, getDocs, writeBatch } from 'firebase/firestore'
import type { StockStore, StockProduct, PurchaseOrder } from '../types'
import { getDb, ensureAuth, COL, META_STOCK_DOC } from './firebase'

export interface MigrateResult {
  products: number
  orders: number
  entries: number
  meta: boolean
  verified?: { products: number; orders: number; entries: number }
  ok?: boolean
}

/**
 * ย้ายข้อมูลที่แอปโหลดมาจาก Google Sheet แล้ว → Firestore
 * - เขียนแบบ merge ตาม id เดิม → รันซ้ำได้ ไม่เกิดข้อมูลซ้ำ (idempotent)
 * - ไม่ลบอะไรใน Sheet — Sheet ยังเป็น backup
 */
export async function migrateToFirestore(stock: StockStore, orders: PurchaseOrder[]): Promise<MigrateResult> {
  await ensureAuth()
  const db = getDb()
  if (!db) throw new Error('Firebase ยังไม่ได้ตั้งค่า')

  const products = stock.products ?? []
  const entries  = stock.entries ?? []

  // Firestore จำกัด 500 ops ต่อ batch → แบ่งเป็นชุด
  const CHUNK = 400
  const commitInChunks = async <T,>(items: T[], write: (b: ReturnType<typeof writeBatch>, item: T) => void) => {
    for (let i = 0; i < items.length; i += CHUNK) {
      const b = writeBatch(db)
      items.slice(i, i + CHUNK).forEach(item => write(b, item))
      await b.commit()
    }
  }

  // สินค้า: 1 ตัว = 1 document (ใช้ id เดิม เพื่อให้ productId ใน orders ยังผูกกันถูก)
  await commitInChunks(products, (b, p: StockProduct) => {
    const { id, ...rest } = p
    b.set(doc(db, COL.products, id), rest, { merge: true })
  })

  // ออเดอร์
  await commitInChunks(orders, (b, o: PurchaseOrder) => {
    const { id, ...rest } = o
    b.set(doc(db, COL.orders, id), rest, { merge: true })
  })

  // log การเคลื่อนไหว (audit trail) — เดิมไม่เคย sync ขึ้น Sheet เลย
  await commitInChunks(entries, (b, e: any) => {
    const { id, ...rest } = e
    b.set(doc(db, COL.entries, id), rest, { merge: true })
  })

  // meta: taxRate / syncedDates / hiddenCategories / categoryAliases
  const metaBatch = writeBatch(db)
  metaBatch.set(doc(db, COL.meta, META_STOCK_DOC), {
    taxRate:          stock.taxRate ?? 15,
    syncedDates:      stock.syncedDates ?? [],
    hiddenCategories: stock.hiddenCategories ?? [],
    categoryAliases:  stock.categoryAliases ?? {},
  }, { merge: true })
  await metaBatch.commit()

  // verify: อ่านกลับมานับว่าครบไหม
  const [pSnap, oSnap, eSnap] = await Promise.all([
    getDocs(collection(db, COL.products)),
    getDocs(collection(db, COL.orders)),
    getDocs(collection(db, COL.entries)),
  ])
  const verified = { products: pSnap.size, orders: oSnap.size, entries: eSnap.size }

  return {
    products: products.length,
    orders: orders.length,
    entries: entries.length,
    meta: true,
    verified,
    ok: verified.products >= products.length
      && verified.orders >= orders.length
      && verified.entries >= entries.length,
  }
}
