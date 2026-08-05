import { LOGO_FILES } from '../generated/imgManifest'

/**
 * โลโก้ประจำหมวดสินค้า — ใช้แทนข้อความในปุ่ม filter
 *
 * กติกา: วางไฟล์ใน  public/logo/  แล้ว "ตั้งชื่อไฟล์ให้ตรงกับชื่อหมวด"
 *   เช่น หมวด "Dragon Ball" → public/logo/Dragon Ball.png
 *
 * ไม่ต้องแก้โค้ด และไม่ต้องเป๊ะเรื่อง:
 *   - ตัวพิมพ์เล็ก/ใหญ่   (dragonball.png ก็ได้)
 *   - ช่องว่าง            (DragonBall.png ก็ได้)
 *   - สระ/วรรณยุกต์ละติน  (Pokemon.png ใช้กับหมวด "Pokémon" ได้)
 *   - นามสกุล             (.png .jpg .webp .svg)
 */
const key = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '')  // ตัดสระละติน: é → e
   .toLowerCase()
   .replace(/\s+/g, '')

const LOGO_BY_KEY: Record<string, string> = (() => {
  const map: Record<string, string> = {}
  for (const f of LOGO_FILES) {
    const k = key(f.replace(/\.(jpe?g|png|webp|svg)$/i, ''))
    if (!(k in map)) map[k] = f
  }
  return map
})()

export function categoryLogo(name: string): string | null {
  const hit = LOGO_BY_KEY[key(name)]
  return hit ? `/logo/${encodeURIComponent(hit)}` : null
}
