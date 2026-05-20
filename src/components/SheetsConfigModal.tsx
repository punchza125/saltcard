import React, { useState } from 'react'
import { X, ExternalLink, CheckCircle, AlertCircle, Loader } from 'lucide-react'
import type { SyncStatus } from '../hooks/useSheets'

interface SheetsConfigModalProps {
  currentUrl: string
  onSave: (url: string) => void
  onClose: () => void
  onTest: (url: string) => Promise<boolean>
  syncStatus: SyncStatus
}

const STEPS = [
  {
    num: 1,
    title: 'เปิด Google Sheets',
    detail: 'สร้าง Spreadsheet ใหม่ ตั้งชื่อว่า "Saltcard DB"',
  },
  {
    num: 2,
    title: 'เปิด Apps Script',
    detail: 'เมนู Extensions → Apps Script',
  },
  {
    num: 3,
    title: 'วางโค้ด',
    detail: 'ลบโค้ดเดิมออก แล้ววางโค้ดจากไฟล์ Code.gs ที่ได้รับ',
  },
  {
    num: 4,
    title: 'Deploy',
    detail: 'กด Deploy → New deployment → Web App\nExecute as: Me\nAccess: Anyone\nกด Deploy และ copy URL',
  },
]

export default function SheetsConfigModal({ currentUrl, onSave, onClose, onTest, syncStatus }: SheetsConfigModalProps) {
  const [url, setUrl] = useState(currentUrl)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'idle' | 'ok' | 'fail'>('idle')

  async function handleTest() {
    if (!url.trim()) return
    setTesting(true)
    setTestResult('idle')
    const ok = await onTest(url.trim())
    setTestResult(ok ? 'ok' : 'fail')
    setTesting(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg bg-white rounded-t-3xl px-5 pt-5 pb-8 overflow-y-auto max-h-[90vh]">

        {/* Handle */}
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5" />

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-white font-semibold text-[17px]">เชื่อม Google Sheets</h2>
            <p className="text-brand-dark/40 text-[12px] mt-0.5">ทีมทุกคนจะเห็นข้อมูลเดียวกัน</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-brand-pale flex items-center justify-center">
            <X size={16} className="text-white/60" />
          </button>
        </div>

        {/* Steps */}
        <div className="space-y-3 mb-5">
          {STEPS.map(s => (
            <div key={s.num} className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-brand-blue/20 text-brand-blue text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                {s.num}
              </div>
              <div>
                <p className="text-white text-[13px] font-medium">{s.title}</p>
                <p className="text-brand-dark/40 text-[12px] mt-0.5 whitespace-pre-line">{s.detail}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Code.gs reminder */}
        <div className="bg-brand-pale/60 border border-brand-blue/10 rounded-xl px-4 py-3 mb-5 flex items-start gap-3">
          <ExternalLink size={15} className="text-brand-blue flex-shrink-0 mt-0.5" />
          <p className="text-white/60 text-[12px]">
            ไฟล์ <span className="text-white font-medium">Code.gs</span> อยู่ในโฟลเดอร์{' '}
            <span className="text-white/80 font-mono text-[11px]">google-apps-script/</span>{' '}
            ของโปรเจคที่ดาวน์โหลด
          </p>
        </div>

        {/* URL input */}
        <div className="mb-3">
          <label className="text-brand-dark/50 text-[11px] uppercase tracking-wider font-medium block mb-2">
            Apps Script Web App URL
          </label>
          <input
            type="url"
            value={url}
            onChange={e => { setUrl(e.target.value); setTestResult('idle') }}
            placeholder="https://script.google.com/macros/s/..."
            className="w-full bg-brand-pale/60 border border-brand-blue/15 rounded-xl px-4 py-3 text-white text-[13px] placeholder:text-brand-dark/25 focus:outline-none focus:border-brand-blue transition-colors"
          />
        </div>

        {/* Test result */}
        {testResult === 'ok' && (
          <div className="flex items-center gap-2 text-green-400 text-[12px] mb-3">
            <CheckCircle size={14} /> เชื่อมต่อได้ปกติ
          </div>
        )}
        {testResult === 'fail' && (
          <div className="flex items-center gap-2 text-red-400 text-[12px] mb-3">
            <AlertCircle size={14} /> เชื่อมต่อไม่ได้ — ตรวจสอบ URL และ Deploy settings
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleTest}
            disabled={!url.trim() || testing}
            className="flex-1 py-3 rounded-xl border border-white/20 text-white/70 text-[13px] font-medium flex items-center justify-center gap-2 hover:bg-brand-pale/60 disabled:opacity-40 transition-all"
          >
            {testing ? <Loader size={14} className="animate-spin" /> : null}
            ทดสอบการเชื่อมต่อ
          </button>
          <button
            onClick={() => { onSave(url.trim()); onClose() }}
            disabled={!url.trim()}
            className="flex-1 py-3 rounded-xl bg-brand-blue text-white text-[13px] font-medium disabled:opacity-40 active:scale-95 transition-all"
          >
            บันทึก
          </button>
        </div>

      </div>
    </div>
  )
}
