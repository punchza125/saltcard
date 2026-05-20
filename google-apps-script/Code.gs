// ============================================================
//  Saltcard Dashboard — Google Apps Script
//  วางโค้ดนี้ใน Google Sheets → Extensions → Apps Script
//  แล้ว Deploy เป็น Web App (Execute as: Me, Access: Anyone)
// ============================================================

const SHEET_NAMES = {
  SALES:    'sales',
  GOODS:    'goods',
  PAYMENTS: 'payments',
  META:     'meta',
  STOCK:    'stock',    // JSON blob ของ stock store
  MACHINE:  'machine',  // JSON blob ของ machine report
}

const HEADERS = {
  SALES: [
    'date','site','route','area',
    'salesVolume','salesAmount',
    'cashVolume','cashAmount',
    'mdbVolume','mdbAmount',
    'promptVolume','promptAmount',
    'qr30Volume','qr30Amount',
    'alipayVolume','alipayAmount',
    'wechatVolume','wechatAmount',
    'vipVolume','vipAmount',
    'mifareVolume','mifareAmount',
    'paytmVolume','paytmAmount',
    'importedAt', 'หมายเหตุ'
  ],
  GOODS: [
    'date','goodsNumber','goodsName','goodsType',
    'salesVolume','salesAmount',
    'importedAt', 'หมายเหตุ'
  ],
  PAYMENTS: [
    'date','site',
    'promptAmount','cashAmount','mdbAmount',
    'qr30Amount','alipayAmount','wechatAmount',
    'vipAmount','mifareAmount','paytmAmount',
    'importedAt'
  ],
  META: [
    'date','fileName','importedAt','importedBy','rowsSales','rowsGoods'
  ],
  STOCK:   ['updatedAt','data'],
  MACHINE: ['updatedAt','data'],
}

// ── Utility ──────────────────────────────────────────────────

function getOrCreateSheet(name, headers) {
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
  Object.entries(HEADERS).forEach(([key, headers]) => {
    getOrCreateSheet(SHEET_NAMES[key], headers)
  })
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, ...data }))
    .setMimeType(ContentService.MimeType.JSON)
}

function errorResponse(msg) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: false, error: msg }))
    .setMimeType(ContentService.MimeType.JSON)
}

// ── GET ──────────────────────────────────────────────────────

function doGet(e) {
  try {
    initSheets()
    const action = e.parameter.action || 'all'

    if (action === 'all')  return jsonResponse({ data: getAllData() })
    if (action === 'dates') return jsonResponse({ dates: getAvailableDates() })
    if (action === 'saveRow') return saveRowFromGet(e.parameter)

    if (action === 'clear' && e.parameter.date) {
      const date = e.parameter.date
      deleteRowsByDate(SHEET_NAMES.SALES, date)
      deleteRowsByDate(SHEET_NAMES.GOODS, date)
      deleteRowsByDate(SHEET_NAMES.PAYMENTS, date)
      deleteRowsByDate(SHEET_NAMES.META, date)
      return jsonResponse({ cleared: date })
    }

    // ── Stock ──
    if (action === 'saveStock') {
      const data = e.parameter.data
      if (!data) return errorResponse('missing data')
      saveBlob(SHEET_NAMES.STOCK, data)
      return jsonResponse({ saved: 'stock' })
    }
    if (action === 'fetchStock') {
      const blob = fetchBlob(SHEET_NAMES.STOCK)
      return jsonResponse({ data: blob })
    }

    // ── Machine ──
    if (action === 'saveMachine') {
      const data = e.parameter.data
      if (!data) return errorResponse('missing data')
      saveBlob(SHEET_NAMES.MACHINE, data)
      return jsonResponse({ saved: 'machine' })
    }
    if (action === 'fetchMachine') {
      const blob = fetchBlob(SHEET_NAMES.MACHINE)
      return jsonResponse({ data: blob })
    }

    return errorResponse('unknown action')
  } catch (err) {
    return errorResponse(String(err))
  }
}

// เก็บ JSON blob (overwrite row เดิม)
function saveBlob(sheetName, jsonStr) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName)
  const updatedAt = new Date().toISOString()
  if (sheet.getLastRow() < 2) {
    sheet.appendRow([updatedAt, jsonStr])
  } else {
    sheet.getRange(2, 1, 1, 2).setValues([[updatedAt, jsonStr]])
  }
}

// ดึง JSON blob
function fetchBlob(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName)
  if (!sheet || sheet.getLastRow() < 2) return null
  return sheet.getRange(2, 2).getValue() || null
}

function getAvailableDates() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.META)
  if (!sheet || sheet.getLastRow() < 2) return []
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues()
  return data.map(r => r[0]).filter(Boolean)
}

function getAllData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  const result = {}
  ;['SALES','GOODS','PAYMENTS','META'].forEach(key => {
    const sheet = ss.getSheetByName(SHEET_NAMES[key])
    if (!sheet || sheet.getLastRow() < 2) { result[key.toLowerCase()] = []; return }
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues()
    result[key.toLowerCase()] = rows.map(row =>
      Object.fromEntries(headers.map((h, i) => [h, row[i]]))
    )
  })
  return result
}

function saveRowFromGet(params) {
  const { type, date, row } = params
  if (!date || !type || !row) return errorResponse('missing params')
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  const importedAt = new Date().toISOString()
  try {
    const r = JSON.parse(row)
    if (type === 'sales') {
      ss.getSheetByName(SHEET_NAMES.SALES).appendRow([
        date, r.name, r.route || '', r.area || '',
        r.salesVolume, r.salesAmount,
        r.cashVolume, r.cashAmount,
        r.mdbVolume, r.mdbAmount,
        r.promptVolume, r.promptAmount,
        r.qr30Volume, r.qr30Amount,
        r.alipayVolume, r.alipayAmount,
        r.wechatVolume, r.wechatAmount,
        r.vipVolume, r.vipAmount,
        r.mifareVolume, r.mifareAmount,
        r.paytmVolume, r.paytmAmount,
        importedAt, ''
      ])
      return jsonResponse({ saved: 'sales', date })
    }
    if (type === 'goods') {
      ss.getSheetByName(SHEET_NAMES.GOODS).appendRow([
        date, r.goodsNumber, r.goodsName, r.goodsType,
        r.salesVolume, r.salesAmount,
        importedAt, ''
      ])
      return jsonResponse({ saved: 'goods', date })
    }
    if (type === 'payments') {
      ss.getSheetByName(SHEET_NAMES.PAYMENTS).appendRow([
        date, 'ALL',
        r.promptAmount, r.cashAmount, r.mdbAmount,
        r.qr30Amount, r.alipayAmount, r.wechatAmount,
        r.vipAmount, r.mifareAmount, r.paytmAmount,
        importedAt
      ])
      return jsonResponse({ saved: 'payments', date })
    }
    if (type === 'meta') {
      ss.getSheetByName(SHEET_NAMES.META).appendRow([
        date, r.fileName, importedAt, '', r.rowsSales, r.rowsGoods
      ])
      return jsonResponse({ saved: 'meta', date })
    }
    return errorResponse('unknown type: ' + type)
  } catch (err) {
    return errorResponse('saveRow error: ' + String(err))
  }
}

// ── POST ─────────────────────────────────────────────────────

function doPost(e) {
  try {
    initSheets()

    // ── blob actions (saveStock / saveMachine) ──
    const blobAction = e.parameter && e.parameter.action
    if (blobAction === 'saveStock' || blobAction === 'saveMachine') {
      let data = (e.parameter && e.parameter.data) || null
      if (!data && e.postData && e.postData.contents) {
        const match = e.postData.contents.match(/(?:^|&)data=([^&]*)/)
        data = match ? decodeURIComponent(match[1].replace(/\+/g, ' ')) : null
      }
      if (!data) return errorResponse('missing data')
      const sheetName = blobAction === 'saveMachine' ? SHEET_NAMES.MACHINE : SHEET_NAMES.STOCK
      saveBlob(sheetName, data)
      return jsonResponse({ saved: blobAction === 'saveMachine' ? 'machine' : 'stock' })
    }

    let raw
    if (e.parameter && e.parameter.data) {
      raw = e.parameter.data
    } else if (e.postData && e.postData.contents) {
      const contents = e.postData.contents
      const match = contents.match(/(?:^|&)data=([^&]*)/)
      raw = match ? decodeURIComponent(match[1].replace(/\+/g, ' ')) : contents
    }
    if (!raw) return errorResponse('no data received')
    const payload = JSON.parse(raw)
    const { report } = payload

    if (!report || !report.date) return errorResponse('missing report.date')

    const importedAt = new Date().toISOString()
    const date = report.date

    deleteRowsByDate(SHEET_NAMES.SALES, date)
    deleteRowsByDate(SHEET_NAMES.GOODS, date)
    deleteRowsByDate(SHEET_NAMES.PAYMENTS, date)
    deleteRowsByDate(SHEET_NAMES.META, date)

    const ss = SpreadsheetApp.getActiveSpreadsheet()

    const salesSheet = ss.getSheetByName(SHEET_NAMES.SALES)
    report.sites.forEach(s => {
      salesSheet.appendRow([
        date, s.name, '', '',
        s.salesVolume, s.salesAmount,
        s.cashVolume, s.cashAmount,
        s.mdbVolume, s.mdbAmount,
        s.promptVolume, s.promptAmount,
        s.qr30Volume, s.qr30Amount,
        s.alipayVolume, s.alipayAmount,
        s.wechatVolume, s.wechatAmount,
        s.vipVolume, s.vipAmount,
        s.mifareVolume, s.mifareAmount,
        s.paytmVolume, s.paytmAmount,
        importedAt, ''
      ])
    })

    const goodsSheet = ss.getSheetByName(SHEET_NAMES.GOODS)
    report.goods.forEach(g => {
      goodsSheet.appendRow([
        date, g.goodsNumber, g.goodsName, g.goodsType,
        g.salesVolume, g.salesAmount,
        importedAt, ''
      ])
    })

    const paySheet = ss.getSheetByName(SHEET_NAMES.PAYMENTS)
    const totalPayments = report.areas.reduce((acc, a) => ({
      prompt:  (acc.prompt  || 0) + a.promptAmount,
      cash:    (acc.cash    || 0) + a.cashAmount,
      mdb:     (acc.mdb     || 0) + a.mdbAmount,
      qr30:    (acc.qr30    || 0) + a.qr30Amount,
      alipay:  (acc.alipay  || 0) + a.alipayAmount,
      wechat:  (acc.wechat  || 0) + a.wechatAmount,
      vip:     (acc.vip     || 0) + a.vipAmount,
      mifare:  (acc.mifare  || 0) + a.mifareAmount,
      paytm:   (acc.paytm   || 0) + a.paytmAmount,
    }), {})
    paySheet.appendRow([
      date, 'ALL',
      totalPayments.prompt, totalPayments.cash, totalPayments.mdb,
      totalPayments.qr30, totalPayments.alipay, totalPayments.wechat,
      totalPayments.vip, totalPayments.mifare, totalPayments.paytm,
      importedAt
    ])

    ss.getSheetByName(SHEET_NAMES.META).appendRow([
      date, report.fileName, importedAt, '',
      report.sites.length, report.goods.length
    ])

    return jsonResponse({
      message: `บันทึกวันที่ ${date} สำเร็จ`,
      date,
      rowsSales: report.sites.length,
      rowsGoods: report.goods.length,
    })
  } catch (err) {
    return errorResponse(String(err))
  }
}

// ── Helper ───────────────────────────────────────────────────

function cellToDateStr(cell) {
  if (cell instanceof Date) {
    return Utilities.formatDate(cell, Session.getScriptTimeZone(), 'yyyy-MM-dd')
  }
  return String(cell).trim().substring(0, 10)
}

function deleteRowsByDate(sheetName, date) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName)
  if (!sheet || sheet.getLastRow() < 2) return
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues()
  for (let i = data.length - 1; i >= 0; i--) {
    if (cellToDateStr(data[i][0]) === date) sheet.deleteRow(i + 2)
  }
}
