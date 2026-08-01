import { useState } from 'react'
import { Database, Loader2, Check, AlertTriangle } from 'lucide-react'
import type { DayReport } from '../types'
import { useStockStore } from '../hooks/useStockStore'
import { useOrderStore } from '../hooks/useOrderStore'
import {
  migrateToFirestore, migrateReportsToFirestore,
  type MigrateResult, type ReportMigrateResult,
} from '../lib/migrateToFirestore'
import { isFirebaseConfigured } from '../lib/firebase'

interface Props {
  /** ดึงรายงานยอดขายทั้งหมดจาก Google Sheet (source เดิม) */
  onFetchAllFromSheets?: () => Promise<DayReport[] | null>
  /** ดึงข้อมูลหน้าตู้จาก Google Sheet */
  onFetchMachineFromSheets?: () => Promise<string | null>
}

/**
 * ย้ายข้อมูลทั้งหมดจาก Google Sheet → Firebase (ครั้งเดียว)
 * กดซ้ำได้ปลอดภัย เพราะเขียนทับตาม id/วันที่เดิม (idempotent) และไม่แตะข้อมูลใน Sheet
 */
export default function MigratePanel({ onFetchAllFromSheets, onFetchMachineFromSheets }: Props) {
  const { stock }  = useStockStore()
  const { orders } = useOrderStore()
  const [running, setRunning] = useState(false)
  const [step,    setStep]    = useState('')
  const [result,  setResult]  = useState<MigrateResult | null>(null)
  const [repResult, setRepResult] = useState<ReportMigrateResult | null>(null)
  const [error,   setError]   = useState<string | null>(null)

  if (!isFirebaseConfigured) return null

  async function run() {
    setRunning(true); setError(null); setResult(null); setRepResult(null)
    try {
      setStep('กำลังย้ายสต็อก + ออเดอร์...')
      setResult(await migrateToFirestore(stock, orders))

      if (onFetchAllFromSheets) {
        setStep('กำลังดึงยอดขายจาก Google Sheet (ใช้เวลาสักครู่)...')
        const reports = await onFetchAllFromSheets()
        const machineRaw = onFetchMachineFromSheets ? await onFetchMachineFromSheets() : null
        let machine: unknown = null
        if (machineRaw) { try { machine = JSON.parse(machineRaw) } catch { machine = null } }
        if (reports?.length) {
          setStep(`กำลังย้ายยอดขาย ${reports.length} วัน...`)
          setRepResult(await migrateReportsToFirestore(reports, machine))
        }
      }
      setStep('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(false)
    }
  }

  const allOk = result?.ok && (repResult ? repResult.ok : true)

  return (
    <div className="rounded-2xl border border-purple-200 bg-purple-50/50 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Database size={15} className="text-purple-600 flex-shrink-0" />
        <p className="text-[13px] font-bold text-purple-700">ย้ายข้อมูลไป Firebase</p>
      </div>

      <p className="text-[11px] text-brand-dark/50 leading-relaxed">
        คัดลอกสต็อก + ออเดอร์ + <strong className="text-brand-dark/70">ยอดขายทุกวัน</strong> + หน้าตู้ ขึ้น Firebase
        <br />
        <strong className="text-brand-dark/70">ไม่ลบข้อมูลใน Sheet</strong> — Sheet ยังเป็น backup และกดซ้ำได้ไม่เกิดข้อมูลซ้ำ
      </p>

      <div className="flex items-center gap-3 text-[11px] text-brand-dark/50 flex-wrap">
        <span>สต็อก <strong className="text-brand-dark">{stock.products.length}</strong></span>
        <span>ออเดอร์ <strong className="text-brand-dark">{orders.length}</strong></span>
        <span>log <strong className="text-brand-dark">{stock.entries.length}</strong></span>
      </div>

      <button onClick={run} disabled={running}
        className="w-full py-2.5 rounded-xl bg-purple-600 text-white text-[13px] font-semibold disabled:opacity-50 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5">
        {running ? <><Loader2 size={14} className="animate-spin" /> {step || 'กำลังย้าย...'}</> : <><Database size={14} /> เริ่มย้ายข้อมูล</>}
      </button>

      {(result || repResult) && !running && (
        <div className={`rounded-xl border p-3 text-[11px] space-y-1 ${
          allOk ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'
        }`}>
          <p className={`font-bold flex items-center gap-1.5 ${allOk ? 'text-emerald-700' : 'text-amber-700'}`}>
            {allOk ? <><Check size={13} /> ย้ายสำเร็จ + ตรวจสอบแล้ว</> : <><AlertTriangle size={13} /> จำนวนไม่ตรง — ตรวจสอบ</>}
          </p>
          {result && (
            <p className="text-brand-dark/60">
              สินค้า {result.verified?.products}/{result.products} · ออเดอร์ {result.verified?.orders}/{result.orders} · log {result.verified?.entries}/{result.entries}
            </p>
          )}
          {repResult && (
            <p className="text-brand-dark/60">
              ยอดขาย {repResult.verified}/{repResult.reports} วัน{repResult.machine ? ' · หน้าตู้ ✓' : ''}
            </p>
          )}
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
