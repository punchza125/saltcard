import React, { useState, useRef, useEffect } from 'react'
import { branchBadge } from '../lib/branchLogos'
import { Upload, Layers, RefreshCw } from 'lucide-react'

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
  const [closing, setClosing] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  function closeDropdown() {
    setClosing(true)
    setTimeout(() => { setOpen(false); setClosing(false) }, 160)
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) closeDropdown()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const siteOptions = ['ทั้งหมด', ...availableSites]
  // วนสลับสาขาทีละอัน: ทุกสาขา → สาขาที่ 1 → สาขาที่ 2 → ทุกสาขา
  const cycle = ['ทั้งหมด', ...siteOptions.filter(s => s !== 'ทั้งหมด')]
  const nextSite = cycle[(cycle.indexOf(selectedSite) + 1) % cycle.length] ?? 'ทั้งหมด'

  const isFiltered = selectedSite !== 'ทั้งหมด'

  // Only show selector when there are sites
  const showSelector = availableSites.length > 0

  return (
    <>
      <style>{`
        @keyframes dropIn {
          from { opacity: 0; transform: translateY(-6px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
        @keyframes dropOut {
          from { opacity: 1; transform: translateY(0)   scale(1);    }
          to   { opacity: 0; transform: translateY(-6px) scale(0.97); }
        }
        .branch-dropdown-enter { animation: dropIn  0.18s cubic-bezier(0.16,1,0.3,1) both; }
        .branch-dropdown-exit  { animation: dropOut 0.16s cubic-bezier(0.4,0,1,1)    both; }
      `}</style>

      <header className="sticky top-0 z-50 bg-white border-b border-brand-blue/10 w-full">
        <div className="flex items-center px-4 md:px-6 h-16 gap-3">

          {/* Logo */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <img src="/logo.png" alt="Saltcard" className="h-10 w-10 object-contain rounded-xl" />
            <div className="hidden sm:block">
              <p className="text-brand-dark font-bold text-[15px] leading-none tracking-wide">SALTCARD</p>
              <p className="text-brand-blue/50 text-[10px] mt-0.5 font-medium">Sales Dashboard</p>
            </div>
          </div>

          {/* Branch selector pill */}
          {showSelector && (
            <div ref={ref} className="relative flex-shrink-0">
              <button
                onClick={() => setSelectedSite(nextSite)}
                title={`กดเพื่อดู ${nextSite === 'ทั้งหมด' ? 'ทุกสาขา' : nextSite}`}
                className={`
                  flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 rounded-xl text-[12px] font-semibold
                  border transition-all duration-200 active:scale-95
                  ${isFiltered
                    ? 'bg-brand-blue text-white border-brand-blue shadow-md shadow-brand-blue/30'
                    : 'bg-brand-pale/70 text-brand-dark/60 border-brand-blue/10 hover:border-brand-blue/30 hover:text-brand-dark hover:bg-brand-pale'
                  }
                `}
              >
                {(() => {
                  const badge = branchBadge(selectedSite)
                  return (
                    <span className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden border ${
                      badge?.needsDarkBg ? 'bg-brand-dark border-brand-dark' : 'bg-white border-black/5'
                    }`}>
                      {badge
                        ? <img src={badge.src} alt={selectedSite} className="w-full h-full object-contain p-[2px]" />
                        : <Layers size={12} className="text-brand-dark/50" />}
                    </span>
                  )
                })()}
                <span key={selectedSite} className="max-w-[130px] truncate animate-pop-in">
                  {isFiltered ? selectedSite : 'ทุกสาขา'}
                </span>
                <RefreshCw size={11} className={`flex-shrink-0 ${isFiltered ? 'text-white/60' : 'text-brand-dark/30'}`} />
              </button>

            </div>
          )}

          {/* Desktop tabs */}
          <div className="hidden md:flex flex-1 justify-center">
            <div className="flex bg-brand-pale/60 rounded-xl p-1 gap-1">
              {(['dashboard','stock','machine','upload'] as const).map(tab => {
                const labels = { dashboard: 'ภาพรวม', stock: 'สต๊อก', machine: 'หน้าตู้', upload: 'จัดการไฟล์' }
                return (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`px-6 py-2 text-[13px] font-medium rounded-lg transition-all ${
                      activeTab === tab ? 'bg-brand-blue text-white' : 'text-brand-dark/50 hover:text-brand-dark'
                    }`}
                  >{labels[tab]}</button>
                )
              })}
            </div>
          </div>

          {/* Badge + Upload */}
          <div className="flex items-center gap-2 ml-auto md:ml-0">
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
    </>
  )
}
