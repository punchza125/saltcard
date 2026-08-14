import React, { useRef, useState, useCallback, useEffect } from 'react'
import {
  Upload, FileSpreadsheet, X,
  CheckCircle, AlertCircle, Loader2,
  Link, RefreshCw, CloudUpload, MapPin,
} from 'lucide-react'
import type { DayReport } from '../types'
import { parseMultiReport, parseTransactionDetails, formatThaiDate } from '../utils/parser'
import { useTxStore } from '../hooks/useTxStore'
import MigratePanel from './MigratePanel'

interface UploadPageProps {
  centralReports: DayReport[]
  passionReports: DayReport[]
  onAddCentral: (r: DayReport) => void
  onAddPassion: (r: DayReport) => void
  onRemoveCentral: (date: string) => void
  onRemovePassion: (date: string) => void
  onClearCentral: () => void
  onClearPassion: () => void
  sheetsUrl: string
  lastSynced: string | null
  onPushReport: (r: DayReport) => Promise<boolean>
  onFetchAll: () => Promise<DayReport[] | null>
  onFetchMachine?: () => Promise<string | null>
  onOpenSheetsConfig: () => void
}

interface FileStatus {
  name: string
  branch: string
  status: 'parsing' | 'done' | 'syncing' | 'synced' | 'error'
  message?: string
}

/**
 * ช่องอัปโหลด 2 ช่อง
 *   sales = Multi-Report (ไฟล์สรุปยอด มีทุกสาขาในไฟล์เดียว)
 *   tx    = Transaction Details (ยอดรายรายการ ใช้แยกสินค้าตามสาขา)
 * ระบบดูจากชื่อไฟล์อยู่แล้ว วางผิดช่องก็ยังเข้าถูกที่
 */
const ZONES = [
  { id: 'sales', label: 'ไฟล์สรุปยอด',        color: '#1a52b3', emoji: '📊',
    hint: 'Multi-Report — รวมทุกสาขาในไฟล์เดียว' },
  { id: 'tx',    label: 'ไฟล์รายการขาย',      color: '#10b981', emoji: '🧾',
    hint: 'Transaction Details — แยกสินค้าตามสาขา' },
] as const


function StatusIcon({ status }: { status: FileStatus['status'] }) {
  if (status === 'parsing' || status === 'syncing')
    return <Loader2 size={14} className="text-brand-blue animate-spin flex-shrink-0" />
  if (status === 'done')
    return <CheckCircle size={14} className="text-green-400 flex-shrink-0" />
  if (status === 'synced')
    return <CloudUpload size={14} className="text-blue-400 flex-shrink-0" />
  return <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
}

// Map branch label → which store handler to call
const BRANCH_HANDLERS: Record<string, 'central' | 'passion'> = {
  'เซนทรัล ระยอง': 'central',
  'พาชชั่น ระยอง': 'passion',
}

export default function UploadPage({
  centralReports, passionReports,
  onAddCentral, onAddPassion,
  onRemoveCentral, onRemovePassion,
  onClearCentral, onClearPassion,
  sheetsUrl, lastSynced,
  onPushReport, onFetchAll, onFetchMachine, onOpenSheetsConfig,
}: UploadPageProps) {
  const { days: txDays, load: loadTx, save: saveTx, remove: removeTx, clear: clearTx } = useTxStore()
  useEffect(() => { loadTx() }, [loadTx])

  const [fileStatuses, setFileStatuses] = useState<FileStatus[]>([])
  const [fetching,    setFetching]    = useState(false)
  const [pushingAll,  setPushingAll]  = useState(false)
  const [draggingId,  setDraggingId]  = useState<string | null>(null)

  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const handlePushAll = async () => {
    const all = [...centralReports, ...passionReports]
    if (!all.length) return
    setPushingAll(true)
    for (const r of all) await onPushReport(r)
    setPushingAll(false)
  }

  // Auto-detect branch from parsed report, fall back to the zone it was dropped in
  function detectBranch(report: DayReport, fallback: string): 'central' | 'passion' {
    // ไฟล์ Multi-Report แบบใหม่มีทุกสาขาใน Site Aspect → เก็บที่ store เดียว (central)
    // แล้วให้ Dashboard กรองแยกสาขาเองจาก sites[]
    if (report.sites.length > 1) return 'central'
    const siteName = report.sites[0]?.name ?? report.areas[0]?.name ?? ''
    if (siteName.includes('พาชชั่น') || siteName.includes('Passion')) return 'passion'
    if (siteName.includes('เซนทรัล') || siteName.includes('เซ็นทรัล')) return 'central'
    return BRANCH_HANDLERS[fallback] ?? 'central'
  }

  const processFiles = useCallback(async (files: FileList | File[], branchLabel: string) => {
    const arr = Array.from(files).filter(f => f.name.match(/\.(xlsx|xls)$/i))
    if (!arr.length) return

    const newStatuses: FileStatus[] = arr.map(f => ({ name: f.name, branch: branchLabel, status: 'parsing' }))
    setFileStatuses(prev => [...newStatuses, ...prev])

    for (let i = 0; i < arr.length; i++) {
      try {
        // ไฟล์ Transaction Details (ยอดรายรายการ แยกสาขาได้) — คนละชนิดกับไฟล์สรุปยอด
        if (/transaction\s*details/i.test(arr[i].name)) {
          const day = await parseTransactionDetails(arr[i])
          await saveTx(day)
          const sites = Object.keys(day.sites).length
          const pieces = Object.values(day.sites).reduce((n, x) => n + x.v, 0)
          setFileStatuses(prev => prev.map((s, idx) =>
            idx === i ? { ...s, status: 'done',
              message: `${formatThaiDate(day.date)} · ${sites} สาขา · ${pieces} ชิ้น` } : s
          ))
          continue
        }

        const report = await parseMultiReport(arr[i])
        const target = detectBranch(report, branchLabel)
        if (target === 'passion') onAddPassion(report)
        else                      onAddCentral(report)

        setFileStatuses(prev => prev.map((s, idx) =>
          idx === i ? { ...s, status: sheetsUrl ? 'syncing' : 'done', message: formatThaiDate(report.date) } : s
        ))
        if (sheetsUrl) {
          const ok = await onPushReport(report)
          setFileStatuses(prev => prev.map((s, idx) =>
            idx === i ? { ...s, status: ok ? 'synced' : 'done', message: formatThaiDate(report.date) } : s
          ))
        }
      } catch (e) {
        setFileStatuses(prev => prev.map((s, idx) =>
          idx === i ? { ...s, status: 'error',
            message: e instanceof Error ? e.message : 'อ่านไฟล์ไม่ได้' } : s
        ))
      }
    }
  }, [onAddCentral, onAddPassion, onPushReport, sheetsUrl, saveTx])

  const handleFetchAll = async () => {
    setFetching(true)
    const fetched = await onFetchAll()
    if (fetched) fetched.forEach(r => onAddCentral(r))  // fetched from Sheets = Central
    setFetching(false)
  }

  // ไฟล์สรุปยอดมีทุกสาขาในไฟล์เดียวอยู่แล้ว จึงรวมเป็นรายการเดียว ไม่แยกกล่องตามสาขา
  const allReports = [...centralReports, ...passionReports].sort((a, b) => b.date.localeCompare(a.date))

  /** ลบรายงานของวันนั้น — เผื่อข้อมูลเก่ายังกระจายอยู่สอง store */
  function removeReport(date: string) {
    if (centralReports.some(r => r.date === date)) onRemoveCentral(date)
    if (passionReports.some(r => r.date === date)) onRemovePassion(date)
  }

  return (
    <div className="px-4 md:px-6 py-5 md:py-8 md:max-w-4xl md:mx-auto">
      <div className="space-y-5">

        {/* ── ย้ายข้อมูลไป Firebase (ชั่วคราวระหว่างย้ายระบบ) ── */}
        <MigratePanel onFetchAllFromSheets={onFetchAll} onFetchMachineFromSheets={onFetchMachine} />

        {/* ── Google Sheets ── */}
        <div className={`rounded-2xl p-4 border ${sheetsUrl ? 'bg-green-50 border-green-200' : 'bg-brand-pale border-brand-blue/15'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${sheetsUrl ? 'bg-green-100' : 'bg-brand-blue/10'}`}>
                <Link size={15} className={sheetsUrl ? 'text-green-600' : 'text-brand-blue'} />
              </div>
              <div>
                <p className="text-brand-dark text-[13px] font-medium">Google Sheets</p>
                <p className="text-[11px] mt-0.5">
                  {sheetsUrl
                    ? <span className="text-green-600">เชื่อมต่อแล้ว {lastSynced ? `· ล่าสุด ${lastSynced}` : ''}</span>
                    : <span className="text-brand-dark/40">ยังไม่ได้เชื่อมต่อ</span>}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {sheetsUrl && (
                <button onClick={handlePushAll} disabled={pushingAll}
                  className="flex items-center gap-1.5 text-[12px] text-brand-blue border border-brand-blue/20 px-3 py-1.5 rounded-lg hover:bg-brand-pale disabled:opacity-40 transition-all">
                  {pushingAll ? <Loader2 size={12} className="animate-spin" /> : <CloudUpload size={12} />}
                  ส่งทั้งหมด
                </button>
              )}
              <button onClick={onOpenSheetsConfig}
                className="text-[12px] text-brand-blue border border-brand-blue/30 px-3 py-1.5 rounded-lg hover:bg-brand-blue hover:text-white transition-all">
                {sheetsUrl ? 'แก้ไข' : 'ตั้งค่า'}
              </button>
            </div>
          </div>
          {sheetsUrl && (
            <button onClick={handleFetchAll} disabled={fetching}
              className="mt-3 w-full py-2.5 rounded-xl bg-white border border-brand-blue/20 text-brand-blue text-[13px] flex items-center justify-center gap-2 hover:bg-brand-pale disabled:opacity-40 transition-all">
              {fetching ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              ดึงข้อมูลจาก Sheets
            </button>
          )}
        </div>

        {/* ── File upload progress ── */}
        {fileStatuses.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-brand-dark/40 text-[11px] uppercase tracking-wider font-medium px-1">กำลังประมวลผล</p>
            {fileStatuses.map((fs, i) => (
              <div key={i} className="flex items-center gap-3 bg-white rounded-xl px-4 py-2.5 border border-brand-blue/10">
                <StatusIcon status={fs.status} />
                <div className="flex-1 min-w-0">
                  <p className="text-brand-dark text-[12px] truncate">{fs.name}</p>
                  <p className="text-brand-dark/40 text-[11px]">
                    {fs.status === 'parsing'  && 'กำลังอ่านไฟล์...'}
                    {fs.status === 'syncing'  && 'กำลังส่งไป Google Sheets...'}
                    {fs.status === 'done'     && `บันทึกแล้ว · ${fs.message}`}
                    {fs.status === 'synced'   && `ส่ง Sheets สำเร็จ · ${fs.message}`}
                    {fs.status === 'error'    && fs.message}
                  </p>
                </div>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                  style={{ background: `${ZONES.find(z => z.label === fs.branch)?.color ?? '#888'}18`,
                           color:      ZONES.find(z => z.label === fs.branch)?.color ?? '#888' }}>
                  {fs.branch}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ── ช่องอัปโหลด 2 ช่อง ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ZONES.map(zone => {
            const isTx = zone.id === 'tx'
            const isDragging = draggingId === zone.id

            // แถวรายการที่จะโชว์ใต้ช่อง — คนละแหล่งกันแต่หน้าตาเดียวกัน
            const items = isTx
              ? Object.values(txDays)
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map(d => {
                    const sites = Object.entries(d.sites)
                    return {
                      date: d.date,
                      vol: sites.reduce((n, [, x]) => n + x.v, 0),
                      amt: sites.reduce((n, [, x]) => n + x.a, 0),
                      note: sites.map(([n, x]) => `${n} ${x.v}`).join(' · '),
                      onRemove: () => removeTx(d.date),
                      report: undefined as DayReport | undefined,
                    }
                  })
              : allReports.map(r => ({
                  date: r.date,
                  vol: r.areas.reduce((n, a) => n + a.salesVolume, 0),
                  amt: r.areas.reduce((n, a) => n + a.salesAmount, 0),
                  note: r.sites.map(x => x.name).join(' · '),
                  onRemove: () => removeReport(r.date),
                  report: r,
                }))

            const totalAmt = items.reduce((n, x) => n + x.amt, 0)

            return (
              <div key={zone.id} className="rounded-2xl border border-brand-blue/15 bg-white overflow-hidden transition-all">
                {/* หัวช่อง */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-brand-blue/8"
                  style={{ background: `${zone.color}08` }}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-[18px] flex-shrink-0">{zone.emoji}</span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-brand-dark">{zone.label}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <MapPin size={9} style={{ color: zone.color }} className="flex-shrink-0" />
                        <p className="text-[10px] font-medium truncate" style={{ color: zone.color }}>
                          {items.length} วัน · {Math.round(totalAmt).toLocaleString('th-TH')} บาท
                        </p>
                      </div>
                    </div>
                  </div>
                  {items.length > 0 && (
                    <button onClick={() => {
                      if (!confirm(`ลบ${zone.label}ทั้งหมด ${items.length} วัน?`)) return
                      if (isTx) clearTx()
                      else { onClearCentral(); onClearPassion() }
                    }} className="text-[11px] text-red-400 hover:text-red-600 transition-colors flex-shrink-0">
                      ล้าง
                    </button>
                  )}
                </div>

                {/* โซนวางไฟล์ */}
                <div
                  className={`relative border-2 border-dashed m-3 rounded-xl cursor-pointer
                    flex flex-col items-center justify-center py-6 gap-2 transition-all
                    ${isDragging ? 'scale-[1.02]' : 'hover:opacity-80'}`}
                  style={{
                    borderColor: isDragging ? zone.color : `${zone.color}40`,
                    background:  isDragging ? `${zone.color}10` : `${zone.color}05`,
                  }}
                  onDragOver={e => { e.preventDefault(); setDraggingId(zone.id) }}
                  onDragLeave={() => setDraggingId(null)}
                  onDrop={e => {
                    e.preventDefault(); setDraggingId(null)
                    processFiles(e.dataTransfer.files, zone.label)
                  }}
                  onClick={() => inputRefs.current[zone.id]?.click()}
                >
                  <input
                    ref={el => { inputRefs.current[zone.id] = el }}
                    type="file" multiple accept=".xlsx,.xls" className="hidden"
                    onChange={e => e.target.files && processFiles(e.target.files, zone.label)}
                  />
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-all"
                    style={{ background: isDragging ? zone.color : `${zone.color}15` }}>
                    <Upload size={18} style={{ color: isDragging ? 'white' : zone.color }} />
                  </div>
                  <div className="text-center px-3">
                    <p className="text-[12px] font-semibold text-brand-dark">วางไฟล์ที่นี่</p>
                    <p className="text-[10px] text-brand-dark/40 mt-0.5">{zone.hint}</p>
                  </div>
                </div>

                {/* รายการที่นำเข้าแล้ว */}
                {items.length > 0 ? (
                  <div className="mx-3 mb-3 rounded-xl overflow-hidden border border-brand-blue/8">
                    <div className="max-h-[260px] overflow-y-auto divide-y divide-brand-blue/5">
                      {items.map(it => (
                        <div key={it.date} className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-brand-pale/40 transition-colors">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: `${zone.color}12` }}>
                            <FileSpreadsheet size={13} style={{ color: zone.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-brand-dark font-medium text-[12px]">{formatThaiDate(it.date)}</p>
                            <p className="text-brand-dark/40 text-[10px] truncate">
                              {it.vol.toLocaleString()} ชิ้น · ฿{Math.round(it.amt).toLocaleString('th-TH')}
                              {it.note && <span className="text-brand-dark/25"> · {it.note}</span>}
                            </p>
                          </div>
                          {sheetsUrl && it.report && (
                            <button onClick={() => onPushReport(it.report!)} title="ส่งไป Sheets"
                              className="w-7 h-7 rounded-full bg-brand-pale flex items-center justify-center hover:bg-brand-blue/20 transition-colors group flex-shrink-0">
                              <CloudUpload size={12} className="text-brand-blue/40 group-hover:text-brand-blue transition-colors" />
                            </button>
                          )}
                          <button onClick={it.onRemove} aria-label="ลบ"
                            className="w-7 h-7 rounded-full bg-red-50 flex items-center justify-center hover:bg-red-100 transition-colors group flex-shrink-0">
                            <X size={12} className="text-red-300 group-hover:text-red-500 transition-colors" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mx-3 mb-3 py-5 rounded-xl border border-dashed border-brand-blue/10 flex flex-col items-center gap-1">
                    <FileSpreadsheet size={20} className="text-brand-dark/15" />
                    <p className="text-[11px] text-brand-dark/30">ยังไม่มีข้อมูล</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>

      </div>
    </div>
  )
}
