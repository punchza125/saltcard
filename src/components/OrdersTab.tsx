import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Plus, Package, CheckCircle2, Clock, Truck,
  ChevronDown, X, Pencil, Trash2, Search,
  Cloud, CloudOff, RefreshCw, Loader2, Copy, ExternalLink, Check, Plane,
} from 'lucide-react'
import type { PurchaseOrder, OrderItem, OrderStatus, StockProduct, OrderMember, CarrierId, ShipMethod } from '../types'
import { ORDER_MEMBERS, CARRIERS } from '../types'
import { useOrderStore } from '../hooks/useOrderStore'
import { formatThaiDate } from '../utils/parser'

// ── helpers ──────────────────────────────────────────────────────────────────

const STATUS_META: Record<OrderStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  ordered:    { label: 'รอรับสินค้า', color: 'text-amber-600',   bg: 'bg-amber-50 border-amber-200',     icon: <Clock size={10} />        },
  in_transit: { label: 'รอรับสินค้า', color: 'text-amber-600',   bg: 'bg-amber-50 border-amber-200',     icon: <Clock size={10} />        },
  received:   { label: 'รับแล้ว',     color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', icon: <CheckCircle2 size={10} /> },
}

// ขนาด/ตำแหน่ง viewport จริงตอนคีย์บอร์ดมือถือเปิด — ใช้วาง modal ให้ปุ่มบันทึกไม่โดนบัง
function useVisualViewport(): { height: number; top: number } | null {
  const [vv, setVv] = useState<{ height: number; top: number } | null>(null)
  useEffect(() => {
    const v = window.visualViewport
    if (!v) return
    const upd = () => setVv({ height: v.height, top: v.offsetTop })
    upd()
    v.addEventListener('resize', upd)
    v.addEventListener('scroll', upd)
    return () => {
      v.removeEventListener('resize', upd)
      v.removeEventListener('scroll', upd)
    }
  }, [])
  return vv
}

// ระหว่างเปิด modal ให้ body มีคลาส modal-open (ใช้ซ่อน bottom nav ตอนคีย์บอร์ดเปิด)
function useModalBodyClass() {
  useEffect(() => {
    document.body.classList.add('modal-open')
    return () => document.body.classList.remove('modal-open')
  }, [])
}

// ── CreateOrderModal ──────────────────────────────────────────────────────────

function CreateOrderModal({
  products,
  onClose,
  onSave,
  initial,
}: {
  products: StockProduct[]
  onClose: () => void
  onSave: (data: Omit<PurchaseOrder, 'id' | 'createdAt' | 'status'>) => void
  initial?: PurchaseOrder
}) {
  const [orderedBy, setOrderedBy] = useState<OrderMember | undefined>(initial?.orderedBy)
  const [supplier, setSupplier] = useState(initial?.supplier ?? '')
  const [shipMethod, setShipMethod] = useState<ShipMethod | undefined>(initial?.shipMethod)
  const [notes,    setNotes]    = useState(initial?.notes ?? '')
  const [items,    setItems]    = useState<OrderItem[]>(
    initial?.items ?? [{ name: '', qty: 1, unit: 'Box' }]
  )
  const [search,   setSearch]   = useState('')
  const [openIdx,  setOpenIdx]  = useState<number | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // ค้นแบบแยกคำ: ทุกคำต้องเจอในชื่อ/หมวด/keyword (ไม่สนลำดับ) และไม่จำกัดแค่ 8 รายการ
  const searchTokens = search.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const filtered = products.filter(p => {
    if (searchTokens.length === 0) return true
    const hay = `${p.name} ${p.category} ${p.goodsKeyword}`.toLowerCase()
    return searchTokens.every(t => hay.includes(t))
  }).slice(0, 30)

  function setItem(i: number, patch: Partial<OrderItem>) {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it))
  }

  function addItem() {
    setItems(prev => [...prev, { name: '', qty: 1, unit: 'Box' }])
    setTimeout(() => setOpenIdx(items.length), 50)
  }

  function removeItem(i: number) {
    setItems(prev => prev.filter((_, idx) => idx !== i))
  }

  function pickProduct(i: number, p: StockProduct) {
    setItem(i, { productId: p.id, name: p.name, unit: p.unit })
    setSearch('')
    setOpenIdx(null)
  }

  const canSave = items.some(it => it.name.trim() && it.qty > 0)

  function handleSave() {
    const validItems = items.filter(it => it.name.trim() && it.qty > 0)
    onSave({ orderedBy, supplier: supplier.trim() || undefined, shipMethod, notes: notes.trim() || undefined, items: validItems })
    onClose()
  }

  const vv = useVisualViewport()
  useModalBodyClass()

  return createPortal((
    <div className="fixed inset-0 z-[100] bg-black/40">
      <div className="absolute inset-x-0 flex items-end md:items-center justify-center"
        style={vv ? { top: vv.top, height: vv.height } : { top: 0, height: '100%' }}>
      <div className="bg-white w-full md:max-w-lg rounded-t-3xl md:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col"
        style={vv ? { maxHeight: vv.height * 0.96 } : undefined}>
        {/* header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
          <p className="text-[15px] font-bold text-brand-dark">
            {initial ? 'แก้ไขรายการสั่งซื้อ' : 'สั่งซื้อใหม่'}
          </p>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-brand-pale flex items-center justify-center">
            <X size={15} className="text-brand-dark/50" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 pb-4 space-y-4"
          onFocusCapture={e => {
            // เลื่อนช่องที่โฟกัสให้ขึ้นมาอยู่กลางพื้นที่ที่มองเห็น หลังคีย์บอร์ดเด้งขึ้น
            const el = e.target as HTMLElement
            setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300)
          }}>

          {/* ordered by */}
          <div>
            <label className="text-[11px] font-semibold text-brand-dark/40 uppercase tracking-wider">ผู้สั่ง</label>
            <div className="flex gap-2 mt-1.5 flex-wrap">
              {ORDER_MEMBERS.map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setOrderedBy(orderedBy === m ? undefined : m)}
                  className={`px-4 py-2 rounded-xl text-[13px] font-semibold transition-all ${
                    orderedBy === m
                      ? 'bg-brand-blue text-white shadow-sm shadow-brand-blue/30'
                      : 'bg-brand-pale text-brand-dark/60 hover:bg-brand-blue/10'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* supplier */}
          <div>
            <label className="text-[11px] font-semibold text-brand-dark/40 uppercase tracking-wider">Supplier</label>
            <input
              value={supplier}
              onChange={e => setSupplier(e.target.value)}
              placeholder="ชื่อ supplier (ไม่บังคับ)"
              className="mt-1.5 w-full border border-brand-blue/15 rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-brand-blue"
            />
          </div>

          {/* ship method */}
          <div>
            <label className="text-[11px] font-semibold text-brand-dark/40 uppercase tracking-wider">แหล่งที่มา</label>
            <div className="flex gap-2 mt-1.5">
              <button type="button"
                onClick={() => setShipMethod(undefined)}
                className={`flex-1 py-2 rounded-xl text-[13px] font-semibold transition-all ${
                  !shipMethod
                    ? 'bg-brand-blue text-white shadow-sm shadow-brand-blue/30'
                    : 'bg-brand-pale text-brand-dark/60 hover:bg-brand-blue/10'
                }`}
              >ในประเทศ</button>
              <button type="button"
                onClick={() => setShipMethod('air')}
                className={`flex-1 py-2 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  shipMethod === 'air'
                    ? 'bg-sky-500 text-white shadow-sm shadow-sky-500/30'
                    : 'bg-brand-pale text-brand-dark/60 hover:bg-sky-50'
                }`}
              ><Plane size={13} /> นำเข้าทางเครื่องบิน</button>
            </div>
          </div>

          {/* items */}
          <div>
            <label className="text-[11px] font-semibold text-brand-dark/40 uppercase tracking-wider">รายการสินค้า</label>
            <div className="mt-1.5 space-y-2">
              {items.map((item, i) => (
                <div key={i} className="border border-brand-blue/10 rounded-xl overflow-hidden">
                  {/* product name row */}
                  <div className="relative">
                    <button
                      onClick={() => { setOpenIdx(openIdx === i ? null : i); setSearch('') }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
                    >
                      <Search size={13} className="text-brand-dark/30 flex-shrink-0" />
                      <span className={`flex-1 text-[13px] truncate ${item.name ? 'text-brand-dark' : 'text-brand-dark/30'}`}>
                        {item.name || 'เลือกหรือพิมพ์ชื่อสินค้า'}
                      </span>
                      <ChevronDown size={13} className={`text-brand-dark/30 transition-transform ${openIdx === i ? 'rotate-180' : ''}`} />
                    </button>

                    {/* dropdown */}
                    {openIdx === i && (
                      <div className="border-t border-brand-blue/10 bg-brand-pale/30">
                        <div className="px-3 py-2">
                          <input
                            ref={searchRef}
                            autoFocus
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="ค้นหา..."
                            className="w-full bg-white border border-brand-blue/15 rounded-lg px-2.5 py-1.5 text-[12px] outline-none focus:border-brand-blue"
                          />
                        </div>
                        <div className="max-h-[240px] overflow-y-auto">
                          {search && !filtered.some(p => p.name.toLowerCase() === search.toLowerCase()) && (
                            <button
                              onClick={() => { setItem(i, { name: search, productId: undefined }); setSearch(''); setOpenIdx(null) }}
                              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white text-left text-[12px]"
                            >
                              <Plus size={12} className="text-brand-blue flex-shrink-0" />
                              <span className="text-brand-blue font-medium">เพิ่ม "{search}" เป็นสินค้าใหม่</span>
                            </button>
                          )}
                          {filtered.map(p => (
                            <button
                              key={p.id}
                              onClick={() => pickProduct(i, p)}
                              className="w-full flex items-center justify-between px-3 py-2 hover:bg-white text-left text-[12px] gap-2"
                            >
                              <span className="text-brand-dark truncate">{p.name}</span>
                              <span className="text-brand-dark/30 flex-shrink-0 text-[10px]">{p.category}</span>
                            </button>
                          ))}
                          {filtered.length === 0 && !search && (
                            <p className="px-3 py-3 text-[11px] text-brand-dark/30">พิมพ์เพื่อค้นหาหรือเพิ่มสินค้าใหม่</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* qty + unit + remove */}
                  <div className="flex items-center gap-2 px-3 py-2 border-t border-brand-blue/8 bg-brand-pale/20">
                    <span className="text-[11px] text-brand-dark/40 w-8">จำนวน</span>
                    <input
                      type="number" min="1" inputMode="numeric"
                      value={item.qty === 0 ? '' : item.qty}
                      onFocus={e => e.target.select()}
                      onChange={e => {
                        const v = e.target.value
                        // ปล่อยให้ลบจนว่างได้ (เก็บเป็น 0 ชั่วคราว) — ไม่งั้นพิมพ์ 2 จะกลายเป็น 12
                        setItem(i, { qty: v === '' ? 0 : Math.max(0, Math.floor(Number(v)) || 0) })
                      }}
                      className="w-16 text-center border border-brand-blue/15 rounded-lg px-2 py-1 text-[13px] font-semibold outline-none focus:border-brand-blue"
                    />
                    <select
                      value={item.unit}
                      onChange={e => setItem(i, { unit: e.target.value })}
                      className="flex-1 border border-brand-blue/15 rounded-lg px-2 py-1 text-[12px] bg-white outline-none focus:border-brand-blue"
                    >
                      {['Box', 'Pack', 'Carton', 'ชิ้น'].map(u => <option key={u}>{u}</option>)}
                    </select>
                    {items.length > 1 && (
                      <button onClick={() => removeItem(i)} className="text-red-300 hover:text-red-500 transition-colors">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              <button onClick={addItem}
                className="w-full py-2 border border-dashed border-brand-blue/20 rounded-xl text-[12px] text-brand-blue/60 hover:text-brand-blue hover:border-brand-blue/40 flex items-center justify-center gap-1.5 transition-colors">
                <Plus size={13} /> เพิ่มสินค้า
              </button>
            </div>
          </div>

          {/* notes */}
          <div>
            <label className="text-[11px] font-semibold text-brand-dark/40 uppercase tracking-wider">หมายเหตุ</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="หมายเหตุ (ไม่บังคับ)"
              className="mt-1.5 w-full border border-brand-blue/15 rounded-xl px-3 py-2.5 text-[13px] resize-none outline-none focus:border-brand-blue"
            />
          </div>
        </div>

        {/* footer */}
        <div className="px-5 pb-5 pt-2 flex-shrink-0 border-t border-brand-blue/8">
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="w-full py-3 bg-brand-blue text-white rounded-xl font-semibold text-[14px] disabled:opacity-40 active:scale-[0.98] transition-all"
          >
            {initial ? 'บันทึกการแก้ไข' : 'สร้างรายการสั่งซื้อ'}
          </button>
        </div>
      </div>
      </div>
    </div>
  ), document.body)
}

// ── TrackingModal ─────────────────────────────────────────────────────────────

function TrackingModal({ order, onClose, onSave }: {
  order: PurchaseOrder
  onClose: () => void
  onSave: (carrier: CarrierId, tracking: string) => void
}) {
  const [carrier,  setCarrier]  = useState<CarrierId>(order.carrier ?? 'kerry')
  const [tracking, setTracking] = useState(order.trackingNumber ?? '')
  const vv = useVisualViewport()
  useModalBodyClass()

  return createPortal((
    <div className="fixed inset-0 z-[100] bg-black/40">
      <div className="absolute inset-x-0 flex items-end md:items-center justify-center"
        style={vv ? { top: vv.top, height: vv.height } : { top: 0, height: '100%' }}>
      <div className="bg-white w-full md:max-w-sm rounded-t-3xl md:rounded-2xl shadow-2xl p-5 overflow-y-auto"
        style={vv ? { maxHeight: vv.height * 0.96 } : undefined}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-[14px] font-bold text-brand-dark">ใส่เลข Tracking</p>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-brand-pale flex items-center justify-center">
            <X size={15} className="text-brand-dark/50" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-semibold text-brand-dark/40 uppercase tracking-wider">บริษัทขนส่ง</label>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              {CARRIERS.map(c => (
                <button key={c.id} onClick={() => setCarrier(c.id as CarrierId)}
                  className={`py-2 px-3 rounded-xl text-[12px] font-medium border transition-all text-left ${
                    carrier === c.id
                      ? 'bg-brand-blue text-white border-brand-blue'
                      : 'bg-white border-brand-blue/15 text-brand-dark/60 hover:border-brand-blue/40'
                  }`}
                >{c.label}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-brand-dark/40 uppercase tracking-wider">เลข Tracking</label>
            <input
              autoFocus
              value={tracking}
              onChange={e => setTracking(e.target.value)}
              placeholder="EG123456789TH"
              className="mt-1.5 w-full border border-brand-blue/15 rounded-xl px-3 py-2.5 text-[14px] font-mono outline-none focus:border-brand-blue"
            />
          </div>
        </div>
        <button
          onClick={() => { if (tracking.trim()) { onSave(carrier, tracking.trim()); onClose() } }}
          disabled={!tracking.trim()}
          className="mt-4 w-full py-3 bg-brand-blue text-white rounded-xl font-semibold text-[14px] disabled:opacity-40 active:scale-[0.98] transition-all"
        >
          บันทึก Tracking
        </button>
      </div>
      </div>
    </div>
  ), document.body)
}

// ── OrderCard ────────────────────────────────────────────────────────────────

function OrderCard({
  order, products, onDelete, onEdit, onSetTracking, onMarkReceived,
}: {
  order: PurchaseOrder
  products: StockProduct[]
  onDelete: () => void
  onEdit: () => void
  onSetTracking: () => void
  onMarkReceived: () => void
}) {
  const [copied, setCopied] = useState(false)
  const meta    = STATUS_META[order.status]
  const carrier = CARRIERS.find(c => c.id === order.carrier)

  function handleCopy() {
    if (!order.trackingNumber) return
    navigator.clipboard.writeText(order.trackingNumber).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function openTracking() {
    if (!carrier || !order.trackingNumber) return
    const url = carrier.trackUrl(order.trackingNumber)
    if (url) window.open(url, '_blank')
  }

  return (
    <div className={`rounded-xl border overflow-hidden transition-all ${
      order.status === 'received' ? 'opacity-60' : ''
    } ${meta.bg}`}>

      {/* header row */}
      <div className="flex items-center justify-between px-3 pt-2 pb-1.5 gap-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className={`text-[10px] font-bold flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border flex-shrink-0 ${meta.bg} ${meta.color}`}>
            {meta.icon} {meta.label}
          </span>
          {order.shipMethod === 'air' && (
            <span className="text-[10px] font-bold flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border border-sky-200 bg-sky-50 text-sky-600 flex-shrink-0">
              <Plane size={10} /> เครื่องบิน
            </span>
          )}
          <span className="text-[10px] text-brand-dark/40 truncate">
            {formatThaiDate(order.createdAt)}
            {order.orderedBy && <span className="text-brand-blue/70 font-medium"> · {order.orderedBy}</span>}
            {order.supplier && <span className="text-brand-dark/30"> · {order.supplier}</span>}
            {order.receivedAt && <span> · รับ {formatThaiDate(order.receivedAt)}</span>}
          </span>
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {order.status !== 'received' && (
            <button onClick={onEdit} className="w-6 h-6 rounded-full hover:bg-white/60 flex items-center justify-center transition-colors">
              <Pencil size={10} className="text-brand-dark/30" />
            </button>
          )}
          <button onClick={() => { if (confirm('ลบรายการนี้?')) onDelete() }}
            className="w-6 h-6 rounded-full hover:bg-red-100 flex items-center justify-center transition-colors">
            <Trash2 size={10} className="text-red-300 hover:text-red-500" />
          </button>
        </div>
      </div>

      {/* items */}
      <div className="px-3 pb-1.5 space-y-0.5">
        {order.items.map((item, i) => {
          const product = products.find(p => p.id === item.productId)
          return (
            <div key={i} className="flex items-center gap-1.5 text-[11px]">
              <span className="w-1 h-1 rounded-full bg-brand-dark/20 flex-shrink-0" />
              <span className="text-brand-dark/70 flex-1 truncate">{item.name}</span>
              <span className="font-semibold text-brand-dark flex-shrink-0">{item.qty} {item.unit}</span>
              {product && <span className="text-[10px] text-brand-dark/25 flex-shrink-0">{product.category}</span>}
            </div>
          )
        })}
        {order.notes && (
          <p className="text-[10px] text-brand-dark/35 italic">{order.notes}</p>
        )}
      </div>

      {/* tracking row */}
      {order.status !== 'received' && (
        <div className="px-3 pb-1.5 space-y-1.5">
          {order.trackingNumber ? (
            <div className="flex items-center gap-1.5 bg-white/60 rounded-lg px-2 py-1 border border-blue-100">
              <Truck size={10} className="text-blue-400 flex-shrink-0" />
              <span className="text-[10px] text-brand-dark/35 flex-shrink-0">{carrier?.label}</span>
              <span className="text-[10px] font-mono font-semibold text-brand-dark flex-1 truncate">{order.trackingNumber}</span>
              <button onClick={handleCopy} title="คัดลอก" className="w-5 h-5 flex items-center justify-center text-brand-dark/30 hover:text-brand-dark transition-colors">
                {copied ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} />}
              </button>
              {carrier?.trackUrl(order.trackingNumber) && (
                <button onClick={openTracking} title="เปิดเว็บขนส่ง" className="w-5 h-5 flex items-center justify-center text-brand-dark/30 hover:text-brand-dark transition-colors">
                  <ExternalLink size={10} />
                </button>
              )}
              <button onClick={onSetTracking} title="แก้ไข" className="w-5 h-5 flex items-center justify-center text-brand-dark/30 hover:text-brand-dark transition-colors">
                <Pencil size={10} />
              </button>
            </div>
          ) : (
            <button onClick={onSetTracking}
              className="w-full flex items-center justify-center gap-1 py-1 text-[10px] font-medium text-brand-blue/70 border border-dashed border-brand-blue/20 rounded-lg hover:border-brand-blue/40 hover:text-brand-blue transition-colors">
              <Truck size={10} /> ใส่เลข Tracking
            </button>
          )}
        </div>
      )}

      {/* confirm button */}
      {order.status !== 'received' && (
        <div className="px-3 pb-2.5">
          <button onClick={onMarkReceived}
            className="w-full flex items-center justify-center gap-1 py-1.5 bg-emerald-500 text-white text-[11px] font-semibold rounded-lg hover:bg-emerald-600 active:scale-95 transition-all">
            <CheckCircle2 size={11} /> ยืนยันรับสินค้า
          </button>
        </div>
      )}
    </div>
  )
}

// ── OrdersTab (main) ─────────────────────────────────────────────────────────

type FilterTab = 'all' | 'pending' | 'received'

export default function OrdersTab({ products }: {
  products: StockProduct[]
}) {
  const {
    orders, updateOrder, setTracking,
    receiveOrder, createOrderWithStock, deleteOrderWithStock,
  } = useOrderStore()
  const [filter,     setFilter]     = useState<FilterTab>('all')
  const [airOnly,    setAirOnly]    = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [editOrder,  setEditOrder]  = useState<PurchaseOrder | null>(null)
  const [trackOrder, setTrackOrder] = useState<PurchaseOrder | null>(null)

  // Firestore เขียนแล้วเห็นผลทันที (optimistic) + queue ให้เองตอนออฟไลน์
  // popup นี้แค่บอกว่ากำลังยืนยันกับ server และแจ้งถ้าพลาด
  const [saving,     setSaving]     = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [opError,    setOpError]    = useState<string | null>(null)

  /** ครอบ transaction: ขึ้น popup กำลังบันทึก → สำเร็จ/พลาด */
  async function withSaving(fn: () => Promise<void>) {
    setSaving(true); setOpError(null)
    try {
      await fn()
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 900)
    } catch (e) {
      setOpError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const isPending = (o: PurchaseOrder) => o.status === 'ordered' || o.status === 'in_transit'

  const filtered = orders.filter(o => {
    if (airOnly && o.shipMethod !== 'air') return false
    if (filter === 'received') return o.status === 'received'
    if (filter === 'pending') return isPending(o)
    return isPending(o) // 'all' แสดงเฉพาะรอรับ ไม่รวมรับแล้ว
  })

  const counts = {
    all:      orders.filter(isPending).length,
    pending:  orders.filter(isPending).length,
    received: orders.filter(o => o.status === 'received').length,
  }

  const TABS: { id: FilterTab; label: string; count: number }[] = [
    { id: 'all',      label: 'รอรับ',    count: counts.all },
    { id: 'received', label: 'รับแล้ว',  count: counts.received },
  ]

  return (
    <div className="px-4 md:px-6 py-4 max-w-2xl mx-auto">

      {/* popup ระหว่าง/หลังบันทึกลง Firebase */}
      {(saving || savedFlash || opError) && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-2xl shadow-2xl px-10 py-7 flex flex-col items-center gap-3 animate-pop-in max-w-[300px] text-center">
            {saving ? (
              <>
                <img src="/pic/doraemonGif.gif" alt="saving" className="w-24 h-24 object-contain" />
                <p className="text-[14px] font-semibold text-brand-dark flex items-center gap-1.5">
                  <Loader2 size={14} className="animate-spin text-brand-blue" /> กำลังบันทึกข้อมูล...
                </p>
              </>
            ) : opError ? (
              <>
                <div className="w-11 h-11 rounded-full bg-red-100 flex items-center justify-center">
                  <CloudOff size={22} className="text-red-500" />
                </div>
                <p className="text-[14px] font-semibold text-red-600">บันทึกไม่สำเร็จ</p>
                <p className="text-[11px] text-brand-dark/50 leading-relaxed">{opError}</p>
                <button onClick={() => setOpError(null)}
                  className="mt-1 px-5 py-2 rounded-xl bg-brand-blue text-white text-[13px] font-semibold active:scale-95 transition-all">
                  ปิด
                </button>
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
      )}

      {/* top bar */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-bold text-brand-dark">ติดตามสินค้า</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 bg-brand-blue text-white text-[12px] font-semibold px-3.5 py-2 rounded-xl hover:bg-brand-light active:scale-95 transition-all"
        >
          <Plus size={14} /> สั่งซื้อใหม่
        </button>
      </div>

      {/* filter tabs */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex gap-1 bg-brand-pale/50 p-1 rounded-xl flex-1">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setFilter(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
                filter === tab.id ? 'bg-white text-brand-dark shadow-sm' : 'text-brand-dark/50 hover:text-brand-dark'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  filter === tab.id ? 'bg-brand-blue text-white' : 'bg-brand-dark/10 text-brand-dark/50'
                }`}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>
        <button onClick={() => setAirOnly(v => !v)}
          className={`flex-shrink-0 flex items-center gap-1 px-3 py-2 rounded-xl text-[12px] font-medium border transition-all ${
            airOnly
              ? 'bg-sky-500 text-white border-transparent'
              : 'bg-white text-brand-dark/50 border-brand-blue/15 hover:border-sky-300 hover:text-sky-500'
          }`}
        >
          <Plane size={13} /> เครื่องบิน
        </button>
      </div>

      {/* order list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 bg-brand-pale rounded-2xl flex items-center justify-center mb-3">
            <Package size={24} className="text-brand-blue/30" />
          </div>
          <p className="text-[14px] font-semibold text-brand-dark/50">ยังไม่มีรายการ</p>
          <p className="text-[12px] text-brand-dark/30 mt-1">กด "+ สั่งซื้อใหม่" เพื่อเริ่มต้น</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              products={products}
              onDelete={() => withSaving(() => deleteOrderWithStock(order, products))}
              onEdit={() => setEditOrder(order)}
              onSetTracking={() => setTrackOrder(order)}
              onMarkReceived={() => withSaving(() => receiveOrder(order, products))}
            />
          ))}
        </div>
      )}

      {/* modals */}
      {showCreate && (
        <CreateOrderModal
          products={products}
          onClose={() => setShowCreate(false)}
          onSave={data => withSaving(async () => { await createOrderWithStock(data, products) })}
        />
      )}
      {editOrder && (
        <CreateOrderModal
          products={products}
          initial={editOrder}
          onClose={() => setEditOrder(null)}
          onSave={data => withSaving(async () => { updateOrder(editOrder.id, data) })}
        />
      )}
      {trackOrder && (
        <TrackingModal
          order={trackOrder}
          onClose={() => setTrackOrder(null)}
          onSave={(carrier, tracking) => withSaving(async () => { setTracking(trackOrder.id, carrier, tracking) })}
        />
      )}
    </div>
  )
}
