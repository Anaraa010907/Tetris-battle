/* ---------- season pass ----------
Seasons run about six weeks. Each has 30 tiers; season XP (match XP plus mission XP, 56-progress.js) fills them,
PASS_XP per tier. Every tier has a free reward and a premium reward: coins, or one of the season's skins (ids 20-39,
never sold for coins). The premium track belongs to whoever owns the `pass_<season id>` purchase: it is bought
and known through the payments agent's window.Store (55-store.js); without a Store (a plain browser) the premium
track shows, locked, with a note that it is bought in the phone app. The server checks the same purchase
(has_entitlement) before it pays a premium tier.

SEASONS is one table shared with the server: the migration holds the same JSON (tests/game_test.py compares them).
Dates are days in Ulaanbaatar; a season runs from `start` up to (not including) `end`. To add a season: a new row
here, the same row in a NEW migration, and its skins in 59-skins.js.
*/
const SEASONS=[
  {"id":"s1","start":"2026-11-16","end":"2026-12-28","free":[20,21],"premium":[22,23,24]},
  {"id":"s2","start":"2026-12-28","end":"2027-02-08","free":[25,26],"premium":[27,28,29]}];
const PASS_XP=350,PASS_TIERS=30,PASS_FREE_SKIN=[10,25],PASS_PREM_SKIN=[1,15,30],PASS_COINS=[25,50],PASS_DUP_COINS=100;
const seasonById=id=>SEASONS.find(s=>s.id===id);
function currentSeason(){const d=progDay();return SEASONS.find(s=>s.start<=d&&d<s.end)||null}
// the season the pass screen shows: the running one, else the last one that ended (to claim what is left), else the next
function shownSeason(){const d=progDay();return currentSeason()||[...SEASONS].reverse().find(s=>s.end<=d)||SEASONS.find(s=>s.start>d)||SEASONS[0]}
function passOf(id){
  const p=profile.pass||(profile.pass={});
  return p[id]||(p[id]={xp:0,f:[],p:[]});
}
const passTier=xp=>Math.min(PASS_TIERS,Math.floor(Math.max(0,xp)/PASS_XP));
function cleanPass(v){
  const out={};
  if(v&&typeof v==='object')for(const id in v){
    const x=v[id];if(!seasonById(id)||!x||typeof x!=='object')continue;
    const tiers=a=>Array.isArray(a)?[...new Set(a.filter(n=>Number.isInteger(n)&&n>=1&&n<=PASS_TIERS))]:[];
    out[id]={xp:Math.max(0,Math.floor(x.xp)||0),f:tiers(x.f),p:tiers(x.p)};
  }
  return out;
}
profile.pass=cleanPass(profile.pass);
// what a tier pays: {skin} or {coins}
function passReward(se,tier,premium){
  const at=premium?PASS_PREM_SKIN:PASS_FREE_SKIN,i=at.indexOf(tier);
  return i>=0?{skin:(premium?se.premium:se.free)[i]}:{coins:PASS_COINS[premium?1:0]};
}
const passSku=se=>'pass_'+se.id;
const hasPremium=se=>!!window.Store?.has?.(passSku(se));
async function claimPassTier(id,tier,premium){
  const se=seasonById(id);if(!se)return null;
  const owned0=new Set(profile.owned);
  if(Cloud.ready()){
    const lv=levelInfo(profile.xp).level;
    applyServer(await Cloud.rpc('claim_pass_tier',{p_season:id,p_tier:tier,p_premium:!!premium}));
    const skin=profile.owned.find(k=>!owned0.has(k));
    return skin!==undefined?{skin}:{coins:1,lv};
  }
  const p=passOf(id),list=premium?p.p:p.f;
  if(list.includes(tier)||tier>passTier(p.xp)||tier<1)return null;
  if(premium&&!hasPremium(se))throw Object.assign(new Error('no_pass'),{status:400});
  const r=passReward(se,tier,premium);
  if(r.skin!==undefined&&!profile.owned.includes(r.skin))profile.owned.push(r.skin);
  else profile.coins+=r.skin!==undefined?PASS_DUP_COINS:r.coins;
  list.push(tier);save();profileView();
  return r;
}
// a small picture of a skin for rewards and celebrations (a data: image, which the page's CSP allows)
const skinImgCache=new Map();
function skinImage(id,w,h){
  const key=id+'|'+w+'x'+h;
  if(!skinImgCache.has(key)){const cv=skinCanvas(w*SKIN_SCALE,h*SKIN_SCALE);drawSkinPreview(cv,skinById(id));skinImgCache.set(key,cv.toDataURL())}
  return '<img class="skinimg" src="'+skinImgCache.get(key)+'" width="'+w+'" height="'+h+'" alt="">';
}
let passStoreHooked=false;
// Fills el with the pass of the shown season. again() re-opens the screen the pass lives in (shop tab or dialog).
function renderPass(el,again){
  const se=shownSeason(),d=progDay(),live=se.start<=d&&d<se.end,soon=se.start>d,p=passOf(se.id),tier=passTier(p.xp),prem=hasPremium(se);
  if(!passStoreHooked&&window.Store?.onChange){passStoreHooked=true;window.Store.onChange(()=>{if($('passBox')&&passAgain)passAgain()})}
  passAgain=again;
  const into=tier>=PASS_TIERS?PASS_XP:p.xp-tier*PASS_XP,left=soon?t('seasonStarts').replace('{t}',fmtLeft(Date.parse(se.start+'T00:00:00+08:00')-Date.now()))
    :live?t('seasonEnds').replace('{t}',fmtLeft(Date.parse(se.end+'T00:00:00+08:00')-Date.now())):t('seasonOver');
  let h='<div id="passBox"><div class="phead"><div><span class="eyebrow">'+t('seasonPass')+' · '+se.id.toUpperCase()+'</span><b class="pname">'+t('season_'+se.id)+'</b>'
    +'<span class="muted small" id="passLeft">'+left+'</span></div><div class="ptierbig"><small>'+t('tier')+'</small><b>'+tier+'</b><small>/ '+PASS_TIERS+'</small></div></div>'
    +'<div class="pxp"><i style="width:'+Math.round(into/PASS_XP*100)+'%"></i></div><p class="muted small pxpnote">'+(tier>=PASS_TIERS?t('passMaxed'):t('passToNext').replace('{n}',PASS_XP-into))+'</p>';
  // premium: owned, buyable in the app, or explained
  if(prem)h+='<div class="ppremium on">◆ '+t('premiumOwned')+'</div>';
  else if(window.Store&&live)h+='<button class="primary wide" id="passBuy">◆ '+t('premiumUnlock')+(window.Store.price?.(passSku(se))?' · '+esc(window.Store.price(passSku(se))):'')+'</button><p class="muted small pnote">'+t('premiumWhat')+'</p>';
  else h+='<div class="ppremium">'+t(window.Store?'premiumEnded':'premiumAppOnly')+'</div>';
  h+='<div class="pcols"><span></span><span>'+t('trackFree')+'</span><span class="gold">◆ '+t('trackPremium')+'</span></div><div class="ptiers" id="passTiers">';
  const cell=(n,premium)=>{
    const r=passReward(se,n,premium),got=(premium?p.p:p.f).includes(n),reached=n<=tier,can=reached&&!got&&(!premium||prem);
    const what=r.skin!==undefined?skinImage(r.skin,58,24)+'<span class="pskin">'+t(skinById(r.skin).name)+'</span>':'<span class="pcoin">◈ '+r.coins+'</span>';
    return '<button class="prew'+(premium?' prem':'')+(got?' got':can?' ready':'')+(r.skin!==undefined?' skin':'')+'" data-tier="'+n+'" data-prem="'+(premium?1:0)+'"'+(can?'':' aria-disabled="true"')+'>'
      +what+'<em>'+(got?'✓':can?t('claim'):premium&&!prem?'🔒':'')+'</em></button>';
  };
  for(let n=1;n<=PASS_TIERS;n++)h+='<div class="ptier'+(n<=tier?' reached':'')+(n===tier+1?' next':'')+'"><span class="pnum">'+n+'</span>'+cell(n,false)+cell(n,true)+'</div>';
  el.innerHTML=h+'</div></div>';
  const list=$('passTiers'),cur=list.children[Math.max(0,Math.min(PASS_TIERS-1,tier-1))];
  if(cur)list.scrollTop=Math.max(0,cur.offsetTop-list.offsetTop-60);
  el.querySelectorAll('.prew').forEach(b=>b.onclick=async()=>{
    const n=+b.dataset.tier,premium=b.dataset.prem==='1';
    if(!b.classList.contains('ready')){
      if(premium&&!prem&&!b.classList.contains('got'))info('seasonPass',window.Store?'premiumWhat':'premiumAppOnly');
      return;
    }
    b.classList.remove('ready');
    try{
      const r=await claimPassTier(se.id,n,premium);
      if(r&&r.skin!==undefined)celebrateNext({kicker:t('seasonExclusive'),title:t(skinById(r.skin).name),badge:skinImage(r.skin,150,60),color:'#ffcf6a',
        sub:t('skinUnlocked'),button:t('continue')});
      if($('passBox'))again();
    }catch(e){msgBox(errText(e),again)}
  });
  if($('passBuy'))$('passBuy').onclick=async()=>{
    $('passBuy').disabled=true;
    let r=null;try{r=await window.Store.buy(passSku(se))}catch(e){}
    if($('passBox'))again();
    if(r&&!r.ok&&r.reason&&r.reason!=='cancelled')msgBox(t('errGeneric'),again);
  };
}
let passAgain=null;
function passDialog(back){
  modal('<div id="passDlg"></div><div class="stack"><button id="passDone">'+t('done')+'</button></div>');
  renderPass($('passDlg'),()=>passDialog(back));
  $('passDone').onclick=back||closeModal;
}
