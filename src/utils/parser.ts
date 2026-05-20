import * as XLSX from 'xlsx'
import type { DayReport, AreaRow, GoodsRow, MachineSlot, MachineReport } from './types'

export interface InventoryRow {
  goodsNumber: string
  goodsName: string
  totalInventory: number  // sum ทุก slot
}

function parseDate(sheetTitle: string): string {
  // Match "Area Aspect (2026-05-18)" → "2026-05-18"
  const m = sheetTitle.match(/\((\d{4}-\d{2}-\d{2})\)/)
  if (m) return m[1]
  // fallback: try to find date in filename
  const m2 = sheetTitle.match(/(\d{4})[-_](\d{2})[-_](\d{2})/)
  if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`
  return new Date().toISOString().slice(0, 10)
}

function parseAreaSheet(ws: XLSX.WorkSheet): { date: string; rows: AreaRow[] } {
  const data: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as string[][]
  const title = String(data[0]?.[0] ?? '')
  const date = parseDate(title)
  const rows: AreaRow[] = []

  for (let i = 2; i < data.length; i++) {
    const r = data[i]
    if (!r[0]) continue
    rows.push({
      name: String(r[0]),
      salesVolume: Number(r[1]) || 0,
      salesAmount: Number(r[2]) || 0,
      cashVolume: Number(r[3]) || 0,
      cashAmount: Number(r[4]) || 0,
      mdbVolume: Number(r[5]) || 0,
      mdbAmount: Number(r[6]) || 0,
      promptVolume: Number(r[7]) || 0,
      promptAmount: Number(r[8]) || 0,
      qr30Volume: Number(r[9]) || 0,
      qr30Amount: Number(r[10]) || 0,
      alipayVolume: Number(r[11]) || 0,
      alipayAmount: Number(r[12]) || 0,
      wechatVolume: Number(r[13]) || 0,
      wechatAmount: Number(r[14]) || 0,
      vipVolume: Number(r[15]) || 0,
      vipAmount: Number(r[16]) || 0,
      mifareVolume: Number(r[17]) || 0,
      mifareAmount: Number(r[18]) || 0,
      paytmVolume: Number(r[19]) || 0,
      paytmAmount: Number(r[20]) || 0,
    })
  }
  return { date, rows }
}

function parseGoodsSheet(ws: XLSX.WorkSheet): GoodsRow[] {
  const data: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as string[][]
  const rows: GoodsRow[] = []
  for (let i = 2; i < data.length; i++) {
    const r = data[i]
    if (!r[0]) continue
    rows.push({
      goodsNumber: String(r[0]),
      goodsName: String(r[1]),
      goodsType: String(r[2]),
      salesVolume: Number(r[3]) || 0,
      salesAmount: Number(r[4]) || 0,
    })
  }
  return rows
}

export async function parseMultiReport(file: File): Promise<DayReport> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })

  const areaSheet = wb.Sheets['Area Aspect']
  const routeSheet = wb.Sheets['Route Aspect']
  const siteSheet = wb.Sheets['Site Aspect']
  const goodsSheet = wb.Sheets['Goods Aspect']

  const { date, rows: areas } = parseAreaSheet(areaSheet)
  const { rows: routes } = parseAreaSheet(routeSheet)
  const { rows: sites } = parseAreaSheet(siteSheet)
  const goods = parseGoodsSheet(goodsSheet)

  return { date, fileName: file.name, areas, routes, sites, goods }
}

export function formatThaiDate(dateStr: string): string {
  const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`
}

export function formatThaiDateFull(dateStr: string): string {
  const days = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัส','ศุกร์','เสาร์']
  const months = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม']
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return `${days[d.getDay()]}ที่ ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`
}

export function formatBaht(n: number): string {
  return n.toLocaleString('th-TH')
}

// parse Inventory Status Batch file → รวม inventory ทุก slot ต่อ goods
export async function parseInventoryReport(file: File): Promise<{ date: string; rows: InventoryRow[] }> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as unknown[][]

  // หาวันที่จากชื่อไฟล์ เช่น 20260519_190633
  const dateMatch = file.name.match(/(\d{4})(\d{2})(\d{2})/)
  const date = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : new Date().toISOString().slice(0, 10)

  // row 0 = title, row 1 = headers, row 2+ = data
  // cols: 0=Machine, 1=M2M, 2=Site, 3=GoodsNumber, 4=GoodsName, 5=Slot, 6=Capacity, 7=Inventory
  const totals = new Map<string, { goodsName: string; total: number }>()

  for (let i = 2; i < raw.length; i++) {
    const row = raw[i]
    if (!row || !row[3]) continue
    const goodsNumber = String(row[3])
    const goodsName   = String(row[4] ?? '')
    const inventory   = Number(row[7]) || 0
    const existing    = totals.get(goodsNumber)
    if (existing) {
      existing.total += inventory
    } else {
      totals.set(goodsNumber, { goodsName, total: inventory })
    }
  }

  const rows: InventoryRow[] = Array.from(totals.entries()).map(([goodsNumber, v]) => ({
    goodsNumber,
    goodsName: v.goodsName,
    totalInventory: v.total,
  }))

  return { date, rows }
}

export async function parseMachineInventory(file: File): Promise<MachineReport> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as unknown[][]

  const dateMatch = file.name.match(/(\d{4})(\d{2})(\d{2})/)
  const date = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : new Date().toISOString().slice(0, 10)

  // row 0 = title, row 1 = headers, row 2+ = data
  // cols: 0=Machine, 1=M2M, 2=Site, 3=GoodsNumber, 4=GoodsName, 5=Slot, 6=Capacity, 7=Inventory, 8=Status
  const slots: MachineSlot[] = []
  for (let i = 2; i < raw.length; i++) {
    const row = raw[i]
    if (!row || !row[3]) continue
    slots.push({
      machineNumber: String(row[0] ?? ''),
      siteName:      String(row[2] ?? ''),
      goodsNumber:   String(row[3]),
      goodsName:     String(row[4] ?? ''),
      slot:          String(row[5] ?? ''),
      capacity:      Number(row[6]) || 0,
      inventory:     Number(row[7]) || 0,
      status:        String(row[8] ?? ''),
    })
  }

  return { date, fileName: file.name, slots }
}
