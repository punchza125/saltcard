import { useSyncExternalStore } from 'react'
import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore'
import type { TxDay } from '../types'
import { getDb, ensureAuth, COL } from '../lib/firebase'

/**
 * สรุปยอดขายแยกสาขา (จากไฟล์ Transaction Details)
 *
 * ทำไมไม่ใช้ onSnapshot ทั้ง collection เหมือน reports:
 *   ข้อมูลนี้เป็นของนำเข้าครั้งเดียวจบ ไม่ต้อง realtime และถ้าโหลดทั้งหมด
 *   ตั้งแต่เปิดแอปจะไปถ่วงเวลาโหลดหน้าแรกโดยไม่จำเป็น เพราะส่วนใหญ่ดู "ทุกสาขา"
 *   จึงโหลดครั้งเดียวตอนที่มีคนกดดูรายสาขาจริงๆ แล้ว cache ไว้ทั้ง session
 *   (Firestore offline persistence ยัง cache ต่อลงดิสก์ให้อีกชั้น)
 */

let _days: Record<string, TxDay> = {}
let _loaded = false
let _loading: Promise<void> | null = null
const _listeners = new Set<() => void>()
function notify() {
  _snapshot = { days: _days, loaded: _loaded }
  _listeners.forEach(fn => fn())
}
let _snapshot = { days: _days, loaded: _loaded }

const db = () => {
  const d = getDb()
  if (!d) throw new Error('Firebase ยังไม่ได้ตั้งค่า')
  return d
}

/** โหลดทั้งหมดครั้งเดียว — ~4KB ต่อวัน ทั้งปีก็ยังไม่ถึง 1.5MB */
export function loadTxDays(): Promise<void> {
  if (_loaded) return Promise.resolve()
  if (_loading) return _loading
  _loading = ensureAuth()
    .then(() => getDocs(collection(db(), COL.txDaily)))
    .then(snap => {
      const next: Record<string, TxDay> = {}
      snap.docs.forEach(d => { next[d.id] = { ...(d.data() as TxDay), date: d.id } })
      _days = next
      _loaded = true
      notify()
    })
    .catch(err => {
      console.error('[txDaily] โหลดไม่สำเร็จ', err)
      _loaded = true          // ไม่วนโหลดซ้ำไม่รู้จบ
      notify()
    })
    .finally(() => { _loading = null })
  return _loading
}

export async function saveTxDay(day: TxDay): Promise<void> {
  await ensureAuth()
  const { date, ...rest } = day
  await setDoc(doc(db(), COL.txDaily, date), { date, ...rest })
  _days = { ..._days, [date]: day }
  notify()
}

export async function removeTxDay(date: string): Promise<void> {
  await ensureAuth()
  await deleteDoc(doc(db(), COL.txDaily, date))
  const next = { ..._days }
  delete next[date]
  _days = next
  notify()
}

export async function clearTxDays(): Promise<void> {
  await ensureAuth()
  await Promise.all(Object.keys(_days).map(d => deleteDoc(doc(db(), COL.txDaily, d))))
  _days = {}
  notify()
}

export function useTxStore() {
  const snap = useSyncExternalStore(
    cb => { _listeners.add(cb); return () => _listeners.delete(cb) },
    () => _snapshot,
  )
  return { ...snap, load: loadTxDays, save: saveTxDay, remove: removeTxDay, clear: clearTxDays }
}
