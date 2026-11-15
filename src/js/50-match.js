/* ---------- match flow ---------- */
// series.mode: 'practice' = vs NOVA, coins only | 'bot' = ranked vs a labelled bot | 'online' = ranked vs a player
// | 'friend' = vs a player by room code (52-friends): live like 'online', but no rating, record or coins
const isOnline=()=>!!series&&(series.mode==='online'||series.mode==='friend');
const powersOn=()=>!!series&&series.mode==='practice'&&profile.powers;   // powers are a practice-only option
function screen(id){$('title').inert=false;$('gameplay').inert=false;for(const s of ['title','gameplay','result','modal'])$(s).hidden=s!==id}
function clearOver(){clearInterval(overTimer);overTimer=0;$('gameover').hidden=true}
function newSeries(mode,target,extra){
  return Object.assign({mode,target,me:0,foe:0,game:1,pieces:0,attack:0,gc:0,time:0,lines:0,tspins:0,quads:0,combo:0,startRank:profile.rank,startLetter:rankLetter()},extra);
}
function setRival(name,label){rival=name;$('rivalName').textContent=name+' · '+label.toUpperCase();$('vs').textContent='VS '+name}
function startPractice(){
  rivalCfg=DIFFS[profile.diff]||DIFFS[1];rivalRating=rivalCfg.rating;
  setRival('NOVA',t(['easy','normal','diffHard'][profile.diff]||'normal'));
  series=newSeries('practice',profile.fmt==='ft3'?3:1);
  startRound();
}
function startBotRanked(){
  const bot=botFor(profile.rank);
  rivalCfg=bot.cfg;rivalRating=bot.rating;
  setRival(bot.name,t('bot')+' '+bot.rating);
  series=newSeries('bot',profile.fmt==='ft3'?3:1);
  startRound();
}
function startRound(){
  clearOver();
  roundEndSent=false;heldAction='';actionTime=0;$('action').className='';$('toast').hidden=true;acc=0;
  seed=(Math.random()*4294967295>>>0)||1;
  // both players get the same piece order; online it comes from the match seed and the game number
  const pieceSeed=isOnline()?(series.seed+series.game*7919)%2147483647:Math.floor(Math.random()*2147483647);
  boards=[makeBoard(pieceSeed),makeBoard(pieceSeed)];
  for(const b of boards)spawn(b);
  powers=[];earned=0;tick=0;aiClock=0;log=[];
  $('powers').hidden=!powersOn();
  $('series').hidden=series.target<2;
  $('series').innerHTML='<b class="me">'+series.me+'</b> – <b class="foe">'+series.foe+'</b>';
  state='play';screen('gameplay');
  if(isOnline())Net.roundStart();
  window.mableTuningReady?.();unlockAudio();
}
// A game ends in two steps: the board freezes with GAME!, then the score is shown once it is known
// (at once against the AI or a bot; online, when the server has confirmed it).
function freezeRound(win){
  const b=boards[0];
  state='over';heldAction='';audio.stopMusic();sound(win?'clear':'lock');vibrate();
  series.pieces+=b.pieces;series.attack+=b.attack;series.gc+=b.garbageCleared;series.time+=b.time;
  series.lines+=b.lines;series.tspins+=b.tspins;series.quads+=b.quads;series.combo=Math.max(series.combo,b.maxCombo);
  $('gameover').innerHTML='<b>GAME!</b><div id="gdet"></div>';
  $('gameover').hidden=false;
}
function showRoundResult(win){
  const s=series,ft=s.target>1,done=!!s.done||s.me>=s.target||s.foe>=s.target;
  $('series').innerHTML='<b class="me">'+s.me+'</b> – <b class="foe">'+s.foe+'</b>';
  $('gdet').innerHTML=(s.reason?'<div class="gsub">'+t(s.reason)+'</div>':ft?'<div class="gsub">'+(win?t('roundWin'):esc(t('roundLose').replace('{r}',rival)))+'</div>':'')
    +(ft?'<div class="gscore"><span class="me">'+s.me+'</span> – <span class="foe">'+s.foe+'</span></div><div class="gnext" id="gnext"></div>':'');
  clearInterval(overTimer);
  let left=done?1.6:4.6;
  overTimer=setInterval(()=>{
    left-=.2;
    if(!done&&$('gnext')&&left<=3)$('gnext').textContent=t('nextRound')+' '+Math.max(1,Math.ceil(left));
    if(left<=0){clearInterval(overTimer);overTimer=0;done?finishMatch(s.won!==undefined?s.won:s.me>s.foe):startRound()}
  },200);
}
function finishRound(loser){
  if(state!=='play')return;
  const win=loser!==boards[0];
  freezeRound(win);
  if(isOnline()){Net.localOver();return}       // only our own top-out ends an online game locally
  if(win)series.me++;else series.foe++;
  showRoundResult(win);
}
const fmtTime=s=>Math.floor(s/60)+':'+(s%60).toFixed(1).padStart(4,'0');
// Coins for a finished match: [loss, win] per format (the server's report_match / finish_online use the same
// numbers; docs/PROGRESSION.md has the whole economy). A friendly match pays none.
const MATCH_COINS={single:[10,30],ft3:[20,75]};
const matchCoins=(mode,ft,win)=>mode==='friend'?0:MATCH_COINS[ft?'ft3':'single'][win?1:0];
function finishMatch(win){
  clearOver();
  state='result';
  const s=series,friend=s.mode==='friend',ranked=s.mode==='bot'||s.mode==='online',online=isOnline(),ft=s.target>1;
  const wasPlaced=placed(),oldTitle=titleIdx(profile.rank),before=profile.rank,coins=matchCoins(s.mode,ft,win);
  const capped=s.mode==='bot'&&Cloud.on()&&before>=BOT_RP_CAP;
  if(!online){
    // practice pays coins only; a ranked bot game also moves the rating
    if(ranked){
      if(win)profile.wins++;else profile.losses++;
      if(!capped)profile.rank=Math.max(0,before+Math.round((ft?40:24)*((win?1:0)-1/(1+Math.pow(10,(rivalRating-before)/400)))));
    }
    profile.coins+=coins;save();
  }
  // XP, level, daily missions and season pass (56-progress.js): counted here at once, confirmed by the server later.
  // ref identifies the match for the server and the payments hooks: the online match id, or a new id.
  const ref=s.matchId||newMatchRef(),info={mode:s.mode,win,coins,ref};
  s.ref=ref;s.gain=progressMatch(s,win,ref);
  const secs=Math.max(1,s.time);
  const pps=(s.pieces/secs).toFixed(2),apm=(s.attack/secs*60).toFixed(1),vs=((s.attack+s.gc)/secs*100).toFixed(1);
  $('resultEyebrow').textContent=t(friend?'friendTag':ranked?'rankedTag':'practiceTag')+(s.reason?' · '+t(s.reason):ft?' · '+s.me+' – '+s.foe:'');
  $('outcome').textContent=win?t('win'):t('lose').replace('{r}',rival);
  $('outcome').classList.toggle('lose',!win);
  const chip=(v,l,c)=>'<span class="chip'+(c?' '+c:'')+'"><b>'+v+'</b>'+l+'</span>';
  let waiting=online&&!friend;                 // online, the rating and coins come from the server
  const show=()=>{
    const d=profile.rank-before,letter=rankLetter(),rankLbl=s.startLetter!==letter?s.startLetter+' → '+letter:letter;
    $('resultStats').innerHTML=(!ranked?chip('–',t(friend?'friendNoRp':'noRp')):waiting?chip('…','RP'):chip((d>=0?'+':'')+d,'RP · '+rankLbl,d>=0?'up':'down'))
      +chip(friend?'–':'+'+coins,'◈ '+t('coins'))+chip(fmtTime(s.time),t('timeLbl'))+chip(pps,'PPS')+chip(apm,'APM')+chip(vs,'VS');
    const ti=titleIdx(profile.rank),promo=!ranked||waiting?null:!wasPlaced&&placed()?['up','placedNow']:wasPlaced&&ti>oldTitle?['up','promoted']:wasPlaced&&ti<oldTitle?['down','demoted']:null;
    $('promo').hidden=!promo&&!capped;
    if(promo){$('promo').className=promo[0];$('promo').innerHTML='<span>'+t(promo[1])+'</span>'+myBadge(34)+'<span>'+titleName(profile.rank)+'</span>'}
    else if(capped){$('promo').className='note';$('promo').textContent=t('botCapNote')}
  };
  show();
  screen('result');
  progressResult(s);
  window.renderResultAd?.($('resultAd'),info);         // payments agent (55-store.js): e.g. watch an ad for double coins
  window.onMatchEnd?.(info);                            // payments agent: interstitial pacing (never for online/friend)
  if(!roundEndSent){roundEndSent=true;if(window.parent!==window)window.parent.postMessage({source:'mable-playable',type:'round_end',score:Math.round(+vs)},'*')}
  if(online){if(!friend)sync(true).then(()=>{waiting=!Cloud.ready();if(state==='result'&&series===s)show()})}
  else if(Cloud.on()){
    // the server recalculates rating and coins; its numbers replace the local ones when they arrive
    outbox.push({p_kind:ranked?'bot':'ai',p_opponent:rival,p_opponent_rating:rivalRating,p_format:ft?'ft3':'single',p_won:win,
      p_score_me:s.me,p_score_foe:s.foe,p_stats:{pps:+pps,apm:+apm,vs:+vs,time:Math.round(s.time),pieces:s.pieces,attack:s.attack}});
    saveOutbox();
    (Cloud.ready()?flushOutbox().then(flushProgress):sync()).then(()=>{if(state==='result'&&series===s)show()});
  }
}
function leaveMatch(){Net.stop();clearOver();series=null;state='title';screen('title');profileView()}

