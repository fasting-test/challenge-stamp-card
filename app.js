// 共通ロジック(登録ページ・カードページの両方から読み込む)
// データはすべてこの端末のブラウザ(localStorage)だけに保存する。
// 外部サービス(Supabaseなど)には一切送信しない。

const PROGRAM_LENGTH = 30
const STUDENT_ID_KEY = "csc_student_id"
const DB_KEY = "csc_db"

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

// ---- 今日の一言 ----

const QUOTES = [
  "今日のあなたが、未来のあなたをつくる。",
  "小さな一歩でも、続けたら大きな道になるよ。",
  "昨日の自分より、今日はちょっとだけ前へ。",
  "できた日もできなかった日も、続けてる時点でえらい。",
  "完璧じゃなくていい。今日もやる、それだけでいい。",
  "スタンプ1個、自分への信頼が1個増える。",
  "誰かと比べなくていい。あなたのペースでいい。",
  "今日の一押しが、30日後のあなたを笑顔にする。",
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
  "積もり積もった30日が、きっと自信になる。",
  "今日も自分を裏切らない。それだけでいい。",
  "変わりたいと思ったその日から、もう変わり始めてる。",
  "今日のひと押しが、明日のあなたを軽くする。",
  "「続けてる」という事実が、もう誇っていいこと。",
  "今日のあなたに、拍手を。",
  "ゴールは30日先。でも今日の1歩がすべて。",
]

function quoteForDay(doy) {
  const index = (((doy - 1) % QUOTES.length) + QUOTES.length) % QUOTES.length
  return QUOTES[index]
}

// ---- ローカル保存データベース(この端末のブラウザだけに閉じたデータ) ----

function loadDb() {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // 無視
  }
  return { students: {}, stamps: {} }
}

function saveDb(db) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db))
  } catch {
    // 保存できない環境(プライベートブラウズ等)では静かに諦める
  }
}

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

// ---- 受講生・スタンプ操作 ----
// 名前で登録する。既存(この端末内)の受講生と同じ名前ならその記録を返す(続きから)。

async function registerOrResumeStudent(displayName, challenge) {
  const name = displayName.trim().slice(0, 40)
  if (!name) throw new Error("名前を入力してください")

  const db = loadDb()
  const existing = Object.values(db.students).find((s) => s.display_name.toLowerCase() === name.toLowerCase())
  if (existing) return existing

  const trimmedChallenge = challenge.trim().slice(0, 80)
  if (!trimmedChallenge) throw new Error("チャレンジ内容を入力してください")

  const id = crypto.randomUUID()
  const student = { id, display_name: name, challenge: trimmedChallenge, start_date: todayStr() }
  db.students[id] = student
  db.stamps[id] = []
  saveDb(db)
  return student
}

async function getStudentById(id) {
  const db = loadDb()
  return db.students[id] ?? null
}

async function getStampDates(studentId) {
  const db = loadDb()
  return new Set(db.stamps[studentId] ?? [])
}

async function toggleTodayStamp(studentId) {
  const date = todayStr()
  const db = loadDb()
  const list = db.stamps[studentId] ?? []
  const idx = list.indexOf(date)
  if (idx >= 0) {
    list.splice(idx, 1)
    db.stamps[studentId] = list
    saveDb(db)
    return false
  }
  list.push(date)
  db.stamps[studentId] = list
  saveDb(db)
  return true
}

function fireConfetti() {
  const colors = ["#ff8a5c", "#ffc93c", "#ff6f91", "#6bcb77", "#4d96ff"]
  confetti({ particleCount: 70, spread: 75, startVelocity: 38, origin: { y: 0.65 }, colors })
  confetti({ particleCount: 30, spread: 100, startVelocity: 25, origin: { y: 0.55 }, colors, scalar: 0.7 })
}
