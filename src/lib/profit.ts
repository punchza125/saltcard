import type { DayReport, PurchaseOrder, StockProduct } from '../types'
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

/**
 * ต้นทุนต่อกล่องที่มีผล ณ วันที่กำหนด
 * = ราคาของออร์เดอร์ล่าสุดที่รับของแล้ว (receivedAt ≤ date) และกรอกราคาไว้
 * ถ้ายังไม่มีออร์เดอร์ไหนกรอกราคาก่อนวันนั้น → ใช้ราคาซื้อตั้งต้นของสินค้า
 */
export function costPerBoxOn(
  product: StockProduct,
  date: string,
  orders: PurchaseOrder[],
): number | undefined {
  let best: { at: string; price: number } | undefined
  for (const o of orders) {
    if (o.status !== 'received' || !o.receivedAt || o.receivedAt > date) continue
    for (const it of o.items) {
      if (it.productId !== product.id || it.pricePerBox == null || it.pricePerBox <= 0) continue
      if (!best || o.receivedAt > best.at) best = { at: o.receivedAt, price: it.pricePerBox }
    }
  }
  return best?.price ?? product.buyPricePerBox
}

/** ต้นทุนต่อกล่องที่ใช้อยู่ตอนนี้ */
export function currentCostPerBox(product: StockProduct, orders: PurchaseOrder[]) {
  return costPerBoxOn(product, new Date().toISOString().slice(0, 10), orders)
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
