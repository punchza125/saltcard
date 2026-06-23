import React, { useRef, useState, useCallback } from 'react'
import {
  Upload, FileSpreadsheet, X,
  CheckCircle, AlertCircle, Loader2,
  Link, RefreshCw, CloudUpload, MapPin,
} from 'lucide-react'
import type { DayReport } from '../types'
import { parseMultiReport, formatThaiDate } from '../utils/parser'

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
  onOpenSheetsConfig: () => void
}

interface FileStatus {
  name: string
  branch: string
  status: 'parsing' | 'done' | 'syncing' | 'synced' | 'error'
  message?: string
}

// Each vending machine branch definition
const BRANCHES = [
  { id: 'central',  label: 'เซนทรัล ระยอง',  color: '#1a52b3', emoji: '🏪', active: true  },
  { id: 'passion',  label: 'พาชชั่น ระยอง',   color: '#10b981', emoji: '🏬', active: false },
]

function getReportBranch(r: DayReport): string {
  return r.sites[0]?.name ?? r.areas[0]?.name ?? 'ไม่ระบุ'
}

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
  onPushReport, onFetchAll, onOpenSheetsConfig,
}: UploadPageProps) {
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
    const siteName = report.sites[0]?.name ?? report.areas[0]?.name ?? ''
    if (siteName.includes('พาชชั่น')) return 'passion'
    if (siteName.includes('เซนทรัล')) return 'central'
    return BRANCH_HANDLERS[fallback] ?? 'central'
  }

  const processFiles = useCallback(async (files: FileList | File[], branchLabel: string) => {
    const arr = Array.from(files).filter(f => f.name.match(/\.(xlsx|xls)$/i))
    if (!arr.length) return

    const newStatuses: FileStatus[] = arr.map(f => ({ name: f.name, branch: branchLabel, status: 'parsing' }))
    setFileStatuses(prev => [...newStatuses, ...prev])

    for (let i = 0; i < arr.length; i++) {
      try {
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
      } catch {
        setFileStatuses(prev => prev.map((s, idx) =>
          idx === i ? { ...s, status: 'error', message: 'อ่านไฟล์ไม่ได้' } : s
        ))
      }
    }
  }, [onAddCentral, onAddPassion, onPushReport, sheetsUrl])

  const handleFetchAll = async () => {
    setFetching(true)
    const fetched = await onFetchAll()
    if (fetched) fetched.forEach(r => onAddCentral(r))  // fetched from Sheets = Central
    setFetching(false)
  }

  const reportsByBranch: Record<string, DayReport[]> = {
    'เซนทรัล ระยอง': [...centralReports].sort((a,b) => b.date.localeCompare(a.date)),
    'พาชชั่น ระยอง':  [...passionReports].sort((a,b) => b.date.localeCompare(a.date)),
  }

  const onRemoveByBranch = { 'เซนทรัล ระยอง': onRemoveCentral, 'พาชชั่น ระยอง': onRemovePassion }
  const onClearByBranch  = { 'เซนทรัล ระยอง': onClearCentral,  'พาชชั่น ระยอง': onClearPassion  }

  return (
    <div className="px-4 md:px-6 py-5 md:py-8 md:max-w-4xl md:mx-auto">
      <div className="space-y-5">

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
                  style={{ background: `${BRANCHES.find(b=>b.label===fs.branch)?.color ?? '#888'}18`,
                           color:      BRANCHES.find(b=>b.label===fs.branch)?.color ?? '#888' }}>
                  {fs.branch}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ── Branch sections ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {BRANCHES.map(branch => {
            const branchReports = (reportsByBranch[branch.label] ?? []).sort((a,b) => b.date.localeCompare(a.date))
            const isDragging = draggingId === branch.id

            return (
              <div key={branch.id}
                className={`rounded-2xl border overflow-hidden transition-all ${
                  branch.active
                    ? 'border-brand-blue/15 bg-white'
                    : 'border-dashed border-brand-blue/15 bg-brand-pale/30'
                }`}
              >
                {/* Branch header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-brand-blue/8"
                  style={{ background: `${branch.color}08` }}>
                  <div className="flex items-center gap-2.5">
                    <span className="text-[18px]">{branch.emoji}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-bold text-brand-dark">{branch.label}</p>
                        {!branch.active && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-brand-dark/10 text-brand-dark/40 uppercase tracking-wide">
                            เร็วๆ นี้
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <MapPin size={9} style={{ color: branch.color }} />
                        <p className="text-[10px] font-medium" style={{ color: branch.color }}>
                          {branchReports.length} วัน · {branchReports.reduce((s,r) => s + r.areas.reduce((a,x) => a + x.salesAmount,0),0).toLocaleString('th-TH')} บาท
                        </p>
                      </div>
                    </div>
                  </div>
                  {branchReports.length > 0 && (
                    <button onClick={() => {
                      if (!confirm(`ลบข้อมูล ${branch.label} ทั้งหมด ${branchReports.length} วัน?`)) return
                      onClearByBranch[branch.label]?.()
                    }} className="text-[11px] text-red-400 hover:text-red-600 transition-colors">
                      ล้าง
                    </button>
                  )}
                </div>

                {/* Upload zone */}
                <div
                  className={`
                    relative border-2 border-dashed m-3 rounded-xl cursor-pointer
                    flex flex-col items-center justify-center py-6 gap-2 transition-all
                    ${isDragging
                      ? 'scale-[1.02]'
                      : branch.active
                        ? 'hover:opacity-80'
                        : 'opacity-50 pointer-events-none'
                    }
                  `}
                  style={{
                    borderColor: isDragging ? branch.color : `${branch.color}40`,
                    background:  isDragging ? `${branch.color}10` : `${branch.color}05`,
                  }}
                  onDragOver={e => { e.preventDefault(); setDraggingId(branch.id) }}
                  onDragLeave={() => setDraggingId(null)}
                  onDrop={e => {
                    e.preventDefault(); setDraggingId(null)
                    processFiles(e.dataTransfer.files, branch.label)
                  }}
                  onClick={() => branch.active && inputRefs.current[branch.id]?.click()}
                >
                  <input
                    ref={el => { inputRefs.current[branch.id] = el }}
                    type="file" multiple accept=".xlsx,.xls" className="hidden"
                    onChange={e => e.target.files && processFiles(e.target.files, branch.label)}
                  />
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-all"
                    style={{ background: isDragging ? branch.color : `${branch.color}15` }}>
                    <Upload size={18} style={{ color: isDragging ? 'white' : branch.color }} />
                  </div>
                  <div className="text-center">
                    <p className="text-[12px] font-semibold text-brand-dark">
                      {branch.active ? 'วางไฟล์ที่นี่' : 'ยังไม่พร้อมใช้งาน'}
                    </p>
                    {branch.active && (
                      <p className="text-[10px] text-brand-dark/40 mt-0.5">
                        {sheetsUrl ? 'ส่ง Google Sheets อัตโนมัติ' : '.xlsx / .xls'}
                      </p>
                    )}
                  </div>
                </div>

                {/* Report list */}
                {branchReports.length > 0 ? (
                  <div className="mx-3 mb-3 rounded-xl overflow-hidden border border-brand-blue/8">
                    <div className="max-h-[260px] overflow-y-auto divide-y divide-brand-blue/5">
                      {branchReports.map(r => {
                        const total = r.areas.reduce((s,a) => s + a.salesAmount, 0)
                        const vol   = r.areas.reduce((s,a) => s + a.salesVolume, 0)
                        return (
                          <div key={r.date} className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-brand-pale/40 transition-colors">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ background: `${branch.color}12` }}>
                              <FileSpreadsheet size={13} style={{ color: branch.color }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-brand-dark font-medium text-[12px]">{formatThaiDate(r.date)}</p>
                              <p className="text-brand-dark/40 text-[10px]">{vol.toLocaleString()} ชิ้น · ฿{total.toLocaleString('th-TH')}</p>
                            </div>
                            {sheetsUrl && (
                              <button onClick={() => onPushReport(r)} title="ส่งไป Sheets"
                                className="w-7 h-7 rounded-full bg-brand-pale flex items-center justify-center hover:bg-brand-blue/20 transition-colors group">
                                <CloudUpload size={12} className="text-brand-blue/40 group-hover:text-brand-blue transition-colors" />
                              </button>
                            )}
                            <button onClick={() => onRemoveByBranch[branch.label]?.(r.date)} aria-label="ลบ"
                              className="w-7 h-7 rounded-full bg-red-50 flex items-center justify-center hover:bg-red-100 transition-colors group">
                              <X size={12} className="text-red-300 group-hover:text-red-500 transition-colors" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : branch.active ? (
                  <div className="mx-3 mb-3 py-5 rounded-xl border border-dashed border-brand-blue/10 flex flex-col items-center gap-1">
                    <FileSpreadsheet size={20} className="text-brand-dark/15" />
                    <p className="text-[11px] text-brand-dark/30">ยังไม่มีข้อมูล</p>
                  </div>
                ) : (
                  <div className="mx-3 mb-3 py-5 rounded-xl border border-dashed border-brand-blue/10 flex flex-col items-center gap-1">
                    <p className="text-[11px] text-brand-dark/20">รอเปิดสาขา</p>
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
