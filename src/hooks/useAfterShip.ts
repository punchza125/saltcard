const API_KEY = import.meta.env.VITE_AFTERSHIP_API_KEY as string | undefined

const SLUGS: Record<string, string> = {
  kerry:    'kerry-express-th',
  flash:    'flash-express',
  thaipost: 'thailand-post',
  jt:       'jtexpress-th',
  ninja:    'ninja-van-th',
  dhl:      'dhl',
}

export const TAG_TH: Record<string, string> = {
  Pending:         'รอดำเนินการ',
  InfoReceived:    'รับข้อมูลแล้ว',
  InTransit:       'อยู่ระหว่างขนส่ง',
  OutForDelivery:  'กำลังนำส่ง',
  AttemptFail:     'จัดส่งไม่สำเร็จ',
  Delivered:       'จัดส่งแล้ว ✓',
  Exception:       'มีปัญหา',
  Expired:         'หมดอายุ',
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

export async function fetchTracking(carrierId: string, trackingNumber: string): Promise<TrackingResult | null> {
  if (!API_KEY) return null
  const slug = SLUGS[carrierId]
  if (!slug) return null
  try {
    const res = await fetch(
      `https://api.aftership.com/v4/trackings/${slug}/${encodeURIComponent(trackingNumber)}`,
      { headers: { 'aftership-api-key': API_KEY, 'Content-Type': 'application/json' } },
    )
    const json = await res.json()
    if (json.meta?.code !== 200) return null
    return {
      tag:         json.data?.tracking?.tag ?? 'Unknown',
      checkpoints: json.data?.tracking?.checkpoints ?? [],
    }
  } catch { return null }
}

export const hasAfterShip = !!API_KEY
