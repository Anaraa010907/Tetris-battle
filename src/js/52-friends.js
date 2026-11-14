/* ---------- play with a friend by code (unranked) ---------- */
// One player opens a room (create_room) and gets a 6-character code; the friend types it (join_room).
// While waiting, the creator asks room_status(code) every 2 s. Once paired, both go through the same
// handshake, live game and server row as a ranked match (51-online: Net.found) with series.mode 'friend':
// rating, record and coins do not change. Rematch: both press it; rematch_room(match) pairs them again.
// Server side: supabase/migrations/20261116000000_friend_rooms.sql.
const LOOKALIKE={'А':'A','В':'B','Е':'E','К':'K','М':'M','Н':'H','Р':'P','С':'C','Т':'T','У':'Y','Ү':'Y','Х':'X','З':'3'};
// Typing is forgiving: lower case, spaces, dashes and Cyrillic letters that look like Latin ones.
function cleanCode(s){return String(s||'').toUpperCase().replace(/./g,ch=>LOOKALIKE[ch]||ch).replace(/[^A-Z0-9]/g,'').slice(0,6)}
function friendErr(e){
  const k={room_not_found:'friendNotFound',room_expired:'friendExpired',room_taken:'friendTaken',own_room:'friendOwn',network:'friendNet'}[e&&e.message];
  return k?t(k):errText(e);
}
function friendBox(text,again){
  modal('<span class="eyebrow">'+t('friendPlay')+'</span><p>'+esc(text)+'</p><div class="stack">'+(again?'<button class="primary" id="fAgain">'+t('friendRetry')+'</button>':'')
    +'<button id="fOk">'+t('done')+'</button></div>');
  if(again)$('fAgain').onclick=again;
  $('fOk').onclick=closeModal;
}
const friendHead=sub=>'<span class="eyebrow">'+t('friendPlay')+(sub?' · '+sub:'')+'</span>';
const fmtName=f=>t(f==='ft3'?'fmtFt3':'fmtSingle');

// The Rank button opens this: find a ranked opponent, or play a friend. Without a server: the bot offer.
function onlineMenu(){
  if(state!=='title')return;
  if(!Cloud.on()){offlineRank(false);return}
  modal('<span class="eyebrow">'+t('rankPlay')+'</span><h2>'+t('playOnline')+'</h2><div class="stack">'
    +'<button class="primary" id="rkFind">'+t('findPlayer')+'<br><small>'+t('findPlayerNote')+'</small></button>'
    +'<button id="rkFriend">'+t('friendPlay')+'<br><small>'+t('friendPlayNote')+'</small></button>'
    +'<button id="rkCancel">'+t('cancel')+'</button></div>');
  $('rkFind').onclick=()=>{closeModal();openRank()};
  $('rkFriend').onclick=openFriend;
  $('rkCancel').onclick=closeModal;
}
let friendTok=0;
async function openFriend(){
  if(state==='result')leaveMatch();
  if(state!=='title')return;
  Net.stop();
  const tk=++friendTok;
  if(!Cloud.on()){friendBox(t('friendNeedsOnline'));return}
  if(!Cloud.ready()){
    modal(friendHead()+'<h2>'+t('connecting')+'</h2>');
    await sync();
    if(tk!==friendTok||state!=='title'||$('modal').hidden)return;
    if(!Cloud.ready()){friendBox(t('friendNet'),openFriend);return}
  }
  modal(friendHead()+'<h2>'+t('friendPlay')+'</h2><p class="muted">'+t('friendInfo')+'</p><div class="stack">'
    +'<button class="primary" id="fCreate">'+t('friendCreate')+'</button><button id="fJoin">'+t('friendJoin')+'</button>'
    +'<button id="fFmt">'+t('format')+': '+fmtName(profile.fmt)+'</button><button id="fClose">'+t('cancel')+'</button></div>');
  $('fCreate').onclick=friendCreate;
  $('fJoin').onclick=friendJoin;
  $('fFmt').onclick=()=>{profile.fmt=profile.fmt==='ft3'?'single':'ft3';save();$('fFmt').textContent=t('format')+': '+fmtName(profile.fmt)};
  $('fClose').onclick=closeModal;
}

// ---- the creator: a code to share, then wait for the friend
async function friendCreate(){
  Net.stop();
  const tok=Net.tok;
  modal(friendHead()+'<h2>'+t('connecting')+'</h2>');
  let room;
  try{room=await Cloud.rpc('create_room',{p_format:profile.fmt})}
  catch(e){if(tok===Net.tok&&!$('modal').hidden)friendBox(friendErr(e),friendCreate);return}
  if(tok!==Net.tok||$('modal').hidden){Cloud.rpc('cancel_room').catch(()=>{});return}
  friendWait(room);
}
function friendWait(room){
  const tok=Net.tok,code=String(room.code||''),life=(Date.parse(room.expires_at)-Date.parse(room.created_at))||600000,until=Date.now()+life;
  Net.phase='room';Net.fails=0;
  modal(friendHead(fmtName(room.format))+'<h2>'+t('friendCodeTitle')+'</h2><p class="muted">'+t('friendCodeNote')+'</p>'
    +'<p class="rktime fcode" id="fCode">'+esc(code)+'</p><p class="muted small fcenter" id="fLeft"></p>'
    +'<div class="stack"><button class="primary" id="fShare">'+t('friendShare')+'</button><p class="fcenter" id="fState">'+t('friendWaiting')+'</p>'
    +'<button id="fCancel">'+t('cancel')+'</button></div>');
  $('fShare').onclick=()=>shareCode(code);
  $('fCancel').onclick=()=>{Net.cancel();openFriend()};
  const expired=()=>{
    Net.stop();
    modal(friendHead()+'<p>'+t('friendExpiredOwn')+'</p><div class="stack"><button class="primary" id="fNew">'+t('friendNewCode')+'</button><button id="fOk">'+t('done')+'</button></div>');
    $('fNew').onclick=friendCreate;$('fOk').onclick=closeModal;
  };
  const clock=()=>{
    const left=Math.max(0,until-Date.now()),sec=Math.ceil(left/1000);
    if($('fLeft'))$('fLeft').textContent=t('friendValid')+' '+Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0');
    if(!left)expired();
  };
  Net.ui=setInterval(clock,500);clock();
  const poll=async()=>{
    if(tok!==Net.tok)return;
    try{
      const m=await Cloud.rpc('room_status',{p_code:code});
      if(tok!==Net.tok)return;
      Net.fails=0;
      if(m&&m.id){Net.found(m);return}
    }catch(e){
      if(tok!==Net.tok)return;
      if(e.message==='room_expired'||e.message==='not_your_room'){expired();return}
      if(++Net.fails>=4){Net.stop();Cloud.rpc('cancel_room').catch(()=>{});friendBox(t('friendNet'),openFriend);return}
    }
    Net.pollT=setTimeout(poll,Net.cfg.poll);
  };
  poll();
}
// The system share sheet where there is one, otherwise the clipboard; the code stays on screen either way.
async function shareCode(code){
  const text=t('friendShareText').replace('{code}',code);
  const note=k=>{if($('fState'))$('fState').textContent=t(k)};
  if(navigator.share){try{await navigator.share({text});return}catch(e){if(e&&e.name==='AbortError')return}}
  try{await navigator.clipboard.writeText(text);note('friendCopied');return}catch(e){}
  try{
    const ta=document.createElement('textarea');ta.value=text;ta.setAttribute('readonly','');ta.style.cssText='position:fixed;left:0;top:0;opacity:0';
    document.body.append(ta);ta.select();const ok=document.execCommand('copy');ta.remove();
    if(ok){note('friendCopied');return}
  }catch(e){}
  note('friendTellCode');
}

// ---- the friend: type the code
function friendJoin(){
  Net.stop();
  modal(friendHead()+'<h2>'+t('friendJoin')+'</h2><p class="muted">'+t('friendJoinNote')+'</p>'
    +'<input id="fCodeIn" class="fcodein" maxlength="14" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABC234" aria-label="'+t('friendJoin')+'">'
    +'<p class="muted" id="fMsg"></p><div class="stack"><button class="primary" id="fJoinGo">'+t('friendJoinGo')+'</button><button id="fBack">'+t('cancel')+'</button></div>');
  const inp=$('fCodeIn'),msg=k=>{if($('fMsg'))$('fMsg').textContent=k};
  inp.oninput=()=>{const v=cleanCode(inp.value);if(inp.value!==v)inp.value=v};
  inp.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();go()}};
  $('fBack').onclick=openFriend;
  $('fJoinGo').onclick=go;
  async function go(){
    const code=cleanCode(inp.value);
    if(code.length!==6){msg(t('friendCodeShort'));return}
    $('fJoinGo').disabled=true;msg(t('connecting'));
    Net.stop();
    const tok=Net.tok;
    try{
      const m=await Cloud.rpc('join_room',{p_code:code});
      if(tok!==Net.tok)return;
      if(!m||!m.id)throw Object.assign(new Error('room_not_found'),{status:400});
      if($('modal').hidden){Cloud.rpc('leave_unstarted',{p_match:m.id}).catch(()=>{});return}   // closed while joining
      Net.found(m);
    }catch(e){
      if(tok!==Net.tok||!$('fJoinGo'))return;
      msg(friendErr(e));$('fJoinGo').disabled=false;
    }
  }
}

// ---- rematch from the result screen: both players press it; the first waits for the second
function friendRematch(){
  const s=series;
  if(!s||s.mode!=='friend'||!Cloud.ready()){openFriend();return}
  const prev=s.matchId,name=rival;
  leaveMatch();
  Net.stop();
  const tok=Net.tok;
  Net.phase='room';Net.fails=0;Net.since=Date.now();
  modal(friendHead()+'<h2>'+t('rematchTitle')+'</h2><p class="muted">'+esc(t('rematchWait').replace('{r}',name))+'</p>'
    +'<p class="rktime" id="rkTime">0:00</p><div class="stack"><button id="fCancel">'+t('cancel')+'</button></div>');
  $('fCancel').onclick=()=>Net.cancel();
  Net.ui=setInterval(()=>{
    const sec=Math.floor((Date.now()-Net.since)/1000);
    if($('rkTime'))$('rkTime').textContent=Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0');
  },250);
  const poll=async()=>{
    if(tok!==Net.tok)return;
    try{
      const m=await Cloud.rpc('rematch_room',{p_match:prev});
      if(tok!==Net.tok)return;
      Net.fails=0;
      if(m&&m.id){Net.found(m);return}
    }catch(e){
      if(tok!==Net.tok)return;
      if(e.status){Net.stop();friendBox(t('rematchGone'),openFriend);return}         // too late, or the friend's room is gone
      if(++Net.fails>=4){Net.stop();friendBox(t('friendNet'),openFriend);return}
    }
    Net.pollT=setTimeout(poll,Net.cfg.poll);
  };
  poll();
}
