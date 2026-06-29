export interface AreaRow {
  name: string
  salesVolume: number
  salesAmount: number
  cashVolume: number
  cashAmount: number
  mdbVolume: number
  mdbAmount: number
  promptVolume: number
  promptAmount: number
  qr30Volume: number
  qr30Amount: number
  alipayVolume: number
  alipayAmount: number
  wechatVolume: number
  wechatAmount: number
  vipVolume: number
  vipAmount: number
  mifareVolume: number
  mifareAmount: number
  paytmVolume: number
  paytmAmount: number
}

export interface GoodsRow {
  goodsNumber: string
  goodsName: string
  goodsType: string
  salesVolume: number
  salesAmount: number
}

export interface DayReport {
  date: string          // YYYY-MM-DD
  fileName: string
  areas: AreaRow[]
  routes: AreaRow[]
  sites: AreaRow[]
  goods: GoodsRow[]
}

export interface DashboardStore {
  reports: DayReport[]
}

export type StockUnit = 'Box' | 'Pack' | 'Carton' | 'ชิ้น'

export interface StockProduct {
  id: string
  name: string
  unit: StockUnit
  packsPerBox: number    // จำนวน pack ต่อ 1 box (0 = ไม่แปลง)
  qty: number            // ของในมือ (pack)
  qtyIncoming: number    // ของที่สั่งแล้วรอรับ (pack)
  yellowAt: number       // warn threshold (pack)
  redAt: number          // critical threshold (pack)
  goodsKeyword: string   // keyword จับคู่ชื่อใน Goods Aspect เช่น "PRB-02"
  category: string       // หมวดหมู่ เช่น "One Piece"
  buyPricePerBox?: number   // ราคาซื้อต่อกล่อง (฿)
  sellPricePerPack?: number // ราคาขายต่อซอง (฿)
  sellPricePerBox?: number  // ราคาขายต่อกล่อง (฿) — optional
}

export type EntryKind = 'in' | 'received' | 'incoming' | 'out' | 'auto' | 'adjust'

export interface StockEntry {
  id: string
  productId: string
  date: string
  delta: number       // positive = เข้า, negative = ออก (หน่วย pack เสมอ)
  note: string
  kind: EntryKind
}

export interface MachineSlot {
  machineNumber: string
  siteName: string
  goodsNumber: string
  goodsName: string
  slot: string
  capacity: number
  inventory: number
  status: string
}

export interface MachineReport {
  date: string
  fileName: string
  slots: MachineSlot[]
}

export interface StockStore {
  products: StockProduct[]
  entries: StockEntry[]
  syncedDates: string[]  // วันที่ที่ sync จากรายงานแล้ว
  taxRate: number        // ภาษี % เช่น 15
}

// ── Purchase Order / Shipping Tracking ──────────────────────────────────────

export const CARRIERS = [
  { id: 'kerry',    label: 'Kerry Express',    trackUrl: (n: string) => `https://th.kerryexpress.com/th/track/?track=${n}` },
  { id: 'flash',    label: 'Flash Express',    trackUrl: (n: string) => `https://www.flashexpress.co.th/fle/tracking/?se=${n}` },
  { id: 'thaipost', label: 'ไปรษณีย์ไทย',     trackUrl: (n: string) => `https://track.thailandpost.co.th/?trackNumber=${n}` },
  { id: 'jt',       label: 'J&T Express',      trackUrl: (n: string) => `https://www.jtexpress.co.th/index/query/gzquery.html?bills=${n}` },
  { id: 'ninja',    label: 'Ninja Van',         trackUrl: () => `https://www.ninjavan.co/th-th/tracking` },
  { id: 'dhl',      label: 'DHL',               trackUrl: (n: string) => `https://www.dhl.com/th-th/home/tracking.html?tracking-id=${n}` },
  { id: 'kex',      label: 'KEX Express',       trackUrl: (n: string) => `https://www.kexpress.co.th/tracking/?trackNumber=${n}` },
  { id: 'other',    label: 'อื่นๆ',             trackUrl: () => '' },
] as const

export type CarrierId = typeof CARRIERS[number]['id']

export interface OrderItem {
  productId?: string   // id จาก StockProduct (ถ้ามี)
  name: string         // ชื่อสินค้า (สำเนาจาก product หรือพิมพ์เอง)
  qty: number          // จำนวนที่สั่ง
  unit: string         // หน่วย (Box/Pack/etc)
}

export type OrderStatus = 'ordered' | 'in_transit' | 'received'

export const ORDER_MEMBERS = ['Punch', 'Tai', 'Ranger', 'Mark'] as const
export type OrderMember = typeof ORDER_MEMBERS[number]

export interface PurchaseOrder {
  id: string
  createdAt: string       // ISO date
  orderedBy?: OrderMember
  supplier?: string
  notes?: string
  items: OrderItem[]
  carrier?: CarrierId
  trackingNumber?: string
  status: OrderStatus
  receivedAt?: string
}
