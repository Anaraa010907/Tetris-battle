/* ---------- dialogs ---------- */
function modal(html){$('modal').innerHTML=html;$('modal').hidden=false;$('title').inert=true;$('gameplay').inert=true}
function closeModal(){$('modal').hidden=true;$('title').inert=false;$('gameplay').inert=false}
function pause(){
  if(state!=='play')return;
  if(isOnline()){forfeitDialog();return}
  state='pause';heldAction='';audio.stopMusic();
  pauseMenu();
}
function pauseMenu(){
  modal('<h2>'+t('paused')+'</h2><div class="stack"><button class="primary" id="resume">'+t('resume')+'</button><button id="pauseCtl">'+t('controls')+'</button><button id="quit">'+t('home')+'</button></div>');
  $('resume').onclick=()=>{closeModal();state='play';unlockAudio()};
  $('pauseCtl').onclick=()=>controlsDialog(pauseMenu);
  $('quit').onclick=leaveMatch;
}
$('pause').onclick=pause;
$('start').onclick=startPractice;
$('rematch').onclick=()=>series&&series.mode==='practice'?startPractice():series&&series.mode==='friend'?friendRematch():openRank();
$('home').onclick=leaveMatch;
$('language').onclick=()=>{profile.lang=profile.lang==='mn'?'en':'mn';save();translate()};
$('sound').onclick=()=>{profile.sound=!profile.sound;save();$('sound').classList.toggle('off',!profile.sound);unlockAudio()};
$('tutorial').onclick=()=>tutorial(0);
function tutorial(i){
  modal('<span class="eyebrow">'+(i+1)+' / 3</span><h2>'+t('t'+i)+'</h2>'+tutorialArt(i)+'<p>'+t('d'+i)+'</p><button class="primary wide" id="tNext">'+t(i===2?'done':'continue')+'</button>');
  $('tNext').onclick=()=>i===2?closeModal():tutorial(i+1);
}
function info(title,body){modal('<h2>'+t(title)+'</h2><p>'+t(body)+'</p><button class="wide" id="infoDone">'+t('done')+'</button>');$('infoDone').onclick=closeModal}
function settings(){
  const fmtTxt=()=>t('format')+': '+t(profile.fmt==='ft3'?'fmtFt3':'fmtSingle'),powTxt=()=>t('powersSet')+': '+t(profile.powers?'on':'off');
  modal('<h2>'+t('settings')+'</h2><div class="stack"><label>'+t('nickname')+'<input id="nick" maxlength="16"></label><button id="avatar">'+t('avatar')+' '+profile.avatar+'</button>'
    +'<button id="fmtBtn">'+fmtTxt()+'</button><button id="powBtn">'+powTxt()+'</button><button id="ctlBtn">'+t('controls')+'</button>'
    +'<button id="vibrate">'+t('vibration')+': '+t(profile.vibration?'on':'off')+'</button><button id="privacy">'+t('privacy')+'</button><button id="delete" class="danger">'+t(Cloud.on()?'deleteAccount':'delete')+'</button><button id="saveProfile" class="primary">'+t('save')+'</button></div><p class="muted" id="setMsg">'+t(Cloud.on()?'cloudSaved':'local')+'</p>');
  $('nick').value=profile.name;
  $('avatar').onclick=()=>{profile.avatar=AVATARS[(AVATARS.indexOf(profile.avatar)+1)%AVATARS.length];$('avatar').textContent=t('avatar')+' '+profile.avatar;save();profileView()};
  $('fmtBtn').onclick=()=>{profile.fmt=profile.fmt==='ft3'?'single':'ft3';$('fmtBtn').textContent=fmtTxt();save()};
  $('powBtn').onclick=()=>{profile.powers=!profile.powers;$('powBtn').textContent=powTxt();save()};
  $('ctlBtn').onclick=()=>controlsDialog(settings);
  $('vibrate').onclick=()=>{profile.vibration=!profile.vibration;$('vibrate').textContent=t('vibration')+': '+t(profile.vibration?'on':'off');save();vibrate()};
  $('privacy').onclick=()=>msgBox(t('privacyText')+(Cloud.on()?' '+t('privacyCloud'):''),settings);
  $('delete').onclick=()=>deleteDialog(settings);
  $('saveProfile').onclick=async()=>{
    const name=$('nick').value.trim().slice(0,16)||'NOMAD';
    if(Cloud.ready()){
      if(name.length<3){$('setMsg').textContent=t('accBad');return}
      try{applyServer(await Cloud.rpc('set_profile',{p_username:name,p_avatar:profile.avatar,p_theme:profile.theme}))}
      catch(e){$('setMsg').textContent=errText(e);return}
    }else profile.name=name;
    save();profileView();closeModal();
  };
}
$('settings').onclick=settings;
// Delete the profile (offline) or the account and its server data (online). Opened from Settings and Profile.
function deleteDialog(back){
  const cloud=Cloud.on();
  modal('<h2>'+t(cloud?'deleteAccount':'delete')+'</h2><p>'+t(cloud?'deleteAskCloud':'deleteAsk')+'</p><div class="stack"><button id="yesDelete" class="danger">'+t(cloud?'confirmDeleteCloud':'confirmDelete')+'</button><button id="noDelete">'+t('cancel')+'</button></div>');
  $('noDelete').onclick=back;
  $('yesDelete').onclick=async()=>{
    if(cloud){
      try{await sync();if(Cloud.ready())await Cloud.rpc('delete_my_account');else throw Object.assign(new Error('network'),{status:0})}
      catch(e){msgBox(errText(e),back);return}
      Cloud.clearSession();outbox=[];saveOutbox();
    }
    profile=freshProfile({diff:profile.diff,lang:profile.lang,fmt:profile.fmt,powers:profile.powers,ctl:profile.ctl});
    save();translate();audio.setMuted(!profile.sound);$('sound').classList.toggle('off',!profile.sound);closeModal();
    if(cloud)sync(true);
  };
}
$('holdBtn').onclick=()=>action('hold');
function diffView(){document.querySelectorAll('[data-diff]').forEach(b=>{const on=+b.dataset.diff===profile.diff;b.classList.toggle('on',on);b.setAttribute('aria-checked',on)})}
document.querySelectorAll('[data-diff]').forEach(b=>b.onclick=()=>{profile.diff=+b.dataset.diff;save();diffView()});
diffView();
$('record').closest('.panel').onclick=stats;
/* ---------- shop ----------
Three tabs: skins (rendered previews from the registry in 59-skins.js; owned / equipped / price / season exclusive),
the season pass (57-pass.js) and #shopIap, which the payments agent fills (window.renderIapSection, 55-store.js:
coin packs, remove ads, free coins, restore). Skins only change how blocks look. */
let shopTab='skins';
function skinLabel(k){
  if(currentSkin()===k)return t('selected');
  if(skinOwned(k))return t('equip');
  if(k.season)return '◆ '+t('seasonSkinNote').replace('{s}',t('season_'+k.season));
  return t('unlockFor').replace('{p}',k.price);
}
function skinButton(k){
  const on=currentSkin()===k;
  return '<button class="skin'+(on?' on':'')+(skinOwned(k)?' owned':'')+(k.season?' season':'')+'" data-theme="'+k.id+'">'
    +'<span class="skwrap'+(k.fx?' fx'+k.fx.kind[0]:'')+'"><canvas class="skinprev" width="'+150*SKIN_SCALE+'" height="'+60*SKIN_SCALE+'"></canvas></span>'
    +'<span class="skintext"><b>'+t(k.name)+'</b><em>'+t(k.desc)+'</em><small>'+skinLabel(k)+'</small></span></button>';
}
function shop(tab){
  if(typeof tab==='string')shopTab=tab;
  const tabs=[['skins','tabSkins'],['pass','tabPass'],['iap','tabCoins']];
  let h='<div class="shophead"><h2>'+t('shop')+'</h2><span class="coinbal" aria-label="'+t('coins')+'">◈ <b>'+profile.coins+'</b></span></div>'
    +'<div class="seg shoptabs" role="tablist">'+tabs.map(([k,l])=>'<button role="tab" data-tab="'+k+'"'+(shopTab===k?' class="on" aria-selected="true"':' aria-selected="false"')+'>'+t(l)+'</button>').join('')+'</div>';
  h+='<div id="shopSkins"'+(shopTab==='skins'?'':' hidden')+'>';
  for(const [label,list] of [['skinsStarter',SKINS.filter(k=>k.id<3)],['skinsCoin',SKINS.filter(k=>k.id>=3&&!k.season)],['skinsSeason',SKINS.filter(k=>k.season)]])
    if(list.length)h+='<span class="eyebrow skgroup">'+t(label)+'</span><div class="stack">'+list.map(skinButton).join('')+'</div>';
  h+='<div class="stack skfoot"><button id="adInfo">'+t('coinsHow')+'</button></div></div>';
  h+='<div id="shopPass"'+(shopTab==='pass'?'':' hidden')+'></div>';
  h+='<div id="shopIap"'+(shopTab==='iap'?'':' hidden')+'></div>';
  h+='<div class="stack shopdone"><button id="shopDone">'+t('done')+'</button></div>';
  modal(h);
  document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>shop(b.dataset.tab));
  if(shopTab==='skins')document.querySelectorAll('[data-theme]').forEach(b=>drawSkinPreview(b.querySelector('canvas'),skinById(+b.dataset.theme),true));
  if(shopTab==='pass')renderPass($('shopPass'),()=>shop('pass'));
  if(window.renderIapSection){try{window.renderIapSection($('shopIap'))}catch(e){}}
  else $('shopIap').innerHTML='<p class="muted iapnote">'+t('iapAppOnly')+'</p>';
  $('shopDone').onclick=closeModal;
  $('adInfo').onclick=()=>info('coinsHow','coinsInfo');
  document.querySelectorAll('[data-theme]').forEach(b=>b.onclick=()=>{
    const k=skinById(+b.dataset.theme);
    if(!skinOwned(k)&&k.season){shop('pass');return}           // season skins come from the pass
    if(!skinOwned(k)&&k.price>=300){buySkinAsk(k);return}       // bigger prices ask first
    buySkin(k);
  });
}
async function buySkin(k){
  const i=k.id;
  if(Cloud.ready()){try{applyServer(await Cloud.rpc('buy_theme',{p_theme:i}));shop()}catch(e){msgBox(errText(e),shop)}return}
  if(!skinOwned(k)){if(profile.coins<k.price){info('shop','notEnough');return}profile.coins-=k.price;profile.owned.push(i)}
  profile.theme=i;save();profileView();shop();
}
function buySkinAsk(k){
  const can=profile.coins>=k.price;
  modal('<span class="eyebrow">'+t('shop')+'</span><h2>'+t(k.name)+'</h2><span class="skwrap big'+(k.fx?' fx'+k.fx.kind[0]:'')+'"><canvas class="skinbig" width="'+300*SKIN_SCALE+'" height="'+120*SKIN_SCALE+'"></canvas></span>'
    +'<p>'+t(k.desc)+'</p><p class="muted small">◈ '+profile.coins+' · '+t('skinBuyNote')+'</p><div class="stack"><button class="primary" id="skBuy"'+(can?'':' disabled')+'>'
    +t('unlockFor').replace('{p}',k.price)+'</button>'+(can?'':'<p class="muted small">'+t('notEnough')+'</p>')+'<button id="skBack">'+t('cancel')+'</button></div>');
  drawSkinPreview(document.querySelector('.skinbig'),k);
  $('skBuy').onclick=()=>buySkin(k);
  $('skBack').onclick=()=>shop();
}
$('shop').onclick=shop;
$('ranked').onclick=onlineMenu;
translate();
if(Cloud.on()){sync();window.addEventListener('online',()=>sync())}
audio.setMuted(!profile.sound);
$('sound').classList.toggle('off',!profile.sound);
$('loading').hidden=true;
window.MableBoot?.ready();
last=performance.now();
raf=requestAnimationFrame(frame);
window.onAndroidBack=()=>{
  if(Net.phase==='search'||Net.phase==='room'){Net.cancel();return true}
  if(Net.phase==='handshake'||Net.phase==='countdown')return true;
  if(!$('modal').hidden){
    if(state==='pause'){closeModal();state='play';unlockAudio()}
    else{rankTok++;closeModal()}
    return true;
  }
  if(state==='play'){pause();return true}
  if(state==='over')return true;
  if(state==='result'){leaveMatch();return true}
  return false;
};
if(location.hash.includes('mable-surface=preview'))startPractice();



