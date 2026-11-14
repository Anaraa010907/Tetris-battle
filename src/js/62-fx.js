/* ---------- game feel: effects, progress bars, celebrations ----------
Line clears burst into sparks in the cleared blocks' colours, attacks fly as glowing orbs to the other
board's meter, big clears shake the boards, rising garbage bumps the board and the incoming meter pulses with
a count while garbage is waiting. Everything is drawn on one overlay canvas (#fx) over the boards, only while
something is moving, and capped so cheap phones keep 60 fps. prefers-reduced-motion: no shake, no flying
orbs, fewer sparks, no confetti.

Reusable pieces (later features can call them):
  fxProgress(el,{from,to,min,max,color,left,right,delay,ms})   animated bar inside el, resolves when done
  fxCelebrate({kicker,title,sub,badge,color,button,ms,whileState})  full-screen celebration, resolves on close
  fxBurst(x,y,colors,n,size)                                     sparks at #boards coordinates
Hooks from the rules (40-rules.js lock): fxRows(b) before lines clear, fxLock(b,rows,spin,pc,atk), fxRise(b,n).
*/
const FX_W=452,FX_H=580,FX_K=1.5,FX_SPARKS=120;      // sparks are capped; flashes and orbs always show
const fxMotion=matchMedia('(prefers-reduced-motion: reduce)');
const fxCalm=()=>fxMotion.matches;
let fxParts=[],fxLast=0,fxDrawn=false,fxShakeT=0,fxShakeA=0,fxShakeD=1;
const fxCanvas=(()=>{const cv=document.createElement('canvas');cv.id='fx';cv.width=FX_W*FX_K;cv.height=FX_H*FX_K;cv.setAttribute('aria-hidden','true');$('boards').append(cv);return cv})();
const fxCtx=fxCanvas.getContext('2d');
(()=>{const d=document.createElement('div');d.id='threat';d.hidden=true;d.setAttribute('aria-hidden','true');$('boards').append(d)})();
let fxBoard=null;
// position of an element inside #boards, in world px (offsets ignore the world scale transform)
function fxOffset(el){let x=0,y=0;while(el&&el.id!=='boards'){x+=el.offsetLeft+(el.clientLeft||0);y+=el.offsetTop+(el.clientTop||0);el=el.offsetParent}return {x,y}}
function fxGeom(b){
  const main=b===boards[0],el=$(main?'board':'rival'),o=fxOffset(el);
  return {x:o.x,y:o.y,s:el.clientWidth/W,main,meter:$(main?'meter':'rmeter')};
}
function fxColor(v){const k=currentSkin();return v===8?k.garbage:k.palette[(v-1)%7]}
const fxGlowCache=new Map();
function fxGlow(color){
  let g=fxGlowCache.get(color);
  if(!g){g=skinCanvas(64,64);const c=g.getContext('2d'),r=c.createRadialGradient(32,32,0,32,32,32);
    r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(.25,tone(color,.2,.9));r.addColorStop(1,tone(color,0,0));c.fillStyle=r;c.fillRect(0,0,64,64);fxGlowCache.set(color,g)}
  return g;
}
let fxSparks=0;
function fxAdd(p){if(p.k==='spark'){if(fxSparks>=FX_SPARKS)return;fxSparks++}fxParts.push(p)}
function fxBurst(x,y,colors,n,size=4){
  if(fxCalm())n=Math.ceil(n/3);
  for(let i=0;i<n;i++){
    const a=Math.random()*Math.PI*2,v=60+Math.random()*220;
    fxAdd({k:'spark',x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-90,life:0,max:.45+Math.random()*.4,c:colors[i%colors.length],s:size*(.6+Math.random()*.8)});
  }
}
function fxShake(amp,dur){if(fxCalm())return;if(amp>=fxShakeA*(fxShakeT/fxShakeD||0)){fxShakeA=amp;fxShakeT=fxShakeD=dur}}
function fxPulse(el,cls){if(!el)return;el.classList.remove(cls);void el.offsetWidth;el.classList.add(cls)}
// the rows that are full right after a piece lands, with their cells (called before they are removed)
function fxRows(b){
  const rows=[];for(let y=0;y<H;y++)if(b.cells[y].every(v=>v))rows.push([y,b.cells[y].slice()]);
  return {rows,pend:pendingRows(b,false)};
}
function fxLock(b,fx,spin,pc,atk){
  if(!fx||!$('boards')||!boards.includes(b))return;
  const g=fxGeom(b),n=fx.rows.length,big=n===4||spin===2||pc,combo=Math.max(0,b.combo);
  if(n){
    for(const [y,row] of fx.rows){
      fxAdd({k:'row',x:g.x,y:g.y+y*g.s,w:g.s*W,h:g.s,life:0,max:big?.42:.3,c:big?'#ffe7a3':'#ffffff'});
      const per=g.main?(big?2:1)+(combo>=4?1:0):Math.random()<.5?1:0;
      row.forEach((v,x)=>{if(v)fxBurst(g.x+(x+.5)*g.s,g.y+(y+.5)*g.s,[fxColor(v),'#ffffff'],per,g.main?4.5:2.5)});
    }
    if(g.main){
      if(big)fxShake(pc?9:n===4?7:6,pc?.45:.32);else if(n>=2||combo>=2)fxShake(2.5,.16);
      if(b.b2b>0&&big)fxBurst(g.x+g.s*W/2,g.y+(fx.rows[0][0]+.5)*g.s,['#ffd35c','#fff1c1'],14,5);
    }
    if(pc)fxAdd({k:'ring',x:g.x+g.s*W/2,y:g.y+g.s*H*.55,life:0,max:.8,c:'#ffd35c',r:g.s*12});
  }
  // what is left of the attack after cancelling our own incoming garbage flies to the other board
  const sent=Math.max(0,atk-fx.pend),other=foeOf(b);
  if(sent>0&&!fxCalm()&&!(isOnline()&&!g.main)){
    const to=fxGeom(other),m=fxOffset(to.meter),from=fx.rows.length?fx.rows[0][0]:H/2;
    fxAdd({k:'orb',x0:g.x+g.s*W/2,y0:g.y+(from+.5)*g.s,x1:m.x+to.meter.offsetWidth/2,y1:m.y+to.meter.offsetHeight*.75,life:0,max:.42+(g.main?0:.08),
      c:g.main?'#ffd35c':'#ff5c7a',r:Math.min(22,9+sent*2.2),hit:to.meter,main:g.main});
  }else if(sent>0)fxPulse(fxGeom(other).meter,'hit');
}
function fxRise(b,n){
  if(n<=0||!boards.includes(b))return;
  const g=fxGeom(b),el=$(g.main?'board':'rival');
  if(!fxCalm())fxPulse(el,'rise');
  fxAdd({k:'row',x:g.x,y:g.y+(H-n)*g.s,w:g.s*W,h:n*g.s,life:0,max:.35,c:'#ff4d6d'});
  if(g.main)fxShake(2,.12);
}
function fxFrame(){
  const now=performance.now(),dt=Math.min(.05,(now-(fxLast||now))/1000);fxLast=now;
  if(boards[0]!==fxBoard){fxBoard=boards[0];fxClear()}       // a new game starts clean
  if(fxCeleb&&fxCelebState&&state!==fxCelebState)fxCelebClose();
  // incoming garbage: the meter pulses and shows the count while rows are waiting
  if(boards.length&&(state==='play'||state==='pause')){
    const b=boards[0],all=pendingRows(b,false),ready=pendingRows(b,true),badge=$('threat');
    $('meter').classList.toggle('threat',ready>0);
    const txt=all?'+'+all:'',top=Math.max(0,560-Math.min(20,all)/20*560-22)+'px';
    if(badge.textContent!==txt){badge.textContent=txt;badge.hidden=!all}
    if(badge.style.top!==top)badge.style.top=top;
    badge.classList.toggle('ready',ready>0);
  }
  if(fxShakeT>0){
    fxShakeT=Math.max(0,fxShakeT-dt);const a=fxShakeA*fxShakeT/fxShakeD;
    $('boards').style.transform=fxShakeT?'translate('+((Math.random()-.5)*2*a).toFixed(1)+'px,'+((Math.random()-.5)*2*a).toFixed(1)+'px)':'';
  }
  if(!fxParts.length){if(fxDrawn){fxCtx.setTransform(1,0,0,1,0,0);fxCtx.clearRect(0,0,fxCanvas.width,fxCanvas.height);fxDrawn=false}return}
  const c=fxCtx;c.setTransform(FX_K,0,0,FX_K,0,0);c.clearRect(0,0,FX_W,FX_H);fxDrawn=true;
  c.globalCompositeOperation='lighter';                       // glows add up on the dark boards
  const keep=[];
  for(const p of fxParts){
    p.life+=dt;if(p.life>=p.max){if(p.k==='orb'){fxPulse(p.hit,'hit');fxBurst(p.x1,p.y1,[p.c,'#ffffff'],10,3.5);if(!p.main)fxShake(3,.18)}continue}
    keep.push(p);const q=p.life/p.max;
    if(p.k==='spark'){
      p.vy+=520*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.985;
      c.globalAlpha=1-q;c.fillStyle=p.c;c.fillRect(p.x-p.s/2,p.y-p.s/2,p.s,p.s);
    }else if(p.k==='row'){
      c.globalAlpha=(1-q)*(1-q)*.7;c.fillStyle=p.c;const grow=q*p.h*.8;c.fillRect(p.x,p.y-grow/2,p.w,p.h+grow);c.globalAlpha*=.6;c.fillRect(p.x,p.y-grow,p.w,p.h+grow*2);
    }else if(p.k==='orb'){
      const e=q*q*(3-2*q),mx=(p.x0+p.x1)/2,my=Math.min(p.y0,p.y1)-90;
      for(let k=3;k>=0;k--){
        const t=Math.max(0,e-k*.06),x=(1-t)*(1-t)*p.x0+2*(1-t)*t*mx+t*t*p.x1,y=(1-t)*(1-t)*p.y0+2*(1-t)*t*my+t*t*p.y1,r=p.r*(1-k*.2);
        c.globalAlpha=k?.35/k:1;c.drawImage(fxGlow(p.c),x-r,y-r,r*2,r*2);
      }
    }else if(p.k==='ring'){
      c.globalAlpha=1-q;c.strokeStyle=p.c;c.lineWidth=6*(1-q)+1;c.beginPath();c.arc(p.x,p.y,p.r*(.2+q*1.2),0,Math.PI*2);c.stroke();
    }
  }
  c.globalAlpha=1;c.globalCompositeOperation='source-over';fxParts=keep;fxSparks=keep.reduce((n,p)=>n+(p.k==='spark'),0);
}
function fxClear(){fxParts=[];fxSparks=0;fxShakeT=0;$('boards').style.transform=''}

/* ---------- progress bar ---------- */
// el gets a labelled bar that fills from `from` to `to` (values between min and max). Returns a Promise.
function fxProgress(el,o){
  const span=Math.max(1,o.max-o.min),pct=v=>Math.max(0,Math.min(100,(v-o.min)/span*100));
  el.innerHTML='<div class="fxbar" style="--c:'+(o.color||'#ffbf3a')+'"><div class="fxlab"><span>'+(o.left||'')+'</span><b>'+(o.right||'')+'</b></div>'
    +'<div class="fxtrack"><i class="fxgain"></i><i class="fxfill"></i></div></div>';
  const fill=el.querySelector('.fxfill'),gain=el.querySelector('.fxgain'),a=pct(o.from),z=pct(o.to);
  fill.style.width=Math.min(a,z)+'%';gain.style.left=Math.min(a,z)+'%';gain.style.width='0%';
  const ms=fxCalm()?0:(o.ms||900);
  return new Promise(res=>setTimeout(()=>{
    if(z>=a){gain.style.transition='width '+ms+'ms cubic-bezier(.2,.8,.2,1)';gain.style.width=(z-a)+'%'}
    else{fill.style.transition='width '+ms+'ms ease';fill.style.width=z+'%';gain.classList.add('lost');gain.style.left=z+'%';gain.style.width=(a-z)+'%'}
    setTimeout(res,ms+60);
  },o.delay||0));
}

/* ---------- celebration overlay ---------- */
let fxCeleb=null,fxCelebState='';           // whileState: close by itself when the game leaves that state
function fxCelebrate(o){
  fxCelebClose();
  const el=document.createElement('div'),calm=fxCalm();
  el.id='celebrate';el.style.setProperty('--c',o.color||'#ffbf3a');
  el.innerHTML='<canvas width="504" height="1092"></canvas><div class="crays"></div><div class="cbox"><span class="ckick">'+(o.kicker||'')+'</span>'
    +'<div class="cbadge">'+(o.badge||'')+'</div><h2>'+(o.title||'')+'</h2><p>'+(o.sub||'')+'</p><button class="primary" id="celebOk">'+(o.button||t('continue'))+'</button></div>';
  $('world').append(el);
  const cv=el.querySelector('canvas'),c=cv.getContext('2d'),skin=currentSkin(),bits=[];
  if(!calm)for(let i=0;i<70;i++)bits.push({x:Math.random()*504,y:-40-Math.random()*500,vy:160+Math.random()*220,vx:(Math.random()-.5)*60,a:Math.random()*6,va:(Math.random()-.5)*6,v:1+i%7,s:10+2*Math.floor(Math.random()*4)});
  let last=performance.now(),raf2=0,done;
  const tickC=now=>{
    const dt=Math.min(.05,(now-last)/1000);last=now;c.clearRect(0,0,504,1092);let alive=0;
    for(const p of bits){p.y+=p.vy*dt;p.x+=p.vx*dt;p.a+=p.va*dt;if(p.y<1120){alive++;c.save();c.translate(p.x,p.y);c.rotate(p.a);c.drawImage(skinSprite(skin,p.v,p.s/2),-p.s/2,-p.s/2,p.s,p.s);c.restore()}}
    if(alive)raf2=requestAnimationFrame(tickC);
  };
  if(bits.length)raf2=requestAnimationFrame(tickC);
  const back=window.onAndroidBack;
  const close=()=>{if(fxCeleb!==close)return;fxCeleb=null;cancelAnimationFrame(raf2);window.onAndroidBack=back;el.classList.add('out');setTimeout(()=>el.remove(),calm?0:220);done&&done()};
  fxCeleb=close;fxCelebState=o.whileState||'';
  window.onAndroidBack=()=>{close();return true};
  el.querySelector('#celebOk').onclick=close;
  const t0=performance.now();el.onclick=e=>{if(e.target===el&&performance.now()-t0>700)close()};
  if(o.ms)setTimeout(close,o.ms);
  sound('clear');vibrate();
  return new Promise(r=>done=r);
}
function fxCelebClose(){if(fxCeleb)fxCeleb()}
