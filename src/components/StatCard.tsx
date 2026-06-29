import React from 'react'

interface StatCardProps {
  label: string
  value: string
  sub?: string
  sub2?: string
  accent?: boolean
  icon?: React.ReactNode
  delay?: number
}

export default function StatCard({ label, value, sub, sub2, accent, icon, delay = 0 }: StatCardProps) {
  return (
    <div
      className={`rounded-2xl p-4 animate-fade-up card-hover ${
        accent
          ? 'border border-brand-blue'
          : 'bg-white border border-brand-blue/10'
      }`}
      style={{
        animationDelay: `${delay}ms`,
        backgroundColor: accent ? '#1a52b3' : undefined,
      }}
    >
      <div className={`flex items-center gap-1.5 mb-2 text-[11px] font-medium ${
        accent ? 'text-white/70' : 'text-brand-dark/50'
      }`}>
        {icon && <span>{icon}</span>}
        {label}
      </div>
      <div className={`text-[22px] font-bold leading-none ${accent ? 'text-white' : 'text-brand-dark'}`}>
        {value}
      </div>
      {sub && (
        <div className={`text-[11px] mt-1.5 ${accent ? 'text-white/60' : 'text-brand-dark/40'}`}>
          {sub}
        </div>
      )}
      {sub2 && (
        <div className={`text-[10px] mt-1 ${accent ? 'text-white/50' : 'text-brand-dark/30'}`}>
          {sub2}
        </div>
      )}
    </div>
  )
}
