// สร้างรายชื่อไฟล์รูปใน public/Img ไว้ให้แอปค้นแบบไม่สนตัวพิมพ์/ช่องว่าง
// รันอัตโนมัติก่อน dev และ build (ดู predev/prebuild ใน package.json)
import { readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const imgDir = join(root, 'public', 'Img')
const outFile = join(root, 'src', 'generated', 'imgManifest.ts')

let files = []
try {
  files = readdirSync(imgDir).filter(f => /\.(jpe?g|png|webp)$/i.test(f)).sort()
} catch {
  // ไม่มีโฟลเดอร์รูปก็ปล่อยว่างไว้ ไม่ให้ build พัง
}

mkdirSync(dirname(outFile), { recursive: true })
writeFileSync(outFile,
  `// ไฟล์นี้ถูกสร้างอัตโนมัติโดย scripts/gen-img-manifest.mjs — อย่าแก้ด้วยมือ\n` +
  `export const IMG_FILES: string[] = ${JSON.stringify(files, null, 2)}\n`)

console.log(`[img-manifest] ${files.length} ไฟล์ → src/generated/imgManifest.ts`)
