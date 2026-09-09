# 31日間チャレンジ達成カード

受講生が自分で決めたチャレンジを、31日間やり通すための記録用Webアプリ。

- 受講生名・チャレンジ内容(自分で決めた目標)を入力してスタート
- 毎日、その日のマスをタップするとスタンプが押される(紙吹雪つき)
- 31マスすべて貯まると、ごほうび画面が表示される
- トップには日替わりのやる気の出る一言を表示
- **同じ1つのURLの中に「受講生」「管理者」タブがあり、切り替えて使う**。管理者タブでは全受講生の進捗を一覧で確認できる

受講生はアカウント登録不要。名前を入力するだけで開始でき、同じ名前を再入力すると続きから記録できます(データはGoogleスプレッドシートに集約されるので、**別の端末で開いても続きから記録できます**)。

## 技術構成

ビルド不要の静的サイト(HTML / CSS / 素のJavaScript)。GitHub Pagesにそのままpushするだけで公開できます。

- データはGoogle Apps Script経由でGoogleスプレッドシートに保存される(全受講生ぶんが1つのシートに集まるので、管理者が一覧で見られる)
- ログイン基盤は持たないため、書き込みは誰でもできる状態(受講生名・チャレンジ内容は機微な個人情報ではない前提の割り切り)
- 管理者タブは合言葉(`config.js`の`adminPin`)を入れないと中身が見えない。本格的なパスワード保護ではなく、「知らない人が偶然タブを開いても見えない」程度のもの

## セットアップ

### 1. Googleスプレッドシート + Apps Scriptを準備する

1. [sheets.google.com](https://sheets.google.com) で新しいスプレッドシートを作成(名前は何でもOK、例: 「challenge-stamp-card DB」)
2. メニューの「拡張機能」→「Apps Script」を開く
3. エディタの中身を全部削除して、[`apps-script/Code.gs`](apps-script/Code.gs) の内容をすべて貼り付けて保存(Ctrl/Cmd+S)
4. 右上の「デプロイ」→「新しいデプロイ」
5. 歯車アイコン(種類の選択)→「ウェブアプリ」を選択
6. 以下のように設定:
   - 説明: 何でもよい
   - 次のユーザーとして実行: **自分**
   - アクセスできるユーザー: **全員**
7. 「デプロイ」をクリック → 初回はGoogleアカウントの確認・許可画面が出るので許可する
8. 表示された **ウェブアプリのURL**(`https://script.google.com/macros/s/.../exec` の形)をコピーする

### 2. 設定ファイルを埋める

[`config.js`](config.js) を開いて、コピーしたURLと、管理者タブ用の合言葉を決めて書き込みます。

```js
window.SHEETS_CONFIG = {
  webAppUrl: "https://script.google.com/macros/s/....../exec",
  adminPin: "好きな合言葉に変更してください",
}
```

### 3. 動作確認

ウェブアプリのURLをブラウザで直接開いて `[]` と表示されればOK(まだ受講生が0人という意味)。

```bash
node scripts/serve.cjs
```

[http://localhost:8090](http://localhost:8090) を開き、上部の「受講生」「管理者」タブで切り替えて確認できます。

### Code.gsを更新したときは

Apps Scriptのコードを直したら、「デプロイ」→「デプロイを管理」→ 既存のデプロイの鉛筆アイコン →「バージョン: 新バージョン」を選んで「デプロイ」を押すと、同じURLのまま更新できます(新規デプロイし直すとURLが変わってしまうので注意)。

### style.css / app.js を更新したときは

GitHub Pagesはこれらのファイルをブラウザに強めにキャッシュさせるため、中身を直しただけだと古い見た目のまま変わって見えないことがあります。[`index.html`](index.html)内の `style.css?v=2` / `app.js?v=2` の数字を1つ増やす(`v=3`など)と、キャッシュを無視して読み直させられます。

## GitHub Pagesへのデプロイ

1. GitHubで新しいリポジトリを作成する(Public)
2. このフォルダの中身をそのままpushする

   ```bash
   git init
   git add .
   git commit -m "初回コミット"
   git branch -M main
   git remote add origin https://github.com/(あなたのアカウント)/(リポジトリ名).git
   git push -u origin main
   ```

3. GitHubのリポジトリ画面 → `Settings` → `Pages` → `Build and deployment` の `Source` を `Deploy from a branch` にし、`Branch` を `main` / `/(root)` に設定して保存
4. 数分後、`https://(あなたのアカウント).github.io/(リポジトリ名)/` で公開されます

## 配る時のURLについて

LINEで配る場合は、URLの末尾に `?openExternalBrowser=1` を付けて配ってください(LINE内ブラウザだと保存や表示が崩れることがあるための対策)。

例: `https://(あなたのアカウント).github.io/(リポジトリ名)/?openExternalBrowser=1`

## 管理者一覧の見方

受講生用と同じURLを開き、上部の「管理者」タブをクリックすると合言葉の入力画面になります。`config.js`の`adminPin`に設定した合言葉を入れると、達成日数の多い順に全受講生が並びます。

より詳しく見たい・自分で集計したい場合は、Apps Scriptを貼り付けたスプレッドシート自体を直接開いても、同じデータをそのまま確認・並べ替えできます。
