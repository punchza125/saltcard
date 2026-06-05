import React from 'react'
import { Upload } from 'lucide-react'

interface HeaderProps {
  reportCount: number
  onUploadClick: () => void
  activeTab: 'dashboard' | 'upload' | 'stock' | 'machine'
  setActiveTab: (t: 'dashboard' | 'upload' | 'stock' | 'machine') => void
}

export default function Header({ reportCount, onUploadClick, activeTab, setActiveTab }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-brand-blue/10 w-full">
      <div className="flex items-center px-4 md:px-6 h-16 gap-3">

        {/* Logo */}
        <div className="flex items-center gap-2.5 flex-1 md:flex-none">
          <img src="/logo.png" alt="Saltcard" className="h-10 w-10 object-contain rounded-xl" />
          <div>
            <p className="text-brand-dark font-bold text-[15px] leading-none tracking-wide">SALTCARD</p>
            <p className="text-brand-blue/60 text-[10px] mt-0.5">Sales Dashboard</p>
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
