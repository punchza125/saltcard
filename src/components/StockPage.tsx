import { useState, useMemo, useRef, useEffect } from 'react'
import {
  Plus, Pencil, Trash2, ArrowUp, ArrowDown,
  ChevronDown, ChevronUp, X, Check, RefreshCw, AlertTriangle, Upload, Cloud, CloudOff,
  Package2, BarChart2, Truck, Loader2,
} from 'lucide-react'
import type { StockProduct, StockUnit, DayReport, PurchaseOrder } from '../types'
import { useStockStore, type SyncPreviewItem, type InventorySnapshotItem } from '../hooks/useStockStore'
import { formatThaiDate, parseInventoryReport } from '../utils/parser'
import OrdersTab from './OrdersTab'
import { useOrderStore } from '../hooks/useOrderStore'


const CATEGORIES = ['One Piece', 'Dragon Ball', 'Naruto', 'Pokémon', 'อื่นๆ'] as const

const STATUS_STYLE = {
  empty:  { dot: 'bg-gray-400',    badge: 'bg-gray-100 text-gray-500 border-gray-300',              label: 'หมดแล้ว',     card: 'bg-gray-50 border-gray-200',    header: 'bg-gray-100/60' },
  red:    { dot: 'bg-red-500',     badge: 'bg-red-50 text-red-600 border-red-200',                  label: 'กำลังจะหมด', card: 'bg-red-50/40 border-red-200',   header: 'bg-red-50/60' },
  yellow: { dot: 'bg-yellow-400',  badge: 'bg-yellow-50 text-yellow-700 border-yellow-200',         label: 'ใกล้หมด',    card: 'bg-yellow-50/40 border-yellow-200', header: 'bg-yellow-50/60' },
  green:  { dot: 'bg-emerald-400', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',      label: 'ปกติ',        card: 'bg-white border-brand-blue/10', header: '' },
}

function formatQty(packs: number, packsPerBox: number): string {
  if (packsPerBox <= 0) return `${packs} Pack`
  const boxes = Math.floor(packs / packsPerBox)
  const rem   = packs % packsPerBox
  if (boxes === 0) return `${rem} Pack`
  if (rem === 0)   return `${boxes} Box`
  return `${boxes} Box ${rem} Pack`
}

// ── InventorySnapshotModal ────────────────────────────────────────────────────
function InventorySnapshotModal({
  items,
  date,
  unmatched,
  onConfirm,
  onClose,
}: {
  items: InventorySnapshotItem[]
  date: string
  unmatched: string[]
  onConfirm: () => void
  onClose: () => void
}) {
  const { stock } = useStockStore()

  if (items.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
          <p className="text-[14px] text-brand-dark/60 mb-2">ไม่พบสินค้าที่ match</p>
          <p className="text-[12px] text-brand-dark/40 mb-5">ตรวจสอบว่าตั้ง Keyword ในสินค้าให้ตรงกับชื่อใน Inventory แล้วหรือยัง</p>
          <button onClick={onClose} className="w-full py-2 rounded-lg bg-brand-pale text-brand-dark/60 text-[13px]">ปิด</button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-brand-dark text-[15px]">Inventory Snapshot</h3>
          <button onClick={onClose} className="text-brand-dark/40 hover:text-brand-dark"><X size={18} /></button>
        </div>
        <p className="text-[12px] text-brand-dark/50 mb-4">
          {formatThaiDate(date)} — สต๊อกจะถูก <strong>set ตรงๆ</strong> ตามค่าในตู้
        </p>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {/* header */}
          <div className="grid grid-cols-3 text-[10px] text-brand-dark/40 font-medium px-3 pb-1">
            <span>สินค้า</span>
            <span className="text-center">ก่อน</span>
            <span className="text-right">หลัง</span>
          </div>

          {items.map((item, i) => {
            const product = stock.products.find(p => p.id === item.productId)
            const ppb = product?.packsPerBox ?? 0
            const delta = item.newQty - item.currentQty
            return (
              <div key={i} className="grid grid-cols-3 items-center bg-brand-pale/40 rounded-lg px-3 py-2.5">
                <div className="min-w-0 pr-2">
                  <p className="text-[12px] font-medium text-brand-dark truncate">{item.productName}</p>
                  <p className="text-[10px] text-brand-dark/40 truncate">{item.goodsName}</p>
                </div>
                <div className="text-center">
                  <p className="text-[12px] text-brand-dark/50">
                    {ppb > 0 ? formatQty(item.currentQty, ppb) : `${item.currentQty} Pack`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[13px] font-semibold text-brand-dark">
                    {ppb > 0 ? formatQty(item.newQty, ppb) : `${item.newQty} Pack`}
                  </p>
                  <p className={`text-[10px] font-medium ${delta > 0 ? 'text-emerald-500' : delta < 0 ? 'text-red-500' : 'text-brand-dark/30'}`}>
                    {delta > 0 ? `+${delta}` : delta === 0 ? '=' : delta} Pack
                  </p>
                </div>
              </div>
            )
          })}

          {unmatched.length > 0 && (
            <div className="border border-yellow-200 bg-yellow-50 rounded-xl px-3 py-2.5 mt-2">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle size={12} className="text-yellow-500" />
                <p className="text-[11px] font-medium text-yellow-700">ไม่พบ keyword ที่ match ({unmatched.length} รายการ)</p>
              </div>
              {unmatched.slice(0, 5).map((name, i) => (
                <p key={i} className="text-[10px] text-yellow-600 truncate">{name}</p>
              ))}
              {unmatched.length > 5 && (
                <p className="text-[10px] text-yellow-500">และอีก {unmatched.length - 5} รายการ...</p>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-4 pt-4 border-t border-brand-blue/10">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-brand-blue/20 text-[13px] text-brand-dark/60">
            ยกเลิก
          </button>
          <button
            onClick={() => { onConfirm(); onClose() }}
            className="flex-1 py-2 rounded-lg bg-brand-blue text-white text-[13px] font-medium hover:bg-brand-light active:scale-95 transition-all flex items-center justify-center gap-1.5"
          >
            <Check size={14} /> อัปเดตสต๊อก
          </button>
        </div>
      </div>
    </div>
  )
}

// ── SyncModal ─────────────────────────────────────────────────────────────────
function SyncModal({
  preview,
  pendingDates,
  onConfirm,
  onClose,
}: {
  preview: SyncPreviewItem[]
  pendingDates: string[]
  onConfirm: () => void
  onClose: () => void
}) {
  const { stock } = useStockStore()

  // จัดกลุ่มตามวันที่
  const byDate = useMemo(() => {
    const map: Record<string, SyncPreviewItem[]> = {}
    for (const item of preview) {
      if (!map[item.date]) map[item.date] = []
      map[item.date].push(item)
    }
    return map
  }, [preview])

  // วันที่ไม่มีรายการ match
  const unmatchedDates = pendingDates.filter(d => !byDate[d])

  if (preview.length === 0 && unmatchedDates.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
          <p className="text-[14px] text-brand-dark/60 mb-4">ไม่พบรายการที่ match กับสินค้าในสต๊อก</p>
          <p className="text-[12px] text-brand-dark/40 mb-5">
            ตรวจสอบว่าตั้ง Keyword ในสินค้าให้ตรงกับชื่อใน Goods Aspect แล้วหรือยัง
          </p>
          <button onClick={onClose} className="w-full py-2 rounded-lg bg-brand-pale text-brand-dark/60 text-[13px]">
            ปิด
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-brand-dark text-[15px]">ซิงค์ยอดขายจากรายงาน</h3>
          <button onClick={onClose} className="text-brand-dark/40 hover:text-brand-dark"><X size={18} /></button>
        </div>
        <p className="text-[12px] text-brand-dark/50 mb-4">
          {pendingDates.length} วันที่รอซิงค์ — ระบบจะหักสต๊อกตามรายการด้านล่าง
        </p>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, items]) => (
            <div key={date}>
              <p className="text-[11px] font-semibold text-brand-blue/70 mb-1.5">{formatThaiDate(date)}</p>
              <div className="space-y-1">
                {items.map((item, i) => {
                  const product = stock.products.find(p => p.id === item.productId)
                  const ppb = product?.packsPerBox ?? 0
                  return (
                    <div key={i} className="flex items-center gap-2 bg-brand-pale/40 rounded-lg px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-brand-dark truncate">{item.productName}</p>
                        <p className="text-[10px] text-brand-dark/40 truncate">{item.goodsName}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[13px] font-semibold text-red-500">
                          −{ppb > 0 ? formatQty(Math.abs(item.packDelta), ppb) : `${Math.abs(item.packDelta)} Pack`}
                        </p>
                        <p className="text-[10px] text-brand-dark/30">
                          {item.isBox ? `${item.soldQty} Box` : `${item.soldQty} Pack`}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {unmatchedDates.length > 0 && (
            <div className="border border-yellow-200 bg-yellow-50 rounded-xl px-3 py-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle size={12} className="text-yellow-500" />
                <p className="text-[11px] font-medium text-yellow-700">ไม่พบสินค้าที่ match</p>
              </div>
              {unmatchedDates.map(d => (
                <p key={d} className="text-[11px] text-yellow-600">{formatThaiDate(d)}</p>
              ))}
              <p className="text-[10px] text-yellow-500 mt-1">วันเหล่านี้จะถูกทำเครื่องหมายว่า sync แล้วเช่นกัน</p>
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-4 pt-4 border-t border-brand-blue/10">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-brand-blue/20 text-[13px] text-brand-dark/60">
            ยกเลิก
          </button>
          <button
            onClick={() => { onConfirm(); onClose() }}
            className="flex-1 py-2 rounded-lg bg-brand-blue text-white text-[13px] font-medium hover:bg-brand-light active:scale-95 transition-all flex items-center justify-center gap-1.5"
          >
            <Check size={14} /> ยืนยันซิงค์
          </button>
        </div>
      </div>
    </div>
  )
}

// ── ProductModal ──────────────────────────────────────────────────────────────
// ช่องจำนวนพร้อมปุ่ม −/+ กดปรับได้ไม่ต้องพิมพ์
function QtyStepper({ suffix, value, onChange, onStep }: {
  suffix: string
  value: string
  onChange: (v: string) => void
  onStep: (dir: 1 | -1) => void
}) {
  return (
    <div>
      <div className="flex items-center bg-white border border-brand-blue/15 rounded-xl overflow-hidden focus-within:border-brand-blue transition-colors">
        <button type="button" onClick={() => onStep(-1)}
          className="w-9 self-stretch flex items-center justify-center text-brand-dark/40 hover:bg-brand-pale text-[17px] font-semibold flex-shrink-0">−</button>
        <input
          type="number" min={0} inputMode="numeric"
          className="w-full min-w-0 text-center text-[16px] font-bold text-brand-dark outline-none py-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          value={value} onChange={e => onChange(e.target.value)}
        />
        <button type="button" onClick={() => onStep(1)}
          className="w-9 self-stretch flex items-center justify-center text-brand-blue hover:bg-brand-pale text-[17px] font-semibold flex-shrink-0">+</button>
      </div>
      <p className="text-[10px] text-brand-dark/40 text-center mt-1">{suffix}</p>
    </div>
  )
}

function ProductModal({
  initial,
  onSave,
  onClose,
  hiddenCategories = [],
  onRemoveCategory,
}: {
  initial?: StockProduct
  onSave: (
    name: string, unit: StockUnit, packsPerBox: number,
    qty: number, qtyIncoming: number, yellowAt: number, redAt: number, goodsKeyword: string, category: string,
    buyPricePerBox?: number, sellPricePerPack?: number, sellPricePerBox?: number
  ) => void
  onClose: () => void
  hiddenCategories?: string[]
  onRemoveCategory?: (name: string) => void
}) {
  const [name,        setName]        = useState(initial?.name          ?? '')
  // หน่วยที่ซื้อเป็น Box เสมอ — ตัด dropdown ทิ้งแล้ว (สินค้าเก่ายังคงหน่วยเดิม)
  const unit: StockUnit = initial?.unit ?? 'Box'
  const [packsPerBox, setPacksPerBox] = useState(String(initial?.packsPerBox ?? 24))
  // แยกช่อง Box/Pack เพื่อไม่ต้องกรอกทศนิยม เช่น 1 Box 1 Pack
  // 'กำลังมา' ไม่มีช่องกรอกแล้ว — ซิงค์จากระบบติดตามสินค้า (OrdersTab)
  const initPpb  = initial?.packsPerBox ?? 0
  const initQty  = initial?.qty ?? 0
  const [qtyBox,  setQtyBox]  = useState(() => initPpb > 0 ? String(Math.floor(initQty / initPpb)) : '0')
  const [qtyPack, setQtyPack] = useState(() => initPpb > 0 ? String(initQty % initPpb) : String(initQty))
  const [yellowAt,    setYellowAt]    = useState(String(initial?.yellowAt    ?? 120))
  const [redAt,       setRedAt]       = useState(String(initial?.redAt       ?? 48))
  const [keyword,     setKeyword]     = useState(initial?.goodsKeyword       ?? '')
  const [category,    setCategory]    = useState(initial?.category           ?? '')
  const [error,       setError]       = useState('')
  const [showNewCat,  setShowNewCat]  = useState(false)
  const [newCat,      setNewCat]      = useState('')
  const [delCatMode,  setDelCatMode]  = useState(false)

  // หมวดหมู่ทั้งหมด = หมวดมาตรฐาน + หมวดที่ผู้ใช้สร้างเอง − หมวดที่ลบไปแล้ว ('อื่นๆ' อยู่ท้ายเสมอ)
  const { stock: allStock } = useStockStore()
  const catChips = useMemo(() => {
    const hidden = new Set(hiddenCategories)
    const set = new Set<string>(CATEGORIES.filter(c => c !== 'อื่นๆ' && !hidden.has(c)))
    allStock.products.forEach(p => { if (p.category && p.category !== 'อื่นๆ' && !hidden.has(p.category)) set.add(p.category) })
    if (category && category !== 'อื่นๆ') set.add(category)
    return [...set, 'อื่นๆ']
  }, [allStock.products, category, hiddenCategories])

  function addNewCat() {
    const c = newCat.trim()
    if (!c) return
    setCategory(c)
    setNewCat('')
    setShowNewCat(false)
  }

  function handleDeleteCat(c: string) {
    if (!onRemoveCategory) return
    if (!confirm(`ลบหมวด "${c}"? สินค้าในหมวดนี้จะย้ายไป "อื่นๆ"`)) return
    onRemoveCategory(c)
    if (category === c) setCategory('')
  }

  const ppb = Number(packsPerBox)
  const hasConversion = ppb > 0

  function boxHint(packs: string) {
    const n = Number(packs)
    if (!hasConversion || isNaN(n) || n <= 0) return ''
    return `≈ ${(n / ppb).toFixed(1)} Box`
  }

  const totalPacks = hasConversion
    ? Math.round(Number(qtyBox || 0) * ppb + Number(qtyPack || 0))
    : Number(qtyPack || 0)

  function stepBox(dir: 1 | -1) {
    setQtyBox(String(Math.max(0, Number(qtyBox || 0) + dir)))
  }

  // ปุ่ม −/+ ของ Pack ทดข้าม Box ให้อัตโนมัติ (เช่น 23→24 Pack กลายเป็น +1 Box)
  function stepPack(dir: 1 | -1) {
    const p = Number(qtyPack || 0), b = Number(qtyBox || 0)
    if (!hasConversion) { setQtyPack(String(Math.max(0, p + dir))); return }
    let np = p + dir, nb = b
    if (np >= ppb) { np -= ppb; nb += 1 }
    else if (np < 0) {
      if (b > 0) { np += ppb; nb -= 1 } else np = 0
    }
    setQtyPack(String(np)); setQtyBox(String(nb))
  }

  function handleSave() {
    if (!name.trim()) return setError('กรุณาใส่ชื่อสินค้า')
    const y = Number(yellowAt), r = Number(redAt)
    const qb = Number(qtyBox || 0), qp = Number(qtyPack || 0)
    if ([y, r, qb, qp].some(isNaN)) return setError('กรุณาใส่ตัวเลขให้ถูกต้อง')
    if (r >= y) return setError('ขีดแดงต้องน้อยกว่าขีดเหลือง')
    const q   = hasConversion ? Math.round(qb * ppb + qp) : qp
    const inc = initial?.qtyIncoming ?? 0
    onSave(
      name.trim(), unit, ppb < 0 ? 0 : ppb, q, inc, y, r, keyword.trim(), category || 'อื่นๆ',
      initial?.buyPricePerBox,
      initial?.sellPricePerPack,
      initial?.sellPricePerBox,
    )
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40">
      <div className="bg-white w-full md:max-w-sm rounded-t-3xl md:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col">

        {/* header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
          <h3 className="text-[15px] font-bold text-brand-dark">
            {initial ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'}
          </h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-brand-pale flex items-center justify-center">
            <X size={15} className="text-brand-dark/50" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 pb-4 space-y-4">

          {/* name */}
          <div>
            <label className="text-[11px] font-semibold text-brand-dark/40 uppercase tracking-wider">ชื่อสินค้า</label>
            <input
              autoFocus={!initial}
              className="mt-1.5 w-full border border-brand-blue/15 rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-brand-blue"
              value={name} onChange={e => setName(e.target.value)}
              placeholder="เช่น One Piece OP-15"
            />
          </div>

          {/* category */}
          <div>
            <label className="text-[11px] font-semibold text-brand-dark/40 uppercase tracking-wider">
              หมวดหมู่ <span className="font-normal normal-case text-brand-dark/30">(ไม่เลือก = อื่นๆ)</span>
            </label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {catChips.map(c => {
                const deletable = delCatMode && c !== 'อื่นๆ'
                return (
                  <button key={c} type="button"
                    onClick={() => deletable ? handleDeleteCat(c) : setCategory(category === c ? '' : c)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all flex items-center gap-1 ${
                      deletable
                        ? 'bg-red-50 text-red-500 border-red-200 hover:bg-red-100'
                        : category === c
                          ? 'bg-brand-blue text-white border-transparent'
                          : 'bg-white text-brand-dark/60 border-brand-blue/20 hover:border-brand-blue/40'
                    }`}
                  >
                    {c}
                    {deletable && <X size={10} />}
                  </button>
                )
              })}
              {!delCatMode && (
                <button type="button"
                  onClick={() => setShowNewCat(v => !v)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium border border-dashed transition-all ${
                    showNewCat
                      ? 'border-brand-blue text-brand-blue bg-brand-pale/60'
                      : 'border-brand-blue/30 text-brand-blue/60 hover:border-brand-blue/60 hover:text-brand-blue'
                  }`}
                >+ เพิ่มเอง</button>
              )}
              {onRemoveCategory && (
                <button type="button"
                  onClick={() => { setDelCatMode(v => !v); setShowNewCat(false) }}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium border border-dashed transition-all ${
                    delCatMode
                      ? 'border-red-400 text-red-500 bg-red-50'
                      : 'border-red-200 text-red-300 hover:border-red-400 hover:text-red-500'
                  }`}
                >{delCatMode ? 'เสร็จสิ้น' : '− ลบหมวด'}</button>
              )}
            </div>
            {showNewCat && (
              <div className="flex gap-1.5 mt-2">
                <input
                  autoFocus
                  className="flex-1 border border-brand-blue/15 rounded-xl px-3 py-2 text-[12px] outline-none focus:border-brand-blue"
                  value={newCat} onChange={e => setNewCat(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addNewCat() }}
                  placeholder="ชื่อหมวดหมู่ใหม่"
                />
                <button type="button" onClick={addNewCat} disabled={!newCat.trim()}
                  className="px-3.5 py-2 rounded-xl bg-brand-blue text-white text-[12px] font-semibold disabled:opacity-40 active:scale-95 transition-all">
                  เพิ่ม
                </button>
              </div>
            )}
          </div>

          {/* qty */}
          <div className="bg-brand-pale/40 rounded-2xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-brand-dark/40 uppercase tracking-wider">จำนวนในมือ</label>
              <span className="text-[12px] font-bold text-brand-blue">= {isNaN(totalPacks) ? '–' : totalPacks} Pack</span>
            </div>
            {hasConversion ? (
              <div className="grid grid-cols-2 gap-2">
                <QtyStepper suffix="Box"  value={qtyBox}  onChange={setQtyBox}  onStep={stepBox} />
                <QtyStepper suffix="Pack" value={qtyPack} onChange={setQtyPack} onStep={stepPack} />
              </div>
            ) : (
              <QtyStepper suffix="Pack" value={qtyPack} onChange={setQtyPack} onStep={stepPack} />
            )}
            <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-brand-blue/10">
              <span className="text-[12px] text-brand-dark/50">Pack ต่อ 1 Box</span>
              <input
                type="number" min={0}
                className="w-20 text-center border border-brand-blue/15 rounded-lg px-2 py-1.5 text-[13px] font-semibold bg-white outline-none focus:border-brand-blue"
                value={packsPerBox} onChange={e => setPacksPerBox(e.target.value)}
              />
            </div>
          </div>

          {/* thresholds */}
          <div>
            <label className="text-[11px] font-semibold text-brand-dark/40 uppercase tracking-wider">ขีดเตือนสต๊อก (Pack)</label>
            <div className="grid grid-cols-2 gap-2 mt-1.5">
              <div className="rounded-xl border border-yellow-200 bg-yellow-50/50 p-3">
                <p className="text-[11px] text-yellow-600 font-medium flex items-center gap-1 mb-1">
                  <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> ใกล้หมด ≤
                </p>
                <input
                  type="number" min={0}
                  className="w-full bg-transparent text-[16px] font-bold text-brand-dark outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={yellowAt} onChange={e => setYellowAt(e.target.value)}
                />
                <p className="text-[10px] text-brand-dark/30 h-3">{boxHint(yellowAt)}</p>
              </div>
              <div className="rounded-xl border border-red-200 bg-red-50/50 p-3">
                <p className="text-[11px] text-red-500 font-medium flex items-center gap-1 mb-1">
                  <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> กำลังจะหมด ≤
                </p>
                <input
                  type="number" min={0}
                  className="w-full bg-transparent text-[16px] font-bold text-brand-dark outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={redAt} onChange={e => setRedAt(e.target.value)}
                />
                <p className="text-[10px] text-brand-dark/30 h-3">{boxHint(redAt)}</p>
              </div>
            </div>
          </div>

          {/* keyword */}
          <div>
            <label className="text-[11px] font-semibold text-brand-dark/40 uppercase tracking-wider">
              Keyword จับคู่รายงาน <span className="font-normal normal-case text-brand-dark/30">(ไม่บังคับ)</span>
            </label>
            <input
              className="mt-1.5 w-full border border-brand-blue/15 rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-brand-blue font-mono"
              value={keyword} onChange={e => setKeyword(e.target.value)}
              placeholder='เช่น "PRB-02" หรือ "OP-15"'
            />
            <p className="text-[10px] text-brand-dark/30 mt-1">
              ใช้จับคู่ชื่อสินค้าใน Goods Aspect เพื่อหักสต๊อกอัตโนมัติ
            </p>
          </div>

          {error && (
            <p className="text-red-500 text-[12px] bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>
          )}
        </div>

        {/* footer */}
        <div className="px-5 pb-5 pt-3 flex-shrink-0 border-t border-brand-blue/8 flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-brand-blue/15 text-[13px] text-brand-dark/60 hover:bg-brand-pale/50 transition-colors">
            ยกเลิก
          </button>
          <button
            onClick={handleSave}
            className="flex-[2] py-2.5 rounded-xl bg-brand-blue text-white text-[13px] font-semibold hover:bg-brand-light active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
          >
            <Check size={14} /> บันทึก
          </button>
        </div>
      </div>
    </div>
  )
}

// ── ProductRow ────────────────────────────────────────────────────────────────

const ENTRY_KIND_LABEL: Record<string, { label: string; color: string }> = {
  incoming: { label: 'สั่งมา',     color: 'text-blue-500' },
  received: { label: 'รับของแล้ว', color: 'text-emerald-600' },
  in:       { label: 'รับเข้า',    color: 'text-emerald-600' },
  out:      { label: 'จ่ายออก',    color: 'text-red-500' },
  auto:     { label: 'ซิงค์',      color: 'text-brand-dark/40' },
  adjust:   { label: 'ปรับยอด',    color: 'text-purple-500' },
}

const STATUS_BAR = {
  empty:  'bg-gray-300',
  red:    'bg-red-400',
  yellow: 'bg-yellow-400',
  green:  'bg-emerald-400',
}

function ProductRow({
  product,
  resolvedGoodsName,
  onEdit,
  onDelete,
  onSync,
  pendingSyncCount,
  readOnly,
  taxRate,
}: {
  product: StockProduct
  resolvedGoodsName: string | null
  onEdit: () => void
  onDelete: () => void
  onSync: () => void
  pendingSyncCount: number
  readOnly?: boolean
  taxRate: number
}) {
  const { getStatus } = useStockStore()
  const status      = getStatus(product)
  const style       = STATUS_STYLE[status]
  const ppb         = product.packsPerBox
  const hasIncoming = product.qtyIncoming > 0
  const total       = product.qty + product.qtyIncoming
  const [open, setOpen] = useState(false)
  const [imgIdx, setImgIdx] = useState(0)
  const imgCandidates = useMemo(() => {
    // ถ้าชื่อสินค้ามี "(1 Pack)" หรือ "(Box)" อยู่แล้ว ใช้ชื่อตรงๆ ไม่เติมซ้ำ
    const hasUnitSuffix = /\((1 Pack|Box)\)\s*$/i.test(product.name)
    const list = [
      `/Img/${product.name}.jpg`,
      ...(hasUnitSuffix ? [] : [`/Img/${product.name} (1 Pack).jpg`]),
      ...(resolvedGoodsName ? [`/Img/${resolvedGoodsName}.jpg`] : []),
    ]
    // deduplicate
    return [...new Set(list)]
  }, [product.name, resolvedGoodsName])

  const barMax = Math.max(total, product.yellowAt + (ppb > 0 ? ppb : 1))
  const qtyPct = Math.min((product.qty / barMax) * 100, 100)
  const incPct = Math.min((product.qtyIncoming / barMax) * 100, 100 - qtyPct)

  return (
    <div className={`rounded-xl border overflow-hidden transition-colors flex flex-col ${style.card}`}>

      {/* status strip */}
      <div className={`h-1 flex-shrink-0 ${STATUS_BAR[status]}`} />

      <div className="p-2.5 pb-2 flex flex-col flex-1">
        {/* product image */}
        <div className="aspect-square w-full rounded-lg overflow-hidden bg-brand-pale/40 mb-2">
          {imgIdx < imgCandidates.length ? (
            <img
              key={imgCandidates[imgIdx]}
              src={imgCandidates[imgIdx]}
              alt={product.name}
              className="w-full h-full object-cover"
              onError={() => setImgIdx(i => i + 1)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[9px] text-brand-dark/20 text-center p-2 leading-tight">
              {product.name}
            </div>
          )}
        </div>

        {/* name — fixed 2-line area */}
        <p className="text-[12px] font-bold text-brand-dark leading-tight line-clamp-2 mb-1 h-[2.5em]">
          {product.name}
        </p>

        {/* status badge + keyword */}
        <div className="flex items-center gap-1 flex-wrap mb-2">
          <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full border ${style.badge}`}>
            {style.label}
          </span>
          {product.goodsKeyword && (
            <span className="text-[9px] text-brand-blue/50 font-mono bg-brand-pale/60 px-1 py-0.5 rounded">
              {product.goodsKeyword}
            </span>
          )}
        </div>

        {/* qty — fixed height area */}
        <div className="mb-1.5 h-[2.5em]">
          <p className={`text-[16px] font-bold leading-tight ${status === 'empty' ? 'text-gray-400' : 'text-brand-dark'}`}>
            {formatQty(product.qty, ppb)}
          </p>
          {hasIncoming && (
            <p className="text-[10px] text-blue-500 font-medium mt-0.5">
              +{formatQty(product.qtyIncoming, ppb)} มา
            </p>
          )}
        </div>

        {/* spacer */}
        <div className="flex-1" />

        {/* progress bar */}
        <div className="h-1 bg-brand-pale rounded-full overflow-hidden relative mb-2">
          {hasIncoming && (
            <div className="absolute top-0 bottom-0 bg-blue-200 rounded-full"
              style={{ left: `${qtyPct}%`, width: `${incPct}%` }} />
          )}
          <div className={`h-full rounded-full ${STATUS_BAR[status]}`}
            style={{ width: `${qtyPct}%` }} />
          <div className="absolute top-0 bottom-0 w-px bg-yellow-400/70"
            style={{ left: `${Math.min((product.yellowAt / barMax) * 100, 95)}%` }} />
          <div className="absolute top-0 bottom-0 w-px bg-red-400/70"
            style={{ left: `${Math.min((product.redAt / barMax) * 100, 90)}%` }} />
        </div>

        {/* actions */}
        <div className="flex items-center justify-end gap-0.5">
          {!readOnly && pendingSyncCount > 0 && (
            <button onClick={onSync}
              className="relative w-6 h-6 flex items-center justify-center rounded-md bg-brand-blue/10 text-brand-blue hover:bg-brand-blue hover:text-white transition-colors"
            >
              <RefreshCw size={11} />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-brand-blue text-white text-[7px] font-bold rounded-full flex items-center justify-center">
                {pendingSyncCount}
              </span>
            </button>
          )}
          {!readOnly && (
            <button onClick={onEdit}
              className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-brand-pale/80 text-brand-dark/30 hover:text-brand-dark transition-colors"
            ><Pencil size={11} /></button>
          )}
          <button onClick={() => setOpen(o => !o)}
            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-brand-pale/80 text-brand-dark/30 hover:text-brand-dark transition-colors"
          >{open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}</button>
        </div>
      </div>

      {/* expanded: thresholds + profit + history */}
      {open && (
        <div className="border-t border-brand-blue/8 px-3 pt-2 pb-3 space-y-1.5">
          <p className="text-[10px] text-brand-dark/30 mb-2">
            เหลือง ≤ {formatQty(product.yellowAt, ppb)} · แดง ≤ {formatQty(product.redAt, ppb)}
            {ppb > 0 && ` · 1 ${product.unit} = ${ppb} Pack`}
          </p>

          {/* Profit section */}
          {(() => {
            const p = calcProfit(product, taxRate)
            if (!p) return null
            return (
              <div className="bg-emerald-50 rounded-xl p-2.5 mb-2 border border-emerald-100">
                <p className="text-[10px] font-semibold text-emerald-700 mb-1.5">กำไร (ภาษี {taxRate}%)</p>
                <div className="grid grid-cols-3 text-[9px] text-brand-dark/40 font-medium px-1 mb-1">
                  <span></span><span className="text-center">Pack</span><span className="text-center">Box</span>
                </div>
                {[
                  { label: 'ต้นทุน', packVal: p.costPerPack, boxVal: product.buyPricePerBox, color: 'text-brand-dark/60' },
                  { label: 'ราคาขาย', packVal: product.sellPricePerPack, boxVal: product.sellPricePerBox, color: 'text-brand-dark/60' },
                  { label: 'กำไรดิบ', packVal: p.pack ? p.pack.rawProfit : undefined, boxVal: p.box ? p.box.rawProfit : undefined, color: 'text-amber-600' },
                  { label: 'กำไรสุทธิ', packVal: p.pack ? p.pack.netProfit : undefined, boxVal: p.box ? p.box.netProfit : undefined, color: 'text-emerald-600', bold: true },
                  { label: 'กำไร %', packVal: p.pack ? p.pack.profitPct : undefined, boxVal: p.box ? p.box.profitPct : undefined, color: 'text-blue-600', isPct: true },
                ].map(({ label, packVal, boxVal, color, bold, isPct }) => (
                  <div key={label} className="grid grid-cols-3 text-[11px] py-0.5 border-t border-emerald-100/60">
                    <span className="text-brand-dark/50 text-[10px]">{label}</span>
                    <span className={`text-center font-${bold ? 'bold' : 'medium'} ${color}`}>
                      {packVal != null ? (isPct ? `${packVal.toFixed(1)}%` : `฿${packVal.toFixed(2)}`) : '—'}
                    </span>
                    <span className={`text-center font-${bold ? 'bold' : 'medium'} ${color}`}>
                      {boxVal != null ? (isPct ? `${boxVal.toFixed(1)}%` : `฿${boxVal.toFixed(0)}`) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )
          })()}
          {!readOnly && (
            <button onClick={onDelete} className="mt-1 flex items-center gap-1 text-[11px] text-red-400 hover:text-red-600">
              <Trash2 size={11} /> ลบสินค้านี้
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── StockPage ─────────────────────────────────────────────────────────────────
interface StockPageProps {
  reports: DayReport[]
  sheetsUrl?: string
  ordersUrl?: string
  isOrdersEnv?: boolean
  onSaveOrdersUrl?: (url: string) => void
  onPushStock?: (s: object) => Promise<boolean>
  onPushOrders?: (orders: PurchaseOrder[]) => Promise<boolean>
  onFetchOrders?: () => Promise<PurchaseOrder[] | null>
  readOnly?: boolean
}

// ── Profit Calculator ─────────────────────────────────────────────────────────
function calcProfit(product: StockProduct, taxRate: number) {
  const ppb = product.packsPerBox
  if (!product.buyPricePerBox || ppb <= 0) return null
  const costPerPack = product.buyPricePerBox / ppb
  const result: {
    costPerPack: number
    pack?: { rawProfit: number; netProfit: number; profitPct: number }
    box?: { rawProfit: number; netProfit: number; profitPct: number }
  } = { costPerPack }
  if (product.sellPricePerPack) {
    const rawProfit = product.sellPricePerPack - costPerPack
    const netProfit = product.sellPricePerPack * (1 - taxRate / 100) - costPerPack
    const profitPct = costPerPack > 0 ? (netProfit / costPerPack) * 100 : 0
    result.pack = { rawProfit, netProfit, profitPct }
  }
  if (product.sellPricePerBox) {
    const costPerBox = product.buyPricePerBox
    const rawProfit = product.sellPricePerBox - costPerBox
    const netProfit = product.sellPricePerBox * (1 - taxRate / 100) - costPerBox
    const profitPct = costPerBox > 0 ? (netProfit / costPerBox) * 100 : 0
    result.box = { rawProfit, netProfit, profitPct }
  }
  return result
}

function SubTabBar({ active, onChange, pendingCount }: {
  active: 'stock' | 'orders'
  onChange: (t: 'stock' | 'orders') => void
  pendingCount: number
}) {
  const TABS = [
    { id: 'stock'  as const, label: 'สต็อก',       icon: <Package2 size={14} /> },
    { id: 'orders' as const, label: 'ติดตามสินค้า', icon: <Truck size={14} />, badge: pendingCount },
  ]
  return (
    <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-brand-blue/8 px-4 md:px-6 py-2.5">
      <div className="max-w-2xl mx-auto">
        <div className="inline-flex bg-[#e4eaf6] rounded-2xl p-1.5 gap-1.5">
          {TABS.map(tab => {
            const isActive = active === tab.id
            return (
              <button key={tab.id} onClick={() => onChange(tab.id)}
                className={`relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-200 active:scale-95 ${
                  isActive
                    ? 'bg-brand-blue text-white shadow-md shadow-brand-blue/30'
                    : 'text-brand-dark/50 hover:text-brand-dark hover:bg-white/50'
                }`}
              >
                {tab.icon}
                {tab.label}
                {'badge' in tab && tab.badge > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full transition-colors ${
                    isActive ? 'bg-white/30 text-white' : 'bg-brand-blue text-white'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function StockPage({ reports, sheetsUrl, ordersUrl, isOrdersEnv, onSaveOrdersUrl, onPushStock, onPushOrders, onFetchOrders, readOnly }: StockPageProps) {
  const [stockTab, setStockTab] = useState<'stock' | 'orders'>('stock')
  const { orders } = useOrderStore()
  const pendingOrderCount = orders.filter(o => o.status !== 'received').length
  const {
    stock, addProduct, updateProduct, removeProduct, removeCategory, logEntry,
    previewSync, applySync, previewSyncProduct, applySyncProduct,
    getPendingDates, resetSyncedDates,
    previewInventorySnapshot, applyInventorySnapshot,
    getStatus, getEntries, setTaxRate,
  } = useStockStore()

  const [showAdd,          setShowAdd]          = useState(false)
  const [editTarget,       setEditTarget]       = useState<StockProduct | null>(null)
  const [filter,           setFilter]           = useState<'all' | 'red' | 'yellow' | 'green'>('all')
  const [catFilter,        setCatFilter]        = useState<string>('ทั้งหมด')
  const [showSync,         setShowSync]         = useState(false)
  const [syncProduct,      setSyncProduct]      = useState<StockProduct | null>(null)
  const [syncExpanded,     setSyncExpanded]     = useState(false)
  const [selectedSyncDates, setSelectedSyncDates] = useState<Set<string>>(new Set())
  const [pushing,          setPushing]          = useState(false)
  const [pushOk,           setPushOk]           = useState<boolean | null>(null)

  const [savedFlash, setSavedFlash] = useState(false)
  function flashSaved() {
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 900)
  }

  async function handlePushStock() {
    if (!onPushStock) return
    setPushing(true)
    const ok = await onPushStock(stock)  // ส่ง stock จาก instance นี้โดยตรง
    setPushOk(ok)
    setPushing(false)
    if (ok) flashSaved()
    setTimeout(() => setPushOk(null), 3000)
  }

  // push อัตโนมัติหลังแก้ไข — ใช้ ref เพื่ออ่าน stock ล่าสุดหลัง state settle
  // (จำเป็นสำหรับเวอร์ชัน deploy ที่โหลดทับจาก Sheets ทุกครั้งที่เปิด)
  const stockRef = useRef(stock)
  useEffect(() => { stockRef.current = stock }, [stock])
  function schedulePushStock() {
    if (!onPushStock) return
    setTimeout(async () => {
      setPushing(true)
      const ok = await onPushStock(stockRef.current)
      setPushOk(ok)
      setPushing(false)
      if (ok) flashSaved()
      setTimeout(() => setPushOk(null), 3000)
    }, 400)
  }

  // popup กลางจอระหว่างบันทึกขึ้น Google Sheet (แสดงทั้ง tab สต็อกและติดตามสินค้า)
  const saveOverlay = (pushing || savedFlash) ? (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-2xl px-10 py-7 flex flex-col items-center gap-3 animate-pop-in">
        {pushing ? (
          <>
            <Loader2 size={30} className="animate-spin text-brand-blue" />
            <p className="text-[14px] font-semibold text-brand-dark">กำลังบันทึกข้อมูล...</p>
            <p className="text-[11px] text-brand-dark/40">กรุณาอย่าเพิ่งปิดหน้านี้</p>
          </>
        ) : (
          <>
            <div className="w-11 h-11 rounded-full bg-emerald-100 flex items-center justify-center">
              <Check size={24} className="text-emerald-500" />
            </div>
            <p className="text-[14px] font-semibold text-emerald-600">บันทึกแล้ว</p>
          </>
        )}
      </div>
    </div>
  ) : null

  // inventory snapshot
  const inventoryInputRef = useRef<HTMLInputElement>(null)
  const [snapshotItems,    setSnapshotItems]    = useState<InventorySnapshotItem[]>([])
  const [snapshotDate,     setSnapshotDate]     = useState('')
  const [snapshotUnmatch,  setSnapshotUnmatch]  = useState<string[]>([])
  const [showSnapshot,     setShowSnapshot]     = useState(false)

  async function handleInventoryFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const { date, rows } = await parseInventoryReport(file)
    const items = previewInventorySnapshot(rows)
    const matchedNames = new Set(items.map(i => i.goodsName))
    const unmatched = rows.filter(r => !matchedNames.has(r.goodsName)).map(r => r.goodsName)
    setSnapshotItems(items)
    setSnapshotDate(date)
    setSnapshotUnmatch(unmatched)
    setShowSnapshot(true)
  }

  // keyword → goodsName lookup from all reports' goods data
  const goodsNameMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of reports) {
      for (const g of r.goods) {
        const kw = g.goodsName.toLowerCase()
        map.set(kw, g.goodsName)
      }
    }
    return map
  }, [reports])

  function resolveGoodsName(product: StockProduct): string | null {
    if (!product.goodsKeyword) return null
    const kw = product.goodsKeyword.toLowerCase()
    for (const [name, goodsName] of goodsNameMap) {
      if (name.includes(kw) || kw.includes(name.split(' ').slice(-1)[0].toLowerCase())) {
        return goodsName
      }
    }
    return null
  }

  const pendingDates = useMemo(() => getPendingDates(reports), [reports, stock.syncedDates])

  // Reset selection whenever pending dates change (new data loaded / after sync)
  useEffect(() => {
    setSelectedSyncDates(new Set(pendingDates))
    setSyncExpanded(false)
  }, [pendingDates.join(',')])

  // All preview items (for counting per date in banner)
  const syncPreviewAll = useMemo(() => reports.length > 0 ? previewSync(reports) : [], [reports, stock.syncedDates])
  const syncCountByDate = useMemo(() => {
    const map: Record<string, number> = {}
    for (const item of syncPreviewAll) {
      map[item.date] = (map[item.date] || 0) + 1
    }
    return map
  }, [syncPreviewAll])

  // Only items for selected dates (used in modal)
  const syncPreview = useMemo(
    () => showSync ? syncPreviewAll.filter(i => selectedSyncDates.has(i.date)) : [],
    [showSync, syncPreviewAll, selectedSyncDates]
  )
  const productSyncPreview = useMemo(
    () => syncProduct ? previewSyncProduct(reports, syncProduct.id) : [],
    [syncProduct, reports, stock]
  )

  const counts = {
    red:    stock.products.filter(p => { const s = getStatus(p); return s === 'red' || s === 'empty' }).length,
    yellow: stock.products.filter(p => getStatus(p) === 'yellow').length,
    green:  stock.products.filter(p => getStatus(p) === 'green').length,
  }

  const filtered = stock.products.filter(p => {
    const s = getStatus(p)
    const statusOk = filter === 'all'
      || (filter === 'red' && (s === 'red' || s === 'empty'))
      || s === filter
    const catOk = catFilter === 'ทั้งหมด'
      || (catFilter === 'อื่นๆ' ? (!p.category || p.category === 'อื่นๆ') : p.category === catFilter)
    return statusOk && catOk
  })

  function handleConfirmSync() {
    applySync(syncPreview, Array.from(selectedSyncDates))
    schedulePushStock()
  }

  if (stockTab === 'orders') {
    return (
      <>
        <SubTabBar active={stockTab} onChange={setStockTab} pendingCount={pendingOrderCount} />
        <OrdersTab products={stock.products} onPush={onPushOrders} onFetch={onFetchOrders} sheetsConnected={!!(sheetsUrl || ordersUrl)} ordersUrl={ordersUrl} isOrdersEnv={isOrdersEnv} onSaveOrdersUrl={onSaveOrdersUrl}
          onStockLog={(items, kind) => {
            items.forEach(it => {
              if (!it.productId) return
              const p = stock.products.find(pp => pp.id === it.productId)
              if (!p) return
              const packs = it.unit === 'Box' && p.packsPerBox > 0 ? it.qty * p.packsPerBox : it.qty
              if (kind === 'incoming')      logEntry(p.id, packs,  `สั่งซื้อ ${it.qty} ${it.unit}`, 'incoming')
              else if (kind === 'cancel')   logEntry(p.id, -packs, 'ยกเลิกรายการสั่งซื้อ', 'incoming')
              else                          logEntry(p.id, packs,  `รับสินค้า ${it.qty} ${it.unit}`, 'received', undefined, true)
            })
            schedulePushStock()
          }} />
        {saveOverlay}
      </>
    )
  }

  return (
    <>
    <SubTabBar active={stockTab} onChange={setStockTab} pendingCount={pendingOrderCount} />
    {saveOverlay}
    <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">

      {/* sync banner — เจ้าของเท่านั้น */}
      {!readOnly && (pendingDates.length > 0 ? (
        <div className="bg-brand-blue/5 border border-brand-blue/20 rounded-xl overflow-hidden">
          {/* header row */}
          <button
            onClick={() => setSyncExpanded(v => !v)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-brand-blue/10 transition-colors text-left"
          >
            <RefreshCw size={16} className="text-brand-blue flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-brand-blue">
                มีรายงาน {pendingDates.length} วันที่รอซิงค์
              </p>
              <p className="text-[11px] text-brand-blue/50">
                เลือกแล้ว {selectedSyncDates.size} วัน · กดเพื่อจัดการ
              </p>
            </div>
            <ChevronDown size={14} className={`text-brand-blue flex-shrink-0 transition-transform duration-200 ${syncExpanded ? 'rotate-180' : ''}`} />
          </button>

          {/* expandable date list */}
          {syncExpanded && (
            <div className="border-t border-brand-blue/15 px-3 pb-3 pt-2">
              <div className="space-y-1 mb-3">
                {pendingDates.map(date => {
                  const itemCount = syncCountByDate[date] ?? 0
                  const checked = selectedSyncDates.has(date)
                  return (
                    <div key={date} className="flex items-center gap-1">
                      {/* checkbox + date */}
                      <button
                        onClick={() => setSelectedSyncDates(prev => {
                          const next = new Set(prev)
                          if (next.has(date)) next.delete(date)
                          else next.add(date)
                          return next
                        })}
                        className="flex-1 flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-brand-blue/5 transition-colors text-left min-w-0"
                      >
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                          checked ? 'bg-brand-blue border-brand-blue' : 'border-brand-dark/25'
                        }`}>
                          {checked && <Check size={10} className="text-white" />}
                        </div>
                        <p className="flex-1 text-[13px] font-medium text-brand-dark">{formatThaiDate(date)}</p>
                        <p className={`text-[11px] flex-shrink-0 ${itemCount > 0 ? 'text-brand-dark/50' : 'text-brand-dark/25'}`}>
                          {itemCount > 0 ? `${itemCount} รายการ` : 'ไม่พบ'}
                        </p>
                      </button>
                      {/* skip button */}
                      <button
                        onClick={() => applySync([], [date])}
                        title="ไม่ซิงค์วันนี้ (หายไปจากรายการ)"
                        className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-brand-dark/25 hover:bg-red-50 hover:text-red-400 transition-colors"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  )
                })}
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-brand-blue/10">
                <button
                  onClick={() => setSelectedSyncDates(new Set(pendingDates))}
                  className="text-[11px] text-brand-blue/60 hover:text-brand-blue transition-colors"
                >
                  เลือกทั้งหมด
                </button>
                <span className="text-brand-dark/20 text-[11px]">·</span>
                <button
                  onClick={() => setSelectedSyncDates(new Set())}
                  className="text-[11px] text-brand-dark/35 hover:text-brand-dark transition-colors"
                >
                  ยกเลิกทั้งหมด
                </button>
                <button
                  disabled={selectedSyncDates.size === 0}
                  onClick={() => setShowSync(true)}
                  className="ml-auto bg-brand-blue text-white text-[12px] font-semibold px-3 py-1.5 rounded-lg disabled:opacity-30 hover:bg-brand-light active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <Check size={12} /> ซิงค์ที่เลือก ({selectedSyncDates.size})
                </button>
              </div>
            </div>
          )}
        </div>
      ) : reports.length > 0 && (
        <div className="flex items-center justify-between bg-brand-pale/40 rounded-xl px-4 py-2.5">
          <p className="text-[12px] text-brand-dark/40">
            ซิงค์ครบทุกรายงานแล้ว ({reports.length} วัน)
          </p>
          <button
            onClick={() => { resetSyncedDates() }}
            className="text-[11px] text-brand-blue/60 hover:text-brand-blue underline"
          >
            ซิงค์ใหม่ทั้งหมด
          </button>
        </div>
      ))}

      {/* inventory upload button — เจ้าของเท่านั้น */}
      {!readOnly && (
        <>
          <input
            ref={inventoryInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleInventoryFile}
          />
          <button
            onClick={() => inventoryInputRef.current?.click()}
            className="w-full flex items-center gap-3 bg-white border border-brand-blue/15 rounded-xl px-4 py-3 hover:bg-brand-pale/40 transition-colors text-left"
          >
            <Upload size={16} className="text-brand-dark/40 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-[13px] font-medium text-brand-dark">อัปโหลด Inventory Snapshot</p>
              <p className="text-[11px] text-brand-dark/40">ไฟล์ Inventory Status Batch จากตู้ — set สต๊อกตรงตามค่าจริงในตู้</p>
            </div>
          </button>
        </>
      )}

      {/* category filter — wrap ลงหลายบรรทัดเมื่อหมวดเยอะ */}
      <div className="flex flex-wrap gap-1.5">
        {(() => {
          // รวมหมวดที่ผู้ใช้สร้างเอง − หมวดที่ลบไปแล้ว ('อื่นๆ' อยู่ท้ายเสมอ)
          const hidden = new Set(stock.hiddenCategories ?? [])
          const set = new Set<string>(CATEGORIES.filter(c => c !== 'อื่นๆ' && !hidden.has(c)))
          stock.products.forEach(p => { if (p.category && p.category !== 'อื่นๆ' && !hidden.has(p.category)) set.add(p.category) })
          return ['ทั้งหมด', ...set, 'อื่นๆ']
        })().map(c => {
          const count = c === 'ทั้งหมด'
            ? stock.products.length
            : stock.products.filter(p => c === 'อื่นๆ' ? (!p.category || p.category === 'อื่นๆ') : p.category === c).length
          return (
            <button key={c} onClick={() => setCatFilter(c)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[12px] font-medium transition-all border ${
                catFilter === c
                  ? 'bg-brand-dark text-white border-transparent'
                  : 'bg-white text-brand-dark/60 border-brand-blue/15 hover:border-brand-blue/30'
              }`}
            >
              {c} {count > 0 && <span className={`text-[10px] ${catFilter === c ? 'text-white/70' : 'text-brand-dark/40'}`}>{count}</span>}
            </button>
          )
        })}
      </div>

      {/* status filter + add */}
      <div className="flex gap-1.5 items-center flex-wrap">
        {sheetsUrl && onPushStock && (
          <button
            onClick={handlePushStock}
            disabled={pushing}
            className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all ${
              pushing ? 'border-brand-blue/20 text-brand-blue animate-pulse'
              : pushOk === true ? 'border-emerald-300 text-emerald-600 bg-emerald-50'
              : pushOk === false ? 'border-red-200 text-red-500'
              : 'border-brand-blue/15 text-brand-dark/50 hover:border-brand-blue/40 hover:text-brand-blue'
            }`}
          >
            {pushOk === false ? <CloudOff size={12} /> : <Cloud size={12} />}
            {pushing ? 'กำลังบันทึก...' : pushOk === true ? 'บันทึกแล้ว' : pushOk === false ? 'บันทึกไม่ได้' : 'บันทึกสต๊อก'}
          </button>
        )}
        {(['all', 'red', 'yellow', 'green'] as const).map(f => {
          const labels = { all: `ทั้งหมด`, red: `หมด/กำลังจะหมด`, yellow: `ใกล้หมด`, green: `ปกติ` }
          const badges = { all: counts.red + counts.yellow + counts.green, red: counts.red, yellow: counts.yellow, green: counts.green }
          const colors = {
            all:    filter === 'all'    ? 'bg-brand-blue text-white border-transparent'      : 'bg-white text-brand-dark/60 border-brand-blue/15',
            red:    filter === 'red'    ? 'bg-red-500 text-white border-transparent'         : 'bg-white text-red-500 border-red-200',
            yellow: filter === 'yellow' ? 'bg-yellow-400 text-white border-transparent'      : 'bg-white text-yellow-600 border-yellow-200',
            green:  filter === 'green'  ? 'bg-emerald-500 text-white border-transparent'     : 'bg-white text-emerald-600 border-emerald-200',
          }
          if (f !== 'all' && badges[f] === 0) return null
          return (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border ${colors[f]}`}
            >
              {f === 'all' ? `${labels[f]} ${stock.products.length}` : `${labels[f]} ${badges[f]}`}
            </button>
          )
        })}
        {/* Tax rate input */}
        <div className="flex items-center gap-1 ml-1">
          <span className="text-[11px] text-brand-dark/40">ภาษี</span>
          <input
            type="number" min={0} max={100}
            className="w-12 border border-brand-blue/20 rounded-lg px-1.5 py-1 text-[11px] text-center outline-none focus:border-brand-blue"
            value={stock.taxRate}
            onChange={e => setTaxRate(Number(e.target.value))}
            disabled={readOnly}
          />
          <span className="text-[11px] text-brand-dark/40">%</span>
        </div>

        {!readOnly && (
          <button
            onClick={() => setShowAdd(true)}
            className="ml-auto flex items-center gap-1.5 bg-brand-blue hover:bg-brand-light text-white text-[12px] font-medium px-3 py-1.5 rounded-full active:scale-95 transition-all"
          >
            <Plus size={13} /> เพิ่มสินค้า
          </button>
        )}
      </div>

      {/* product grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-brand-dark/30">
          <p className="text-[14px]">
            {stock.products.length === 0
              ? 'ยังไม่มีสินค้า กด "เพิ่มสินค้า" เพื่อเริ่มต้น'
              : 'ไม่มีสินค้าในกลุ่มนี้'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {filtered.map(p => {
            const pendingForProduct = syncPreviewAll.filter(i => i.productId === p.id).length
            return (
              <ProductRow
                key={p.id}
                product={p}
                resolvedGoodsName={resolveGoodsName(p)}
                onEdit={() => setEditTarget(p)}
                onDelete={() => { removeProduct(p.id); schedulePushStock() }}
                onSync={() => setSyncProduct(p)}
                pendingSyncCount={pendingForProduct}
                readOnly={readOnly}
                taxRate={stock.taxRate}
              />
            )
          })}
        </div>
      )}

      {/* modals */}
      {showAdd && (
        <ProductModal
          onSave={(name, unit, ppb, qty, inc, yellowAt, redAt, kw, cat, buyPricePerBox, sellPricePerPack, sellPricePerBox) => {
            const id = addProduct(name, unit, ppb, qty, yellowAt, redAt, kw, cat)
            updateProduct(id, { buyPricePerBox, sellPricePerPack, sellPricePerBox })
            schedulePushStock()
          }}
          onClose={() => setShowAdd(false)}
          hiddenCategories={stock.hiddenCategories ?? []}
          onRemoveCategory={c => { removeCategory(c); schedulePushStock() }}
        />
      )}
      {editTarget && (
        <ProductModal
          initial={editTarget}
          onSave={(name, unit, ppb, qty, inc, yellowAt, redAt, kw, cat, buyPricePerBox, sellPricePerPack, sellPricePerBox) => {
            updateProduct(editTarget.id, { name, unit, packsPerBox: ppb, qty, qtyIncoming: inc, yellowAt, redAt, goodsKeyword: kw, category: cat, buyPricePerBox, sellPricePerPack, sellPricePerBox })
            schedulePushStock()
          }}
          onClose={() => setEditTarget(null)}
          hiddenCategories={stock.hiddenCategories ?? []}
          onRemoveCategory={c => { removeCategory(c); schedulePushStock() }}
        />
      )}
      {showSync && (
        <SyncModal
          preview={syncPreview}
          pendingDates={Array.from(selectedSyncDates)}
          onConfirm={handleConfirmSync}
          onClose={() => setShowSync(false)}
        />
      )}
      {showSnapshot && (
        <InventorySnapshotModal
          items={snapshotItems}
          date={snapshotDate}
          unmatched={snapshotUnmatch}
          onConfirm={() => { applyInventorySnapshot(snapshotItems, snapshotDate); schedulePushStock() }}
          onClose={() => setShowSnapshot(false)}
        />
      )}
      {syncProduct && (
        <SyncModal
          preview={productSyncPreview}
          pendingDates={productSyncPreview.map(i => i.date).filter((d, i, a) => a.indexOf(d) === i)}
          onConfirm={() => { applySyncProduct(productSyncPreview); schedulePushStock() }}
          onClose={() => setSyncProduct(null)}
        />
      )}
    </div>
    </>
  )
}
