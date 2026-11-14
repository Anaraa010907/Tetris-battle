/* ---------- drawing ---------- */
// Cells are pictures from the equipped skin's sprite cache (59-skins.js), snapped to device pixels so the
// 2x canvases stay sharp.
function tile(c,x,y,s,v,ghost=false,skin=currentSkin()){
  c.drawImage(skinSprite(skin,v,s,ghost),Math.round(x*SKIN_SCALE)/SKIN_SCALE,Math.round(y*SKIN_SCALE)/SKIN_SCALE,s,s);
}
// The board background and the locked cells live in one layer per canvas that is repainted only when a
// cell changes (lock, garbage, line clear). A board canvas is redrawn only when its layer, the falling
// piece, the ghost or the danger marks change, so most frames draw nothing at all.
const stackLayers=new Map(),boardSig=new Map();
let layerPaints=0;
function stackLayer(key,b,w,h,skin){
  let L=stackLayers.get(key);
  if(!L||L.skin!==skin||L.w!==w||L.h!==h){
    L={skin,w,h,paint:0,seen:new Int8Array(W*H).fill(-1)};
    L.cv=skinCanvas(w*SKIN_SCALE,h*SKIN_SCALE,()=>L.seen.fill(-1));stackLayers.set(key,L);
  }
  const changed=[],full=L.seen[0]<0;
  for(let y=0,i=0;y<H;y++){const row=b.cells[y];for(let x=0;x<W;x++,i++)if(L.seen[i]!==row[x]){L.seen[i]=row[x];changed.push(i)}}
  if(changed.length){
    const g=L.cv.getContext('2d'),s=w/W,bg=skinBoard(skin,w,h),k=SKIN_SCALE;
    g.setTransform(k,0,0,k,0,0);
    if(full||changed.length>40){                              // first paint, line clears, garbage rising
      g.drawImage(bg,0,0,w,h);
      for(let i=0;i<W*H;i++)if(L.seen[i])g.drawImage(skinSprite(skin,L.seen[i],s),i%W*s,(i/W|0)*s,s,s);
    }else for(const i of changed){                            // a lock: repaint just those cells
      const x=i%W*s,y=(i/W|0)*s;
      g.drawImage(bg,x*k,y*k,s*k,s*k,x,y,s,s);
      if(L.seen[i])g.drawImage(skinSprite(skin,L.seen[i],s),x,y,s,s);
    }
    L.paint=++layerPaints;
  }
  return L;
}
const ctx=$('board').getContext('2d'),rctx=$('rival').getContext('2d');
function drawBoard(c,b,w,h,opts){
  const skin=currentSkin(),s=w/W,p=b.piece,L=stackLayer(c,b,w,h,skin);
  let gy=p.y;if(opts.ghost)while(!hit(b,p.m,p.x,gy+1))gy++;
  // red X where the next piece spawns when the stack (plus incoming garbage) reaches the spawn zone
  let warn=-1;
  if(opts.warn){let top=b.cells.findIndex(r=>r.some(v=>v));if(top<0)top=H;if(top-pendingRows(b,false)<=3)warn=b.queue[0]}
  const sig=L.paint+'|'+p.id+','+p.r+','+p.x+','+p.y+','+gy+','+warn;
  if(boardSig.get(c)===sig)return;
  boardSig.set(c,sig);
  c.setTransform(2,0,0,2,0,0);
  c.drawImage(L.cv,0,0,w,h);                                 // opaque: background, grid and locked cells
  if(opts.ghost)for(let r=0;r<p.m.length;r++)for(let x=0;x<p.m[r].length;x++)if(p.m[r][x]&&gy+r>=0)tile(c,(p.x+x)*s,(gy+r)*s,s,p.id+1,true,skin);
  for(let r=0;r<p.m.length;r++)for(let x=0;x<p.m[r].length;x++)if(p.m[r][x]&&p.y+r>=0)tile(c,(p.x+x)*s,(p.y+r)*s,s,p.id+1,false,skin);
  if(warn>=0){
    const m=ROT[warn][0],x0=warn===1?4:3,y0=-m.findIndex(r=>r.some(v=>v));
    c.beginPath();
    for(let r=0;r<m.length;r++)for(let x=0;x<m[r].length;x++)if(m[r][x]&&y0+r>=0){
      const px=(x0+x)*s,py=(y0+r)*s,k=s*.25;
      c.moveTo(px+k,py+k);c.lineTo(px+s-k,py+s-k);c.moveTo(px+s-k,py+k);c.lineTo(px+k,py+s-k);
    }
    c.lineCap='round';c.strokeStyle='#050a18';c.lineWidth=5;c.stroke();   // dark halo keeps the X readable on any tile
    c.strokeStyle='#ff3b5c';c.lineWidth=2.5;c.stroke();
  }
}
function drawPiece(c,id,cx,cy,s){const m=PREV[id],ox=cx-m[0].length*s/2,oy=cy-m.length*s/2;for(let y=0;y<m.length;y++)for(let x=0;x<m[y].length;x++)if(m[y][x])tile(c,ox+x*s,oy+y*s,s,id+1)}
// hold and next previews are redrawn only when what they show changes
const shownPreview={};
function next(id,p,s,dim){
  const key=currentSkin().id+'|'+p+'|'+s+'|'+!!dim;if(shownPreview[id]===key)return;shownPreview[id]=key;
  const cv=$(id),c=cv.getContext('2d'),Wd=cv.width/2,Hd=cv.height/2;
  c.setTransform(2,0,0,2,0,0);c.clearRect(0,0,Wd,Hd);if(!(p>=0))return;
  c.globalAlpha=dim?.6:1;drawPiece(c,p,Wd/2,Hd/2,s);c.globalAlpha=1;
}
function drawQueue(b){
  const key=currentSkin().id+'|'+b.queue.slice(0,5).join();if(shownPreview.next===key)return;shownPreview.next=key;
  const cv=$('next'),c=cv.getContext('2d'),Wd=cv.width/2,Hd=cv.height/2;
  c.setTransform(2,0,0,2,0,0);c.clearRect(0,0,Wd,Hd);
  let y=18;
  b.queue.slice(0,5).forEach((id,i)=>{drawPiece(c,id,Wd/2,y,i?10:13);y+=i?30:36});
}
// Paint the equipped skin's pictures ahead of time, outside a match, so a match does not start with a stall.
let warmedSkin=null;
function warmSkin(skin){
  for(const s of [28,12,13,10])for(let v=1;v<=8;v++){skinSprite(skin,v,s);if(s===28&&v<8)skinSprite(skin,v,s,true)}
  skinBoard(skin,280,560);skinBoard(skin,120,240);
}
// Forget every cached picture and redraw from scratch: after the app comes back to the front or a canvas
// lost its GPU memory (Android may drop it), cached canvases can come back blank.
function renderReset(){skinCache.clear();stackLayers.clear();boardSig.clear();warmedSkin=null;for(const k in shownPreview)delete shownPreview[k]}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)renderReset()});
for(const id of ['board','rival','next','hold'])$(id).addEventListener('contextrestored',renderReset);
function text(id,val){const e=$(id);if(e.textContent!==String(val))e.textContent=val}
function setMeter(id,b,full){
  const el=$(id),ready=Math.min(20,pendingRows(b,true)),all=Math.min(20,pendingRows(b,false));
  const r=ready/20*100+'%',p=(all-ready)/20*100+'%';
  if(el.children[0].style.height!==r)el.children[0].style.height=r;
  if(el.children[1].style.height!==p){el.children[1].style.height=p;el.children[1].style.bottom=r}
}
function render(){
  const skin=currentSkin();
  if(warmedSkin!==skin&&state!=='play'){warmedSkin=skin;(window.requestIdleCallback||setTimeout)(()=>warmSkin(skin))}
  if(boards.length&&(state==='play'||state==='pause'||state==='over')){
    const b=boards[0],o=boards[1],secs=Math.max(1,b.time);
    applySkinCss(skin);
    drawBoard(ctx,b,280,560,{ghost:true,warn:true});
    drawBoard(rctx,o,120,240,{});
    drawQueue(b);
    next('hold',b.hold,13,!b.canHold);
    $('holdBtn').classList.toggle('used',!b.canHold);
    text('time',fmtTime(b.time));
    text('sPps',(b.pieces/secs).toFixed(2));
    text('sApm',(b.attack/secs*60).toFixed(1));
    text('sVs',((b.attack+b.garbageCleared)/secs*100).toFixed(1));
    text('rinc',powersOn()&&o.slow>0?t('slowActive'):'APM '+(o.attack/secs*60).toFixed(1)+' · PPS '+(o.pieces/secs).toFixed(2));
    setMeter('meter',b);setMeter('rmeter',o);
    if(powersOn()){
      for(let i=0;i<2;i++){
        const el=$('power'+(i+1)),k=powers[i]===undefined?'':['slow','shield','clear'][powers[i]],pp=Math.round(earned/param('powerLines')*100)+'%';
        text('power'+(i+1),powers[i]===undefined?'◇ '+t('earn')+' '+Math.max(1,param('powerLines')-earned):['◷ '+t('slow'),'◇ '+t('shield'),'▱ '+t('clear')][powers[i]]);
        if(el.disabled!==(powers[i]===undefined))el.disabled=powers[i]===undefined;
        if(el.dataset.kind!==k)el.dataset.kind=k;
        if(el.style.getPropertyValue('--p')!==pp)el.style.setProperty('--p',pp);
      }
    }
    let top=b.cells.findIndex(r=>r.some(v=>v));
    $('board').classList.toggle('shielded',powersOn()&&!!b.shield);
    $('board').classList.toggle('danger',top>=0&&top<5);
    const fw=flashTime>0?'4px':'0px';if($('flash').style.borderWidth!==fw)$('flash').style.borderWidth=fw;
  }
  fxFrame();
  if(state==='title')homeView();
  window.mableTuningFrame?.();
}

