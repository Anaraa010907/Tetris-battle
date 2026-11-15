/* ---------- store: Google Play purchases, ads and their rules ----------
Products (Google Play one-time products; prices come from Play, already localized):
  remove_ads                         non-consumable: no ads between matches (rewarded ads stay, they are optional)
  pass_<season id> (e.g. pass_s1)    non-consumable: the season pass premium track (its button is in 57-pass.js)
  coins_small / medium / large       consumable coin packs (COIN_PACKS, same numbers as sku_coins() in SQL)
Who grants: with Supabase configured (Cloud.on()) the server does, through the verify-purchase Edge Function
(it checks the token with Google Play) and claim_ad_reward; the local state follows the server's answer.
Without Supabase (the offline build) Play's confirmation is the proof and the grant is local.
A purchase is acknowledged (non-consumables) or consumed (coin packs) only after it was granted.
Ads render natively (AdMob) on top of the WebView; nothing here loads anything from the web.
Hooks for the rest of the game, all on window (other files call them as window.X?.(...)):
  Store                         only in the Android app (has the bridge): ready, has, price, buy, onChange, adsRemoved
  renderIapSection(el)          coin packs, Remove ads, free coins for an ad, Restore (the shop fills a container)
  renderResultAd(el, info)      "watch an ad: double your coins" on the result screen
  onMatchEnd(info)              interstitial pacing, once per finished match
  renderStoreSettings(el)       the "Privacy and ads" entry (UMP privacy options), when the law requires it
*/
const COIN_PACKS={coins_small:500,coins_medium:1200,coins_large:3500};
const PAY_SKUS=['coins_small','coins_medium','coins_large','remove_ads'];
// Ad rules. Interstitials: practice and bot matches only, never for players who paid, not in the first 5 matches
// or the first day, at most one per 3 finished matches and 3 minutes apart, never within 3 minutes of a rewarded ad.
const AD_RULES={freeCoins:30,freeDay:5,doubleMax:150,doubleDay:10,firstMatches:5,firstMs:864e5,every:3,gapMs:18e4,afterRewardMs:18e4,delayMs:900};
const validSku=s=>typeof s==='string'&&/^(remove_ads|coins_(small|medium|large)|pass_[a-z0-9]{1,16})$/.test(s);
const validRef=s=>typeof s==='string'&&/^[A-Za-z0-9_.:-]{1,64}$/.test(s);
const isPack=s=>Object.prototype.hasOwnProperty.call(COIN_PACKS,s);

// ---- saved state (its own localStorage key; nothing is added to the profile)
const payState=(()=>{
  let s={};try{s=JSON.parse(localStorage.getItem('khan-store')||'{}')||{}}catch(e){}
  const n=v=>Number.isFinite(v)&&v>=0?Math.floor(v):0,arr=v=>Array.isArray(v)?v.filter(x=>typeof x==='string'):[],str=v=>typeof v==='string'?v:'';
  const loc={};if(s.local&&typeof s.local==='object')for(const k of Object.keys(s.local))if(validSku(k)&&!isPack(k))loc[k]=1;
  const sv=s.server&&typeof s.server==='object'?s.server:{};
  return {
    first:Number.isFinite(s.first)&&s.first>0?s.first:Date.now(),   // first launch with this file (for "not on the first day")
    matches:n(s.matches),since:n(s.since),lastAd:n(s.lastAd),lastReward:n(s.lastReward),
    paid:!!s.paid,                                  // bought anything on this phone (offline build)
    local:loc,                                      // offline build: owned non-consumables
    granted:arr(s.granted).slice(-10),              // offline build: coin-pack tokens granted but maybe not consumed yet
    server:{owner:str(sv.owner),skus:arr(sv.skus).filter(validSku),paid:!!sv.paid},   // the server's last answer, for that account
    day:str(s.day),free:n(s.free),dbl:n(s.dbl),     // today's rewarded ads (Ulaanbaatar day)
    doubled:arr(s.doubled).slice(-40),              // match refs whose coins were doubled
    claims:(Array.isArray(s.claims)?s.claims:[]).filter(c=>c&&validRef(c.ref)&&(c.placement==='free_coins'||c.placement==='double_coins')).slice(-10),
  };
})();
function paySave(){try{localStorage.setItem('khan-store',JSON.stringify(payState))}catch(e){}}
paySave();
function payUid(){return Cloud.on()&&Cloud.session?.user?.id||''}
function ownedSkus(){
  if(!Cloud.on())return Object.keys(payState.local);
  const uid=payUid()||profile.cloudId||'';
  return uid&&payState.server.owner===uid?payState.server.skus:[];
}
function everPaid(){return payState.paid||(Cloud.on()&&payState.server.paid&&payState.server.owner===(payUid()||profile.cloudId||''))}
function adDay(){const d=ubDay(0);if(payState.day!==d){payState.day=d;payState.free=0;payState.dbl=0}return payState}

// ---- the app's state (billing, consent, ads loaded) and product prices
let payNative=Native.info()||{};
const payPrices={},payMissing=new Set(),payAsked=new Map(),payListeners=new Set();
let payBusy=false,adBusy=false,adTimer=0,iapEl=null,payLoading=null;
const nativeAds=()=>payNative.ads&&typeof payNative.ads==='object'?payNative.ads:{};
function payChanged(){for(const fn of payListeners){try{fn()}catch(e){}}iapRefresh()}
async function loadProducts(list){
  const all=[...new Set((list||[]).filter(validSku))].filter(s=>!payPrices[s]);
  const want=all.filter(s=>!payAsked.has(s));
  if(want.length&&Native.has()){
    const job=(async()=>{
      try{
        const r=await Native.call('products',{skus:want},20000);
        for(const p of Array.isArray(r.products)?r.products:[])if(validSku(p.sku)&&typeof p.price==='string'){
          payPrices[p.sku]={price:p.price.slice(0,24),micros:+p.micros||0,currency:String(p.currency||'').slice(0,3)};payMissing.delete(p.sku);
        }
        for(const s of Array.isArray(r.missing)?r.missing:[])if(validSku(s))payMissing.add(s);
      }catch(e){}
      want.forEach(s=>payAsked.delete(s));
      payChanged();
    })();
    want.forEach(s=>payAsked.set(s,job));
  }
  await Promise.all(all.map(s=>payAsked.get(s)).filter(Boolean));
}
function applyStoreState(v){
  if(!v||typeof v!=='object')return;
  const before=ownedSkus().join();
  if(Array.isArray(v.skus))payState.server={owner:payUid(),skus:v.skus.filter(validSku),paid:!!v.paid};
  if(v.ads&&typeof v.ads==='object'&&typeof v.day==='string'){payState.day=v.day;payState.free=Math.max(0,v.ads.free_coins|0);payState.dbl=Math.max(0,v.ads.double_coins|0)}
  paySave();
  if(before!==ownedSkus().join())payChanged();else iapRefresh();
}
function serverProfile(p){if(p&&p.id&&typeof applyServer==='function')applyServer(p)}

// ---- purchases
// What a finished purchase gives, once: the server decides when online, Play's word is enough offline.
async function processPurchase(p,restoring){
  if(!p||!validSku(p.sku)||typeof p.token!=='string'||p.token.length<10)return {ok:false,reason:'bad_purchase'};
  if(p.state==='pending')return {ok:false,reason:'pending'};
  if(p.state!=='purchased')return {ok:false,reason:'not_purchased'};
  const pack=isPack(p.sku);
  if(Cloud.on()){
    let v;
    try{
      await Cloud.ensure();
      v=await Cloud.req('/functions/v1/verify-purchase',{method:'POST',body:{sku:p.sku,token:p.token,restore:!!restoring}});
    }catch(e){
      // not finished: Play keeps the purchase and the next restore (at start, on reconnect) tries again
      return {ok:false,reason:e.status===0?'offline':String(e.message||'verify_failed')};
    }
    if(!v||!v.ok)return {ok:false,reason:String(v&&v.error||'verify_failed')};
    serverProfile(v.profile);
    applyStoreState(v);
    if(!v.finished)await payFinish(p,pack);
    return {ok:true,granted:v.coins|0};
  }
  if(pack){
    if(!payState.granted.includes(p.token)){
      profile.coins+=COIN_PACKS[p.sku];save();profileView();
      payState.granted=[...payState.granted,p.token].slice(-10);
    }
  }else payState.local[p.sku]=1;
  payState.paid=true;paySave();
  if(await payFinish(p,pack)&&pack){payState.granted=payState.granted.filter(x=>x!==p.token);paySave()}
  payChanged();
  return {ok:true,granted:pack?COIN_PACKS[p.sku]:0};
}
async function payFinish(p,pack){
  if(!pack&&p.acknowledged)return true;
  try{await Native.call('finish',{token:p.token,consume:pack},20000);return true}catch(e){return false}
}
// Purchases Play still lists: unconsumed coin packs, owned non-consumables, any not acknowledged yet.
async function restorePurchases(byPlayer){
  if(!Native.has())return {ok:false,reason:'no_billing'};
  let r;
  try{r=await Native.call('purchases',{},20000)}catch(e){return {ok:false,reason:e.message}}
  const list=Array.isArray(r.purchases)?r.purchases:[];
  let done=0,pending=0;
  for(const p of list){
    if(!p||!validSku(p.sku))continue;
    if(p.state==='pending'){pending++;continue}
    const known=!isPack(p.sku)&&p.acknowledged&&ownedSkus().includes(p.sku);
    if(known&&!byPlayer)continue;
    if((await processPurchase(p,byPlayer)).ok)done++;
  }
  if(!Cloud.on()){
    // offline build: Play's list is the truth for non-consumables (a refunded one is no longer in it)
    const have=new Set(list.filter(p=>p&&p.state==='purchased').map(p=>p.sku));
    let gone=false;
    for(const k of Object.keys(payState.local))if(!have.has(k)){delete payState.local[k];gone=true}
    if(gone){paySave();payChanged()}
  }
  return {ok:true,done,pending};
}
async function buySku(sku){
  if(!validSku(sku))return {ok:false,reason:'bad_sku'};
  if(!Native.has())return {ok:false,reason:'no_billing'};
  if(!isPack(sku)&&ownedSkus().includes(sku))return {ok:true,reason:'owned'};
  if(payBusy)return {ok:false,reason:'busy'};
  payBusy=true;
  try{
    if(!payPrices[sku])await loadProducts([sku]);
    if(!payPrices[sku])return {ok:false,reason:payMissing.has(sku)?'unavailable':'no_billing'};
    const r=await Native.call('buy',{sku,account:payUid()},0);
    if(r.status==='cancel')return {ok:false,reason:'cancel'};
    if(r.status==='pending')return {ok:false,reason:'pending'};
    if(r.status==='owned'){await restorePurchases(true);return ownedSkus().includes(sku)?{ok:true,reason:'owned'}:{ok:false,reason:'owned'}}
    if(r.status!=='ok')return {ok:false,reason:String(r.code||'error')};
    let res={ok:false,reason:'not_purchased'};
    for(const p of Array.isArray(r.purchases)?r.purchases:[]){
      const g=await processPurchase(p,false);
      if(p&&p.sku===sku)res=g.ok?{ok:true}:{ok:false,reason:g.reason};
    }
    return res;
  }catch(e){return {ok:false,reason:String(e.message||'error')}}
  finally{payBusy=false}
}

// ---- rewarded ads (the player chooses to watch; the reward is said on the button)
function adsLeft(placement){const d=adDay();return placement==='free_coins'?Math.max(0,AD_RULES.freeDay-d.free):Math.max(0,AD_RULES.doubleDay-d.dbl)}
function countAd(placement){const d=adDay();if(placement==='free_coins')d.free++;else d.dbl++;paySave()}
async function watchRewarded(placement,ref,coins){
  if(!Native.has())return {ok:false,reason:'no_ads'};
  if(adBusy)return {ok:false,reason:'busy'};
  if(!adsLeft(placement))return {ok:false,reason:'daily_limit'};
  adBusy=true;clearTimeout(adTimer);
  try{
    const r=await Native.call('rewarded',{placement,ref},0);
    if(r.status==='earned'||r.status==='closed'){payState.lastReward=Date.now();paySave()}
    if(r.status!=='earned')return {ok:false,reason:r.status==='closed'?'no_reward':'ad_unavailable'};
    return await grantReward(placement,ref,coins);
  }catch(e){return {ok:false,reason:'ad_unavailable'}}
  finally{adBusy=false}
}
async function grantReward(placement,ref,coins){
  const amount=placement==='free_coins'?AD_RULES.freeCoins:Math.min(Math.max(0,Math.floor(+coins||0)),AD_RULES.doubleMax);
  if(!amount)return {ok:false,reason:'bad_coins'};
  if(Cloud.on()&&Cloud.ready()){
    try{
      const v=await Cloud.rpc('claim_ad_reward',{p_placement:placement,p_ref:ref,p_coins:placement==='double_coins'?amount:null});
      serverProfile(v&&v.profile);applyStoreState(v);
      return {ok:true,granted:v&&v.granted|0};
    }catch(e){if(e.status!==0)return {ok:false,reason:String(e.message||'error')}}
  }
  // shown at once; online builds also queue it for the server, whose answer replaces the local coins later
  profile.coins+=amount;save();profileView();countAd(placement);
  if(Cloud.on()){payState.claims=[...payState.claims,{placement,ref,coins:amount}].slice(-10);paySave()}
  return {ok:true,granted:amount,queued:Cloud.on()};
}
async function flushClaims(){
  while(payState.claims.length&&Cloud.ready()){
    const c=payState.claims[0];
    try{const v=await Cloud.rpc('claim_ad_reward',{p_placement:c.placement,p_ref:c.ref,p_coins:c.placement==='double_coins'?c.coins:null});serverProfile(v&&v.profile);applyStoreState(v)}
    catch(e){if(e.status===0)return;if(e.message==='too_fast'){setTimeout(flushClaims,11000);return}}
    payState.claims.shift();paySave();
  }
}

// ---- interstitials
function interstitialDue(now){
  now=now||Date.now();
  if(!Native.has()||adBusy)return false;
  if(ownedSkus().includes('remove_ads')||everPaid())return false;
  if(payState.matches<=AD_RULES.firstMatches||now-payState.first<AD_RULES.firstMs)return false;
  if(payState.since<AD_RULES.every||now-payState.lastAd<AD_RULES.gapMs||now-payState.lastReward<AD_RULES.afterRewardMs)return false;
  return nativeAds().canRequest!==false;
}
function onMatchEnd(info){
  if(!info||(info.mode!=='practice'&&info.mode!=='bot'))return false;     // never in online or friend matches
  payState.matches++;payState.since++;paySave();
  if(!interstitialDue())return false;
  clearTimeout(adTimer);
  // at the break the result screen gives: only while it is still up and nothing else is open
  adTimer=setTimeout(async()=>{
    if(state!=='result'||!$('modal').hidden||$('celebrate')||!interstitialDue())return;
    adBusy=true;
    try{const r=await Native.call('interstitial',{},0);if(r.status==='shown'){payState.lastAd=Date.now();payState.since=0;paySave()}}
    catch(e){}finally{adBusy=false}
  },AD_RULES.delayMs);
  return true;
}

// ---- UI
const coinMark=n=>'◈ '+Number(n).toLocaleString('en-US');
function payReasonText(reason){
  return t({cancel:'',pending:'iapPending',offline:'iapLater',unavailable:'iapNoProducts',no_billing:'iapNoBilling',busy:'',
    no_reward:'adNoReward',daily_limit:'adLimit',ad_unavailable:'adNone',too_fast:'adNone',error:'iapFail'}[reason]??'iapFail')||'';
}
function iapRefresh(){if(iapEl&&iapEl.isConnected)renderIapSection(iapEl)}
function renderIapSection(el){
  if(!el)return;
  iapEl=el;
  el.classList.add('iap');
  if(!Native.has()){el.innerHTML='<h3 class="iaph">'+t('iapTitle')+'</h3><p class="iapnote">'+t('iapBrowser')+'</p>';return}
  const msg=el.querySelector('.iapmsg')?.textContent||'';
  const billing=payNative.billing,owned=ownedSkus(),noAds=owned.includes('remove_ads'),ads=nativeAds();
  const price=s=>payPrices[s]?esc(payPrices[s].price):payMissing.has(s)?'–':'…';
  const can=s=>billing==='ready'&&!!payPrices[s]&&!payBusy;
  let h='<h3 class="iaph">'+t('iapTitle')+'</h3>';
  if(billing==='unavailable')h+='<p class="iapnote">'+t('iapNoBilling')+'</p>';
  else if(PAY_SKUS.every(s=>payMissing.has(s)))h+='<p class="iapnote">'+t('iapNoProducts')+'</p>';
  h+='<div class="iappacks">';
  for(const s of Object.keys(COIN_PACKS))
    h+='<button class="iappack" data-sku="'+s+'"'+(can(s)?'':' disabled')+'><b>'+coinMark(COIN_PACKS[s])+'</b><span>'+price(s)+'</span></button>';
  h+='</div>';
  h+=noAds?'<div class="iapowned"><b>✓ '+t('iapNoAdsOwned')+'</b></div>'
    :'<button class="iapwide" data-sku="remove_ads"'+(can('remove_ads')?'':' disabled')+'><span class="iapwt"><b>'+t('iapNoAds')+'</b><em>'+t('iapNoAdsDesc')+'</em></span><span class="iapprice">'+price('remove_ads')+'</span></button>';
  const left=adsLeft('free_coins'),adOk=ads.canRequest!==false&&left>0&&!adBusy;
  h+='<button class="adbtn" id="iapFree"'+(adOk?'':' disabled')+'><i class="adtag">'+t('adTag')+'</i><span class="adtx"><b>'+t('adFree').replace('{n}',AD_RULES.freeCoins)+'</b><small>'
    +(left?t('adLeft').replace('{n}',left).replace('{m}',AD_RULES.freeDay):t('adLimit'))+'</small></span></button>';
  h+='<button class="iaplink" id="iapRestore"'+(billing==='ready'&&!payBusy?'':' disabled')+'>'+t('iapRestore')+'</button>';
  h+='<p class="iapmsg" aria-live="polite">'+esc(msg)+'</p>';
  el.innerHTML=h;
  const say=txt=>{const m=el.querySelector('.iapmsg');if(m)m.textContent=txt||''};
  el.querySelectorAll('[data-sku]').forEach(b=>b.onclick=async()=>{
    const sku=b.dataset.sku;say('');
    el.querySelectorAll('button').forEach(x=>x.disabled=true);
    const r=await buySku(sku);
    renderIapSection(el);
    say(r.ok?t(isPack(sku)?'iapThanksCoins':'iapThanks').replace('{n}',COIN_PACKS[sku]||''):payReasonText(r.reason));
  });
  el.querySelector('#iapFree').onclick=async()=>{
    say('');el.querySelector('#iapFree').disabled=true;
    const r=await watchRewarded('free_coins','free-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8));
    renderIapSection(el);
    say(r.ok?t('adGot').replace('{n}',r.granted||AD_RULES.freeCoins):payReasonText(r.reason));
  };
  el.querySelector('#iapRestore').onclick=async()=>{
    say(t('iapRestoring'));
    const r=await restorePurchases(true);
    renderIapSection(el);
    say(!r.ok?payReasonText(r.reason):r.pending?t('iapPending'):t('iapRestored'));
  };
  if(billing==='ready'&&PAY_SKUS.some(s=>!payPrices[s]&&!payMissing.has(s))&&!payLoading)
    payLoading=loadProducts(PAY_SKUS).finally(()=>{payLoading=null});
}
const resultAdDone=new Map();     // match ref -> coins added, for this session's result screens
function renderResultAd(el,info){
  if(!el)return;
  el.innerHTML='';el.hidden=true;el.classList.add('resad');
  if(!Native.has()||!info||(info.mode!=='practice'&&info.mode!=='bot'))return;
  const coins=Math.min(Math.max(0,Math.floor(+info.coins||0)),AD_RULES.doubleMax),ref=String(info.ref||'');
  if(!coins||!validRef(ref))return;
  if(payState.doubled.includes(ref)){
    if(resultAdDone.has(ref)){el.hidden=false;el.innerHTML='<p class="iapnote ok">✓ '+esc(t('adDoubled').replace('{n}',resultAdDone.get(ref)))+'</p>'}
    return;
  }
  if(nativeAds().canRequest===false||!adsLeft('double_coins'))return;
  el.hidden=false;
  el.innerHTML='<button class="adbtn"><i class="adtag">'+t('adTag')+'</i><span class="adtx"><b>'+t('adDouble').replace('{n}',coins)+'</b><small>'+t('adDoubleSub')+'</small></span></button><p class="iapmsg" aria-live="polite"></p>';
  const btn=el.querySelector('button');
  btn.onclick=async()=>{
    btn.disabled=true;
    const r=await watchRewarded('double_coins',ref,coins);
    if(r.ok){
      payState.doubled=[...payState.doubled.filter(x=>x!==ref),ref].slice(-40);paySave();
      resultAdDone.set(ref,r.granted||coins);renderResultAd(el,info);
    }else{btn.disabled=false;el.querySelector('.iapmsg').textContent=payReasonText(r.reason)}
  };
}
function privacyRequired(){return Native.has()&&nativeAds().privacyRequired===true}
function renderStoreSettings(el){
  if(!el)return;
  if(!privacyRequired()){el.hidden=true;el.innerHTML='';return}
  el.hidden=false;
  el.innerHTML='<button id="adPrivacy">'+t('adPrivacy')+'</button>';
  el.querySelector('button').onclick=()=>Native.call('privacy',{},0).then(d=>{if(d&&d.state)payNative=Object.assign({},payNative,d.state)}).catch(()=>{});
}
// Settings (80-ui.js) has no slot of its own for this: the entry goes right after its Privacy button
// each time the dialog opens, only in the app and only when the consent rules need it.
new MutationObserver(()=>{
  const p=$('privacy');
  if(!p||$('adPrivacy')||!p.closest('#modal')||!privacyRequired())return;
  const box=document.createElement('span');box.className='setad';p.after(box);renderStoreSettings(box);
}).observe($('modal'),{childList:true});

// ---- start: the app tells us when billing is connected; the online account brings the server's view
let payCloudUid='';
async function payServerSync(){
  try{applyStoreState(await Cloud.rpc('my_entitlements'))}catch(e){payCloudUid='';return}
  await flushClaims();
  if(payNative.billing==='ready')await restorePurchases(false);
}
if(Native.has()){
  Native.on((ev,data)=>{
    if(ev==='state'){
      const was=payNative.billing;payNative=Object.assign({},payNative,data);
      if(payNative.billing==='ready'&&was!=='ready'){loadProducts(PAY_SKUS);if(!Cloud.on()||Cloud.ready())restorePurchases(false)}
      iapRefresh();
    }else if(ev==='purchases'){
      // a purchase finished outside a buy() call (a pending payment went through, or the app was restarted)
      (async()=>{for(const p of Array.isArray(data.purchases)?data.purchases:[])await processPurchase(p,false)})();
    }
  });
  if(payNative.billing==='ready'){loadProducts(PAY_SKUS);if(!Cloud.on())restorePurchases(false)}
  if(Cloud.on())setInterval(()=>{
    const uid=Cloud.ready()?payUid():'';
    if(uid&&uid!==payCloudUid){payCloudUid=uid;payServerSync()}
  },1500);
  window.Store={
    ready:()=>payNative.billing==='ready',
    has:sku=>ownedSkus().includes(String(sku)),
    price:sku=>{sku=String(sku);if(!payPrices[sku]&&validSku(sku)&&!payMissing.has(sku)&&payNative.billing==='ready')loadProducts([sku]);return payPrices[sku]?.price||''},
    buy:sku=>buySku(String(sku)),
    onChange(fn){if(typeof fn==='function')payListeners.add(fn);return()=>payListeners.delete(fn)},
    adsRemoved:()=>ownedSkus().includes('remove_ads'),
    restore:()=>restorePurchases(true),
  };
}
window.renderIapSection=renderIapSection;
window.renderResultAd=renderResultAd;
window.onMatchEnd=onMatchEnd;
window.renderStoreSettings=renderStoreSettings;
