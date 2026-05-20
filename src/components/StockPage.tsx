import { useState, useMemo, useRef, useEffect } from 'react'
import {
  Plus, Pencil, Trash2, ArrowUp, ArrowDown,
  ChevronDown, ChevronUp, X, Check, RefreshCw, AlertTriangle, Upload,
} from 'lucide-react'
import type { StockProduct, StockUnit, DayReport } from '../types'
import { useStockStore, type SyncPreviewItem, type InventorySnapshotItem } from '../hooks/useStockStore'
import { formatThaiDate, parseInventoryReport } from '../utils/parser'

const UNITS: StockUnit[] = ['Box', 'Pack', 'Carton', 'ชิ้น']

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
function ProductModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: StockProduct
  onSave: (
    name: string, unit: StockUnit, packsPerBox: number,
    qty: number, qtyIncoming: number, yellowAt: number, redAt: number, goodsKeyword: string, category: string
  ) => void
  onClose: () => void
}) {
  const [name,        setName]        = useState(initial?.name          ?? '')
  const [unit,        setUnit]        = useState<StockUnit>(initial?.unit ?? 'Box')
  const [packsPerBox, setPacksPerBox] = useState(String(initial?.packsPerBox ?? 24))
  const [qtyInput,    setQtyInput]    = useState(() => {
    if (!initial) return '0'
    const p = initial.packsPerBox
    return p > 0 ? String(Math.round(initial.qty / p * 1000) / 1000) : String(initial.qty)
  })
  const [incomingInput, setIncomingInput] = useState(() => {
    if (!initial) return '0'
    const p = initial.packsPerBox
    return p > 0 ? String(Math.round((initial.qtyIncoming ?? 0) / p * 1000) / 1000) : String(initial.qtyIncoming ?? 0)
  })
  const [yellowAt,    setYellowAt]    = useState(String(initial?.yellowAt    ?? 120))
  const [redAt,       setRedAt]       = useState(String(initial?.redAt       ?? 48))
  const [keyword,     setKeyword]     = useState(initial?.goodsKeyword       ?? '')
  const [category,    setCategory]    = useState(initial?.category           ?? '')
  const [error,       setError]       = useState('')

  const ppb = Number(packsPerBox)
  const hasConversion = ppb > 0

  function boxHint(packs: string) {
    const n = Number(packs)
    if (!hasConversion || isNaN(n) || n <= 0) return ''
    return ` (≈ ${(n / ppb).toFixed(1)} Box)`
  }

  function handleSave() {
    if (!name.trim()) return setError('กรุณาใส่ชื่อสินค้า')
    const y = Number(yellowAt), r = Number(redAt), raw = Number(qtyInput), rawInc = Number(incomingInput)
    if (isNaN(y) || isNaN(r) || isNaN(raw) || isNaN(rawInc)) return setError('กรุณาใส่ตัวเลขให้ถูกต้อง')
    if (r >= y) return setError('ขีดแดงต้องน้อยกว่าขีดเหลือง')
    const q   = hasConversion ? Math.round(raw * ppb)    : raw
    const inc = hasConversion ? Math.round(rawInc * ppb) : rawInc
    onSave(name.trim(), unit, ppb < 0 ? 0 : ppb, q, inc, y, r, keyword.trim(), category)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-brand-dark text-[15px]">
            {initial ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'}
          </h3>
          <button onClick={onClose} className="text-brand-dark/40 hover:text-brand-dark"><X size={18} /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[12px] text-brand-dark/60 mb-1 block">ชื่อสินค้า</label>
            <input
              className="w-full border border-brand-blue/20 rounded-lg px-3 py-2 text-[13px] outline-none focus:border-brand-blue"
              value={name} onChange={e => setName(e.target.value)}
              placeholder="เช่น One Piece OP-15"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[12px] text-brand-dark/60 mb-1 block">หน่วยที่ซื้อ</label>
              <select
                className="w-full border border-brand-blue/20 rounded-lg px-3 py-2 text-[13px] outline-none focus:border-brand-blue bg-white"
                value={unit} onChange={e => setUnit(e.target.value as StockUnit)}
              >
                {UNITS.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[12px] text-brand-dark/60 mb-1 block">Pack ต่อ 1 {unit}</label>
              <input
                type="number" min={0}
                className="w-full border border-brand-blue/20 rounded-lg px-3 py-2 text-[13px] outline-none focus:border-brand-blue"
                value={packsPerBox} onChange={e => setPacksPerBox(e.target.value)}
                placeholder="0 = ไม่แปลง"
              />
            </div>
          </div>

          {hasConversion && (
            <p className="text-[11px] text-brand-blue/60 bg-brand-pale/50 rounded-lg px-3 py-2">
              1 {unit} = {ppb} Pack — ระบบเก็บสต๊อกเป็น Pack และแปลงกลับให้อัตโนมัติ
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[12px] text-brand-dark/60 mb-1 block">
                ในมือ ({hasConversion ? unit : 'Pack'})
              </label>
              <input
                type="number" min={0}
                className="w-full border border-brand-blue/20 rounded-lg px-3 py-2 text-[13px] outline-none focus:border-brand-blue"
                value={qtyInput} onChange={e => setQtyInput(e.target.value)}
              />
              {hasConversion && Number(qtyInput) > 0 && (
                <p className="text-[11px] text-brand-dark/40 mt-1">
                  = {Math.round(Number(qtyInput) * ppb)} Pack
                </p>
              )}
            </div>
            <div>
              <label className="text-[12px] text-blue-500 mb-1 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
                กำลังมา ({hasConversion ? unit : 'Pack'})
              </label>
              <input
                type="number" min={0}
                className="w-full border border-blue-200 rounded-lg px-3 py-2 text-[13px] outline-none focus:border-blue-400"
                value={incomingInput} onChange={e => setIncomingInput(e.target.value)}
              />
              {hasConversion && Number(incomingInput) > 0 && (
                <p className="text-[11px] text-blue-400/60 mt-1">
                  = {Math.round(Number(incomingInput) * ppb)} Pack
                </p>
              )}
            </div>
          </div>

          {/* category */}
          <div>
            <label className="text-[12px] text-brand-dark/60 mb-1.5 block">หมวดหมู่</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map(c => (
                <button key={c} type="button"
                  onClick={() => setCategory(category === c ? '' : c)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
                    category === c
                      ? 'bg-brand-blue text-white border-transparent'
                      : 'bg-white text-brand-dark/60 border-brand-blue/20 hover:border-brand-blue/40'
                  }`}
                >{c}</button>
              ))}
            </div>
          </div>

          {/* keyword */}
          <div>
            <label className="text-[12px] text-brand-dark/60 mb-1 block">
              Keyword จับคู่รายงาน
              <span className="ml-1 text-brand-dark/30">(ไม่บังคับ)</span>
            </label>
            <input
              className="w-full border border-brand-blue/20 rounded-lg px-3 py-2 text-[13px] outline-none focus:border-brand-blue font-mono"
              value={keyword} onChange={e => setKeyword(e.target.value)}
              placeholder='เช่น "PRB-02" หรือ "OP-15"'
            />
            <p className="text-[10px] text-brand-dark/30 mt-1">
              ระบบจะค้นหา keyword นี้ในชื่อสินค้าของ Goods Aspect แล้วหักสต๊อกอัตโนมัติ
            </p>
          </div>

          <div className="bg-brand-pale/50 rounded-xl p-3 space-y-2">
            <p className="text-[11px] text-brand-dark/50 font-medium">ขีดเตือน (Pack)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[12px] text-yellow-600 mb-1 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> ใกล้หมด (≤)
                </label>
                <input
                  type="number" min={0}
                  className="w-full border border-yellow-200 rounded-lg px-3 py-2 text-[13px] outline-none focus:border-yellow-400"
                  value={yellowAt} onChange={e => setYellowAt(e.target.value)}
                />
                <p className="text-[10px] text-brand-dark/30 mt-0.5">{boxHint(yellowAt)}</p>
              </div>
              <div>
                <label className="text-[12px] text-red-500 mb-1 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> กำลังจะหมด (≤)
                </label>
                <input
                  type="number" min={0}
                  className="w-full border border-red-200 rounded-lg px-3 py-2 text-[13px] outline-none focus:border-red-400"
                  value={redAt} onChange={e => setRedAt(e.target.value)}
                />
                <p className="text-[10px] text-brand-dark/30 mt-0.5">{boxHint(redAt)}</p>
              </div>
            </div>
          </div>

          {error && <p className="text-red-500 text-[12px]">{error}</p>}
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-brand-blue/20 text-[13px] text-brand-dark/60 hover:bg-brand-pale/50">
            ยกเลิก
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2 rounded-lg bg-brand-blue text-white text-[13px] font-medium hover:bg-brand-light active:scale-95 transition-all flex items-center justify-center gap-1"
          >
            <Check size={14} /> บันทึก
          </button>
        </div>
      </div>
    </div>
  )
}

// ── LogModal ──────────────────────────────────────────────────────────────────
type LogMode = 'incoming' | 'received' | 'out' | 'adjust'

const LOG_MODES: { key: LogMode; label: string; sub: string; color: string; activeClass: string }[] = [
  {
    key: 'incoming',
    label: 'สั่งมาแล้ว',
    sub: 'รอของมาส่ง',
    color: 'text-blue-600',
    activeClass: 'bg-blue-500 text-white',
  },
  {
    key: 'received',
    label: 'ได้รับของแล้ว',
    sub: 'ของถึงมือแล้ว',
    color: 'text-emerald-600',
    activeClass: 'bg-emerald-500 text-white',
  },
  {
    key: 'out',
    label: 'จ่ายออก',
    sub: 'ขาย / ใช้ไป',
    color: 'text-red-500',
    activeClass: 'bg-red-500 text-white',
  },
  {
    key: 'adjust',
    label: 'ปรับยอด',
    sub: 'ตั้งค่าใหม่',
    color: 'text-purple-600',
    activeClass: 'bg-purple-500 text-white',
  },
]

function LogModal({
  product,
  onLog,
  onClose,
}: {
  product: StockProduct
  onLog: (delta: number, note: string, kind: LogMode, deductIncoming: boolean) => void
  onClose: () => void
}) {
  const [mode,            setMode]            = useState<LogMode>('incoming')
  const [amount,          setAmount]          = useState('1')
  const [note,            setNote]            = useState('')
  const [deductIncoming,  setDeductIncoming]  = useState(true)
  const [adjustTarget,    setAdjustTarget]    = useState<'qty' | 'incoming'>('qty')

  const ppb = product.packsPerBox
  const hasConversion = ppb > 0
  const isBoxInput = mode !== 'out' && hasConversion
  const packCount  = isBoxInput ? Number(amount) * ppb : Number(amount)

  // reset amount to match the target field when entering adjust mode or switching target
  useEffect(() => {
    if (mode === 'adjust') {
      const base = adjustTarget === 'qty' ? product.qty : product.qtyIncoming
      setAmount(hasConversion ? String(Math.round(base / ppb * 1000) / 1000) : String(base))
    } else {
      setAmount('1')
    }
  }, [mode, adjustTarget])

  // adjust delta calculation
  const adjustNewPacks = mode === 'adjust'
    ? (hasConversion ? Math.round(Number(amount) * ppb) : Number(amount))
    : 0
  const adjustCurrentPacks = adjustTarget === 'qty' ? product.qty : product.qtyIncoming
  const adjustDelta = adjustNewPacks - adjustCurrentPacks

  function handleLog() {
    if (mode === 'adjust') {
      if (amount === '' || isNaN(Number(amount))) return
      if (adjustTarget === 'incoming') {
        onLog(adjustDelta, note.trim() || 'ปรับยอดกำลังมา', 'incoming', false)
      } else {
        onLog(adjustDelta, note.trim(), 'adjust', false)
      }
      onClose()
      return
    }
    const n = Number(amount)
    if (!n || n <= 0) return
    const delta = mode === 'out' ? -packCount : packCount
    onLog(delta, note.trim(), mode, deductIncoming)
    onClose()
  }

  const modeConfig = LOG_MODES.find(m => m.key === mode)!

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5">

        {/* header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold text-brand-dark text-[15px]">{product.name}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[12px] text-brand-dark/50">
                ในมือ <strong className="text-brand-dark">{formatQty(product.qty, ppb)}</strong>
              </span>
              {product.qtyIncoming > 0 && (
                <span className="text-[12px] text-blue-500">
                  · กำลังมา <strong>{formatQty(product.qtyIncoming, ppb)}</strong>
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-brand-dark/40 hover:text-brand-dark mt-0.5"><X size={18} /></button>
        </div>

        {/* mode selector — card style */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {LOG_MODES.map(m => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={`rounded-xl py-2.5 px-1 text-center transition-all border ${
                mode === m.key
                  ? m.activeClass + ' border-transparent shadow-sm'
                  : 'bg-white border-brand-blue/15 hover:bg-brand-pale/50'
              }`}
            >
              <p className={`text-[12px] font-semibold ${mode === m.key ? 'text-white' : m.color}`}>
                {m.label}
              </p>
              <p className={`text-[10px] mt-0.5 ${mode === m.key ? 'text-white/70' : 'text-brand-dark/40'}`}>
                {m.sub}
              </p>
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {/* adjust mode: show current qty + new qty input + diff */}
          {mode === 'adjust' ? (
            <div>
              {/* toggle: ในมือ / กำลังมา */}
              <div className="flex bg-brand-pale/60 rounded-xl p-1 mb-3">
                {(['qty', 'incoming'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setAdjustTarget(t)}
                    className={`flex-1 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
                      adjustTarget === t
                        ? 'bg-white shadow-sm text-purple-600'
                        : 'text-brand-dark/40'
                    }`}
                  >
                    {t === 'qty' ? 'ในมือ' : 'กำลังมา'}
                  </button>
                ))}
              </div>

              <div className="bg-brand-pale/50 rounded-xl px-4 py-3 mb-3 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-brand-dark/40 mb-0.5">
                    {adjustTarget === 'qty' ? 'ในมือปัจจุบัน' : 'กำลังมาปัจจุบัน'}
                  </p>
                  <p className={`text-[18px] font-bold leading-none ${adjustTarget === 'incoming' ? 'text-blue-600' : 'text-brand-dark'}`}>
                    {formatQty(adjustCurrentPacks, ppb)}
                  </p>
                  {ppb > 0 && <p className="text-[10px] text-brand-dark/30 mt-0.5">{adjustCurrentPacks} Pack</p>}
                </div>
                <div className="text-right">
                  {adjustDelta !== 0 && !isNaN(Number(amount)) && (
                    <>
                      <p className={`text-[13px] font-semibold ${adjustDelta > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {adjustDelta > 0 ? '+' : '−'}{ppb > 0 ? formatQty(Math.abs(adjustDelta), ppb) : `${Math.abs(adjustDelta)} Pack`}
                      </p>
                      <p className="text-[10px] text-brand-dark/30">{adjustDelta > 0 ? 'เพิ่มขึ้น' : 'ลดลง'}</p>
                    </>
                  )}
                  {adjustDelta === 0 && !isNaN(Number(amount)) && (
                    <p className="text-[12px] text-brand-dark/30">ไม่มีการเปลี่ยนแปลง</p>
                  )}
                </div>
              </div>
              <label className="text-[12px] text-brand-dark/60 mb-1 block">
                {adjustTarget === 'qty' ? 'ยอดในมือที่มีจริง' : 'ยอดกำลังมาที่แท้จริง'} ({hasConversion ? product.unit : 'Pack'})
              </label>
              <input
                type="number" min={0}
                className="w-full border border-purple-200 focus:border-purple-400 rounded-lg px-3 py-2.5 text-center text-xl font-bold outline-none transition-colors"
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
              {hasConversion && Number(amount) >= 0 && (
                <p className="text-[11px] text-center mt-1 text-brand-dark/40">
                  = {adjustNewPacks} Pack
                </p>
              )}
            </div>
          ) : (
            /* amount for other modes */
            <div>
              <label className="text-[12px] text-brand-dark/60 mb-1 block">
                {mode === 'out' ? 'จำนวน (Pack)' : `จำนวน (${hasConversion ? product.unit : 'Pack'})`}
              </label>
              <input
                type="number" min={1}
                className={`w-full border rounded-lg px-3 py-2.5 text-center text-xl font-bold outline-none transition-colors ${
                  mode === 'incoming' ? 'border-blue-200 focus:border-blue-400'
                  : mode === 'received' ? 'border-emerald-200 focus:border-emerald-400'
                  : 'border-red-200 focus:border-red-400'
                }`}
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
              {isBoxInput && Number(amount) > 0 && (
                <p className="text-[11px] text-center mt-1 text-brand-dark/40">
                  = {packCount} Pack
                </p>
              )}
            </div>
          )}

          {/* deduct incoming toggle — แสดงเมื่อ mode=received และมีของกำลังมา */}
          {mode === 'received' && product.qtyIncoming > 0 && (
            <button
              onClick={() => setDeductIncoming(v => !v)}
              className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 border transition-all text-left ${
                deductIncoming
                  ? 'bg-blue-50 border-blue-200'
                  : 'bg-white border-brand-blue/15'
              }`}
            >
              <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors ${
                deductIncoming ? 'bg-blue-500' : 'border-2 border-brand-dark/20'
              }`}>
                {deductIncoming && <Check size={10} className="text-white" />}
              </div>
              <div>
                <p className="text-[12px] font-medium text-brand-dark">
                  นำมาจากของที่สั่งไว้
                </p>
                <p className="text-[10px] text-brand-dark/40">
                  ตัดออกจาก "กำลังมา" {formatQty(product.qtyIncoming, ppb)} อัตโนมัติ
                </p>
              </div>
            </button>
          )}

          {/* note */}
          <div>
            <label className="text-[12px] text-brand-dark/60 mb-1 block">หมายเหตุ (ไม่บังคับ)</label>
            <input
              className="w-full border border-brand-blue/20 rounded-lg px-3 py-2 text-[13px] outline-none focus:border-brand-blue"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder={
                mode === 'incoming' ? 'เช่น Shopee, Tomokazu Kunii'
                : mode === 'received' ? 'เช่น รับของแล้ว 15 พ.ค.'
                : 'เช่น Facebook: Ken SY'
              }
            />
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-brand-blue/20 text-[13px] text-brand-dark/60">
            ยกเลิก
          </button>
          <button
            onClick={handleLog}
            className={`flex-1 py-2.5 rounded-lg text-white text-[13px] font-semibold active:scale-95 transition-all flex items-center justify-center gap-1.5 ${
              mode === 'incoming' ? 'bg-blue-500 hover:bg-blue-600'
              : mode === 'received' ? 'bg-emerald-500 hover:bg-emerald-600'
              : mode === 'adjust' ? 'bg-purple-500 hover:bg-purple-600'
              : 'bg-red-500 hover:bg-red-600'
            }`}
          >
            <Check size={14} />
            {mode === 'incoming' ? 'บันทึกการสั่ง'
             : mode === 'received' ? 'ยืนยันรับของ'
             : mode === 'adjust' ? (adjustTarget === 'incoming' ? 'ยืนยันปรับกำลังมา' : 'ยืนยันปรับยอด')
             : 'ยืนยันจ่ายออก'}
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
  onLog,
  onSync,
  pendingSyncCount,
  entries,
}: {
  product: StockProduct
  resolvedGoodsName: string | null
  onEdit: () => void
  onDelete: () => void
  onLog: () => void
  onSync: () => void
  pendingSyncCount: number
  entries: ReturnType<typeof useStockStore>['getEntries'] extends (id: string) => infer R ? R : never
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
    const list = [
      `/Img/${product.name} (1 Pack).jpg`,
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
          <button onClick={onLog}
            className="w-6 h-6 flex items-center justify-center rounded-md bg-brand-pale/80 text-brand-blue hover:bg-brand-blue hover:text-white transition-colors"
          ><Plus size={12} /></button>
          {pendingSyncCount > 0 && (
            <button onClick={onSync}
              className="relative w-6 h-6 flex items-center justify-center rounded-md bg-brand-blue/10 text-brand-blue hover:bg-brand-blue hover:text-white transition-colors"
            >
              <RefreshCw size={11} />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-brand-blue text-white text-[7px] font-bold rounded-full flex items-center justify-center">
                {pendingSyncCount}
              </span>
            </button>
          )}
          <button onClick={onEdit}
            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-brand-pale/80 text-brand-dark/30 hover:text-brand-dark transition-colors"
          ><Pencil size={11} /></button>
          <button onClick={() => setOpen(o => !o)}
            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-brand-pale/80 text-brand-dark/30 hover:text-brand-dark transition-colors"
          >{open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}</button>
        </div>
      </div>

      {/* expanded: thresholds + history */}
      {open && (
        <div className="border-t border-brand-blue/8 px-3 pt-2 pb-3 space-y-1.5">
          <p className="text-[10px] text-brand-dark/30 mb-2">
            เหลือง ≤ {formatQty(product.yellowAt, ppb)} · แดง ≤ {formatQty(product.redAt, ppb)}
            {ppb > 0 && ` · 1 ${product.unit} = ${ppb} Pack`}
          </p>
          {entries.length === 0 ? (
            <p className="text-[12px] text-brand-dark/30 text-center py-1">ยังไม่มีประวัติ</p>
          ) : entries.slice(0, 15).map(e => {
            const kindMeta = ENTRY_KIND_LABEL[e.kind ?? 'in']
            const isIncoming = e.kind === 'incoming'
            const isAdjust   = e.kind === 'adjust'
            return (
              <div key={e.id} className="flex items-center gap-2 text-[12px]">
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold flex-shrink-0 ${
                  isIncoming ? 'bg-blue-100 text-blue-500'
                  : isAdjust  ? 'bg-purple-100 text-purple-500'
                  : e.delta > 0 ? 'bg-emerald-100 text-emerald-600'
                  : 'bg-red-100 text-red-500'
                }`}>{kindMeta.label}</span>
                <span className={`font-semibold w-16 text-right flex-shrink-0 ${
                  isIncoming ? 'text-blue-500'
                  : isAdjust  ? 'text-purple-500'
                  : e.delta > 0 ? 'text-emerald-600'
                  : 'text-red-500'
                }`}>
                  {isIncoming ? '+' : e.delta > 0 ? '+' : '−'}
                  {ppb > 0 ? formatQty(Math.abs(e.delta), ppb) : `${Math.abs(e.delta)} Pack`}
                </span>
                <span className="text-brand-dark/40 flex-shrink-0">{e.date}</span>
                <span className="text-brand-dark/50 truncate">{e.note || '—'}</span>
              </div>
            )
          })}
          <button onClick={onDelete} className="mt-1 flex items-center gap-1 text-[11px] text-red-400 hover:text-red-600">
            <Trash2 size={11} /> ลบสินค้านี้
          </button>
        </div>
      )}
    </div>
  )
}

// ── StockPage ─────────────────────────────────────────────────────────────────
interface StockPageProps {
  reports: DayReport[]
}

export default function StockPage({ reports }: StockPageProps) {
  const {
    stock, addProduct, updateProduct, removeProduct, logEntry,
    previewSync, applySync, previewSyncProduct, applySyncProduct,
    getPendingDates, resetSyncedDates,
    previewInventorySnapshot, applyInventorySnapshot,
    getStatus, getEntries,
  } = useStockStore()

  const [showAdd,       setShowAdd]       = useState(false)
  const [editTarget,    setEditTarget]    = useState<StockProduct | null>(null)
  const [logTarget,     setLogTarget]     = useState<StockProduct | null>(null)
  const [filter,        setFilter]        = useState<'all' | 'red' | 'yellow' | 'green'>('all')
  const [catFilter,     setCatFilter]     = useState<string>('ทั้งหมด')
  const [showSync,      setShowSync]      = useState(false)
  const [syncProduct,   setSyncProduct]   = useState<StockProduct | null>(null)

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
  const syncPreview  = useMemo(() => showSync ? previewSync(reports) : [], [showSync, reports, stock])
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
    applySync(syncPreview, pendingDates)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">

      {/* sync banner */}
      {pendingDates.length > 0 ? (
        <button
          onClick={() => setShowSync(true)}
          className="w-full flex items-center gap-3 bg-brand-blue/5 border border-brand-blue/20 rounded-xl px-4 py-3 hover:bg-brand-blue/10 transition-colors text-left"
        >
          <RefreshCw size={16} className="text-brand-blue flex-shrink-0" />
          <div className="flex-1">
            <p className="text-[13px] font-medium text-brand-blue">
              มีรายงาน {pendingDates.length} วันที่รอซิงค์
            </p>
            <p className="text-[11px] text-brand-blue/60">
              {pendingDates.map(d => formatThaiDate(d)).join(', ')}
            </p>
          </div>
          <span className="bg-brand-blue text-white text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0">
            ซิงค์เลย
          </span>
        </button>
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
      )}

      {/* inventory upload button */}
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

      {/* category filter — scrollable */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1 scrollbar-none">
        {(['ทั้งหมด', ...CATEGORIES] as string[]).map(c => {
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
        <button
          onClick={() => setShowAdd(true)}
          className="ml-auto flex items-center gap-1.5 bg-brand-blue hover:bg-brand-light text-white text-[12px] font-medium px-3 py-1.5 rounded-full active:scale-95 transition-all"
        >
          <Plus size={13} /> เพิ่มสินค้า
        </button>
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
            const pendingForProduct = reports.length > 0
              ? previewSyncProduct(reports, p.id).length
              : 0
            return (
              <ProductRow
                key={p.id}
                product={p}
                resolvedGoodsName={resolveGoodsName(p)}
                onEdit={() => setEditTarget(p)}
                onDelete={() => removeProduct(p.id)}
                onLog={() => setLogTarget(p)}
                onSync={() => setSyncProduct(p)}
                pendingSyncCount={pendingForProduct}
                entries={getEntries(p.id)}
              />
            )
          })}
        </div>
      )}

      {/* modals */}
      {showAdd && (
        <ProductModal
          onSave={(name, unit, ppb, qty, inc, yellowAt, redAt, kw, cat) =>
            addProduct(name, unit, ppb, qty, yellowAt, redAt, kw, cat)}
          onClose={() => setShowAdd(false)}
        />
      )}
      {editTarget && (
        <ProductModal
          initial={editTarget}
          onSave={(name, unit, ppb, qty, inc, yellowAt, redAt, kw, cat) =>
            updateProduct(editTarget.id, { name, unit, packsPerBox: ppb, qty, qtyIncoming: inc, yellowAt, redAt, goodsKeyword: kw, category: cat })}
          onClose={() => setEditTarget(null)}
        />
      )}
      {logTarget && (
        <LogModal
          product={logTarget}
          onLog={(delta, note, kind, deductIncoming) =>
            logEntry(logTarget.id, delta, note, kind, undefined, deductIncoming)}
          onClose={() => setLogTarget(null)}
        />
      )}
      {showSync && (
        <SyncModal
          preview={syncPreview}
          pendingDates={pendingDates}
          onConfirm={handleConfirmSync}
          onClose={() => setShowSync(false)}
        />
      )}
      {showSnapshot && (
        <InventorySnapshotModal
          items={snapshotItems}
          date={snapshotDate}
          unmatched={snapshotUnmatch}
          onConfirm={() => applyInventorySnapshot(snapshotItems, snapshotDate)}
          onClose={() => setShowSnapshot(false)}
        />
      )}
      {syncProduct && (
        <SyncModal
          preview={productSyncPreview}
          pendingDates={productSyncPreview.map(i => i.date).filter((d, i, a) => a.indexOf(d) === i)}
          onConfirm={() => applySyncProduct(productSyncPreview)}
          onClose={() => setSyncProduct(null)}
        />
      )}
    </div>
  )
}
