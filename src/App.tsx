import React, { useState, useEffect, useRef } from 'react'
import Header from './components/Header'
import DashboardPage from './components/DashboardPage'
import UploadPage from './components/UploadPage'
import StockPage from './components/StockPage'
import MachinePage from './components/MachinePage'
import SheetsConfigModal from './components/SheetsConfigModal'
import { useStore } from './hooks/useStore'
import { useSheets } from './hooks/useSheets'

const SHEETS_URL_KEY = 'saltcard_sheets_url'
const ENV_SHEETS_URL = import.meta.env.VITE_SHEETS_URL as string | undefined

export default function App() {
  const { store, addReport, removeReport, clearAll } = useStore()
  const [activeTab, setActiveTab] = useState<'dashboard' | 'upload' | 'stock' | 'machine'>('dashboard')
  const [showSheetsConfig, setShowSheetsConfig] = useState(false)
  // env URL เป็น default — ผู้ใช้ยังเปลี่ยนได้จาก SheetsConfigModal
  const [sheetsUrl, setSheetsUrl] = useState(
    () => localStorage.getItem(SHEETS_URL_KEY) ?? ENV_SHEETS_URL ?? ''
  )

  const sheetsConfig = sheetsUrl ? { url: sheetsUrl } : null
  const { syncStatus, syncMessage, lastSynced, pushReport, fetchAll } = useSheets(sheetsConfig)

  // auto-fetch เมื่อเปิดแอปครั้งแรกถ้ามี Sheets URL และยังไม่มีข้อมูล
  const didAutoFetch = useRef(false)
  useEffect(() => {
    if (didAutoFetch.current) return
    if (!sheetsUrl || store.reports.length > 0) return
    didAutoFetch.current = true
    fetchAll().then(reports => {
      if (reports?.length) reports.forEach(addReport)
    })
  }, [sheetsUrl])

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
        {activeTab === 'stock' && <StockPage reports={store.reports} />}
        {activeTab === 'machine' && <MachinePage />}
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
