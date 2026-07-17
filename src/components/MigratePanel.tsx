import { useState } from 'react'
import { Database, Loader2, Check, AlertTriangle } from 'lucide-react'
import { useStockStore } from '../hooks/useStockStore'
import { useOrderStore } from '../hooks/useOrderStore'
import { migrateToFirestore, type MigrateResult } from '../lib/migrateToFirestore'
import { isFirebaseConfigured } from '../lib/firebase'

/**
 * ย้ายข้อมูลสต็อก+ออเดอร์จาก Google Sheet → Firebase (ครั้งเดียว)
 * กดซ้ำได้ปลอดภัย เพราะเขียนทับตาม id เดิม (idempotent) และไม่แตะข้อมูลใน Sheet
 */
export default function MigratePanel() {
  const { stock }  = useStockStore()
  const { orders } = useOrderStore()
  const [running, setRunning] = useState(false)
  const [result,  setResult]  = useState<MigrateResult | null>(null)
  const [error,   setError]   = useState<string | null>(null)

  if (!isFirebaseConfigured) return null

  async function run() {
    setRunning(true); setError(null); setResult(null)
    try {
      setResult(await migrateToFirestore(stock, orders))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="rounded-2xl border border-purple-200 bg-purple-50/50 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Database size={15} className="text-purple-600 flex-shrink-0" />
        <p className="text-[13px] font-bold text-purple-700">ย้ายข้อมูลไป Firebase</p>
      </div>

      <p className="text-[11px] text-brand-dark/50 leading-relaxed">
        คัดลอกสต็อก + ออเดอร์ที่โหลดมาจาก Google Sheet ขึ้น Firebase
        <br />
        <strong className="text-brand-dark/70">ไม่ลบข้อมูลใน Sheet</strong> — Sheet ยังเป็น backup และกดซ้ำได้ไม่เกิดข้อมูลซ้ำ
      </p>

      <div className="flex items-center gap-3 text-[11px] text-brand-dark/50">
        <span>จะย้าย: <strong className="text-brand-dark">{stock.products.length}</strong> สินค้า</span>
        <span><strong className="text-brand-dark">{orders.length}</strong> ออเดอร์</span>
        <span><strong className="text-brand-dark">{stock.entries.length}</strong> log</span>
      </div>

      <button onClick={run} disabled={running}
        className="w-full py-2.5 rounded-xl bg-purple-600 text-white text-[13px] font-semibold disabled:opacity-50 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5">
        {running ? <><Loader2 size={14} className="animate-spin" /> กำลังย้าย...</> : <><Database size={14} /> เริ่มย้ายข้อมูล</>}
      </button>

      {result && (
        <div className={`rounded-xl border p-3 text-[11px] space-y-1 ${
          result.ok ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'
        }`}>
          <p className={`font-bold flex items-center gap-1.5 ${result.ok ? 'text-emerald-700' : 'text-amber-700'}`}>
            {result.ok ? <><Check size={13} /> ย้ายสำเร็จ + ตรวจสอบแล้ว</> : <><AlertTriangle size={13} /> จำนวนไม่ตรง — ตรวจสอบ</>}
          </p>
          <p className="text-brand-dark/60">
            สินค้า {result.verified?.products}/{result.products} · ออเดอร์ {result.verified?.orders}/{result.orders} · log {result.verified?.entries}/{result.entries}
          </p>
          <p className="text-brand-dark/40">(ตัวเลขใน Firebase / ที่ส่งไป — เท่ากันหรือมากกว่า = ครบ)</p>
        </div>
      )}

      {error && (
        <p className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          ย้ายไม่สำเร็จ: {error}
        </p>
      )}
    </div>
  )
}
