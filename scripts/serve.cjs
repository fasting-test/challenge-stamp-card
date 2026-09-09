// ビルド不要の静的サイトをローカル確認するための最小限のサーバー。
// (python3 -m http.serverはpreview_startのサンドボックスでgetcwdに失敗するため使わない)
const http = require("http")
const fs = require("fs")
const path = require("path")

const root = path.resolve(__dirname, "..")
const port = 8090

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".sql": "text/plain; charset=utf-8",
}

http
  .createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split("?")[0])
    if (urlPath === "/") urlPath = "/index.html"
    const filePath = path.join(root, urlPath)
    if (!filePath.startsWith(root)) {
      res.writeHead(403)
      res.end("forbidden")
      return
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404)
        res.end("not found")
        return
      }
      const ext = path.extname(filePath)
      res.writeHead(200, { "Content-Type": mime[ext] || "application/octet-stream" })
      res.end(data)
    })
  })
  .listen(port, () => {
    console.log(`serving ${root} at http://localhost:${port}`)
  })
