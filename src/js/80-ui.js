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
  adminSettings(settings);                                   // admin sign-in and the coach switch (44-coach.js)
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
function shop(){
  // one button per skin in the registry (59-skins.js), each with a scene drawn by the real tile sprites
  let h='<h2>'+t('shop')+'</h2><p>◈ '+profile.coins+' · '+t('soon')+'</p><div class="stack">';
  for(const k of SKINS){
    const on=currentSkin()===k,own=!k.price||profile.owned.includes(k.id);
    h+='<button class="skin'+(on?' on':'')+'" data-theme="'+k.id+'"><canvas class="skinprev" width="'+150*SKIN_SCALE+'" height="'+60*SKIN_SCALE+'"></canvas>'
      +'<span class="skintext"><b>'+t(k.name)+'</b><em>'+t(k.desc)+'</em><small>'+(on?t('selected'):own?t('equip'):t('unlockFor').replace('{p}',k.price))+'</small></span></button>';
  }
  h+='<button id="adInfo">'+t('coinsHow')+'</button><button id="shopDone">'+t('done')+'</button></div>';
  modal(h);
  document.querySelectorAll('[data-theme]').forEach(b=>drawSkinPreview(b.querySelector('canvas'),skinById(+b.dataset.theme)));
  $('shopDone').onclick=closeModal;
  $('adInfo').onclick=()=>info('coinsHow','coinsInfo');
  document.querySelectorAll('[data-theme]').forEach(b=>b.onclick=async()=>{
    const k=skinById(+b.dataset.theme),i=k.id;
    if(Cloud.ready()){try{applyServer(await Cloud.rpc('buy_theme',{p_theme:i}));shop()}catch(e){msgBox(errText(e),shop)}return}
    if(!profile.owned.includes(i)){if(profile.coins<k.price){info('shop','notEnough');return}profile.coins-=k.price;profile.owned.push(i)}
    profile.theme=i;save();profileView();shop();
  });
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



