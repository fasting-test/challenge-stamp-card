// 31日間チャレンジ達成カード — Googleスプレッドシートをデータベース代わりに使うAPI
//
// 使い方:
// 1. 新しいGoogleスプレッドシートを作成する
// 2. 「拡張機能」→「Apps Script」を開き、このファイルの中身を全部貼り付けて保存
// 3. 右上の「デプロイ」→「新しいデプロイ」→種類は「ウェブアプリ」
//    - 実行するユーザー: 自分
//    - アクセスできるユーザー: 全員
// 4. デプロイ後に表示されるURL(.../exec で終わるもの)を config.js に貼る

const SHEET_NAME = "students"
const HEADERS = ["id", "display_name", "challenge", "start_date", "stamp_dates", "achieved_count", "created_at", "updated_at"]

function doGet(e) {
  try {
    const action = (e.parameter.action || "list")
    if (action === "list") return respond(listStudents())
    if (action === "get") return respond(getStudentById(e.parameter.id) || { error: "not_found" })
    return respond({ error: "unknown_action" })
  } catch (err) {
    return respond({ error: String(err) })
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents)
    const lock = LockService.getScriptLock()
    lock.waitLock(10000)
    try {
      if (body.action === "registerOrResume") {
        return respond(registerOrResume(body.display_name, body.challenge))
      }
      if (body.action === "toggleStamp") {
        return respond(toggleStamp(body.student_id))
      }
      return respond({ error: "unknown_action" })
    } finally {
      lock.releaseLock()
    }
  } catch (err) {
    return respond({ error: String(err) })
  }
}

function respond(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  let sheet = ss.getSheetByName(SHEET_NAME)
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME)
    sheet.appendRow(HEADERS)
  }
  return sheet
}

function todayStr() {
  return Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd")
}

function rowToObject(row, headers) {
  const obj = {}
  headers.forEach((h, i) => (obj[h] = row[i]))
  return obj
}

// スプレッドシートは "2026-09-09" のような文字列を自動的に日付型のセルに
// 変換してしまうことがある。その場合 getValues() はJSのDateオブジェクトを
// 返してくるので、文字列化する際に必ずここで整形し直す。
function toDateStr(value) {
  if (value instanceof Date) return Utilities.formatDate(value, "Asia/Tokyo", "yyyy-MM-dd")
  return value
}

function toIsoStr(value) {
  if (value instanceof Date) return value.toISOString()
  return value
}

// stamp_dates列は通常カンマ区切りの文字列("2026-09-09,2026-09-10")だが、
// スタンプが1つしかない状態だと単一の日付に見えてスプレッドシート側が
// 日付型に自動変換してしまうことがあるので、その場合も救う。
function parseStampDatesCell(value) {
  if (!value) return []
  if (value instanceof Date) return [toDateStr(value)]
  return String(value).split(",").filter(Boolean)
}

function formatStudent(obj) {
  return {
    id: obj.id,
    display_name: obj.display_name,
    challenge: obj.challenge,
    start_date: toDateStr(obj.start_date),
    stamp_dates: parseStampDatesCell(obj.stamp_dates),
    achieved_count: Number(obj.achieved_count || 0),
    created_at: toIsoStr(obj.created_at),
    updated_at: toIsoStr(obj.updated_at),
  }
}

function findRowIndexById(sheet, id) {
  const data = sheet.getDataRange().getValues()
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) return i + 1 // 1-indexedの行番号
  }
  return -1
}

function findRowIndexByName(sheet, name) {
  const data = sheet.getDataRange().getValues()
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]).toLowerCase() === name.toLowerCase()) return i + 1
  }
  return -1
}

function listStudents() {
  const sheet = getSheet()
  const data = sheet.getDataRange().getValues()
  if (data.length < 2) return []
  const headers = data[0]
  return data.slice(1).map((r) => formatStudent(rowToObject(r, headers)))
}

function getStudentById(id) {
  if (!id) return null
  const sheet = getSheet()
  const rowIndex = findRowIndexById(sheet, id)
  if (rowIndex === -1) return null
  const headers = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0]
  const row = sheet.getRange(rowIndex, 1, 1, HEADERS.length).getValues()[0]
  return formatStudent(rowToObject(row, headers))
}

function registerOrResume(displayName, challenge) {
  const name = String(displayName || "").trim().slice(0, 40)
  if (!name) return { error: "名前を入力してください" }

  const sheet = getSheet()
  const existingRowIndex = findRowIndexByName(sheet, name)
  if (existingRowIndex !== -1) {
    const headers = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0]
    const row = sheet.getRange(existingRowIndex, 1, 1, HEADERS.length).getValues()[0]
    return formatStudent(rowToObject(row, headers))
  }

  const trimmedChallenge = String(challenge || "").trim().slice(0, 80)
  if (!trimmedChallenge) return { error: "チャレンジ内容を入力してください" }

  const id = Utilities.getUuid()
  const now = new Date().toISOString()
  const start = todayStr()
  sheet.appendRow([id, name, trimmedChallenge, start, "", 0, now, now])
  return {
    id,
    display_name: name,
    challenge: trimmedChallenge,
    start_date: start,
    stamp_dates: [],
    achieved_count: 0,
    created_at: now,
    updated_at: now,
  }
}

function toggleStamp(studentId) {
  const sheet = getSheet()
  const rowIndex = findRowIndexById(sheet, studentId)
  if (rowIndex === -1) return { error: "student_not_found" }

  const stampDatesCol = HEADERS.indexOf("stamp_dates") + 1
  const countCol = HEADERS.indexOf("achieved_count") + 1
  const updatedCol = HEADERS.indexOf("updated_at") + 1

  const current = sheet.getRange(rowIndex, stampDatesCol).getValue()
  const dates = parseStampDatesCell(current)
  const today = todayStr()
  const idx = dates.indexOf(today)
  let filled
  if (idx >= 0) {
    dates.splice(idx, 1)
    filled = false
  } else {
    dates.push(today)
    filled = true
  }

  sheet.getRange(rowIndex, stampDatesCol).setValue(dates.join(","))
  sheet.getRange(rowIndex, countCol).setValue(dates.length)
  sheet.getRange(rowIndex, updatedCol).setValue(new Date().toISOString())

  return { filled, achieved_count: dates.length, stamp_dates: dates }
}
