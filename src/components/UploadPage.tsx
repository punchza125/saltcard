import React, { useRef, useState, useCallback } from 'react'
import {
  Upload, FileSpreadsheet, X,
  CheckCircle, AlertCircle, Loader2,
  Link, RefreshCw, CloudUpload
} from 'lucide-react'
import type { DayReport } from '../types'
import { parseMultiReport, formatThaiDate } from '../utils/parser'
interface UploadPageProps {
  reports: DayReport[]
  onAdd: (r: DayReport) => void
  onRemove: (date: string) => void
  onClearAll: () => void
  sheetsUrl: string
  lastSynced: string | null
  onPushReport: (r: DayReport) => Promise<boolean>
  onFetchAll: () => Promise<DayReport[] | null>
  onOpenSheetsConfig: () => void
}

interface FileStatus {
  name: string
  status: 'parsing' | 'done' | 'syncing' | 'synced' | 'error'
  message?: string
}

export default function UploadPage({
  reports, onAdd, onRemove, onClearAll,
  sheetsUrl, lastSynced,
  onPushReport, onFetchAll, onOpenSheetsConfig,
}: UploadPageProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [fileStatuses, setFileStatuses] = useState<FileStatus[]>([])
  const [fetching, setFetching] = useState(false)
  const [pushingAll, setPushingAll] = useState(false)

  const handlePushAll = async () => {
    if (!reports.length) return
    setPushingAll(true)
    for (const r of reports) {
      await onPushReport(r)
    }
    setPushingAll(false)
  }

  const processFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files).filter(f => f.name.match(/\.(xlsx|xls)$/i))
    if (!arr.length) return
    setFileStatuses(arr.map(f => ({ name: f.name, status: 'parsing' })))

    for (let i = 0; i < arr.length; i++) {
      try {
        const report = await parseMultiReport(arr[i])
        onAdd(report)
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
  }, [onAdd, onPushReport, sheetsUrl])

  const handleFetchAll = async () => {
    setFetching(true)
    const fetched = await onFetchAll()
    if (fetched) fetched.forEach(r => onAdd(r))
    setFetching(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    processFiles(e.dataTransfer.files)
  }

  const StatusIcon = ({ status }: { status: FileStatus['status'] }) => {
    if (status === 'parsing' || status === 'syncing')
      return <Loader2 size={16} className="text-brand-blue animate-spin flex-shrink-0" />
    if (status === 'done')
      return <CheckCircle size={16} className="text-green-400 flex-shrink-0" />
    if (status === 'synced')
      return <CloudUpload size={16} className="text-blue-400 flex-shrink-0" />
    return <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
  }

  return (
    <div className="px-4 md:px-6 py-5 md:py-8 md:max-w-2xl md:mx-auto">
      <div className="space-y-4">

        {/* ── Actions ── */}
        <div className="space-y-4">

          {/* Google Sheets */}
          <div className={`rounded-2xl p-4 border card-hover ${sheetsUrl ? 'bg-green-50 border-green-200' : 'bg-brand-pale border-brand-blue/15'}`}>
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
              <button onClick={onOpenSheetsConfig}
                className="text-[12px] text-brand-blue border border-brand-blue/30 px-3 py-1.5 rounded-lg hover:bg-brand-blue hover:text-white transition-all">
                {sheetsUrl ? 'แก้ไข' : 'ตั้งค่า'}
              </button>
            </div>
            {sheetsUrl && (
              <button onClick={handleFetchAll} disabled={fetching}
                className="mt-3 w-full py-2.5 rounded-xl bg-white border border-brand-blue/20 text-brand-blue text-[13px] flex items-center justify-center gap-2 hover:bg-brand-pale disabled:opacity-40 transition-all">
                {fetching ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                ดึงข้อมูลจาก Sheets
              </button>
            )}
          </div>

          {/* Upload zone */}
          <div
            className={`relative border-2 border-dashed rounded-2xl text-center transition-all cursor-pointer
              flex flex-col items-center justify-center min-h-[200px] md:min-h-[240px] p-8
              ${dragging ? 'border-brand-blue bg-brand-pale scale-[1.02]' : 'border-brand-blue/20 bg-brand-pale/40 hover:border-brand-blue/50 hover:bg-brand-pale/60'}`}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            <input ref={inputRef} type="file" multiple accept=".xlsx,.xls" className="hidden"
              onChange={e => e.target.files && processFiles(e.target.files)} />
            <div className={`w-14 h-14 rounded-2xl mb-4 flex items-center justify-center transition-all ${dragging ? 'bg-brand-blue scale-110' : 'bg-brand-blue/10'}`}>
              <Upload size={26} className={dragging ? 'text-white' : 'text-brand-blue'} />
            </div>
            <p className="text-brand-dark font-semibold text-[15px]">วางไฟล์ที่นี่</p>
            <p className="text-brand-dark/50 text-[13px] mt-1">หรือกดเพื่อเลือกไฟล์</p>
            <p className="text-brand-dark/30 text-[11px] mt-2">
              {sheetsUrl ? 'จะส่งไป Google Sheets อัตโนมัติ' : 'รองรับ .xlsx, .xls หลายไฟล์พร้อมกัน'}
            </p>
          </div>

          {/* Processing status */}
          {fileStatuses.length > 0 && (
            <div className="space-y-2">
              <p className="text-brand-dark/40 text-[11px] uppercase tracking-wider font-medium">กำลังประมวลผล</p>
              {fileStatuses.map((fs, i) => (
                <div key={i} className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-brand-blue/10">
                  <StatusIcon status={fs.status} />
                  <div className="flex-1 min-w-0">
                    <p className="text-brand-dark text-[12px] truncate">{fs.name}</p>
                    <p className="text-brand-dark/40 text-[11px]">
                      {fs.status === 'parsing' && 'กำลังอ่านไฟล์...'}
                      {fs.status === 'syncing' && 'กำลังส่งไป Google Sheets...'}
                      {fs.status === 'done' && `บันทึกแล้ว · ${fs.message}`}
                      {fs.status === 'synced' && `ส่ง Sheets สำเร็จ · ${fs.message}`}
                      {fs.status === 'error' && fs.message}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── File list ── */}
        <div>
          {reports.length > 0 ? (
            <div className="bg-white border border-brand-blue/10 rounded-2xl overflow-hidden">
              {/* Sticky header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-brand-blue/8 bg-brand-pale/30">
                <p className="text-brand-dark/50 text-[12px] font-semibold uppercase tracking-wider">
                  ข้อมูลที่โหลดแล้ว · {reports.length} วัน
                </p>
                <div className="flex items-center gap-3">
                  {sheetsUrl && (
                    <button onClick={handlePushAll} disabled={pushingAll}
                      className="flex items-center gap-1.5 text-[12px] text-brand-blue hover:text-brand-light disabled:opacity-40 font-medium">
                      {pushingAll ? <Loader2 size={12} className="animate-spin" /> : <CloudUpload size={12} />}
                      ส่งทั้งหมด
                    </button>
                  )}
                  <button onClick={onClearAll}
                    className="text-[12px] text-red-400 hover:text-red-600">
                    ล้างทั้งหมด
                  </button>
                </div>
              </div>
              {/* Scrollable list */}
              <div className="divide-y divide-brand-blue/5">
                {[...reports].reverse().map(r => {
                  const total = r.areas.reduce((s, a) => s + a.salesAmount, 0)
                  const vol   = r.areas.reduce((s, a) => s + a.salesVolume, 0)
                  return (
                    <div key={r.date} className="flex items-center gap-3 px-5 py-3.5 hover:bg-brand-pale/40 transition-colors">
                      <div className="w-9 h-9 rounded-xl bg-brand-pale flex items-center justify-center flex-shrink-0">
                        <FileSpreadsheet size={16} className="text-brand-blue" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-brand-dark font-medium text-[13px]">{formatThaiDate(r.date)}</p>
                        <p className="text-brand-dark/40 text-[11px]">{vol.toLocaleString()} ชิ้น · ฿{total.toLocaleString('th-TH')}</p>
                      </div>
                      {sheetsUrl && (
                        <button onClick={() => onPushReport(r)} title="ส่งไป Sheets"
                          className="w-8 h-8 rounded-full bg-brand-pale flex items-center justify-center hover:bg-brand-blue/20 transition-colors group">
                          <CloudUpload size={14} className="text-brand-blue/40 group-hover:text-brand-blue transition-colors" />
                        </button>
                      )}
                      <button onClick={() => onRemove(r.date)} aria-label="ลบ"
                        className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center hover:bg-red-100 transition-colors group">
                        <X size={14} className="text-red-300 group-hover:text-red-500 transition-colors" />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : fileStatuses.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center bg-white border border-brand-blue/10 rounded-2xl p-10">
              <div className="w-12 h-12 rounded-2xl bg-brand-pale/60 flex items-center justify-center mb-3">
                <FileSpreadsheet size={22} className="text-brand-dark/20" />
              </div>
              <p className="text-brand-dark/30 text-[13px]">ยังไม่มีข้อมูล</p>
              <p className="text-brand-dark/20 text-[12px] mt-1">อัปโหลดไฟล์ MultiReport เพื่อเริ่มต้น</p>
            </div>
          ) : null}
        </div>

      </div>
    </div>
  )
}
