/* ---------- home screen ----------
The home backdrop is drawn in code: a night sky over the steppe with a lit ger, an ornament ring, and
floating pieces painted with the equipped skin, so the home screen always shows the blocks the player
plays with. The sky is painted once into #homeArt; the ring and pieces float with CSS transforms
(composited, cheap; still under prefers-reduced-motion). homeView() runs every frame on the home screen
and only repaints when the skin changes.
*/
const HOME_PIECES=[            // piece id, tile size, x, y (centre, hero box px), angle, depth class
  [2,42,252,138,-8,'near'],[4,24,92,58,14,''],[1,26,96,196,-12,''],[3,24,412,62,-16,''],[6,28,408,194,10,''],
  [0,13,178,40,0,'far'],[5,12,34,126,20,'far'],[3,12,472,138,-24,'far']];
let homeSkin=null,homeStreak='';
function homeRand(seed){return ()=>{seed=(seed*16807)%2147483647;return seed/2147483647}}
function drawHomeArt(){
  const cv=$('homeArt'),c=cv.getContext('2d'),w=504,h=1092,hz=566,rnd=homeRand(7);
  c.setTransform(cv.width/w,0,0,cv.height/h,0,0);
  let g=c.createLinearGradient(0,0,0,h);
  g.addColorStop(0,'#040816');g.addColorStop(.32,'#081032');g.addColorStop(.5,'#141554');g.addColorStop(.52,'#1d1658');g.addColorStop(.6,'#0a0d2a');g.addColorStop(1,'#050817');
  c.fillStyle=g;c.fillRect(0,0,w,h);
  // aurora glows at the sides, like the gameplay backdrop
  for(const [x,y,r,col] of [[-30,300,280,'rgba(34,211,238,.28)'],[540,410,290,'rgba(143,60,255,.30)'],[252,hz,300,'rgba(74,92,240,.32)']]){
    g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,col);g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(0,0,w,h);
  }
  // stars
  for(let i=0;i<150;i++){
    const x=rnd()*w,y=rnd()*(hz-40),s=rnd()<.12?1.6:.5+rnd()*.8,a=.25+rnd()*.65;
    c.fillStyle=rnd()<.15?'rgba(255,214,120,'+a+')':'rgba(200,220,255,'+a+')';c.fillRect(x,y,s,s);
  }
  for(const [x,y] of [[60,120],[438,96],[392,262],[118,330],[300,64]]){
    c.strokeStyle='rgba(220,235,255,.55)';c.lineWidth=.8;c.beginPath();c.moveTo(x-6,y);c.lineTo(x+6,y);c.moveTo(x,y-6);c.lineTo(x,y+6);c.stroke();
    c.fillStyle='#fff';c.fillRect(x-1,y-1,2,2);
  }
  // mountains: far jagged range with a neon rim, near rolling steppe hills
  const ridge=(base,amp,step,seed)=>{const r=homeRand(seed),p=[];for(let x=-20;x<=w+20;x+=step)p.push([x,base-amp*(.35+r()*.65)]);return p};
  const far=ridge(hz-18,70,34,3),near=ridge(hz+2,26,56,11);
  const hill=(pts,fill)=>{c.beginPath();c.moveTo(-20,hz+60);pts.forEach(([x,y],i)=>{if(!i)c.lineTo(x,y);else{const [px,py]=pts[i-1];c.quadraticCurveTo(px,py,(px+x)/2,(py+y)/2)}});c.lineTo(w+20,hz+60);c.closePath();c.fillStyle=fill;c.fill()};
  hill(far,'#151a4a');
  c.save();c.beginPath();far.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));
  g=c.createLinearGradient(0,0,w,0);g.addColorStop(0,'rgba(34,211,238,.7)');g.addColorStop(.5,'rgba(110,120,255,.45)');g.addColorStop(1,'rgba(180,81,249,.7)');
  c.strokeStyle=g;c.lineWidth=1.2;c.shadowColor='#6d6bff';c.shadowBlur=10;c.stroke();c.restore();
  hill(near,'#0b0f2e');
  // a ger on the near hill with a warm lit door
  const gx=446,gy=hz-4;
  c.fillStyle='#0d1236';c.beginPath();c.moveTo(gx-22,gy);c.lineTo(gx-22,gy-13);c.quadraticCurveTo(gx,gy-30,gx+22,gy-13);c.lineTo(gx+22,gy);c.closePath();c.fill();
  c.strokeStyle='rgba(255,191,58,.45)';c.lineWidth=1;c.beginPath();c.moveTo(gx-22,gy-13);c.quadraticCurveTo(gx,gy-30,gx+22,gy-13);c.stroke();
  g=c.createRadialGradient(gx,gy-5,0,gx,gy-5,26);g.addColorStop(0,'rgba(255,190,90,.45)');g.addColorStop(1,'rgba(255,190,90,0)');c.fillStyle=g;c.fillRect(gx-30,gy-30,60,40);
  c.fillStyle='#ffc66b';c.fillRect(gx-3.5,gy-11,7,11);
  c.fillStyle='rgba(255,255,255,.18)';c.fillRect(gx-1,gy-31,2,5);
  // floor: a perspective grid toward the horizon
  c.save();c.beginPath();c.rect(0,hz+8,w,h-hz);c.clip();
  for(let k=1;k<26;k++){const y=hz+8+k*k*1.25;if(y>h)break;c.strokeStyle='rgba(96,110,255,'+Math.max(.04,.32-k*.012)+')';c.lineWidth=.8;c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke()}
  for(let k=-12;k<=12;k++){c.strokeStyle='rgba(96,110,255,'+(.22-Math.abs(k)*.01)+')';c.lineWidth=.8;c.beginPath();c.moveTo(252+k*8,hz+8);c.lineTo(252+k*92,h);c.stroke()}
  c.restore();
  g=c.createLinearGradient(0,hz-2,0,hz+16);g.addColorStop(0,'rgba(120,130,255,0)');g.addColorStop(.5,'rgba(140,150,255,.55)');g.addColorStop(1,'rgba(120,130,255,0)');c.fillStyle=g;c.fillRect(0,hz-2,w,18);
  g=c.createRadialGradient(252,h+40,0,252,h+40,330);g.addColorStop(0,'rgba(59,130,246,.35)');g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(0,0,w,h);
}
// the ornament ring behind the pieces: stepped motifs and a diamond chain (drawn once, rotated by CSS)
function drawHomeRing(){
  const cv=$('homeRing'),c=cv.getContext('2d'),S=cv.width/300,R=128;
  c.setTransform(S,0,0,S,150*S,150*S);c.clearRect(-150,-150,300,300);
  const g=c.createRadialGradient(0,0,40,0,0,150);g.addColorStop(0,'rgba(255,191,58,.10)');g.addColorStop(.7,'rgba(110,90,255,.08)');g.addColorStop(1,'rgba(0,0,0,0)');
  c.fillStyle=g;c.fillRect(-150,-150,300,300);
  c.strokeStyle='rgba(255,201,90,.55)';c.lineWidth=1.2;c.beginPath();c.arc(0,0,R,0,Math.PI*2);c.stroke();
  c.strokeStyle='rgba(255,201,90,.25)';c.beginPath();c.arc(0,0,R-12,0,Math.PI*2);c.stroke();
  for(let i=0;i<24;i++){
    c.save();c.rotate(i/24*Math.PI*2);c.translate(0,-R+6);
    if(i%2){c.fillStyle='rgba(255,214,120,.8)';c.beginPath();c.moveTo(0,-4);c.lineTo(3.5,0);c.lineTo(0,4);c.lineTo(-3.5,0);c.closePath();c.fill()}
    else{c.strokeStyle='rgba(120,200,255,.7)';c.lineWidth=1;pathStepped(c,-5,-5,10,10,3);c.stroke()}
    c.restore();
  }
}
function homePieces(skin){
  const hero=$('hero');
  if(!hero.children.length){
    hero.innerHTML='<canvas id="homeRing" width="600" height="600"></canvas>'+HOME_PIECES.map((p,i)=>'<canvas class="hp '+p[5]+'" style="--d:'+(i*.7).toFixed(1)+'s;--r:'+p[4]+'deg"></canvas>').join('');
    drawHomeRing();
  }
  HOME_PIECES.forEach(([id,s,x,y],i)=>{
    const cv=hero.children[i+1],m=PREV[id],w=m[0].length*s,h=m.length*s;
    cv.width=w*SKIN_SCALE;cv.height=h*SKIN_SCALE;cv.style.width=w+'px';cv.style.height=h+'px';cv.style.left=(x-w/2)+'px';cv.style.top=(y-h/2)+'px';
    const c=cv.getContext('2d');c.setTransform(SKIN_SCALE,0,0,SKIN_SCALE,0,0);
    m.forEach((row,r)=>row.forEach((v,q)=>{if(v)c.drawImage(skinSprite(skin,id+1,s),q*s,r*s,s,s)}));
  });
}
// the daily streak chip above the profile card (opens the profile, where the reward is claimed)
function streakView(){
  const can=canClaim(),n=profile.streak||0,key=profile.lang+n+can;
  if(key===homeStreak)return;homeStreak=key;
  const el=$('streak');el.hidden=!n&&!can;el.classList.toggle('ready',can);
  el.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2.4 1.2-4 2.6-5.3.2 1.8 1 3 2.4 3.6C11.4 8.6 11 5 12 2z"/></svg>'
    +(n?'<b>'+t('streakN').replace('{n}',n)+'</b>':'')+(can?'<span>'+t('dailyReady')+'</span>':'');
}
function homeView(){
  const skin=currentSkin();
  if(homeSkin!==skin){if(!homeSkin)drawHomeArt();homeSkin=skin;homePieces(skin)}
  streakView();
}
$('streak').onclick=()=>stats();
// The wordmark comes from t('brandName'): the first word large in gold, the rest under it between ornaments.
// Font sizes shrink to fit, so any name of one or two words fits the logo and the header.
function brandLogo(){
  const words=t('brandName').toUpperCase().split(/\s+/),one=words[0],two=words.slice(1).join(' ');
  const logo=document.querySelector('.logo');
  logo.querySelectorAll('.lgw1').forEach(e=>{e.textContent=one;e.style.fontSize=''});
  const w2=logo.querySelector('.lgw2');w2.textContent=two;w2.style.fontSize='';
  logo.querySelector('.lgline').setAttribute('d',two?'M30 151H98M362 151H430':'M30 151H430');
  logo.querySelector('.lgband').classList.toggle('solo',!two);
  const fit=(el,max,els)=>{for(let i=0;i<3;i++){const w=el.getComputedTextLength();if(w<=max)break;const fs=parseFloat(getComputedStyle(el).fontSize)*max/w*.99;els.forEach(e=>e.style.fontSize=fs+'px')}};
  fit(logo.querySelector('.lgf'),396,logo.querySelectorAll('.lgw1'));
  if(two)fit(w2,216,[w2]);
  const hb=$('brandMark');hb.style.fontSize='';if(hb.offsetWidth>160)hb.style.fontSize=parseFloat(getComputedStyle(hb).fontSize)*160/hb.offsetWidth+'px';
}
brandLogo();
document.fonts?.ready.then(brandLogo);

// seven dots for the daily streak (the reward grows until day 7), shown in the profile's daily panel
function streakDots(){
  const n=Math.min(7,profile.streak||0);
  return '<div class="sdots" aria-hidden="true">'+Array.from({length:7},(_,i)=>'<i class="'+(i<n?'on':'')+'"></i>').join('')+'</div>';
}

/* ---------- tutorial pictures ----------
Each tutorial step gets a small scene drawn with the equipped skin: moving and rotating, clearing rows to
attack, and incoming garbage on the meter. tutorialArt(i) returns the canvas markup and draws it right after
the dialog is shown. */
const TUT_SCENES=[
  ['....3.....','...333....','..........','..........','..........','..........','1.22..44..','1.22.4466.'],
  ['..........','..........','..........','.......1..','3......1..','33.6...1..','3366644177','5566177117'],
  ['..........','..........','..........','.....3....','..1.333...','..1.22.66.','8888.88888','88.8888888']];
function tutorialArt(i){queueMicrotask(()=>drawTutorial(i));return '<canvas id="tutArt" width="'+400*SKIN_SCALE+'" height="'+140*SKIN_SCALE+'" aria-hidden="true"></canvas>'}
function drawTutorial(i){
  const cv=$('tutArt');if(!cv)return;
  const c=cv.getContext('2d'),skin=currentSkin(),s=16,bx=120,by=6,rows=TUT_SCENES[i];
  c.setTransform(SKIN_SCALE,0,0,SKIN_SCALE,0,0);c.clearRect(0,0,400,140);
  c.drawImage(skinBoard(skin,160,128),bx,by,160,128);
  rows.forEach((row,y)=>[...row].forEach((ch,x)=>{if(ch!=='.')c.drawImage(skinSprite(skin,+ch,s),bx+x*s,by+y*s,s,s)}));
  const line=(pts,col,w=2.4)=>{c.strokeStyle=col;c.lineWidth=w;c.lineCap='round';c.lineJoin='round';c.beginPath();pts.forEach(([x,y],k)=>k?c.lineTo(x,y):c.moveTo(x,y));c.stroke()};
  const arrow=(x,y,dx,dy,col)=>{const l=Math.hypot(dx,dy),ux=dx/l,uy=dy/l;line([[x,y],[x+dx,y+dy]],col);line([[x+dx-ux*7-uy*5,y+dy-uy*7+ux*5],[x+dx,y+dy],[x+dx-ux*7+uy*5,y+dy-uy*7-ux*5]],col)};
  const gold='#ffcf6a',cyan='#7fdcff';
  if(i===0){
    for(const [x,y] of [[3,4],[4,4],[5,4],[4,3]])c.drawImage(skinSprite(skin,3,s,true),bx+x*s,by+y*s,s,s);
    c.strokeStyle=cyan;c.lineWidth=2.4;c.beginPath();c.arc(60,52,18,-Math.PI*.9,Math.PI*.6);c.stroke();arrow(60+18*Math.cos(Math.PI*.6),52+18*Math.sin(Math.PI*.6),-6,2,cyan);
    c.fillStyle=cyan;c.beginPath();c.arc(60,52,4,0,Math.PI*2);c.fill();
    arrow(318,40,-26,0,gold);arrow(346,40,26,0,gold);arrow(332,62,0,42,gold);
  }else if(i===1){
    c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,215,120,.35)';c.fillRect(bx,by+6*s,160,2*s);c.globalCompositeOperation='source-over';
    c.strokeStyle=gold;c.lineWidth=2.4;c.beginPath();c.moveTo(bx+168,by+100);c.quadraticCurveTo(340,4,360,92);c.stroke();arrow(358,84,2,10,gold);
    c.fillStyle='#0b1428';c.fillRect(350,104,20,30);c.fillStyle='#ff4d7d';c.fillRect(352,118,16,14);
    c.font='800 15px Inter,system-ui,sans-serif';c.fillStyle=gold;c.textAlign='center';c.fillText('+4',318,40);
  }else{
    const mx=bx+168;c.fillStyle='#0b1428';c.fillRect(mx,by,10,128);c.strokeStyle='#22324d';c.strokeRect(mx+.5,by+.5,9,127);
    c.fillStyle='#ff4d7d';c.fillRect(mx+1,by+92,8,35);c.fillStyle='#ffb04a';c.fillRect(mx+1,by+62,8,30);
    arrow(bx-22,by+126,0,-40,'#ff6b8a');arrow(bx-38,by+126,0,-28,'#ff6b8a');
    c.font='800 14px Inter,system-ui,sans-serif';c.fillStyle='#ffb04a';c.textAlign='left';c.fillText('+3',mx+16,by+70);c.fillStyle='#ff4d7d';c.fillText('+2',mx+16,by+104);
  }
}
homeView();
