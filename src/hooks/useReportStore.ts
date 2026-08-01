import { useSyncExternalStore } from 'react'
import { collection, doc, onSnapshot, setDoc, deleteDoc, writeBatch } from 'firebase/firestore'
import type { DayReport } from '../types'
import { getDb, ensureAuth, COL, META_MACHINE_DOC } from '../lib/firebase'

// ── Shared store: รายงานยอดขายจาก Firestore (1 วัน = 1 document) ──────────
// เก็บทั้งวันไว้ใน document เดียว (areas/routes/sites/goods) → เขียนทีเดียว atomic
// ไม่มีทางที่สาขาหนึ่งเข้าแล้วอีกสาขาหาย แบบที่เคยเจอตอนใช้ Google Sheet
let _reports: DayReport[] = []
let _loaded = false
const _listeners = new Set<() => void>()
function notify() { _listeners.forEach(fn => fn()) }

let _started = false
function startListener() {
  if (_started) return
  const db = getDb()
  if (!db) return
  _started = true
  ensureAuth().then(() => {
    onSnapshot(collection(db, COL.reports), snap => {
      _reports = snap.docs
        .map(d => d.data() as DayReport)
        .sort((a, b) => a.date.localeCompare(b.date))
      _loaded = true
      notify()
    })
  })
}

const db = () => {
  const d = getDb()
  if (!d) throw new Error('Firebase ยังไม่ได้ตั้งค่า')
  return d
}
const reportRef = (date: string) => doc(db(), COL.reports, date)

/** Firestore ไม่รับ undefined → ตัดทิ้งก่อนเขียน */
function clean<T>(v: T): T {
  return JSON.parse(JSON.stringify(v ?? null))
}

export function useReportStore() {
  startListener()
  const reports = useSyncExternalStore(
    cb => { _listeners.add(cb); return () => _listeners.delete(cb) },
    () => _reports,
  )

  /** บันทึกรายงาน 1 วัน — เขียนทับทั้ง document (id = วันที่) จึงไม่มีข้อมูลค้างของเก่า */
  async function saveReport(report: DayReport) {
    await setDoc(reportRef(report.date), clean({
      date:     report.date,
      fileName: report.fileName ?? '',
      areas:    report.areas  ?? [],
      routes:   report.routes ?? [],
      sites:    report.sites  ?? [],
      goods:    report.goods  ?? [],
    }))
  }

  /** บันทึกหลายวันพร้อมกัน (ใช้ตอน migrate) */
  async function saveMany(list: DayReport[]) {
    const CHUNK = 400  // Firestore จำกัด 500 ops ต่อ batch
    for (let i = 0; i < list.length; i += CHUNK) {
      const b = writeBatch(db())
      for (const r of list.slice(i, i + CHUNK)) {
        b.set(reportRef(r.date), clean({
          date: r.date, fileName: r.fileName ?? '',
          areas: r.areas ?? [], routes: r.routes ?? [],
          sites: r.sites ?? [], goods: r.goods ?? [],
        }))
      }
      await b.commit()
    }
  }

  async function removeReport(date: string) {
    await deleteDoc(reportRef(date))
  }

  return { reports, loaded: _loaded, saveReport, saveMany, removeReport }
}

// ── หน้าตู้ (machine report) — เก็บเป็น document เดียวใน meta ─────────────
export async function saveMachineReport(data: unknown) {
  await ensureAuth()
  const d = getDb()
  if (!d) throw new Error('Firebase ยังไม่ได้ตั้งค่า')
  await setDoc(doc(d, COL.meta, META_MACHINE_DOC), clean({ data }))
}

export function subscribeMachineReport(cb: (data: unknown | null) => void) {
  const d = getDb()
  if (!d) return () => {}
  let unsub = () => {}
  ensureAuth().then(() => {
    unsub = onSnapshot(doc(d, COL.meta, META_MACHINE_DOC), snap => {
      cb(snap.exists() ? (snap.data() as { data?: unknown }).data ?? null : null)
    })
  })
  return () => unsub()
}
