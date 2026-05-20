import { useState, useRef, useMemo } from 'react'
import { Upload, RefreshCw } from 'lucide-react'
import type { MachineReport, MachineSlot } from '../types'
import { parseMachineInventory, formatThaiDate } from '../utils/parser'

const STORAGE_KEY = 'saltcard_machine'

function loadReport(): MachineReport | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}
function saveReport(r: MachineReport) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(r))
}

function slotNum(s: MachineSlot) { return parseInt(s.slot, 10) }

function fillColor(inv: number, cap: number) {
  if (inv === 0 || cap === 0) return 'bg-red-400'
  const pct = inv / cap
  if (pct < 0.3) return 'bg-orange-400'
  if (pct < 0.6) return 'bg-yellow-400'
  return 'bg-emerald-400'
}
function borderColor(inv: number, cap: number) {
  if (inv === 0 || cap === 0) return 'border-red-300 bg-red-50/40'
  const pct = inv / cap
  if (pct < 0.3) return 'border-orange-200 bg-orange-50/20'
  if (pct < 0.6) return 'border-yellow-200 bg-yellow-50/20'
  return 'border-gray-200 bg-white'
}

function SlotCard({ slot }: { slot: MachineSlot }) {
  const [imgFailed, setImgFailed] = useState(false)
  const n   = slotNum(slot)
  const pct = slot.capacity > 0 ? slot.inventory / slot.capacity : 0
  const bar = fillColor(slot.inventory, slot.capacity)
  const bdr = borderColor(slot.inventory, slot.capacity)

  return (
    <div className={`rounded-lg border overflow-hidden flex flex-col h-full ${bdr} transition-all duration-200 hover:scale-105 hover:shadow-md hover:z-10 cursor-default`}>
      {/* slot number */}
      <div className="flex items-center justify-between px-1.5 pt-1 pb-0.5">
        <span className="text-[9px] font-bold text-brand-dark/40">{n}</span>
        {slot.inventory === 0 && (
          <span className="text-[7px] font-bold text-red-400 uppercase">หมด</span>
        )}
      </div>

      {/* image */}
      <div className="aspect-square bg-brand-pale/40 mx-1 rounded overflow-hidden relative">
        {!imgFailed && (
          <img
            src={`/Img/${slot.goodsName}.jpg`}
            alt={slot.goodsName}
            className="w-full h-full object-cover"
            onError={() => setImgFailed(true)}
          />
        )}
        {imgFailed && (
          <div className="w-full h-full flex items-center justify-center text-[7px] text-brand-dark/20 text-center p-1 leading-tight">
            {slot.goodsName}
          </div>
        )}
      </div>

      {/* name + count */}
      <div className="px-1.5 pt-1 pb-1">
        <p className="text-[8px] text-brand-dark/60 leading-tight line-clamp-2 mb-1 min-h-[2em]">
          {slot.goodsName}
        </p>
        <div className="flex items-center justify-between">
          <span className={`text-[11px] font-bold ${slot.inventory === 0 ? 'text-red-400' : 'text-brand-dark'}`}>
            {slot.inventory}
          </span>
          <span className="text-[8px] text-brand-dark/30">/{slot.capacity}</span>
        </div>
        <div className="h-1 bg-brand-pale rounded-full overflow-hidden mt-0.5">
          <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.min(pct * 100, 100)}%` }} />
        </div>
      </div>
    </div>
  )
}

export default function MachinePage() {
  const [report, setReport] = useState<MachineReport | null>(loadReport)
  const [site,   setSite]   = useState<string>('ทั้งหมด')
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const r = await parseMachineInventory(file)
    setReport(r)
    saveReport(r)
    setSite('ทั้งหมด')
  }

  const sites = useMemo(() => {
    if (!report) return []
    return Array.from(new Set(report.slots.map(s => s.siteName)))
  }, [report])

  // group slots into decades (10-19, 20-29, …)
  const rows = useMemo(() => {
    if (!report) return []
    const filtered = site === 'ทั้งหมด'
      ? report.slots
      : report.slots.filter(s => s.siteName === site)

    // group by decade
    const map = new Map<number, MachineSlot[]>()
    for (const s of filtered) {
      const n = slotNum(s)
      const decade = Math.floor(n / 10) * 10
      if (!map.has(decade)) map.set(decade, [])
      map.get(decade)!.push(s)
    }

    // sort decades, sort slots within each decade
    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([decade, slots]) => ({
        decade,
        label: `${decade}–${decade + 9}`,
        slots: slots.sort((a, b) => slotNum(a) - slotNum(b)),
      }))
  }, [report, site])

  const stats = useMemo(() => {
    if (!report) return { total: 0, out: 0, low: 0 }
    const slots = site === 'ทั้งหมด' ? report.slots : report.slots.filter(s => s.siteName === site)
    return {
      total: slots.length,
      out:   slots.filter(s => s.inventory === 0).length,
      low:   slots.filter(s => s.inventory > 0 && s.capacity > 0 && s.inventory / s.capacity < 0.3).length,
    }
  }, [report, site])

  if (!report) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 flex flex-col items-center gap-4 text-center">
        <div className="w-16 h-16 bg-brand-pale rounded-2xl flex items-center justify-center">
          <Upload size={24} className="text-brand-blue/50" />
        </div>
        <p className="text-[15px] font-semibold text-brand-dark">ยังไม่มีข้อมูลหน้าตู้</p>
        <p className="text-[13px] text-brand-dark/40">อัปโหลดไฟล์ Inventory Status จากระบบตู้</p>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-2 bg-brand-blue text-white text-[13px] font-medium px-5 py-2.5 rounded-xl hover:bg-brand-light active:scale-95 transition-all"
        >
          <Upload size={14} /> อัปโหลดไฟล์
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-[1400px] mx-auto px-3 py-4 space-y-3">

      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[13px] font-semibold text-brand-dark">หน้าตู้</p>
          <p className="text-[11px] text-brand-dark/40">
            {formatThaiDate(report.date)} · {stats.total} ช่อง ·{' '}
            <span className="text-red-500 font-medium">{stats.out} หมด</span>
            {stats.low > 0 && <span className="text-orange-500 font-medium"> · {stats.low} ใกล้หมด</span>}
          </p>
        </div>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 bg-brand-pale text-brand-blue text-[12px] font-medium px-3 py-2 rounded-lg hover:bg-brand-blue hover:text-white transition-colors"
        >
          <RefreshCw size={13} /> อัปเดตไฟล์
        </button>
      </div>

      {/* site tabs */}
      {sites.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
          {(['ทั้งหมด', ...sites] as string[]).map(s => (
            <button key={s} onClick={() => setSite(s)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[12px] font-medium border transition-all ${
                site === s
                  ? 'bg-brand-dark text-white border-transparent'
                  : 'bg-white text-brand-dark/60 border-brand-blue/15'
              }`}
            >{s}</button>
          ))}
        </div>
      )}

      {/* vending machine grid — rows by decade */}
      <div className="space-y-3">
        {rows.map(({ decade, label, slots }, rowIdx) => (
          <div
            key={decade}
            className="bg-white rounded-xl border border-brand-blue/10 overflow-hidden"
            style={{ animation: `fadeUp 0.35s ease both`, animationDelay: `${rowIdx * 60}ms` }}
          >
            {/* row header */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-brand-pale/40 border-b border-brand-blue/8">
              <span className="text-[10px] font-bold text-brand-dark/40 w-12">{label}</span>
              <div className="flex gap-1">
                {slots.map(s => (
                  <span
                    key={s.slot}
                    className={`w-1.5 h-1.5 rounded-full ${
                      s.inventory === 0 ? 'bg-red-400'
                      : s.capacity > 0 && s.inventory / s.capacity < 0.3 ? 'bg-orange-400'
                      : 'bg-emerald-400'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* slot cards — scrollable on mobile, full grid on desktop */}
            <div className="p-2 overflow-x-auto scrollbar-none">
              <div className="grid gap-1.5"
                style={{ gridTemplateColumns: `repeat(${Math.min(slots.length, 10)}, minmax(110px, 1fr))` }}
              >
                {slots.map((s, i) => (
                  <div key={s.slot} style={{ animation: `popIn 0.3s ease both`, animationDelay: `${rowIdx * 60 + i * 25}ms` }}>
                    <SlotCard slot={s} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
