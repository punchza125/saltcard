import { useState, useMemo, useRef, useEffect } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Sector, ReferenceLine
} from 'recharts'
import { ChevronLeft, ChevronRight, TrendingUp, Package, MapPin } from 'lucide-react'
import type { DayReport, StockProduct } from '../types'
import { formatThaiDate, formatThaiDateFull, formatBaht } from '../utils/parser'
import StatCard from './StatCard'

interface DashboardPageProps {
  reports: DayReport[]
  stockProducts?: StockProduct[]
  taxRate?: number
  activeBranch: string       // which branch is selected (for display only — reports are pre-filtered)
  setActiveBranch: (s: string) => void
  syncStatus?: 'idle' | 'syncing' | 'success' | 'error'
  lastSynced?: string
  categoryAliases?: Record<string, string>  // ย้าย/รวมหมวด → remap ยอดขายในกราฟ
}

function calcDayProfit(report: DayReport, products: StockProduct[], taxRate: number) {
  let totalRevenue = 0
  let totalCost = 0
  let matchedItems = 0
  for (const goods of report.goods) {
    const lowerName = goods.goodsName.toLowerCase()
    const isBox = lowerName.includes('(box)') || lowerName.endsWith(' box')
    for (const product of products) {
      if (!product.goodsKeyword || !product.buyPricePerBox || product.packsPerBox <= 0) continue
      if (!lowerName.includes(product.goodsKeyword.toLowerCase())) continue
      const costPerPack = product.buyPricePerBox / product.packsPerBox
      const packsSold = isBox ? goods.salesVolume * product.packsPerBox : goods.salesVolume
      totalRevenue += goods.salesAmount
      totalCost += packsSold * costPerPack
      matchedItems++
      break
    }
  }
  if (matchedItems === 0) return null
  const grossProfit = totalRevenue - totalCost
  const netProfit = totalRevenue * (1 - taxRate / 100) - totalCost
  const profitPct = totalCost > 0 ? (netProfit / totalCost) * 100 : 0
  return { totalRevenue, totalCost, grossProfit, netProfit, profitPct, matchedItems }
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

export default function DashboardPage({ reports, stockProducts = [], taxRate = 15, activeBranch, setActiveBranch, syncStatus, lastSynced, categoryAliases = {} }: DashboardPageProps) {
  // กรองตามสาขาที่เลือก — 'ทั้งหมด' รวมทุกสาขา (ใช้ area total), ไม่งั้นดึงเฉพาะ site ที่ตรงชื่อ
  const selectedSite = activeBranch || 'ทั้งหมด'
  const [rangeMode, setRangeMode] = useState<RangeMode>('day')
  const [selectedDateIdx, setSelectedDateIdx] = useState<number>(reports.length - 1)
  const [activeGoodsTab, setActiveGoodsTab] = useState<'amount' | 'volume'>('amount')
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

  // Day profit — only for today (cannot know cost price for past days)
  const todayStr = new Date().toISOString().slice(0, 10)
  const isToday = selectedReport?.date === todayStr
  const dayProfit = useMemo(() => {
    if (rangeMode !== 'day' || !selectedReport || !isToday || stockProducts.length === 0) return null
    return calcDayProfit(selectedReport, stockProducts, taxRate)
  }, [rangeMode, selectedReport, isToday, stockProducts, taxRate])

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

  const goodsData = useMemo(() => {
    const map = new Map<string, { name: string; volume: number; amount: number }>()
    filteredReports.forEach(r => {
      r.goods.forEach(g => {
        const ex = map.get(g.goodsName)
        if (ex) { ex.volume += g.salesVolume; ex.amount += g.salesAmount }
        else map.set(g.goodsName, { name: g.goodsName, volume: g.salesVolume, amount: g.salesAmount })
      })
    })
    return Array.from(map.values()).sort((a, b) => activeGoodsTab === 'amount' ? b.amount - a.amount : b.volume - a.volume)
  }, [filteredReports, activeGoodsTab])

  // remap หมวดผ่าน alias (รองรับ chain เช่น A→B→C) กัน loop ด้วยลิมิตรอบ
  const resolveType = (t: string) => {
    let cur = t
    for (let i = 0; i < 10 && categoryAliases[cur] && categoryAliases[cur] !== cur; i++) cur = categoryAliases[cur]
    return cur
  }

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
        <StatCard label="ยอดขายรวม" value={`฿${formatBaht(stats.totalAmount)}`} sub={activeBranch !== 'ทั้งหมด' ? activeBranch : `${filteredReports.length} วัน`} sub2={cumulativeTotal != null ? `สะสม ณ วันนี้ ฿${formatBaht(cumulativeTotal)}` : undefined} accent icon={<TrendingUp size={12} />} delay={0} animKey={currentIdx} />
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

      {/* ── Day profit card (day mode only) ─────────────── */}
      {rangeMode === 'day' && selectedReport && (
        <div className="px-4 md:px-6 mb-5">
          {isToday && dayProfit ? (
            <div className="rounded-2xl overflow-hidden border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 px-4 py-3 flex flex-col gap-2"
              style={{ animation: 'fadeUp 0.4s ease both', animationDelay: '150ms' }}>
              <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-600">💰 กำไรสุทธิวันนี้</p>
              <div className="flex items-end gap-4 flex-wrap">
                <div>
                  <p className="text-[26px] font-bold leading-tight text-emerald-700">
                    ฿{formatBaht(dayProfit.netProfit)}
                  </p>
                  <p className="text-[11px] text-emerald-500 font-medium">
                    {dayProfit.profitPct >= 0 ? '▲' : '▼'} {Math.abs(dayProfit.profitPct).toFixed(1)}% ROI
                  </p>
                </div>
                <div className="flex gap-4 pb-0.5">
                  <div>
                    <p className="text-[10px] text-brand-dark/40 mb-0.5">รายได้สุทธิ (หักภาษี {taxRate}%)</p>
                    <p className="text-[13px] font-semibold text-brand-dark/70">฿{formatBaht(dayProfit.totalRevenue * (1 - taxRate / 100))}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-brand-dark/40 mb-0.5">ต้นทุน</p>
                    <p className="text-[13px] font-semibold text-brand-dark/70">฿{formatBaht(dayProfit.totalCost)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-brand-dark/40 mb-0.5">ยอดขายรวม</p>
                    <p className="text-[13px] font-semibold text-brand-dark/70">฿{formatBaht(dayProfit.totalRevenue)}</p>
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-brand-dark/30">คำนวณจาก {dayProfit.matchedItems} รายการที่ตรงกับสินค้าในสต๊อก</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-brand-blue/10 bg-brand-pale/30 px-4 py-3 text-center">
              <p className="text-[12px] text-brand-dark/30">ยังไม่มีข้อมูลราคากล่อง — ตั้งค่าราคาซื้อในหน้าสต๊อกเพื่อดูกำไร</p>
            </div>
          )}
        </div>
      )}

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
                <div className="flex items-center justify-between mb-3">
                  <p className="text-brand-dark/60 text-[12px] font-medium">สินค้าขายดี</p>
                  <div className="flex bg-brand-pale rounded-lg p-0.5 gap-0.5">
                    {([['amount','ยอด'],['volume','ชิ้น']] as ['amount'|'volume',string][]).map(([k, label]) => (
                      <button key={k} onClick={() => setActiveGoodsTab(k)}
                        className={`text-[11px] px-3 py-1 rounded-md transition-all ${activeGoodsTab === k ? 'bg-brand-blue text-white' : 'text-brand-dark/50'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-3 md:max-h-96 md:overflow-y-auto md:pr-1">
                  {goodsData.map((g, i) => {
                    const pct = goodsData[0] ? (activeGoodsTab === 'amount' ? g.amount / goodsData[0].amount : g.volume / goodsData[0].volume) * 100 : 0
                    return (
                      <div key={g.name} className="flex items-center gap-3 row-hover px-2 py-1 -mx-2">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                          style={RANK_STYLES[i]
                            ? { backgroundColor: RANK_STYLES[i].bg, color: RANK_STYLES[i].text }
                            : { backgroundColor: '#e8f0fc', color: 'rgba(13,27,62,0.5)' }}>
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-brand-dark text-[12px] font-medium truncate pr-2">{g.name}</p>
                            <p className="text-brand-dark/70 text-[12px] font-medium flex-shrink-0">
                              {activeGoodsTab === 'amount' ? `฿${formatBaht(g.amount)}` : `${g.volume} ชิ้น`}
                            </p>
                          </div>
                          <div className="h-1.5 bg-brand-pale rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%`, backgroundColor: RANK_STYLES[i]?.bg ?? '#1a52b3', opacity: i >= 3 ? 0.5 : 1 }} />
                          </div>
                        </div>
                      </div>
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
                  <p className="text-brand-dark/60 text-[12px] font-medium mb-2">สินค้าตามประเภท</p>
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
    </div>
  )
}
