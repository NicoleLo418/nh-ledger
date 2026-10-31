# CLAUDE.md — nh-ledger

## ⚠️ 共用帳號：還有其他正在使用的 App，不要動

這個專案使用的 Cloudflare、GitHub、Google Cloud 帳號裡，還有另一個**正在使用中**的專案：

**阿母基金記帳／媽媽股票帳（家人每天在用）**
- Cloudflare Worker：`ama-fund-api`（網址 `https://ama-fund-api.nicole-nh.workers.dev`）
- GitHub repo：`NicoleLo418/ama-fund`（GitHub Pages：`https://nicolelo418.github.io/ama-fund/`）
- Google 服務帳號：`ama-fund-sheets@refreshing-well-499006-t0.iam.gserviceaccount.com`（Google Cloud 專案 My First Project / refreshing-well-499006-t0）
- LINE LIFF：`2011746619-WV6eVn7h`

### 不可以做的事
- **不要修改 Cloudflare 的 workers.dev 子網域**（目前是 `nicole-nh`）。它是整個帳號共用的，一改，`ama-fund-api` 的網址就會失效，家人的 App 全部停擺。
  （2026/10/31 就發生過：子網域被改掉，阿母基金和股票帳整天打不開。）
- 不要修改、重新部署或刪除 `ama-fund-api` 這個 Worker，也不要改它的設定或加密變數（secrets）。
- 不要動 `ama-fund-sheets@…` 這個服務帳號、它的金鑰，或它被共用的試算表。
- 不要修改 GitHub 上的 `ama-fund` repo。
- 不要改任何帳號層級的共用設定（帳號 API 權杖、Pages 設定、帳號成員等）。

### 規則
- 開始工作前，先列出帳號裡現有的 Worker 和 repo，確認自己只動 nh-ledger 的東西。
- nh-ledger 只用自己的 Worker（`nh-ledger-api`）、自己的 repo、自己的服務帳號與試算表。
- **需要動任何共用設定時，先停下來問 Nicole**，不要自己改。
