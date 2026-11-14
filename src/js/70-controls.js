/* ---------- buttons ---------- */
document.querySelectorAll('#controls button,#powers button').forEach(b=>{
  b.onclick=()=>{if(!b.dataset.pointerFired)action(b.dataset.action);b.dataset.pointerFired=''};
  const a=b.dataset.action;
  if(HELD[a]){                                   // left, right, soft: held moves (43-handling)
    b.onpointerdown=e=>{
      if(state!=='play'||e.composedPath().some(n=>n.hasAttribute?.('data-mable-debug')))return;
      b.dataset.pointerFired='1';press(a,'p'+e.pointerId);try{b.setPointerCapture(e.pointerId)}catch(_){}
    };
    b.onpointerup=e=>release(a,'p'+e.pointerId);
    b.onpointercancel=e=>{release(a,'p'+e.pointerId);b.dataset.pointerFired=''};
    b.onlostpointercapture=e=>release(a,'p'+e.pointerId);
  }
});
window.addEventListener('blur',()=>{releaseAll();if(state==='play'&&!isOnline())pause()});

/* ---------- touch gestures anywhere on the screen ---------- */
// step: finger travel (game px) per column / row. flick: speed (game px per ms) that counts as a fast swipe.
// step and row are scaled by the touch sensitivity setting (72-controls-ui: applyControls).
const G={step:26,row:28,tap:12,flick:.8,flickMin:40,up:50};
function gIgnore(e){return state!=='play'||!$('modal').hidden||!!e.target.closest?.('button,input,label,a')||e.composedPath().some(n=>n.hasAttribute?.('data-mable-debug'))}
$('root').addEventListener('pointerdown',e=>{
  if(gest||gIgnore(e)||(e.pointerType==='mouse'&&e.button!==0))return;
  const now=performance.now();
  gest={id:e.pointerId,s:parseFloat($('world').style.transform.slice(6))||1,x0:e.clientX,y0:e.clientY,ax:e.clientX,ay:e.clientY,t0:now,axis:'',moved:false,dead:false,piece:boards[0].piece,pts:[{t:now,y:e.clientY}]};
  try{$('root').setPointerCapture(e.pointerId)}catch(_){}
});
$('root').addEventListener('pointermove',e=>{
  const g=gest;if(!g||e.pointerId!==g.id||g.dead)return;
  const now=performance.now();g.pts.push({t:now,y:e.clientY});while(g.pts.length>2&&now-g.pts[0].t>120)g.pts.shift();
  // a new piece (locked or held) ends the gesture so the next piece is not dragged by accident
  if(state!=='play'||boards[0].piece!==g.piece){g.dead=true;return}
  const dx=(e.clientX-g.ax)/g.s,dy=(e.clientY-g.ay)/g.s;
  if(!g.axis){const tx=(e.clientX-g.x0)/g.s,ty=(e.clientY-g.y0)/g.s;if(Math.hypot(tx,ty)<G.tap)return;g.axis=Math.abs(tx)>Math.abs(ty)?'h':'v'}
  if(g.axis==='h'&&dy>G.row*1.5&&dy>Math.abs(dx)){g.axis='v';g.ax=e.clientX}
  else if(g.axis==='v'&&Math.abs(dx)>G.step*1.5&&Math.abs(dx)>Math.max(0,dy)){g.axis='h';g.ay=e.clientY}
  if(g.axis==='h'){while(Math.abs(e.clientX-g.ax)/g.s>=G.step){const dir=e.clientX>g.ax?1:-1;g.ax+=dir*G.step*g.s;action(dir>0?'right':'left');g.moved=true}}
  else{while((e.clientY-g.ay)/g.s>=G.row){g.ay+=G.row*g.s;action('down1');g.moved=true}}
});
function gEnd(e,cancel){
  const g=gest;if(!g||e.pointerId!==g.id)return;gest=null;
  if(cancel||g.dead||state!=='play'||boards[0].piece!==g.piece)return;
  const now=performance.now(),ty=(e.clientY-g.y0)/g.s,p0=g.pts.find(p=>now-p.t<=100)||g.pts[g.pts.length-1],vy=(e.clientY-p0.y)/g.s/Math.max(16,now-p0.t);
  if(!g.axis&&now-g.t0<350){action('rotate');return}
  if(profile.ctl.flick&&g.axis==='v'&&ty>=G.flickMin&&vy>=G.flick){action('hard');return}
  if(g.axis==='v'&&ty<=-G.up)action('hold');
}
$('root').addEventListener('pointerup',e=>gEnd(e,false));
$('root').addEventListener('pointercancel',e=>gEnd(e,true));
// Keyboard: arrows move, Down soft drop, Up / X rotate right, Z / Ctrl rotate left, A half turn, Space hard drop,
// C / Shift hold, P pause, Esc back. Held moves repeat with the player's DAS / ARR, not the OS key repeat.
const KEYS={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'rotate',x:'rotate',X:'rotate',z:'ccw',Z:'ccw',Control:'ccw',a:'r180',A:'r180',
  ArrowDown:'soft',' ':'hard',c:'hold',C:'hold',Shift:'hold'};
const keySrc=e=>'k'+(e.code||e.key);
window.onkeydown=e=>{
  if(e.target.tagName==='INPUT'||e.composedPath().some(n=>n.hasAttribute?.('data-mable-debug')))return;
  if(e.key==='Escape'){e.preventDefault();window.onAndroidBack();return}
  if((e.key==='p'||e.key==='P')&&state==='play'){e.preventDefault();pause();return}
  const a=KEYS[e.key];if(!a)return;
  e.preventDefault();
  if(HELD[a])press(a,keySrc(e));                // repeats of a key that is already held are ignored there
  else if(!e.repeat)action(a);
};
window.onkeyup=e=>release('',keySrc(e));
