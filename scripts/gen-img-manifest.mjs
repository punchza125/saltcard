// สร้างรายชื่อไฟล์รูปไว้ให้แอปค้นแบบไม่สนตัวพิมพ์/ช่องว่าง
//   public/Img  → รูปสินค้า
//   public/logo → โลโก้ประจำหมวด (ตั้งชื่อไฟล์ = ชื่อหมวด)
// รันอัตโนมัติก่อน dev และ build (ดู predev/prebuild ใน package.json)
import { readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outFile = join(root, 'src', 'generated', 'imgManifest.ts')
const IMAGE_RE = /\.(jpe?g|png|webp|svg)$/i

function list(...segments) {
  try {
    return readdirSync(join(root, ...segments)).filter(f => IMAGE_RE.test(f)).sort()
  } catch {
    return []  // ไม่มีโฟลเดอร์ก็ปล่อยว่าง ไม่ให้ build พัง
  }
}

const imgFiles  = list('public', 'Img')
const logoFiles = list('public', 'logo')

mkdirSync(dirname(outFile), { recursive: true })
writeFileSync(outFile,
  `// ไฟล์นี้ถูกสร้างอัตโนมัติโดย scripts/gen-img-manifest.mjs — อย่าแก้ด้วยมือ\n` +
  `export const IMG_FILES: string[] = ${JSON.stringify(imgFiles, null, 2)}\n\n` +
  `export const LOGO_FILES: string[] = ${JSON.stringify(logoFiles, null, 2)}\n`)

console.log(`[img-manifest] สินค้า ${imgFiles.length} ไฟล์, โลโก้ ${logoFiles.length} ไฟล์`)
