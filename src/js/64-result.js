/* ---------- result screen polish ----------
After a ranked game the result screen shows a bar toward the next title that fills with the RP just won (or
empties with the RP lost); a promotion or a first title opens a celebration (fxCelebrate). finishMatch
(50-match.js) writes #resultStats, possibly twice (online: once the server answers); this watches it, so the
match flow itself needs no changes.
*/
function resultFx(){
  if(state!=='result'||!series)return;
  const s=series,ranked=s.mode==='bot'||s.mode==='online';
  let box=$('rpProg');
  if(!box){box=document.createElement('div');box.id='rpProg';$('promo').after(box)}
  box.hidden=!ranked;
  if(!ranked||$('resultStats').textContent.includes('…')){box.innerHTML='';return}
  if(s.fxShown===profile.rank)return;
  s.fxShown=profile.rank;
  const before=s.startRank,after=profile.rank,d=after-before,games=profile.wins+profile.losses;
  if(!placed()){
    box.innerHTML='<div class="rptitle">'+myBadge(26)+'<span>'+t('placement')+'</span><span class="muted">'+games+' / '+PLACEMENT+'</span></div><div class="rpbar"></div>';
    fxProgress(box.querySelector('.rpbar'),{from:games-1,to:games,min:0,max:PLACEMENT,color:'#8ea2c2',left:(d>=0?'+':'')+d+' RP',right:after+' RP',delay:350});
    return;
  }
  const ti=titleIdx(after),base=TITLES[ti][1],nx=TITLES[ti+1],col=titleColor(after),start=s.startLetter==='?'?-1:titleIdx(before);
  const first=start<0,up=!first&&ti>start,down=!first&&ti<start,max=nx?nx[1]:Math.max(after,base+1);
  box.innerHTML='<div class="rptitle">'+myBadge(26)+'<span style="color:'+col+'">'+titleName(after)+' · '+rankLetter()+'</span><span class="muted">'+after+' RP</span></div><div class="rpbar"></div>';
  fxProgress(box.querySelector('.rpbar'),{from:first||up?base:down?max:before,to:nx?after:max,min:base,max,color:col,delay:350,
    left:(d>=0?'+':'')+d+' RP',right:nx?t('rpToNext').replace('{n}',nx[1]-after).replace('{t}',t(nx[0])):t('topRank')});
  if(first||up)setTimeout(()=>{if(state==='result'&&series===s)celebrateNext({kicker:t(first?'placedNow':'promoted'),title:titleName(after),
    badge:myBadge(132),color:col,sub:rankLetter()+' · '+after+' RP',whileState:'result'})},1100);
}
new MutationObserver(resultFx).observe($('resultStats'),{childList:true});
