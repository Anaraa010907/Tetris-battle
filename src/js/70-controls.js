/* ---------- buttons ---------- */
document.querySelectorAll('#controls button,#powers button').forEach(b=>{
  b.onclick=()=>{if(!b.dataset.pointerFired)action(b.dataset.action);b.dataset.pointerFired=''};
  if(['left','right','soft'].includes(b.dataset.action)){
    b.onpointerdown=e=>{
      if(state!=='play'||e.composedPath().some(n=>n.hasAttribute?.('data-mable-debug')))return;
      b.dataset.pointerFired='1';action(b.dataset.action);heldAction=b.dataset.action;holdTime=0;holdNext=.28;b.setPointerCapture(e.pointerId);
    };
    b.onpointerup=()=>{heldAction=''};
    b.onpointercancel=()=>{heldAction='';b.dataset.pointerFired=''};
    b.onlostpointercapture=()=>{heldAction=''};
  }
});
window.addEventListener('blur',()=>{heldAction='';if(state==='play'&&!isOnline())pause()});

/* ---------- touch gestures anywhere on the screen ---------- */
// step: finger travel (game px) per column / row. flick: speed (game px per ms) that counts as a fast swipe.
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
  if(g.axis==='v'&&ty>=G.flickMin&&vy>=G.flick){action('hard');return}
  if(g.axis==='v'&&ty<=-G.up)action('hold');
}
$('root').addEventListener('pointerup',e=>gEnd(e,false));
$('root').addEventListener('pointercancel',e=>gEnd(e,true));
window.onkeydown=e=>{
  if(e.target.tagName==='INPUT'||e.composedPath().some(n=>n.hasAttribute?.('data-mable-debug')))return;
  if(e.key==='Escape'){e.preventDefault();window.onAndroidBack();return}
  if((e.key==='p'||e.key==='P')&&state==='play'){e.preventDefault();pause();return}
  const a={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'rotate',x:'rotate',X:'rotate',z:'ccw',Z:'ccw',Control:'ccw',a:'r180',A:'r180',
    ArrowDown:'soft',' ':'hard',c:'hold',C:'hold',Shift:'hold'}[e.key];
  if(a){e.preventDefault();if(!e.repeat||['left','right','soft'].includes(a))action(a)}
};

