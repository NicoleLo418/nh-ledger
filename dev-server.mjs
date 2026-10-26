// Local preview: serves web/ and the Worker API (in-memory sheet, DEV_MODE) on one port. Never used in production.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { handle } from './worker/src/app.js';
import { FakeSheets } from './worker/src/sheets.js';
import { pinHash } from './worker/src/core.js';

const PORT = +(process.argv[3] || 8787), ORIGIN = `http://localhost:${PORT}`;
const env = { ENVIRONMENT: 'development', DEV_MODE: 'true', ALLOWED_ORIGIN: ORIGIN, LINE_CHANNEL_ID: 'dev', PIN_PEPPER: 'dev-pepper' };
const salt = 'devsalt';
const sheets = new FakeSheets({
  members: [
    { lineId: 'U-nicole', lineName: 'Nicole', name: 'Nicole', role: '管理者', status: '已核准', appliedAt: '2026-10-26 09:00:00' },
    { lineId: 'U-hsiao', lineName: 'HSIAO', name: 'HSIAO', role: '成員', status: '已核准', appliedAt: '2026-10-26 09:05:00' },
    { lineId: 'U-pending', lineName: '王小明', name: '', role: '成員', status: '待核准', appliedAt: '2026-10-26 09:10:00' },
  ],
  settings: [{ key: '目標金額', value: 1000000 }, { key: '起始日', value: '2026-10-26' }, { key: '目標日', value: '2028-10-26' }, { key: '密碼雜湊', value: `${salt}:${await pinHash('2468', salt, 'dev-pepper')}` }],
  trades: [
    { id: 'T-1', date: '2026-10-20', side: '買進', code: '0050', name: '元大台50', shares: 100, price: 107.3, fee: 2, tax: 0, cashflow: -10732, by: 'Nicole', createdAt: '2026-10-26 13:05:04', deleted: false },
    { id: 'T-2', date: '2026-10-22', side: '買進', code: '0050', name: '元大台50', shares: 100, price: 107, fee: 2, tax: 0, cashflow: -10702, by: 'Nicole', createdAt: '2026-10-26 13:05:31', deleted: false },
  ],
  cash: [
    { id: 'C-1', date: '2026-10-20', type: '存入', perPerson: 15000, total: 30000, amount: 0, createdAt: '2026-10-26 13:00:53', deleted: false },
    { id: 'C-2', date: '2026-10-26', type: '存入', perPerson: 30000, total: 60000, amount: 0, createdAt: '2026-10-26 14:24:46', deleted: false },
  ],
  prices: [{ code: '0050', name: '元大台灣50', market: '上市', close: 106.9, date: '2026-10-26', fetchedAt: '2026-10-26 14:40:00' }],
});
const user = process.argv[2] || 'U-nicole';
createServer(async (req, res) => {
  if (req.url.startsWith('/api/')) {
    const chunks = []; for await (const c of req) chunks.push(c);
    const headers = new Headers(); for (const [k, v] of Object.entries(req.headers)) headers.set(k, v);
    headers.set('origin', ORIGIN);
    const r = await handle(new Request(ORIGIN + req.url, { method: req.method, headers, body: chunks.length ? Buffer.concat(chunks) : undefined }), env, { sheets });
    res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer())); return;
  }
  const file = req.url === '/' || req.url.startsWith('/?') ? 'index.html' : req.url.slice(1).split('?')[0];
  if (file === 'config.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(`window.NH_CONFIG={api:'${ORIGIN}',devUser:'${user}'}`); return; }
  try { const body = readFileSync(new URL(`./web/${file}`, import.meta.url)); res.writeHead(200, { 'content-type': file.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); res.end(body); }
  catch { res.writeHead(404); res.end('not found'); }
}).listen(PORT, () => console.log(`dev on ${ORIGIN} as ${user}`));
