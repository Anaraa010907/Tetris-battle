/* ---------- drawing ---------- */
function tile(ctx,x,y,s,v,ghost=false){
  const col=v===8?COLORS[7]:(THEMES[profile.theme]||THEMES[0])[v-1];
  if(ghost){ctx.strokeStyle=col;ctx.lineWidth=1.5;ctx.strokeRect(x+3,y+3,s-6,s-6);return}
  ctx.fillStyle=col;ctx.fillRect(x+1,y+1,s-2,s-2);
  ctx.fillStyle='#ffffff55';ctx.fillRect(x+2,y+2,s-4,Math.max(2,s*.1));
  ctx.fillStyle='#00000033';ctx.fillRect(x+2,y+s-2-Math.max(2,s*.1),s-4,Math.max(2,s*.1));
}
const ctx=$('board').getContext('2d'),rctx=$('rival').getContext('2d');
function drawBoard(c,b,w,h,opts){
  c.setTransform(2,0,0,2,0,0);c.clearRect(0,0,w,h);
  const s=w/W;
  c.strokeStyle='#17243a';c.lineWidth=.5;
  for(let x=0;x<=W;x++){c.beginPath();c.moveTo(x*s,0);c.lineTo(x*s,h);c.stroke()}
  for(let y=0;y<=H;y++){c.beginPath();c.moveTo(0,y*s);c.lineTo(w,y*s);c.stroke()}
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(b.cells[y][x])tile(c,x*s,y*s,s,b.cells[y][x]);
  const p=b.piece;
  if(opts.ghost){let y=p.y;while(!hit(b,p.m,p.x,y+1))y++;for(let r=0;r<p.m.length;r++)for(let x=0;x<p.m[r].length;x++)if(p.m[r][x])tile(c,(p.x+x)*s,(y+r)*s,s,p.id+1,true)}
  for(let r=0;r<p.m.length;r++)for(let x=0;x<p.m[r].length;x++)if(p.m[r][x]&&p.y+r>=0)tile(c,(p.x+x)*s,(p.y+r)*s,s,p.id+1);
  if(opts.warn){
    // red X where the next piece spawns when the stack (plus incoming garbage) reaches the spawn zone
    let top=b.cells.findIndex(r=>r.some(v=>v));if(top<0)top=H;
    if(top-pendingRows(b,false)<=3){
      const id=b.queue[0],m=ROT[id][0],x0=id===1?4:3,y0=-m.findIndex(r=>r.some(v=>v));
      c.strokeStyle='#ff3b5c';c.lineWidth=2.5;c.lineCap='round';
      for(let r=0;r<m.length;r++)for(let x=0;x<m[r].length;x++)if(m[r][x]&&y0+r>=0){
        const px=(x0+x)*s,py=(y0+r)*s,k=s*.25;
        c.beginPath();c.moveTo(px+k,py+k);c.lineTo(px+s-k,py+s-k);c.moveTo(px+s-k,py+k);c.lineTo(px+k,py+s-k);c.stroke();
      }
    }
  }
}
function drawPiece(c,id,cx,cy,s){const m=PREV[id],ox=cx-m[0].length*s/2,oy=cy-m.length*s/2;for(let y=0;y<m.length;y++)for(let x=0;x<m[y].length;x++)if(m[y][x])tile(c,ox+x*s,oy+y*s,s,id+1)}
function next(id,p,s,dim){
  const cv=$(id),c=cv.getContext('2d'),Wd=cv.width/2,Hd=cv.height/2;
  c.setTransform(2,0,0,2,0,0);c.clearRect(0,0,Wd,Hd);if(!(p>=0))return;
  c.globalAlpha=dim?.6:1;drawPiece(c,p,Wd/2,Hd/2,s);c.globalAlpha=1;
}
function drawQueue(b){
  const cv=$('next'),c=cv.getContext('2d'),Wd=cv.width/2,Hd=cv.height/2;
  c.setTransform(2,0,0,2,0,0);c.clearRect(0,0,Wd,Hd);
  let y=18;
  b.queue.slice(0,5).forEach((id,i)=>{drawPiece(c,id,Wd/2,y,i?10:13);y+=i?30:36});
}
function text(id,val){const e=$(id);if(e.textContent!==String(val))e.textContent=val}
function setMeter(id,b,full){
  const el=$(id),ready=Math.min(20,pendingRows(b,true)),all=Math.min(20,pendingRows(b,false));
  const r=ready/20*100+'%',p=(all-ready)/20*100+'%';
  if(el.children[0].style.height!==r)el.children[0].style.height=r;
  if(el.children[1].style.height!==p){el.children[1].style.height=p;el.children[1].style.bottom=r}
}
function render(){
  if(boards.length&&(state==='play'||state==='pause'||state==='over')){
    const b=boards[0],o=boards[1],secs=Math.max(1,b.time);
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
  window.mableTuningFrame?.();
}

