/* ---------- online ranked play ---------- */
// Matchmaking and results go through the server functions (supabase/migrations). During a game the two
// phones exchange board snapshots and attacks over a Supabase Realtime broadcast channel "match:<id>".
// The server row is the only authority on scores; messages between phones are hints and pictures.
const hangUp=ws=>{try{ws.close(1000,'done')}catch(e){}};
const RT={
  ws:null,topic:'',ref:0,joinRef:'',joined:false,want:false,hb:0,retry:0,timer:0,onMsg:null,
  open(topic,onMsg){this.close();this.topic='realtime:'+topic;this.onMsg=onMsg;this.want=true;this.retry=0;this.connect()},
  connect(){
    if(!this.want)return;
    let ws;
    try{ws=new WebSocket(Cloud.url.replace(/^http/,'ws')+'/realtime/v1/websocket?apikey='+encodeURIComponent(Cloud.key)+'&vsn=1.0.0')}
    catch(e){this.again();return}
    this.ws=ws;this.joined=false;
    ws.onopen=()=>{
      if(ws!==this.ws)return;
      this.joinRef=String(++this.ref);
      ws.send(JSON.stringify({topic:this.topic,event:'phx_join',ref:this.joinRef,join_ref:this.joinRef,
        payload:{config:{broadcast:{ack:false,self:false},presence:{enabled:false},private:false}}}));
      clearInterval(this.hb);
      this.hb=setInterval(()=>{if(ws.readyState===1)ws.send(JSON.stringify({topic:'phoenix',event:'heartbeat',payload:{},ref:String(++this.ref)}))},20000);
    };
    ws.onmessage=e=>{
      if(ws!==this.ws)return;
      let m;try{m=JSON.parse(e.data)}catch(_){return}
      if(!m||m.topic!==this.topic)return;
      if(m.event==='phx_reply'&&m.ref===this.joinRef){if(m.payload&&m.payload.status==='ok'){this.joined=true;this.retry=0}else hangUp(ws)}
      else if(m.event==='broadcast'&&m.payload&&this.onMsg)this.onMsg(m.payload.event,m.payload.payload);
      else if(m.event==='phx_error'||m.event==='phx_close')hangUp(ws);
    };
    ws.onclose=()=>{if(ws!==this.ws)return;this.ws=null;this.joined=false;clearInterval(this.hb);this.again()};
    ws.onerror=()=>hangUp(ws);
  },
  again(){if(!this.want)return;clearTimeout(this.timer);this.timer=setTimeout(()=>this.connect(),Math.min(5000,500*Math.pow(2,this.retry++)))},
  send(event,payload){
    if(!this.joined||!this.ws||this.ws.readyState!==1)return false;
    this.ws.send(JSON.stringify({topic:this.topic,event:'broadcast',ref:String(++this.ref),join_ref:this.joinRef,payload:{type:'broadcast',event,payload}}));
    return true;
  },
  close(){this.want=false;clearTimeout(this.timer);clearInterval(this.hb);const ws=this.ws;this.ws=null;this.joined=false;if(ws)hangUp(ws)},
};
const Net={
  // poll: matchmaking poll; botAfter: when the bot offer appears; noShow: wait for an opponent who never connects;
  // silent: opponent silence before claiming the series (the server requires 30 s); keepalive/ping: in-game beats
  // friendNoShow: a friend may still be in another app (sharing the code), so a friendly match waits longer
  cfg:{poll:2000,botAfter:10000,noShow:14000,friendNoShow:60000,silent:31000,lagNote:6000,keepalive:1000,ping:4000},
  tok:0,phase:'',match:null,opp:null,iAmA:false,loop:0,ui:0,pollT:0,since:0,fails:0,t0:0,
  seenOpp:false,goAt:0,pinged:false,lastHi:0,
  seq:0,out:[],lastIn:0,lastSent:0,lastHeard:0,lastPing:0,lastTry:0,lastClaim:0,died:0,oppDeadAt:0,busy:false,
  myId(){return Cloud.session?Cloud.session.user.id:''},
  stop(){this.tok++;this.phase='';clearInterval(this.loop);clearInterval(this.ui);clearTimeout(this.pollT);this.loop=this.ui=this.pollT=0;RT.close()},

  // ---- 1. look for a player with the same title
  search(){
    this.stop();
    const tok=this.tok;
    this.phase='search';this.since=Date.now();this.fails=0;
    modal('<span class="eyebrow">'+t('rankPlay')+' · '+t(profile.fmt==='ft3'?'fmtFt3':'fmtSingle')+'</span><h2>'+t('searchingRank')+'</h2>'
      +'<div class="rkme">'+myBadge(44)+'<div><b>'+esc(profile.name)+'</b><span class="muted">'+(placed()?titleName(profile.rank):t('placementShort'))+' · '+profile.rank+' RP</span></div></div>'
      +'<p class="muted" id="rkNote">'+t('sameTitle')+'</p><p class="rktime" id="rkTime">0:00</p>'
      +'<div class="stack"><button class="primary" id="rkBot" hidden>'+t('playBot')+'</button><button id="rkCancel">'+t('cancel')+'</button></div>');
    $('rkCancel').onclick=()=>this.cancel();
    $('rkBot').onclick=()=>{this.cancel();startBotRanked()};
    this.ui=setInterval(()=>{
      if(!$('rkTime'))return;
      const ms=Date.now()-this.since,sec=Math.floor(ms/1000);
      $('rkTime').textContent=Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0');
      if(ms>=15000)$('rkNote').textContent=t('nearTitle');
      if(ms>=this.cfg.botAfter)$('rkBot').hidden=false;
    },250);
    const poll=async()=>{
      if(tok!==this.tok)return;
      try{
        const m=await Cloud.rpc('find_match',{p_format:profile.fmt});
        if(tok!==this.tok)return;
        this.fails=0;
        if(m&&m.id){this.found(m);return}
      }catch(e){
        if(tok!==this.tok)return;
        if(++this.fails>=4){this.stop();offlineRank(true);return}
      }
      this.pollT=setTimeout(poll,this.cfg.poll);
    };
    poll();
  },
  cancel(){
    const was=this.phase;this.stop();closeModal();
    if(was==='search'&&Cloud.ready())Cloud.rpc('cancel_queue').catch(()=>{});
    if(was==='room'&&Cloud.ready())Cloud.rpc('cancel_room').catch(()=>{});        // a friend room (52-friends)
  },

  // ---- 2. opponent found: open the live channel, say hello, count down
  async found(m){
    const tok=this.tok;
    clearInterval(this.ui);clearTimeout(this.pollT);
    this.phase='handshake';this.match=m;this.iAmA=m.player_a===this.myId();
    this.t0=Date.now();this.seenOpp=false;this.goAt=0;this.pinged=false;this.lastHi=0;this.lastHeard=0;this.lastClaim=0;
    let o=null;
    try{const r=await Cloud.req('/rest/v1/profiles?id=eq.'+(this.iAmA?m.player_b:m.player_a)+'&select=username,avatar,rating,wins,losses');o=r&&r[0]}catch(e){}
    if(tok!==this.tok)return;
    o=this.opp=o||{username:'?',avatar:'',rating:1000,wins:0,losses:0};
    const side=(bdg,name,sub)=>'<div class="rkside">'+bdg+'<b>'+esc(name)+'</b><span class="muted">'+sub+'</span></div>';
    modal('<span class="eyebrow">'+t(m.ranked===false?'friendPlay':'rankPlay')+' · '+t(m.target>1?'fmtFt3':'fmtSingle')+'</span><h2>'+t('foundOpp')+'</h2>'
      +'<div class="rkvs">'+side(myBadge(44),profile.name,profile.rank+' RP')+'<i>VS</i>'
      +side(o.wins+o.losses>=PLACEMENT?badge(rankOf(o.rating)[0],titleColor(o.rating),44):badge('?','#8ea2c2',44),o.username,(o.rating|0)+' RP')+'</div>'
      +'<p class="rkgo" id="rkStatus">'+t('connecting')+'</p>');
    RT.open('match:'+m.id,(ev,p)=>this.onMsg(ev,p));
    this.loop=setInterval(()=>this.tick(),250);
  },
  begin(){
    const m=this.match,o=this.opp;
    this.phase='live';
    rivalRating=o.rating|0;rivalCfg=DIFFS[1];
    setRival(o.username,o.wins+o.losses>=PLACEMENT?rankOf(o.rating)[0]:'?');
    series=newSeries(m.ranked===false?'friend':'online',m.target,{matchId:m.id,seed:Number(m.seed)||1,game:m.game||1});
    closeModal();
    startRound();
  },
  fail(key){
    const on=isOnline(),m=this.match;
    if(key==='rtFail'&&m)Cloud.rpc('leave_unstarted',{p_match:m.id}).catch(()=>{});   // free the opponent at once
    this.stop();if(on)leaveMatch();againBox(t(key),!!m&&m.ranked===false);
  },

  // ---- 3. the beat: hello and countdown first, then keepalives, heartbeats and timeouts
  tick(){
    const now=Date.now(),m=this.match;
    if(this.phase==='handshake'||this.phase==='countdown'){
      if(RT.joined&&!this.pinged){this.pinged=true;this.ping()}         // "I am here", only once the live channel works
      if(RT.joined&&now-this.lastHi>=1000){this.lastHi=now;RT.send('hi',{go:this.iAmA&&this.seenOpp})}
      if(this.phase==='countdown'){
        const left=Math.ceil((this.goAt-now)/1000);
        if(left<=0){this.begin();return}
        if($('rkStatus'))$('rkStatus').textContent=left;
      }else if(now-this.t0>(m.ranked===false?this.cfg.friendNoShow:this.cfg.noShow)&&now-this.lastClaim>4000){
        this.lastClaim=now;
        if(!this.pinged){this.fail('rtFail');return}                       // our own live connection never opened
        Cloud.rpc('claim_abandoned',{p_match:m.id}).then(r=>this.onRow(r)).catch(()=>{});
      }else if(m.ranked===false&&!this.seenOpp&&now-this.t0>3000&&$('rkStatus'))$('rkStatus').textContent=t('friendWaiting');
      return;
    }
    if(this.phase!=='live'||!isOnline())return;
    const mine=state==='over'&&this.died===series.game;                   // I topped out; the server has not confirmed yet
    if((state==='play'||mine)&&now-this.lastSent>=this.cfg.keepalive)this.sendState();
    if(mine&&!this.busy&&now-this.lastTry>1500)this.report();
    const hurry=state==='play'&&this.oppDeadAt&&now-this.oppDeadAt<15000;  // the opponent topped out: get the verdict
    if(now-this.lastPing>=(hurry?700:this.cfg.ping))this.ping();
    if(state==='play'||mine){
      const quiet=now-this.lastHeard,lag=t('oppLag');
      if(state==='play'&&quiet>this.cfg.lagNote){$('toast').textContent=lag;$('toast').hidden=false}
      else if(!$('toast').hidden&&$('toast').textContent===lag)$('toast').hidden=true;
      if(quiet>this.cfg.silent&&now-this.lastClaim>5000){
        this.lastClaim=now;
        Cloud.rpc('claim_abandoned',{p_match:m.id}).then(r=>this.onRow(r)).catch(()=>{});
      }
    }
  },
  ping(){
    const m=this.match;if(!m)return;
    this.lastPing=Date.now();
    Cloud.rpc('ping_match',{p_match:m.id}).then(r=>this.onRow(r)).catch(()=>{});
  },

  // ---- 4. messages from the other phone
  onMsg(ev,p){
    if(!p||typeof p!=='object')return;
    this.lastHeard=Date.now();
    if(this.phase==='handshake'||this.phase==='countdown'){
      if(ev!=='hi'&&ev!=='s')return;
      // the host (player A) starts counting when it first hears the guest; the guest starts on the host's "go"
      if(!this.seenOpp){this.seenOpp=true;if(this.iAmA){this.lastHi=Date.now();RT.send('hi',{go:true})}}
      if(this.phase==='handshake'&&(this.iAmA||p.go||ev==='s')){this.phase='countdown';this.goAt=Date.now()+3000}
      return;
    }
    if(this.phase!=='live'||!isOnline())return;
    if(ev==='hi'){if(this.iAmA)RT.send('hi',{go:true})}                    // a guest that missed the start
    else if(ev==='over'||ev==='bye')this.lastPing=0;                       // a hint to ask the server now
    else if(ev==='s')this.onState(p);
  },
  onState(p){
    const s=series,o=boards[1];
    if(p.g!==s.game||(state!=='play'&&state!=='over'))return;
    if(typeof p.c==='string'&&p.c.length===W*H)
      for(let y=0;y<H;y++)for(let x=0;x<W;x++){const v=p.c.charCodeAt(y*W+x)-48;o.cells[y][x]=v>=0&&v<=8?v:0}
    if(Array.isArray(p.p)){const id=p.p[0]|0,r=p.p[1]|0;if(ROT[id]&&ROT[id][r])o.piece={id,r,m:ROT[id][r],x:p.p[2]|0,y:Math.max(-3,Math.min(H,p.p[3]|0))}}
    if(Array.isArray(p.gr)){const rd=Math.max(0,Math.min(40,p.gr[0]|0)),all=Math.max(rd,Math.min(40,p.gr[1]|0));o.garbage=[{rows:rd,hole:0,delay:0},{rows:all-rd,hole:0,delay:9}]}
    if(Array.isArray(p.st)){o.pieces=Math.max(0,p.st[0]|0);o.attack=Math.max(0,p.st[1]|0)}
    if(state!=='play')return;
    // every message repeats the sender's last attacks, so a lost message loses nothing
    if(Array.isArray(p.k))for(const a of p.k){
      if(!Array.isArray(a)||!(a[0]>this.lastIn))continue;
      this.lastIn=a[0];
      boards[0].garbage.push({rows:Math.max(1,Math.min(20,a[1]|0)),hole:Math.max(0,Math.min(W-1,a[2]|0)),delay:GARBAGE_DELAY});
    }
    if(p.d&&!this.oppDeadAt){this.oppDeadAt=Date.now();this.lastPing=0}
  },

  // ---- 5. our side of a game
  roundStart(){this.seq=0;this.out=[];this.lastIn=0;this.died=0;this.oppDeadAt=0;this.lastHeard=Date.now();this.sendState()},
  attack(rows,hole){this.out.push([++this.seq,rows,hole]);if(this.out.length>16)this.out.shift()},
  sendState(){
    if(!isOnline()||!boards.length)return;
    const b=boards[0],p=b.piece;
    this.lastSent=Date.now();
    RT.send('s',{g:series.game,c:b.cells.map(r=>r.join('')).join(''),p:[p.id,p.r,p.x,p.y],
      gr:[pendingRows(b,true),pendingRows(b,false)],st:[b.pieces,b.attack],d:this.died===series.game?1:0,k:this.out.slice(-8)});
  },
  localOver(){this.died=series.game;this.sendState();this.report()},
  // Only the player who topped out reports it; the opponent gets the point.
  report(){
    const s=series;if(this.busy||!s)return;
    this.busy=true;this.lastTry=Date.now();
    Cloud.rpc('report_online_game',{p_match:s.matchId,p_game:s.game})
      .then(r=>{RT.send('over',{});this.onRow(r)}).catch(()=>{}).finally(()=>{this.busy=false});
  },

  // ---- 6. the server row decides games and the series
  onRow(row){
    if(!row||!row.id||!this.match||row.id!==this.match.id)return;
    const won=row.winner===this.myId();
    if(this.phase==='handshake'||this.phase==='countdown'){
      if(row.status==='abandoned')this.fail('oppNoShow');
      else if(row.status==='finished'){this.stop();sync(true);againBox(t(won?'oppLeft':'youLeft'),row.ranked===false)}
      return;
    }
    const s=series;
    if(this.phase!=='live'||!s||!isOnline()||s.done)return;
    const me=this.iAmA?row.score_a:row.score_b,foe=this.iAmA?row.score_b:row.score_a;
    if(row.status!=='active'){
      s.done=true;s.won=won;
      if(row.status==='abandoned'){this.fail('oppNoShow');return}
      if(me<s.target&&foe<s.target)s.reason=won?'oppLeft':'youLeft';        // ended by leaving, not on points
      const wonGame=s.reason?won:me>s.me;
      s.me=me;s.foe=foe;
      if(state==='play')freezeRound(wonGame);
      closeModal();
      showRoundResult(wonGame);
      this.stop();
      return;
    }
    if(row.game>s.game){
      const wonGame=me>s.me;
      s.me=me;s.foe=foe;
      if(state==='play')freezeRound(wonGame);
      s.game=row.game;
      showRoundResult(wonGame);
    }
  },
};
let rankTok=0;
async function openRank(){
  if(state==='result')leaveMatch();
  if(state!=='title')return;
  const tk=++rankTok;
  if(Cloud.on()&&!Cloud.ready()){
    modal('<span class="eyebrow">'+t('rankPlay')+'</span><h2>'+t('connecting')+'</h2>');
    await sync();
    if(tk!==rankTok||state!=='title'||$('modal').hidden)return;
  }
  if(Cloud.ready())Net.search();else offlineRank(Cloud.on());
}
// No server (not set up yet, or unreachable): a ranked game against a bot of the player's own level.
function offlineRank(netProblem){
  modal('<span class="eyebrow">'+t('rankPlay')+'</span><h2>'+t(netProblem?'rankNoNet':'rankOffline')+'</h2><p class="muted">'+t('rankBotNote')+'</p>'
    +'<div class="stack"><button class="primary" id="rkBot">'+t('playBot')+'</button><button id="rkFriend">'+t('friendPlay')+'</button><button id="rkCancel">'+t('cancel')+'</button></div>');
  $('rkBot').onclick=()=>{closeModal();startBotRanked()};
  $('rkFriend').onclick=openFriend;
  $('rkCancel').onclick=closeModal;
}
function againBox(text,friend){
  modal('<p>'+esc(text)+'</p><div class="stack"><button class="primary" id="agYes">'+t(friend?'friendPlay':'searchAgain')+'</button><button id="agNo">'+t('done')+'</button></div>');
  $('agYes').onclick=()=>{closeModal();friend?openFriend():openRank()};
  $('agNo').onclick=closeModal;
}
// An online game cannot be paused: the button offers to give up instead, while the game keeps running.
function forfeitDialog(){
  modal('<h2>'+t('forfeitAsk')+'</h2><p class="muted" id="ffMsg">'+t(series&&series.mode==='friend'?'forfeitNoteFriend':'forfeitNote')+'</p><div class="stack"><button class="primary" id="ffNo">'+t('resume')+'</button><button id="ffYes">'+t('forfeit')+'</button></div>');
  $('ffNo').onclick=closeModal;
  $('ffYes').onclick=async()=>{
    if(!isOnline()){closeModal();return}
    $('ffYes').disabled=true;
    try{const row=await Cloud.rpc('forfeit_online',{p_match:series.matchId});RT.send('bye',{});Net.onRow(row)}
    catch(e){if($('ffMsg')){$('ffMsg').textContent=errText(e);$('ffYes').disabled=false}}
  };
}

