import React, { useState, useEffect, useRef, useMemo } from 'react'
import { BarChart2, Package, MonitorPlay, FolderOpen } from 'lucide-react'
import Header from './components/Header'
import DashboardPage from './components/DashboardPage'
import UploadPage from './components/UploadPage'
import StockPage from './components/StockPage'
import MachinePage from './components/MachinePage'
import SheetsConfigModal from './components/SheetsConfigModal'
import { useStore } from './hooks/useStore'
import { useSheets } from './hooks/useSheets'
import { useStockStore } from './hooks/useStockStore'
import type { MachineReport } from './types'

const SHEETS_URL_KEY = 'saltcard_sheets_url'
const ENV_SHEETS_URL = import.meta.env.VITE_SHEETS_URL as string | undefined

export default function App() {
  const { store, addReport, removeReport, clearAll } = useStore()
  const { stock, replaceAll: replaceStock } = useStockStore()
  const [activeTab, setActiveTab] = useState<'dashboard' | 'upload' | 'stock' | 'machine'>('dashboard')
  const [selectedSite, setSelectedSite] = useState<string>('ทั้งหมด')
  const [showSheetsConfig, setShowSheetsConfig] = useState(false)
  const [sheetsMachine, setSheetsMachine] = useState<MachineReport | null>(null)
  // env URL เป็น default — ผู้ใช้ยังเปลี่ยนได้จาก SheetsConfigModal
  const [sheetsUrl, setSheetsUrl] = useState(
    () => ENV_SHEETS_URL ?? localStorage.getItem(SHEETS_URL_KEY) ?? ''
  )

  const availableSites = useMemo(
    () => Array.from(new Set(store.reports.flatMap(r => r.sites.map(s => s.name)))).sort(),
    [store.reports]
  )

  const sheetsConfig = sheetsUrl ? { url: sheetsUrl } : null
  const { syncStatus, syncMessage, lastSynced, pushReport, fetchAll, pushStock, fetchStock, pushMachine, fetchMachine } = useSheets(sheetsConfig)

  // ถ้ามี ENV_SHEETS_URL (deployed version) → โหลดจาก Sheets ทุกครั้งที่เปิดแอป
  // ถ้าไม่มี (local dev) → โหลดเฉพาะตอนยังไม่มีข้อมูล
  const didAutoFetch = useRef(false)
  useEffect(() => {
    if (didAutoFetch.current || !sheetsUrl) return
    didAutoFetch.current = true
    if (ENV_SHEETS_URL) {
      // always fetch latest from Sheets — replace local data
      fetchAll().then(fresh => {
        if (fresh?.length) {
          clearAll()
          fresh.forEach(addReport)
        }
      })
      fetchStock().then(raw => {
        if (!raw) return
        try { replaceStock(JSON.parse(raw)) } catch {}
      })
      fetchMachine().then(raw => {
        if (!raw) return
        try { setSheetsMachine(JSON.parse(raw)) } catch {}
      })
    } else if (store.reports.length === 0) {
      fetchAll().then(reports => {
        if (reports?.length) reports.forEach(addReport)
      })
    }
  }, [sheetsUrl])

  async function handlePushStock(currentStock: object): Promise<boolean> {
    return pushStock(currentStock)
  }

  async function handlePushMachine(r: MachineReport): Promise<boolean> {
    return pushMachine(r)
  }

  const prevCount = useRef(store.reports.length)
  useEffect(() => {
    if (store.reports.length > prevCount.current && store.reports.length === 1) {
      setActiveTab('dashboard')
    }
    prevCount.current = store.reports.length
  }, [store.reports.length])

  function handleSaveSheetsUrl(url: string) {
    setSheetsUrl(url)
    localStorage.setItem(SHEETS_URL_KEY, url)
  }

  async function handleTestSheets(url: string): Promise<boolean> {
    try {
      const res = await fetch(`${url}?action=dates`)
      const json = await res.json()
      return json.ok === true
    } catch {
      return false
    }
  }

  if (syncStatus === 'syncing' && store.reports.length === 0) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-white z-50">
        <img src="/pic/luffygif.gif" alt="loading" className="w-48 h-48 object-contain" />
        <p className="mt-4 text-brand-dark/50 text-[15px] font-medium tracking-widest">Loading...</p>
      </div>
    )
  }

  const NAV_ITEMS = [
    { tab: 'dashboard' as const, label: 'ภาพรวม',    Icon: BarChart2   },
    { tab: 'stock'     as const, label: 'สต็อก',      Icon: Package     },
    { tab: 'machine'   as const, label: 'หน้าตู้',    Icon: MonitorPlay },
    { tab: 'upload'    as const, label: 'จัดการไฟล์', Icon: FolderOpen  },
  ]

  return (
    // h-dvh = dynamic viewport height — ป้องกัน nav ลอยตอน iOS Safari address bar เปลี่ยนขนาด
    <div className="w-full flex flex-col bg-white md:bg-[#f0f4fb] md:min-h-screen md:shadow-xl md:shadow-brand-blue/10"
      style={{ height: '100dvh' }}>
      <Header
        reportCount={store.reports.length}
        onUploadClick={() => setActiveTab('upload')}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        availableSites={availableSites}
        selectedSite={selectedSite}
        setSelectedSite={setSelectedSite}
      />

      {/* main scrolls inside — ไม่ใช้ body scroll เพื่อให้ nav ไม่ลอย */}
      <main className="flex-1 overflow-y-auto md:overflow-visible">
        {activeTab === 'dashboard' && <DashboardPage reports={store.reports} stockProducts={stock.products} taxRate={stock.taxRate} selectedSite={selectedSite} setSelectedSite={setSelectedSite} />}
        {activeTab === 'stock' && (
          <StockPage
            reports={store.reports}
            sheetsUrl={sheetsUrl}
            onPushStock={handlePushStock}
            readOnly={!!ENV_SHEETS_URL}
          />
        )}
        {activeTab === 'machine' && (
          <MachinePage
            sheetsReport={sheetsMachine}
            onPushMachine={handlePushMachine}
          />
        )}
        {activeTab === 'upload' && (
          <UploadPage
            reports={store.reports}
            onAdd={r => { addReport(r); setActiveTab('dashboard') }}
            onRemove={removeReport}
            onClearAll={clearAll}
            sheetsUrl={sheetsUrl}
            lastSynced={lastSynced}
            onPushReport={pushReport}
            onFetchAll={fetchAll}
            onOpenSheetsConfig={() => setShowSheetsConfig(true)}
          />
        )}
      </main>

      {/* Bottom nav — normal flow (ไม่ fixed) อยู่ใต้ main เสมอ */}
      <nav className="md:hidden flex-shrink-0 bg-white border-t border-brand-blue/10 flex"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {NAV_ITEMS.map(({ tab, label, Icon }) => {
          const isActive = activeTab === tab
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="flex-1 flex flex-col items-center justify-center pt-1 pb-2 relative"
            >
              <div className={`absolute top-0 left-3 right-3 h-0.5 rounded-full transition-all ${isActive ? 'bg-brand-blue' : 'bg-transparent'}`} />
              <div className={`rounded-xl px-4 py-1 mb-0.5 transition-all ${isActive ? 'bg-brand-blue/10' : ''}`}>
                <Icon size={20} strokeWidth={isActive ? 2.5 : 1.5} className={isActive ? 'text-brand-blue' : 'text-brand-dark/30'} />
              </div>
              <span className={`text-[10px] font-semibold transition-colors ${isActive ? 'text-brand-blue' : 'text-brand-dark/30'}`}>{label}</span>
            </button>
          )
        })}
      </nav>

      {showSheetsConfig && (
        <SheetsConfigModal
          currentUrl={sheetsUrl}
          onSave={handleSaveSheetsUrl}
          onClose={() => setShowSheetsConfig(false)}
          onTest={handleTestSheets}
          syncStatus={syncStatus}
        />
      )}
    </div>
  )
}
