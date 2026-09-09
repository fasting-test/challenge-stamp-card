# 30日間チャレンジ達成カード

受講生が自分で決めたチャレンジを、30日間やり通すための記録用Webアプリ。

- 受講生名・チャレンジ内容(自分で決めた目標)を入力してスタート
- 毎日、その日のマスをタップするとスタンプが押される(紙吹雪つき)
- 30マスすべて貯まると、ごほうび画面が表示される
- トップには日替わりのやる気の出る一言を表示

受講生はアカウント登録不要。名前を入力するだけで開始でき、同じ名前を再入力すると続きから記録できます。

## 技術構成

ビルド不要・外部サービス不要の静的サイト(HTML / CSS / 素のJavaScript)。GitHub Pagesにそのままpushするだけで公開できます。

- データは**その受講生のスマホ(ブラウザのlocalStorage)の中だけ**に保存される。サーバーやデータベースは使わない
- 登録フォームの入力内容もlocalStorageに自動保存され、ページを閉じても消えない

### この方式の注意点(トレードオフ)

- 同じ受講生が別の端末(スマホ→PCなど)で開くと、記録は引き継がれない(その端末では0からになる)。**基本的に、いつも同じ1台のスマホで開いてもらう前提**の設計
- 端末やブラウザの「サイトデータを削除」をすると記録も消える
- 運営側が全受講生の進捗をまとめて見る管理画面はない(各自の端末の中にしかデータがないため)

複数端末での同期や、運営側の進捗確認が必要になった場合は、Supabaseなどの外部データベースを使う構成に変更できます(姉妹プロジェクト `gratitude-stamp-card` が同様の構成です)。

## ローカルで確認

ブラウザで `index.html` を直接開くか、簡易サーバーで確認します。

```bash
node scripts/serve.cjs
```

[http://localhost:8090](http://localhost:8090) にアクセスします。

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
