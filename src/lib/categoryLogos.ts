/**
 * โลโก้ประจำหมวดสินค้า — ใช้แทนข้อความในปุ่ม filter
 * คีย์เทียบแบบไม่สนตัวพิมพ์/ช่องว่าง (Pokemon กับ Pokémon ถือเป็นตัวเดียวกัน)
 * หมวดที่ยังไม่มีโลโก้จะแสดงเป็นข้อความตามเดิม — เพิ่มไฟล์แล้วมาเติมบรรทัดตรงนี้ได้เลย
 */
const LOGOS: Record<string, string> = {
  'onepiece': '/pic/OPlogo.png',
  'pokemon':  '/pic/Pokemon_logo.png',
  'pokémon':  '/pic/Pokemon_logo.png',
  'lorcana':  '/pic/lorcanaLogo.png',
  'kayou':    '/pic/kayouLogo.png',
}

export function categoryLogo(name: string): string | null {
  return LOGOS[name.toLowerCase().replace(/\s+/g, '')] ?? null
}
