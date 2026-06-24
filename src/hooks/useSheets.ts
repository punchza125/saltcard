import { useState, useCallback } from 'react'
import type { DayReport, PurchaseOrder } from '../types'

export interface SheetsConfig {
  url: string   // Apps Script Web App URL
}

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error'

export function useSheets(config: SheetsConfig | null) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [syncMessage, setSyncMessage] = useState('')
  const [lastSynced, setLastSynced] = useState<string | null>(null)

  const pushReport = useCallback(async (report: DayReport): Promise<boolean> => {
    if (!config?.url) return false
    setSyncStatus('syncing')
    setSyncMessage('กำลังส่งข้อมูลไป Google Sheets...')
    try {
      const base = config.url
      const date = encodeURIComponent(report.date)

      // 1. ลบข้อมูลเดิมของวันนี้
      await fetch(`${base}?action=clear&date=${date}`)

      // 2. ส่ง sales rows (sequential เพื่อป้องกัน conflict)
      for (const site of report.sites) {
        await fetch(`${base}?action=saveRow&type=sales&date=${date}&row=${encodeURIComponent(JSON.stringify(site))}`)
      }

      // 3. ส่ง goods rows (sequential)
      for (const g of report.goods) {
        await fetch(`${base}?action=saveRow&type=goods&date=${date}&row=${encodeURIComponent(JSON.stringify(g))}`)
      }

      // 4. ส่ง payments (รวมจาก areas)
      const pay = report.areas.reduce((acc, a) => ({
        promptAmount:  (acc.promptAmount  || 0) + (a.promptAmount  || 0),
        cashAmount:    (acc.cashAmount    || 0) + (a.cashAmount    || 0),
        mdbAmount:     (acc.mdbAmount     || 0) + (a.mdbAmount     || 0),
        qr30Amount:    (acc.qr30Amount    || 0) + (a.qr30Amount    || 0),
        alipayAmount:  (acc.alipayAmount  || 0) + (a.alipayAmount  || 0),
        wechatAmount:  (acc.wechatAmount  || 0) + (a.wechatAmount  || 0),
        vipAmount:     (acc.vipAmount     || 0) + (a.vipAmount     || 0),
        mifareAmount:  (acc.mifareAmount  || 0) + (a.mifareAmount  || 0),
        paytmAmount:   (acc.paytmAmount   || 0) + (a.paytmAmount   || 0),
      }), {} as Record<string, number>)
      await fetch(`${base}?action=saveRow&type=payments&date=${date}&row=${encodeURIComponent(JSON.stringify(pay))}`)

      // 5. ส่ง meta
      const meta = { fileName: report.fileName, rowsSales: report.sites.length, rowsGoods: report.goods.length }
      await fetch(`${base}?action=saveRow&type=meta&date=${date}&row=${encodeURIComponent(JSON.stringify(meta))}`)

      setSyncStatus('success')
      setSyncMessage(`ส่งข้อมูลวันที่ ${report.date} สำเร็จ ✓`)
      setLastSynced(new Date().toLocaleTimeString('th-TH'))
      return true
    } catch (e) {
      setSyncStatus('error')
      setSyncMessage('เชื่อมต่อ Google Sheets ไม่ได้ ตรวจสอบ URL อีกครั้ง')
      return false
    }
  }, [config])

  const fetchAll = useCallback(async (): Promise<DayReport[] | null> => {
    if (!config?.url) return null
    setSyncStatus('syncing')
    setSyncMessage('กำลังดึงข้อมูลจาก Google Sheets...')
    try {
      const res = await fetch(`${config.url}?action=all`)
      const json = await res.json()
      if (!json.ok) throw new Error(json.error)
      setSyncStatus('success')
      setSyncMessage('ดึงข้อมูลสำเร็จ')
      setLastSynced(new Date().toLocaleTimeString('th-TH'))
      return sheetsDataToReports(json.data)
    } catch (e) {
      setSyncStatus('error')
      setSyncMessage('ดึงข้อมูลไม่สำเร็จ')
      return null
    }
  }, [config])

  const pushStock = useCallback(async (stockData: object): Promise<boolean> => {
    if (!config?.url) return false
    const s = stockData as any
    const payload = { products: s.products ?? [], syncedDates: s.syncedDates ?? [], entries: [] }
    try {
      await fetch(`${config.url}?action=saveStock`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    } catch {}
    try {
      const vRes = await fetch(`${config.url}?action=fetchStock`)
      const rv = await vRes.json()
      return rv.ok === true && rv.data != null
    } catch { return false }
  }, [config])

  const fetchStock = useCallback(async (): Promise<string | null> => {
    if (!config?.url) return null
    try {
      const res = await fetch(`${config.url}?action=fetchStock`)
      const r = await res.json()
      return r.ok && r.data ? r.data : null
    } catch { return null }
  }, [config])

  const pushMachine = useCallback(async (machineData: object): Promise<boolean> => {
    if (!config?.url) return false
    try {
      await fetch(`${config.url}?action=saveMachine`, {
        method: 'POST',
        body: JSON.stringify(machineData),
      })
    } catch {}
    try {
      const vRes = await fetch(`${config.url}?action=fetchMachine`)
      const rv = await vRes.json()
      return rv.ok === true && rv.data != null
    } catch { return false }
  }, [config])

  const fetchMachine = useCallback(async (): Promise<string | null> => {
    if (!config?.url) return null
    try {
      const res = await fetch(`${config.url}?action=fetchMachine`)
      const r = await res.json()
      return r.ok && r.data ? r.data : null
    } catch { return null }
  }, [config])

  const pushOrders = useCallback(async (orders: PurchaseOrder[]): Promise<boolean> => {
    if (!config?.url) return false
    try {
      await fetch(`${config.url}?action=saveOrders`, {
        method: 'POST',
        body: JSON.stringify(orders),
      })
      return true
    } catch { return false }
  }, [config])

  const fetchOrders = useCallback(async (): Promise<PurchaseOrder[] | null> => {
    if (!config?.url) return null
    try {
      const res = await fetch(`${config.url}?action=fetchOrders`)
      const r = await res.json()
      if (r.error) return null         // explicit GAS error
      if (!r.data) return []           // connected, but no orders saved yet
      return JSON.parse(r.data) as PurchaseOrder[]
    } catch { return null }
  }, [config])

  const resetStatus = useCallback(() => {
    setSyncStatus('idle')
    setSyncMessage('')
  }, [])

  return { syncStatus, syncMessage, lastSynced, pushReport, fetchAll, pushStock, fetchStock, pushMachine, fetchMachine, pushOrders, fetchOrders, resetStatus }
}

// ── แปลงข้อมูลจาก Sheets กลับเป็น DayReport[] ───────────────

function normalizeDate(d: any): string {
  return String(d).slice(0, 10)
}

function sheetsDataToReports(data: any): DayReport[] {
  if (!data?.sales) return []

  const dateSet = [...new Set<string>(data.sales.map((r: any) => normalizeDate(r.date)))]

  return dateSet.map(date => {
    const salesRows = data.sales.filter((r: any) => normalizeDate(r.date) === date)
    const goodsRows = data.goods?.filter((r: any) => normalizeDate(r.date) === date) ?? []

    const sites = salesRows.map((r: any) => ({
      name: r.site,
      salesVolume: Number(r.salesVolume) || 0,
      salesAmount: Number(r.salesAmount) || 0,
      cashVolume: Number(r.cashVolume) || 0,
      cashAmount: Number(r.cashAmount) || 0,
      mdbVolume: Number(r.mdbVolume) || 0,
      mdbAmount: Number(r.mdbAmount) || 0,
      promptVolume: Number(r.promptVolume) || 0,
      promptAmount: Number(r.promptAmount) || 0,
      qr30Volume: Number(r.qr30Volume) || 0,
      qr30Amount: Number(r.qr30Amount) || 0,
      alipayVolume: Number(r.alipayVolume) || 0,
      alipayAmount: Number(r.alipayAmount) || 0,
      wechatVolume: Number(r.wechatVolume) || 0,
      wechatAmount: Number(r.wechatAmount) || 0,
      vipVolume: Number(r.vipVolume) || 0,
      vipAmount: Number(r.vipAmount) || 0,
      mifareVolume: Number(r.mifareVolume) || 0,
      mifareAmount: Number(r.mifareAmount) || 0,
      paytmVolume: Number(r.paytmVolume) || 0,
      paytmAmount: Number(r.paytmAmount) || 0,
    }))

    // aggregate routes & areas from sites
    const totals = sites.reduce((acc, s) => ({
      name: 'รวม',
      salesVolume: acc.salesVolume + s.salesVolume,
      salesAmount: acc.salesAmount + s.salesAmount,
      cashVolume: acc.cashVolume + s.cashVolume,
      cashAmount: acc.cashAmount + s.cashAmount,
      mdbVolume: acc.mdbVolume + s.mdbVolume,
      mdbAmount: acc.mdbAmount + s.mdbAmount,
      promptVolume: acc.promptVolume + s.promptVolume,
      promptAmount: acc.promptAmount + s.promptAmount,
      qr30Volume: acc.qr30Volume + s.qr30Volume,
      qr30Amount: acc.qr30Amount + s.qr30Amount,
      alipayVolume: acc.alipayVolume + s.alipayVolume,
      alipayAmount: acc.alipayAmount + s.alipayAmount,
      wechatVolume: acc.wechatVolume + s.wechatVolume,
      wechatAmount: acc.wechatAmount + s.wechatAmount,
      vipVolume: acc.vipVolume + s.vipVolume,
      vipAmount: acc.vipAmount + s.vipAmount,
      mifareVolume: acc.mifareVolume + s.mifareVolume,
      mifareAmount: acc.mifareAmount + s.mifareAmount,
      paytmVolume: acc.paytmVolume + s.paytmVolume,
      paytmAmount: acc.paytmAmount + s.paytmAmount,
    }), {
      name: 'รวม', salesVolume: 0, salesAmount: 0,
      cashVolume: 0, cashAmount: 0, mdbVolume: 0, mdbAmount: 0,
      promptVolume: 0, promptAmount: 0, qr30Volume: 0, qr30Amount: 0,
      alipayVolume: 0, alipayAmount: 0, wechatVolume: 0, wechatAmount: 0,
      vipVolume: 0, vipAmount: 0, mifareVolume: 0, mifareAmount: 0,
      paytmVolume: 0, paytmAmount: 0,
    })

    return {
      date,
      fileName: data.meta?.find((m: any) => normalizeDate(m.date) === date)?.fileName ?? '',
      areas: [totals],
      routes: [totals],
      sites,
      goods: goodsRows.map((g: any) => ({
        goodsNumber: String(g.goodsNumber),
        goodsName: String(g.goodsName),
        goodsType: String(g.goodsType),
        salesVolume: Number(g.salesVolume) || 0,
        salesAmount: Number(g.salesAmount) || 0,
      })),
    }
  })
}
