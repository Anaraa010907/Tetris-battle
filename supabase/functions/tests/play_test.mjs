// Tests for supabase/functions/_shared/play.mjs (the verify-purchase and voided-purchases Edge Functions) on Node 22,
// which has the same web APIs as Deno (fetch, Request, Response, WebCrypto). Google, Supabase Auth and PostgREST are
// played by a fake fetch; the JWT is really signed with a generated RSA key and checked with its public key.
//     node supabase/functions/tests/play_test.mjs        (exit code 1 when a check fails)
import { generateKeyPairSync, createPublicKey, verify as rsaVerify } from 'node:crypto';
import {
  readPurchase, signJwt, jwtClaims, parseServiceAccount, sha256Hex, readConfig, serviceHeaders, validToken, validSku,
  createVerifyHandler, createVoidedHandler, purchaseUrl, finishUrl,
} from '../_shared/play.mjs';

let fails = 0, count = 0;
function check(name, ok, info) {
  count++;
  if (!ok) fails++;
  console.log((ok ? '  ok   ' : '  FAIL ') + name + (ok ? '' : '  -> ' + JSON.stringify(info)));
}

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
const SA = { type: 'service_account', client_email: 'play-verifier@khan-blocks.iam.gserviceaccount.com', private_key: pem, token_uri: 'https://oauth2.googleapis.com/token' };
const NOW = Date.UTC(2026, 10, 16, 3, 0, 0);

// ---------------------------------------------------------------- pure parts
{
  const sa = parseServiceAccount(JSON.stringify(SA));
  const jwt = await signJwt(sa, NOW / 1000);
  const [h, c, s] = jwt.split('.');
  const dec = (x) => JSON.parse(Buffer.from(x, 'base64url').toString());
  check('JWT header is RS256', JSON.stringify(dec(h)) === '{"alg":"RS256","typ":"JWT"}', dec(h));
  check('JWT claims: issuer, Play scope, token audience, one hour', JSON.stringify(dec(c)) === JSON.stringify(jwtClaims(sa, NOW / 1000))
    && dec(c).scope === 'https://www.googleapis.com/auth/androidpublisher' && dec(c).exp - dec(c).iat === 3600 && dec(c).aud === SA.token_uri, dec(c));
  const ok = rsaVerify('sha256', Buffer.from(h + '.' + c), createPublicKey(privateKey), Buffer.from(s, 'base64url'));
  check('JWT signature verifies with the public key (WebCrypto RSASSA-PKCS1-v1_5)', ok);
  const escaped = { ...SA, private_key: pem.replace(/\n/g, '\\n') };
  check('a key pasted with literal \\n still signs', (await signJwt(parseServiceAccount(escaped), 1)).split('.').length === 3);
  let threw = false; try { parseServiceAccount('{"client_email":"x"}'); } catch (_) { threw = true; }
  check('a service account without a key is refused', threw);
}
{
  const base = { kind: 'androidpublisher#productPurchaseV2', orderId: 'GPA.3311-2233-4455-66778', purchaseCompletionTime: '2026-11-16T02:59:00Z',
    purchaseStateContext: { purchaseState: 'PURCHASED' }, acknowledgementState: 'ACKNOWLEDGEMENT_STATE_PENDING',
    productLineItem: [{ productId: 'coins_small', productOfferDetails: { consumptionState: 'CONSUMPTION_STATE_YET_TO_BE_CONSUMED', quantity: 1 } }] };
  const r = readPurchase(base, 'coins_small');
  check('a purchased coin pack reads as purchased, not consumed, not acknowledged',
    r.ok && !r.consumed && !r.acknowledged && r.orderId === base.orderId && !r.test && r.purchasedAt === base.purchaseCompletionTime, r);
  check('another product on the token is refused', readPurchase(base, 'coins_large').error === 'wrong_product');
  check('pending is not a purchase', readPurchase({ ...base, purchaseStateContext: { purchaseState: 'PENDING' } }, 'coins_small').error === 'pending');
  check('cancelled is not a purchase', readPurchase({ ...base, purchaseStateContext: { purchaseState: 'CANCELLED' } }, 'coins_small').error === 'not_purchased');
  check('missing state is not a purchase', readPurchase({ ...base, purchaseStateContext: undefined }, 'coins_small').error === 'not_purchased');
  const t = readPurchase({ ...base, testPurchaseContext: { fopType: 'TEST' }, acknowledgementState: 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED',
    productLineItem: [{ productId: 'coins_small', productOfferDetails: { consumptionState: 'CONSUMPTION_STATE_CONSUMED' } }] }, 'coins_small');
  check('test, acknowledged and consumed flags', t.ok && t.test && t.acknowledged && t.consumed, t);
  check('garbage is refused', readPurchase(null, 'x').error === 'bad_response' && readPurchase({}, 'coins_small').error === 'wrong_product');
  check('sku and token checks', validSku('pass_s1') && validSku('remove_ads') && !validSku('pass_S1') && !validSku('coins_huge')
    && validToken('abcdefghij.AO-J1Ox_yz') && !validToken('short') && !validToken('bad token with spaces'));
  check('URLs: productsv2 to read, products to acknowledge/consume',
    purchaseUrl('com.anaraa.khanblocks', 'a/b') === 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/com.anaraa.khanblocks/purchases/productsv2/tokens/a%2Fb'
    && finishUrl('com.anaraa.khanblocks', 'coins_small', 'tok', true).endsWith('/purchases/products/coins_small/tokens/tok:consume')
    && finishUrl('com.anaraa.khanblocks', 'remove_ads', 'tok', false).endsWith('/purchases/products/remove_ads/tokens/tok:acknowledge'));
  check('sha256Hex', (await sha256Hex('abc')) === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  const env = (m) => (k) => m[k];
  check('config: new secret keys preferred, package default', (() => {
    const c = readConfig(env({ SUPABASE_URL: 'https://x.supabase.co/', SUPABASE_SECRET_KEYS: '{"default":"sb_secret_abc"}', SUPABASE_SERVICE_ROLE_KEY: 'eyJ.legacy',
      SUPABASE_PUBLISHABLE_KEYS: '{"default":"sb_publishable_p"}', GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify(SA) }));
    return c.url === 'https://x.supabase.co' && c.serviceKey === 'sb_secret_abc' && c.publicKey === 'sb_publishable_p' && c.pkg === 'com.anaraa.khanblocks';
  })());
  check('config: legacy keys work, missing service account is not configured',
    readConfig(env({ SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'eyJ.legacy', GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify(SA) })).serviceKey === 'eyJ.legacy'
    && readConfig(env({ SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k' })) === null);
  check('service headers: sb_secret only in apikey, a legacy JWT in both',
    !('Authorization' in serviceHeaders('sb_secret_x')) && serviceHeaders('eyJ.legacy').Authorization === 'Bearer eyJ.legacy');
}

// ---------------------------------------------------------------- the verify-purchase handler with a fake world
const USER = '11111111-2222-3333-4444-555555555555';
function world(over = {}) {
  const w = { calls: [], oauth: 0, google: {}, recorded: {}, finishOk: true, recordError: null, ...over };
  w.fetch = async (url, init = {}) => {
    url = String(url);
    const h = Object.fromEntries(Object.entries(init.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
    w.calls.push({ url, method: init.method || 'GET', headers: h, body: init.body });
    const res = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json' } });
    if (url === 'https://x.supabase.co/auth/v1/user') return h.authorization === 'Bearer user-jwt' ? res({ id: USER, aud: 'authenticated' }) : res({ msg: 'invalid JWT' }, 401);
    if (url === SA.token_uri) {
      w.oauth++;
      const form = new URLSearchParams(init.body);
      return form.get('grant_type') === 'urn:ietf:params:oauth:grant-type:jwt-bearer' && form.get('assertion').split('.').length === 3
        ? res({ access_token: 'ya29.test', expires_in: 3599, token_type: 'Bearer' }) : res({ error: 'invalid_grant' }, 400);
    }
    const m = url.match(/\/applications\/com\.anaraa\.khanblocks\/purchases\/productsv2\/tokens\/([^/?]+)$/);
    if (m) {
      if (h.authorization !== 'Bearer ya29.test') return res({}, 401);
      const p = w.google[decodeURIComponent(m[1])];
      return p ? res(p) : res({ error: { code: 400, message: 'Invalid Value' } }, 400);
    }
    if (/\/purchases\/products\/[a-z_0-9]+\/tokens\/[^/]+:(consume|acknowledge)$/.test(url)) return new Response('', { status: w.finishOk ? 200 : 503 });
    if (url === 'https://x.supabase.co/rest/v1/rpc/record_purchase') {
      if (w.recordError) return res({ code: 'P0001', message: w.recordError }, 400);
      const b = JSON.parse(init.body);
      const again = w.recorded[b.p_token];
      w.recorded[b.p_token] = b;
      return res({ status: again ? 'already' : 'granted', sku: b.p_sku, kind: b.p_sku.startsWith('coins_') ? 'coins' : 'entitlement',
        coins: again ? 0 : 500, profile: { id: b.p_user, coins: 540 }, skus: [], paid: true });
    }
    if (url === 'https://x.supabase.co/rest/v1/rpc/revoke_purchase') {
      const b = JSON.parse(init.body);
      return res({ status: b.p_token.includes('known') ? 'revoked' : 'unknown' });
    }
    if (url.includes('/purchases/voidedpurchases?')) {
      const q = new URL(url).searchParams;
      if (!q.get('token')) return res({ voidedPurchases: [{ purchaseToken: 'tok-known-0001', voidedReason: 1, voidedSource: 0 }, { purchaseToken: 'tok-other-0001', voidedReason: 7 }],
        tokenPagination: { nextPageToken: 'page2' } });
      return res({ voidedPurchases: [{ purchaseToken: 'tok-known-0002', voidedReason: 5, voidedSource: 2 }] });
    }
    return res({ error: 'unexpected ' + url }, 599);
  };
  return w;
}
const ENV = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SECRET_KEYS: '{"default":"sb_secret_abc"}', SUPABASE_PUBLISHABLE_KEYS: '{"default":"sb_publishable_p"}',
  GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify(SA), PLAY_PACKAGE_NAME: 'com.anaraa.khanblocks', CRON_SECRET: 'cron-s3cret-value' };
const purchase = (sku, extra = {}, offer = {}) => ({ orderId: 'GPA.1', purchaseCompletionTime: '2026-11-16T02:59:00Z', purchaseStateContext: { purchaseState: 'PURCHASED' },
  acknowledgementState: 'ACKNOWLEDGEMENT_STATE_PENDING', productLineItem: [{ productId: sku, productOfferDetails: { consumptionState: 'CONSUMPTION_STATE_YET_TO_BE_CONSUMED', ...offer } }], ...extra });
const post = (body, auth = 'Bearer user-jwt') => new Request('https://x.supabase.co/functions/v1/verify-purchase',
  { method: 'POST', headers: { Authorization: auth, apikey: 'sb_publishable_p', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
// one handler per fake world, like one function instance (it keeps its Google token between requests)
const run = async (w, req, env = ENV) => {
  if (!w.handlers) w.handlers = new Map();
  if (!w.handlers.has(env)) w.handlers.set(env, createVerifyHandler({ env: (k) => env[k], fetch: w.fetch, now: () => NOW }));
  const r = await w.handlers.get(env)(req);
  return [r.status, await r.json().catch(() => null), r];
};
const TOK = 'opaque-token-AO-J1OyabcdefghijKLMNOP.1234';
{
  let w = world();
  const pre = await createVerifyHandler({ env: (k) => ENV[k], fetch: w.fetch })(new Request('https://x/v', { method: 'OPTIONS' }));
  check('CORS preflight answered', pre.status === 200 && pre.headers.get('access-control-allow-headers').includes('authorization') && pre.headers.get('access-control-allow-origin') === '*');
  let [st, d] = await run(w, post({ sku: 'coins_small', token: TOK }, ''));
  check('no session: 401', st === 401 && d.error === 'not_signed_in' && w.calls.length === 0, [st, d]);
  [st, d] = await run(w, post({ sku: 'coins_small', token: TOK }, 'Bearer someone-else'));
  check('a session Supabase Auth does not know: 401', st === 401 && !w.calls.some((c) => c.url.includes('androidpublisher')), [st, d]);
  [st, d] = await run(w, post({ sku: 'gems', token: TOK }));
  check('unknown product: 400 before asking Google', st === 400 && d.error === 'bad_request' && !w.calls.some((c) => c.url.includes('androidpublisher')), [st, d]);
  [st, d] = await run(world(), post({ sku: 'coins_small', token: TOK }), { ...ENV, GOOGLE_SERVICE_ACCOUNT_JSON: '' });
  check('without the service account: not configured', st === 500 && d.error === 'not_configured', [st, d]);

  w = world({ google: { [TOK]: purchase('coins_small') } });
  [st, d] = await run(w, post({ sku: 'coins_small', token: TOK }));
  const rec = w.calls.find((c) => c.url.endsWith('/rpc/record_purchase'));
  const fin = w.calls.find((c) => c.url.includes(':consume'));
  check('coin pack: verified, recorded for the caller, then consumed', st === 200 && d.ok && d.status === 'granted' && d.coins === 500 && d.finished === true
    && JSON.parse(rec.body).p_user === USER && JSON.parse(rec.body).p_sku === 'coins_small' && JSON.parse(rec.body).p_order_id === 'GPA.1'
    && rec.headers.apikey === 'sb_secret_abc' && !rec.headers.authorization && fin && fin.method === 'POST', [st, d]);
  const order = w.calls.map((c) => c.url.includes('/auth/v1/user') ? 'auth' : c.url === SA.token_uri ? 'oauth' : c.url.includes('productsv2') ? 'read' : c.url.includes('record_purchase') ? 'record' : c.url.includes(':consume') ? 'consume' : '?');
  check('order: auth, Google token, read, record, consume (the grant comes before consuming)', order.join() === 'auth,oauth,read,record,consume', order);
  [st, d] = await run(w, post({ sku: 'coins_small', token: TOK }));
  check('asking again: already granted, the Google token is reused', st === 200 && d.status === 'already' && w.oauth === 1, [st, d, w.oauth]);

  w = world({ google: { [TOK]: purchase('remove_ads', { acknowledgementState: 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED' }) } });
  [st, d] = await run(w, post({ sku: 'remove_ads', token: TOK }));
  check('an already acknowledged non-consumable is not acknowledged twice', st === 200 && d.finished && !w.calls.some((c) => c.url.includes(':acknowledge')), [st, d]);
  w = world({ google: { [TOK]: purchase('remove_ads') } });
  [st, d] = await run(w, post({ sku: 'remove_ads', token: TOK }));
  check('a new non-consumable is acknowledged, not consumed', d.finished && w.calls.some((c) => c.url.includes(':acknowledge')) && !w.calls.some((c) => c.url.includes(':consume')), d);
  w = world({ google: { [TOK]: purchase('coins_small', {}, { consumptionState: 'CONSUMPTION_STATE_CONSUMED' }) } });
  [st, d] = await run(w, post({ sku: 'coins_small', token: TOK }));
  check('a coin pack the offline build already consumed is still granted (once)', st === 200 && d.status === 'granted' && d.finished && !w.calls.some((c) => c.url.includes(':consume')), d);
  w = world({ google: { [TOK]: purchase('coins_small') }, finishOk: false });
  [st, d] = await run(w, post({ sku: 'coins_small', token: TOK }));
  check('if consuming fails the answer says so (the app then consumes it)', st === 200 && d.ok && d.finished === false, d);

  w = world({ google: { [TOK]: purchase('coins_small', { purchaseStateContext: { purchaseState: 'PENDING' } }) } });
  [st, d] = await run(w, post({ sku: 'coins_small', token: TOK }));
  check('pending: nothing recorded', st === 202 && d.error === 'pending' && !w.calls.some((c) => c.url.includes('record_purchase')), [st, d]);
  w = world({ google: { [TOK]: purchase('coins_large') } });
  [st, d] = await run(w, post({ sku: 'coins_small', token: TOK }));
  check('token of a cheaper product sent as a bigger one: refused', st === 400 && d.error === 'wrong_product', [st, d]);
  [st, d] = await run(world(), post({ sku: 'coins_small', token: TOK }));
  check('a token Google does not know: invalid_token', st === 400 && d.error === 'invalid_token', [st, d]);

  const mine = await sha256Hex(USER), theirs = await sha256Hex('99999999-0000-0000-0000-000000000000');
  w = world({ google: { [TOK]: purchase('coins_small', { obfuscatedExternalAccountId: mine }) } });
  [st, d] = await run(w, post({ sku: 'coins_small', token: TOK }));
  check('bought by this account (obfuscated id matches): granted', st === 200 && d.ok, [st, d]);
  w = world({ google: { [TOK]: purchase('coins_small', { obfuscatedExternalAccountId: theirs }) } });
  [st, d] = await run(w, post({ sku: 'coins_small', token: TOK, restore: true }));
  check('a coin pack bought by another account: refused, even on restore', st === 403 && d.error === 'other_account' && !w.calls.some((c) => c.url.includes('record_purchase')), [st, d]);
  w = world({ google: { [TOK]: purchase('remove_ads', { obfuscatedExternalAccountId: theirs }) } });
  [st, d] = await run(w, post({ sku: 'remove_ads', token: TOK }));
  check('Remove ads from another account without restore: refused', st === 403, [st, d]);
  [st, d] = await run(w, post({ sku: 'remove_ads', token: TOK, restore: true }));
  check('... and moved on "Restore purchases"', st === 200 && JSON.parse(w.calls.filter((c) => c.url.includes('record_purchase')).pop().body).p_restore === true, [st, d]);

  w = world({ google: { [TOK]: purchase('coins_small') }, recordError: 'token_used' });
  [st, d] = await run(w, post({ sku: 'coins_small', token: TOK }));
  check('the database refuses a used token: 409, not consumed', st === 409 && d.error === 'token_used' && !w.calls.some((c) => c.url.includes(':consume')), [st, d]);
  w = world({ google: { [TOK]: purchase('coins_small') }, recordError: 'something odd' });
  [st, d] = await run(w, post({ sku: 'coins_small', token: TOK }));
  check('unknown database errors are not passed through', st === 500 && d.error === 'record_failed', [st, d]);
  w = world({ google: { [TOK]: purchase('pass_s1') } });
  [st, d] = await run(w, post({ sku: 'pass_s1', token: TOK }), { ...ENV, SUPABASE_SECRET_KEYS: '', SUPABASE_SERVICE_ROLE_KEY: 'eyJ.legacy' });
  const lr = w.calls.find((c) => c.url.endsWith('/rpc/record_purchase'));
  check('legacy service_role key: sent as apikey and Authorization', st === 200 && lr.headers.authorization === 'Bearer eyJ.legacy', lr && lr.headers);
}

// ---------------------------------------------------------------- the voided-purchases handler
{
  const w = world();
  const voided = createVoidedHandler({ env: (k) => ENV[k], fetch: w.fetch, now: () => NOW });
  let r = await voided(new Request('https://x.supabase.co/functions/v1/voided-purchases', { method: 'POST' }));
  check('voided: without the cron secret 401, nothing asked', r.status === 401 && w.calls.length === 0);
  r = await voided(new Request('https://x.supabase.co/functions/v1/voided-purchases?days=2', { method: 'POST', headers: { 'x-cron-secret': 'cron-s3cret-value' } }));
  const d = await r.json();
  const lists = w.calls.filter((c) => c.url.includes('voidedpurchases'));
  const start = Number(new URL(lists[0].url).searchParams.get('startTime'));
  check('voided: all pages read, every token revoked, counted', r.status === 200 && d.checked === 3 && d.revoked === 2 && lists.length === 2
    && new URL(lists[1].url).searchParams.get('token') === 'page2' && new URL(lists[0].url).searchParams.get('type') === '0', d);
  check('voided: looks back the asked number of days', Math.abs(NOW - start - 2 * 864e5) < 120e3, NOW - start);
  const reasons = w.calls.filter((c) => c.url.endsWith('/rpc/revoke_purchase')).map((c) => JSON.parse(c.body).p_reason);
  check('voided: the reason and source are kept', reasons.join() === 'voided:1:0,voided:7:0,voided:5:2', reasons);
  const none = createVoidedHandler({ env: (k) => ({ ...ENV, CRON_SECRET: '' })[k], fetch: w.fetch, now: () => NOW });
  r = await none(new Request('https://x/v', { method: 'POST', headers: { 'x-cron-secret': '' } }));
  check('voided: refuses to run without a CRON_SECRET', r.status === 500);
}

console.log(`RESULT: ${count} checks, ${fails} failed`);
process.exit(fails ? 1 : 0);
