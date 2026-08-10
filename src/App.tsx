import React, { useState, useEffect, useRef, useMemo } from 'react'
import { BarChart2, Package, MonitorPlay, FolderOpen } from 'lucide-react'
import Header from './components/Header'
import DashboardPage from './components/DashboardPage'
import UploadPage from './components/UploadPage'
import StockPage from './components/StockPage'
import MachinePage from './components/MachinePage'
import SheetsConfigModal from './components/SheetsConfigModal'
import { useSheets } from './hooks/useSheets'
import { useOrdersSheets } from './hooks/useOrdersSheets'
import { useStockStore } from './hooks/useStockStore'
import { useReportStore, subscribeMachineReport, saveMachineReport } from './hooks/useReportStore'
import { isFirebaseConfigured } from './lib/firebase'
import type { DayReport, MachineReport } from './types'

const SHEETS_URL_KEY = 'saltcard_sheets_url'
const ENV_SHEETS_URL = import.meta.env.VITE_SHEETS_URL as string | undefined

export default function App() {
  // รายงานยอดขายอยู่บน Firestore แล้ว (1 วัน = 1 document) — real-time, ไม่ต้อง fetch เอง
  const { reports: fbReports, loaded: reportsLoaded, saveReport, removeReport: removeReportDoc } = useReportStore()
  const { stock, setMonthlyProfitGoal } = useStockStore()
  const [activeTab, setActiveTab] = useState<'dashboard' | 'upload' | 'stock' | 'machine'>('dashboard')
  const [selectedSite, setSelectedSite] = useState<string>('ทั้งหมด')
  const [showSheetsConfig, setShowSheetsConfig] = useState(false)
  const [sheetsMachine, setSheetsMachine] = useState<MachineReport | null>(null)
  // env URL เป็น default — ผู้ใช้ยังเปลี่ยนได้จาก SheetsConfigModal
  const [sheetsUrl, setSheetsUrl] = useState(
    () => ENV_SHEETS_URL ?? localStorage.getItem(SHEETS_URL_KEY) ?? ''
  )

  const allReports = fbReports
  // ส่ง report ทั้งหมดเสมอ — DashboardPage กรองตามสาขาจาก sites[] ของแต่ละ report เอง
  // (Multi-Report ไฟล์เดียวมีทุกสาขาใน Site Aspect อยู่แล้ว)
  const activeReports = allReports

  const availableSites = useMemo(() => {
    // ชื่อสาขาจริงจากข้อมูล (Site Aspect ของทุก report)
    const sites = new Set<string>()
    allReports.forEach(r => r.sites.forEach(s => { if (s.name) sites.add(s.name) }))
    return Array.from(sites).sort()
  }, [allReports])

  const sheetsConfig = sheetsUrl ? { url: sheetsUrl } : null
  const { syncStatus, syncMessage, lastSynced, pushReport, fetchAll, pushStock, fetchStock, pushMachine, fetchMachine, pushOrders, fetchOrders } = useSheets(sheetsConfig)
  // If VITE_ORDERS_URL is set, route orders to the separate SaltOrder sheet
  const ordersSheets = useOrdersSheets()
  // Use ordersSheets if VITE_ORDERS_URL is set OR if user manually saved a URL in localStorage
  const hasOrdersUrl = ordersSheets.isEnvConfigured || !!ordersSheets.url
  const effectivePushOrders = hasOrdersUrl ? ordersSheets.push : pushOrders
  const effectiveFetchOrders = hasOrdersUrl ? ordersSheets.fetch : fetchOrders

  // หน้าตู้: subscribe จาก Firestore (real-time) — สต็อก/ออเดอร์/ยอดขาย มี listener ในตัวอยู่แล้ว
  useEffect(() => subscribeMachineReport(data => {
    setSheetsMachine((data as MachineReport | null) ?? null)
  }), [])

  async function handlePushStock(currentStock: object): Promise<boolean> {
    return pushStock(currentStock)
  }

  async function handlePushMachine(r: MachineReport): Promise<boolean> {
    try { await saveMachineReport(r); return true } catch { return false }
  }

  const prevCount = useRef(allReports.length)
  useEffect(() => {
    if (allReports.length > prevCount.current && allReports.length === 1) {
      setActiveTab('dashboard')
    }
    prevCount.current = allReports.length
  }, [allReports.length])

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

  if (isFirebaseConfigured && !reportsLoaded) {
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
    <div className="w-full flex flex-col bg-white md:bg-[#f0f4fb] md:min-h-screen"
      style={{ height: '100dvh' }}>
      <Header
        reportCount={allReports.length}
        onUploadClick={() => setActiveTab('upload')}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        availableSites={availableSites}
        selectedSite={selectedSite}
        setSelectedSite={setSelectedSite}
      />

      {/* main scrolls inside — ไม่ใช้ body scroll เพื่อให้ nav ไม่ลอย */}
      <main className="flex-1 overflow-y-auto md:overflow-visible">
        {activeTab === 'dashboard' && <DashboardPage reports={activeReports} stockProducts={stock.products} taxRate={stock.taxRate} monthlyProfitGoal={stock.monthlyProfitGoal} onSetMonthlyGoal={setMonthlyProfitGoal} activeBranch={selectedSite} setActiveBranch={setSelectedSite} syncStatus={syncStatus} lastSynced={lastSynced ?? undefined} categoryAliases={stock.categoryAliases} />}
        {activeTab === 'stock' && (
          <StockPage
            reports={allReports}
            sheetsUrl={sheetsUrl}
            ordersUrl={ordersSheets.url}
            isOrdersEnv={ordersSheets.isEnvConfigured}
            onSaveOrdersUrl={ordersSheets.saveUrl}
            onPushStock={handlePushStock}
            onFetchStock={fetchStock}
            onPushOrders={effectivePushOrders}
            onFetchOrders={effectiveFetchOrders}
            readOnly={false}
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
            centralReports={allReports}
            passionReports={[]}
            onAddCentral={saveReport}
            onAddPassion={saveReport}
            onRemoveCentral={removeReportDoc}
            onRemovePassion={removeReportDoc}
            onClearCentral={() => {}}
            onClearPassion={() => {}}
            sheetsUrl={isFirebaseConfigured ? '' : sheetsUrl}
            lastSynced={lastSynced}
            onPushReport={pushReport}
            onFetchAll={fetchAll}
            onFetchMachine={fetchMachine}
            onOpenSheetsConfig={() => setShowSheetsConfig(true)}
          />
        )}
      </main>

      {/* Bottom nav — normal flow (ไม่ fixed) อยู่ใต้ main เสมอ; ซ่อนเมื่อมี modal เปิด (body.modal-open) */}
      <nav data-bottom-nav className="md:hidden flex-shrink-0 bg-white border-t border-brand-blue/10 flex"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {NAV_ITEMS.map(({ tab, label, Icon }) => {
          const isActive = activeTab === tab
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="flex-1 flex flex-col items-center justify-center pt-1.5 pb-1 relative"
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
