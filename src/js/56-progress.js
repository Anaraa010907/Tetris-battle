/* ---------- XP, levels and daily missions ----------
Every finished match gives XP (more for bot than practice, more for online; a friendly match a little), more for
a win and for effort (pieces placed), plus a bonus for the first win of the day. XP raises the player level
(a gentle curve; each level pays coins) and the season pass (57-pass.js). Three daily missions from MISSIONS
pay coins and XP when claimed; one free reroll a day. Nothing here touches gameplay or rating.

Offline-first: progressMatch() counts everything on the phone at once. With a server configured the match is
also queued (progOutbox, like the match outbox) for report_progress, and the server's numbers replace the
phone's when they arrive (applyProgress, called by applyServer). The server repeats every rule below
(supabase/migrations/20261118100000_progression.sql) with caps against made-up results, so keep the two in step:
XP_BASE, matchXp, the first-win rule, XP_DAY_CAP, xpNeed, levelCoins, MISSIONS and missionAdvance.
Missions reset at local midnight; with a server, at midnight Ulaanbaatar time (the server decides the day).
*/
const XP_BASE={practice:[15,25],bot:[25,40],online:[30,50],friend:[10,15]};   // [loss, win] for one game; FT3 x2.5
const XP_FIRST_WIN=40,XP_FIRST_MIN=20,XP_DAY_CAP=2400,LEVEL_MAX=99;
function xpNeed(L){return 100+20*(L-1)}                 // XP from level L to L+1
function levelInfo(xp){
  let L=1,into=Math.max(0,Math.floor(xp)||0);
  while(L<LEVEL_MAX&&into>=xpNeed(L)){into-=xpNeed(L);L++}
  return {level:L,into,need:xpNeed(L)};
}
const levelCoins=L=>L%10===0?150:25;                    // coins for reaching level L
// m: {mode, won, ft, time (whole seconds), pieces}. Effort is capped by what fits in the match's time and pieces,
// so a match where nothing happened gives (almost) nothing.
function matchXp(m){
  const b=XP_BASE[m.mode]||XP_BASE.practice,w=b[m.won?1:0],base=m.ft?Math.floor((w*5+1)/2):w;
  const effort=Math.min(m.ft?50:20,Math.floor(m.pieces/10)),cap=Math.floor(3*Math.min(m.time,m.pieces)/2);
  return Math.max(0,Math.min(base+effort,cap));
}

// One table, shared with the server (the migration holds the same JSON; tests/game_test.py compares them).
// k: what counts, n: target, t: tier 0 easy / 1 medium / 2 hard (rewards in MISSION_REWARD). pps targets are in tenths.
const MISSIONS=[
  {"id":"play3","k":"play","n":3,"t":0},{"id":"lines30","k":"lines","n":30,"t":0},{"id":"quad1","k":"quad","n":1,"t":0},
  {"id":"pieces150","k":"pieces","n":150,"t":0},{"id":"ranked1","k":"ranked","n":1,"t":0},{"id":"attack15","k":"attack","n":15,"t":0},
  {"id":"win2","k":"win","n":2,"t":1},{"id":"lines80","k":"lines","n":80,"t":1},{"id":"tspin1","k":"tspin","n":1,"t":1},
  {"id":"quad3","k":"quad","n":3,"t":1},{"id":"attack40","k":"attack","n":40,"t":1},{"id":"combo4","k":"combo","n":4,"t":1},
  {"id":"pps15","k":"pps","n":15,"t":1},{"id":"friend1","k":"friend","n":1,"t":1},{"id":"ranked3","k":"ranked","n":3,"t":1},
  {"id":"win5","k":"win","n":5,"t":2},{"id":"tspin3","k":"tspin","n":3,"t":2},{"id":"attack100","k":"attack","n":100,"t":2},
  {"id":"pps20","k":"pps","n":20,"t":2},{"id":"ft3win1","k":"ft3win","n":1,"t":2},{"id":"hardwin1","k":"hardwin","n":1,"t":2},
  {"id":"lines200","k":"lines","n":200,"t":2},{"id":"combo7","k":"combo","n":7,"t":2}];
const MISSION_REWARD=[[20,40],[30,60],[50,90]];          // [coins, xp] per tier
const missionDef=id=>MISSIONS.find(x=>x.id===id);
const missionText=d=>t('mk_'+d.k).replace('{n}',d.k==='pps'?(d.n/10).toFixed(1):d.n);

/* ---------- the day ---------- */
function isoDay(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function progDay(){return (Cloud.on()&&ubDay(0))||isoDay()}
// milliseconds until the missions reset (Ulaanbaatar is UTC+8 all year)
function msToReset(){
  if(Cloud.on()&&ubDay(0))return 864e5-(Date.now()+8*36e5)%864e5;
  const d=new Date(),m=new Date(d.getFullYear(),d.getMonth(),d.getDate()+1);return m-d;
}
const fmtLeft=ms=>{const s=Math.max(0,Math.floor(ms/1000)),d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60);
  return d?t('leftDH').replace('{d}',d).replace('{h}',h):t('leftHM').replace('{h}',h).replace('{m}',String(m).padStart(2,'0'))};
// one easy, one medium and one hard mission, each of a different kind (friend play only where there is a server)
function newMissions(day){
  const list=[];
  for(const tier of [0,1,2]){
    const pool=MISSIONS.filter(x=>x.t===tier&&(x.k!=='friend'||Cloud.on())&&!list.some(y=>missionDef(y.id).k===x.k));
    list.push({id:pool[Math.floor(Math.random()*pool.length)].id,p:0,c:false});
  }
  return {day,rr:false,list};
}
function cleanMissions(ms){
  if(!ms||typeof ms!=='object'||typeof ms.day!=='string'||!Array.isArray(ms.list))return null;
  const list=ms.list.filter(x=>x&&missionDef(x.id)).slice(0,3).map(x=>({id:x.id,p:Math.max(0,Math.min(missionDef(x.id).n,Math.floor(x.p)||0)),c:!!x.c}));
  return list.length===3?{day:ms.day,rr:!!ms.rr,list}:null;
}
// a new day: daily XP count and missions start over
function rollDay(){
  const d=progDay();
  if(profile.xpDay!==d){profile.xpDay=d;profile.xpToday=0}
  if(!profile.missions||profile.missions.day!==d)profile.missions=newMissions(d);
}
profile.missions=cleanMissions(profile.missions);

/* ---------- counting a match ---------- */
function matchStats(s,win){
  return {mode:s.mode,won:!!win,ft:s.target>1,time:Math.floor(s.time),pieces:s.pieces|0,lines:s.lines|0,tspins:s.tspins|0,quads:s.quads|0,
    attack:s.attack|0,combo:s.combo|0,diff:s.mode==='practice'?profile.diff:-1,day:progDay()};
}
function missionStep(k,m){
  return {play:1,win:+m.won,lines:m.lines,tspin:m.tspins,quad:m.quads,attack:m.attack,pieces:m.pieces,ranked:+(m.mode==='bot'||m.mode==='online'),
    friend:+(m.mode==='friend'),ft3win:+(m.won&&m.ft),hardwin:+(m.won&&m.mode==='practice'&&m.diff===2)}[k]||0;
}
// adds a match to the missions; pps and combo are bests within one match, the rest add up. Returns the ids just completed.
function missionAdvance(ms,m){
  const done=[];
  for(const x of ms.list){
    const d=missionDef(x.id);if(x.c||x.p>=d.n)continue;
    if(d.k==='pps'){if(m.pieces>=30)x.p=Math.max(x.p,Math.floor(m.pieces*10/Math.max(1,m.time)))}
    else if(d.k==='combo')x.p=Math.max(x.p,m.combo);
    else x.p+=missionStep(d.k,m);
    x.p=Math.min(x.p,d.n);
    if(x.p>=d.n)done.push(x.id);
  }
  return done;
}
// XP into the level and the current season; level-ups pay coins. Returns [{level, coins}] for each new level.
function addXp(xp){
  const a=levelInfo(profile.xp).level;profile.xp+=xp;const z=levelInfo(profile.xp).level,ups=[];
  for(let L=a+1;L<=z;L++){const c=levelCoins(L);profile.coins+=c;ups.push({level:L,coins:c})}
  const se=currentSeason();if(se)passOf(se.id).xp+=xp;
  return ups;
}
const newMatchRef=()=>'m-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);
let progOutbox=[];try{progOutbox=JSON.parse(localStorage.getItem('neon-duel-progress')||'[]').slice(-30)}catch(e){}
function saveProg(){try{localStorage.setItem('neon-duel-progress',JSON.stringify(progOutbox.slice(-30)))}catch(e){}}
// Called once per finished match (50-match.js finishMatch). Returns what the result screen shows.
function progressMatch(s,win,ref){
  rollDay();
  const m=matchStats(s,win),before=profile.xp,se=currentSeason(),tier0=se?passTier(passOf(se.id).xp):0;
  const xp=matchXp(m);let first=0;
  if(m.won&&m.pieces>=XP_FIRST_MIN&&profile.firstWinDay!==m.day){first=XP_FIRST_WIN;profile.firstWinDay=m.day}
  const total=Math.min(xp+first,Math.max(0,XP_DAY_CAP-profile.xpToday));
  profile.xpToday+=total;
  const done=missionAdvance(profile.missions,m),ups=addXp(total);
  save();profileView();
  if(Cloud.on()){
    progOutbox.push({p_ref:ref,p_mode:m.mode,p_won:m.won,p_stats:{time:m.time,pieces:m.pieces,lines:m.lines,tspins:m.tspins,quads:m.quads,
      attack:m.attack,combo:m.combo,diff:m.diff,ft:m.ft,day:m.day}});
    saveProg();
  }
  return {xp:total,match:Math.min(xp,total),first:total-Math.min(xp,total),before,after:profile.xp,ups,done,
    season:se?se.id:'',tier0,tier1:se?passTier(passOf(se.id).xp):0,capped:total<xp+first};
}

/* ---------- server ---------- */
let progFlushing=null;
function flushProgress(){
  if(progFlushing)return progFlushing;
  return progFlushing=(async()=>{
    while(progOutbox.length&&Cloud.ready()){
      try{applyServer(await Cloud.rpc('report_progress',progOutbox[0]));progOutbox.shift();saveProg()}
      catch(e){
        if(!e.status){Cloud.state='offline';netView();break}
        if(e.message==='too_fast'||e.message==='not_finished'){setTimeout(()=>flushProgress(),11000);break}
        progOutbox.shift();saveProg();     // refused (or a server without progression): the server's numbers stand
      }
    }
  })().finally(()=>{progFlushing=null});
}
// The server's numbers replace the phone's (only when the server has the progression migration).
function applyProgress(p){
  if(!p||typeof p.xp!=='number')return;
  profile.xp=p.xp;profile.xpToday=p.xp_today|0;profile.xpDay=p.xp_day||'';profile.firstWinDay=p.first_win_day||'';
  const ms=cleanMissions(p.missions);if(ms)profile.missions=ms;
  if(p.pass&&typeof p.pass==='object')profile.pass=cleanPass(p.pass);
}
// first time on this phone: offline XP and the current season's XP go to the account once (the server caps them)
async function importProgress(p){
  if(!p||typeof p.xp!=='number'||p.xp>0||p.progress_imported||!(profile.xp>0))return p;
  const se=currentSeason();
  try{
    const r=await Cloud.rpc('import_progress',{p_xp:profile.xp,p_season:se?se.id:null,p_season_xp:se?passOf(se.id).xp:0});
    progOutbox=[];saveProg();            // those matches are part of the imported numbers
    return r&&r.id?r:p;
  }catch(e){return p}
}

/* ---------- level badge and celebrations ---------- */
// an eight-pointed seal with the level number
const LV_STAR=(()=>{let d='';for(let i=0;i<16;i++){const a=Math.PI*i/8-Math.PI/2,r=i%2?15.2:19;d+=(i?'L':'M')+(20+r*Math.cos(a)).toFixed(2)+' '+(20+r*Math.sin(a)).toFixed(2)}return d+'Z'})();
function lvlBadge(L,size){
  const fs=L>=10?12.5:14.5;
  return '<svg class="lvbadge" width="'+size+'" height="'+size+'" viewBox="0 0 40 40" aria-hidden="true"><path d="'+LV_STAR+'" fill="#ffbf3a33" stroke="#ffcf6a" stroke-width="1.8" stroke-linejoin="round"/>'
    +'<circle cx="20" cy="20" r="11.6" fill="#1b1430" stroke="#ffcf6a99" stroke-width="1.1"/>'
    +'<text x="20" y="'+(20+fs*.36).toFixed(1)+'" text-anchor="middle" font-size="'+fs+'" font-weight="800" fill="#ffe39a" font-family="Inter,system-ui,sans-serif">'+L+'</text></svg>';
}
// celebrations wait for each other (a new title first, then a level, then ...)
let celebChain=Promise.resolve();
function celebrateNext(o){
  const s=series;
  celebChain=celebChain.then(()=>(!o.whileState||(state===o.whileState&&series===s))?fxCelebrate(o):0).catch(()=>{});
  return celebChain;
}
function levelUpFx(ups,whileState){
  for(const u of ups)celebrateNext({kicker:t('levelUp'),title:t('levelN').replace('{n}',u.level),badge:lvlBadge(u.level,132),color:'#ffcf6a',
    sub:u.coins?'+'+u.coins+' ◈ '+t('coins'):t('levelUpSub'),whileState});
}

/* ---------- result screen: XP gained ---------- */
function progressResult(s){
  const box=$('xpProg'),g=s&&s.gain;if(!box)return;
  if(!g){box.innerHTML='';return}
  const a=levelInfo(g.before),z=levelInfo(g.after);
  const parts=[g.match?'+'+g.match+' '+t('xpMatch'):'',g.first?'+'+g.first+' '+t('xpFirstWin'):''].filter(Boolean).join(' · ')||t('xpNone');
  let notes='';
  if(g.capped)notes+='<span>'+t('xpCapped')+'</span>';
  if(g.done.length)notes+='<button class="xpnote" id="xpMissions">✓ '+esc(g.done.map(id=>missionText(missionDef(id))).join(', '))+' · '+t('missionClaimNow')+'</button>';
  if(g.season&&g.tier1>g.tier0)notes+='<button class="xpnote pass" id="xpPass">◆ '+t('passTierUp').replace('{n}',g.tier1)+'</button>';
  box.innerHTML='<div class="xphead">'+lvlBadge(a.level,30)+'<span id="xpLvl">'+t('levelN').replace('{n}',a.level)+'</span><b class="xpgain">+'+g.xp+' XP</b></div>'
    +'<div class="xpbar"></div>'+(notes?'<div class="xpnotes">'+notes+'</div>':'');
  if($('xpMissions'))$('xpMissions').onclick=()=>missionsDialog(closeModal);
  if($('xpPass'))$('xpPass').onclick=()=>passDialog(closeModal);
  const bar=box.querySelector('.xpbar'),col='#5fd0ff',right=i=>i.into+' / '+i.need+' XP';
  if(z.level===a.level){fxProgress(bar,{from:a.into,to:z.into,min:0,max:a.need,color:col,left:parts,right:right(z),delay:450});return}
  fxProgress(bar,{from:a.into,to:a.need,min:0,max:a.need,color:col,left:parts,right:t('levelUp'),delay:450}).then(()=>{
    if(state!=='result'||series!==s)return;
    $('xpLvl').textContent=t('levelN').replace('{n}',z.level);box.querySelector('.lvbadge').outerHTML=lvlBadge(z.level,30);
    levelUpFx(g.ups,'result');
    fxProgress(bar,{from:0,to:z.into,min:0,max:z.need,color:col,left:parts,right:right(z),ms:600});
  });
}

/* ---------- daily missions dialog ---------- */
async function claimMission(i){
  const x=profile.missions&&profile.missions.list[i];if(!x)return;
  if(Cloud.ready()){
    const lv=levelInfo(profile.xp).level;
    applyServer(await Cloud.rpc('claim_mission',{p_slot:i}));
    const L=levelInfo(profile.xp).level;if(L>lv)levelUpFx(Array.from({length:L-lv},(_,k)=>({level:lv+k+1,coins:levelCoins(lv+k+1)})));
    return;
  }
  const d=missionDef(x.id);if(x.c||x.p<d.n)return;
  const [coins,xp]=MISSION_REWARD[d.t];
  x.c=true;profile.coins+=coins;const ups=addXp(xp);save();profileView();levelUpFx(ups);
}
async function rerollMission(i){
  const ms=profile.missions,x=ms&&ms.list[i];if(!x||x.c||ms.rr)return;
  if(Cloud.ready()){applyServer(await Cloud.rpc('reroll_mission',{p_slot:i}));return}
  const d=missionDef(x.id),pool=MISSIONS.filter(y=>y.t===d.t&&!ms.list.some(z=>missionDef(z.id).k===y.k)&&(y.k!=='friend'||Cloud.on()));
  if(!pool.length)return;
  ms.list[i]={id:pool[Math.floor(Math.random()*pool.length)].id,p:0,c:false};ms.rr=true;save();
}
const MISSION_ICONS={play:'M8 5v14l11-7z',win:'M7 4h10v3a5 5 0 0 1-10 0zM5 5H3v2a4 4 0 0 0 4 4M19 5h2v2a4 4 0 0 1-4 4M12 12v4M8 20h8',lines:'M3 7h18M3 12h18M3 17h18',
  tspin:'M4 6h16M12 6v12',quad:'M8 3v18M16 3v18M4 12h16',attack:'M5 19 19 5M13 5h6v6',pieces:'M4 4h7v7H4zM13 13h7v7h-7z',ranked:'M12 3l8 4.5v9L12 21l-8-4.5v-9z',
  friend:'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M16 11a3 3 0 1 0 0-6M21 20a6 6 0 0 0-4-5.6',ft3win:'M4 17l3-10 5 6 5-6 3 10z',
  hardwin:'M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.3 6.7 19.4l1.2-6L3.4 9.3l6-.7z',pps:'M13 2 4 14h7l-1 8 9-12h-7z',combo:'M4 12h4l2-6 4 12 2-6h4'};
function missionIcon(k){return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+(MISSION_ICONS[k]||MISSION_ICONS.play)+'"/></svg>'}
function missionsDialog(back){
  rollDay();
  if(Cloud.ready()&&profile.missions.day!==ubDay(0))sync(true).then(()=>{if($('msList'))missionsDialog(back)});
  const ms=profile.missions,done=ms.list.filter(x=>x.c).length;
  let h='<span class="eyebrow">'+t('missionsEyebrow')+'</span><h2>'+t('missions')+'</h2><p class="muted" id="msReset">'+t('missionsReset').replace('{t}',fmtLeft(msToReset()))+'</p><div class="mlist" id="msList">';
  ms.list.forEach((x,i)=>{
    const d=missionDef(x.id),[coins,xp]=MISSION_REWARD[d.t],ready=!x.c&&x.p>=d.n,pct=Math.round(x.p/d.n*100);
    h+='<div class="mcard t'+d.t+(x.c?' claimed':ready?' ready':'')+'"><span class="mic">'+missionIcon(d.k)+'</span><div class="mbody"><b>'+missionText(d)+'</b>'
      +'<div class="mprog"><i style="width:'+pct+'%"></i></div><span class="mmeta"><em>'+(d.k==='pps'?(x.p/10).toFixed(1)+' / '+(d.n/10).toFixed(1):x.p+' / '+d.n)+'</em>'
      +'<span>+'+coins+' ◈ · +'+xp+' XP</span></span></div>'
      +(x.c?'<span class="mdone">✓</span>':ready?'<button class="primary mbtn" data-claim="'+i+'">'+t('claim')+'</button>'
        :'<button class="mbtn quiet" data-reroll="'+i+'"'+(ms.rr?' disabled':'')+' aria-label="'+t('reroll')+'">'+'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 0 1 13.7-5.7L20 8.6M20 4v4.6h-4.6M20 12a8 8 0 0 1-13.7 5.7L4 15.4M4 20v-4.6h4.6"/></svg></button>')+'</div>';
  });
  h+='</div><p class="muted small" id="msNote">'+(done===3?t('missionsAllDone'):ms.rr?t('rerollUsed'):t('rerollFree'))+'</p>'
    +'<div class="stack"><button id="msPass">◆ '+t('seasonPass')+'</button><button id="msDone">'+t('done')+'</button></div>';
  modal(h);
  const again=()=>missionsDialog(back),fail=e=>msgBox(errText(e),again);
  document.querySelectorAll('[data-claim]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await claimMission(+b.dataset.claim);if($('msList'))again()}catch(e){fail(e)}});
  document.querySelectorAll('[data-reroll]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await rerollMission(+b.dataset.reroll);if($('msList'))again()}catch(e){fail(e)}});
  $('msPass').onclick=()=>passDialog(again);
  $('msDone').onclick=back||closeModal;
  const tick=setInterval(()=>{if(!$('msReset')){clearInterval(tick);return}$('msReset').textContent=t('missionsReset').replace('{t}',fmtLeft(msToReset()))},1000);
}
function missionsSummary(){
  rollDay();
  const l=profile.missions.list;
  return {claimed:l.filter(x=>x.c).length,ready:l.filter(x=>!x.c&&x.p>=missionDef(x.id).n).length};
}
