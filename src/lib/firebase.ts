import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore'

// Firebase web config ไม่ใช่ความลับ — ออกแบบมาให้ฝังใน client ได้ (ความปลอดภัยอยู่ที่ Firestore Rules)
// ฝังค่า default ไว้เลยเพื่อไม่ต้องตั้ง env ที่ Vercel; ยัง override ด้วย env ได้ถ้าอยากแยก project
const env = import.meta.env
const cfg = {
  apiKey:            (env.VITE_FB_API_KEY        as string) || 'AIzaSyAJxdm3JEWdwQ_JiwzDhW-TgqnB3xfHjDs',
  authDomain:        (env.VITE_FB_AUTH_DOMAIN    as string) || 'saltcard-c69eb.firebaseapp.com',
  projectId:         (env.VITE_FB_PROJECT_ID     as string) || 'saltcard-c69eb',
  storageBucket:     (env.VITE_FB_STORAGE_BUCKET as string) || 'saltcard-c69eb.firebasestorage.app',
  messagingSenderId: (env.VITE_FB_SENDER_ID      as string) || '878619829552',
  appId:             (env.VITE_FB_APP_ID         as string) || '1:878619829552:web:337813fd2e8598b75d14f5',
}

/** ตั้งค่า Firebase ครบหรือยัง — ถ้ายัง แอปจะ fallback ไปใช้ Google Sheet เหมือนเดิม */
export const isFirebaseConfigured = !!(cfg.apiKey && cfg.projectId && cfg.appId)

let _app: FirebaseApp | null = null
let _db: Firestore | null = null

/** init app ครั้งเดียว — ทั้ง Firestore และ Auth ใช้ตัวเดียวกัน */
function getApp(): FirebaseApp {
  if (!_app) _app = initializeApp(cfg as Required<typeof cfg>)
  return _app
}

/** Firestore instance (null ถ้ายังไม่ได้ตั้งค่า) — เปิด offline persistence ให้เขียนตอนเน็ตหลุดได้ */
export function getDb(): Firestore | null {
  if (!isFirebaseConfigured) return null
  if (_db) return _db
  _db = initializeFirestore(getApp(), {
    // cache ในเครื่อง + รองรับหลายแท็บพร้อมกัน → เขียนตอนออฟไลน์ได้ ส่งให้เองเมื่อเน็ตกลับมา
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  })
  return _db
}

/**
 * ล็อกอินแบบ anonymous ให้เองเบื้องหลัง (ไม่มีหน้า login)
 * — Firestore Rules ต้องการ request.auth != null เพื่อกันการยิง REST API ตรง
 * resolve เมื่อได้ user แล้ว; เรียกซ้ำได้ (คืน promise เดิม)
 */
let _authReady: Promise<void> | null = null
export function ensureAuth(): Promise<void> {
  if (!isFirebaseConfigured) return Promise.resolve()
  if (_authReady) return _authReady
  _authReady = new Promise<void>((resolve, reject) => {
    const auth = getAuth(getApp())
    onAuthStateChanged(auth, u => { if (u) resolve() })
    signInAnonymously(auth).catch(reject)
  })
  return _authReady
}

// ── ชื่อ collection ────────────────────────────────────────────
export const COL = {
  products: 'products',   // สินค้า 1 ตัว = 1 document
  orders:   'orders',     // ออเดอร์ 1 รายการ = 1 document
  entries:  'entries',    // log การเคลื่อนไหวสต็อก (audit trail)
  meta:     'meta',       // meta/stock = taxRate, syncedDates, hiddenCategories, categoryAliases
} as const

export const META_STOCK_DOC = 'stock'
