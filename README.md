# Saltcard Sales Dashboard

เว็บแอปดูยอดขาย Vending Machine รองรับมือถือ สร้างด้วย React + TypeScript + Tailwind CSS

## วิธีใช้งาน (ทีม)

### เปิดเว็บได้เลย (ไม่ต้อง install)
เปิดไฟล์ `dist/index.html` ในเบราว์เซอร์ หรือ deploy โฟลเดอร์ `dist/` ขึ้น hosting ใดก็ได้

### Deploy ขึ้น Netlify / Vercel (แนะนำ)
1. สมัคร https://netlify.com (ฟรี)
2. ลากโฟลเดอร์ `dist/` วางที่หน้า Netlify
3. ได้ลิงก์แชร์ทีมได้เลย

---

## การพัฒนา (Developer)

### ติดตั้ง
```bash
npm install
```

### รันในโหมด dev
```bash
npm run dev
```
เปิด http://localhost:5173

### Build สำหรับ production
```bash
npm run build
```
ไฟล์พร้อมใช้งานอยู่ที่โฟลเดอร์ `dist/`

---

## รูปแบบไฟล์ที่รองรับ

รองรับไฟล์ **MultiReport** จาก Worldwide VMS โดยตรง  
ชื่อ sheet ที่ต้องมี:
- `Area Aspect` — ยอดขายตามพื้นที่
- `Route Aspect` — ยอดขายตาม Route
- `Site Aspect` — ยอดขายตามสาขา
- `Goods Aspect` — ยอดขายตามสินค้า

ระบบจะดึงวันที่จาก sheet title อัตโนมัติ เช่น `Area Aspect (2026-05-18)`

---

## ฟีเจอร์

- อัปโหลดหลายไฟล์พร้อมกัน (ย้อนหลังได้)
- Filter: วันที่เลือก / 7 วัน / 30 วัน / ทั้งหมด
- กราฟยอดขายรายวัน (Area Chart)
- Top 10 สินค้าขายดี (เรียงตามยอดเงิน/จำนวนชิ้น)
- สัดส่วนการชำระเงิน (Pie Chart)
- ยอดขายตามสาขา
- บันทึกข้อมูลใน localStorage (เปิดซ้ำข้อมูลยังอยู่)
- รองรับมือถือ (Mobile-first)
- Dark mode

---

## Tech Stack

| ไลบรารี | เวอร์ชัน | ใช้ทำ |
|---------|---------|-------|
| React | 18 | UI framework |
| TypeScript | 5 | Type safety |
| Tailwind CSS | 3 | Styling |
| Recharts | 2 | กราฟ |
| SheetJS (xlsx) | 0.18 | อ่านไฟล์ Excel |
| Vite | 5 | Build tool |
