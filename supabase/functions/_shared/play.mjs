// Google Play purchase checks for the Khan Blocks Edge Functions (verify-purchase, voided-purchases).
// Plain JavaScript (ES module) using only web-standard APIs (fetch, Request, Response, WebCrypto, TextEncoder),
// so the same file runs in Supabase's Deno runtime and in Node 22 for the tests (supabase/functions/tests/).
// Setup and secrets: docs/MONETIZATION.md. The products must match sku_kind()/sku_coins() in
// supabase/migrations/20261118000000_payments.sql and COIN_PACKS in src/js/55-store.js.

export const PACKS = { coins_small: 500, coins_medium: 1200, coins_large: 3500 };
export const validSku = (s) => typeof s === 'string' && /^(remove_ads|coins_(small|medium|large)|pass_[a-z0-9]{1,16})$/.test(s);
export const isPack = (s) => Object.prototype.hasOwnProperty.call(PACKS, s);
export const validToken = (t) => typeof t === 'string' && t.length >= 10 && t.length <= 4096 && /^[A-Za-z0-9._:-]+$/.test(t);

export const PLAY_SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
export const TOKEN_URI = 'https://oauth2.googleapis.com/token';
const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/';
export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ---------------------------------------------------------------- small helpers
const enc = new TextEncoder();
export function b64url(bytes) {
  let s = '';
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export async function sha256Hex(text) {
  const h = await crypto.subtle.digest('SHA-256', enc.encode(String(text)));
  return [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
export function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}
function sameText(a, b) {                       // compares without stopping at the first difference
  a = String(a); b = String(b);
  let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) | 0) ^ (b.charCodeAt(i) | 0);
  return d === 0;
}

// ---------------------------------------------------------------- configuration (function secrets)
// SUPABASE_URL and the keys are provided by Supabase; GOOGLE_SERVICE_ACCOUNT_JSON (the whole JSON key file of a
// service account with access to the app in Play Console) and PLAY_PACKAGE_NAME are set with `supabase secrets set`.
function firstKey(dictJson) {
  try {
    const d = JSON.parse(dictJson || '');
    if (d && typeof d === 'object') return d.default || Object.values(d).find((v) => typeof v === 'string') || '';
  } catch (_) { /* not set */ }
  return '';
}
export function readConfig(env) {
  const url = String(env('SUPABASE_URL') || '').replace(/\/+$/, '');
  const serviceKey = firstKey(env('SUPABASE_SECRET_KEYS')) || env('SUPABASE_SERVICE_ROLE_KEY') || '';
  const publicKey = firstKey(env('SUPABASE_PUBLISHABLE_KEYS')) || env('SUPABASE_ANON_KEY') || serviceKey;
  const pkg = env('PLAY_PACKAGE_NAME') || 'com.anaraa.khanblocks';
  let sa = null;
  try { sa = parseServiceAccount(env('GOOGLE_SERVICE_ACCOUNT_JSON') || ''); } catch (_) { sa = null; }
  if (!url || !serviceKey || !sa || !/^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/i.test(pkg)) return null;
  return { url, serviceKey, publicKey, pkg, sa, cronSecret: env('CRON_SECRET') || '' };
}
// New secret keys (sb_secret_...) go only in apikey; a legacy service_role JWT goes in both headers.
export function serviceHeaders(key) {
  const h = { apikey: key, 'Content-Type': 'application/json' };
  if (!String(key).startsWith('sb_')) h.Authorization = 'Bearer ' + key;
  return h;
}

// ---------------------------------------------------------------- Google OAuth for a service account (JWT, RS256)
export function parseServiceAccount(text) {
  const sa = typeof text === 'string' ? JSON.parse(text) : text;
  if (!sa || typeof sa.client_email !== 'string' || typeof sa.private_key !== 'string') throw new Error('bad_service_account');
  return { email: sa.client_email, key: sa.private_key, tokenUri: sa.token_uri || TOKEN_URI };
}
export function jwtClaims(sa, nowSec) {
  return { iss: sa.email, scope: PLAY_SCOPE, aud: sa.tokenUri, iat: nowSec, exp: nowSec + 3600 };
}
function pemToDer(pem) {
  const bin = atob(String(pem).replace(/-----[A-Z ]+-----/g, '').replace(/\\n/g, '').replace(/\s+/g, ''));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}
export async function signJwt(sa, nowSec) {
  const input = b64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))) + '.' + b64url(enc.encode(JSON.stringify(jwtClaims(sa, nowSec))));
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(sa.key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(input));
  return input + '.' + b64url(sig);
}
// One access token per function instance, renewed a minute before it runs out.
export function googleToken(sa, fetchFn, now) {
  let cached = null;
  return async () => {
    const t = Math.floor(now() / 1000);
    if (cached && cached.exp - 60 > t) return cached.token;
    const assertion = await signJwt(sa, t);
    const r = await fetchFn(sa.tokenUri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }).toString(),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || typeof d.access_token !== 'string') throw Object.assign(new Error('google_auth_failed'), { status: 502 });
    cached = { token: d.access_token, exp: t + (Number(d.expires_in) || 3600) };
    return cached.token;
  };
}

// ---------------------------------------------------------------- Google Play Developer API (androidpublisher v3)
export const purchaseUrl = (pkg, token) => API + encodeURIComponent(pkg) + '/purchases/productsv2/tokens/' + encodeURIComponent(token);
export const finishUrl = (pkg, sku, token, consume) =>
  API + encodeURIComponent(pkg) + '/purchases/products/' + encodeURIComponent(sku) + '/tokens/' + encodeURIComponent(token) + (consume ? ':consume' : ':acknowledge');
export function voidedUrl(pkg, startMs, pageToken) {
  const q = new URLSearchParams({ type: '0', startTime: String(startMs) });
  if (pageToken) q.set('token', pageToken);
  return API + encodeURIComponent(pkg) + '/purchases/voidedpurchases?' + q.toString();
}
// What a ProductPurchaseV2 (purchases.productsv2.getproductpurchasev2) says about the product the app named.
export function readPurchase(p, sku) {
  if (!p || typeof p !== 'object') return { ok: false, error: 'bad_response' };
  const item = (Array.isArray(p.productLineItem) ? p.productLineItem : []).find((i) => i && i.productId === sku);
  if (!item) return { ok: false, error: 'wrong_product' };
  const state = (p.purchaseStateContext && p.purchaseStateContext.purchaseState) || 'PURCHASE_STATE_UNSPECIFIED';
  if (state === 'PENDING') return { ok: false, error: 'pending' };
  if (state !== 'PURCHASED') return { ok: false, error: 'not_purchased' };
  const offer = item.productOfferDetails || {};
  return {
    ok: true, sku,
    orderId: typeof p.orderId === 'string' ? p.orderId : null,
    account: typeof p.obfuscatedExternalAccountId === 'string' ? p.obfuscatedExternalAccountId : '',
    test: !!(p.testPurchaseContext && p.testPurchaseContext.fopType === 'TEST'),
    acknowledged: p.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED',
    consumed: offer.consumptionState === 'CONSUMPTION_STATE_CONSUMED',
    purchasedAt: typeof p.purchaseCompletionTime === 'string' ? p.purchaseCompletionTime : null,
    quantity: Number(offer.quantity) || 1,
  };
}
const RECORD_ERRORS = { token_used: 409, purchase_revoked: 409, token_mismatch: 409, bad_sku: 400, bad_token: 400, no_profile: 404 };

// ---------------------------------------------------------------- verify-purchase
// POST {sku, token, restore?} with the player's Supabase session in Authorization.
// 1. who is calling (Supabase Auth)  2. what Google Play says about the token  3. the purchase belongs to this
// account (the app passes SHA-256 of the user id as the obfuscated account id)  4. record_purchase grants it once
// (service role)  5. consume a coin pack / acknowledge the rest with Google (unfinished purchases are refunded
// after 3 days). Answers {ok: true, status, coins, profile, skus, paid, ads, finished} or {ok: false, error}.
export function createVerifyHandler({ env, fetch: fetchFn, now = () => Date.now() }) {
  let cfg = null, token = null;
  return async function handle(req) {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
    if (!cfg) { cfg = readConfig(env); if (cfg) token = googleToken(cfg.sa, fetchFn, now); }
    if (!cfg) return json({ ok: false, error: 'not_configured' }, 500);
    const auth = req.headers.get('authorization') || '';
    if (!/^Bearer\s+\S+$/.test(auth)) return json({ ok: false, error: 'not_signed_in' }, 401);
    let user = null;
    try {
      const ur = await fetchFn(cfg.url + '/auth/v1/user', { headers: { apikey: cfg.publicKey, Authorization: auth } });
      user = ur.ok ? await ur.json() : null;
    } catch (_) { return json({ ok: false, error: 'auth_unreachable' }, 502); }
    if (!user || typeof user.id !== 'string') return json({ ok: false, error: 'not_signed_in' }, 401);
    let body = null;
    try { body = await req.json(); } catch (_) { body = null; }
    const sku = body && body.sku, ptoken = body && body.token, restore = !!(body && body.restore);
    if (!validSku(sku) || !validToken(ptoken)) return json({ ok: false, error: 'bad_request' }, 400);
    try {
      const access = await token();
      const pr = await fetchFn(purchaseUrl(cfg.pkg, ptoken), { headers: { Authorization: 'Bearer ' + access } });
      if (pr.status === 400 || pr.status === 404 || pr.status === 410) return json({ ok: false, error: 'invalid_token' }, 400);
      if (!pr.ok) return json({ ok: false, error: 'google_error' }, 502);
      const info = readPurchase(await pr.json(), sku);
      if (!info.ok) return json({ ok: false, error: info.error }, info.error === 'pending' ? 202 : 400);
      // bought from another game account: only a non-consumable may follow the Google account on "Restore purchases"
      if (info.account && info.account !== await sha256Hex(user.id) && !(restore && !isPack(sku))) {
        return json({ ok: false, error: 'other_account' }, 403);
      }
      const rr = await fetchFn(cfg.url + '/rest/v1/rpc/record_purchase', {
        method: 'POST', headers: serviceHeaders(cfg.serviceKey),
        body: JSON.stringify({ p_user: user.id, p_sku: sku, p_token: ptoken, p_order_id: info.orderId, p_purchased_at: info.purchasedAt, p_test: info.test, p_restore: restore }),
      });
      const rec = await rr.json().catch(() => null);
      if (!rr.ok) {
        const m = rec && typeof rec.message === 'string' ? rec.message : '';
        return RECORD_ERRORS[m] ? json({ ok: false, error: m }, RECORD_ERRORS[m]) : json({ ok: false, error: 'record_failed' }, 500);
      }
      let finished = isPack(sku) ? info.consumed : info.acknowledged;
      if (!finished) {
        const fr = await fetchFn(finishUrl(cfg.pkg, sku, ptoken, isPack(sku)), {
          method: 'POST', headers: { Authorization: 'Bearer ' + access, 'Content-Type': 'application/json' }, body: '{}',
        });
        finished = fr.ok;
      }
      return json({ ...(rec && typeof rec === 'object' ? rec : {}), ok: true, finished });
    } catch (e) {
      return json({ ok: false, error: e && e.message === 'google_auth_failed' ? 'google_auth_failed' : 'server_error' }, 502);
    }
  };
}

// ---------------------------------------------------------------- voided-purchases
// Refunds, chargebacks and cancellations from the Voided Purchases API take back what was granted
// (revoke_purchase). Run it once a day (Supabase Cron, docs/MONETIZATION.md) with the header x-cron-secret.
// ?days=N looks N days back (1-30, default 3; the API keeps 30 days).
export function createVoidedHandler({ env, fetch: fetchFn, now = () => Date.now() }) {
  let cfg = null, token = null;
  return async function handle(req) {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (req.method !== 'POST' && req.method !== 'GET') return json({ ok: false, error: 'method_not_allowed' }, 405);
    if (!cfg) { cfg = readConfig(env); if (cfg) token = googleToken(cfg.sa, fetchFn, now); }
    if (!cfg || !cfg.cronSecret) return json({ ok: false, error: 'not_configured' }, 500);
    if (!sameText(req.headers.get('x-cron-secret') || '', cfg.cronSecret)) return json({ ok: false, error: 'forbidden' }, 401);
    const days = Math.min(30, Math.max(1, parseInt(new URL(req.url).searchParams.get('days') || '3', 10) || 3));
    const start = now() - days * 864e5 + 60e3;
    let page = '', checked = 0, revoked = 0, pages = 0;
    try {
      const access = await token();
      do {
        const r = await fetchFn(voidedUrl(cfg.pkg, start, page), { headers: { Authorization: 'Bearer ' + access } });
        if (!r.ok) return json({ ok: false, error: 'google_error', checked, revoked }, 502);
        const d = await r.json();
        for (const v of Array.isArray(d.voidedPurchases) ? d.voidedPurchases : []) {
          if (!v || !validToken(v.purchaseToken)) continue;
          checked++;
          const rr = await fetchFn(cfg.url + '/rest/v1/rpc/revoke_purchase', {
            method: 'POST', headers: serviceHeaders(cfg.serviceKey),
            body: JSON.stringify({ p_token: v.purchaseToken, p_reason: 'voided:' + (Number(v.voidedReason) || 0) + ':' + (Number(v.voidedSource) || 0) }),
          });
          const out = await rr.json().catch(() => null);
          if (rr.ok && out && out.status === 'revoked') revoked++;
        }
        page = d.tokenPagination && typeof d.tokenPagination.nextPageToken === 'string' ? d.tokenPagination.nextPageToken : '';
      } while (page && ++pages < 50);
      return json({ ok: true, days, checked, revoked });
    } catch (_) {
      return json({ ok: false, error: 'server_error', checked, revoked }, 502);
    }
  };
}
