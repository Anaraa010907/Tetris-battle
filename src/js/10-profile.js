/* ================= Khan Blocks ================= */
/* ================= Khan Blocks ================= */
/* ================= Khan Blocks ================= */
const $=id=>document.getElementById(id);
const STRINGS=JSON.parse($('translations').textContent);
// "{@key}" inside a text is that language's text for key (the brand name, a title), so a rename is one edit
for(const L of Object.values(STRINGS))for(const k in L)L[k]=L[k].replace(/\{@(\w+)\}/g,(m,key)=>L[key]??m);

/* ---------- profile ---------- */
const AVATARS=['👑','◈','☾','⚡'];
// Control settings (Settings → Controls). das/arr in ms (arr 0 = straight to the wall), sdf = soft drop × gravity
// (0 = to the floor at once). Anything missing or invalid falls back to the default.
function ctlClean(v){
  v=v&&typeof v==='object'?v:{};
  const num=(x,lo,hi,d)=>Number.isFinite(x)&&x>=lo&&x<=hi?Math.round(x):d,bool=(x,d)=>typeof x==='boolean'?x:d,one=(x,list)=>list.includes(x)?x:list[0];
  return {das:num(v.das,50,300,170),arr:num(v.arr,0,100,50),sdf:one(v.sdf,[20,5,10,0]),sens:one(v.sens,['normal','low','high']),
    flick:bool(v.flick,true),buttons:bool(v.buttons,true),mirror:bool(v.mirror,false),size:one(v.size,['normal','large'])};
}
const freshProfile=keep=>Object.assign({name:'NOMAD',avatar:'👑',rank:1000,wins:0,losses:0,coins:0,streak:0,lastClaim:'',account:null,
  theme:0,owned:[0],diff:1,lang:'mn',sound:true,vibration:true,powers:false,fmt:'single',ctl:ctlClean(),
  xp:0,xpDay:'',xpToday:0,firstWinDay:'',missions:null,pass:{}},keep||{});
let profile=freshProfile();
try{
  const saved=JSON.parse(localStorage.getItem('neon-duel')||'{}');
  if(saved&&typeof saved==='object'){
    if(typeof saved.lastClaim==='string')profile.lastClaim=saved.lastClaim;
    if(saved.account&&typeof saved.account.user==='string'&&typeof saved.account.hash==='string')
      profile.account={user:saved.account.user,hash:saved.account.hash,in:!!saved.account.in};
    if(typeof saved.name==='string')profile.name=saved.name.trim().slice(0,16)||'NOMAD';
    if(AVATARS.includes(saved.avatar))profile.avatar=saved.avatar;
    for(const k of ['rank','wins','losses','coins','streak'])if(Number.isFinite(saved[k]))profile[k]=Math.max(0,Math.floor(saved[k]));
    for(const k of ['sound','vibration','powers'])if(typeof saved[k]==='boolean')profile[k]=saved[k];
    for(const k of ['cloudClaim','cloudId'])if(typeof saved[k]==='string')profile[k]=saved[k];
    if(['mn','en'].includes(saved.lang))profile.lang=saved.lang;
    if([0,1,2].includes(saved.diff))profile.diff=saved.diff;
    if(['single','ft3'].includes(saved.fmt))profile.fmt=saved.fmt;
    // skin ids 1-39 (59-skins.js checks them against the registry once it is loaded)
    if(Array.isArray(saved.owned))profile.owned=[0,...new Set(saved.owned.filter(v=>Number.isInteger(v)&&v>0&&v<40))];
    if(profile.owned.includes(saved.theme))profile.theme=saved.theme;
    profile.ctl=ctlClean(saved.ctl);
    // progression (56-progress.js re-checks missions and the season pass against its tables)
    for(const k of ['xp','xpToday'])if(Number.isFinite(saved[k]))profile[k]=Math.max(0,Math.floor(saved[k]));
    for(const k of ['xpDay','firstWinDay'])if(typeof saved[k]==='string')profile[k]=saved[k];
    if(saved.missions&&typeof saved.missions==='object')profile.missions=saved.missions;
    if(saved.pass&&typeof saved.pass==='object'&&!Array.isArray(saved.pass))profile.pass=saved.pass;
  }
}catch(e){}
function save(){try{localStorage.setItem('neon-duel',JSON.stringify(profile))}catch(e){}}
function t(k){return STRINGS[profile.lang]?.[k]||k}
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function translate(){
  document.documentElement.lang=profile.lang;
  document.querySelectorAll('[data-t]').forEach(e=>e.textContent=t(e.dataset.t));
  $('language').textContent=profile.lang==='mn'?'EN':'МН';
  netView();
  $('outcome').textContent=t('resultTitle');
  document.querySelectorAll('[data-action]').forEach(el=>{if(STRINGS[profile.lang][el.dataset.action])el.setAttribute('aria-label',t(el.dataset.action))});
  $('sound').setAttribute('aria-label',t('soundLabel'));
  profileView();
}

