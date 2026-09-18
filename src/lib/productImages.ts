import { IMG_FILES } from '../generated/imgManifest'

/**
 * หารูปสินค้าจากชื่อ — ใช้ร่วมกันทั้งหน้าภาพรวมและหน้าสต็อก
 *
 * เทียบชื่อแบบไม่สน:
 *   - ตัวพิมพ์เล็ก/ใหญ่ และช่องว่าง
 *   - อักขระที่ macOS/Windows ห้ามใช้ในชื่อไฟล์  / \ : * ? " < > |
 *   - ขีด - และขีดล่าง _
 *
 * เพราะชื่อสินค้าบางตัวมี / อยู่ เช่น "Topps - Premier League 2026/27 (1 Pack)"
 * ซึ่งตั้งเป็นชื่อไฟล์ไม่ได้ ตั้งแบบไหนก็ใช้ได้หมด:
 *   Topps - Premier League 2026-27 (1 Pack).jpg
 *   Topps - Premier League 2026_27 (1 Pack).jpg
 *   Topps - Premier League 202627 (1 Pack).jpg
 */
export function imgKey(s: string): string {
  return s
    .replace(/\.(jpe?g|png|webp)$/i, '')
    .toLowerCase()
    .replace(/[\s/\\:*?"<>|\-_]+/g, '')
}

const IMG_BY_KEY: Record<string, string> = (() => {
  const map: Record<string, string> = {}
  for (const f of IMG_FILES) {
    const k = imgKey(f)
    if (!(k in map)) map[k] = f
  }
  return map
})()

function promotionBase(name: string): string {
  return name
    .replace(/^\[Promotion\]\s*/i, '')
    .replace(/^Promotion\s*-\s*/i, '')
    .replace(/\s*\(Promotion\)\s*$/i, '')
    .trim()
}

/**
 * รายการ path รูปที่เจอจริงใน public/Img เรียงจากตรงที่สุดไปหาใกล้เคียง
 * - สินค้า [Promotion] ใช้รูปปกติของสินค้านั้นก่อน
 * - ชื่อที่ไม่มี (1 Pack)/(Box) ลองเติม (1 Pack) ให้
 * - สินค้า (Box) ที่ไม่มีรูปกล่อง ใช้รูปซองแทน
 */
export function productImageCandidates(...names: (string | null | undefined)[]): string[] {
  const tries: string[] = []
  for (const raw of names) {
    if (!raw) continue
    const base = promotionBase(raw)
    const list = base !== raw ? [base, raw] : [raw]
    for (const b of [...list]) {
      if (!/\((1 Pack|Box)\)\s*$/i.test(b)) list.push(`${b} (1 Pack)`)
      const noBox = b.replace(/\s*\(Box\)\s*$/i, '')
      if (noBox !== b) list.push(`${noBox} (1 Pack)`)
    }
    tries.push(...list)
  }
  const out: string[] = []
  for (const n of tries) {
    const hit = IMG_BY_KEY[imgKey(n)]
    // encode ชื่อไฟล์ — กันช่องว่าง/วงเล็บ/อักขระพิเศษทำ URL เพี้ยน
    if (hit) out.push(`/Img/${encodeURIComponent(hit)}`)
  }
  return [...new Set(out)]
}
