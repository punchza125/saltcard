import { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Sector, ReferenceLine
} from 'recharts'
import { ChevronLeft, ChevronRight, ChevronDown, Check, TrendingUp, Package, MapPin, Search, X } from 'lucide-react'
import type { DayReport, StockProduct } from '../types'
import { formatThaiDate, formatThaiDateFull, formatBaht, matchesKeyword, baseGoodsName } from '../utils/parser'
import { calcProfit } from '../lib/profit'
import { useOrderStore } from '../hooks/useOrderStore'
import { useTxStore } from '../hooks/useTxStore'
import StatCard from './StatCard'
import { IMG_FILES } from '../generated/imgManifest'
import { categoryLogo } from '../lib/categoryLogos'
import { branchBadge } from '../lib/branchLogos'

interface DashboardPageProps {
  reports: DayReport[]
  stockProducts?: StockProduct[]
  taxRate?: number
  monthlyProfitGoal?: number
  onSetMonthlyGoal?: (v: number) => void
  activeBranch: string       // which branch is selected (for display only — reports are pre-filtered)
  setActiveBranch: (s: string) => void
  syncStatus?: 'idle' | 'syncing' | 'success' | 'error'
  lastSynced?: string
  categoryAliases?: Record<string, string>  // ย้าย/รวมหมวด → remap ยอดขายในกราฟ
}


type RangeMode = 'day' | 'week' | 'month' | 'all'

const TYPE_COLORS = ['#4f3dc8', '#1a52b3', '#e94560', '#f59e0b', '#10b981', '#8b5cf6', '#0ea5e9', '#14b8a6']
const THAI_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม']
const THAI_DAYS = ['อา','จ','อ','พ','พฤ','ศ','ส']

const RANK_STYLES = [
  { bg: '#e94560', text: '#fff' },
  { bg: '#94a3b8', text: '#fff' },
  { bg: '#8b5cf6', text: '#fff' },
]

/**
 * ลำดับรูปที่จะลองโหลดสำหรับสินค้าในรายงานขาย
 * สินค้า [Promotion] ใช้รูปปกติของสินค้านั้น (ตัดคำว่า promotion ออกก่อนค้น)
 */
// ชื่อไฟล์รูปจริง (จาก manifest) → คีย์ที่ตัดช่องว่าง/ตัวพิมพ์ออก
// กันเคสไฟล์ตั้งชื่อไม่ตรงเป๊ะ เช่น "Attack Of The Vine - Set 13(1 Pack).jpg"
// ขณะที่รายงานเขียนว่า "Attack of the Vine - Set 13 (1 Pack)"
const IMG_BY_KEY: Record<string, string> = (() => {
  const map: Record<string, string> = {}
  for (const f of IMG_FILES) {
    const key = f.replace(/\.(jpe?g|png|webp)$/i, '').toLowerCase().replace(/\s+/g, '')
    if (!(key in map)) map[key] = f
  }
  return map
})()

function goodsImageCandidates(name: string): string[] {
  const base = name
    .replace(/^\[Promotion\]\s*/i, '')
    .replace(/^Promotion\s*-\s*/i, '')
    .replace(/\s*\(Promotion\)\s*$/i, '')
    .trim()
  // สินค้า promotion ใช้ "รูปปกติ" ของสินค้านั้นก่อน แล้วค่อย fallback เป็นชื่อเต็ม
  const names: string[] = base !== name ? [base, name] : [name]
  for (const b of [...names]) {
    if (!/\((1 Pack|Box)\)\s*$/i.test(b)) names.push(`${b} (1 Pack)`)
    const noBox = b.replace(/\s*\(Box\)\s*$/i, '')
    if (noBox !== b) names.push(`${noBox} (1 Pack)`)
  }
  const out: string[] = []
  for (const n of names) {
    const hit = IMG_BY_KEY[n.toLowerCase().replace(/\s+/g, '')]
    if (hit) out.push(`/Img/${hit}`)
  }
  return [...new Set(out)]
}

/** รูปสินค้าเล็กในรายการขายดี — ลองหลายชื่อ ถ้าไม่เจอเลยแสดงกล่องเปล่า */
function GoodsThumb({ name, delay = 0 }: { name: string; delay?: number }) {
  const srcs = useMemo(() => goodsImageCandidates(name), [name])
  const [idx, setIdx] = useState(0)
  if (idx >= srcs.length) {
    return (
      <div className="w-11 h-11 rounded-lg bg-brand-pale flex items-center justify-center flex-shrink-0 animate-pop-in"
        style={{ animationDelay: `${delay}ms` }}>
        <Package size={14} className="text-brand-blue/25" />
      </div>
    )
  }
  return (
    <img
      key={srcs[idx]}
      src={srcs[idx]}
      alt={name}
      loading="lazy"
      onError={() => setIdx(i => i + 1)}
      style={{ animationDelay: `${delay}ms` }}
      className="w-11 h-11 rounded-lg object-contain bg-white ring-1 ring-brand-blue/10 flex-shrink-0 animate-pop-in transition-transform duration-200 hover:scale-110"
    />
  )
}



/** คลื่นน้ำ SVG แบบ data URI — ใช้เป็น background ที่วิ่งวนได้ */
function waveBg(color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 28" preserveAspectRatio="none"><path d="M0 10 C 15 2, 25 2, 40 10 S 65 18, 80 10 S 105 2, 120 10 L120 28 L0 28 Z" fill="${color}"/></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

/** หลอดเป้ากำไรรายเดือน — แนวตั้งเล็กๆ ในการ์ดยอดขาย กดดูรายละเอียด/แก้เป้าได้ */
function MonthlyGoalTube({ earned, goal, monthLabel, daysLeft, onEditGoal }: {
  earned: number
  goal: number
  monthLabel: string
  daysLeft: number
  onEditGoal?: (v: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(String(goal))
  const pct = goal > 0 ? Math.min((earned / goal) * 100, 100) : 0
  const done = earned >= goal
  const remain = Math.max(0, goal - earned)

  function save() {
    const n = Number(draft)
    if (onEditGoal && n > 0) onEditGoal(Math.round(n))
    setOpen(false)
  }

  return (
    <div className="relative flex flex-col items-center justify-between py-0.5">
      <button
        onClick={() => { setDraft(String(goal)); setOpen(o => !o) }}
        className="flex flex-col items-center gap-1 h-full group"
        title={`เป้ากำไร${monthLabel} ฿${formatBaht(Math.round(earned))} / ฿${formatBaht(goal)}`}
      >
        <span className="text-[8px] font-medium text-white/50 leading-none">เป้า</span>
        {/* หลอดน้ำแนวตั้ง — น้ำขึ้นจากล่าง */}
        <div className="relative w-4 flex-1 min-h-[38px] rounded-full bg-white/15 overflow-hidden group-hover:bg-white/25 transition-colors">
          <div
            className="absolute inset-x-0 bottom-0 overflow-hidden transition-[height] duration-1000 ease-out"
            style={{ height: `${Math.max(pct, 6)}%` }}
          >
            <div className={`wave-body absolute inset-0 ${done
              ? 'bg-gradient-to-t from-emerald-500 to-emerald-300'
              : 'bg-gradient-to-t from-sky-500 to-sky-300'}`} />
            <div className="wave-layer wave-a" style={{ backgroundImage: waveBg('#ffffff') }} />
            <div className="wave-layer wave-b" style={{ backgroundImage: waveBg('#ffffff') }} />
          </div>
        </div>
        <span className={`text-[9px] font-bold tabular-nums leading-none ${done ? 'text-emerald-300' : 'text-white/80'}`}>
          {pct.toFixed(0)}%
        </span>
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/40"
          onClick={() => setOpen(false)}>
          <div className="bg-white w-full md:max-w-xs rounded-t-3xl md:rounded-2xl shadow-2xl p-5 pb-7 md:pb-5"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[13px] font-semibold text-brand-dark">เป้ากำไร{monthLabel}</p>
              <button onClick={() => setOpen(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-brand-dark/30 hover:bg-brand-pale">
                <X size={15} />
              </button>
            </div>

            <p className="text-[20px] font-bold leading-tight mb-0.5">
              <span className={done ? 'text-emerald-600' : 'text-brand-dark'}>
                ฿{formatBaht(Math.round(earned))}
              </span>
              <span className="text-[13px] font-normal text-brand-dark/35"> / ฿{formatBaht(goal)}</span>
            </p>

            <div className="relative h-6 rounded-full bg-brand-pale overflow-hidden my-2.5">
              <div className="absolute inset-y-0 left-0 overflow-hidden transition-[width] duration-1000 ease-out"
                style={{ width: `${Math.max(pct, 3)}%` }}>
                <div className={`wave-body absolute inset-0 ${done
                  ? 'bg-gradient-to-r from-emerald-400 to-teal-400'
                  : 'bg-gradient-to-r from-sky-400 to-brand-blue'}`} />
                <div className="wave-layer wave-a" style={{ backgroundImage: waveBg('#ffffff') }} />
                <div className="wave-layer wave-b" style={{ backgroundImage: waveBg('#ffffff') }} />
              </div>
              <span className={`absolute inset-0 flex items-center px-2.5 text-[11px] font-bold tabular-nums ${
                pct > 50 ? 'text-white justify-start' : 'text-brand-dark/50 justify-end'
              }`}>{pct.toFixed(0)}%</span>
            </div>

            <p className="text-[11px] text-brand-dark/45 leading-relaxed mb-3">
              {done
                ? `ถึงเป้าแล้ว เกินมา ฿${formatBaht(Math.round(earned - goal))} 🎉`
                : daysLeft > 0
                  ? `เหลืออีก ฿${formatBaht(Math.round(remain))} · ${daysLeft} วัน · เฉลี่ยวันละ ฿${formatBaht(Math.round(remain / daysLeft))}`
                  : `เหลืออีก ฿${formatBaht(Math.round(remain))}`}
            </p>

            {onEditGoal && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-brand-dark/40 flex-shrink-0">ตั้งเป้า ฿</span>
                <input
                  type="number" inputMode="numeric"
                  className="flex-1 min-w-0 border border-brand-blue/20 rounded-xl px-3 py-2 text-[15px] outline-none focus:border-brand-blue"
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setOpen(false) }}
                />
                <button onClick={save}
                  className="text-[13px] font-semibold px-4 py-2 rounded-xl bg-brand-blue text-white flex-shrink-0 active:scale-95 transition-transform">
                  ตั้ง
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

/** กรอบโลโก้สาขา — โลโก้สีอ่อนต้องวางบนพื้นเข้มไม่งั้นมองไม่เห็น */
function BranchIcon({ site, size = 28 }: { site: string; size?: number }) {
  const badge = branchBadge(site)
  return (
    <span
      className={`rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden border ${
        badge?.needsDarkBg
          ? 'bg-brand-dark border-brand-dark'
          : 'bg-white border-brand-blue/10'
      }`}
      style={{ width: size, height: size }}
    >
      {badge
        ? <img src={badge.src} alt={site} className="w-full h-full object-contain p-[3px]" />
        : <span style={{ fontSize: size * 0.5 }}>🏪</span>}
    </span>
  )
}

/** ป้ายลอยบอกสาขาที่ดูอยู่ — กดแล้วสลับสาขาได้ทันที */
function BranchSwitcherPill({ selected, options, onSelect }: {
  selected: string
  options: string[]
  onSelect: (s: string) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-[76px] md:bottom-6 z-[90]">
      {open && (
        <>
          <div className="fixed inset-0" onClick={() => setOpen(false)} />
          {/* ตัวนอกจัดตำแหน่ง ตัวในทำอนิเมชัน — ไม่งั้น transform ของ animate-pop-in
              จะไปทับ -translate-x-1/2 ทำให้เมนูเลื่อนหลุดขอบจอ */}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 max-w-[calc(100vw-2rem)]">
            <div className="bg-white rounded-2xl shadow-xl shadow-brand-blue/15 border border-brand-blue/10
              overflow-hidden animate-pop-in">
              <p className="px-3 pt-2.5 pb-1.5 text-[9px] font-bold text-brand-dark/30 uppercase tracking-widest">
                เลือกสาขา
              </p>
              {['ทั้งหมด', ...options].map(site => {
                const active = site === selected
                return (
                  <button
                    key={site}
                    onClick={() => { onSelect(site); setOpen(false) }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors
                      ${active ? 'bg-brand-blue/5' : 'hover:bg-brand-pale/60'}`}
                  >
                    <BranchIcon site={site} />
                    <span className={`text-[12px] font-semibold flex-1 truncate ${active ? 'text-brand-blue' : 'text-brand-dark/70'}`}>
                      {site === 'ทั้งหมด' ? 'ทุกสาขา' : site}
                    </span>
                    {active && (
                      <span className="w-4 h-4 rounded-full bg-brand-blue flex items-center justify-center flex-shrink-0">
                        <Check size={9} strokeWidth={3} className="text-white" />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}

      <button
        onClick={() => setOpen(o => !o)}
        className="relative flex items-center gap-2 rounded-full bg-brand-blue text-white
          shadow-lg shadow-brand-blue/30 pl-1.5 pr-3 py-1.5 animate-pop-in active:scale-95 transition-transform"
        title="กดเพื่อเปลี่ยนสาขา"
      >
        <BranchIcon site={selected} />
        <span className="text-[12px] font-semibold whitespace-nowrap">{selected}</span>
        <ChevronDown size={13} className={`text-white/70 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
    </div>
  )
}

const THAI_DAY_FULL = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์']

/** ประวัติการขายของสินค้าตัวเดียว — กดจากรายการสินค้าขายดี */
function GoodsDetailModal({ name, reports, onClose }: {
  name: string
  reports: DayReport[]
  onClose: () => void
}) {
  const [range, setRange] = useState<7 | 30 | 'all'>(30)

  const data = useMemo(() => {
    // ทุกวันที่สินค้านี้มียอด
    const all = reports
      .map(r => {
        // รวมทุกแถวที่เป็นสินค้าตัวเดียวกัน (ทั้งราคาปกติและ [Promotion])
        const rows = r.goods.filter(x => baseGoodsName(x.goodsName) === name)
        if (!rows.length) return null
        return {
          date: r.date,
          volume: rows.reduce((s, x) => s + x.salesVolume, 0),
          amount: rows.reduce((s, x) => s + x.salesAmount, 0),
        }
      })
      .filter((x): x is { date: string; volume: number; amount: number } => !!x)
    if (!all.length) return null

    const cutoff = range === 'all' ? '' : (() => {
      const last = new Date(reports[reports.length - 1].date)
      last.setDate(last.getDate() - (range - 1))
      return last.toISOString().slice(0, 10)
    })()
    const rows = range === 'all' ? all : all.filter(d => d.date >= cutoff)
    if (!rows.length) return null

    const totalVol = rows.reduce((s, d) => s + d.volume, 0)
    const totalAmt = rows.reduce((s, d) => s + d.amount, 0)
    const best = rows.reduce((a, b) => (b.amount > a.amount ? b : a))
    const first = all[0].date

    // ทุกวันในช่วงที่เลือก รวมวันที่ขายไม่ได้ด้วย — ใช้เป็นตัวหารของค่าเฉลี่ยต่อวัน
    // ช่วง "ทั้งหมด" เริ่มนับจากวันที่ขายได้ครั้งแรก ไม่งั้นวันก่อนวางขายจะมาถ่วงค่าเฉลี่ย
    const startAt = range === 'all' ? first : (cutoff > first ? cutoff : first)
    const volByDate = new Map(rows.map(d => [d.date, d.volume]))
    const daysInRange = reports.filter(r => r.date >= startAt).map(r => r.date)

    // ขายดีวันไหนของสัปดาห์ — เฉลี่ยจากทุกวันในช่วง วันที่ขายไม่ได้นับเป็น 0
    const dow = Array.from({ length: 7 }, () => ({ vol: 0, days: 0 }))
    daysInRange.forEach(date => {
      const i = new Date(date).getDay()
      dow[i].vol += volByDate.get(date) ?? 0
      dow[i].days++
    })
    const dowAvg = dow.map((x, i) => ({
      label: THAI_DAY_FULL[i],
      avg: x.days ? x.vol / x.days : 0,
      days: x.days,
    }))
    const dowMax = Math.max(...dowAvg.map(x => x.avg), 0)

    return {
      rows: rows.map(d => ({ ...d, label: formatThaiDate(d.date) })),
      totalVol, totalAmt, best, first,
      avgPerDay: daysInRange.length ? totalVol / daysInRange.length : 0,
      rangeDays: daysInRange.length,
      dowAvg, dowMax,
      activeDays: rows.length,
    }
  }, [reports, name, range])

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/40 p-0 md:p-4"
      onClick={onClose}>
      <div className="bg-white w-full md:max-w-2xl rounded-t-3xl md:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}>

        {/* header */}
        <div className="flex items-start gap-3 px-4 md:px-5 pt-4 pb-3 border-b border-brand-blue/8">
          <GoodsThumb name={name} />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-brand-dark leading-snug">{name}</p>
            {data && (
              <p className="text-[10px] text-brand-dark/35 mt-0.5">
                ขายครั้งแรก {formatThaiDate(data.first)} · มียอด {data.activeDays} วัน
              </p>
            )}
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-brand-dark/30 hover:bg-brand-pale hover:text-brand-dark transition-colors flex-shrink-0">
            <X size={15} />
          </button>
        </div>

        <div className="overflow-y-auto px-4 md:px-5 py-3 space-y-4">
          {/* ช่วงเวลา */}
          <div className="flex gap-1.5">
            {([[7, '7 วัน'], [30, '30 วัน'], ['all', 'ทั้งหมด']] as [7 | 30 | 'all', string][]).map(([k, label]) => (
              <button key={String(k)} onClick={() => setRange(k)}
                className={`text-[11px] px-3 py-1.5 rounded-lg font-medium transition-all ${
                  range === k ? 'bg-brand-blue text-white' : 'bg-brand-pale text-brand-dark/50 hover:text-brand-dark'
                }`}>
                {label}
              </button>
            ))}
          </div>

          {!data ? (
            <p className="text-[12px] text-brand-dark/35 text-center py-10">ไม่มียอดขายในช่วงนี้</p>
          ) : (
            <>
              {/* สรุป */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  { l: 'ขายได้', v: `${data.totalVol} ชิ้น` },
                  { l: 'ยอดขาย', v: `฿${formatBaht(data.totalAmt)}` },
                  { l: 'เฉลี่ยต่อวัน', v: `${data.avgPerDay.toFixed(1)} ชิ้น/วัน`, sub: `เฉลี่ยจากช่วง ${data.rangeDays} วัน` },
                  { l: 'วันที่ดีที่สุด', v: `฿${formatBaht(data.best.amount)}`, sub: formatThaiDate(data.best.date) },
                ].map(x => (
                  <div key={x.l} className="rounded-xl bg-brand-pale/50 px-3 py-2">
                    <p className="text-[9px] text-brand-dark/40 mb-0.5">{x.l}</p>
                    <p className="text-[14px] font-bold text-brand-dark leading-tight">{x.v}</p>
                    {x.sub && <p className="text-[9px] text-brand-dark/35 mt-0.5">{x.sub}</p>}
                  </div>
                ))}
              </div>

              {/* กราฟยอดขายรายวัน */}
              <div>
                <p className="text-[11px] font-medium text-brand-dark/50 mb-1.5">ยอดขายรายวัน</p>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={data.rows} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gDetail" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#1a52b3" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#1a52b3" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e4eaf6" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#0d1b3e66' }} tickLine={false} axisLine={false} minTickGap={20} />
                    <YAxis tick={{ fontSize: 9, fill: '#0d1b3e66' }} tickLine={false} axisLine={false} width={45}
                      tickFormatter={(v: number) => v >= 1000 ? `${Math.round(v / 1000)}K` : String(v)} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="amount" name="ยอดขาย" stroke="#1a52b3" strokeWidth={2} fill="url(#gDetail)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* ขายดีวันไหนของสัปดาห์ */}
              <div>
                <p className="text-[11px] font-medium text-brand-dark/50 mb-1.5">
                  ขายดีวันไหน <span className="text-brand-dark/30 font-normal">(เฉลี่ยชิ้นต่อวัน)</span>
                </p>
                <div className="space-y-1">
                  {data.dowAvg.map(d => (
                    <div key={d.label} className="flex items-center gap-2">
                      <span className="w-12 text-[10px] text-brand-dark/45 flex-shrink-0">{d.label}</span>
                      <div className="flex-1 h-3.5 bg-brand-pale rounded-full overflow-hidden relative">
                        <div className="h-full rounded-full bg-brand-blue transition-all duration-500"
                          style={{ width: data.dowMax > 0 ? `${(d.avg / data.dowMax) * 100}%` : '0%',
                                   opacity: d.avg === data.dowMax && d.avg > 0 ? 1 : 0.4 }} />
                      </div>
                      <span className="w-16 text-right text-[10px] tabular-nums text-brand-dark/45 flex-shrink-0">
                        {d.days ? `${d.avg.toFixed(1)} ชิ้น` : '—'}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-[9px] text-brand-dark/30 mt-1.5">
                  เฉลี่ยจากทุกวันในช่วง วันที่ขายไม่ได้นับเป็น 0 — ช่วง "ทั้งหมด" เริ่มนับจากวันที่ขายได้ครั้งแรก
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-brand-blue/15 rounded-xl px-3 py-2 text-[12px]">
      <p className="text-brand-dark/50 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-medium">
          {p.name}: {typeof p.value === 'number' ? (p.name === 'ยอดขาย' ? '฿' + p.value.toLocaleString('th-TH') : p.value) : p.value}
        </p>
      ))}
    </div>
  )
}

export default function DashboardPage({ reports: allReports, stockProducts = [], taxRate = 15, monthlyProfitGoal = 40000, onSetMonthlyGoal, activeBranch, setActiveBranch, syncStatus, lastSynced, categoryAliases = {} }: DashboardPageProps) {
  const { orders } = useOrderStore()
  const { days: txDays, load: loadTx } = useTxStore()
  const [goodsMetric, setGoodsMetric] = useState<'amount' | 'profit'>('amount')
  const [goodsDetail, setGoodsDetail] = useState<string | null>(null)
  // กรองตามสาขาที่เลือก — 'ทั้งหมด' รวมทุกสาขา (ใช้ area total), ไม่งั้นดึงเฉพาะ site ที่ตรงชื่อ
  const selectedSite = activeBranch || 'ทั้งหมด'

  // เลือกสาขา → เหลือเฉพาะ "วันที่สาขานั้นมีข้อมูลจริง" (อยู่ใน Site Aspect ของวันนั้น)
  // เช่น Passion เพิ่งเปิด 2 วัน → รายงานวันเก่าๆ ที่เป็นเซ็นทรัลล้วนถูกตัดทิ้งทั้งวัน
  // ทำให้กราฟรายวัน/สินค้าขายดี/สินค้าตามประเภท เห็นเฉพาะช่วงที่สาขานี้เปิดจริง
  const reports = useMemo(() => {
    if (selectedSite === 'ทั้งหมด') return allReports
    return allReports.filter(r => r.sites.some(s => s.name === selectedSite))
  }, [allReports, selectedSite])

  // ข้อมูลแยกสาขาโหลดเฉพาะตอนที่เลือกสาขาจริงๆ — ดู "ทุกสาขา" ไม่ต้องโหลด
  useEffect(() => { if (selectedSite !== 'ทั้งหมด') loadTx() }, [selectedSite, loadTx])

  const [rangeMode, setRangeMode] = useState<RangeMode>('day')
  const [selectedDateIdx, setSelectedDateIdx] = useState<number>(reports.length - 1)
  const [goodsSearch, setGoodsSearch] = useState('')
  const [goodsCat,    setGoodsCat]    = useState('ทั้งหมด')
  const [showCalendar, setShowCalendar] = useState(false)
  const [activePieIndex, setActivePieIndex] = useState<number | undefined>(undefined)
  const [calendarMonth, setCalendarMonth] = useState(() =>
    (reports[reports.length - 1]?.date ?? new Date().toISOString().slice(0, 10)).slice(0, 7)
  )
  const calendarRef = useRef<HTMLDivElement>(null)
  const [showLuffyGood, setShowLuffyGood] = useState(false)
  const prevSyncStatus = useRef(syncStatus)
  useEffect(() => {
    if (prevSyncStatus.current === 'syncing' && syncStatus === 'success') {
      setShowLuffyGood(true)
      setTimeout(() => setShowLuffyGood(false), 2500)
    }
    prevSyncStatus.current = syncStatus
  }, [syncStatus])

  // helper: get amount/volume for a report, optionally filtered to one site
  function siteAmt(r: DayReport, site: string) {
    if (site === 'ทั้งหมด') return r.areas.reduce((a, row) => a + row.salesAmount, 0)
    return r.sites.find(s => s.name === site)?.salesAmount ?? 0
  }
  function siteVol(r: DayReport, site: string) {
    if (site === 'ทั้งหมด') return r.areas.reduce((a, row) => a + row.salesVolume, 0)
    return r.sites.find(s => s.name === site)?.salesVolume ?? 0
  }

  const currentIdx = Math.min(selectedDateIdx, reports.length - 1)
  const selectedReport = reports[currentIdx] as DayReport | undefined

  const filteredReports = useMemo(() => {
    if (rangeMode === 'all') return reports
    if (rangeMode === 'day') return selectedReport ? [selectedReport] : []
    if (!reports.length) return []
    const last = reports[reports.length - 1]
    const anchor = new Date(last.date)
    anchor.setDate(anchor.getDate() - (rangeMode === 'week' ? 6 : 29))
    const cutoff = anchor.toISOString().slice(0, 10)
    return reports.filter(r => r.date >= cutoff)
  }, [reports, rangeMode, selectedReport])

  const stats = useMemo(() => {
    const totalAmount = filteredReports.reduce((s, r) => s + siteAmt(r, selectedSite), 0)
    const totalVolume = filteredReports.reduce((s, r) => s + siteVol(r, selectedSite), 0)
    const avgPerPiece = totalVolume > 0 ? Math.round(totalAmount / totalVolume) : 0
    return { totalAmount, totalVolume, avgPerPiece }
  }, [filteredReports, selectedSite])

  const cumulativeTotal = useMemo(() => {
    if (rangeMode === 'all') return null
    const lastDate = filteredReports[filteredReports.length - 1]?.date
    if (!lastDate) return null
    return reports.filter(r => r.date <= lastDate).reduce((s, r) => s + siteAmt(r, selectedSite), 0)
  }, [reports, filteredReports, rangeMode, selectedSite])

  // branch comparison (for sites card — shows each site's share)
  const branchComparison = useMemo(() => {
    const sites = Array.from(new Set(filteredReports.flatMap(r => r.sites.map(s => s.name)))).sort()
    if (sites.length === 0) return null
    return sites.map(site => ({
      site,
      amount: filteredReports.reduce((s, r) => s + siteAmt(r, site), 0),
      volume: filteredReports.reduce((s, r) => s + siteVol(r, site), 0),
    })).sort((a, b) => b.amount - a.amount)
  }, [filteredReports])

  // compare selected day vs the report immediately before it (day mode only)
  const vsYesterday = useMemo(() => {
    if (rangeMode !== 'day') return null
    if (currentIdx < 1) return null
    const today     = reports[currentIdx]
    const yesterday = reports[currentIdx - 1]
    if (!today || !yesterday) return null
    const todayAmt = siteAmt(today, selectedSite)
    const yestAmt  = siteAmt(yesterday, selectedSite)
    const diff = todayAmt - yestAmt
    const pct  = yestAmt > 0 ? Math.round(Math.abs(diff) / yestAmt * 100) : 0
    return { todayAmt, yestAmt, diff, pct, todayDate: today.date, yestDate: yesterday.date }
  }, [reports, rangeMode, currentIdx, selectedSite])

  // week comparison for luffy card (only in 'week' mode)
  const weekStats = useMemo(() => {
    if (rangeMode !== 'week' || reports.length < 2) return null
    const sorted = [...reports].sort((a, b) => a.date.localeCompare(b.date))
    const thisWeek = sorted.slice(-7)
    const prevWeek = sorted.slice(-14, -7)
    if (prevWeek.length === 0) return null
    const thisAmt = thisWeek.reduce((s, r) => s + siteAmt(r, selectedSite), 0)
    const prevAmt = prevWeek.reduce((s, r) => s + siteAmt(r, selectedSite), 0)
    const diff = thisAmt - prevAmt
    const pct  = prevAmt > 0 ? Math.round(Math.abs(diff) / prevAmt * 100) : null
    const best = thisWeek.reduce((a, b) =>
      siteAmt(b, selectedSite) > siteAmt(a, selectedSite) ? b : a
    )
    return { thisAmt, prevAmt, diff, pct, bestDate: best.date }
  }, [reports, rangeMode])

  // month comparison for naruto card (only in 'month' mode)
  const monthStats = useMemo(() => {
    if (rangeMode !== 'month' || reports.length < 2) return null
    const sorted = [...reports].sort((a, b) => a.date.localeCompare(b.date))
    const thisMonth = sorted.slice(-30)
    const prevMonth = sorted.slice(-60, -30)
    const thisAmt = thisMonth.reduce((s, r) => s + siteAmt(r, selectedSite), 0)
    const prevAmt = prevMonth.reduce((s, r) => s + siteAmt(r, selectedSite), 0)
    const diff = thisAmt - prevAmt
    const pct  = prevAmt > 0 ? Math.round(Math.abs(diff) / prevAmt * 100) : null
    const avgDay = thisMonth.length > 0 ? Math.round(thisAmt / thisMonth.length) : 0
    const wins = thisMonth.slice(1).filter((r, i) =>
      siteAmt(r, selectedSite) > siteAmt(thisMonth[i], selectedSite)
    ).length
    return { thisAmt, prevAmt, diff, pct, avgDay, wins, days: thisMonth.length }
  }, [reports, rangeMode])

  // all-time stats for pikachu card (only in 'all' mode)
  const allTimeStats = useMemo(() => {
    if (rangeMode !== 'all' || reports.length < 2) return null
    const dailyAmts = reports.map(r => ({
      date: r.date,
      amount: siteAmt(r, selectedSite),
    }))
    const best = dailyAmts.reduce((a, b) => b.amount > a.amount ? b : a)
    // current winning streak from the end
    let streak = 0
    for (let i = dailyAmts.length - 1; i >= 1; i--) {
      if (dailyAmts[i].amount > dailyAmts[i - 1].amount) streak++
      else break
    }
    const winsTotal = dailyAmts.slice(1).filter((d, i) => d.amount > dailyAmts[i].amount).length
    return { best, streak, winsTotal, total: dailyAmts.length - 1 }
  }, [reports, rangeMode])

  /**
   * กำไรของช่วงที่เลือก — ต้นทุนอ้างอิงราคากล่องล่าสุดที่รับของแล้ว ณ วันนั้น
   * เลือกสาขา + มีไฟล์ Transaction Details ของวันนั้น → คิดจากยอดสินค้าของสาขานั้น
   * ไม่งั้นกำไรจะเป็นของทั้งวันทุกสาขา ทั้งที่ยอดขายด้านบนแสดงแค่สาขาเดียว
   */
  const profit = useMemo(() => {
    if (!filteredReports.length || stockProducts.length === 0) return null
    const src = selectedSite === 'ทั้งหมด' ? filteredReports : filteredReports.map(r => {
      const site = txDays[r.date]?.sites[selectedSite]
      if (!site) return r
      return {
        ...r,
        goods: site.g.map(g => ({
          goodsNumber: '', goodsName: g.n, goodsType: '',
          salesVolume: g.v, salesAmount: g.a,
        })),
      }
    })
    return calcProfit(src, stockProducts, orders, taxRate)
  }, [filteredReports, stockProducts, orders, taxRate, selectedSite, txDays])

  // เป้ากำไรรายเดือน — นับทั้งเดือนของรายงานล่าสุด ไม่ขึ้นกับช่วงที่เลือกดู
  const monthGoal = useMemo(() => {
    if (!reports.length) return null
    const lastDate = reports[reports.length - 1].date
    const ym = lastDate.slice(0, 7)
    const inMonth = reports.filter(r => r.date.startsWith(ym))
    const p = calcProfit(inMonth, stockProducts, orders, taxRate)
    const y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7))
    const lastDay = new Date(y, m, 0).getDate()
    return {
      earned: p?.total ?? 0,
      monthLabel: ` ${THAI_MONTHS[m - 1]}`,
      daysLeft: Math.max(0, lastDay - Number(lastDate.slice(8, 10))),
    }
  }, [reports, stockProducts, orders, taxRate])

  // สาขาทั้งหมดที่เคยมีข้อมูล — ใช้ในป้ายลอยสำหรับสลับสาขา
  const branchOptions = useMemo(
    () => Array.from(new Set(allReports.flatMap(r => r.sites.map(s => s.name)))).sort(),
    [allReports],
  )

  const availableDates = useMemo(() => new Set(reports.map(r => r.date)), [reports])

  const calYear = parseInt(calendarMonth.slice(0, 4))
  const calMonthNum = parseInt(calendarMonth.slice(5, 7))
  const calFirstDay = new Date(calYear, calMonthNum - 1, 1).getDay()
  const calDaysInMonth = new Date(calYear, calMonthNum, 0).getDate()

  function shiftCalMonth(delta: number) {
    const d = new Date(calYear, calMonthNum - 1 + delta, 1)
    setCalendarMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const trendData = useMemo(() =>
    reports.map(r => ({
      date: formatThaiDate(r.date),
      ยอดขาย: siteAmt(r, selectedSite),
    })), [reports, selectedSite])

  const { support, resistance } = useMemo(() => {
    if (trendData.length < 5) return { support: null, resistance: null }
    const vals = trendData.map(d => d['ยอดขาย']).sort((a, b) => a - b)
    const p25 = vals[Math.floor(vals.length * 0.25)]
    const p75 = vals[Math.floor(vals.length * 0.75)]
    return { support: p25, resistance: p75 }
  }, [trendData])

  // remap หมวดผ่าน alias (รองรับ chain เช่น A→B→C) กัน loop ด้วยลิมิตรอบ
  const resolveType = (t: string) => {
    let cur = t
    for (let i = 0; i < 10 && categoryAliases[cur] && categoryAliases[cur] !== cur; i++) cur = categoryAliases[cur]
    return cur
  }

  /**
   * สินค้าขายดี
   * เลือกสาขา + มีไฟล์ Transaction Details ของวันนั้น → ใช้ยอดจริงของสาขานั้น
   * ไม่งั้นใช้ยอดรวมทุกสาขาจากไฟล์สรุปเหมือนเดิม (ไฟล์นั้นไม่ได้แยกสาขาให้)
   */
  const goodsFromTx = useMemo(() => {
    if (selectedSite === 'ทั้งหมด') return null
    const usable = filteredReports.filter(r => txDays[r.date]?.sites[selectedSite])
    if (!usable.length) return null
    const map = new Map<string, { name: string; type: string; volume: number; amount: number }>()
    usable.forEach(r => {
      txDays[r.date].sites[selectedSite].g.forEach(g => {
        const key = baseGoodsName(g.n)
        const ex = map.get(key)
        if (ex) { ex.volume += g.v; ex.amount += g.a }
        else map.set(key, { name: key, type: '', volume: g.v, amount: g.a })
      })
    })
    // ประเภทสินค้าเอาจากไฟล์สรุป (Transaction Details ไม่มีคอลัมน์ประเภท)
    const typeByName = new Map<string, string>()
    filteredReports.forEach(r => r.goods.forEach(g =>
      typeByName.set(baseGoodsName(g.goodsName), resolveType(g.goodsType))))
    const list = [...map.values()].map(x => ({ ...x, type: typeByName.get(x.name) ?? '' }))
    return {
      list: list.sort((a, b) => b.amount - a.amount),
      coveredDays: usable.length,
      totalDays: filteredReports.length,
    }
  }, [selectedSite, filteredReports, txDays, categoryAliases])

  const goodsData = useMemo(() => {
    if (goodsFromTx) return goodsFromTx.list
    const map = new Map<string, { name: string; type: string; volume: number; amount: number }>()
    filteredReports.forEach(r => {
      r.goods.forEach(g => {
        // [Promotion] X กับ X เป็นสินค้าตัวเดียวกัน → รวมยอดเข้าด้วยกัน
        const key = baseGoodsName(g.goodsName)
        const ex = map.get(key)
        if (ex) { ex.volume += g.salesVolume; ex.amount += g.salesAmount }
        else map.set(key, { name: key, type: resolveType(g.goodsType), volume: g.salesVolume, amount: g.salesAmount })
      })
    })
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount)
  }, [goodsFromTx, filteredReports, categoryAliases])

  // กำไรรายสินค้า → ใช้ในโหมด "กำไร" ของรายการสินค้าขายดี
  const profitByGoods = useMemo(
    () => new Map((profit?.items ?? []).map(it => [it.name, it])),
    [profit],
  )

  // ค้นหา + กรองหมวด สำหรับรายการสินค้าขายดี (สินค้าเยอะแล้วเลื่อนหายาก)
  const goodsTypes = useMemo(() => {
    // หมวดหลักขึ้นก่อนตามลำดับนี้ ที่เหลือเรียง ก-ฮ/A-Z ต่อท้าย
    const PINNED = ['One Piece', 'Pokemon', 'Lorcana', 'Naruto']
    const rank = (t: string) => {
      const i = PINNED.findIndex(p => p.toLowerCase() === t.toLowerCase())
      return i === -1 ? PINNED.length : i
    }
    return Array.from(new Set(goodsData.map(g => g.type).filter(Boolean)))
      .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, 'th'))
  }, [goodsData])
  const visibleGoods = useMemo(() => {
    const q = goodsSearch.trim().toLowerCase()
    const list = goodsData.filter(g => {
      if (goodsCat !== 'ทั้งหมด' && g.type !== goodsCat) return false
      if (!q) return true
      // ค้นแบบแยกคำ — พิมพ์ "op 15" เจอ "One Piece OP-15" ได้
      return q.split(/\s+/).every(w => g.name.toLowerCase().includes(w))
    })
    if (goodsMetric === 'amount') return list
    // โหมดกำไร — ตัวที่ยังไม่รู้ต้นทุนไปอยู่ท้ายสุด
    return [...list].sort((a, b) => {
      const pa = profitByGoods.get(a.name)?.profit
      const pb = profitByGoods.get(b.name)?.profit
      if (pa == null && pb == null) return b.amount - a.amount
      if (pa == null) return 1
      if (pb == null) return -1
      return pb - pa
    })
  }, [goodsData, goodsSearch, goodsCat, goodsMetric, profitByGoods])

  const goodsTypeData = useMemo(() => {
    const map = new Map<string, { name: string; value: number }>()
    filteredReports.forEach(r => {
      r.goods.forEach(g => {
        const type = resolveType(g.goodsType)
        const ex = map.get(type)
        if (ex) ex.value += g.salesVolume
        else map.set(type, { name: type, value: g.salesVolume })
      })
    })
    return Array.from(map.values()).sort((a, b) => b.value - a.value)
  }, [filteredReports, categoryAliases])

  const sitesData = useMemo(() => {
    const map = new Map<string, { name: string; amount: number; volume: number }>()
    filteredReports.forEach(r => {
      r.sites.forEach(s => {
        const ex = map.get(s.name)
        if (ex) { ex.amount += s.salesAmount; ex.volume += s.salesVolume }
        else map.set(s.name, { name: s.name, amount: s.salesAmount, volume: s.salesVolume })
      })
    })
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount)
  }, [filteredReports])

  // Shared calendar popup JSX
  const calendarPopup = showCalendar && (
    <>
      <div className="fixed inset-0 z-40" onClick={() => setShowCalendar(false)} />
    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-brand-blue/15 rounded-2xl shadow-lg shadow-brand-blue/10 p-3">
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => shiftCalMonth(-1)} className="w-8 h-8 rounded-full hover:bg-brand-pale flex items-center justify-center transition-colors">
          <ChevronLeft size={14} className="text-brand-blue" />
        </button>
        <p className="text-brand-dark font-medium text-[13px]">{THAI_MONTHS[calMonthNum - 1]} {calYear + 543}</p>
        <button onClick={() => shiftCalMonth(1)} className="w-8 h-8 rounded-full hover:bg-brand-pale flex items-center justify-center transition-colors">
          <ChevronRight size={14} className="text-brand-blue" />
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {THAI_DAYS.map(d => <div key={d} className="text-center text-[10px] text-brand-dark/30 py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {Array.from({ length: calFirstDay }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: calDaysInMonth }, (_, i) => i + 1).map(day => {
          const dateStr = `${calYear}-${String(calMonthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const hasData = availableDates.has(dateStr)
          const isSelected = selectedReport?.date === dateStr
          return (
            <button key={day}
              onClick={() => {
                if (!hasData) return
                const idx = reports.findIndex(r => r.date === dateStr)
                if (idx >= 0) { setSelectedDateIdx(idx); setShowCalendar(false) }
              }}
              className={`h-9 w-full rounded-lg text-[12px] font-medium transition-all ${
                isSelected ? 'bg-brand-blue text-white'
                : hasData ? 'text-brand-dark hover:bg-brand-pale font-semibold'
                : 'text-brand-dark/20 cursor-default select-none'
              }`}
            >{day}</button>
          )
        })}
      </div>
    </div>
    </>
  )

  if (reports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-brand-pale/60 flex items-center justify-center mb-4">
          <TrendingUp size={28} className="text-brand-dark/30" />
        </div>
        <p className="text-brand-dark/50 text-[15px] font-medium">ยังไม่มีข้อมูล</p>
        <p className="text-brand-dark/30 text-[13px] mt-1">ไปที่แท็บ "จัดการไฟล์" เพื่ออัปโหลด MultiReport</p>
      </div>
    )
  }

  return (
    <div className="pb-10 md:pb-12">

      {/* ── Controls row ─────────────────────────────── */}
      <div className="px-4 md:px-6 pt-4 pb-3 flex flex-col md:flex-row md:items-center gap-3">
        {/* Range selector */}
        <div className="md:w-72 flex-shrink-0">
          <div className="flex bg-brand-pale/60 rounded-xl p-1 gap-1">
            {([['day','วันที่เลือก'],['week','7 วัน'],['month','30 วัน'],['all','ทั้งหมด']] as [RangeMode,string][]).map(([k, label]) => (
              <button key={k} onClick={() => setRangeMode(k)}
                className={`flex-1 text-[12px] font-medium py-2.5 rounded-lg transition-all ${
                  rangeMode === k ? 'bg-brand-blue text-white' : 'text-brand-dark/50 hover:text-brand-dark'
                }`}>{label}</button>
            ))}
          </div>
        </div>

        {/* Day navigator */}
        {rangeMode === 'day' && (
          <div ref={calendarRef} className="relative flex-1 md:flex-none">
            <div className="flex items-center gap-1 bg-brand-pale/60 rounded-xl p-1">
              <button onClick={() => setSelectedDateIdx(i => Math.max(0, i - 1))} disabled={currentIdx === 0}
                className="w-10 h-10 rounded-lg bg-white/70 flex items-center justify-center disabled:opacity-30 hover:bg-white transition-colors flex-shrink-0 shadow-sm">
                <ChevronLeft size={16} className="text-brand-blue" />
              </button>
              <button className="flex-1 md:w-56 text-center py-2 px-3 rounded-lg hover:bg-white/70 transition-colors"
                onClick={() => setShowCalendar(v => !v)}>
                <p key={currentIdx} className="text-brand-dark font-medium text-[14px] whitespace-nowrap animate-pop-in">
                  {selectedReport ? formatThaiDateFull(selectedReport.date) : '-'}
                </p>
              </button>
              <button onClick={() => setSelectedDateIdx(i => Math.min(reports.length - 1, i + 1))} disabled={currentIdx === reports.length - 1}
                className="w-10 h-10 rounded-lg bg-white/70 flex items-center justify-center disabled:opacity-30 hover:bg-white transition-colors flex-shrink-0 shadow-sm">
                <ChevronRight size={16} className="text-brand-blue" />
              </button>
            </div>
            {calendarPopup}
          </div>
        )}

        {rangeMode !== 'day' && (
          <p className="text-brand-dark/40 text-[12px]">
            {filteredReports.length} วัน · {filteredReports[0] ? formatThaiDate(filteredReports[0].date) : ''} – {filteredReports[filteredReports.length-1] ? formatThaiDate(filteredReports[filteredReports.length-1].date) : ''}
          </p>
        )}

        {/* Sync status badge */}
        {syncStatus === 'syncing' && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100">
            <svg className="animate-spin w-3 h-3 text-brand-blue flex-shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            <span className="text-[11px] text-brand-blue font-medium whitespace-nowrap">กำลังดึงข้อมูล...</span>
          </div>
        )}
        {syncStatus === 'success' && lastSynced && (
          <div className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-blue/10 border border-brand-blue/20">
            <svg className="w-3 h-3 text-brand-blue flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
            </svg>
            <span className="text-[11px] text-brand-blue font-medium whitespace-nowrap">ข้อมูลล่าสุด {lastSynced}</span>
            {showLuffyGood && (
              <img
                src="/pic/luffyGood.gif"
                alt="luffy good"
                className="absolute -top-10 right-0 w-12 h-12 object-contain pointer-events-none"
                style={{ animation: 'luffyPop 2.5s ease forwards' }}
              />
            )}
          </div>
        )}

      </div>

      {/* ── Stat cards: 2 cols mobile → 4 cols desktop ─ */}
      <div className="px-4 md:px-6 grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard label="ยอดขายรวม" value={`฿${formatBaht(stats.totalAmount)}`} sub={activeBranch !== 'ทั้งหมด' ? activeBranch : `${filteredReports.length} วัน`} sub2={cumulativeTotal != null ? `สะสม ณ วันนี้ ฿${formatBaht(cumulativeTotal)}` : undefined} accent icon={<TrendingUp size={12} />} delay={0} animKey={currentIdx}
          valueSuffix={profit && (
            <>กำไร <b className="font-semibold text-white/90">฿{formatBaht(Math.round(profit.total))}</b> · {profit.marginPct.toFixed(1)}%</>
          )}
          side={monthGoal && (
            <MonthlyGoalTube
              earned={monthGoal.earned}
              goal={monthlyProfitGoal}
              monthLabel={monthGoal.monthLabel}
              daysLeft={monthGoal.daysLeft}
              onEditGoal={onSetMonthlyGoal}
            />
          )} />
        <StatCard label="จำนวนชิ้น" value={`${stats.totalVolume.toLocaleString()}`} sub={`เฉลี่ย ฿${formatBaht(stats.avgPerPiece)}/ชิ้น`} icon={<Package size={12} />} delay={50} animKey={currentIdx} />

        {/* Luffy — 7-day comparison card */}
        {weekStats && (() => {
          const good = weekStats.diff >= 0
          return (
            <div
              className={`col-span-2 rounded-2xl overflow-hidden flex items-stretch border ${
                good ? 'bg-gradient-to-br from-blue-50 to-sky-50 border-blue-200'
                      : 'bg-gradient-to-br from-slate-50 to-blue-50 border-slate-200'
              }`}
              style={{ animation: 'fadeUp 0.4s ease both', animationDelay: '100ms', minHeight: '96px' }}
            >
              <div className="flex-1 px-4 py-3 flex flex-col justify-center gap-0.5 z-10">
                <p className={`text-[11px] font-bold uppercase tracking-wide ${good ? 'text-blue-600' : 'text-slate-500'}`}>
                  ⚔️ สัปดาห์นี้ {good ? 'ชนะ' : 'แพ้'} สัปดาห์ก่อน
                </p>
                <p className={`text-[22px] font-bold leading-tight ${good ? 'text-blue-700' : 'text-slate-600'}`}>
                  {good ? '+' : '-'}฿{formatBaht(Math.abs(weekStats.diff))}
                </p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-[11px] text-brand-dark/50">สัปดาห์นี้ ฿{formatBaht(weekStats.thisAmt)}</span>
                  <span className="text-[11px] text-brand-dark/30">ก่อน ฿{formatBaht(weekStats.prevAmt)}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-[11px] font-medium ${good ? 'text-blue-500' : 'text-slate-400'}`}>
                    {weekStats.pct !== null ? `${good ? '▲' : '▼'} ${weekStats.pct}%` : '✨ ใหม่'}
                  </span>
                  <span className="text-[11px] text-brand-dark/30">· วันสูงสุด {formatThaiDate(weekStats.bestDate)}</span>
                </div>
              </div>
              <div className="relative w-28 flex-shrink-0 self-stretch">
                <img src="/pic/luffy.png" alt="luffy"
                  className="absolute bottom-0 right-0 h-full w-full object-contain object-bottom" />
              </div>
            </div>
          )
        })()}

        {/* Naruto — 30-day comparison card */}
        {monthStats && (() => {
          const good = monthStats.diff >= 0
          return (
            <div
              className={`col-span-2 rounded-2xl overflow-hidden flex items-stretch border ${
                good ? 'bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200'
                      : 'bg-gradient-to-br from-stone-50 to-orange-50 border-stone-200'
              }`}
              style={{ animation: 'fadeUp 0.4s ease both', animationDelay: '100ms', minHeight: '96px' }}
            >
              <div className="flex-1 px-4 py-3 flex flex-col justify-center gap-0.5 z-10">
                <p className={`text-[11px] font-bold uppercase tracking-wide ${good ? 'text-orange-600' : 'text-stone-500'}`}>
                  🍥 30 วันนี้ {good ? 'ดีกว่า' : 'น้อยกว่า'} 30 วันก่อน
                </p>
                <p className={`text-[22px] font-bold leading-tight ${good ? 'text-orange-700' : 'text-stone-600'}`}>
                  {good ? '+' : '-'}฿{formatBaht(Math.abs(monthStats.diff))}
                </p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-[11px] text-brand-dark/50">เฉลี่ย ฿{formatBaht(monthStats.avgDay)}/วัน</span>
                  <span className="text-[11px] text-brand-dark/30">ชนะ {monthStats.wins}/{monthStats.days - 1} วัน</span>
                </div>
                <span className={`text-[11px] font-medium mt-0.5 ${good ? 'text-orange-500' : 'text-stone-400'}`}>
                  {monthStats.pct !== null ? `${good ? '▲' : '▼'} ${monthStats.pct}%` : '✨ ใหม่'}
                </span>
              </div>
              <div className="relative w-28 flex-shrink-0 self-stretch">
                <img src={good ? '/pic/naruto.png' : '/pic/sasuke.png'} alt={good ? 'naruto' : 'sasuke'}
                  className="absolute bottom-0 right-0 h-full w-full object-contain object-bottom" />
              </div>
            </div>
          )
        })()}

        {/* Pikachu all-time stats card (all mode) */}
        {allTimeStats ? (
          <div
            className="col-span-2 rounded-2xl overflow-hidden flex items-stretch border border-yellow-300 bg-gradient-to-br from-yellow-50 to-amber-50"
            style={{ animation: 'fadeUp 0.4s ease both', animationDelay: '100ms', minHeight: '96px' }}
          >
            <div className="flex-1 px-4 py-3 flex flex-col justify-center gap-1 z-10">
              {/* best day */}
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wide">🏆 สถิติสูงสุด</span>
                <span className="text-[11px] text-brand-dark/40">{formatThaiDate(allTimeStats.best.date)}</span>
              </div>
              <p className="text-[22px] font-bold text-amber-600 leading-tight">
                ฿{formatBaht(allTimeStats.best.amount)}
              </p>
              {/* win rate + streak */}
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-[11px] text-brand-dark/50">
                  ชนะ {allTimeStats.winsTotal}/{allTimeStats.total} วัน
                </span>
                {allTimeStats.streak > 0 && (
                  <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${
                    allTimeStats.streak >= 3
                      ? 'bg-amber-400 text-white'
                      : 'bg-amber-100 text-amber-600'
                  }`}>
                    🔥 streak {allTimeStats.streak} วัน
                  </span>
                )}
              </div>
            </div>
            {/* luffy */}
            <div className="relative w-28 flex-shrink-0 self-stretch">
              <img
                src="/pic/luffynigga.gif"
                alt="luffy"
                className="absolute bottom-0 right-0 h-full w-full object-contain object-bottom"
              />
            </div>
          </div>
        ) : vsYesterday ? (() => {
          const good = vsYesterday.diff >= 0
          return (
            <div
              className={`col-span-2 rounded-2xl overflow-hidden flex items-stretch relative border transition-all duration-500 ${
                good ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
              }`}
              style={{ animation: 'fadeUp 0.4s ease both', animationDelay: '100ms', minHeight: '96px' }}
            >
              <div className="flex-1 px-4 py-3 flex flex-col justify-center gap-0.5 z-10">
                <p className={`text-[11px] font-semibold uppercase tracking-wide ${good ? 'text-emerald-600' : 'text-red-500'}`}>
                  {good ? 'ยอดดีกว่าวันก่อน' : 'ยอดน้อยกว่าวันก่อน'}
                </p>
                <p className={`text-[22px] font-bold leading-tight ${good ? 'text-emerald-700' : 'text-red-600'}`}>
                  {good ? '+' : '-'}฿{formatBaht(Math.abs(vsYesterday.diff))}
                </p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-[11px] text-brand-dark/50">
                    {formatThaiDate(vsYesterday.todayDate)} ฿{formatBaht(vsYesterday.todayAmt)}
                  </span>
                  <span className="text-[11px] text-brand-dark/30">
                    {formatThaiDate(vsYesterday.yestDate)} ฿{formatBaht(vsYesterday.yestAmt)}
                  </span>
                </div>
                <p className={`text-[11px] font-medium mt-0.5 ${good ? 'text-emerald-500' : 'text-red-400'}`}>
                  {good ? '▲' : '▼'} {vsYesterday.pct}%
                </p>
              </div>
              <div className="relative w-28 flex-shrink-0 self-stretch">
                <img
                  src={good ? '/pic/goodnami.jpeg' : '/pic/badnami.png'}
                  alt={good ? 'goodnami' : 'badnami'}
                  className="absolute bottom-0 right-0 h-full w-full object-contain object-bottom"
                />
              </div>
            </div>
          )
        })() : (
          rangeMode === 'day' ? (
            <div className="col-span-2 rounded-2xl bg-brand-pale/40 border border-brand-blue/10 flex items-center justify-center px-4 py-3" style={{ minHeight: '96px' }}>
              <p className="text-[12px] text-brand-dark/30">ต้องมีข้อมูลอย่างน้อย 2 วันเพื่อเปรียบเทียบ</p>
            </div>
          ) : null
        )}
      </div>

      {/* ── Main content: stacked mobile → 2-col desktop ─ */}
      <div className="md:px-6 md:grid md:grid-cols-3 md:gap-5 md:items-start">

        {/* Left column (2/3) */}
        <div className="md:col-span-2 space-y-4">

          {/* Trend chart */}
          {reports.length > 1 && (
            <div className="px-4 md:px-0">
              <div className="bg-white border border-brand-blue/10 rounded-2xl p-4 card-hover">
                <p className="text-brand-dark/60 text-[12px] font-medium mb-3">ยอดขายรายวัน</p>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={trendData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1a52b3" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#1a52b3" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(26,82,179,0.08)" />
                    <XAxis dataKey="date" tick={{ fill: 'rgba(13,27,62,0.4)', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: 'rgba(13,27,62,0.4)', fontSize: 10 }} tickLine={false} axisLine={false}
                      tickFormatter={v => v >= 1000 ? `${Math.round(v/1000)}K` : String(v)} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="ยอดขาย" stroke="#1a52b3" strokeWidth={2} fill="url(#grad1)" />
                    {support != null && (
                      <ReferenceLine y={support} stroke="#10b981" strokeDasharray="5 3" strokeWidth={1.5}
                        label={{ value: `แนวรับ ฿${formatBaht(support)}`, position: 'insideTopLeft', fontSize: 9, fill: '#10b981', dy: 4 }} />
                    )}
                    {resistance != null && (
                      <ReferenceLine y={resistance} stroke="#f59e0b" strokeDasharray="5 3" strokeWidth={1.5}
                        label={{ value: `แนวต้าน ฿${formatBaht(resistance)}`, position: 'insideTopLeft', fontSize: 9, fill: '#f59e0b', dy: 4 }} />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Goods ranking */}
          {goodsData.length > 0 && (
            <div className="px-4 md:px-0">
              <div className="bg-white border border-brand-blue/10 rounded-2xl p-4 card-hover">
                {selectedSite !== 'ทั้งหมด' && (
                  goodsFromTx ? (
                    <div className="flex items-start gap-1.5 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5 mb-3">
                      <span className="flex-shrink-0">✅</span>
                      <span>
                        ยอดสินค้าของ<strong>สาขานี้จริงๆ</strong> จากไฟล์ Transaction Details
                        {goodsFromTx.coveredDays < goodsFromTx.totalDays && (
                          <> — มีข้อมูลแยกสาขา {goodsFromTx.coveredDays} จาก {goodsFromTx.totalDays} วันในช่วงนี้</>
                        )}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-start gap-1.5 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 mb-3">
                      <span className="flex-shrink-0">⚠️</span>
                      <span>นับเฉพาะวันที่สาขานี้มีข้อมูล แต่ยอดสินค้าในแต่ละวันเป็น<strong>ยอดรวมทุกสาขา</strong> — อัปโหลดไฟล์ <strong>Transaction Details</strong> ของวันนั้นเพื่อแยกตามสาขา</span>
                    </div>
                  )
                )}
                <div className="flex items-center justify-between mb-3">
                  <p className="text-brand-dark/60 text-[12px] font-medium">
                    สินค้าขายดี
                    {visibleGoods.length !== goodsData.length && (
                      <span className="ml-1.5 text-[11px] text-brand-dark/35">{visibleGoods.length}/{goodsData.length}</span>
                    )}
                  </p>
                  {profit && (
                    <div className="flex bg-brand-pale rounded-lg p-0.5 gap-0.5">
                      {([['amount', 'ยอดขาย'], ['profit', 'กำไร']] as ['amount' | 'profit', string][]).map(([k, label]) => (
                        <button key={k} onClick={() => setGoodsMetric(k)}
                          className={`text-[11px] px-3 py-1 rounded-md transition-all ${
                            goodsMetric === k ? 'bg-brand-blue text-white' : 'text-brand-dark/50'
                          }`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* ค้นหา + กรองหมวด — สินค้าเยอะแล้วเลื่อนหายาก */}
                <div className="relative mb-2">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-dark/30 pointer-events-none" />
                  <input
                    value={goodsSearch}
                    onChange={e => setGoodsSearch(e.target.value)}
                    placeholder="ค้นหาสินค้า..."
                    className="w-full border border-brand-blue/15 rounded-xl pl-8 pr-8 py-2 text-[12px] outline-none focus:border-brand-blue"
                  />
                  {goodsSearch && (
                    <button onClick={() => setGoodsSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-brand-pale flex items-center justify-center text-brand-dark/40 hover:text-brand-dark">
                      <X size={11} />
                    </button>
                  )}
                </div>
                {goodsTypes.length > 1 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {['ทั้งหมด', ...goodsTypes].map((c, idx) => {
                      const logo = categoryLogo(c)
                      const active = goodsCat === c
                      return (
                        <button key={c} onClick={() => setGoodsCat(c)} title={c}
                          style={{ animationDelay: `${Math.min(idx, 10) * 40}ms` }}
                          className={`h-7 px-2.5 rounded-full text-[11px] font-medium border flex items-center animate-pop-in transition-all duration-200 active:scale-90 hover:-translate-y-0.5 ${
                            active
                              ? 'bg-brand-pale border-brand-blue ring-1 ring-brand-blue/40 text-brand-dark'
                              : 'bg-white text-brand-dark/50 border-brand-blue/15 hover:border-brand-blue/40'
                          }`}
                        >
                          {logo
                            ? <img src={logo} alt={c} className={`h-4 w-auto max-w-[54px] object-contain transition-opacity ${active ? '' : 'opacity-55'}`} />
                            : c}
                        </button>
                      )
                    })}
                  </div>
                )}

                {visibleGoods.length === 0 && (
                  <p className="text-[12px] text-brand-dark/35 text-center py-6">ไม่พบสินค้าที่ค้นหา</p>
                )}

                <div className="space-y-0.5 md:max-h-[26rem] md:overflow-y-auto md:pr-1">
                  {visibleGoods.map((g, i) => {
                    const gp = profitByGoods.get(g.name)
                    const val = goodsMetric === 'amount' ? g.amount : gp?.profit
                    const topVal = goodsMetric === 'amount'
                      ? visibleGoods[0]?.amount
                      : profitByGoods.get(visibleGoods[0]?.name ?? '')?.profit
                    const pct = topVal && val != null && val > 0 ? (val / topVal) * 100 : 0
                    return (
                      <button key={g.name} type="button" onClick={() => setGoodsDetail(g.name)}
                        className="w-full text-left flex items-center gap-2 rounded-xl px-2 py-1.5 -mx-2 hover:bg-brand-pale/50 active:scale-[0.995] transition-all">
                        {RANK_STYLES[i] ? (
                          <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold tabular-nums flex-shrink-0 text-white"
                            style={{ backgroundColor: RANK_STYLES[i].bg }}>
                            {i + 1}
                          </span>
                        ) : (
                          <span className="w-5 text-center text-[11px] font-semibold tabular-nums flex-shrink-0 text-brand-dark/30">
                            {i + 1}
                          </span>
                        )}
                        <GoodsThumb name={g.name} delay={Math.min(i, 12) * 35} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-2 mb-1.5">
                            <p className="text-brand-dark text-[12px] font-medium truncate leading-snug">{g.name}</p>
                            <p className={`text-[12px] font-semibold tabular-nums flex-shrink-0 ${
                              goodsMetric === 'profit'
                                ? val == null ? 'text-brand-dark/25' : val >= 0 ? 'text-emerald-600' : 'text-red-500'
                                : 'text-brand-dark'
                            }`}>
                              {val == null ? 'ยังไม่รู้ต้นทุน' : `฿${formatBaht(Math.round(val))}`}
                            </p>
                          </div>
                          <div className="relative h-4 bg-brand-pale rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%`, backgroundColor: RANK_STYLES[i]?.bg ?? '#1a52b3', opacity: i >= 3 ? 0.45 : 1 }} />
                            {/* จำนวนชิ้น — วางในหลอดถ้ายาวพอ ไม่งั้นวางนอกหลอด */}
                            <span
                              className={`absolute inset-y-0 flex items-center text-[10px] font-semibold tabular-nums leading-none ${
                                pct >= 22 ? 'text-white/95 justify-end pr-1.5' : 'text-brand-dark/45 pl-1.5'
                              }`}
                              style={pct >= 22 ? { left: 0, width: `${pct}%` } : { left: `${pct}%` }}
                            >
                              {g.volume} ชิ้น
                              {goodsMetric === 'profit' && ` · ฿${formatBaht(g.amount)}`}
                            </span>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right column (1/3) */}
        <div className="space-y-4 mt-4 md:mt-0">

          {/* Goods by type pie chart */}
          {goodsTypeData.length > 0 && (() => {
            const total = goodsTypeData.reduce((s, x) => s + x.value, 0)
            return (
              <div className="px-4 md:px-0">
                <div className="bg-white border border-brand-blue/10 rounded-2xl p-4 card-hover">
                  <p className="text-brand-dark/60 text-[12px] font-medium mb-2">
                    สินค้าตามประเภท
                    {selectedSite !== 'ทั้งหมด' && (
                      <span className={`ml-1.5 text-[10px] font-normal px-1.5 py-0.5 rounded-full border ${
                        goodsFromTx
                          ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
                          : 'text-amber-600 bg-amber-50 border-amber-200'
                      }`}>{goodsFromTx ? 'เฉพาะสาขานี้' : 'รวมทุกสาขา'}</span>
                    )}
                  </p>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={goodsTypeData}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        dataKey="value"
                        stroke="#fff"
                        strokeWidth={2}
                        activeIndex={activePieIndex}
                        activeShape={(props: any) => {
                          const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props
                          return <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 10} startAngle={startAngle} endAngle={endAngle} fill={fill} />
                        }}
                        onMouseEnter={(_, i) => setActivePieIndex(i)}
                        onMouseLeave={() => setActivePieIndex(undefined)}
                      >
                        {goodsTypeData.map((_, i) => (
                          <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number, name: string) => [
                          `${value} ชิ้น (${total > 0 ? (value / total * 100).toFixed(2) : 0}%)`,
                          name,
                        ]}
                        contentStyle={{
                          borderRadius: '12px',
                          border: '1px solid rgba(26,82,179,0.12)',
                          fontSize: '12px',
                          boxShadow: '0 4px 16px rgba(26,82,179,0.1)',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-3 space-y-2">
                    {goodsTypeData.map((d, i) => (
                      <div key={d.name} className="flex items-center justify-between row-hover px-2 py-1 -mx-2">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: TYPE_COLORS[i % TYPE_COLORS.length] }} />
                          <span className="text-brand-dark/70 text-[12px]">{d.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-brand-dark/30 text-[11px]">{total > 0 ? (d.value / total * 100).toFixed(1) : 0}%</span>
                          <span className="text-brand-dark font-medium text-[12px] w-14 text-right">{d.value} ชิ้น</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Sites */}
          {sitesData.length > 0 && (
            <div className="px-4 md:px-0">
              <div className="bg-white border border-brand-blue/10 rounded-2xl p-4 card-hover">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-brand-dark/60 text-[12px] font-medium">ยอดขายตามสาขา</p>
                  {activeBranch !== 'ทั้งหมด' && (
                    <button onClick={() => setActiveBranch('ทั้งหมด')}
                      className="flex items-center gap-1 text-[11px] text-brand-blue bg-brand-pale px-2 py-0.5 rounded-full hover:bg-brand-blue hover:text-white transition-colors">
                      <MapPin size={10} /> {activeBranch} ×
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  {sitesData.map(s => {
                    const pct = sitesData[0].amount > 0 ? (s.amount / sitesData[0].amount) * 100 : 0
                    const isSelected = activeBranch === s.name
                    return (
                      <button key={s.name} onClick={() => setActiveBranch(isSelected ? 'ทั้งหมด' : s.name)}
                        className={`w-full text-left px-2 py-1.5 -mx-2 rounded-xl transition-all ${isSelected ? 'bg-brand-blue/8' : 'hover:bg-brand-pale/60'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <p className={`text-[13px] font-medium flex items-center gap-1.5 ${isSelected ? 'text-brand-blue' : 'text-brand-dark'}`}>
                            {isSelected && <MapPin size={11} className="text-brand-blue" />}
                            {s.name}
                          </p>
                          <p className="text-brand-dark/70 text-[12px]">฿{formatBaht(s.amount)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-brand-pale rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: '#10b981' }} />
                          </div>
                          <span className="text-brand-dark/40 text-[11px] w-10 text-right">{s.volume} ชิ้น</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ป้ายลอยบอกว่ากำลังดูสาขาไหน + กดสลับสาขาได้เลย */}
      {selectedSite !== 'ทั้งหมด' && createPortal(
        <BranchSwitcherPill
          selected={selectedSite}
          options={branchOptions}
          onSelect={setActiveBranch}
        />,
        document.body,
      )}

      {goodsDetail && (
        <GoodsDetailModal
          name={goodsDetail}
          reports={reports}
          onClose={() => setGoodsDetail(null)}
        />
      )}
    </div>
  )
}
