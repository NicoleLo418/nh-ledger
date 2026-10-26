// Official daily closing prices: TWSE (上市) and TPEx (上櫃).
export const TWSE_URL = 'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL';
export const TPEX_OPENAPI_URL = 'https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes';
export const MIS_URL = 'https://mis.twse.com.tw/stock/api/getStockInfo.jsp';
export const TPEX_URL = 'https://www.tpex.org.tw/www/zh-tw/afterTrading/otc?type=EW&response=json';

export function rocToIso(s) {
  const m = String(s || '').trim().match(/^(\d{2,3})(\d{2})(\d{2})$/);
  return m ? `${+m[1] + 1911}-${m[2]}-${m[3]}` : '';
}

export function parseTwse(rows) {
  if (!Array.isArray(rows)) throw new Error('證交所回傳格式改變');
  const out = {};
  for (const r of rows) {
    if (!r || !('Code' in r) || !('ClosingPrice' in r)) throw new Error('證交所欄位格式改變');
    const close = parseFloat(String(r.ClosingPrice || '').replace(/,/g, ''));
    if (!(close > 0)) continue;
    out[String(r.Code).trim()] = { close, date: rocToIso(r.Date), market: '上市', name: String(r.Name || '').trim() };
  }
  return out;
}

export function parseTpex(resp) {
  if (!resp || !Array.isArray(resp.tables)) throw new Error('櫃買中心回傳格式改變');
  const t = resp.tables[0];
  if (!t || !Array.isArray(t.data) || !t.data.length) return {};
  const fields = (t.fields || []).map((f) => String(f).replace(/<br>/g, '').replace(/\s+/g, ''));
  const ci = fields.indexOf('代號'), ni = fields.indexOf('名稱'), cc = fields.indexOf('收盤');
  if (ci < 0 || cc < 0) throw new Error('櫃買中心欄位格式改變');
  const d = String(resp.date || '');
  const date = /^\d{8}$/.test(d) ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : '';
  const out = {};
  for (const row of t.data) {
    const close = parseFloat(String(row[cc] || '').replace(/,/g, ''));
    if (!(close > 0)) continue;
    out[String(row[ci]).trim()] = { close, date, market: '上櫃', name: ni >= 0 ? String(row[ni]).trim() : '' };
  }
  return out;
}

// TPEx OpenAPI：欄位名稱接受常見寫法；找不到就丟錯，不會寫入錯的價格
const pick = (r, keys) => { for (const k of keys) if (k in r) return r[k]; return undefined; };
export function parseTpexOpenApi(rows) {
  if (!Array.isArray(rows)) throw new Error('櫃買中心 OpenAPI 回傳格式改變');
  const out = {};
  for (const r of rows) {
    if (!r) continue;
    const code = pick(r, ['SecuritiesCompanyCode', 'Code', 'SecuritiesCode', '代號']);
    const closeRaw = pick(r, ['Close', 'ClosingPrice', '收盤']);
    if (code === undefined || closeRaw === undefined) throw new Error('櫃買中心 OpenAPI 欄位格式改變：' + Object.keys(r).slice(0, 8).join(','));
    const close = parseFloat(String(closeRaw || '').replace(/,/g, ''));
    if (!(close > 0)) continue;
    const d = String(pick(r, ['Date', '資料日期']) || '');
    const date = /^\d{8}$/.test(d) ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : rocToIso(d);
    out[String(code).trim()] = { close, date, market: '上櫃', name: String(pick(r, ['CompanyName', 'Name', '名稱']) || '').trim() };
  }
  return out;
}

// 證交所行情系統（上市、上櫃都有）：只查指定代號；收盤後 z 就是當日收盤價
export function parseMis(resp) {
  if (!resp || !Array.isArray(resp.msgArray)) throw new Error('行情系統回傳格式改變');
  const out = {};
  for (const r of resp.msgArray) {
    if (!r || !r.c) continue;
    const close = parseFloat(String(r.z || '').replace(/,/g, ''));
    if (!(close > 0)) continue;
    const d = String(r.d || '');
    out[String(r.c).trim()] = { close, date: /^\d{8}$/.test(d) ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : '', market: r.ex === 'otc' ? '上櫃' : '上市', name: String(r.n || '').trim() };
  }
  return out;
}
export async function fetchMis(codes, fetchImpl = fetch) {
  const list = [...codes].filter((c) => /^[0-9A-Z]{4,6}$/.test(c)).slice(0, 40);
  if (!list.length) return {};
  const exch = list.flatMap((c) => [`tse_${c}.tw`, `otc_${c}.tw`]).join('|');
  const r = await fetchImpl(`${MIS_URL}?ex_ch=${encodeURIComponent(exch)}&json=1&delay=0`, { headers: { 'user-agent': 'Mozilla/5.0 (nh-ledger daily close)', accept: 'application/json', referer: 'https://mis.twse.com.tw/stock/index.jsp' } });
  if (!r.ok) throw new Error(`行情系統 ${r.status}`);
  return parseMis(await r.json());
}

// Fetch both markets; one source failing does not block the other.
export async function fetchCloses(fetchImpl = fetch, codes = null) {
  const headers = { 'user-agent': 'Mozilla/5.0 (nh-ledger daily close)', accept: 'application/json' };
  const result = {}, errors = [];
  try { const r = await fetchImpl(TWSE_URL, { headers }); if (!r.ok) throw new Error(`證交所 ${r.status}`); Object.assign(result, parseTwse(await r.json())); } catch (e) { errors.push(String(e.message || e)); }
  // 櫃買中心：先用 OpenAPI，失敗再試網站資料
  let tpexErr = '';
  try { const r = await fetchImpl(TPEX_OPENAPI_URL, { headers }); if (!r.ok) throw new Error(`櫃買中心 OpenAPI ${r.status}`); Object.assign(result, parseTpexOpenApi(await r.json())); }
  catch (e) {
    tpexErr = String(e.message || e).slice(0, 200);
    try { const r = await fetchImpl(TPEX_URL, { headers, redirect: 'manual' }); if (!r.ok) throw new Error(`櫃買中心網站 ${r.status}`); Object.assign(result, parseTpex(await r.json())); }
    catch (e2) { errors.push(tpexErr + '；' + String(e2.message || e2).slice(0, 200)); }
  }
  // 有指定代號時，再用行情系統補上缺的或比較新的價格（櫃買中心擋 Cloudflare 時靠這個）
  if (codes && codes.size) {
    try {
      const mis = await fetchMis(codes, fetchImpl);
      for (const [code, c] of Object.entries(mis)) if (!result[code] || (c.date && c.date > (result[code].date || ''))) result[code] = c;
    } catch (e) { errors.push(String(e.message || e).slice(0, 200)); }
  }
  return { closes: result, errors };
}
