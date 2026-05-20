import React, { useState, useEffect, useRef } from 'react'
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
  const { replaceAll: replaceStock } = useStockStore()
  const [activeTab, setActiveTab] = useState<'dashboard' | 'upload' | 'stock' | 'machine'>('dashboard')
  const [showSheetsConfig, setShowSheetsConfig] = useState(false)
  const [sheetsMachine, setSheetsMachine] = useState<MachineReport | null>(null)
  // env URL เป็น default — ผู้ใช้ยังเปลี่ยนได้จาก SheetsConfigModal
  const [sheetsUrl, setSheetsUrl] = useState(
    () => ENV_SHEETS_URL ?? localStorage.getItem(SHEETS_URL_KEY) ?? ''
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

  return (
    <div className="w-full min-h-screen flex flex-col bg-white md:bg-[#f0f4fb] shadow-xl shadow-brand-blue/10 md:shadow-none">
      <Header
        reportCount={store.reports.length}
        onUploadClick={() => setActiveTab('upload')}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />
      <main className="flex-1 pb-16 md:pb-0">
        {activeTab === 'dashboard' && <DashboardPage reports={store.reports} />}
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
