import type { ProfitRate, StockProduct } from '../types'

/**
 * อัตรากำไรตามช่วงเวลา
 *
 * ทุกครั้งที่แก้กำไรต่อซอง/ต่อกล่อง จะบันทึกเป็น "ช่วงใหม่" ที่มีวันที่เริ่มมีผล
 * ยอดขายของแต่ละวันจะถูกคูณด้วยอัตราที่มีผล ณ วันนั้น ไม่ใช่อัตราล่าสุด
 * → แก้ราคาวันนี้ ไม่กระทบกำไรที่คำนวณไว้ของเมื่อวาน
 *
 * ลำดับการเลือกอัตราสำหรับวันที่ d:
 *   1. ช่วงที่ from ล่าสุดแต่ยังไม่เกิน d
 *   2. ถ้า d เก่ากว่าทุกช่วง → ใช้ค่าตั้งต้น profitPerPack/profitPerBox (ของเดิมก่อนมีประวัติ)
 *   3. ถ้าไม่มีค่าตั้งต้น → ใช้ช่วงที่เก่าที่สุด (กันไม่ให้วันเก่ากลายเป็น "ยังไม่ตั้งกำไร")
 */

export function sortRates(rates: ProfitRate[]): ProfitRate[] {
  return [...rates].sort((a, b) => a.from.localeCompare(b.from))
}

export function rateOn(product: StockProduct, date: string): { perPack?: number; perBox?: number } {
  const rates = product.profitRates?.length ? sortRates(product.profitRates) : []
  if (!rates.length) return { perPack: product.profitPerPack, perBox: product.profitPerBox }

  let hit: ProfitRate | undefined
  for (const r of rates) {
    if (r.from <= date) hit = r
    else break
  }
  if (hit) return { perPack: hit.perPack, perBox: hit.perBox }

  // วันที่เก่ากว่าช่วงแรกทั้งหมด
  if (product.profitPerPack != null || product.profitPerBox != null) {
    return { perPack: product.profitPerPack, perBox: product.profitPerBox }
  }
  return { perPack: rates[0].perPack, perBox: rates[0].perBox }
}

/** อัตราที่ใช้อยู่ ณ วันนี้ */
export function currentRate(product: StockProduct) {
  return rateOn(product, new Date().toISOString().slice(0, 10))
}

/**
 * เพิ่ม/แทนที่ช่วงที่เริ่มวันเดียวกัน แล้วคืน array ที่เรียงแล้ว
 * ถ้าค่าใหม่เท่ากับอัตราที่มีผลอยู่แล้ว ณ วันนั้น จะไม่เพิ่มช่วงซ้ำ
 */
export function upsertRate(
  product: StockProduct,
  from: string,
  perPack?: number,
  perBox?: number,
): ProfitRate[] {
  const rest = (product.profitRates ?? []).filter(r => r.from !== from)
  const next = sortRates(rest)

  if (perPack == null && perBox == null) return next   // ล้างค่า = ลบช่วงนั้นทิ้ง

  const effective = rateOn({ ...product, profitRates: next }, from)
  if (effective.perPack === perPack && effective.perBox === perBox) return next  // ไม่เปลี่ยน

  // ห้ามใส่ key ที่เป็น undefined — Firestore ไม่รับค่า undefined ที่อยู่ในอาร์เรย์
  const rate: ProfitRate = { from }
  if (perPack != null) rate.perPack = perPack
  if (perBox  != null) rate.perBox  = perBox
  return sortRates([...next, rate])
}

export function removeRate(product: StockProduct, from: string): ProfitRate[] {
  return sortRates((product.profitRates ?? []).filter(r => r.from !== from))
}
