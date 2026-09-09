// 共通ロジック(登録ページ・カードページ・管理者ページから読み込む)
// データはGoogle Apps Script経由でGoogleスプレッドシートに保存される。
// (全受講生ぶんが1つのスプレッドシートに集約されるので、管理者が一覧で確認できる)

const PROGRAM_LENGTH = 31
const STUDENT_ID_KEY = "csc_student_id"

// ---- 日付ユーティリティ(タイムゾーンによるズレを避けるため文字列ベースで計算) ----

function todayStr() {
  const now = new Date()
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return jst.toISOString().slice(0, 10)
}

function parseYmd(s) {
  const [y, m, d] = s.split("-").map(Number)
  return [y, m - 1, d]
}

function dayOffsetFromStart(startDate, targetDate = todayStr()) {
  const [sy, sm, sd] = parseYmd(startDate)
  const [ty, tm, td] = parseYmd(targetDate)
  const start = Date.UTC(sy, sm, sd)
  const target = Date.UTC(ty, tm, td)
  return Math.round((target - start) / (1000 * 60 * 60 * 24))
}

function addDays(s, delta) {
  const [y, m, d] = parseYmd(s)
  const date = new Date(Date.UTC(y, m, d))
  date.setUTCDate(date.getUTCDate() + delta)
  return date.toISOString().slice(0, 10)
}

function dayOfYear(s = todayStr()) {
  const [y, m, d] = parseYmd(s)
  const start = Date.UTC(y, 0, 1)
  const target = Date.UTC(y, m, d)
  return Math.round((target - start) / (1000 * 60 * 60 * 24)) + 1
}

// ---- 敬称 ----

function withSan(name) {
  return name.endsWith("さん") || name.endsWith("ちゃん") || name.endsWith("くん") ? name : `${name}さん`
}

// 名前がすでに「ちゃん」「さん」「くん」で終わっている場合は二重に付けない
function withChan(name) {
  return name.endsWith("ちゃん") || name.endsWith("さん") || name.endsWith("くん") ? name : `${name}ちゃん`
}

// ---- 今日の一言を話すキャラクター(3種類からランダム) ----

const CHARACTER_IMAGES = ["images/character-1.png", "images/character-2.png", "images/character-3.png"]

function randomCharacterImage() {
  return CHARACTER_IMAGES[Math.floor(Math.random() * CHARACTER_IMAGES.length)]
}

// ---- 今日の一言 ----

const QUOTES = [
  "今日のあなたが、未来のあなたをつくる。",
  "小さな一歩でも、続けたら大きな道になるよ。",
  "昨日の自分より、今日はちょっとだけ前へ。",
  "できた日もできなかった日も、続けてる時点でえらい。",
  "完璧じゃなくていい。今日もやる、それだけでいい。",
  "スタンプ1個、自分への信頼が1個増える。",
  "誰かと比べなくていい。あなたのペースでいい。",
  "今日の一押しが、31日後のあなたを笑顔にする。",
  "続けている自分を、ちゃんと褒めてあげて。",
  "決めたのはあなた。やり遂げるのもあなた。",
  "小さな約束を守れる人は、大きな自分にもなれる。",
  "今日という日は、今日しかやってこない。",
  "できる日もある、できない日もある。それでも大丈夫。",
  "積み重ねは裏切らない。今日も一歩。",
  "「やろう」と思えたその気持ちがもう素敵。",
  "今日のあなたを、未来のあなたが必ず見てる。",
  "焦らなくていい。今日のぶんだけ、進もう。",
  "続けることは才能じゃなくて、習慣。今日もその習慣を。",
  "自分との約束を、今日も一つ果たそう。",
  "小さな「できた」が、自信になる。",
  "今日のスタンプは、未来の自分へのプレゼント。",
  "気分が乗らない日ほど、1個押せたら大金星。",
  "誰も見てなくても、あなたはちゃんと頑張ってる。",
  "積もり積もった31日が、きっと自信になる。",
  "今日も自分を裏切らない。それだけでいい。",
  "変わりたいと思ったその日から、もう変わり始めてる。",
  "今日のひと押しが、明日のあなたを軽くする。",
  "「続けてる」という事実が、もう誇っていいこと。",
  "今日のあなたに、拍手を。",
  "ゴールは31日先。でも今日の1歩がすべて。",
]

function quoteForDay(doy) {
  const index = (((doy - 1) % QUOTES.length) + QUOTES.length) % QUOTES.length
  return QUOTES[index]
}

// ---- 受講生IDの保存(この端末が「自分は誰か」を覚えておくためだけのもの。
//      本体データはスプレッドシート側にある) ----

function getStudentIdFromLocalStorage() {
  try {
    return localStorage.getItem(STUDENT_ID_KEY)
  } catch {
    return null
  }
}

function setStudentIdToLocalStorage(id) {
  try {
    localStorage.setItem(STUDENT_ID_KEY, id)
  } catch {
    // 無視
  }
}

function clearStudentIdFromLocalStorage() {
  try {
    localStorage.removeItem(STUDENT_ID_KEY)
  } catch {
    // 無視
  }
}

// ---- Google Apps Script ウェブアプリとの通信 ----

function getWebAppUrl() {
  const url = window.SHEETS_CONFIG && window.SHEETS_CONFIG.webAppUrl
  if (!url || url.indexOf("xxxx") !== -1) {
    throw new Error("config.jsにGoogle Apps ScriptのウェブアプリURLを設定してください")
  }
  return url
}

async function apiGet(params) {
  const url = new URL(getWebAppUrl())
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url.toString())
  const data = await res.json()
  if (data && data.error) throw new Error(apiErrorMessage(data.error))
  return data
}

async function apiPost(body) {
  // Content-Typeを明示しない(text/plainのままにする)ことで、
  // Google Apps Script側でのCORSプリフライトの問題を回避する。
  const res = await fetch(getWebAppUrl(), {
    method: "POST",
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (data && data.error) throw new Error(apiErrorMessage(data.error))
  return data
}

function apiErrorMessage(error) {
  if (error === "not_found" || error === "student_not_found") return "データが見つかりませんでした"
  if (error === "unknown_action") return "通信エラーが発生しました"
  return error
}

// ---- 受講生・スタンプ操作 ----

async function registerOrResumeStudent(displayName, challenge) {
  const name = displayName.trim().slice(0, 40)
  if (!name) throw new Error("名前を入力してください")
  const trimmedChallenge = challenge.trim().slice(0, 80)
  if (!trimmedChallenge) throw new Error("チャレンジ内容を入力してください")

  return apiPost({ action: "registerOrResume", display_name: name, challenge: trimmedChallenge })
}

async function getStudentById(id) {
  if (!id) return null
  const data = await apiGet({ action: "get", id })
  return data && data.id ? data : null
}

async function toggleTodayStamp(studentId) {
  const data = await apiPost({ action: "toggleStamp", student_id: studentId })
  return data
}

async function listAllStudents() {
  return apiGet({ action: "list" })
}

function fireConfetti() {
  const colors = ["#ff8a5c", "#ffc93c", "#ff6f91", "#6bcb77", "#4d96ff"]
  confetti({ particleCount: 70, spread: 75, startVelocity: 38, origin: { y: 0.65 }, colors })
  confetti({ particleCount: 30, spread: 100, startVelocity: 25, origin: { y: 0.55 }, colors, scalar: 0.7 })
}
