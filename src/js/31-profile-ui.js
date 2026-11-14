/* ---------- profile modal ---------- */
function stats(){
  const can=canClaim(),games=profile.wins+profile.losses,pl=placed(),L=rankOf(profile.rank),ti=titleIdx(profile.rank),col=titleColor(profile.rank);
  let h='<span class="eyebrow">'+t('profile')+'</span><div class="rankhead">'+myBadge(64)+'<div><h2>'+esc(profile.avatar+' '+profile.name)+'</h2>';
  h+=pl?'<b class="ttl" style="color:'+col+'">'+t(TITLES[ti][0])+' · '+L[0]+'</b><div class="muted">'+profile.rank+' RP<span id="myPos"></span></div>'
       :'<b class="ttl">'+t('placement')+' '+games+' / '+PLACEMENT+'</b><div class="muted">'+profile.rank+' RP</div>';
  h+='</div></div>';
  const nxt=RANKS[RANKS.indexOf(L)+1];
  if(!pl)h+='<div class="prog"><i style="width:'+games/PLACEMENT*100+'%"></i></div>';
  else if(nxt){
    const pct=Math.max(0,Math.min(100,(profile.rank-L[1])/(nxt[1]-L[1])*100)),newTitle=titleIdx(nxt[1])>ti;
    h+='<div class="prog"><i style="width:'+pct+'%;background:'+col+'"></i></div><p class="muted small">'+t('nextRank')+': '
      +(newTitle?t(TITLES[titleIdx(nxt[1])][0])+' · ':'')+nxt[0]+' ('+nxt[1]+') · '+(nxt[1]-profile.rank)+' '+t('rpToGo')+'</p>';
  }else h+='<p class="muted small">'+t('topRank')+'</p>';
  h+='<p>'+profile.wins+' '+t('wins')+' · '+profile.losses+' '+t('losses')+(games?' · '+Math.round(profile.wins/games*100)+'% '+t('winRate'):'')+'</p>';
  h+='<div class="row"><button style="flex:1" id="ladderBtn">'+t('ladder')+'</button><button style="flex:1" id="lbBtn">'+t('leaderboard')+'</button></div>';
  h+='<div class="panel" style="margin:16px 0"><b>'+t('daily')+'</b><p class="muted">'+(profile.streak||0)+' '+t('streakDays')+'</p><button class="primary wide" id="claimDaily"'+(can?'':' disabled')+'>'+(can?t('claim')+' · +'+bonusFor()+' '+t('coins'):t('claimed'))+'</button></div>';
  const inputs='<input id="aUser" placeholder="'+t(Cloud.on()?'email':'user')+'" maxlength="'+(Cloud.on()?80:16)+'" style="'+INP+'"'+(Cloud.on()?' type="email" autocomplete="email"':'')+'><input id="aPw" type="password" placeholder="'+t('pass')+'" style="'+INP+'">';
  if(Cloud.on()){
    const u=Cloud.session?.user;
    h+='<div class="panel" style="margin:0 0 16px"><b>'+t('accTitle')+' · '+(Cloud.ready()?'<span class="ok">'+t('onlineWord')+'</span>':t('offlineWord'))+'</b>';
    if(!Cloud.ready())h+='<p class="muted">'+t('errNetwork')+'</p><button class="wide" id="retrySync">'+t('retry')+'</button>';
    else if(u.anon)h+='<p class="muted">'+t('guest')+'. '+t('cloudInfo')+'</p>'+inputs+'<div class="row"><button style="flex:1" id="linkAcc">'+t('linkAcc')+'</button><button style="flex:1" id="signInAcc">'+t('login')+'</button></div><p id="aMsg" class="muted"></p>';
    else h+='<p class="muted">'+esc(u.email)+'</p><button class="wide" id="logout">'+t('logout')+'</button>';
    h+='</div>';
  }else{
    const acc=profile.account,on=!!(acc&&acc.in);
    if(on)h+='<p class="muted">'+t('accTitle')+': '+esc(acc.user)+'</p><button class="wide" id="logout">'+t('logout')+'</button>';
    else h+='<div class="panel" style="margin:0 0 16px"><b>'+t('accTitle')+'</b><p class="muted">'+t('accInfo')+'</p>'+inputs+'<div class="row"><button style="flex:1" id="register"'+(acc?' hidden':'')+'>'+t('register')+'</button><button style="flex:1" id="login"'+(acc?'':' hidden')+'>'+t('login')+'</button></div><p id="aMsg" class="muted"></p></div>';
  }
  h+='<button class="wide" id="statsDone">'+t('done')+'</button>';
  modal(h);
  const msg=k=>$('aMsg').textContent=k;
  if(can)$('claimDaily').onclick=async()=>{$('claimDaily').disabled=true;try{await claimDaily();stats()}catch(e){msgBox(errText(e),stats)}};
  $('statsDone').onclick=closeModal;
  $('ladderBtn').onclick=ladder;
  $('lbBtn').onclick=leaderboard;
  if(Cloud.ready()&&pl)Cloud.rpc('my_position').then(n=>{if(n&&$('myPos'))$('myPos').textContent=' · #'+n}).catch(()=>{});
  if(Cloud.on()){
    if(!Cloud.ready()){$('retrySync').onclick=async()=>{$('retrySync').disabled=true;await sync(true);stats()};return}
    if(Cloud.session.user.anon){
      $('linkAcc').onclick=async()=>{
        const em=$('aUser').value.trim(),pw=$('aPw').value;if(!em.includes('@')||pw.length<6){msg(t('accBadCloud'));return}
        try{msg(t((await Cloud.link(em,pw))?'linked':'linkSent'));if(!Cloud.session.user.anon)setTimeout(stats,900)}catch(e){msg(errText(e))}
      };
      $('signInAcc').onclick=async()=>{
        const em=$('aUser').value.trim(),pw=$('aPw').value;if(!em||!pw){msg(t('accBadCloud'));return}
        try{await Cloud.signIn(em,pw);profile.cloudId='';await sync(true);stats()}catch(e){msg(errText(e))}
      };
    }else $('logout').onclick=async()=>{
      await Cloud.signOut();outbox=[];saveOutbox();
      profile=freshProfile({diff:profile.diff,lang:profile.lang,fmt:profile.fmt,powers:profile.powers,sound:profile.sound,vibration:profile.vibration,ctl:profile.ctl});
      save();translate();await sync(true);stats();
    };
    return;
  }
  const acc=profile.account;
  if(acc&&acc.in){$('logout').onclick=()=>{acc.in=false;save();stats()};return}
  $('register').onclick=async()=>{
    const u=$('aUser').value.trim(),pw=$('aPw').value;
    if(acc||u.length<3||pw.length<4){msg(t('accBad'));return}
    profile.account={user:u,hash:await hashPw(u,pw),in:true};profile.name=u.slice(0,16);save();profileView();stats();
  };
  $('login').onclick=async()=>{
    const u=$('aUser').value.trim(),pw=$('aPw').value;
    if(!acc||u!==acc.user||(await hashPw(u,pw))!==acc.hash){msg(t('accBad'));return}
    acc.in=true;profile.name=u.slice(0,16);save();profileView();stats();
  };
}
function ladder(){
  const cur=placed()?titleIdx(profile.rank):-1;
  let h='<span class="eyebrow">'+t('ladder')+'</span><h2>'+t('ladder')+'</h2><div class="lb">';
  for(let i=TITLES.length-1;i>=0;i--){
    const [k,from,col]=TITLES[i],letters=RANKS.filter(r=>titleIdx(r[1])===i).map(r=>r[0]);
    h+='<div class="lbrow'+(i===cur?' me':'')+'">'+badge(letters[letters.length-1],col,32)+'<span class="nm" style="color:'+col+'">'+t(k)
      +(i===cur?' · '+t('you'):'')+'</span><span class="muted small">'+letters.join(' ')+'</span><b>'+from+'+</b></div>';
  }
  modal(h+'</div><p class="muted small">'+t('ladderNote')+(Cloud.on()?' '+t('botCapNote'):'')+'</p><button class="wide" id="ladDone">'+t('done')+'</button>');
  $('ladDone').onclick=stats;
}
async function leaderboard(){
  modal('<span class="eyebrow">'+t('leaderboard')+'</span><h2>'+t('leaderboard')+'</h2><div class="lb" id="lbList"><p class="muted">'+t('loading')+'</p></div><p class="muted small" id="lbNote"></p><button class="wide" id="lbDone">'+t('done')+'</button>');
  $('lbDone').onclick=stats;
  const row=(pos,name,rating,me,ranked)=>'<div class="lbrow'+(me?' me':'')+'"><span class="pos">'+(pos?'#'+pos:'–')+'</span>'
    +(ranked?badge(rankOf(rating)[0],titleColor(rating),28):badge('?','#8ea2c2',28))+'<span class="nm">'+esc(name)+'</span><b>'+rating+'</b></div>';
  let html='',note='';
  if(Cloud.ready()){
    try{
      const rows=await Cloud.req('/rest/v1/leaderboard?select=id,username,avatar,rating,position&order=rating.desc&limit=50');
      html=rows.map(r=>row(r.position,r.avatar+' '+r.username,r.rating,r.id===profile.cloudId,true)).join('');
      if(placed()&&!rows.some(r=>r.id===profile.cloudId)){const n=await Cloud.rpc('my_position');html+=row(n,profile.avatar+' '+profile.name,profile.rank,true,true)}
      if(!rows.length)note=t('lbEmpty');
    }catch(e){note=t('errNetwork')}
  }
  if(!html){
    const list=[['NOVA · '+t('easy'),850],['NOVA · '+t('normal'),1000],['NOVA · '+t('diffHard'),1250]]
      .map(([n,r])=>({n,r,me:false})).concat([{n:profile.avatar+' '+profile.name+' ('+t('you')+')',r:profile.rank,me:true}]).sort((a,b)=>b.r-a.r);
    html=list.map((x,i)=>row(i+1,x.n,x.r,x.me,!x.me||placed())).join('');
    note=(note?note+' ':'')+t('offlineBoard');
  }
  if($('lbList')){$('lbList').innerHTML=html;$('lbNote').textContent=note}
}
function profileView(){
  const pn=$('profileName'),av=document.createElement('span'),nm=document.createElement('span');
  av.className='av';av.textContent=profile.avatar;nm.textContent=profile.name;pn.replaceChildren(av,nm);
  if(canClaim()){const d=document.createElement('i');d.className='dot';d.title=t('daily');pn.append(d)}
  $('record').textContent=profile.wins+' '+t('wins')+' • '+profile.losses+' '+t('losses')+' • '+profile.coins+' '+t('coins');
  $('rank').innerHTML=rankPill();
  $('rank').style.borderColor=$('rank').style.color=placed()?titleColor(profile.rank):'#8ea2c2';
}
function fit(){
  let s=Math.min(innerWidth/504,innerHeight/1000);
  $('world').style.transform='scale('+s+')';
  $('world').style.left=(innerWidth-504*s)/2+'px';
  $('world').style.top=(innerHeight-1092*s)/2+'px';
}
window.addEventListener('resize',fit);fit();

