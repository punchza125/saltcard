import type { CostRate, DayReport, PurchaseOrder, StockProduct } from '../types'
import { matchesKeyword } from '../utils/parser'

/**
 * การคิดกำไร — ตามสูตรในสเปรดชีตเดิม
 *
 *   ต้นทุน/กล่อง = ราคาซื้อของกล่องล่าสุดที่ "รับของแล้ว" ณ วันนั้น
 *   ต้นทุน/ซอง   = ต้นทุน/กล่อง ÷ จำนวนซองต่อกล่อง
 *   ราคาขาย      = ยอดเงิน ÷ จำนวนชิ้น ของสินค้านั้นในรายงานวันนั้น (ไม่ต้องกรอก)
 *   กำไรดิบ      = ราคาขาย − ต้นทุน
 *   กำไรสุทธิ    = ราคาขาย × (1 − ภาษี%) − ต้นทุน
 *   กำไร %       = กำไรสุทธิ ÷ ต้นทุน × 100
 */

/** ชื่อสินค้าในรายงานเป็นแบบขายยกกล่องหรือไม่ */
export function isBoxGoods(goodsName: string): boolean {
  const lower = goodsName.toLowerCase()
  return lower.includes('(box)') || lower.endsWith(' box')
}

export type CostSource = 'manual' | 'order' | 'default'
export interface CostPoint { from: string; perBox: number; source: 'manual' | 'order' }

export function sortCostRates(rates: CostRate[]): CostRate[] {
  return [...rates].sort((a, b) => a.from.localeCompare(b.from))
}

/**
 * รวมจุดเปลี่ยนต้นทุนทั้งหมดของสินค้าหนึ่งตัว เรียงตามวันที่
 *   - ที่กรอกเองในหน้าแก้ไขสินค้า (costRates)
 *   - ราคาจากออร์เดอร์ที่กดรับของแล้ว (นับตั้งแต่วันที่รับ)
 * ถ้าวันเดียวกัน ค่าที่กรอกเองชนะ เพราะถือว่าตั้งใจแก้ทีหลัง
 */
export function costTimeline(product: StockProduct, orders: PurchaseOrder[]): CostPoint[] {
  const points: CostPoint[] = []
  for (const o of orders) {
    if (o.status !== 'received' || !o.receivedAt) continue
    for (const it of o.items) {
      if (it.productId !== product.id || it.pricePerBox == null || it.pricePerBox <= 0) continue
      points.push({ from: o.receivedAt, perBox: it.pricePerBox, source: 'order' })
    }
  }
  for (const r of product.costRates ?? []) {
    if (r.perBox > 0) points.push({ from: r.from, perBox: r.perBox, source: 'manual' })
  }
  return points.sort((a, b) =>
    a.from === b.from
      ? (a.source === 'manual' ? 1 : -1)   // วันเดียวกัน: manual อยู่ท้าย = ชนะ
      : a.from.localeCompare(b.from))
}

/**
 * ต้นทุนต่อกล่องที่มีผล ณ วันที่กำหนด
 * = จุดเปลี่ยนล่าสุดที่ยังไม่เกินวันนั้น ถ้าไม่มีเลย → ราคาซื้อตั้งต้นของสินค้า
 */
export function costPerBoxOn(
  product: StockProduct,
  date: string,
  orders: PurchaseOrder[],
): number | undefined {
  let hit: CostPoint | undefined
  for (const p of costTimeline(product, orders)) {
    if (p.from <= date) hit = p
    else break
  }
  return hit?.perBox ?? product.buyPricePerBox
}

/** ต้นทุนที่มีผล ณ วันนั้น พร้อมบอกว่ามาจากไหน */
export function costDetailOn(product: StockProduct, date: string, orders: PurchaseOrder[]):
  { perBox?: number; source: CostSource } {
  let hit: CostPoint | undefined
  for (const p of costTimeline(product, orders)) {
    if (p.from <= date) hit = p
    else break
  }
  if (hit) return { perBox: hit.perBox, source: hit.source }
  return { perBox: product.buyPricePerBox, source: 'default' }
}

/** เพิ่ม/แทนที่ต้นทุนที่กรอกเองของวันนั้น — ถ้าไม่ต่างจากที่มีผลอยู่แล้ว จะไม่เพิ่มซ้ำ */
export function upsertCostRate(
  product: StockProduct,
  orders: PurchaseOrder[],
  from: string,
  perBox?: number,
): CostRate[] {
  const rest = sortCostRates((product.costRates ?? []).filter(r => r.from !== from))
  if (perBox == null || perBox <= 0) return rest        // ล้างค่า = ลบจุดนั้นทิ้ง
  const effective = costPerBoxOn({ ...product, costRates: rest }, from, orders)
  if (effective === perBox) return rest                  // ไม่เปลี่ยน
  return sortCostRates([...rest, { from, perBox }])
}

export function removeCostRate(product: StockProduct, from: string): CostRate[] {
  return sortCostRates((product.costRates ?? []).filter(r => r.from !== from))
}


export interface ProfitBreakdown {
  total: number         // กำไรสุทธิรวม (฿)
  revenue: number       // ยอดขายที่คิดกำไรได้ (฿)
  cost: number          // ต้นทุนรวม (฿)
  rawProfit: number     // กำไรก่อนหักภาษี (฿)
  tax: number           // ภาษีที่หักออก (฿)
  marginPct: number     // กำไรสุทธิ ÷ ต้นทุน × 100
  packQty: number; packProfit: number; avgPerPack: number
  boxQty: number;  boxProfit: number;  avgPerBox: number
  matched: number
  uncosted: string[]    // สินค้าที่ยังไม่รู้ต้นทุน — ไม่ถูกนับ
}

export function calcProfit(
  reports: DayReport[],
  products: StockProduct[],
  orders: PurchaseOrder[],
  taxRate: number,
): ProfitBreakdown | null {
  let revenue = 0, cost = 0
  let packQty = 0, packProfit = 0
  let boxQty  = 0, boxProfit  = 0
  let matched = 0
  const uncosted = new Set<string>()

  for (const report of reports) {
    for (const goods of report.goods) {
      if (goods.salesVolume <= 0) continue

      const product = products.find(p => p.goodsKeyword && matchesKeyword(goods.goodsName, p.goodsKeyword))
      const perBox  = product ? costPerBoxOn(product, report.date, orders) : undefined
      if (!product || perBox == null || perBox <= 0) { uncosted.add(goods.goodsName); continue }

      const box = isBoxGoods(goods.goodsName)
      const ppb = product.packsPerBox
      if (!box && ppb <= 0) { uncosted.add(goods.goodsName); continue }  // แปลงเป็นซองไม่ได้

      const unitCost = box ? perBox : perBox / ppb
      const unitSell = goods.salesAmount / goods.salesVolume     // ราคาขายจริงเฉลี่ยวันนั้น
      const unitNet  = unitSell * (1 - taxRate / 100) - unitCost

      revenue += goods.salesAmount
      cost    += unitCost * goods.salesVolume
      if (box) { boxQty  += goods.salesVolume; boxProfit  += unitNet * goods.salesVolume }
      else     { packQty += goods.salesVolume; packProfit += unitNet * goods.salesVolume }
      matched++
    }
  }

  if (matched === 0) return null
  const total = packProfit + boxProfit
  return {
    total, revenue, cost,
    rawProfit: revenue - cost,
    tax: revenue * (taxRate / 100),
    marginPct: cost > 0 ? (total / cost) * 100 : 0,
    packQty, packProfit, avgPerPack: packQty > 0 ? packProfit / packQty : 0,
    boxQty,  boxProfit,  avgPerBox:  boxQty  > 0 ? boxProfit  / boxQty  : 0,
    matched,
    uncosted: [...uncosted],
  }
}
