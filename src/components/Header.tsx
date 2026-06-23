import React, { useState, useRef, useEffect } from 'react'
import { Upload, ChevronDown, MapPin, Check } from 'lucide-react'

interface HeaderProps {
  reportCount: number
  onUploadClick: () => void
  activeTab: 'dashboard' | 'upload' | 'stock' | 'machine'
  setActiveTab: (t: 'dashboard' | 'upload' | 'stock' | 'machine') => void
  availableSites: string[]
  selectedSite: string
  setSelectedSite: (s: string) => void
}

export default function Header({ reportCount, onUploadClick, activeTab, setActiveTab, availableSites, selectedSite, setSelectedSite }: HeaderProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const siteOptions = ['ทั้งหมด', ...availableSites]

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-brand-blue/10 w-full">
      <div className="flex items-center px-4 md:px-6 h-16 gap-3">

        {/* Logo + Branch dropdown */}
        <div className="flex items-center gap-2.5 flex-1 md:flex-none">
          <img src="/logo.png" alt="Saltcard" className="h-10 w-10 object-contain rounded-xl" />
          <div>
            <p className="text-brand-dark font-bold text-[15px] leading-none tracking-wide">SALTCARD</p>
            {/* Branch dropdown */}
            <div ref={ref} className="relative mt-0.5">
              <button
                onClick={() => setOpen(v => !v)}
                className="flex items-center gap-1 text-[10px] font-medium text-brand-blue/70 hover:text-brand-blue transition-colors"
              >
                <MapPin size={9} />
                {selectedSite === 'ทั้งหมด' ? 'ทุกสาขา' : selectedSite}
                <ChevronDown size={9} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
              </button>

              {open && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                  <div className="absolute z-50 top-full left-0 mt-1.5 bg-white border border-brand-blue/15 rounded-xl shadow-lg shadow-brand-blue/10 py-1 min-w-[180px]">
                    {siteOptions.map(site => (
                      <button key={site}
                        onClick={() => { setSelectedSite(site); setOpen(false) }}
                        className="w-full flex items-center justify-between px-3 py-2 text-[12px] hover:bg-brand-pale/60 transition-colors text-left"
                      >
                        <span className={selectedSite === site ? 'font-semibold text-brand-blue' : 'text-brand-dark/70'}>
                          {site === 'ทั้งหมด' ? '🏪 ทุกสาขา' : `📍 ${site}`}
                        </span>
                        {selectedSite === site && <Check size={12} className="text-brand-blue flex-shrink-0" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Desktop tabs — pill (hidden on mobile) */}
        <div className="hidden md:flex flex-1 justify-center">
          <div className="flex bg-brand-pale/60 rounded-xl p-1 gap-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-6 py-2 text-[13px] font-medium rounded-lg transition-all ${
                activeTab === 'dashboard' ? 'bg-brand-blue text-white' : 'text-brand-dark/50 hover:text-brand-dark'
              }`}
            >ภาพรวม</button>
            <button
              onClick={() => setActiveTab('stock')}
              className={`px-6 py-2 text-[13px] font-medium rounded-lg transition-all ${
                activeTab === 'stock' ? 'bg-brand-blue text-white' : 'text-brand-dark/50 hover:text-brand-dark'
              }`}
            >สต๊อก</button>
            <button
              onClick={() => setActiveTab('machine')}
              className={`px-6 py-2 text-[13px] font-medium rounded-lg transition-all ${
                activeTab === 'machine' ? 'bg-brand-blue text-white' : 'text-brand-dark/50 hover:text-brand-dark'
              }`}
            >หน้าตู้</button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`px-6 py-2 text-[13px] font-medium rounded-lg transition-all ${
                activeTab === 'upload' ? 'bg-brand-blue text-white' : 'text-brand-dark/50 hover:text-brand-dark'
              }`}
            >จัดการไฟล์</button>
          </div>
        </div>

        {/* Badge + Upload button (desktop only) */}
        <div className="flex items-center gap-2">
          {reportCount > 0 && (
            <div className="text-[11px] bg-brand-pale text-brand-blue font-medium px-2.5 py-1 rounded-full border border-brand-blue/20">
              {reportCount} วัน
            </div>
          )}
          <button
            onClick={onUploadClick}
            className="hidden md:flex items-center gap-1.5 bg-brand-blue hover:bg-brand-light text-white text-[13px] font-medium px-3 py-2 rounded-lg active:scale-95 transition-all"
          >
            <Upload size={14} />
            นำเข้า
          </button>
        </div>
      </div>

    </header>
  )
}
