# NH 財富自由的路上 · 共同投資帳本

Nicole 與 HSIAO 的共同投資帳本。前端放在 GitHub Pages，後端是 Cloudflare Worker，資料存在 Google 試算表「NH財富自由的路上」。

> 這個 repo 是公開的：**程式碼裡沒有任何金鑰、密碼、個資**。金鑰都存在 Cloudflare（wrangler secret）與 GitHub Secrets。

## 架構

| 部分 | 位置 | 說明 |
|---|---|---|
| 畫面 | `web/` | 純 HTML + 原生 JS，LINE LIFF 登入 |
| 後端 | `worker/` | Cloudflare Worker：驗證 LINE 身分、權限、驗證資料、讀寫試算表、每交易日 14:40 / 16:30 抓收盤價 |
| 資料 | Google 試算表 | 交易、資金進出、成員、設定、收盤價、異動紀錄；總覽／持股明細／個股損益由系統產生 |

## 規則

- 每個請求都帶 LINE ID Token，由 Worker 呼叫 LINE verify API 驗證；不信任前端傳來的身分。
- 權限由後端把關：待核准、停用、不在名單的人拿不到任何資料。
- 刪除都是軟刪除；新增、修改、刪除都寫入「異動紀錄」。
- 寫入帶 requestId，網路重試不會重複記帳。
- 日期不能是未來，股數、價格、金額由後端驗證；不能賣超、領出超過餘額要再確認。
- 請在網頁上修改，不要直接改試算表。

## 開發

```bash
npm test            # 自動測試（含以沒權限身分呼叫每個 API）
node dev-server.mjs # 本機預覽（假資料，PIN 2468）
node scripts/preflight.mjs  # 上線前檢查
```

## 部署

推到 `main` 分支後，GitHub Actions 會：

1. 跑全部測試與上線前檢查（DEV_MODE 必須關閉、不能留佔位字、不能有金鑰）
2. 全部通過才部署 Worker 與網頁

需要的 GitHub Secrets：`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`
需要的 Cloudflare Worker secrets：`GOOGLE_SA_JSON`（服務帳號金鑰整份 JSON）、`PIN_PEPPER`
