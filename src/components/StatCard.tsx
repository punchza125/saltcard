import React from 'react'

interface StatCardProps {
  label: string
  value: string
  sub?: string
  sub2?: string
  accent?: boolean
  icon?: React.ReactNode
  delay?: number
  animKey?: string | number
}

export default function StatCard({ label, value, sub, sub2, accent, icon, delay = 0, animKey }: StatCardProps) {
  return (
    <div
      className={`rounded-2xl p-4 animate-pop-in card-hover ${
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
      <div key={animKey} className={`text-[22px] font-bold leading-none animate-pop-in ${accent ? 'text-white' : 'text-brand-dark'}`}>
        {value}
      </div>
      {sub && (
        <div key={`sub-${animKey}`} className={`text-[11px] mt-1.5 animate-pop-in ${accent ? 'text-white/60' : 'text-brand-dark/40'}`} style={{ animationDelay: '30ms' }}>
          {sub}
        </div>
      )}
      {sub2 && (
        <div key={`sub2-${animKey}`} className={`text-[10px] mt-1 animate-pop-in ${accent ? 'text-white/50' : 'text-brand-dark/30'}`} style={{ animationDelay: '50ms' }}>
          {sub2}
        </div>
      )}
    </div>
  )
}
