import { handle, updatePrices } from './app.js';
import { GoogleSheets, FakeSheets } from './sheets.js';

let fake = null;
function sheetsFor(env) {
  if (env.FAKE_SHEETS === 'true' && env.ENVIRONMENT !== 'production') return fake || (fake = new FakeSheets());
  return new GoogleSheets(env);
}

export default {
  async fetch(request, env, ctx) {
    return handle(request, env, { sheets: sheetsFor(env), waitUntil: (p) => ctx.waitUntil(p) });
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(updatePrices(env, { sheets: sheetsFor(env) }));
  },
};
