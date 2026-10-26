// Official daily closing prices: TWSE (上市) and TPEx (上櫃).
export const TWSE_URL = 'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL';
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

// Fetch both markets; one source failing does not block the other.
export async function fetchCloses(fetchImpl = fetch) {
  const headers = { 'user-agent': 'Mozilla/5.0 (nh-ledger daily close)', accept: 'application/json' };
  const result = {}, errors = [];
  try { const r = await fetchImpl(TWSE_URL, { headers }); if (!r.ok) throw new Error(`證交所 ${r.status}`); Object.assign(result, parseTwse(await r.json())); } catch (e) { errors.push(String(e.message || e)); }
  try { const r = await fetchImpl(TPEX_URL, { headers }); if (!r.ok) throw new Error(`櫃買中心 ${r.status}`); Object.assign(result, parseTpex(await r.json())); } catch (e) { errors.push(String(e.message || e)); }
  return { closes: result, errors };
}
