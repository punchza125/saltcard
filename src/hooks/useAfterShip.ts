const ENV_URL = import.meta.env.VITE_ORDERS_URL as string | undefined
const URL_KEY = 'saltcard_orders_sheets_url'

const SLUGS: Record<string, string> = {
  kerry:    'kerry-express-th',
  flash:    'flash-express',
  thaipost: 'thailand-post',
  jt:       'jtexpress-th',
  ninja:    'ninja-van-th',
  dhl:      'dhl',
}

export const TAG_TH: Record<string, string> = {
  Pending:        'รอดำเนินการ',
  InfoReceived:   'รับข้อมูลแล้ว',
  InTransit:      'อยู่ระหว่างขนส่ง',
  OutForDelivery: 'กำลังนำส่ง',
  AttemptFail:    'จัดส่งไม่สำเร็จ',
  Delivered:      'จัดส่งแล้ว ✓',
  Exception:      'มีปัญหา',
  Expired:        'หมดอายุ',
}

export interface Checkpoint {
  created_at: string
  message: string
  location?: string
  tag?: string
}

export interface TrackingResult {
  tag: string
  checkpoints: Checkpoint[]
}

function getOrdersUrl(): string | null {
  return ENV_URL ?? localStorage.getItem(URL_KEY) ?? null
}

export function hasAfterShip(carrierId: string): boolean {
  return !!getOrdersUrl() && !!SLUGS[carrierId]
}

export async function fetchTracking(carrierId: string, trackingNumber: string): Promise<TrackingResult | null> {
  const u    = getOrdersUrl()
  const slug = SLUGS[carrierId]
  if (!u || !slug) return null
  const res  = await fetch(`${u}?action=track&slug=${encodeURIComponent(slug)}&number=${encodeURIComponent(trackingNumber)}`)
  const json = await res.json()
  if (!json.ok) throw new Error(json.error ?? 'unknown error')
  return {
    tag:         json.tracking?.tag ?? 'Unknown',
    checkpoints: json.tracking?.checkpoints ?? [],
  }
}
