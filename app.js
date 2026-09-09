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

// ---- 今日の一言(受講生ごとの「開始日から何日目か」に対応する31日分) ----

const QUOTES = [
  { title: "決めた未来しか実現しない", body: "ゴールが明確でないと絶対にそこには辿り着けない。自分は「どんな未来を実現したいのか」を明確にすることからはじめよう。目指すものがなければ行動できないよ。" },
  { title: "すべてはテスト！正解は自分で作るしかない！", body: "間違いも、失敗も、唯一の正解もない！自分で考えて自分で選んだ道を、正解にしていく。すべてはそのためのテストだと思えば、なんでもできるよ。" },
  { title: "じゃあ、どうする？打つ手は無限！", body: "うまくいかない時は「じゃあ、どうする？」打つ手は無限！打つ手がない時は視野が狭くなってるよ。" },
  { title: "不快領域に飛び込もう　コンフォートゾーンを出る", body: "変化のない場所に成長はない。ドキドキや不安は、成長のサイン。その先に、まだ見ぬ素晴らしい景色が待っているよ。" },
  { title: "TY！とにかくやってみよう！", body: "頭でぐるぐると考える時間があったら、とにかくやってみよう。迷っている時間に行動できるよ。" },
  { title: "スポットライトを相手に当てる", body: "なんでわかってくれないの？そう思うときこそ相手の立場に立とう。相手を理解し、そして理解されるよ。" },
  { title: "行動だけが人生を変える", body: "どんなに理想を描いても、知識があっても、行動しないと現実は変わらない。この世は行動の星。小さな一歩でも、踏み出した人から人生は変わっていく。" },
  { title: "環境が人を創る", body: "自分の意志は弱いもの。意志の力に頼らず、なりたい自分がいる環境に、先に飛び込もう。付き合う人、身を置く場所、目にするものを変えていこう。" },
  { title: "過去は関係ない！今ここから！", body: "過去がどうだったかは、未来には一切関係ない。これからの未来を創るのは、今のあなた。今、この瞬間から、どんな自分にもなれる。" },
  { title: "言葉が未来を創る", body: "自分が発する言葉を一番近くで聞いているのは、自分の脳。ポジティブな言葉を使えば、脳が勝手に幸せな未来を探し始めるよ。" },
  { title: "失敗は成功へのデータ収集　失敗は折り込み済み", body: "失敗は最初から折り込み済み。失敗は「この方法ではうまくいかない」という貴重なデータを得たということ。成功するまで続ければ、失敗は経験に変わる。" },
  { title: "Give, Give, Give!", body: "もらうことばかり考えてない？まずは自分から与えること。見返りを求めず、自分ができることで誰かを喜ばせよう。その循環が豊かさを連れてくる。" },
  { title: "「ある」に目を向ける", body: "足りないもの探しはやめよう。今、目の前にあるもの、持っている才能、恵まれている環境に感謝しよう。「ある」を見れば、豊かさは加速する。" },
  { title: "比べるのは昨日の自分", body: "他人と比べて落ち込むのは時間の無駄。昨日の自分より、ほんの少しでも前進していればOK。自分のペースで、自分だけの道を歩もう。" },
  { title: "まず、決める。方法は後で脳が勝手に探してくれる", body: "根拠なんてなくていい。どうやるかなんて後回しでいい。まず「こうなる！」と決める。決めるから、必要な情報やチャンスが引き寄せられる。" },
  { title: "チャンスはピンチの顔をしてやってくる", body: "トラブルやピンチはチャンスです。神様が進む方向を軌道修正してくれてます。今、目の前のことに集中しよう。打つ手は無限！" },
  { title: "思考が行動を作り行動がスキルを作りスキルが現実を作る", body: "全ては価値観で決まる。いい価値観をインストールしてアップデートさせよう。" },
  { title: "初期こそ大量行動", body: "すごい人も最初は初心者。表には出さないけど、必ず大量行動をして今があるよ。" },
  { title: "頭の中がいっぱいになったら書き出して分解する", body: "それは誰の問題なのか？他人の問題まで解決する必要はないよ。とにかく紙に書き出して整理しよう。" },
  { title: "エッセンシャル思考で動こう", body: "やった方が良いことは手放し、やらなければいけないことだけにエネルギーを注ごう。たくさんやるとエネルギーが分散するよ。" },
  { title: "忙しすぎる時は第2象限が足りていない", body: "人に任せる仕組み作りや効率化するための学びなど、自分の将来に時間を投資しよう。" },
  { title: "モチベーション・メンタルが落ちてる時は寝不足", body: "心は体から作られます。まずはしっかり寝て栄養を取れば回復します。" },
  { title: "赤ちゃんはプロテインを飲まない", body: "ステージが違えばやることも違います。ステージの違う人を見て落ち込まないで。落ち込んでいる暇はないよ。" },
  { title: "大事なことには時間がかかる", body: "行動と結果にはタイムラグがある。焦らないで。二次関数的に結果がついてきます。" },
  { title: "五点でも出そう", body: "バッターボックスに立たずにバットを磨いているだけでは一点も取れないよ。60パーセントでも世に出してみて軌道修正すればいい。インプットとアウトプットの高速回転が成功の鍵。" },
  { title: "感情は作り出せる", body: "出来事に支配される人生から、感情を「デザイン」する人生へ。" },
  { title: "自分の価値観に沿って生きることが自分軸", body: "誰かの無責任な言葉に惑わされないで。自分の幸せは自分が決める。" },
  { title: "発信のブロックを外そう！", body: "発信で大事なのは目立つ勇気。矢印を自分に向けないで、相手に向けよう！" },
  { title: "Greatの敵はGood", body: "これくらいでいいかな、まあまあ幸せを手放そう！そこに成長はない。" },
  { title: "人を動かしたければ、自分が動く", body: "自分の心・身体・人生を動かしていない人が人を動かせるはずがない。" },
  { title: "基準値を上げる　価値観をずっと変え続ける", body: "今の自分はこれまでの自分の基準値が作り出した結果。自分よりステージの高い人の基準値を見よう。価値観をアップデートしていこう！" },
]

// dayNumber: 受講生の開始日から数えた日数(1〜31)。範囲外は最初/最後の一言に揃える
function quoteForDay(dayNumber) {
  const index = Math.min(Math.max(dayNumber, 1), QUOTES.length) - 1
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
