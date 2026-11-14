/* ---------- dialogs ---------- */
function modal(html){$('modal').innerHTML=html;$('modal').hidden=false;$('title').inert=true;$('gameplay').inert=true}
function closeModal(){$('modal').hidden=true;$('title').inert=false;$('gameplay').inert=false}
function pause(){
  if(state!=='play')return;
  if(isOnline()){forfeitDialog();return}
  state='pause';heldAction='';audio.stopMusic();
  modal('<h2>'+t('paused')+'</h2><div class="stack"><button class="primary" id="resume">'+t('resume')+'</button><button id="quit">'+t('home')+'</button></div>');
  $('resume').onclick=()=>{closeModal();state='play';unlockAudio()};
  $('quit').onclick=leaveMatch;
}
$('pause').onclick=pause;
$('start').onclick=startPractice;
$('rematch').onclick=()=>series&&series.mode==='practice'?startPractice():openRank();
$('home').onclick=leaveMatch;
$('language').onclick=()=>{profile.lang=profile.lang==='mn'?'en':'mn';save();translate()};
$('sound').onclick=()=>{profile.sound=!profile.sound;save();$('sound').classList.toggle('off',!profile.sound);unlockAudio()};
$('tutorial').onclick=()=>tutorial(0);
function tutorial(i){
  modal('<span class="eyebrow">'+(i+1)+' / 3</span><h2>'+t('t'+i)+'</h2><p>'+t('d'+i)+'</p><button class="primary wide" id="tNext">'+t(i===2?'done':'continue')+'</button>');
  $('tNext').onclick=()=>i===2?closeModal():tutorial(i+1);
}
function info(title,body){modal('<h2>'+t(title)+'</h2><p>'+t(body)+'</p><button class="wide" id="infoDone">'+t('done')+'</button>');$('infoDone').onclick=closeModal}
function settings(){
  const fmtTxt=()=>t('format')+': '+t(profile.fmt==='ft3'?'fmtFt3':'fmtSingle'),powTxt=()=>t('powersSet')+': '+t(profile.powers?'on':'off');
  modal('<h2>'+t('settings')+'</h2><div class="stack"><label>'+t('nickname')+'<input id="nick" maxlength="16"></label><button id="avatar">'+t('avatar')+' '+profile.avatar+'</button>'
    +'<button id="fmtBtn">'+fmtTxt()+'</button><button id="powBtn">'+powTxt()+'</button>'
    +'<button id="vibrate">'+t('vibration')+': '+t(profile.vibration?'on':'off')+'</button><button id="privacy">'+t('privacy')+'</button><button id="delete">'+t('delete')+'</button><button id="saveProfile" class="primary">'+t('save')+'</button></div><p class="muted" id="setMsg">'+t(Cloud.on()?'cloudSaved':'local')+'</p>');
  $('nick').value=profile.name;
  $('avatar').onclick=()=>{profile.avatar=AVATARS[(AVATARS.indexOf(profile.avatar)+1)%AVATARS.length];$('avatar').textContent=t('avatar')+' '+profile.avatar;save();profileView()};
  $('fmtBtn').onclick=()=>{profile.fmt=profile.fmt==='ft3'?'single':'ft3';$('fmtBtn').textContent=fmtTxt();save()};
  $('powBtn').onclick=()=>{profile.powers=!profile.powers;$('powBtn').textContent=powTxt();save()};
  $('vibrate').onclick=()=>{profile.vibration=!profile.vibration;$('vibrate').textContent=t('vibration')+': '+t(profile.vibration?'on':'off');save();vibrate()};
  $('privacy').onclick=()=>msgBox(t('privacyText')+(Cloud.on()?' '+t('privacyCloud'):''),settings);
  $('delete').onclick=()=>{
    modal('<h2>'+t('delete')+'</h2><p>'+t(Cloud.on()?'deleteAskCloud':'deleteAsk')+'</p><div class="stack"><button id="yesDelete">'+t('confirmDelete')+'</button><button id="noDelete">'+t('cancel')+'</button></div>');
    $('noDelete').onclick=settings;
    $('yesDelete').onclick=async()=>{
      if(Cloud.on()){
        try{await sync();if(Cloud.ready())await Cloud.rpc('delete_my_account');else throw Object.assign(new Error('network'),{status:0})}
        catch(e){msgBox(errText(e),settings);return}
        Cloud.clearSession();outbox=[];saveOutbox();
      }
      profile=freshProfile({diff:profile.diff,lang:profile.lang,fmt:profile.fmt,powers:profile.powers});
      save();translate();audio.setMuted(!profile.sound);$('sound').classList.toggle('off',!profile.sound);closeModal();
      if(Cloud.on())sync(true);
    };
  };
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
$('holdBtn').onclick=()=>action('hold');
function diffView(){document.querySelectorAll('[data-diff]').forEach(b=>{const on=+b.dataset.diff===profile.diff;b.classList.toggle('on',on);b.setAttribute('aria-checked',on)})}
document.querySelectorAll('[data-diff]').forEach(b=>b.onclick=()=>{profile.diff=+b.dataset.diff;save();diffView()});
diffView();
$('record').closest('.panel').onclick=stats;
function shop(){
  let h='<h2>'+t('shop')+'</h2><p>◈ '+profile.coins+' · '+t('soon')+'</p><div class="stack">';
  for(let i=0;i<3;i++)h+='<button data-theme="'+i+'"'+(profile.theme===i?' class="on"':'')+'>'+THEMES[i].slice(0,5).map(c=>'<span class="sw" style="background:'+c+'"></span>').join('')+' '+t(['neon','aurora','sunset'][i])+'<br><small>'+t(profile.theme===i?'selected':profile.owned.includes(i)?'equip':'buy')+'</small></button>';
  h+='<button id="adInfo">'+t('ads')+'</button><button id="shopDone">'+t('done')+'</button></div>';
  modal(h);
  $('shopDone').onclick=closeModal;
  $('adInfo').onclick=()=>info('ads','adsInfo');
  document.querySelectorAll('[data-theme]').forEach(b=>b.onclick=async()=>{
    const i=+b.dataset.theme;
    if(Cloud.ready()){try{applyServer(await Cloud.rpc('buy_theme',{p_theme:i}));shop()}catch(e){msgBox(errText(e),shop)}return}
    if(!profile.owned.includes(i)){if(profile.coins<100){info('shop','notEnough');return}profile.coins-=100;profile.owned.push(i)}
    profile.theme=i;save();profileView();shop();
  });
}
$('shop').onclick=shop;
$('ranked').onclick=openRank;
translate();
if(Cloud.on()){sync();window.addEventListener('online',()=>sync())}
audio.setMuted(!profile.sound);
$('sound').classList.toggle('off',!profile.sound);
$('loading').hidden=true;
window.MableBoot?.ready();
last=performance.now();
raf=requestAnimationFrame(frame);
window.onAndroidBack=()=>{
  if(Net.phase==='search'){Net.cancel();return true}
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



