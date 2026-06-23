import React, { useState, useRef, useEffect } from 'react'
import { Upload, ChevronDown, MapPin, Check, Layers } from 'lucide-react'

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
                onClick={() => open ? closeDropdown() : setOpen(true)}
                className={`
                  flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-semibold
                  border transition-all duration-200 active:scale-95
                  ${isFiltered
                    ? 'bg-brand-blue text-white border-brand-blue shadow-md shadow-brand-blue/30'
                    : 'bg-brand-pale/70 text-brand-dark/60 border-brand-blue/10 hover:border-brand-blue/30 hover:text-brand-dark hover:bg-brand-pale'
                  }
                `}
              >
                {isFiltered
                  ? <MapPin size={13} className="flex-shrink-0" />
                  : <Layers size={13} className="flex-shrink-0" />
                }
                <span className="max-w-[120px] truncate">
                  {isFiltered ? selectedSite : 'ทุกสาขา'}
                </span>
                <ChevronDown
                  size={13}
                  className={`flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                />
              </button>

              {open && (
                <>
                  {/* backdrop */}
                  <div className="fixed inset-0 z-40" onClick={closeDropdown} />

                  {/* dropdown panel */}
                  <div className={`
                    absolute z-50 top-[calc(100%+8px)] left-0
                    bg-white rounded-2xl shadow-xl shadow-brand-blue/12
                    border border-brand-blue/10 overflow-hidden
                    min-w-[210px]
                    ${closing ? 'branch-dropdown-exit' : 'branch-dropdown-enter'}
                  `}>
                    {/* header label */}
                    <div className="px-4 py-2.5 border-b border-brand-blue/8">
                      <p className="text-[10px] font-bold text-brand-dark/30 uppercase tracking-widest">เลือกสาขา</p>
                    </div>

                    {siteOptions.map((site, i) => {
                      const isAll     = site === 'ทั้งหมด'
                      const isPassion = site === 'พาชชั่น ระยอง'
                      // Passion shows as coming-soon only when it has no real data yet
                      // (it appears in availableSites as placeholder when passion store is empty)
                      const comingSoon = isPassion && !availableSites.filter(s => s !== 'พาชชั่น ระยอง').some(s => s.includes('พาชชั่น'))
                      const active    = selectedSite === site
                      return (
                        <button
                          key={site}
                          onClick={() => { if (!comingSoon) { setSelectedSite(site); closeDropdown() } }}
                          disabled={comingSoon}
                          className={`
                            w-full flex items-center gap-3 px-4 py-3
                            text-[13px] text-left transition-all duration-150
                            ${active ? 'bg-brand-blue/5 text-brand-blue' : ''}
                            ${comingSoon ? 'opacity-50 cursor-default' : 'hover:bg-brand-pale/50 text-brand-dark/70'}
                            ${i < siteOptions.length - 1 ? 'border-b border-brand-blue/5' : ''}
                          `}
                          style={{ animationDelay: `${i * 30}ms` }}
                        >
                          <span className={`
                            flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-[15px]
                            ${active ? 'bg-brand-blue/10' : 'bg-brand-pale/60'}
                          `}>
                            {isAll ? '🏪' : '📍'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className={`font-semibold leading-none truncate ${active ? 'text-brand-blue' : ''}`}>
                                {isAll ? 'ทุกสาขา' : site}
                              </p>
                              {comingSoon && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-brand-dark/10 text-brand-dark/40 uppercase tracking-wide flex-shrink-0">
                                  เร็วๆ นี้
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-brand-dark/30 mt-0.5 font-normal">
                              {isAll ? 'แสดงข้อมูลทั้งหมด' : comingSoon ? 'ยังไม่มีข้อมูล' : 'เฉพาะสาขานี้'}
                            </p>
                          </div>
                          {active && (
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-blue flex items-center justify-center">
                              <Check size={11} strokeWidth={3} className="text-white" />
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
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
