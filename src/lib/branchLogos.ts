/**
 * โลโก้ประจำสาขา — ใช้แทนข้อความ/อีโมจิ
 * ไฟล์อยู่ที่ public/pic/ ตั้งชื่อ <ชื่อสาขาแบบย่อ>Logo.png
 *
 * เทียบชื่อแบบไม่สนตัวพิมพ์ เพราะชื่อสาขาในไฟล์รายงานเขียนได้หลายแบบ
 * เช่น "เซ็นทรัล ระยอง" / "เซนทรัล ระยอง" / "Central Rayong"
 *
 * onLight = โลโก้เป็นสีเข้ม วางบนพื้นอ่อนได้
 * onDark  = โลโก้เป็นสีอ่อน/ขาว ต้องวางบนพื้นเข้มไม่งั้นมองไม่เห็น
 *           (centralLogo.png เป็นสีขาวล้วน วัดความสว่างได้ 255)
 */
export interface BranchBadge {
  src: string
  /** โลโก้สีอ่อน — ต้องใช้พื้นหลังเข้ม */
  needsDarkBg: boolean
}

const RULES: { match: RegExp; badge: BranchBadge }[] = [
  { match: /เซ็?นทรัล|central/i, badge: { src: '/pic/centralLogo.png', needsDarkBg: true  } },
  { match: /พาชชั่?น|passion/i,  badge: { src: '/pic/passionLogo.png', needsDarkBg: false } },
]

export function branchBadge(siteName: string): BranchBadge | null {
  if (!siteName || siteName === 'ทั้งหมด') return null
  return RULES.find(r => r.match.test(siteName))?.badge ?? null
}
