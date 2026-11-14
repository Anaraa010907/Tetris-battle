/* ---------- AI ---------- */
// Scores a placement (El-Tetris weights) and returns the board after it.
// style 0: survive, 1: also likes quads, 2: builds a right-side well for quads and looks one piece ahead.
function evalPlace(cells,m,x,y,style,pend){
  const g=cells.map(r=>r.slice());let top=H,bottom=0;
  for(let r=0;r<m.length;r++)for(let c=0;c<m[r].length;c++)if(m[r][c]){if(y+r<0)return {s:-1e8,g:cells};g[y+r][x+c]=1;top=Math.min(top,y+r);bottom=Math.max(bottom,y+r)}
  const full=[];for(let r=0;r<H;r++)if(g[r].every(v=>v))full.push(r);
  const lines=full.length;let eroded=0;
  for(const r of full)for(let rr=0;rr<m.length;rr++)if(y+rr===r)eroded+=m[rr].filter(v=>v).length;
  if(lines){const kept=g.filter((_,r)=>!full.includes(r));while(kept.length<H)kept.unshift(emptyRow());g.splice(0,H,...kept)}
  const landing=H-(top+bottom)/2;
  let rowT=0,colT=0,holes=0,wells=0,maxH=0;
  const heights=[];
  for(let c=0;c<W;c++){let h=0;for(let r=0;r<H;r++)if(g[r][c]){h=H-r;break}heights.push(h);maxH=Math.max(maxH,h)}
  for(let r=0;r<H;r++){let prev=1;for(let c=0;c<W;c++){const v=g[r][c]?1:0;if(v!==prev)rowT++;prev=v}if(!prev)rowT++}
  for(let c=0;c<W;c++){let prev=0,seen=false;for(let r=0;r<H;r++){const v=g[r][c]?1:0;if(v!==prev)colT++;if(v)seen=true;else if(seen)holes++;prev=v}if(!prev)colT++}
  const keepWell=!pend&&((style===2&&maxH<9)||(style===1&&maxH<6));
  for(let c=0;c<W;c++){
    if(keepWell&&c===W-1)continue;
    const l=c?heights[c-1]:H,rr=c<W-1?heights[c+1]:H,d=Math.min(l,rr)-heights[c];
    if(d>0)wells+=d*(d+1)/2;
  }
  let s=-4.5*landing+3.42*eroded*lines-3.22*rowT-9.35*colT-7.9*holes-3.39*wells;
  if(style>=1&&lines===4)s+=30;
  if(pend&&lines)s+=6*lines;                          // clear to cancel incoming garbage
  if(keepWell){
    if(lines>0&&lines<4)s-=8*lines;
    if(heights[W-1]>0&&lines<4)s-=7*heights[W-1];
  }
  return {s,g};
}
function placements(cells,id,y0,fn){
  const nrot=id===1?1:id===0||id===3||id===4?2:4,b={cells};
  for(let r=0;r<nrot;r++){
    const m=ROT[id][r];
    for(let x=-2;x<W;x++){let y=y0;if(hit(b,m,x,y))continue;while(!hit(b,m,x,y+1))y++;fn(m,r,x,y)}
  }
}
function aiMove(){
  const b=boards[1],p=b.piece,d=rivalCfg,pend=pendingRows(b,false);let best=-1e9,target=null;
  const nextId=b.queue[0],nextY=-ROT[nextId][0].findIndex(r=>r.some(v=>v));
  placements(b.cells,p.id,p.y,(m,r,x,y)=>{
    const e=evalPlace(b.cells,m,x,y,d.style,pend);let s=e.s;
    if(d.style===2&&s>-1e7){let s2=-1e9;placements(e.g,nextId,nextY,(m2,r2,x2,y2)=>{s2=Math.max(s2,evalPlace(e.g,m2,x2,y2,2,pend).s)});s=s*.4+s2}
    s+=(rnd()-.5)*d.noise*20;
    if(s>best){best=s;target={m,r,x,y}}
  });
  if(!target){b.dead=true;finishRound(b);return}
  Object.assign(p,target);b.lastRot=false;lock(b);
}
function aiInterval(){
  const b=boards[1];
  return Math.max(.38,rivalCfg.sec-Math.floor(b.time/30)*.05)*(powersOn()&&b.slow>0?2:1);
}

