// ============================================================
//  Saltcard — Purchase Orders Tracking
//  สร้าง Google Sheet ใหม่ แล้ววางโค้ดนี้ใน
//  Extensions → Apps Script → Deploy as Web App
//  (Execute as: Me, Access: Anyone)
// ============================================================

const ORDER_SHEET  = 'orders'
const ITEMS_SHEET  = 'order_items'

const ORDER_HEADERS = [
  'id', 'createdAt', 'orderedBy', 'supplier', 'status',
  'carrier', 'trackingNumber', 'receivedAt', 'notes', 'updatedAt',
]
const ITEM_HEADERS = [
  'orderId', 'productId', 'name', 'qty', 'unit',
]

// ── Utility ──────────────────────────────────────────────────

function getSheet(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  let sheet = ss.getSheetByName(name)
  if (!sheet) {
    sheet = ss.insertSheet(name)
    sheet.appendRow(headers)
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#1a1a2e')
      .setFontColor('#ffffff')
    sheet.setFrozenRows(1)
  }
  return sheet
}

function initSheets() {
  getSheet(ORDER_SHEET, ORDER_HEADERS)
  getSheet(ITEMS_SHEET, ITEM_HEADERS)
}

function jsonOk(data)  { return res({ ok: true,  ...data }) }
function jsonErr(msg)  { return res({ ok: false, error: msg }) }
function res(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON)
}

function sheetToObjects(sheet) {
  if (sheet.getLastRow() < 2) return []
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
  const rows    = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues()
  return rows.map(row => {
    const obj = {}
    headers.forEach((h, i) => { obj[h] = row[i] === '' ? null : row[i] })
    return obj
  })
}

// ── GET ──────────────────────────────────────────────────────

function doGet(e) {
  try {
    initSheets()
    const action = (e.parameter && e.parameter.action) || 'fetch'

    if (action === 'dates') return jsonOk({})   // health-check endpoint

    if (action === 'track') {
      const number = e.parameter && e.parameter.number
      const slug   = e.parameter && e.parameter.slug
      if (!number || !slug) return jsonErr('missing number or slug')

      const props  = PropertiesService.getScriptProperties()
      const apiKey = props.getProperty('AFTERSHIP_API_KEY')
      if (!apiKey) return jsonErr('AFTERSHIP_API_KEY not set in Script Properties')

      const headers = { 'aftership-api-key': apiKey, 'Content-Type': 'application/json' }
      const trackUrl = 'https://api.aftership.com/v4/trackings/' + slug + '/' + encodeURIComponent(number)

      let resp = UrlFetchApp.fetch(trackUrl, { headers: headers, muteHttpExceptions: true })
      let data = JSON.parse(resp.getContentText())

      // If tracking not yet registered in AfterShip, add it first then re-fetch
      if (data.meta && data.meta.code === 4004) {
        UrlFetchApp.fetch('https://api.aftership.com/v4/trackings', {
          method: 'post',
          headers: headers,
          payload: JSON.stringify({ tracking: { slug: slug, tracking_number: number } }),
          muteHttpExceptions: true,
        })
        resp = UrlFetchApp.fetch(trackUrl, { headers: headers, muteHttpExceptions: true })
        data = JSON.parse(resp.getContentText())
      }

      if (!data.data || !data.data.tracking) return jsonErr(data.meta && data.meta.message || 'api error')
      const t = data.data.tracking
      return jsonOk({ tracking: { tag: t.tag, checkpoints: t.checkpoints || [] } })
    }

    if (action === 'save' || action === 'saveOrders') {
      const data = e.parameter && e.parameter.data
      if (!data) return jsonErr('missing data')
      const orders = JSON.parse(decodeURIComponent(data))
      saveAllOrders(orders)
      return jsonOk({ saved: orders.length })
    }

    if (action === 'fetch' || action === 'fetchOrders') {
      const orderSheet = getSheet(ORDER_SHEET, ORDER_HEADERS)
      const itemSheet  = getSheet(ITEMS_SHEET,  ITEM_HEADERS)
      const orders = sheetToObjects(orderSheet)
      const items  = sheetToObjects(itemSheet)

      const result = orders.map(o => ({
        id:             String(o.id || ''),
        createdAt:      String(o.createdAt || ''),
        orderedBy:      o.orderedBy || undefined,
        supplier:       o.supplier  || undefined,
        notes:          o.notes     || undefined,
        status:         String(o.status || 'ordered'),
        carrier:        o.carrier   || undefined,
        trackingNumber: o.trackingNumber || undefined,
        receivedAt:     o.receivedAt    || undefined,
        items: items
          .filter(it => String(it.orderId) === String(o.id))
          .map(it => ({
            productId: it.productId || undefined,
            name:      String(it.name || ''),
            qty:       Number(it.qty) || 1,
            unit:      String(it.unit || 'Box'),
          })),
      }))

      return jsonOk({ orders: result })
    }

    return jsonErr('unknown action')
  } catch (err) {
    return jsonErr(String(err))
  }
}

// ── POST ─────────────────────────────────────────────────────

function doPost(e) {
  try {
    initSheets()
    const action = e.parameter && e.parameter.action

    if (action === 'save' || action === 'saveOrders') {
      const orders = JSON.parse(e.postData.contents)
      saveAllOrders(orders)
      return jsonOk({ saved: orders.length })
    }

    return jsonErr('unknown action')
  } catch (err) {
    return jsonErr(String(err))
  }
}

// ── Save (full replace) ───────────────────────────────────────

function saveAllOrders(orders) {
  const ss         = SpreadsheetApp.getActiveSpreadsheet()
  const orderSheet = getSheet(ORDER_SHEET, ORDER_HEADERS)
  const itemSheet  = getSheet(ITEMS_SHEET,  ITEM_HEADERS)
  const now        = new Date().toISOString()

  // clear existing data (keep header)
  if (orderSheet.getLastRow() > 1) orderSheet.deleteRows(2, orderSheet.getLastRow() - 1)
  if (itemSheet.getLastRow()  > 1) itemSheet.deleteRows(2,  itemSheet.getLastRow()  - 1)

  // write orders
  if (orders.length > 0) {
    const orderRows = orders.map(o => [
      o.id, o.createdAt, o.orderedBy || '', o.supplier || '', o.status,
      o.carrier || '', o.trackingNumber || '', o.receivedAt || '', o.notes || '', now,
    ])
    orderSheet.getRange(2, 1, orderRows.length, ORDER_HEADERS.length).setValues(orderRows)

    // write items (flat)
    const itemRows = orders.flatMap(o =>
      (o.items || []).map(it => [
        o.id, it.productId || '', it.name, it.qty, it.unit,
      ])
    )
    if (itemRows.length > 0) {
      itemSheet.getRange(2, 1, itemRows.length, ITEM_HEADERS.length).setValues(itemRows)
    }
  }

  // auto-color status column
  if (orders.length > 0) {
    const statusCol = ORDER_HEADERS.indexOf('status') + 1
    orders.forEach((o, i) => {
      const row  = i + 2
      const cell = orderSheet.getRange(row, statusCol)
      const bg   = o.status === 'received'   ? '#d1fae5'
                 : o.status === 'in_transit' ? '#dbeafe'
                 : '#fef3c7'
      cell.setBackground(bg)
    })
  }
}
